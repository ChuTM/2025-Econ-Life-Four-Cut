// Prevent default gesture behaviors that might interfere with UI
document.addEventListener("gesturestart", function (e) {
	e.preventDefault();
});
document.addEventListener("doubleclick", function (e) {
	e.preventDefault();
});

// Prevent default click behavior for non-interactive elements
var allElements = document.getElementsByTagName("*");
for (let i = 0; i < allElements.length; i++) {
	allElements[i].addEventListener("click", function (e) {
		// Allow clicks on inputs and links
		if (e.target.tagName == "INPUT" || e.target.tagName == "A") return;
		e.preventDefault();
	});
}

// DOM query helper (returns single element or collection)
const $ = (s) =>
	document.querySelectorAll(s).length > 1
		? document.querySelectorAll(s)
		: document.querySelector(s);

// Socket connection and device configuration
const socket = io();
const deviceName = "iPad";
let sessionId = null;

// Handle start button click - navigate to frame selection
$(".start-button").addEventListener("click", () => {
	socket.emit("chat message", { name: deviceName, msg: ":start" });
	$(".page-2").style.display = "block";
	$(".page-1").style.display = "none";
});

$(".leave-button").forEach((e) => {
	e.addEventListener("click", () => {
		location.reload();
	});
});

// Frame selection handlers
$(".frame").forEach((e) => {
	e.addEventListener("click", () => {
		// Toggle selection state
		if (e.classList.contains("selected")) {
			$(".frame-button").classList.remove("continue");
			return e.classList.remove("selected");
		}

		// Set as selected and enable continue button
		$(".frame-button").classList.add("continue");
		$(".frame").forEach((f) => f.classList.remove("selected"));
		e.classList.add("selected");
	});
});

let selectedFrame, framePictureAmount; // Selected frame properties

// Handle frame confirmation - navigate to filter selection
$(".frame-button").addEventListener("click", () => {
	if (!$(".frame-button").classList.contains("continue")) return;

	// Get selected frame details
	selectedFrame = $(".selected").id;
	framePictureAmount = $(".selected").getAttribute("data-pictures-required");

	// Notify system of frame selection
	socket.emit("chat message", {
		name: deviceName,
		msg: `:frame-${selectedFrame}-${framePictureAmount}`,
	});

	$(".page-3").style.display = "block";
	$(".page-2").style.display = "none";
});

// ---------- Filter Swipe Functionality ----------

let currentFilterIndex = 0; // Track active filter index

/**
 * Scrolls to specific filter with smooth animation
 * @param {number} index - Index of filter to display
 */
function snapToFilterIndex(index) {
	const filterWrapper = $(".page-3 .wrapper");
	const filters = filterWrapper.querySelectorAll(".filter");

	if (index < 0 || index >= filters.length) return;

	// Calculate scroll position to center filter
	const targetFilter = filters[index];
	const target =
		targetFilter.offsetLeft -
		(filterWrapper.clientWidth - targetFilter.clientWidth) / 2;
	filterWrapper.scrollTo({
		left: target,
		behavior: "smooth",
	});

	currentFilterIndex = index;
	syncFilter(); // Update server with current filter
}

const filterWrapper = $(".page-3 .wrapper");
let startTouchX = 0;
let startTime = 0;

// Track touch start for swipe detection
filterWrapper.addEventListener("touchstart", (e) => {
	startTouchX = e.touches[0].clientX;
	startTime = Date.now();
});

// Handle touch end for swipe completion
filterWrapper.addEventListener("touchend", (e) => {
	const endTouchX = e.changedTouches[0].clientX;
	const endTime = Date.now();
	const deltaX = endTouchX - startTouchX;
	const deltaTime = endTime - startTime || 1; // Prevent division by zero
	const velocity = deltaX / deltaTime; // Pixels per millisecond

	// Determine if swipe is significant enough to change filter
	if (Math.abs(deltaX) > 30 && velocity < -0.3) {
		currentFilterIndex = Math.min(currentFilterIndex + 1, 3);
	} else if (Math.abs(deltaX) > 30 && velocity > 0.3) {
		currentFilterIndex = Math.max(currentFilterIndex - 1, 0);
	}
	snapToFilterIndex(currentFilterIndex);
});

