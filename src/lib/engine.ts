import type { UserState, Question, IntervalDef, PlayMode, ChordDef, ChordVoicing, ChordQuestion, ScaleDef, ScaleQuestion, ModeQuestion } from './types';
import { INTERVALS, getUnlockedIntervals, getEnabledIntervals } from './intervals';
import { CHORDS, getEnabledChords } from './chords';
import { SCALES, getEnabledScales } from './scales';
import { MODES, type ModeDef } from './modes';

export function pickInterval(state: UserState): IntervalDef {
	const unlocked = getEnabledIntervals(state.intervals);
	if (unlocked.length === 0) throw new Error('No unlocked intervals');

	const now = Date.now();

	const weights = unlocked.map((def) => {
		const s = state.intervals[def.id];
		const accuracy = s.attempts > 0 ? s.correct / s.attempts : 0.5;
		const weaknessWeight = 1 - accuracy;

		const overdue = s.nextReview > 0 ? Math.max(0, now - s.nextReview) : 0;
		const reviewWeight = Math.min(1, overdue / (24 * 60 * 60 * 1000));

		const newBoost = s.attempts === 0 ? 0.5 : 0;

		return {
			def,
			weight: 0.1 + weaknessWeight * 0.5 + reviewWeight * 0.3 + newBoost
		};
	});

	const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
	let roll = Math.random() * totalWeight;
	for (const w of weights) {
		roll -= w.weight;
		if (roll <= 0) return w.def;
	}
	return weights[weights.length - 1].def;
}

export function pickMode(state: UserState, interval: IntervalDef): PlayMode {
	const enabledModes = state.settings.enabledModes;
	const modes: PlayMode[] = (['ascending', 'descending', 'harmonic'] as PlayMode[]).filter(
		(m) => enabledModes[m]
	);
	if (modes.length === 0) throw new Error('No enabled play modes');
	if (modes.length === 1) return modes[0];

	const intervalState = state.intervals[interval.id];

	const weights = modes.map((mode) => {
		const modeStats = intervalState.modes[mode];
		const accuracy = modeStats.attempts > 0 ? modeStats.correct / modeStats.attempts : 0.5;
		const weaknessWeight = 1 - accuracy;
		const newBoost = modeStats.attempts === 0 ? 0.5 : 0;

		return {
			mode,
			weight: 0.1 + weaknessWeight + newBoost
		};
	});

	const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
	let roll = Math.random() * totalWeight;
	for (const w of weights) {
		roll -= w.weight;
		if (roll <= 0) return w.mode;
	}
	return weights[weights.length - 1].mode;
}

export function generateDistractors(correctId: string, state: UserState): IntervalDef[] {
	const correctDef = INTERVALS.find((i) => i.id === correctId);
	const correctSemitones = correctDef?.semitones ?? 0;

	const unlocked = getEnabledIntervals(state.intervals).filter((i) => i.id !== correctId);
	const shuffledUnlocked = [...unlocked].sort(() => Math.random() - 0.5);

	if (shuffledUnlocked.length >= 3) {
		return shuffledUnlocked.slice(0, 3);
	}

	// Not enough unlocked distractors — fill remaining from locked intervals
	// sorted by proximity in semitones to the correct answer (better confusables)
	const usedIds = new Set([correctId, ...shuffledUnlocked.map(i => i.id)]);
	const locked = INTERVALS.filter(
		(i) => !usedIds.has(i.id)
	).sort(
		(a, b) =>
			Math.abs(a.semitones - correctSemitones) - Math.abs(b.semitones - correctSemitones)
	);

	const result = [...shuffledUnlocked];
	for (const def of locked) {
		if (result.length >= 3) break;
		result.push(def);
	}

	return result;
}

export function generateQuestion(state: UserState): Question {
	const interval = pickInterval(state);
	const playMode = pickMode(state, interval);
	const direction = playMode as 'ascending' | 'descending';

	const maxRoot = direction === 'ascending' || playMode === 'harmonic' ? 84 - interval.semitones : 84;
	const minRoot = direction === 'descending' ? 48 + interval.semitones : 48;
	const rootNote = minRoot + Math.floor(Math.random() * (maxRoot - minRoot + 1));

	const distractors = generateDistractors(interval.id, state);
	// Dedup safety: ensure no choice appears twice
	const seen = new Set<string>();
	const uniqueChoices = [interval, ...distractors].filter(c => {
		if (seen.has(c.id)) return false;
		seen.add(c.id);
		return true;
	});
	const choices = uniqueChoices.sort(() => Math.random() - 0.5);

	return {
		rootNote,
		interval,
		direction,
		playMode,
		choices,
		replays: 0
	};
}

// --- Chord engine (v3.3) ---

