// tests/modes.test.ts — Tests for mode definitions

import { describe, it, expect } from 'vitest';
import { MODES, getModeById, getModesByTier } from '../src/lib/modes';

describe('MODES', () => {
	it('has 7 modes (all major scale modes)', () => {
		expect(MODES.length).toBe(7);
	});

	it('has modes across 4 tiers', () => {
		const tiers = new Set(MODES.map(m => m.tier));
		expect(tiers).toEqual(new Set([1, 2, 3, 4]));
	});

	it('tier 1 has Ionian and Aeolian', () => {
		const t1 = getModesByTier(1);
		expect(t1.length).toBe(2);
		expect(t1.map(m => m.id).sort()).toEqual(['aeolian', 'ionian']);
	});

	it('tier 2 has Dorian and Mixolydian', () => {
		const t2 = getModesByTier(2);
		expect(t2.length).toBe(2);
		expect(t2.map(m => m.id).sort()).toEqual(['dorian', 'mixolydian']);
	});

	it('tier 3 has Lydian and Phrygian', () => {
		const t3 = getModesByTier(3);
		expect(t3.length).toBe(2);
		expect(t3.map(m => m.id).sort()).toEqual(['lydian', 'phrygian']);
	});

	it('tier 4 has Locrian', () => {
		const t4 = getModesByTier(4);
		expect(t4.length).toBe(1);
		expect(t4[0].id).toBe('locrian');
	});

	it('all modes have category "mode"', () => {
		for (const mode of MODES) {
			expect(mode.category).toBe('mode');
		}
	});

	it('all modes have valid intervals starting at 0 and ending at 12', () => {
		for (const mode of MODES) {
			expect(mode.intervals[0]).toBe(0);
			expect(mode.intervals[mode.intervals.length - 1]).toBe(12);
		}
	});

	it('all modes have characteristic intervals', () => {
		for (const mode of MODES) {
			expect(mode.characteristic.length).toBeGreaterThan(0);
			for (const c of mode.characteristic) {
				expect(mode.intervals).toContain(c);
			}
		}
	});

	it('ionian has major scale intervals', () => {
		const ion = getModeById('ionian');
		expect(ion).toBeDefined();
		expect(ion!.intervals).toEqual([0, 2, 4, 5, 7, 9, 11, 12]);
		expect(ion!.degree).toBe(1);
	});

	it('aeolian has natural minor intervals', () => {
		const aeo = getModeById('aeolian');
		expect(aeo).toBeDefined();
		expect(aeo!.intervals).toEqual([0, 2, 3, 5, 7, 8, 10, 12]);
		expect(aeo!.degree).toBe(6);
	});

	it('dorian has correct intervals', () => {
		const dorian = getModeById('dorian');
		expect(dorian).toBeDefined();
		expect(dorian!.intervals).toEqual([0, 2, 3, 5, 7, 9, 10, 12]);
		expect(dorian!.parent).toBe('major');
		expect(dorian!.degree).toBe(2);
	});

	it('mixolydian has correct intervals', () => {
		const mix = getModeById('mixolydian');
		expect(mix).toBeDefined();
		expect(mix!.intervals).toEqual([0, 2, 4, 5, 7, 9, 10, 12]);
	});

	it('phrygian has correct intervals', () => {
		const phr = getModeById('phrygian');
		expect(phr).toBeDefined();
		expect(phr!.intervals).toEqual([0, 1, 3, 5, 7, 8, 10, 12]);
	});

	it('lydian has correct intervals', () => {
		const lyd = getModeById('lydian');
		expect(lyd).toBeDefined();
		expect(lyd!.intervals).toEqual([0, 2, 4, 6, 7, 9, 11, 12]);
	});

	it('locrian has correct intervals', () => {
		const loc = getModeById('locrian');
		expect(loc).toBeDefined();
		expect(loc!.intervals).toEqual([0, 1, 3, 5, 6, 8, 10, 12]);
		expect(loc!.degree).toBe(7);
	});
});

describe('getModeById', () => {
	it('returns mode for valid id', () => {
		expect(getModeById('dorian')).toBeDefined();
		expect(getModeById('ionian')).toBeDefined();
		expect(getModeById('locrian')).toBeDefined();
	});

	it('returns undefined for invalid id', () => {
		expect(getModeById('superlocrian')).toBeUndefined();
	});
});

describe('getModesByTier', () => {
	it('returns 2 modes for tier 1', () => {
		expect(getModesByTier(1).length).toBe(2);
	});

	it('returns 2 modes for tier 2', () => {
		expect(getModesByTier(2).length).toBe(2);
	});

	it('returns 2 modes for tier 3', () => {
		expect(getModesByTier(3).length).toBe(2);
	});

	it('returns 1 mode for tier 4', () => {
		expect(getModesByTier(4).length).toBe(1);
	});

	it('returns empty for non-existent tier', () => {
		expect(getModesByTier(5).length).toBe(0);
	});
});
