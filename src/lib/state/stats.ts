/**
 * Helper functions for working with v4 unified stats.
 *
 * Stats are keyed by composite string IDs:
 *   - "interval:{id}:{mode}"   (e.g. "interval:P5:ascending")
 *   - "chord:{id}:{voicing}"   (e.g. "chord:maj:root")
 *   - "scale:{id}"             (e.g. "scale:major")
 *   - "mode:{id}"              (e.g. "mode:ionian")
 */

import type { ContentStats, ContentKind } from './schema';
import { defaultContentStats } from './schema';

/** Get stats for a specific composite key, returning defaults if not found. */
export function getStats(
	allStats: Record<string, ContentStats>,
	itemId: string,
): ContentStats {
	return allStats[itemId] ?? defaultContentStats();
}

/** Get accuracy for a single ContentStats entry (0–1). */
export function getAccuracy(stats: ContentStats): number {
	return stats.attempts > 0 ? stats.correct / stats.attempts : 0;
}

/**
 * Get all stat entries whose key starts with a given content kind prefix.
 * e.g. kind='interval' → all keys starting with "interval:"
 */
export function getStatsByKind(
	allStats: Record<string, ContentStats>,
	kind: ContentKind,
): [string, ContentStats][] {
	const prefix = `${kind}:`;
	return Object.entries(allStats).filter(([key]) => key.startsWith(prefix));
}

/**
 * Get all stat entries for a specific definition across sub-keys.
 *
 * Matches keys equal to `{kind}:{defId}` OR starting with `{kind}:{defId}:`.
 * This handles both flat keys (scale:major) and multi-variant keys
 * (interval:P5:ascending, interval:P5:descending, etc.).
 */
export function getStatsForDef(
	allStats: Record<string, ContentStats>,
	kind: ContentKind,
	defId: string,
): [string, ContentStats][] {
	const exact = `${kind}:${defId}`;
	const prefix = `${exact}:`;
	return Object.entries(allStats).filter(
		([key]) => key === exact || key.startsWith(prefix),
	);
}

/**
 * Aggregate attempts + correct across multiple stat entries.
 * Returns total attempts, total correct, and combined accuracy.
 */
export function aggregateStats(
	entries: [string, ContentStats][],
): { attempts: number; correct: number; accuracy: number } {
	let attempts = 0;
	let correct = 0;
	for (const [, stats] of entries) {
		attempts += stats.attempts;
		correct += stats.correct;
	}
	const accuracy = attempts > 0 ? correct / attempts : 0;
	return { attempts, correct, accuracy };
}

/**
 * Get overall accuracy across all stats, optionally filtered by content kind.
 * Returns 0 when there are no attempts.
 */
export function getOverallAccuracy(
	allStats: Record<string, ContentStats>,
	kind?: ContentKind,
): number {
	const entries: [string, ContentStats][] = kind
		? getStatsByKind(allStats, kind)
		: Object.entries(allStats);
	const { accuracy } = aggregateStats(entries);
	return accuracy;
}
