import type { UserState, Question, IntervalDef } from './types';
import { INTERVALS, getUnlockedIntervals, getEnabledIntervals } from './intervals';

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
	const direction: 'ascending' | 'descending' =
		state.settings.direction === 'random'
			? Math.random() < 0.5
				? 'ascending'
				: 'descending'
			: state.settings.direction;

	const maxRoot = direction === 'ascending' ? 84 - interval.semitones : 84;
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
		choices,
		replays: 0
	};
}
