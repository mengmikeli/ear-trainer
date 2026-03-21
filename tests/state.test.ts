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
	it('unlocks tier 2 when tier 1 all >= 80% over 10+ attempts', () => {
		const state = createDefaultState();
		for (const id of ['P1', 'P5', 'P8']) {
			state.intervals[id].attempts = 10;
			state.intervals[id].correct = 8;
		}
		const updated = checkTierUnlock(state);
		expect(updated.intervals['M3'].unlocked).toBe(true);
		expect(updated.intervals['P4'].unlocked).toBe(true);
	});
	it('does not unlock tier 2 if attempts < 10', () => {
		const state = createDefaultState();
		for (const id of ['P1', 'P5', 'P8']) {
			state.intervals[id].attempts = 5;
			state.intervals[id].correct = 5;
		}
		const updated = checkTierUnlock(state);
		expect(updated.intervals['M3'].unlocked).toBe(false);
	});
});
