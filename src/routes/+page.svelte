<script lang="ts">
	import { onMount } from 'svelte';
	import { loadState } from '$lib/state';
	import { INTERVALS } from '$lib/intervals';
	import type { UserState } from '$lib/types';
	import RadarGrid from '../components/RadarGrid.svelte';
	import TelemetryBar from '../components/TelemetryBar.svelte';

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

	const currentTier = $derived(() => {
		if (!state) return 1;
		let highest = 1;
		for (const def of INTERVALS) {
			const s = state.intervals[def.id];
			if (s?.unlocked && def.tier > highest) {
				highest = def.tier;
			}
		}
		return highest;
	});

	const intervalsMastered = $derived(() => {
		if (!state) return 0;
		return Object.values(state.intervals).filter(s => s.attempts > 0).length;
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
	</header>

	{#if state}
		<div class="center-area">
			<RadarGrid size="320px" />

			<a href="/quiz" class="start-btn">
				<span class="btn-text">PRACTICE</span>
			</a>

			<span class="coord coord-tr">INT: {intervalsMastered()}/13</span>
			<span class="coord coord-bl">T{currentTier()}</span>

			<div class="telemetry-row">
				<TelemetryBar segments={[
					{ label: 'STK', value: state.stats.currentStreak },
					{ label: 'ACC', value: accuracy() + '%' },
					{ label: 'Q', value: state.stats.totalQuestions },
					{ label: 'TIER', value: currentTier() }
				]} />
			</div>
		</div>
	{/if}
</div>

<style>
	.home {
		display: flex; flex-direction: column; align-items: center;
		justify-content: center; height: 100%; gap: 2.5rem; text-align: center;
	}
	.title-block { position: relative; }
	.title {
		font-size: 6.5rem; font-weight: 400; letter-spacing: 0.05em;
		line-height: 0.7; color: var(--text-primary); text-transform: uppercase;
		font-family: var(--font-display);
	}
	.title-accent {
		color: var(--accent); font-size: 3.5rem;
		letter-spacing: 0.12em; font-family: var(--font-display);
	}
	.version-tag {
		display: flex; align-items: center; gap: 0;
		margin-top: 1.5rem; justify-content: center;
	}
	.hazard-bar {
		display: block; width: 20px; height: 100%;
		background: var(--marathon-blue);
	}
	.version {
		font-size: 0.5rem; color: #FFFFFF;
		font-family: var(--mono); letter-spacing: 0.3em;
		background: var(--marathon-blue); padding: 0.3rem 0.75rem;
	}

	/* Center area: relative container for radar + button + coords */
	.center-area {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 320px;
		min-height: 320px;
	}

	.start-btn {
		display: flex; align-items: center; justify-content: center;
		width: 180px; height: 180px; border-radius: 50%;
		background: var(--accent); border: none;
		transition: transform 0.1s, opacity 0.15s;
		position: relative;
		z-index: 1;
	}
	.start-btn:active { transform: scale(0.93); opacity: 0.9; }
	.btn-text {
		color: var(--base); font-size: 1.4rem; font-weight: 400;
		letter-spacing: 0.15em; text-transform: uppercase;
		font-family: var(--font-display);
	}

	/* Floating coordinate labels */
	.coord {
		position: absolute;
		font-family: var(--mono);
		font-size: 0.3rem;
		color: var(--accent);
		opacity: 0.3;
		letter-spacing: 0.1em;
	}
	.coord-tr {
		top: 0.5rem;
		right: 0.5rem;
	}
	.coord-bl {
		bottom: 2.5rem;
		left: 0.5rem;
	}

	/* TelemetryBar wrapper */
	.telemetry-row {
		position: relative;
		z-index: 1;
		margin-top: 1.5rem;
	}
</style>
