/**
 * Phase 0 — Snapshot tests for checkTierUnlock behavior across all content types.
 * Captures existing behavior BEFORE any refactor.
 */
import { describe, it, expect } from 'vitest';
import { createDefaultState, checkTierUnlock } from '$lib/state';
import type { UserState } from '$lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Distribute attempts/correct evenly across ascending mode of the given tier-1 intervals */
function addIntervalStats(
	state: UserState,
	intervals: string[],
	totalAttempts: number,
	totalCorrect: number,
	mode: 'ascending' | 'descending' | 'harmonic' = 'ascending',
): void {
	const perInterval = Math.floor(totalAttempts / intervals.length);
	const perCorrect = Math.floor(totalCorrect / intervals.length);
	for (const id of intervals) {
		state.intervals[id].modes[mode].attempts = perInterval;
		state.intervals[id].modes[mode].correct = perCorrect;
	}
	// Distribute remainder to first interval
	const remainAttempts = totalAttempts - perInterval * intervals.length;
	const remainCorrect = totalCorrect - perCorrect * intervals.length;
	if (remainAttempts > 0) {
		state.intervals[intervals[0]].modes[mode].attempts += remainAttempts;
	}
	if (remainCorrect > 0) {
		state.intervals[intervals[0]].modes[mode].correct += remainCorrect;
	}
}

/** Add chord stats distributed across root voicing */
function addChordStats(
	state: UserState,
	chords: string[],
	totalAttempts: number,
	totalCorrect: number,
	voicing: 'root' | 'first' | 'second' = 'root',
): void {
	const perChord = Math.floor(totalAttempts / chords.length);
	const perCorrect = Math.floor(totalCorrect / chords.length);
	for (const id of chords) {
		state.chords[id].voicings[voicing].attempts = perChord;
		state.chords[id].voicings[voicing].correct = perCorrect;
	}
	const remainAttempts = totalAttempts - perChord * chords.length;
	const remainCorrect = totalCorrect - perCorrect * chords.length;
	if (remainAttempts > 0) {
		state.chords[chords[0]].voicings[voicing].attempts += remainAttempts;
	}
	if (remainCorrect > 0) {
		state.chords[chords[0]].voicings[voicing].correct += remainCorrect;
	}
}

/** Add scale stats (flat, no modes/voicings) */
function addScaleStats(
	state: UserState,
	scales: string[],
	totalAttempts: number,
	totalCorrect: number,
): void {
	const perScale = Math.floor(totalAttempts / scales.length);
	const perCorrect = Math.floor(totalCorrect / scales.length);
	for (const id of scales) {
		state.scales[id].attempts = perScale;
		state.scales[id].correct = perCorrect;
	}
	const remainAttempts = totalAttempts - perScale * scales.length;
	const remainCorrect = totalCorrect - perCorrect * scales.length;
	if (remainAttempts > 0) {
		state.scales[scales[0]].attempts += remainAttempts;
	}
	if (remainCorrect > 0) {
		state.scales[scales[0]].correct += remainCorrect;
	}
}

const TIER1_INTERVALS = ['P1', 'P5', 'P8'];
const TIER2_INTERVALS = ['M3', 'P4'];
const TIER3_INTERVALS = ['m3', 'M6'];
const TIER4_INTERVALS = ['m7', 'M2'];
const TIER5_INTERVALS = ['m6', 'M7', 'm2', 'TT'];

const TIER1_CHORDS = ['maj', 'min'];
const TIER2_CHORDS = ['dim', 'aug'];
const TIER3_CHORDS = ['dom7', 'maj7', 'min7'];

const TIER1_SCALES = ['major', 'nat_min', 'maj_pent'];
const TIER2_SCALES = ['harm_min', 'min_pent'];
const TIER3_SCALES = ['blues', 'whole', 'mel_min', 'chromatic'];

const ALL_MODES = ['ionian', 'aeolian', 'dorian', 'mixolydian', 'lydian', 'phrygian', 'locrian'];
const TIER1_MODES = ['ionian', 'aeolian'];

// ---------------------------------------------------------------------------
// Interval unlock tests
// ---------------------------------------------------------------------------

