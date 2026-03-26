// src/lib/adaptive.ts — Unified adaptive learning engine (v3.5)

import type { UserState, ModeStats } from './types';
import { INTERVALS } from './intervals';
import { CHORDS } from './chords';
import { SCALES } from './scales';
import { MODES } from './modes';
import { getConnectionBoost, populateRelatedItems } from './connections';
import { calculateSm2, responseQuality, type ResponseInput } from './sm2';

// --- Core types ---

export type ContentKind = 'interval' | 'chord' | 'scale' | 'mode';

export interface ContentItem {
	kind: ContentKind;
	id: string;           // composite: "interval:P5:ascending", "chord:min7:root", "scale:blues"
	defId: string;        // definition id: "P5", "min7", "blues"
	variant?: string;     // mode/voicing: "ascending", "root", etc.
	tier: number;
	category?: string;
}

export interface ContentStats {
	attempts: number;
	correct: number;
	streak: number;
	lastSeen: number;
	easeFactor: number;
	nextReview: number;
	relatedItems: string[];
}

export interface SessionRecord {
	date: number;
	length: number;
	kinds: ContentKind[];
	accuracy: number;
	weakestItem: string;
	strongestItem: string;
}

export interface AdaptiveState {
	stats: Record<string, ContentStats>;
	sessionHistory: SessionRecord[];
	lastSessionDate: number;
}

export interface SessionConfig {
	length: number;
	allowedKinds: ContentKind[];
	mixStrategy: 'adaptive' | 'focused';
}

export interface PlannedQuestion {
	item: ContentItem;
	phase: 'warmup' | 'focus' | 'review';
}

export interface SessionPlan {
	questions: PlannedQuestion[];
	summary: string;
}

// --- Default stats ---

export function defaultContentStats(): ContentStats {
	return {
		attempts: 0,
		correct: 0,
		streak: 0,
		lastSeen: 0,
		easeFactor: 2.5,
		nextReview: 0,
		relatedItems: [],
	};
}

// --- Build all ContentItems from definitions ---

export function buildAllItems(state: UserState): ContentItem[] {
	const items: ContentItem[] = [];

	// Intervals: one item per interval × mode
	for (const def of INTERVALS) {
		const s = state.intervals[def.id];
		if (!s?.unlocked || !s?.enabled) continue;
		for (const mode of ['ascending', 'descending', 'harmonic'] as const) {
			if (!state.settings.enabledModes[mode]) continue;
			items.push({
				kind: 'interval',
				id: `interval:${def.id}:${mode}`,
				defId: def.id,
				variant: mode,
				tier: def.tier,
				category: undefined,
			});
		}
	}

	// Chords: one item per chord × voicing
	for (const def of CHORDS) {
		const s = state.chords[def.id];
		if (!s?.unlocked || !s?.enabled) continue;
		for (const voicing of ['root', 'first', 'second'] as const) {
			if (!state.settings.enabledVoicings[voicing]) continue;
			items.push({
				kind: 'chord',
				id: `chord:${def.id}:${voicing}`,
				defId: def.id,
				variant: voicing,
				tier: def.tier,
				category: def.category,
			});
		}
	}

	// Scales: one item per scale (no variant for now)
	for (const def of SCALES) {
		const s = state.scales[def.id];
		if (!s?.unlocked || !s?.enabled) continue;
		items.push({
			kind: 'scale',
			id: `scale:${def.id}`,
			defId: def.id,
			tier: def.tier,
			category: def.category,
		});
	}

	// Modes: one item per mode (unlocked via tier config)
	for (const def of MODES) {
		// Modes share unlock state with scales tier 4
		// Check if mode is unlocked via the adaptive tier system
		const modeState = state.scales[def.id];
		if (modeState && (!modeState.unlocked || !modeState.enabled)) continue;
		// If no state exists yet, check if modes are unlocked globally
		if (!modeState && !state.adaptive) continue;
		if (!modeState && state.adaptive) {
			// Mode is available if tier 4 scales are unlocked
			const hasModeTier = Object.keys(state.scales).some(
				id => state.scales[id].unlocked && SCALES.find(s => s.id === id)?.tier === 3
			);
			if (!hasModeTier) continue;
		}
		items.push({
			kind: 'mode',
			id: `mode:${def.id}`,
			defId: def.id,
			tier: def.tier,
			category: 'mode',
		});
	}

	return items;
}

// --- Unified pick function ---

