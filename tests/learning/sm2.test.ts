import { describe, it, expect } from 'vitest';
import { responseQuality, calculateSm2 } from '$lib/sm2';

describe('responseQuality — snapshot of current behavior', () => {
	it('correct, no replays, fast response (<5s) → 5', () => {
		expect(responseQuality({ correct: true, replays: 0, responseTimeMs: 2000 })).toBe(5);
	});

	it('correct with replays (≥1) → 4', () => {
		expect(responseQuality({ correct: true, replays: 1, responseTimeMs: 2000 })).toBe(4);
	});

	it('correct but slow response (>5s) → 3', () => {
		expect(responseQuality({ correct: true, replays: 0, responseTimeMs: 6000 })).toBe(3);
	});

	it('correct with replays AND slow → 4 (replays checked first)', () => {
		// replays > 0 takes priority over slow response
		expect(responseQuality({ correct: true, replays: 2, responseTimeMs: 8000 })).toBe(4);
	});

	it('incorrect → 1', () => {
		expect(responseQuality({ correct: false, replays: 0, responseTimeMs: 2000 })).toBe(1);
	});

	it('incorrect with replays → 1 (incorrect overrides everything)', () => {
		expect(responseQuality({ correct: false, replays: 3, responseTimeMs: 1000 })).toBe(1);
	});

	it('edge: responseTimeMs = 0 → 5 (fast correct)', () => {
		expect(responseQuality({ correct: true, replays: 0, responseTimeMs: 0 })).toBe(5);
	});

	it('edge: replays very high (10+) → 4', () => {
		expect(responseQuality({ correct: true, replays: 15, responseTimeMs: 500 })).toBe(4);
	});

	it('edge: exactly 5000ms is NOT slow (≤5000) → 5', () => {
		expect(responseQuality({ correct: true, replays: 0, responseTimeMs: 5000 })).toBe(5);
	});

	it('edge: 5001ms IS slow (>5000) → 3', () => {
		expect(responseQuality({ correct: true, replays: 0, responseTimeMs: 5001 })).toBe(3);
	});
});

describe('calculateSm2 — snapshot of current behavior', () => {
	it('quality 5, ease 2.5 → increases ease factor', () => {
		const result = calculateSm2(2.5, 5);
		expect(result.easeFactor).toBe(2.6);
		expect(result.intervalMs).toBe(112320000); // 1.3 days
	});

	it('quality 4, ease 2.5 → maintains ease factor', () => {
		const result = calculateSm2(2.5, 4);
		expect(result.easeFactor).toBe(2.5);
		expect(result.intervalMs).toBe(108000000); // 1.25 days
	});

	it('quality 3, ease 2.5 → decreases ease factor', () => {
		const result = calculateSm2(2.5, 3);
		expect(result.easeFactor).toBeCloseTo(2.36, 10);
		expect(result.intervalMs).toBe(101952000); // ~1.18 days
	});

	it('quality 1, ease 2.5 → significant decrease, short interval', () => {
		const result = calculateSm2(2.5, 1);
		expect(result.easeFactor).toBeCloseTo(1.96, 10);
		// quality < 3 → intervalDays = 0.0007 (~1 min)
		expect(result.intervalMs).toBe(60480);
	});

	it('quality 1 triggers review-soon interval (< 3 threshold)', () => {
		const result = calculateSm2(2.5, 2);
		// quality 2 is also < 3
		expect(result.intervalMs).toBe(60480);
	});

	it('quality 3 uses ease-based interval (>= 3 threshold)', () => {
		const result = calculateSm2(2.5, 3);
		// intervalDays = newEf * 0.5 = 2.36 * 0.5 = 1.18 days
		expect(result.intervalMs).toBe(Math.round(2.36 * 0.5 * 86400000));
	});

	it('higher quality → longer interval (quality 5 vs 1 at same ease)', () => {
		const high = calculateSm2(2.5, 5);
		const low = calculateSm2(2.5, 1);
		expect(high.intervalMs).toBeGreaterThan(low.intervalMs);
	});

	it('ease factor never drops below 1.3 after repeated failures', () => {
		let ef = 2.5;
		for (let i = 0; i < 20; i++) {
			const result = calculateSm2(ef, 1);
			ef = result.easeFactor;
			expect(ef).toBeGreaterThanOrEqual(1.3);
		}
		expect(ef).toBe(1.3);
	});

	it('edge: ease factor already at minimum (1.3), quality 1', () => {
		const result = calculateSm2(1.3, 1);
		expect(result.easeFactor).toBe(1.3);
		expect(result.intervalMs).toBe(60480);
	});

	it('edge: ease factor very high (4.0), quality 5', () => {
		const result = calculateSm2(4.0, 5);
		expect(result.easeFactor).toBe(4.1);
		// intervalDays = 4.1 * 0.5 = 2.05 days
		expect(result.intervalMs).toBe(177120000);
	});

	it('returns positive intervalMs at all quality levels', () => {
		for (let q = 0; q <= 5; q++) {
			const result = calculateSm2(2.5, q);
			expect(result.intervalMs).toBeGreaterThan(0);
		}
	});

	it('snapshot: trace 3 consecutive failures from 2.5', () => {
		// Step 1: ef=2.5, q=1 → ef=1.96
		const r1 = calculateSm2(2.5, 1);
		expect(r1.easeFactor).toBeCloseTo(1.96, 10);

		// Step 2: ef=1.96, q=1 → ef=1.42
		const r2 = calculateSm2(r1.easeFactor, 1);
		expect(r2.easeFactor).toBeCloseTo(1.42, 10);

		// Step 3: ef=1.42, q=1 → ef=1.3 (floor)
		const r3 = calculateSm2(r2.easeFactor, 1);
		expect(r3.easeFactor).toBe(1.3);
	});
});