export function pickChord(state: UserState): ChordDef {
	const enabled = getEnabledChords(state.chords);
	if (enabled.length === 0) throw new Error('No enabled chords');

	const now = Date.now();

	const weights = enabled.map((def) => {
		const s = state.chords[def.id];
		const accuracy = s.attempts > 0 ? s.correct / s.attempts : 0.5;
		const weaknessWeight = 1 - accuracy;

		const overdue = s.nextReview > 0 ? Math.max(0, now - s.nextReview) : 0;
		const reviewWeight = Math.min(1, overdue / (24 * 60 * 60 * 1000));

		const newBoost = s.attempts === 0 ? 0.5 : 0;

		return {
			def,
			weight: 0.1 + weaknessWeight * 0.5 + reviewWeight * 0.3 + newBoost
		};
	});

	const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
	let roll = Math.random() * totalWeight;
	for (const w of weights) {
		roll -= w.weight;
		if (roll <= 0) return w.def;
	}
	return weights[weights.length - 1].def;
}

export function pickVoicing(state: UserState, chord: ChordDef): ChordVoicing {
	const enabledVoicings = state.settings.enabledVoicings;
	const voicings: ChordVoicing[] = (['root', 'first', 'second'] as ChordVoicing[]).filter(
		(v) => enabledVoicings[v]
	);
	if (voicings.length === 0) throw new Error('No enabled voicings');
	if (voicings.length === 1) return voicings[0];

	const chordState = state.chords[chord.id];

	const weights = voicings.map((voicing) => {
		const stats = chordState.voicings[voicing];
		const accuracy = stats.attempts > 0 ? stats.correct / stats.attempts : 0.5;
		const weaknessWeight = 1 - accuracy;
		const newBoost = stats.attempts === 0 ? 0.5 : 0;

		return {
			voicing,
			weight: 0.1 + weaknessWeight + newBoost
		};
	});

	const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
	let roll = Math.random() * totalWeight;
	for (const w of weights) {
		roll -= w.weight;
		if (roll <= 0) return w.voicing;
	}
	return weights[weights.length - 1].voicing;
}

export function generateChordDistractors(correctId: string, state: UserState): ChordDef[] {
	const correctDef = CHORDS.find((c) => c.id === correctId);
	const correctIntervals = new Set(correctDef?.intervals ?? []);

	const enabled = getEnabledChords(state.chords).filter((c) => c.id !== correctId);
	const shuffled = [...enabled].sort(() => Math.random() - 0.5);

	if (shuffled.length >= 3) {
		return shuffled.slice(0, 3);
	}

	const usedIds = new Set([correctId, ...shuffled.map(c => c.id)]);
	const locked = CHORDS.filter(
		(c) => !usedIds.has(c.id)
	).sort((a, b) => {
		const sharedA = a.intervals.filter(i => correctIntervals.has(i)).length;
		const sharedB = b.intervals.filter(i => correctIntervals.has(i)).length;
		return sharedB - sharedA;
	});

	const result = [...shuffled];
	for (const def of locked) {
		if (result.length >= 3) break;
		result.push(def);
	}

	return result;
}

export function generateChordQuestion(state: UserState): ChordQuestion {
	const chord = pickChord(state);
	const voicing = pickVoicing(state, chord);

	const maxSemitone = Math.max(...chord.intervals);
	const inversionBoost = voicing === 'second' ? 12 : voicing === 'first' ? 12 : 0;
	const maxRoot = Math.min(72, 84 - maxSemitone - inversionBoost);
	const minRoot = 48;
	const rootNote = minRoot + Math.floor(Math.random() * (Math.max(1, maxRoot - minRoot + 1)));

	const distractors = generateChordDistractors(chord.id, state);
	const seen = new Set<string>();
	const uniqueChoices = [chord, ...distractors].filter(c => {
		if (seen.has(c.id)) return false;
		seen.add(c.id);
		return true;
	});
	const choices = uniqueChoices.sort(() => Math.random() - 0.5);

	return {
		rootNote,
		chord,
		voicing,
		choices,
		replays: 0
	};
}

// --- Scale engine ---

export function pickScale(state: UserState): ScaleDef {
	const enabled = getEnabledScales(state.scales);
	if (enabled.length === 0) throw new Error('No enabled scales');

	const now = Date.now();

	const weights = enabled.map((def) => {
		const s = state.scales[def.id];
		const accuracy = s.attempts > 0 ? s.correct / s.attempts : 0.5;
		const weaknessWeight = 1 - accuracy;

		const overdue = s.nextReview > 0 ? Math.max(0, now - s.nextReview) : 0;
		const reviewWeight = Math.min(1, overdue / (24 * 60 * 60 * 1000));

		const newBoost = s.attempts === 0 ? 0.5 : 0;

		return {
			def,
			weight: 0.1 + weaknessWeight * 0.5 + reviewWeight * 0.3 + newBoost
		};
	});

	const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
	let roll = Math.random() * totalWeight;
	for (const w of weights) {
		roll -= w.weight;
		if (roll <= 0) return w.def;
	}
	return weights[weights.length - 1].def;
}

