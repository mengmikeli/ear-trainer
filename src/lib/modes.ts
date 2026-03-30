// src/lib/modes.ts — Musical mode definitions (v3.5)

export interface ModeDef {
	id: string;
	name: string;
	label: string;
	parent: string;         // parent scale id
	degree: number;         // degree of parent scale (1-indexed)
	intervals: number[];    // semitones from root
	tier: number;
	category: 'mode';
	characteristic: number[]; // semitones that distinguish this mode
}

export const MODES: ModeDef[] = [
	{
		id: 'dorian',
		name: 'Dorian',
		label: 'Dor',
		parent: 'major',
		degree: 2,
		intervals: [0, 2, 3, 5, 7, 9, 10, 12],
		tier: 4,
		category: 'mode',
		characteristic: [3, 10],  // m3 + m7 (minor feel but bright)
	},
	{
		id: 'mixolydian',
		name: 'Mixolydian',
		label: 'Mix',
		parent: 'major',
		degree: 5,
		intervals: [0, 2, 4, 5, 7, 9, 10, 12],
		tier: 4,
		category: 'mode',
		characteristic: [10],  // m7 (major but with flat 7)
	},
	{
		id: 'phrygian',
		name: 'Phrygian',
		label: 'Phr',
		parent: 'major',
		degree: 3,
		intervals: [0, 1, 3, 5, 7, 8, 10, 12],
		tier: 4,
		category: 'mode',
		characteristic: [1],  // m2 (the "Spanish" flavor)
	},
	{
		id: 'lydian',
		name: 'Lydian',
		label: 'Lyd',
		parent: 'major',
		degree: 4,
		intervals: [0, 2, 4, 6, 7, 9, 11, 12],
		tier: 4,
		category: 'mode',
		characteristic: [6],  // aug4/TT (the "dreamy" interval)
	},
];

export function getModeById(id: string): ModeDef | undefined {
	return MODES.find(m => m.id === id);
}

export function getModesByTier(tier: number): ModeDef[] {
	return MODES.filter(m => m.tier === tier);
}
