<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface Props { onplay: () => void; replaying?: boolean; playing?: boolean; }
	let { onplay, replaying = false, playing = false }: Props = $props();

	let phase = $state(0);
	let animFrame: number | null = null;

	function generateWavyCircle(cx: number, cy: number, baseRadius: number, amplitude: number, frequency: number, phaseOffset: number): string {
		const points: string[] = [];
		const steps = 120;
		for (let i = 0; i <= steps; i++) {
			const angle = (i / steps) * Math.PI * 2;
			const wave = Math.sin(angle * frequency + phaseOffset) * amplitude;
			const r = baseRadius + wave;
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

	const ring1 = $derived(generateWavyCircle(150, 150, 85, 4, 8, phase));
	const ring2 = $derived(generateWavyCircle(150, 150, 105, 5, 6, phase * 0.8 + 1));
	const ring3 = $derived(generateWavyCircle(150, 150, 125, 6, 10, phase * 1.2 + 2));
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
		{replaying ? '[↻] REPLAY' : '[▶] PLAY'}
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
		width: 140px; height: 140px; border-radius: 50%;
		background: var(--accent); border: none;
		color: var(--base); font-size: 0.9rem; font-weight: 900;
		letter-spacing: 0.05em; transition: transform 0.1s, opacity 0.15s;
		font-family: var(--mono);
		display: flex; align-items: center; justify-content: center;
		text-align: center; line-height: 1;
	}
	.play-btn:active { transform: scale(0.93); opacity: 0.9; }
	.replay {
		width: 100px; height: 100px; font-size: 0.75rem;
		background: transparent; border: 2px solid var(--accent);
		color: var(--accent);
	}
	.replay:active { background: var(--accent-dim); }
</style>
