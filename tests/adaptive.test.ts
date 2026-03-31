// tests/adaptive.test.ts — Snapshot tests for the unified adaptive engine (Phase 0)
// Captures existing behavior BEFORE any refactor.

import { describe, it, expect } from 'vitest';
import {
	buildAllItems,
	pickNextItem,
	planSession,
	recordAdaptiveAnswer,
	migrateToAdaptive,
	defaultContentStats,
	findNeighbor,
	needsLearnCard,
	isColdStart,
	buildColdStartIntro,
	getItemDisplayName,
	getItemLabel,
	type ContentItem,
	type ContentStats,
	type SessionConfig,
} from '../src/lib/adaptive';
import { createDefaultState } from '../src/lib/state';

// ---------------------------------------------------------------------------
// buildAllItems
// ---------------------------------------------------------------------------

describe('buildAllItems', () => {
	it('only includes unlocked AND enabled items', () => {
		const state = createDefaultState();
		const items = buildAllItems(state);

		// Tier 1 intervals: P1, P5, P8 — all unlocked + enabled by default
		// Default enabledModes: ascending=true, descending=true, harmonic=true → 3×3=9
		const intervalItems = items.filter(i => i.kind === 'interval');
		expect(intervalItems.length).toBe(9);

		// Disable an interval — it should disappear
		state.intervals['P5'].enabled = false;
		const items2 = buildAllItems(state);
		const intervalItems2 = items2.filter(i => i.kind === 'interval');
		expect(intervalItems2.length).toBe(6); // P1 + P8 only

		// Locked interval shouldn't appear (M3 is tier 2, locked by default)
		const hasM3 = items.some(i => i.defId === 'M3');
		expect(hasM3).toBe(false);
	});

	it('respects enabledModes — ascending only → no descending/harmonic', () => {
		const state = createDefaultState();
		state.settings.enabledModes.descending = false;
		state.settings.enabledModes.harmonic = false;

		const items = buildAllItems(state);
		const intervalItems = items.filter(i => i.kind === 'interval');

		expect(intervalItems.length).toBe(3); // P1, P5, P8 ascending only
		expect(intervalItems.every(i => i.variant === 'ascending')).toBe(true);
		expect(intervalItems.some(i => i.variant === 'descending')).toBe(false);
		expect(intervalItems.some(i => i.variant === 'harmonic')).toBe(false);
	});

	it('respects enabledVoicings — root only → no first/second chord items', () => {
		const state = createDefaultState();
		// Default: root=true, first=false, second=false
		const items = buildAllItems(state);
		const chordItems = items.filter(i => i.kind === 'chord');

		// Tier 1 chords: maj, min — root only = 2
		expect(chordItems.length).toBe(2);
		expect(chordItems.every(i => i.variant === 'root')).toBe(true);

		// Enable first inversion
		state.settings.enabledVoicings.first = true;
		const items2 = buildAllItems(state);
		const chordItems2 = items2.filter(i => i.kind === 'chord');
		expect(chordItems2.length).toBe(4); // 2 chords × 2 voicings
		expect(chordItems2.some(i => i.variant === 'first')).toBe(true);
	});

	it('includes scales (flat, no variant)', () => {
		const state = createDefaultState();
		const items = buildAllItems(state);
		const scaleItems = items.filter(i => i.kind === 'scale');

		// Tier 1 scales: major, nat_min, maj_pent
		expect(scaleItems.length).toBe(3);
		expect(scaleItems.every(i => i.variant === undefined)).toBe(true);
		expect(scaleItems.map(i => i.defId).sort()).toEqual(['maj_pent', 'major', 'nat_min']);
	});

	it('includes modes only if unlocked', () => {
		const state = createDefaultState();
		const items = buildAllItems(state);

		// By default, tier 1 modes (ionian, aeolian) are unlocked
		const modeItems = items.filter(i => i.kind === 'mode');
		expect(modeItems.length).toBe(2);
		expect(modeItems.map(i => i.defId).sort()).toEqual(['aeolian', 'ionian']);

		// Manually unlock dorian
		state.modes!['dorian'].unlocked = true;
		const items2 = buildAllItems(state);
		const modeItems2 = items2.filter(i => i.kind === 'mode');
		expect(modeItems2.length).toBe(3);
		expect(modeItems2.some(i => i.defId === 'dorian')).toBe(true);
	});

	it('returns correct ContentItem shape (kind, id, defId, variant, tier)', () => {
		const state = createDefaultState();
		const items = buildAllItems(state);

		// Interval shape
		const p5asc = items.find(i => i.id === 'interval:P5:ascending');
		expect(p5asc).toBeDefined();
		expect(p5asc!.kind).toBe('interval');
		expect(p5asc!.defId).toBe('P5');
		expect(p5asc!.variant).toBe('ascending');
		expect(p5asc!.tier).toBe(1);

		// Chord shape
		const majRoot = items.find(i => i.id === 'chord:maj:root');
		expect(majRoot).toBeDefined();
		expect(majRoot!.kind).toBe('chord');
		expect(majRoot!.defId).toBe('maj');
		expect(majRoot!.variant).toBe('root');
		expect(majRoot!.tier).toBe(1);
		expect(majRoot!.category).toBe('triad');

		// Scale shape
		const majorScale = items.find(i => i.id === 'scale:major');
		expect(majorScale).toBeDefined();
		expect(majorScale!.kind).toBe('scale');
		expect(majorScale!.defId).toBe('major');
		expect(majorScale!.variant).toBeUndefined();
		expect(majorScale!.tier).toBe(1);
		expect(majorScale!.category).toBe('diatonic');

		// Mode shape
		const ionian = items.find(i => i.id === 'mode:ionian');
		expect(ionian).toBeDefined();
		expect(ionian!.kind).toBe('mode');
		expect(ionian!.defId).toBe('ionian');
		expect(ionian!.variant).toBeUndefined();
		expect(ionian!.tier).toBe(1);
		expect(ionian!.category).toBe('mode');
	});
});

