import type { ChordDef, ChordState } from './types';

export const CHORDS: ChordDef[] = [
	// Tier 1 — Triads (unlocked when chord system is discovered)
	{ id: 'maj', name: 'Major', intervals: [0, 4, 7], tier: 1, category: 'triad' },
	{ id: 'min', name: 'Minor', intervals: [0, 3, 7], tier: 1, category: 'triad' },

	// Tier 2 — Altered triads
	{ id: 'dim', name: 'Diminished', intervals: [0, 3, 6], tier: 2, category: 'triad' },
	{ id: 'aug', name: 'Augmented', intervals: [0, 4, 8], tier: 2, category: 'triad' },

	// Tier 3 — Seventh chords
	{ id: 'dom7', name: 'Dominant 7th', intervals: [0, 4, 7, 10], tier: 3, category: 'seventh' },
	{ id: 'maj7', name: 'Major 7th', intervals: [0, 4, 7, 11], tier: 3, category: 'seventh' },
	{ id: 'min7', name: 'Minor 7th', intervals: [0, 3, 7, 10], tier: 3, category: 'seventh' },

	// Tier 4 — Extended seventh chords
	{ id: 'dim7', name: 'Diminished 7th', intervals: [0, 3, 6, 9], tier: 4, category: 'seventh' },
	{ id: 'hdim7', name: 'Half-dim 7th', label: 'HD7', intervals: [0, 3, 6, 10], tier: 4, category: 'seventh' },
	{ id: 'aug7', name: 'Augmented 7th', intervals: [0, 4, 8, 10], tier: 4, category: 'seventh' },
];

export function getChordsByTier(tier: number): ChordDef[] {
	return CHORDS.filter((c) => c.tier === tier);
}

export function getChordById(id: string): ChordDef | undefined {
	return CHORDS.find((c) => c.id === id);
}

export function getUnlockedChords(states: Record<string, ChordState>): ChordDef[] {
	return CHORDS.filter((c) => states[c.id]?.unlocked);
}

export function getEnabledChords(states: Record<string, ChordState>): ChordDef[] {
	return CHORDS.filter((c) => states[c.id]?.unlocked && states[c.id]?.enabled);
}

/**
 * Apply inversion to a set of intervals (semitones from root).
 * - root: intervals as-is
 * - first: move lowest note up an octave
 * - second: move two lowest notes up an octave
 */
export function applyInversion(intervals: number[], voicing: 'root' | 'first' | 'second'): number[] {
	const sorted = [...intervals].sort((a, b) => a - b);
	if (voicing === 'root') return sorted;
	if (voicing === 'first') {
		// Move bottom note up 12
		const [bottom, ...rest] = sorted;
		return [...rest, bottom + 12].sort((a, b) => a - b);
	}
	// second inversion: move bottom two up 12
	const [first, second, ...rest] = sorted;
	return [...rest, first + 12, second + 12].sort((a, b) => a - b);
}
