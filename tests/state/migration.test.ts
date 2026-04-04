import { describe, it, expect } from 'vitest';
import { migrateToV4 } from '$lib/state/migration';
import { createDefaultStateV4 } from '$lib/state/defaults';
import { STATE_VERSION, defaultContentStats, defaultDefinitionState } from '$lib/state/schema';
import type { UserStateV4 } from '$lib/state/schema';
import { INTERVALS } from '$lib/definitions/intervals';
import { CHORDS } from '$lib/definitions/chords';
import { SCALES } from '$lib/definitions/scales';
import { MODES } from '$lib/definitions/modes';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a minimal v3 state (intervals + settings + stats, no chords/scales/modes). */
function minimalV3(): any {
	const intervals: Record<string, any> = {};
	for (const def of INTERVALS) {
		intervals[def.id] = {
			interval: def.id,
			mode: 'choice',
			unlocked: def.tier === 1,
			enabled: true,
			attempts: 0,
			correct: 0,
			easeFactor: 2.5,
			nextReview: 0,
			streak: 0,
			lastSeen: 0,
			modes: {
				ascending: { attempts: 0, correct: 0, streak: 0, lastSeen: 0, easeFactor: 2.5, nextReview: 0 },
				descending: { attempts: 0, correct: 0, streak: 0, lastSeen: 0, easeFactor: 2.5, nextReview: 0 },
				harmonic: { attempts: 0, correct: 0, streak: 0, lastSeen: 0, easeFactor: 2.5, nextReview: 0 },
			},
		};
	}
	return {
		intervals,
		settings: {
			toneType: 'epiano',
			direction: 'ascending',
			sessionLength: 20,
			theme: 'dark',
			enabledModes: { ascending: true, descending: true, harmonic: true },
			enabledVoicings: { root: true, first: false, second: false },
			activeContent: 'intervals',
		},
		stats: {
			totalSessions: 5,
			totalQuestions: 100,
			currentStreak: 3,
			bestStreak: 7,
			lastPractice: 1700000000000,
		},
	};
}

/** Build a full v3 state with all categories. */
function fullV3(): any {
	const v3 = minimalV3();

	// Chords
	v3.chords = {};
	for (const def of CHORDS) {
		v3.chords[def.id] = {
			chord: def.id,
			unlocked: def.tier === 1,
			enabled: true,
			attempts: 0,
			correct: 0,
			easeFactor: 2.5,
			nextReview: 0,
			streak: 0,
			lastSeen: 0,
			voicings: {
				root: { attempts: 0, correct: 0, streak: 0, lastSeen: 0, easeFactor: 2.5, nextReview: 0 },
				first: { attempts: 0, correct: 0, streak: 0, lastSeen: 0, easeFactor: 2.5, nextReview: 0 },
				second: { attempts: 0, correct: 0, streak: 0, lastSeen: 0, easeFactor: 2.5, nextReview: 0 },
			},
		};
	}

	// Scales
	v3.scales = {};
	for (const def of SCALES) {
		v3.scales[def.id] = {
			scale: def.id,
			unlocked: def.tier === 1,
			enabled: true,
			attempts: 0,
			correct: 0,
			easeFactor: 2.5,
			nextReview: 0,
			streak: 0,
			lastSeen: 0,
		};
	}

	// Modes
	v3.modes = {};
	for (const def of MODES) {
		v3.modes[def.id] = {
			mode: def.id,
			unlocked: def.tier === 1,
			enabled: true,
			attempts: 0,
			correct: 0,
			easeFactor: 2.5,
			nextReview: 0,
			streak: 0,
			lastSeen: 0,
		};
	}

	return v3;
}

