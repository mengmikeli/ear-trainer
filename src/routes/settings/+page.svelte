<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { base } from '$app/paths';
	import { loadStateV4, saveStateV4 } from '$lib/state/storage';
	import { createDefaultStateV4 } from '$lib/state/defaults';
	import type { UserStateV4 } from '$lib/state/schema';
	import type { ToneType, SessionLength, ThemeMode } from '$lib/state/schema';
	import { applyTheme, watchSystemTheme } from '$lib/theme';
	import { playInterval } from '$lib/audio/playback';
	import { APP_VERSION, VERSION_STRING, RELEASE_NOTES } from '$lib/version';

	let showReleaseNotes = $state(false);
	let versionCopied = $state(false);

	let state: UserStateV4 | null = $state(null);

	// Long-press reset
	let holdProgress = $state(0);
	let holdActive = $state(false);
	let holdStart = 0;
	let holdRaf: number | null = null;
	let resetDone = $state(false);
	const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
	let glitchText = $state('RESET PROGRESS');
	let glitchInterval: ReturnType<typeof setInterval> | null = null;
	let systemThemeCleanup: (() => void) | undefined;

	// Long-press lab
	let labHoldProgress = $state(0);
	let labHoldActive = $state(false);
	let labHoldStart = 0;
	let labHoldRaf: number | null = null;
	let labDone = $state(false);
	let labGlitchText = $state('ENTER VIZ LAB');
	let labGlitchInterval: ReturnType<typeof setInterval> | null = null;

	// Long-press training
	let trainHoldProgress = $state(0);
	let trainHoldActive = $state(false);
	let trainHoldStart = 0;
	let trainHoldRaf: number | null = null;
	let trainDone = $state(false);
	let trainGlitchText = $state('ENTER TRAINING');
	let trainGlitchInterval: ReturnType<typeof setInterval> | null = null;

	// Long-press onboarding
	let onboardHoldProgress = $state(0);
	let onboardHoldActive = $state(false);
	let onboardHoldStart = 0;
	let onboardHoldRaf: number | null = null;
	let onboardDone = $state(false);
	let onboardGlitchText = $state('ENTER ONBOARDING');
	let onboardGlitchInterval: ReturnType<typeof setInterval> | null = null;

	const holdDuration = 3500; // 3.5s hold to confirm
	const baseText = 'RESET PROGRESS';
	const glyphs = ['\uE000', '\uE001', '\uE002', '\uE003', '\uE004', '\uE005', '\uE006', '\uE007', '\uE008', '\uE010', '\uE011', '\uE012', '\uE013', '\uE014', '\uE015', '\uE016', '\uE017', '\uE018', '\uE019'];

	function randomGlitchText(): string {
		const chars = [...baseText];
		const maxGlitch = Math.max(1, Math.ceil(holdProgress * chars.length * 0.6));
		const count = 1 + Math.floor(Math.random() * Math.min(maxGlitch, chars.length));
		for (let i = 0; i < count; i++) {
			const idx = Math.floor(Math.random() * chars.length);
			chars[idx] = glyphs[Math.floor(Math.random() * glyphs.length)];
		}
		return chars.join('');
	}

	onMount(() => {
		state = loadStateV4();
		if (state) {
			systemThemeCleanup = watchSystemTheme(state.settings.theme, () => applyTheme('system'));
		}
	});

	onDestroy(() => {
		cancelHold();
		cancelLabHold();
		cancelTrainHold();
		cancelOnboardHold();
		systemThemeCleanup?.();
	});

	function update() {
		if (state) saveStateV4(state);
	}

	function previewTone(tone: ToneType) {
		if (!state) return;
		state.settings.toneType = tone;
		update();
		// Play a P5 ascending as preview
		playInterval(60, 7, 'ascending', tone);
	}

	function startHold() {
		if (resetDone) return;
		holdActive = true;
		holdStart = performance.now();
		holdProgress = 0;
		glitchInterval = setInterval(() => {
			glitchText = randomGlitchText();
		}, 60);
		holdRaf = requestAnimationFrame(tickHold);
	}

	function tickHold(now: number) {
		const elapsed = now - holdStart;
		const linear = Math.min(1, elapsed / holdDuration);
		// ease-out cubic: fast start, slows near end
		holdProgress = 1 - Math.pow(1 - linear, 3);
		if (linear >= 1) {
			executeReset();
			return;
		}
		holdRaf = requestAnimationFrame(tickHold);
	}

	function cancelHold() {
		holdActive = false;
		holdProgress = 0;
		glitchText = 'RESET PROGRESS';
		if (holdRaf) { cancelAnimationFrame(holdRaf); holdRaf = null; }
		if (glitchInterval) { clearInterval(glitchInterval); glitchInterval = null; }
	}

	function executeReset() {
		holdActive = false;
		if (holdRaf) { cancelAnimationFrame(holdRaf); holdRaf = null; }
		if (glitchInterval) { clearInterval(glitchInterval); glitchInterval = null; }

		const fresh = createDefaultStateV4();
		if (state) fresh.settings = state.settings;
		state = fresh;
		saveStateV4(state);

		resetDone = true;
		glitchText = '\uE018 RESET \uE018';
		holdProgress = 1;
		setTimeout(() => {
			resetDone = false;
			holdProgress = 0;
			glitchText = 'RESET PROGRESS';
		}, 2000);
	}

	// Lab long-press functions
	const labHoldDuration = 2000;

	function labRandomGlitchText(): string {
		const base = 'ENTER VIZ LAB';
		const chars = [...base];
		const maxGlitch = Math.max(1, Math.ceil(labHoldProgress * chars.length * 0.6));
		const count = 1 + Math.floor(Math.random() * Math.min(maxGlitch, chars.length));
		for (let i = 0; i < count; i++) {
			const idx = Math.floor(Math.random() * chars.length);
			chars[idx] = glyphs[Math.floor(Math.random() * glyphs.length)];
		}
		return chars.join('');
	}

	function startLabHold() {
		if (labDone) return;
		labHoldActive = true;
		labHoldStart = performance.now();
		labHoldProgress = 0;
		labGlitchInterval = setInterval(() => {
			labGlitchText = labRandomGlitchText();
		}, 60);
		labHoldRaf = requestAnimationFrame(tickLabHold);
	}

	function tickLabHold(now: number) {
		const elapsed = now - labHoldStart;
		const linear = Math.min(1, elapsed / labHoldDuration);
		labHoldProgress = 1 - Math.pow(1 - linear, 3);
		if (linear >= 1) {
			executeLabEnter();
			return;
		}
		labHoldRaf = requestAnimationFrame(tickLabHold);
	}

	function cancelLabHold() {
		labHoldActive = false;
		labHoldProgress = 0;
		labGlitchText = 'ENTER VIZ LAB';
		if (labHoldRaf) { cancelAnimationFrame(labHoldRaf); labHoldRaf = null; }
		if (labGlitchInterval) { clearInterval(labGlitchInterval); labGlitchInterval = null; }
	}

	function executeLabEnter() {
		labHoldActive = false;
		if (labHoldRaf) { cancelAnimationFrame(labHoldRaf); labHoldRaf = null; }
		if (labGlitchInterval) { clearInterval(labGlitchInterval); labGlitchInterval = null; }

		labDone = true;
		labGlitchText = '\uE018 VIZ LAB \uE018';
		labHoldProgress = 1;
		setTimeout(() => {
			window.location.href = `${base}/lab`;
		}, 500);
	}

	// Training long-press functions
	const trainHoldDuration = 2000;

	function trainRandomGlitchText(): string {
		const txt = 'ENTER TRAINING';
		const chars = [...txt];
		const maxGlitch = Math.max(1, Math.ceil(trainHoldProgress * chars.length * 0.6));
		const count = 1 + Math.floor(Math.random() * Math.min(maxGlitch, chars.length));
		for (let i = 0; i < count; i++) {
			const idx = Math.floor(Math.random() * chars.length);
			chars[idx] = glyphs[Math.floor(Math.random() * glyphs.length)];
		}
		return chars.join('');
	}

	function startTrainHold() {
		if (trainDone) return;
		trainHoldActive = true;
		trainHoldStart = performance.now();
		trainHoldProgress = 0;
		trainGlitchInterval = setInterval(() => {
			trainGlitchText = trainRandomGlitchText();
		}, 60);
		trainHoldRaf = requestAnimationFrame(tickTrainHold);
	}

	function tickTrainHold(now: number) {
		const elapsed = now - trainHoldStart;
		const linear = Math.min(1, elapsed / trainHoldDuration);
		trainHoldProgress = 1 - Math.pow(1 - linear, 3);
		if (linear >= 1) {
			executeTrainEnter();
			return;
		}
		trainHoldRaf = requestAnimationFrame(tickTrainHold);
	}

	function cancelTrainHold() {
		trainHoldActive = false;
		trainHoldProgress = 0;
		trainGlitchText = 'ENTER TRAINING';
		if (trainHoldRaf) { cancelAnimationFrame(trainHoldRaf); trainHoldRaf = null; }
		if (trainGlitchInterval) { clearInterval(trainGlitchInterval); trainGlitchInterval = null; }
	}

	function executeTrainEnter() {
		trainHoldActive = false;
		if (trainHoldRaf) { cancelAnimationFrame(trainHoldRaf); trainHoldRaf = null; }
		if (trainGlitchInterval) { clearInterval(trainGlitchInterval); trainGlitchInterval = null; }

		trainDone = true;
		trainGlitchText = '\uE018 TRAIN \uE018';
		trainHoldProgress = 1;
		setTimeout(() => {
			window.location.href = `${base}/quiz`;
		}, 500);
	}

	// Onboarding long-press functions
	const onboardHoldDuration = 2000;

	function onboardRandomGlitchText(): string {
		const txt = 'ENTER ONBOARDING';
		const chars = [...txt];
		const maxGlitch = Math.max(1, Math.ceil(onboardHoldProgress * chars.length * 0.6));
		const count = 1 + Math.floor(Math.random() * Math.min(maxGlitch, chars.length));
		for (let i = 0; i < count; i++) {
			const idx = Math.floor(Math.random() * chars.length);
			chars[idx] = glyphs[Math.floor(Math.random() * glyphs.length)];
		}
		return chars.join('');
	}

	function startOnboardHold() {
		if (onboardDone) return;
		onboardHoldActive = true;
		onboardHoldStart = performance.now();
		onboardHoldProgress = 0;
		onboardGlitchInterval = setInterval(() => {
			onboardGlitchText = onboardRandomGlitchText();
		}, 60);
		onboardHoldRaf = requestAnimationFrame(tickOnboardHold);
	}

	function tickOnboardHold(now: number) {
		const elapsed = now - onboardHoldStart;
		const linear = Math.min(1, elapsed / onboardHoldDuration);
		onboardHoldProgress = 1 - Math.pow(1 - linear, 3);
		if (linear >= 1) {
			executeOnboardEnter();
			return;
		}
		onboardHoldRaf = requestAnimationFrame(tickOnboardHold);
	}

	function cancelOnboardHold() {
		onboardHoldActive = false;
		onboardHoldProgress = 0;
		onboardGlitchText = 'ENTER ONBOARDING';
		if (onboardHoldRaf) { cancelAnimationFrame(onboardHoldRaf); onboardHoldRaf = null; }
		if (onboardGlitchInterval) { clearInterval(onboardGlitchInterval); onboardGlitchInterval = null; }
	}

	function executeOnboardEnter() {
		onboardHoldActive = false;
		if (onboardHoldRaf) { cancelAnimationFrame(onboardHoldRaf); onboardHoldRaf = null; }
		if (onboardGlitchInterval) { clearInterval(onboardGlitchInterval); onboardGlitchInterval = null; }

		onboardDone = true;
		onboardGlitchText = '\uE018 ONBOARD \uE018';
		onboardHoldProgress = 1;
		setTimeout(() => {
			window.location.href = `${base}/quiz?onboard=1`;
		}, 500);
	}
