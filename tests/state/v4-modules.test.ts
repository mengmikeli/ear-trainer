/**
 * Tests for v4 state modules: defaults, storage, progression, stats.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { INTERVALS } from '$lib/definitions/intervals';
import { CHORDS } from '$lib/definitions/chords';
import { SCALES } from '$lib/definitions/scales';
import { MODES } from '$lib/definitions/modes';
import { STATE_VERSION } from '$lib/state/schema';
import type { UserStateV4, ContentStats } from '$lib/state/schema';
import { defaultContentStats } from '$lib/state/schema';
import { createDefaultStateV4 } from '$lib/state/defaults';
import { loadStateV4, saveStateV4 } from '$lib/state/storage';
import { checkTierUnlockV4 } from '$lib/state/progression';
import {
	getStats,
	getAccuracy,
	getStatsByKind,
	getStatsForDef,
	aggregateStats,
	getOverallAccuracy,
} from '$lib/state/stats';

// ─── Mock Storage ───────────────────────────────────────────────────────────

const store = new Map<string, string>();
const mockStorage = {
	getItem: (key: string) => store.get(key) ?? null,
	setItem: (key: string, value: string) => store.set(key, value),
	removeItem: (key: string) => store.delete(key),
	clear: () => store.clear(),
	get length() {
		return store.size;
	},
	key: (_i: number) => null,
} as unknown as Storage;

beforeEach(() => store.clear());

// ─── Helpers ────────────────────────────────────────────────────────────────

const TIER1_INTERVALS = INTERVALS.filter((i) => i.tier === 1).map((i) => i.id);
const TIER2_INTERVALS = INTERVALS.filter((i) => i.tier === 2).map((i) => i.id);
const TIER3_INTERVALS = INTERVALS.filter((i) => i.tier === 3).map((i) => i.id);
const TIER4_INTERVALS = INTERVALS.filter((i) => i.tier === 4).map((i) => i.id);
const TIER5_INTERVALS = INTERVALS.filter((i) => i.tier === 5).map((i) => i.id);

const TIER1_CHORDS = CHORDS.filter((c) => c.tier === 1).map((c) => c.id);
const TIER2_CHORDS = CHORDS.filter((c) => c.tier === 2).map((c) => c.id);

const TIER1_SCALES = SCALES.filter((s) => s.tier === 1).map((s) => s.id);
const TIER2_SCALES = SCALES.filter((s) => s.tier === 2).map((s) => s.id);
const TIER3_SCALES = SCALES.filter((s) => s.tier === 3).map((s) => s.id);
const TIER4_SCALES = SCALES.filter((s) => s.tier === 4).map((s) => s.id);
const ALL_SCALE_IDS = SCALES.map((s) => s.id);

const TIER1_MODES = MODES.filter((m) => m.tier === 1).map((m) => m.id);
const TIER2_MODES = MODES.filter((m) => m.tier === 2).map((m) => m.id);
const TIER3_MODES = MODES.filter((m) => m.tier === 3).map((m) => m.id);
const ALL_MODE_IDS = MODES.map((m) => m.id);

/** Add interval stats to a v4 state across the three play modes. */
function addV4IntervalStats(
	state: UserStateV4,
	intervalIds: string[],
	totalAttempts: number,
	totalCorrect: number,
	mode: 'ascending' | 'descending' | 'harmonic' = 'ascending',
): void {
	const perItem = Math.floor(totalAttempts / intervalIds.length);
	const perCorrect = Math.floor(totalCorrect / intervalIds.length);
	for (const id of intervalIds) {
		const key = `interval:${id}:${mode}`;
		const existing = state.stats[key] ?? defaultContentStats();
		state.stats[key] = {
			...existing,
			attempts: existing.attempts + perItem,
			correct: existing.correct + perCorrect,
		};
	}
	// Remainder to first item
	const remA = totalAttempts - perItem * intervalIds.length;
	const remC = totalCorrect - perCorrect * intervalIds.length;
	if (remA > 0 || remC > 0) {
		const key = `interval:${intervalIds[0]}:${mode}`;
		state.stats[key].attempts += remA;
		state.stats[key].correct += remC;
	}
}