// ===========================================================================
// Basic migration
// ===========================================================================
describe('basic migration', () => {
	it('returns v4 state unchanged (already migrated)', () => {
		const v4 = createDefaultStateV4();
		const result = migrateToV4(v4);
		expect(result).toBe(v4); // exact same reference (no clone)
		expect(result.version).toBe(STATE_VERSION);
	});

	it('null input → fresh v4 defaults', () => {
		const result = migrateToV4(null);
		expect(result.version).toBe(STATE_VERSION);
		expect(result.stats).toEqual({});
		expect(Object.keys(result.definitions.intervals)).toHaveLength(INTERVALS.length);
		expect(result.settings.toneType).toBe('epiano');
		expect(result.globalStats.totalSessions).toBe(0);
		expect(result.sessionHistory).toEqual([]);
	});

	it('undefined input → fresh v4 defaults', () => {
		const result = migrateToV4(undefined);
		expect(result.version).toBe(STATE_VERSION);
	});

	it('empty object → fresh v4 defaults', () => {
		const result = migrateToV4({});
		expect(result.version).toBe(STATE_VERSION);
		expect(result.settings.activeContent).toBe('intervals');
	});

	it('minimal v3 state → valid v4', () => {
		const v3 = minimalV3();
		const result = migrateToV4(v3);
		expect(result.version).toBe(STATE_VERSION);
		expect(result.definitions.intervals['P5']).toEqual({ unlocked: true, enabled: true });
		expect(result.globalStats.totalSessions).toBe(5);
		// Chords/scales/modes should get defaults since they're missing from v3
		expect(Object.keys(result.definitions.chords)).toHaveLength(CHORDS.length);
		expect(Object.keys(result.definitions.scales)).toHaveLength(SCALES.length);
		expect(Object.keys(result.definitions.modes)).toHaveLength(MODES.length);
	});
});

// ===========================================================================
// Stats migration
// ===========================================================================
describe('stats migration', () => {
	it('v3 with adaptive.stats present → stats promoted directly', () => {
		const v3 = fullV3();
		v3.adaptive = {
			stats: {
				'interval:P5:ascending': {
					attempts: 42,
					correct: 35,
					streak: 5,
					lastSeen: 1700000000000,
					easeFactor: 2.8,
					nextReview: 1700100000000,
				},
			},
			sessionHistory: [],
			lastSessionDate: 0,
		};

		const result = migrateToV4(v3);
		expect(result.stats['interval:P5:ascending']).toEqual({
			attempts: 42,
			correct: 35,
			streak: 5,
			lastSeen: 1700000000000,
			easeFactor: 2.8,
			nextReview: 1700100000000,
		});
	});

	it('v3 without adaptive → stats built from legacy interval modes', () => {
		const v3 = minimalV3();
		v3.intervals['P5'].modes.ascending = {
			attempts: 20,
			correct: 15,
			streak: 3,
			lastSeen: 1700000000000,
			easeFactor: 2.6,
			nextReview: 1700050000000,
		};

		const result = migrateToV4(v3);
		expect(result.stats['interval:P5:ascending']).toEqual({
			attempts: 20,
			correct: 15,
			streak: 3,
			lastSeen: 1700000000000,
			easeFactor: 2.6,
			nextReview: 1700050000000,
		});
	});

	it('v3 interval with 10 ascending attempts → stats["interval:P5:ascending"].attempts = 10', () => {
		const v3 = minimalV3();
		v3.intervals['P5'].modes.ascending.attempts = 10;
		v3.intervals['P5'].modes.ascending.correct = 8;

		const result = migrateToV4(v3);
		expect(result.stats['interval:P5:ascending'].attempts).toBe(10);
		expect(result.stats['interval:P5:ascending'].correct).toBe(8);
	});

	it('v3 chord with voicing stats → stats["chord:maj:root"]', () => {
		const v3 = fullV3();
		v3.chords['maj'].voicings.root = {
			attempts: 15,
			correct: 12,
			streak: 4,
			lastSeen: 1700000000000,
			easeFactor: 2.7,
			nextReview: 1700090000000,
		};

		const result = migrateToV4(v3);
		expect(result.stats['chord:maj:root']).toEqual({
			attempts: 15,
			correct: 12,
			streak: 4,
			lastSeen: 1700000000000,
			easeFactor: 2.7,
			nextReview: 1700090000000,
		});
	});

	it('v3 scale with flat stats → stats["scale:major"]', () => {
		const v3 = fullV3();
		v3.scales['major'].attempts = 30;
		v3.scales['major'].correct = 25;
		v3.scales['major'].streak = 7;
		v3.scales['major'].lastSeen = 1700000000000;

		const result = migrateToV4(v3);
		expect(result.stats['scale:major'].attempts).toBe(30);
		expect(result.stats['scale:major'].correct).toBe(25);
		expect(result.stats['scale:major'].streak).toBe(7);
	});

	it('v3 mode state (if present) → stats["mode:dorian"]', () => {
		const v3 = fullV3();
		v3.modes['dorian'] = {
			mode: 'dorian',
			unlocked: true,
			enabled: true,
			attempts: 8,
			correct: 6,
			easeFactor: 2.4,
			nextReview: 1700060000000,
			streak: 2,
			lastSeen: 1700000000000,
		};

		const result = migrateToV4(v3);
		expect(result.stats['mode:dorian'].attempts).toBe(8);
		expect(result.stats['mode:dorian'].correct).toBe(6);
		expect(result.stats['mode:dorian'].streak).toBe(2);
	});
});

