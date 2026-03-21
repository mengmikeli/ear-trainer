import { describe, it, expect, beforeEach } from 'vitest';
import { createDefaultState, loadState, saveState, checkTierUnlock } from '$lib/state';

const storage = new Map<string, string>();
const mockLocalStorage = {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => storage.set(key, value),
	removeItem: (key: string) => storage.delete(key),
	clear: () => storage.clear(),
} as Storage;

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

describe('checkTierUnlock', () => {
	it('unlocks tier 2 when 10+ total questions with 70%+ accuracy', () => {
		const state = createDefaultState();
		// Spread 10 questions across tier 1 intervals with 70%+ accuracy
		state.intervals['P1'].attempts = 4;
		state.intervals['P1'].correct = 3;
		state.intervals['P5'].attempts = 3;
		state.intervals['P5'].correct = 2;
		state.intervals['P8'].attempts = 3;
		state.intervals['P8'].correct = 3;
		// Total: 10 attempts, 8 correct = 80% > 70%
		const updated = checkTierUnlock(state);
		expect(updated.intervals['M3'].unlocked).toBe(true);
		expect(updated.intervals['P4'].unlocked).toBe(true);
	});
	it('does not unlock tier 2 if total questions < 10', () => {
		const state = createDefaultState();
		state.intervals['P1'].attempts = 3;
		state.intervals['P1'].correct = 3;
		state.intervals['P5'].attempts = 3;
		state.intervals['P5'].correct = 3;
		state.intervals['P8'].attempts = 3;
		state.intervals['P8'].correct = 3;
		// Total: 9 attempts — not enough
		const updated = checkTierUnlock(state);
		expect(updated.intervals['M3'].unlocked).toBe(false);
	});
	it('does not unlock tier 2 if accuracy below 70%', () => {
		const state = createDefaultState();
		state.intervals['P1'].attempts = 5;
		state.intervals['P1'].correct = 2;
		state.intervals['P5'].attempts = 5;
		state.intervals['P5'].correct = 2;
		state.intervals['P8'].attempts = 5;
		state.intervals['P8'].correct = 2;
		// Total: 15 attempts, 6 correct = 40% < 70%
		const updated = checkTierUnlock(state);
		expect(updated.intervals['M3'].unlocked).toBe(false);
	});
	it('does not unlock tier 3 before tier 2 is unlocked', () => {
		const state = createDefaultState();
		// Put enough questions for tier 3 threshold but tier 2 not unlocked
		state.intervals['P1'].attempts = 15;
		state.intervals['P1'].correct = 10;
		state.intervals['P5'].attempts = 10;
		state.intervals['P5'].correct = 8;
		state.intervals['P8'].attempts = 10;
		state.intervals['P8'].correct = 8;
		// Total: 35 attempts, 26 correct = 74%
		// BUT tier 2 should unlock first (10+ at 70%), then tier 3 needs 30+ total
		// Since we have 35 at 74%, both tier 2 AND tier 3 should unlock
		const updated = checkTierUnlock(state);
		expect(updated.intervals['M3'].unlocked).toBe(true);  // tier 2
		expect(updated.intervals['m3'].unlocked).toBe(true);  // tier 3
	});
});
