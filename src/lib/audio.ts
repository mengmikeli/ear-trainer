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
 * Synth tone — futuristic, FM synthesis inspired
 * Two-operator FM with detuned unison for thickness
 */
function playPianoTone(freq: number, startTime: number, duration: number, audioCtx: AudioContext): void {
	// Carrier oscillator
	const carrier = audioCtx.createOscillator();
	const carrierGain = audioCtx.createGain();
	carrier.type = 'sawtooth';
	carrier.frequency.value = freq;

	// Detuned unison for width
	const detune = audioCtx.createOscillator();
	const detuneGain = audioCtx.createGain();
	detune.type = 'sawtooth';
	detune.frequency.value = freq * 1.003; // slight detune
	detuneGain.gain.setValueAtTime(0.15, startTime);
	detuneGain.gain.linearRampToValueAtTime(0, startTime + duration);

	// FM modulator for metallic attack
	const modulator = audioCtx.createOscillator();
	const modGain = audioCtx.createGain();
	modulator.type = 'sine';
	modulator.frequency.value = freq * 3; // 3:1 ratio
	modGain.gain.setValueAtTime(freq * 0.5, startTime); // high mod index at attack
	modGain.gain.exponentialRampToValueAtTime(1, startTime + 0.15); // decay to almost nothing
	modulator.connect(modGain);
	modGain.connect(carrier.frequency);

	// Low-pass filter for warmth
	const filter = audioCtx.createBiquadFilter();
	filter.type = 'lowpass';
	filter.frequency.setValueAtTime(freq * 6, startTime);
	filter.frequency.exponentialRampToValueAtTime(freq * 1.5, startTime + duration * 0.7);
	filter.Q.value = 1;

	// Envelope — punchy attack, sustain, clean release
	carrierGain.gain.setValueAtTime(0, startTime);
	carrierGain.gain.linearRampToValueAtTime(0.3, startTime + 0.005);
	carrierGain.gain.setValueAtTime(0.3, startTime + 0.005);
	carrierGain.gain.exponentialRampToValueAtTime(0.18, startTime + 0.1);
	carrierGain.gain.setValueAtTime(0.18, startTime + duration - 0.1);
	carrierGain.gain.linearRampToValueAtTime(0, startTime + duration);

	// Routing
	carrier.connect(filter);
	detune.connect(detuneGain);
	detuneGain.connect(filter);
	filter.connect(carrierGain);
	carrierGain.connect(audioCtx.destination);

	modulator.start(startTime);
	modulator.stop(startTime + duration);
	carrier.start(startTime);
	carrier.stop(startTime + duration);
	detune.start(startTime);
	detune.stop(startTime + duration);
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
	const gap = 0.15;

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
		// Low buzzy descending tone
		const osc = audioCtx.createOscillator();
		const gain = audioCtx.createGain();
		osc.type = 'square';
		osc.frequency.setValueAtTime(300, now);
		osc.frequency.linearRampToValueAtTime(150, now + 0.25);
		gain.gain.setValueAtTime(0.12, now);
		gain.gain.linearRampToValueAtTime(0, now + 0.3);
		osc.connect(gain);
		gain.connect(audioCtx.destination);
		osc.start(now);
		osc.stop(now + 0.3);
	}
}
