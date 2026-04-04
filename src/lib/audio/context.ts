/**
 * Singleton AudioContext — created once on first user gesture, NEVER closed.
 *
 * Fixes:
 * - #86: Persistent AudioContext (no more create/close per page)
 * - #55: BT headsets miss first play (audio route stays warm)
 * - #56: Dynamic Island flicker (no rapid start/stop cycles)
 *
 * iOS Safari quirks (all required for reliable playback):
 * 1. Must use webkitAudioContext fallback on older iOS
 * 2. AudioContext must be created AND resumed inside a user gesture
 * 3. A silent buffer must be played to fully unlock the audio pipeline
 * 4. navigator.audioSession.type = "playback" (iOS 17+) ensures sound
 *    plays even when the device mute switch is on
 */

// Capacitor: eagerly pre-warm audio pipeline on app foreground.
// Runs during the app switch animation so pipeline is hot by the time user taps.
if (typeof window !== 'undefined') {
	import('@capacitor/app')
		.then(({ App }) => {
			App.addListener('appStateChange', async ({ isActive }) => {
				if (isActive && ctx) {
					try {
						// Resume the suspended AudioContext
						if (ctx.state === 'suspended' || (ctx.state as string) === 'interrupted') {
							await ctx.resume();
						}
						// Play silent buffer to flush the native audio pipeline
						const silent = ctx.createBuffer(1, 1, ctx.sampleRate);
						const source = ctx.createBufferSource();
						source.buffer = silent;
						source.connect(ctx.destination);
						source.start();
					} catch (e) {
						console.warn('[AudioSession] Pre-warm failed:', e);
					}
				}
			});
		})
		.catch(() => {
			// Not running in Capacitor — no-op
		});
}

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let analyserNode: AnalyserNode | null = null;
let contextWasReset = false;

/**
 * Get (or create) the singleton AudioContext.
 * On first call, creates the context, sets iOS audio session to playback,
 * and plays a silent buffer to unlock the audio pipeline.
 * On subsequent calls, resumes if suspended/interrupted.
 */
export function getContext(): AudioContext {
	if (!ctx) {
		const AC = window.AudioContext || (window as any).webkitAudioContext;
		ctx = new AC();
		// After a reset (background recovery), reclaim iOS audio session
		// BEFORE the silent buffer — iOS needs the session type set for correct routing.
		// On first-ever creation (not a reset), skip this to avoid stealing from other apps.
		if (contextWasReset) {
			if ('audioSession' in navigator && 'type' in (navigator as any).audioSession) {
				(navigator as any).audioSession.type = 'playback';
			}
			contextWasReset = false;
		}
		// Play a silent buffer to fully unlock iOS audio pipeline
		const silent = ctx.createBuffer(1, 1, ctx.sampleRate);
		const source = ctx.createBufferSource();
		source.buffer = silent;
		source.connect(ctx.destination);
		source.start();
	}
	if (ctx.state === 'suspended' || (ctx.state as string) === 'interrupted') {
		ctx.resume();
	}
	return ctx;
}

/**
 * Ensure the AudioContext is fully running before scheduling audio.
 * Must be called from a user gesture handler (tap/click) for iOS compatibility.
 * Unlike getContext(), this awaits the resume() promise so oscillators
 * scheduled immediately after won't hit a still-suspended context.
 */
export async function ensureResumed(): Promise<AudioContext> {
	const audioCtx = getContext();
	if (audioCtx.state === 'suspended' || (audioCtx.state as string) === 'interrupted') {
		await audioCtx.resume();
	}
	return audioCtx;
}

/**
 * Get (or create) the master output chain: all audio → masterGain → analyser → destination.
 * This allows the AnalyserNode to tap into all audio output.
 */
export function getMasterOutput(): GainNode {
	const audioCtx = getContext();
	if (!masterGain) {
		masterGain = audioCtx.createGain();
		masterGain.gain.value = 1;
		analyserNode = audioCtx.createAnalyser();
		analyserNode.fftSize = 256;
		analyserNode.smoothingTimeConstant = 0.8;

		// Safety limiter — prevents clipping when drone + scale notes stack
		const compressor = audioCtx.createDynamicsCompressor();
		compressor.threshold.value = -6;   // start limiting at -6dB
		compressor.knee.value = 3;          // soft knee
		compressor.ratio.value = 12;        // aggressive limiting
		compressor.attack.value = 0.003;    // fast attack (catch transients)
		compressor.release.value = 0.1;     // quick release

		masterGain.connect(analyserNode);
		analyserNode.connect(compressor);
		compressor.connect(audioCtx.destination);
	}
	return masterGain;
}

/**
 * Get the AnalyserNode for audio-reactive visualizations.
 * Returns the analyser + a Uint8Array for time-domain data.
 */
export function getAnalyser(): { analyser: AnalyserNode; dataArray: Uint8Array } {
	getMasterOutput(); // ensure created
	const analyser = analyserNode!;
	return { analyser, dataArray: new Uint8Array(analyser.frequencyBinCount) };
}

/**
 * Get the current audio amplitude (0–1) from the analyser.
 * Useful for driving visual effects in sync with audio.
 */
export function getAmplitude(analyser: AnalyserNode, dataArray: Uint8Array): number {
	analyser.getByteTimeDomainData(dataArray);
	let sum = 0;
	for (let i = 0; i < dataArray.length; i++) {
		const v = (dataArray[i] - 128) / 128;
		sum += v * v;
	}
	return Math.sqrt(sum / dataArray.length); // RMS amplitude 0–1
}

/**
 * Warm up the AudioContext on first user interaction.
 * Call this once from a top-level touch/click handler to ensure
 * iOS Safari has unlocked audio before the user reaches the quiz.
 */
export function warmUpAudio(): void {
	getContext();
}

/** Returns true if AudioContext is running (not suspended/blocked by browser policy). */
export function isAudioReady(): boolean {
	return !!ctx && ctx.state === 'running';
}

/**
 * Destroy and null out the AudioContext + master chain.
 * Used as a recovery mechanism when iOS kills the context in background
 * and resume() silently fails. The next getContext() call will create a fresh one.
 * This is NOT called during normal page navigation — only on background recovery failure.
 */
export function resetContext(): void {
	if (ctx) {
		try { ctx.close(); } catch { /* already dead */ }
		ctx = null;
		masterGain = null;
		analyserNode = null;
		contextWasReset = true;
	}
}

/** Convert MIDI note number to frequency in Hz. */
export function midiToFreq(midi: number): number {
	return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Legacy no-op. In the v4 persistent-context model, audio context is never closed.
 * Kept for backward compatibility with pages that call stopAudio() in onDestroy.
 */
export function stopAudio(): void {
	// no-op — context is persistent
}

/**
 * Legacy no-op. Suspend/resume is handled automatically by the persistent context.
 */
export function suspendAudio(): void {
	// no-op
}

/**
 * Legacy no-op.
 */
export function cancelScheduledSuspend(): void {
	// no-op
}

/**
 * Try to resume the AudioContext (e.g. on visibility change).
 * Returns true if context exists and is running or successfully resumed.
 */
export function resumeAudio(): boolean {
	if (!ctx) return false;
	if (ctx.state === 'suspended') {
		ctx.resume().catch(() => {});
	}
	return ctx.state === 'running';
}
