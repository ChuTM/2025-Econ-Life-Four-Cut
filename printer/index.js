const io = require("socket.io-client");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const os = require("os");
const readline = require("readline");

// ==================== ⚙️ CONFIGURATION ====================

// 1. YOUR DEFAULT URL (Hit Enter to use this)
const DEFAULT_URL = "http://192.168.1.115:7721";

// 2. SET FALSE TO PRINT FOR REAL
const DEV_MODE = true;

const deviceName = "PrinterPC";
const tempDir = path.join(os.tmpdir(), "printerpc-mac");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

// ==================== PRINTER DETECTION ====================
function getL4260PrinterName(callback) {
	if (DEV_MODE) return callback("Mock_Epson_L4260_Series");

	exec("lpstat -e", (err, stdout) => {
		if (err || !stdout) return callback(null);
		const printers = stdout
			.split("\n")
			.map((p) => p.trim())
			.filter(Boolean);

		const match = printers.find(
			(p) =>
				p.toLowerCase().includes("l4260") ||
				p.toLowerCase().includes("4260")
		);
		callback(match || null);
	});
}

// ==================== MAIN LOGIC ====================
async function downloadAndPrint(imageID, printMode) {

	const cleanUrl = `https://lh3.googleusercontent.com/d/${imageID}`;

	const filename = `job_${Date.now()}.jpg`;
	const filepath = path.join(tempDir, filename);

	const modeLabel =
		printMode === "RECEIPT" ? "💰 RECEIPT (1/8)" : "🖼️  NORMAL (Full)";

	try {
		console.log(`⬇️  [${modeLabel}] Downloading image...`);

		const response = await axios({
			url: cleanUrl,
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

		const stats = fs.statSync(filepath);
		if (stats.size === 0) throw new Error("Empty file");

		getL4260PrinterName((printerName) => {
			if (!printerName) {
				console.log("❌ No printer found.");
				cleanup(filepath);
				return;
			}

			let options = `-o media=a4 -o landscape=no`;

			if (printMode === "RECEIPT") {
				options += ` -o scaling=35`; // ~1/8th size
			} else {
				options += ` -o fit-to-page`; // Full size
			}

			const cmd = `lp -d "${printerName}" ${options} "${filepath}"`;

			if (DEV_MODE) {
				console.log(`\n🛠️  [DEV_MODE] SKIPPING PHYSICAL PRINT.`);
				console.log(`    Cmd: ${cmd}`);
				cleanup(filepath);
				return;
			}

			console.log(`🖨️  Sending to printer (${printMode})...`);

			exec(cmd, (err, stdout, stderr) => {
				if (err) console.log("❌ Print Failed:", err.message);
				else console.log("✅ Job sent successfully!");
				cleanup(filepath);
			});
		});
	} catch (err) {
		console.log("❌ Error:", err.message);
		if (fs.existsSync(filepath)) cleanup(filepath);
	}
}

function cleanup(filepath) {
	setTimeout(() => {
		if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
	}, 5000);
}

// ==================== SOCKET CONNECTION ====================
let socket;
async function start() {
	// ALWAYS ask for URL now, even in Dev Mode
	const socketUrl = await new Promise((resolve) => {
		rl.question(`Enter Server URL (Default: ${DEFAULT_URL}): `, (url) => {
			url = url.trim();
			// If user types nothing, use the correct default
			resolve(url || DEFAULT_URL);
		});
	});

	// Close readline so it doesn't hang
	// Note: We don't close rl completely if you want to reuse it,
	// but here we are done with input.
	// rl.close();

	console.log(`\n🔌 Connecting to: ${socketUrl}\n`);
	socket = io(socketUrl, { transports: ["websocket"], reconnection: true });

	socket.on("connect", () => {
		socket.emit("join", {
			name: deviceName,
			folder: "/" + deviceName.toLowerCase(),
		});
		console.log(`🟢 Connected!`);
		console.log(`   Waiting for: :print- OR :purchase-confirmed-`);
	});

	socket.on("chat message", async (data) => {
		const msg = data.msg?.trim();
		if (!msg) return;

		const PREFIX_NORMAL = ":print-";
		const PREFIX_RECEIPT = ":purchase-confirmed-";

		if (msg.toLowerCase().startsWith(PREFIX_RECEIPT)) {
			const url = msg.slice(PREFIX_RECEIPT.length).trim();
			if (url) {
				console.log(`----------------------------------------`);
				console.log(`💰 Command: Purchase Confirmed`);
				await downloadAndPrint(url, "RECEIPT");
			}
		} else if (msg.toLowerCase().startsWith(PREFIX_NORMAL)) {
			const url = msg.slice(PREFIX_NORMAL.length).trim();
			if (url) {
				console.log(`----------------------------------------`);
				console.log(`🖼️  Command: Standard Print`);
				await downloadAndPrint(url, "NORMAL");
			}
		}
	});

	socket.on("disconnect", () => console.log("🔴 Disconnected"));
	socket.on("connect_error", (err) =>
		console.log(`⚠️ Connect Error: ${err.message}`)
	);
}

console.log(`PrinterPC - ${DEV_MODE ? "🛠️ TEST MODE" : "🖨️ LIVE MODE"}`);
start();

setInterval(() => {}, 1 << 30);
