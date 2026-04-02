/**
 * First-Run Experience (FRE) quiz config.
 *
 * Boot sequence → 2 scripted questions (Octave, Perfect 5th) with guidance.
 * No stat recording — marks FRE complete via onSessionEnd, then shows
 * a conclusion debrief screen before navigating home.
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

// ─── Boot sequence lines ────────────────────────────────────────────────────

const BOOT_LINES = [
	'SYSTEM CHECK...',
	'AUDIO ENGINE: ONLINE',
	'FREQUENCY ANALYZER: CALIBRATED',
	'EAR TRAINER v4.0',
	'',
	'READY',
];

// ─── Config factory ─────────────────────────────────────────────────────────

export function createFREConfig(): QuizSessionConfig {
	let questionIndex = 0;

	return {
		heading: 'INITIALIZING',
		contentKinds: ['interval'],
		sessionLength: 2,
		freMode: true,
		autoPlay: false, // Component controls play via terminal dismiss

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

		/**
		 * Guidance messages keyed by (questionNum, phase).
		 *
		 * questionNum mapping (after nextQuestion increments):
		 *   0 = before any question (boot sequence, component create)
		 *   1 = Q1 active (Octave)
		 *   2 = Q2 active (Perfect 5th)
		 */
		getGuidanceMessage(questionNum: number, phase: QuizPhase, correct?: boolean): string | null {
			// Boot sequence — component creates with questionNum=0, phase='idle'
			if (phase === 'idle' && questionNum === 0) {
				return 'BOOT:' + BOOT_LINES.join('\n');
			}
			// Q1 pre-play (after boot dismiss → nextQuestion)
			if (phase === 'idle' && questionNum === 1) {
				return 'TRANSMITTING...\n\nLISTEN TO THE INTERVAL\nIDENTIFY THE FREQUENCY';
			}
			// Q2 pre-play intro (questionNum=2 after nextQuestion increments)
			if (phase === 'idle' && questionNum === 2) {
				return 'TRANSMITTING...\n\nNEW FREQUENCY DETECTED\nANALYZING SIGNAL';
			}
			// Post-answer feedback — Q1 (Octave)
			if (phase === 'feedback_correct' && questionNum === 1) {
				return 'OCTAVE DETECTED\n\nSAME NOTE -- HIGHER PITCH\nSIGNAL CONFIRMED';
			}
			if ((phase === 'feedback_wrong' || phase === 'result_mode') && questionNum === 1) {
				return 'SIGNAL MISMATCH\n\nTARGET WAS OCTAVE\nCALIBRATING...';
			}
			// Post-answer feedback — Q2 (Perfect 5th)
			if (phase === 'feedback_correct' && questionNum === 2) {
				return 'PERFECT 5TH CONFIRMED\n\nSTRONG SIGNAL\nCALIBRATION COMPLETE';
			}
			if ((phase === 'feedback_wrong' || phase === 'result_mode') && questionNum === 2) {
				return 'CLOSE ENOUGH\n\nTARGET WAS PERFECT 5TH\nCALIBRATION COMPLETE';
			}
			return null;
		},
	};
}
