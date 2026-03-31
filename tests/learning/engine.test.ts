/**
 * Phase 0 — Snapshot tests for the question generation engine.
 * Captures existing behavior BEFORE any refactor.
 */
import { describe, it, expect } from 'vitest';
import {
	generateQuestion,
	generateChordQuestion,
	generateScaleQuestion,
	generateModeQuestion,
} from '$lib/engine';
import { createDefaultState } from '$lib/state';

// ─── generateQuestion (intervals) ───────────────────────────────────────────

describe('generateQuestion', () => {
	it('returns a valid question with all required fields', () => {
		const state = createDefaultState();
		const q = generateQuestion(state);

		expect(q).toHaveProperty('interval');
		expect(q).toHaveProperty('rootNote');
		expect(q).toHaveProperty('playMode');
		expect(q).toHaveProperty('choices');
		expect(q.replays).toBe(0);
		expect(q.interval).toBeDefined();
		expect(q.interval.id).toBeDefined();
	});

	it('rootNote is within MIDI range (48-84)', () => {
		const state = createDefaultState();
		for (let i = 0; i < 50; i++) {
			const q = generateQuestion(state);
			expect(q.rootNote).toBeGreaterThanOrEqual(48);
			expect(q.rootNote).toBeLessThanOrEqual(84);
		}
	});

	it('choices has exactly 4 items', () => {
		const state = createDefaultState();
		for (let i = 0; i < 20; i++) {
			const q = generateQuestion(state);
			expect(q.choices).toHaveLength(4);
		}
	});

	it('correct answer (question.interval) is always in the choices array', () => {
		const state = createDefaultState();
		for (let i = 0; i < 50; i++) {
			const q = generateQuestion(state);
			const choiceIds = q.choices.map((c) => c.id);
			expect(choiceIds).toContain(q.interval.id);
		}
	});

	it('choices are unique (no duplicate IDs)', () => {
		const state = createDefaultState();
		for (let i = 0; i < 50; i++) {
			const q = generateQuestion(state);
			const ids = q.choices.map((c) => c.id);
			expect(new Set(ids).size).toBe(ids.length);
		}
	});

	it('only uses unlocked intervals for the correct answer (50 iterations)', () => {
		const state = createDefaultState();
		// Default state: only tier 1 unlocked → P1, P5, P8
		const unlockedIds = ['P1', 'P5', 'P8'];
		for (let i = 0; i < 50; i++) {
			const q = generateQuestion(state);
			expect(unlockedIds).toContain(q.interval.id);
		}
	});

	it('respects enabledModes setting (ascending only)', () => {
		const state = createDefaultState();
		state.settings.enabledModes = { ascending: true, descending: false, harmonic: false };
		for (let i = 0; i < 30; i++) {
			const q = generateQuestion(state);
			expect(q.playMode).toBe('ascending');
		}
	});

	it('when only descending enabled, all questions are descending', () => {
		const state = createDefaultState();
		state.settings.enabledModes = { ascending: false, descending: true, harmonic: false };
		for (let i = 0; i < 30; i++) {
			const q = generateQuestion(state);
			expect(q.playMode).toBe('descending');
		}
	});
});

// ─── generateChordQuestion ──────────────────────────────────────────────────

describe('generateChordQuestion', () => {
	it('returns valid chord question with all required fields', () => {
		const state = createDefaultState();
		const q = generateChordQuestion(state);

		expect(q).toHaveProperty('chord');
		expect(q).toHaveProperty('voicing');
		expect(q).toHaveProperty('rootNote');
		expect(q).toHaveProperty('choices');
		expect(q.replays).toBe(0);
		expect(q.chord).toBeDefined();
		expect(q.chord.id).toBeDefined();
	});

	it('choices has exactly 4 items', () => {
		const state = createDefaultState();
		for (let i = 0; i < 20; i++) {
			const q = generateChordQuestion(state);
			expect(q.choices).toHaveLength(4);
		}
	});

	it('correct answer is in choices', () => {
		const state = createDefaultState();
		for (let i = 0; i < 50; i++) {
			const q = generateChordQuestion(state);
			const choiceIds = q.choices.map((c) => c.id);
			expect(choiceIds).toContain(q.chord.id);
		}
	});

	it('choices are unique', () => {
		const state = createDefaultState();
		for (let i = 0; i < 50; i++) {
			const q = generateChordQuestion(state);
			const ids = q.choices.map((c) => c.id);
			expect(new Set(ids).size).toBe(ids.length);
		}
	});

	it('respects enabledVoicings setting', () => {
		const state = createDefaultState();
		// Default: only root=true
		for (let i = 0; i < 20; i++) {
			const q = generateChordQuestion(state);
			expect(q.voicing).toBe('root');
		}

		// Enable first only
		state.settings.enabledVoicings = { root: false, first: true, second: false };
		for (let i = 0; i < 20; i++) {
			const q = generateChordQuestion(state);
			expect(q.voicing).toBe('first');
		}
	});
});

