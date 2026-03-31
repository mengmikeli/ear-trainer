import { describe, it, expect, beforeEach } from 'vitest';
import { createDefaultState, loadState, saveState } from '$lib/state';
import { INTERVALS } from '$lib/intervals';
import { CHORDS } from '$lib/chords';
import { SCALES } from '$lib/scales';
import { MODES } from '$lib/modes';
import type { UserState } from '$lib/types';

// ---------------------------------------------------------------------------
// Mock Storage
// ---------------------------------------------------------------------------
const store = new Map<string, string>();
const mockStorage = {
	getItem: (key: string) => store.get(key) ?? null,
	setItem: (key: string, value: string) => store.set(key, value),
	removeItem: (key: string) => store.delete(key),
	clear: () => store.clear(),
	get length() { return store.size; },
	key: (_i: number) => null,
} as unknown as Storage;

beforeEach(() => store.clear());

// ===========================================================================
// createDefaultState
// ===========================================================================
describe('createDefaultState', () => {
	it('returns a UserState with all top-level fields', () => {
		const s = createDefaultState();
		expect(s).toHaveProperty('intervals');
		expect(s).toHaveProperty('chords');
		expect(s).toHaveProperty('scales');
		expect(s).toHaveProperty('modes');
		expect(s).toHaveProperty('settings');
		expect(s).toHaveProperty('stats');
	});

	// --- Intervals -----------------------------------------------------------
	it('contains all 13 intervals', () => {
		const s = createDefaultState();
		expect(Object.keys(s.intervals)).toHaveLength(INTERVALS.length);
		for (const def of INTERVALS) {
			expect(s.intervals[def.id]).toBeDefined();
		}
	});

	it('tier 1 intervals (P1, P5, P8) are unlocked', () => {
		const s = createDefaultState();
		const tier1 = INTERVALS.filter(i => i.tier === 1);
		expect(tier1.map(i => i.id)).toEqual(['P1', 'P5', 'P8']);
		for (const def of tier1) {
			expect(s.intervals[def.id].unlocked).toBe(true);
			expect(s.intervals[def.id].enabled).toBe(true);
		}
	});

	it('tier 2+ intervals are locked', () => {
		const s = createDefaultState();
		for (const def of INTERVALS.filter(i => i.tier > 1)) {
			expect(s.intervals[def.id].unlocked).toBe(false);
		}
	});

	it('every interval has zeroed per-mode stats', () => {
		const s = createDefaultState();
		for (const id of Object.keys(s.intervals)) {
			const interval = s.intervals[id];
			expect(interval.modes).toBeDefined();
			for (const mode of ['ascending', 'descending', 'harmonic'] as const) {
				expect(interval.modes[mode]).toEqual({
					attempts: 0,
					correct: 0,
					streak: 0,
					lastSeen: 0,
					easeFactor: 2.5,
					nextReview: 0,
				});
			}
		}
	});

	// --- Chords --------------------------------------------------------------
	it('contains all defined chords', () => {
		const s = createDefaultState();
		expect(Object.keys(s.chords)).toHaveLength(CHORDS.length);
		for (const def of CHORDS) {
			expect(s.chords[def.id]).toBeDefined();
		}
	});

	it('tier 1 chords are unlocked, tier 2+ locked', () => {
		const s = createDefaultState();
		for (const def of CHORDS) {
			if (def.tier === 1) {
				expect(s.chords[def.id].unlocked).toBe(true);
			} else {
				expect(s.chords[def.id].unlocked).toBe(false);
			}
		}
	});

	it('chord voicing stats are zeroed', () => {
		const s = createDefaultState();
		for (const def of CHORDS) {
			const cs = s.chords[def.id];
			for (const v of ['root', 'first', 'second'] as const) {
				expect(cs.voicings[v]).toEqual({
					attempts: 0,
					correct: 0,
					streak: 0,
					lastSeen: 0,
					easeFactor: 2.5,
					nextReview: 0,
				});
			}
		}
	});

	// --- Scales --------------------------------------------------------------
	it('contains all defined scales', () => {
		const s = createDefaultState();
		expect(Object.keys(s.scales)).toHaveLength(SCALES.length);
		for (const def of SCALES) {
			expect(s.scales[def.id]).toBeDefined();
		}
	});

	it('tier 1 scales are unlocked, tier 2+ locked', () => {
		const s = createDefaultState();
		for (const def of SCALES) {
			if (def.tier === 1) {
				expect(s.scales[def.id].unlocked).toBe(true);
			} else {
				expect(s.scales[def.id].unlocked).toBe(false);
			}
		}
	});

	// --- Modes ---------------------------------------------------------------
	it('contains all defined modes', () => {
		const s = createDefaultState();
		expect(s.modes).toBeDefined();
		expect(Object.keys(s.modes!)).toHaveLength(MODES.length);
		for (const def of MODES) {
			expect(s.modes![def.id]).toBeDefined();
		}
	});

	it('tier 1 modes are unlocked, tier 2+ locked', () => {
		const s = createDefaultState();
		for (const def of MODES) {
			if (def.tier === 1) {
				expect(s.modes![def.id].unlocked).toBe(true);
			} else {
				expect(s.modes![def.id].unlocked).toBe(false);
			}
		}
	});

	// --- Settings ------------------------------------------------------------
	it('default settings have expected values', () => {
		const s = createDefaultState();
		expect(s.settings.toneType).toBe('epiano');
		expect(s.settings.sessionLength).toBe(20);
		expect(s.settings.activeContent).toBe('intervals');
		expect(s.settings.theme).toBe('dark');
		expect(s.settings.direction).toBe('ascending');
	});

	it('default enabledModes', () => {
		const s = createDefaultState();
		expect(s.settings.enabledModes).toEqual({
			ascending: true,
			descending: true,
			harmonic: true,
		});
	});

	it('default enabledVoicings', () => {
		const s = createDefaultState();
		expect(s.settings.enabledVoicings).toEqual({
			root: true,
			first: false,
			second: false,
		});
	});

	// --- Global stats --------------------------------------------------------
	it('global stats are zeroed', () => {
		const s = createDefaultState();
		expect(s.stats).toEqual({
			totalSessions: 0,
			totalQuestions: 0,
			currentStreak: 0,
			bestStreak: 0,
			lastPractice: 0,
		});
	});
});

