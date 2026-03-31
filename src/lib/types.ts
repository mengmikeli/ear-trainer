/**
 * Legacy type re-exports for backward compatibility.
 *
 * New code should import from:
 *   - '$lib/definitions/*' for IntervalDef, ChordDef, ScaleDef, ModeDef
 *   - '$lib/state/schema' for Settings, GlobalStats, ContentStats, etc.
 *   - '$lib/state/compat' for LegacyIntervalState, LegacyChordState, etc.
 */

// Re-export definition types
export type { IntervalDef } from '$lib/definitions/intervals';
export type { ChordDef, ChordCategory, ChordVoicing } from '$lib/definitions/chords';
export type { ScaleDef, ScaleCategory } from '$lib/definitions/scales';
export type { ModeDef } from '$lib/definitions/modes';

// Re-export state schema types
export type {
	ToneType,
	PlayMode,
	SessionLength,
	ThemeMode,
	ContentKind,
	Settings,
	GlobalStats,
	ContentStats,
} from '$lib/state/schema';

// Re-export legacy compat types for card components
export type {
	LegacyIntervalState as IntervalState,
	LegacyChordState as ChordState,
	LegacyScaleState as ScaleState,
	LegacyModeState as ModeState,
	LegacyModeStats as ModeStats,
} from '$lib/state/compat';

// Legacy type alias
export type Direction = 'ascending' | 'descending' | 'random';
