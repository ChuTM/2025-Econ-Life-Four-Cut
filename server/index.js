const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { google } = require("googleapis");
const sharp = require("sharp");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 7721;

const localIP =
	Object.values(require("os").networkInterfaces())
		.flat()
		.find((i) => i.family === "IPv4" && !i.internal)?.address ||
	"127.0.0.1";

// ---------- Google OAuth (token.js) ----------

const { OAUTH_CONFIG, DRIVE_FOLDER_ID } = require("./token");

const oauth2Client = new google.auth.OAuth2(
	OAUTH_CONFIG.clientId,
	OAUTH_CONFIG.clientSecret,
	OAUTH_CONFIG.redirectUri
);

const TOKEN_PATH = path.join(__dirname, "token.json");
let driveTokens = null;

function loadTokens() {
	if (fs.existsSync(TOKEN_PATH)) {
		const data = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
		oauth2Client.setCredentials(data);
		return data;
	}
	return null;
}
function saveTokens(tokens) {
	fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}
driveTokens = loadTokens();
const drive = google.drive({ version: "v3", auth: oauth2Client });

// ---------- OAuth routes ----------
app.get("/auth", (req, res) => {
	const url = oauth2Client.generateAuthUrl({
		access_type: "offline",
		prompt: "consent",
		scope: ["https://www.googleapis.com/auth/drive.file"],
	});
	res.redirect(url);
});

app.get("/oauth2callback", async (req, res) => {
	const { code } = req.query;
	if (!code) return res.status(400).send("No code");
	try {
		const { tokens } = await oauth2Client.getToken(code);
		oauth2Client.setCredentials(tokens);
		driveTokens = tokens;
		saveTokens(tokens);
		res.send(`
			<h2>Success!</h2>
			<p>Google Drive connected.</p>
			<p><a href="/admin">Back to Admin</a></p>
			<script>setTimeout(() => window.close(), 2000);</script>
		`);
	} catch (e) {
		console.error("OAuth error:", e);
		res.status(500).send("Authentication failed");
	}
});

app.get("/auth-status", (req, res) => {
	res.json({
		googleDriveAuthenticated: !!driveTokens,
		hasRefreshToken: !!(driveTokens && driveTokens.refresh_token),
	});
});

// ---------- Static + HTML routes ----------
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) =>
	res.sendFile(path.join(__dirname, "public", "index.html"))
);
app.get("/admin", (req, res) =>
	res.sendFile(path.join(__dirname, "public", "admin.html"))
);
app.get("/iPad", (req, res) =>
	res.sendFile(path.join(__dirname, "public", "ipad.html"))
);
app.get("/iMac", (req, res) =>
	res.sendFile(path.join(__dirname, "public", "iMac.html"))
);
app.get("/printerPC", (req, res) =>
	res.sendFile(path.join(__dirname, "public", "printerPC.html"))
);

// ---------- Multer (file upload) ----------
const upload = multer({ storage: multer.memoryStorage() });

let imagePathMap = [];

// ---------- HTTP Image Upload ----------
app.post("/upload-image", upload.single("image"), async (req, res) => {
	if (!req.file || !req.body.sessionId) {
		return res
			.status(400)
			.json({ success: false, message: "Missing image or sessionId" });
	}

	const sessionId = req.body.sessionId;
	const uploadDir = path.join(
		__dirname,
		"public",
		"uploads",
		String(sessionId)
	);
	if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
	const fileName = `${sessionId}-${Date.now()}.png`;

	const localPath = path.join(uploadDir, fileName);
	fs.writeFileSync(localPath, req.file.buffer);

	imagePathMap.push(localPath);

	// store the uploaded file path for later use in composite
	const userLinks = imagePathMap;
	const imageIndex = userLinks.length - 1;
	currentUploadLinks[imageIndex] = localPath;

	// Generate preview

	const previewLocalPath = localPath.replace(".png", "-preview.webp");

	await sharp(localPath)
		.resize(800) // Smaller preview
		.webp({ quality: 80 })
		.toFile(previewLocalPath);

	res.json({
		success: true,
		link: `/uploads/${String(sessionId)}/${fileName}`,
	});
});

async function uploadToGoogleDrive(localPath) {
	// ---- Drive upload (if token exists) ----
	if (!driveTokens) {
		console.warn("No Google token – saved locally only");
		return { success: true, localOnly: true, path: localPath };
	}

	try {
		const fileMetadata = {
			name: path.basename(localPath),
			parents: [DRIVE_FOLDER_ID],
		};
		const media = {
			mimeType: "image/png",
			body: fs.createReadStream(localPath),
		};

		// 1. Create the file
		const driveRes = await drive.files.create({
			resource: fileMetadata,
			media: media,
			fields: "id, webViewLink",
		});

		// 2. ALLOW ANYONE TO VIEW (Add Permissions)
		await drive.permissions.create({
			fileId: driveRes.data.id,
			requestBody: {
				role: "reader", // Allows viewing
				type: "anyone", // Allows public access
			},
		});

		// 3. Return the ID or Link
		// Note: You can get the ID directly via driveRes.data.id
		// instead of regexing the link, but keeping your logic below:
		const link = driveRes.data.webViewLink.match(
			/\/d\/([A-Za-z0-9_-]+)/
		)[1];

		return link;
	} catch (err) {
		console.error("Drive upload error:", err);
		return false;
	}
}