/** Add chord stats to a v4 state. */
function addV4ChordStats(
	state: UserStateV4,
	chordIds: string[],
	totalAttempts: number,
	totalCorrect: number,
	voicing: 'root' | 'first' | 'second' = 'root',
): void {
	const perItem = Math.floor(totalAttempts / chordIds.length);
	const perCorrect = Math.floor(totalCorrect / chordIds.length);
	for (const id of chordIds) {
		const key = `chord:${id}:${voicing}`;
		const existing = state.stats[key] ?? defaultContentStats();
		state.stats[key] = {
			...existing,
			attempts: existing.attempts + perItem,
			correct: existing.correct + perCorrect,
		};
	}
	const remA = totalAttempts - perItem * chordIds.length;
	const remC = totalCorrect - perCorrect * chordIds.length;
	if (remA > 0 || remC > 0) {
		const key = `chord:${chordIds[0]}:${voicing}`;
		state.stats[key].attempts += remA;
		state.stats[key].correct += remC;
	}
}

/** Add scale stats to a v4 state. */
function addV4ScaleStats(
	state: UserStateV4,
	scaleIds: string[],
	totalAttempts: number,
	totalCorrect: number,
): void {
	const perItem = Math.floor(totalAttempts / scaleIds.length);
	const perCorrect = Math.floor(totalCorrect / scaleIds.length);
	for (const id of scaleIds) {
		const key = `scale:${id}`;
		const existing = state.stats[key] ?? defaultContentStats();
		state.stats[key] = {
			...existing,
			attempts: existing.attempts + perItem,
			correct: existing.correct + perCorrect,
		};
	}
	const remA = totalAttempts - perItem * scaleIds.length;
	const remC = totalCorrect - perCorrect * scaleIds.length;
	if (remA > 0 || remC > 0) {
		const key = `scale:${scaleIds[0]}`;
		state.stats[key].attempts += remA;
		state.stats[key].correct += remC;
	}
}

function addV4ModeStats(
	state: UserStateV4,
	modeIds: string[],
	totalAttempts: number,
	totalCorrect: number,
): void {
	const perItem = Math.floor(totalAttempts / modeIds.length);
	const perCorrect = Math.floor(totalCorrect / modeIds.length);
	for (const id of modeIds) {
		const key = `mode:${id}`;
		const existing = state.stats[key] ?? defaultContentStats();
		state.stats[key] = {
			...existing,
			attempts: existing.attempts + perItem,
			correct: existing.correct + perCorrect,
		};
	}
	const remA = totalAttempts - perItem * modeIds.length;
	const remC = totalCorrect - perCorrect * modeIds.length;
	if (remA > 0 || remC > 0) {
		const key = `mode:${modeIds[0]}`;
		state.stats[key].attempts += remA;
		state.stats[key].correct += remC;
	}
}

// ===========================================================================
// defaults — createDefaultStateV4
// ===========================================================================

