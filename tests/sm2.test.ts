import { describe, it, expect } from 'vitest';
import { calculateSm2, responseQuality } from '$lib/sm2';

describe('responseQuality', () => {
	it('returns 5 for correct on first listen', () => {
		expect(responseQuality({ correct: true, replays: 0, responseTimeMs: 2000 })).toBe(5);
	});
	it('returns 4 for correct after replay', () => {
		expect(responseQuality({ correct: true, replays: 1, responseTimeMs: 2000 })).toBe(4);
	});
	it('returns 3 for correct but slow (>5s)', () => {
		expect(responseQuality({ correct: true, replays: 0, responseTimeMs: 6000 })).toBe(3);
	});
	it('returns 1 for wrong', () => {
		expect(responseQuality({ correct: false, replays: 0, responseTimeMs: 1000 })).toBe(1);
	});
});

describe('calculateSm2', () => {
	it('increases ease factor for quality 5', () => {
		const result = calculateSm2(2.5, 5);
		expect(result.easeFactor).toBeGreaterThan(2.5);
	});
	it('decreases ease factor for quality 1', () => {
		const result = calculateSm2(2.5, 1);
		expect(result.easeFactor).toBeLessThan(2.5);
	});
	it('never drops ease factor below 1.3', () => {
		const result = calculateSm2(1.3, 1);
		expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
	});
	it('returns interval in ms', () => {
		const result = calculateSm2(2.5, 5);
		expect(result.intervalMs).toBeGreaterThan(0);
	});
});
