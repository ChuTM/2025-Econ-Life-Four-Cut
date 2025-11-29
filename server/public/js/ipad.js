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

const teachers = $(".teacher");
const btnLeft = $(".round-button.l");
const btnRight = $(".round-button.r");

let currentIndex = 0;

// Find initial current teacher
teachers.forEach((el, i) => {
	if (el.classList.contains("current")) currentIndex = i;
});

let introing = false;
let introed = false;
let toStart = false;
function tryStart() {
	if (!toStart) return;

	$(".page-1").classList.add("hide");
	$(".page-1").style.transform = "translateY(100%)";

	setTimeout(() => {
		$(".page-2").classList.remove("hide");
		if (navigator === "lly") vn.trigger(navigator, 2);
	}, 400);
}

const update = () => {
	introing = true;
	introed = true;
	teachers.forEach((el, i) => {
		el.classList.remove("current", "up", "down");
		if (i === currentIndex) {
			el.classList.add("current");
			navigator = el.getAttribute("data-navigator");
			vn.trigger(navigator, 1).then(() => {
				introing = false;
				tryStart();
			});
		} else if (i < currentIndex) el.classList.add("up");
		else el.classList.add("down");
	});
};

btnLeft.addEventListener("click", () => {
	currentIndex = currentIndex > 0 ? currentIndex - 1 : teachers.length - 1;
	update();
});

btnRight.addEventListener("click", () => {
	currentIndex = currentIndex < teachers.length - 1 ? currentIndex + 1 : 0;
	update();
});

// Handle start button click - navigate to frame selection
$(".start-button").addEventListener("click", () => {
	socket.emit("chat message", { name: deviceName, msg: ":start" });
	toStart = true;

	$(".start-button").disabled = "true";

	$(".page-1").classList.add("animating");

	socket.emit("chat message", {
		name: deviceName,
		msg: `:navigator-${navigator}`,
	});

	socket.emit("chat message", {
		name: deviceName,
		msg: `:starts-${Date.now()}`,
	});

	if (!introing) {
		if (introed) {
			tryStart();
		} else {
			vn.trigger(navigator, 1).then(() => {
				tryStart();
			});
		}
	}
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
		if (e.getAttribute("data-disabled") != null) return;
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

let selectedFrame,
	framePictureAmount = 4; // Selected frame properties

let frameDetail = {};

async function loadFrame(n) {
	return new Promise((r) => {
		fetch(`/frames/jsons/${n}.json`)
			.then((response) => response.json())
			.then((data) => {
				frameDetail = data;
				r(data);
				console.log("Frame details loaded:", frameDetail);
			})
			.catch((error) => {
				console.error("Error loading frame details:", error);
			});
	});
}

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

	loadFrame(selectedFrame);

	// Page-2 -> Page-3

	$(".page-3").classList.remove("hide");
	$(".page-2").classList.add("hide");

	vn.trigger("lly", 3);
	vn.trigger("cml", 2);
	vn.trigger("csl", 2);
	vn.trigger("hht", 2);
});
const swiper = $("#filterSwiper");
const track = $(".carousel-track");
const filters = $(".carousel-track .filter");
const filterCount = filters.length;
let currentFilterIndex = 0; // Track active filter index

let isDragging = false;
let startX = 0;
let currentTranslateX = 0;
let dragDistance = 0;
let vwUnit = window.innerWidth / 100; // Value of 1vw in pixels

// --- Variables for Velocity Tracking ---
let lastDragX = 0;
let lastDragTime = 0;
let dragVelocity = 0; // Calculated in px/ms
const VELOCITY_THRESHOLD = 0.3; // px/ms threshold for a fast swipe

/**
 * Calculates the target X translation (in pixels) to center a filter.
 * The math relies on the fact that each filter (with its margins) occupies 100vw.
 * The translation is applied to the 'track'.
 * @param {number} index - Index of filter to center.
 * @returns {number} The required translateX value in pixels.
 */
function calculateTargetTranslation(index) {
	// Recalculate vwUnit on demand for responsiveness
	vwUnit = window.innerWidth / 100;

	// Total space occupied by one slide unit (100vw)
	const slideUnitPx = 100 * vwUnit;

	// To center the filter, we translate the track by the distance of all previous slides.
	return -(index * slideUnitPx);
}

