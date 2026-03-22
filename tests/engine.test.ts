import { describe, it, expect } from 'vitest';
import { pickInterval, pickMode, generateQuestion, generateDistractors, pickChord, pickVoicing, generateChordDistractors, generateChordQuestion } from '$lib/engine';
import { createDefaultState } from '$lib/state';
import { INTERVALS } from '$lib/intervals';
import { CHORDS } from '$lib/chords';

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
		state.intervals['P1'].enabled = false;
		state.intervals['P5'].enabled = false;
		for (let i = 0; i < 20; i++) {
			const picked = pickInterval(state);
			expect(picked.id).toBe('P8');
		}
	});
});

// --- Chord engine tests ---

describe('pickChord', () => {
	it('only picks from unlocked+enabled chords', () => {
		const state = createDefaultState();
		for (let i = 0; i < 50; i++) {
			const picked = pickChord(state);
			expect(['maj', 'min']).toContain(picked.id);
		}
	});

	it('prefers weaker chords', () => {
		const state = createDefaultState();
		state.chords['maj'].attempts = 20;
		state.chords['maj'].correct = 20;
		state.chords['min'].attempts = 20;
		state.chords['min'].correct = 5;

		const counts: Record<string, number> = { maj: 0, min: 0 };
		for (let i = 0; i < 200; i++) {
			counts[pickChord(state).id]++;
		}
		expect(counts['min']).toBeGreaterThan(counts['maj']);
	});

	it('throws when no chords are enabled', () => {
		const state = createDefaultState();
		state.chords['maj'].enabled = false;
		state.chords['min'].enabled = false;
		expect(() => pickChord(state)).toThrow('No enabled chords');
	});
});

describe('pickVoicing', () => {
	it('returns only enabled voicings', () => {
		const state = createDefaultState();
		const chord = CHORDS.find(c => c.id === 'maj')!;
		for (let i = 0; i < 30; i++) {
			expect(pickVoicing(state, chord)).toBe('root');
		}
	});

	it('picks from multiple enabled voicings', () => {
		const state = createDefaultState();
		state.settings.enabledVoicings = { root: true, first: true, second: false };
		const chord = CHORDS.find(c => c.id === 'maj')!;
		const seen = new Set<string>();
		for (let i = 0; i < 100; i++) {
			seen.add(pickVoicing(state, chord));
		}
		expect(seen).toContain('root');
		expect(seen).toContain('first');
		expect(seen).not.toContain('second');
	});

	it('throws when no voicings enabled', () => {
		const state = createDefaultState();
		state.settings.enabledVoicings = { root: false, first: false, second: false };
		const chord = CHORDS.find(c => c.id === 'maj')!;
		expect(() => pickVoicing(state, chord)).toThrow('No enabled voicings');
	});
});

describe('generateChordDistractors', () => {
	it('returns exactly 3 distractors', () => {
		const state = createDefaultState();
		const distractors = generateChordDistractors('maj', state);
		expect(distractors).toHaveLength(3);
	});

	it('does not include the correct answer', () => {
		const state = createDefaultState();
		const distractors = generateChordDistractors('maj', state);
		expect(distractors.map(d => d.id)).not.toContain('maj');
	});

	it('fills from locked chords when not enough enabled', () => {
		const state = createDefaultState();
		const distractors = generateChordDistractors('maj', state);
		expect(distractors).toHaveLength(3);
		expect(distractors.map(d => d.id)).toContain('min');
	});
});

describe('generateChordQuestion', () => {
	it('returns a valid chord question', () => {
		const state = createDefaultState();
		const q = generateChordQuestion(state);
		expect(q.rootNote).toBeGreaterThanOrEqual(48);
		expect(q.rootNote).toBeLessThanOrEqual(72);
		expect(q.choices.length).toBeGreaterThanOrEqual(2);
		expect(q.choices.length).toBeLessThanOrEqual(4);
		expect(q.choices.map(c => c.id)).toContain(q.chord.id);
		expect(['root', 'first', 'second']).toContain(q.voicing);
		expect(q.replays).toBe(0);
	});

	it('chord is always from unlocked set', () => {
		const state = createDefaultState();
		for (let i = 0; i < 50; i++) {
			const q = generateChordQuestion(state);
			expect(['maj', 'min']).toContain(q.chord.id);
		}
	});

	it('voicing matches enabled voicings setting', () => {
		const state = createDefaultState();
		state.settings.enabledVoicings = { root: false, first: true, second: false };
		for (let i = 0; i < 20; i++) {
			const q = generateChordQuestion(state);
			expect(q.voicing).toBe('first');
		}
	});
});