// ─── generateScaleQuestion ──────────────────────────────────────────────────

describe('generateScaleQuestion', () => {
	it('returns valid scale question with all required fields', () => {
		const state = createDefaultState();
		const q = generateScaleQuestion(state);

		expect(q).toHaveProperty('scale');
		expect(q).toHaveProperty('rootNote');
		expect(q).toHaveProperty('choices');
		expect(q.replays).toBe(0);
		expect(q.scale).toBeDefined();
		expect(q.scale.id).toBeDefined();
	});

	it('choices has exactly 4 items', () => {
		const state = createDefaultState();
		for (let i = 0; i < 20; i++) {
			const q = generateScaleQuestion(state);
			expect(q.choices).toHaveLength(4);
		}
	});

	it('correct answer is in choices', () => {
		const state = createDefaultState();
		for (let i = 0; i < 50; i++) {
			const q = generateScaleQuestion(state);
			const choiceIds = q.choices.map((c) => c.id);
			expect(choiceIds).toContain(q.scale.id);
		}
	});

	it('choices are unique', () => {
		const state = createDefaultState();
		for (let i = 0; i < 50; i++) {
			const q = generateScaleQuestion(state);
			const ids = q.choices.map((c) => c.id);
			expect(new Set(ids).size).toBe(ids.length);
		}
	});

	it('rootNote in MIDI range', () => {
		const state = createDefaultState();
		for (let i = 0; i < 50; i++) {
			const q = generateScaleQuestion(state);
			expect(q.rootNote).toBeGreaterThanOrEqual(48);
			expect(q.rootNote).toBeLessThanOrEqual(72);
		}
	});
});

// ─── generateModeQuestion ───────────────────────────────────────────────────

describe('generateModeQuestion', () => {
	it('returns valid mode question with devMode=true', () => {
		const state = createDefaultState();
		state.settings.devMode = true;
		const q = generateModeQuestion(state);

		expect(q).toHaveProperty('mode');
		expect(q).toHaveProperty('rootNote');
		expect(q).toHaveProperty('droneNote');
		expect(q).toHaveProperty('choices');
		expect(q.replays).toBe(0);
		expect(q.mode).toBeDefined();
		expect(q.mode.id).toBeDefined();
	});

	it('droneNote equals rootNote', () => {
		const state = createDefaultState();
		state.settings.devMode = true;
		for (let i = 0; i < 30; i++) {
			const q = generateModeQuestion(state);
			expect(q.droneNote).toBe(q.rootNote);
		}
	});

	it('choices has exactly 4 items', () => {
		const state = createDefaultState();
		state.settings.devMode = true;
		for (let i = 0; i < 20; i++) {
			const q = generateModeQuestion(state);
			expect(q.choices).toHaveLength(4);
		}
	});

	it('correct answer is in choices', () => {
		const state = createDefaultState();
		state.settings.devMode = true;
		for (let i = 0; i < 50; i++) {
			const q = generateModeQuestion(state);
			const choiceIds = q.choices.map((c) => c.id);
			expect(choiceIds).toContain(q.mode.id);
		}
	});
});

// ─── Weighted selection (statistical) ───────────────────────────────────────

describe('weighted selection', () => {
	it('weak intervals appear more often than strong intervals', () => {
		const state = createDefaultState();

		// Make P5 weak (20% accuracy)
		state.intervals['P5'].attempts = 20;
		state.intervals['P5'].correct = 4;
		state.intervals['P5'].modes.ascending.attempts = 20;
		state.intervals['P5'].modes.ascending.correct = 4;

		// Make P1 strong (95% accuracy)
		state.intervals['P1'].attempts = 20;
		state.intervals['P1'].correct = 19;
		state.intervals['P1'].modes.ascending.attempts = 20;
		state.intervals['P1'].modes.ascending.correct = 19;

		// Make P8 medium (70% accuracy)
		state.intervals['P8'].attempts = 20;
		state.intervals['P8'].correct = 14;
		state.intervals['P8'].modes.ascending.attempts = 20;
		state.intervals['P8'].modes.ascending.correct = 14;

		// Ascending only to eliminate mode variance
		state.settings.enabledModes = { ascending: true, descending: false, harmonic: false };

		const counts: Record<string, number> = { P1: 0, P5: 0, P8: 0 };
		for (let i = 0; i < 1000; i++) {
			const q = generateQuestion(state);
			counts[q.interval.id]++;
		}

		// Weak items (P5) should be picked more often than strong items (P1)
		expect(counts['P5']).toBeGreaterThan(counts['P1']);
	});
});