describe('checkTierUnlock — Intervals', () => {
	it('does not unlock tier 2 with insufficient attempts (<10)', () => {
		const state = createDefaultState();
		// 9 attempts, 100% accuracy — below threshold
		addIntervalStats(state, TIER1_INTERVALS, 9, 9);

		const result = checkTierUnlock(state);

		for (const id of TIER2_INTERVALS) {
			expect(result.intervals[id].unlocked).toBe(false);
		}
	});

	it('does not unlock tier 2 with sufficient attempts but low accuracy (<70%)', () => {
		const state = createDefaultState();
		// 10 attempts, 60% accuracy (6/10) — below 70%
		addIntervalStats(state, TIER1_INTERVALS, 10, 6);

		const result = checkTierUnlock(state);

		for (const id of TIER2_INTERVALS) {
			expect(result.intervals[id].unlocked).toBe(false);
		}
	});

	it('unlocks tier 2 at exactly 10 attempts with ≥70% accuracy', () => {
		const state = createDefaultState();
		// 10 attempts, 70% accuracy (7/10) — exactly at threshold
		addIntervalStats(state, TIER1_INTERVALS, 10, 7);

		const result = checkTierUnlock(state);

		for (const id of TIER2_INTERVALS) {
			expect(result.intervals[id].unlocked).toBe(true);
		}
		// Tier 1 still unlocked
		for (const id of TIER1_INTERVALS) {
			expect(result.intervals[id].unlocked).toBe(true);
		}
	});

	it('does not unlock tier 3 without tier 2 being unlocked first', () => {
		const state = createDefaultState();
		// Manually lock tier 2 intervals (they start locked, so this is already default)
		// Give 30 attempts with 70% accuracy — enough for tier 3 threshold
		// But tier 2 is not unlocked, so tier 3 should not unlock
		// NOTE: with 30 attempts at 70%, tier 2 would also unlock (10 threshold),
		// which then allows tier 3. To test this properly, we need tier 2 intervals
		// locked AND prevent tier 2 from unlocking.
		// Actually, with the current code, 30 attempts would first unlock tier 2
		// (since 30 >= 10), and THEN tier 3 (since prev tier is now unlocked).
		// To truly test "tier 3 without tier 2", we'd need a scenario where
		// tier 2 can't unlock. The code iterates tiers sequentially, checking
		// prevTierUnlocked from updated state. Since tier 2 unlocks first,
		// tier 3 can chain-unlock.
		//
		// Let's test a different angle: give 30 attempts but only 65% accuracy.
		// This prevents tier 2 from unlocking, which blocks tier 3.
		addIntervalStats(state, TIER1_INTERVALS, 30, 19); // 63.3% < 70%

		const result = checkTierUnlock(state);

		// Neither tier 2 nor tier 3 should unlock
		for (const id of TIER2_INTERVALS) {
			expect(result.intervals[id].unlocked).toBe(false);
		}
		for (const id of TIER3_INTERVALS) {
			expect(result.intervals[id].unlocked).toBe(false);
		}
	});

	it('unlocks tier 3 when tier 2 is unlocked and 30+ attempts at 70%+', () => {
		const state = createDefaultState();
		// Pre-unlock tier 2
		for (const id of TIER2_INTERVALS) {
			state.intervals[id].unlocked = true;
		}
		// 30 attempts, 70% accuracy
		addIntervalStats(state, TIER1_INTERVALS, 30, 21);

		const result = checkTierUnlock(state);

		for (const id of TIER3_INTERVALS) {
			expect(result.intervals[id].unlocked).toBe(true);
		}
	});

	it('chain unlocks multiple tiers at once with enough attempts', () => {
		const state = createDefaultState();
		// 100 attempts with 70% accuracy on tier 1 intervals
		// Should chain: tier 2 (10) → tier 3 (30) → tier 4 (60) → tier 5 (100)
		addIntervalStats(state, TIER1_INTERVALS, 100, 70);

		const result = checkTierUnlock(state);

		for (const id of [...TIER2_INTERVALS, ...TIER3_INTERVALS, ...TIER4_INTERVALS, ...TIER5_INTERVALS]) {
			expect(result.intervals[id].unlocked).toBe(true);
		}
	});

	it('stats from all three modes count toward totals', () => {
		const state = createDefaultState();
		// Split attempts across modes: 4 ascending + 3 descending + 3 harmonic = 10
		// With 3 + 2 + 2 = 7 correct (70%)
		addIntervalStats(state, ['P1'], 4, 3, 'ascending');
		addIntervalStats(state, ['P5'], 3, 2, 'descending');
		addIntervalStats(state, ['P8'], 3, 2, 'harmonic');

		const result = checkTierUnlock(state);

		for (const id of TIER2_INTERVALS) {
			expect(result.intervals[id].unlocked).toBe(true);
		}
	});
});

