<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		onplay: () => void;
		replaying?: boolean;
		playing?: boolean;
		noBorder?: boolean;
		questionNum?: number;
		glitching?: boolean;
	}
	let { onplay, replaying = false, playing = false, noBorder = false, questionNum = 1, glitching = false }: Props = $props();

	let phase = $state(0);
	let animFrame: number | null = null;
	let glitchText = $state('');
	let glitchInterval: ReturnType<typeof setInterval> | null = null;

	const glitchChars = ['#7', 'Q_', '>>', '//', '??', '<!', '}{', '0x', '~~', '##', '$_', '&&'];

	$effect(() => {
		if (glitching) {
			glitchInterval = setInterval(() => {
				glitchText = glitchChars[Math.floor(Math.random() * glitchChars.length)];
			}, 50);
		} else {
			if (glitchInterval) {
				clearInterval(glitchInterval);
				glitchInterval = null;
			}
			glitchText = '';
		}
	});

	// Seeded pseudo-random for deterministic but organic-looking waves
	function seededRandom(seed: number): number {
		const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
		return x - Math.floor(x);
	}

	function generateWavyCircle(cx: number, cy: number, baseRadius: number, amplitude: number, frequency: number, phaseOffset: number, seed: number): string {
		const points: string[] = [];
		const steps = 120;
		for (let i = 0; i <= steps; i++) {
			const angle = (i / steps) * Math.PI * 2;
			const wave1 = Math.sin(angle * frequency + phaseOffset) * amplitude;
			const wave2 = Math.sin(angle * (frequency * 1.7) + phaseOffset * 0.6 + 3.1) * amplitude * 0.5;
			const wave3 = Math.sin(angle * (frequency * 3.1) + phaseOffset * 1.3 + 1.7) * amplitude * 0.3;
			const noise = (seededRandom(i + seed + Math.floor(phaseOffset * 2)) - 0.5) * amplitude * 0.6;
			const r = baseRadius + wave1 + wave2 + wave3 + noise;
			const x = cx + Math.cos(angle) * r;
			const y = cy + Math.sin(angle) * r;
			points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`);
		}
		return points.join(' ') + 'Z';
	}

	function animate() {
		phase += 0.04;
		animFrame = requestAnimationFrame(animate);
	}

	onMount(() => {
		animFrame = requestAnimationFrame(animate);
	});

	onDestroy(() => {
		if (animFrame !== null) cancelAnimationFrame(animFrame);
		if (glitchInterval) clearInterval(glitchInterval);
	});

	const ring1 = $derived(generateWavyCircle(75, 75, 42, 4, 6, phase, 1));
	const ring2 = $derived(generateWavyCircle(75, 75, 52, 5, 5, phase * 0.7 + 1, 2));
	const ring3 = $derived(generateWavyCircle(75, 75, 62, 6, 7, phase * 1.1 + 2, 3));

	const displayText = $derived.by(() => {
		if (glitching) return glitchText;
		if (replaying) return 'REPLAY';
		return `Q${questionNum}`;
	});
</script>

<div class="play-wrapper">
	{#if playing}
		<svg class="wave-rings" viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg">
			<path d={ring1} class="ring ring-1" />
			<path d={ring2} class="ring ring-2" />
			<path d={ring3} class="ring ring-3" />
		</svg>
	{/if}
	<button class="play-btn" class:replay={replaying} class:no-border={noBorder} class:glitch-text={glitching} onclick={onplay}>
		{displayText}
	</button>
</div>

<style>
	.play-wrapper {
		position: relative;
		display: flex; align-items: center; justify-content: center;
	}
	.wave-rings {
		position: absolute;
		width: 150px; height: 150px;
		pointer-events: none;
	}
	.ring {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1.5;
	}
	.ring-1 {
		opacity: 0.6;
		animation: ring-pulse 1.8s ease-out infinite;
	}
	.ring-2 {
		opacity: 0.4;
		animation: ring-pulse 1.8s ease-out infinite 0.4s;
	}
	.ring-3 {
		opacity: 0.25;
		animation: ring-pulse 1.8s ease-out infinite 0.8s;
	}
	@keyframes ring-pulse {
		0% { opacity: 0.6; transform-origin: center; transform: scale(0.9); }
		100% { opacity: 0; transform-origin: center; transform: scale(1.1); }
	}
	.play-btn {
		position: relative; z-index: 1;
		width: 100px; height: 100px; border-radius: 50%;
		background: var(--accent); border: none;
		color: var(--base); font-size: 1rem; font-weight: 700;
		letter-spacing: 0.05em; transition: transform 0.1s, opacity 0.15s;
		font-family: 'Space Mono', monospace;
		display: flex; align-items: center; justify-content: center;
		text-align: center; line-height: 1;
	}
	.play-btn:active { transform: scale(0.93); opacity: 0.9; }
	.replay {
		background: transparent; border: 2px solid var(--accent);
		color: var(--accent);
	}
	.replay:active { background: var(--accent-dim); }
	.no-border {
		border: none !important;
	}
	.glitch-text {
		text-shadow: -2px 0 var(--accent), 2px 0 var(--hot);
		animation: glitch-shake 50ms infinite;
	}
	@keyframes glitch-shake {
		0% { transform: translate(0); }
		25% { transform: translate(-1px, 1px); }
		50% { transform: translate(1px, -1px); }
		75% { transform: translate(-1px, -1px); }
		100% { transform: translate(0); }
	}
</style>
