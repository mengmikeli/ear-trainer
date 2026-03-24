import { describe, it, expect } from 'vitest';
import { SCALES, getScalesByTier, getScaleById, getUnlockedScales, getEnabledScales } from '../src/lib/scales';
import type { ScaleState } from '../src/lib/types';

function createMockScaleState(overrides: Partial<ScaleState> = {}): ScaleState {
	return {
		scale: 'major',
		unlocked: false,
		enabled: true,
		attempts: 0, correct: 0, easeFactor: 2.5,
		nextReview: 0, streak: 0, lastSeen: 0,
		...overrides,
	};
}

describe('SCALES constant', () => {
	it('has exactly 9 definitions', () => {
		expect(SCALES).toHaveLength(9);
	});

	it('all scales have required fields', () => {
		for (const scale of SCALES) {
			expect(scale.id).toBeTruthy();
			expect(scale.name).toBeTruthy();
			expect(scale.intervals.length).toBeGreaterThanOrEqual(6);
			expect(scale.intervals[0]).toBe(0); // starts at root
			expect(scale.intervals[scale.intervals.length - 1]).toBe(12); // ends at octave
			expect(scale.tier).toBeGreaterThanOrEqual(1);
			expect(scale.tier).toBeLessThanOrEqual(3);
			expect(['diatonic', 'pentatonic', 'symmetric']).toContain(scale.category);
		}
	});

	it('intervals are strictly ascending within each scale', () => {
		for (const scale of SCALES) {
			for (let i = 1; i < scale.intervals.length; i++) {
				expect(scale.intervals[i]).toBeGreaterThan(scale.intervals[i - 1]);
			}
		}
	});

	it('no duplicate ids', () => {
		const ids = SCALES.map(s => s.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('tier 1 has Major, Natural Minor, Major Pentatonic', () => {
		const t1 = getScalesByTier(1);
		expect(t1.map(s => s.id).sort()).toEqual(['maj_pent', 'major', 'nat_min']);
	});

	it('tier 2 has Harmonic Minor, Minor Pentatonic', () => {
		const t2 = getScalesByTier(2);
		expect(t2.map(s => s.id).sort()).toEqual(['harm_min', 'min_pent']);
	});

	it('tier 3 has Blues, Whole Tone, Melodic Minor, Chromatic', () => {
		const t3 = getScalesByTier(3);
		expect(t3.map(s => s.id).sort()).toEqual(['blues', 'chromatic', 'mel_min', 'whole']);
	});

	it('pentatonics have 6 notes', () => {
		const pents = SCALES.filter(s => s.category === 'pentatonic' && s.id !== 'blues');
		for (const p of pents) {
			expect(p.intervals).toHaveLength(6);
		}
	});

	it('diatonic scales have 8 notes', () => {
		const diats = SCALES.filter(s => s.category === 'diatonic');
		for (const d of diats) {
			expect(d.intervals).toHaveLength(8);
		}
	});

	it('blues has 7 notes', () => {
		const blues = getScaleById('blues');
		expect(blues?.intervals).toHaveLength(7);
	});

	it('whole tone has 7 notes', () => {
		const whole = getScaleById('whole');
		expect(whole?.intervals).toHaveLength(7);
	});

	it('chromatic has 13 notes', () => {
		const chromatic = getScaleById('chromatic');
		expect(chromatic?.intervals).toHaveLength(13);
	});
});

describe('specific scale interval correctness', () => {
	it('Major scale: W-W-H-W-W-W-H', () => {
		expect(getScaleById('major')?.intervals).toEqual([0, 2, 4, 5, 7, 9, 11, 12]);
	});

	it('Natural Minor: W-H-W-W-H-W-W', () => {
		expect(getScaleById('nat_min')?.intervals).toEqual([0, 2, 3, 5, 7, 8, 10, 12]);
	});

	it('Harmonic Minor: raised 7th', () => {
		expect(getScaleById('harm_min')?.intervals).toEqual([0, 2, 3, 5, 7, 8, 11, 12]);
	});

	it('Melodic Minor (ascending): raised 6th + 7th', () => {
		expect(getScaleById('mel_min')?.intervals).toEqual([0, 2, 3, 5, 7, 9, 11, 12]);
	});

	it('Major Pentatonic: 1-2-3-5-6', () => {
		expect(getScaleById('maj_pent')?.intervals).toEqual([0, 2, 4, 7, 9, 12]);
	});

	it('Minor Pentatonic: 1-b3-4-5-b7', () => {
		expect(getScaleById('min_pent')?.intervals).toEqual([0, 3, 5, 7, 10, 12]);
	});

	it('Blues: Minor Pent + b5', () => {
		expect(getScaleById('blues')?.intervals).toEqual([0, 3, 5, 6, 7, 10, 12]);
	});

	it('Whole Tone: all whole steps', () => {
		const intervals = getScaleById('whole')?.intervals ?? [];
		for (let i = 1; i < intervals.length; i++) {
			expect(intervals[i] - intervals[i - 1]).toBe(2);
		}
	});

	it('Chromatic: all half steps', () => {
		const intervals = getScaleById('chromatic')?.intervals ?? [];
		for (let i = 1; i < intervals.length; i++) {
			expect(intervals[i] - intervals[i - 1]).toBe(1);
		}
	});
});

describe('getScaleById', () => {
	it('finds existing scale', () => {
		expect(getScaleById('major')?.name).toBe('Major');
		expect(getScaleById('blues')?.name).toBe('Blues');
	});

	it('returns undefined for unknown id', () => {
		expect(getScaleById('dorian')).toBeUndefined();
		expect(getScaleById('xxx')).toBeUndefined();
	});
});

describe('getUnlockedScales / getEnabledScales', () => {
	it('returns only unlocked scales', () => {
		const states: Record<string, ScaleState> = {
			major: createMockScaleState({ scale: 'major', unlocked: true }),
			nat_min: createMockScaleState({ scale: 'nat_min', unlocked: false }),
		};
		const unlocked = getUnlockedScales(states);
		expect(unlocked.map(s => s.id)).toContain('major');
		expect(unlocked.map(s => s.id)).not.toContain('nat_min');
	});

	it('getEnabledScales filters out disabled', () => {
		const states: Record<string, ScaleState> = {
			major: createMockScaleState({ scale: 'major', unlocked: true, enabled: false }),
			nat_min: createMockScaleState({ scale: 'nat_min', unlocked: true, enabled: true }),
		};
		const enabled = getEnabledScales(states);
		expect(enabled.map(s => s.id)).toEqual(['nat_min']);
	});

	it('returns empty when no scales unlocked', () => {
		const states: Record<string, ScaleState> = {
			major: createMockScaleState({ scale: 'major', unlocked: false }),
		};
		expect(getUnlockedScales(states)).toHaveLength(0);
	});
});