</script>

<div class="settings-page">
	<h2 class="heading">SETTINGS</h2>

	{#if state}
		<div class="section">
			<label class="field-label">THEME</label>
			<div class="toggle-group">
				{#each ['dark', 'light', 'system'] as t}
					<button class:active={state.settings.theme === t}
						onclick={() => {
							state!.settings.theme = t as ThemeMode;
							applyTheme(t as ThemeMode);
							systemThemeCleanup?.();
							systemThemeCleanup = watchSystemTheme(t as ThemeMode, () => applyTheme('system'));
							update();
						}}>
						{t.toUpperCase()}
					</button>
				{/each}
			</div>
		</div>

		<div class="section">
			<label class="field-label">TONE TYPE</label>
			<div class="toggle-group">
				<button class:active={state.settings.toneType === 'epiano'}
					onclick={() => previewTone('epiano')}>WARM</button>
				<button class:active={state.settings.toneType === 'sine'}
					onclick={() => previewTone('sine')}>CLEAN</button>
				<button class:active={state.settings.toneType === 'piano'}
					onclick={() => previewTone('piano')}>AMBIENT</button>
			</div>
		</div>

		<div class="section">
			<label class="field-label">PLAY MODES</label>
			<div class="toggle-group">
				<button class:active={state.settings.enabledModes.ascending}
					onclick={() => {
						const m = state!.settings.enabledModes;
						const activeCount = +m.ascending + +m.descending + +m.harmonic;
						if (m.ascending && activeCount <= 1) return;
						m.ascending = !m.ascending;
						update();
					}}>{'\uE007'} ASC</button>
				<button class:active={state.settings.enabledModes.descending}
					onclick={() => {
						const m = state!.settings.enabledModes;
						const activeCount = +m.ascending + +m.descending + +m.harmonic;
						if (m.descending && activeCount <= 1) return;
						m.descending = !m.descending;
						update();
					}}>{'\uE008'} DESC</button>
				<button class:active={state.settings.enabledModes.harmonic}
					onclick={() => {
						const m = state!.settings.enabledModes;
						const activeCount = +m.ascending + +m.descending + +m.harmonic;
						if (m.harmonic && activeCount <= 1) return;
						m.harmonic = !m.harmonic;
						update();
					}}>{'\uE000'} HARM</button>
			</div>
		</div>

		<div class="section">
			<label class="field-label">CHORD VOICINGS</label>
			<div class="toggle-group">
				<button class:active={state.settings.enabledVoicings.root}
					onclick={() => {
						const v = state!.settings.enabledVoicings;
						const activeCount = +v.root + +v.first + +v.second;
						if (v.root && activeCount <= 1) return;
						v.root = !v.root;
						update();
					}}>ROOT</button>
				<button class:active={state.settings.enabledVoicings.first}
					onclick={() => {
						const v = state!.settings.enabledVoicings;
						const activeCount = +v.root + +v.first + +v.second;
						if (v.first && activeCount <= 1) return;
						v.first = !v.first;
						update();
					}}>INV1</button>
				<button class:active={state.settings.enabledVoicings.second}
					onclick={() => {
						const v = state!.settings.enabledVoicings;
						const activeCount = +v.root + +v.first + +v.second;
						if (v.second && activeCount <= 1) return;
						v.second = !v.second;
						update();
					}}>INV2</button>
			</div>
		</div>

		<div class="section">
			<label class="field-label">SESSION LENGTH</label>
			<div class="toggle-group">
				{#each [10, 20, 30] as len}
					<button class:active={state.settings.sessionLength === len}
						onclick={() => { state!.settings.sessionLength = len as SessionLength; update(); }}>
						{len}
					</button>
				{/each}
			</div>
		</div>

		<div class="section danger">
			<label class="field-label">DANGER ZONE</label>

			<div class="dev-toggle-row">
				<span class="dev-label">DEV MODE</span>
				<button class="dev-btn" class:active={state.settings.devMode}
					onclick={() => {
						state!.settings.devMode = !state!.settings.devMode;
						update();
					}}>
					{state.settings.devMode ? 'ON' : 'OFF'}
				</button>
			</div>

			{#if state.settings.devMode}
			<div class="dev-toggle-row">
				<span class="dev-label" style="color: var(--marathon-blue)">SUPERCHARGE VIZ</span>
				<button class="dev-btn supercharge" class:active={state.settings.superchargeViz ?? !isMobile}
					onclick={() => {
						state!.settings.superchargeViz = !(state!.settings.superchargeViz ?? !isMobile);
						update();
					}}>
					{(state.settings.superchargeViz ?? !isMobile) ? 'ON' : 'OFF'}
				</button>
			</div>
				<button
					class="lab-btn"
					class:holding={labHoldActive}
					class:done={labDone}
					onpointerdown={startLabHold}
					onpointerup={cancelLabHold}
					onpointerleave={cancelLabHold}
					oncontextmenu={(e) => e.preventDefault()}
				>
					<div class="lab-fill" style="transform: scaleX({labHoldProgress})"></div>
					<span class="lab-text" class:glitching={labHoldActive}>{labGlitchText}</span>
				</button>

				<button
					class="train-btn"
					class:holding={trainHoldActive}
					class:done={trainDone}
					onpointerdown={startTrainHold}
					onpointerup={cancelTrainHold}
					onpointerleave={cancelTrainHold}
					oncontextmenu={(e) => e.preventDefault()}
				>
					<div class="train-fill" style="transform: scaleX({trainHoldProgress})"></div>
					<span class="train-text" class:glitching={trainHoldActive}>{trainGlitchText}</span>
				</button>

				<button
					class="onboard-btn"
					class:holding={onboardHoldActive}
					class:done={onboardDone}
					onpointerdown={startOnboardHold}
					onpointerup={cancelOnboardHold}
					onpointerleave={cancelOnboardHold}
					oncontextmenu={(e) => e.preventDefault()}
				>
					<div class="onboard-fill" style="transform: scaleX({onboardHoldProgress})"></div>
					<span class="onboard-text" class:glitching={onboardHoldActive}>{onboardGlitchText}</span>
				</button>

			{/if}

			<button
				class="reset-btn"
				class:holding={holdActive}
				class:done={resetDone}
				onpointerdown={startHold}
				onpointerup={cancelHold}
				onpointerleave={cancelHold}
				oncontextmenu={(e) => e.preventDefault()}
			>
				<div class="reset-fill" style="transform: scaleX({holdProgress})"></div>
				<span class="reset-text" class:glitching={holdActive}>{glitchText}</span>
			</button>
		</div>

		<div class="section version-section">
			<label class="field-label">ABOUT</label>
			<div class="version-row">
				<button class="version-copy" onclick={(e) => {
					e.stopPropagation();
					navigator.clipboard.writeText(VERSION_STRING);
					versionCopied = true;
					setTimeout(() => { versionCopied = false; }, 1500);
				}}>
					<span class="version-label" class:copied={versionCopied}>{VERSION_STRING}</span>
				</button>
				<button class="version-btn" onclick={() => showReleaseNotes = !showReleaseNotes}>
					<span class="version-toggle" class:open={showReleaseNotes}>{showReleaseNotes ? '^' : '>'}</span>
				</button>
			</div>

			{#if showReleaseNotes}
				<div class="release-notes">
					{#each RELEASE_NOTES as note}
						<div class="release">
							<div class="release-header">
								<span class="release-version">v{note.version}</span>
								<span class="release-date">{note.date}</span>
							</div>
							<div class="release-title">{note.title}</div>
							<ul class="release-changes">
								{#each note.changes as change}
									<li>{change}</li>
								{/each}
							</ul>
						</div>
					{/each}
				</div>
			{/if}

			<div class="credits">
				<div class="credits-header">TEAM</div>
				<div class="credits-grid">
					<div class="credit-entry">
						<span class="credit-emoji">🧑‍💻</span>
						<div class="credit-info">
							<span class="credit-name">MIKE</span>
							<span class="credit-role">Creator · The Only Human</span>
						</div>
					</div>
					<div class="credit-entry">
						<span class="credit-emoji">🗝️</span>
						<div class="credit-info">
							<span class="credit-name">MOTO</span>
							<span class="credit-role">Lead · Architecture · Sprint Ops</span>
						</div>
					</div>
					<div class="credit-entry">
						<span class="credit-emoji">🌉</span>
						<div class="credit-info">
							<span class="credit-name">PIXI</span>
							<span class="credit-role">Design · Learning Systems · UI</span>
						</div>
					</div>
					<div class="credit-entry">
						<span class="credit-emoji">🇫🇮</span>
						<div class="credit-info">
							<span class="credit-name">NOKI</span>
							<span class="credit-role">Visualization · Chladni · Lissajous</span>
						</div>
					</div>
					<div class="credit-entry">
						<span class="credit-emoji">🌴</span>
						<div class="credit-info">
							<span class="credit-name">PALM</span>
							<span class="credit-role">QA · Testing · Visual Regression</span>
						</div>
					</div>
				</div>
				<div class="credits-footer">
					Built with <span class="credits-accent">OpenClaw</span> · Human-directed, agent-built
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.settings-page { display: flex; flex-direction: column; gap: 1.5rem; }
	.data-readout {
		font-family: var(--mono); font-size: 0.45rem;
		color: var(--marathon-blue); opacity: 0.3;
		letter-spacing: 0.3em; text-align: center;
		margin-top: -0.5rem;
	}
	.heading {
		font-size: 3rem; font-weight: 400;
		letter-spacing: 0.12em; color: var(--text-primary);
		padding-bottom: 0.5rem; border-bottom: 2px solid var(--border-heavy);
		text-transform: uppercase; font-family: var(--font-display);
	}
	.section { display: flex; flex-direction: column; gap: 0.5rem; }
	.field-label {
		font-size: 0.6rem; font-weight: 400;
		letter-spacing: 0.25em; color: var(--text-primary);
		font-family: var(--font-display);
	}
	.toggle-group { display: flex; gap: 0.5rem; }
	.toggle-group button {
		flex: 1; padding: 0.85rem;
		background: var(--surface); border: 1px solid var(--border-heavy);
		border-radius: 0; font-size: 0.45rem;
		font-weight: 400; letter-spacing: 0.08em;
		color: var(--text-secondary);
		transition: all 0.15s;
		font-family: var(--mono);
	}
	.toggle-group button.active {
		border-color: var(--marathon-blue); color: var(--marathon-blue);
		background: #3A2CFF10;
	}
	.danger { margin-top: 2rem; }
	.reset-btn {
		position: relative;
		overflow: hidden;
		padding: 0.85rem; background: var(--surface);
		border: 1px solid var(--hot); border-radius: 0;
		color: var(--hot); font-size: 0.45rem;
		font-weight: 400; letter-spacing: 0.08em;
		font-family: var(--mono);
		width: 100%;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}
	.reset-fill {
		position: absolute;
		inset: 0;
		background: var(--hot);
		transform-origin: left;
		transform: scaleX(0);
		transition: none;
		pointer-events: none;
		opacity: 0.35;
	}
	.reset-text {
		position: relative;
		z-index: 1;
	}
	.glitching {
		animation: reset-shake 60ms infinite;
	}
	.reset-btn.done {
		border-color: var(--correct);
		color: var(--correct);
	}
	.reset-btn.done .reset-fill {
		background: var(--correct);
		opacity: 0.35;
	}
	.dev-toggle-row {
		display: flex; align-items: center; justify-content: space-between;
		padding: 0.6rem 0.85rem;
		background: var(--surface);
		border: 1px solid var(--border);
		margin-bottom: 0.5rem;
	}
	.dev-label {
		font-family: var(--mono); font-size: 0.45rem;
		font-weight: 900; letter-spacing: 0.1em;
		color: var(--hot);
	}
	.dev-btn {
		font-family: var(--mono); font-size: 0.4rem;
		font-weight: 900; letter-spacing: 0.08em;
		padding: 0.25rem 0.6rem;
		border: 1px solid var(--hot);
		background: transparent;
		color: var(--hot);
		cursor: pointer;
	}
	.dev-btn.reset-learn {
		border-color: var(--marathon-blue);
		color: var(--marathon-blue);
		margin-top: 0.5rem;
		padding: 0.4rem 0.8rem;
	}
	.dev-btn.reset-learn:active {
		background: var(--marathon-blue);
		color: var(--base);
	}
	.dev-btn.active {
		background: var(--hot);
		color: var(--base);
	}
	.dev-btn.supercharge {
		border-color: var(--marathon-blue);
		color: var(--marathon-blue);
	}
	.dev-btn.supercharge.active {
		background: var(--marathon-blue);
		color: var(--base);
	}
	.dev-link {
		display: block;
		font-family: var(--mono); font-size: 0.4rem;
		font-weight: 900; letter-spacing: 0.1em;
		color: var(--marathon-blue);
		text-decoration: none;
		padding: 0.5rem 0.85rem;
		border: 1px solid var(--marathon-blue);
		margin-bottom: 0.5rem;
		text-align: center;
	}
	.lab-btn {
		position: relative;
		overflow: hidden;
		padding: 0.85rem; background: var(--surface);
		border: 1px solid var(--correct); border-radius: 0;
		color: var(--correct); font-size: 0.45rem;
		font-weight: 400; letter-spacing: 0.08em;
		font-family: var(--mono);
		width: 100%;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		margin-bottom: 0.5rem;
	}
	.lab-fill {
		position: absolute;
		inset: 0;
		background: var(--correct);
		transform-origin: left;
		transform: scaleX(0);
		transition: none;
		pointer-events: none;
		opacity: 0.35;
	}
	.lab-text {
		position: relative;
		z-index: 1;
	}
	.lab-btn.done {
		border-color: var(--correct);
		color: var(--correct);
	}
	.lab-btn.done .lab-fill {
		background: var(--correct);
		opacity: 0.35;
	}
	.train-btn {
		position: relative;
		overflow: hidden;
		padding: 0.85rem; background: var(--surface);
		border: 1px solid var(--marathon-blue); border-radius: 0;
		color: var(--marathon-blue); font-size: 0.45rem;
		font-weight: 400; letter-spacing: 0.08em;
		font-family: var(--mono);
		width: 100%;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		margin-bottom: 0.5rem;
	}
	.train-fill {
		position: absolute;
		inset: 0;
		background: var(--marathon-blue);
		transform-origin: left;
		transform: scaleX(0);
		transition: none;
		pointer-events: none;
		opacity: 0.35;
	}
	.train-text {
		position: relative;
		z-index: 1;
	}
	.train-btn.done {
		border-color: var(--marathon-blue);
		color: var(--marathon-blue);
	}
	.train-btn.done .train-fill {
		background: var(--marathon-blue);
		opacity: 0.35;
	}
	.onboard-btn {
		position: relative;
		overflow: hidden;
		padding: 0.85rem; background: var(--surface);
		border: 1px solid var(--marathon-blue); border-radius: 0;
		color: var(--marathon-blue); font-size: 0.45rem;
		font-weight: 400; letter-spacing: 0.08em;
		font-family: var(--mono);
		width: 100%;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		margin-bottom: 0.5rem;
	}
	.onboard-fill {
		position: absolute;
		inset: 0;
		background: var(--marathon-blue);
		transform-origin: left;
		transform: scaleX(0);
		transition: none;
		pointer-events: none;
		opacity: 0.35;
	}
	.onboard-text {
		position: relative;
		z-index: 1;
	}
	.onboard-btn.done {
		border-color: var(--marathon-blue);
		color: var(--marathon-blue);
	}
	.onboard-btn.done .onboard-fill {
		background: var(--marathon-blue);
		opacity: 0.35;
	}
	@keyframes reset-shake {
		0% { transform: translate(0); }
		25% { transform: translate(-1px, 1px); }
		50% { transform: translate(1px, -1px); }
		75% { transform: translate(-1px, -1px); }
		100% { transform: translate(0); }
	}

	/* Version + Release Notes */
	.version-section { margin-top: 1rem; }
	.version-row {
		display: flex; gap: 0;
	}
	.version-copy {
		flex: 1;
		display: flex; align-items: center;
		padding: 0.6rem 0.85rem;
		background: var(--surface); border: 1px solid var(--border);
		border-right: none;
		color: var(--text-secondary); font-size: 0.45rem;
		font-family: var(--mono); letter-spacing: 0.08em;
		cursor: pointer;
		transition: color 0.15s;
	}
	.version-copy:active { color: var(--accent); }
	.version-btn {
		display: flex; align-items: center; justify-content: center;
		padding: 0.6rem 0.85rem;
		background: var(--surface); border: 1px solid var(--border);
		color: var(--text-secondary); font-size: 0.45rem;
		font-family: var(--mono); letter-spacing: 0.08em;
		cursor: pointer;
	}
	.version-label { color: var(--marathon-blue); transition: color 0.15s; }
	.version-label.copied { color: var(--correct); }
	.version-toggle { font-size: 0.45rem; display: inline-block; transition: transform 0.15s; }
	.version-toggle.open { transform: rotate(180deg); }
	.release-notes {
		display: flex; flex-direction: column; gap: 1rem;
		margin-top: 0.75rem;
		padding: 0.75rem;
		border: 1px solid var(--border);
		background: var(--surface);
	}
	.release { }
	.release-header {
		display: flex; justify-content: space-between; align-items: center;
		margin-bottom: 0.25rem;
	}
	.release-version {
		font-family: var(--mono); font-size: 0.5rem;
		color: var(--accent); font-weight: 700;
	}
	.release-date {
		font-family: var(--mono); font-size: 0.4rem;
		color: var(--text-secondary);
	}
	.release-title {
		font-family: var(--font-display); font-size: 0.7rem;
		color: var(--text-primary); letter-spacing: 0.1em;
		margin-bottom: 0.35rem;
	}
	.release-changes {
		list-style: none; padding: 0;
		display: flex; flex-direction: column; gap: 0.2rem;
	}
	.release-changes li {
		font-family: var(--mono); font-size: 0.35rem;
		color: var(--text-secondary); line-height: 1.5;
		padding-left: 0.75rem;
		position: relative;
	}
	.release-changes li::before {
		content: '›';
		position: absolute; left: 0;
		color: var(--border-heavy);
	}
	.release + .release {
		border-top: 1px solid var(--border);
		padding-top: 1rem;
	}

	/* Credits */
	.credits {
		margin-top: 0.75rem;
		padding: 0.75rem;
		border: 1px solid var(--border);
		background: var(--surface);
		display: flex; flex-direction: column; gap: 0.75rem;
	}
	.credits-header {
		font-family: var(--font-display); font-size: 0.6rem;
		letter-spacing: 0.25em; color: var(--text-secondary);
	}
	.credits-grid {
		display: flex; flex-direction: column; gap: 0.5rem;
	}
	.credit-entry {
		display: flex; align-items: center; gap: 0.6rem;
		padding: 0.4rem 0;
		border-bottom: 1px solid var(--border);
	}
	.credit-entry:last-child { border-bottom: none; }
	.credit-emoji { font-size: 0.8rem; width: 1.2rem; text-align: center; }
	.credit-info {
		display: flex; flex-direction: column; gap: 0.1rem;
	}
	.credit-name {
		font-family: var(--font-display); font-size: 0.55rem;
		letter-spacing: 0.15em; color: var(--text-primary);
		font-weight: 700;
	}
	.credit-role {
		font-family: var(--mono); font-size: 0.35rem;
		letter-spacing: 0.06em; color: var(--text-secondary);
	}
	.credits-footer {
		font-family: var(--mono); font-size: 0.3rem;
		letter-spacing: 0.08em; color: var(--text-secondary);
		text-align: center; padding-top: 0.25rem;
		border-top: 1px solid var(--border);
	}
	.credits-accent { color: var(--marathon-blue); }

	/* Desktop: constrained width, larger type */
	@media (min-width: 768px) {
		.settings-page { max-width: 600px; margin: 0 auto; }
		.heading { font-size: 3.5rem; }
		.credits-grid {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			gap: 0.5rem;
		}
	}
</style>
