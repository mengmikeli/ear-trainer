import { describe, it, expect, beforeEach } from 'vitest';
import { createDefaultState, loadState, saveState, checkTierUnlock, getAggregateStats } from '$lib/state';
import type { IntervalState, ModeStats } from '$lib/types';

const storage = new Map<string, string>();
const mockLocalStorage = {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => storage.set(key, value),
	removeItem: (key: string) => storage.delete(key),
	clear: () => storage.clear(),
} as unknown as Storage;

/** Helper: set attempts/correct on an interval's ascending mode (and sync aggregate fields) */
function setModeStats(interval: IntervalState, mode: keyof IntervalState['modes'], attempts: number, correct: number) {
	interval.modes[mode].attempts = attempts;
	interval.modes[mode].correct = correct;
	// Sync flat aggregate fields for consistency
	interval.attempts = interval.modes.ascending.attempts + interval.modes.descending.attempts + interval.modes.harmonic.attempts;
	interval.correct = interval.modes.ascending.correct + interval.modes.descending.correct + interval.modes.harmonic.correct;
}

describe('createDefaultState', () => {
	it('has all 13 intervals', () => {
		const state = createDefaultState();
		expect(Object.keys(state.intervals)).toHaveLength(13);
	});
	it('tier 1 intervals are unlocked by default', () => {
		const state = createDefaultState();
		expect(state.intervals['P1'].unlocked).toBe(true);
		expect(state.intervals['P5'].unlocked).toBe(true);
		expect(state.intervals['P8'].unlocked).toBe(true);
		expect(state.intervals['P1'].enabled).toBe(true);
	});
	it('tier 2+ intervals are locked by default', () => {
		const state = createDefaultState();
		expect(state.intervals['M3'].unlocked).toBe(false);
		expect(state.intervals['TT'].unlocked).toBe(false);
	});
	it('all intervals have initialized modes with zeroed stats', () => {
		const state = createDefaultState();
		for (const id of Object.keys(state.intervals)) {
			const interval = state.intervals[id];
			expect(interval.modes).toBeDefined();
			for (const mode of ['ascending', 'descending', 'harmonic'] as const) {
				expect(interval.modes[mode].attempts).toBe(0);
				expect(interval.modes[mode].correct).toBe(0);
				expect(interval.modes[mode].streak).toBe(0);
				expect(interval.modes[mode].lastSeen).toBe(0);
				expect(interval.modes[mode].easeFactor).toBe(2.5);
				expect(interval.modes[mode].nextReview).toBe(0);
			}
		}
	});
	it('settings has enabledModes with all modes enabled', () => {
		const state = createDefaultState();
		expect(state.settings.enabledModes).toEqual({
			ascending: true,
			descending: true,
			harmonic: true,
		});
	});
});

describe('loadState / saveState', () => {
	beforeEach(() => storage.clear());

	it('returns default state when nothing saved', () => {
		const state = loadState(mockLocalStorage);
		expect(state.stats.totalSessions).toBe(0);
	});
	it('round-trips state through save/load', () => {
		const state = createDefaultState();
		state.stats.totalSessions = 5;
		saveState(state, mockLocalStorage);
		const loaded = loadState(mockLocalStorage);
		expect(loaded.stats.totalSessions).toBe(5);
	});
});

