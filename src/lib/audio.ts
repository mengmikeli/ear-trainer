import type { ToneType } from './types';

let ctx: AudioContext | null = null;

function getContext(): AudioContext {
	if (!ctx) ctx = new AudioContext();
	if (ctx.state === 'suspended') ctx.resume();
	return ctx;
}

export function midiToFreq(midi: number): number {
	return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Sine tone — clean, pure, clinical
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

export function playInterval(
	rootMidi: number,
	semitones: number,
	direction: 'ascending' | 'descending',
	toneType: ToneType = 'sine'
): void {
	const audioCtx = getContext();
	const now = audioCtx.currentTime;

	const freq1 = midiToFreq(rootMidi);
	const secondMidi = direction === 'ascending' ? rootMidi + semitones : rootMidi - semitones;
	const freq2 = midiToFreq(secondMidi);

	const noteDuration = 0.6;
	const gap = toneType === 'piano' ? 0.3 : 0.15; // more space for ambient tail

	const playFn = toneType === 'piano' ? playPianoTone : playSineTone;
	playFn(freq1, now, noteDuration, audioCtx);
	playFn(freq2, now + noteDuration + gap, noteDuration, audioCtx);
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
		// Rising two-note chirp
		const notes = [880, 1320]; // A5 → E6
		notes.forEach((freq, i) => {
			const osc = audioCtx.createOscillator();
			const gain = audioCtx.createGain();
			osc.type = 'triangle';
			osc.frequency.value = freq;
			const t = now + i * 0.08;
			gain.gain.setValueAtTime(0, t);
			gain.gain.linearRampToValueAtTime(0.2, t + 0.01);
			gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
			osc.connect(gain);
			gain.connect(audioCtx.destination);
			osc.start(t);
			osc.stop(t + 0.15);
		});
	} else {
		// Sci-fi error tone — metallic dissonant cluster with filter sweep
		const baseFreq = 220;

		// Dissonant tritone cluster
		const freqs = [baseFreq, baseFreq * 1.414, baseFreq * 0.5]; // root, tritone, sub
		freqs.forEach((freq, i) => {
			const osc = audioCtx.createOscillator();
			const gain = audioCtx.createGain();
			osc.type = i === 2 ? 'sine' : 'sawtooth';
			osc.frequency.setValueAtTime(freq, now);
			osc.frequency.exponentialRampToValueAtTime(freq * 0.85, now + 0.4);
			const vol = i === 2 ? 0.06 : 0.05;
			gain.gain.setValueAtTime(0, now);
			gain.gain.linearRampToValueAtTime(vol, now + 0.01);
			gain.gain.setValueAtTime(vol, now + 0.15);
			gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

			const filter = audioCtx.createBiquadFilter();
			filter.type = 'lowpass';
			filter.frequency.setValueAtTime(3000, now);
			filter.frequency.exponentialRampToValueAtTime(200, now + 0.4);
			filter.Q.value = 4;

			osc.connect(filter);
			filter.connect(gain);
			gain.connect(audioCtx.destination);
			osc.start(now);
			osc.stop(now + 0.5);
		});
	}
}
