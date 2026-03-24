import { describe, it, expect, beforeEach } from 'vitest';
import { createDefaultState, loadState, saveState, checkTierUnlock, getScaleAggregateStats } from '$lib/state';
import { SCALES } from '$lib/scales';
import type { ScaleState, ModeStats } from '$lib/types';

const storage = new Map<string, string>();
const mockLocalStorage = {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => storage.set(key, value),
	removeItem: (key: string) => storage.delete(key),
	clear: () => storage.clear(),
} as Storage;

function setChordVoicingStats(state: any, chordId: string, voicing: string, attempts: number, correct: number) {
	const chord = state.chords[chordId];
	chord.voicings[voicing].attempts = attempts;
	chord.voicings[voicing].correct = correct;
	chord.attempts = chord.voicings.root.attempts + chord.voicings.first.attempts + chord.voicings.second.attempts;
	chord.correct = chord.voicings.root.correct + chord.voicings.first.correct + chord.voicings.second.correct;
}

function setModeStats(state: any, intervalId: string, mode: string, attempts: number, correct: number) {
	const interval = state.intervals[intervalId];
	interval.modes[mode].attempts = attempts;
	interval.modes[mode].correct = correct;
	interval.attempts = interval.modes.ascending.attempts + interval.modes.descending.attempts + interval.modes.harmonic.attempts;
	interval.correct = interval.modes.ascending.correct + interval.modes.descending.correct + interval.modes.harmonic.correct;
}

describe('createDefaultState — scale fields', () => {
	it('has all 9 scales', () => {
		const state = createDefaultState();
		expect(Object.keys(state.scales)).toHaveLength(9);
	});

	it('tier 1 scales are unlocked', () => {
		const state = createDefaultState();
		expect(state.scales['major'].unlocked).toBe(true);
		expect(state.scales['nat_min'].unlocked).toBe(true);
		expect(state.scales['maj_pent'].unlocked).toBe(true);
	});

	it('tier 2 scales are locked', () => {
		const state = createDefaultState();
		expect(state.scales['harm_min'].unlocked).toBe(false);
		expect(state.scales['min_pent'].unlocked).toBe(false);
	});

	it('tier 3 scales are locked', () => {
		const state = createDefaultState();
		expect(state.scales['blues'].unlocked).toBe(false);
		expect(state.scales['whole'].unlocked).toBe(false);
		expect(state.scales['mel_min'].unlocked).toBe(false);
		expect(state.scales['chromatic'].unlocked).toBe(false);
	});

	it('all scales have zeroed stats', () => {
		const state = createDefaultState();
		for (const id of Object.keys(state.scales)) {
			const s = state.scales[id];
			expect(s.attempts).toBe(0);
			expect(s.correct).toBe(0);
			expect(s.easeFactor).toBe(2.5);
			expect(s.nextReview).toBe(0);
			expect(s.streak).toBe(0);
			expect(s.lastSeen).toBe(0);
		}
	});

	it('settings.activeContent accepts scales', () => {
		const state = createDefaultState();
		state.settings.activeContent = 'scales';
		expect(state.settings.activeContent).toBe('scales');
	});
});

