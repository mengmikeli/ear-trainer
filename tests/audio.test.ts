import { describe, it, expect, vi, beforeEach } from 'vitest';
import { midiToFreq } from '$lib/audio';

describe('midiToFreq', () => {
	it('converts A4 (MIDI 69) to 440Hz', () => {
		expect(midiToFreq(69)).toBeCloseTo(440, 1);
	});
	it('converts C4 (MIDI 60) to ~261.6Hz', () => {
		expect(midiToFreq(60)).toBeCloseTo(261.63, 0);
	});
	it('converts C3 (MIDI 48) to ~130.8Hz', () => {
		expect(midiToFreq(48)).toBeCloseTo(130.81, 0);
	});
});

function createMockAudioContext() {
	return {
		currentTime: 0,
		sampleRate: 44100,
		state: 'running',
		destination: {},
		resume: vi.fn(),
		createOscillator: vi.fn(function () {
			return {
				type: 'sine' as string,
				frequency: { value: 440 },
				connect: vi.fn(),
				start: vi.fn(),
				stop: vi.fn()
			};
		}),
		createGain: vi.fn(function () {
			return {
				gain: {
					value: 1,
					setValueAtTime: vi.fn(),
					linearRampToValueAtTime: vi.fn(),
					exponentialRampToValueAtTime: vi.fn()
				},
				connect: vi.fn()
			};
		}),
		createBiquadFilter: vi.fn(function () {
			return {
				type: 'lowpass' as string,
				frequency: { value: 1000 },
				Q: { value: 1 },
				connect: vi.fn()
			};
		}),
		createBuffer: vi.fn(function () {
			return {};
		}),
		createBufferSource: vi.fn(function () {
			return {
				buffer: null as any,
				connect: vi.fn(),
				start: vi.fn()
			};
		})
	};
}

describe('playInterval — with mocked Web Audio API', () => {
	let lastMockCtx: ReturnType<typeof createMockAudioContext>;

	beforeEach(() => {
		vi.resetModules();
		// audio.ts uses `window.AudioContext` with `new`, so we need a proper constructor
		(globalThis as any).window = globalThis;
		(globalThis as any).AudioContext = vi.fn(function (this: any) {
			lastMockCtx = createMockAudioContext();
			Object.assign(this, lastMockCtx);
		});
	});

	it('plays harmonic interval with sine tone without throwing', async () => {
		const { playInterval } = await import('$lib/audio');
		expect(() => playInterval(60, 7, 'harmonic', 'sine')).not.toThrow();
	});

	it('plays harmonic interval with piano tone without throwing', async () => {
		const { playInterval } = await import('$lib/audio');
		expect(() => playInterval(60, 7, 'harmonic', 'piano')).not.toThrow();
	});

	it('plays ascending interval without throwing (regression)', async () => {
		const { playInterval } = await import('$lib/audio');
		expect(() => playInterval(60, 7, 'ascending', 'sine')).not.toThrow();
	});

	it('plays descending interval without throwing (regression)', async () => {
		const { playInterval } = await import('$lib/audio');
		expect(() => playInterval(60, 7, 'descending', 'sine')).not.toThrow();
	});

	it('harmonic mode starts all oscillators at the same time', async () => {
		const { playInterval } = await import('$lib/audio');
		playInterval(60, 7, 'harmonic', 'sine');

		// All oscillators should start at time 0 (currentTime)
		const oscResults = lastMockCtx!.createOscillator.mock.results;
		for (const result of oscResults) {
			const startCalls = result.value.start.mock.calls;
			expect(startCalls.length).toBe(1);
			expect(startCalls[0][0]).toBe(0);
		}
	});
});