// ---------------------------------------------------------------------------
// Chord unlock tests
// ---------------------------------------------------------------------------

describe('checkTierUnlock — Chords', () => {
	it('does not unlock chord tier 2 with insufficient attempts', () => {
		const state = createDefaultState();
		// 9 attempts on tier 1 chords — below threshold
		addChordStats(state, TIER1_CHORDS, 9, 9);

		const result = checkTierUnlock(state);

		for (const id of TIER2_CHORDS) {
			expect(result.chords[id].unlocked).toBe(false);
		}
	});

	it('unlocks chord tier 2 at threshold (uses voicing aggregate)', () => {
		const state = createDefaultState();
		// Split across voicings: 5 root + 3 first + 2 second = 10 total
		addChordStats(state, TIER1_CHORDS, 5, 4, 'root');
		addChordStats(state, TIER1_CHORDS, 3, 2, 'first');
		addChordStats(state, TIER1_CHORDS, 2, 1, 'second');
		// Total: 10 attempts, 7 correct = 70%

		const result = checkTierUnlock(state);

		for (const id of TIER2_CHORDS) {
			expect(result.chords[id].unlocked).toBe(true);
		}
	});

	it('chord unlocks are independent of interval unlocks', () => {
		const state = createDefaultState();
		// Give enough interval stats to unlock tier 2 intervals
		addIntervalStats(state, TIER1_INTERVALS, 10, 7);
		// But give NO chord stats

		const result = checkTierUnlock(state);

		// Interval tier 2 should unlock
		for (const id of TIER2_INTERVALS) {
			expect(result.intervals[id].unlocked).toBe(true);
		}
		// Chord tier 2 should NOT unlock
		for (const id of TIER2_CHORDS) {
			expect(result.chords[id].unlocked).toBe(false);
		}
	});
});

// ---------------------------------------------------------------------------
// Scale unlock tests
// ---------------------------------------------------------------------------

describe('checkTierUnlock — Scales', () => {
	it('does not unlock scale tier 2 with insufficient attempts', () => {
		const state = createDefaultState();
		addScaleStats(state, TIER1_SCALES, 9, 9);

		const result = checkTierUnlock(state);

		for (const id of TIER2_SCALES) {
			expect(result.scales[id].unlocked).toBe(false);
		}
	});

	it('unlocks scale tier 2 at threshold', () => {
		const state = createDefaultState();
		// 10 attempts, 70% accuracy
		addScaleStats(state, TIER1_SCALES, 10, 7);

		const result = checkTierUnlock(state);

		for (const id of TIER2_SCALES) {
			expect(result.scales[id].unlocked).toBe(true);
		}
	});

	it('scale unlocks are independent of interval/chord unlocks', () => {
		const state = createDefaultState();
		// Give enough for interval and chord tier 2 unlocks
		addIntervalStats(state, TIER1_INTERVALS, 10, 7);
		addChordStats(state, TIER1_CHORDS, 10, 7);
		// But give NO scale stats

		const result = checkTierUnlock(state);

		// Intervals and chords should unlock
		for (const id of TIER2_INTERVALS) {
			expect(result.intervals[id].unlocked).toBe(true);
		}
		for (const id of TIER2_CHORDS) {
			expect(result.chords[id].unlocked).toBe(true);
		}
		// Scale tier 2 should NOT unlock
		for (const id of TIER2_SCALES) {
			expect(result.scales[id].unlocked).toBe(false);
		}
	});
});

// ---------------------------------------------------------------------------
// Mode unlock tests
// ---------------------------------------------------------------------------

