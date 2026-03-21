<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface Props { onplay: () => void; replaying?: boolean; playing?: boolean; }
	let { onplay, replaying = false, playing = false }: Props = $props();

	let phase = $state(0);
	let animFrame: number | null = null;

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
			// Layer multiple sine waves + noise for organic randomness
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
	});

	const ring1 = $derived(generateWavyCircle(150, 150, 85, 8, 6, phase, 1));
	const ring2 = $derived(generateWavyCircle(150, 150, 105, 10, 5, phase * 0.7 + 1, 2));
	const ring3 = $derived(generateWavyCircle(150, 150, 125, 12, 7, phase * 1.1 + 2, 3));
</script>

<div class="play-wrapper">
	{#if playing}
		<svg class="wave-rings" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
			<path d={ring1} class="ring ring-1" />
			<path d={ring2} class="ring ring-2" />
			<path d={ring3} class="ring ring-3" />
		</svg>
	{/if}
	<button class="play-btn" class:replay={replaying} onclick={onplay}>
		{replaying ? 'REPLAY' : 'PLAY'}
	</button>
</div>

<style>
	.play-wrapper {
		position: relative;
		display: flex; align-items: center; justify-content: center;
	}
	.wave-rings {
		position: absolute;
		width: 300px; height: 300px;
		pointer-events: none;
	}
	.ring {
		fill: none;
		stroke: var(--marathon-blue);
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
		width: 140px; height: 140px; border-radius: 50%;
		background: var(--accent); border: none;
		color: var(--base); font-size: 1.3rem; font-weight: 400;
		letter-spacing: 0.05em; transition: transform 0.1s, opacity 0.15s;
		font-family: var(--font-display);
		display: flex; align-items: center; justify-content: center;
		text-align: center; line-height: 1;
	}
	.play-btn:active { transform: scale(0.93); opacity: 0.9; }
	.replay {
		width: 100px; height: 100px; font-size: 1rem;
		background: transparent; border: 2px solid var(--accent);
		color: var(--accent);
	}
	.replay:active { background: var(--accent-dim); }
</style>
