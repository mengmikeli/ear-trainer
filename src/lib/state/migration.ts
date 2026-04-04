/**
 * v3 → v4 state migrator.
 *
 * Converts any legacy localStorage shape (v1/v2/v3/v3.3/v3.4/v3.5) into the
 * canonical UserStateV4 schema. Defensive: corrupt/missing fields always fall
 * back to sensible defaults — never throws.
 */

import type {
	UserStateV4,
	ContentStats,
	DefinitionState,
	Settings,
	GlobalStats,
	SessionRecord,
	ContentKind,
} from './schema';
import { STATE_VERSION, defaultContentStats, defaultDefinitionState } from './schema';
import { createDefaultStateV4 } from './defaults';
import { INTERVALS } from '$lib/definitions/intervals';
import { CHORDS } from '$lib/definitions/chords';
import { SCALES } from '$lib/definitions/scales';
import { MODES } from '$lib/definitions/modes';

// ─── Public API ─────────────────────────────────────────────────────────────

export function migrateToV4(raw: any): UserStateV4 {
	try {
		return doMigrate(raw);
	} catch {
		// Absolutely anything goes wrong → fresh defaults
		return createDefaultStateV4();
	}
}

// ─── Internal ───────────────────────────────────────────────────────────────

function doMigrate(raw: any): UserStateV4 {
	// Null/undefined/non-object → fresh defaults
	if (!raw || typeof raw !== 'object') {
		return createDefaultStateV4();
	}

	// Already v4 — patch in any missing definitions (handles new content added in updates)
	if (raw.version === STATE_VERSION) {
		const state = raw as UserStateV4;
		patchMissingDefinitions(state);
		// Existing v4 user without FRE flag → skip FRE
		if (state.settings.hasCompletedFRE === undefined) {
			state.settings.hasCompletedFRE = true;
		}
		// Migrate legacy proUnlocked → unlockedPacks
		migrateProToUnlockedPacks(state.settings);
		return state;
	}

	// ── Definitions ──────────────────────────────────────────────────────

	const definitions = extractDefinitions(raw);

	// ── Stats ────────────────────────────────────────────────────────────

	const stats = buildStats(raw);

	// ── Settings ─────────────────────────────────────────────────────────

	const settings = migrateSettings(raw);

	// ── GlobalStats ──────────────────────────────────────────────────────

	const globalStats = migrateGlobalStats(raw);

	// ── Session history ──────────────────────────────────────────────────

	const sessionHistory = migrateSessionHistory(raw);

	return {
		version: STATE_VERSION,
		stats,
		definitions,
		settings,
		globalStats,
		sessionHistory,
	};
}

// ─── Definitions ────────────────────────────────────────────────────────────

function extractDefinitions(raw: any): UserStateV4['definitions'] {
	const intervals: Record<string, DefinitionState> = {};
	for (const def of INTERVALS) {
		const legacy = raw.intervals?.[def.id];
		if (legacy && typeof legacy === 'object') {
			intervals[def.id] = {
				unlocked: legacy.unlocked === true,
				enabled: legacy.enabled !== false, // default true if missing
			};
		} else {
			intervals[def.id] = defaultDefinitionState(def.tier === 1);
		}
	}

	const chords: Record<string, DefinitionState> = {};
	for (const def of CHORDS) {
		const legacy = raw.chords?.[def.id];
		if (legacy && typeof legacy === 'object') {
			chords[def.id] = {
				unlocked: legacy.unlocked === true,
				enabled: legacy.enabled !== false,
			};
		} else {
			chords[def.id] = defaultDefinitionState(def.tier === 1);
		}
	}

	const scales: Record<string, DefinitionState> = {};
	for (const def of SCALES) {
		const legacy = raw.scales?.[def.id];
		if (legacy && typeof legacy === 'object') {
			scales[def.id] = {
				unlocked: legacy.unlocked === true,
				enabled: legacy.enabled !== false,
			};
		} else {
			scales[def.id] = defaultDefinitionState(def.tier === 1);
		}
	}

	const modes: Record<string, DefinitionState> = {};
	for (const def of MODES) {
		const legacy = raw.modes?.[def.id];
		if (legacy && typeof legacy === 'object') {
			modes[def.id] = {
				unlocked: legacy.unlocked === true,
				enabled: legacy.enabled !== false,
			};
		} else {
			modes[def.id] = defaultDefinitionState(def.tier === 1);
		}
	}

	return { intervals, chords, scales, modes };
}

// ─── Stats ──────────────────────────────────────────────────────────────────

