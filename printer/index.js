const io = require("socket.io-client");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const os = require("os");
const readline = require("readline");

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

// ==================== CONFIG ====================
const deviceName = "PrinterPC";
const tempDir = path.join(os.tmpdir(), "printerpc-mac");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// ==================== AIRPRINT-READY PRINTER DETECTION ====================
function getL4260PrinterName(callback) {
	exec("lpstat -p", (err, stdout) => {
		if (err || !stdout) {
			console.log(
				"Cannot list printers. Is the L4260 on Wi-Fi and AirPrint enabled?"
			);
			return callback(null);
		}

		const lines = stdout.split("\n");
		const printerNames = [];

		for (const line of lines) {
			// Matches both: printer EPSON_L4260_Series is idle...
			// and: printer "EPSON L4260 Series (AirPrint)" is idle...
			const match = line.match(/printer\s+([^"\s]+)|printer\s+"([^"]+)"/);
			if (match) {
				const name = match[1] || match[2];
				if (
					name &&
					(name.toLowerCase().includes("l4260") ||
						name.toLowerCase().includes("4260"))
				) {
					printerNames.push(name);
				}
			}
		}

		if (printerNames.length === 0) {
			console.log("EPSON L4260 not found!");
			console.log("Available printers:");
			console.log(stdout);
			return callback(null);
		}

		// Prefer the clean name without (AirPrint) if both exist
		const preferred =
			printerNames.find((p) => !p.includes("(AirPrint)")) ||
			printerNames[0];
		console.log(`Found printer → ${preferred}`);
		callback(preferred);
	});
}

// ==================== REST OF YOUR CODE (unchanged, just better) ====================
function getDirectImageUrl(rawUrl) {
	const url = rawUrl.trim();
	if (url.includes("lh3.googleusercontent.com/d/")) {
		const clean = url.split("=")[0];
		return clean + "=w2048-h2048";
	}
	return url;
}

async function downloadAndPrint(imageUrl) {
	const filepath = path.join(tempDir, `print_${Date.now()}.jpg`);

	try {
		console.log("Downloading image...");
		const response = await axios({
			url: imageUrl,
			method: "GET",
			responseType: "stream",
			timeout: 60000,
			headers: { "User-Agent": "Mozilla/5.0" },
		});

		const writer = fs.createWriteStream(filepath);
		response.data.pipe(writer);

		await new Promise((resolve, reject) => {
			writer.on("finish", resolve);
			writer.on("error", reject);
			response.data.on("error", reject);
		});

		console.log("Download complete → printing via AirPrint");

		getL4260PrinterName((printerName) => {
			if (!printerName) {
				cleanup();
				return;
			}

			const cmd = `lp -d "${printerName}" -o media=a4 -o fit-to-page -o landscape=no "${filepath}"`;
			exec(cmd, (err, stdout, stderr) => {
				if (err || stderr) {
					console.log("Print failed:", err?.message || stderr);
				} else {
					console.log("Print job sent successfully via AirPrint!\n");
				}
				cleanup();
			});
		});

		function cleanup() {
			setTimeout(() => {
				if (fs.existsSync(filepath)) {
					fs.unlinkSync(filepath);
					console.log("Temp file cleaned up\n");
				}
			}, 15000);
		}
	} catch (err) {
		console.log("Error:", err.message);
		if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
	}
}

// ==================== SOCKET.IO (unchanged) ====================
let socket;
async function start() {
	const socketUrl = await new Promise((resolve) => {
		rl.question(
			"Enter WebSocket server URL (e.g. http://192.168.1.100:3000): ",
			(url) => {
				url = url.trim();
				rl.close();
				resolve(url || "http://192.168.1.100:3000");
			}
		);
	});

	console.log(`\nConnecting to: ${socketUrl}\n`);
	socket = io(socketUrl, { transports: ["websocket"], reconnection: true });

	socket.on("connect", () => {
		socket.emit("join", {
			name: deviceName,
			folder: "/" + deviceName.toLowerCase(),
		});
		console.log(
			`Connected & registered as "${deviceName}"\nReady for :print- links!\n`
		);
	});

	socket.on("chat message", async (data) => {
		const msg = data.msg?.trim();
		if (msg?.toLowerCase().startsWith(":print-")) {
			const url = msg.slice(7).trim();
			if (!url) return console.log("Empty URL");
			console.log(`Print request → ${url}\n`);
			await downloadAndPrint(getDirectImageUrl(url));
		}
	});

	socket.on("disconnect", () => console.log("Disconnected"));
	socket.on("connect_error", (e) =>
		console.log("Connection error:", e.message)
	);
}

console.log("PrinterPC — AirPrint Ready (Epson L4260)\n");
start();

// Keep process alive
setInterval(() => {}, 1 << 30);
