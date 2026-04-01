// src/lib/definitions/index.ts — Re-export all definitions

export {
	type IntervalDef,
	INTERVALS,
	getIntervalsByTier,
} from './intervals';

export {
	type ChordCategory,
	type ChordVoicing,
	type ChordDef,
	CHORDS,
	getChordsByTier,
	applyInversion,
} from './chords';

export {
	type ScaleCategory,
	type ScaleDef,
	SCALES,
	getScalesByTier,
} from './scales';

export {
	type ModeDef,
	MODES,
	getModesByTier,
} from './modes';
