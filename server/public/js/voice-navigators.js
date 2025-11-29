let navigator = "lly";

const voices = {
	lly: [
		"/assets/audio/voices/lly/1. Welcome to the photo booth. I am Mr Marcus Leung. Get ready to capture some amazing memories. Enjoy!.wav",
		"/assets/audio/voices/lly/2. Please choose the frame first, then press the ‘choose this’ button at the right corner.wav",
		"/assets/audio/voices/lly/3. Now please choose the filter, then press the ‘choose this’ button again.wav",
		"/assets/audio/voices/lly/4. We will take 6 photos in total. You can choose 4 of them as your final product.wav",
		"/assets/audio/voices/lly/5. Shot 1! Say cheese!.wav",
		"/assets/audio/voices/lly/6. Great start! Now you have 20 seconds to change your pose or prop.wav",
		"/assets/audio/voices/lly/7. Shot 3! Look at the camera!.wav",
		"/assets/audio/voices/lly/8. Halfway there! 20 seconds to prepare.wav",
		"/assets/audio/voices/lly/9. Shot 4! Smile!.wav",
		"/assets/audio/voices/lly/10. Shot 5! Brilliant!.wav",
		"/assets/audio/voices/lly/11. Almost done! Last chance for a fun pose.wav",
		"/assets/audio/voices/lly/12. Shot 6! Final picture, give us your best shot!.wav",
		"/assets/audio/voices/lly/13. Amazing! That_s a wrap.wav",
		"/assets/audio/voices/lly/14. Thank you. Wait a moment while we process your photos.wav",
	],
	cml: [
		"/assets/audio/voices/cml/1. Welcome.wav",
		"/assets/audio/voices/cml/2. Filter.wav",
		"/assets/audio/voices/cml/3. Photos.wav",
		"/assets/audio/voices/cml/4. Dismiss.wav",
	],
	csl: [
		"/assets/audio/voices/csl/1. Welcome.wav",
		"/assets/audio/voices/csl/2. Filter.wav",
		"/assets/audio/voices/csl/3. Photos.wav",
		"/assets/audio/voices/csl/4. End.wav",
		"/assets/audio/voices/csl/5. Dismiss.wav",
	],
	hht: [
		"/assets/audio/voices/hht/1. Welcome.wav",
		"/assets/audio/voices/hht/2. Filter.wav",
		"/assets/audio/voices/hht/3. Photos.wav",
		"/assets/audio/voices/hht/4. Dismiss.wav",
	],
};

const vn = {
	// Track all currently playing Audio instances (one per navigator)
	_current: {},

	// === GLOBAL STOP: Stop EVERY playing audio, no matter which navigator ===
	_stopAll() {
		Object.keys(this._current).forEach(nav => {
			if (this._current[nav]) {
				this._current[nav].pause();
				this._current[nav].currentTime = 0; // optional reset
				this._current[nav] = null;
			}
		});
	},

	// Main trigger function
	trigger(navigatorName, index) {
		// Optional: reject if trying to play a different navigator
		if (navigator !== navigatorName) {
			return Promise.reject();
		}

		if (!voices[navigatorName]) {
			return Promise.reject(new Error(`Navigator "${navigatorName}" not found`));
		}

		if (index < 1 || index > voices[navigatorName].length) {
			return Promise.reject(new Error(`Voice ${index} does not exist for ${navigatorName}`));
		}

		const list = voices[navigatorName];
		const url = list[index - 1];

		// STOP ALL PREVIOUSLY PLAYING AUDIO (from any navigator)
		this._stopAll();

		const audio = new Audio(url);
		this._current[navigatorName] = audio;

		return new Promise((resolve, reject) => {
			audio.addEventListener("ended", () => {
				this._current[navigatorName] = null;
				resolve();
			});

			audio.addEventListener("error", (e) => {
				this._current[navigatorName] = null;
				reject(e);
			});

			audio.play().catch(err => {
				this._current[navigatorName] = null;
				reject(err);
			});
		});
	},

	// Shortcut for current navigator
	current(index) {
		return this.trigger(navigator, index);
	},

	// Manual global stop (useful for emergencies, screen change, etc.)
	stopAll() {
		this._stopAll();
	},

	// Optional: stop only the current navigator
	stop() {
		if (this._current[navigator]) {
			this._current[navigator].pause();
			this._current[navigator] = null;
		}
	}
};