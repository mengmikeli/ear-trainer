/**
 * Unified tier-progression logic for v4 schema.
 *
 * Reads from `state.stats` (flat composite-keyed ContentStats) and writes to
 * `state.definitions` (unlock flags). Thresholds:
 *
 *   Intervals  2=10/70%  3=30/70%  4=60/70%  5=100/70%
 *   Chords     2=10/70%  3=30/70%  4=60/70%
 *   Scales     2=10/70%  3=30/70%  4=60/70%
 *   Modes      prerequisite: all scales unlocked + 60 attempts at 70%
 *              then tiers: 2=10/70%  3=30/70%
 */

import type { UserStateV4, ContentKind } from './schema';
import { INTERVALS } from '$lib/definitions/intervals';
import { CHORDS } from '$lib/definitions/chords';
import { SCALES } from '$lib/definitions/scales';
import { MODES } from '$lib/definitions/modes';
import { getStatsForDef, aggregateStats } from './stats';
import { canAccess, getUserTier } from '$lib/features/gate';

// ─── Threshold tables ───────────────────────────────────────────────────────

const INTERVAL_THRESHOLDS: Record<number, { questions: number; accuracy: number }> = {
	2: { questions: 10, accuracy: 0.7 },
	3: { questions: 30, accuracy: 0.7 },
	4: { questions: 60, accuracy: 0.7 },
	5: { questions: 100, accuracy: 0.7 },
};

const CHORD_THRESHOLDS: Record<number, { questions: number; accuracy: number }> = {
	2: { questions: 10, accuracy: 0.7 },
	3: { questions: 30, accuracy: 0.7 },
	4: { questions: 60, accuracy: 0.7 },
};

const SCALE_THRESHOLDS: Record<number, { questions: number; accuracy: number }> = {
	2: { questions: 10, accuracy: 0.7 },
	3: { questions: 30, accuracy: 0.7 },
	4: { questions: 60, accuracy: 0.7 },
};

const MODE_PREREQUISITE = { questions: 60, accuracy: 0.7 };

const MODE_THRESHOLDS: Record<number, { questions: number; accuracy: number }> = {
	2: { questions: 10, accuracy: 0.7 },
	3: { questions: 30, accuracy: 0.7 },
};

// ─── Per-item mastery constants ─────────────────────────────────────────────

export const PER_ITEM_MIN_ATTEMPTS = 5;
export const PER_ITEM_MIN_ACCURACY = 0.7;
export const PER_ITEM_MIN_MASTERED_RATIO = 0.7;

// ─── Per-item mastery types ────────────────────────────────────────────────

export type MasteryStatus = 'mastered' | 'in-progress' | 'untouched';

export interface ItemMasteryInfo {
	id: string;
	attempts: number;
	accuracy: number;
	mastered: boolean;
}

export interface TierMasteryProgress {
	tier: number;
	items: ItemMasteryInfo[];
	totalItems: number;
	masteredCount: number;
	allHaveMinAttempts: boolean;
	isMastered: boolean;
}

export interface NextTierUnlockProgress {
	nextTier: number;
	prerequisiteMastery: TierMasteryProgress;
	threshold: { questions: number; accuracy: number };
	pooledAttempts: number;
	pooledAccuracy: number;
}

// ─── Per-item mastery functions ─────────────────────────────────────────────

/** Get mastery status for a single content item. */
export function getItemMasteryStatus(
	state: UserStateV4,
	kind: ContentKind,
	defId: string,
): MasteryStatus {
	const entries = getStatsForDef(state.stats, kind, defId);
	const agg = aggregateStats(entries);
	if (agg.attempts === 0) return 'untouched';
	if (agg.attempts >= PER_ITEM_MIN_ATTEMPTS && agg.accuracy >= PER_ITEM_MIN_ACCURACY) return 'mastered';
	return 'in-progress';
}