export function pickNextItem(
	items: ContentItem[],
	stats: Record<string, ContentStats>,
): ContentItem {
	if (items.length === 0) throw new Error('No items available');
	if (items.length === 1) return items[0];

	const now = Date.now();

	const weights = items.map(item => {
		const s = stats[item.id] ?? defaultContentStats();
		const accuracy = s.attempts > 0 ? s.correct / s.attempts : 0.5;
		const weaknessWeight = 1 - accuracy;

		const overdue = s.nextReview > 0 ? Math.max(0, now - s.nextReview) : 0;
		const reviewWeight = Math.min(1, overdue / (24 * 60 * 60 * 1000));

		const newBoost = s.attempts === 0 ? 0.5 : 0;

		const connectionBoost = getConnectionBoost(item.id, stats);

		return {
			item,
			weight: 0.1
				+ weaknessWeight * 0.4
				+ reviewWeight * 0.3
				+ newBoost
				+ connectionBoost * 0.2,
		};
	});

	return weightedPick(weights);
}

function weightedPick<T>(items: { item: T; weight: number }[]): T {
	const totalWeight = items.reduce((sum, w) => sum + w.weight, 0);
	let roll = Math.random() * totalWeight;
	for (const w of items) {
		roll -= w.weight;
		if (roll <= 0) return w.item;
	}
	return items[items.length - 1].item;
}

// --- Smart session planner ---

export function planSession(
	state: UserState,
	config: SessionConfig,
): SessionPlan {
	const allItems = buildAllItems(state);
	const stats = state.adaptive?.stats ?? {};

	// Filter to allowed kinds
	const eligible = config.allowedKinds.length > 0
		? allItems.filter(item => config.allowedKinds.includes(item.kind))
		: allItems;

	if (eligible.length === 0) {
		return { questions: [], summary: 'No content unlocked yet' };
	}

	const now = Date.now();

	// Score each item by urgency
	const scored = eligible.map(item => {
		const s = stats[item.id] ?? defaultContentStats();
		const accuracy = s.attempts > 0 ? s.correct / s.attempts : 0.5;
		const overdue = s.nextReview > 0 ? Math.max(0, now - s.nextReview) / (24 * 60 * 60 * 1000) : 0;
		const recencyPenalty = s.lastSeen > 0
			? Math.min(1, (now - s.lastSeen) / (7 * 24 * 60 * 60 * 1000))
			: 1;
		const urgency = overdue * (1 - accuracy) * recencyPenalty;
		return { item, urgency, accuracy };
	});

	// Sort by urgency descending
	scored.sort((a, b) => b.urgency - a.urgency);

	const { length } = config;
	const warmupCount = Math.min(Math.ceil(length * 0.15), 3);
	const reviewCount = Math.min(Math.ceil(length * 0.2), 5);
	const focusCount = length - warmupCount - reviewCount;

	const questions: PlannedQuestion[] = [];

	// Warm-up: items the user is good at (high accuracy, recently seen)
	const warmupPool = [...scored].sort((a, b) => b.accuracy - a.accuracy);
	const warmupUsed = new Set<string>();
	for (let i = 0; i < warmupCount && i < warmupPool.length; i++) {
		questions.push({ item: warmupPool[i].item, phase: 'warmup' });
		warmupUsed.add(warmupPool[i].item.id);
	}

	// Focus: highest urgency items, interleaved by kind
	const focusPool = scored.filter(s => !warmupUsed.has(s.item.id));
	const focusItems = interleaveByKind(
		focusPool.slice(0, Math.min(focusPool.length, focusCount * 2)).map(s => s.item),
		focusCount,
	);
	for (const item of focusItems) {
		questions.push({ item, phase: 'focus' });
	}

	// Review: pick from remaining or repeat weakness items
	const usedIds = new Set(questions.map(q => q.item.id));
	const reviewPool = scored.filter(s => !usedIds.has(s.item.id));
	for (let i = 0; i < reviewCount; i++) {
		const item = reviewPool.length > i
			? reviewPool[i].item
			: scored[i % scored.length].item;  // repeat if needed
		questions.push({ item, phase: 'review' });
	}

	// Build summary
	const kinds = [...new Set(questions.map(q => q.item.kind))];
	const weakest = scored.length > 0 ? scored[0].item : null;
	const summary = weakest
		? `${kinds.join(' + ')} • focus: ${weakest.defId}`
		: kinds.join(' + ');

	return { questions, summary };
}

/**
 * Interleave items by kind so we don't cluster same-type questions.
 * Takes up to `count` items from the pool.
 */
function interleaveByKind(items: ContentItem[], count: number): ContentItem[] {
	if (items.length === 0) return [];

	const byKind = new Map<ContentKind, ContentItem[]>();
	for (const item of items) {
		const arr = byKind.get(item.kind) ?? [];
		arr.push(item);
		byKind.set(item.kind, arr);
	}

	const result: ContentItem[] = [];
	const kinds = [...byKind.keys()];
	let kindIdx = 0;

	while (result.length < count) {
		let found = false;
		for (let attempt = 0; attempt < kinds.length; attempt++) {
			const kind = kinds[(kindIdx + attempt) % kinds.length];
			const arr = byKind.get(kind)!;
			if (arr.length > 0) {
				result.push(arr.shift()!);
				kindIdx = (kindIdx + attempt + 1) % kinds.length;
				found = true;
				break;
			}
		}
		if (!found) break; // all pools empty
	}

	return result;
}

