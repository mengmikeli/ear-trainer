/**
 * Default v4 state factory.
 *
 * Creates a fresh UserStateV4 with tier-1 items unlocked, empty stats,
 * default settings, zeroed globalStats, and empty sessionHistory.
 */

import type { UserStateV4, DefinitionState } from './schema';
import { STATE_VERSION, defaultDefinitionState } from './schema';
import { INTERVALS } from '$lib/intervals';
import { CHORDS } from '$lib/chords';
import { SCALES } from '$lib/scales';
import { MODES } from '$lib/modes';

/** Create a fresh v4 state with tier-1 items unlocked and sensible defaults. */
export function createDefaultStateV4(): UserStateV4 {
	// ── Definitions: tier-1 items unlocked, everything else locked ────────

	const intervals: Record<string, DefinitionState> = {};
	for (const def of INTERVALS) {
		intervals[def.id] = defaultDefinitionState(def.tier === 1);
	}

	const chords: Record<string, DefinitionState> = {};
	for (const def of CHORDS) {
		chords[def.id] = defaultDefinitionState(def.tier === 1);
	}

	const scales: Record<string, DefinitionState> = {};
	for (const def of SCALES) {
		scales[def.id] = defaultDefinitionState(def.tier === 1);
	}

	const modes: Record<string, DefinitionState> = {};
	for (const def of MODES) {
		modes[def.id] = defaultDefinitionState(def.tier === 1);
	}

	return {
		version: STATE_VERSION,
		stats: {},
		definitions: { intervals, chords, scales, modes },
		settings: {
			toneType: 'epiano',
			sessionLength: 20,
			theme: 'dark',
			enabledModes: { ascending: true, descending: false, harmonic: false },
			enabledVoicings: { root: true, first: false, second: false },
			activeContent: 'intervals',
		},
		globalStats: {
			totalSessions: 0,
			totalQuestions: 0,
			currentStreak: 0,
			bestStreak: 0,
			lastPractice: 0,
		},
		sessionHistory: [],
	};
}
