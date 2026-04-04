// src/lib/definitions/scales.ts — Pure scale definitions (v4)

import type { ContentPack } from '$lib/state/schema';

export type ScaleCategory = 'diatonic' | 'pentatonic' | 'symmetric';

export interface ScaleDef {
	id: string; // e.g. "major", "nat_min", "blues"
	name: string; // e.g. "Major", "Natural Minor"
	label: string; // short display label for quiz grid (e.g. "MAJ", "NTm")
	intervals: number[]; // semitones from root, e.g. [0,2,4,5,7,9,11,12]
	tier: number; // 1-3 unlock tier
	pack: ContentPack; // access gating
	category: ScaleCategory;
}

export const SCALES: ScaleDef[] = [
	// Tier 1 — Fundamentals
	{
		id: 'major',
		name: 'Major',
		label: 'Maj',
		intervals: [0, 2, 4, 5, 7, 9, 11, 12],
		tier: 1,
		pack: 'beginner',
		category: 'diatonic',
	},
	{
		id: 'nat_min',
		name: 'Natural Minor',
		label: 'NMIN',
		intervals: [0, 2, 3, 5, 7, 8, 10, 12],
		tier: 1,
		pack: 'beginner',
		category: 'diatonic',
	},

	// Tier 2 — Pentatonics + Modal scales
	{
		id: 'maj_pent',
		name: 'Major Pentatonic',
		label: 'MajP',
		intervals: [0, 2, 4, 7, 9, 12],
		tier: 2,
		pack: 'blues',
		category: 'pentatonic',
	},
	{
		id: 'min_pent',
		name: 'Minor Pentatonic',
		label: 'MinP',
		intervals: [0, 3, 5, 7, 10, 12],
		tier: 2,
		pack: 'blues',
		category: 'pentatonic',
	},
	{
		id: 'dorian_scale',
		name: 'Dorian',
		label: 'DOR',
		intervals: [0, 2, 3, 5, 7, 9, 10, 12],
		tier: 2,
		pack: 'blues',
		category: 'diatonic',
	},
	{
		id: 'mixolydian_scale',
		name: 'Mixolydian',
		label: 'MIX',
		intervals: [0, 2, 4, 5, 7, 9, 10, 12],
		tier: 2,
		pack: 'blues',
		category: 'diatonic',
	},

	// Tier 3 — Advanced
	{
		id: 'harm_min',
		name: 'Harmonic Minor',
		label: 'HMIN',
		intervals: [0, 2, 3, 5, 7, 8, 11, 12],
		tier: 3,
		pack: 'jazz',
		category: 'diatonic',
	},
	{
		id: 'blues',
		name: 'Blues',
		label: 'Blu',
		intervals: [0, 3, 5, 6, 7, 10, 12],
		tier: 3,
		pack: 'blues',
		category: 'pentatonic',
	},
	{
		id: 'whole',
		name: 'Whole Tone',
		label: 'Whol',
		intervals: [0, 2, 4, 6, 8, 10, 12],
		tier: 3,
		pack: 'advanced',
		category: 'symmetric',
	},
	{
		id: 'mel_min',
		name: 'Melodic Minor',
		label: 'MMIN',
		intervals: [0, 2, 3, 5, 7, 9, 11, 12],
		tier: 3,
		pack: 'jazz',
		category: 'diatonic',
	},
	{
		id: 'chromatic',
		name: 'Chromatic',
		label: 'Chr',
		intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
		tier: 3,
		pack: 'advanced',
		category: 'symmetric',
	},
	{
		id: 'maj_blues',
		name: 'Major Blues',
		label: 'MBLU',
		intervals: [0, 2, 3, 4, 7, 9, 12],
		tier: 3,
		pack: 'blues',
		category: 'pentatonic',
	},
	{
		id: 'bebop',
		name: 'Bebop',
		label: 'BOP',
		intervals: [0, 2, 4, 5, 7, 9, 10, 11, 12],
		tier: 3,
		pack: 'jazz',
		category: 'diatonic',
	},
	{
		id: 'lydian_scale',
		name: 'Lydian',
		label: 'LYD',
		intervals: [0, 2, 4, 6, 7, 9, 11, 12],
		tier: 3,
		pack: 'jazz',
		category: 'diatonic',
	},
	{
		id: 'phrygian_scale',
		name: 'Phrygian',
		label: 'PHR',
		intervals: [0, 1, 3, 5, 7, 8, 10, 12],
		tier: 3,
		pack: 'jazz',
		category: 'diatonic',
	},
	{
		id: 'locrian_scale',
		name: 'Locrian',
		label: 'LOC',
		intervals: [0, 1, 3, 5, 6, 8, 10, 12],
		tier: 3,
		pack: 'advanced',
		category: 'diatonic',
	},
];

export function getScalesByTier(tier: number): ScaleDef[] {
	return SCALES.filter((s) => s.tier === tier);
}