describe('migration from old format (v2 → v3)', () => {
	beforeEach(() => storage.clear());

	it('migrates old intervals without modes field — ascending direction', () => {
		// Simulate old v2 state with no modes and direction=ascending
		const oldState = {
			intervals: {
				P1: { interval: 'P1', mode: 'choice', unlocked: true, enabled: true, attempts: 10, correct: 8, easeFactor: 2.6, nextReview: 1000, streak: 3, lastSeen: 500 },
				P5: { interval: 'P5', mode: 'choice', unlocked: true, enabled: true, attempts: 5, correct: 4, easeFactor: 2.5, nextReview: 0, streak: 1, lastSeen: 400 },
				P8: { interval: 'P8', mode: 'choice', unlocked: true, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				M3: { interval: 'M3', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				P4: { interval: 'P4', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				m3: { interval: 'm3', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				M6: { interval: 'M6', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				m7: { interval: 'm7', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				M2: { interval: 'M2', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				m6: { interval: 'm6', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				M7: { interval: 'M7', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				m2: { interval: 'm2', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				TT: { interval: 'TT', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
			},
			settings: { toneType: 'sine', direction: 'ascending', sessionLength: 20, theme: 'dark' },
			stats: { totalSessions: 3, totalQuestions: 15, currentStreak: 2, bestStreak: 5, lastPractice: 1000 },
		};
		storage.set('ear-trainer-state', JSON.stringify(oldState));
		const loaded = loadState(mockLocalStorage);

		// P1 stats should be migrated to ascending mode
		expect(loaded.intervals['P1'].modes.ascending.attempts).toBe(10);
		expect(loaded.intervals['P1'].modes.ascending.correct).toBe(8);
		expect(loaded.intervals['P1'].modes.ascending.easeFactor).toBe(2.6);
		expect(loaded.intervals['P1'].modes.ascending.streak).toBe(3);
		expect(loaded.intervals['P1'].modes.ascending.lastSeen).toBe(500);
		expect(loaded.intervals['P1'].modes.ascending.nextReview).toBe(1000);

		// Descending and harmonic should be zeroed
		expect(loaded.intervals['P1'].modes.descending.attempts).toBe(0);
		expect(loaded.intervals['P1'].modes.harmonic.attempts).toBe(0);

		// enabledModes for ascending direction
		expect(loaded.settings.enabledModes).toEqual({ ascending: true, descending: false, harmonic: false });
	});

	it('migrates old intervals — descending direction', () => {
		const oldState = {
			intervals: {
				P1: { interval: 'P1', mode: 'choice', unlocked: true, enabled: true, attempts: 6, correct: 5, easeFactor: 2.5, nextReview: 0, streak: 2, lastSeen: 300 },
				P5: { interval: 'P5', mode: 'choice', unlocked: true, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				P8: { interval: 'P8', mode: 'choice', unlocked: true, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				M3: { interval: 'M3', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				P4: { interval: 'P4', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				m3: { interval: 'm3', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				M6: { interval: 'M6', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				m7: { interval: 'm7', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				M2: { interval: 'M2', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				m6: { interval: 'm6', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				M7: { interval: 'M7', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				m2: { interval: 'm2', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				TT: { interval: 'TT', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
			},
			settings: { toneType: 'sine', direction: 'descending', sessionLength: 20, theme: 'dark' },
			stats: { totalSessions: 1, totalQuestions: 6, currentStreak: 1, bestStreak: 2, lastPractice: 500 },
		};
		storage.set('ear-trainer-state', JSON.stringify(oldState));
		const loaded = loadState(mockLocalStorage);

		// Stats should go to descending mode
		expect(loaded.intervals['P1'].modes.descending.attempts).toBe(6);
		expect(loaded.intervals['P1'].modes.descending.correct).toBe(5);
		expect(loaded.intervals['P1'].modes.ascending.attempts).toBe(0);
		expect(loaded.intervals['P1'].modes.harmonic.attempts).toBe(0);

		// enabledModes for descending direction
		expect(loaded.settings.enabledModes).toEqual({ ascending: false, descending: true, harmonic: false });
	});

	it('migrates old intervals — random direction', () => {
		const oldState = {
			intervals: {
				P1: { interval: 'P1', mode: 'choice', unlocked: true, enabled: true, attempts: 8, correct: 6, easeFactor: 2.5, nextReview: 0, streak: 1, lastSeen: 200 },
				P5: { interval: 'P5', mode: 'choice', unlocked: true, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				P8: { interval: 'P8', mode: 'choice', unlocked: true, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				M3: { interval: 'M3', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				P4: { interval: 'P4', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				m3: { interval: 'm3', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				M6: { interval: 'M6', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				m7: { interval: 'm7', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				M2: { interval: 'M2', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				m6: { interval: 'm6', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				M7: { interval: 'M7', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				m2: { interval: 'm2', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
				TT: { interval: 'TT', mode: 'choice', unlocked: false, enabled: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
			},
			settings: { toneType: 'sine', direction: 'random', sessionLength: 20, theme: 'dark' },
			stats: { totalSessions: 2, totalQuestions: 8, currentStreak: 1, bestStreak: 3, lastPractice: 400 },
		};
		storage.set('ear-trainer-state', JSON.stringify(oldState));
		const loaded = loadState(mockLocalStorage);

		// random → stats go to ascending (simpler)
		expect(loaded.intervals['P1'].modes.ascending.attempts).toBe(8);
		expect(loaded.intervals['P1'].modes.ascending.correct).toBe(6);
		expect(loaded.intervals['P1'].modes.descending.attempts).toBe(0);

		// enabledModes for random direction
		expect(loaded.settings.enabledModes).toEqual({ ascending: true, descending: true, harmonic: false });
	});
});

describe('getAggregateStats', () => {
	it('sums stats across all modes', () => {
		const state = createDefaultState();
		const interval = state.intervals['P1'];
		interval.modes.ascending.attempts = 5;
		interval.modes.ascending.correct = 4;
		interval.modes.descending.attempts = 3;
		interval.modes.descending.correct = 2;
		interval.modes.harmonic.attempts = 2;
		interval.modes.harmonic.correct = 1;

		const agg = getAggregateStats(interval);
		expect(agg.attempts).toBe(10);
		expect(agg.correct).toBe(7);
		expect(agg.accuracy).toBeCloseTo(0.7);
	});

	it('returns zero accuracy when no attempts', () => {
		const state = createDefaultState();
		const agg = getAggregateStats(state.intervals['P1']);
		expect(agg.attempts).toBe(0);
		expect(agg.correct).toBe(0);
		expect(agg.accuracy).toBe(0);
	});
});

describe('checkTierUnlock', () => {
	it('unlocks tier 2 when 10+ total questions with 70%+ accuracy (using modes)', () => {
		const state = createDefaultState();
		// Spread 10 questions across tier 1 intervals with 70%+ accuracy
		setModeStats(state.intervals['P1'], 'ascending', 4, 3);
		setModeStats(state.intervals['P5'], 'ascending', 3, 2);
		setModeStats(state.intervals['P8'], 'ascending', 3, 3);
		// Total: 10 attempts, 8 correct = 80% > 70%
		const updated = checkTierUnlock(state);
		expect(updated.intervals['M3'].unlocked).toBe(true);
		expect(updated.intervals['P4'].unlocked).toBe(true);
	});

	it('unlocks tier 2 with stats spread across multiple modes', () => {
		const state = createDefaultState();
		// Stats across ascending and descending modes
		setModeStats(state.intervals['P1'], 'ascending', 2, 2);
		setModeStats(state.intervals['P1'], 'descending', 2, 1);
		setModeStats(state.intervals['P5'], 'ascending', 2, 2);
		setModeStats(state.intervals['P5'], 'harmonic', 1, 1);
		setModeStats(state.intervals['P8'], 'ascending', 2, 2);
		setModeStats(state.intervals['P8'], 'descending', 1, 1);
		// Total: 12 attempts, 11 correct = 91.7% > 70% — but need to recount
		// P1: 2+2=4 attempts, 2+1=3 correct
		// P5: 2+1=3 attempts, 2+1=3 correct
		// P8: 2+1=3 attempts, 2+1=3 correct
		// Total: 10 attempts, 9 correct = 90%
		const updated = checkTierUnlock(state);
		expect(updated.intervals['M3'].unlocked).toBe(true);
		expect(updated.intervals['P4'].unlocked).toBe(true);
	});

	it('does not unlock tier 2 if total questions < 10', () => {
		const state = createDefaultState();
		setModeStats(state.intervals['P1'], 'ascending', 3, 3);
		setModeStats(state.intervals['P5'], 'ascending', 3, 3);
		setModeStats(state.intervals['P8'], 'ascending', 3, 3);
		// Total: 9 attempts — not enough
		const updated = checkTierUnlock(state);
		expect(updated.intervals['M3'].unlocked).toBe(false);
	});
	it('does not unlock tier 2 if accuracy below 70%', () => {
		const state = createDefaultState();
		setModeStats(state.intervals['P1'], 'ascending', 5, 2);
		setModeStats(state.intervals['P5'], 'ascending', 5, 2);
		setModeStats(state.intervals['P8'], 'ascending', 5, 2);
		// Total: 15 attempts, 6 correct = 40% < 70%
		const updated = checkTierUnlock(state);
		expect(updated.intervals['M3'].unlocked).toBe(false);
	});
	it('does not unlock tier 3 before tier 2 is unlocked', () => {
		const state = createDefaultState();
		// Put enough questions for tier 3 threshold but tier 2 not unlocked
		setModeStats(state.intervals['P1'], 'ascending', 15, 10);
		setModeStats(state.intervals['P5'], 'ascending', 10, 8);
		setModeStats(state.intervals['P8'], 'ascending', 10, 8);
		// Total: 35 attempts, 26 correct = 74%
		// Both tier 2 AND tier 3 should unlock (tier 2 first at 10+, then tier 3 at 30+)
		const updated = checkTierUnlock(state);
		expect(updated.intervals['M3'].unlocked).toBe(true);  // tier 2
		expect(updated.intervals['m3'].unlocked).toBe(true);  // tier 3
	});
});
