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

function playSineTone(freq: number, startTime: number, duration: number, audioCtx: AudioContext): void {
	const osc = audioCtx.createOscillator();
	const gain = audioCtx.createGain();
	osc.type = 'sine';
	osc.frequency.value = freq;
	gain.gain.setValueAtTime(0, startTime);
	gain.gain.linearRampToValueAtTime(0.5, startTime + 0.02);
	gain.gain.setValueAtTime(0.5, startTime + duration - 0.05);
	gain.gain.linearRampToValueAtTime(0, startTime + duration);
	osc.connect(gain);
	gain.connect(audioCtx.destination);
	osc.start(startTime);
	osc.stop(startTime + duration);
}

function playPianoTone(freq: number, startTime: number, duration: number, audioCtx: AudioContext): void {
	const harmonics = [1, 2, 3, 4];
	const amplitudes = [0.5, 0.2, 0.1, 0.05];

	for (let i = 0; i < harmonics.length; i++) {
		const osc = audioCtx.createOscillator();
		const gain = audioCtx.createGain();
		osc.type = 'sine';
		osc.frequency.value = freq * harmonics[i];
		const attack = 0.01;
		const decay = 0.1;
		const sustain = amplitudes[i] * 0.6;
		gain.gain.setValueAtTime(0, startTime);
		gain.gain.linearRampToValueAtTime(amplitudes[i], startTime + attack);
		gain.gain.linearRampToValueAtTime(sustain, startTime + attack + decay);
		gain.gain.setValueAtTime(sustain, startTime + duration - 0.1);
		gain.gain.linearRampToValueAtTime(0, startTime + duration);
		osc.connect(gain);
		gain.connect(audioCtx.destination);
		osc.start(startTime);
		osc.stop(startTime + duration);
	}
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

export function playFeedbackChime(correct: boolean): void {
	const audioCtx = getContext();
	const now = audioCtx.currentTime;
	const osc = audioCtx.createOscillator();
	const gain = audioCtx.createGain();
	osc.type = 'sine';
	osc.frequency.value = correct ? 880 : 220;
	gain.gain.setValueAtTime(0.2, now);
	gain.gain.linearRampToValueAtTime(0, now + 0.3);
	osc.connect(gain);
	gain.connect(audioCtx.destination);
	osc.start(now);
	osc.stop(now + 0.3);
}
