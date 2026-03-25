import type { ScaleDef, ScaleState } from './types';

export const SCALES: ScaleDef[] = [
	// Tier 1 — Big Three
	{ id: 'major', name: 'Major', label: 'Maj', intervals: [0, 2, 4, 5, 7, 9, 11, 12], tier: 1, category: 'diatonic' },
	{ id: 'nat_min', name: 'Natural Minor', label: 'Min', intervals: [0, 2, 3, 5, 7, 8, 10, 12], tier: 1, category: 'diatonic' },
	{ id: 'maj_pent', name: 'Major Pentatonic', label: 'MajP', intervals: [0, 2, 4, 7, 9, 12], tier: 1, category: 'pentatonic' },

	// Tier 2
	{ id: 'harm_min', name: 'Harmonic Minor', label: 'hMin', intervals: [0, 2, 3, 5, 7, 8, 11, 12], tier: 2, category: 'diatonic' },
	{ id: 'min_pent', name: 'Minor Pentatonic', label: 'MinP', intervals: [0, 3, 5, 7, 10, 12], tier: 2, category: 'pentatonic' },

	// Tier 3
	{ id: 'blues', name: 'Blues', label: 'Blu', intervals: [0, 3, 5, 6, 7, 10, 12], tier: 3, category: 'pentatonic' },
	{ id: 'whole', name: 'Whole Tone', label: 'Whol', intervals: [0, 2, 4, 6, 8, 10, 12], tier: 3, category: 'symmetric' },
	{ id: 'mel_min', name: 'Melodic Minor', label: 'mMin', intervals: [0, 2, 3, 5, 7, 9, 11, 12], tier: 3, category: 'diatonic' },
	{ id: 'chromatic', name: 'Chromatic', label: 'Chr', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], tier: 3, category: 'symmetric' },
];

export function getScalesByTier(tier: number): ScaleDef[] {
	return SCALES.filter((s) => s.tier === tier);
}

export function getScaleById(id: string): ScaleDef | undefined {
	return SCALES.find((s) => s.id === id);
}

export function getUnlockedScales(states: Record<string, ScaleState>): ScaleDef[] {
	return SCALES.filter((s) => states[s.id]?.unlocked);
}

export function getEnabledScales(states: Record<string, ScaleState>): ScaleDef[] {
	return SCALES.filter((s) => states[s.id]?.unlocked && states[s.id]?.enabled);
}
