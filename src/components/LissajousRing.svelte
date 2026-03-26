<script lang="ts">
	/**
	 * LissajousRing — Full lifecycle Lissajous circle as play button visual.
	 * 
	 * State machine:
	 *   REST     → P1 circle, slow idle rotation, accent color
	 *   PLAYING  → Morphs to interval shape, audio-reactive pulse
	 *   CORRECT  → Snaps back to P1 circle, green bloom, then REST
	 *   WRONG    → Shape fragments/dissolves, red, then reassembles to REST
	 *   GLITCH   → Trail points scatter randomly ~100ms, reform to REST circle
	 *
	 * Extracted from lab/intervals page with matching constants.
	 */
	import { onMount, onDestroy } from 'svelte';
	import { getRatio } from '$lib/viz';
	import { getAnalyser, getAmplitude } from '$lib/audio';

	type Phase = 'rest' | 'playing' | 'correct' | 'wrong' | 'glitch';

	interface Props {
		size?: number;
		semitones?: number;
		chordIntervals?: number[];
		scaleIntervals?: number[];
		phase?: Phase;
	}

	let {
		size = 160,
		semitones = 0,
		chordIntervals,
		scaleIntervals,
		phase: vizPhase = 'rest',
	}: Props = $props();

	let canvas: HTMLCanvasElement;
	let animId: number;
	let t = 0; // animation time

	// Audio analyser
	let analyserRef: AnalyserNode | null = null;
	let dataArrayRef: Uint8Array | null = null;
	let amplitude = 0;

	// ── Constants — matched to lab intervals page ──
	const PHASE_DELTA = Math.PI / 2;
	const TRAIL_POINTS = 600;
	const TARGET_LOOPS = 1.5;
	const BASE_SPEED = 0.006;

	// ── Morph state ──
	let morphT = 0;       // 0 = P1 circle, 1 = target shape
	let morphTarget = 0;

	// ── Color state (smooth transitions) ──
	let colorR = 194, colorG = 254, colorB = 12; // accent (#C2FE0C)
	let targetR = 194, targetG = 254, targetB = 12;
	const COLOR_LERP = 0.08;

	// ── Dissolve state (wrong answer) ──
	let dissolveT = 0;      // 0 = solid, 1 = fully dissolved
	let dissolveTarget = 0;
	const dissolveOffsets: { dx: number; dy: number; angle: number; speed: number }[] = [];
	for (let i = 0; i < TRAIL_POINTS; i++) {
		dissolveOffsets.push({
			dx: 0, dy: 0,
			angle: Math.random() * Math.PI * 2,
			speed: 0.5 + Math.random() * 1.5,
		});
	}

	// ── Bloom state (correct answer) ──
	let bloomT = 0;  // 0 = no bloom, peaks at 1, decays
	let bloomDecay = 0;

	// ── Glitch state ──
	let glitchSeed = 0;

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

	// Update target ratio when interval changes
	$effect(() => {
		const _s = semitones;
		const _c = chordIntervals;
		const _sc = scaleIntervals;
		const [fx, fy] = getTargetRatio();
		targetFx = fx;
		targetFy = fy;
	});

	// State machine transitions
	$effect(() => {
		switch (vizPhase) {
			case 'rest':
				morphTarget = 0;       // circle
				dissolveTarget = 0;    // solid
				targetR = 194; targetG = 254; targetB = 12; // accent
				break;

			case 'playing':
				morphTarget = 1;       // morph to interval shape
				dissolveTarget = 0;    // solid
				targetR = 194; targetG = 254; targetB = 12; // accent
				// Init analyser
				if (!analyserRef) {
					try {
						const { analyser, dataArray } = getAnalyser();
						analyserRef = analyser;
						dataArrayRef = dataArray;
					} catch { /* not ready */ }
				}
				break;

			case 'correct':
				morphTarget = 0;       // snap back to perfect circle (consonance = resolution)
				dissolveTarget = 0;    // solid
				targetR = 0; targetG = 255; targetB = 136; // --correct green
				bloomT = 1;            // trigger bloom burst
				bloomDecay = 0.02;     // slow decay
				break;

			case 'wrong':
				// Hold interval shape, dissolve/fragment
				dissolveTarget = 1;
				targetR = 255; targetG = 51; targetB = 51; // --hot red
				// Randomize dissolve directions
				for (const d of dissolveOffsets) {
					d.angle = Math.random() * Math.PI * 2;
					d.speed = 0.5 + Math.random() * 1.5;
				}
				break;

			case 'glitch':
				morphTarget = 0;       // heading back to circle
				dissolveTarget = 0;    // reform
				targetR = 194; targetG = 254; targetB = 12; // accent
				glitchSeed = Math.random() * 1000;
				break;
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

			// Audio amplitude (same as lab)
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

			// Dissolve interpolation
			dissolveT += (dissolveTarget - dissolveT) * 0.06;

			// Color interpolation
			colorR += (targetR - colorR) * COLOR_LERP;
			colorG += (targetG - colorG) * COLOR_LERP;
			colorB += (targetB - colorB) * COLOR_LERP;
			const strokeColor = `rgb(${Math.round(colorR)}, ${Math.round(colorG)}, ${Math.round(colorB)})`;

			// Bloom decay
			if (bloomT > 0) {
				bloomT -= bloomDecay;
				if (bloomT < 0) bloomT = 0;
			}

			const baseRadius = Math.min(cx, cy) * 0.78;
			const radius = baseRadius * radiusPulse;

			// Speed (same as lab)
			const maxRatio = Math.max(fx, fy);
			const speed = BASE_SPEED / maxRatio;

			// Trail step (same as lab)
			const circleStep = (Math.PI * 2) / TRAIL_POINTS;
			const activeStep = (Math.PI * 2 * TARGET_LOOPS / maxRatio) / TRAIL_POINTS;
			const currentStep = circleStep + (activeStep - circleStep) * morphT;

			// Clear
			ctx.clearRect(0, 0, w, h);

			// ── Bloom burst (correct feedback) ──
			if (bloomT > 0.01) {
				const bloomRadius = baseRadius * (1 + bloomT * 0.3);
				const grad = ctx.createRadialGradient(cx, cy, baseRadius * 0.6, cx, cy, bloomRadius * 1.2);
				grad.addColorStop(0, `rgba(${Math.round(colorR)}, ${Math.round(colorG)}, ${Math.round(colorB)}, ${0.3 * bloomT})`);
				grad.addColorStop(0.5, `rgba(${Math.round(colorR)}, ${Math.round(colorG)}, ${Math.round(colorB)}, ${0.1 * bloomT})`);
				grad.addColorStop(1, `rgba(${Math.round(colorR)}, ${Math.round(colorG)}, ${Math.round(colorB)}, 0)`);
				ctx.fillStyle = grad;
				ctx.fillRect(0, 0, w, h);
			}

			// ── Compute Lissajous trail points (same per-point morph as lab) ──
			const lissPoints: [number, number][] = [];
			for (let i = 0; i < TRAIL_POINTS; i++) {
				const tt = t - i * currentStep;
				let px: number, py: number;

				if (vizPhase === 'glitch') {
					// Glitch: points scatter with high-frequency noise
					const noise = Math.sin(i * 0.7 + glitchSeed + t * 15) * 12 * (1 - i / TRAIL_POINTS);
					const pointMorph = Math.max(0, morphT - (i / TRAIL_POINTS) * 0.3);
					const ptFx = 1 + (fx - 1) * pointMorph;
					const ptFy = 1 + (fy - 1) * pointMorph;
					px = radius * Math.sin(ptFx * tt + PHASE_DELTA) + noise;
					py = radius * Math.sin(ptFy * tt) + noise * 0.6;
				} else {
					// Per-point morph: head leads, tail follows (same as lab)
					const pointMorph = Math.max(0, morphT - (i / TRAIL_POINTS) * 0.3);
					const ptFx = 1 + (fx - 1) * pointMorph;
					const ptFy = 1 + (fy - 1) * pointMorph;
					px = radius * Math.sin(ptFx * tt + PHASE_DELTA);
					py = radius * Math.sin(ptFy * tt);
				}

				// Apply dissolve (wrong answer — points drift outward)
				if (dissolveT > 0.01) {
					const d = dissolveOffsets[i];
					const drift = dissolveT * 20 * d.speed;
					px += Math.cos(d.angle) * drift;
					py += Math.sin(d.angle) * drift;
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

			// Dissolve reduces alpha on outer mirrors first
			const dissolveAlphaScale = 1 - dissolveT * 0.6;

			for (const [mx, my, baseAlpha] of mirrors) {
				const mirrorAlpha = baseAlpha * dissolveAlphaScale;
				if (mirrorAlpha < 0.02) continue;

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
				ctx.globalAlpha = 0.1 * mirrorAlpha;
				ctx.shadowColor = strokeColor;
				ctx.shadowBlur = 8 + glowBoost + bloomT * 12;
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
				ctx.globalAlpha = 0.3 * mirrorAlpha;
				ctx.shadowBlur = 4 + glowBoost * 0.5 + bloomT * 6;
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
				ctx.globalAlpha = Math.min(1, mirrorAlpha + alphaBoost);
				ctx.shadowBlur = 2 + glowBoost * 0.5;
				ctx.stroke();
			}

			ctx.globalAlpha = 1;
			ctx.shadowBlur = 0;

			// ── Head dot (same as lab) ──
			if (dissolveT < 0.5) {
				const headX = cx + radius * Math.sin(drawFx * t + PHASE_DELTA);
				const headY = cy + radius * Math.sin(drawFy * t);

				// Apply dissolve drift to head too
				let hdx = headX, hdy = headY;
				if (dissolveT > 0.01) {
					const d = dissolveOffsets[0];
					const drift = dissolveT * 20 * d.speed;
					hdx += Math.cos(d.angle) * drift;
					hdy += Math.sin(d.angle) * drift;
				}

				ctx.beginPath();
				ctx.arc(hdx, hdy, 3, 0, Math.PI * 2);
				ctx.fillStyle = strokeColor;
				ctx.shadowColor = strokeColor;
				ctx.shadowBlur = 6 + glowBoost + bloomT * 10;
				ctx.globalAlpha = 1 - dissolveT;
				ctx.fill();
				ctx.globalAlpha = 1;
				ctx.shadowBlur = 0;
			}

			t += speed;
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
