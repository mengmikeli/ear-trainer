/**
 * v4 unified learning engine tests.
 * Tests pickItem, generateDistractors, and similarity functions.
 */
import { describe, it, expect } from 'vitest';
import {
	pickItem,
	generateDistractors,
	intervalSimilarity,
	chordSimilarity,
	scaleSimilarity,
	modeSimilarity,
} from '$lib/learning/engine';
import { defaultContentStats, type ContentStats } from '$lib/state/schema';
import { INTERVALS } from '$lib/definitions/intervals';
import { CHORDS } from '$lib/definitions/chords';
import { SCALES } from '$lib/definitions/scales';
import { MODES } from '$lib/definitions/modes';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeStats(overrides: Partial<ContentStats> = {}): ContentStats {
	return { ...defaultContentStats(), ...overrides };
}

// ─── pickItem ───────────────────────────────────────────────────────────────

describe('pickItem', () => {
	it('returns an item from the provided list', () => {
		const items = INTERVALS.slice(0, 3); // P1, P5, P8
		const statsMap: Record<string, ContentStats> = {};
		for (const i of items) statsMap[i.id] = makeStats();

		const picked = pickItem(items, (item) => statsMap[item.id]);
		expect(items.map((i) => i.id)).toContain(picked.id);
	});

	it('throws when given an empty list', () => {
		expect(() =>
			pickItem([], () => makeStats()),
		).toThrow('No items to pick from');
	});

	it('favors low-accuracy items (statistical, 500+ iterations)', () => {
		const items = INTERVALS.slice(0, 3); // P1, P5, P8
		const statsMap: Record<string, ContentStats> = {
			P1: makeStats({ attempts: 50, correct: 48 }), // 96% accuracy → low weight
			P5: makeStats({ attempts: 50, correct: 10 }), // 20% accuracy → high weight
			P8: makeStats({ attempts: 50, correct: 25 }), // 50% accuracy → medium weight
		};

		const counts: Record<string, number> = { P1: 0, P5: 0, P8: 0 };
		for (let i = 0; i < 1000; i++) {
			const picked = pickItem(items, (item) => statsMap[item.id]);
			counts[picked.id]++;
		}

		// Weak item (P5, 20%) should be picked more than strong item (P1, 96%)
		expect(counts['P5']).toBeGreaterThan(counts['P1']);
		// Medium item (P8, 50%) should be picked more than strong item (P1, 96%)
		expect(counts['P8']).toBeGreaterThan(counts['P1']);
	});

	it('gives boost to items with 0 attempts', () => {
		const items = INTERVALS.slice(0, 3); // P1, P5, P8
		const statsMap: Record<string, ContentStats> = {
			P1: makeStats({ attempts: 50, correct: 45 }), // 90% — well-practiced
			P5: makeStats({ attempts: 50, correct: 45 }), // 90% — well-practiced
			P8: makeStats(), // 0 attempts → new item boost
		};

		const counts: Record<string, number> = { P1: 0, P5: 0, P8: 0 };
		for (let i = 0; i < 1000; i++) {
			const picked = pickItem(items, (item) => statsMap[item.id]);
			counts[picked.id]++;
		}

		// New item (P8) should appear more often than either practiced item
		expect(counts['P8']).toBeGreaterThan(counts['P1']);
		expect(counts['P8']).toBeGreaterThan(counts['P5']);
	});

	it('favors overdue items', () => {
		const now = Date.now();
		const items = INTERVALS.slice(0, 3); // P1, P5, P8
		const statsMap: Record<string, ContentStats> = {
			// P1: reviewed recently, not overdue
			P1: makeStats({
				attempts: 30,
				correct: 24,
				nextReview: now + 60_000, // 1 min in future
			}),
			// P5: overdue by 12 hours
			P5: makeStats({
				attempts: 30,
				correct: 24,
				nextReview: now - 12 * 60 * 60 * 1000,
			}),
			// P8: same accuracy, not overdue
			P8: makeStats({
				attempts: 30,
				correct: 24,
				nextReview: now + 60_000,
			}),
		};

		const counts: Record<string, number> = { P1: 0, P5: 0, P8: 0 };
		for (let i = 0; i < 1000; i++) {
			const picked = pickItem(items, (item) => statsMap[item.id]);
			counts[picked.id]++;
		}

		// Overdue item (P5) should be picked more than non-overdue items
		expect(counts['P5']).toBeGreaterThan(counts['P1']);
		expect(counts['P5']).toBeGreaterThan(counts['P8']);
	});
});