/*
================================================================================
Advanced Swipe Handling for Filter Selection
Supports both touch and mouse input with momentum scrolling
================================================================================
*/
(function () {
	const swiper = document.getElementById("filterSwiper");
	const filters = swiper.querySelectorAll(".filter");
	const filterCount = filters.length;

	let isDragging = false;
	let startX = 0;
	let startScrollLeft = 0;
	let dragVelocity = 0;
	let lastDragTime = 0;
	let lastDragX = 0;

	/**
	 * Initializes swipe event listeners
	 */
	function initSwipe() {
		// Add touch event listeners
		swiper.addEventListener("touchstart", startDrag);
		swiper.addEventListener("touchmove", drag);
		swiper.addEventListener("touchend", endDrag);
		swiper.addEventListener("touchcancel", endDrag);

		// Add mouse event listeners for desktop testing
		swiper.addEventListener("mousedown", startDrag);
		swiper.addEventListener("mousemove", drag);
		swiper.addEventListener("mouseup", endDrag);
		swiper.addEventListener("mouseleave", endDrag);
	}

	/**
	 * Starts drag operation (touch or mouse)
	 * @param {Event} e - Touch or mouse event
	 */
	function startDrag(e) {
		isDragging = true;
		startX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
		startScrollLeft = swiper.scrollLeft; // Save current scroll position
		lastDragX = startX;
		lastDragTime = Date.now();
		swiper.style.scrollBehavior = "auto"; // Disable smooth scroll during drag
		document.body.style.userSelect = "none"; // Prevent text selection
		swiper.style.cursor = "grabbing";
	}

	/**
	 * Handles drag movement
	 * @param {Event} e - Touch or mouse event
	 */
	function drag(e) {
		if (!isDragging) return;
		e.preventDefault(); // Prevent default scrolling

		const currentX = e.type.includes("mouse")
			? e.clientX
			: e.touches[0].clientX;
		const dragDistance = (currentX - startX) * 1.2; // 1.2 = swipe sensitivity

		// Calculate drag velocity for momentum
		const currentTime = Date.now();
		const timeDiff = currentTime - lastDragTime;
		if (timeDiff > 0) {
			dragVelocity = (currentX - lastDragX) / timeDiff;
		}
		lastDragX = currentX;
		lastDragTime = currentTime;

		// Update scroll position based on drag
		swiper.scrollLeft = startScrollLeft - dragDistance;
	}

	/**
	 * Ends drag operation and applies momentum
	 */
	function endDrag() {
		isDragging = false;
		document.body.style.userSelect = ""; // Restore text selection
		swiper.style.cursor = "";
		swiper.style.scrollBehavior = "smooth"; // Restore smooth scrolling

		// Apply momentum if swipe was fast enough
		const momentum = dragVelocity * 100; // 100 = momentum strength
		if (Math.abs(momentum) > 10) {
			// Minimum threshold
			swiper.scrollLeft += momentum;
		}
	}

	// Initialize swipe when page-3 is active
	if ($(".page-3").style.display === "block") {
		initSwipe();
	} else {
		const frameButton = $(".frame-button");
		if (!frameButton.classList.contains("continue")) return;
		// Override button click to initialize swipe after navigation
		const originalClick = frameButton.onclick;
		frameButton.onclick = function () {
			originalClick.call(this);
			setTimeout(initSwipe, 100); // Small delay for UI update
		};
	}
})();

/**
 * Synchronizes selected filter with server
 * Extracts filter properties from CSS and sends to iMac
 */
