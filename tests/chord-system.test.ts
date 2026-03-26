import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDefaultState, loadState, saveState, checkTierUnlock, getChordAggregateStats } from '$lib/state';
import { CHORDS } from '$lib/chords';
import type { ChordState, ModeStats } from '$lib/types';

const storage = new Map<string, string>();
const mockLocalStorage = {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => storage.set(key, value),
	removeItem: (key: string) => storage.delete(key),
	clear: () => storage.clear(),
} as unknown as Storage;

function setChordVoicingStats(chord: ChordState, voicing: keyof ChordState['voicings'], attempts: number, correct: number) {
	chord.voicings[voicing].attempts = attempts;
	chord.voicings[voicing].correct = correct;
	chord.attempts = chord.voicings.root.attempts + chord.voicings.first.attempts + chord.voicings.second.attempts;
	chord.correct = chord.voicings.root.correct + chord.voicings.first.correct + chord.voicings.second.correct;
}

describe('createDefaultState — chord fields', () => {
	it('has all 10 chords', () => {
		const state = createDefaultState();
		expect(Object.keys(state.chords)).toHaveLength(10);
	});

	it('tier 1 chords (maj, min) are unlocked', () => {
		const state = createDefaultState();
		expect(state.chords['maj'].unlocked).toBe(true);
		expect(state.chords['min'].unlocked).toBe(true);
	});

	it('tier 2+ chords are locked', () => {
		const state = createDefaultState();
		expect(state.chords['dim'].unlocked).toBe(false);
		expect(state.chords['aug'].unlocked).toBe(false);
		expect(state.chords['dom7'].unlocked).toBe(false);
	});

	it('all chords have initialized voicings with zeroed stats', () => {
		const state = createDefaultState();
		for (const id of Object.keys(state.chords)) {
			const chord = state.chords[id];
			expect(chord.voicings).toBeDefined();
			for (const voicing of ['root', 'first', 'second'] as const) {
				expect(chord.voicings[voicing].attempts).toBe(0);
				expect(chord.voicings[voicing].correct).toBe(0);
				expect(chord.voicings[voicing].easeFactor).toBe(2.5);
			}
		}
	});

	it('settings has enabledVoicings with root enabled, inversions locked', () => {
		const state = createDefaultState();
		expect(state.settings.enabledVoicings).toEqual({
			root: true,
			first: false,
			second: false,
		});
	});

	it('activeContent defaults to intervals', () => {
		const state = createDefaultState();
		expect(state.settings.activeContent).toBe('intervals');
	});
});

describe('v3 → v3.3 migration — chord state', () => {
	beforeEach(() => storage.clear());

	it('adds chords field to old state missing it', () => {
		const oldState = createDefaultState();
		delete (oldState as any).chords;
		delete (oldState as any).settings.enabledVoicings;
		delete (oldState as any).settings.activeContent;
		storage.set('ear-trainer-state', JSON.stringify(oldState));

		const loaded = loadState(mockLocalStorage);
		expect(Object.keys(loaded.chords)).toHaveLength(10);
		expect(loaded.chords['maj'].unlocked).toBe(true);
		expect(loaded.chords['dim'].unlocked).toBe(false);
		expect(loaded.settings.enabledVoicings).toEqual({ root: true, first: false, second: false });
		expect(loaded.settings.activeContent).toBe('intervals');
	});

	it('preserves existing interval data during chord migration', () => {
		const oldState = createDefaultState();
		oldState.intervals['P1'].attempts = 42;
		oldState.intervals['P1'].correct = 35;
		oldState.stats.totalSessions = 10;
		delete (oldState as any).chords;
		storage.set('ear-trainer-state', JSON.stringify(oldState));

		const loaded = loadState(mockLocalStorage);
		expect(loaded.intervals['P1'].attempts).toBe(42);
		expect(loaded.intervals['P1'].correct).toBe(35);
		expect(loaded.stats.totalSessions).toBe(10);
		expect(Object.keys(loaded.chords)).toHaveLength(10);
	});
});

describe('getChordAggregateStats', () => {
	it('sums stats across all voicings', () => {
		const state = createDefaultState();
		const chord = state.chords['maj'];
		chord.voicings.root.attempts = 10;
		chord.voicings.root.correct = 8;
		chord.voicings.first.attempts = 5;
		chord.voicings.first.correct = 3;
		chord.voicings.second.attempts = 3;
		chord.voicings.second.correct = 2;

		const agg = getChordAggregateStats(chord);
		expect(agg.attempts).toBe(18);
		expect(agg.correct).toBe(13);
		expect(agg.accuracy).toBeCloseTo(13 / 18);
	});

	it('returns zero accuracy when no attempts', () => {
		const state = createDefaultState();
		const agg = getChordAggregateStats(state.chords['maj']);
		expect(agg.attempts).toBe(0);
		expect(agg.accuracy).toBe(0);
	});
});