describe('createDefaultStateV4', () => {
	it('returns a valid v4 state with version=4', () => {
		const s = createDefaultStateV4();
		expect(s.version).toBe(4);
		expect(s.version).toBe(STATE_VERSION);
	});

	it('has all top-level fields', () => {
		const s = createDefaultStateV4();
		expect(s).toHaveProperty('stats');
		expect(s).toHaveProperty('definitions');
		expect(s).toHaveProperty('settings');
		expect(s).toHaveProperty('globalStats');
		expect(s).toHaveProperty('sessionHistory');
	});

	// --- Definitions ---------------------------------------------------------

	it('contains all interval definitions', () => {
		const s = createDefaultStateV4();
		expect(Object.keys(s.definitions.intervals)).toHaveLength(INTERVALS.length);
		for (const def of INTERVALS) {
			expect(s.definitions.intervals[def.id]).toBeDefined();
		}
	});

	it('tier 1 intervals are unlocked', () => {
		const s = createDefaultStateV4();
		for (const def of INTERVALS.filter((i) => i.tier === 1)) {
			expect(s.definitions.intervals[def.id].unlocked).toBe(true);
			expect(s.definitions.intervals[def.id].enabled).toBe(true);
		}
	});

	it('tier 2+ intervals are locked', () => {
		const s = createDefaultStateV4();
		for (const def of INTERVALS.filter((i) => i.tier > 1)) {
			expect(s.definitions.intervals[def.id].unlocked).toBe(false);
		}
	});

	it('tier 1 chords are unlocked, tier 2+ locked', () => {
		const s = createDefaultStateV4();
		for (const def of CHORDS) {
			expect(s.definitions.chords[def.id].unlocked).toBe(def.tier === 1);
		}
	});

	it('tier 1 scales are unlocked, tier 2+ locked', () => {
		const s = createDefaultStateV4();
		for (const def of SCALES) {
			expect(s.definitions.scales[def.id].unlocked).toBe(def.tier === 1);
		}
	});

	it('tier 1 modes are unlocked, tier 2+ locked', () => {
		const s = createDefaultStateV4();
		for (const def of MODES) {
			expect(s.definitions.modes[def.id].unlocked).toBe(def.tier === 1);
		}
	});

	// --- Stats ---------------------------------------------------------------

	it('has empty stats (no entries)', () => {
		const s = createDefaultStateV4();
		expect(Object.keys(s.stats)).toHaveLength(0);
	});

	// --- Settings ------------------------------------------------------------

	it('default settings match expected values', () => {
		const s = createDefaultStateV4();
		expect(s.settings.toneType).toBe('epiano');
		expect(s.settings.sessionLength).toBe(20);
		expect(s.settings.theme).toBe('dark');
		expect(s.settings.activeContent).toBe('intervals');
		expect(s.settings.enabledModes).toEqual({
			ascending: true,
			descending: false,
			harmonic: false,
		});
		expect(s.settings.enabledVoicings).toEqual({
			root: true,
			first: false,
			second: false,
		});
	});

	// --- Global stats --------------------------------------------------------

	it('globalStats are zeroed', () => {
		const s = createDefaultStateV4();
		expect(s.globalStats).toEqual({
			totalSessions: 0,
			totalQuestions: 0,
			currentStreak: 0,
			bestStreak: 0,
			lastPractice: 0,
		});
	});

	// --- Session history -----------------------------------------------------

	it('sessionHistory is empty', () => {
		const s = createDefaultStateV4();
		expect(s.sessionHistory).toEqual([]);
	});
});

// ===========================================================================
// storage — loadStateV4 / saveStateV4
// ===========================================================================

