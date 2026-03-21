import { describe, it, expect } from 'vitest';
import { INTERVALS, getIntervalsByTier, getUnlockedIntervals } from '$lib/intervals';
import type { IntervalState } from '$lib/types';

describe('INTERVALS', () => {
	it('has 13 intervals (P1 through P8)', () => {
		expect(INTERVALS).toHaveLength(13);
	});
	it('each interval has required fields', () => {
		for (const interval of INTERVALS) {
			expect(interval.id).toBeTruthy();
			expect(interval.name).toBeTruthy();
			expect(interval.semitones).toBeGreaterThanOrEqual(0);
			expect(interval.semitones).toBeLessThanOrEqual(12);
			expect(interval.tier).toBeGreaterThanOrEqual(1);
			expect(interval.tier).toBeLessThanOrEqual(5);
		}
	});
	it('tier 1 has P1, P5, P8', () => {
		const tier1 = getIntervalsByTier(1);
		const ids = tier1.map((i) => i.id);
		expect(ids).toContain('P1');
		expect(ids).toContain('P5');
		expect(ids).toContain('P8');
		expect(tier1).toHaveLength(3);
	});
});

describe('getUnlockedIntervals', () => {
	it('returns only unlocked intervals', () => {
		const states: Record<string, IntervalState> = {
			P1: {
				interval: 'P1',
				mode: 'choice',
				unlocked: true,
				attempts: 0,
				correct: 0,
				easeFactor: 2.5,
				nextReview: 0,
				streak: 0,
				lastSeen: 0
			},
			P5: {
				interval: 'P5',
				mode: 'choice',
				unlocked: true,
				attempts: 0,
				correct: 0,
				easeFactor: 2.5,
				nextReview: 0,
				streak: 0,
				lastSeen: 0
			},
			m3: {
				interval: 'm3',
				mode: 'choice',
				unlocked: false,
				attempts: 0,
				correct: 0,
				easeFactor: 2.5,
				nextReview: 0,
				streak: 0,
				lastSeen: 0
			}
		};
		const unlocked = getUnlockedIntervals(states);
		expect(unlocked).toHaveLength(2);
	});
});
