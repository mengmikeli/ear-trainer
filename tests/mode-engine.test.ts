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

	it('returns empty when all modes are locked', () => {
		const state = createDefaultState();
		expect(getEnabledModes(state.modes)).toEqual([]);
	});

	it('returns unlocked and enabled modes', () => {
		const state = unlockAllModes(createDefaultState());
		const enabled = getEnabledModes(state.modes);
		expect(enabled.length).toBe(4);
	});

	it('excludes disabled modes', () => {
		const state = unlockAllModes(createDefaultState());
		state.modes!['dorian'].enabled = false;
		const enabled = getEnabledModes(state.modes);
		expect(enabled.length).toBe(3);
		expect(enabled.find(m => m.id === 'dorian')).toBeUndefined();
	});
});

describe('generateModeDistractors', () => {
	it('returns 3 distractors', () => {
		const distractors = generateModeDistractors('dorian');
		expect(distractors.length).toBe(3);
		expect(distractors.every(d => d.id !== 'dorian')).toBe(true);
	});

	it('returns all other modes when only 3 exist', () => {
		// 4 modes total - 1 correct = 3 distractors (exactly fills)
		const distractors = generateModeDistractors('dorian');
		expect(distractors.length).toBe(3);
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
		expect(() => generateModeQuestion(state)).toThrow('No enabled modes');
	});

	it('favors weak modes', () => {
		const state = unlockAllModes(createDefaultState());
		// Make dorian weak
		state.modes!['dorian'].attempts = 100;
		state.modes!['dorian'].correct = 20; // 20% accuracy
		// Make others strong
		for (const id of ['mixolydian', 'phrygian', 'lydian']) {
			state.modes![id].attempts = 100;
			state.modes![id].correct = 95;
		}

		let dorianCount = 0;
		for (let i = 0; i < 200; i++) {
			const q = generateModeQuestion(state);
			if (q.mode.id === 'dorian') dorianCount++;
		}
		// Dorian should appear more than 25% (uniform) of the time
		expect(dorianCount).toBeGreaterThan(60);
	});
});
