// Establish socket connection for admin controls
const socket = io();
const consoleDiv = document.getElementById("console");
const devices = ["iPad", "iMac", "PrinterPC", "Admin"]; // Tracked devices
const authBtn = document.getElementById("google-auth");
const authStatus = document.getElementById("auth-status");

// ---------- Console Logging ----------

/**
 * Adds formatted message to admin console
 * @param {string} message - Message to display
 * @param {string} type - Message type (affects styling)
 */
function log(message, type = "default") {
	const p = document.createElement("p");
	const time = new Date().toLocaleTimeString("en-HK", { hour12: false });
	p.innerHTML = `<span style="opacity:0.6;">${time}</span> - ${message}`;

	// Map message types to CSS classes
	const typeClasses = {
		command: "console-command",
		response: "console-response",
		error: "console-error",
		join: "console-join",
		leave: "console-leave",
		chat: "console-chat",
		server: "console-server",
	};
	p.className = typeClasses[type] || "";

	// Auto-detect error messages
	if (
		!type &&
		(message.toLowerCase().includes("error") ||
			message.toLowerCase().includes("fail"))
	) {
		p.className = "console-error";
	}

	consoleDiv.appendChild(p);
	consoleDiv.scrollTop = consoleDiv.scrollHeight; // Auto-scroll to bottom
}

// ---------- Device Status Management ----------

/**
 * Updates device online/offline status in UI
 * @param {Array} users - List of connected users/devices
 */
function updateStatus(users) {
	devices.forEach((device) => {
		const el = document.getElementById(device.toLowerCase() + "-status");
		const isOnline = users.some((user) => user.name === device);
		el.textContent = isOnline ? "Online" : "Offline";
		el.className = isOnline ? "online" : "offline";
	});
}

// ---------- Google Drive Authentication ----------

/**
 * Checks and updates Google Drive authentication status
 */
async function checkAuthStatus() {
	try {
		const res = await fetch("/auth-status");
		const data = await res.json();
		if (data.googleDriveAuthenticated) {
			authStatus.textContent = "Connected";
			authStatus.style.color = "#0f0";
			authBtn.disabled = true;
			authBtn.textContent = "Authenticated";
		} else {
			authStatus.textContent = "Not connected";
			authStatus.style.color = "#f00";
			authBtn.disabled = false;
			authBtn.textContent = "Sign-in with Google";
		}
	} catch (e) {
		log("Auth status error", "error");
	}
}

// Trigger authentication flow
authBtn.addEventListener("click", () => {
	location.href = "/auth";
});

// Periodically check auth status
setInterval(checkAuthStatus, 8000);
checkAuthStatus(); // Initial check

// ---------- Socket Communication ----------

// Handle initial connection
socket.on("connect", () => {
	socket.emit("join", { name: "Admin", folder: "/admin" });
	log("Connected to server", "server");
});

// Handle user connection events
socket.on("user joined", (data) => {
	log(`User joined: ${data.name}`, "join");
	updateStatus(data.users);
});

// Handle user disconnection events
socket.on("user left", (data) => {
	log(`User left: ${data.name}`, "leave");
	updateStatus(data.users);
});

// Handle incoming chat messages
socket.on("chat message", (data) => {
	log(`Message from ${data.name}: ${data.msg}`, "chat");
});

// Handle IP address notification
socket.on("ip", (data) => {
	log(`IP: ${data.full}`);
	log('Turn on "Insecure origins treated as secure"');
});

/**
 * Sends chat message to server
 * @param {string} msg - Message content
 */
function message(msg) {
	socket.emit("chat message", { name: "Admin", msg });
}

// ---------- UI Control Handlers ----------

// Test message button
document.getElementById("send-test").addEventListener("click", () => {
	message("Test message sent from Admin");
	log("Sent test message", "chat");
});

// Send custom message button
document.getElementById("send-message").addEventListener("click", () => {
	const inp = document.getElementById("message-input");
	const msg = inp.value.trim();
	if (!msg) return;
	inp.value = "";
	message(msg);
	log(`Message sent: ${msg}`, "chat");
});

// Send command button
document.getElementById("send-command").addEventListener("click", () => {
	const inp = document.getElementById("command-input");
	const cmd = inp.value.trim();
	if (!cmd) return;
	inp.value = "";
	socket.emit("command", cmd);
	log(`Command sent: ${cmd}`, "command");
	try {
		eval(`commandSet.${cmd}`); // Execute local command if exists
	} catch (e) {}
});

// ---------- Admin Command Set ----------

const commandSet = {
	/** Clears console history */
	clear() {
		consoleDiv.innerHTML =
			'<p class="console-server">------- Refreshed -------</p>';
	},
	/** Shows available commands */
	help() {
		log(
			'Available commands: clear, reload() -> iMac, alert("hi") -> iPad, etc.',
			"server"
		);
	},
};

// Allow Enter key to send commands
document.getElementById("command-input").addEventListener("keypress", (e) => {
	if (e.key === "Enter") document.getElementById("send-command").click();
});
