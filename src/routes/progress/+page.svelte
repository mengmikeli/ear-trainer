<script lang="ts">
	import { onMount } from 'svelte';
	import { loadState, saveState } from '$lib/state';
	import { INTERVALS } from '$lib/intervals';
	import { CHORDS } from '$lib/chords';
	import { playInterval, playChord } from '$lib/audio';
	import { isModeMastered } from '$lib/mastery';
	import IntervalCard from '../../components/IntervalCard.svelte';
	import ChordCard from '../../components/ChordCard.svelte';
	import TelemetryBar from '../../components/TelemetryBar.svelte';
	import type { UserState, PlayMode, ChordVoicing } from '$lib/types';

	let state: UserState | null = $state(null);
	let minWarning = $state(false);
	let activeTab: PlayMode | null = $state(null);
	let chordVoicingTab: ChordVoicing | null = $state(null);
	let playingId: string | null = $state(null);
	let contentView: 'intervals' | 'chords' = $state('intervals');

	const modes: PlayMode[] = ['ascending', 'descending', 'harmonic'];

	const intervalTabs: { label: string; value: PlayMode | null }[] = [
		{ label: 'ALL', value: null },
		{ label: '\uE007', value: 'ascending' },
		{ label: '\uE008', value: 'descending' },
		{ label: '\uE000', value: 'harmonic' },
	];

	const chordTabs: { label: string; value: ChordVoicing | null }[] = [
		{ label: 'ALL', value: null },
		{ label: 'ROOT', value: 'root' },
		{ label: 'INV1', value: 'first' },
		{ label: 'INV2', value: 'second' },
	];

	// Chord system unlock: Bronze mastery on 5+ intervals
	const chordsUnlocked = $derived(() => {
		if (!state) return false;
		let bronzeCount = 0;
		for (const s of Object.values(state.intervals)) {
			if (!s.unlocked) continue;
			const mastered = [s.modes.ascending, s.modes.descending, s.modes.harmonic]
				.filter(m => isModeMastered(m)).length;
			if (mastered >= 1) bronzeCount++;
		}
		return bronzeCount >= 5;
	});

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

	function toggleChord(id: string) {
		if (!state) return;
		const s = state.chords[id];
		if (!s.unlocked) return;
		if (s.enabled) {
			const enabledCount = Object.values(state.chords).filter(c => c.unlocked && c.enabled).length;
			if (enabledCount <= 2) {
				minWarning = true;
				setTimeout(() => { minWarning = false; }, 2000);
				return;
			}
		}
		state.chords[id].enabled = !s.enabled;
		state = { ...state };
		saveState(state);
	}

	function playIntervalPreview(id: string) {
		if (!state || playingId) return;
		const def = INTERVALS.find(d => d.id === id);
		if (!def) return;
		const mode: PlayMode = activeTab ?? modes[Math.floor(Math.random() * modes.length)];
		playingId = id;
		playInterval(60, def.semitones, mode, state.settings.toneType);
		const dur = mode === 'harmonic' ? 1500 : 1200;
		setTimeout(() => { playingId = null; }, dur);
	}

	function playChordPreview(id: string) {
		if (!state || playingId) return;
		const def = CHORDS.find(d => d.id === id);
		if (!def) return;
		playingId = id;
		playChord(60, def.intervals, 'root', state.settings.toneType, false);
		setTimeout(() => { playingId = null; }, 1500);
	}

	const telemetrySegments = $derived(() => {
		if (!state) return [];
		if (contentView === 'chords') {
			if (!chordVoicingTab) {
				let attempts = 0, correct = 0;
				for (const s of Object.values(state.chords)) {
					if (!s.unlocked) continue;
					attempts += s.attempts;
					correct += s.correct;
				}
				const acc = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
				return [
					{ label: 'Q', value: attempts },
					{ label: 'ACC', value: acc + '%' },
				];
			}
			let attempts = 0, correct = 0;
			for (const s of Object.values(state.chords)) {
				if (!s.unlocked) continue;
				const v = s.voicings[chordVoicingTab];
				attempts += v.attempts;
				correct += v.correct;
			}
			const acc = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
			return [
				{ label: 'Q', value: attempts },
				{ label: 'ACC', value: acc + '%' },
			];
		}
		if (!activeTab) {
			return [
				{ label: 'SES', value: state.stats.totalSessions },
				{ label: 'Q', value: state.stats.totalQuestions },
				{ label: 'STK', value: state.stats.currentStreak },
			];
		}
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

	{#if chordsUnlocked()}
		<div class="content-toggle">
			<button class="ct-btn" class:active={contentView === 'intervals'} onclick={() => contentView = 'intervals'}>INTERVALS</button>
			<button class="ct-btn" class:active={contentView === 'chords'} onclick={() => contentView = 'chords'}>CHORDS</button>
		</div>
	{/if}

	{#if contentView === 'intervals'}
		<div class="tabs">
			{#each intervalTabs as tab}
				<button class="tab" class:active={activeTab === tab.value} class:glyph={tab.value !== null}
					onclick={() => activeTab = tab.value}>{tab.label}</button>
			{/each}
		</div>
	{:else}
		<div class="tabs">
			{#each chordTabs as tab}
				<button class="tab" class:active={chordVoicingTab === tab.value}
					onclick={() => chordVoicingTab = tab.value}>{tab.label}</button>
			{/each}
		</div>
	{/if}

	{#if state}
		<TelemetryBar segments={telemetrySegments()} />

		{#if minWarning}
			<div class="min-warn">⚠ MINIMUM {contentView === 'chords' ? '2 CHORDS' : '3 INTERVALS'} REQUIRED</div>
		{/if}

		{#if contentView === 'intervals'}
			<div class="interval-list">
				{#each INTERVALS as def}
					<IntervalCard {def} state={state.intervals[def.id]} modeFilter={activeTab} ontoggle={toggleInterval} onplay={playIntervalPreview} playing={playingId === def.id} />
				{/each}
			</div>
		{:else}
			<div class="interval-list">
				{#each CHORDS as def}
					<ChordCard {def} state={state.chords[def.id]} voicingFilter={chordVoicingTab} ontoggle={toggleChord} onplay={playChordPreview} playing={playingId === def.id} />
				{/each}
			</div>
		{/if}
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
	.content-toggle {
		display: flex; gap: 0;
	}
	.ct-btn {
		flex: 1;
		font-size: 0.4rem; font-weight: 900;
		font-family: var(--mono); letter-spacing: 0.12em;
		padding: 0.4rem 0.75rem;
		background: transparent;
		color: var(--text-secondary);
		border: 1px solid var(--border-heavy);
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s, background 0.15s;
	}
	.ct-btn:first-child { border-right: none; }
	.ct-btn.active {
		color: var(--accent);
		border-color: var(--accent);
		background: rgba(194, 254, 12, 0.05);
	}
</style>
