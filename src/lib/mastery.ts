import type { ModeStats, IntervalState } from './types';

export type MasteryLevel = 'none' | 'bronze' | 'silver' | 'gold';

const MASTERY_MIN_ATTEMPTS = 20;
const MASTERY_MIN_ACCURACY = 0.85;

/** Check if a single mode is mastered for an interval */
export function isModeMastered(stats: ModeStats): boolean {
	return stats.attempts >= MASTERY_MIN_ATTEMPTS && stats.correct / stats.attempts >= MASTERY_MIN_ACCURACY;
}

/** Get mastery level for an interval (across all modes) */
export function getMasteryLevel(interval: IntervalState): MasteryLevel {
	const modes = interval.modes;
	let mastered = 0;
	if (isModeMastered(modes.ascending)) mastered++;
	if (isModeMastered(modes.descending)) mastered++;
	if (isModeMastered(modes.harmonic)) mastered++;

	if (mastered === 0) return 'none';
	if (mastered === 1) return 'bronze';
	if (mastered === 2) return 'silver';
	return 'gold';
}

/** Count total mastered mode-skills across all intervals */
export function countMasteredSkills(intervals: Record<string, IntervalState>): { mastered: number; total: number } {
	let mastered = 0;
	let total = 0;

	for (const state of Object.values(intervals)) {
		if (!state.unlocked) continue;
		total += 3; // one per mode
		if (isModeMastered(state.modes.ascending)) mastered++;
		if (isModeMastered(state.modes.descending)) mastered++;
		if (isModeMastered(state.modes.harmonic)) mastered++;
	}

	return { mastered, total };
}

/** Get per-mode mastery status for an interval */
export function getModeMasteryStatus(interval: IntervalState): { ascending: boolean; descending: boolean; harmonic: boolean } {
	return {
		ascending: isModeMastered(interval.modes.ascending),
		descending: isModeMastered(interval.modes.descending),
		harmonic: isModeMastered(interval.modes.harmonic),
	};
}
