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
	}

	const paths = $derived((): PathInfo[] => {
		if (!state) return [];
		const settings = state.settings;
		return [
			{ id: 'beginner', name: 'BEGINNER', unlocked: true, count: String(countPackItems('beginner')), ...getPackStats('beginner'), price: 'FREE' },
			{ id: 'blues', name: 'BLUES / ROCK', unlocked: isPackUnlocked('blues', settings), count: String(countPackItems('blues')), ...getPackStats('blues'), price: '$1.99' },
			{ id: 'jazz', name: 'JAZZ', unlocked: isPackUnlocked('jazz', settings), count: String(countPackItems('jazz')), ...getPackStats('jazz'), price: '$1.99' },
			{ id: 'advanced', name: 'ADVANCED', unlocked: isPackUnlocked('advanced', settings), count: String(countPackItems('advanced')), ...getPackStats('advanced'), price: '$4.99' },
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
			<div class="path-grid">
				{#each paths() as path}
					{#if path.unlocked}
						<a href="{base}/quiz/path/{path.id}" class="path-card unlocked">
							<div class="path-top">
								<span class="path-name">{path.name}</span>
								<span class="path-count">{path.count} ITEMS</span>
							</div>
							<div class="path-bottom">
								{#if path.hasAttempts}
									<span class="path-accuracy">{path.accuracy}% ACCURACY</span>
								{:else if path.id === 'beginner'}
									<span class="path-free">FREE</span>
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
							<div class="path-top">
								<span class="path-name">{path.name}</span>
								<span class="path-count">{path.count} ITEMS</span>
							</div>
							<div class="path-bottom">
								<span class="path-price">{path.price}</span>
								<span class="path-pro">PRO</span>
							</div>
						</button>
					{/if}
				{/each}
			</div>
		</div>

		<!-- By Type -->
		<div class="section">
			<label class="section-label">BY TYPE</label>
			<div class="type-grid">
				<a href="{base}/quiz/intervals" class="type-btn">INT</a>
				<a href="{base}/quiz/chords" class="type-btn">CRD</a>
				<a href="{base}/quiz/scales" class="type-btn">SCL</a>
				{#if modesAvailable()}
					<a href="{base}/quiz/modes" class="type-btn">MODE</a>
				{:else}
					<span class="type-btn type-locked">MODE<span class="type-pro">PRO</span></span>
				{/if}
			</div>
		</div>

		<!-- Quick Start -->
		<div class="section">
			<a href="{base}/quiz/adaptive" class="quick-start-btn">
				QUICK START
			</a>
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

	/* ─── Sections — matches settings pattern ─── */
	.section { display: flex; flex-direction: column; gap: 0.5rem; }

	/* ─── Section labels — matches settings .field-label ─── */
	.section-label {
		font-size: 0.6rem; font-weight: 400;
		letter-spacing: 0.25em; color: var(--text-primary);
		font-family: var(--font-display);
	}

	/* ─── Path Grid ─── */
	.path-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.path-card {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		min-height: 5.5rem;
		background: var(--surface);
		padding: 0;
		text-decoration: none;
		color: inherit;
		overflow: hidden;
		cursor: pointer;
		transition: border-color 0.15s, opacity 0.15s;
	}
	.path-card:active { opacity: 0.85; }

	/* Unlocked: accent left border (like ContentCard) */
	.path-card.unlocked {
		border: 1px solid var(--border-heavy);
		border-left: 3px solid var(--accent);
	}

	/* Locked: dim border, reduced opacity */
	.path-card.locked {
		border: 1px solid var(--border-heavy);
		border-left: 3px solid var(--border-heavy);
		opacity: 0.5;
	}
	.path-card.locked:disabled { cursor: not-allowed; }
	.path-card.locked:not(:disabled) { cursor: pointer; opacity: 0.6; }
	.path-card.locked:not(:disabled):active { opacity: 0.5; }

	.path-top {
		display: flex; flex-direction: column; gap: 0.15rem;
		padding: 0.6rem 0.6rem 0.3rem;
	}

	.path-name {
		font-family: var(--font-display);
		font-size: 0.55rem; font-weight: 400;
		letter-spacing: 0.15em;
		color: var(--text-primary);
		text-transform: uppercase;
	}

	.path-count {
		font-family: var(--mono);
		font-size: 0.35rem; font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--text-secondary);
	}

	.path-bottom {
		display: flex; align-items: center; justify-content: space-between;
		padding: 0.35rem 0.6rem 0.5rem;
		border-top: 1px solid var(--border);
	}

	.path-accuracy {
		font-family: var(--mono);
		font-size: 0.4rem; font-weight: 900;
		letter-spacing: 0.05em;
		color: var(--accent);
	}

	.path-free {
		font-family: var(--mono);
		font-size: 0.4rem; font-weight: 900;
		letter-spacing: 0.15em;
		color: var(--accent);
	}

	.path-new {
		font-family: var(--mono);
		font-size: 0.35rem; font-weight: 900;
		letter-spacing: 0.15em;
		color: var(--text-secondary);
	}

	.path-price {
		font-family: var(--mono);
		font-size: 0.4rem; font-weight: 700;
		letter-spacing: 0.05em;
		color: var(--marathon-blue);
	}

	.path-pro {
		font-family: var(--mono);
		font-size: 0.3rem; font-weight: 900;
		letter-spacing: 0.2em;
		color: var(--marathon-blue);
	}

	/* ─── Type Grid — matches settings toggle-group ─── */
	.type-grid { display: flex; gap: 0.5rem; }

	.type-btn {
		flex: 1;
		display: flex; align-items: center; justify-content: center;
		gap: 0.3rem;
		padding: 0.85rem;
		background: var(--surface);
		border: 1px solid var(--border-heavy);
		font-family: var(--mono);
		font-size: 0.45rem; font-weight: 900;
		letter-spacing: 0.12em;
		color: var(--text-primary);
		text-decoration: none;
		text-transform: uppercase;
		transition: border-color 0.15s, background 0.15s;
	}
	.type-btn:active {
		background: var(--surface-raised);
		border-color: var(--accent);
	}

	.type-locked {
		opacity: 0.5;
		cursor: default;
	}
	.type-locked:active {
		background: var(--surface);
		border-color: var(--border-heavy);
	}

	.type-pro {
		font-size: 0.25rem;
		letter-spacing: 0.15em;
		color: var(--marathon-blue);
	}

	/* ─── Quick Start — secondary, at bottom ─── */
	.quick-start-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		padding: 0.85rem;
		background: transparent;
		border: 1px solid var(--border-heavy);
		color: var(--text-secondary);
		font-family: var(--mono);
		font-size: 0.45rem; font-weight: 900;
		letter-spacing: 0.2em;
		text-decoration: none;
		text-transform: uppercase;
		transition: border-color 0.15s, color 0.15s;
	}
	.quick-start-btn:active {
		border-color: var(--accent);
		color: var(--accent);
	}

	/* ─── Desktop ─── */
	@media (min-width: 768px) {
		.heading { font-size: 3.5rem; }
	}
</style>
