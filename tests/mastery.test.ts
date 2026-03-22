import { describe, it, expect } from 'vitest';
import { isModeMastered, getMasteryLevel, countMasteredSkills, getModeMasteryStatus } from '$lib/mastery';
import type { ModeStats, IntervalState } from '$lib/types';

function makeModeStats(overrides: Partial<ModeStats> = {}): ModeStats {
	return {
		attempts: 0,
		correct: 0,
		streak: 0,
		lastSeen: 0,
		easeFactor: 2.5,
		nextReview: 0,
		...overrides,
	};
}

function makeIntervalState(overrides: Partial<IntervalState> = {}): IntervalState {
	return {
		interval: 'P5',
		mode: 'choice',
		unlocked: true,
		enabled: true,
		attempts: 0,
		correct: 0,
		easeFactor: 2.5,
		nextReview: 0,
		streak: 0,
		lastSeen: 0,
		modes: {
			ascending: makeModeStats(),
			descending: makeModeStats(),
			harmonic: makeModeStats(),
		},
		...overrides,
	};
}

describe('isModeMastered', () => {
	it('returns true when 20+ attempts and 85%+ accuracy', () => {
		expect(isModeMastered(makeModeStats({ attempts: 20, correct: 17 }))).toBe(true); // 85%
	});

	it('returns true when well above threshold', () => {
		expect(isModeMastered(makeModeStats({ attempts: 100, correct: 95 }))).toBe(true); // 95%
	});

	it('returns false when 0 attempts', () => {
		expect(isModeMastered(makeModeStats({ attempts: 0, correct: 0 }))).toBe(false);
	});

	it('returns false when below 20 attempts even with 100% accuracy', () => {
		expect(isModeMastered(makeModeStats({ attempts: 19, correct: 19 }))).toBe(false);
	});

	it('returns false when 20 attempts but below 85% accuracy', () => {
		expect(isModeMastered(makeModeStats({ attempts: 20, correct: 16 }))).toBe(false); // 80%
	});

	it('returns true at exactly 85% with exactly 20 attempts', () => {
		expect(isModeMastered(makeModeStats({ attempts: 20, correct: 17 }))).toBe(true); // 85%
	});

	it('returns false at just below 85%', () => {
		// 84.6% — 22 attempts, 18.6 correct → 22 attempts, 18 correct = ~81.8%
		// More precise: 100 attempts, 84 correct = 84%
		expect(isModeMastered(makeModeStats({ attempts: 100, correct: 84 }))).toBe(false);
	});
});

describe('getMasteryLevel', () => {
	it('returns none when no modes mastered', () => {
		const state = makeIntervalState();
		expect(getMasteryLevel(state)).toBe('none');
	});

	it('returns bronze when 1 mode mastered', () => {
		const state = makeIntervalState({
			modes: {
				ascending: makeModeStats({ attempts: 25, correct: 23 }),
				descending: makeModeStats(),
				harmonic: makeModeStats(),
			},
		});
		expect(getMasteryLevel(state)).toBe('bronze');
	});

	it('returns silver when 2 modes mastered', () => {
		const state = makeIntervalState({
			modes: {
				ascending: makeModeStats({ attempts: 25, correct: 23 }),
				descending: makeModeStats({ attempts: 30, correct: 28 }),
				harmonic: makeModeStats(),
			},
		});
		expect(getMasteryLevel(state)).toBe('silver');
	});

	it('returns gold when all 3 modes mastered', () => {
		const state = makeIntervalState({
			modes: {
				ascending: makeModeStats({ attempts: 25, correct: 23 }),
				descending: makeModeStats({ attempts: 30, correct: 28 }),
				harmonic: makeModeStats({ attempts: 20, correct: 17 }),
			},
		});
		expect(getMasteryLevel(state)).toBe('gold');
	});
});

describe('countMasteredSkills', () => {
	it('returns 0/0 for empty intervals', () => {
		expect(countMasteredSkills({})).toEqual({ mastered: 0, total: 0 });
	});

	it('counts only unlocked intervals for total', () => {
		const intervals: Record<string, IntervalState> = {
			P1: makeIntervalState({ interval: 'P1', unlocked: true }),
			P5: makeIntervalState({ interval: 'P5', unlocked: false }),
		};
		const result = countMasteredSkills(intervals);
		expect(result.total).toBe(3); // only P1 counts (1 × 3)
	});

	it('correctly counts mastered skills across intervals', () => {
		const intervals: Record<string, IntervalState> = {
			P1: makeIntervalState({
				interval: 'P1',
				unlocked: true,
				modes: {
					ascending: makeModeStats({ attempts: 25, correct: 23 }),
					descending: makeModeStats({ attempts: 20, correct: 17 }),
					harmonic: makeModeStats(),
				},
			}),
			m3: makeIntervalState({
				interval: 'm3',
				unlocked: true,
				modes: {
					ascending: makeModeStats({ attempts: 50, correct: 48 }),
					descending: makeModeStats(),
					harmonic: makeModeStats(),
				},
			}),
		};
		const result = countMasteredSkills(intervals);
		expect(result.total).toBe(6); // 2 unlocked × 3
		expect(result.mastered).toBe(3); // P1:asc, P1:desc, m3:asc
	});

	it('skips locked intervals entirely', () => {
		const intervals: Record<string, IntervalState> = {
			P1: makeIntervalState({
				interval: 'P1',
				unlocked: false,
				modes: {
					ascending: makeModeStats({ attempts: 100, correct: 100 }),
					descending: makeModeStats({ attempts: 100, correct: 100 }),
					harmonic: makeModeStats({ attempts: 100, correct: 100 }),
				},
			}),
		};
		const result = countMasteredSkills(intervals);
		expect(result.total).toBe(0);
		expect(result.mastered).toBe(0);
	});
});

describe('getModeMasteryStatus', () => {
	it('returns all false for fresh interval', () => {
		const state = makeIntervalState();
		expect(getModeMasteryStatus(state)).toEqual({
			ascending: false,
			descending: false,
			harmonic: false,
		});
	});

	it('returns correct per-mode status', () => {
		const state = makeIntervalState({
			modes: {
				ascending: makeModeStats({ attempts: 25, correct: 23 }),
				descending: makeModeStats({ attempts: 10, correct: 10 }),
				harmonic: makeModeStats({ attempts: 40, correct: 35 }),
			},
		});
		expect(getModeMasteryStatus(state)).toEqual({
			ascending: true,
			descending: false, // only 10 attempts
			harmonic: true, // 35/40 = 87.5%
		});
	});
});