describe('loadStateV4', () => {
	it('returns defaults when storage is empty', () => {
		const loaded = loadStateV4(mockStorage);
		const defaults = createDefaultStateV4();
		expect(loaded).toEqual(defaults);
	});

	it('returns defaults when storage has corrupt JSON', () => {
		store.set('ear-trainer-state', '{{not valid json!!');
		const loaded = loadStateV4(mockStorage);
		expect(loaded.version).toBe(4);
		expect(loaded).toEqual(createDefaultStateV4());
	});

	it('roundtrips: saveStateV4 → loadStateV4 preserves data', () => {
		const state = createDefaultStateV4();
		state.settings.toneType = 'sine';
		state.settings.sessionLength = 30;
		state.globalStats.totalSessions = 42;
		state.stats['interval:P5:ascending'] = {
			...defaultContentStats(),
			attempts: 100,
			correct: 85,
		};

		saveStateV4(state, mockStorage);
		const loaded = loadStateV4(mockStorage);

		expect(loaded.settings.toneType).toBe('sine');
		expect(loaded.settings.sessionLength).toBe(30);
		expect(loaded.globalStats.totalSessions).toBe(42);
		expect(loaded.stats['interval:P5:ascending'].attempts).toBe(100);
		expect(loaded.stats['interval:P5:ascending'].correct).toBe(85);
	});

	it('v3 data → triggers migration and persists v4', () => {
		// Build a minimal v3-shaped object (no version field)
		const v3: any = {
			intervals: {} as any,
			chords: {} as any,
			scales: {} as any,
			modes: {} as any,
			settings: {
				toneType: 'epiano',
				direction: 'ascending',
				sessionLength: 20,
				theme: 'dark',
				enabledModes: { ascending: true, descending: false, harmonic: false },
				enabledVoicings: { root: true, first: false, second: false },
				activeContent: 'intervals',
			},
			stats: {
				totalSessions: 5,
				totalQuestions: 100,
				currentStreak: 2,
				bestStreak: 3,
				lastPractice: 1000,
			},
		};
		for (const def of INTERVALS) {
			v3.intervals[def.id] = {
				unlocked: def.tier === 1,
				enabled: true,
				modes: {
					ascending: { attempts: 0, correct: 0, streak: 0, lastSeen: 0, easeFactor: 2.5, nextReview: 0 },
					descending: { attempts: 0, correct: 0, streak: 0, lastSeen: 0, easeFactor: 2.5, nextReview: 0 },
					harmonic: { attempts: 0, correct: 0, streak: 0, lastSeen: 0, easeFactor: 2.5, nextReview: 0 },
				},
			};
		}
		for (const def of CHORDS) {
			v3.chords[def.id] = { unlocked: def.tier === 1, enabled: true };
		}
		for (const def of SCALES) {
			v3.scales[def.id] = { unlocked: def.tier === 1, enabled: true };
		}
		for (const def of MODES) {
			v3.modes[def.id] = { unlocked: def.tier === 1, enabled: true };
		}

		store.set('ear-trainer-state', JSON.stringify(v3));
		const loaded = loadStateV4(mockStorage);

		// Should be v4 now
		expect(loaded.version).toBe(4);
		expect(loaded.globalStats.totalSessions).toBe(5);

		// Storage should have been updated with v4
		const persisted = JSON.parse(store.get('ear-trainer-state')!);
		expect(persisted.version).toBe(4);
	});
});

describe('saveStateV4', () => {
	it('persists state to storage as JSON', () => {
		const state = createDefaultStateV4();
		saveStateV4(state, mockStorage);
		const raw = store.get('ear-trainer-state');
		expect(raw).toBeDefined();
		const parsed = JSON.parse(raw!);
		expect(parsed.version).toBe(4);
		expect(parsed.settings.toneType).toBe('epiano');
	});

	it('overwrites previous state', () => {
		const s1 = createDefaultStateV4();
		s1.globalStats.totalSessions = 1;
		saveStateV4(s1, mockStorage);

		const s2 = createDefaultStateV4();
		s2.globalStats.totalSessions = 99;
		saveStateV4(s2, mockStorage);

		const parsed = JSON.parse(store.get('ear-trainer-state')!);
		expect(parsed.globalStats.totalSessions).toBe(99);
	});
});

// ===========================================================================
// progression — checkTierUnlockV4
// ===========================================================================

