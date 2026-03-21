<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { loadState, saveState, createDefaultState } from '$lib/state';
	import type { UserState, ToneType, Direction, SessionLength } from '$lib/types';

	let state: UserState | null = $state(null);

	// Long-press reset
	let holdProgress = $state(0);
	let holdActive = $state(false);
	let holdStart = 0;
	let holdRaf: number | null = null;
	let resetDone = $state(false);
	let glitchText = $state('RESET PROGRESS');
	let glitchInterval: ReturnType<typeof setInterval> | null = null;

	const holdDuration = 2000; // 2s hold to confirm
	const baseText = 'RESET PROGRESS';
	const glyphs = ['\uE000', '\uE001', '\uE002', '\uE003', '\uE004', '\uE005', '\uE006', '\uE007', '\uE008', '\uE010', '\uE011', '\uE012', '\uE013', '\uE014', '\uE015', '\uE016', '\uE017', '\uE018', '\uE019'];

	function randomGlitchText(): string {
		const chars = [...baseText];
		const count = 1 + Math.floor(Math.random() * 2); // 1 or 2 chars
		for (let i = 0; i < count; i++) {
			const idx = Math.floor(Math.random() * chars.length);
			chars[idx] = glyphs[Math.floor(Math.random() * glyphs.length)];
		}
		return chars.join('');
	}

	onMount(() => {
		state = loadState();
	});

	onDestroy(() => {
		cancelHold();
	});

	function update() {
		if (state) saveState(state);
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
		holdProgress = Math.min(1, elapsed / holdDuration);
		if (holdProgress >= 1) {
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

		const fresh = createDefaultState();
		if (state) fresh.settings = state.settings;
		state = fresh;
		saveState(state);

		resetDone = true;
		glitchText = '\uE018 RESET \uE018';
		holdProgress = 1;
		setTimeout(() => {
			resetDone = false;
			holdProgress = 0;
			glitchText = 'RESET PROGRESS';
		}, 2000);
	}
</script>

<div class="settings-page">
	<h2 class="heading">SETTINGS</h2>

	{#if state}
		<div class="section">
			<label class="field-label">TONE TYPE</label>
			<div class="toggle-group">
				<button class:active={state.settings.toneType === 'sine'}
					onclick={() => { state!.settings.toneType = 'sine'; update(); }}>CLEAN</button>
				<button class:active={state.settings.toneType === 'piano'}
					onclick={() => { state!.settings.toneType = 'piano'; update(); }}>AMBIENT</button>
			</div>
		</div>

		<div class="section">
			<label class="field-label">DIRECTION</label>
			<div class="toggle-group">
				{#each ['ascending', 'descending', 'random'] as dir}
					<button class:active={state.settings.direction === dir}
						onclick={() => { state!.settings.direction = dir as Direction; update(); }}>
						{dir.toUpperCase()}
					</button>
				{/each}
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
		letter-spacing: 0.25em; color: var(--text-secondary);
		font-family: var(--font-display);
	}
	.toggle-group { display: flex; gap: 0.5rem; }
	.toggle-group button {
		flex: 1; padding: 0.85rem;
		background: var(--surface); border: 2px solid var(--border-heavy);
		border-radius: 0; font-size: 0.45rem;
		font-weight: 400; letter-spacing: 0.08em;
		color: var(--text-secondary);
		transition: all 0.15s;
		font-family: var(--mono);
	}
	.toggle-group button.active {
		border-color: var(--accent); color: var(--accent);
		background: var(--accent-dim);
	}
	.danger { margin-top: 2rem; }
	.reset-btn {
		position: relative;
		overflow: hidden;
		padding: 0.85rem; background: var(--surface);
		border: 2px solid var(--hot); border-radius: 0;
		color: var(--hot); font-size: 0.75rem;
		font-weight: 400; letter-spacing: 0.12em;
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
	}
	.reset-text {
		position: relative;
		z-index: 1;
	}
	.reset-btn.holding {
		color: var(--base);
	}
	.reset-btn.holding .reset-text {
		text-shadow: -1px 0 var(--accent), 1px 0 var(--hot);
	}
	.glitching {
		animation: reset-shake 60ms infinite;
		letter-spacing: 0.02em;
	}
	.reset-btn.done {
		border-color: var(--correct);
		color: var(--correct);
	}
	.reset-btn.done .reset-fill {
		background: var(--correct);
	}
	.reset-btn.done .reset-text {
		color: var(--base);
		font-family: var(--mono);
	}
	@keyframes reset-shake {
		0% { transform: translate(0); }
		25% { transform: translate(-1px, 1px); }
		50% { transform: translate(1px, -1px); }
		75% { transform: translate(-1px, -1px); }
		100% { transform: translate(0); }
	}
</style>
