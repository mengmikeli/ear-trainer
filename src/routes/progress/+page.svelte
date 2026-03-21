<script lang="ts">
	import { onMount } from 'svelte';
	import { loadState, saveState } from '$lib/state';
	import { INTERVALS } from '$lib/intervals';
	import IntervalCard from '../../components/IntervalCard.svelte';
	import TelemetryBar from '../../components/TelemetryBar.svelte';
	import type { UserState } from '$lib/types';

	let state: UserState | null = $state(null);
	let minWarning = $state(false);

	onMount(() => {
		state = loadState();
	});

	function toggleInterval(id: string) {
		if (!state) return;

		const s = state.intervals[id];
		if (!s.unlocked) return;

		if (s.enabled) {
			const enabledCount = Object.values(state.intervals).filter(i => i.unlocked && i.enabled).length;
			if (enabledCount <= 3) {
				minWarning = true;
				setTimeout(() => { minWarning = false; }, 2000);
				return;
			}
		}

		state.intervals[id].enabled = !s.enabled;
		state = { ...state };
		saveState(state);
	}
</script>

<div class="progress-page">
	<h2 class="heading">PROGRESS</h2>

	{#if state}
		<TelemetryBar segments={[
			{ label: 'SES', value: state.stats.totalSessions },
			{ label: 'Q', value: state.stats.totalQuestions },
			{ label: 'BST', value: state.stats.bestStreak }
		]} />

		{#if minWarning}
			<div class="min-warn">⚠ MINIMUM 3 INTERVALS REQUIRED</div>
		{/if}

		<div class="interval-list">
			{#each INTERVALS as def}
				<IntervalCard {def} state={state.intervals[def.id]} ontoggle={toggleInterval} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.progress-page { display: flex; flex-direction: column; gap: 1.5rem; }
	.data-readout {
		font-family: var(--mono); font-size: 0.45rem;
		color: var(--marathon-blue); opacity: 0.3;
		letter-spacing: 0.3em; text-align: center;
		margin-top: -0.5rem;
	}
	.heading {
		font-size: 3rem; font-weight: 400;
		letter-spacing: 0.12em; color: var(--text-primary);
		padding-bottom: 0.5rem; border-bottom: 2px solid var(--border-heavy);
		text-transform: uppercase; font-family: var(--font-display);
	}
	.interval-list { display: flex; flex-direction: column; gap: 0.5rem; }
	.min-warn {
		font-family: var(--mono); font-size: 0.45rem; font-weight: 900;
		color: var(--hot); letter-spacing: 0.15em; text-align: center;
		padding: 0.5rem; border: 1px solid var(--hot);
		background: #ED174F10; animation: flash 0.2s ease-out;
	}
</style>
