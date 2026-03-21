<script lang="ts">
	import { onMount } from 'svelte';
	import { loadState } from '$lib/state';
	import type { UserState } from '$lib/types';

	let state: UserState | null = $state(null);

	onMount(() => {
		state = loadState();
	});

	const accuracy = $derived(() => {
		if (!state) return 0;
		const vals = Object.values(state.intervals).filter(s => s.attempts > 0);
		if (vals.length === 0) return 0;
		const total = vals.reduce((sum, s) => sum + s.correct, 0);
		const attempts = vals.reduce((sum, s) => sum + s.attempts, 0);
		return Math.round((total / attempts) * 100);
	});
</script>

<div class="home">
	<header>
		<h1 class="title">EAR<br/>TRAINER</h1>
		<span class="version">v1.0</span>
	</header>

	{#if state}
		<div class="stats">
			<div class="stat">
				<span class="value">{state.stats.currentStreak}</span>
				<span class="label">DAY STREAK</span>
			</div>
			<div class="stat">
				<span class="value">{accuracy()}%</span>
				<span class="label">ACCURACY</span>
			</div>
		</div>

		<a href="/quiz" class="start-btn">▶ PRACTICE</a>
	{/if}
</div>

<style>
	.home {
		display: flex; flex-direction: column; align-items: center;
		justify-content: center; height: 100%; gap: 3rem; text-align: center;
	}
	.title {
		font-size: 4.5rem; font-weight: 900; letter-spacing: -0.04em;
		line-height: 0.9; color: var(--text-primary); text-transform: uppercase;
	}
	.version {
		display: inline-block; margin-top: 0.5rem;
		font-size: 0.65rem; color: var(--text-secondary);
		font-family: var(--mono);
		letter-spacing: 0.2em;
		border: 1px solid var(--border); padding: 0.15rem 0.5rem;
	}
	.stats { display: flex; gap: 3rem; }
	.stat { display: flex; flex-direction: column; align-items: center; gap: 0.15rem; }
	.value {
		font-size: 2.25rem; font-weight: 800;
		font-family: var(--mono); color: var(--accent);
	}
	.label {
		font-size: 0.6rem; color: var(--text-secondary);
		letter-spacing: 0.2em; font-weight: 700;
	}
	.start-btn {
		display: flex; align-items: center; justify-content: center;
		width: 180px; height: 180px; border-radius: 50%;
		background: var(--accent); border: 3px solid var(--accent);
		color: var(--base); font-size: 1.2rem; font-weight: 800;
		letter-spacing: 0.08em; transition: transform 0.1s, opacity 0.15s;
		text-transform: uppercase;
	}
	.start-btn:active { transform: scale(0.93); opacity: 0.9; }
</style>
