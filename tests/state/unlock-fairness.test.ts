/**
 * Tests for per-item unlock fairness (Task 3.1).
 *
 * Validates that tier progression requires per-item mastery on the prerequisite
 * tier alongside the existing pooled accuracy/attempt thresholds.
 */
import { describe, it, expect } from 'vitest';
import { INTERVALS } from '$lib/definitions/intervals';
import { CHORDS } from '$lib/definitions/chords';
import { SCALES } from '$lib/definitions/scales';
import { MODES } from '$lib/definitions/modes';
import type { UserStateV4 } from '$lib/state/schema';
import { defaultContentStats } from '$lib/state/schema';
import { createDefaultStateV4 } from '$lib/state/defaults';
import {
	checkTierUnlockV4,
	checkPerItemMastery,
	getPerItemMasteryProgress,
	getItemMasteryStatus,
	PER_ITEM_MIN_ATTEMPTS,
	PER_ITEM_MIN_ACCURACY,
	PER_ITEM_MIN_MASTERED_RATIO,
} from '$lib/state/progression';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Set stats for a single composite key. */
function setStats(state: UserStateV4, key: string, attempts: number, correct: number): void {
	state.stats[key] = { ...defaultContentStats(), attempts, correct };
}

/** Set stats for an interval across a play mode (default ascending). */
function setIntervalStats(
	state: UserStateV4,
	id: string,
	attempts: number,
	correct: number,
	mode: 'ascending' | 'descending' | 'harmonic' = 'ascending',
): void {
	setStats(state, `interval:${id}:${mode}`, attempts, correct);
}

/** Set stats for a chord with a voicing (default root). */
function setChordStats(
	state: UserStateV4,
	id: string,
	attempts: number,
	correct: number,
	voicing: 'root' | 'first' | 'second' = 'root',
): void {
	setStats(state, `chord:${id}:${voicing}`, attempts, correct);
}

/** Set stats for a scale. */
function setScaleStats(
	state: UserStateV4,
	id: string,
	attempts: number,
	correct: number,
): void {
	setStats(state, `scale:${id}`, attempts, correct);
}

/** Set stats for a mode. */
function setModeStats(
	state: UserStateV4,
	id: string,
	attempts: number,
	correct: number,
): void {
	setStats(state, `mode:${id}`, attempts, correct);
}

/** Create a pro-enabled state (unlocks all pro gates). */
function proState(): UserStateV4 {
	const s = createDefaultStateV4();
	s.settings.proUnlocked = true;
	return s;
}

/** Unlock all items in a tier for a content type. */
function unlockTier(
	state: UserStateV4,
	contentType: 'intervals' | 'chords' | 'scales' | 'modes',
	tier: number,
): void {
	const defs: Record<string, { id: string; tier: number }[]> = {
		intervals: INTERVALS,
		chords: CHORDS,
		scales: SCALES,
		modes: MODES,
	};
	for (const def of defs[contentType].filter((d) => d.tier === tier)) {
		state.definitions[contentType][def.id].unlocked = true;
	}
}

// Tier 1 interval IDs: P1, P5, P8
const T1_INTERVALS = INTERVALS.filter((i) => i.tier === 1);
// Tier 2 interval IDs: M3, m3, P4
const T2_INTERVALS = INTERVALS.filter((i) => i.tier === 2);
// Tier 1 chord IDs: maj, min
const T1_CHORDS = CHORDS.filter((c) => c.tier === 1);

// ===========================================================================
// checkPerItemMastery — unit tests
// ===========================================================================

