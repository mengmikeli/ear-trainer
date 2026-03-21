<script lang="ts">
	import { onMount } from 'svelte';
	import { loadState, saveState } from '$lib/state';
	import { INTERVALS } from '$lib/intervals';
	import IntervalCard from '../../components/IntervalCard.svelte';
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

		// If turning OFF, check minimum 3 enabled
		if (s.enabled) {
			const enabledCount = Object.values(state.intervals).filter(i => i.unlocked && i.enabled).length;
			if (enabledCount <= 3) {
				minWarning = true;
				setTimeout(() => { minWarning = false; }, 2000);
				return;
			}
		}

		state.intervals[id].enabled = !s.enabled;
		// Trigger reactivity by reassigning
		state = { ...state };
		saveState(state);
	}
</script>

<div class="progress-page">
	<h2 class="heading">PROGRESS</h2>
	<div class="data-readout interference">▌▌▌ TRAINING DATA ▌▌▌</div>

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
		font-family: var(--mono); font-size: 0.55rem;
		color: var(--accent); opacity: 0.3;
		letter-spacing: 0.3em; text-align: center;
		margin-top: -0.5rem;
	}
	.heading {
		font-size: 0.85rem; font-weight: 900;
		letter-spacing: 0.12em; color: var(--accent);
		padding-bottom: 0.5rem; border-bottom: 2px solid var(--accent);
		text-transform: uppercase; font-family: var(--font-display);
	}
	.global-stats {
		display: flex; justify-content: space-around;
		padding: 1.25rem; background: var(--surface);
		border-left: 3px solid var(--accent);
	}
	.stat { display: flex; flex-direction: column; align-items: center; gap: 0.15rem; }
	.value {
		font-size: 1.75rem; font-weight: 900;
		font-family: var(--mono); color: var(--accent);
	}
	.label {
		font-size: 0.55rem; color: var(--text-secondary);
		letter-spacing: 0.2em; font-weight: 700;
		font-family: var(--font-display);
	}
	.interval-list { display: flex; flex-direction: column; gap: 0.5rem; }
	.min-warn {
		font-family: var(--mono); font-size: 0.65rem; font-weight: 900;
		color: var(--hot); letter-spacing: 0.15em; text-align: center;
		padding: 0.5rem; border: 1px solid var(--hot);
		background: #ED174F10; animation: flash 0.2s ease-out;
	}
</style>