// ---------------------------------------------------------------------------
// pickNextItem
// ---------------------------------------------------------------------------

describe('pickNextItem', () => {
	it('returns an item from the provided list', () => {
		const items: ContentItem[] = [
			{ kind: 'interval', id: 'interval:P5:ascending', defId: 'P5', variant: 'ascending', tier: 1 },
			{ kind: 'interval', id: 'interval:P8:ascending', defId: 'P8', variant: 'ascending', tier: 1 },
		];

		const picked = pickNextItem(items, {});
		expect(items.some(i => i.id === picked.id)).toBe(true);
	});

	it('with empty stats, still returns an item (new boost)', () => {
		const items: ContentItem[] = [
			{ kind: 'interval', id: 'interval:P1:ascending', defId: 'P1', variant: 'ascending', tier: 1 },
		];

		const picked = pickNextItem(items, {});
		expect(picked.id).toBe('interval:P1:ascending');
	});

	it('favors items with low accuracy over high accuracy (500+ iterations)', () => {
		const items: ContentItem[] = [
			{ kind: 'interval', id: 'interval:P5:ascending', defId: 'P5', variant: 'ascending', tier: 1 },
			{ kind: 'interval', id: 'interval:P8:ascending', defId: 'P8', variant: 'ascending', tier: 1 },
		];

		const stats: Record<string, ContentStats> = {
			'interval:P5:ascending': { ...defaultContentStats(), attempts: 100, correct: 95 },
			'interval:P8:ascending': { ...defaultContentStats(), attempts: 100, correct: 30 },
		};

		let p8Count = 0;
		const iterations = 500;
		for (let i = 0; i < iterations; i++) {
			const picked = pickNextItem(items, stats);
			if (picked.id === 'interval:P8:ascending') p8Count++;
		}

		// P8 (30% accuracy) should be picked significantly more than P5 (95% accuracy)
		expect(p8Count).toBeGreaterThan(iterations * 0.55);
	});

	it('favors overdue items (nextReview in the past)', () => {
		const now = Date.now();
		const items: ContentItem[] = [
			{ kind: 'interval', id: 'interval:P5:ascending', defId: 'P5', variant: 'ascending', tier: 1 },
			{ kind: 'interval', id: 'interval:P8:ascending', defId: 'P8', variant: 'ascending', tier: 1 },
		];

		const stats: Record<string, ContentStats> = {
			// P5: reviewed recently, not overdue
			'interval:P5:ascending': {
				...defaultContentStats(),
				attempts: 50, correct: 25,
				nextReview: now + 24 * 60 * 60 * 1000, // 1 day in the future
			},
			// P8: overdue by 2 days
			'interval:P8:ascending': {
				...defaultContentStats(),
				attempts: 50, correct: 25,
				nextReview: now - 2 * 24 * 60 * 60 * 1000, // 2 days in the past
			},
		};

		let p8Count = 0;
		const iterations = 500;
		for (let i = 0; i < iterations; i++) {
			const picked = pickNextItem(items, stats);
			if (picked.id === 'interval:P8:ascending') p8Count++;
		}

		// Overdue P8 should be favored
		expect(p8Count).toBeGreaterThan(iterations * 0.55);
	});

	it('throws on empty items', () => {
		expect(() => pickNextItem([], {})).toThrow('No items available');
	});
});

