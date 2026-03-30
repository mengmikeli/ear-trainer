import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	findNeighbor,
	needsLearnCard,
	isColdStart,
	buildColdStartIntro,
	getItemDisplayName,
	getItemLabel,
	buildAllItems,
	planSession,
	defaultContentStats,
	type ContentItem,
	type ContentStats,
	MAX_LEARN_PER_SESSION,
} from '$lib/adaptive';
import { createDefaultState } from '$lib/state';
import type { UserState } from '$lib/types';

// --- Helper: build a minimal ContentItem ---
function makeItem(kind: 'interval' | 'chord' | 'scale' | 'mode', defId: string, variant?: string): ContentItem {
	return {
		kind,
		id: variant ? `${kind}:${defId}:${variant}` : `${kind}:${defId}`,
		defId,
		variant,
		tier: 1,
	};
}

function makeStats(attempts: number, correct: number): ContentStats {
	return {
		attempts,
		correct,
		streak: 0,
		lastSeen: attempts > 0 ? Date.now() : 0,
		easeFactor: 2.5,
		nextReview: 0,
		relatedItems: [],
	};
}

describe('findNeighbor', () => {
	it('returns the closest practiced same-kind item', () => {
		const newItem = makeItem('interval', 'P5', 'ascending');
		const allItems = [
			newItem,
			makeItem('interval', 'P4', 'ascending'),
			makeItem('interval', 'P8', 'ascending'),
			makeItem('interval', 'M3', 'ascending'),
		];
		const stats: Record<string, ContentStats> = {
			'interval:P4:ascending': makeStats(10, 8),
			'interval:P8:ascending': makeStats(5, 4),
			'interval:M3:ascending': makeStats(3, 2),
		};

		const neighbor = findNeighbor(newItem, allItems, stats);
		// P4 (5 semitones) is closest to P5 (7 semitones) — distance = 2
		// P8 (12 semitones) — distance = 5
		// M3 (4 semitones) — distance = 3
		expect(neighbor).not.toBeNull();
		expect(neighbor!.defId).toBe('P4');
	});

	it('returns null when no practiced neighbors exist', () => {
		const newItem = makeItem('interval', 'P5', 'ascending');
		const allItems = [
			newItem,
			makeItem('interval', 'P4', 'ascending'),
			makeItem('interval', 'P8', 'ascending'),
		];
		const stats: Record<string, ContentStats> = {
			'interval:P4:ascending': makeStats(0, 0),
			'interval:P8:ascending': makeStats(0, 0),
		};

		const neighbor = findNeighbor(newItem, allItems, stats);
		expect(neighbor).toBeNull();
	});

	it('returns null when no same-kind items exist', () => {
		const newItem = makeItem('interval', 'P5', 'ascending');
		const allItems = [
			newItem,
			makeItem('chord', 'maj', 'root'),
		];
		const stats: Record<string, ContentStats> = {
			'chord:maj:root': makeStats(10, 8),
		};

		const neighbor = findNeighbor(newItem, allItems, stats);
		expect(neighbor).toBeNull();
	});

	it('prefers different defId over same defId with different variant', () => {
		const newItem = makeItem('interval', 'P5', 'descending');
		const allItems = [
			newItem,
			makeItem('interval', 'P5', 'ascending'),  // same defId, different variant
			makeItem('interval', 'P4', 'ascending'),   // different defId, close distance
		];
		const stats: Record<string, ContentStats> = {
			'interval:P5:ascending': makeStats(10, 8),
			'interval:P4:ascending': makeStats(5, 4),
		};

		const neighbor = findNeighbor(newItem, allItems, stats);
		expect(neighbor).not.toBeNull();
		// Should pick P4 (different defId) over P5 ascending (same defId)
		expect(neighbor!.defId).toBe('P4');
	});

	it('falls back to same defId if no different defId neighbor exists', () => {
		const newItem = makeItem('interval', 'P5', 'descending');
		const allItems = [
			newItem,
			makeItem('interval', 'P5', 'ascending'),
		];
		const stats: Record<string, ContentStats> = {
			'interval:P5:ascending': makeStats(10, 8),
		};

		const neighbor = findNeighbor(newItem, allItems, stats);
		expect(neighbor).not.toBeNull();
		expect(neighbor!.defId).toBe('P5'); // only option
	});

	it('finds chord neighbors by shared intervals', () => {
		const newItem = makeItem('chord', 'min', 'root');
		const allItems = [
			newItem,
			makeItem('chord', 'maj', 'root'),
			makeItem('chord', 'dim', 'root'),
		];
		const stats: Record<string, ContentStats> = {
			'chord:maj:root': makeStats(10, 8),
			'chord:dim:root': makeStats(5, 3),
		};

		const neighbor = findNeighbor(newItem, allItems, stats);
		expect(neighbor).not.toBeNull();
		// maj [0,4,7] shares P1+P5 with min [0,3,7] → distance = 1
		// dim [0,3,6] shares P1+m3 with min [0,3,7] → distance = 1
		// Both are equally close; either is valid
		expect(['maj', 'dim']).toContain(neighbor!.defId);
	});

	it('finds scale neighbors by shared scale degrees', () => {
		const newItem = makeItem('scale', 'nat_min');
		const allItems = [
			newItem,
			makeItem('scale', 'major'),
			makeItem('scale', 'blues'),
		];
		const stats: Record<string, ContentStats> = {
			'scale:major': makeStats(10, 8),
			'scale:blues': makeStats(5, 3),
		};

		const neighbor = findNeighbor(newItem, allItems, stats);
		expect(neighbor).not.toBeNull();
		// Major [0,2,4,5,7,9,11,12] vs nat_min [0,2,3,5,7,8,10,12] — share 5 degrees (0,2,5,7,12)
		// Blues [0,3,5,6,7,10,12] vs nat_min — share 5 degrees (0,3,5,7,12)
		// Both have distance 3; either is valid
		expect(['major', 'blues']).toContain(neighbor!.defId);
	});
});

