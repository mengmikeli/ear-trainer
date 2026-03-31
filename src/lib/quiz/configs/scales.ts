/**
 * Scale quiz config factory.
 *
 * Bridges scale quiz logic to the unified QuizSessionConfig.
 */

import type { QuizSessionConfig, UnifiedQuestion, QuestionResult, PlaybackInfo } from '../types';
import type { UserStateV4 } from '$lib/state/schema';
import { defaultContentStats } from '$lib/state/schema';
import { getStats, getStatsForDef, aggregateStats } from '$lib/state/stats';
import { playScale } from '$lib/audio/playback';
import { responseQuality, calculateSm2 } from '$lib/learning/sm2';
import { SCALES, type ScaleDef } from '$lib/definitions/scales';

const TEMPO = 150;

// ─── Helpers ────────────────────────────────────────────────────────────────

function getEnabledScalesV4(state: UserStateV4): ScaleDef[] {
	return SCALES.filter((def) => {
		const d = state.definitions.scales[def.id];
		return d?.unlocked && d?.enabled;
	});
}

function weightedPick<T>(items: { item: T; weight: number }[]): T {
	const total = items.reduce((s, w) => s + w.weight, 0);
	let roll = Math.random() * total;
	for (const w of items) {
		roll -= w.weight;
		if (roll <= 0) return w.item;
	}
	return items[items.length - 1].item;
}

function pickScaleV4(state: UserStateV4): ScaleDef {
	const enabled = getEnabledScalesV4(state);
	if (enabled.length === 0) throw new Error('No enabled scales');
	const now = Date.now();

	const weights = enabled.map((def) => {
		const s = getStats(state.stats, `scale:${def.id}`);
		const accuracy = s.attempts > 0 ? s.correct / s.attempts : 0.5;
		const weaknessWeight = 1 - accuracy;
		const overdue = s.nextReview > 0 ? Math.max(0, now - s.nextReview) : 0;
		const reviewWeight = Math.min(1, overdue / (24 * 60 * 60 * 1000));
		const newBoost = s.attempts === 0 ? 0.5 : 0;

		return { item: def, weight: 0.1 + weaknessWeight * 0.5 + reviewWeight * 0.3 + newBoost };
	});

	return weightedPick(weights);
}

function generateScaleDistractorsV4(correctId: string, state: UserStateV4): ScaleDef[] {
	const correctDef = SCALES.find((s) => s.id === correctId);
	const correctIntervals = new Set(correctDef?.intervals ?? []);

	const enabled = getEnabledScalesV4(state).filter((s) => s.id !== correctId);
	const shuffled = [...enabled].sort(() => Math.random() - 0.5);
	if (shuffled.length >= 3) return shuffled.slice(0, 3);

	const usedIds = new Set([correctId, ...shuffled.map((s) => s.id)]);
	const locked = SCALES.filter((s) => !usedIds.has(s.id)).sort((a, b) => {
		const sharedA = a.intervals.filter((i) => correctIntervals.has(i)).length;
		const sharedB = b.intervals.filter((i) => correctIntervals.has(i)).length;
		return sharedB - sharedA;
	});

	const result = [...shuffled];
	for (const def of locked) {
		if (result.length >= 3) break;
		result.push(def);
	}
	return result;
}

// ─── Config factory ─────────────────────────────────────────────────────────

export function createScaleConfig(state: UserStateV4): QuizSessionConfig {
	return {
		heading: 'SCALES',
		contentKinds: ['scale'],
		sessionLength: state.settings.sessionLength,
		countdownDuration: 10000,

		generateQuestion(s: UserStateV4): UnifiedQuestion {
			const scale = pickScaleV4(s);
			const highestInterval = Math.max(...scale.intervals);
			const maxRoot = 72 - highestInterval;
			const rootNote = 48 + Math.floor(Math.random() * Math.max(1, maxRoot - 48 + 1));

			const distractors = generateScaleDistractorsV4(scale.id, s);
			const seen = new Set<string>();
			const raw = [scale, ...distractors].filter((c) => {
				if (seen.has(c.id)) return false;
				seen.add(c.id);
				return true;
			});
			const choices = raw.sort(() => Math.random() - 0.5);

			return {
				id: `scale:${scale.id}`,
				kind: 'scale',
				rootNote,
				playback: {
					type: 'scale',
					rootNote,
					intervals: scale.intervals,
					toneType: s.settings.toneType,
					tempo: TEMPO,
				},
				correctAnswer: {
					id: scale.id,
					name: scale.name,
					label: scale.label,
				},
				choices: choices.map((c) => ({
					id: c.id,
					name: c.name,
					label: c.label,
				})),
				replays: 0,
				metadata: { scaleIntervals: scale.intervals },
			};
		},

		async playAudio(q: UnifiedQuestion): Promise<PlaybackInfo> {
			const tempo = q.playback.tempo ?? TEMPO;
			await playScale(q.rootNote, q.playback.intervals, q.playback.toneType, tempo);
			const durationMs = q.playback.intervals.length * tempo + 200;
			return {
				durationMs,
				notes: q.playback.intervals.map((s: number) => q.rootNote + s),
			};
		},

		onAnswer(s: UserStateV4, q: UnifiedQuestion, result: QuestionResult) {
			const statsKey = `scale:${q.correctAnswer.id}`;
			if (!s.stats[statsKey]) s.stats[statsKey] = defaultContentStats();
			const st = s.stats[statsKey];
			st.attempts++;
			if (result.correct) {
				st.correct++;
				st.streak++;
			} else {
				st.streak = 0;
			}
			st.lastSeen = Date.now();

			const quality = responseQuality({
				correct: result.correct,
				replays: q.replays,
				responseTimeMs: result.responseTimeMs,
			});
			const sm2 = calculateSm2(st.easeFactor, quality);
			st.easeFactor = sm2.easeFactor;
			st.nextReview = Date.now() + sm2.intervalMs;
		},
	};
}
