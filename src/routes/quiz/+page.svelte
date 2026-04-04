<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { loadStateV4, saveStateV4 } from '$lib/state/storage';
	import { isPackUnlocked } from '$lib/features/gate';
	import { isContentKindAvailable } from '$lib/features/content-access';
	import { getStatsByKind, aggregateStats } from '$lib/state/stats';
	import { INTERVALS } from '$lib/definitions/intervals';
	import { CHORDS } from '$lib/definitions/chords';
	import { SCALES } from '$lib/definitions/scales';
	import { MODES } from '$lib/definitions/modes';
	import type { UserStateV4, ContentPack } from '$lib/state/schema';

	let state: UserStateV4 | null = $state(null);

	// Marathon corporation colors — paths
	const packColors: Record<string, string> = {
		beginner: '#C2FE0C',  // CyberAcme — green (our accent)
		blues:    '#FFB800',  // MIDA — military amber
		jazz:     '#A855F7',  // NuCaloric — purple/violet
		advanced: '#FF0D1A',  // Traxus — industrial red
	};

	onMount(() => {
		state = loadStateV4();
	});

	// --- Pack item counts (cumulative per spec) ---
	function countPackItems(pack: ContentPack): number {
		const packs = getPacksForFilter(pack);
		let count = 0;
		for (const def of INTERVALS) { if (packs.has(def.pack)) count++; }
		for (const def of CHORDS) { if (packs.has(def.pack)) count++; }
		for (const def of SCALES) { if (packs.has(def.pack)) count++; }
		for (const def of MODES) { if (packs.has(def.pack)) count++; }
		return count;
	}

	function getPacksForFilter(pack: ContentPack): Set<ContentPack> {
		switch (pack) {
			case 'beginner': return new Set(['beginner']);
			case 'blues': return new Set(['beginner', 'blues']);
			case 'jazz': return new Set(['beginner', 'jazz']);
			case 'advanced': return new Set(['beginner', 'blues', 'jazz', 'advanced']);
			default: return new Set(['beginner']);
		}
	}

	// --- Pack accuracy + attempt tracking ---
	function getPackStats(pack: ContentPack): { accuracy: number; hasAttempts: boolean } {
		if (!state) return { accuracy: 0, hasAttempts: false };
		const packs = getPacksForFilter(pack);
		let totalAttempts = 0;
		let totalCorrect = 0;

		for (const def of INTERVALS) {
			if (!packs.has(def.pack)) continue;
			const entries = Object.entries(state.stats).filter(([k]) => k.startsWith(`interval:${def.id}:`));
			for (const [, s] of entries) { totalAttempts += s.attempts; totalCorrect += s.correct; }
		}
		for (const def of CHORDS) {
			if (!packs.has(def.pack)) continue;
			const entries = Object.entries(state.stats).filter(([k]) => k.startsWith(`chord:${def.id}:`));
			for (const [, s] of entries) { totalAttempts += s.attempts; totalCorrect += s.correct; }
		}
		for (const def of SCALES) {
			if (!packs.has(def.pack)) continue;
			const key = `scale:${def.id}`;
			if (state.stats[key]) { totalAttempts += state.stats[key].attempts; totalCorrect += state.stats[key].correct; }
		}
		for (const def of MODES) {
			if (!packs.has(def.pack)) continue;
			const key = `mode:${def.id}`;
			if (state.stats[key]) { totalAttempts += state.stats[key].attempts; totalCorrect += state.stats[key].correct; }
		}

		return {
			accuracy: totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0,
			hasAttempts: totalAttempts > 0,
		};
	}

	// --- Paths data ---
	interface PathInfo {
		id: ContentPack;
		name: string;
		unlocked: boolean;
		count: string;
		accuracy: number;
		hasAttempts: boolean;
		price: string;
		color: string;
	}

	const paths = $derived((): PathInfo[] => {
		if (!state) return [];
		const settings = state.settings;
		return [
			{ id: 'beginner', name: 'BEGINNER', unlocked: true, count: String(countPackItems('beginner')), ...getPackStats('beginner'), price: 'FREE', color: packColors.beginner },
			{ id: 'blues', name: 'BLUES / ROCK', unlocked: isPackUnlocked('blues', settings), count: String(countPackItems('blues')), ...getPackStats('blues'), price: '$1.99', color: packColors.blues },
			{ id: 'jazz', name: 'JAZZ', unlocked: isPackUnlocked('jazz', settings), count: String(countPackItems('jazz')), ...getPackStats('jazz'), price: '$1.99', color: packColors.jazz },
			{ id: 'advanced', name: 'ADVANCED', unlocked: isPackUnlocked('advanced', settings), count: String(countPackItems('advanced')), ...getPackStats('advanced'), price: '$4.99', color: packColors.advanced },
		];
	});

	// --- Type data ---
	interface TypeInfo {
		id: string;
		name: string;
		href: string;
		count: number;
		accuracy: number;
		hasAttempts: boolean;
		unlocked: boolean;
		color: string;
	}

	const types = $derived((): TypeInfo[] => {
		if (!state) return [];
		const dev = state.settings.devMode;
		const intervalStats = aggregateStats(getStatsByKind(state.stats, 'interval'));
		const chordStats = aggregateStats(getStatsByKind(state.stats, 'chord'));
		const scaleStats = aggregateStats(getStatsByKind(state.stats, 'scale'));
		const modeStats = aggregateStats(getStatsByKind(state.stats, 'mode'));

		const typeColor = 'var(--marathon-blue)';
		return [
			{ id: 'intervals', name: 'INTERVALS', href: `${base}/quiz/intervals`, count: INTERVALS.length,
				accuracy: intervalStats.attempts > 0 ? Math.round(intervalStats.accuracy * 100) : 0,
				hasAttempts: intervalStats.attempts > 0, unlocked: true, color: typeColor },
			{ id: 'chords', name: 'CHORDS', href: `${base}/quiz/chords`, count: CHORDS.length,
				accuracy: chordStats.attempts > 0 ? Math.round(chordStats.accuracy * 100) : 0,
				hasAttempts: chordStats.attempts > 0, unlocked: true, color: typeColor },
			{ id: 'scales', name: 'SCALES', href: `${base}/quiz/scales`, count: SCALES.length,
				accuracy: scaleStats.attempts > 0 ? Math.round(scaleStats.accuracy * 100) : 0,
				hasAttempts: scaleStats.attempts > 0, unlocked: true, color: typeColor },
			{ id: 'modes', name: 'MODES', href: `${base}/quiz/modes`, count: MODES.length,
				accuracy: modeStats.attempts > 0 ? Math.round(modeStats.accuracy * 100) : 0,
				hasAttempts: modeStats.attempts > 0,
				unlocked: isContentKindAvailable(state!, 'mode') || dev, color: typeColor },
		];
	});

	// --- Dev mode mock unlock ---
	function handleLockedPathClick(packId: ContentPack) {
		if (!state) return;
		if (!state.settings.devMode) return;
		const packs = state.settings.unlockedPacks ?? [];
		if (!packs.includes(packId)) {
			state.settings.unlockedPacks = [...packs, packId];
		} else {
			state.settings.unlockedPacks = packs.filter(p => p !== packId);
		}
		saveStateV4(state);
		state = { ...state };
	}