function buildStats(raw: any): Record<string, ContentStats> {
	// Prefer adaptive.stats if already present (v3.5+)
	if (raw.adaptive?.stats && typeof raw.adaptive.stats === 'object') {
		return promoteAdaptiveStats(raw.adaptive.stats);
	}

	// Otherwise build from legacy per-category fields
	return buildStatsFromLegacy(raw);
}

/**
 * Promote adaptive stats — ensure every entry has the full ContentStats shape.
 */
function promoteAdaptiveStats(adaptiveStats: Record<string, any>): Record<string, ContentStats> {
	const result: Record<string, ContentStats> = {};
	for (const [key, raw] of Object.entries(adaptiveStats)) {
		result[key] = toContentStats(raw);
	}
	return result;
}

function buildStatsFromLegacy(raw: any): Record<string, ContentStats> {
	const stats: Record<string, ContentStats> = {};

	// Intervals: need v2→v3 migration for modes (same logic as loadState)
	if (raw.intervals && typeof raw.intervals === 'object') {
		for (const [id, s] of Object.entries<any>(raw.intervals)) {
			if (!s || typeof s !== 'object') continue;

			// If modes exist, use per-mode stats
			if (s.modes && typeof s.modes === 'object') {
				for (const mode of ['ascending', 'descending', 'harmonic'] as const) {
					const ms = s.modes[mode];
					if (ms && typeof ms === 'object') {
						stats[`interval:${id}:${mode}`] = toContentStats(ms);
					} else {
						stats[`interval:${id}:${mode}`] = defaultContentStats();
					}
				}
			} else {
				// Pre-v3: flat stats on the interval, assign to direction-based mode
				const oldDirection = raw.settings?.direction ?? 'ascending';
				const targetMode: string =
					oldDirection === 'descending' ? 'descending' : 'ascending';

				for (const mode of ['ascending', 'descending', 'harmonic'] as const) {
					if (mode === targetMode) {
						stats[`interval:${id}:${mode}`] = toContentStats(s);
					} else {
						stats[`interval:${id}:${mode}`] = defaultContentStats();
					}
				}
			}
		}
	}

	// Chords: per-voicing stats
	if (raw.chords && typeof raw.chords === 'object') {
		for (const [id, s] of Object.entries<any>(raw.chords)) {
			if (!s || typeof s !== 'object') continue;
			if (s.voicings && typeof s.voicings === 'object') {
				for (const voicing of ['root', 'first', 'second'] as const) {
					const vs = s.voicings[voicing];
					if (vs && typeof vs === 'object') {
						stats[`chord:${id}:${voicing}`] = toContentStats(vs);
					} else {
						stats[`chord:${id}:${voicing}`] = defaultContentStats();
					}
				}
			} else {
				// Chord without voicings — put flat stats into root
				stats[`chord:${id}:root`] = toContentStats(s);
				stats[`chord:${id}:first`] = defaultContentStats();
				stats[`chord:${id}:second`] = defaultContentStats();
			}
		}
	}

	// Scales: flat stats
	if (raw.scales && typeof raw.scales === 'object') {
		for (const [id, s] of Object.entries<any>(raw.scales)) {
			if (!s || typeof s !== 'object') continue;
			stats[`scale:${id}`] = toContentStats(s);
		}
	}

	// Modes: flat stats (may not exist in older state)
	if (raw.modes && typeof raw.modes === 'object') {
		for (const [id, s] of Object.entries<any>(raw.modes)) {
			if (!s || typeof s !== 'object') continue;
			stats[`mode:${id}`] = toContentStats(s);
		}
	}

	return stats;
}

/** Safely coerce any object into a ContentStats shape with defaults. */
function toContentStats(raw: any): ContentStats {
	if (!raw || typeof raw !== 'object') return defaultContentStats();
	return {
		attempts: safeNum(raw.attempts),
		correct: safeNum(raw.correct),
		streak: safeNum(raw.streak),
		lastSeen: safeNum(raw.lastSeen),
		easeFactor: safeNum(raw.easeFactor, 2.5),
		nextReview: safeNum(raw.nextReview),
	};
}

// ─── Settings ───────────────────────────────────────────────────────────────

const VALID_ACTIVE_CONTENT = ['intervals', 'chords', 'scales', 'modes', 'adaptive'] as const;

