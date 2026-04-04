/**
 * UserStateV4 Schema
 *
 * Canonical data model for v4.0. Replaces the fragmented per-category state
 * (IntervalState, ChordState, ScaleState, ModeState) with a unified model
 * where all content items share a common ContentStats shape keyed by string ID,
 * and definitions (unlock/enable) are organized by content kind.
 *
 * This file is TYPES ONLY + small helper functions — no logic, no imports
 * from other src/lib modules.
 */

export const STATE_VERSION = 4;

// ─── Shared enums / type aliases ────────────────────────────────────────────

/** The four kinds of ear-training content. */
export type ContentKind = 'interval' | 'chord' | 'scale' | 'mode';

/** Content pack — controls access gating (beginner = free, others = pro). */
export type ContentPack = 'beginner' | 'blues' | 'jazz' | 'advanced';

/** Available tone / instrument types for audio playback. */
export type ToneType = 'epiano' | 'sine' | 'piano';

/** Number of questions per practice session. */
export type SessionLength = 10 | 20 | 30;

/** UI theme preference. */
export type ThemeMode = 'light' | 'dark' | 'system';

/** How intervals/chords are played (direction / voicing style). */
export type PlayMode = 'ascending' | 'descending' | 'harmonic';

/** Chord inversion / voicing position. */
export type ChordVoicing = 'root' | 'first' | 'second';

// ─── Per-item stats ─────────────────────────────────────────────────────────

/**
 * Statistics for a single content item (interval, chord, scale, or mode).
 * Keyed by a composite string ID in `UserStateV4.stats`.
 */
export interface ContentStats {
	/** Total number of times this item has been presented. */
	attempts: number;
	/** Total correct answers. */
	correct: number;
	/** Current consecutive-correct streak. */
	streak: number;
	/** Timestamp (ms) of the last time this item was practiced. */
	lastSeen: number;
	/** SM-2 ease factor — higher means easier recall (default 2.5). */
	easeFactor: number;
	/** Timestamp (ms) of the next scheduled review. */
	nextReview: number;
}

// ─── Definition state ───────────────────────────────────────────────────────

/**
 * Whether a content item is unlocked (available) and enabled (active in quizzes).
 */
export interface DefinitionState {
	/** True if the item has been unlocked (via tier progression or dev mode). */
	unlocked: boolean;
	/** True if the user has toggled this item on for practice. */
	enabled: boolean;
}

// ─── Settings ───────────────────────────────────────────────────────────────

/** Global user preferences. */
export interface Settings {
	/** Instrument / tone used for audio playback. */
	toneType: ToneType;
	/** Number of questions per session. */
	sessionLength: SessionLength;
	/** UI theme. */
	theme: ThemeMode;
	/** Which play modes (ascending / descending / harmonic) are active. */
	enabledModes: {
		ascending: boolean;
		descending: boolean;
		harmonic: boolean;
	};
	/** Which chord voicings (root / first / second inversion) are active. */
	enabledVoicings: {
		root: boolean;
		first: boolean;
		second: boolean;
	};
	/** Which content type the Practice button launches. */
	activeContent: 'intervals' | 'chords' | 'scales' | 'modes' | 'adaptive';
	/** Bypass mastery gates and show lab link. */
	devMode?: boolean;
	/** True if user has purchased Pro (unlocks gated content tiers). @deprecated Use unlockedPacks instead. */
	proUnlocked?: boolean;
	/** Content packs the user has unlocked (beginner always free). */
	unlockedPacks?: ContentPack[];
	/** Enable experimental visualisation enhancements. */
	superchargeViz?: boolean;
	/** True after completing the first-run experience. */
	hasCompletedFRE?: boolean;
}

// ─── Global stats ───────────────────────────────────────────────────────────

/** Aggregated statistics across all practice sessions. */
export interface GlobalStats {
	/** Total completed sessions. */
	totalSessions: number;
	/** Total questions answered across all sessions. */
	totalQuestions: number;
	/** Current daily streak (consecutive days practiced). */
	currentStreak: number;
	/** All-time best daily streak. */
	bestStreak: number;
	/** Timestamp (ms) of the most recent practice session. */
	lastPractice: number;
}

// ─── Session history ────────────────────────────────────────────────────────

/** A single completed practice session record. */
export interface SessionRecord {
	/** Timestamp (ms) when the session started. */
	date: number;
	/** Number of questions in this session. */
	length: number;
	/** Which content kinds were practiced. */
	kinds: ContentKind[];
	/** Accuracy as a fraction 0-1. */
	accuracy: number;
	/** ID of the item the user struggled with most. */
	weakestItem: string;
	/** ID of the item the user performed best on. */
	strongestItem: string;
}

// ─── Root state ─────────────────────────────────────────────────────────────

/**
 * The canonical v4 user state.
 *
 * Key changes from v3:
 * - `stats` is a flat `Record<string, ContentStats>` keyed by composite ID
 *   (e.g. "interval:P5:ascending") instead of nested per-category objects.
 * - `definitions` groups unlock/enable state by content kind, separate from stats.
 * - `sessionHistory` replaces the old `adaptive.sessionHistory`.
 */
export interface UserStateV4 {
	/** Schema version — always `4` for this shape. */
	version: 4;
	/** Per-item practice statistics, keyed by composite ID. */
	stats: Record<string, ContentStats>;
	/** Unlock & enable state for every content item, grouped by kind. */
	definitions: {
		intervals: Record<string, DefinitionState>;
		chords: Record<string, DefinitionState>;
		scales: Record<string, DefinitionState>;
		modes: Record<string, DefinitionState>;
	};
	/** Global user preferences. */
	settings: Settings;
	/** Aggregated cross-session statistics. */
	globalStats: GlobalStats;
	/** Chronological log of completed sessions. */
	sessionHistory: SessionRecord[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Create a fresh `ContentStats` with SM-2 defaults. */
export function defaultContentStats(): ContentStats {
	return {
		attempts: 0,
		correct: 0,
		streak: 0,
		lastSeen: 0,
		easeFactor: 2.5,
		nextReview: 0,
	};
}

/** Create a fresh `DefinitionState`. Items default to enabled when created. */
export function defaultDefinitionState(unlocked: boolean = false): DefinitionState {
	return { unlocked, enabled: true };
}

// ─── ContentKind ↔ plural mapping ───────────────────────────────────────────

export const KIND_TO_PLURAL: Record<ContentKind, 'intervals' | 'chords' | 'scales' | 'modes'> = {
	interval: 'intervals',
	chord: 'chords',
	scale: 'scales',
	mode: 'modes',
};

export const PLURAL_TO_KIND: Record<string, ContentKind> = {
	intervals: 'interval',
	chords: 'chord',
	scales: 'scale',
	modes: 'mode',
};