// ===========================================================================
// loadState — empty / missing storage
// ===========================================================================
describe('loadState', () => {
	it('returns defaults when storage is empty', () => {
		const loaded = loadState(mockStorage);
		const defaults = createDefaultState();
		// Loaded state goes through migrateToAdaptive, so it will have adaptive field
		expect(loaded.intervals).toEqual(defaults.intervals);
		expect(loaded.chords).toEqual(defaults.chords);
		expect(loaded.scales).toEqual(defaults.scales);
		expect(loaded.modes).toEqual(defaults.modes);
		expect(loaded.settings).toEqual(defaults.settings);
		expect(loaded.stats).toEqual(defaults.stats);
	});

	it('returns defaults when storage has corrupt JSON', () => {
		store.set('ear-trainer-state', '{{not valid json!!');
		const loaded = loadState(mockStorage);
		const defaults = createDefaultState();
		expect(loaded.intervals).toEqual(defaults.intervals);
		expect(loaded.settings).toEqual(defaults.settings);
		expect(loaded.stats).toEqual(defaults.stats);
	});

	// --- Save / load roundtrip -----------------------------------------------
	it('roundtrips through save/load with modified fields', () => {
		const state = createDefaultState();
		// Modify some fields
		state.settings.toneType = 'sine';
		state.settings.sessionLength = 30;
		state.stats.totalSessions = 42;
		state.stats.totalQuestions = 500;
		state.stats.currentStreak = 7;
		state.intervals['P1'].modes.ascending.attempts = 100;
		state.intervals['P1'].modes.ascending.correct = 85;

		saveState(state, mockStorage);
		const loaded = loadState(mockStorage);

		expect(loaded.settings.toneType).toBe('sine');
		expect(loaded.settings.sessionLength).toBe(30);
		expect(loaded.stats.totalSessions).toBe(42);
		expect(loaded.stats.totalQuestions).toBe(500);
		expect(loaded.stats.currentStreak).toBe(7);
		expect(loaded.intervals['P1'].modes.ascending.attempts).toBe(100);
		expect(loaded.intervals['P1'].modes.ascending.correct).toBe(85);
	});

	it('roundtrips chord state', () => {
		const state = createDefaultState();
		state.chords['maj'].voicings.root.attempts = 20;
		state.chords['maj'].voicings.root.correct = 15;
		saveState(state, mockStorage);
		const loaded = loadState(mockStorage);
		expect(loaded.chords['maj'].voicings.root.attempts).toBe(20);
		expect(loaded.chords['maj'].voicings.root.correct).toBe(15);
	});

	it('roundtrips scale state', () => {
		const state = createDefaultState();
		state.scales['major'].attempts = 30;
		state.scales['major'].correct = 25;
		saveState(state, mockStorage);
		const loaded = loadState(mockStorage);
		expect(loaded.scales['major'].attempts).toBe(30);
		expect(loaded.scales['major'].correct).toBe(25);
	});

	it('roundtrips mode state', () => {
		const state = createDefaultState();
		state.modes!['ionian'].attempts = 10;
		state.modes!['ionian'].correct = 8;
		saveState(state, mockStorage);
		const loaded = loadState(mockStorage);
		expect(loaded.modes!['ionian'].attempts).toBe(10);
		expect(loaded.modes!['ionian'].correct).toBe(8);
	});
});

