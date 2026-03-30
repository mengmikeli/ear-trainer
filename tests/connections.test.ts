// tests/connections.test.ts — Tests for cross-content connections

import { describe, it, expect } from 'vitest';
import { getConnectionBoost, populateRelatedItems, getConnectionDescription, CURATED_CONNECTIONS } from '../src/lib/connections';
import { defaultContentStats, type ContentStats } from '../src/lib/adaptive';

describe('CURATED_CONNECTIONS', () => {
	it('has connections for intervals → chords', () => {
		const intervalToChord = CURATED_CONNECTIONS.filter(
			c => c.from.startsWith('interval:') && c.to.startsWith('chord:')
		);
		expect(intervalToChord.length).toBeGreaterThan(0);
	});

	it('has connections for intervals → scales', () => {
		const intervalToScale = CURATED_CONNECTIONS.filter(
			c => c.from.startsWith('interval:') && c.to.startsWith('scale:')
		);
		expect(intervalToScale.length).toBeGreaterThan(0);
	});

	it('has connections for chords → scales', () => {
		const chordToScale = CURATED_CONNECTIONS.filter(
			c => c.from.startsWith('chord:') && c.to.startsWith('scale:')
		);
		expect(chordToScale.length).toBeGreaterThan(0);
	});

	it('has connections for intervals → modes', () => {
		const intervalToMode = CURATED_CONNECTIONS.filter(
			c => c.from.startsWith('interval:') && c.to.startsWith('mode:')
		);
		expect(intervalToMode.length).toBeGreaterThan(0);
	});
});

describe('getConnectionBoost', () => {
	it('returns 0 when no related items have stats', () => {
		const boost = getConnectionBoost('interval:M3:ascending', {});
		expect(boost).toBe(0);
	});

	it('returns positive boost when related item was recently failed', () => {
		const stats: Record<string, ContentStats> = {
			'chord:maj:root': {
				...defaultContentStats(),
				attempts: 20,
				correct: 8,  // 40% accuracy — low
				lastSeen: Date.now() - 1000,  // just now
			},
		};

		// M3 is connected to chord:maj
		const boost = getConnectionBoost('interval:M3:ascending', stats);
		expect(boost).toBeGreaterThan(0);
	});

	it('returns 0 when related items have high accuracy', () => {
		const stats: Record<string, ContentStats> = {
			'chord:maj:root': {
				...defaultContentStats(),
				attempts: 20,
				correct: 19,  // 95% accuracy — high
				lastSeen: Date.now() - 1000,
			},
		};

		const boost = getConnectionBoost('interval:M3:ascending', stats);
		expect(boost).toBe(0);
	});

	it('returns 0 when related items were seen long ago', () => {
		const stats: Record<string, ContentStats> = {
			'chord:maj:root': {
				...defaultContentStats(),
				attempts: 20,
				correct: 8,
				lastSeen: Date.now() - 30 * 24 * 60 * 60 * 1000,  // 30 days ago
			},
		};

		const boost = getConnectionBoost('interval:M3:ascending', stats);
		expect(boost).toBe(0);
	});
});

describe('populateRelatedItems', () => {
	it('populates related items bidirectionally', () => {
		const stats: Record<string, ContentStats> = {
			'interval:M3:ascending': defaultContentStats(),
			'chord:maj:root': defaultContentStats(),
		};

		populateRelatedItems(stats);

		expect(stats['interval:M3:ascending'].relatedItems).toContain('chord:maj:root');
		expect(stats['chord:maj:root'].relatedItems).toContain('interval:M3:ascending');
	});

	it('does not include self in related items', () => {
		const stats: Record<string, ContentStats> = {
			'interval:M3:ascending': defaultContentStats(),
			'interval:M3:descending': defaultContentStats(),
			'chord:maj:root': defaultContentStats(),
		};

		populateRelatedItems(stats);

		// M3 ascending shouldn't list itself
		expect(stats['interval:M3:ascending'].relatedItems).not.toContain('interval:M3:ascending');
		// But it should list chord:maj:root (connected) and potentially M3:descending (same prefix → shares connections)
		expect(stats['interval:M3:ascending'].relatedItems).toContain('chord:maj:root');
	});
});

describe('getConnectionDescription', () => {
	it('returns description for connected items', () => {
		const desc = getConnectionDescription('interval:M3:ascending', 'chord:maj:root');
		expect(desc).toBeTruthy();
		expect(desc).toContain('M3');
	});

	it('returns description bidirectionally', () => {
		const desc1 = getConnectionDescription('interval:M3:ascending', 'chord:maj:root');
		const desc2 = getConnectionDescription('chord:maj:root', 'interval:M3:ascending');
		expect(desc1).toBe(desc2);
	});

	it('returns null for unconnected items', () => {
		const desc = getConnectionDescription('interval:P1:ascending', 'scale:chromatic');
		expect(desc).toBeNull();
	});
});
