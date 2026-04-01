// src/lib/definitions/chords.ts — Pure chord definitions (v4)

export type ChordCategory = 'triad' | 'seventh';
export type ChordVoicing = 'root' | 'first' | 'second';

export interface ChordDef {
	id: string; // e.g. "maj", "min", "dim", "aug", "dom7"
	name: string; // e.g. "Major", "Minor 7th"
	label?: string; // short display label (defaults to id.toUpperCase())
	intervals: number[]; // semitones from root, e.g. [0, 4, 7]
	tier: number; // 1-4 unlock tier (chord-specific)
	category: ChordCategory;
}

export const CHORDS: ChordDef[] = [
	// Tier 1 — Triads (unlocked when chord system is discovered)
	{ id: 'maj', name: 'Major', label: 'Maj', intervals: [0, 4, 7], tier: 1, category: 'triad' },
	{ id: 'min', name: 'Minor', label: 'Min', intervals: [0, 3, 7], tier: 1, category: 'triad' },

	// Tier 2 — Altered triads
	{ id: 'dim', name: 'Diminished', label: 'Dim', intervals: [0, 3, 6], tier: 2, category: 'triad' },
	{ id: 'aug', name: 'Augmented', label: 'Aug', intervals: [0, 4, 8], tier: 2, category: 'triad' },

	// Tier 3 — Seventh chords
	{
		id: 'dom7',
		name: 'Dominant 7th',
		label: 'Dom7',
		intervals: [0, 4, 7, 10],
		tier: 3,
		category: 'seventh',
	},
	{
		id: 'maj7',
		name: 'Major 7th',
		label: 'Maj7',
		intervals: [0, 4, 7, 11],
		tier: 3,
		category: 'seventh',
	},
	{
		id: 'min7',
		name: 'Minor 7th',
		label: 'Min7',
		intervals: [0, 3, 7, 10],
		tier: 3,
		category: 'seventh',
	},

	// Tier 4 — Extended seventh chords
	{
		id: 'dim7',
		name: 'Diminished 7th',
		label: 'Dim7',
		intervals: [0, 3, 6, 9],
		tier: 4,
		category: 'seventh',
	},
	{
		id: 'hdim7',
		name: 'Half-dim 7th',
		label: 'hDim7',
		intervals: [0, 3, 6, 10],
		tier: 4,
		category: 'seventh',
	},
	{
		id: 'aug7',
		name: 'Augmented 7th',
		label: 'Aug7',
		intervals: [0, 4, 8, 10],
		tier: 4,
		category: 'seventh',
	},

	// Tier 4 — Suspended & Power chords
	{ id: 'sus2', name: 'Suspended 2nd', label: 'SUS2', intervals: [0, 2, 7], tier: 4, category: 'triad' },
	{ id: 'sus4', name: 'Suspended 4th', label: 'SUS4', intervals: [0, 5, 7], tier: 4, category: 'triad' },
	{ id: 'pow', name: 'Power Chord', label: 'PWR', intervals: [0, 7], tier: 4, category: 'triad' },
];

export function getChordsByTier(tier: number): ChordDef[] {
	return CHORDS.filter((c) => c.tier === tier);
}

/**
 * Maximum inversion level supported for a given number of notes.
 * 2-note chords only support root + first; 3+ support all three.
 */
export function maxInversionForNoteCount(n: number): ChordVoicing {
	if (n <= 1) return 'root';
	if (n <= 2) return 'first';
	return 'second';
}

/**
 * Return the voicings available for a chord with the given number of notes.
 */
export function availableVoicings(noteCount: number): ChordVoicing[] {
	if (noteCount <= 1) return ['root'];
	if (noteCount <= 2) return ['root', 'first'];
	return ['root', 'first', 'second'];
}

/**
 * Apply inversion to a set of intervals (semitones from root).
 * - root: intervals as-is
 * - first: move lowest note up an octave
 * - second: move two lowest notes up an octave
 *
 * For chords with fewer than 3 notes, 'second' inversion is capped
 * to the maximum supported level (e.g. 'first' for 2-note chords).
 */
export function applyInversion(
	intervals: number[],
	voicing: 'root' | 'first' | 'second',
): number[] {
	const sorted = [...intervals].sort((a, b) => a - b);

	// Cap inversion for chords with fewer notes than the voicing requires
	const allowed = availableVoicings(sorted.length);
	const effective = allowed.includes(voicing) ? voicing : allowed[allowed.length - 1];

	if (effective === 'root') return sorted;
	if (effective === 'first') {
		// Move bottom note up 12
		const [bottom, ...rest] = sorted;
		return [...rest, bottom + 12].sort((a, b) => a - b);
	}
	// second inversion: move bottom two up 12
	const [first, second, ...rest] = sorted;
	return [...rest, first + 12, second + 12].sort((a, b) => a - b);
}
