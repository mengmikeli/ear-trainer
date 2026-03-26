// src/lib/connections.ts — Cross-content musical connection map (v3.5)

import type { ContentStats } from './adaptive';
import { CHORDS } from './chords';
import { SCALES } from './scales';

// --- Connection definitions ---

export interface Connection {
	from: string;         // ContentItem id prefix (e.g. "interval:M3")
	to: string;           // ContentItem id prefix (e.g. "chord:maj")
	relationship: 'builds' | 'step' | 'character' | 'harmonic';
	description: string;  // terse, industrial tone
}

/**
 * Hand-curated connections between intervals, chords, and scales.
 * These are the musically meaningful relationships that drive the
 * connection boost in the adaptive engine.
 */
export const CURATED_CONNECTIONS: Connection[] = [
	// Intervals → Chords
	{ from: 'interval:M3', to: 'chord:maj', relationship: 'builds',
		description: 'M3 → defines major chords' },
	{ from: 'interval:m3', to: 'chord:min', relationship: 'builds',
		description: 'm3 → defines minor chords' },
	{ from: 'interval:P5', to: 'chord:maj', relationship: 'builds',
		description: 'P5 → completes major triad' },
	{ from: 'interval:P5', to: 'chord:min', relationship: 'builds',
		description: 'P5 → completes minor triad' },
	{ from: 'interval:TT', to: 'chord:dim', relationship: 'builds',
		description: 'TT → defines diminished triad' },
	{ from: 'interval:M3', to: 'chord:aug', relationship: 'builds',
		description: 'M3 → stacked thirds form augmented' },
	{ from: 'interval:m7', to: 'chord:dom7', relationship: 'builds',
		description: 'm7 on major triad → dominant 7th' },
	{ from: 'interval:M7', to: 'chord:maj7', relationship: 'builds',
		description: 'M7 on major triad → major 7th' },
	{ from: 'interval:m7', to: 'chord:min7', relationship: 'builds',
		description: 'm7 on minor triad → minor 7th' },
	{ from: 'interval:m3', to: 'chord:dim7', relationship: 'builds',
		description: 'stacked m3s → diminished 7th' },

	// Intervals → Scales
	{ from: 'interval:M2', to: 'scale:major', relationship: 'step',
		description: 'M2 whole steps drive the major scale' },
	{ from: 'interval:m3', to: 'scale:min_pent', relationship: 'character',
		description: 'm3 → minor pentatonic color' },
	{ from: 'interval:TT', to: 'scale:blues', relationship: 'character',
		description: 'TT → the blue note' },
	{ from: 'interval:m2', to: 'scale:chromatic', relationship: 'step',
		description: 'm2 half steps → chromatic scale' },
	{ from: 'interval:M7', to: 'scale:harm_min', relationship: 'character',
		description: 'M7 → harmonic minor leading tone' },
	{ from: 'interval:M6', to: 'scale:mel_min', relationship: 'character',
		description: 'M6 → melodic minor raised 6th' },

	// Chords → Scales
	{ from: 'chord:maj', to: 'scale:major', relationship: 'harmonic',
		description: 'major chord → I of major scale' },
	{ from: 'chord:min', to: 'scale:nat_min', relationship: 'harmonic',
		description: 'minor chord → i of natural minor' },
	{ from: 'chord:dom7', to: 'scale:blues', relationship: 'harmonic',
		description: 'dom7 over blues → classic blues' },
	{ from: 'chord:dim', to: 'scale:harm_min', relationship: 'harmonic',
		description: 'dim triad → vii° of harmonic minor' },

	// Intervals → Modes
	{ from: 'interval:m3', to: 'mode:dorian', relationship: 'character',
		description: 'm3 + m7 → dorian color' },
	{ from: 'interval:m7', to: 'mode:mixolydian', relationship: 'character',
		description: 'm7 on major → mixolydian' },
	{ from: 'interval:m2', to: 'mode:phrygian', relationship: 'character',
		description: 'm2 → phrygian Spanish sound' },
	{ from: 'interval:TT', to: 'mode:lydian', relationship: 'character',
		description: 'TT (aug4) → lydian dreamy quality' },
];

/**
 * Build the full connection index from curated list.
 * Returns a map from ContentItem id prefix → array of related id prefixes.
 */
function buildConnectionIndex(): Map<string, string[]> {
	const index = new Map<string, string[]>();

	for (const conn of CURATED_CONNECTIONS) {
		// Bidirectional
		if (!index.has(conn.from)) index.set(conn.from, []);
		if (!index.has(conn.to)) index.set(conn.to, []);
		index.get(conn.from)!.push(conn.to);
		index.get(conn.to)!.push(conn.from);
	}

	return index;
}

const CONNECTION_INDEX = buildConnectionIndex();

/**
 * Get connection boost for a ContentItem based on related items' recent failures.
 * If a related item was recently failed (low accuracy, seen recently), boost this item.
 *
 * @returns 0-1 boost value
 */
export function getConnectionBoost(
	itemId: string,
	stats: Record<string, ContentStats>,
): number {
	// Find all connection prefixes that match this item
	// e.g. "interval:M3:ascending" matches prefix "interval:M3"
	const parts = itemId.split(':');
	const prefixes = [
		parts.slice(0, 2).join(':'),  // "interval:M3"
		parts.slice(0, 1).join(':'),  // "interval"
	];

	let maxBoost = 0;
	const now = Date.now();
	const recentWindow = 3 * 24 * 60 * 60 * 1000; // 3 days

	for (const prefix of prefixes) {
		const related = CONNECTION_INDEX.get(prefix);
		if (!related) continue;

		for (const relatedPrefix of related) {
			// Find all stats entries matching this related prefix
			for (const [id, s] of Object.entries(stats)) {
				if (!id.startsWith(relatedPrefix)) continue;
				if (s.attempts === 0) continue;

				const accuracy = s.correct / s.attempts;
				const recency = s.lastSeen > 0 && (now - s.lastSeen) < recentWindow ? 1 : 0;

				// Boost when related item has low accuracy and was seen recently
				if (accuracy < 0.6 && recency > 0) {
					const boost = (1 - accuracy) * 0.5;
					maxBoost = Math.max(maxBoost, boost);
				}
			}
		}
	}

	return Math.min(1, maxBoost);
}

/**
 * Populate relatedItems arrays in a stats map based on the connection index.
 * Called once during migration.
 */
export function populateRelatedItems(stats: Record<string, ContentStats>): void {
	const ids = Object.keys(stats);

	for (const id of ids) {
		const parts = id.split(':');
		const prefix = parts.slice(0, 2).join(':');
		const related = CONNECTION_INDEX.get(prefix);
		if (!related) continue;

		const relatedIds: string[] = [];
		for (const relatedPrefix of related) {
			for (const otherId of ids) {
				if (otherId.startsWith(relatedPrefix) && otherId !== id) {
					relatedIds.push(otherId);
				}
			}
		}
		stats[id].relatedItems = relatedIds;
	}
}

/**
 * Get the description for a connection between two items (if one exists).
 * Used for potential future UI features.
 */
export function getConnectionDescription(fromId: string, toId: string): string | null {
	const fromPrefix = fromId.split(':').slice(0, 2).join(':');
	const toPrefix = toId.split(':').slice(0, 2).join(':');

	for (const conn of CURATED_CONNECTIONS) {
		if (
			(conn.from === fromPrefix && conn.to === toPrefix) ||
			(conn.from === toPrefix && conn.to === fromPrefix)
		) {
			return conn.description;
		}
	}
	return null;
}