describe('checkPerItemMastery', () => {
	it('returns true for empty tier (no items)', () => {
		const state = proState();
		// Tier 99 doesn't exist → vacuously true
		expect(checkPerItemMastery(state, 'interval', 99, INTERVALS)).toBe(true);
	});

	it('returns false when no stats exist for tier items', () => {
		const state = proState();
		expect(checkPerItemMastery(state, 'interval', 1, INTERVALS)).toBe(false);
	});

	it('returns true when all tier items are mastered', () => {
		const state = proState();
		for (const def of T1_INTERVALS) {
			setIntervalStats(state, def.id, 10, 8); // 80% accuracy, ≥5 attempts
		}
		expect(checkPerItemMastery(state, 'interval', 1, INTERVALS)).toBe(true);
	});

	it('blocks when an item has < 5 attempts even with 100% accuracy', () => {
		const state = proState();
		for (const def of T1_INTERVALS) {
			setIntervalStats(state, def.id, 10, 8);
		}
		// Reduce one item to 4 attempts at 100%
		setIntervalStats(state, T1_INTERVALS[0].id, 4, 4);
		expect(checkPerItemMastery(state, 'interval', 1, INTERVALS)).toBe(false);
	});

	it('blocks when mastered ratio is below 70%', () => {
		const state = proState();
		// Tier 3 intervals have 4 items: M2, M6, m7, M7
		const t3 = INTERVALS.filter((i) => i.tier === 3);
		expect(t3.length).toBe(4);

		// Master 2 of 4 (50%) — below 70% threshold
		setIntervalStats(state, t3[0].id, 10, 8); // mastered
		setIntervalStats(state, t3[1].id, 10, 8); // mastered
		setIntervalStats(state, t3[2].id, 10, 3); // 30% — not mastered
		setIntervalStats(state, t3[3].id, 10, 3); // 30% — not mastered

		expect(checkPerItemMastery(state, 'interval', 3, INTERVALS)).toBe(false);
	});

	it('passes when 70% mastery ratio is met (3 of 4 = 75%)', () => {
		const state = proState();
		const t3 = INTERVALS.filter((i) => i.tier === 3);

		// Master 3 of 4 (75%) — above 70% threshold
		setIntervalStats(state, t3[0].id, 10, 8);
		setIntervalStats(state, t3[1].id, 10, 8);
		setIntervalStats(state, t3[2].id, 10, 8);
		setIntervalStats(state, t3[3].id, 10, 3); // not mastered but has min attempts

		expect(checkPerItemMastery(state, 'interval', 3, INTERVALS)).toBe(true);
	});

	it('aggregates stats across sub-keys (modes/voicings)', () => {
		const state = proState();
		// P1 has stats across ascending + descending: 3+3=6 attempts, 2+2=4 correct (67%)
		setIntervalStats(state, 'P1', 3, 2, 'ascending');
		setIntervalStats(state, 'P1', 3, 2, 'descending');
		// P5 and P8 fully mastered
		setIntervalStats(state, 'P5', 10, 8, 'ascending');
		setIntervalStats(state, 'P8', 10, 8, 'ascending');

		// P1: 6 attempts, 67% accuracy — NOT mastered (< 70%)
		// But all have ≥5 attempts and 2/3 mastered = 67% < 70%
		expect(checkPerItemMastery(state, 'interval', 1, INTERVALS)).toBe(false);
	});
});

// ===========================================================================
// getPerItemMasteryProgress — unit tests
// ===========================================================================

describe('getPerItemMasteryProgress', () => {
	it('returns correct mastery counts', () => {
		const state = proState();
		setIntervalStats(state, 'P1', 10, 8); // mastered
		setIntervalStats(state, 'P5', 10, 5); // 50% — not mastered
		setIntervalStats(state, 'P8', 3, 3); // < 5 attempts — not mastered

		const progress = getPerItemMasteryProgress(state, 'interval', 1, INTERVALS);
		expect(progress.totalItems).toBe(3);
		expect(progress.masteredCount).toBe(1);
		expect(progress.allHaveMinAttempts).toBe(false);
		expect(progress.isMastered).toBe(false);
	});

	it('marks isMastered true when all conditions are met', () => {
		const state = proState();
		for (const def of T1_INTERVALS) {
			setIntervalStats(state, def.id, 10, 9);
		}
		const progress = getPerItemMasteryProgress(state, 'interval', 1, INTERVALS);
		expect(progress.isMastered).toBe(true);
		expect(progress.masteredCount).toBe(3);
		expect(progress.allHaveMinAttempts).toBe(true);
	});
});

// ===========================================================================
// getItemMasteryStatus — unit tests
// ===========================================================================

describe('getItemMasteryStatus', () => {
	it('returns untouched for 0 attempts', () => {
		const state = proState();
		expect(getItemMasteryStatus(state, 'interval', 'P1')).toBe('untouched');
	});

	it('returns in-progress when attempts < min', () => {
		const state = proState();
		setIntervalStats(state, 'P1', 3, 3);
		expect(getItemMasteryStatus(state, 'interval', 'P1')).toBe('in-progress');
	});

	it('returns in-progress when accuracy < min despite attempts', () => {
		const state = proState();
		setIntervalStats(state, 'P1', 10, 5); // 50%
		expect(getItemMasteryStatus(state, 'interval', 'P1')).toBe('in-progress');
	});

	it('returns mastered when both thresholds met', () => {
		const state = proState();
		setIntervalStats(state, 'P1', 10, 8); // 80%
		expect(getItemMasteryStatus(state, 'interval', 'P1')).toBe('mastered');
	});
});