// ===========================================================================
// Pre-v3 (no modes field on intervals) migration
// ===========================================================================
describe('pre-v3 migration (no interval modes)', () => {
	it('flat interval stats assigned to ascending mode when direction=ascending', () => {
		const v3: any = {
			intervals: {
				P5: {
					interval: 'P5',
					unlocked: true,
					enabled: true,
					attempts: 25,
					correct: 20,
					streak: 5,
					lastSeen: 1700000000000,
					easeFactor: 2.6,
					nextReview: 1700050000000,
					// no modes field — pre-v3 data
				},
			},
			settings: { direction: 'ascending' },
			stats: {},
		};

		const result = migrateToV4(v3);
		expect(result.stats['interval:P5:ascending'].attempts).toBe(25);
		expect(result.stats['interval:P5:descending'].attempts).toBe(0);
		expect(result.stats['interval:P5:harmonic'].attempts).toBe(0);
	});

	it('flat interval stats assigned to descending mode when direction=descending', () => {
		const v3: any = {
			intervals: {
				P5: {
					interval: 'P5',
					unlocked: true,
					enabled: true,
					attempts: 15,
					correct: 10,
					streak: 3,
					lastSeen: 1700000000000,
					easeFactor: 2.5,
					nextReview: 0,
				},
			},
			settings: { direction: 'descending' },
			stats: {},
		};

		const result = migrateToV4(v3);
		expect(result.stats['interval:P5:descending'].attempts).toBe(15);
		expect(result.stats['interval:P5:ascending'].attempts).toBe(0);
	});
});

// ===========================================================================
// Definition extraction
// ===========================================================================
describe('definition extraction', () => {
	it('intervals unlocked/enabled extracted correctly', () => {
		const v3 = fullV3();
		v3.intervals['P5'].unlocked = true;
		v3.intervals['P5'].enabled = false;
		v3.intervals['m7'].unlocked = false;
		v3.intervals['m7'].enabled = true;

		const result = migrateToV4(v3);
		expect(result.definitions.intervals['P5']).toEqual({ unlocked: true, enabled: false });
		expect(result.definitions.intervals['m7']).toEqual({ unlocked: false, enabled: true });
	});

	it('chords: tier 1 unlocked, tier 2+ locked', () => {
		const v3 = fullV3();
		const result = migrateToV4(v3);

		// Tier 1 chords (maj, min) are unlocked
		expect(result.definitions.chords['maj'].unlocked).toBe(true);
		expect(result.definitions.chords['min'].unlocked).toBe(true);

		// Tier 2+ are locked (unless explicitly unlocked in v3)
		expect(result.definitions.chords['dim'].unlocked).toBe(false);
		expect(result.definitions.chords['dom7'].unlocked).toBe(false);
	});

	it('missing modes field → all modes get default DefinitionState', () => {
		const v3 = minimalV3(); // no modes field
		const result = migrateToV4(v3);

		for (const def of MODES) {
			expect(result.definitions.modes[def.id]).toBeDefined();
			// Tier 1 modes get unlocked by default
			if (def.tier === 1) {
				expect(result.definitions.modes[def.id].unlocked).toBe(true);
			}
			expect(result.definitions.modes[def.id].enabled).toBe(true);
		}
	});

	it('all INTERVALS, CHORDS, SCALES, MODES have entries even if legacy is missing', () => {
		const result = migrateToV4({});
		expect(Object.keys(result.definitions.intervals)).toHaveLength(INTERVALS.length);
		expect(Object.keys(result.definitions.chords)).toHaveLength(CHORDS.length);
		expect(Object.keys(result.definitions.scales)).toHaveLength(SCALES.length);
		expect(Object.keys(result.definitions.modes)).toHaveLength(MODES.length);
	});
});