/**
 * Applies the calculated translation and updates the current index state.
 * @param {number} index - Index of filter to display
 */
function snapToFilterIndex(index) {
	// Clamp index within bounds
	currentFilterIndex = Math.min(Math.max(index, 0), filterCount - 1);

	const targetX = calculateTargetTranslation(currentFilterIndex);

	// Apply the transform
	track.style.transform = `translateX(${targetX}px)`;
	currentTranslateX = targetX;

	syncFilter(); // Update server with current filter
}

/**
 * Starts drag operation (touch or mouse)
 * @param {Event} e - Touch or mouse event
 */
function startDrag(e) {
	isDragging = true;
	// Get initial X position
	startX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;

	// Disable CSS transition during drag for immediate response
	track.style.transition = "none";

	// Set current X position to where the transition ended
	const transformMatch = track.style.transform.match(/translateX\((.*?)px\)/);
	currentTranslateX = transformMatch ? parseFloat(transformMatch[1]) : 0;

	// Initialize velocity tracking variables
	lastDragX = startX;
	lastDragTime = Date.now();
	dragVelocity = 0; // Reset velocity

	swiper.style.cursor = "grabbing";
	e.preventDefault(); // Prevent accidental selection
}

/**
 * Handles drag movement - Includes Velocity Calculation
 * @param {Event} e - Touch or mouse event
 */
function drag(e) {
	if (!isDragging) return;

	const currentX = e.type.includes("mouse")
		? e.clientX
		: e.touches[0].clientX;

	dragDistance = currentX - startX;

	// --- Velocity Calculation ---
	const currentTime = Date.now();
	const timeDiff = currentTime - lastDragTime;

	if (timeDiff > 0) {
		const deltaX = currentX - lastDragX;
		// Velocity is distance moved over time passed (px/ms)
		dragVelocity = deltaX / timeDiff;
	}

	lastDragX = currentX;
	lastDragTime = currentTime;
	// --- End Velocity Calculation ---

	// Apply new transform: current position + drag distance
	const newX = currentTranslateX + dragDistance;
	track.style.transform = `translateX(${newX}px)`;
}

/**
 * Ends drag operation and snaps to the nearest filter - Incorporates Velocity
 */
function endDrag() {
	if (!isDragging) return;
	isDragging = false;

	// Re-enable CSS transition for the snap back/to
	track.style.transition = "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
	swiper.style.cursor = "grab";

	// Determine if a snap forward or backward is needed
	const slideUnitPx = 100 * vwUnit;
	const distanceThreshold = slideUnitPx * 0.2; // 20% distance rule

	let targetIndex = currentFilterIndex;

	// Priority 1: Check for a fast swipe (high velocity)
	if (dragVelocity < -VELOCITY_THRESHOLD) {
		// Fast swipe left (next filter)
		targetIndex = currentFilterIndex + 1;
	} else if (dragVelocity > VELOCITY_THRESHOLD) {
		// Fast swipe right (previous filter)
		targetIndex = currentFilterIndex - 1;
	}
	// Priority 2: If not fast enough, check the distance threshold
	else if (dragDistance < -distanceThreshold) {
		// Slow but long swipe left (next filter)
		targetIndex = currentFilterIndex + 1;
	} else if (dragDistance > distanceThreshold) {
		// Slow but long swipe right (previous filter)
		targetIndex = currentFilterIndex - 1;
	}
	// If neither condition is met, targetIndex remains currentFilterIndex (snaps back to center)

	// Ensure target index is clamped within bounds
	targetIndex = Math.min(Math.max(targetIndex, 0), filterCount - 1);

	snapToFilterIndex(targetIndex);

	// Reset drag state
	startX = 0;
	dragDistance = 0;
	dragVelocity = 0;
}

/**
 * Handles window resize to maintain responsive centering.
 */
function handleResize() {
	// Recalculate vwUnit
	vwUnit = window.innerWidth / 100;
	// Force a snap to the current index to recalculate transform using new window size
	snapToFilterIndex(currentFilterIndex);
}

/**
 * Initializes drag/swipe event listeners
 */
