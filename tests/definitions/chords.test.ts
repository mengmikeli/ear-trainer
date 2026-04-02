import { describe, it, expect } from 'vitest';
import {
	applyInversion,
	availableVoicings,
	maxInversionForNoteCount,
	CHORDS,
} from '$lib/definitions/chords';

describe('applyInversion', () => {
	it('applies root position for a triad', () => {
		expect(applyInversion([0, 4, 7], 'root')).toEqual([0, 4, 7]);
	});

	it('applies first inversion for a triad', () => {
		// [0, 4, 7] → move 0 up → [4, 7, 12]
		expect(applyInversion([0, 4, 7], 'first')).toEqual([4, 7, 12]);
	});

	it('applies second inversion for a triad', () => {
		// [0, 4, 7] → move 0 and 4 up → [7, 12, 16]
		expect(applyInversion([0, 4, 7], 'second')).toEqual([7, 12, 16]);
	});

	it('applies root position for a 2-note chord (Power)', () => {
		expect(applyInversion([0, 7], 'root')).toEqual([0, 7]);
	});

	it('applies first inversion for a 2-note chord', () => {
		// [0, 7] → move 0 up → [7, 12]
		expect(applyInversion([0, 7], 'first')).toEqual([7, 12]);
	});

	it('caps second inversion to first for a 2-note chord', () => {
		// 'second' on a 2-note chord should fall back to 'first'
		// [0, 7] → capped to first → [7, 12]
		expect(applyInversion([0, 7], 'second')).toEqual([7, 12]);
	});

	it('handles single-note arrays gracefully', () => {
		expect(applyInversion([0], 'root')).toEqual([0]);
		expect(applyInversion([0], 'first')).toEqual([0]);
		expect(applyInversion([0], 'second')).toEqual([0]);
	});

	it('works with 4-note (seventh) chords', () => {
		// [0, 4, 7, 10] root
		expect(applyInversion([0, 4, 7, 10], 'root')).toEqual([0, 4, 7, 10]);
		// first: move 0 up → [4, 7, 10, 12]
		expect(applyInversion([0, 4, 7, 10], 'first')).toEqual([4, 7, 10, 12]);
		// second: move 0 and 4 up → [7, 10, 12, 16]
		expect(applyInversion([0, 4, 7, 10], 'second')).toEqual([7, 10, 12, 16]);
	});
});

describe('availableVoicings', () => {
	it('returns only root for 1-note chord', () => {
		expect(availableVoicings(1)).toEqual(['root']);
	});

	it('returns root and first for 2-note chord', () => {
		expect(availableVoicings(2)).toEqual(['root', 'first']);
	});

	it('returns all three for 3+ note chords', () => {
		expect(availableVoicings(3)).toEqual(['root', 'first', 'second']);
		expect(availableVoicings(4)).toEqual(['root', 'first', 'second']);
	});
});

describe('maxInversionForNoteCount', () => {
	it('returns root for 1 note', () => {
		expect(maxInversionForNoteCount(1)).toBe('root');
	});

	it('returns first for 2 notes', () => {
		expect(maxInversionForNoteCount(2)).toBe('first');
	});

	it('returns second for 3+ notes', () => {
		expect(maxInversionForNoteCount(3)).toBe('second');
		expect(maxInversionForNoteCount(4)).toBe('second');
	});
});

describe('CHORDS definitions', () => {
	it('Power chord has exactly 2 intervals', () => {
		const pow = CHORDS.find((c) => c.id === 'pow');
		expect(pow).toBeDefined();
		expect(pow!.intervals).toEqual([0, 7]);
		expect(pow!.intervals.length).toBe(2);
	});

	it('Sus2 and Sus4 have 3 intervals', () => {
		const sus2 = CHORDS.find((c) => c.id === 'sus2');
		const sus4 = CHORDS.find((c) => c.id === 'sus4');
		expect(sus2!.intervals.length).toBe(3);
		expect(sus4!.intervals.length).toBe(3);
	});
});
