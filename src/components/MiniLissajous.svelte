<script lang="ts">
	/**
	 * MiniLissajous — Tiny static Lissajous curve for content type tiles.
	 * No animation, no audio — just the mathematical shape.
	 */
	import { onMount } from 'svelte';
	import { getRatio } from '$lib/viz';

	interface Props {
		size?: number;
		semitones?: number;
		chordIntervals?: number[];
		scaleIntervals?: number[];
		color?: string;
	}

	let {
		size = 32,
		semitones = 7,
		chordIntervals,
		scaleIntervals,
		color = '#C2FE0C',
	}: Props = $props();

	let canvas: HTMLCanvasElement;

	function semitonesToId(s: number): string {
		const ids = ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'];
		return ids[Math.min(Math.max(0, s), 12)] ?? 'P1';
	}

	function getTargetRatio(): [number, number] {
		if (chordIntervals && chordIntervals.length > 1) {
			const maxSt = Math.max(...chordIntervals);
			return getRatio(semitonesToId(maxSt));
		}
		if (scaleIntervals && scaleIntervals.length > 1) {
			const filtered = scaleIntervals.filter(s => s > 0 && s < 12);
			const dominant = filtered.includes(7) ? 7 : Math.max(...filtered, 0);
			return getRatio(semitonesToId(dominant));
		}
		return getRatio(semitonesToId(semitones));
	}

	onMount(() => {
		const ctx = canvas.getContext('2d')!;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = size * dpr;
		canvas.height = size * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		const [fx, fy] = getTargetRatio();
		const cx = size / 2;
		const cy = size / 2;
		const radius = size * 0.38;
		const PHASE_DELTA = Math.PI / 2;
		const POINTS = 300;
		const maxRatio = Math.max(fx, fy);
		const step = (Math.PI * 2 * 1.5 / maxRatio) / POINTS;

		ctx.clearRect(0, 0, size, size);

		// Draw the curve
		ctx.beginPath();
		for (let i = 0; i < POINTS; i++) {
			const t = i * step;
			const x = cx + radius * Math.sin(fx * t + PHASE_DELTA);
			const y = cy + radius * Math.sin(fy * t);
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.strokeStyle = color;
		ctx.lineWidth = 1;
		ctx.globalAlpha = 0.6;
		ctx.stroke();

		// Glow pass
		ctx.strokeStyle = color;
		ctx.lineWidth = 2;
		ctx.globalAlpha = 0.15;
		ctx.shadowColor = color;
		ctx.shadowBlur = 4;
		ctx.stroke();
		ctx.globalAlpha = 1;
		ctx.shadowBlur = 0;
	});
</script>

<canvas
	bind:this={canvas}
	class="mini-lissajous"
	style="width: {size}px; height: {size}px;"
></canvas>

<style>
	.mini-lissajous {
		display: block;
		pointer-events: none;
	}
</style>
