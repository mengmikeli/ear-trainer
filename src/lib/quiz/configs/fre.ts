/**
 * First-Run Experience (FRE) quiz config.
 *
 * Exactly 2 scripted questions (Octave, Perfect 5th) with guidance messages.
 * No stat recording, no debrief — marks FRE complete and navigates home.
 */

import type { QuizSessionConfig, UnifiedQuestion, PlaybackInfo, QuizPhase } from '../types';
import type { UserStateV4 } from '$lib/state/schema';
import { playInterval } from '$lib/audio/playback';
import { INTERVALS } from '$lib/definitions/intervals';

// ─── Scripted questions ─────────────────────────────────────────────────────

const SCRIPTED = [
	{ id: 'P8', name: 'Octave', semitones: 12 },
	{ id: 'P5', name: 'Perfect 5th', semitones: 7 },
];

const ROOT_MIDI = 60; // C4

// Tier 1 intervals for distractor pool
const TIER1 = INTERVALS.filter((i) => i.tier <= 2);

function buildChoices(correctId: string) {
	const correct = TIER1.find((i) => i.id === correctId)!;
	const pool = TIER1.filter((i) => i.id !== correctId);
	const shuffled = [...pool].sort(() => Math.random() - 0.5);
	const distractors = shuffled.slice(0, 3);
	const all = [correct, ...distractors].sort(() => Math.random() - 0.5);
	return all.map((i) => ({ id: i.id, name: i.name, label: i.id }));
}

// ─── Config factory ─────────────────────────────────────────────────────────

export function createFREConfig(): QuizSessionConfig {
	let questionIndex = 0;

	return {
		heading: 'INITIALIZING',
		contentKinds: ['interval'],
		sessionLength: 2,
		skipDebrief: true,

		generateQuestion(_state: UserStateV4): UnifiedQuestion {
			const q = SCRIPTED[Math.min(questionIndex, SCRIPTED.length - 1)];
			questionIndex++;

			return {
				id: `interval:${q.id}:ascending`,
				kind: 'interval',
				rootNote: ROOT_MIDI,
				playback: {
					type: 'interval',
					rootNote: ROOT_MIDI,
					intervals: [q.semitones],
					toneType: 'epiano',
					direction: 'ascending',
				},
				correctAnswer: { id: q.id, name: q.name, label: q.id },
				choices: buildChoices(q.id),
				replays: 0,
			};
		},

		async playAudio(q: UnifiedQuestion): Promise<PlaybackInfo> {
			const semitones = q.playback.intervals[0];
			await playInterval(
				q.rootNote,
				semitones,
				'ascending',
				'epiano',
			);
			const noteDur = 0.6;
			const gap = 0.3; // epiano gap
			return {
				durationMs: (noteDur * 2 + gap) * 1000 + 200,
				notes: [q.rootNote],
			};
		},

		// No onAnswer — FRE doesn't record stats

		getGuidanceMessage(questionNum: number, phase: QuizPhase, correct?: boolean): string | null {
			if (phase === 'idle' && questionNum === 0) {
				return 'SYSTEM INITIALIZING\n\nLISTEN CAREFULLY\nIDENTIFY THE INTERVAL\nTAP PLAY TO BEGIN';
			}
			if (phase === 'idle' && questionNum === 1) {
				return 'SIGNAL ACQUIRED\n\nNEW FREQUENCY DETECTED\nTAP PLAY TO ANALYZE';
			}
			if (phase === 'awaiting_answer') {
				return 'ANALYZING\n\nSELECT MATCHING FREQUENCY';
			}
			if (phase === 'feedback_correct' && questionNum === 1) {
				return 'OCTAVE DETECTED\n\nSAME NOTE -- HIGHER PITCH\nSIGNAL CONFIRMED';
			}
			if (phase === 'feedback_wrong' && questionNum === 1) {
				return 'SIGNAL MISMATCH\n\nTARGET WAS OCTAVE\nCALIBRATING';
			}
			if (phase === 'feedback_correct' && questionNum === 2) {
				return 'PERFECT 5TH CONFIRMED\n\nNATURAL APTITUDE DETECTED\nSYSTEM READY';
			}
			if (phase === 'feedback_wrong' && questionNum === 2) {
				return 'SIGNAL MISMATCH\n\nTARGET WAS PERFECT 5TH\nCALIBRATION COMPLETE';
			}
			return null;
		},
	};
}
