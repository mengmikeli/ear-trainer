<script lang="ts">
	import { onMount } from 'svelte';
	import { loadState } from '$lib/state';
	import { INTERVALS, getIntervalsByTier } from '$lib/intervals';
	import IntervalCard from '../../components/IntervalCard.svelte';
	import type { UserState } from '$lib/types';

	let state: UserState | null = $state(null);

	onMount(() => {
		state = loadState();
	});

	// Calculate tier progress
	function tierProgress(tier: number): { ready: number; total: number; percent: number } {
		if (!state) return { ready: 0, total: 0, percent: 0 };
		const intervals = getIntervalsByTier(tier);
		const total = intervals.length;
		const ready = intervals.filter(def => {
			const s = state!.intervals[def.id];
			return s && s.attempts >= 10 && (s.correct / s.attempts) >= 0.8;
		}).length;
		return { ready, total, percent: Math.round((ready / total) * 100) };
	}

	// Find current highest unlocked tier
	const currentTier = $derived(() => {
		if (!state) return 1;
		let maxTier = 1;
		for (const def of INTERVALS) {
			if (state.intervals[def.id]?.unlocked && def.tier > maxTier) {
				maxTier = def.tier;
			}
		}
		return maxTier;
	});

	// Next tier to unlock
	const nextTier = $derived(() => {
		const ct = currentTier();
		return ct < 5 ? ct + 1 : null;
	});
</script>

<div class="progress-page screen-enter">
	<h2 class="heading">PROGRESS</h2>

	{#if state}
		<!-- Global Stats -->
		<div class="global-stats">
			<div class="stat">
				<span class="stat-value">{state.stats.totalSessions}</span>
				<span class="stat-label">SESSIONS</span>
			</div>
			<div class="stat">
				<span class="stat-value">{state.stats.totalQuestions}</span>
				<span class="stat-label">QUESTIONS</span>
			</div>
			<div class="stat">
				<span class="stat-value">{state.stats.bestStreak}</span>
				<span class="stat-label">BEST STREAK</span>
			</div>
		</div>

		<!-- Tier Progress -->
		{#if nextTier()}
			{@const progress = tierProgress(currentTier())}
			<div class="tier-progress">
				<div class="tier-header">
					<span class="tier-label">TIER {currentTier()} → {nextTier()}</span>
					<span class="tier-pct">{progress.ready}/{progress.total} READY</span>
				</div>
				<div class="tier-bar">
					<div class="tier-fill" style="width: {progress.percent}%"></div>
				</div>
			</div>
		{:else}
			<div class="tier-progress complete">
				<span class="tier-label">ALL TIERS UNLOCKED</span>
			</div>
		{/if}

		<!-- Interval List -->
		<div class="interval-list">
			{#each INTERVALS as def}
				<IntervalCard {def} state={state.intervals[def.id]} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.progress-page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.heading {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--accent);
		text-transform: uppercase;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--accent);
	}

	.global-stats {
		display: flex;
		justify-content: space-around;
		padding: 1.25rem;
		background: var(--surface);
		border-left: 2px solid var(--accent);
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
	}

	.stat-value {
		font-family: var(--font-mono);
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--accent);
		font-variant-numeric: tabular-nums;
	}

	.stat-label {
		font-family: var(--font-mono);
		font-size: 0.5rem;
		font-weight: 500;
		color: var(--text-secondary);
		letter-spacing: 0.2em;
	}

	.tier-progress {
		padding: 0.85rem;
		background: var(--surface);
		border: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.tier-progress.complete {
		border-color: var(--correct);
	}

	.tier-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.tier-label {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.15em;
		color: var(--accent);
	}

	.tier-pct {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 500;
		color: var(--text-secondary);
		letter-spacing: 0.1em;
	}

	.tier-bar {
		height: 4px;
		background: var(--border);
		overflow: hidden;
	}

	.tier-fill {
		height: 100%;
		background: var(--accent);
		transition: width 0.3s ease;
	}

	.interval-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
</style>
