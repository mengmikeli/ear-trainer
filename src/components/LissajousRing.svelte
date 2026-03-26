<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getRatio } from '$lib/viz';
	import { getAnalyser, getAmplitude } from '$lib/audio';

	interface Props {
		/** Size in CSS px (canvas rendered at 2x for retina) */
		size?: number;
		/** Current interval semitones (maps to Lissajous ratio) */
		semitones?: number;
		/** Chord intervals (overrides semitones — uses largest interval for Lissajous) */
		chordIntervals?: number[];
		/** Scale intervals (overrides semitones) */
		scaleIntervals?: number[];
		/** Whether audio is currently playing */
		playing?: boolean;
		/** Whether we're in glitch transition between questions */
		glitching?: boolean;
		/** Feedback state after answering */
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

	// Morph state: 0 = P1 circle, 1 = target interval shape
	let morphT = 0;
	let morphTarget = 0;

	// Glitch state
	let glitchOffset = 0;
	let glitchPhase = 0;

	// Current target ratio
	let targetFx = 1;
	let targetFy = 1;

	// Determine ratio from props
	function getTargetRatio(): [number, number] {
		if (chordIntervals && chordIntervals.length > 1) {
			// For chords: use the largest interval for the Lissajous shape
			const maxSemitones = Math.max(...chordIntervals);
			const intervalId = semitonesToId(maxSemitones);
			return getRatio(intervalId);
		}
		if (scaleIntervals && scaleIntervals.length > 1) {
			// For scales: use the 5th degree (or largest < octave) for the shape
			const filtered = scaleIntervals.filter(s => s > 0 && s < 12);
			const dominant = filtered.includes(7) ? 7 : Math.max(...filtered, 0);
			const intervalId = semitonesToId(dominant);
			return getRatio(intervalId);
		}
		const intervalId = semitonesToId(semitones);
		return getRatio(intervalId);
	}

	function semitonesToId(s: number): string {
		const ids = ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'];
		return ids[Math.min(s, 12)] ?? 'P1';
	}

	// Update target when props change
	$effect(() => {
		// Read reactive props to create dependency
		const _s = semitones;
		const _c = chordIntervals;
		const _sc = scaleIntervals;
		const [fx, fy] = getTargetRatio();
		targetFx = fx;
		targetFy = fy;
		// Reset morph to circle, will morph on play
		morphTarget = 0;
		morphT = 0;
	});

	// Morph to shape when playing
	$effect(() => {
		if (playing) {
			morphTarget = 1;
			// Init analyser on first play
			if (!analyserRef) {
				try {
					const { analyser, dataArray } = getAnalyser();
					analyserRef = analyser;
					dataArrayRef = dataArray;
				} catch { /* not ready */ }
			}
		}
	});

	// Glitch effect
	$effect(() => {
		if (glitching) {
			glitchPhase = phase;
			glitchOffset = Math.random() * Math.PI;
		}
	});

	const PHASE_DELTA = Math.PI / 2;
	const TRAIL_POINTS = 200;
	const TARGET_LOOPS = 1.5;

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
			const baseRadius = Math.min(cx, cy) * 0.82;

			// Audio amplitude
			let amp = 0;
			if (analyserRef && dataArrayRef) {
				amp = Math.min(1, getAmplitude(analyserRef, dataArrayRef) * 3);
			}
			const radiusPulse = 1 + amp * 0.08;
			const glowBoost = amp * 6;

			// Morph interpolation
			morphT += (morphTarget - morphT) * 0.06;
			const drawFx = 1 + (targetFx - 1) * morphT;
			const drawFy = 1 + (targetFy - 1) * morphT;

			const radius = baseRadius * radiusPulse;

			// Speed scaled by complexity
			const maxF = Math.max(drawFx, drawFy);
			const speed = 0.004 / maxF;

			// Trail step for consistent visual density
			const trailStep = (Math.PI * 2 * TARGET_LOOPS / maxF) / TRAIL_POINTS;

			// Clear
			ctx.clearRect(0, 0, w, h);

			// Determine colors
			let strokeColor = '#C2FE0C';  // --accent (neon green)
			let glowColor = '#C2FE0C';
			let baseAlpha = 0.85;

			if (feedback === 'correct') {
				strokeColor = '#00FF88';
				glowColor = '#00FF88';
			} else if (feedback === 'wrong') {
				strokeColor = '#FF3333';
				glowColor = '#FF3333';
				baseAlpha = 0.7;
			}

			if (glitching) {
				strokeColor = '#C2FE0C';
				glowColor = '#5A4CFF';
				baseAlpha = 0.5;
			}

			// Compute Lissajous trail points
			const pts: [number, number][] = [];
			for (let i = 0; i < TRAIL_POINTS; i++) {
				const t = phase - i * trailStep;

				let px: number, py: number;
				if (glitching) {
					// Glitch: rapid random distortion
					const jitter = Math.sin(i * 0.3 + glitchOffset) * 8;
					px = radius * Math.sin(drawFx * t + PHASE_DELTA) + jitter;
					py = radius * Math.sin(drawFy * t) + jitter * 0.7;
				} else {
					// Per-point morph: head leads, tail follows
					const pointMorph = Math.max(0, morphT - (i / TRAIL_POINTS) * 0.25);
					const ptFx = 1 + (targetFx - 1) * pointMorph;
					const ptFy = 1 + (targetFy - 1) * pointMorph;
					px = radius * Math.sin(ptFx * t + PHASE_DELTA);
					py = radius * Math.sin(ptFy * t);
				}

				pts.push([px, py]);
			}

			// Draw ring with glow (3-pass for glow effect)
			for (let pass = 0; pass < 3; pass++) {
				const passAlpha = pass === 0 ? 0.15 : pass === 1 ? 0.4 : baseAlpha;
				const passWidth = pass === 0 ? 4 : pass === 1 ? 2 : 1;
				const passBlur = pass === 0 ? 8 + glowBoost : pass === 1 ? 4 + glowBoost * 0.5 : 1;

				ctx.beginPath();
				for (let i = 0; i < pts.length; i++) {
					const x = cx + pts[i][0];
					const y = cy + pts[i][1];
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}

				ctx.strokeStyle = strokeColor;
				ctx.lineWidth = passWidth;
				ctx.globalAlpha = passAlpha;
				ctx.shadowColor = glowColor;
				ctx.shadowBlur = passBlur;
				ctx.stroke();
			}

			// Head dot (traversing dot)
			const headX = cx + radius * Math.sin(drawFx * phase + PHASE_DELTA);
			const headY = cy + radius * Math.sin(drawFy * phase);
			ctx.beginPath();
			ctx.arc(headX, headY, 2.5, 0, Math.PI * 2);
			ctx.fillStyle = strokeColor;
			ctx.shadowBlur = 6 + glowBoost;
			ctx.globalAlpha = 1;
			ctx.fill();

			// Reset
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
