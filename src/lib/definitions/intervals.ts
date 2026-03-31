// src/lib/definitions/intervals.ts — Pure interval definitions (v4)

export interface IntervalDef {
	id: string; // e.g. "P5", "m3", "TT"
	name: string; // e.g. "Perfect 5th"
	semitones: number; // 0-12
	tier: number; // 1-5
}

export const INTERVALS: IntervalDef[] = [
	{ id: 'P1', name: 'Unison', semitones: 0, tier: 1 },
	{ id: 'P5', name: 'Perfect 5th', semitones: 7, tier: 1 },
	{ id: 'P8', name: 'Octave', semitones: 12, tier: 1 },
	{ id: 'M3', name: 'Major 3rd', semitones: 4, tier: 2 },
	{ id: 'P4', name: 'Perfect 4th', semitones: 5, tier: 2 },
	{ id: 'm3', name: 'Minor 3rd', semitones: 3, tier: 3 },
	{ id: 'M6', name: 'Major 6th', semitones: 9, tier: 3 },
	{ id: 'm7', name: 'Minor 7th', semitones: 10, tier: 4 },
	{ id: 'M2', name: 'Major 2nd', semitones: 2, tier: 4 },
	{ id: 'm6', name: 'Minor 6th', semitones: 8, tier: 5 },
	{ id: 'M7', name: 'Major 7th', semitones: 11, tier: 5 },
	{ id: 'm2', name: 'Minor 2nd', semitones: 1, tier: 5 },
	{ id: 'TT', name: 'Tritone', semitones: 6, tier: 5 },
];

export function getIntervalsByTier(tier: number): IntervalDef[] {
	return INTERVALS.filter((i) => i.tier === tier);
}
