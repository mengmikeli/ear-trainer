<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { loadStateV4, saveStateV4 } from '$lib/state/storage';
	import { checkTierUnlockV4, getNextUnlockProgress } from '$lib/state/progression';
	import { getStatsForDef, aggregateStats, getStatsByKind } from '$lib/state/stats';
	import { warmUpAudio } from '$lib/audio/context';
	import { isContentKindAvailable } from '$lib/features/content-access';
	import { INTERVALS } from '$lib/definitions/intervals';
	import { CHORDS } from '$lib/definitions/chords';
	import { SCALES } from '$lib/definitions/scales';
	import { MODES } from '$lib/definitions/modes';
	import { VERSION_STRING } from '$lib/version';
	import type { UserStateV4 } from '$lib/state/schema';
	import LissajousRing from '../components/LissajousRing.svelte';
	// import ChladniBackground from '../components/ChladniBackground.svelte'; // disabled — perf not optimized yet
	// import MiniLissajous from '../components/MiniLissajous.svelte'; // disabled — repetitive, revisit later

	let state: UserStateV4 | null = $state(null);
	let goGlitching = $state(false);
	let goText = $state('GO');
	let versionCopied = $state(false);
	let booted = $state(false);
	let titleChars: string[] = $state([]);
	let bootPhase = $state(0); // 0=glitch, 1=resolving, 2=done

	const TITLE_TEXT = 'EAR TRAINER';
	const glitchChars = ['\uE000', '\uE001', '\uE002', '\uE003', '\uE004', '\uE005', '\uE006', '\uE007', '\uE008', '\uE010', '\uE013', '\uE014', '\uE017'];
	const CHEVRON_LEFT = '\uE007';
	const CHEVRON_RIGHT = '\uE008';
	const LOCK_GLYPH = '\uE015';

	// Content type metadata for mode-switch tiles
	const CONTENT_TYPES = [
		{ id: 'intervals' as const, label: 'INT', fullLabel: 'INTERVALS', color: 'var(--accent)', semitones: 7 },
		{ id: 'chords' as const, label: 'CRD', fullLabel: 'CHORDS', color: 'var(--marathon-blue)', chordIntervals: [0, 4, 7] },
		{ id: 'scales' as const, label: 'SCL', fullLabel: 'SCALES', color: '#FF6B2C', scaleIntervals: [0, 2, 4, 5, 7, 9, 11] },
		{ id: 'modes' as const, label: 'MOD', fullLabel: 'MODES', color: '#9B59B6', semitones: 10 },
	] as const;

	onMount(() => {
		state = loadStateV4();
		if (state && !state.settings.hasCompletedFRE) {
			goto(`${base}/welcome`);
			return;
		}

		// Boot sequence: glitch characters → resolve to title
		titleChars = TITLE_TEXT.split('').map(() => glitchChars[Math.floor(Math.random() * glitchChars.length)]);
		bootPhase = 0;

		// Rapid glitch phase (100ms)
		const glitchInterval = setInterval(() => {
			titleChars = TITLE_TEXT.split('').map(() => glitchChars[Math.floor(Math.random() * glitchChars.length)]);
		}, 50);

		setTimeout(() => {
			clearInterval(glitchInterval);
			bootPhase = 1;
			// Resolve characters one by one
			const chars = TITLE_TEXT.split('');
			let resolved = 0;
			const resolveInterval = setInterval(() => {
				if (resolved < chars.length) {
					titleChars[resolved] = chars[resolved];
					titleChars = [...titleChars]; // trigger reactivity
					resolved++;
				} else {
					clearInterval(resolveInterval);
					bootPhase = 2;
					booted = true;
				}
			}, 35);
		}, 300);
	});

	// --- Unlock logic (single source of truth: isContentKindAvailable) ---
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

	const activeContent = $derived(() => {
		const content = state?.settings?.activeContent ?? 'adaptive';
		const devMode = state?.settings?.devMode;
		if (devMode) return content;
		if (content === 'chords' && !chordsUnlocked()) return 'intervals';
		if (content === 'scales' && !scalesUnlocked()) return 'intervals';
		if (content === 'modes' && !modesUnlocked()) return 'intervals';
		if (content === 'adaptive') return 'intervals';
		return content;
	});

	function setActiveContent(mode: 'intervals' | 'chords' | 'scales' | 'modes') {
		if (!state) return;
		if (state.settings.activeContent === mode) {
			state.settings.activeContent = 'adaptive';
		} else {
			state.settings.activeContent = mode;
		}
		saveStateV4(state);
	}

	function isContentUnlocked(id: string): boolean {
		if (id === 'intervals') return true;
		if (id === 'chords') return chordsUnlocked();
		if (id === 'scales') return scalesUnlocked();
		if (id === 'modes') return modesUnlocked();
		return false;
	}

	function handleGo(e: Event) {
		e.preventDefault();
		warmUpAudio();
		if (goGlitching) return;
		goGlitching = true;
		const content = activeContent();
		const target = content === 'chords'
			? `${base}/quiz/chords`
			: content === 'scales'
				? `${base}/quiz/scales`
				: content === 'modes'
					? `${base}/quiz/modes`
					: content === 'intervals'
						? `${base}/quiz/intervals`
						: `${base}/quiz`;
		let tick = 0;
		const iv = setInterval(() => {
			goText = glitchChars[Math.floor(Math.random() * glitchChars.length)];
			tick++;
			if (tick >= 6) {
				clearInterval(iv);
				goto(target);
			}
		}, 50);
	}

	// --- Stats derivations ---
	const overallAccuracy = $derived(() => {
		if (!state) return 0;
		const content = activeContent();
		const kind = content === 'chords' ? 'chord' as const
			: content === 'scales' ? 'scale' as const
			: 'interval' as const;
		const entries = getStatsByKind(state.stats, kind);
		const agg = aggregateStats(entries);
		return agg.attempts > 0 ? Math.round(agg.accuracy * 100) : 0;
	});

	const currentTier = $derived(() => {
		if (!state) return 1;
		if (activeContent() === 'chords') {
			let highest = 1;
			for (const def of CHORDS) {
				if (state.definitions.chords[def.id]?.unlocked && def.tier > highest) highest = def.tier;
			}
			return highest;
		}
		if (activeContent() === 'scales') {
			let highest = 1;
			for (const def of SCALES) {
				if (state.definitions.scales[def.id]?.unlocked && def.tier > highest) highest = def.tier;
			}
			return highest;
		}
		let highest = 1;
		for (const def of INTERVALS) {
			if (state.definitions.intervals[def.id]?.unlocked && def.tier > highest) highest = def.tier;
		}
		return highest;
	});

	const contentCount = $derived(() => {
		if (!state) return '0/13';
		if (activeContent() === 'chords') {
			const unlocked = Object.values(state.definitions.chords).filter(s => s.unlocked).length;
			return `${unlocked}/${CHORDS.length}`;
		}
		if (activeContent() === 'scales') {
			const unlocked = Object.values(state.definitions.scales).filter(s => s.unlocked).length;
			return `${unlocked}/${SCALES.length}`;
		}
		const unlocked = Object.values(state.definitions.intervals).filter(s => s.unlocked).length;
		return `${unlocked}/${INTERVALS.length}`;
	});

	const totalQuestions = $derived(() => {
		if (!state) return 0;
		if (activeContent() === 'chords') {
			const entries = getStatsByKind(state.stats, 'chord');
			return aggregateStats(entries).attempts;
		}
		if (activeContent() === 'scales') {
			const entries = getStatsByKind(state.stats, 'scale');
			return aggregateStats(entries).attempts;
		}
		return state.globalStats.totalQuestions;
	});

	const unlockHint = $derived(() => {
		if (!state) return null;
		const content = activeContent();
		if (content === 'adaptive') return null;
		const info = getNextUnlockProgress(state, content as 'intervals' | 'chords' | 'scales' | 'modes');
		if (!info) return null;
		const { prerequisiteMastery: pm, threshold, pooledAttempts } = info;
		const remaining = pm.totalItems - pm.masteredCount;
		const needAttempts = pm.items.filter(i => i.attempts < 5);
		if (needAttempts.length > 0 && needAttempts.length <= 3) {
			const names = needAttempts.map(i => i.id).join(', ');
			return `PRACTICE ${names} -- NEED 5+ ATTEMPTS EACH`;
		}
		if (remaining > 0) {
			const label = content === 'chords' ? 'CHORDS' : content === 'scales' ? 'SCALES' : content === 'modes' ? 'MODES' : 'INTERVALS';
			return `MASTER ${remaining} MORE ${label} TO UNLOCK T${info.nextTier}`;
		}
		if (pooledAttempts < threshold.questions) {
			return `${pooledAttempts}/${threshold.questions} QUESTIONS FOR T${info.nextTier}`;
		}
		return `${pm.masteredCount}/${pm.totalItems} MASTERED`;
	});

	// Ambient color — shifts the whole page palette per content type
	const CONTENT_COLORS: Record<string, string> = {
		'intervals': '#C2FE0C',  // accent
		'chords': '#3A2CFF',     // marathon-blue
		'scales': '#FF6B2C',     // warm orange
		'modes': '#9B59B6',      // deep purple
		'adaptive': '#C2FE0C',
	};

	const ambientColor = $derived(() => {
		return CONTENT_COLORS[activeContent()] ?? '#C2FE0C';
	});

	const ambientColorDim = $derived(() => {
		return ambientColor() + '15'; // 8% opacity hex suffix
	});

	// Lissajous signature for current content type
	const heroSemitones = $derived(() => {
		const content = activeContent();
		if (content === 'modes') return 10;
		return 7; // P5 — the signature
	});

	const heroChordIntervals = $derived(() => {
		const content = activeContent();
		if (content === 'chords') return [0, 4, 7]; // major triad
		return undefined;
	});

	const heroScaleIntervals = $derived(() => {
		const content = activeContent();
		if (content === 'scales') return [0, 2, 4, 5, 7, 9, 11]; // major scale
		return undefined;
	});

	// Content type stats for tiles
	function getContentStats(id: string): { accuracy: number; count: string; tier: number } {
		if (!state) return { accuracy: 0, count: '0/0', tier: 1 };
		if (id === 'chords') {
			const entries = getStatsByKind(state.stats, 'chord');
			const agg = aggregateStats(entries);
			const unlocked = Object.values(state.definitions.chords).filter(s => s.unlocked).length;
			let highest = 1;
			for (const def of CHORDS) { if (state.definitions.chords[def.id]?.unlocked && def.tier > highest) highest = def.tier; }
			return { accuracy: agg.attempts > 0 ? Math.round(agg.accuracy * 100) : 0, count: `${unlocked}/${CHORDS.length}`, tier: highest };
		}
		if (id === 'scales') {
			const entries = getStatsByKind(state.stats, 'scale');
			const agg = aggregateStats(entries);
			const unlocked = Object.values(state.definitions.scales).filter(s => s.unlocked).length;
			let highest = 1;
			for (const def of SCALES) { if (state.definitions.scales[def.id]?.unlocked && def.tier > highest) highest = def.tier; }
			return { accuracy: agg.attempts > 0 ? Math.round(agg.accuracy * 100) : 0, count: `${unlocked}/${SCALES.length}`, tier: highest };
		}
		if (id === 'modes') {
			const entries = getStatsByKind(state.stats, 'mode');
			const agg = aggregateStats(entries);
			const unlocked = Object.values(state.definitions.modes).filter(s => s.unlocked).length;
			let highest = 1;
			for (const def of MODES) { if (state.definitions.modes[def.id]?.unlocked && def.tier > highest) highest = def.tier; }
			return { accuracy: agg.attempts > 0 ? Math.round(agg.accuracy * 100) : 0, count: `${unlocked}/${MODES.length}`, tier: highest };
		}
		// intervals — always use interval stats, not activeContent-dependent
		const entries = getStatsByKind(state.stats, 'interval');
		const agg = aggregateStats(entries);
		const unlocked = Object.values(state.definitions.intervals).filter(s => s.unlocked).length;
		let highest = 1;
		for (const def of INTERVALS) { if (state.definitions.intervals[def.id]?.unlocked && def.tier > highest) highest = def.tier; }
		return {
			accuracy: agg.attempts > 0 ? Math.round(agg.accuracy * 100) : 0,
			count: `${unlocked}/${INTERVALS.length}`,
			tier: highest,
		};
	}
