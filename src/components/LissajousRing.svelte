<script lang="ts">
	/**
	 * LissajousRing — Lissajous circle/shape as the play button visual.
	 * Extracted from lab/intervals page. Same rendering: 4-way mirrored trails,
	 * per-point morph (head leads, tail follows), audio-reactive glow/pulse,
	 * head dot, 3-pass glow.
	 *
	 * Rest state: P1 circle. On play: morphs to interval shape.
	 * For chords: uses largest interval. For scales: uses dominant (P5 if present).
	 */
	import { onMount, onDestroy } from 'svelte';
	import { getRatio } from '$lib/viz';
	import { getAnalyser, getAmplitude } from '$lib/audio';

	interface Props {
		size?: number;
		semitones?: number;
		chordIntervals?: number[];
		scaleIntervals?: number[];
		playing?: boolean;
		glitching?: boolean;
		feedback?: 'correct' | 'wrong' | null;
	}

	let {
		size = 120,
		semitones = 0,
		chordIntervals,
		scaleIntervals,
		playing = false,
		glitching = false,
		feedback = null,
	}: Props = $props();

	let canvas: HTMLCanvasElement;
	let animId: number;
	let phase = 0;

	// Audio analyser
	let analyserRef: AnalyserNode | null = null;
	let dataArrayRef: Uint8Array | null = null;
	let amplitude = 0;

	// ── Constants — matched to lab intervals page ──
	const PHASE_DELTA = Math.PI / 2;
	const TRAIL_POINTS = 600;
	const TARGET_LOOPS = 1.5;
	const BASE_SPEED = 0.006;

	// Morph state: 0 = P1 circle, 1 = target interval shape
	let morphT = 0;
	let morphTarget = 0;

	// Target ratio
	let targetFx = 1;
	let targetFy = 1;

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

	// Update target when interval changes
	$effect(() => {
		const _s = semitones;
		const _c = chordIntervals;
		const _sc = scaleIntervals;
		const [fx, fy] = getTargetRatio();
		targetFx = fx;
		targetFy = fy;
		// Reset to circle — will morph on play
		morphTarget = 0;
		morphT = 0;
	});

	// Morph to shape when playing
	$effect(() => {
		if (playing) {
			morphTarget = 1;
			if (!analyserRef) {
				try {
					const { analyser, dataArray } = getAnalyser();
					analyserRef = analyser;
					dataArrayRef = dataArray;
				} catch { /* not ready */ }
			}
		}
	});

	onMount(() => {
		const ctx = canvas.getContext('2d')!;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);

		canvas.width = size * dpr;
		canvas.height = size * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		function draw() {
			const w = size;
			const h = size;
			const cx = w / 2;
			const cy = h / 2;
			const fx = targetFx;
			const fy = targetFy;

			// Audio amplitude (same processing as lab)
			if (analyserRef && dataArrayRef) {
				amplitude = getAmplitude(analyserRef, dataArrayRef);
			} else {
				amplitude *= 0.95;
			}
			const amp = Math.min(1, amplitude * 3);
			const radiusPulse = 1 + amp * 0.12;
			const glowBoost = amp * 4;
			const lwBoost = amp * 1.5;
			const alphaBoost = amp * 0.3;

			// Morph interpolation (same rate as lab: 0.08)
			morphT += (morphTarget - morphT) * 0.08;
			const drawFx = 1 + (fx - 1) * morphT;
			const drawFy = 1 + (fy - 1) * morphT;

			const radius = Math.min(cx, cy) * 0.78 * radiusPulse;

			// Speed scaled by ratio complexity (same as lab)
			const maxRatio = Math.max(fx, fy);
			const speed = BASE_SPEED / maxRatio;

			// Trail step for consistent visual density (same as lab)
			const circleStep = (Math.PI * 2) / TRAIL_POINTS;
			const activeStep = (Math.PI * 2 * TARGET_LOOPS / maxRatio) / TRAIL_POINTS;
			const currentStep = circleStep + (activeStep - circleStep) * morphT;

			// Clear (transparent — this is an overlay on the play button)
			ctx.clearRect(0, 0, w, h);

			// Determine colors based on state
			let strokeColor = '#C2FE0C';
			let glowColor = '#C2FE0C';

			if (feedback === 'correct') {
				strokeColor = '#00FF88';
				glowColor = '#00FF88';
			} else if (feedback === 'wrong') {
				strokeColor = '#FF3333';
				glowColor = '#FF3333';
			}

			if (glitching) {
				glowColor = '#5A4CFF';
			}

			// ── Lissajous trail (same per-point morph as lab) ──
			const lissPoints: [number, number][] = [];
			for (let i = 0; i < TRAIL_POINTS; i++) {
				const t = phase - i * currentStep;
				let px: number, py: number;

				if (glitching) {
					// Glitch distortion — rapid jitter on points
					const jitter = Math.sin(i * 0.4 + phase * 10) * 6;
					px = radius * Math.sin(drawFx * t + PHASE_DELTA) + jitter;
					py = radius * Math.sin(drawFy * t) + jitter * 0.6;
				} else {
					// Per-point morph: head leads, tail follows (same as lab)
					const pointMorph = Math.max(0, morphT - (i / TRAIL_POINTS) * 0.3);
					const ptFx = 1 + (fx - 1) * pointMorph;
					const ptFy = 1 + (fy - 1) * pointMorph;
					px = radius * Math.sin(ptFx * t + PHASE_DELTA);
					py = radius * Math.sin(ptFy * t);
				}

				lissPoints.push([px, py]);
			}

			// ── 4-way mirrors (same as lab) ──
			const mirrors: [number, number, number][] = [
				[1, 1, 0.85],
				[-1, 1, 0.5],
				[1, -1, 0.5],
				[-1, -1, 0.35],
			];

			// 3-pass glow rendering (matching lab ring depth)
			for (const [mx, my, baseAlpha] of mirrors) {
				// Pass 1: outer glow
				ctx.beginPath();
				for (let i = 0; i < lissPoints.length; i++) {
					const x = cx + mx * lissPoints[i][0];
					const y = cy + my * lissPoints[i][1];
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				ctx.strokeStyle = strokeColor;
				ctx.lineWidth = 3;
				ctx.globalAlpha = 0.1 * baseAlpha;
				ctx.shadowColor = glowColor;
				ctx.shadowBlur = 8 + glowBoost;
				ctx.stroke();

				// Pass 2: bloom
				ctx.beginPath();
				for (let i = 0; i < lissPoints.length; i++) {
					const x = cx + mx * lissPoints[i][0];
					const y = cy + my * lissPoints[i][1];
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				ctx.lineWidth = 1.8 + lwBoost * 0.5;
				ctx.globalAlpha = 0.3 * baseAlpha;
				ctx.shadowBlur = 4 + glowBoost * 0.5;
				ctx.stroke();

				// Pass 3: primary stroke
				ctx.beginPath();
				for (let i = 0; i < lissPoints.length; i++) {
					const x = cx + mx * lissPoints[i][0];
					const y = cy + my * lissPoints[i][1];
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				ctx.lineWidth = 1.2 + lwBoost;
				ctx.globalAlpha = Math.min(1, baseAlpha + alphaBoost);
				ctx.shadowBlur = 2 + glowBoost * 0.5;
				ctx.stroke();
			}

			ctx.globalAlpha = 1;
			ctx.shadowBlur = 0;

			// ── Head dot (same as lab) ──
			const headX = cx + radius * Math.sin(drawFx * phase + PHASE_DELTA);
			const headY = cy + radius * Math.sin(drawFy * phase);
			ctx.beginPath();
			ctx.arc(headX, headY, 3, 0, Math.PI * 2);
			ctx.fillStyle = strokeColor;
			ctx.shadowColor = glowColor;
			ctx.shadowBlur = 6 + glowBoost;
			ctx.globalAlpha = 1;
			ctx.fill();
			ctx.globalAlpha = 1;
			ctx.shadowBlur = 0;

			phase += speed;
			animId = requestAnimationFrame(draw);
		}

		draw();

		return () => cancelAnimationFrame(animId);
	});

	onDestroy(() => {
		if (animId) cancelAnimationFrame(animId);
	});
</script>

<canvas
	bind:this={canvas}
	class="lissajous-ring"
	style="width: {size}px; height: {size}px;"
></canvas>

<style>
	.lissajous-ring {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		pointer-events: none;
		z-index: 0;
	}
</style>
