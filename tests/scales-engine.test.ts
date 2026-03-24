import { describe, it, expect } from 'vitest';
import { pickScale, generateScaleDistractors, generateScaleQuestion } from '$lib/engine';
import { createDefaultState } from '$lib/state';
import { SCALES } from '$lib/scales';

describe('pickScale', () => {
	it('only picks from unlocked+enabled scales', () => {
		const state = createDefaultState();
		for (let i = 0; i < 50; i++) {
			const picked = pickScale(state);
			expect(['major', 'nat_min', 'maj_pent']).toContain(picked.id);
		}
	});

	it('prefers weaker scales (lower accuracy)', () => {
		const state = createDefaultState();
		state.scales['major'].attempts = 20;
		state.scales['major'].correct = 20; // 100%
		state.scales['nat_min'].attempts = 20;
		state.scales['nat_min'].correct = 5;  // 25%
		state.scales['maj_pent'].attempts = 20;
		state.scales['maj_pent'].correct = 20; // 100%

		const counts: Record<string, number> = { major: 0, nat_min: 0, maj_pent: 0 };
		for (let i = 0; i < 200; i++) {
			const picked = pickScale(state);
			counts[picked.id]++;
		}
		expect(counts['nat_min']).toBeGreaterThan(counts['major']);
	});

	it('throws when no enabled scales', () => {
		const state = createDefaultState();
		for (const id of Object.keys(state.scales)) {
			state.scales[id].enabled = false;
		}
		expect(() => pickScale(state)).toThrow('No enabled scales');
	});

	it('gives new boost to unseen scales', () => {
		const state = createDefaultState();
		// Two scales well-practiced, one brand new
		state.scales['major'].attempts = 50;
		state.scales['major'].correct = 45;
		state.scales['nat_min'].attempts = 50;
		state.scales['nat_min'].correct = 45;
		// maj_pent: 0 attempts (new boost)

		const counts: Record<string, number> = { major: 0, nat_min: 0, maj_pent: 0 };
		for (let i = 0; i < 200; i++) {
			const picked = pickScale(state);
			counts[picked.id]++;
		}
		expect(counts['maj_pent']).toBeGreaterThan(counts['major']);
	});
});

describe('generateScaleDistractors', () => {
	it('returns exactly 3 distractors', () => {
		const state = createDefaultState();
		const distractors = generateScaleDistractors('major', state);
		expect(distractors).toHaveLength(3);
	});

	it('does not include the correct answer', () => {
		const state = createDefaultState();
		const distractors = generateScaleDistractors('major', state);
		expect(distractors.map(d => d.id)).not.toContain('major');
	});

	it('prefers unlocked distractors and fills from locked when few unlocked', () => {
		const state = createDefaultState();
		// Default: only 3 tier-1 scales unlocked
		// Correct = major → only nat_min and maj_pent are unlocked distractors (2 < 3)
		const distractors = generateScaleDistractors('major', state);
		expect(distractors).toHaveLength(3);
		expect(distractors.map(d => d.id)).not.toContain('major');

		const ids = distractors.map(d => d.id);
		expect(ids).toContain('nat_min');
		expect(ids).toContain('maj_pent');

		// Third is a locked scale
		const lockedDistractor = distractors.find(d => !['major', 'nat_min', 'maj_pent'].includes(d.id));
		expect(lockedDistractor).toBeDefined();
	});

	it('uses only unlocked distractors when enough are available', () => {
		const state = createDefaultState();
		// Unlock all scales
		for (const id of Object.keys(state.scales)) {
			state.scales[id].unlocked = true;
		}
		const distractors = generateScaleDistractors('major', state);
		expect(distractors).toHaveLength(3);
		expect(distractors.map(d => d.id)).not.toContain('major');
		// All 3 should be from the unlocked pool
		for (const d of distractors) {
			expect(state.scales[d.id].unlocked).toBe(true);
		}
	});
});

describe('generateScaleQuestion', () => {
	it('returns a valid question structure', () => {
		const state = createDefaultState();
		const q = generateScaleQuestion(state);
		expect(q.rootNote).toBeGreaterThanOrEqual(48); // C3
		expect(q.rootNote).toBeLessThanOrEqual(72);    // C5
		expect(q.choices.length).toBeGreaterThanOrEqual(3);
		expect(q.choices.length).toBeLessThanOrEqual(4);
		expect(q.choices.map(c => c.id)).toContain(q.scale.id);
		expect(q.replays).toBe(0);
	});

	it('root note stays in MIDI range for all scale types', () => {
		const state = createDefaultState();
		for (let i = 0; i < 100; i++) {
			const q = generateScaleQuestion(state);
			const highestNote = q.rootNote + Math.max(...q.scale.intervals);
			expect(highestNote).toBeLessThanOrEqual(84); // don't go absurdly high
			expect(q.rootNote).toBeGreaterThanOrEqual(48);
		}
	});

	it('choices are not always in the same order (shuffled)', () => {
		const state = createDefaultState();
		const firstPositions: string[] = [];
		for (let i = 0; i < 30; i++) {
			const q = generateScaleQuestion(state);
			firstPositions.push(q.choices[0].id);
		}
		// Shouldn't always be the same first choice
		const unique = new Set(firstPositions);
		expect(unique.size).toBeGreaterThan(1);
	});

	it('has no duplicate ids in choices', () => {
		const state = createDefaultState();
		for (let i = 0; i < 50; i++) {
			const q = generateScaleQuestion(state);
			const ids = q.choices.map(c => c.id);
			expect(new Set(ids).size).toBe(ids.length);
		}
	});
});