// ===========================================================================
// Settings migration
// ===========================================================================
describe('settings migration', () => {
	it('direction field dropped (not in v4)', () => {
		const v3 = minimalV3();
		v3.settings.direction = 'descending';
		const result = migrateToV4(v3);
		expect((result.settings as any).direction).toBeUndefined();
	});

	it('missing enabledModes → defaults derived from direction=ascending', () => {
		const v3 = minimalV3();
		delete v3.settings.enabledModes;
		v3.settings.direction = 'ascending';

		const result = migrateToV4(v3);
		expect(result.settings.enabledModes).toEqual({
			ascending: true,
			descending: false,
			harmonic: false,
		});
	});

	it('missing enabledModes → random direction maps to ascending+descending', () => {
		const v3 = minimalV3();
		delete v3.settings.enabledModes;
		v3.settings.direction = 'random';

		const result = migrateToV4(v3);
		expect(result.settings.enabledModes).toEqual({
			ascending: true,
			descending: true,
			harmonic: false,
		});
	});

	it('missing enabledVoicings → defaults applied', () => {
		const v3 = minimalV3();
		delete v3.settings.enabledVoicings;

		const result = migrateToV4(v3);
		expect(result.settings.enabledVoicings).toEqual({
			root: true,
			first: false,
			second: false,
		});
	});

	it('invalid activeContent → reset to intervals', () => {
		const v3 = minimalV3();
		v3.settings.activeContent = 'bogus_value';

		const result = migrateToV4(v3);
		expect(result.settings.activeContent).toBe('intervals');
	});

	it('preserves valid settings fields', () => {
		const v3 = minimalV3();
		v3.settings.toneType = 'piano';
		v3.settings.sessionLength = 30;
		v3.settings.theme = 'light';
		v3.settings.devMode = true;
		v3.settings.superchargeViz = true;

		const result = migrateToV4(v3);
		expect(result.settings.toneType).toBe('piano');
		expect(result.settings.sessionLength).toBe(30);
		expect(result.settings.theme).toBe('light');
		expect(result.settings.devMode).toBe(true);
		expect(result.settings.superchargeViz).toBe(true);
	});

	it('invalid toneType/sessionLength/theme → defaults', () => {
		const v3 = minimalV3();
		v3.settings.toneType = 'guitar';
		v3.settings.sessionLength = 99;
		v3.settings.theme = 'neon';

		const result = migrateToV4(v3);
		expect(result.settings.toneType).toBe('epiano');
		expect(result.settings.sessionLength).toBe(20);
		expect(result.settings.theme).toBe('dark');
	});
});

// ===========================================================================
// GlobalStats
// ===========================================================================
describe('globalStats migration', () => {
	it('maps from raw.stats correctly', () => {
		const v3 = minimalV3();
		const result = migrateToV4(v3);
		expect(result.globalStats).toEqual({
			totalSessions: 5,
			totalQuestions: 100,
			currentStreak: 3,
			bestStreak: 7,
			lastPractice: 1700000000000,
		});
	});

	it('missing fields get zeroed defaults', () => {
		const result = migrateToV4({ intervals: {}, settings: {}, stats: {} });
		expect(result.globalStats).toEqual({
			totalSessions: 0,
			totalQuestions: 0,
			currentStreak: 0,
			bestStreak: 0,
			lastPractice: 0,
		});
	});

	it('no stats field at all → zeroed defaults', () => {
		const result = migrateToV4({});
		expect(result.globalStats.totalSessions).toBe(0);
		expect(result.globalStats.lastPractice).toBe(0);
	});
});

// ===========================================================================
// SessionHistory
// ===========================================================================
describe('sessionHistory migration', () => {
	it('from adaptive.sessionHistory when present', () => {
		const v3 = fullV3();
		const session = {
			date: 1700000000000,
			length: 20,
			kinds: ['interval'] as any[],
			accuracy: 0.85,
			weakestItem: 'interval:m3:ascending',
			strongestItem: 'interval:P5:ascending',
		};
		v3.adaptive = {
			stats: {},
			sessionHistory: [session],
			lastSessionDate: 1700000000000,
		};

		const result = migrateToV4(v3);
		expect(result.sessionHistory).toHaveLength(1);
		expect(result.sessionHistory[0]).toEqual(session);
	});

	it('empty array when adaptive not present', () => {
		const v3 = minimalV3();
		const result = migrateToV4(v3);
		expect(result.sessionHistory).toEqual([]);
	});

	it('filters out invalid session records', () => {
		const v3 = fullV3();
		v3.adaptive = {
			stats: {},
			sessionHistory: [
				{ date: 1700000000000, length: 20, kinds: ['interval'], accuracy: 0.85, weakestItem: 'a', strongestItem: 'b' },
				null, // invalid
				'not an object', // invalid
				{ noDateField: true }, // invalid — missing date
			],
			lastSessionDate: 0,
		};

		const result = migrateToV4(v3);
		expect(result.sessionHistory).toHaveLength(1);
	});
});

