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
		justify-content: center; height: 100%; gap: 2.5rem; text-align: center;
	}
	.title {
		font-size: 3rem; font-weight: 700; letter-spacing: -0.03em;
		line-height: 1; color: var(--text-primary);
	}
	.version {
		font-size: 0.7rem; color: var(--text-secondary);
		font-family: 'SF Mono', 'Fira Code', monospace;
	}
	.stats { display: flex; gap: 3rem; }
	.stat { display: flex; flex-direction: column; align-items: center; }
	.value {
		font-size: 2rem; font-weight: 700;
		font-family: 'SF Mono', 'Fira Code', monospace;
	}
	.label {
		font-size: 0.6rem; color: var(--text-secondary);
		letter-spacing: 0.15em; font-weight: 600;
	}
	.start-btn {
		display: flex; align-items: center; justify-content: center;
		width: 180px; height: 180px; border-radius: 50%;
		background: var(--surface); border: 2px solid var(--accent);
		color: var(--accent); font-size: 1.1rem; font-weight: 700;
		letter-spacing: 0.05em; transition: transform 0.1s;
	}
	.start-btn:active { transform: scale(0.95); }
</style>
