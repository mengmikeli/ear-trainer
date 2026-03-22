import { describe, it, expect } from 'vitest';
import { CHORDS, getChordsByTier, getChordById, getUnlockedChords, getEnabledChords, applyInversion } from '../src/lib/chords';
import type { ChordState, ModeStats } from '../src/lib/types';

function createMockChordState(overrides: Partial<ChordState> = {}): ChordState {
	const defaultMode: ModeStats = {
		attempts: 0, correct: 0, streak: 0,
		lastSeen: 0, easeFactor: 2.5, nextReview: 0,
	};
	return {
		chord: 'maj',
		unlocked: false,
		enabled: true,
		attempts: 0, correct: 0, easeFactor: 2.5,
		nextReview: 0, streak: 0, lastSeen: 0,
		voicings: {
			root: { ...defaultMode },
			first: { ...defaultMode },
			second: { ...defaultMode },
		},
		...overrides,
	};
}

describe('CHORDS constant', () => {
	it('has 10 chord definitions', () => {
		expect(CHORDS).toHaveLength(10);
	});

	it('all chords have required fields', () => {
		for (const chord of CHORDS) {
			expect(chord.id).toBeTruthy();
			expect(chord.name).toBeTruthy();
			expect(chord.intervals.length).toBeGreaterThanOrEqual(3);
			expect(chord.intervals[0]).toBe(0); // root is always 0
			expect(chord.tier).toBeGreaterThanOrEqual(1);
			expect(chord.tier).toBeLessThanOrEqual(4);
			expect(['triad', 'seventh']).toContain(chord.category);
		}
	});

	it('tier 1 has Major and Minor', () => {
		const t1 = getChordsByTier(1);
		expect(t1.map(c => c.id).sort()).toEqual(['maj', 'min']);
	});

	it('tier 2 has Diminished and Augmented', () => {
		const t2 = getChordsByTier(2);
		expect(t2.map(c => c.id).sort()).toEqual(['aug', 'dim']);
	});

	it('tier 3 has three 7th chords', () => {
		const t3 = getChordsByTier(3);
		expect(t3).toHaveLength(3);
		expect(t3.every(c => c.category === 'seventh')).toBe(true);
	});

	it('tier 4 has three extended 7th chords', () => {
		const t4 = getChordsByTier(4);
		expect(t4).toHaveLength(3);
	});

	it('triads have 3 notes, sevenths have 4', () => {
		for (const chord of CHORDS) {
			if (chord.category === 'triad') {
				expect(chord.intervals).toHaveLength(3);
			} else {
				expect(chord.intervals).toHaveLength(4);
			}
		}
	});
});

describe('getChordById', () => {
	it('finds existing chord', () => {
		expect(getChordById('maj')?.name).toBe('Major');
		expect(getChordById('dom7')?.name).toBe('Dominant 7th');
	});

	it('returns undefined for unknown id', () => {
		expect(getChordById('xxx')).toBeUndefined();
	});
});

describe('getUnlockedChords / getEnabledChords', () => {
	it('returns only unlocked chords', () => {
		const states: Record<string, ChordState> = {
			maj: createMockChordState({ chord: 'maj', unlocked: true }),
			min: createMockChordState({ chord: 'min', unlocked: false }),
		};
		const unlocked = getUnlockedChords(states);
		expect(unlocked.map(c => c.id)).toContain('maj');
		expect(unlocked.map(c => c.id)).not.toContain('min');
	});

	it('getEnabledChords filters out disabled', () => {
		const states: Record<string, ChordState> = {
			maj: createMockChordState({ chord: 'maj', unlocked: true, enabled: false }),
			min: createMockChordState({ chord: 'min', unlocked: true, enabled: true }),
		};
		const enabled = getEnabledChords(states);
		expect(enabled.map(c => c.id)).toEqual(['min']);
	});
});

describe('applyInversion', () => {
	it('root position returns sorted intervals as-is', () => {
		expect(applyInversion([0, 4, 7], 'root')).toEqual([0, 4, 7]);
	});

	it('1st inversion moves bottom note up an octave', () => {
		// Major triad: [0,4,7] → bottom (0) goes up 12 → [4, 7, 12]
		expect(applyInversion([0, 4, 7], 'first')).toEqual([4, 7, 12]);
	});

	it('2nd inversion moves bottom two notes up an octave', () => {
		// Major triad: [0,4,7] → 0→12, 4→16 → [7, 12, 16]
		expect(applyInversion([0, 4, 7], 'second')).toEqual([7, 12, 16]);
	});

	it('works with 7th chords', () => {
		// Dom7: [0,4,7,10] → first inv: [4,7,10,12]
		expect(applyInversion([0, 4, 7, 10], 'first')).toEqual([4, 7, 10, 12]);
		// Dom7: second inv: [7,10,12,16]
		expect(applyInversion([0, 4, 7, 10], 'second')).toEqual([7, 10, 12, 16]);
	});

	it('minor triad inversions', () => {
		// Minor: [0,3,7] → first: [3,7,12] → second: [7,12,15]
		expect(applyInversion([0, 3, 7], 'first')).toEqual([3, 7, 12]);
		expect(applyInversion([0, 3, 7], 'second')).toEqual([7, 12, 15]);
	});
});