function migrateSettings(raw: any): Settings {
	const s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};

	// enabledModes: migrate from old `direction` if missing
	let enabledModes = s.enabledModes;
	if (!enabledModes || typeof enabledModes !== 'object') {
		const oldDirection = s.direction ?? 'ascending';
		if (oldDirection === 'descending') {
			enabledModes = { ascending: false, descending: true, harmonic: false };
		} else if (oldDirection === 'random') {
			enabledModes = { ascending: true, descending: true, harmonic: false };
		} else {
			enabledModes = { ascending: true, descending: false, harmonic: false };
		}
	}

	// enabledVoicings
	let enabledVoicings = s.enabledVoicings;
	if (!enabledVoicings || typeof enabledVoicings !== 'object') {
		enabledVoicings = { root: true, first: false, second: false };
	}

	// activeContent — validate
	let activeContent = s.activeContent;
	if (!VALID_ACTIVE_CONTENT.includes(activeContent)) {
		activeContent = 'intervals';
	}

	return {
		toneType: validToneType(s.toneType) ? s.toneType : 'epiano',
		sessionLength: validSessionLength(s.sessionLength) ? s.sessionLength : 20,
		theme: validTheme(s.theme) ? s.theme : 'dark',
		enabledModes: {
			ascending: enabledModes.ascending === true,
			descending: enabledModes.descending === true,
			harmonic: enabledModes.harmonic === true,
		},
		enabledVoicings: {
			root: enabledVoicings.root !== false,
			first: enabledVoicings.first === true,
			second: enabledVoicings.second === true,
		},
		activeContent,
		...(s.devMode !== undefined ? { devMode: s.devMode === true } : {}),
		...(s.proUnlocked !== undefined ? { proUnlocked: s.proUnlocked === true } : {}),
		unlockedPacks: s.proUnlocked ? ['advanced'] as const : [],
		...(s.superchargeViz !== undefined ? { superchargeViz: s.superchargeViz === true } : {}),
		hasCompletedFRE: true, // existing user migrating → skip FRE
	};
}

function validToneType(v: any): v is Settings['toneType'] {
	return v === 'epiano' || v === 'sine' || v === 'piano';
}

function validSessionLength(v: any): v is Settings['sessionLength'] {
	return v === 10 || v === 20 || v === 30;
}

function validTheme(v: any): v is Settings['theme'] {
	return v === 'light' || v === 'dark' || v === 'system';
}

// ─── GlobalStats ────────────────────────────────────────────────────────────

function migrateGlobalStats(raw: any): GlobalStats {
	const s = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
	return {
		totalSessions: safeNum(s.totalSessions),
		totalQuestions: safeNum(s.totalQuestions),
		currentStreak: safeNum(s.currentStreak),
		bestStreak: safeNum(s.bestStreak),
		lastPractice: safeNum(s.lastPractice),
	};
}

// ─── Session history ────────────────────────────────────────────────────────

function migrateSessionHistory(raw: any): SessionRecord[] {
	const history = raw.adaptive?.sessionHistory;
	if (!Array.isArray(history)) return [];
	return history.filter(
		(r: any) => r && typeof r === 'object' && typeof r.date === 'number',
	) as SessionRecord[];
}

// ─── Patch missing definitions (v4 → v4 with new content) ──────────────────

/**
 * Ensure all currently-defined content exists in a v4 state.
 * Handles new chords/intervals/scales/modes added in app updates
 * for users who already have a v4 state in localStorage.
 */
function patchMissingDefinitions(state: UserStateV4): void {
	for (const def of INTERVALS) {
		if (!state.definitions.intervals[def.id]) {
			state.definitions.intervals[def.id] = defaultDefinitionState(def.tier === 1);
		}
	}
	for (const def of CHORDS) {
		if (!state.definitions.chords[def.id]) {
			state.definitions.chords[def.id] = defaultDefinitionState(def.tier === 1);
		}
	}
	for (const def of SCALES) {
		if (!state.definitions.scales[def.id]) {
			state.definitions.scales[def.id] = defaultDefinitionState(def.tier === 1);
		}
	}
	for (const def of MODES) {
		if (!state.definitions.modes[def.id]) {
			state.definitions.modes[def.id] = defaultDefinitionState(def.tier === 1);
		}
	}
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeNum(v: any, fallback: number = 0): number {
	return typeof v === 'number' && !Number.isNaN(v) ? v : fallback;
}

// ─── proUnlocked → unlockedPacks migration ─────────────────────────────────

/**
 * Migrate legacy `proUnlocked: true` to `unlockedPacks: ['advanced']`.
 * 'advanced' grants access to all packs, so this is equivalent to old Pro.
 */
function migrateProToUnlockedPacks(settings: any): void {
	if (settings.proUnlocked && (!settings.unlockedPacks || settings.unlockedPacks.length === 0)) {
		settings.unlockedPacks = ['advanced'];
	}
	if (!settings.unlockedPacks) {
		settings.unlockedPacks = [];
	}
}