// ─── generateDistractors ───────────────────────────────────────────────────

describe('generateDistractors', () => {
	it('returns exactly `count` items (default 3)', () => {
		const eligible = INTERVALS.slice(0, 5); // P1, P5, P8, M3, P4
		const result = generateDistractors(
			'P1',
			eligible,
			INTERVALS,
			intervalSimilarity,
		);
		expect(result).toHaveLength(3);
	});

	it('returns custom count when specified', () => {
		const eligible = INTERVALS.slice(0, 6);
		const result = generateDistractors(
			'P1',
			eligible,
			INTERVALS,
			intervalSimilarity,
			5,
		);
		expect(result).toHaveLength(5);
	});

	it('never includes the correct answer', () => {
		for (let i = 0; i < 50; i++) {
			const result = generateDistractors(
				'P5',
				INTERVALS,
				INTERVALS,
				intervalSimilarity,
			);
			const ids = result.map((r) => r.id);
			expect(ids).not.toContain('P5');
		}
	});

	it('all items are unique', () => {
		for (let i = 0; i < 50; i++) {
			const result = generateDistractors(
				'P1',
				INTERVALS,
				INTERVALS,
				intervalSimilarity,
			);
			const ids = result.map((r) => r.id);
			expect(new Set(ids).size).toBe(ids.length);
		}
	});

	it('fills from allItems when eligible is insufficient', () => {
		// Only 2 eligible items (one is correct → only 1 distractor candidate)
		const eligible = INTERVALS.slice(0, 2); // P1, P5
		const result = generateDistractors(
			'P1',
			eligible,
			INTERVALS,
			intervalSimilarity,
		);
		// Should still return 3 distractors by filling from allItems
		expect(result).toHaveLength(3);
		// Should not include the correct answer
		expect(result.map((r) => r.id)).not.toContain('P1');
	});

	it('sorts fill items by similarity (closest first for intervals)', () => {
		// P5 has semitones=7. Closest non-eligible intervals:
		// TT=6 (dist 1), m6=8 (dist 1), M6=9 (dist 2), ...
		// With only 1 eligible item, we need 2 from fill — they should be closest
		const eligible = [
			INTERVALS.find((i) => i.id === 'P5')!,
			INTERVALS.find((i) => i.id === 'P4')!, // semitones=5
		];
		const result = generateDistractors(
			'P5',
			eligible, // only P4 is a distractor candidate (P5 is correct)
			INTERVALS,
			intervalSimilarity,
		);

		expect(result).toHaveLength(3);
		expect(result.map((r) => r.id)).toContain('P4'); // eligible item
		// Fill items should be close to P5 (semitones=7):
		// TT(6, dist=1), m6(8, dist=1) should be chosen before P1(0, dist=7)
		const fillIds = result.filter((r) => r.id !== 'P4').map((r) => r.id);
		const fillSemitones = fillIds.map(
			(id) => INTERVALS.find((i) => i.id === id)!.semitones,
		);
		// All fill items should be within 3 semitones of P5 (7)
		for (const st of fillSemitones) {
			expect(Math.abs(st - 7)).toBeLessThanOrEqual(3);
		}
	});

	it('works with chord similarity', () => {
		const eligible = CHORDS.slice(0, 2); // maj, min
		const result = generateDistractors(
			'maj',
			eligible,
			CHORDS,
			chordSimilarity,
		);
		expect(result).toHaveLength(3);
		expect(result.map((r) => r.id)).not.toContain('maj');
	});
});

// ─── intervalSimilarity ─────────────────────────────────────────────────────

describe('intervalSimilarity', () => {
	it('returns correct distance between intervals', () => {
		const P5 = INTERVALS.find((i) => i.id === 'P5')!; // semitones=7
		const P4 = INTERVALS.find((i) => i.id === 'P4')!; // semitones=5
		const M3 = INTERVALS.find((i) => i.id === 'M3')!; // semitones=4
		const P1 = INTERVALS.find((i) => i.id === 'P1')!; // semitones=0
		const P8 = INTERVALS.find((i) => i.id === 'P8')!; // semitones=12

		expect(intervalSimilarity(P5, P4)).toBe(2);
		expect(intervalSimilarity(P5, M3)).toBe(3);
		expect(intervalSimilarity(P1, P8)).toBe(12);
		expect(intervalSimilarity(P5, P5)).toBe(0); // same interval
	});

	it('is symmetric', () => {
		const P5 = INTERVALS.find((i) => i.id === 'P5')!;
		const M3 = INTERVALS.find((i) => i.id === 'M3')!;
		expect(intervalSimilarity(P5, M3)).toBe(intervalSimilarity(M3, P5));
	});
});