/** Get per-item mastery progress for a specific tier. */
export function getPerItemMasteryProgress(
	state: UserStateV4,
	kind: ContentKind,
	tier: number,
	definitions: { id: string; tier: number }[],
): TierMasteryProgress {
	const tierItems = definitions.filter((d) => d.tier === tier);
	if (tierItems.length === 0) {
		return {
			tier,
			items: [],
			totalItems: 0,
			masteredCount: 0,
			allHaveMinAttempts: true,
			isMastered: true,
		};
	}

	let masteredCount = 0;
	let allHaveMinAttempts = true;
	const items: ItemMasteryInfo[] = [];

	for (const item of tierItems) {
		const entries = getStatsForDef(state.stats, kind, item.id);
		const agg = aggregateStats(entries);

		const hasMin = agg.attempts >= PER_ITEM_MIN_ATTEMPTS;
		if (!hasMin) allHaveMinAttempts = false;

		const mastered = hasMin && agg.accuracy >= PER_ITEM_MIN_ACCURACY;
		if (mastered) masteredCount++;

		items.push({ id: item.id, attempts: agg.attempts, accuracy: agg.accuracy, mastered });
	}

	const isMastered =
		allHaveMinAttempts && masteredCount / tierItems.length >= PER_ITEM_MIN_MASTERED_RATIO;

	return { tier, items, totalItems: tierItems.length, masteredCount, allHaveMinAttempts, isMastered };
}

/** Check if per-item mastery requirements are met for a tier. */
export function checkPerItemMastery(
	state: UserStateV4,
	kind: ContentKind,
	tier: number,
	definitions: { id: string; tier: number }[],
): boolean {
	return getPerItemMasteryProgress(state, kind, tier, definitions).isMastered;
}

/**
 * Get progress toward unlocking the next tier for a content type.
 * Returns null if all tiers are unlocked or next tier is pro-gated.
 */