// ===========================================================================
// loadState — migrations
// ===========================================================================
describe('loadState — migrations', () => {
	it('adds enabled field to intervals missing it (v1 compat)', () => {
		const state = createDefaultState();
		const raw: any = JSON.parse(JSON.stringify(state));
		// Remove 'enabled' from one interval
		delete raw.intervals['P1'].enabled;
		store.set('ear-trainer-state', JSON.stringify(raw));
		const loaded = loadState(mockStorage);
		expect(loaded.intervals['P1'].enabled).toBe(true);
	});

	it('adds theme if missing', () => {
		const state = createDefaultState();
		const raw: any = JSON.parse(JSON.stringify(state));
		delete raw.settings.theme;
		store.set('ear-trainer-state', JSON.stringify(raw));
		const loaded = loadState(mockStorage);
		expect(loaded.settings.theme).toBe('dark');
	});

	it('adds per-mode stats to intervals missing them (v2 → v3 migration)', () => {
		const state = createDefaultState();
		const raw: any = JSON.parse(JSON.stringify(state));
		// Simulate v2 interval without modes
		delete raw.intervals['P1'].modes;
		raw.intervals['P1'].attempts = 50;
		raw.intervals['P1'].correct = 40;
		raw.intervals['P1'].streak = 3;
		raw.settings.direction = 'ascending';
		store.set('ear-trainer-state', JSON.stringify(raw));

		const loaded = loadState(mockStorage);
		// Existing stats should migrate into ascending mode
		expect(loaded.intervals['P1'].modes.ascending.attempts).toBe(50);
		expect(loaded.intervals['P1'].modes.ascending.correct).toBe(40);
		expect(loaded.intervals['P1'].modes.ascending.streak).toBe(3);
		// Other modes should be zeroed
		expect(loaded.intervals['P1'].modes.descending.attempts).toBe(0);
		expect(loaded.intervals['P1'].modes.harmonic.attempts).toBe(0);
	});

	it('migrates v2 descending direction stats into descending mode', () => {
		const state = createDefaultState();
		const raw: any = JSON.parse(JSON.stringify(state));
		delete raw.intervals['P5'].modes;
		raw.intervals['P5'].attempts = 20;
		raw.intervals['P5'].correct = 15;
		raw.settings.direction = 'descending';
		store.set('ear-trainer-state', JSON.stringify(raw));

		const loaded = loadState(mockStorage);
		expect(loaded.intervals['P5'].modes.descending.attempts).toBe(20);
		expect(loaded.intervals['P5'].modes.descending.correct).toBe(15);
		expect(loaded.intervals['P5'].modes.ascending.attempts).toBe(0);
	});

	// --- enabledModes migration ----------------------------------------------
	it('adds enabledModes from ascending direction when missing', () => {
		const state = createDefaultState();
		const raw: any = JSON.parse(JSON.stringify(state));
		delete raw.settings.enabledModes;
		raw.settings.direction = 'ascending';
		store.set('ear-trainer-state', JSON.stringify(raw));

		const loaded = loadState(mockStorage);
		expect(loaded.settings.enabledModes).toEqual({
			ascending: true,
			descending: false,
			harmonic: false,
		});
	});

	it('adds enabledModes from descending direction when missing', () => {
		const state = createDefaultState();
		const raw: any = JSON.parse(JSON.stringify(state));
		delete raw.settings.enabledModes;
		raw.settings.direction = 'descending';
		store.set('ear-trainer-state', JSON.stringify(raw));

		const loaded = loadState(mockStorage);
		expect(loaded.settings.enabledModes).toEqual({
			ascending: false,
			descending: true,
			harmonic: false,
		});
	});

	it('adds enabledModes from random direction when missing', () => {
		const state = createDefaultState();
		const raw: any = JSON.parse(JSON.stringify(state));
		delete raw.settings.enabledModes;
		raw.settings.direction = 'random';
		store.set('ear-trainer-state', JSON.stringify(raw));

		const loaded = loadState(mockStorage);
		expect(loaded.settings.enabledModes).toEqual({
			ascending: true,
			descending: true,
			harmonic: false,
		});
	});

	// --- Chords migration (v3.3) ---------------------------------------------
	it('adds chords field when missing (v3.3 migration)', () => {
		const state = createDefaultState();
		const raw: any = JSON.parse(JSON.stringify(state));
		delete raw.chords;
		store.set('ear-trainer-state', JSON.stringify(raw));

		const loaded = loadState(mockStorage);
		expect(loaded.chords).toBeDefined();
		expect(Object.keys(loaded.chords)).toHaveLength(CHORDS.length);
		// Tier 1 chords should be unlocked
		for (const def of CHORDS.filter(c => c.tier === 1)) {
			expect(loaded.chords[def.id].unlocked).toBe(true);
		}
		for (const def of CHORDS.filter(c => c.tier > 1)) {
			expect(loaded.chords[def.id].unlocked).toBe(false);
		}
	});

	it('adds enabledVoicings when missing', () => {
		const state = createDefaultState();
		const raw: any = JSON.parse(JSON.stringify(state));
		delete raw.settings.enabledVoicings;
		store.set('ear-trainer-state', JSON.stringify(raw));

		const loaded = loadState(mockStorage);
		expect(loaded.settings.enabledVoicings).toEqual({
			root: true,
			first: false,
			second: false,
		});
	});

	it('adds activeContent when missing', () => {
		const state = createDefaultState();
		const raw: any = JSON.parse(JSON.stringify(state));
		delete raw.settings.activeContent;
		store.set('ear-trainer-state', JSON.stringify(raw));

		const loaded = loadState(mockStorage);
		expect(loaded.settings.activeContent).toBe('intervals');
	});

	it('resets invalid activeContent to intervals', () => {
		const state = createDefaultState();
		const raw: any = JSON.parse(JSON.stringify(state));
		raw.settings.activeContent = 'bogus_value';
		store.set('ear-trainer-state', JSON.stringify(raw));

		const loaded = loadState(mockStorage);
		expect(loaded.settings.activeContent).toBe('intervals');
	});

	// --- Scales migration (v3.4) ---------------------------------------------
	it('adds scales field when missing (v3.4 migration)', () => {
		const state = createDefaultState();
		const raw: any = JSON.parse(JSON.stringify(state));
		delete raw.scales;
		store.set('ear-trainer-state', JSON.stringify(raw));

		const loaded = loadState(mockStorage);
		expect(loaded.scales).toBeDefined();
		expect(Object.keys(loaded.scales)).toHaveLength(SCALES.length);
		for (const def of SCALES.filter(s => s.tier === 1)) {
			expect(loaded.scales[def.id].unlocked).toBe(true);
		}
		for (const def of SCALES.filter(s => s.tier > 1)) {
			expect(loaded.scales[def.id].unlocked).toBe(false);
		}
	});

	// --- Modes migration (v3.5) ----------------------------------------------
	it('adds modes field when missing (v3.5 migration)', () => {
		const state = createDefaultState();
		const raw: any = JSON.parse(JSON.stringify(state));
		delete raw.modes;
		store.set('ear-trainer-state', JSON.stringify(raw));

		const loaded = loadState(mockStorage);
		expect(loaded.modes).toBeDefined();
		expect(Object.keys(loaded.modes!)).toHaveLength(MODES.length);
		for (const def of MODES.filter(m => m.tier === 1)) {
			expect(loaded.modes![def.id].unlocked).toBe(true);
		}
		for (const def of MODES.filter(m => m.tier > 1)) {
			expect(loaded.modes![def.id].unlocked).toBe(false);
		}
	});

	it('fills in missing mode entries when some modes exist', () => {
		const state = createDefaultState();
		const raw: any = JSON.parse(JSON.stringify(state));
		// Keep only ionian, delete rest
		raw.modes = { ionian: raw.modes!.ionian };
		store.set('ear-trainer-state', JSON.stringify(raw));

		const loaded = loadState(mockStorage);
		// All modes should exist
		for (const def of MODES) {
			expect(loaded.modes![def.id]).toBeDefined();
		}
		// ionian should retain its state
		expect(loaded.modes!['ionian']).toBeDefined();
	});

	// --- Adaptive migration --------------------------------------------------
	it('loadState adds adaptive field via migrateToAdaptive', () => {
		const state = createDefaultState();
		// Save WITHOUT adaptive field
		const raw: any = JSON.parse(JSON.stringify(state));
		delete raw.adaptive;
		store.set('ear-trainer-state', JSON.stringify(raw));

		const loaded = loadState(mockStorage);
		expect(loaded.adaptive).toBeDefined();
		expect(loaded.adaptive!.sessionHistory).toEqual([]);
		expect(loaded.adaptive!.lastSessionDate).toBe(0);
		expect(typeof loaded.adaptive!.stats).toBe('object');
	});

	// --- Partial / combined migrations ----------------------------------------
	it('handles state missing chords, scales, modes all at once', () => {
		const state = createDefaultState();
		const raw: any = JSON.parse(JSON.stringify(state));
		delete raw.chords;
		delete raw.scales;
		delete raw.modes;
		delete raw.settings.enabledVoicings;
		delete raw.settings.activeContent;
		store.set('ear-trainer-state', JSON.stringify(raw));

		const loaded = loadState(mockStorage);
		expect(loaded.chords).toBeDefined();
		expect(Object.keys(loaded.chords)).toHaveLength(CHORDS.length);
		expect(loaded.scales).toBeDefined();
		expect(Object.keys(loaded.scales)).toHaveLength(SCALES.length);
		expect(loaded.modes).toBeDefined();
		expect(Object.keys(loaded.modes!)).toHaveLength(MODES.length);
		expect(loaded.settings.enabledVoicings).toBeDefined();
		expect(loaded.settings.activeContent).toBe('intervals');
	});
});

// ===========================================================================
// saveState
// ===========================================================================
describe('saveState', () => {
	it('persists state to storage as JSON', () => {
		const state = createDefaultState();
		saveState(state, mockStorage);
		const raw = store.get('ear-trainer-state');
		expect(raw).toBeDefined();
		const parsed = JSON.parse(raw!);
		expect(parsed.settings.toneType).toBe('epiano');
	});

	it('overwrites previous state', () => {
		const s1 = createDefaultState();
		s1.stats.totalSessions = 1;
		saveState(s1, mockStorage);

		const s2 = createDefaultState();
		s2.stats.totalSessions = 99;
		saveState(s2, mockStorage);

		const raw = JSON.parse(store.get('ear-trainer-state')!);
		expect(raw.stats.totalSessions).toBe(99);
	});
});
