<script lang="ts">
	import { onMount } from 'svelte';
	import { loadState } from '$lib/state';
	import { INTERVALS } from '$lib/intervals';
	import IntervalCard from '../../components/IntervalCard.svelte';
	import type { UserState } from '$lib/types';

	let state: UserState | null = $state(null);

	onMount(() => {
		state = loadState();
	});
</script>

<div class="progress-page">
	<h2 class="heading">PROGRESS</h2>

	{#if state}
		<div class="global-stats">
			<div class="stat">
				<span class="value">{state.stats.totalSessions}</span>
				<span class="label">SESSIONS</span>
			</div>
			<div class="stat">
				<span class="value">{state.stats.totalQuestions}</span>
				<span class="label">QUESTIONS</span>
			</div>
			<div class="stat">
				<span class="value">{state.stats.bestStreak}</span>
				<span class="label">BEST STREAK</span>
			</div>
		</div>

		<div class="interval-list">
			{#each INTERVALS as def}
				<IntervalCard {def} state={state.intervals[def.id]} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.progress-page { display: flex; flex-direction: column; gap: 1.5rem; }
	.heading {
		font-size: 0.75rem; font-weight: 700;
		letter-spacing: 0.15em; color: var(--text-secondary);
	}
	.global-stats {
		display: flex; justify-content: space-around;
		padding: 1rem; background: var(--surface); border-radius: 4px;
	}
	.stat { display: flex; flex-direction: column; align-items: center; }
	.value {
		font-size: 1.5rem; font-weight: 700;
		font-family: 'SF Mono', 'Fira Code', monospace;
	}
	.label {
		font-size: 0.55rem; color: var(--text-secondary);
		letter-spacing: 0.15em; font-weight: 600;
	}
	.interval-list { display: flex; flex-direction: column; gap: 0.5rem; }
</style>
