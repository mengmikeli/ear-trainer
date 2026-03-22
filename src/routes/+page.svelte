<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { loadState, saveState } from '$lib/state';
	import { INTERVALS } from '$lib/intervals';
	import { countMasteredSkills, isModeMastered } from '$lib/mastery';
	import type { UserState, PlayMode } from '$lib/types';
	import TelemetryBar from '../components/TelemetryBar.svelte';

	let state: UserState | null = $state(null);
	let goGlitching = $state(false);
	let goText = $state('PRACTICE');

	const glitchChars = ['\uE000', '\uE001', '\uE002', '\uE003', '\uE004', '\uE005', '\uE006', '\uE007', '\uE008', '\uE010', '\uE013', '\uE014', '\uE017'];

	onMount(() => {
		state = loadState();
	});

	function handleGo(e: Event) {
		e.preventDefault();
		if (goGlitching) return;
		goGlitching = true;
		let tick = 0;
		const iv = setInterval(() => {
			goText = glitchChars[Math.floor(Math.random() * glitchChars.length)];
			tick++;
			if (tick >= 6) {
				clearInterval(iv);
				goto('/quiz');
			}
		}, 50);
	}

	// Mastery stats
	const masteryStats = $derived(() => {
		if (!state) return { mastered: 0, total: 0 };
		return countMasteredSkills(state.intervals);
	});

	// Per-mode mastery counts
	function countModeMastery(mode: PlayMode): { mastered: number; total: number } {
		if (!state) return { mastered: 0, total: 0 };
		let mastered = 0;
		let total = 0;
		for (const s of Object.values(state.intervals)) {
			if (!s.unlocked) continue;
			total++;
			if (isModeMastered(s.modes[mode])) mastered++;
		}
		return { mastered, total };
	}

	const ascStats = $derived(() => countModeMastery('ascending'));
	const descStats = $derived(() => countModeMastery('descending'));
	const harmStats = $derived(() => countModeMastery('harmonic'));

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

	// Mode toggle
	function toggleMode(mode: PlayMode) {
		if (!state) return;
		const modes = state.settings.enabledModes;
		// Count currently enabled
		const enabledCount = (modes.ascending ? 1 : 0) + (modes.descending ? 1 : 0) + (modes.harmonic ? 1 : 0);
		// Don't allow disabling last mode
		if (modes[mode] && enabledCount <= 1) return;
		modes[mode] = !modes[mode];
		saveState(state);
	}
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
		<div class="content">
			<!-- Mode skill bars -->
			<div class="skill-bars">
				<div class="skill-bar-row">
					<span class="bar-label">▲ ASC</span>
					<div class="bar-track">
						<div class="bar-fill" style="width: {ascStats().total > 0 ? (ascStats().mastered / ascStats().total) * 100 : 0}%"></div>
					</div>
					<span class="bar-frac">{ascStats().mastered}/{ascStats().total}</span>
				</div>

				<div class="skill-bar-row">
					<span class="bar-label">▼ DESC</span>
					<div class="bar-track">
						<div class="bar-fill" style="width: {descStats().total > 0 ? (descStats().mastered / descStats().total) * 100 : 0}%"></div>
					</div>
					<span class="bar-frac">{descStats().mastered}/{descStats().total}</span>
				</div>

				<div class="skill-bar-row">
					<span class="bar-label">═ HARM</span>
					<div class="bar-track">
						<div class="bar-fill" style="width: {harmStats().total > 0 ? (harmStats().mastered / harmStats().total) * 100 : 0}%"></div>
					</div>
					<span class="bar-frac">{harmStats().mastered}/{harmStats().total}</span>
				</div>
			</div>

			<!-- Mode quick-toggles -->
			<div class="mode-toggles">
				<button
					class="mode-toggle"
					class:active={state.settings.enabledModes.ascending}
					onclick={() => toggleMode('ascending')}
				>▲</button>
				<button
					class="mode-toggle"
					class:active={state.settings.enabledModes.descending}
					onclick={() => toggleMode('descending')}
				>▼</button>
				<button
					class="mode-toggle"
					class:active={state.settings.enabledModes.harmonic}
					onclick={() => toggleMode('harmonic')}
				>═</button>
			</div>

			<!-- Stats row -->
			<div class="telemetry-row">
				<TelemetryBar segments={[
					{ label: 'SES', value: state.stats.totalSessions },
					{ label: 'STK', value: state.stats.currentStreak },
					{ label: 'MST', value: masteryStats().mastered + '/' + masteryStats().total },
					{ label: 'TIER', value: currentTier() }
				]} />
			</div>

			<!-- Practice button -->
			<a href="/quiz" class="start-btn" class:glitching={goGlitching} onclick={handleGo}>
				<span class="btn-text">{goText}</span>
			</a>
		</div>
	{/if}
</div>

<style>
	.home {
		display: flex; flex-direction: column; align-items: center;
		justify-content: center; height: 100%; gap: 2rem; text-align: center;
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
		display: inline-flex; align-items: center;
		line-height: 1;
	}

	/* Content area */
	.content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		width: 280px;
	}

	/* Skill bars */
	.skill-bars {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
	}
	.skill-bar-row {
		display: grid;
		grid-template-columns: 3.5rem 1fr 2rem;
		align-items: center;
		gap: 0.5rem;
	}
	.bar-label {
		font-family: var(--font-display);
		font-size: 0.6rem;
		color: var(--accent);
		text-align: left;
		letter-spacing: 0.05em;
		white-space: nowrap;
	}
	.bar-track {
		height: 4px;
		background: var(--surface);
		border: 1px solid var(--surface-raised);
		overflow: hidden;
	}
	.bar-fill {
		height: 100%;
		background: var(--accent);
		transition: width 0.4s ease-out;
	}
	.bar-frac {
		font-family: var(--mono);
		font-size: 0.45rem;
		color: var(--text-secondary);
		text-align: right;
		letter-spacing: 0.05em;
	}

	/* Mode toggles */
	.mode-toggles {
		display: flex;
		gap: 0.4rem;
		justify-content: center;
	}
	.mode-toggle {
		font-family: var(--mono);
		font-size: 0.55rem;
		font-weight: 900;
		letter-spacing: 0.05em;
		padding: 0.25rem 0.6rem;
		border: 1px solid var(--accent);
		background: transparent;
		color: var(--accent);
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
		line-height: 1;
		opacity: 0.5;
	}
	.mode-toggle.active {
		background: var(--accent);
		color: var(--base);
		opacity: 1;
	}

	/* Telemetry row */
	.telemetry-row {
		width: 100%;
	}

	/* Practice button */
	.start-btn {
		display: flex; align-items: center; justify-content: center;
		width: 100%; height: 2.8rem;
		background: var(--accent); border: none;
		transition: transform 0.1s, opacity 0.15s;
		text-decoration: none;
	}
	.start-btn:active { transform: scale(0.97); opacity: 0.9; }
	.start-btn.glitching {
		text-shadow: -2px 0 var(--accent), 2px 0 var(--hot);
		animation: go-glitch 50ms infinite;
	}
	@keyframes go-glitch {
		0% { transform: translate(0); }
		25% { transform: translate(-2px, 1px); }
		50% { transform: translate(2px, -1px); }
		75% { transform: translate(-1px, -1px); }
		100% { transform: translate(0); }
	}
	.btn-text {
		color: var(--base); font-size: 0.8rem; font-weight: 400;
		letter-spacing: 0.3em; text-transform: uppercase;
		font-family: var(--font-display);
	}
</style>