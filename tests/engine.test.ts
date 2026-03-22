import { describe, it, expect } from 'vitest';
import { pickInterval, pickMode, generateQuestion, generateDistractors } from '$lib/engine';
import { createDefaultState } from '$lib/state';
import { INTERVALS } from '$lib/intervals';

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
	it('prefers unlocked distractors and fills from locked when few unlocked', () => {
		const state = createDefaultState();
		// Default: only P1, P5, P8 unlocked (tier 1)
		// Correct = P1 → only P5 and P8 are unlocked distractors (2 < 3)
		const distractors = generateDistractors('P1', state);
		expect(distractors).toHaveLength(3);
		expect(distractors.map(d => d.id)).not.toContain('P1');

		// Both unlocked distractors should be present
		const ids = distractors.map(d => d.id);
		expect(ids).toContain('P5');
		expect(ids).toContain('P8');

		// The third should be a locked interval (not P1, P5, or P8)
		const lockedDistractor = distractors.find(d => !['P1', 'P5', 'P8'].includes(d.id));
		expect(lockedDistractor).toBeDefined();
	});
});

describe('generateQuestion', () => {
	it('returns a valid question with playMode', () => {
		const state = createDefaultState();
		const q = generateQuestion(state);
		expect(q.rootNote).toBeGreaterThanOrEqual(48); // C3
		expect(q.rootNote).toBeLessThanOrEqual(84);    // C6
		expect(q.choices).toHaveLength(4);
		expect(q.choices.map(c => c.id)).toContain(q.interval.id);
		expect(['ascending', 'descending', 'harmonic']).toContain(q.playMode);
		expect(q.direction).toBeDefined();
	});

	it('playMode matches an enabled mode', () => {
		const state = createDefaultState();
		state.settings.enabledModes = { ascending: false, descending: false, harmonic: true };
		for (let i = 0; i < 20; i++) {
			const q = generateQuestion(state);
			expect(q.playMode).toBe('harmonic');
		}
	});
});

describe('pickMode', () => {
	it('returns only enabled modes', () => {
		const state = createDefaultState();
		state.settings.enabledModes = { ascending: true, descending: false, harmonic: false };
		const interval = INTERVALS.find(i => i.id === 'P5')!;
		for (let i = 0; i < 30; i++) {
			expect(pickMode(state, interval)).toBe('ascending');
		}
	});

	it('respects multiple enabled modes', () => {
		const state = createDefaultState();
		state.settings.enabledModes = { ascending: true, descending: true, harmonic: false };
		const interval = INTERVALS.find(i => i.id === 'P5')!;
		const seen = new Set<string>();
		for (let i = 0; i < 100; i++) {
			seen.add(pickMode(state, interval));
		}
		expect(seen).toContain('ascending');
		expect(seen).toContain('descending');
		expect(seen).not.toContain('harmonic');
	});

	it('weights toward weak modes', () => {
		const state = createDefaultState();
		const interval = INTERVALS.find(i => i.id === 'P5')!;
		// Make ascending strong (100%), descending weak (25%), harmonic untouched
		state.intervals['P5'].modes.ascending.attempts = 20;
		state.intervals['P5'].modes.ascending.correct = 20;
		state.intervals['P5'].modes.descending.attempts = 20;
		state.intervals['P5'].modes.descending.correct = 5;
		state.intervals['P5'].modes.harmonic.attempts = 20;
		state.intervals['P5'].modes.harmonic.correct = 20;

		const counts: Record<string, number> = { ascending: 0, descending: 0, harmonic: 0 };
		for (let i = 0; i < 300; i++) {
			counts[pickMode(state, interval)]++;
		}
		expect(counts['descending']).toBeGreaterThan(counts['ascending']);
		expect(counts['descending']).toBeGreaterThan(counts['harmonic']);
	});

	it('throws when no modes are enabled', () => {
		const state = createDefaultState();
		state.settings.enabledModes = { ascending: false, descending: false, harmonic: false };
		const interval = INTERVALS.find(i => i.id === 'P5')!;
		expect(() => pickMode(state, interval)).toThrow('No enabled play modes');
	});

	it('gives new boost to untried modes', () => {
		const state = createDefaultState();
		const interval = INTERVALS.find(i => i.id === 'P5')!;
		// ascending has many attempts with high accuracy, harmonic is untried
		state.intervals['P5'].modes.ascending.attempts = 50;
		state.intervals['P5'].modes.ascending.correct = 48;
		state.intervals['P5'].modes.descending.attempts = 50;
		state.intervals['P5'].modes.descending.correct = 48;
		// harmonic: 0 attempts → should get new boost

		const counts: Record<string, number> = { ascending: 0, descending: 0, harmonic: 0 };
		for (let i = 0; i < 300; i++) {
			counts[pickMode(state, interval)]++;
		}
		expect(counts['harmonic']).toBeGreaterThan(counts['ascending']);
	});
});

describe('enabled filtering', () => {
	it('pickInterval skips disabled intervals', () => {
		const state = createDefaultState();
		// Disable P1 and P5, leaving only P8
		state.intervals['P1'].enabled = false;
		state.intervals['P5'].enabled = false;
		
		// Pick 20 times — should always get P8
		for (let i = 0; i < 20; i++) {
			const picked = pickInterval(state);
			expect(picked.id).toBe('P8');
		}
	});
});
