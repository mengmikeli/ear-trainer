/**
 * MASTERY SYSTEMS — Display mastery now aligned with progression mastery:
 *
 * 1. DISPLAY MASTERY (this file): 10 attempts, 70% accuracy
 *    Used for: bronze/silver/gold badges, content-type unlock gating
 *    (isModeMastered, getMasteryLevel)
 *
 * 2. PROGRESSION MASTERY (progression.ts): 5 attempts, 70% accuracy
 *    Used for: tier unlock within a content type
 *    (checkPerItemMastery, PER_ITEM_MIN_ATTEMPTS, PER_ITEM_MIN_ACCURACY)
 *
 * Display mastery is a slightly higher bar (more attempts) but uses the
 * same 70% accuracy threshold as progression. This reduces the grind gap
 * for content-type unlock (e.g., intervals → chords) from ~150 questions
 * to ~50-60 questions while still requiring meaningful practice.
 */

/**
 * v4 → legacy state compat layer.
 *
 * Constructs old-format state objects (IntervalState, ChordState, ScaleState,
 * ModeState) from UserStateV4 data, so existing card components can receive
 * props in the shape they expect.
 */

import type { UserStateV4, ContentStats } from './schema';
import { defaultContentStats } from './schema';
import { getStats, getStatsForDef, aggregateStats } from './stats';

// ─── Old-format interfaces (subset needed by card components) ───────────────

export interface LegacyModeStats {
	attempts: number;
	correct: number;
	streak: number;
	lastSeen: number;
	easeFactor: number;
	nextReview: number;
}

export interface LegacyIntervalState {
	interval: string;
	mode: 'choice';
	unlocked: boolean;
	enabled: boolean;
	attempts: number;
	correct: number;
	easeFactor: number;
	nextReview: number;
	streak: number;
	lastSeen: number;
	modes: {
		ascending: LegacyModeStats;
		descending: LegacyModeStats;
		harmonic: LegacyModeStats;
	};
}

export interface LegacyChordState {
	chord: string;
	unlocked: boolean;
	enabled: boolean;
	attempts: number;
	correct: number;
	easeFactor: number;
	nextReview: number;
	streak: number;
	lastSeen: number;
	voicings: {
		root: LegacyModeStats;
		first: LegacyModeStats;
		second: LegacyModeStats;
	};
}

export interface LegacyScaleState {
	scale: string;
	unlocked: boolean;
	enabled: boolean;
	attempts: number;
	correct: number;
	easeFactor: number;
	nextReview: number;
	streak: number;
	lastSeen: number;
}

export interface LegacyModeState {
	mode: string;
	unlocked: boolean;
	enabled: boolean;
	attempts: number;
	correct: number;
	easeFactor: number;
	nextReview: number;
	streak: number;
	lastSeen: number;
}

// ─── Converters ─────────────────────────────────────────────────────────────

function toModeStats(cs: ContentStats): LegacyModeStats {
	return {
		attempts: cs.attempts,
		correct: cs.correct,
		streak: cs.streak,
		lastSeen: cs.lastSeen,
		easeFactor: cs.easeFactor,
		nextReview: cs.nextReview,
	};
}

export function buildIntervalState(state: UserStateV4, id: string): LegacyIntervalState {
	const def = state.definitions.intervals[id];
	const asc = getStats(state.stats, `interval:${id}:ascending`);
	const desc = getStats(state.stats, `interval:${id}:descending`);
	const harm = getStats(state.stats, `interval:${id}:harmonic`);
	const entries = getStatsForDef(state.stats, 'interval', id);
	const agg = aggregateStats(entries);

	return {
		interval: id,
		mode: 'choice',
		unlocked: def?.unlocked ?? false,
		enabled: def?.enabled ?? true,
		attempts: agg.attempts,
		correct: agg.correct,
		easeFactor: asc.easeFactor,
		nextReview: Math.min(asc.nextReview || Infinity, desc.nextReview || Infinity, harm.nextReview || Infinity) || 0,
		streak: asc.streak + desc.streak + harm.streak,
		lastSeen: Math.max(asc.lastSeen, desc.lastSeen, harm.lastSeen),
		modes: {
			ascending: toModeStats(asc),
			descending: toModeStats(desc),
			harmonic: toModeStats(harm),
		},
	};
}

export function buildChordState(state: UserStateV4, id: string): LegacyChordState {
	const def = state.definitions.chords[id];
	const root = getStats(state.stats, `chord:${id}:root`);
	const first = getStats(state.stats, `chord:${id}:first`);
	const second = getStats(state.stats, `chord:${id}:second`);
	const entries = getStatsForDef(state.stats, 'chord', id);
	const agg = aggregateStats(entries);

	return {
		chord: id,
		unlocked: def?.unlocked ?? false,
		enabled: def?.enabled ?? true,
		attempts: agg.attempts,
		correct: agg.correct,
		easeFactor: root.easeFactor,
		nextReview: Math.min(root.nextReview || Infinity, first.nextReview || Infinity, second.nextReview || Infinity) || 0,
		streak: root.streak + first.streak + second.streak,
		lastSeen: Math.max(root.lastSeen, first.lastSeen, second.lastSeen),
		voicings: {
			root: toModeStats(root),
			first: toModeStats(first),
			second: toModeStats(second),
		},
	};
}

export function buildScaleState(state: UserStateV4, id: string): LegacyScaleState {
	const def = state.definitions.scales[id];
	const cs = getStats(state.stats, `scale:${id}`);

	return {
		scale: id,
		unlocked: def?.unlocked ?? false,
		enabled: def?.enabled ?? true,
		attempts: cs.attempts,
		correct: cs.correct,
		easeFactor: cs.easeFactor,
		nextReview: cs.nextReview,
		streak: cs.streak,
		lastSeen: cs.lastSeen,
	};
}

export function buildModeState(state: UserStateV4, id: string): LegacyModeState {
	const def = state.definitions.modes[id];
	const cs = getStats(state.stats, `mode:${id}`);

	return {
		mode: id,
		unlocked: def?.unlocked ?? false,
		enabled: def?.enabled ?? true,
		attempts: cs.attempts,
		correct: cs.correct,
		easeFactor: cs.easeFactor,
		nextReview: cs.nextReview,
		streak: cs.streak,
		lastSeen: cs.lastSeen,
	};
}

// ─── Mastery (moved from $lib/mastery.ts) ───────────────────────────────────

const MASTERY_MIN_ATTEMPTS = 10;
const MASTERY_MIN_ACCURACY = 0.70;

export type MasteryLevel = 'none' | 'bronze' | 'silver' | 'gold';

/** Check if stats meet mastery threshold (works with both ModeStats and ContentStats). */
export function isModeMastered(stats: { attempts: number; correct: number }): boolean {
	return stats.attempts >= MASTERY_MIN_ATTEMPTS && stats.correct / stats.attempts >= MASTERY_MIN_ACCURACY;
}

/** Get mastery level for an interval (across all modes). */
export function getMasteryLevel(interval: LegacyIntervalState): MasteryLevel {
	const modes = interval.modes;
	let mastered = 0;
	if (isModeMastered(modes.ascending)) mastered++;
	if (isModeMastered(modes.descending)) mastered++;
	if (isModeMastered(modes.harmonic)) mastered++;

	if (mastered === 0) return 'none';
	if (mastered === 1) return 'bronze';
	if (mastered === 2) return 'silver';
	return 'gold';
}