describe('needsLearnCard', () => {
	it('returns true for items with no attempts', () => {
		expect(needsLearnCard('interval:P5:ascending', {})).toBe(true);
	});

	it('returns true for items with explicit zero attempts', () => {
		const stats = { 'interval:P5:ascending': makeStats(0, 0) };
		expect(needsLearnCard('interval:P5:ascending', stats)).toBe(true);
	});

	it('returns false for items with attempts > 0', () => {
		const stats = { 'interval:P5:ascending': makeStats(1, 1) };
		expect(needsLearnCard('interval:P5:ascending', stats)).toBe(false);
	});

	it('returns false when devMode is true', () => {
		expect(needsLearnCard('interval:P5:ascending', {}, true)).toBe(false);
	});
});

describe('isColdStart', () => {
	it('returns true when all stats have zero attempts', () => {
		const stats = {
			'interval:P1:ascending': makeStats(0, 0),
			'interval:P5:ascending': makeStats(0, 0),
		};
		expect(isColdStart(stats)).toBe(true);
	});

	it('returns true for empty stats', () => {
		expect(isColdStart({})).toBe(true);
	});

	it('returns false when any item has attempts', () => {
		const stats = {
			'interval:P1:ascending': makeStats(1, 1),
			'interval:P5:ascending': makeStats(0, 0),
		};
		expect(isColdStart(stats)).toBe(false);
	});
});

describe('buildColdStartIntro', () => {
	it('returns 3 Tier 1 interval items in P1 → P8 → P5 order', () => {
		const intro = buildColdStartIntro();
		expect(intro).toHaveLength(3);
		expect(intro[0].defId).toBe('P1');
		expect(intro[1].defId).toBe('P8');
		expect(intro[2].defId).toBe('P5');
	});

	it('all items are ascending intervals', () => {
		const intro = buildColdStartIntro();
		for (const item of intro) {
			expect(item.kind).toBe('interval');
			expect(item.variant).toBe('ascending');
		}
	});
});

describe('getItemDisplayName', () => {
	it('returns interval name', () => {
		expect(getItemDisplayName(makeItem('interval', 'P5'))).toBe('Perfect 5th');
	});

	it('returns chord name', () => {
		expect(getItemDisplayName(makeItem('chord', 'maj'))).toBe('Major');
	});

	it('returns scale name', () => {
		expect(getItemDisplayName(makeItem('scale', 'major'))).toBe('Major');
	});

	it('returns mode name', () => {
		expect(getItemDisplayName(makeItem('mode', 'dorian'))).toBe('Dorian');
	});

	it('falls back to defId for unknown items', () => {
		expect(getItemDisplayName(makeItem('interval', 'FAKE'))).toBe('FAKE');
	});
});

