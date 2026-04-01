/**
 * High-level playback with generation-based cancellation.
 *
 * Each play*() call creates a new "playback generation" gain node.
 * When a new generation starts, the previous one is crossfaded out (~30ms).
 * This eliminates click artifacts when rapidly replaying audio.
 *
 * Feedback chimes are routed through master output (so they appear in the analyser)
 * but use their own separate gain node — they play alongside quiz audio without
 * cancelling it, and don't get cancelled by the next play.
 *
 * All play functions:
 * 1. Call ensureResumed() — async resume for iOS
 * 2. Call beginPlayback() — crossfade out previous, get fresh gain node
 * 3. Route all oscillators through the new gain → master output
 * 4. Set media session metadata
 */

import { ensureResumed, getMasterOutput, midiToFreq } from './context';
import { playEpianoToneToNode, playSineToneToNode, playPianoToneToNode } from './synths';
import { setMediaSessionMetadata, claimAudioSession, scheduleRelease, cancelScheduledRelease } from './session';
import type { ToneType, ChordVoicing } from '$lib/state/schema';
import { applyInversion } from '$lib/definitions/chords';

// ─── Generation-based cancellation ─────────────────────────────────────────

let currentPlaybackGain: GainNode | null = null;

/**
 * Begin a new playback generation.
 * Crossfades out the previous generation's gain node (~30ms ramp to 0),
 * then creates and returns a new gain node connected to master output.
 */
function beginPlayback(audioCtx: AudioContext, master: GainNode): GainNode {
	// Claim audio session on actual playback
	cancelScheduledRelease();
	claimAudioSession();

	// Crossfade out previous generation
	if (currentPlaybackGain) {
		const now = audioCtx.currentTime;
		currentPlaybackGain.gain.cancelScheduledValues(now);
		currentPlaybackGain.gain.setValueAtTime(currentPlaybackGain.gain.value, now);
		currentPlaybackGain.gain.linearRampToValueAtTime(0, now + 0.03);
		const old = currentPlaybackGain;
		setTimeout(() => {
			try {
				old.disconnect();
			} catch {
				/* already disconnected */
			}
		}, 100);
	}
	// New generation
	const gain = audioCtx.createGain();
	gain.gain.value = 1;
	gain.connect(master);
	currentPlaybackGain = gain;
	return gain;
}

// ─── Tone player dispatch ───────────────────────────────────────────────────

function getTonePlayer(toneType: ToneType) {
	if (toneType === 'piano') return playPianoToneToNode;
	if (toneType === 'epiano') return playEpianoToneToNode;
	return playSineToneToNode;
}

// ─── Public playback functions ──────────────────────────────────────────────

/**
 * Play an interval — two notes melodically (ascending/descending) or harmonically.
 */
export async function playInterval(
	rootMidi: number,
	semitones: number,
	direction: 'ascending' | 'descending' | 'harmonic',
	toneType: ToneType = 'sine'
): Promise<void> {
	const audioCtx = await ensureResumed();
	const master = getMasterOutput();
	const gen = beginPlayback(audioCtx, master);
	const now = audioCtx.currentTime;

	const freq1 = midiToFreq(rootMidi);
	const secondMidi = direction === 'descending' ? rootMidi - semitones : rootMidi + semitones;
	const freq2 = midiToFreq(secondMidi);

	const noteDuration = 0.6;
	const harmonicDuration = 1.2;
	const playToNode = getTonePlayer(toneType);

	if (direction === 'harmonic') {
		const harmGain = audioCtx.createGain();
		harmGain.gain.value = 0.7;
		harmGain.connect(gen);

		playToNode(freq1, now, harmonicDuration, audioCtx, harmGain);
		playToNode(freq2, now, harmonicDuration, audioCtx, harmGain);
	} else {
		const gap = toneType === 'piano' ? 0.3 : 0.15;
		playToNode(freq1, now, noteDuration, audioCtx, gen);
		playToNode(freq2, now + noteDuration + gap, noteDuration, audioCtx, gen);
	}

	setMediaSessionMetadata('Interval Practice');
	scheduleRelease();
}

/**
 * Play a chord — multiple notes through a shared gain node.
 *
 * @param rootMidi - MIDI note number for the root
 * @param intervals - semitones from root, e.g. [0, 4, 7] for major triad
 * @param voicing - root position, 1st inversion, or 2nd inversion
 * @param toneType - which synth engine to use
 * @param arpeggiated - if true, play notes sequentially (~150ms apart); if false, block chord
 */