describe('v3.3 → v3.4 migration — scale state', () => {
	beforeEach(() => storage.clear());

	it('adds scales field to old state missing it', () => {
		const oldState = createDefaultState();
		delete (oldState as any).scales;
		storage.set('ear-trainer-state', JSON.stringify(oldState));

		const loaded = loadState(mockLocalStorage);
		expect(Object.keys(loaded.scales)).toHaveLength(9);
		expect(loaded.scales['major'].unlocked).toBe(true);
		expect(loaded.scales['harm_min'].unlocked).toBe(false);
	});

	it('preserves existing interval data during migration', () => {
		const oldState = createDefaultState();
		oldState.intervals['P1'].attempts = 42;
		oldState.intervals['P1'].correct = 35;
		oldState.stats.totalSessions = 10;
		delete (oldState as any).scales;
		storage.set('ear-trainer-state', JSON.stringify(oldState));

		const loaded = loadState(mockLocalStorage);
		expect(loaded.intervals['P1'].attempts).toBe(42);
		expect(loaded.intervals['P1'].correct).toBe(35);
		expect(loaded.stats.totalSessions).toBe(10);
		expect(Object.keys(loaded.scales)).toHaveLength(9);
	});

	it('preserves existing chord data during migration', () => {
		const oldState = createDefaultState();
		setChordVoicingStats(oldState, 'maj', 'root', 20, 15);
		delete (oldState as any).scales;
		storage.set('ear-trainer-state', JSON.stringify(oldState));

		const loaded = loadState(mockLocalStorage);
		expect(loaded.chords['maj'].voicings.root.attempts).toBe(20);
		expect(loaded.chords['maj'].voicings.root.correct).toBe(15);
		expect(Object.keys(loaded.scales)).toHaveLength(9);
	});

	it('preserves activeContent value when already set', () => {
		const oldState = createDefaultState();
		oldState.settings.activeContent = 'chords';
		delete (oldState as any).scales;
		storage.set('ear-trainer-state', JSON.stringify(oldState));

		const loaded = loadState(mockLocalStorage);
		expect(loaded.settings.activeContent).toBe('chords');
	});

	it('round-trips scale state through save/load', () => {
		const state = createDefaultState();
		state.scales['major'].attempts = 15;
		state.scales['major'].correct = 12;
		state.scales['major'].easeFactor = 2.8;
		saveState(state, mockLocalStorage);

		const loaded = loadState(mockLocalStorage);
		expect(loaded.scales['major'].attempts).toBe(15);
		expect(loaded.scales['major'].correct).toBe(12);
		expect(loaded.scales['major'].easeFactor).toBe(2.8);
	});
});

describe('getScaleAggregateStats', () => {
	it('returns stats directly (no sub-modes)', () => {
		const state = createDefaultState();
		state.scales['major'].attempts = 10;
		state.scales['major'].correct = 8;

		const agg = getScaleAggregateStats(state.scales['major']);
		expect(agg.attempts).toBe(10);
		expect(agg.correct).toBe(8);
		expect(agg.accuracy).toBeCloseTo(0.8);
	});

	it('returns zero accuracy when no attempts', () => {
		const state = createDefaultState();
		const agg = getScaleAggregateStats(state.scales['major']);
		expect(agg.attempts).toBe(0);
		expect(agg.accuracy).toBe(0);
	});
});