describe('getItemLabel', () => {
	it('returns interval id as label', () => {
		expect(getItemLabel(makeItem('interval', 'P5'))).toBe('P5');
	});

	it('returns chord label', () => {
		expect(getItemLabel(makeItem('chord', 'min'))).toBe('Min');
	});

	it('returns scale label', () => {
		expect(getItemLabel(makeItem('scale', 'nat_min'))).toBe('Min');
	});
});

describe('planSession — learn phase integration', () => {
	let state: UserState;

	beforeEach(() => {
		state = createDefaultState();
	});

	it('places learn items before warmup phase for new users', () => {
		// Fresh state — all items have attempts === 0
		const plan = planSession(state, {
			length: 20,
			allowedKinds: ['interval'],
			mixStrategy: 'adaptive',
		});

		expect(plan.learnCount).toBeGreaterThan(0);
		expect(plan.learnCount).toBeLessThanOrEqual(MAX_LEARN_PER_SESSION);

		// First N items should be learn phase
		for (let i = 0; i < plan.learnCount; i++) {
			expect(plan.questions[i].phase).toBe('learn');
		}
	});

	it('caps learn items at MAX_LEARN_PER_SESSION', () => {
		const plan = planSession(state, {
			length: 20,
			allowedKinds: ['interval'],
			mixStrategy: 'adaptive',
		});

		const learnQuestions = plan.questions.filter(q => q.phase === 'learn');
		expect(learnQuestions.length).toBeLessThanOrEqual(MAX_LEARN_PER_SESSION);
	});

	it('sorts learn items by tier (lowest first)', () => {
		const plan = planSession(state, {
			length: 20,
			allowedKinds: ['interval'],
			mixStrategy: 'adaptive',
		});

		const learnQuestions = plan.questions.filter(q => q.phase === 'learn');
		for (let i = 1; i < learnQuestions.length; i++) {
			expect(learnQuestions[i].item.tier).toBeGreaterThanOrEqual(learnQuestions[i - 1].item.tier);
		}
	});

	it('skips learn phase when devMode is enabled', () => {
		state.settings.devMode = true;
		const plan = planSession(state, {
			length: 20,
			allowedKinds: ['interval'],
			mixStrategy: 'adaptive',
		});

		expect(plan.learnCount).toBe(0);
		const learnQuestions = plan.questions.filter(q => q.phase === 'learn');
		expect(learnQuestions.length).toBe(0);
	});

	it('no learn items when all items have been practiced', () => {
		// Give all Tier 1 intervals some attempts
		if (!state.adaptive) {
			state.adaptive = { stats: {}, sessionHistory: [], lastSessionDate: 0 };
		}
		const modes = ['ascending', 'descending', 'harmonic'] as const;
		for (const interval of ['P1', 'P5', 'P8']) {
			for (const mode of modes) {
				if (!state.settings.enabledModes[mode]) continue;
				state.adaptive.stats[`interval:${interval}:${mode}`] = makeStats(10, 8);
			}
		}

		const plan = planSession(state, {
			length: 10,
			allowedKinds: ['interval'],
			mixStrategy: 'adaptive',
		});

		// Tier 1 items have attempts, but other unlocked items might not
		// Since only tier 1 is unlocked by default, learn count should be 0
		expect(plan.learnCount).toBe(0);
	});

	it('uses cold start intro for brand new users', () => {
		const plan = planSession(state, {
			length: 20,
			allowedKinds: ['interval'],
			mixStrategy: 'adaptive',
		});

		// Should use cold start intro: P1, P8, P5
		const learnQuestions = plan.questions.filter(q => q.phase === 'learn');
		if (learnQuestions.length >= 3) {
			expect(learnQuestions[0].item.defId).toBe('P1');
			expect(learnQuestions[1].item.defId).toBe('P8');
			expect(learnQuestions[2].item.defId).toBe('P5');
		}
	});

	it('includes learn count in summary', () => {
		const plan = planSession(state, {
			length: 20,
			allowedKinds: ['interval'],
			mixStrategy: 'adaptive',
		});

		if (plan.learnCount > 0) {
			expect(plan.summary).toContain('new');
		}
	});
});
