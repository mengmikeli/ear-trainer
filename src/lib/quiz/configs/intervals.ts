/**
 * Interval quiz config factory.
 *
 * Bridges old interval quiz logic to the unified QuizSessionConfig.
 * Question generation reimplemented for v4 state types.
 */

import type { QuizSessionConfig, UnifiedQuestion, QuestionResult, DebriefSection, PlaybackInfo } from '../types';
import type { UserStateV4, ContentStats, PlayMode } from '$lib/state/schema';
import { defaultContentStats } from '$lib/state/schema';
import { getStats, getStatsForDef, aggregateStats } from '$lib/state/stats';
import { playInterval } from '$lib/audio/playback';
import { responseQuality, calculateSm2 } from '$lib/learning/sm2';
import { INTERVALS, type IntervalDef } from '$lib/definitions/intervals';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getEnabledIntervalsV4(state: UserStateV4): IntervalDef[] {
	return INTERVALS.filter((def) => {
		const d = state.definitions.intervals[def.id];
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

function pickIntervalV4(state: UserStateV4): IntervalDef {
	const enabled = getEnabledIntervalsV4(state);
	if (enabled.length === 0) throw new Error('No enabled intervals');

	const now = Date.now();

	const weights = enabled.map((def) => {
		const entries = getStatsForDef(state.stats, 'interval', def.id);
		const agg = aggregateStats(entries);
		const accuracy = agg.attempts > 0 ? agg.correct / agg.attempts : 0.5;
		const weaknessWeight = 1 - accuracy;

		// Find earliest overdue review across modes
		let minNextReview = 0;
		for (const [, s] of entries) {
			if (s.nextReview > 0 && (minNextReview === 0 || s.nextReview < minNextReview)) {
				minNextReview = s.nextReview;
			}
		}
		const overdue = minNextReview > 0 ? Math.max(0, now - minNextReview) : 0;
		const reviewWeight = Math.min(1, overdue / (24 * 60 * 60 * 1000));
		const newBoost = agg.attempts === 0 ? 0.5 : 0;

		return {
			item: def,
			weight: 0.1 + weaknessWeight * 0.5 + reviewWeight * 0.3 + newBoost,
		};
	});

	return weightedPick(weights);
}

function pickModeV4(state: UserStateV4, interval: IntervalDef): PlayMode {
	const enabledModes = state.settings.enabledModes;
	const modes: PlayMode[] = (['ascending', 'descending', 'harmonic'] as PlayMode[]).filter(
		(m) => enabledModes[m],
	);
	if (modes.length === 0) throw new Error('No enabled play modes');
	if (modes.length === 1) return modes[0];

	const weights = modes.map((mode) => {
		const s = getStats(state.stats, `interval:${interval.id}:${mode}`);
		const accuracy = s.attempts > 0 ? s.correct / s.attempts : 0.5;
		const weaknessWeight = 1 - accuracy;
		const newBoost = s.attempts === 0 ? 0.5 : 0;

		return { item: mode, weight: 0.1 + weaknessWeight + newBoost };
	});

	return weightedPick(weights);
}

function generateDistractorsV4(correctId: string, state: UserStateV4): IntervalDef[] {
	const correctDef = INTERVALS.find((i) => i.id === correctId);
	const correctSemitones = correctDef?.semitones ?? 0;

	const enabled = getEnabledIntervalsV4(state).filter((i) => i.id !== correctId);

	// Sort by proximity (closest semitones = most confusable)
	// Add small random factor to avoid deterministic ordering
	const sorted = [...enabled].sort((a, b) => {
		const distA = Math.abs(a.semitones - correctSemitones);
		const distB = Math.abs(b.semitones - correctSemitones);
		return (distA - distB) + (Math.random() - 0.5) * 2;
	});

	if (sorted.length >= 3) return sorted.slice(0, 3);

	// Fill from all intervals if not enough enabled
	const usedIds = new Set([correctId, ...sorted.map((i) => i.id)]);
	const fill = INTERVALS.filter((i) => !usedIds.has(i.id)).sort(
		(a, b) => Math.abs(a.semitones - correctSemitones) - Math.abs(b.semitones - correctSemitones),
	);

	const result = [...sorted];
	for (const def of fill) {
		if (result.length >= 3) break;
		result.push(def);
	}
	return result;
}

// ─── Config factory ─────────────────────────────────────────────────────────

const modeGlyph: Record<string, string> = {
	ascending: '\uE007',
	descending: '\uE008',
	harmonic: '\uE000',
};

export function createIntervalConfig(state: UserStateV4): QuizSessionConfig {
	return {
		heading: 'INTERVALS',
		contentKinds: ['interval'],
		sessionLength: state.settings.sessionLength,

		generateQuestion(s: UserStateV4): UnifiedQuestion {
			const interval = pickIntervalV4(s);
			const playMode = pickModeV4(s, interval);
			const direction = playMode as 'ascending' | 'descending';

			const maxRoot =
				direction === 'ascending' || playMode === 'harmonic'
					? 84 - interval.semitones
					: 84;
			const minRoot = direction === 'descending' ? 48 + interval.semitones : 48;
			const rootNote = minRoot + Math.floor(Math.random() * (maxRoot - minRoot + 1));

			const distractors = generateDistractorsV4(interval.id, s);
			const seen = new Set<string>();
			const raw = [interval, ...distractors].filter((c) => {
				if (seen.has(c.id)) return false;
				seen.add(c.id);
				return true;
			});
			const choices = raw.sort(() => Math.random() - 0.5);

			return {
				id: `interval:${interval.id}:${playMode}`,
				kind: 'interval',
				rootNote,
				playback: {
					type: 'interval',
					rootNote,
					intervals: [interval.semitones],
					toneType: s.settings.toneType,
					direction: playMode,
				},
				correctAnswer: { id: interval.id, name: interval.name, label: interval.id },
				choices: choices.map((c) => ({ id: c.id, name: c.name, label: c.id })),
				replays: 0,
				metadata: { playMode, semitones: interval.semitones },
			};
		},

		async playAudio(q: UnifiedQuestion): Promise<PlaybackInfo> {
			const semitones = q.playback.intervals[0];
			await playInterval(
				q.rootNote,
				semitones,
				q.playback.direction! as 'ascending' | 'descending' | 'harmonic',
				q.playback.toneType,
			);
			const secondMidi =
				q.playback.direction === 'descending'
					? q.rootNote - semitones
					: q.rootNote + semitones;
			const isHarmonic = q.playback.direction === 'harmonic';
			const noteDur = 0.6;
			const gap = q.playback.toneType === 'piano' ? 0.3 : 0.15;
			return {
				durationMs: isHarmonic ? 1200 : (noteDur * 2 + gap) * 1000 + 200,
				notes: isHarmonic ? [q.rootNote, secondMidi] : [q.rootNote],
			};
		},

		onAnswer(s: UserStateV4, q: UnifiedQuestion, result: QuestionResult) {
			const playMode = q.metadata?.playMode as PlayMode;
			const statsKey = `interval:${q.correctAnswer.id}:${playMode}`;

			if (!s.stats[statsKey]) {
				s.stats[statsKey] = defaultContentStats();
			}
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

		formatDebrief(results: QuestionResult[]): DebriefSection[] {
			const modes: Record<string, { total: number; correct: number }> = {};
			for (const r of results) {
				const mode = (r.question.metadata?.playMode as string) ?? 'ascending';
				if (!modes[mode]) modes[mode] = { total: 0, correct: 0 };
				modes[mode].total++;
				if (r.correct) modes[mode].correct++;
			}

			if (Object.keys(modes).length <= 1) return [];

			return [
				{
					label: 'PER MODE',
					items: Object.entries(modes).map(([mode, stats]) => ({
						label: modeGlyph[mode] ?? mode,
						value: `${stats.correct}/${stats.total}  ${Math.round((stats.correct / stats.total) * 100)}%`,
					})),
				},
			];
		},
	};
}
