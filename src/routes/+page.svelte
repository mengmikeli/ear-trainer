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
		<div class="title-block">
			<h1 class="title">EAR<br/><span class="title-accent">TRAINER</span></h1>
		</div>
		<div class="version-tag">
			<span class="hazard-bar"></span>
			<span class="version">SYS v1.0</span>
			<span class="hazard-bar"></span>
		</div>
		<pre class="ascii-decor interference">╔══════════════════════╗
║  INTERVAL TRAINING  ║
║  SYSTEM ONLINE      ║
╚══════════════════════╝</pre>
	</header>

	{#if state}
		<div class="stats">
			<div class="stat">
				<span class="value">{state.stats.currentStreak}</span>
				<span class="label">STREAK</span>
			</div>
			<div class="divider"></div>
			<div class="stat">
				<span class="value">{accuracy()}%</span>
				<span class="label">ACCURACY</span>
			</div>
		</div>

		<a href="/quiz" class="start-btn">
			<span class="btn-text">[▶] PRACTICE</span>
		</a>
	{/if}
</div>

<style>
	.home {
		display: flex; flex-direction: column; align-items: center;
		justify-content: center; height: 100%; gap: 2.5rem; text-align: center;
	}
	.title-block { position: relative; }
	.title {
		font-size: 5rem; font-weight: 400; letter-spacing: -0.05em;
		line-height: 0.85; color: var(--text-primary); text-transform: uppercase;
		font-family: var(--font-display);
	}
	.title-accent {
		color: var(--accent); font-size: 3.5rem;
		letter-spacing: 0.12em; font-family: var(--font-display);
	}
	.version-tag {
		display: flex; align-items: center; gap: 0.5rem;
		margin-top: 0.75rem; justify-content: center;
	}
	.hazard-bar {
		display: block; width: 20px; height: 3px;
		background: repeating-linear-gradient(
			-45deg, var(--accent), var(--accent) 2px, transparent 2px, transparent 4px
		);
	}
	.version {
		font-size: 0.6rem; color: var(--accent);
		font-family: var(--mono); letter-spacing: 0.3em;
		opacity: 0.7;
	}
	.ascii-decor {
		font-family: var(--mono); font-size: 0.5rem;
		color: var(--accent); opacity: 0.25;
		line-height: 1.3; letter-spacing: 0.1em;
		margin-top: 0.75rem;
	}
	.stats {
		display: flex; align-items: center; gap: 1.5rem;
		padding: 1rem 1.5rem;
		border: 1px solid var(--border-heavy);
		background: var(--surface);
	}
	.divider { width: 1px; height: 2.5rem; background: var(--border-heavy); }
	.stat { display: flex; flex-direction: column; align-items: center; gap: 0.1rem; }
	.value {
		font-size: 2.5rem; font-weight: 900;
		font-family: var(--mono); color: var(--accent);
	}
	.label {
		font-size: 0.55rem; color: var(--text-secondary);
		letter-spacing: 0.25em; font-weight: 400;
		font-family: var(--font-display);
	}
	.start-btn {
		display: flex; align-items: center; justify-content: center;
		width: 180px; height: 180px; border-radius: 50%;
		background: var(--accent); border: none;
		transition: transform 0.1s, opacity 0.15s;
		position: relative;
	}
	.start-btn:active { transform: scale(0.93); opacity: 0.9; }
	.btn-text {
		color: var(--base); font-size: 1.1rem; font-weight: 400;
		letter-spacing: 0.1em; text-transform: uppercase;
		font-family: var(--font-display);
	}
</style>