// ---------------------------------------------------------------------------
// findNeighbor
// ---------------------------------------------------------------------------

describe('findNeighbor', () => {
	const makeIntervalItem = (defId: string, variant: string = 'ascending'): ContentItem => ({
		kind: 'interval',
		id: `interval:${defId}:${variant}`,
		defId,
		variant,
		tier: 1,
	});

	it('returns null when no items have been practiced (all stats have 0 attempts)', () => {
		const newItem = makeIntervalItem('P5');
		const allItems = [makeIntervalItem('P1'), makeIntervalItem('P5'), makeIntervalItem('P8')];
		const stats: Record<string, ContentStats> = {
			'interval:P1:ascending': defaultContentStats(),
			'interval:P8:ascending': defaultContentStats(),
		};

		const neighbor = findNeighbor(newItem, allItems, stats);
		expect(neighbor).toBeNull();
	});

	it('returns a practiced item when one exists', () => {
		const newItem = makeIntervalItem('P5');
		const allItems = [makeIntervalItem('P1'), makeIntervalItem('P5'), makeIntervalItem('P8')];
		const stats: Record<string, ContentStats> = {
			'interval:P1:ascending': { ...defaultContentStats(), attempts: 5, correct: 3 },
			'interval:P8:ascending': defaultContentStats(),
		};

		const neighbor = findNeighbor(newItem, allItems, stats);
		expect(neighbor).not.toBeNull();
		expect(neighbor!.id).toBe('interval:P1:ascending');
	});

	it('prefers different defId over same defId', () => {
		const newItem = makeIntervalItem('P5', 'ascending');
		const allItems = [
			makeIntervalItem('P5', 'ascending'),
			makeIntervalItem('P5', 'descending'),
			makeIntervalItem('P4', 'ascending'),
		];

		const stats: Record<string, ContentStats> = {
			// Both practiced
			'interval:P5:descending': { ...defaultContentStats(), attempts: 10, correct: 8 },
			'interval:P4:ascending': { ...defaultContentStats(), attempts: 10, correct: 8 },
		};

		const neighbor = findNeighbor(newItem, allItems, stats);
		expect(neighbor).not.toBeNull();
		// P4 is a different defId, should be preferred over P5:descending (same defId)
		expect(neighbor!.defId).toBe('P4');
	});

	it('returns musically close items (for intervals: close in semitones)', () => {
		const newItem = makeIntervalItem('P5'); // semitones: 7
		const allItems = [
			makeIntervalItem('P5'),
			makeIntervalItem('P4'),  // semitones: 5 — close
			makeIntervalItem('m2'),  // semitones: 1 — far
		];

		const stats: Record<string, ContentStats> = {
			'interval:P4:ascending': { ...defaultContentStats(), attempts: 10, correct: 8 },
			'interval:m2:ascending': { ...defaultContentStats(), attempts: 10, correct: 8 },
		};

		const neighbor = findNeighbor(newItem, allItems, stats);
		expect(neighbor).not.toBeNull();
		// P4 (5 semitones) is closer to P5 (7 semitones) than m2 (1 semitone)
		expect(neighbor!.defId).toBe('P4');
	});
});