function syncFilter() {
	const selectedFilter = filters[currentFilterIndex];

	// Get filter style from overlay element
	const filterStyle = getComputedStyle(
		selectedFilter.querySelector(".filter-overlay")
	).backdropFilter;

	let filterDetails = {};

	// Parse filter properties from CSS string
	filterStyle.split(" ").forEach((part) => {
		const match = part.match(/(.*?)\((.*?)\)/);
		if (match) {
			const key = match[1];
			const value = match[2];
			filterDetails[key] = value;
		}
	});

	// Send filter configuration to server
	socket.emit("chat message", {
		name: deviceName,
		msg: `:filter-${JSON.stringify(filterDetails)}`,
	});
}

const filters = document.querySelectorAll(".page-3 .filter");

// Handle filter confirmation - navigate to capture phase
$(".filter-button").addEventListener("click", () => {
	// Determine closest filter based on scroll position
	let closestIndex = 0;
	let closestDistance = Infinity;
	const centerPosition =
		filterWrapper.scrollLeft + filterWrapper.clientWidth / 2;

	filters.forEach((filter, index) => {
		const filterCenter = filter.offsetLeft + filter.clientWidth / 2;
		const distance = Math.abs(centerPosition - filterCenter);
		if (distance < closestDistance) {
			closestDistance = distance;
			closestIndex = index;
		}
	});

	$(".page-4").style.display = "block";
	$(".page-3").style.display = "none";

	startFilmingProcess(); // Begin capture sequence
});

// Handle offer skip
$(".text-offer .skip").addEventListener("click", () => {
	$(".o1").style.display = "none";
	$(".o3").style.display = "flex";
});

// Update slider overlay transparency based on value
$("#purchase-confirm").addEventListener("input", (e) => {
	$(".purchase-confirm-overlap").style.background = `rgba(247, 0, 0, ${
		0.5 + e.target.value / 200
	})`;
});

// Show purchase confirmation overlay
$(".shop").addEventListener("click", () => {
	$(".purchase-confirm-overlap").classList.add("visible");
});

// Hide purchase confirmation overlay
$(".purchase-confirm-overlap button").addEventListener("click", () => {
	$(".purchase-confirm-overlap").classList.remove("visible");
});

// ---------- Capture Sequence ----------

const COUNTDOWN_SECONDS = 20; // Seconds between captures

/**
 * Starts the automated capture sequence
 * Handles multiple captures based on selected frame requirements
 */
function startFilmingProcess() {
	const fractionElement = document.querySelector(".page-4 .fraction");
	const countdownElement = document.querySelector(".page-4 .countdown");

	let index = 0; // Track number of captures

	/**
	 * Starts countdown for next capture
	 */
	function countdownStarts() {
		let countdown = COUNTDOWN_SECONDS;

		// Allow skipping to final 6 seconds
		$("button.skip").onclick = () => {
			if (countdown > 6) countdown = 6;
		};

		// Update UI with progress
		fractionElement.textContent = `${index + 1} / ${framePictureAmount}`;
		countdownElement.textContent = countdown;
		$(".unit").textContent = "seconds";

		// Start countdown interval
		const interval = setInterval(() => {
			countdown--;
			countdownElement.textContent = countdown === 0 ? "" : countdown;

			if (countdown === 1) $(".unit").textContent = "second";

			// Trigger iMac countdown 5 seconds before capture
			if (countdown === 5) {
				socket.emit("chat message", {
					name: deviceName,
					msg: `:countdown-${countdown}-capture`,
				});
			}

			if (countdown <= 0) {
				clearInterval(interval);
				index++;

				// Continue sequence or finish
				setTimeout(() => {
					if (index < framePictureAmount) {
						countdownStarts();
					} else {
						// All captures complete
						socket.emit("chat message", {
							name: deviceName,
							msg: `:end`,
						});
						$(".page-5").style.display = "block";
						$(".page-4").style.display = "none";
					}
				}, 5000);
			}
		}, 1000);
	}

	countdownStarts(index);
}