export function generateScaleDistractors(correctId: string, state: UserState): ScaleDef[] {
	const correctDef = SCALES.find((s) => s.id === correctId);
	const correctIntervals = new Set(correctDef?.intervals ?? []);

	const enabled = getEnabledScales(state.scales).filter((s) => s.id !== correctId);
	const shuffled = [...enabled].sort(() => Math.random() - 0.5);

	if (shuffled.length >= 3) {
		return shuffled.slice(0, 3);
	}

	// Not enough enabled distractors — fill from locked scales sorted by shared interval count
	const usedIds = new Set([correctId, ...shuffled.map(s => s.id)]);
	const locked = SCALES.filter(
		(s) => !usedIds.has(s.id)
	).sort((a, b) => {
		const sharedA = a.intervals.filter(i => correctIntervals.has(i)).length;
		const sharedB = b.intervals.filter(i => correctIntervals.has(i)).length;
		return sharedB - sharedA;
	});

	const result = [...shuffled];
	for (const def of locked) {
		if (result.length >= 3) break;
		result.push(def);
	}

	return result;
}

export function generateScaleQuestion(state: UserState): ScaleQuestion {
	const scale = pickScale(state);

	const highestInterval = Math.max(...scale.intervals);
	const maxRoot = 72 - highestInterval; // C5 (72) minus highest interval
	const minRoot = 48; // C3
	const rootNote = minRoot + Math.floor(Math.random() * (Math.max(1, maxRoot - minRoot + 1)));

	const distractors = generateScaleDistractors(scale.id, state);
	const seen = new Set<string>();
	const uniqueChoices = [scale, ...distractors].filter(c => {
		if (seen.has(c.id)) return false;
		seen.add(c.id);
		return true;
	});
	const choices = uniqueChoices.sort(() => Math.random() - 0.5);

	return {
		rootNote,
		scale,
		choices,
		replays: 0
	};
}

// --- Mode engine (v3.5) ---

export function getEnabledModes(modeStates: Record<string, import('./types').ModeState> | undefined): ModeDef[] {
	if (!modeStates) return [];
	return MODES.filter(m => modeStates[m.id]?.unlocked && modeStates[m.id]?.enabled);
}

export function generateModeDistractors(correctId: string, modeStates?: Record<string, import('./types').ModeState>): ModeDef[] {
	const correctDef = MODES.find(m => m.id === correctId);
	const correctIntervals = new Set(correctDef?.intervals ?? []);

	// Use enabled modes first, then fall back to all modes
	const enabled = modeStates
		? getEnabledModes(modeStates).filter(m => m.id !== correctId)
		: MODES.filter(m => m.id !== correctId);
	const shuffled = [...enabled].sort(() => Math.random() - 0.5);

	if (shuffled.length >= 3) {
		return shuffled.slice(0, 3);
	}

	// Fill from remaining modes sorted by shared interval count (better confusables)
	const usedIds = new Set([correctId, ...shuffled.map(m => m.id)]);
	const remaining = MODES.filter(m => !usedIds.has(m.id)).sort((a, b) => {
		const sharedA = a.intervals.filter(i => correctIntervals.has(i)).length;
		const sharedB = b.intervals.filter(i => correctIntervals.has(i)).length;
		return sharedB - sharedA;
	});

	const result = [...shuffled];
	for (const def of remaining) {
		if (result.length >= 3) break;
		result.push(def);
	}

	return result;
}

export function generateModeQuestion(state: UserState): ModeQuestion {
	const enabled = getEnabledModes(state.modes);
	if (enabled.length === 0) throw new Error('No enabled modes');

	// Simple weighted pick (same pattern as scales — flat, no per-variant)
	const now = Date.now();
	const weights = enabled.map(def => {
		const s = state.modes?.[def.id];
		const attempts = s?.attempts ?? 0;
		const correct = s?.correct ?? 0;
		const accuracy = attempts > 0 ? correct / attempts : 0.5;
		const weaknessWeight = 1 - accuracy;
		const overdue = s?.nextReview && s.nextReview > 0 ? Math.max(0, now - s.nextReview) : 0;
		const reviewWeight = Math.min(1, overdue / (24 * 60 * 60 * 1000));
		const newBoost = attempts === 0 ? 0.5 : 0;

		return {
			def,
			weight: 0.1 + weaknessWeight * 0.5 + reviewWeight * 0.3 + newBoost,
		};
	});

	const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
	let roll = Math.random() * totalWeight;
	let mode = weights[weights.length - 1].def;
	for (const w of weights) {
		roll -= w.weight;
		if (roll <= 0) { mode = w.def; break; }
	}

	// Root note: C3-C4 range (48-60) — keep it in a comfortable range for drone
	const rootNote = 48 + Math.floor(Math.random() * 13);

	const distractors = generateModeDistractors(mode.id, state.modes);
	const seen = new Set<string>();
	const uniqueChoices = [mode, ...distractors].filter(c => {
		if (seen.has(c.id)) return false;
		seen.add(c.id);
		return true;
	});
	const choices = uniqueChoices.sort(() => Math.random() - 0.5);

	return {
		rootNote,
		mode,
		choices,
		replays: 0,
		droneNote: rootNote, // drone sits on root
	};
}
