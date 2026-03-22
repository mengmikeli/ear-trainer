import type { ToneType } from './types';

let ctx: AudioContext | null = null;

/**
 * Ensure AudioContext exists and is running.
 *
 * iOS Safari quirks (all required for reliable playback):
 * 1. Must use webkitAudioContext fallback on older iOS
 * 2. AudioContext must be created AND resumed inside a user gesture
 * 3. A silent buffer must be played to fully unlock the audio pipeline
 * 4. navigator.audioSession.type = "playback" (iOS 17+) ensures sound
 *    plays even when the device mute switch is on
 */
function getContext(): AudioContext {
	if (!ctx) {
		const AC = window.AudioContext || (window as any).webkitAudioContext;
		ctx = new AC();

		// iOS 17+: override audio session so sound plays even in silent mode
		if ('audioSession' in navigator && 'type' in (navigator as any).audioSession) {
			(navigator as any).audioSession.type = 'playback';
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

export function midiToFreq(midi: number): number {
	return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Electric piano — FM synthesis Rhodes-style
 * Clear attack, bell-like harmonics, great for harmonic intervals
 */
function playEpianoTone(freq: number, startTime: number, duration: number, audioCtx: AudioContext): void {
	// Carrier: sine wave at fundamental
	const carrier = audioCtx.createOscillator();
	const carrierGain = audioCtx.createGain();
	carrier.type = 'sine';
	carrier.frequency.value = freq;

	// Modulator: sine wave at 2x fundamental (FM ratio = 2:1 for Rhodes character)
	const modulator = audioCtx.createOscillator();
	const modGain = audioCtx.createGain();
	modulator.type = 'sine';
	modulator.frequency.value = freq * 2;
	// Modulation depth — higher = more bell-like harmonics
	modGain.gain.setValueAtTime(freq * 1.5, startTime);
	modGain.gain.exponentialRampToValueAtTime(freq * 0.1, startTime + duration * 0.7);
	modGain.gain.linearRampToValueAtTime(0, startTime + duration);

	// FM: modulator → modGain → carrier.frequency
	modulator.connect(modGain);
	modGain.connect(carrier.frequency);

	// Carrier envelope — sharp attack, smooth decay
	carrierGain.gain.setValueAtTime(0, startTime);
	carrierGain.gain.linearRampToValueAtTime(0.35, startTime + 0.005); // snappy attack
	carrierGain.gain.exponentialRampToValueAtTime(0.15, startTime + 0.15);
	carrierGain.gain.setValueAtTime(0.15, startTime + duration - 0.2);
	carrierGain.gain.linearRampToValueAtTime(0, startTime + duration);

	carrier.connect(carrierGain);
	carrierGain.connect(audioCtx.destination);

	carrier.start(startTime);
	carrier.stop(startTime + duration);
	modulator.start(startTime);
	modulator.stop(startTime + duration);
}

/**
 * Electric piano routed to a specific destination node (for harmonic stacking).
 */
function playEpianoToneToNode(freq: number, startTime: number, duration: number, audioCtx: AudioContext, dest: AudioNode): void {
	const carrier = audioCtx.createOscillator();
	const carrierGain = audioCtx.createGain();
	carrier.type = 'sine';
	carrier.frequency.value = freq;

	const modulator = audioCtx.createOscillator();
	const modGain = audioCtx.createGain();
	modulator.type = 'sine';
	modulator.frequency.value = freq * 2;
	modGain.gain.setValueAtTime(freq * 1.5, startTime);
	modGain.gain.exponentialRampToValueAtTime(freq * 0.1, startTime + duration * 0.7);
	modGain.gain.linearRampToValueAtTime(0, startTime + duration);

	modulator.connect(modGain);
	modGain.connect(carrier.frequency);

	carrierGain.gain.setValueAtTime(0, startTime);
	carrierGain.gain.linearRampToValueAtTime(0.35, startTime + 0.005);
	carrierGain.gain.exponentialRampToValueAtTime(0.15, startTime + 0.15);
	carrierGain.gain.setValueAtTime(0.15, startTime + duration - 0.2);
	carrierGain.gain.linearRampToValueAtTime(0, startTime + duration);

	carrier.connect(carrierGain);
	carrierGain.connect(dest);

	carrier.start(startTime);
	carrier.stop(startTime + duration);
	modulator.start(startTime);
	modulator.stop(startTime + duration);
}

/**
 * Sine tone — warm triangle wave, pure
 */
function playSineTone(freq: number, startTime: number, duration: number, audioCtx: AudioContext): void {
	const osc = audioCtx.createOscillator();
	const gain = audioCtx.createGain();

	// Use triangle wave for warmer sine-like tone
	osc.type = 'triangle';
	osc.frequency.value = freq;

	// Sub-oscillator for body (one octave down, quiet)
	const subOsc = audioCtx.createOscillator();
	const subGain = audioCtx.createGain();
	subOsc.type = 'sine';
	subOsc.frequency.value = freq / 2;
	subGain.gain.setValueAtTime(0.08, startTime);
	subGain.gain.linearRampToValueAtTime(0, startTime + duration);
	subOsc.connect(subGain);
	subGain.connect(audioCtx.destination);
	subOsc.start(startTime);
	subOsc.stop(startTime + duration);

	// Main envelope — snappy attack, smooth decay
	gain.gain.setValueAtTime(0, startTime);
	gain.gain.linearRampToValueAtTime(0.4, startTime + 0.01);
	gain.gain.exponentialRampToValueAtTime(0.25, startTime + 0.08);
	gain.gain.setValueAtTime(0.25, startTime + duration - 0.15);
	gain.gain.linearRampToValueAtTime(0, startTime + duration);

	osc.connect(gain);
	gain.connect(audioCtx.destination);
	osc.start(startTime);
	osc.stop(startTime + duration);
}

/**
 * Ambient synth tone — pad-like, reverberant, dreamy
 * Layered sine waves with slow attack, chorus detune, and convolution-like tail
 */
function playPianoTone(freq: number, startTime: number, duration: number, audioCtx: AudioContext): void {
	const padDuration = duration + 0.4; // longer tail for ambient feel

	// Layer 1: Main sine
	const osc1 = audioCtx.createOscillator();
	const gain1 = audioCtx.createGain();
	osc1.type = 'sine';
	osc1.frequency.value = freq;
	gain1.gain.setValueAtTime(0, startTime);
	gain1.gain.linearRampToValueAtTime(0.2, startTime + 0.12); // slow attack
	gain1.gain.setValueAtTime(0.2, startTime + padDuration - 0.3);
	gain1.gain.linearRampToValueAtTime(0, startTime + padDuration);
	osc1.connect(gain1);

	// Layer 2: Detuned +5 cents — chorus width
	const osc2 = audioCtx.createOscillator();
	const gain2 = audioCtx.createGain();
	osc2.type = 'sine';
	osc2.frequency.value = freq * 1.003;
	gain2.gain.setValueAtTime(0, startTime);
	gain2.gain.linearRampToValueAtTime(0.12, startTime + 0.15);
	gain2.gain.setValueAtTime(0.12, startTime + padDuration - 0.3);
	gain2.gain.linearRampToValueAtTime(0, startTime + padDuration);
	osc2.connect(gain2);

	// Layer 3: Detuned -5 cents
	const osc3 = audioCtx.createOscillator();
	const gain3 = audioCtx.createGain();
	osc3.type = 'sine';
	osc3.frequency.value = freq * 0.997;
	gain3.gain.setValueAtTime(0, startTime);
	gain3.gain.linearRampToValueAtTime(0.12, startTime + 0.15);
	gain3.gain.setValueAtTime(0.12, startTime + padDuration - 0.3);
	gain3.gain.linearRampToValueAtTime(0, startTime + padDuration);
	osc3.connect(gain3);

	// Layer 4: Octave up, very quiet — shimmer
	const osc4 = audioCtx.createOscillator();
	const gain4 = audioCtx.createGain();
	osc4.type = 'triangle';
	osc4.frequency.value = freq * 2;
	gain4.gain.setValueAtTime(0, startTime);
	gain4.gain.linearRampToValueAtTime(0.04, startTime + 0.2);
	gain4.gain.setValueAtTime(0.04, startTime + padDuration - 0.4);
	gain4.gain.linearRampToValueAtTime(0, startTime + padDuration);
	osc4.connect(gain4);

	// Layer 5: Sub — one octave down
	const sub = audioCtx.createOscillator();
	const subGain = audioCtx.createGain();
	sub.type = 'sine';
	sub.frequency.value = freq / 2;
	subGain.gain.setValueAtTime(0, startTime);
	subGain.gain.linearRampToValueAtTime(0.06, startTime + 0.1);
	subGain.gain.setValueAtTime(0.06, startTime + padDuration - 0.3);
	subGain.gain.linearRampToValueAtTime(0, startTime + padDuration);
	sub.connect(subGain);

	// Low-pass filter on everything for warmth
	const filter = audioCtx.createBiquadFilter();
	filter.type = 'lowpass';
	filter.frequency.value = freq * 3;
	filter.Q.value = 0.5;

	// Connect all through filter
	gain1.connect(filter);
	gain2.connect(filter);
	gain3.connect(filter);
	gain4.connect(filter);
	subGain.connect(filter);
	filter.connect(audioCtx.destination);

	// Start/stop all
	[osc1, osc2, osc3, osc4, sub].forEach(osc => {
		osc.start(startTime);
		osc.stop(startTime + padDuration);
	});
}

/**
 * Play two notes simultaneously through a shared gain node to avoid clipping.
 * Used for harmonic interval playback.
 */
function playHarmonicPair(
	freq1: number,
	freq2: number,
	startTime: number,
	duration: number,
	audioCtx: AudioContext,
	toneType: ToneType
): void {
	// Route both notes through a master gain node at 0.7 to avoid clipping
	const masterGain = audioCtx.createGain();
	masterGain.gain.value = 0.7;
	masterGain.connect(audioCtx.destination);

	if (toneType === 'piano') {
		playPianoToneToNode(freq1, startTime, duration, audioCtx, masterGain);
		playPianoToneToNode(freq2, startTime, duration, audioCtx, masterGain);
	} else if (toneType === 'epiano') {
		playEpianoToneToNode(freq1, startTime, duration, audioCtx, masterGain);
		playEpianoToneToNode(freq2, startTime, duration, audioCtx, masterGain);
	} else {
		playSineToneToNode(freq1, startTime, duration, audioCtx, masterGain);
		playSineToneToNode(freq2, startTime, duration, audioCtx, masterGain);
	}
}

/**
 * Sine tone routed to a specific destination node (for harmonic stacking).
 */
function playSineToneToNode(
	freq: number,
	startTime: number,
	duration: number,
	audioCtx: AudioContext,
	destNode: AudioNode
): void {
	const osc = audioCtx.createOscillator();
	const gain = audioCtx.createGain();

	osc.type = 'triangle';
	osc.frequency.value = freq;

	const subOsc = audioCtx.createOscillator();
	const subGain = audioCtx.createGain();
	subOsc.type = 'sine';
	subOsc.frequency.value = freq / 2;
	subGain.gain.setValueAtTime(0.08, startTime);
	subGain.gain.linearRampToValueAtTime(0, startTime + duration);
	subOsc.connect(subGain);
	subGain.connect(destNode);
	subOsc.start(startTime);
	subOsc.stop(startTime + duration);

	gain.gain.setValueAtTime(0, startTime);
	gain.gain.linearRampToValueAtTime(0.4, startTime + 0.01);
	gain.gain.exponentialRampToValueAtTime(0.25, startTime + 0.08);
	gain.gain.setValueAtTime(0.25, startTime + duration - 0.15);
	gain.gain.linearRampToValueAtTime(0, startTime + duration);

	osc.connect(gain);
	gain.connect(destNode);
	osc.start(startTime);
	osc.stop(startTime + duration);
}

/**
 * Piano tone routed to a specific destination node (for harmonic stacking).
 */
function playPianoToneToNode(
	freq: number,
	startTime: number,
	duration: number,
	audioCtx: AudioContext,
	destNode: AudioNode
): void {
	const padDuration = duration + 0.4;

	const osc1 = audioCtx.createOscillator();
	const gain1 = audioCtx.createGain();
	osc1.type = 'sine';
	osc1.frequency.value = freq;
	gain1.gain.setValueAtTime(0, startTime);
	gain1.gain.linearRampToValueAtTime(0.2, startTime + 0.12);
	gain1.gain.setValueAtTime(0.2, startTime + padDuration - 0.3);
	gain1.gain.linearRampToValueAtTime(0, startTime + padDuration);
	osc1.connect(gain1);

	const osc2 = audioCtx.createOscillator();
	const gain2 = audioCtx.createGain();
	osc2.type = 'sine';
	osc2.frequency.value = freq * 1.003;
	gain2.gain.setValueAtTime(0, startTime);
	gain2.gain.linearRampToValueAtTime(0.12, startTime + 0.15);
	gain2.gain.setValueAtTime(0.12, startTime + padDuration - 0.3);
	gain2.gain.linearRampToValueAtTime(0, startTime + padDuration);
	osc2.connect(gain2);

	const osc3 = audioCtx.createOscillator();
	const gain3 = audioCtx.createGain();
	osc3.type = 'sine';
	osc3.frequency.value = freq * 0.997;
	gain3.gain.setValueAtTime(0, startTime);
	gain3.gain.linearRampToValueAtTime(0.12, startTime + 0.15);
	gain3.gain.setValueAtTime(0.12, startTime + padDuration - 0.3);
	gain3.gain.linearRampToValueAtTime(0, startTime + padDuration);
	osc3.connect(gain3);

	const osc4 = audioCtx.createOscillator();
	const gain4 = audioCtx.createGain();
	osc4.type = 'triangle';
	osc4.frequency.value = freq * 2;
	gain4.gain.setValueAtTime(0, startTime);
	gain4.gain.linearRampToValueAtTime(0.04, startTime + 0.2);
	gain4.gain.setValueAtTime(0.04, startTime + padDuration - 0.4);
	gain4.gain.linearRampToValueAtTime(0, startTime + padDuration);
	osc4.connect(gain4);

	const sub = audioCtx.createOscillator();
	const subGain = audioCtx.createGain();
	sub.type = 'sine';
	sub.frequency.value = freq / 2;
	subGain.gain.setValueAtTime(0, startTime);
	subGain.gain.linearRampToValueAtTime(0.06, startTime + 0.1);
	subGain.gain.setValueAtTime(0.06, startTime + padDuration - 0.3);
	subGain.gain.linearRampToValueAtTime(0, startTime + padDuration);
	sub.connect(subGain);

	const filter = audioCtx.createBiquadFilter();
	filter.type = 'lowpass';
	filter.frequency.value = freq * 3;
	filter.Q.value = 0.5;

	gain1.connect(filter);
	gain2.connect(filter);
	gain3.connect(filter);
	gain4.connect(filter);
	subGain.connect(filter);
	filter.connect(destNode);

	[osc1, osc2, osc3, osc4, sub].forEach(osc => {
		osc.start(startTime);
		osc.stop(startTime + padDuration);
	});
}

/**
 * Warm up the AudioContext on first user interaction.
 * Call this once from a top-level touch/click handler to ensure
 * iOS Safari has unlocked audio before the user reaches the quiz.
 */
export function warmUpAudio(): void {
	getContext();
}

export function playInterval(
	rootMidi: number,
	semitones: number,
	direction: 'ascending' | 'descending' | 'harmonic',
	toneType: ToneType = 'sine'
): void {
	const audioCtx = getContext();
	const now = audioCtx.currentTime;

	const freq1 = midiToFreq(rootMidi);
	const secondMidi = direction === 'descending' ? rootMidi - semitones : rootMidi + semitones;
	const freq2 = midiToFreq(secondMidi);

	const noteDuration = 0.6;
	const harmonicDuration = 1.2; // longer for harmonic — need time to hear both notes
	const playFn = toneType === 'piano' ? playPianoTone : toneType === 'epiano' ? playEpianoTone : playSineTone;

	if (direction === 'harmonic') {
		// Play both notes simultaneously with reduced gain to avoid clipping
		playHarmonicPair(freq1, freq2, now, harmonicDuration, audioCtx, toneType);
	} else {
		const gap = toneType === 'piano' ? 0.3 : 0.15;
		playFn(freq1, now, noteDuration, audioCtx);
		playFn(freq2, now + noteDuration + gap, noteDuration, audioCtx);
	}
}

/**
 * Feedback chime — short, distinctive
 * Correct: rising arpeggio chirp
 * Wrong: descending buzz
 */
export function playFeedbackChime(correct: boolean): void {
	const audioCtx = getContext();
	const now = audioCtx.currentTime;

	if (correct) {
		// Ascending two-note — bassy, muffled, ambient
		const notes = [220, 330]; // A3 → E4
		notes.forEach((freq, i) => {
			const osc = audioCtx.createOscillator();
			const gain = audioCtx.createGain();
			osc.type = 'triangle';
			osc.frequency.value = freq;
			const t = now + i * 0.1;
			gain.gain.setValueAtTime(0, t);
			gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
			gain.gain.setValueAtTime(0.18, t + 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

			const filter = audioCtx.createBiquadFilter();
			filter.type = 'lowpass';
			filter.frequency.value = 600;
			filter.Q.value = 1;

			osc.connect(filter);
			filter.connect(gain);
			gain.connect(audioCtx.destination);
			osc.start(t);
			osc.stop(t + 0.4);
		});
	} else {
		// Descending two-note — mirror of correct chirp, lower + muffled
		const notes = [330, 220]; // E4 → A3 (descending, one octave below correct)
		notes.forEach((freq, i) => {
			const osc = audioCtx.createOscillator();
			const gain = audioCtx.createGain();
			osc.type = 'triangle';
			osc.frequency.value = freq;
			const t = now + i * 0.1;
			gain.gain.setValueAtTime(0, t);
			gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
			gain.gain.setValueAtTime(0.18, t + 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

			const filter = audioCtx.createBiquadFilter();
			filter.type = 'lowpass';
			filter.frequency.value = 600;
			filter.Q.value = 1;

			osc.connect(filter);
			filter.connect(gain);
			gain.connect(audioCtx.destination);
			osc.start(t);
			osc.stop(t + 0.4);
		});
	}
}
