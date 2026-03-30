// tests/adaptive.test.ts — Tests for the unified adaptive engine

import { describe, it, expect } from 'vitest';
import {
	buildAllItems,
	pickNextItem,
	planSession,
	recordAdaptiveAnswer,
	migrateToAdaptive,
	defaultContentStats,
	type ContentItem,
	type ContentStats,
	type SessionConfig,
} from '../src/lib/adaptive';
import { createDefaultState } from '../src/lib/state';

describe('buildAllItems', () => {
	it('returns items for all unlocked intervals × enabled modes', () => {
		const state = createDefaultState();
		const items = buildAllItems(state);

		// Tier 1 intervals: P1, P5, P8 (3 intervals × 3 modes = 9)
		const intervalItems = items.filter(i => i.kind === 'interval');
		expect(intervalItems.length).toBe(9);
		expect(intervalItems.every(i => i.variant !== undefined)).toBe(true);
	});

	it('returns items for unlocked chords × enabled voicings', () => {
		const state = createDefaultState();
		const items = buildAllItems(state);

		// Tier 1 chords: maj, min (2 chords × 1 voicing [root only] = 2)
		const chordItems = items.filter(i => i.kind === 'chord');
		expect(chordItems.length).toBe(2); // root voicing only (first/second disabled by default)
	});

	it('returns items for unlocked scales', () => {
		const state = createDefaultState();
		const items = buildAllItems(state);

		// Tier 1 scales: major, nat_min, maj_pent (3 scales)
		const scaleItems = items.filter(i => i.kind === 'scale');
		expect(scaleItems.length).toBe(3);
	});

	it('respects enabled modes setting', () => {
		const state = createDefaultState();
		state.settings.enabledModes.descending = false;
		state.settings.enabledModes.harmonic = false;

		const items = buildAllItems(state);
		const intervalItems = items.filter(i => i.kind === 'interval');

		// Only ascending mode enabled → 3 intervals × 1 mode = 3
		expect(intervalItems.length).toBe(3);
		expect(intervalItems.every(i => i.variant === 'ascending')).toBe(true);
	});

	it('uses composite ids', () => {
		const state = createDefaultState();
		const items = buildAllItems(state);

		const p5asc = items.find(i => i.id === 'interval:P5:ascending');
		expect(p5asc).toBeDefined();
		expect(p5asc!.defId).toBe('P5');
		expect(p5asc!.variant).toBe('ascending');
		expect(p5asc!.kind).toBe('interval');

		const majRoot = items.find(i => i.id === 'chord:maj:root');
		expect(majRoot).toBeDefined();

		const majorScale = items.find(i => i.id === 'scale:major');
		expect(majorScale).toBeDefined();
	});
});

describe('pickNextItem', () => {
	it('picks from available items', () => {
		const items: ContentItem[] = [
			{ kind: 'interval', id: 'interval:P5:ascending', defId: 'P5', variant: 'ascending', tier: 1 },
			{ kind: 'interval', id: 'interval:P8:ascending', defId: 'P8', variant: 'ascending', tier: 1 },
		];
		const stats: Record<string, ContentStats> = {};

		const picked = pickNextItem(items, stats);
		expect(items.some(i => i.id === picked.id)).toBe(true);
	});

	it('favors weak items', () => {
		const items: ContentItem[] = [
			{ kind: 'interval', id: 'interval:P5:ascending', defId: 'P5', variant: 'ascending', tier: 1 },
			{ kind: 'interval', id: 'interval:P8:ascending', defId: 'P8', variant: 'ascending', tier: 1 },
		];

		const stats: Record<string, ContentStats> = {
			'interval:P5:ascending': { ...defaultContentStats(), attempts: 100, correct: 95 },
			'interval:P8:ascending': { ...defaultContentStats(), attempts: 100, correct: 30 },
		};

		// Run many picks and check that weak item (P8) is picked more often
		let p8Count = 0;
		for (let i = 0; i < 200; i++) {
			const picked = pickNextItem(items, stats);
			if (picked.id === 'interval:P8:ascending') p8Count++;
		}

		// P8 should be picked significantly more than 50% of the time
		expect(p8Count).toBeGreaterThan(100);
	});

	it('boosts new items', () => {
		const items: ContentItem[] = [
			{ kind: 'interval', id: 'interval:P5:ascending', defId: 'P5', variant: 'ascending', tier: 1 },
			{ kind: 'interval', id: 'interval:P8:ascending', defId: 'P8', variant: 'ascending', tier: 1 },
		];

		const stats: Record<string, ContentStats> = {
			'interval:P5:ascending': { ...defaultContentStats(), attempts: 50, correct: 45 },
			// P8 has no stats → new boost applies
		};

		let p8Count = 0;
		for (let i = 0; i < 200; i++) {
			const picked = pickNextItem(items, stats);
			if (picked.id === 'interval:P8:ascending') p8Count++;
		}

		// New item should be picked more often
		expect(p8Count).toBeGreaterThan(80);
	});

	it('throws on empty items', () => {
		expect(() => pickNextItem([], {})).toThrow('No items available');
	});
});

