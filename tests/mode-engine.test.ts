// tests/mode-engine.test.ts — Tests for mode question generation

import { describe, it, expect } from 'vitest';
import { generateModeQuestion, generateModeDistractors, getEnabledModes } from '../src/lib/engine';
import { createDefaultState } from '../src/lib/state';
import { MODES } from '../src/lib/modes';
import type { ModeState } from '../src/lib/types';

function unlockAllModes(state: ReturnType<typeof createDefaultState>) {
	if (!state.modes) state.modes = {};
	for (const def of MODES) {
		state.modes[def.id] = {
			mode: def.id,
			unlocked: true,
			enabled: true,
			attempts: 0,
			correct: 0,
			easeFactor: 2.5,
			nextReview: 0,
			streak: 0,
			lastSeen: 0,
		};
	}
	return state;
}

describe('getEnabledModes', () => {
	it('returns empty when no modes exist', () => {
		expect(getEnabledModes(undefined)).toEqual([]);
	});

	it('returns tier 1 modes on fresh state (Ionian + Aeolian)', () => {
		const state = createDefaultState();
		const enabled = getEnabledModes(state.modes);
		expect(enabled.length).toBe(2);
		expect(enabled.map(m => m.id).sort()).toEqual(['aeolian', 'ionian']);
	});

	it('returns all modes when all unlocked', () => {
		const state = unlockAllModes(createDefaultState());
		const enabled = getEnabledModes(state.modes);
		expect(enabled.length).toBe(7);
	});

	it('excludes disabled modes', () => {
		const state = unlockAllModes(createDefaultState());
		state.modes!['dorian'].enabled = false;
		const enabled = getEnabledModes(state.modes);
		expect(enabled.length).toBe(6);
		expect(enabled.find(m => m.id === 'dorian')).toBeUndefined();
	});
});

describe('generateModeDistractors', () => {
	it('returns 3 distractors', () => {
		const distractors = generateModeDistractors('dorian');
		expect(distractors.length).toBe(3);
		expect(distractors.every(d => d.id !== 'dorian')).toBe(true);
	});

	it('does not include the correct mode', () => {
		for (const mode of MODES) {
			const distractors = generateModeDistractors(mode.id);
			expect(distractors.find(d => d.id === mode.id)).toBeUndefined();
		}
	});
});

describe('generateModeQuestion', () => {
	it('generates a valid mode question', () => {
		const state = unlockAllModes(createDefaultState());
		const question = generateModeQuestion(state);

		expect(question.mode).toBeDefined();
		expect(question.rootNote).toBeGreaterThanOrEqual(48);
		expect(question.rootNote).toBeLessThanOrEqual(60);
		expect(question.droneNote).toBe(question.rootNote);
		expect(question.choices.length).toBeGreaterThanOrEqual(2);
		expect(question.replays).toBe(0);
	});

	it('works on fresh state (tier 1 modes only)', () => {
		const state = createDefaultState();
		const question = generateModeQuestion(state);
		expect(question.mode).toBeDefined();
		expect(['ionian', 'aeolian']).toContain(question.mode.id);
	});

	it('includes the correct mode in choices', () => {
		const state = unlockAllModes(createDefaultState());
		for (let i = 0; i < 20; i++) {
			const question = generateModeQuestion(state);
			const correctInChoices = question.choices.find(c => c.id === question.mode.id);
			expect(correctInChoices).toBeDefined();
		}
	});

	it('throws when no modes are enabled', () => {
		const state = createDefaultState();
		// Disable the two tier 1 modes
		state.modes!['ionian'].enabled = false;
		state.modes!['aeolian'].enabled = false;
		expect(() => generateModeQuestion(state)).toThrow('No enabled modes');
	});

	it('favors weak modes', () => {
		const state = unlockAllModes(createDefaultState());
		// Make dorian weak
		state.modes!['dorian'].attempts = 100;
		state.modes!['dorian'].correct = 20; // 20% accuracy
		// Make others strong
		for (const id of ['ionian', 'aeolian', 'mixolydian', 'phrygian', 'lydian', 'locrian']) {
			state.modes![id].attempts = 100;
			state.modes![id].correct = 95;
		}

		let dorianCount = 0;
		for (let i = 0; i < 200; i++) {
			const q = generateModeQuestion(state);
			if (q.mode.id === 'dorian') dorianCount++;
		}
		// Dorian should appear more than ~14% (uniform 1/7)
		expect(dorianCount).toBeGreaterThan(40);
	});
});