function initSwipe() {
	// Touch events
	swiper.addEventListener("touchstart", startDrag);
	swiper.addEventListener("touchmove", drag);
	swiper.addEventListener("touchend", endDrag);
	swiper.addEventListener("touchcancel", endDrag);

	// Mouse events for desktop
	swiper.addEventListener("mousedown", startDrag);
	swiper.addEventListener("mousemove", drag);
	swiper.addEventListener("mouseup", endDrag);
	swiper.addEventListener("mouseleave", endDrag);

	// Responsive handling
	window.addEventListener("resize", handleResize);

	// Initial snap to the first element's center
	snapToFilterIndex(currentFilterIndex);
}

/*
        ================================================================================
        Synchronization and Button Logic
        ================================================================================
        */

/**
 * Synchronizes selected filter with server
 * Extracts filter properties from CSS and sends
 */
function syncFilter() {
	const selectedFilter = filters[currentFilterIndex];

	// Get filter style from overlay element
	const filterStyle = getComputedStyle(
		selectedFilter.querySelector(".filter-overlay")
	).backdropFilter;

	let filterDetails = {};

	// Parse filter properties from CSS string
	// Regex to match 'function(value)' e.g., hue-rotate(90deg)
	const regex = /(\w+)\(([^)]+)\)/g;
	let match;
	while ((match = regex.exec(filterStyle)) !== null) {
		const key = match[1];
		const value = match[2];
		filterDetails[key] = value.trim();
	}

	// Send filter configuration to server
	// Note: socket object is stubbed

	socket.emit("chat message", {
		name: deviceName,
		msg: `:filter-${JSON.stringify(filterDetails)}`,
	});
}

// Handle filter confirmation - navigate to capture phase (Stubbed)
$(".filter-button").addEventListener("click", () => {
	console.log(`Filter ${currentFilterIndex + 1} selected!`);

	// Log the transition: Page-3 -> Page-4
	// In a real application, you'd show/hide pages here.

	$(".page-4").classList.remove("hide");
	$(".page-3").classList.add("hide");

	// Log VN triggers (stubbed)
	vn.trigger("lly", 4);
	vn.trigger("cml", 3);
	vn.trigger("csl", 3);
	vn.trigger("hht", 3);

	// Log start filming process (stubbed)

	setTimeout(() => startFilmingProcess(), navigator === "csl" ? 10000 : 5000);
});

// Initialize the swiper logic on load
window.onload = initSwipe;

// Handle offer skip
$(".text-offer .skip").addEventListener("click", () => {
	$(".o1").style.display = "none";
	$(".o3").style.display = "flex";
});

// Update slider overlay transparency based on value
$("#purchase-confirm").addEventListener("input", (e) => {
	cancelPulse();
	$(".purchase-confirm-overlap").style.background = `rgba(0, 132, 0, ${
		0.5 + e.target.value / 200
	})`;
	$("#purchase-confirm").style.setProperty("--value", `${e.target.value}%`);
});

let purchaseAnimationTimer;
let cancelPulse = () => {};