describe('checkTierUnlockV4 — Intervals', () => {
	it('does not unlock tier 2 with insufficient attempts (<10)', () => {
		const state = createDefaultStateV4();
		addV4IntervalStats(state, TIER1_INTERVALS, 9, 9);

		const result = checkTierUnlockV4(state);

		for (const id of TIER2_INTERVALS) {
			expect(result.definitions.intervals[id].unlocked).toBe(false);
		}
	});

	it('does not unlock tier 2 with low accuracy (<70%)', () => {
		const state = createDefaultStateV4();
		addV4IntervalStats(state, TIER1_INTERVALS, 10, 6);

		const result = checkTierUnlockV4(state);

		for (const id of TIER2_INTERVALS) {
			expect(result.definitions.intervals[id].unlocked).toBe(false);
		}
	});

	it('unlocks tier 2 at exactly 10 attempts with ≥70% accuracy', () => {
		const state = createDefaultStateV4();
		addV4IntervalStats(state, TIER1_INTERVALS, 10, 7);

		const result = checkTierUnlockV4(state);

		for (const id of TIER2_INTERVALS) {
			expect(result.definitions.intervals[id].unlocked).toBe(true);
		}
		for (const id of TIER1_INTERVALS) {
			expect(result.definitions.intervals[id].unlocked).toBe(true);
		}
	});

	it('unlocks tier 2 when stats are aggregated across modes', () => {
		const state = createDefaultStateV4();
		// Split: 4 ascending + 3 descending + 3 harmonic = 10
		// Correct: 3 + 2 + 2 = 7 → 70%
		addV4IntervalStats(state, ['P1'], 4, 3, 'ascending');
		addV4IntervalStats(state, ['P5'], 3, 2, 'descending');
		addV4IntervalStats(state, ['P8'], 3, 2, 'harmonic');

		const result = checkTierUnlockV4(state);

		for (const id of TIER2_INTERVALS) {
			expect(result.definitions.intervals[id].unlocked).toBe(true);
		}
	});

	it('chain unlocks multiple tiers at once', () => {
		const state = createDefaultStateV4();
		state.settings.proUnlocked = true; // Pro needed for tier 3-4
		addV4IntervalStats(state, TIER1_INTERVALS, 100, 70);

		const result = checkTierUnlockV4(state);

		for (const id of [...TIER2_INTERVALS, ...TIER3_INTERVALS, ...TIER4_INTERVALS, ...TIER5_INTERVALS]) {
			expect(result.definitions.intervals[id].unlocked).toBe(true);
		}
	});

	it('returns a new object (no mutation)', () => {
		const state = createDefaultStateV4();
		addV4IntervalStats(state, TIER1_INTERVALS, 10, 7);

		const result = checkTierUnlockV4(state);

		expect(result).not.toBe(state);
		expect(result.definitions.intervals['M3'].unlocked).toBe(true);
		expect(state.definitions.intervals['M3'].unlocked).toBe(false);
	});
});

describe('checkTierUnlockV4 — Chords', () => {
	it('does not unlock chord tier 2 with insufficient attempts', () => {
		const state = createDefaultStateV4();
		addV4ChordStats(state, TIER1_CHORDS, 9, 9);

		const result = checkTierUnlockV4(state);

		for (const id of TIER2_CHORDS) {
			expect(result.definitions.chords[id].unlocked).toBe(false);
		}
	});

	it('unlocks chord tier 2 at threshold (aggregating across voicings)', () => {
		const state = createDefaultStateV4();
		state.settings.proUnlocked = true; // Pro needed for chord tier 2+
		addV4ChordStats(state, TIER1_CHORDS, 5, 4, 'root');
		addV4ChordStats(state, TIER1_CHORDS, 3, 2, 'first');
		addV4ChordStats(state, TIER1_CHORDS, 2, 1, 'second');
		// Total: 10 attempts, 7 correct = 70%

		const result = checkTierUnlockV4(state);

		for (const id of TIER2_CHORDS) {
			expect(result.definitions.chords[id].unlocked).toBe(true);
		}
	});

	it('chord unlocks are independent of interval unlocks', () => {
		const state = createDefaultStateV4();
		addV4IntervalStats(state, TIER1_INTERVALS, 10, 7);
		// No chord stats

		const result = checkTierUnlockV4(state);

		for (const id of TIER2_INTERVALS) {
			expect(result.definitions.intervals[id].unlocked).toBe(true);
		}
		for (const id of TIER2_CHORDS) {
			expect(result.definitions.chords[id].unlocked).toBe(false);
		}
	});
});