function generateCompositeImage(
	frameDefinition,
	imageMap,
	resultFileName,
	destinationFolder
) {
	const { w, h } = frameDefinition.Resolution;
	const OUTPUT_PATH = path.resolve(
		__dirname,
		destinationFolder,
		resultFileName
	);

	async function generate() {
		const start = Date.now();
		const composites = [];

		// Background
		composites.push({
			input: await sharp(
				path.resolve(__dirname, frameDefinition.background)
			)
				.resize(w, h)
				.toBuffer(),
			left: 0,
			top: 0,
		});

		// Photos – skip missing ones gracefully
		for (const item of frameDefinition.images) {
			const src = imageMap[item.src];
			if (!src) continue;

			const absolutePath = path.resolve(__dirname, src);

			try {
				const buffer = await sharp(absolutePath)
					.resize(item.w, item.h, {
						fit: "cover",
						position: "centre",
					})
					.toBuffer();

				composites.push({ input: buffer, left: item.x, top: item.y });
			} catch (err) {
				console.warn(`⚠️  Skipping missing/invalid photo: ${src}`);
				// Optionally draw a placeholder
				const placeholder = Buffer.from(
					`<svg width="${item.w}" height="${
						item.h
					}"><rect width="100%" height="100%" fill="#cccccc"/><text x="50%" y="50%" font-size="48" text-anchor="middle" dy=".3em" fill="#666666">${item.src
						.replace("{{image-", "")
						.replace("}}", "")}</text></svg>`
				);
				composites.push({
					input: await sharp(placeholder).png().toBuffer(),
					left: item.x,
					top: item.y,
				});
			}
		}

		// Foreground
		composites.push({
			input: await sharp(
				path.resolve(__dirname, frameDefinition.foreground)
			)
				.resize(w, h)
				.toBuffer(),
			left: 0,
			top: 0,
		});

		// create output directory if not exists
		const outputDir = path.dirname(OUTPUT_PATH);
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		// One-shot composite
		await sharp({
			create: {
				width: w,
				height: h,
				channels: 4,
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			},
		})
			.composite(composites)
			.jpeg({ quality: 95 })
			.toFile(OUTPUT_PATH);

		console.log(`✓ Done in ${Date.now() - start} ms → ${OUTPUT_PATH}`);

		io.emit("chat message", {
			name: "Server",
			msg: `:local-link-/outputs/output_${id}.jpg`,
		});

		const compositeLocalPath = path.join(
			__dirname,
			"public",
			"outputs",
			`output_${id}.jpg`
		);

		uploadToGoogleDrive(compositeLocalPath).then((link) => {
			if (link) {
				io.emit("chat message", {
					name: "Server",
					msg: `:google-drive-link-${link}`,
				});
			} else {
				io.emit("chat message", {
					name: "Server",
					msg: `:google-drive-failed`,
				});
			}
		});
	}

	generate().catch(console.error);
}

// ---------- Session state ----------
const users = new Map();
let id,
	pastID = [],
	n = 0;
let currentUploadLinks = [];

// generateId 32 character UUID
function generateId() {
	let newId;
	do {
		newId = generateUUID();
	} while (pastID.includes(newId)); // Ensure ID is unique
	pastID.push(newId);
	return newId;
}

function generateUUID() {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
		/[xy]/g,
		function (c) {
			var r = (Math.random() * 16) | 0,
				v = c == "x" ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		}
	);
}

let frameID = "default";

function addToRecord(item, data) {
	const tableID = id;

	// Save to /records.json
	const filePath = path.join(__dirname, `records.json`);

	// if no
	if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
		fs.writeFileSync(filePath, "[]"); // Create an empty JSON array if file doesn't exist
	}

	let records = JSON.parse(fs.readFileSync(filePath, "utf8"));

	let recordFound = false;
	for (let i = 0; i < records.length; i++) {
		if (records[i].tableID === tableID) {
			records[i][item] = data;
			recordFound = true;
			break;
		}
	}

	if (!recordFound) {
		const newRecord = { tableID };
		newRecord[item] = data;
		records.push(newRecord);
	}

	fs.writeFileSync(filePath, JSON.stringify(records));
}