// Show purchase confirmation overlay
$(".shop").addEventListener("click", () => {
	$(".purchase-confirm-overlap").classList.add("visible");
	function setAnimationValue(v) {
		$("#purchase-confirm").value = v;
	}

	// EDIT ONLY THESE 6 LINES
	const durationMs = 1000; // total time for one full 0→10→0
	const startNum = 0;
	const maxNum = 7;
	const easing = (t) => 1 - Math.pow(1 - t, 4); // easeOutQuart
	const step = 0.001;
	const repeatCount = 2; // ←←← CHANGE THIS TO HOW MANY TIMES YOU WANT
	const startDelay = 400;

	// RUN ANIMATION – replace entire old block
	setTimeout(() => {
		const half = durationMs / 2;
		const up = [];
		const down = [];
		for (let i = startNum; i <= maxNum; i += step) up.push(i);
		for (let i = maxNum; i >= startNum; i -= step) down.push(i);

		let done = 0;

		const play = () => {
			if (done >= repeatCount) return;

			let upIdx = 0,
				downIdx = 0;
			let cancelled = false;
			const start = performance.now();

			// This function will be overwritten on every new pulse
			cancelPulse = () => {
				cancelled = true;
				setAnimationValue(startNum); // instantly snap back to 0
				cancelPulse = () => {};
			};

			const tick = (now) => {
				if (cancelled) return;

				const elapsed = now - start;

				if (elapsed < half) {
					const p = elapsed / half;
					const target = Math.floor(easing(p) * up.length);
					while (upIdx < target) setAnimationValue(up[upIdx++]);
				} else {
					const p = (elapsed - half) / half;
					if (p >= 1 || cancelled) {
						while (downIdx < down.length)
							setAnimationValue(down[downIdx++]);
						done++;
						if (done < repeatCount && !cancelled) {
							requestAnimationFrame(play);
						}
						return;
					}
					const target = Math.floor(easing(p) * down.length);
					while (downIdx < target) setAnimationValue(down[downIdx++]);
				}

				requestAnimationFrame(tick);
			};

			requestAnimationFrame(tick);
		};

		play();
	}, startDelay); // you can keep your startDelay here if you want
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

	$("button.skip").style.display = "block";

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

		let current = index + 1;

		if (current == 2) {
			// ready to shot current (post shot 1)
			vn.trigger("lly", 6);
		} else if (current == 3) {
			// lly missing
		} else if (current == 4) {
			vn.trigger("lly", 8);
		} else if (current == 5) {
			// lly missing
		} else if (current == 6) {
			vn.trigger("lly", 11);
		}

		// Update UI with progress
		fractionElement.textContent = `${current} / 6`;
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

				if (current == 1) {
					vn.trigger("lly", 5);
				} else if (current == 2) {
					// lly missing
				} else if (current == 3) {
					vn.trigger("lly", 7);
				} else if (current == 4) {
					vn.trigger("lly", 9);
				} else if (current == 5) {
					vn.trigger("lly", 10);
				} else if (current == 6) {
					vn.trigger("lly", 12);
				}
			}

			if (countdown <= 0) {
				clearInterval(interval);
				index++;

				// Continue sequence or finish
				setTimeout(() => {
					if (index < 6) {
						// TAKE 6 PHOTOS
						countdownStarts();
					} else {
						// All captures complete
						socket.emit("chat message", {
							name: deviceName,
							msg: `:end`,
						});

						// Page-4 -> Page-5

						$(".page-5").classList.remove("hide");
						initPage5();
						$(".page-4").classList.add("hide");
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

let previewPhotos = [];

const refineImageLink = (l) => l.replace("./public", "");

async function renderPreviewToCanvas(frameDef, imageMap) {
	const canvas = document.querySelector(".page-5 .preview canvas");
	if (!canvas) return;

	const PREVIEW_W = 480;
	const PREVIEW_H = 715;
	const REAL_W = frameDef.Resolution.w; // 1440
	const REAL_H = frameDef.Resolution.h; // 2146

	const ctx = canvas.getContext("2d");

	// ——— 1. Draw full-res version on a hidden offscreen canvas ———
	const offscreen = new OffscreenCanvas(REAL_W, REAL_H);
	const offCtx = offscreen.getContext("2d");

	const load = (src) =>
		new Promise((res, rej) => {
			const img = new Image();
			img.onload = () => res(img);
			img.onerror = rej;
			img.crossOrigin = "anonymous";
			img.src = src;
		});

	const drawCover = (img, x, y, w, h) => {
		const scale = Math.max(w / img.width, h / img.height);
		const sw = w / scale;
		const sh = h / scale;
		const sx = (img.width - sw) / 2;
		const sy = (img.height - sh) / 2;
		offCtx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
	};

	// background
	const bg = await load(refineImageLink(frameDef.background));
	offCtx.drawImage(bg, 0, 0, REAL_W, REAL_H);

	// photos
	for (const item of frameDef.images) {
		const src = imageMap[item.src];
		if (!src) {
			offCtx.fillStyle = "#cccccc";
			offCtx.fillRect(item.x, item.y, item.w, item.h);
			continue;
		}
		try {
			const photo = await load(src);
			drawCover(photo, item.x, item.y, item.w, item.h);
		} catch (e) {
			offCtx.fillStyle = "#cccccc";
			offCtx.fillRect(item.x, item.y, item.w, item.h);
		}
	}

	// foreground
	const fg = await load(refineImageLink(frameDef.foreground));
	offCtx.drawImage(fg, 0, 0, REAL_W, REAL_H);

	// ——— 2. Downscale the perfect full-res result to preview size ———
	canvas.width = PREVIEW_W;
	canvas.height = PREVIEW_H;
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = "high";
	ctx.drawImage(offscreen, 0, 0, REAL_W, REAL_H, 0, 0, PREVIEW_W, PREVIEW_H);
}

// Page 5 - Photo Selection

let selectedImages = new Array(framePictureAmount).fill(null); // framePictureAmount
let selectedImageMap = {};

function initPage5() {
	vn.trigger("lly", 13);
	renderPreviewToCanvas(frameDetail, {});
	let index = 0;
	$(".page-5>.grid>.img").forEach((e) => {
		e.querySelector("img").src = previewPhotos[index];
		index++;
		e.addEventListener("click", () => {
			const actualSrc = e.querySelector("img").src; // real uploaded URL

			const alreadyIndex = selectedImages.indexOf(actualSrc);

			if (alreadyIndex !== -1) {
				// ——— DESELECT ———
				selectedImages[alreadyIndex] = null;

				e.classList.remove("selected");

				// Find which placeholder was using this image and clear it
				const placeholderKey = Object.keys(selectedImageMap).find(
					(key) => selectedImageMap[key] === actualSrc
				);
				if (placeholderKey) {
					selectedImageMap[placeholderKey] = null;
				}
			} else {
				// ——— SELECT ———
				const emptySlotIndex = selectedImages.indexOf(null);
				e.classList.add("selected");

				if (emptySlotIndex !== -1) {
					// Fill the first available frame slot
					selectedImages[emptySlotIndex] = actualSrc;

					// Assign this real image to the corresponding placeholder
					const placeholderKey = `{{image-${emptySlotIndex + 1}}}`;
					selectedImageMap[placeholderKey] = actualSrc;
				}
			}

			renderPreviewToCanvas(frameDetail, selectedImageMap);
		});
	});

	$(".confirm-result-button").addEventListener("click", () => {
		socket.emit("chat message", {
			name: deviceName,
			msg: `:generate-${JSON.stringify(selectedImages)}`,
		});

		vn.trigger("lly", 14);
	});
}

// Handle incoming chat messages
socket.on("chat message", (data) => {
	consoleLog(`Chat from ${data.name}: ${data.msg}`);
	const msg = data.msg.trim();

	// Handle animation notification from iMac
	if (msg.startsWith(":animation-started-")) {
		const url = msg.replace(":animation-started-", "");
		const previewLink = url.replace(".png", "-preview.webp");
		previewPhotos.push(url);
		document.body.style.setProperty(
			"--captured-image",
			`url(${previewLink})`
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

		// Page-5 -> Page-6

		$(".page-5").classList.add("hide");
		$(".page-6").classList.remove("hide");

		vn.trigger("cml", 4);
		vn.trigger("hht", 4);
		try {
			vn.trigger("csl", 4).then(() => {
				vn.trigger("csl", 5);
			});
		} catch {}

		$(".page-6 .current").textContent = `Making it available online...`;

		$(".page-6 img").src = link;
		$(".page-7 .final-image").src = link;

		// Apply reveal animation (reduce blur)
		let blur = 20;
		const interval = setInterval(() => {
			$(".page-6 img").style.filter = `blur(${blur}px)`;
			blur = Math.max(0, blur - 2);
			if (blur === 0) {
				$(".page-6 img").style.filter = `blur(0px)`;
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
				$("#purchase-confirm").style.setProperty(
					"--value",
					e.target.value
				);
				e.target.value = 0;
				$(
					".purchase-confirm-overlap"
				).style.background = `rgba(0, 132, 0, 0.5)`;
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

		$(".page-6").classList.add("hide");
		$(".page-7").classList.remove("hide");

		// Countdown to page refresh
		let countdown = 120;
		setInterval(() => {
			$(".page-7 .countdown").textContent = `${countdown}s`;
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