describe('checkTierUnlockV4 — Scales', () => {
	it('does not unlock scale tier 2 with insufficient attempts', () => {
		const state = createDefaultStateV4();
		addV4ScaleStats(state, TIER1_SCALES, 9, 9);

		const result = checkTierUnlockV4(state);

		for (const id of TIER2_SCALES) {
			expect(result.definitions.scales[id].unlocked).toBe(false);
		}
	});

	it('unlocks scale tier 2 at threshold', () => {
		const state = createDefaultStateV4();
		state.settings.proUnlocked = true; // Pro needed for scale tier 2+
		addV4ScaleStats(state, TIER1_SCALES, 10, 7);

		const result = checkTierUnlockV4(state);

		for (const id of TIER2_SCALES) {
			expect(result.definitions.scales[id].unlocked).toBe(true);
		}
	});
});

describe('checkTierUnlockV4 — Modes', () => {
	it('does not unlock modes when tier 4 scales are locked', () => {
		const state = createDefaultStateV4();
		state.settings.proUnlocked = true; // Pro needed for scale/mode gating
		// Give scale stats but don't unlock all scale tiers
		// With 20 attempts at 70%, tier 2 unlocks (20>=10), but not tier 3 (20<30)
		addV4ScaleStats(state, TIER1_SCALES, 20, 14);

		const result = checkTierUnlockV4(state);

		for (const id of TIER2_SCALES) {
			expect(result.definitions.scales[id].unlocked).toBe(true);
		}
		for (const id of TIER3_SCALES) {
			expect(result.definitions.scales[id].unlocked).toBe(false);
		}
		for (const id of TIER4_SCALES) {
			expect(result.definitions.scales[id].unlocked).toBe(false);
		}
		// Tier 1 modes stay unlocked by default, higher tiers stay locked
		for (const id of ALL_MODE_IDS) {
			if (TIER1_MODES.includes(id)) {
				expect(result.definitions.modes[id].unlocked).toBe(true);
			} else {
				expect(result.definitions.modes[id].unlocked).toBe(false);
			}
		}
	});

	it('does not unlock modes with all scales but insufficient scale attempts', () => {
		const state = createDefaultStateV4();
		// Manually unlock all scales
		for (const id of ALL_SCALE_IDS) {
			state.definitions.scales[id].unlocked = true;
		}
		addV4ScaleStats(state, TIER1_SCALES, 50, 35);

		const result = checkTierUnlockV4(state);

		// Tier 1 modes are unlocked by default, but prerequisite not met (50 < 60)
		// so no tier 2/3 mode unlocks
		for (const id of ALL_MODE_IDS) {
			if (TIER1_MODES.includes(id)) {
				expect(result.definitions.modes[id].unlocked).toBe(true);
			} else {
				expect(result.definitions.modes[id].unlocked).toBe(false);
			}
		}
	});

	it('unlocks tier 1 modes when all scales unlocked + 60 attempts at 70%', () => {
		const state = createDefaultStateV4();
		for (const id of ALL_SCALE_IDS) {
			state.definitions.scales[id].unlocked = true;
		}
		addV4ScaleStats(state, TIER1_SCALES, 60, 42);

		const result = checkTierUnlockV4(state);

		// Tier 1 modes unlocked
		for (const id of TIER1_MODES) {
			expect(result.definitions.modes[id].unlocked).toBe(true);
		}
		// Tier 2+ modes still locked (no mode practice yet)
		for (const id of TIER2_MODES) {
			expect(result.definitions.modes[id].unlocked).toBe(false);
		}
		for (const id of TIER3_MODES) {
			expect(result.definitions.modes[id].unlocked).toBe(false);
		}
	});

	it('unlocks tier 2 modes after 10 mode attempts at 70%', () => {
		const state = createDefaultStateV4();
		state.settings.proUnlocked = true; // Pro needed for modes
		for (const id of ALL_SCALE_IDS) {
			state.definitions.scales[id].unlocked = true;
		}
		addV4ScaleStats(state, TIER1_SCALES, 60, 42);
		// Add mode practice stats
		addV4ModeStats(state, TIER1_MODES, 10, 7);

		const result = checkTierUnlockV4(state);

		for (const id of TIER1_MODES) {
			expect(result.definitions.modes[id].unlocked).toBe(true);
		}
		for (const id of TIER2_MODES) {
			expect(result.definitions.modes[id].unlocked).toBe(true);
		}
		for (const id of TIER3_MODES) {
			expect(result.definitions.modes[id].unlocked).toBe(false);
		}
	});

	it('unlocks all mode tiers after 30 mode attempts at 70%', () => {
		const state = createDefaultStateV4();
		state.settings.proUnlocked = true; // Pro needed for modes
		for (const id of ALL_SCALE_IDS) {
			state.definitions.scales[id].unlocked = true;
		}
		addV4ScaleStats(state, TIER1_SCALES, 60, 42);
		addV4ModeStats(state, TIER1_MODES, 30, 21);

		const result = checkTierUnlockV4(state);

		for (const id of ALL_MODE_IDS) {
			expect(result.definitions.modes[id].unlocked).toBe(true);
		}
	});
});

