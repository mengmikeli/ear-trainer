<script lang="ts">
	import { onMount } from 'svelte';
	import { loadStateV4, saveStateV4 } from '$lib/state/storage';
	import { INTERVALS } from '$lib/definitions/intervals';
	import { CHORDS } from '$lib/definitions/chords';
	import { SCALES } from '$lib/definitions/scales';
	import { MODES } from '$lib/definitions/modes';
	import { playInterval, playChord, playScale } from '$lib/audio/playback';
	import { SCALE_TEMPO, MODE_TEMPO } from '$lib/audio/tempo';
	import { isModeMastered, buildIntervalState, buildChordState, buildScaleState, buildModeState, getMasteryLevel } from '$lib/state/compat';
	import { getStats, getStatsByKind, aggregateStats } from '$lib/state/stats';
	import { isContentKindAvailable } from '$lib/features/content-access';

	import ContentCard from '../../components/ContentCard.svelte';
	import TelemetryBar from '../../components/TelemetryBar.svelte';
	import { canAccessPack, getUserTier, type Tier } from '$lib/features/gate';
	import type { UserStateV4, PlayMode, ChordVoicing } from '$lib/state/schema';

	let state: UserStateV4 | null = $state(null);
	let minWarning = $state(false);
	let activeTab: PlayMode | null = $state(null);
	let chordVoicingTab: ChordVoicing | null = $state(null);
	let playingId: string | null = $state(null);
	let contentView: 'intervals' | 'chords' | 'scales' | 'modes' = $state('intervals');

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

	// Content unlock checks (single source of truth: isContentKindAvailable)
	const chordsUnlocked = $derived(() => {
		if (!state) return false;
		return isContentKindAvailable(state, 'chord');
	});

	const scalesUnlocked = $derived(() => {
		if (!state) return false;
		return isContentKindAvailable(state, 'scale');
	});

	const modesUnlocked = $derived(() => {
		if (!state) return false;
		return isContentKindAvailable(state, 'mode');
	});

	// Pro gate helpers
	const userTier = $derived(() => {
		if (!state) return 'free' as Tier;
		return getUserTier(state.settings);
	});
	const devMode = $derived(() => state?.settings?.devMode ?? false);

	// In dev mode, override unlock/enable so all items are accessible
	function devUnlock<T extends { unlocked: boolean; enabled: boolean }>(s: T): T {
		if (!devMode()) return s;
		return { ...s, unlocked: true, enabled: s.enabled || true };
	}


	onMount(() => {
		state = loadStateV4();
	});

	// ─── Helper functions: compute display props for ContentCard ─────────

	function intervalCardProps(defId: string) {
		if (!state) return null;
		const def = INTERVALS.find(d => d.id === defId)!;
		const istate = devUnlock(buildIntervalState(state, defId));
		const filteredAttempts = activeTab ? istate.modes[activeTab].attempts : istate.attempts;
		const filteredCorrect = activeTab ? istate.modes[activeTab].correct : istate.correct;
		const accuracy = filteredAttempts > 0 ? Math.round((filteredCorrect / filteredAttempts) * 100) : 0;

		const mastery = getMasteryLevel(istate);
		const modeMastered = activeTab ? isModeMastered(istate.modes[activeTab]) : false;

		let dots = '';
		let color = '';
		if (activeTab) {
			dots = modeMastered ? '●' : '';
			color = modeMastered ? '#C2FE0C' : '';
		} else {
			dots = mastery === 'gold' ? '●●●' : mastery === 'silver' ? '●●' : mastery === 'bronze' ? '●' : '';
			color = mastery === 'gold' ? '#FFD700' : mastery === 'silver' ? '#C0C0C0' : '#CD7F32';
		}

		return {
			id: def.id,
			label: def.id,
			name: def.name,
			tier: def.tier,
			unlocked: istate.unlocked,
			enabled: istate.enabled,
			accuracy,
			attempts: filteredAttempts,
			isNew: istate.unlocked && filteredAttempts === 0,
			masteryDots: dots,
			masteryColor: color,
		};
	}

	function chordCardProps(defId: string) {
		if (!state) return null;
		const def = CHORDS.find(d => d.id === defId)!;
		const cstate = devUnlock(buildChordState(state, defId));
		const filteredAttempts = chordVoicingTab ? cstate.voicings[chordVoicingTab].attempts : cstate.attempts;
		const filteredCorrect = chordVoicingTab ? cstate.voicings[chordVoicingTab].correct : cstate.correct;
		const accuracy = filteredAttempts > 0 ? Math.round((filteredCorrect / filteredAttempts) * 100) : 0;

		const masteredCount = [cstate.voicings.root, cstate.voicings.first, cstate.voicings.second]
			.filter(v => isModeMastered(v)).length;
		const mastery = masteredCount === 3 ? 'gold' : masteredCount === 2 ? 'silver' : masteredCount === 1 ? 'bronze' : 'none';
		const modeMastered = chordVoicingTab ? isModeMastered(cstate.voicings[chordVoicingTab]) : false;

		let dots = '';
		let color = '';
		if (chordVoicingTab) {
			dots = modeMastered ? '●' : '';
			color = modeMastered ? '#C2FE0C' : '';
		} else {
			dots = mastery === 'gold' ? '●●●' : mastery === 'silver' ? '●●' : mastery === 'bronze' ? '●' : '';
			color = mastery === 'gold' ? '#FFD700' : mastery === 'silver' ? '#C0C0C0' : '#CD7F32';
		}

		return {
			id: def.id,
			label: def.label ?? def.id.toUpperCase(),
			name: def.name,
			tier: def.tier,
			unlocked: cstate.unlocked,
			enabled: cstate.enabled,
			accuracy,
			attempts: filteredAttempts,
			isNew: cstate.unlocked && filteredAttempts === 0,
			masteryDots: dots,
			masteryColor: color,
		};
	}

	function scaleCardProps(defId: string) {
		if (!state) return null;
		const def = SCALES.find(d => d.id === defId)!;
		const sstate = devUnlock(buildScaleState(state, defId));
		const accuracy = sstate.attempts > 0 ? Math.round((sstate.correct / sstate.attempts) * 100) : 0;

		return {
			id: def.id,
			label: def.label,
			name: def.name,
			tier: def.tier,
			unlocked: sstate.unlocked,
			enabled: sstate.enabled,
			accuracy,
			attempts: sstate.attempts,
			isNew: sstate.unlocked && sstate.attempts === 0,
			masteryDots: '',
			masteryColor: '',
		};
	}

	function modeCardProps(defId: string) {
		if (!state) return null;
		const def = MODES.find(d => d.id === defId)!;
		const mstate = devUnlock(buildModeState(state, defId));
		const accuracy = mstate.attempts > 0 ? Math.round((mstate.correct / mstate.attempts) * 100) : 0;

		return {
			id: def.id,
			label: def.label,
			name: def.name,
			tier: def.tier,
			unlocked: mstate.unlocked,
			enabled: mstate.enabled,
			accuracy,
			attempts: mstate.attempts,
			isNew: mstate.unlocked && mstate.attempts === 0,
			masteryDots: '',
			masteryColor: '',
		};
	}

	// ─── Toggle & play handlers (unchanged) ──────────────────────────────

	function toggleInterval(id: string) {
		if (!state) return;
		const ds = state.definitions.intervals[id];
		if (!ds.unlocked && !state.settings.devMode) return;
		if (ds.enabled) {
			const enabledCount = Object.values(state.definitions.intervals).filter(i => (i.unlocked || state!.settings.devMode) && i.enabled).length;
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
		if (!ds.unlocked && !state.settings.devMode) return;
		if (ds.enabled) {
			const enabledCount = Object.values(state.definitions.chords).filter(c => (c.unlocked || state!.settings.devMode) && c.enabled).length;
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
		if (!ds.unlocked && !state.settings.devMode) return;
		if (ds.enabled) {
			const enabledCount = Object.values(state.definitions.scales).filter(sc => (sc.unlocked || state!.settings.devMode) && sc.enabled).length;
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
		playScale(60, def.intervals, state.settings.toneType, SCALE_TEMPO);
		const dur = def.intervals.length * SCALE_TEMPO + 200;
		setTimeout(() => { playingId = null; }, dur);
	}

	function toggleMode(id: string) {
		if (!state) return;
		const ds = state.definitions.modes[id];
		if (!ds) return;
		if (!ds.unlocked && !state.settings.devMode) return;
		if (ds.enabled) {
			const enabledCount = Object.values(state.definitions.modes).filter(md => (md.unlocked || state!.settings.devMode) && md.enabled).length;
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
		playScale(60, def.intervals, state.settings.toneType, MODE_TEMPO);
		const dur = def.intervals.length * MODE_TEMPO + 200;
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
			const intervalEntries = getStatsByKind(state.stats, 'interval');
			const intervalAgg = aggregateStats(intervalEntries);
			return [
				{ label: 'SES', value: state.globalStats.totalSessions },
				{ label: 'Q', value: intervalAgg.attempts },
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
	<h2 class="page-heading">PROGRESS</h2>

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

		{#if minWarning}
			<div class="min-warn">MINIMUM {contentView === 'chords' ? '2 CHORDS' : contentView === 'scales' ? '2 SCALES' : contentView === 'modes' ? '2 MODES' : '3 INTERVALS'} REQUIRED</div>
		{/if}

		{#if contentView === 'intervals'}
			<div class="interval-list">
				{#each INTERVALS as def}
					{@const accessible = canAccessPack(def.pack, userTier(), devMode())}
					{#if accessible}
						{@const props = intervalCardProps(def.id)}
						{#if props}
							<ContentCard {...props} ontoggle={toggleInterval} onplay={playIntervalPreview} playing={playingId === def.id} />
						{/if}
					{:else}
						<ContentCard
							id={def.id}
							label={def.label ?? def.id}
							name={def.name}
							tier={def.tier}
							unlocked={false}
							enabled={false}
							accuracy={0}
							attempts={0}
							isNew={false}
							masteryDots=""
							masteryColor=""
							playing={false}
						/>
					{/if}
				{/each}
			</div>
		{:else if contentView === 'chords'}
			<div class="interval-list">
				{#each CHORDS as def}
					{@const accessible = canAccessPack(def.pack, userTier(), devMode())}
					{#if accessible}
						{@const props = chordCardProps(def.id)}
						{#if props}
							<ContentCard {...props} ontoggle={toggleChord} onplay={playChordPreview} playing={playingId === def.id} />
						{/if}
					{:else}
						<ContentCard
							id={def.id}
							label={def.label ?? def.id}
							name={def.name}
							tier={def.tier}
							unlocked={false}
							enabled={false}
							accuracy={0}
							attempts={0}
							isNew={false}
							masteryDots=""
							masteryColor=""
							playing={false}
						/>
					{/if}
				{/each}
			</div>
		{:else if contentView === 'scales'}
			<div class="interval-list">
				{#each SCALES as def}
					{@const accessible = canAccessPack(def.pack, userTier(), devMode())}
					{#if accessible}
						{@const props = scaleCardProps(def.id)}
						{#if props}
							<ContentCard {...props} ontoggle={toggleScale} onplay={playScalePreview} playing={playingId === def.id} />
						{/if}
					{:else}
						<ContentCard
							id={def.id}
							label={def.label ?? def.id}
							name={def.name}
							tier={def.tier}
							unlocked={false}
							enabled={false}
							accuracy={0}
							attempts={0}
							isNew={false}
							masteryDots=""
							masteryColor=""
							playing={false}
						/>
					{/if}
				{/each}
			</div>
		{:else if contentView === 'modes'}
			<div class="interval-list">
				{#each MODES as def}
					{@const accessible = canAccessPack(def.pack, userTier(), devMode())}
					{#if accessible}
						{@const props = modeCardProps(def.id)}
						{#if props}
							<ContentCard {...props} ontoggle={toggleMode} onplay={playModePreview} playing={playingId === def.id} />
						{/if}
					{:else}
						<ContentCard
							id={def.id}
							label={def.label ?? def.id}
							name={def.name}
							tier={def.tier}
							unlocked={false}
							enabled={false}
							accuracy={0}
							attempts={0}
							isNew={false}
							masteryDots=""
							masteryColor=""
							playing={false}
						/>
					{/if}
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.progress-page { display: flex; flex-direction: column; gap: 1.5rem; }
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
	}
</style>
