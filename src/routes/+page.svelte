<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { loadState } from '$lib/state';
	import type { UserState } from '$lib/types';

	let state: UserState | null = $state(null);
	let idle = $state(false);
	let idleTimer: ReturnType<typeof setTimeout> | null = null;
	let scanIntensity = $state(false);

	onMount(() => {
		state = loadState();
		startIdleTimer();
		document.addEventListener('pointerdown', resetIdle);
		document.addEventListener('pointermove', resetIdle);
	});

	onDestroy(() => {
		if (idleTimer) clearTimeout(idleTimer);
		if (typeof document !== 'undefined') {
			document.removeEventListener('pointerdown', resetIdle);
			document.removeEventListener('pointermove', resetIdle);
		}
	});

	function startIdleTimer() {
		if (idleTimer) clearTimeout(idleTimer);
		idle = false;
		scanIntensity = false;
		idleTimer = setTimeout(() => {
			idle = true;
			// Increase scan line intensity after idle
			setTimeout(() => { scanIntensity = true; }, 2000);
		}, 10000);
	}

	function resetIdle() {
		startIdleTimer();
	}

	const accuracy = $derived(() => {
		if (!state) return 0;
		const vals = Object.values(state.intervals).filter(s => s.attempts > 0);
		if (vals.length === 0) return 0;
		const total = vals.reduce((sum, s) => sum + s.correct, 0);
		const attempts = vals.reduce((sum, s) => sum + s.attempts, 0);
		return Math.round((total / attempts) * 100);
	});

	const unlockedCount = $derived(() => {
		if (!state) return 0;
		return Object.values(state.intervals).filter(s => s.unlocked).length;
	});
</script>

<div class="home" class:idle-wobble={idle}>
	<header class="header">
		<div class="title-block">
			<h1 class="title">EAR</h1>
			<h1 class="title title-accent">TRAINER</h1>
		</div>
		<div class="sys-tag">
			<span class="dash"></span>
			<span class="version">SYS v1.0 — INTERVAL RECOGNITION MODULE</span>
			<span class="dash"></span>
		</div>
	</header>

	{#if state}
		<div class="readout">
			<div class="stat">
				<span class="stat-value">{state.stats.currentStreak}</span>
				<span class="stat-label">DAY STREAK</span>
			</div>
			<div class="stat-divider"></div>
			<div class="stat">
				<span class="stat-value">{accuracy()}%</span>
				<span class="stat-label">ACCURACY</span>
			</div>
			<div class="stat-divider"></div>
			<div class="stat">
				<span class="stat-value">{unlockedCount()}/13</span>
				<span class="stat-label">UNLOCKED</span>
			</div>
		</div>

		<a href="/quiz" class="start-btn chromatic">
			<span class="btn-icon">▶</span>
			<span class="btn-text">PRACTICE</span>
		</a>

		<div class="status-line">
			{#if state.stats.totalSessions === 0}
				<span class="status-text">AWAITING FIRST SESSION</span>
			{:else}
				<span class="status-text">{state.stats.totalQuestions} INTERVALS PROCESSED</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	.home {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 2.5rem;
		text-align: center;
	}

	.header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.title-block {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0;
	}

	.title {
		font-family: var(--font-display);
		font-size: 4.5rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 0.9;
		color: var(--text-primary);
		text-transform: uppercase;
	}

	.title-accent {
		color: var(--accent);
		font-size: 3rem;
		letter-spacing: 0.15em;
	}

	.sys-tag {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 0.5rem;
	}

	.dash {
		display: block;
		width: 24px;
		height: 1px;
		background: var(--accent);
		opacity: 0.4;
	}

	.version {
		font-family: var(--font-mono);
		font-size: 0.55rem;
		font-weight: 500;
		color: var(--accent);
		letter-spacing: 0.2em;
		opacity: 0.5;
	}

	.readout {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 1rem 1.75rem;
		border: 1px solid var(--border);
		background: var(--surface);
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
	}

	.stat-value {
		font-family: var(--font-mono);
		font-size: 2rem;
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

	.stat-divider {
		width: 1px;
		height: 2.5rem;
		background: var(--border);
	}

	.start-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		width: 160px;
		height: 160px;
		border-radius: 50%;
		background: var(--accent);
		transition: transform 0.1s, box-shadow 0.15s;
		box-shadow: 0 0 40px rgba(0, 212, 255, 0.15);
	}

	.start-btn:hover {
		box-shadow: 0 0 60px rgba(0, 212, 255, 0.3);
	}

	.start-btn:active {
		transform: scale(0.93);
	}

	.btn-icon {
		font-size: 1.5rem;
		color: var(--base);
	}

	.btn-text {
		font-family: var(--font-display);
		font-size: 0.9rem;
		font-weight: 800;
		color: var(--base);
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}

	.status-line {
		opacity: 0.3;
	}

	.status-text {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 500;
		letter-spacing: 0.25em;
		color: var(--text-secondary);
	}
</style>