// ===========================================================================
// Edge cases
// ===========================================================================
describe('edge cases', () => {
	it('corrupt/partial state → fresh defaults', () => {
		// String instead of object
		const result = migrateToV4('corrupted');
		expect(result.version).toBe(STATE_VERSION);
		expect(result.stats).toEqual({});
	});

	it('number input → fresh defaults', () => {
		const result = migrateToV4(42);
		expect(result.version).toBe(STATE_VERSION);
	});

	it('array input → fresh defaults', () => {
		const result = migrateToV4([1, 2, 3]);
		// arrays are typeof 'object', but Array.isArray — the migrator
		// will still produce valid output since fields are missing
		expect(result.version).toBe(STATE_VERSION);
	});

	it('state with extra unknown fields → ignored gracefully', () => {
		const v3 = fullV3();
		(v3 as any).unknownTopLevel = { foo: 'bar' };
		(v3 as any).settings.unknownSetting = true;
		(v3 as any).intervals['P5'].unknownField = 'hey';

		const result = migrateToV4(v3);
		expect(result.version).toBe(STATE_VERSION);
		expect((result as any).unknownTopLevel).toBeUndefined();
		expect((result.settings as any).unknownSetting).toBeUndefined();
	});

	it('NaN values in stats → treated as 0', () => {
		const v3 = minimalV3();
		v3.intervals['P5'].modes.ascending.attempts = NaN;
		v3.intervals['P5'].modes.ascending.easeFactor = NaN;

		const result = migrateToV4(v3);
		expect(result.stats['interval:P5:ascending'].attempts).toBe(0);
		expect(result.stats['interval:P5:ascending'].easeFactor).toBe(2.5); // falls back to default
	});

	it('v3 interval with enabled=undefined → defaults to true', () => {
		const v3 = minimalV3();
		delete v3.intervals['P5'].enabled;

		const result = migrateToV4(v3);
		expect(result.definitions.intervals['P5'].enabled).toBe(true);
	});

	it('chord without voicings → flat stats go to root voicing', () => {
		const v3: any = {
			intervals: {},
			chords: {
				maj: {
					chord: 'maj',
					unlocked: true,
					enabled: true,
					attempts: 10,
					correct: 8,
					streak: 3,
					lastSeen: 1700000000000,
					easeFactor: 2.5,
					nextReview: 0,
					// no voicings field
				},
			},
			settings: {},
			stats: {},
		};

		const result = migrateToV4(v3);
		expect(result.stats['chord:maj:root'].attempts).toBe(10);
		expect(result.stats['chord:maj:first'].attempts).toBe(0);
		expect(result.stats['chord:maj:second'].attempts).toBe(0);
	});
});

// ===========================================================================
// createDefaultStateV4
// ===========================================================================
describe('createDefaultStateV4', () => {
	it('has correct version', () => {
		const state = createDefaultStateV4();
		expect(state.version).toBe(STATE_VERSION);
	});

	it('has all definition categories populated', () => {
		const state = createDefaultStateV4();
		expect(Object.keys(state.definitions.intervals)).toHaveLength(INTERVALS.length);
		expect(Object.keys(state.definitions.chords)).toHaveLength(CHORDS.length);
		expect(Object.keys(state.definitions.scales)).toHaveLength(SCALES.length);
		expect(Object.keys(state.definitions.modes)).toHaveLength(MODES.length);
	});

	it('tier 1 items are unlocked, others are not', () => {
		const state = createDefaultStateV4();
		for (const def of INTERVALS) {
			expect(state.definitions.intervals[def.id].unlocked).toBe(def.tier === 1);
		}
		for (const def of CHORDS) {
			expect(state.definitions.chords[def.id].unlocked).toBe(def.tier === 1);
		}
	});
});