describe('checkTierUnlock — Modes', () => {
	it('does not unlock modes when tier 3 scales are still locked', () => {
		const state = createDefaultState();
		// Give plenty of scale stats but don't unlock tier 2/3 scales manually
		addScaleStats(state, TIER1_SCALES, 60, 42);

		const result = checkTierUnlock(state);

		// Tier 2 scales unlock (60 >= 10, 70%), tier 3 might chain-unlock (60 >= 30)
		// But tier 3 requires tier 2 unlocked first — let's check what actually happens
		// With 60 attempts at 70%, tier 2 unlocks (10 threshold), then tier 3 checks
		// if tier 2 is unlocked (yes, just unlocked), and 60 >= 30 → tier 3 unlocks too
		// So tier 3 scales will chain-unlock, and then modes will also unlock!
		// This test needs a scenario where tier 3 scales DON'T unlock.

		// Let's redo: give stats that unlock tier 2 but not tier 3
		const state2 = createDefaultState();
		addScaleStats(state2, TIER1_SCALES, 20, 14); // 70%, unlocks tier 2 (20>=10) but not tier 3 (20<30)

		const result2 = checkTierUnlock(state2);

		// Tier 2 scales should unlock
		for (const id of TIER2_SCALES) {
			expect(result2.scales[id].unlocked).toBe(true);
		}
		// Tier 3 scales should NOT unlock (20 < 30)
		for (const id of TIER3_SCALES) {
			expect(result2.scales[id].unlocked).toBe(false);
		}
		// Modes beyond tier 1 should stay locked
		for (const id of ALL_MODES) {
			if (TIER1_MODES.includes(id)) {
				expect(result2.modes[id].unlocked).toBe(true);
			} else {
				expect(result2.modes[id].unlocked).toBe(false);
			}
		}
	});

	it('does not unlock modes when tier 3 scales are unlocked but insufficient scale attempts', () => {
		const state = createDefaultState();
		// Manually unlock all scales (tiers 1-3)
		for (const id of [...TIER1_SCALES, ...TIER2_SCALES, ...TIER3_SCALES]) {
			state.scales[id].unlocked = true;
		}
		// Only 50 attempts (below 60 threshold) at 70%
		addScaleStats(state, TIER1_SCALES, 50, 35);

		const result = checkTierUnlock(state);

		// Tier 2+ modes should stay locked
		for (const id of ALL_MODES) {
			if (TIER1_MODES.includes(id)) {
				expect(result.modes[id].unlocked).toBe(true);
			} else {
				expect(result.modes[id].unlocked).toBe(false);
			}
		}
	});

	it('unlocks all modes when tier 3 scales unlocked + 60 attempts at 70%', () => {
		const state = createDefaultState();
		// Manually unlock all scales
		for (const id of [...TIER1_SCALES, ...TIER2_SCALES, ...TIER3_SCALES]) {
			state.scales[id].unlocked = true;
		}
		// 60 attempts at 70% accuracy
		addScaleStats(state, TIER1_SCALES, 60, 42);

		const result = checkTierUnlock(state);

		// ALL modes should now be unlocked
		for (const id of ALL_MODES) {
			expect(result.modes[id].unlocked).toBe(true);
		}
	});
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('checkTierUnlock — Edge cases', () => {
	it('already-unlocked tiers stay unlocked (idempotent)', () => {
		const state = createDefaultState();
		// Pre-unlock tier 2 intervals
		for (const id of TIER2_INTERVALS) {
			state.intervals[id].unlocked = true;
		}
		// Give no stats — tier 3 won't unlock, but tier 2 should stay

		const result = checkTierUnlock(state);

		for (const id of TIER2_INTERVALS) {
			expect(result.intervals[id].unlocked).toBe(true);
		}
		// Tier 3 should still be locked
		for (const id of TIER3_INTERVALS) {
			expect(result.intervals[id].unlocked).toBe(false);
		}
	});

	it('checkTierUnlock returns a NEW object (not mutating input)', () => {
		const state = createDefaultState();
		addIntervalStats(state, TIER1_INTERVALS, 10, 7);

		const result = checkTierUnlock(state);

		// Result should have tier 2 unlocked
		expect(result.intervals['M3'].unlocked).toBe(true);
		// Original should NOT be mutated
		expect(state.intervals['M3'].unlocked).toBe(false);
		// Should be different references
		expect(result).not.toBe(state);
	});
});