</script>

<div class="practice-page">
	<h2 class="heading">PRACTICE</h2>

	{#if state}
		<!-- Paths -->
		<div class="section">
			<label class="section-label">PATHS</label>
			<div class="card-grid">
				{#each paths() as path}
					{#if path.unlocked}
						<a href="{base}/quiz/path/{path.id}" class="pack-card" style="border-left-color: {path.color}">
							<span class="card-name" style="color: {path.color}">{path.name}</span>
							<span class="card-count">{path.count} ITEMS</span>
							{#if path.hasAttempts}
								<span class="card-stat">{path.accuracy}% ACC</span>
							{:else if path.id === 'beginner'}
								<span class="card-stat card-free">FREE</span>
							{:else}
								<span class="card-stat">--</span>
							{/if}
						</a>
					{:else}
						<button
							class="pack-card locked"
							style="border-left-color: {path.color}"
							onclick={() => handleLockedPathClick(path.id)}
							disabled={!state?.settings.devMode}
						>
							<span class="card-name" style="color: {path.color}">{path.name}</span>
							<span class="card-count">{path.count} ITEMS</span>
							<span class="card-stat card-pro">{path.price} PRO</span>
						</button>
					{/if}
				{/each}
			</div>
		</div>

		<!-- By Type -->
		<div class="section">
			<label class="section-label">BY TYPE</label>
			<div class="card-grid">
				{#each types() as type}
					{#if type.unlocked}
						<a href={type.href} class="pack-card" style="border-left-color: {type.color}">
							<span class="card-name" style="color: {type.color}">{type.name}</span>
							<span class="card-count">{type.count} ITEMS</span>
							{#if type.hasAttempts}
								<span class="card-stat">{type.accuracy}% ACC</span>
							{:else}
								<span class="card-stat">--</span>
							{/if}
						</a>
					{:else}
						<span class="pack-card locked" style="border-left-color: {type.color}">
							<span class="card-name">{type.name}</span>
							<span class="card-count">{type.count} ITEMS</span>
							<span class="card-stat card-pro">PRO</span>
						</span>
					{/if}
				{/each}
			</div>
		</div>

		<!-- Quick Start -->
		<div class="section">
			<a href="{base}/quiz/adaptive" class="quick-start">QUICK START</a>
		</div>
	{/if}
</div>

<style>
	.practice-page { display: flex; flex-direction: column; gap: 1.5rem; }

	/* ─── Heading — matches settings/progress ─── */
	.heading {
		font-size: 3rem; font-weight: 400;
		letter-spacing: 0.12em; color: var(--text-primary);
		padding-bottom: 0.5rem; border-bottom: 2px solid var(--border-heavy);
		text-transform: uppercase; font-family: var(--font-display);
	}

	/* ─── Sections ─── */
	.section { display: flex; flex-direction: column; gap: 0.5rem; }

	/* ─── Section labels — matches settings .field-label ─── */
	.section-label {
		font-size: 0.6rem; font-weight: 400;
		letter-spacing: 0.25em; color: var(--text-primary);
		font-family: var(--font-display);
	}

	/* ─── Card Grid — 2×2 mobile ─── */
	.card-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	/* ─── Unified card: paths + types ─── */
	.pack-card {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: flex-start;
		gap: 0.2rem;
		min-height: 5rem;
		padding: 0.6rem;
		background: var(--surface);
		border: 1px solid var(--border-heavy);
		border-left: 3px solid var(--accent); /* overridden by inline style */
		text-decoration: none;
		text-align: left;
		color: inherit;
		cursor: pointer;
		transition: opacity 0.15s;
	}
	.pack-card:active { opacity: 0.85; }

	/* Locked state */
	.pack-card.locked {
		opacity: 0.5;
	}
	.pack-card.locked:disabled { cursor: not-allowed; }
	.pack-card.locked:not(:disabled) { cursor: pointer; }
	.pack-card.locked:not(:disabled):active { opacity: 0.4; }

	/* Card content */
	.card-name {
		font-family: var(--font-display);
		font-size: 0.55rem; font-weight: 400;
		letter-spacing: 0.15em;
		color: var(--text-primary);
		text-transform: uppercase;
	}

	.card-count {
		font-family: var(--mono);
		font-size: 0.35rem; font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--text-secondary);
	}

	.card-stat {
		font-family: var(--mono);
		font-size: 0.4rem; font-weight: 900;
		letter-spacing: 0.08em;
		color: var(--text-secondary);
	}

	.card-free { color: var(--accent); }
	.card-pro { color: var(--marathon-blue); }

	/* ─── Quick Start — secondary, full-width ─── */
	.quick-start {
		width: 100%;
		padding: 0.85rem;
		font-family: var(--mono);
		font-size: 0.45rem;
		font-weight: 900;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		background: transparent;
		border: 1px solid var(--border-heavy);
		color: var(--text-secondary);
		text-align: center;
		text-decoration: none;
		display: block;
	}
	.quick-start:active {
		border-color: var(--accent);
		color: var(--accent);
	}

	/* ─── Desktop ─── */
	@media (min-width: 768px) {
		.heading { font-size: 3.5rem; }
	}
</style>