describe('checkTierUnlockV4 — Edge cases', () => {
	it('already-unlocked definitions stay unlocked', () => {
		const state = createDefaultStateV4();
		for (const id of TIER2_INTERVALS) {
			state.definitions.intervals[id].unlocked = true;
		}

		const result = checkTierUnlockV4(state);

		for (const id of TIER2_INTERVALS) {
			expect(result.definitions.intervals[id].unlocked).toBe(true);
		}
		for (const id of TIER3_INTERVALS) {
			expect(result.definitions.intervals[id].unlocked).toBe(false);
		}
	});
});

// ===========================================================================
// stats helpers
// ===========================================================================

describe('getStats', () => {
	it('returns defaults for missing items', () => {
		const allStats: Record<string, ContentStats> = {};
		const result = getStats(allStats, 'interval:P5:ascending');
		expect(result).toEqual(defaultContentStats());
	});

	it('returns existing stats when present', () => {
		const allStats: Record<string, ContentStats> = {
			'interval:P5:ascending': { ...defaultContentStats(), attempts: 10, correct: 8 },
		};
		const result = getStats(allStats, 'interval:P5:ascending');
		expect(result.attempts).toBe(10);
		expect(result.correct).toBe(8);
	});
});

describe('getAccuracy', () => {
	it('returns 0 when no attempts', () => {
		expect(getAccuracy(defaultContentStats())).toBe(0);
	});

	it('computes correctly', () => {
		const stats = { ...defaultContentStats(), attempts: 10, correct: 7 };
		expect(getAccuracy(stats)).toBeCloseTo(0.7, 5);
	});

	it('returns 1 for perfect accuracy', () => {
		const stats = { ...defaultContentStats(), attempts: 50, correct: 50 };
		expect(getAccuracy(stats)).toBe(1);
	});
});

describe('getStatsByKind', () => {
	it('filters correctly by kind prefix', () => {
		const allStats: Record<string, ContentStats> = {
			'interval:P5:ascending': { ...defaultContentStats(), attempts: 5 },
			'interval:P1:descending': { ...defaultContentStats(), attempts: 3 },
			'chord:maj:root': { ...defaultContentStats(), attempts: 10 },
			'scale:major': { ...defaultContentStats(), attempts: 20 },
		};

		const intervals = getStatsByKind(allStats, 'interval');
		expect(intervals).toHaveLength(2);
		expect(intervals.map(([k]) => k)).toContain('interval:P5:ascending');
		expect(intervals.map(([k]) => k)).toContain('interval:P1:descending');

		const chords = getStatsByKind(allStats, 'chord');
		expect(chords).toHaveLength(1);

		const scales = getStatsByKind(allStats, 'scale');
		expect(scales).toHaveLength(1);

		const modes = getStatsByKind(allStats, 'mode');
		expect(modes).toHaveLength(0);
	});
});

