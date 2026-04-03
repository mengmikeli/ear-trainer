<script lang="ts">
	import { onDestroy } from 'svelte';

	let {
		label,
		doneLabel,
		duration = 2000,
		color = 'accent',
		onExecute,
	}: {
		label: string;
		doneLabel: string;
		duration?: number;
		color?: 'accent' | 'danger' | 'marathon-blue';
		onExecute: () => void;
	} = $props();

	const glyphs = ['\uE000', '\uE001', '\uE002', '\uE003', '\uE004', '\uE005', '\uE006', '\uE007', '\uE008', '\uE010', '\uE011', '\uE012', '\uE013', '\uE014', '\uE015', '\uE016', '\uE017', '\uE018', '\uE019'];

	let holdProgress = $state(0);
	let holdActive = $state(false);
	let done = $state(false);
	// label is stable for the lifetime of each button instance
	let glitchText = $state(label); // eslint-disable-line
	let holdStart = 0;
	let holdRaf: number | null = null;
	let glitchInterval: ReturnType<typeof setInterval> | null = null;

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
			glitchText = randomGlitchText();
		}, 60);
		holdRaf = requestAnimationFrame(tickHold);
	}

	function tickHold(now: number) {
		const elapsed = now - holdStart;
		const linear = Math.min(1, elapsed / duration);
		holdProgress = 1 - Math.pow(1 - linear, 3);
		if (linear >= 1) {
			execute();
			return;
		}
		holdRaf = requestAnimationFrame(tickHold);
	}

	function cancelHold() {
		holdActive = false;
		holdProgress = 0;
		glitchText = label;
		if (holdRaf) { cancelAnimationFrame(holdRaf); holdRaf = null; }
		if (glitchInterval) { clearInterval(glitchInterval); glitchInterval = null; }
	}

	function execute() {
		holdActive = false;
		if (holdRaf) { cancelAnimationFrame(holdRaf); holdRaf = null; }
		if (glitchInterval) { clearInterval(glitchInterval); glitchInterval = null; }

		done = true;
		glitchText = doneLabel;
		holdProgress = 1;
		onExecute();
		setTimeout(() => {
			done = false;
			holdProgress = 0;
			glitchText = label;
		}, 2000);
	}

	onDestroy(() => {
		cancelHold();
	});
</script>

<button
	class="hold-btn {color}"
	class:holding={holdActive}
	class:done
	onpointerdown={startHold}
	onpointerup={cancelHold}
	onpointerleave={cancelHold}
	oncontextmenu={(e) => e.preventDefault()}
>
	<div class="hold-fill" style="transform: scaleX({holdProgress})"></div>
	<span class="hold-text" class:glitching={holdActive}>{glitchText}</span>
</button>

<style>
	.hold-btn {
		position: relative;
		overflow: hidden;
		padding: 0.85rem;
		background: var(--surface);
		border: 1px solid var(--accent);
		border-radius: 0;
		color: var(--accent);
		font-size: 0.45rem;
		font-weight: 400;
		letter-spacing: 0.08em;
		font-family: var(--mono);
		width: 100%;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		margin-bottom: 0.5rem;
	}
	.hold-btn.danger {
		border-color: var(--hot);
		color: var(--hot);
		margin-bottom: 0;
	}
	.hold-btn.marathon-blue {
		border-color: var(--marathon-blue);
		color: var(--marathon-blue);
	}
	.hold-fill {
		position: absolute;
		inset: 0;
		background: var(--accent);
		transform-origin: left;
		transform: scaleX(0);
		transition: none;
		pointer-events: none;
		opacity: 0.35;
	}
	.hold-btn.danger .hold-fill {
		background: var(--hot);
	}
	.hold-btn.marathon-blue .hold-fill {
		background: var(--marathon-blue);
	}
	.hold-text {
		position: relative;
		z-index: 1;
	}
	.glitching {
		animation: hold-shake 60ms infinite;
	}
	.hold-btn.done {
		border-color: var(--correct);
		color: var(--correct);
	}
	.hold-btn.done .hold-fill {
		background: var(--correct);
		opacity: 0.35;
	}
	@keyframes hold-shake {
		0% { transform: translate(0); }
		25% { transform: translate(-1px, 1px); }
		50% { transform: translate(1px, -1px); }
		75% { transform: translate(-1px, -1px); }
		100% { transform: translate(0); }
	}
</style>