// ---------- Utility & Socket Functions ----------

/**
 * Logs messages with timestamp
 * @param {string} msg - Message to log
 */
function consoleLog(msg) {
	console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

let cameraReady = false; // Track camera readiness state

// Handle socket connection
socket.on("connect", () => {
	socket.emit("join", {
		name: deviceName,
		folder: "/" + deviceName.toLowerCase(),
	});
	consoleLog("Connected");
});

// Store session ID when received
socket.on("session-id", (sid) => {
	sessionId = sid;
	consoleLog("Session ID: " + sid);
});

// Handle remote commands
socket.on("command", (cmd) => {
	consoleLog(`Command: ${cmd}`);
	const m = cmd.match(/^(.*?)\s*->\s*(.*?)$/);
	if (m) {
		const command = m[1].trim(),
			target = m[2].trim();
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
			eval(cmd);
		} catch {}
	}
});

// Handle incoming chat messages
socket.on("chat message", (data) => {
	consoleLog(`Chat from ${data.name}: ${data.msg}`);
	const msg = data.msg.trim();

	// Handle animation notification from iMac
	if (msg.startsWith(":animation-started-")) {
		const url = msg.replace(":animation-started-", "");
		document.body.style.setProperty(
			"--captured-image",
			`url(${url.replace(".png", "-preview.webp")})`
		);

		// Show capture animation
		setTimeout(() => {
			document
				.querySelector(".animation-captured")
				.classList.add("animates");

			setTimeout(() => {
				document
					.querySelector(".animation-captured")
					.classList.remove("animates");
			}, 3000);
		}, 1000);
	}

	// Track camera readiness
	if (msg === ":camera-ready") {
		cameraReady = true;
		consoleLog("Camera is ready for next capture.");
	}

	// Handle local image link
	if (msg.startsWith(":local-link-")) {
		const link = msg.replace(":local-link-", "");

		$(".page-5 .current").textContent = `Making it available online...`;

		$(".page-5 img").src = link;
		$(".page-6 .final-image").src = link;

		// Apply reveal animation (reduce blur)
		let blur = 20;
		const interval = setInterval(() => {
			$(".page-5 img").style.filter = `blur(${blur}px)`;
			blur = Math.max(0, blur - 2);
			if (blur === 0) {
				$(".page-5 img").style.filter = `blur(0px)`;
				clearInterval(interval);
			}
		}, 500);
	}

	// Handle Google Drive link and display final page
	if (msg.startsWith(":google-drive-link-")) {
		const link = msg.replace(":google-drive-link-", "");

		// send :print-[link] to printer device
		socket.emit("chat message", {
			name: deviceName,
			msg: `:print-${link}`,
		});

		// Purchase confirmation slider handler
		$("#purchase-confirm").addEventListener("change", (e) => {
			if (e.target.value != 100) {
				e.target.value = 0;
				$(
					".purchase-confirm-overlap"
				).style.background = `rgba(247, 0, 0, 0.5)`;
				return;
			}

			// Confirm purchase and proceed
			$(".purchase-confirm-overlap").classList.remove("visible");
			$(".o1").style.display = "none";
			$(".o2").style.display = "flex";

			socket.emit("chat message", {
				name: deviceName,
				msg: `:purchase-confirmed-${link}`,
			});
		});

		$(".page-5").style.display = "none";
		$(".page-6").style.display = "block";

		// Countdown to page refresh
		let countdown = 120;
		setInterval(() => {
			$(".page-6 .countdown").textContent = `${countdown}s`;
			countdown--;
			if (countdown === 0) location.reload();
		}, 1000);

		// Generate QR code for image access
		new QRCode($(".qr-code"), {
			text: `https://sccl4c.web.app/?l=${encodeURIComponent(link)}`,
			width: 200,
			height: 200,
			colorDark: "#000000",
			colorLight: "#ffffff",
		});
	}
});
