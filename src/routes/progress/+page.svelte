<script lang="ts">
	import { onMount } from 'svelte';
	import { loadState, saveState } from '$lib/state';
	import { INTERVALS } from '$lib/intervals';
	import IntervalCard from '../../components/IntervalCard.svelte';
	import TelemetryBar from '../../components/TelemetryBar.svelte';
	import type { UserState, PlayMode } from '$lib/types';

	let state: UserState | null = $state(null);
	let minWarning = $state(false);
	let activeTab: PlayMode | null = $state(null); // null = ALL

	const tabs: { label: string; value: PlayMode | null }[] = [
		{ label: 'ALL', value: null },
		{ label: '\uE007', value: 'ascending' },
		{ label: '\uE008', value: 'descending' },
		{ label: '\uE000', value: 'harmonic' },
	];

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

	// Telemetry adapts to active tab
	const telemetrySegments = $derived(() => {
		if (!state) return [];
		if (!activeTab) {
			return [
				{ label: 'SES', value: state.stats.totalSessions },
				{ label: 'Q', value: state.stats.totalQuestions },
				{ label: 'BST', value: state.stats.bestStreak },
			];
		}
		// Per-mode aggregates
		let attempts = 0, correct = 0;
		for (const s of Object.values(state.intervals)) {
			if (!s.unlocked) continue;
			const m = s.modes[activeTab];
			attempts += m.attempts;
			correct += m.correct;
		}
		const acc = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
		return [
			{ label: 'Q', value: attempts },
			{ label: 'ACC', value: acc + '%' },
		];
	});
</script>

<div class="progress-page">
	<h2 class="heading">PROGRESS</h2>

	<div class="tabs">
		{#each tabs as tab}
			<button
				class="tab"
				class:active={activeTab === tab.value}
				class:glyph={tab.value !== null}
				onclick={() => activeTab = tab.value}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	{#if state}
		<TelemetryBar segments={telemetrySegments()} />

		{#if minWarning}
			<div class="min-warn">⚠ MINIMUM 3 INTERVALS REQUIRED</div>
		{/if}

		<div class="interval-list">
			{#each INTERVALS as def}
				<IntervalCard {def} state={state.intervals[def.id]} modeFilter={activeTab} ontoggle={toggleInterval} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.progress-page { display: flex; flex-direction: column; gap: 1.5rem; }
	.heading {
		font-size: 3rem; font-weight: 400;
		letter-spacing: 0.12em; color: var(--text-primary);
		padding-bottom: 0.5rem; border-bottom: 2px solid var(--border-heavy);
		text-transform: uppercase; font-family: var(--font-display);
	}
	.tabs {
		display: flex; gap: 0; width: 100%;
	}
	.tab {
		flex: 1;
		padding: 0.5rem 0;
		font-family: var(--mono);
		font-size: 0.45rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		color: var(--text-secondary);
		background: transparent;
		border: 1px solid var(--border-heavy);
		border-right: none;
		cursor: pointer;
		transition: color 0.15s, background 0.15s, border-color 0.15s;
	}
	.tab:last-child { border-right: 1px solid var(--border-heavy); }
	.tab.glyph { font-size: 0.6rem; letter-spacing: 0; }
	.tab.active {
		color: var(--marathon-blue);
		border-color: var(--marathon-blue);
		background: rgba(58, 44, 255, 0.08);
	}
	.tab.active + .tab { border-left-color: var(--marathon-blue); }
	.interval-list { display: flex; flex-direction: column; gap: 0.5rem; }
	.min-warn {
		font-family: var(--mono); font-size: 0.45rem; font-weight: 900;
		color: var(--hot); letter-spacing: 0.15em; text-align: center;
		padding: 0.5rem; border: 1px solid var(--hot);
		background: #ED174F10; animation: flash 0.2s ease-out;
	}
</style>