describe('checkTierUnlock — chord tiers', () => {
	it('unlocks chord tier 2 when 10+ chord questions with 70%+ accuracy', () => {
		const state = createDefaultState();
		setChordVoicingStats(state.chords['maj'], 'root', 6, 5);
		setChordVoicingStats(state.chords['min'], 'root', 5, 4);
		// Total: 11 attempts, 9 correct = 81.8%
		const updated = checkTierUnlock(state);
		expect(updated.chords['dim'].unlocked).toBe(true);
		expect(updated.chords['aug'].unlocked).toBe(true);
	});

	it('does not unlock chord tier 2 with insufficient questions', () => {
		const state = createDefaultState();
		setChordVoicingStats(state.chords['maj'], 'root', 4, 4);
		setChordVoicingStats(state.chords['min'], 'root', 4, 4);
		// Total: 8 attempts < 10
		const updated = checkTierUnlock(state);
		expect(updated.chords['dim'].unlocked).toBe(false);
	});

	it('does not unlock chord tier 2 with low accuracy', () => {
		const state = createDefaultState();
		setChordVoicingStats(state.chords['maj'], 'root', 8, 3);
		setChordVoicingStats(state.chords['min'], 'root', 8, 3);
		// Total: 16 attempts, 6 correct = 37.5% < 70%
		const updated = checkTierUnlock(state);
		expect(updated.chords['dim'].unlocked).toBe(false);
	});

	it('does not unlock chord tier 3 before tier 2', () => {
		const state = createDefaultState();
		// Enough for tier 3 threshold (30q) but tier 2 not explicitly unlocked
		setChordVoicingStats(state.chords['maj'], 'root', 20, 16);
		setChordVoicingStats(state.chords['min'], 'root', 15, 12);
		// Total: 35 attempts, 28 correct = 80%
		// This should unlock tier 2 first, then tier 3
		const updated = checkTierUnlock(state);
		expect(updated.chords['dim'].unlocked).toBe(true);   // tier 2
		expect(updated.chords['aug'].unlocked).toBe(true);   // tier 2
		expect(updated.chords['dom7'].unlocked).toBe(true);  // tier 3
		expect(updated.chords['maj7'].unlocked).toBe(true);  // tier 3
	});

	it('chord unlock is independent of interval unlock', () => {
		const state = createDefaultState();
		// No interval progress, but plenty of chord progress
		setChordVoicingStats(state.chords['maj'], 'root', 6, 5);
		setChordVoicingStats(state.chords['min'], 'root', 6, 5);
		const updated = checkTierUnlock(state);
		// Chords should unlock independently
		expect(updated.chords['dim'].unlocked).toBe(true);
		// Intervals stay locked (no progress)
		expect(updated.intervals['M3'].unlocked).toBe(false);
	});
});

describe('playChord — with mocked Web Audio API', () => {
	let lastMockCtx: any;

	beforeEach(() => {
		vi.resetModules();
		(globalThis as any).window = globalThis;
		(globalThis as any).AudioContext = vi.fn(function (this: any) {
			lastMockCtx = {
				currentTime: 0,
				sampleRate: 44100,
				state: 'running',
				destination: {},
				resume: vi.fn(),
				createOscillator: vi.fn(() => ({
					type: 'sine' as string,
					frequency: { value: 440 },
					connect: vi.fn(),
					start: vi.fn(),
					stop: vi.fn()
				})),
				createGain: vi.fn(() => ({
					gain: {
						value: 1,
						setValueAtTime: vi.fn(),
						linearRampToValueAtTime: vi.fn(),
						exponentialRampToValueAtTime: vi.fn()
					},
					connect: vi.fn()
				})),
				createAnalyser: vi.fn(() => ({
					fftSize: 256,
					frequencyBinCount: 128,
					smoothingTimeConstant: 0.8,
					connect: vi.fn(),
					getByteTimeDomainData: vi.fn()
				})),
				createBiquadFilter: vi.fn(() => ({
					type: 'lowpass' as string,
					frequency: { value: 1000 },
					Q: { value: 1 },
					connect: vi.fn()
				})),
				createBuffer: vi.fn(() => ({})),
				createBufferSource: vi.fn(() => ({
					buffer: null as any,
					connect: vi.fn(),
					start: vi.fn()
				}))
			};
			Object.assign(this, lastMockCtx);
		});
	});

	it('plays block chord without throwing', async () => {
		const { playChord } = await import('$lib/audio');
		expect(() => playChord(60, [0, 4, 7], 'root', 'epiano', false)).not.toThrow();
	});

	it('plays arpeggiated chord without throwing', async () => {
		const { playChord } = await import('$lib/audio');
		expect(() => playChord(60, [0, 4, 7], 'root', 'epiano', true)).not.toThrow();
	});

	it('plays with all tone types', async () => {
		const { playChord } = await import('$lib/audio');
		expect(() => playChord(60, [0, 4, 7], 'root', 'sine', false)).not.toThrow();
		expect(() => playChord(60, [0, 4, 7], 'root', 'piano', false)).not.toThrow();
		expect(() => playChord(60, [0, 4, 7], 'root', 'epiano', false)).not.toThrow();
	});

	it('plays 7th chord (4 notes) without throwing', async () => {
		const { playChord } = await import('$lib/audio');
		expect(() => playChord(60, [0, 4, 7, 10], 'root', 'epiano', false)).not.toThrow();
	});

	it('plays with inversions without throwing', async () => {
		const { playChord } = await import('$lib/audio');
		expect(() => playChord(60, [0, 4, 7], 'first', 'epiano', false)).not.toThrow();
		expect(() => playChord(60, [0, 4, 7], 'second', 'epiano', false)).not.toThrow();
	});

	it('creates oscillators for each note in the chord', async () => {
		const { playChord } = await import('$lib/audio');
		playChord(60, [0, 4, 7], 'root', 'sine', false);
		// Sine creates 2 oscillators per note (main + sub), plus 1 for initial silent buffer
		// 3 notes × 2 oscillators = 6, plus 1 buffer source
		const oscCount = lastMockCtx.createOscillator.mock.calls.length;
		expect(oscCount).toBeGreaterThanOrEqual(3); // at least 1 per note
	});
});
