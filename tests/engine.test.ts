import { describe, it, expect } from 'vitest';
import { pickInterval, generateQuestion, generateDistractors } from '$lib/engine';
import { createDefaultState } from '$lib/state';

describe('pickInterval', () => {
	it('only picks from unlocked intervals', () => {
		const state = createDefaultState();
		for (let i = 0; i < 50; i++) {
			const picked = pickInterval(state);
			expect(['P1', 'P5', 'P8']).toContain(picked.id);
		}
	});
	it('prefers weaker intervals (lower accuracy)', () => {
		const state = createDefaultState();
		state.intervals['P1'].attempts = 20;
		state.intervals['P1'].correct = 20; // 100%
		state.intervals['P5'].attempts = 20;
		state.intervals['P5'].correct = 5;  // 25%
		state.intervals['P8'].attempts = 20;
		state.intervals['P8'].correct = 20; // 100%

		const counts: Record<string, number> = { P1: 0, P5: 0, P8: 0 };
		for (let i = 0; i < 200; i++) {
			const picked = pickInterval(state);
			counts[picked.id]++;
		}
		expect(counts['P5']).toBeGreaterThan(counts['P1']);
	});
});

describe('generateDistractors', () => {
	it('returns exactly 3 distractors', () => {
		const state = createDefaultState();
		const distractors = generateDistractors('P5', state);
		expect(distractors).toHaveLength(3);
	});
	it('does not include the correct answer', () => {
		const state = createDefaultState();
		const distractors = generateDistractors('P5', state);
		expect(distractors.map(d => d.id)).not.toContain('P5');
	});
});

describe('generateQuestion', () => {
	it('returns a valid question', () => {
		const state = createDefaultState();
		const q = generateQuestion(state);
		expect(q.rootNote).toBeGreaterThanOrEqual(48); // C3
		expect(q.rootNote).toBeLessThanOrEqual(84);    // C6
		expect(q.choices).toHaveLength(4);
		expect(q.choices.map(c => c.id)).toContain(q.interval.id);
	});
});
