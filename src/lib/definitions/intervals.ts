// src/lib/definitions/intervals.ts — Pure interval definitions (v4)

import type { ContentPack } from '$lib/state/schema';

export interface IntervalDef {
	id: string; // e.g. "P5", "m3", "TT"
	name: string; // e.g. "Perfect 5th"
	semitones: number; // 0-12
	tier: number; // 1-4
	pack: ContentPack; // access gating
}

export const INTERVALS: IntervalDef[] = [
	// Tier 1 — Anchors
	{ id: 'P1', name: 'Unison', semitones: 0, tier: 1, pack: 'beginner' },
	{ id: 'P5', name: 'Perfect 5th', semitones: 7, tier: 1, pack: 'beginner' },
	{ id: 'P8', name: 'Octave', semitones: 12, tier: 1, pack: 'beginner' },
	// Tier 2 — Color
	{ id: 'M3', name: 'Major 3rd', semitones: 4, tier: 2, pack: 'beginner' },
	{ id: 'm3', name: 'Minor 3rd', semitones: 3, tier: 2, pack: 'beginner' },
	{ id: 'P4', name: 'Perfect 4th', semitones: 5, tier: 2, pack: 'beginner' },
	// Tier 3 — Steps + Tension
	{ id: 'M2', name: 'Major 2nd', semitones: 2, tier: 3, pack: 'blues' },
	{ id: 'M6', name: 'Major 6th', semitones: 9, tier: 3, pack: 'jazz' },
	{ id: 'm7', name: 'Minor 7th', semitones: 10, tier: 3, pack: 'blues' },
	{ id: 'M7', name: 'Major 7th', semitones: 11, tier: 3, pack: 'jazz' },
	// Tier 4 — Hard + Compound
	{ id: 'm2', name: 'Minor 2nd', semitones: 1, tier: 4, pack: 'advanced' },
	{ id: 'm6', name: 'Minor 6th', semitones: 8, tier: 4, pack: 'advanced' },
	{ id: 'TT', name: 'Tritone', semitones: 6, tier: 4, pack: 'blues' },
	{ id: 'm9', name: 'Minor 9th', semitones: 13, tier: 4, pack: 'jazz' },
	{ id: 'M9', name: 'Major 9th', semitones: 14, tier: 4, pack: 'jazz' },
	{ id: 'm10', name: 'Minor 10th', semitones: 15, tier: 4, pack: 'advanced' },
	{ id: 'M10', name: 'Major 10th', semitones: 16, tier: 4, pack: 'advanced' },
];

export function getIntervalsByTier(tier: number): IntervalDef[] {
	return INTERVALS.filter((i) => i.tier === tier);
}
