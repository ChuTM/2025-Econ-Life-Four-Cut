// Establish socket connection for real-time communication
const socket = io();
const deviceName = "iMac";
let sessionId = null; // Unique session identifier for file uploads
let filter = null; // Image filter configuration

/**
 * Logs messages with timestamp for debugging/monitoring
 * @param {string} msg - Message to log
 */
function consoleLog(msg) {
	console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

// Request fullscreen mode when document is clicked (improves user experience)
document.addEventListener("click", () => {
	document.body.requestFullscreen().catch(() => {});
});

// DOM elements for video processing and UI
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const countdownDiv = document.getElementById("countdown");
const blurOverlay = document.getElementById("blur-overlay");
const clickSound = document.getElementById("click-sound");
let stream = null; // Media stream from camera

// ---------- Camera Control ----------

/**
 * Initializes camera stream with high-res preference
 * Tries fallback to standard resolution if high-res fails
 */
function startCamera() {
	if (stream) return; // Exit if camera is already active

	// High-resolution constraints (1080p)
	const constraints = {
		video: {
			facingMode: "user",
			width: { ideal: 1920, min: 1920 },
			height: { ideal: 1080, min: 1080 },
		},
	};

	navigator.mediaDevices
		.getUserMedia(constraints)
		.then((s) => {
			stream = s;
			video.srcObject = s;
			video.style.display = "block";
			video.style.filter = "blur(10px)"; // Keep video blurred initially
			const settings = s.getVideoTracks()[0].getSettings();
			consoleLog(`Camera started: ${settings.width}x${settings.height}`);
		})
		.catch((e) => {
			consoleLog("High-res failed: " + e.message + " – trying fallback");
			// Fallback to default resolution
			navigator.mediaDevices
				.getUserMedia({ video: { facingMode: "user" } })
				.then((s) => {
					stream = s;
					video.srcObject = s;
					video.style.display = "block";
					video.style.filter = "blur(10px)";
					const settings = s.getVideoTracks()[0].getSettings();
					consoleLog(
						`Fallback: ${settings.width}x${settings.height}`
					);
				})
				.catch((e2) =>
					consoleLog("Camera failed completely: " + e2.message)
				);
		});
}

/**
 * Removes video blur and notifies system camera is ready
 */
function unblur() {
	if (!stream) startCamera(); // Ensure camera is active
	video.style.filter = "none";
	socket.emit("chat message", { name: deviceName, msg: ":camera-ready" });
}

/**
 * Applies blur effect to video
 */
function blurVideo() {
	video.style.filter = "blur(10px)";
}

/**
 * Stops camera stream and hides video element
 */
function stopCamera() {
	if (stream) {
		stream.getTracks().forEach((t) => t.stop()); // Stop all media tracks
		stream = null;
	}
	video.srcObject = null;
	video.style.display = "none";
}

// ---------- Countdown Timer ----------

/**
 * Starts a countdown before triggering image capture
 * @param {number} seconds - Duration of countdown in seconds
 */
function startCountdown(seconds) {
	blurOverlay.style.display = "block";
	countdownDiv.style.display = "block";
	let count = seconds;
	countdownDiv.textContent = count;

	const interval = setInterval(() => {
		count--;
		if (count > 0) {
			countdownDiv.textContent = count;
		} else {
			clearInterval(interval);
			captureImage(); // Trigger capture when countdown ends
			blurOverlay.style.display = "none";
			countdownDiv.style.display = "none";
		}
	}, 1000);
}

// ---------- Image Capture & Upload ----------

/**
 * Captures video frame, applies filters, and uploads image to server
 */
async function captureImage() {
	if (!stream || !video.videoWidth) return consoleLog("Capture failed");

	video.pause();
	// Match canvas dimensions to video resolution
	canvas.width = video.videoWidth;
	canvas.height = video.videoHeight;
	const ctx = canvas.getContext("2d");

	// Reset canvas state
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// Mirror front camera (selfie view)
	ctx.scale(-1, 1);
	ctx.translate(-canvas.width, 0);

	// Apply active filters if available
	if (filter && typeof filter === "object") {
		let filterStr = "";
		// Map of valid CSS filter functions
		const validFilters = {
			sepia: (v) => `sepia(${v})`,
			grayscale: (v) => `grayscale(${v})`,
			brightness: (v) => `brightness(${v})`,
			contrast: (v) => `contrast(${v})`,
			saturate: (v) => `saturate(${v})`,
			invert: (v) => `invert(${v})`,
			opacity: (v) => `opacity(${v})`,
			"hue-rotate": (v) => `hue-rotate(${v})`,
		};

		// Build filter string from valid properties
		Object.keys(filter).forEach((key) => {
			const val = filter[key];
			if (val !== undefined && validFilters[key]) {
				filterStr += validFilters[key](val) + " ";
			}
		});

		if (filterStr) {
			ctx.filter = filterStr.trim();
		}
	}

	// Draw filtered video frame to canvas
	ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
	ctx.filter = "none"; // Reset filter for future draws
	video.play();

	// Play shutter sound effect
	clickSound.currentTime = 0;
	clickSound.play().catch(() => {});

	if (!sessionId) {
		consoleLog("No sessionId – cannot upload");
		socket.emit("chat message", { name: deviceName, msg: ":camera-ready" });
		return;
	}

	// Prepare image for upload
	const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
	const form = new FormData();
	form.append("image", blob, `${sessionId}-${Date.now()}.png`);
	form.append("sessionId", sessionId);

	try {
		const res = await fetch("/upload-image", {
			method: "POST",
			body: form,
		});
		const data = await res.json();
		if (data.success && data.link) {
			// Update UI with captured image
			document.body.style.setProperty(
				"--captured-image",
				`url(${data.link})`
			);
			document
				.querySelector(".animation-captured")
				.classList.add("animates");
			socket.emit("chat message", {
				name: deviceName,
				msg: `:animation-started-${data.link}`,
			});
			// Remove animation after delay
			setTimeout(() => {
				document
					.querySelector(".animation-captured")
					.classList.remove("animates");
			}, 1500);
		}
		consoleLog("Upload response: " + JSON.stringify(data));
	} catch (e) {
		consoleLog("Upload error: " + e.message);
	}

	// Notify system camera is ready for next capture
	setTimeout(() => {
		socket.emit("chat message", { name: deviceName, msg: ":camera-ready" });
	}, 1000);
}

// ---------- Socket Communication ----------

// Handle initial connection
socket.on("connect", () => {
	socket.emit("join", {
		name: deviceName,
		folder: "/" + deviceName.toLowerCase(),
	});
	consoleLog("Connected");
});

// Store session ID when received from server
socket.on("session-id", (sid) => {
	sessionId = sid;
	consoleLog("Session ID: " + sid);
});

// Handle remote commands from server/admin
socket.on("command", (cmd) => {
	consoleLog(`Command: ${cmd}`);
	const m = cmd.match(/^(.*?)\s*->\s*(.*?)$/);
	if (m) {
		const command = m[1].trim(),
			target = m[2].trim();
		// Execute command if target matches this device or "all"
		if (target === deviceName || target === "all") {
			try {
				const r = eval(command); // Caution: eval can be security risk
				socket.emit("command response", {
					to: "Admin",
					from: deviceName,
					response: `${r}`,
				});
			} catch (e) {
				socket.emit("command response", {
					to: "Admin",
					from: deviceName,
					response: `Error: ${e.message}`,
				});
			}
		}
	} else {
		try {
			eval(cmd); // Execute simple commands
		} catch {}
	}
});

// Start camera on initial load
startCamera();

// Handle incoming chat messages/commands
socket.on("chat message", (data) => {
	consoleLog(`Chat from ${data.name}: ${data.msg}`);
	const msg = data.msg.trim();

	// Parse command messages
	if (msg === ":ready") startCamera();
	else if (msg === ":start") unblur();
	else if (msg === ":end") blurVideo();
	else if (msg === ":stop") stopCamera();
	else if (msg === ":capture") captureImage();
	else if (msg.startsWith(":countdown-") && msg.endsWith("-capture")) {
		const seconds = parseInt(msg.split("-")[1]);
		if (!isNaN(seconds) && seconds > 0) startCountdown(seconds);
	} else if (msg.startsWith(":filter-")) {
		// Apply image filter from message
		const filterJson = msg.replace(":filter-", "");
		filter = JSON.parse(filterJson);
		let filterStr = "";
		Object.keys(filter).forEach((k) => {
			if (filter[k] !== undefined) filterStr += `${k}(${filter[k]}) `;
		});
		video.style.filter = filterStr;
		console.log(filterStr);
	}
});
