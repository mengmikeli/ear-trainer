/**
 * Unified tier-progression logic for v4 schema.
 *
 * Reads from `state.stats` (flat composite-keyed ContentStats) and writes to
 * `state.definitions` (unlock flags). Thresholds match the existing v3 code:
 *
 *   Intervals  2=10/70%  3=30/70%  4=60/70%  5=100/70%
 *   Chords     2=10/70%  3=30/70%  4=60/70%
 *   Scales     2=10/70%  3=30/70%
 *   Modes      all tier-3 scales unlocked + 60 scale attempts at 70%
 */

import type { UserStateV4 } from './schema';
import { INTERVALS } from '$lib/definitions/intervals';
import { CHORDS } from '$lib/definitions/chords';
import { SCALES } from '$lib/definitions/scales';
import { MODES } from '$lib/definitions/modes';
import { getStatsForDef, aggregateStats } from './stats';

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
};

const MODE_THRESHOLD = { questions: 60, accuracy: 0.7 };

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

		// Previous tier must be unlocked
		const prevUnlocked = INTERVALS.filter((i) => i.tier === tier - 1).every(
			(def) => state.definitions.intervals[def.id]?.unlocked,
		);
		if (!prevUnlocked) continue;

		if (totalAttempts >= threshold.questions && overallAccuracy >= threshold.accuracy) {
			for (const def of tierDefs) {
				state.definitions.intervals[def.id].unlocked = true;
			}
		}
	}
}

// ─── Chords ─────────────────────────────────────────────────────────────────

function unlockChordTiers(state: UserStateV4): void {
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

		const prevUnlocked = CHORDS.filter((c) => c.tier === tier - 1).every(
			(def) => state.definitions.chords[def.id]?.unlocked,
		);
		if (!prevUnlocked) continue;

		if (totalAttempts >= threshold.questions && overallAccuracy >= threshold.accuracy) {
			for (const def of tierDefs) {
				state.definitions.chords[def.id].unlocked = true;
			}
		}
	}
}

// ─── Scales ─────────────────────────────────────────────────────────────────

function unlockScaleTiers(state: UserStateV4): void {
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

	for (let tier = 2; tier <= 3; tier++) {
		const threshold = SCALE_THRESHOLDS[tier];
		const tierDefs = SCALES.filter((s) => s.tier === tier);

		if (tierDefs.every((def) => state.definitions.scales[def.id]?.unlocked)) continue;

		const prevUnlocked = SCALES.filter((s) => s.tier === tier - 1).every(
			(def) => state.definitions.scales[def.id]?.unlocked,
		);
		if (!prevUnlocked) continue;

		if (totalAttempts >= threshold.questions && overallAccuracy >= threshold.accuracy) {
			for (const def of tierDefs) {
				state.definitions.scales[def.id].unlocked = true;
			}
		}
	}
}

// ─── Modes ──────────────────────────────────────────────────────────────────

function unlockModes(state: UserStateV4): void {
	// Requires all tier 3 scales to be unlocked
	const allTier3Unlocked = SCALES.filter((s) => s.tier === 3).every(
		(def) => state.definitions.scales[def.id]?.unlocked,
	);
	if (!allTier3Unlocked) return;

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

	if (scaleAttempts >= MODE_THRESHOLD.questions && scaleAccuracy >= MODE_THRESHOLD.accuracy) {
		for (const def of MODES) {
			if (state.definitions.modes[def.id]) {
				state.definitions.modes[def.id].unlocked = true;
			}
		}
	}
}
