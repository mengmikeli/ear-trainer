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
		resume: vi.fn().mockResolvedValue(undefined),
		suspend: vi.fn().mockResolvedValue(undefined),
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
					exponentialRampToValueAtTime: vi.fn(),
					cancelScheduledValues: vi.fn()
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
		}),
		createAnalyser: vi.fn(function () {
			return {
				fftSize: 256,
				frequencyBinCount: 128,
				smoothingTimeConstant: 0.8,
				connect: vi.fn(),
				getByteTimeDomainData: vi.fn()
			};
		})
	};
}

describe('playInterval — with mocked Web Audio API', () => {
	let lastMockCtx: ReturnType<typeof createMockAudioContext>;

	beforeEach(() => {
		vi.resetModules();
		(globalThis as any).window = globalThis;
		(globalThis as any).AudioContext = vi.fn(function (this: any) {
			lastMockCtx = createMockAudioContext();
			Object.assign(this, lastMockCtx);
		});
	});

	it('plays harmonic interval with sine tone', async () => {
		const { playInterval } = await import('$lib/audio');
		await playInterval(60, 7, 'harmonic', 'sine');
	});

	it('plays harmonic interval with piano tone', async () => {
		const { playInterval } = await import('$lib/audio');
		await playInterval(60, 7, 'harmonic', 'piano');
	});

	it('plays ascending interval', async () => {
		const { playInterval } = await import('$lib/audio');
		await playInterval(60, 7, 'ascending', 'sine');
	});

	it('plays descending interval', async () => {
		const { playInterval } = await import('$lib/audio');
		await playInterval(60, 7, 'descending', 'sine');
	});

	it('harmonic mode starts all oscillators at the same time', async () => {
		const { playInterval } = await import('$lib/audio');
		await playInterval(60, 7, 'harmonic', 'sine');

		const oscResults = lastMockCtx!.createOscillator.mock.results;
		for (const result of oscResults) {
			const startCalls = result.value.start.mock.calls;
			expect(startCalls.length).toBe(1);
			expect(startCalls[0][0]).toBe(0);
		}
	});
});

describe('playScale — with mocked Web Audio API', () => {
	let lastMockCtx: ReturnType<typeof createMockAudioContext>;

	beforeEach(() => {
		vi.resetModules();
		(globalThis as any).window = globalThis;
		(globalThis as any).AudioContext = vi.fn(function (this: any) {
			lastMockCtx = createMockAudioContext();
			Object.assign(this, lastMockCtx);
		});
	});

	it('plays a major scale', async () => {
		const { playScale } = await import('$lib/audio');
		await playScale(60, [0, 2, 4, 5, 7, 9, 11, 12], 'epiano', 150);
	});

	it('plays with all tone types', async () => {
		const { playScale } = await import('$lib/audio');
		const intervals = [0, 2, 4, 5, 7, 9, 11, 12];
		await playScale(60, intervals, 'sine', 150);
		await playScale(60, intervals, 'piano', 150);
		await playScale(60, intervals, 'epiano', 150);
	});

	it('plays pentatonic scale (6 notes)', async () => {
		const { playScale } = await import('$lib/audio');
		await playScale(60, [0, 2, 4, 7, 9, 12], 'sine', 150);
		const oscCount = lastMockCtx!.createOscillator.mock.calls.length;
		expect(oscCount).toBeGreaterThanOrEqual(6);
	});

	it('plays chromatic scale (13 notes)', async () => {
		const { playScale } = await import('$lib/audio');
		await playScale(60, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'sine', 150);
		const oscCount = lastMockCtx!.createOscillator.mock.calls.length;
		expect(oscCount).toBeGreaterThanOrEqual(13);
	});

	it('plays blues scale (7 notes)', async () => {
		const { playScale } = await import('$lib/audio');
		await playScale(60, [0, 3, 5, 6, 7, 10, 12], 'sine', 150);
		const oscCount = lastMockCtx!.createOscillator.mock.calls.length;
		expect(oscCount).toBeGreaterThanOrEqual(7);
	});

	it('plays with slow tempo', async () => {
		const { playScale } = await import('$lib/audio');
		await playScale(60, [0, 2, 4, 5, 7, 9, 11, 12], 'epiano', 250);
	});

	it('plays at boundary MIDI values', async () => {
		const { playScale } = await import('$lib/audio');
		await playScale(48, [0, 2, 4, 5, 7, 9, 11, 12], 'sine', 150);
		await playScale(72, [0, 2, 4, 7, 9, 12], 'sine', 150);
	});

	it('uses default tempo when not specified', async () => {
		const { playScale } = await import('$lib/audio');
		await playScale(60, [0, 2, 4, 5, 7, 9, 11, 12], 'epiano');
	});

	it('schedules notes sequentially (not all at time 0)', async () => {
		const { playScale } = await import('$lib/audio');
		await playScale(60, [0, 2, 4, 5, 7, 9, 11, 12], 'sine', 150);

		const oscResults = lastMockCtx!.createOscillator.mock.results;
		const startTimes: number[] = [];
		for (const result of oscResults) {
			const calls = result.value.start.mock.calls;
			if (calls.length > 0) {
				startTimes.push(calls[0][0]);
			}
		}
		const unique = new Set(startTimes);
		expect(unique.size).toBeGreaterThan(1);
	});
});
