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

	// --- Pack accuracy (average across all items in pack) ---
	function getPackAccuracy(pack: ContentPack): number {
		if (!state) return 0;
		const packs = getPacksForFilter(pack);
		let totalAttempts = 0;
		let totalCorrect = 0;

		// Intervals
		for (const def of INTERVALS) {
			if (!packs.has(def.pack)) continue;
			const entries = Object.entries(state.stats).filter(([k]) => k.startsWith(`interval:${def.id}:`));
			for (const [, s] of entries) { totalAttempts += s.attempts; totalCorrect += s.correct; }
		}
		// Chords
		for (const def of CHORDS) {
			if (!packs.has(def.pack)) continue;
			const entries = Object.entries(state.stats).filter(([k]) => k.startsWith(`chord:${def.id}:`));
			for (const [, s] of entries) { totalAttempts += s.attempts; totalCorrect += s.correct; }
		}
		// Scales
		for (const def of SCALES) {
			if (!packs.has(def.pack)) continue;
			const key = `scale:${def.id}`;
			if (state.stats[key]) { totalAttempts += state.stats[key].attempts; totalCorrect += state.stats[key].correct; }
		}
		// Modes
		for (const def of MODES) {
			if (!packs.has(def.pack)) continue;
			const key = `mode:${def.id}`;
			if (state.stats[key]) { totalAttempts += state.stats[key].attempts; totalCorrect += state.stats[key].correct; }
		}

		return totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
	}

	// --- Paths data ---
	interface PathInfo {
		id: ContentPack;
		name: string;
		unlocked: boolean;
		count: string;
		accuracy: number;
		price: string;
	}

	const paths = $derived((): PathInfo[] => {
		if (!state) return [];
		const settings = state.settings;
		return [
			{ id: 'beginner', name: 'BEGINNER', unlocked: true, count: String(countPackItems('beginner')), accuracy: getPackAccuracy('beginner'), price: 'FREE' },
			{ id: 'blues', name: 'BLUES / ROCK', unlocked: isPackUnlocked('blues', settings), count: String(countPackItems('blues')), accuracy: getPackAccuracy('blues'), price: '$1.99' },
			{ id: 'jazz', name: 'JAZZ', unlocked: isPackUnlocked('jazz', settings), count: String(countPackItems('jazz')), accuracy: getPackAccuracy('jazz'), price: '$1.99' },
			{ id: 'advanced', name: 'ADVANCED', unlocked: isPackUnlocked('advanced', settings), count: String(countPackItems('advanced')), accuracy: getPackAccuracy('advanced'), price: '$4.99' },
		];
	});

	// --- Type availability ---
	const modesAvailable = $derived(() => {
		if (!state) return false;
		return isContentKindAvailable(state, 'mode');
	});

	// --- Dev mode mock unlock ---
	function handleLockedPathClick(packId: ContentPack) {
		if (!state) return;
		if (!state.settings.devMode) return;
		// Toggle: add pack to unlockedPacks
		const packs = state.settings.unlockedPacks ?? [];
		if (!packs.includes(packId)) {
			state.settings.unlockedPacks = [...packs, packId];
		} else {
			state.settings.unlockedPacks = packs.filter(p => p !== packId);
		}
		saveStateV4(state);
		// Trigger reactivity
		state = { ...state };
	}
</script>

