// tests/modes.test.ts — Tests for mode definitions

import { describe, it, expect } from 'vitest';
import { MODES, getModeById, getModesByTier } from '../src/lib/modes';

describe('MODES', () => {
	it('has 4 modes', () => {
		expect(MODES.length).toBe(4);
	});

	it('all modes are tier 4', () => {
		for (const mode of MODES) {
			expect(mode.tier).toBe(4);
		}
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
});

describe('getModeById', () => {
	it('returns mode for valid id', () => {
		expect(getModeById('dorian')).toBeDefined();
	});

	it('returns undefined for invalid id', () => {
		expect(getModeById('locrian')).toBeUndefined();
	});
});

describe('getModesByTier', () => {
	it('returns all modes for tier 4', () => {
		expect(getModesByTier(4).length).toBe(4);
	});

	it('returns empty for other tiers', () => {
		expect(getModesByTier(1).length).toBe(0);
		expect(getModesByTier(3).length).toBe(0);
	});
});