// --- Record answer (updates adaptive stats + legacy dual-write) ---

export function recordAdaptiveAnswer(
	state: UserState,
	itemId: string,
	input: ResponseInput,
): void {
	// Ensure adaptive state exists
	if (!state.adaptive) {
		state.adaptive = {
			stats: {},
			sessionHistory: [],
			lastSessionDate: 0,
		};
	}

	const stats = state.adaptive.stats;
	if (!stats[itemId]) {
		stats[itemId] = defaultContentStats();
	}

	const s = stats[itemId];
	const now = Date.now();

	s.attempts++;
	if (input.correct) {
		s.correct++;
		s.streak++;
	} else {
		s.streak = 0;
	}
	s.lastSeen = now;

	// SM-2 update
	const quality = responseQuality(input);
	const sm2 = calculateSm2(s.easeFactor, quality);
	s.easeFactor = sm2.easeFactor;
	s.nextReview = now + sm2.intervalMs;

	// --- Dual-write back to legacy state ---
	const parts = itemId.split(':');
	const kind = parts[0] as ContentKind;
	const defId = parts[1];
	const variant = parts[2];

	if (kind === 'interval' && variant) {
		const interval = state.intervals[defId];
		if (interval) {
			const mode = variant as keyof typeof interval.modes;
			const modeStats = interval.modes[mode];
			if (modeStats) {
				modeStats.attempts = s.attempts;
				modeStats.correct = s.correct;
				modeStats.streak = s.streak;
				modeStats.lastSeen = s.lastSeen;
				modeStats.easeFactor = s.easeFactor;
				modeStats.nextReview = s.nextReview;
			}
		}
	} else if (kind === 'chord' && variant) {
		const chord = state.chords[defId];
		if (chord) {
			const voicing = variant as keyof typeof chord.voicings;
			const voicingStats = chord.voicings[voicing];
			if (voicingStats) {
				voicingStats.attempts = s.attempts;
				voicingStats.correct = s.correct;
				voicingStats.streak = s.streak;
				voicingStats.lastSeen = s.lastSeen;
				voicingStats.easeFactor = s.easeFactor;
				voicingStats.nextReview = s.nextReview;
			}
		}
	} else if (kind === 'scale') {
		const scale = state.scales[defId];
		if (scale) {
			scale.attempts = s.attempts;
			scale.correct = s.correct;
			scale.streak = s.streak;
			scale.lastSeen = s.lastSeen;
			scale.easeFactor = s.easeFactor;
			scale.nextReview = s.nextReview;
		}
	}
	// mode kind — no legacy state to write back to (new content type)
}

// --- Migration: build adaptive stats from existing legacy state ---

export function migrateToAdaptive(state: UserState): UserState {
	if (state.adaptive) return state;

	const stats: Record<string, ContentStats> = {};

	// Intervals
	for (const [id, s] of Object.entries(state.intervals)) {
		for (const mode of ['ascending', 'descending', 'harmonic'] as const) {
			const ms = s.modes[mode];
			const key = `interval:${id}:${mode}`;
			stats[key] = {
				attempts: ms.attempts,
				correct: ms.correct,
				streak: ms.streak,
				lastSeen: ms.lastSeen,
				easeFactor: ms.easeFactor,
				nextReview: ms.nextReview,
				relatedItems: [],
			};
		}
	}

	// Chords
	for (const [id, s] of Object.entries(state.chords)) {
		for (const voicing of ['root', 'first', 'second'] as const) {
			const vs = s.voicings[voicing];
			const key = `chord:${id}:${voicing}`;
			stats[key] = {
				attempts: vs.attempts,
				correct: vs.correct,
				streak: vs.streak,
				lastSeen: vs.lastSeen,
				easeFactor: vs.easeFactor,
				nextReview: vs.nextReview,
				relatedItems: [],
			};
		}
	}

	// Scales
	for (const [id, s] of Object.entries(state.scales)) {
		const key = `scale:${id}`;
		stats[key] = {
			attempts: s.attempts,
			correct: s.correct,
			streak: s.streak,
			lastSeen: s.lastSeen,
			easeFactor: s.easeFactor,
			nextReview: s.nextReview,
			relatedItems: [],
		};
	}

	// Populate cross-content connections
	populateRelatedItems(stats);

	return {
		...state,
		adaptive: {
			stats,
			sessionHistory: [],
			lastSessionDate: 0,
		},
	};
}