<div class="practice-page">
	<h2 class="heading">PRACTICE</h2>

	{#if state}
		<!-- Quick Start -->
		<section class="section">
			<a href="{base}/quiz/adaptive" class="quick-start-btn">
				QUICK START
			</a>
		</section>

		<!-- Paths -->
		<section class="section">
			<label class="section-label">PATHS</label>
			<div class="path-grid">
				{#each paths() as path}
					{#if path.unlocked}
						<a href="{base}/quiz/path/{path.id}" class="path-card">
							<div class="path-header">
								<span class="path-name">{path.name}</span>
								<span class="path-count">{path.count} ITEMS</span>
							</div>
							<div class="path-footer">
								{#if path.accuracy > 0}
									<span class="path-accuracy">{path.accuracy}%</span>
								{:else}
									<span class="path-new">NEW</span>
								{/if}
							</div>
						</a>
					{:else}
						<button
							class="path-card locked"
							onclick={() => handleLockedPathClick(path.id)}
							disabled={!state?.settings.devMode}
						>
							<div class="path-header">
								<span class="path-name">{path.name}</span>
								<span class="path-count">{path.count} ITEMS</span>
							</div>
							<div class="path-footer">
								<span class="path-price">{path.price}</span>
								<span class="path-lock">PRO</span>
							</div>
						</button>
					{/if}
				{/each}
			</div>
		</section>

		<!-- By Type -->
		<section class="section">
			<label class="section-label">BY TYPE</label>
			<div class="type-grid">
				<a href="{base}/quiz/intervals" class="type-btn">INT</a>
				<a href="{base}/quiz/chords" class="type-btn">CRD</a>
				<a href="{base}/quiz/scales" class="type-btn">SCL</a>
				{#if modesAvailable()}
					<a href="{base}/quiz/modes" class="type-btn">MODE</a>
				{/if}
			</div>
		</section>
	{/if}
</div>

<style>
	.practice-page {
		display: flex;
		flex-direction: column;
		gap: 0;
		padding: 0.75rem 0.75rem;
		padding-top: calc(env(safe-area-inset-top, 0px) + 0.75rem);
		height: 100%;
		overflow-y: auto;
	}

	.heading {
		font-family: var(--font-display, 'Maratype', monospace);
		font-size: 2rem;
		font-weight: 400;
		letter-spacing: 0.12em;
		color: var(--accent, #C2FE0C);
		margin: 0 0 0.75rem 0;
		line-height: 1;
	}

	.section {
		margin-bottom: 1rem;
	}

	.section-label {
		display: block;
		font-family: var(--mono, monospace);
		font-size: 0.35rem;
		font-weight: 900;
		letter-spacing: 0.2em;
		color: var(--text-secondary, #666);
		margin-bottom: 0.4rem;
		text-transform: uppercase;
	}

	/* ─── Quick Start ─── */
	.quick-start-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		padding: 1rem;
		background: var(--accent, #C2FE0C);
		color: var(--base, #0A0A0A);
		font-family: var(--mono, monospace);
		font-size: 0.65rem;
		font-weight: 900;
		letter-spacing: 0.2em;
		text-decoration: none;
		text-transform: uppercase;
		border: none;
		transition: opacity 0.15s;
	}
	.quick-start-btn:active {
		opacity: 0.85;
	}

	/* ─── Path Grid ─── */
	.path-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2px;
	}

	.path-card {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		background: var(--surface, #1A1A1A);
		border: 1px solid var(--accent, #C2FE0C);
		padding: 0;
		text-decoration: none;
		color: inherit;
		overflow: hidden;
		min-height: 5rem;
		cursor: pointer;
		transition: border-color 0.15s, opacity 0.15s;
	}
	.path-card:active {
		opacity: 0.85;
	}

	.path-card.locked {
		border-color: color-mix(in srgb, var(--marathon-blue, #3A2CFF) 40%, var(--border-heavy, #333));
		opacity: 0.5;
	}
	.path-card.locked:disabled {
		cursor: not-allowed;
	}
	.path-card.locked:not(:disabled) {
		cursor: pointer;
		opacity: 0.6;
	}
	.path-card.locked:not(:disabled):active {
		opacity: 0.5;
	}

	.path-header {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.5rem 0.6rem 0.3rem;
	}

	.path-name {
		font-family: var(--mono, monospace);
		font-size: 0.45rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		color: var(--text-primary, #E8E8E8);
		text-transform: uppercase;
	}

	.path-count {
		font-family: var(--mono, monospace);
		font-size: 0.3rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--text-secondary, #666);
	}

	.path-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.3rem 0.6rem 0.4rem;
		border-top: 1px solid var(--border, #1F1F1F);
	}

	.path-accuracy {
		font-family: var(--mono, monospace);
		font-size: 0.55rem;
		font-weight: 900;
		letter-spacing: 0.05em;
		color: var(--accent, #C2FE0C);
	}

	.path-new {
		font-family: var(--mono, monospace);
		font-size: 0.3rem;
		font-weight: 900;
		letter-spacing: 0.15em;
		color: var(--text-secondary, #666);
	}

	.path-price {
		font-family: var(--mono, monospace);
		font-size: 0.4rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		color: var(--marathon-blue, #3A2CFF);
	}

	.path-lock {
		font-family: var(--mono, monospace);
		font-size: 0.3rem;
		font-weight: 900;
		letter-spacing: 0.2em;
		color: var(--marathon-blue, #3A2CFF);
	}

	/* ─── Type Grid ─── */
	.type-grid {
		display: flex;
		gap: 2px;
	}

	.type-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.65rem 0.5rem;
		background: var(--surface, #1A1A1A);
		border: 1px solid var(--border-heavy, #333);
		font-family: var(--mono, monospace);
		font-size: 0.45rem;
		font-weight: 900;
		letter-spacing: 0.12em;
		color: var(--text-primary, #E8E8E8);
		text-decoration: none;
		text-transform: uppercase;
		transition: border-color 0.15s, background 0.15s;
	}
	.type-btn:active {
		background: var(--surface-raised, #242424);
		border-color: var(--accent, #C2FE0C);
	}

	/* ─── Desktop ─── */
	@media (min-width: 768px) {
		.practice-page {
			max-width: 600px;
			margin: 0 auto;
			padding: 1.5rem 2rem;
		}
		.heading {
			font-size: 2.5rem;
		}
		.path-grid {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