export function getNextUnlockProgress(
	state: UserStateV4,
	contentType: 'intervals' | 'chords' | 'scales' | 'modes',
): NextTierUnlockProgress | null {
	const config: Record<
		string,
		{
			kind: ContentKind;
			defs: { id: string; tier: number }[];
			thresholds: Record<number, { questions: number; accuracy: number }>;
			defKey: 'intervals' | 'chords' | 'scales' | 'modes';
		}
	> = {
		intervals: {
			kind: 'interval',
			defs: INTERVALS,
			thresholds: INTERVAL_THRESHOLDS,
			defKey: 'intervals',
		},
		chords: {
			kind: 'chord',
			defs: CHORDS,
			thresholds: CHORD_THRESHOLDS,
			defKey: 'chords',
		},
		scales: {
			kind: 'scale',
			defs: SCALES,
			thresholds: SCALE_THRESHOLDS,
			defKey: 'scales',
		},
		modes: { kind: 'mode', defs: MODES, thresholds: MODE_THRESHOLDS, defKey: 'modes' },
	};

	const c = config[contentType];
	if (!c) return null;

	const maxTier = Math.max(...c.defs.map((d) => d.tier));

	// Find the next tier that isn't fully unlocked
	let nextTier: number | null = null;
	for (let t = 2; t <= maxTier; t++) {
		const tierDefs = c.defs.filter((d) => d.tier === t);
		const allUnlocked = tierDefs.every(
			(d) => state.definitions[c.defKey][d.id]?.unlocked,
		);
		if (!allUnlocked) {
			nextTier = t;
			break;
		}
	}

	if (nextTier === null) return null;

	const threshold = c.thresholds[nextTier];
	if (!threshold) return null;

	// Pro gate check — don't show progress if tier is inaccessible
	const userTier = getUserTier(state.settings);
	const devMode = state.settings.devMode ?? false;
	const gateId =
		contentType === 'modes'
			? 'content:modes'
			: `content:${contentType}:tier${nextTier}`;
	if (!canAccess(gateId, userTier, devMode)) return null;

	// Pooled stats across all unlocked items
	let totalAttempts = 0;
	let totalCorrect = 0;
	for (const def of c.defs) {
		if (state.definitions[c.defKey][def.id]?.unlocked) {
			const entries = getStatsForDef(state.stats, c.kind, def.id);
			const agg = aggregateStats(entries);
			totalAttempts += agg.attempts;
			totalCorrect += agg.correct;
		}
	}
	const pooledAccuracy = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;

	// Per-item mastery on the prerequisite tier
	const prereqTier = nextTier - 1;
	const prerequisiteMastery = getPerItemMasteryProgress(state, c.kind, prereqTier, c.defs);

	return {
		nextTier,
		prerequisiteMastery,
		threshold,
		pooledAttempts: totalAttempts,
		pooledAccuracy,
	};
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Check and apply tier unlocks across all content types.
 * Returns a new state object — never mutates the input.
 */
export function checkTierUnlockV4(state: UserStateV4): UserStateV4 {
	const updated: UserStateV4 = JSON.parse(JSON.stringify(state));

	unlockIntervalTiers(updated);
	unlockChordTiers(updated);
	unlockScaleTiers(updated);
	unlockModes(updated);

	return updated;
}

// ─── Intervals ──────────────────────────────────────────────────────────────

function unlockIntervalTiers(state: UserStateV4): void {
	const userTier = getUserTier(state.settings);
	const devMode = state.settings.devMode ?? false;

	// Aggregate attempts/correct across all unlocked intervals
	let totalAttempts = 0;
	let totalCorrect = 0;
	for (const def of INTERVALS) {
		if (state.definitions.intervals[def.id]?.unlocked) {
			const entries = getStatsForDef(state.stats, 'interval', def.id);
			const agg = aggregateStats(entries);
			totalAttempts += agg.attempts;
			totalCorrect += agg.correct;
		}
	}
	const overallAccuracy = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;

	for (let tier = 2; tier <= 4; tier++) {
		const threshold = INTERVAL_THRESHOLDS[tier];
		const tierDefs = INTERVALS.filter((i) => i.tier === tier);

		// Already unlocked → skip
		if (tierDefs.every((def) => state.definitions.intervals[def.id]?.unlocked)) continue;

		// Pro gate check — don't unlock if tier is gated for this user
		if (!canAccess(`content:intervals:tier${tier}`, userTier, devMode)) continue;

		// Previous tier must be unlocked
		const prevUnlocked = INTERVALS.filter((i) => i.tier === tier - 1).every(
			(def) => state.definitions.intervals[def.id]?.unlocked,
		);
		if (!prevUnlocked) continue;

		if (totalAttempts >= threshold.questions && overallAccuracy >= threshold.accuracy) {
			// Per-item mastery on prerequisite tier
			if (checkPerItemMastery(state, 'interval', tier - 1, INTERVALS)) {
				for (const def of tierDefs) {
					state.definitions.intervals[def.id].unlocked = true;
				}
			}
		}
	}
}

// ─── Chords ─────────────────────────────────────────────────────────────────

function unlockChordTiers(state: UserStateV4): void {
	const userTier = getUserTier(state.settings);
	const devMode = state.settings.devMode ?? false;

	let totalAttempts = 0;
	let totalCorrect = 0;
	for (const def of CHORDS) {
		if (state.definitions.chords[def.id]?.unlocked) {
			const entries = getStatsForDef(state.stats, 'chord', def.id);
			const agg = aggregateStats(entries);
			totalAttempts += agg.attempts;
			totalCorrect += agg.correct;
		}
	}
	const overallAccuracy = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;

	for (let tier = 2; tier <= 4; tier++) {
		const threshold = CHORD_THRESHOLDS[tier];
		const tierDefs = CHORDS.filter((c) => c.tier === tier);

		if (tierDefs.every((def) => state.definitions.chords[def.id]?.unlocked)) continue;

		// Pro gate check
		if (!canAccess(`content:chords:tier${tier}`, userTier, devMode)) continue;

		const prevUnlocked = CHORDS.filter((c) => c.tier === tier - 1).every(
			(def) => state.definitions.chords[def.id]?.unlocked,
		);
		if (!prevUnlocked) continue;

		if (totalAttempts >= threshold.questions && overallAccuracy >= threshold.accuracy) {
			// Per-item mastery on prerequisite tier
			if (checkPerItemMastery(state, 'chord', tier - 1, CHORDS)) {
				for (const def of tierDefs) {
					state.definitions.chords[def.id].unlocked = true;
				}
			}
		}
	}
}

// ─── Scales ─────────────────────────────────────────────────────────────────

function unlockScaleTiers(state: UserStateV4): void {
	const userTier = getUserTier(state.settings);
	const devMode = state.settings.devMode ?? false;

	let totalAttempts = 0;
	let totalCorrect = 0;
	for (const def of SCALES) {
		if (state.definitions.scales[def.id]?.unlocked) {
			const entries = getStatsForDef(state.stats, 'scale', def.id);
			const agg = aggregateStats(entries);
			totalAttempts += agg.attempts;
			totalCorrect += agg.correct;
		}
	}
	const overallAccuracy = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;

	for (let tier = 2; tier <= 4; tier++) {
		const threshold = SCALE_THRESHOLDS[tier];
		const tierDefs = SCALES.filter((s) => s.tier === tier);

		if (tierDefs.every((def) => state.definitions.scales[def.id]?.unlocked)) continue;

		// Pro gate check
		if (!canAccess(`content:scales:tier${tier}`, userTier, devMode)) continue;

		const prevUnlocked = SCALES.filter((s) => s.tier === tier - 1).every(
			(def) => state.definitions.scales[def.id]?.unlocked,
		);
		if (!prevUnlocked) continue;

		if (totalAttempts >= threshold.questions && overallAccuracy >= threshold.accuracy) {
			// Per-item mastery on prerequisite tier
			if (checkPerItemMastery(state, 'scale', tier - 1, SCALES)) {
				for (const def of tierDefs) {
					state.definitions.scales[def.id].unlocked = true;
				}
			}
		}
	}
}

// ─── Modes ──────────────────────────────────────────────────────────────────

function unlockModes(state: UserStateV4): void {
	const userTier = getUserTier(state.settings);
	const devMode = state.settings.devMode ?? false;

	// Pro gate check — all modes are gated behind Pro
	if (!canAccess('content:modes', userTier, devMode)) return;

	// Prerequisite: all scales must be unlocked (all tiers)
	const maxScaleTier = Math.max(...SCALES.map((s) => s.tier));
	const allMaxTierUnlocked = SCALES.filter((s) => s.tier === maxScaleTier).every(
		(def) => state.definitions.scales[def.id]?.unlocked,
	);
	if (!allMaxTierUnlocked) return;

	// Aggregate scale stats across all unlocked scales
	let scaleAttempts = 0;
	let scaleCorrect = 0;
	for (const def of SCALES) {
		if (state.definitions.scales[def.id]?.unlocked) {
			const entries = getStatsForDef(state.stats, 'scale', def.id);
			const agg = aggregateStats(entries);
			scaleAttempts += agg.attempts;
			scaleCorrect += agg.correct;
		}
	}
	const scaleAccuracy = scaleAttempts > 0 ? scaleCorrect / scaleAttempts : 0;

	if (scaleAttempts < MODE_PREREQUISITE.questions || scaleAccuracy < MODE_PREREQUISITE.accuracy) {
		return;
	}

	// Per-item mastery on max scale tier before unlocking modes
	if (!checkPerItemMastery(state, 'scale', maxScaleTier, SCALES)) return;

	// Prerequisite met → ensure tier 1 modes are unlocked
	for (const def of MODES.filter((m) => m.tier === 1)) {
		if (state.definitions.modes[def.id]) {
			state.definitions.modes[def.id].unlocked = true;
		}
	}

	// Tiered mode progression (tier 2, 3)
	let modeAttempts = 0;
	let modeCorrect = 0;
	for (const def of MODES) {
		if (state.definitions.modes[def.id]?.unlocked) {
			const entries = getStatsForDef(state.stats, 'mode', def.id);
			const agg = aggregateStats(entries);
			modeAttempts += agg.attempts;
			modeCorrect += agg.correct;
		}
	}
	const modeAccuracy = modeAttempts > 0 ? modeCorrect / modeAttempts : 0;

	for (let tier = 2; tier <= 3; tier++) {
		const threshold = MODE_THRESHOLDS[tier];
		const tierDefs = MODES.filter((m) => m.tier === tier);

		if (tierDefs.every((def) => state.definitions.modes[def.id]?.unlocked)) continue;

		const prevUnlocked = MODES.filter((m) => m.tier === tier - 1).every(
			(def) => state.definitions.modes[def.id]?.unlocked,
		);
		if (!prevUnlocked) continue;

		if (modeAttempts >= threshold.questions && modeAccuracy >= threshold.accuracy) {
			// Per-item mastery on prerequisite tier
			if (checkPerItemMastery(state, 'mode', tier - 1, MODES)) {
				for (const def of tierDefs) {
					if (state.definitions.modes[def.id]) {
						state.definitions.modes[def.id].unlocked = true;
					}
				}
			}
		}
	}
}