describe('getStatsForDef', () => {
	it('finds all variants for a multi-variant definition', () => {
		const allStats: Record<string, ContentStats> = {
			'interval:P5:ascending': { ...defaultContentStats(), attempts: 5 },
			'interval:P5:descending': { ...defaultContentStats(), attempts: 3 },
			'interval:P5:harmonic': { ...defaultContentStats(), attempts: 2 },
			'interval:P1:ascending': { ...defaultContentStats(), attempts: 10 },
		};

		const p5Stats = getStatsForDef(allStats, 'interval', 'P5');
		expect(p5Stats).toHaveLength(3);
		expect(p5Stats.map(([k]) => k).sort()).toEqual([
			'interval:P5:ascending',
			'interval:P5:descending',
			'interval:P5:harmonic',
		]);
	});

	it('finds exact match for flat keys (no sub-key)', () => {
		const allStats: Record<string, ContentStats> = {
			'scale:major': { ...defaultContentStats(), attempts: 15 },
			'scale:nat_min': { ...defaultContentStats(), attempts: 8 },
		};

		const majorStats = getStatsForDef(allStats, 'scale', 'major');
		expect(majorStats).toHaveLength(1);
		expect(majorStats[0][0]).toBe('scale:major');
		expect(majorStats[0][1].attempts).toBe(15);
	});

	it('returns empty array when no matches', () => {
		const allStats: Record<string, ContentStats> = {
			'interval:P5:ascending': { ...defaultContentStats(), attempts: 5 },
		};
		expect(getStatsForDef(allStats, 'chord', 'maj')).toHaveLength(0);
	});
});

describe('aggregateStats', () => {
	it('sums attempts and correct correctly', () => {
		const entries: [string, ContentStats][] = [
			['interval:P5:ascending', { ...defaultContentStats(), attempts: 10, correct: 8 }],
			['interval:P5:descending', { ...defaultContentStats(), attempts: 5, correct: 3 }],
			['interval:P5:harmonic', { ...defaultContentStats(), attempts: 5, correct: 4 }],
		];

		const result = aggregateStats(entries);
		expect(result.attempts).toBe(20);
		expect(result.correct).toBe(15);
		expect(result.accuracy).toBeCloseTo(0.75, 5);
	});

	it('returns zero for empty entries', () => {
		const result = aggregateStats([]);
		expect(result.attempts).toBe(0);
		expect(result.correct).toBe(0);
		expect(result.accuracy).toBe(0);
	});
});

describe('getOverallAccuracy', () => {
	it('returns overall accuracy across all stats', () => {
		const allStats: Record<string, ContentStats> = {
			'interval:P5:ascending': { ...defaultContentStats(), attempts: 10, correct: 7 },
			'chord:maj:root': { ...defaultContentStats(), attempts: 10, correct: 8 },
		};

		// 20 attempts, 15 correct = 75%
		expect(getOverallAccuracy(allStats)).toBeCloseTo(0.75, 5);
	});

	it('filters by kind when specified', () => {
		const allStats: Record<string, ContentStats> = {
			'interval:P5:ascending': { ...defaultContentStats(), attempts: 10, correct: 7 },
			'chord:maj:root': { ...defaultContentStats(), attempts: 10, correct: 10 },
		};

		expect(getOverallAccuracy(allStats, 'interval')).toBeCloseTo(0.7, 5);
		expect(getOverallAccuracy(allStats, 'chord')).toBeCloseTo(1.0, 5);
	});

	it('returns 0 when no stats exist', () => {
		expect(getOverallAccuracy({})).toBe(0);
		expect(getOverallAccuracy({}, 'interval')).toBe(0);
	});
});
