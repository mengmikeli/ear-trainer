// src/lib/definitions/modes.ts — Pure mode definitions (v4)

export interface ModeDef {
	id: string;
	name: string;
	label: string;
	parent: string; // parent scale id
	degree: number; // degree of parent scale (1-indexed)
	intervals: number[]; // semitones from root
	tier: number;
	category: 'mode';
	characteristic: number[]; // semitones that distinguish this mode
}

export const MODES: ModeDef[] = [
	// Tier 1 — unlocked by default (the two fundamentals)
	{
		id: 'ionian',
		name: 'Ionian (Major)',
		label: 'Ion',
		parent: 'major',
		degree: 1,
		intervals: [0, 2, 4, 5, 7, 9, 11, 12],
		tier: 1,
		category: 'mode',
		characteristic: [4, 11], // M3 + M7 (bright, resolved)
	},
	{
		id: 'aeolian',
		name: 'Aeolian (Minor)',
		label: 'Aeo',
		parent: 'major',
		degree: 6,
		intervals: [0, 2, 3, 5, 7, 8, 10, 12],
		tier: 1,
		category: 'mode',
		characteristic: [3, 8, 10], // m3 + m6 + m7 (dark, melancholy)
	},

	// Tier 2 — most common after major/minor
	{
		id: 'dorian',
		name: 'Dorian',
		label: 'Dor',
		parent: 'major',
		degree: 2,
		intervals: [0, 2, 3, 5, 7, 9, 10, 12],
		tier: 2,
		category: 'mode',
		characteristic: [3, 10], // m3 + m7 (minor feel but bright 6th)
	},
	{
		id: 'mixolydian',
		name: 'Mixolydian',
		label: 'Mix',
		parent: 'major',
		degree: 5,
		intervals: [0, 2, 4, 5, 7, 9, 10, 12],
		tier: 2,
		category: 'mode',
		characteristic: [10], // m7 (major but with flat 7)
	},

	// Tier 3 — distinctive color modes
	{
		id: 'phrygian',
		name: 'Phrygian',
		label: 'Phr',
		parent: 'major',
		degree: 3,
		intervals: [0, 1, 3, 5, 7, 8, 10, 12],
		tier: 3,
		category: 'mode',
		characteristic: [1], // m2 (the "Spanish" flavor)
	},
	{
		id: 'lydian',
		name: 'Lydian',
		label: 'Lyd',
		parent: 'major',
		degree: 4,
		intervals: [0, 2, 4, 6, 7, 9, 11, 12],
		tier: 3,
		category: 'mode',
		characteristic: [6], // aug4/TT (the "dreamy" interval)
	},
	{
		id: 'locrian',
		name: 'Locrian',
		label: 'Loc',
		parent: 'major',
		degree: 7,
		intervals: [0, 1, 3, 5, 6, 8, 10, 12],
		tier: 3,
		category: 'mode',
		characteristic: [1, 6], // m2 + dim5 (unstable, diminished feel)
	},
];

export function getModesByTier(tier: number): ModeDef[] {
	return MODES.filter((m) => m.tier === tier);
}