export async function playChord(
	rootMidi: number,
	intervals: number[],
	voicing: ChordVoicing,
	toneType: ToneType = 'epiano',
	arpeggiated: boolean = false
): Promise<void> {
	const audioCtx = await ensureResumed();
	const master = getMasterOutput();
	const gen = beginPlayback(audioCtx, master);
	const now = audioCtx.currentTime;

	const voiced = applyInversion(intervals, voicing);
	const noteCount = voiced.length;

	// Gain node to avoid clipping — scale down per note count
	const chordGain = audioCtx.createGain();
	chordGain.gain.value = 0.7 / Math.sqrt(noteCount);
	chordGain.connect(gen);

	const noteDuration = arpeggiated ? 0.8 : 1.2;
	const arpDelay = 0.15; // 150ms between arpeggiated notes

	const playToNode = getTonePlayer(toneType);

	voiced.forEach((semitones, i) => {
		const freq = midiToFreq(rootMidi + semitones);
		const offset = arpeggiated ? i * arpDelay : Math.random() * 0.015; // humanization for block
		playToNode(freq, now + offset, noteDuration, audioCtx, chordGain);
	});

	setMediaSessionMetadata('Chord Practice');
	scheduleRelease();
}

/**
 * Play a single note through the master output (analyser-connected).
 * Use for scale visualization where each note needs individual timing control.
 */
export async function playNote(
	midi: number,
	toneType: ToneType = 'epiano',
	duration: number = 0.5
): Promise<void> {
	const audioCtx = await ensureResumed();
	const master = getMasterOutput();
	const gen = beginPlayback(audioCtx, master);
	const now = audioCtx.currentTime;
	const freq = midiToFreq(midi);

	const noteGain = audioCtx.createGain();
	noteGain.gain.setValueAtTime(1, now);
	noteGain.gain.setValueAtTime(1, now + duration - 0.03);
	noteGain.gain.linearRampToValueAtTime(0, now + duration);
	noteGain.connect(gen);

	const playToNode = getTonePlayer(toneType);
	playToNode(freq, now, duration, audioCtx, noteGain);

	scheduleRelease();
}

/**
 * Play a scale — sequential notes from root ascending.
 *
 * @param rootMidi - MIDI note number for the root
 * @param intervals - semitones from root for each note, e.g. [0,2,4,5,7,9,11,12]
 * @param toneType - which synth engine to use
 * @param tempo - milliseconds between note onsets (default 150ms)
 */
export async function playScale(
	rootMidi: number,
	intervals: number[],
	toneType: ToneType = 'epiano',
	tempo: number = 150
): Promise<void> {
	const audioCtx = await ensureResumed();
	const master = getMasterOutput();
	const gen = beginPlayback(audioCtx, master);
	const now = audioCtx.currentTime;

	const noteSpacing = tempo / 1000; // seconds between note onsets
	// Note duration slightly shorter than spacing to avoid overlap clicks
	const noteDuration = noteSpacing * 0.85;
	// Fade-out ramp time at end of each note
	const fadeOut = 0.03; // 30ms ramp to zero — eliminates clicks

	const playToNode = getTonePlayer(toneType);

	intervals.forEach((semitones, i) => {
		const freq = midiToFreq(rootMidi + semitones);
		const startTime = now + i * noteSpacing;

		// Use a per-note gain wrapper with guaranteed clean fade-out
		const noteGain = audioCtx.createGain();
		noteGain.gain.setValueAtTime(1, startTime);
		noteGain.gain.setValueAtTime(1, startTime + noteDuration - fadeOut);
		noteGain.gain.linearRampToValueAtTime(0, startTime + noteDuration);
		noteGain.connect(gen);

		playToNode(freq, startTime, noteDuration, audioCtx, noteGain);
	});

	setMediaSessionMetadata('Scale Practice');
	scheduleRelease();
}

/**
 * Feedback chime — short, distinctive.
 * Correct: rising arpeggio chirp. Wrong: descending buzz.
 *
 * Routes through master output (so it appears in the analyser) but does NOT
 * use beginPlayback() — feedback chimes play alongside quiz audio without
 * cancelling it, and don't get cancelled by the next play.
 */
export async function playFeedbackChime(correct: boolean): Promise<void> {
	const audioCtx = await ensureResumed();
	const master = getMasterOutput();
	const now = audioCtx.currentTime;

	// Claim audio session for feedback chime too
	cancelScheduledRelease();
	claimAudioSession();

	// Separate gain node for feedback — independent of playback generations
	const feedbackGain = audioCtx.createGain();
	feedbackGain.gain.value = 1;
	feedbackGain.connect(master);

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
			gain.connect(feedbackGain);
			osc.start(t);
			osc.stop(t + 0.4);
		});
	} else {
		// Descending two-note — mirror of correct chirp, lower + muffled
		const notes = [330, 220]; // E4 → A3 (descending)
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
			gain.connect(feedbackGain);
			osc.start(t);
			osc.stop(t + 0.4);
		});
	}

	// Auto-disconnect feedback gain after chime finishes
	setTimeout(() => {
		try {
			feedbackGain.disconnect();
		} catch {
			/* ok */
		}
	}, 600);

	scheduleRelease();
}