</script>

<!-- Chladni background disabled — perf not optimized yet -->
<!-- <div class="chladni-wrap">
	<ChladniBackground
		semitones={heroSemitones()}
		chordIntervals={heroChordIntervals()}
		scaleIntervals={heroScaleIntervals()}
	/>
</div> -->

<div class="home" class:booted style:--ambient={ambientColor()} style:--ambient-dim={ambientColorDim()}>
	<!-- ═══ BAND 1: Header strip ═══ -->
	<header class="header-strip">
		<div class="title-boot">
			<h1 class="title">
				{#each titleChars as char, i}
					<span class="char" class:resolved={bootPhase >= 2 || (bootPhase === 1 && char === TITLE_TEXT[i])} class:space={TITLE_TEXT[i] === ' '}>{char}</span>
				{/each}
			</h1>
		</div>
		<div class="header-telemetry">
			<div class="version-badge" role="button" tabindex="0" onclick={() => {
				navigator.clipboard.writeText(VERSION_STRING);
				versionCopied = true;
				setTimeout(() => { versionCopied = false; }, 1500);
			}} class:copied={versionCopied}>
				SYS {VERSION_STRING}
			</div>
		</div>
	</header>

	{#if state}
		<!-- ═══ BAND 2: HUD Telemetry Bar ═══ -->
		<div class="telemetry-strip">
			<div class="telem-segment">
				<span class="telem-tag">ACC</span>
				<span class="telem-val">{overallAccuracy()}%</span>
			</div>
			<div class="telem-divider"></div>
			<div class="telem-segment">
				<span class="telem-tag">STK</span>
				<span class="telem-val">{state.globalStats.currentStreak}</span>
			</div>
			<div class="telem-divider"></div>
			<div class="telem-segment">
				<span class="telem-tag">T{currentTier()}</span>
				<span class="telem-val">{contentCount()}</span>
			</div>
			<div class="telem-divider"></div>
			<div class="telem-segment">
				<span class="telem-tag">Q</span>
				<span class="telem-val">{totalQuestions()}</span>
			</div>
		</div>

		<!-- ═══ BAND 3: Hero — Lissajous ring center stage ═══ -->
		<div class="hero-zone">
			<!-- Corner HUD marks -->
			<span class="corner-mark tl"></span>
			<span class="corner-mark tr"></span>
			<span class="corner-mark bl"></span>
			<span class="corner-mark br"></span>

			<!-- Coordinate micro-labels -->
			<span class="coord-label top-left">FREQ 1:1</span>
			<span class="coord-label bottom-right">PHASE +90</span>

			<div class="ring-container">
				<LissajousRing
					size={320}
					semitones={0}
					phase="rest"
				/>
			</div>

			<a
				href={activeContent() === 'chords' ? `${base}/quiz/chords` : activeContent() === 'scales' ? `${base}/quiz/scales` : activeContent() === 'modes' ? `${base}/quiz/modes` : activeContent() === 'intervals' ? `${base}/quiz/intervals` : `${base}/quiz`}
				class="go-btn"
				class:glitching={goGlitching}
				onclick={handleGo}
			>
				<span class="go-text">{goText}</span>
			</a>
		</div>

		<!-- ═══ Bottom section — pinned to bottom ═══ -->
		<div class="bottom-section">
			<!-- Unlock announcement band — always rendered for layout stability -->
			<div class="unlock-band">
				{#if unlockHint()}
					<span class="unlock-chevron">{CHEVRON_LEFT}</span>
					<span class="unlock-text">{unlockHint()}</span>
					<span class="unlock-chevron">{CHEVRON_RIGHT}</span>
				{/if}
			</div>

			<!-- Content type mode switches -->
			<nav class="content-selector">
			{#each CONTENT_TYPES as ct}
				{@const unlocked = isContentUnlocked(ct.id)}
				{@const active = activeContent() === ct.id}
				{@const stats = getContentStats(ct.id)}
				<button
					class="content-tile"
					class:active
					class:locked={!unlocked}
					style:--tile-color={ct.color}
					onclick={() => unlocked && setActiveContent(ct.id)}
					disabled={!unlocked}
				>
					<div class="tile-header" class:active>
						<span class="tile-label">{ct.label}</span>
						{#if !unlocked}
							<span class="tile-lock">{LOCK_GLYPH}</span>
						{/if}
					</div>
					<div class="tile-body">
						<span class="tile-full-label">{ct.fullLabel}</span>
						{#if unlocked && stats.accuracy > 0}
							<span class="tile-stat">{stats.accuracy}%</span>
						{/if}
					</div>
					<div class="tile-footer">
						<span class="tile-count">{stats.count}</span>
						<span class="tile-tier">T{stats.tier}</span>
					</div>
				</button>
			{/each}
		</nav>
		</div>
	{/if}
</div>

<style>
	/* Chladni background boost */
	.chladni-wrap :global(.chladni-bg) {
		opacity: 0.85;
	}

	.home {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: env(safe-area-inset-top) 0 0 0;
		opacity: 0;
		transition: opacity 0.4s ease;
	}
	.home.booted {
		opacity: 1;
	}

	/* ─── BAND 1: Header — centered/stacked mobile, hidden desktop ─── */
	.header-strip {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		padding: 0.75rem 1rem 0;
	}

	.title {
		font-family: var(--font-display);
		font-size: 3.2rem;
		font-weight: 400;
		letter-spacing: 0.12em;
		line-height: 1;
		color: var(--accent);
		display: flex;
		gap: 0;
		justify-content: center;
	}

	.char {
		display: inline-block;
		font-family: var(--mono);
		color: var(--accent);
		opacity: 0.5;
		transition: opacity 0.15s, color 0.15s;
	}
	.char.resolved {
		font-family: var(--font-display);
		color: var(--accent);
		opacity: 1;
	}
	.char.space {
		width: 0.4em;
	}

	.header-telemetry {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.version-badge {
		font-family: var(--mono);
		font-size: 0.35rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		color: #fff;
		background: var(--marathon-blue);
		padding: 0.15rem 0.5rem;
		cursor: pointer;
		transition: background 0.15s;
	}
	.version-badge:active { opacity: 0.7; }
	.version-badge.copied { background: var(--correct); }

	/* ─── BAND 2: Telemetry strip ─── */
	.telemetry-strip {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0;
		margin: 0.5rem 1rem 0;
		border-top: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
		padding: 0.3rem 0;
	}

	.telem-segment {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0 0.6rem;
	}

	.telem-tag {
		font-family: var(--mono);
		font-size: 0.4rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		color: var(--ambient, var(--accent));
		border: 1px solid var(--ambient, var(--accent));
		padding: 0 0.3rem;
		line-height: 1.6;
		transition: color 0.3s, border-color 0.3s;
	}

	.telem-val {
		font-family: var(--mono);
		font-size: 0.45rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		color: var(--text-primary);
	}

	.telem-divider {
		width: 1px;
		height: 0.8rem;
		background: var(--border-heavy);
	}

	/* ─── BAND 3: Hero zone ─── */
	.hero-zone {
		flex: 1 1 0;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		min-height: 0;
		overflow: hidden;
	}

	.ring-container {
		width: min(320px, 80vw, 100%);
		height: min(320px, 80vw, 100%);
		position: relative;
		aspect-ratio: 1;
		max-height: 100%;
	}

	/* Corner HUD marks */
	.corner-mark {
		position: absolute;
		width: 16px;
		height: 16px;
		border-style: solid;
		border-color: var(--ambient, var(--accent));
		opacity: 0.25;
		transition: border-color 0.3s;
	}
	.corner-mark.tl { top: 1rem; left: 1rem; border-width: 1px 0 0 1px; }
	.corner-mark.tr { top: 1rem; right: 1rem; border-width: 1px 1px 0 0; }
	.corner-mark.bl { bottom: 1rem; left: 1rem; border-width: 0 0 1px 1px; }
	.corner-mark.br { bottom: 1rem; right: 1rem; border-width: 0 1px 1px 0; }

	/* Coordinate micro-labels */
	.coord-label {
		position: absolute;
		font-family: var(--mono);
		font-size: 0.3rem;
		letter-spacing: 0.15em;
		color: var(--ambient, var(--accent));
		opacity: 0.2;
		transition: color 0.3s;
	}
	.coord-label.top-left { top: 1.4rem; left: 2rem; }
	.coord-label.bottom-right { bottom: 1.4rem; right: 2rem; }

	/* GO button — overlaid on ring */
	.go-btn {
		position: absolute;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100px;
		height: 100px;
		border-radius: 50%;
		background: var(--accent);
		text-decoration: none;
		transition: transform 0.1s, opacity 0.15s;
		z-index: 2;
	}
	.go-btn:active { transform: scale(0.93); opacity: 0.9; }
	.go-btn.glitching {
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

	.go-text {
		font-family: var(--mono);
		font-size: 1.6rem;
		font-weight: 400;
		letter-spacing: 0.2em;
		color: var(--base);
		text-transform: uppercase;
	}

	/* ─── Unlock announcement band ─── */
	/* ─── Bottom section — unlock band + tiles pinned together ─── */
	.bottom-section {
		margin-top: auto;
		flex-shrink: 0;
		padding: 0 0.5rem;
		padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 0.75rem);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	/* ─── Unlock announcement band — fixed height for layout stability ─── */
	.unlock-band {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.4rem 2rem;
		min-height: 2.4rem;
		background: var(--ambient-dim, rgba(194, 254, 12, 0.04));
		border: 1px solid color-mix(in srgb, var(--ambient, var(--accent)) 15%, transparent);
		transition: background 0.3s, border-color 0.3s;
	}

	.unlock-chevron {
		position: absolute;
		font-family: var(--mono);
		font-size: 0.45rem;
		color: var(--ambient, var(--accent));
		opacity: 0.5;
		transition: color 0.3s;
	}
	.unlock-chevron:first-child { left: 0.5rem; }
	.unlock-chevron:last-child { right: 0.5rem; }

	.unlock-text {
		font-family: var(--mono);
		font-size: 0.35rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		color: var(--ambient, var(--accent));
		opacity: 0.7;
		text-align: center;
		transition: color 0.3s;
	}

	/* ─── BAND 4: Content mode switches ─── */
	.content-selector {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 2px;
	}

	.content-tile {
		display: flex;
		flex-direction: column;
		background: var(--surface);
		border: 1px solid var(--border);
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
		padding: 0;
		overflow: hidden;
		min-width: 0;
	}
	.content-tile.active {
		border-color: var(--tile-color);
	}
	.content-tile.locked {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.tile-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--border);
		padding: 0.15rem 0.35rem;
		transition: background 0.15s;
	}
	.tile-header.active {
		background: var(--tile-color);
	}

	.tile-label {
		font-family: var(--mono);
		font-size: 0.4rem;
		font-weight: 900;
		letter-spacing: 0.12em;
		color: var(--text-primary);
	}
	.tile-header.active .tile-label {
		color: var(--base);
	}

	.tile-lock {
		font-family: var(--mono);
		font-size: 0.35rem;
		color: var(--text-secondary);
	}

	.tile-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: 0.25rem 0.35rem;
	}

	.tile-full-label {
		font-family: var(--mono);
		font-size: 0.3rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--text-secondary);
	}

	.tile-stat {
		font-family: var(--mono);
		font-size: 0.55rem;
		font-weight: 900;
		letter-spacing: 0.05em;
		color: var(--tile-color);
		margin-top: 0.1rem;
	}

	.tile-footer {
		display: flex;
		justify-content: space-between;
		padding: 0.1rem 0.35rem 0.15rem;
		border-top: 1px solid var(--border);
	}

	.tile-count {
		font-family: var(--mono);
		font-size: 0.3rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--text-secondary);
	}

	.tile-tier {
		font-family: var(--mono);
		font-size: 0.3rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--tile-color);
	}
	.content-tile:not(.active) .tile-tier {
		color: var(--text-secondary);
	}

	/* ─── Desktop adaptations ─── */
	@media (min-width: 768px) {
		.header-strip { display: none; }
		.ring-container { width: 420px; height: 420px; }
		.go-btn { width: 130px; height: 130px; }
		.go-text { font-size: 2rem; }
		.bottom-section { padding: 0 2rem; padding-bottom: 1.5rem; }
		.telemetry-strip { margin: 0.5rem 2rem 0; }
	}
</style>