describe('planSession', () => {
	it('creates a session plan with correct length', () => {
		const state = createDefaultState();
		state.adaptive = { stats: {}, sessionHistory: [], lastSessionDate: 0 };

		// Use a length that fits within the available items
		const config: SessionConfig = {
			length: 10,
			allowedKinds: ['interval', 'chord', 'scale'],
			mixStrategy: 'adaptive',
		};

		const plan = planSession(state, config);
		expect(plan.questions.length).toBe(10);
	});

	it('includes warmup phase at the start', () => {
		const state = createDefaultState();
		state.adaptive = { stats: {}, sessionHistory: [], lastSessionDate: 0 };

		const config: SessionConfig = {
			length: 20,
			allowedKinds: ['interval'],
			mixStrategy: 'adaptive',
		};

		const plan = planSession(state, config);
		const warmups = plan.questions.filter(q => q.phase === 'warmup');
		expect(warmups.length).toBeGreaterThanOrEqual(1);
		expect(warmups.length).toBeLessThanOrEqual(3);

		// Warmups should be at the start
		for (let i = 0; i < warmups.length; i++) {
			expect(plan.questions[i].phase).toBe('warmup');
		}
	});

	it('includes review phase at the end', () => {
		const state = createDefaultState();
		state.adaptive = { stats: {}, sessionHistory: [], lastSessionDate: 0 };

		const config: SessionConfig = {
			length: 20,
			allowedKinds: ['interval'],
			mixStrategy: 'adaptive',
		};

		const plan = planSession(state, config);
		const reviews = plan.questions.filter(q => q.phase === 'review');
		expect(reviews.length).toBeGreaterThanOrEqual(1);
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
	});

	it('returns empty plan when no content is unlocked', () => {
		const state = createDefaultState();
		// Lock everything
		for (const s of Object.values(state.intervals)) s.unlocked = false;
		for (const s of Object.values(state.chords)) s.unlocked = false;
		for (const s of Object.values(state.scales)) s.unlocked = false;

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

describe('recordAdaptiveAnswer', () => {
	it('updates adaptive stats on correct answer', () => {
		const state = createDefaultState();
		state.adaptive = { stats: {}, sessionHistory: [], lastSessionDate: 0 };

		recordAdaptiveAnswer(state, 'interval:P5:ascending', {
			correct: true,
			replays: 0,
			responseTimeMs: 2000,
		});

		const s = state.adaptive!.stats['interval:P5:ascending'];
		expect(s.attempts).toBe(1);
		expect(s.correct).toBe(1);
		expect(s.streak).toBe(1);
		expect(s.easeFactor).toBeGreaterThan(2.5);
	});

	it('updates adaptive stats on wrong answer', () => {
		const state = createDefaultState();
		state.adaptive = { stats: {}, sessionHistory: [], lastSessionDate: 0 };

		recordAdaptiveAnswer(state, 'interval:P5:ascending', {
			correct: false,
			replays: 0,
			responseTimeMs: 3000,
		});

		const s = state.adaptive!.stats['interval:P5:ascending'];
		expect(s.attempts).toBe(1);
		expect(s.correct).toBe(0);
		expect(s.streak).toBe(0);
	});

	it('dual-writes to legacy interval state', () => {
		const state = createDefaultState();
		state.adaptive = { stats: {}, sessionHistory: [], lastSessionDate: 0 };

		recordAdaptiveAnswer(state, 'interval:P5:ascending', {
			correct: true,
			replays: 0,
			responseTimeMs: 2000,
		});

		const legacy = state.intervals['P5'].modes.ascending;
		expect(legacy.attempts).toBe(1);
		expect(legacy.correct).toBe(1);
	});

	it('dual-writes to legacy chord state', () => {
		const state = createDefaultState();
		state.adaptive = { stats: {}, sessionHistory: [], lastSessionDate: 0 };

		recordAdaptiveAnswer(state, 'chord:maj:root', {
			correct: true,
			replays: 0,
			responseTimeMs: 2000,
		});

		const legacy = state.chords['maj'].voicings.root;
		expect(legacy.attempts).toBe(1);
		expect(legacy.correct).toBe(1);
	});

	it('dual-writes to legacy scale state', () => {
		const state = createDefaultState();
		state.adaptive = { stats: {}, sessionHistory: [], lastSessionDate: 0 };

		recordAdaptiveAnswer(state, 'scale:major', {
			correct: true,
			replays: 0,
			responseTimeMs: 2000,
		});

		const legacy = state.scales['major'];
		expect(legacy.attempts).toBe(1);
		expect(legacy.correct).toBe(1);
	});

	it('creates adaptive state if missing', () => {
		const state = createDefaultState();
		delete (state as any).adaptive;

		recordAdaptiveAnswer(state, 'interval:P5:ascending', {
			correct: true,
			replays: 0,
			responseTimeMs: 2000,
		});

		expect(state.adaptive).toBeDefined();
		expect(state.adaptive!.stats['interval:P5:ascending'].attempts).toBe(1);
	});
});

describe('migrateToAdaptive', () => {
	it('builds adaptive stats from existing interval state', () => {
		const state = createDefaultState();
		state.intervals['P5'].modes.ascending.attempts = 10;
		state.intervals['P5'].modes.ascending.correct = 8;

		const migrated = migrateToAdaptive(state);
		expect(migrated.adaptive).toBeDefined();

		const s = migrated.adaptive!.stats['interval:P5:ascending'];
		expect(s.attempts).toBe(10);
		expect(s.correct).toBe(8);
	});

	it('builds adaptive stats from existing chord state', () => {
		const state = createDefaultState();
		state.chords['maj'].voicings.root.attempts = 5;
		state.chords['maj'].voicings.root.correct = 4;

		const migrated = migrateToAdaptive(state);
		const s = migrated.adaptive!.stats['chord:maj:root'];
		expect(s.attempts).toBe(5);
		expect(s.correct).toBe(4);
	});

	it('builds adaptive stats from existing scale state', () => {
		const state = createDefaultState();
		state.scales['major'].attempts = 15;
		state.scales['major'].correct = 12;

		const migrated = migrateToAdaptive(state);
		const s = migrated.adaptive!.stats['scale:major'];
		expect(s.attempts).toBe(15);
		expect(s.correct).toBe(12);
	});

	it('is idempotent', () => {
		const state = createDefaultState();
		const first = migrateToAdaptive(state);
		const second = migrateToAdaptive(first);
		expect(second).toBe(first); // same reference — no re-migration
	});

	it('populates relatedItems', () => {
		const state = createDefaultState();
		state.intervals['M3'].modes.ascending.attempts = 10;
		state.intervals['M3'].modes.ascending.correct = 8;

		const migrated = migrateToAdaptive(state);
		const s = migrated.adaptive!.stats['interval:M3:ascending'];
		// M3 should have connections to chord:maj (via CURATED_CONNECTIONS)
		expect(s.relatedItems.length).toBeGreaterThan(0);
	});
});
