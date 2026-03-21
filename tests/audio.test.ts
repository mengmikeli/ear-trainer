import { describe, it, expect } from 'vitest';
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
