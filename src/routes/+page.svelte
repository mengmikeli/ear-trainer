<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { loadStateV4 } from '$lib/state/storage';
	import { aggregateStats, getStatsByKind } from '$lib/state/stats';
	import { warmUpAudio } from '$lib/audio/context';
	import { VERSION_STRING } from '$lib/version';
	import type { UserStateV4 } from '$lib/state/schema';
	import LissajousRing from '../components/LissajousRing.svelte';

	let state: UserStateV4 | null = $state(null);
	let goGlitching = $state(false);
	let goText = $state('GO');
	let versionCopied = $state(false);
	let booted = $state(false);
	let titleChars: string[] = $state([]);
	let bootPhase = $state(0); // 0=glitch, 1=resolving, 2=done

	const TITLE_TEXT = 'LISSA';
	const glitchChars = ['\uE000', '\uE001', '\uE002', '\uE003', '\uE004', '\uE005', '\uE006', '\uE007', '\uE008', '\uE010', '\uE013', '\uE014', '\uE017'];

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

	// --- Stats derivations ---
	const overallAccuracy = $derived(() => {
		if (!state) return 0;
		const entries = [
			...getStatsByKind(state.stats, 'interval'),
			...getStatsByKind(state.stats, 'chord'),
			...getStatsByKind(state.stats, 'scale'),
			...getStatsByKind(state.stats, 'mode'),
		];
		const agg = aggregateStats(entries);
		return agg.attempts > 0 ? Math.round(agg.accuracy * 100) : 0;
	});

	const totalQuestions = $derived(() => {
		if (!state) return 0;
		return state.globalStats.totalQuestions;
	});

	function handleGo(e: Event) {
		e.preventDefault();
		warmUpAudio();
		if (goGlitching) return;
		goGlitching = true;
		let tick = 0;
		const iv = setInterval(() => {
			goText = glitchChars[Math.floor(Math.random() * glitchChars.length)];
			tick++;
			if (tick >= 6) {
				clearInterval(iv);
				goto(`${base}/quiz`);
			}
		}, 50);
	}
</script>

<div class="home" class:booted>
	<!-- ═══ BAND 1: Header strip ═══ -->
	<header class="header-strip">
		<div class="title-boot">
			<h1 class="title">
				{#each titleChars as char, i}
					<span class="char" class:resolved={bootPhase >= 2 || (bootPhase === 1 && char === TITLE_TEXT[i])} class:space={TITLE_TEXT[i] === ' '}>{char}</span>
				{/each}
			</h1>
			<span class="title-sub">EAR TRAINING</span>
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
				href="{base}/quiz"
				class="go-btn"
				class:glitching={goGlitching}
				onclick={handleGo}
			>
				<span class="go-text">{goText}</span>
			</a>
		</div>
	{/if}
</div>

<style>
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

	/* ─── BAND 1: Header ─── */
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

	.title-sub {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 400;
		letter-spacing: 0.2em;
		color: var(--accent);
		opacity: 0.6;
		text-align: center;
		margin-top: 0.15rem;
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
		color: var(--accent);
		border: 1px solid var(--accent);
		padding: 0 0.3rem;
		line-height: 1.6;
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
		border-color: var(--accent);
		opacity: 0.25;
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
		color: var(--accent);
		opacity: 0.2;
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

	/* ─── Desktop adaptations ─── */
	@media (min-width: 768px) {
		.header-strip { display: none; }
		.ring-container { width: 420px; height: 420px; }
		.go-btn { width: 130px; height: 130px; }
		.go-text { font-size: 2rem; }
		.telemetry-strip { margin: 0.5rem 2rem 0; }
	}
</style>