// ---------------------------------------------------------------------------
// needsLearnCard
// ---------------------------------------------------------------------------

describe('needsLearnCard', () => {
	it('returns false when onboardMode is not set (disabled by default)', () => {
		const stats: Record<string, ContentStats> = {};
		expect(needsLearnCard('interval:P5:ascending', stats)).toBe(false);
		expect(needsLearnCard('interval:P5:ascending', stats, false)).toBe(false);
		expect(needsLearnCard('interval:P5:ascending', stats, false, false)).toBe(false);
	});

	it('returns false for items with attempts > 0 even with onboardMode', () => {
		const stats: Record<string, ContentStats> = {
			'interval:P5:ascending': { ...defaultContentStats(), attempts: 3, correct: 2 },
		};
		expect(needsLearnCard('interval:P5:ascending', stats, false, true)).toBe(false);
	});

	it('returns true for unpracticed items when onboardMode is true', () => {
		const stats: Record<string, ContentStats> = {};
		expect(needsLearnCard('interval:P5:ascending', stats, false, true)).toBe(true);

		// Also true when stats entry exists but attempts=0
		const stats2: Record<string, ContentStats> = {
			'interval:P5:ascending': defaultContentStats(),
		};
		expect(needsLearnCard('interval:P5:ascending', stats2, false, true)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// recordAdaptiveAnswer
// ---------------------------------------------------------------------------

describe('recordAdaptiveAnswer', () => {
	it('creates adaptive state if it doesn\'t exist', () => {
		const state = createDefaultState();
		delete (state as any).adaptive;

		recordAdaptiveAnswer(state, 'interval:P5:ascending', {
			correct: true, replays: 0, responseTimeMs: 2000,
		});

		expect(state.adaptive).toBeDefined();
		expect(state.adaptive!.stats['interval:P5:ascending'].attempts).toBe(1);
	});

	it('creates stats entry for new itemId', () => {
		const state = createDefaultState();
		state.adaptive = { stats: {}, sessionHistory: [], lastSessionDate: 0 };

		recordAdaptiveAnswer(state, 'interval:P5:ascending', {
			correct: true, replays: 0, responseTimeMs: 2000,
		});

		expect(state.adaptive.stats['interval:P5:ascending']).toBeDefined();
		expect(state.adaptive.stats['interval:P5:ascending'].attempts).toBe(1);
	});

	it('updates attempts, correct, streak on correct answer', () => {
		const state = createDefaultState();
		state.adaptive = { stats: {}, sessionHistory: [], lastSessionDate: 0 };

		recordAdaptiveAnswer(state, 'interval:P5:ascending', {
			correct: true, replays: 0, responseTimeMs: 2000,
		});
		recordAdaptiveAnswer(state, 'interval:P5:ascending', {
			correct: true, replays: 0, responseTimeMs: 2000,
		});

		const s = state.adaptive.stats['interval:P5:ascending'];
		expect(s.attempts).toBe(2);
		expect(s.correct).toBe(2);
		expect(s.streak).toBe(2);
	});

	it('resets streak on incorrect answer', () => {
		const state = createDefaultState();
		state.adaptive = { stats: {}, sessionHistory: [], lastSessionDate: 0 };

		// Build a streak
		recordAdaptiveAnswer(state, 'interval:P5:ascending', {
			correct: true, replays: 0, responseTimeMs: 2000,
		});
		recordAdaptiveAnswer(state, 'interval:P5:ascending', {
			correct: true, replays: 0, responseTimeMs: 2000,
		});
		expect(state.adaptive.stats['interval:P5:ascending'].streak).toBe(2);

		// Wrong answer
		recordAdaptiveAnswer(state, 'interval:P5:ascending', {
			correct: false, replays: 0, responseTimeMs: 2000,
		});

		const s = state.adaptive.stats['interval:P5:ascending'];
		expect(s.attempts).toBe(3);
		expect(s.correct).toBe(2);
		expect(s.streak).toBe(0);
	});

	it('updates easeFactor and nextReview via SM-2', () => {
		const state = createDefaultState();
		state.adaptive = { stats: {}, sessionHistory: [], lastSessionDate: 0 };

		// Correct, fast answer → quality 5
		recordAdaptiveAnswer(state, 'interval:P5:ascending', {
			correct: true, replays: 0, responseTimeMs: 2000,
		});

		const s = state.adaptive.stats['interval:P5:ascending'];
		// Default easeFactor is 2.5, quality 5 → new EF = 2.5 + 0.1 = 2.6
		expect(s.easeFactor).toBeCloseTo(2.6, 1);
		expect(s.nextReview).toBeGreaterThan(0);

		// Wrong answer → quality 1 → EF should decrease
		const efBefore = s.easeFactor;
		recordAdaptiveAnswer(state, 'interval:P5:ascending', {
			correct: false, replays: 0, responseTimeMs: 2000,
		});
		expect(s.easeFactor).toBeLessThan(efBefore);
		// Wrong answer (quality < 3) → intervalDays ~0.0007 → very short review
		expect(s.nextReview).toBeGreaterThan(0);
	});

	it('dual-writes to legacy interval state', () => {
		const state = createDefaultState();
		state.adaptive = { stats: {}, sessionHistory: [], lastSessionDate: 0 };

		recordAdaptiveAnswer(state, 'interval:P5:ascending', {
			correct: true, replays: 0, responseTimeMs: 2000,
		});

		const legacy = state.intervals['P5'].modes.ascending;
		expect(legacy.attempts).toBe(1);
		expect(legacy.correct).toBe(1);
		expect(legacy.streak).toBe(1);
		expect(legacy.easeFactor).toBeGreaterThan(2.5);
		expect(legacy.nextReview).toBeGreaterThan(0);
	});

	it('dual-writes to legacy chord state', () => {
		const state = createDefaultState();
		state.adaptive = { stats: {}, sessionHistory: [], lastSessionDate: 0 };

		recordAdaptiveAnswer(state, 'chord:maj:root', {
			correct: true, replays: 0, responseTimeMs: 2000,
		});

		const legacy = state.chords['maj'].voicings.root;
		expect(legacy.attempts).toBe(1);
		expect(legacy.correct).toBe(1);
		expect(legacy.streak).toBe(1);
		expect(legacy.easeFactor).toBeGreaterThan(2.5);
		expect(legacy.nextReview).toBeGreaterThan(0);
	});

	it('dual-writes to legacy scale state', () => {
		const state = createDefaultState();
		state.adaptive = { stats: {}, sessionHistory: [], lastSessionDate: 0 };

		recordAdaptiveAnswer(state, 'scale:major', {
			correct: true, replays: 0, responseTimeMs: 2000,
		});

		const legacy = state.scales['major'];
		expect(legacy.attempts).toBe(1);
		expect(legacy.correct).toBe(1);
		expect(legacy.streak).toBe(1);
		expect(legacy.easeFactor).toBeGreaterThan(2.5);
		expect(legacy.nextReview).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// migrateToAdaptive
// ---------------------------------------------------------------------------

describe('migrateToAdaptive', () => {
	it('creates adaptive stats from legacy interval per-mode data', () => {
		const state = createDefaultState();
		state.intervals['P5'].modes.ascending.attempts = 10;
		state.intervals['P5'].modes.ascending.correct = 8;
		state.intervals['P5'].modes.descending.attempts = 5;
		state.intervals['P5'].modes.descending.correct = 3;

		const migrated = migrateToAdaptive(state);
		expect(migrated.adaptive).toBeDefined();

		const ascStats = migrated.adaptive!.stats['interval:P5:ascending'];
		expect(ascStats.attempts).toBe(10);
		expect(ascStats.correct).toBe(8);

		const descStats = migrated.adaptive!.stats['interval:P5:descending'];
		expect(descStats.attempts).toBe(5);
		expect(descStats.correct).toBe(3);
	});

	it('creates adaptive stats from legacy chord per-voicing data', () => {
		const state = createDefaultState();
		state.chords['maj'].voicings.root.attempts = 5;
		state.chords['maj'].voicings.root.correct = 4;
		state.chords['maj'].voicings.first.attempts = 3;
		state.chords['maj'].voicings.first.correct = 1;

		const migrated = migrateToAdaptive(state);

		const rootStats = migrated.adaptive!.stats['chord:maj:root'];
		expect(rootStats.attempts).toBe(5);
		expect(rootStats.correct).toBe(4);

		const firstStats = migrated.adaptive!.stats['chord:maj:first'];
		expect(firstStats.attempts).toBe(3);
		expect(firstStats.correct).toBe(1);
	});

	it('creates adaptive stats from legacy scale flat data', () => {
		const state = createDefaultState();
		state.scales['major'].attempts = 15;
		state.scales['major'].correct = 12;

		const migrated = migrateToAdaptive(state);

		const s = migrated.adaptive!.stats['scale:major'];
		expect(s.attempts).toBe(15);
		expect(s.correct).toBe(12);
	});

	it('populates relatedItems via connections', () => {
		const state = createDefaultState();
		state.intervals['M3'].modes.ascending.attempts = 10;
		state.intervals['M3'].modes.ascending.correct = 8;

		const migrated = migrateToAdaptive(state);
		const s = migrated.adaptive!.stats['interval:M3:ascending'];
		// M3 connects to chord:maj, chord:aug via CURATED_CONNECTIONS
		expect(s.relatedItems.length).toBeGreaterThan(0);
		// Should include chord:maj variants
		expect(s.relatedItems.some(r => r.startsWith('chord:maj:'))).toBe(true);
	});

	it('returns same object if adaptive already exists (no re-migration)', () => {
		const state = createDefaultState();
		const first = migrateToAdaptive(state);
		const second = migrateToAdaptive(first);
		expect(second).toBe(first); // same reference
	});
});

// ---------------------------------------------------------------------------
// isColdStart
// ---------------------------------------------------------------------------

describe('isColdStart', () => {
	it('returns true when all stats have 0 attempts', () => {
		const stats: Record<string, ContentStats> = {
			'interval:P5:ascending': defaultContentStats(),
			'interval:P1:ascending': defaultContentStats(),
		};
		expect(isColdStart(stats)).toBe(true);
	});

	it('returns true when stats is empty', () => {
		expect(isColdStart({})).toBe(true);
	});

	it('returns false when any stat has attempts > 0', () => {
		const stats: Record<string, ContentStats> = {
			'interval:P5:ascending': { ...defaultContentStats(), attempts: 1, correct: 1 },
			'interval:P1:ascending': defaultContentStats(),
		};
		expect(isColdStart(stats)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// buildColdStartIntro
// ---------------------------------------------------------------------------

describe('buildColdStartIntro', () => {
	it('returns ContentItems for P1, P8, P5 in that order', () => {
		const intro = buildColdStartIntro();
		expect(intro.length).toBe(3);
		expect(intro[0].defId).toBe('P1');
		expect(intro[1].defId).toBe('P8');
		expect(intro[2].defId).toBe('P5');
	});

	it('all items are kind=interval, variant=ascending', () => {
		const intro = buildColdStartIntro();
		for (const item of intro) {
			expect(item.kind).toBe('interval');
			expect(item.variant).toBe('ascending');
			expect(item.id).toBe(`interval:${item.defId}:ascending`);
		}
	});

	it('items have correct tiers from INTERVALS definitions', () => {
		const intro = buildColdStartIntro();
		// P1, P8, P5 are all tier 1
		for (const item of intro) {
			expect(item.tier).toBe(1);
		}
	});
});

// ---------------------------------------------------------------------------
// getItemDisplayName
// ---------------------------------------------------------------------------

describe('getItemDisplayName', () => {
	it('returns correct names for interval items', () => {
		expect(getItemDisplayName({ kind: 'interval', id: 'interval:P5:ascending', defId: 'P5', variant: 'ascending', tier: 1 }))
			.toBe('Perfect 5th');
		expect(getItemDisplayName({ kind: 'interval', id: 'interval:P1:ascending', defId: 'P1', variant: 'ascending', tier: 1 }))
			.toBe('Unison');
		expect(getItemDisplayName({ kind: 'interval', id: 'interval:P8:ascending', defId: 'P8', variant: 'ascending', tier: 1 }))
			.toBe('Octave');
		expect(getItemDisplayName({ kind: 'interval', id: 'interval:TT:ascending', defId: 'TT', variant: 'ascending', tier: 5 }))
			.toBe('Tritone');
	});

	it('returns correct names for chord items', () => {
		expect(getItemDisplayName({ kind: 'chord', id: 'chord:maj:root', defId: 'maj', variant: 'root', tier: 1 }))
			.toBe('Major');
		expect(getItemDisplayName({ kind: 'chord', id: 'chord:min:root', defId: 'min', variant: 'root', tier: 1 }))
			.toBe('Minor');
		expect(getItemDisplayName({ kind: 'chord', id: 'chord:dom7:root', defId: 'dom7', variant: 'root', tier: 3 }))
			.toBe('Dominant 7th');
	});

	it('returns correct names for scale items', () => {
		expect(getItemDisplayName({ kind: 'scale', id: 'scale:major', defId: 'major', tier: 1 }))
			.toBe('Major');
		expect(getItemDisplayName({ kind: 'scale', id: 'scale:blues', defId: 'blues', tier: 3 }))
			.toBe('Blues');
		expect(getItemDisplayName({ kind: 'scale', id: 'scale:nat_min', defId: 'nat_min', tier: 1 }))
			.toBe('Natural Minor');
	});

	it('returns correct names for mode items', () => {
		expect(getItemDisplayName({ kind: 'mode', id: 'mode:ionian', defId: 'ionian', tier: 1 }))
			.toBe('Ionian (Major)');
		expect(getItemDisplayName({ kind: 'mode', id: 'mode:dorian', defId: 'dorian', tier: 2 }))
			.toBe('Dorian');
	});

	it('falls back to defId for unknown items', () => {
		expect(getItemDisplayName({ kind: 'interval', id: 'interval:XYZ:ascending', defId: 'XYZ', variant: 'ascending', tier: 1 }))
			.toBe('XYZ');
	});
});

// ---------------------------------------------------------------------------
// getItemLabel
// ---------------------------------------------------------------------------

describe('getItemLabel', () => {
	it('returns defId for interval items', () => {
		expect(getItemLabel({ kind: 'interval', id: 'interval:P5:ascending', defId: 'P5', variant: 'ascending', tier: 1 }))
			.toBe('P5');
		expect(getItemLabel({ kind: 'interval', id: 'interval:m3:ascending', defId: 'm3', variant: 'ascending', tier: 3 }))
			.toBe('m3');
	});

	it('returns correct labels for chord items', () => {
		expect(getItemLabel({ kind: 'chord', id: 'chord:maj:root', defId: 'maj', variant: 'root', tier: 1 }))
			.toBe('Maj');
		expect(getItemLabel({ kind: 'chord', id: 'chord:min:root', defId: 'min', variant: 'root', tier: 1 }))
			.toBe('Min');
		expect(getItemLabel({ kind: 'chord', id: 'chord:dom7:root', defId: 'dom7', variant: 'root', tier: 3 }))
			.toBe('Dom7');
	});

	it('returns correct labels for scale items', () => {
		expect(getItemLabel({ kind: 'scale', id: 'scale:major', defId: 'major', tier: 1 }))
			.toBe('Maj');
		expect(getItemLabel({ kind: 'scale', id: 'scale:blues', defId: 'blues', tier: 3 }))
			.toBe('Blu');
		expect(getItemLabel({ kind: 'scale', id: 'scale:nat_min', defId: 'nat_min', tier: 1 }))
			.toBe('Min');
	});

	it('returns correct labels for mode items', () => {
		expect(getItemLabel({ kind: 'mode', id: 'mode:ionian', defId: 'ionian', tier: 1 }))
			.toBe('Ion');
		expect(getItemLabel({ kind: 'mode', id: 'mode:dorian', defId: 'dorian', tier: 2 }))
			.toBe('Dor');
	});
});

// ---------------------------------------------------------------------------
// planSession
// ---------------------------------------------------------------------------

describe('planSession', () => {
	it('creates a session plan with correct length', () => {
		const state = createDefaultState();
		state.adaptive = { stats: {}, sessionHistory: [], lastSessionDate: 0 };

		const config: SessionConfig = {
			length: 10,
			allowedKinds: ['interval', 'chord', 'scale'],
			mixStrategy: 'adaptive',
		};

		const plan = planSession(state, config);
		expect(plan.questions.length).toBe(10);
	});

	it('includes warmup, focus, and review phases', () => {
		const state = createDefaultState();
		state.adaptive = { stats: {}, sessionHistory: [], lastSessionDate: 0 };

		const config: SessionConfig = {
			length: 20,
			allowedKinds: ['interval'],
			mixStrategy: 'adaptive',
		};

		const plan = planSession(state, config);
		const phases = new Set(plan.questions.map(q => q.phase));
		expect(phases.has('warmup')).toBe(true);
		expect(phases.has('focus')).toBe(true);
		expect(phases.has('review')).toBe(true);
	});

	it('generates summary text', () => {
		const state = createDefaultState();
		state.adaptive = { stats: {}, sessionHistory: [], lastSessionDate: 0 };

		const config: SessionConfig = {
			length: 10,
			allowedKinds: ['interval', 'scale'],
			mixStrategy: 'adaptive',
		};

		const plan = planSession(state, config);
		expect(plan.summary).toBeTruthy();
		expect(typeof plan.summary).toBe('string');
	});

	it('returns empty plan when no content is unlocked', () => {
		const state = createDefaultState();
		for (const s of Object.values(state.intervals)) s.unlocked = false;
		for (const s of Object.values(state.chords)) s.unlocked = false;
		for (const s of Object.values(state.scales)) s.unlocked = false;
		if (state.modes) for (const s of Object.values(state.modes)) s.unlocked = false;

		const config: SessionConfig = {
			length: 20,
			allowedKinds: [],
			mixStrategy: 'adaptive',
		};

		const plan = planSession(state, config);
		expect(plan.questions.length).toBe(0);
		expect(plan.summary).toContain('No content unlocked');
	});
});

// ---------------------------------------------------------------------------
// defaultContentStats
// ---------------------------------------------------------------------------

describe('defaultContentStats', () => {
	it('returns expected default values', () => {
		const s = defaultContentStats();
		expect(s.attempts).toBe(0);
		expect(s.correct).toBe(0);
		expect(s.streak).toBe(0);
		expect(s.lastSeen).toBe(0);
		expect(s.easeFactor).toBe(2.5);
		expect(s.nextReview).toBe(0);
		expect(s.relatedItems).toEqual([]);
	});
});