describe('checkTierUnlock — scale tiers', () => {
	it('unlocks scale tier 2 with 10+ questions and 70%+ accuracy', () => {
		const state = createDefaultState();
		state.scales['major'].attempts = 6;
		state.scales['major'].correct = 5;
		state.scales['nat_min'].attempts = 5;
		state.scales['nat_min'].correct = 4;
		// Total: 11 attempts, 9 correct = 81.8%
		const updated = checkTierUnlock(state);
		expect(updated.scales['harm_min'].unlocked).toBe(true);
		expect(updated.scales['min_pent'].unlocked).toBe(true);
	});

	it('does not unlock scale tier 2 with <10 questions', () => {
		const state = createDefaultState();
		state.scales['major'].attempts = 4;
		state.scales['major'].correct = 4;
		state.scales['nat_min'].attempts = 4;
		state.scales['nat_min'].correct = 4;
		// Total: 8 attempts < 10
		const updated = checkTierUnlock(state);
		expect(updated.scales['harm_min'].unlocked).toBe(false);
	});

	it('does not unlock scale tier 2 with <70% accuracy', () => {
		const state = createDefaultState();
		state.scales['major'].attempts = 8;
		state.scales['major'].correct = 3;
		state.scales['nat_min'].attempts = 8;
		state.scales['nat_min'].correct = 3;
		// Total: 16 attempts, 6 correct = 37.5%
		const updated = checkTierUnlock(state);
		expect(updated.scales['harm_min'].unlocked).toBe(false);
	});

	it('unlocks scale tier 3 after 30+ questions (cascading)', () => {
		const state = createDefaultState();
		state.scales['major'].attempts = 20;
		state.scales['major'].correct = 16;
		state.scales['nat_min'].attempts = 15;
		state.scales['nat_min'].correct = 12;
		// Total: 35 attempts, 28 correct = 80%
		const updated = checkTierUnlock(state);
		expect(updated.scales['harm_min'].unlocked).toBe(true);  // tier 2
		expect(updated.scales['min_pent'].unlocked).toBe(true);  // tier 2
		expect(updated.scales['blues'].unlocked).toBe(true);     // tier 3
		expect(updated.scales['whole'].unlocked).toBe(true);     // tier 3
		expect(updated.scales['mel_min'].unlocked).toBe(true);   // tier 3
		expect(updated.scales['chromatic'].unlocked).toBe(true); // tier 3
	});

	it('does not unlock tier 3 before tier 2 is unlocked', () => {
		const state = createDefaultState();
		// Manually lock tier 1 to ensure tier 2 can't unlock
		state.scales['major'].unlocked = false;
		state.scales['nat_min'].unlocked = false;
		state.scales['maj_pent'].unlocked = false;
		state.scales['major'].attempts = 40;
		state.scales['major'].correct = 35;
		const updated = checkTierUnlock(state);
		expect(updated.scales['harm_min'].unlocked).toBe(false);
		expect(updated.scales['blues'].unlocked).toBe(false);
	});

	it('scale unlock is independent of interval unlock', () => {
		const state = createDefaultState();
		// Lots of scale progress, zero interval progress
		state.scales['major'].attempts = 6;
		state.scales['major'].correct = 5;
		state.scales['nat_min'].attempts = 6;
		state.scales['nat_min'].correct = 5;
		const updated = checkTierUnlock(state);
		// Scale tier 2 unlocked
		expect(updated.scales['harm_min'].unlocked).toBe(true);
		// Interval tier 2 stays locked
		expect(updated.intervals['M3'].unlocked).toBe(false);
	});

	it('scale unlock is independent of chord unlock', () => {
		const state = createDefaultState();
		state.scales['major'].attempts = 6;
		state.scales['major'].correct = 5;
		state.scales['nat_min'].attempts = 6;
		state.scales['nat_min'].correct = 5;
		const updated = checkTierUnlock(state);
		expect(updated.scales['harm_min'].unlocked).toBe(true);
		expect(updated.chords['dim'].unlocked).toBe(false);
	});
});

describe('cross-content isolation', () => {
	it('scale progress does not affect interval stats', () => {
		const state = createDefaultState();
		state.scales['major'].attempts = 50;
		state.scales['major'].correct = 40;
		const updated = checkTierUnlock(state);
		// Interval tier 2 should NOT be unlocked by scale progress
		expect(updated.intervals['M3'].unlocked).toBe(false);
	});

	it('scale progress does not affect chord stats', () => {
		const state = createDefaultState();
		state.scales['major'].attempts = 50;
		state.scales['major'].correct = 40;
		const updated = checkTierUnlock(state);
		expect(updated.chords['dim'].unlocked).toBe(false);
	});

	it('interval progress does not unlock scale tiers', () => {
		const state = createDefaultState();
		setModeStats(state, 'P1', 'ascending', 20, 18);
		setModeStats(state, 'P5', 'ascending', 20, 18);
		setModeStats(state, 'P8', 'ascending', 20, 18);
		const updated = checkTierUnlock(state);
		// Lots of interval progress, but scale tier 2 stays locked
		expect(updated.scales['harm_min'].unlocked).toBe(false);
	});

	it('switching activeContent preserves all state', () => {
		const state = createDefaultState();
		state.scales['major'].attempts = 10;
		state.intervals['P1'].attempts = 20;
		state.chords['maj'].attempts = 15;
		state.settings.activeContent = 'scales';
		saveState(state, mockLocalStorage);

		const loaded = loadState(mockLocalStorage);
		expect(loaded.settings.activeContent).toBe('scales');
		expect(loaded.scales['major'].attempts).toBe(10);
		expect(loaded.intervals['P1'].attempts).toBe(20);
		expect(loaded.chords['maj'].attempts).toBe(15);
	});
});
