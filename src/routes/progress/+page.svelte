<script lang="ts">
	import { onMount } from 'svelte';
	import { loadStateV4, saveStateV4 } from '$lib/state/storage';
	import { INTERVALS } from '$lib/definitions/intervals';
	import { CHORDS } from '$lib/definitions/chords';
	import { SCALES } from '$lib/definitions/scales';
	import { MODES } from '$lib/definitions/modes';
	import { playInterval, playChord, playScale } from '$lib/audio/playback';
	import { isModeMastered, buildIntervalState, buildChordState, buildScaleState, buildModeState } from '$lib/state/compat';
	import { getStats, getStatsByKind, aggregateStats, getStatsForDef } from '$lib/state/stats';
	import { LISTENING_TIPS } from '$lib/definitions/tips';
	import { getItemMasteryStatus, getNextUnlockProgress, type MasteryStatus } from '$lib/state/progression';
	import IntervalCard from '../../components/IntervalCard.svelte';
	import ChordCard from '../../components/ChordCard.svelte';
	import ScaleCard from '../../components/ScaleCard.svelte';
	import ModeCard from '../../components/ModeCard.svelte';
	import LockedCard from '../../components/LockedCard.svelte';
	import TelemetryBar from '../../components/TelemetryBar.svelte';
	import { canAccess, getUserTier, type Tier } from '$lib/features/gate';
	import type { UserStateV4, PlayMode, ChordVoicing } from '$lib/state/schema';

	let state: UserStateV4 | null = $state(null);
	let minWarning = $state(false);
	let activeTab: PlayMode | null = $state(null);
	let chordVoicingTab: ChordVoicing | null = $state(null);
	let playingId: string | null = $state(null);
	let contentView: 'intervals' | 'chords' | 'scales' | 'modes' = $state('intervals');

	const modes: PlayMode[] = ['ascending', 'descending', 'harmonic'];

	function masteryBadge(kind: 'interval' | 'chord' | 'scale' | 'mode', defId: string): { symbol: string; cls: string } {
		if (!state) return { symbol: '—', cls: 'untouched' };
		const status = getItemMasteryStatus(state, kind, defId);
		if (status === 'mastered') return { symbol: '✓', cls: 'mastered' };
		if (status === 'in-progress') return { symbol: '⟳', cls: 'in-progress' };
		return { symbol: '—', cls: 'untouched' };
	}

	function hasAttempts(kind: 'interval' | 'chord' | 'scale' | 'mode', defId: string): boolean {
		if (!state) return false;
		const entries = getStatsForDef(state.stats, kind, defId);
		const agg = aggregateStats(entries);
		return agg.attempts > 0;
	}

	const tierProgress = $derived(() => {
		if (!state) return null;
		return getNextUnlockProgress(state, contentView);
	});

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
		if (state.settings.devMode) return true;
		let bronzeCount = 0;
		for (const def of INTERVALS) {
			const ds = state.definitions.intervals[def.id];
			if (!ds?.unlocked) continue;
			const istate = buildIntervalState(state, def.id);
			const mastered = [istate.modes.ascending, istate.modes.descending, istate.modes.harmonic]
				.filter(m => isModeMastered(m)).length;
			if (mastered >= 1) bronzeCount++;
		}
		return bronzeCount >= 5;
	});

	// Scale system unlock: Bronze mastery on 3+ intervals
	const scalesUnlocked = $derived(() => {
		if (!state) return false;
		if (state.settings.devMode) return true;
		let bronzeCount = 0;
		for (const def of INTERVALS) {
			const ds = state.definitions.intervals[def.id];
			if (!ds?.unlocked) continue;
			const istate = buildIntervalState(state, def.id);
			const mastered = [istate.modes.ascending, istate.modes.descending, istate.modes.harmonic]
				.filter(m => isModeMastered(m)).length;
			if (mastered >= 1) bronzeCount++;
		}
		return bronzeCount >= 3;
	});

	const modesUnlocked = $derived(() => {
		if (!state) return false;
		if (state.settings.devMode) return true;
		return scalesUnlocked();
	});

	// Pro gate helpers
	const userTier = $derived(() => {
		if (!state) return 'free' as Tier;
		return getUserTier(state.settings);
	});
	const devMode = $derived(() => state?.settings?.devMode ?? false);

	function handleProUnlock() {
		if (!state) return;
		state.settings.proUnlocked = true;
		state = { ...state };
		saveStateV4(state);
	}

	onMount(() => {
		state = loadStateV4();
	});

	function toggleInterval(id: string) {
		if (!state) return;
		const ds = state.definitions.intervals[id];
		if (!ds.unlocked) return;
		if (ds.enabled) {
			const enabledCount = Object.values(state.definitions.intervals).filter(i => i.unlocked && i.enabled).length;
			if (enabledCount <= 3) {
				minWarning = true;
				setTimeout(() => { minWarning = false; }, 2000);
				return;
			}
		}
		state.definitions.intervals[id].enabled = !ds.enabled;
		state = { ...state };
		saveStateV4(state);
	}

	function toggleChord(id: string) {
		if (!state) return;
		const ds = state.definitions.chords[id];
		if (!ds.unlocked) return;
		if (ds.enabled) {
			const enabledCount = Object.values(state.definitions.chords).filter(c => c.unlocked && c.enabled).length;
			if (enabledCount <= 2) {
				minWarning = true;
				setTimeout(() => { minWarning = false; }, 2000);
				return;
			}
		}
		state.definitions.chords[id].enabled = !ds.enabled;
		state = { ...state };
		saveStateV4(state);
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

	function toggleScale(id: string) {
		if (!state) return;
		const ds = state.definitions.scales[id];
		if (!ds.unlocked) return;
		if (ds.enabled) {
			const enabledCount = Object.values(state.definitions.scales).filter(sc => sc.unlocked && sc.enabled).length;
			if (enabledCount <= 2) {
				minWarning = true;
				setTimeout(() => { minWarning = false; }, 2000);
				return;
			}
		}
		state.definitions.scales[id].enabled = !ds.enabled;
		state = { ...state };
		saveStateV4(state);
	}

	function playScalePreview(id: string) {
		if (!state || playingId) return;
		const def = SCALES.find(d => d.id === id);
		if (!def) return;
		playingId = id;
		playScale(60, def.intervals, state.settings.toneType, 150);
		const dur = def.intervals.length * 150 + 200;
		setTimeout(() => { playingId = null; }, dur);
	}

	function toggleMode(id: string) {
		if (!state) return;
		const ds = state.definitions.modes[id];
		if (!ds || !ds.unlocked) return;
		if (ds.enabled) {
			const enabledCount = Object.values(state.definitions.modes).filter(md => md.unlocked && md.enabled).length;
			if (enabledCount <= 2) {
				minWarning = true;
				setTimeout(() => { minWarning = false; }, 2000);
				return;
			}
		}
		state.definitions.modes[id].enabled = !ds.enabled;
		state = { ...state };
		saveStateV4(state);
	}

	function playModePreview(id: string) {
		if (!state || playingId) return;
		const def = MODES.find(d => d.id === id);
		if (!def) return;
		playingId = id;
		playScale(60, def.intervals, state.settings.toneType, 150);
		const dur = def.intervals.length * 150 + 200;
		setTimeout(() => { playingId = null; }, dur);
	}

	const telemetrySegments = $derived(() => {
		if (!state) return [];
		if (contentView === 'chords') {
			if (!chordVoicingTab) {
				const entries = getStatsByKind(state.stats, 'chord');
				const agg = aggregateStats(entries);
				const acc = agg.attempts > 0 ? Math.round(agg.accuracy * 100) : 0;
				return [
					{ label: 'Q', value: agg.attempts },
					{ label: 'ACC', value: acc + '%' },
				];
			}
			// Filter by voicing
			let attempts = 0, correct = 0;
			for (const def of CHORDS) {
				if (!state.definitions.chords[def.id]?.unlocked) continue;
				const cs = getStats(state.stats, `chord:${def.id}:${chordVoicingTab}`);
				attempts += cs.attempts;
				correct += cs.correct;
			}
			const acc = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
			return [
				{ label: 'Q', value: attempts },
				{ label: 'ACC', value: acc + '%' },
			];
		}
		if (contentView === 'scales') {
			const entries = getStatsByKind(state.stats, 'scale');
			const agg = aggregateStats(entries);
			const acc = agg.attempts > 0 ? Math.round(agg.accuracy * 100) : 0;
			return [
				{ label: 'Q', value: agg.attempts },
				{ label: 'ACC', value: acc + '%' },
			];
		}
		if (contentView === 'modes') {
			const entries = getStatsByKind(state.stats, 'mode');
			const agg = aggregateStats(entries);
			const acc = agg.attempts > 0 ? Math.round(agg.accuracy * 100) : 0;
			return [
				{ label: 'Q', value: agg.attempts },
				{ label: 'ACC', value: acc + '%' },
			];
		}
		// Intervals
		if (!activeTab) {
			return [
				{ label: 'SES', value: state.globalStats.totalSessions },
				{ label: 'Q', value: state.globalStats.totalQuestions },
				{ label: 'STK', value: state.globalStats.currentStreak },
			];
		}
		// Filter by mode
		let attempts = 0, correct = 0;
		for (const def of INTERVALS) {
			if (!state.definitions.intervals[def.id]?.unlocked) continue;
			const cs = getStats(state.stats, `interval:${def.id}:${activeTab}`);
			attempts += cs.attempts;
			correct += cs.correct;
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

	{#if chordsUnlocked() || scalesUnlocked() || modesUnlocked()}
		<div class="content-toggle">
			<button class="ct-btn" class:active={contentView === 'intervals'} onclick={() => contentView = 'intervals'}>INTERVALS</button>
			{#if chordsUnlocked()}
			<button class="ct-btn" class:active={contentView === 'chords'} onclick={() => contentView = 'chords'}>CHORDS</button>
			{/if}
			{#if scalesUnlocked()}
			<button class="ct-btn" class:active={contentView === 'scales'} onclick={() => contentView = 'scales'}>SCALES</button>
			{/if}
			{#if modesUnlocked()}
			<button class="ct-btn" class:active={contentView === 'modes'} onclick={() => contentView = 'modes'}>MODES</button>
			{/if}
		</div>
	{/if}

	{#if contentView === 'intervals'}
		<div class="tabs">
			{#each intervalTabs as tab}
				<button class="tab" class:active={activeTab === tab.value} class:glyph={tab.value !== null}
					onclick={() => activeTab = tab.value}>{tab.label}</button>
			{/each}
		</div>
	{:else if contentView === 'chords'}
		<div class="tabs">
			{#each chordTabs as tab}
				<button class="tab" class:active={chordVoicingTab === tab.value}
					onclick={() => chordVoicingTab = tab.value}>{tab.label}</button>
			{/each}
		</div>
	{/if}

	{#if state}
		<TelemetryBar segments={telemetrySegments()} />

		{#if tierProgress()}
			{@const tp = tierProgress()}
			<div class="tier-progress">
				<span class="tp-label">T{tp.nextTier}</span>
				<span class="tp-detail">{tp.prerequisiteMastery.masteredCount}/{tp.prerequisiteMastery.totalItems} mastered · {tp.pooledAttempts}/{tp.threshold.questions} questions</span>
			</div>
		{/if}

		{#if minWarning}
			<div class="min-warn">⚠ MINIMUM {contentView === 'chords' ? '2 CHORDS' : contentView === 'scales' ? '2 SCALES' : contentView === 'modes' ? '2 MODES' : '3 INTERVALS'} REQUIRED</div>
		{/if}

		{#if contentView === 'intervals'}
			<div class="interval-list">
				{#each INTERVALS as def}
					{#if !canAccess(`content:intervals:tier${def.tier}`, userTier(), devMode())}
						<LockedCard feature={def.name} onUnlock={handleProUnlock} />
					{:else}
						{@const badge = masteryBadge('interval', def.id)}
						<div class="card-wrap">
							<span class="mastery-badge {badge.cls}">{badge.symbol}</span>
							<IntervalCard {def} state={buildIntervalState(state, def.id)} modeFilter={activeTab} ontoggle={toggleInterval} onplay={playIntervalPreview} playing={playingId === def.id} />
							{#if LISTENING_TIPS[def.id] && hasAttempts('interval', def.id)}
								<p class="listening-tip">{LISTENING_TIPS[def.id]}</p>
							{/if}
						</div>
					{/if}
				{/each}
			</div>
		{:else if contentView === 'chords'}
			<div class="interval-list">
				{#each CHORDS as def}
					{#if !canAccess(`content:chords:tier${def.tier}`, userTier(), devMode())}
						<LockedCard feature={def.name} onUnlock={handleProUnlock} />
					{:else}
						{@const badge = masteryBadge('chord', def.id)}
						<div class="card-wrap">
							<span class="mastery-badge {badge.cls}">{badge.symbol}</span>
							<ChordCard {def} state={buildChordState(state, def.id)} voicingFilter={chordVoicingTab} ontoggle={toggleChord} onplay={playChordPreview} playing={playingId === def.id} />
							{#if LISTENING_TIPS[def.id] && hasAttempts('chord', def.id)}
								<p class="listening-tip">{LISTENING_TIPS[def.id]}</p>
							{/if}
						</div>
					{/if}
				{/each}
			</div>
		{:else if contentView === 'scales'}
			<div class="interval-list">
				{#each SCALES as def}
					{#if !canAccess(`content:scales:tier${def.tier}`, userTier(), devMode())}
						<LockedCard feature={def.name} onUnlock={handleProUnlock} />
					{:else}
						{@const badge = masteryBadge('scale', def.id)}
						<div class="card-wrap">
							<span class="mastery-badge {badge.cls}">{badge.symbol}</span>
							<ScaleCard {def} state={buildScaleState(state, def.id)} ontoggle={toggleScale} onplay={playScalePreview} playing={playingId === def.id} />
							{#if LISTENING_TIPS[def.id] && hasAttempts('scale', def.id)}
								<p class="listening-tip">{LISTENING_TIPS[def.id]}</p>
							{/if}
						</div>
					{/if}
				{/each}
			</div>
		{:else if contentView === 'modes'}
			<div class="interval-list">
				{#each MODES as def}
					{#if !canAccess('content:modes', userTier(), devMode())}
						<LockedCard feature={def.name} onUnlock={handleProUnlock} />
					{:else if state.definitions.modes[def.id]?.unlocked || state.settings.devMode}
						{@const badge = masteryBadge('mode', def.id)}
						<div class="card-wrap">
							<span class="mastery-badge {badge.cls}">{badge.symbol}</span>
							<ModeCard {def} state={buildModeState(state, def.id)} ontoggle={toggleMode} onplay={playModePreview} playing={playingId === def.id} />
							{#if LISTENING_TIPS[def.id] && hasAttempts('mode', def.id)}
								<p class="listening-tip">{LISTENING_TIPS[def.id]}</p>
							{/if}
						</div>
					{/if}
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
		margin-right: -1px;
		cursor: pointer;
		transition: color 0.15s, background 0.15s, border-color 0.15s;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.tab:last-child { margin-right: 0; }
	.tab.glyph { font-size: 0.6rem; letter-spacing: 0; }
	.tab.active {
		color: var(--marathon-blue);
		border-color: var(--marathon-blue);
		background: rgba(58, 44, 255, 0.08);
		z-index: 1;
		position: relative;
	}
	.tab.active + .tab { border-left-color: var(--marathon-blue); }
	.interval-list { display: flex; flex-direction: column; gap: 0.5rem; }
	.card-wrap {
		position: relative;
	}
	.mastery-badge {
		position: absolute;
		top: 0.35rem;
		right: 0.35rem;
		z-index: 2;
		font-size: 0.4rem;
		font-weight: 900;
		font-family: var(--mono);
		width: 1.2rem;
		height: 1.2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		pointer-events: none;
	}
	.mastery-badge.mastered {
		color: var(--correct);
		background: rgba(0, 255, 100, 0.08);
	}
	.mastery-badge.in-progress {
		color: var(--warm);
		background: rgba(255, 200, 0, 0.08);
	}
	.mastery-badge.untouched {
		color: var(--text-secondary);
		opacity: 0.3;
	}
	.listening-tip {
		margin: 0.15rem 0.25rem 0;
		font-family: var(--mono);
		font-size: 0.32rem;
		font-style: italic;
		color: var(--text-secondary);
		opacity: 0.65;
		line-height: 1.4;
		letter-spacing: 0.02em;
	}
	.tier-progress {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--border-heavy);
		font-family: var(--mono);
		font-size: 0.35rem;
		letter-spacing: 0.08em;
	}
	.tp-label {
		font-weight: 900;
		color: var(--accent);
	}
	.tp-detail {
		color: var(--text-secondary);
	}
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
	.ct-btn + .ct-btn { margin-left: -1px; }
	.ct-btn.active {
		color: var(--accent);
		border-color: var(--accent);
		background: rgba(194, 254, 12, 0.05);
		z-index: 1;
		position: relative;
	}

	/* Desktop: two-column card grid */
	@media (min-width: 768px) {
		.progress-page { max-width: 800px; margin: 0 auto; }
		.interval-list {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			gap: 0.75rem;
		}
		.heading { font-size: 3.5rem; }
	}
</style>