// ─── chordSimilarity ────────────────────────────────────────────────────────

describe('chordSimilarity', () => {
	it('returns lower distance for chords with more shared intervals', () => {
		const maj = CHORDS.find((c) => c.id === 'maj')!; // [0, 4, 7]
		const min = CHORDS.find((c) => c.id === 'min')!; // [0, 3, 7]
		const dim = CHORDS.find((c) => c.id === 'dim')!; // [0, 3, 6]

		// maj vs min: shared=[0,7] → 2, maxLen=3, distance=1
		// maj vs dim: shared=[0] → 1, maxLen=3, distance=2
		expect(chordSimilarity(maj, min)).toBeLessThan(chordSimilarity(maj, dim));
	});

	it('returns 0 for identical chords', () => {
		const maj = CHORDS.find((c) => c.id === 'maj')!;
		expect(chordSimilarity(maj, maj)).toBe(0);
	});

	it('returns correct values for known chord pairs', () => {
		const maj = CHORDS.find((c) => c.id === 'maj')!; // [0, 4, 7]
		const min = CHORDS.find((c) => c.id === 'min')!; // [0, 3, 7]
		const dom7 = CHORDS.find((c) => c.id === 'dom7')!; // [0, 4, 7, 10]

		// maj [0,4,7] vs min [0,3,7]: shared=2 (0,7), maxLen=3, distance=1
		expect(chordSimilarity(maj, min)).toBe(1);

		// maj [0,4,7] vs dom7 [0,4,7,10]: shared=3 (0,4,7), maxLen=4, distance=1
		expect(chordSimilarity(maj, dom7)).toBe(1);
	});
});

// ─── scaleSimilarity ────────────────────────────────────────────────────────

describe('scaleSimilarity', () => {
	it('returns lower distance for scales with more shared intervals', () => {
		const major = SCALES.find((s) => s.id === 'major')!; // [0,2,4,5,7,9,11,12]
		const natMin = SCALES.find((s) => s.id === 'nat_min')!; // [0,2,3,5,7,8,10,12]
		const chromatic = SCALES.find((s) => s.id === 'chromatic')!; // all 13 notes

		// major vs natMin: share {0,2,5,7,12}=5, maxLen=8, distance=3
		// major vs chromatic: share all of major's notes (8), maxLen=13, distance=5
		expect(scaleSimilarity(major, natMin)).toBeLessThan(
			scaleSimilarity(major, chromatic),
		);
	});

	it('returns 0 for identical scales', () => {
		const major = SCALES.find((s) => s.id === 'major')!;
		expect(scaleSimilarity(major, major)).toBe(0);
	});
});

// ─── modeSimilarity ─────────────────────────────────────────────────────────

describe('modeSimilarity', () => {
	it('same parent scale: close degree = low distance', () => {
		const ionian = MODES.find((m) => m.id === 'ionian')!; // major, degree 1
		const dorian = MODES.find((m) => m.id === 'dorian')!; // major, degree 2

		expect(modeSimilarity(ionian, dorian)).toBe(1);
	});

	it('same parent scale: far degree = higher distance', () => {
		const ionian = MODES.find((m) => m.id === 'ionian')!; // major, degree 1
		const locrian = MODES.find((m) => m.id === 'locrian')!; // major, degree 7

		expect(modeSimilarity(ionian, locrian)).toBe(6);
	});

	it('different parent = far (large distance)', () => {
		// All current modes share 'major' as parent, so we create a synthetic one
		const ionianFromMajor = MODES.find((m) => m.id === 'ionian')!;
		const syntheticMode = {
			...ionianFromMajor,
			id: 'synth',
			parent: 'melodic_minor',
			degree: 1,
		};

		expect(modeSimilarity(ionianFromMajor, syntheticMode)).toBe(100);
	});

	it('same parent: closer modes are more similar than farther ones', () => {
		const ionian = MODES.find((m) => m.id === 'ionian')!; // degree 1
		const dorian = MODES.find((m) => m.id === 'dorian')!; // degree 2
		const locrian = MODES.find((m) => m.id === 'locrian')!; // degree 7

		expect(modeSimilarity(ionian, dorian)).toBeLessThan(
			modeSimilarity(ionian, locrian),
		);
	});
});