// ---------- Socket.IO (control only) ----------
io.on("connection", (socket) => {
	console.log(`Socket connected: ${socket.id}`);

	socket.on("join", ({ name, folder } = {}) => {
		socket.username = name || "Anonymous";
		users.set(socket.id, { name: socket.username });
		console.log(`User connected: ${socket.username}`);
		io.emit("user joined", {
			id: socket.id,
			name: socket.username,
			users: Array.from(users.values()),
		});

		if (socket.username === "Admin") {
			io.emit("ip", {
				ip: localIP,
				port: PORT,
				full: `http://${localIP}:${PORT}`,
			});
		}
	});

	socket.on("command", (command) => io.emit("command", command));

	socket.on("chat message", (data) => {
		io.emit("chat message", { name: data.name, msg: data.msg });

		if (data.msg.startsWith(":frame-")) {
			frameID = data.msg.split("-")[1];

			addToRecord("frame", frameID);
		}

		if (data.msg.startsWith(":filter-")) {
			const filter = data.msg.replace(":filter-", "");
			addToRecord("filter", filter);
		}

		if (data.msg.startsWith(":animation-started-")) {
			addToRecord("image-count", ++n);
		}

		if (data.msg === ":start") {
			id = generateId();
			n = 0;
			currentUploadLinks = [];
			imagePathMap = [];
			io.emit("chat message", {
				name: "Server",
				msg: `Session ${id} started`,
			});
			// tell all clients the session ID
			io.emit("session-id", id);

			addToRecord("participated", true);
		}

		if (data.msg.startsWith(":purchase-confirmed")) {
			addToRecord("purchase", true);
		}

		if (data.msg.startsWith(":print")) {
			addToRecord("print", true);
		}

		if (data.msg.startsWith(":generate-")) {
			// Extract the JSON array part after ":generate-"
			const jsonPart = data.msg.slice(10); // ":generate-".length === 10

			let imagePaths = [];
			try {
				imagePaths = JSON.parse(jsonPart);
				if (!Array.isArray(imagePaths)) throw new Error("Not an array");
			} catch (err) {
				console.error(
					"Invalid :generate- command - JSON array expected",
					err
				);
				return;
			}

			// Optional: basic validation (e.g. max 10 images, only strings, etc.)
			if (imagePaths.length === 0 || imagePaths.length > 20) {
				console.error("Invalid number of images:", imagePaths.length);
				return;
			}

			// --- 1. Clean up old preview files ---
			const uploadDir = path.join(
				__dirname,
				"public",
				"uploads",
				String(id)
			);
			if (fs.existsSync(uploadDir)) {
				const files = fs.readdirSync(uploadDir);
				for (const file of files) {
					if (file.endsWith("-preview.webp")) {
						fs.unlinkSync(path.join(uploadDir, file));
					}
				}
			}

			// --- 2. Load frame definition ---
			const frameDefinitionPath = path.join(
				__dirname,
				"public",
				"frames",
				"jsons",
				`${frameID}.json`
			);

			if (!fs.existsSync(frameDefinitionPath)) {
				console.error(
					`Frame definition not found for frameID: ${frameID}`
				);
				return;
			}

			const frameDefinition = JSON.parse(
				fs.readFileSync(frameDefinitionPath, "utf8")
			);

			// --- 3. Build imageMap from the received array ---
			const imageMap = {};
			imagePaths.forEach((imgPath, index) => {
				// Sanitize / normalize the path to prevent directory traversal
				const safePath = imgPath.split('/uploads/')[1];
				const fullPath = path.join(
					__dirname,
					"public",
					"uploads",
					safePath
				);

				// Optional: extra security - ensure it really exists and is inside the session folder
				if (
					!fs.existsSync(fullPath) ||
					!fullPath.startsWith(uploadDir + path.sep)
				) {
					console.warn(
						`Image not found or access denied: ${fullPath}`
					);
					return;
				}

				imageMap[`{{image-${index + 1}}}`] = fullPath; // use absolute path for generateCompositeImage
			});

			// If no valid images were mapped, abort
			if (Object.keys(imageMap).length === 0) {
				console.error("No valid images provided for generation");
				return;
			}

			// --- 4. Generate the composite ---
			const outputFilename = `output_${id}.jpg`;
			const outputDir = path.join(__dirname, "public", "outputs");

			generateCompositeImage(
				frameDefinition,
				imageMap,
				outputFilename,
				outputDir
			);
		}
	});

	socket.on("disconnect", () => {
		const info = users.get(socket.id) || { name: "Anonymous" };
		console.log(`User disconnected: ${info.name}`);
		users.delete(socket.id);
		io.emit("user left", {
			id: socket.id,
			name: info.name,
			users: Array.from(users.values()),
		});
	});
});

server.listen(PORT, () => {
	console.log(`Server listening on http://localhost:${PORT}`);
	console.log(`Google auth: http://localhost:${PORT}/auth`);
	console.log(`Auth status: http://localhost:${PORT}/auth-status`);
	console.log(
		`Image upload endpoint: POST /upload-image (multipart/form-data)`
	);
});