// ===========================================================================
// checkTierUnlockV4 — integration with per-item mastery
// ===========================================================================

describe('checkTierUnlockV4 with per-item mastery', () => {
	it('pooled threshold met but per-item NOT met → does NOT unlock intervals tier 2', () => {
		const state = proState();
		// Give enough pooled stats: 15 attempts, 80% accuracy across tier 1
		// But concentrate all stats on P1, leaving P5 and P8 untouched
		setIntervalStats(state, 'P1', 15, 12); // P1: 15 attempts, 80%
		// P5: 0 attempts — per-item check fails (not all have ≥5 attempts)
		// P8: 0 attempts

		const updated = checkTierUnlockV4(state);
		const t2Unlocked = T2_INTERVALS.every(
			(d) => updated.definitions.intervals[d.id]?.unlocked,
		);
		expect(t2Unlocked).toBe(false);
	});

	it('both pooled and per-item met → unlocks intervals tier 2', () => {
		const state = proState();
		// Distribute stats evenly across tier 1 items (≥5 each, ≥70% each)
		for (const def of T1_INTERVALS) {
			setIntervalStats(state, def.id, 5, 4); // 80%, 5 attempts
		}
		// Total: 15 attempts, 80% — meets tier 2 threshold (10 questions, 70%)
		const updated = checkTierUnlockV4(state);
		const t2Unlocked = T2_INTERVALS.every(
			(d) => updated.definitions.intervals[d.id]?.unlocked,
		);
		expect(t2Unlocked).toBe(true);
	});

	it('3 of 4 tier-3 items mastered (75%) → unlocks tier 4', () => {
		const state = proState();
		// Unlock tiers 1-3
		unlockTier(state, 'intervals', 2);
		unlockTier(state, 'intervals', 3);

		// Enough pooled stats for tier 4 threshold (60 questions, 70%)
		// Add stats to tier 1 items to boost pooled count
		for (const def of T1_INTERVALS) {
			setIntervalStats(state, def.id, 10, 8);
		}
		for (const def of T2_INTERVALS) {
			setIntervalStats(state, def.id, 10, 8);
		}

		const t3 = INTERVALS.filter((i) => i.tier === 3); // 4 items
		// Master 3 of 4 (75% ≥ 70%)
		setIntervalStats(state, t3[0].id, 10, 8);
		setIntervalStats(state, t3[1].id, 10, 8);
		setIntervalStats(state, t3[2].id, 10, 8);
		setIntervalStats(state, t3[3].id, 10, 3); // not mastered but has attempts
		// Total: 30 + 30 + 40 = 100 attempts, well above 60

		const updated = checkTierUnlockV4(state);
		const t4 = INTERVALS.filter((i) => i.tier === 4);
		const t4Unlocked = t4.every((d) => updated.definitions.intervals[d.id]?.unlocked);
		expect(t4Unlocked).toBe(true);
	});

	it('2 of 4 tier-3 items mastered (50%) → does NOT unlock tier 4', () => {
		const state = proState();
		unlockTier(state, 'intervals', 2);
		unlockTier(state, 'intervals', 3);

		// Enough pooled stats
		for (const def of T1_INTERVALS) {
			setIntervalStats(state, def.id, 10, 8);
		}
		for (const def of T2_INTERVALS) {
			setIntervalStats(state, def.id, 10, 8);
		}

		const t3 = INTERVALS.filter((i) => i.tier === 3);
		// Master only 2 of 4 (50% < 70%)
		setIntervalStats(state, t3[0].id, 10, 8);
		setIntervalStats(state, t3[1].id, 10, 8);
		setIntervalStats(state, t3[2].id, 10, 3);
		setIntervalStats(state, t3[3].id, 10, 3);

		const updated = checkTierUnlockV4(state);
		const t4 = INTERVALS.filter((i) => i.tier === 4);
		const t4Unlocked = t4.every((d) => updated.definitions.intervals[d.id]?.unlocked);
		expect(t4Unlocked).toBe(false);
	});

	it('items with 4 attempts (below min 5) → blocks even with 100% accuracy', () => {
		const state = proState();
		// Set 4 attempts at 100% for each tier 1 item
		for (const def of T1_INTERVALS) {
			setIntervalStats(state, def.id, 4, 4);
		}
		// Total: 12 attempts, 100% — pooled threshold met (10 questions, 70%)

		const updated = checkTierUnlockV4(state);
		const t2Unlocked = T2_INTERVALS.every(
			(d) => updated.definitions.intervals[d.id]?.unlocked,
		);
		expect(t2Unlocked).toBe(false);
	});

	it('backward compat: already-unlocked tiers stay unlocked', () => {
		const state = proState();
		// Manually unlock tier 2 intervals (simulating existing user)
		unlockTier(state, 'intervals', 2);

		// No stats at all — per-item mastery would fail for new unlock,
		// but existing unlocks should persist
		const updated = checkTierUnlockV4(state);
		const t2Unlocked = T2_INTERVALS.every(
			(d) => updated.definitions.intervals[d.id]?.unlocked,
		);
		expect(t2Unlocked).toBe(true);
	});

	it('chords use chord-specific per-item mastery (not interval stats)', () => {
		const state = proState();
		// Give lots of interval stats — shouldn't help chord unlock
		for (const def of T1_INTERVALS) {
			setIntervalStats(state, def.id, 20, 18);
		}

		// Chord tier 1 has only 2 items: maj, min
		// Give enough pooled chord stats but only on one item
		setChordStats(state, 'maj', 15, 12); // mastered
		// 'min' has 0 attempts — per-item fails

		const updated = checkTierUnlockV4(state);
		const t2Chords = CHORDS.filter((c) => c.tier === 2);
		const t2Unlocked = t2Chords.every(
			(d) => updated.definitions.chords[d.id]?.unlocked,
		);
		expect(t2Unlocked).toBe(false);
	});

	it('chords unlock when both pooled and per-item met for chord items', () => {
		const state = proState();
		// Cross-content prerequisite: interval tier 2 must be unlocked for chord progression
		unlockTier(state, 'intervals', 2);
		// Master both tier 1 chord items
		for (const def of T1_CHORDS) {
			setChordStats(state, def.id, 6, 5); // 83%, ≥5 attempts
		}
		// Total: 12 attempts, 83% — meets tier 2 threshold (10 questions, 70%)

		const updated = checkTierUnlockV4(state);
		const t2Chords = CHORDS.filter((c) => c.tier === 2);
		const t2Unlocked = t2Chords.every(
			(d) => updated.definitions.chords[d.id]?.unlocked,
		);
		expect(t2Unlocked).toBe(true);
	});

	it('scales require per-item mastery on prerequisite tier', () => {
		const state = proState();
		const t1Scales = SCALES.filter((s) => s.tier === 1); // major, nat_min

		// Pooled threshold met but only one item practiced
		setScaleStats(state, t1Scales[0].id, 15, 12); // mastered
		// t1Scales[1] has 0 attempts

		const updated = checkTierUnlockV4(state);
		const t2Scales = SCALES.filter((s) => s.tier === 2);
		const t2Unlocked = t2Scales.every(
			(d) => updated.definitions.scales[d.id]?.unlocked,
		);
		expect(t2Unlocked).toBe(false);
	});

	it('modes require per-item mastery on max scale tier for prerequisite', () => {
		const state = proState();
		// Lock tier 1 modes (they're unlocked by default in createDefaultStateV4)
		for (const def of MODES.filter((m) => m.tier === 1)) {
			state.definitions.modes[def.id].unlocked = false;
		}

		// Unlock all scale tiers
		for (let t = 1; t <= 3; t++) {
			unlockTier(state, 'scales', t);
		}

		// Add enough scale stats for mode prerequisite (60 attempts, 70%)
		// But DON'T master tier 3 scale items per-item
		const maxTierScales = SCALES.filter((s) => s.tier === 3); // 5 items
		const otherScales = SCALES.filter((s) => s.tier < 3);
		for (const def of otherScales) {
			setScaleStats(state, def.id, 8, 6); // spread attempts
		}
		// For max tier, put all attempts on first item only
		setScaleStats(state, maxTierScales[0].id, 10, 8);
		// remaining maxTierScales items have 0 attempts — per-item fails

		const updated = checkTierUnlockV4(state);
		const t1Modes = MODES.filter((m) => m.tier === 1);
		const modesUnlocked = t1Modes.some(
			(d) => updated.definitions.modes[d.id]?.unlocked,
		);
		// Tier 1 modes should NOT be unlocked since max scale tier per-item fails
		expect(modesUnlocked).toBe(false);
	});
});
