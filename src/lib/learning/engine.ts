// src/lib/learning/engine.ts — Unified learning engine (v4)
//
// Replaces the 4 duplicate pick/distractor implementations in src/lib/engine.ts
// with generic, type-parameterized versions.

import type { ContentStats } from '$lib/state/schema';
import type { IntervalDef } from '$lib/definitions/intervals';
import type { ChordDef } from '$lib/definitions/chords';
import type { ScaleDef } from '$lib/definitions/scales';
import type { ModeDef } from '$lib/definitions/modes';

// ─── Generic weighted pick ──────────────────────────────────────────────────

/**
 * Pick an item using weighted random selection based on SM-2 stats.
 * Replaces pickInterval, pickChord, pickScale, and the mode picker.
 *
 * Weight formula: 0.1 + weakness * 0.5 + overdue * 0.3 + newBoost
 * - weakness: 1 - accuracy (items answered incorrectly get higher weight)
 * - overdue:  fraction of a day past scheduled review (capped at 1.0)
 * - newBoost: 0.5 for items never attempted (ensures new items get tried)
 */
export function pickItem<T extends { id: string }>(
	items: T[],
	getStats: (item: T) => ContentStats,
): T {
	if (items.length === 0) throw new Error('No items to pick from');

	const now = Date.now();

	const weights = items.map((item) => {
		const s = getStats(item);
		const accuracy = s.attempts > 0 ? s.correct / s.attempts : 0.5;
		const weaknessWeight = 1 - accuracy;

		const overdue = s.nextReview > 0 ? Math.max(0, now - s.nextReview) : 0;
		const reviewWeight = Math.min(1, overdue / (24 * 60 * 60 * 1000));

		const newBoost = s.attempts === 0 ? 0.5 : 0;

		return {
			item,
			weight: 0.1 + weaknessWeight * 0.5 + reviewWeight * 0.3 + newBoost,
		};
	});

	const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
	let roll = Math.random() * totalWeight;
	for (const w of weights) {
		roll -= w.weight;
		if (roll <= 0) return w.item;
	}
	return weights[weights.length - 1].item;
}

// ─── Generic distractor generator ──────────────────────────────────────────

/**
 * Generate distractors for a multiple-choice question.
 * Replaces generateDistractors, generateChordDistractors,
 * generateScaleDistractors, and generateModeDistractors.
 *
 * Algorithm:
 * 1. Remove correct answer from eligible items
 * 2. Shuffle remaining eligible items
 * 3. If enough, take first `count`
 * 4. If not enough, fill from allItems sorted by similarity to the correct
 *    item (best confusables first)
 *
 * @param correctId   ID of the correct answer
 * @param eligible    Items currently enabled/unlocked for the user
 * @param allItems    Complete pool of items for this content type
 * @param distanceFn  Distance function: lower value = more similar (better confusable).
 *                    Called as distanceFn(correctItem, candidate).
 * @param count       Number of distractors to generate (default 3)
 */
export function generateDistractors<T extends { id: string }>(
	correctId: string,
	eligible: T[],
	allItems: T[],
	distanceFn: (a: T, b: T) => number,
	count: number = 3,
): T[] {
	const correctItem = allItems.find((i) => i.id === correctId);

	// Filter out correct answer from eligible
	const candidates = eligible.filter((i) => i.id !== correctId);
	const shuffled = [...candidates].sort(() => Math.random() - 0.5);

	if (shuffled.length >= count) {
		return shuffled.slice(0, count);
	}

	// Not enough eligible — fill from allItems sorted by distance (ascending = most similar first)
	const usedIds = new Set([correctId, ...shuffled.map((i) => i.id)]);
	const fill = allItems
		.filter((i) => !usedIds.has(i.id))
		.sort((a, b) => {
			if (!correctItem) return 0;
			return distanceFn(correctItem, a) - distanceFn(correctItem, b);
		});

	const result = [...shuffled];
	for (const item of fill) {
		if (result.length >= count) break;
		result.push(item);
	}

	return result;
}

// ─── Similarity / distance functions ────────────────────────────────────────
// All return a DISTANCE: lower value = more similar = better confusable.

/**
 * Interval distance: absolute difference in semitones.
 * P5 (7) vs P4 (5) → 2; P5 (7) vs TT (6) → 1.
 */
export function intervalSimilarity(a: IntervalDef, b: IntervalDef): number {
	return Math.abs(a.semitones - b.semitones);
}

/**
 * Chord distance: based on how many intervals are NOT shared.
 * Lower = more shared intervals = more confusable.
 */
export function chordSimilarity(a: ChordDef, b: ChordDef): number {
	const setA = new Set(a.intervals);
	const shared = b.intervals.filter((i) => setA.has(i)).length;
	return Math.max(a.intervals.length, b.intervals.length) - shared;
}

/**
 * Scale distance: based on how many intervals are NOT shared.
 * Lower = more shared intervals = more confusable.
 */
export function scaleSimilarity(a: ScaleDef, b: ScaleDef): number {
	const setA = new Set(a.intervals);
	const shared = b.intervals.filter((i) => setA.has(i)).length;
	return Math.max(a.intervals.length, b.intervals.length) - shared;
}

/**
 * Mode distance: same parent scale = close (degree difference),
 * different parent = far (100).
 */
export function modeSimilarity(a: ModeDef, b: ModeDef): number {
	if (a.parent === b.parent) {
		return Math.abs(a.degree - b.degree);
	}
	return 100;
}
