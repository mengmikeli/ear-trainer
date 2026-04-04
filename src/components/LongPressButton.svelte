<script lang="ts">
	/**
	 * LongPressButton — shared long-press-to-confirm button with glitch text effect.
	 * Replaces inline implementations in settings page.
	 */
	import { onDestroy } from 'svelte';

	interface Props {
		label: string;
		doneLabel: string;
		duration?: number;
		color?: 'accent' | 'danger' | 'marathon-blue';
		onExecute: () => void;
	}

	let { label, doneLabel, duration = 2000, color = 'accent', onExecute }: Props = $props();

	const glyphs = ['\uE000', '\uE001', '\uE002', '\uE003', '\uE004', '\uE005', '\uE006', '\uE007', '\uE008', '\uE010', '\uE011', '\uE012', '\uE013', '\uE014', '\uE015', '\uE016', '\uE017', '\uE018', '\uE019'];

	let holdProgress = $state(0);
	let holdActive = $state(false);
	let holdStart = 0;
	let holdRaf: number | null = null;
	let done = $state(false);
	let displayText = $state('');
	let glitchInterval: ReturnType<typeof setInterval> | null = null;

	// Keep displayText in sync with label prop when idle
	$effect(() => {
		if (!holdActive && !done) {
			displayText = label;
		}
	});

	function randomGlitchText(): string {
		const chars = [...label];
		const maxGlitch = Math.max(1, Math.ceil(holdProgress * chars.length * 0.6));
		const count = 1 + Math.floor(Math.random() * Math.min(maxGlitch, chars.length));
		for (let i = 0; i < count; i++) {
			const idx = Math.floor(Math.random() * chars.length);
			chars[idx] = glyphs[Math.floor(Math.random() * glyphs.length)];
		}
		return chars.join('');
	}

	function startHold() {
		if (done) return;
		holdActive = true;
		holdStart = performance.now();
		holdProgress = 0;
		glitchInterval = setInterval(() => {
			displayText = randomGlitchText();
		}, 60);
		holdRaf = requestAnimationFrame(tick);
	}

	function tick(now: number) {
		const elapsed = now - holdStart;
		const linear = Math.min(1, elapsed / duration);
		holdProgress = 1 - Math.pow(1 - linear, 3);
		if (linear >= 1) {
			execute();
			return;
		}
		holdRaf = requestAnimationFrame(tick);
	}

	function cancelHold() {
		holdActive = false;
		holdProgress = 0;
		if (holdRaf) { cancelAnimationFrame(holdRaf); holdRaf = null; }
		if (glitchInterval) { clearInterval(glitchInterval); glitchInterval = null; }
	}

	function execute() {
		holdActive = false;
		if (holdRaf) { cancelAnimationFrame(holdRaf); holdRaf = null; }
		if (glitchInterval) { clearInterval(glitchInterval); glitchInterval = null; }

		done = true;
		displayText = doneLabel;
		holdProgress = 1;

		onExecute();

		setTimeout(() => {
			done = false;
			holdProgress = 0;
		}, 2000);
	}

	onDestroy(() => {
		cancelHold();
	});

	const cssColor = $derived(
		color === 'danger' ? 'var(--hot)' :
		color === 'marathon-blue' ? 'var(--marathon-blue)' :
		'var(--accent)'
	);
	const doneCssColor = $derived(
		color === 'danger' ? 'var(--correct)' :
		color === 'marathon-blue' ? 'var(--marathon-blue)' :
		'var(--correct)'
	);
</script>

<button
	class="longpress-btn"
	class:holding={holdActive}
	class:done
	style="--lp-color: {cssColor}; --lp-done-color: {doneCssColor}"
	onpointerdown={startHold}
	onpointerup={cancelHold}
	onpointerleave={cancelHold}
	oncontextmenu={(e) => e.preventDefault()}
>
	<div class="lp-fill" style="transform: scaleX({holdProgress})"></div>
	<span class="lp-text" class:glitching={holdActive}>{displayText}</span>
</button>

<style>
	.longpress-btn {
		position: relative;
		overflow: hidden;
		padding: 0.85rem;
		background: var(--surface);
		border: 1px solid var(--lp-color);
		border-radius: 0;
		color: var(--lp-color);
		font-size: 0.45rem;
		font-weight: 400;
		letter-spacing: 0.08em;
		font-family: var(--mono);
		width: 100%;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		cursor: pointer;
	}
	.lp-fill {
		position: absolute;
		inset: 0;
		background: var(--lp-color);
		transform-origin: left;
		transform: scaleX(0);
		transition: none;
		pointer-events: none;
		opacity: 0.35;
	}
	.lp-text {
		position: relative;
		z-index: 1;
	}
	.glitching {
		animation: lp-shake 60ms infinite;
	}
	.longpress-btn.done {
		border-color: var(--lp-done-color);
		color: var(--lp-done-color);
	}
	.longpress-btn.done .lp-fill {
		background: var(--lp-done-color);
		opacity: 0.35;
	}
	@keyframes lp-shake {
		0% { transform: translate(0); }
		25% { transform: translate(-1px, 1px); }
		50% { transform: translate(1px, -1px); }
		75% { transform: translate(-1px, -1px); }
		100% { transform: translate(0); }
	}
</style>
