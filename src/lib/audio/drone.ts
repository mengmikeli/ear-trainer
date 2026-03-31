/**
 * Drone lifecycle — continuous tone for modes practice.
 *
 * Routes through master output (analyser-connected) but has its own gain chain,
 * completely separate from playback.ts's beginPlayback(). Playing a scale in modes
 * does NOT cancel the drone.
 *
 * KEY CHANGE from old code: no scheduleSuspend() calls on stop.
 * AudioContext stays alive — no suspend/close cycle.
 */

import { ensureResumed, getMasterOutput, midiToFreq } from './context';

export interface DroneHandle {
	stop: () => void;
	forceStop: () => void;
	setMuted: (muted: boolean) => void;
	isMuted: () => boolean;
}

let activeDrone: DroneHandle | null = null;

/**
 * Start a continuous drone on a given MIDI note.
 * Uses layered sine + fifth with slow LFO for organic warmth.
 * Returns a handle to stop/mute it.
 *
 * Only one drone at a time — calling startDrone while one is active
 * stops the previous drone first.
 */
export async function startDrone(midi: number): Promise<DroneHandle> {
	// Stop any existing drone
	if (activeDrone) {
		activeDrone.stop();
		activeDrone = null;
	}

	const audioCtx = await ensureResumed();
	const master = getMasterOutput();

	// Fundamental — sine wave
	const osc1 = audioCtx.createOscillator();
	osc1.type = 'sine';
	osc1.frequency.value = midiToFreq(midi);

	// Fifth above — very quiet, adds richness
	const osc2 = audioCtx.createOscillator();
	osc2.type = 'sine';
	osc2.frequency.value = midiToFreq(midi + 7);

	// Slow LFO on gain for organic breathing feel — delayed start
	const lfo = audioCtx.createOscillator();
	lfo.type = 'sine';
	lfo.frequency.value = 0.15; // very slow

	const lfoGain = audioCtx.createGain();
	// LFO silent during fade-in, fades in after attack completes
	lfoGain.gain.setValueAtTime(0, audioCtx.currentTime);

	lfo.connect(lfoGain);

	// Per-oscillator gains — drone is background support, not prominent
	const osc1Gain = audioCtx.createGain();
	osc1Gain.gain.value = 0.1; // softer fundamental
	const osc2Gain = audioCtx.createGain();
	osc2Gain.gain.value = 0.02; // barely audible fifth

	// Low-pass filter for warmth — FIXED frequency, no sweep
	// (Sweeping filter caused audible resonance/"buzz" even at low Q)
	const filter = audioCtx.createBiquadFilter();
	filter.type = 'lowpass';
	filter.frequency.value = 700; // warm fixed cutoff — removes harsh harmonics
	filter.Q.value = 0.1; // nearly flat — zero resonance

	// Master drone gain (for fade in/out + mute)
	const droneGain = audioCtx.createGain();
	droneGain.gain.value = 0; // true zero — no leak

	// Wire internal chain (osc → gain → filter → droneGain)
	// but DON'T connect droneGain to master yet — connect after
	// oscillators have started to avoid filter init transient
	osc1.connect(osc1Gain);
	osc2.connect(osc2Gain);
	osc1Gain.connect(filter);
	osc2Gain.connect(filter);
	lfoGain.connect(droneGain.gain); // LFO modulates master gain
	filter.connect(droneGain);
	// droneGain → master connected below, after oscillators start

	// Schedule oscillator start in the future
	const now = audioCtx.currentTime;
	const t0 = now + 0.05; // 50ms scheduling buffer

	// Pin gain at 0 through the entire startup window
	droneGain.gain.setValueAtTime(0, now);
	droneGain.gain.setValueAtTime(0, t0);
	droneGain.gain.setValueAtTime(0, t0 + 0.05); // extra safety window
	droneGain.gain.linearRampToValueAtTime(1, t0 + 0.55); // 500ms fade in
	// LFO fades in after attack completes (avoids wobble during ramp)
	lfoGain.gain.setValueAtTime(0, now);
	lfoGain.gain.setValueAtTime(0, t0 + 0.55);
	lfoGain.gain.linearRampToValueAtTime(0.03, t0 + 0.85);

	// Start oscillators (not yet connected to output — no transient possible)
	osc1.start(t0);
	osc2.start(t0);
	lfo.start(t0);

	// Connect to output AFTER oscillators have started and stabilized
	// The 70ms timeout ensures osc.start() has initialized before
	// the signal chain reaches the destination
	let muted = false;
	let stopped = false;

	setTimeout(() => {
		if (!stopped) {
			droneGain.connect(master);
		}
	}, 70);

	const handle: DroneHandle = {
		stop() {
			if (stopped) return;
			stopped = true;
			const t = audioCtx.currentTime;
			// Fade out: pure gain ramp to silence
			const fadeStart = t + 0.01;
			// Kill LFO immediately to prevent modulation during fade
			lfoGain.gain.cancelScheduledValues(t);
			lfoGain.gain.setValueAtTime(0, t);
			// Capture current gain, ramp to 0 over 600ms
			droneGain.gain.cancelScheduledValues(t);
			const currentGain = droneGain.gain.value;
			droneGain.gain.setValueAtTime(currentGain, t);
			droneGain.gain.setValueAtTime(currentGain, fadeStart);
			droneGain.gain.linearRampToValueAtTime(0, fadeStart + 0.6);
			// DISCONNECT from master first (removes from output graph),
			// THEN stop oscillators. osc.stop() while connected to
			// destination causes a click at the waveform's current phase.
			setTimeout(() => {
				try {
					droneGain.disconnect();
				} catch {
					/* already disconnected */
				}
				// Stop oscillators 100ms after disconnect — no longer audible
				setTimeout(() => {
					try {
						osc1.stop();
						osc2.stop();
						lfo.stop();
					} catch {
						/* ok */
					}
					try {
						osc1.disconnect();
						osc2.disconnect();
						lfo.disconnect();
					} catch {
						/* ok */
					}
				}, 100);
			}, 700);
			if (activeDrone === handle) activeDrone = null;
			// NOTE: No scheduleSuspend() — AudioContext stays alive
		},
		forceStop() {
			// Instant kill — no fade, no timeout. For page teardown / navigation.
			if (stopped) return;
			stopped = true;
			try {
				droneGain.gain.setValueAtTime(0, audioCtx.currentTime);
			} catch {
				/* ok */
			}
			try {
				droneGain.disconnect();
			} catch {
				/* ok */
			}
			try {
				osc1.stop();
				osc2.stop();
				lfo.stop();
			} catch {
				/* ok */
			}
			try {
				osc1.disconnect();
				osc2.disconnect();
				lfo.disconnect();
				lfoGain.disconnect();
			} catch {
				/* ok */
			}
			if (activeDrone === handle) activeDrone = null;
			// NOTE: No scheduleSuspend() — AudioContext stays alive
		},
		setMuted(m: boolean) {
			if (stopped) return;
			muted = m;
			const t = audioCtx.currentTime;
			droneGain.gain.cancelScheduledValues(t);
			droneGain.gain.setValueAtTime(droneGain.gain.value, t);
			droneGain.gain.linearRampToValueAtTime(m ? 0 : 1, t + 0.15);
		},
		isMuted() {
			return muted;
		},
	};

	activeDrone = handle;
	return handle;
}

/** Stop any active drone with fade-out. */
export function stopDrone(): void {
	if (activeDrone) {
		activeDrone.stop();
		activeDrone = null;
	}
}

/**
 * Force-kill drone instantly — no fade, no timeouts.
 * Use on page teardown / navigation where residual audio is unacceptable.
 */
export function forceStopDrone(): void {
	if (activeDrone) {
		activeDrone.forceStop();
		activeDrone = null;
	}
}

/** Get the current active drone handle (if any). */
export function getActiveDrone(): DroneHandle | null {
	return activeDrone;
}
