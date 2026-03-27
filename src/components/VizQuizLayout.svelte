<script lang="ts">
	/**
	 * VizQuizLayout — Full-viewport canvas with quiz UI overlaid.
	 *
	 * The canvas IS the page. Quiz controls float on top via named slots.
	 * Single draw loop: Chladni particles (bg) + Lissajous shape (center).
	 *
	 * Dumb renderer — takes phase as prop, doesn't own timers.
	 * Quiz pages control all timing via phase prop changes.
	 */
	import { onMount, onDestroy } from 'svelte';
	import {
		getRatio, chladni, chladniGrad, chladniSuper, chladniGradSuper,
		chordToModes, midiToChladniMode, harmonograph3D
	} from '$lib/viz';
	import type { ChladniMode } from '$lib/viz';
	import { getAnalyser, getAmplitude } from '$lib/audio';

	type Phase = 'rest' | 'playing' | 'playing-a' | 'playing-b' | 'correct' | 'wrong' | 'transition';

	interface Props {
		mode: 'interval' | 'chord' | 'scale';
		phase?: Phase;
		semitones?: number;
		chordIntervals?: number[];
		scaleIntervals?: number[];
		countdownPct?: number;
		ontransitionend?: () => void;
		children?: import('svelte').Snippet;
	}

	let {
		mode = 'interval',
		phase: vizPhase = 'rest',
		semitones = 0,
		chordIntervals,
		scaleIntervals,
		countdownPct = -1,
		ontransitionend,
		children,
	}: Props = $props();

	let canvas: HTMLCanvasElement;
	let animId: number;
	let t = 0;

	// Audio analyser
	let analyserRef: AnalyserNode | null = null;
	let dataArrayRef: Uint8Array | null = null;
	let amplitude = 0;

	// ── Lissajous constants (from lab) ──
	const PHASE_DELTA = Math.PI / 2;
	const TRAIL_POINTS = 600;
	const TARGET_LOOPS = 1.5;
	const BASE_SPEED = 0.006;

	// ── Morph state ──
	let morphT = 0;
	let morphTarget = 0;

	// ── Color state (smooth RGB lerp) ──
	let colorR = 194, colorG = 254, colorB = 12;
	let targetR = 194, targetG = 254, targetB = 12;
	const COLOR_LERP = 0.08;

	// ── Bloom (correct) ──
	let bloomT = 0;

	// ── Wrong state: harmonograph destabilization ──
	let wrongT = 0;        // 0 = clean Lissajous, 1 = full harmonograph chaos
	let wrongTarget = 0;
	// Random dissonant frequencies for wrong-state harmonograph
	let wrongFreqs = [1, 1.41, 1.73]; // will be randomized

	// ── Transition state ──
	let transitionT = 0;   // 0 = start, 1 = settled at P1
	let transitionActive = false;

	// ── Target Lissajous ratio ──
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

	// ── Chladni constants (from lab) ──
	const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
	const PARTICLE_COUNT = isMobile ? 1500 : 3500;
	const SETTLE_SPEED_BASE = 0.003;
	const SETTLE_SPEED_BOOST = 0.025;
	const JITTER = 0.001;
	const SHAKE_BASE = 0.02;
	const SHAKE_AUDIO = 0.05;
	let particles: { x: number; y: number }[] = [];
	let settleSpeed = SETTLE_SPEED_BASE;
	let migrateTimer = 0;
	let scatterTimer = 0;

	// Chladni mode(s)
	let currentModes: ChladniMode[] = [{ n: 1, m: 1, amp: 1 }];
	let useSuperposition = false;

	function initParticles() {
		particles = [];
		const TAU = Math.PI * 2;
		for (let i = 0; i < PARTICLE_COUNT; i++) {
			particles.push({ x: Math.random() * TAU, y: Math.random() * TAU });
		}
	}

	function updateChladniModes() {
		if (chordIntervals && chordIntervals.length > 1) {
			currentModes = chordToModes(60, chordIntervals);
			useSuperposition = true;
		} else if (scaleIntervals && scaleIntervals.length > 1) {
			const filtered = scaleIntervals.filter(s => s > 0 && s < 12);
			const dominant = filtered.includes(7) ? 7 : Math.max(...filtered, 0);
			const [n, m] = midiToChladniMode(60 + dominant);
			currentModes = [{ n, m, amp: 1 }];
			useSuperposition = false;
		} else {
			const [n, m] = midiToChladniMode(60 + semitones);
			currentModes = [{ n, m, amp: 1 }];
			useSuperposition = false;
		}
	}

	// Noise texture (from lab)
	let noiseCanvas: HTMLCanvasElement | null = null;
	let noiseCtx: CanvasRenderingContext2D | null = null;

	function generateNoise(w: number, h: number) {
		if (!noiseCanvas) {
			noiseCanvas = document.createElement('canvas');
			noiseCtx = noiseCanvas.getContext('2d')!;
		}
		noiseCanvas.width = w;
		noiseCanvas.height = h;
	}

	function refreshNoise(w: number, h: number) {
		if (!noiseCtx || !noiseCanvas) return;
		const imgData = noiseCtx.createImageData(w, h);
		const d = imgData.data;
		for (let i = 0; i < d.length; i += 4) {
			const v = Math.random() * 255;
			d[i] = v; d[i + 1] = v; d[i + 2] = v;
			d[i + 3] = Math.random() < 0.35 ? 12 : 0;
		}
		noiseCtx.putImageData(imgData, 0, 0);
	}

	// ── React to interval/chord/scale changes ──
	$effect(() => {
		const _s = semitones;
		const _c = chordIntervals;
		const _sc = scaleIntervals;
		const [fx, fy] = getTargetRatio();
		targetFx = fx;
		targetFy = fy;
		updateChladniModes();
		settleSpeed = SETTLE_SPEED_BOOST;
		migrateTimer = 90;
		if (particles.length === 0) initParticles();
	});

	// ── State machine ──
	$effect(() => {
		switch (vizPhase) {
			case 'rest':
				morphTarget = 0;
				wrongTarget = 0;
				targetR = 194; targetG = 254; targetB = 12;
				transitionActive = false;
				break;
			case 'playing':
			case 'playing-a':
			case 'playing-b':
				morphTarget = 1;
				wrongTarget = 0;
				targetR = 194; targetG = 254; targetB = 12;
				if (!analyserRef) {
					try {
						const { analyser, dataArray } = getAnalyser();
						analyserRef = analyser;
						dataArrayRef = dataArray;
					} catch { /* not ready */ }
				}
				break;
			case 'correct':
				morphTarget = 0; // snap to circle (consonance = resolution)
				wrongTarget = 0;
				targetR = 0; targetG = 255; targetB = 136;
				bloomT = 1;
				// Chladni: boost migration
				settleSpeed = SETTLE_SPEED_BOOST;
				migrateTimer = 120;
				break;
			case 'wrong':
				wrongTarget = 1; // destabilize to harmonograph
				targetR = 194; targetG = 254; targetB = 12; // stay accent, dim via wrong
				// Random dissonant frequencies
				wrongFreqs = [
					1 + Math.random() * 2,
					1.3 + Math.random() * 1.5,
					0.7 + Math.random() * 2,
				];
				// Chladni: scatter
				scatterTimer = 30;
				const TAU = Math.PI * 2;
				for (const p of particles) {
					p.x += (Math.random() - 0.5) * 0.5;
					p.y += (Math.random() - 0.5) * 0.5;
					if (p.x < 0) p.x += TAU;
					if (p.x > TAU) p.x -= TAU;
					if (p.y < 0) p.y += TAU;
					if (p.y > TAU) p.y -= TAU;
				}
				break;
			case 'transition':
				morphTarget = 0;
				wrongTarget = 0;
				targetR = 194; targetG = 254; targetB = 12;
				transitionActive = true;
				transitionT = 0;
				break;
		}
	});

	onMount(() => {
		const ctx = canvas.getContext('2d')!;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);

		function resize() {
			const rect = canvas.getBoundingClientRect();
			canvas.width = rect.width * dpr;
			canvas.height = rect.height * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			generateNoise(Math.ceil(rect.width), Math.ceil(rect.height));
		}

		resize();
		window.addEventListener('resize', resize);
		const ro = new ResizeObserver(() => resize());
		ro.observe(canvas);
		initParticles();

		let frameCount = 0;

		function draw() {
			const w = canvas.width / dpr;
			const h = canvas.height / dpr;
			const cx = w / 2;
			const cy = h / 2;
			const fx = targetFx;
			const fy = targetFy;

			// ── Audio amplitude ──
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

			// ── Morph / wrong / color interpolation ──
			morphT += (morphTarget - morphT) * 0.08;
			wrongT += (wrongTarget - wrongT) * 0.05;
			colorR += (targetR - colorR) * COLOR_LERP;
			colorG += (targetG - colorG) * COLOR_LERP;
			colorB += (targetB - colorB) * COLOR_LERP;
			const strokeColor = `rgb(${Math.round(colorR)}, ${Math.round(colorG)}, ${Math.round(colorB)})`;

			if (bloomT > 0) bloomT -= 0.02;

			// Transition: morph progress → call ontransitionend when settled
			if (transitionActive) {
				transitionT += 0.02;
				if (transitionT >= 1 && morphT < 0.05 && wrongT < 0.05) {
					transitionActive = false;
					ontransitionend?.();
				}
			}

			const drawFx = 1 + (fx - 1) * morphT;
			const drawFy = 1 + (fy - 1) * morphT;
			const radius = Math.min(cx, cy) * 0.35 * radiusPulse; // Lissajous in center area

			// Speed
			const maxRatio = Math.max(fx, fy);
			const speed = BASE_SPEED / maxRatio;

			// Trail step
			const circleStep = (Math.PI * 2) / TRAIL_POINTS;
			const activeStep = (Math.PI * 2 * TARGET_LOOPS / maxRatio) / TRAIL_POINTS;
			const currentStep = circleStep + (activeStep - circleStep) * morphT;

			// ── CLEAR ──
			ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
			ctx.fillRect(0, 0, w, h);

			// ── Migration / scatter decay ──
			if (migrateTimer > 0) {
				migrateTimer--;
				if (migrateTimer < 30) {
					settleSpeed = SETTLE_SPEED_BASE + (SETTLE_SPEED_BOOST - SETTLE_SPEED_BASE) * (migrateTimer / 30);
				}
				if (migrateTimer === 0) settleSpeed = SETTLE_SPEED_BASE;
			}
			const scatterBoost = scatterTimer > 0 ? 0.03 : 0;
			if (scatterTimer > 0) scatterTimer--;

			// ── CHLADNI PARTICLES ──
			const TAU = Math.PI * 2;
			const currentShake = SHAKE_BASE + amp * SHAKE_AUDIO + scatterBoost;
			const migrating = migrateTimer > 0;
			const modes = currentModes;

			ctx.shadowColor = '#3A2CFF';
			ctx.shadowBlur = 2;

			for (const p of particles) {
				const val = useSuperposition
					? chladniSuper(p.x, p.y, modes)
					: chladni(p.x, p.y, modes[0].n, modes[0].m);
				const [gx, gy] = useSuperposition
					? chladniGradSuper(p.x, p.y, modes)
					: chladniGrad(p.x, p.y, modes[0].n, modes[0].m);

				p.x -= gx * val * settleSpeed;
				p.y -= gy * val * settleSpeed;

				const nearLine = Math.max(0.3, 1 - Math.abs(val) * 3);
				const shakeAmp = currentShake * nearLine;
				p.x += (Math.random() - 0.5) * shakeAmp;
				p.y += (Math.random() - 0.5) * shakeAmp;
				p.x += (Math.random() - 0.5) * JITTER;
				p.y += (Math.random() - 0.5) * JITTER;

				if (p.x < 0) p.x += TAU;
				if (p.x > TAU) p.x -= TAU;
				if (p.y < 0) p.y += TAU;
				if (p.y > TAU) p.y -= TAU;

				const sx = (p.x / TAU) * w;
				const sy = (p.y / TAU) * h;
				const dist = Math.abs(val);
				const migrateGlow = migrating ? 0.3 * (dist * 2) : 0;
				const alpha = Math.min(0.6, Math.max(0.05, 0.4 - dist * 2) + migrateGlow);

				ctx.globalAlpha = alpha;
				ctx.fillStyle = migrating ? '#5A4CFF' : '#3A2CFF';
				ctx.fillRect(sx, sy, migrating ? 1.6 : 1.2, migrating ? 1.6 : 1.2);
			}
			ctx.globalAlpha = 1;
			ctx.shadowBlur = 0;

			// ── LISSAJOUS SHAPE ──
			// Countdown: trail erases from tail
			const visiblePoints = countdownPct >= 0
				? Math.max(1, Math.floor(TRAIL_POINTS * Math.max(0, countdownPct)))
				: TRAIL_POINTS;

			// Wrong state dimming
			const wrongDim = 1 - wrongT * 0.5;

			// Bloom glow
			if (bloomT > 0.01) {
				const bloomRadius = radius * (1 + bloomT * 0.4);
				const grad = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, bloomRadius * 1.3);
				grad.addColorStop(0, `rgba(${Math.round(colorR)}, ${Math.round(colorG)}, ${Math.round(colorB)}, ${0.25 * bloomT})`);
				grad.addColorStop(0.6, `rgba(${Math.round(colorR)}, ${Math.round(colorG)}, ${Math.round(colorB)}, ${0.08 * bloomT})`);
				grad.addColorStop(1, `rgba(${Math.round(colorR)}, ${Math.round(colorG)}, ${Math.round(colorB)}, 0)`);
				ctx.fillStyle = grad;
				ctx.fillRect(0, 0, w, h);
			}

			// Compute trail points
			const lissPoints: [number, number][] = [];
			for (let i = 0; i < visiblePoints; i++) {
				const tt = t - i * currentStep;
				let px: number, py: number;

				// Blend between clean Lissajous and harmonograph chaos
				if (wrongT > 0.01) {
					// Clean Lissajous position
					const pointMorph = Math.max(0, morphT - (i / TRAIL_POINTS) * 0.3);
					const ptFx = 1 + (fx - 1) * pointMorph;
					const ptFy = 1 + (fy - 1) * pointMorph;
					const cleanX = radius * Math.sin(ptFx * tt + PHASE_DELTA);
					const cleanY = radius * Math.sin(ptFy * tt);

					// Harmonograph chaos position
					const [hx, hy] = harmonograph3D(tt, wrongFreqs, radius, PHASE_DELTA, 0);

					// Blend
					px = cleanX * (1 - wrongT) + hx * wrongT;
					py = cleanY * (1 - wrongT) + hy * wrongT;
				} else if (transitionActive) {
					// Transition: brief chaos then settle
					const chaos = Math.max(0, 1 - transitionT * 2); // chaos decays quickly
					const pointMorph = Math.max(0, morphT - (i / TRAIL_POINTS) * 0.3);
					const ptFx = 1 + (fx - 1) * pointMorph;
					const ptFy = 1 + (fy - 1) * pointMorph;
					const cleanX = radius * Math.sin(ptFx * tt + PHASE_DELTA);
					const cleanY = radius * Math.sin(ptFy * tt);
					const noise = chaos * Math.sin(i * 0.5 + t * 12) * 15;
					px = cleanX + noise;
					py = cleanY + noise * 0.6;
				} else {
					// Normal: per-point morph (head leads, tail follows)
					const pointMorph = Math.max(0, morphT - (i / TRAIL_POINTS) * 0.3);
					const ptFx = 1 + (fx - 1) * pointMorph;
					const ptFy = 1 + (fy - 1) * pointMorph;
					px = radius * Math.sin(ptFx * tt + PHASE_DELTA);
					py = radius * Math.sin(ptFy * tt);
				}

				lissPoints.push([px, py]);
			}

			// 4-way mirrors (from lab)
			const mirrors: [number, number, number][] = [
				[1, 1, 0.85],
				[-1, 1, 0.5],
				[1, -1, 0.5],
				[-1, -1, 0.35],
			];

			ctx.strokeStyle = strokeColor;
			ctx.shadowColor = strokeColor;

			for (const [mx, my, baseAlpha] of mirrors) {
				const mirrorAlpha = baseAlpha * wrongDim;
				if (mirrorAlpha < 0.02) continue;

				// Pass 1: outer glow
				ctx.beginPath();
				for (let i = 0; i < lissPoints.length; i++) {
					const x = cx + mx * lissPoints[i][0];
					const y = cy + my * lissPoints[i][1];
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				ctx.lineWidth = 3;
				ctx.globalAlpha = 0.1 * mirrorAlpha;
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

			// Head dot
			if (wrongT < 0.8 && visiblePoints > 10) {
				const headX = cx + radius * Math.sin(drawFx * t + PHASE_DELTA);
				const headY = cy + radius * Math.sin(drawFy * t);
				ctx.beginPath();
				ctx.arc(headX, headY, 3, 0, Math.PI * 2);
				ctx.fillStyle = strokeColor;
				ctx.shadowColor = strokeColor;
				ctx.shadowBlur = 6 + glowBoost + bloomT * 10;
				ctx.globalAlpha = 1 - wrongT;
				ctx.fill();
				ctx.globalAlpha = 1;
				ctx.shadowBlur = 0;
			}

			// ── NOISE GRAIN ──
			if (noiseCanvas && frameCount % 3 === 0) {
				refreshNoise(Math.ceil(w), Math.ceil(h));
				ctx.globalAlpha = 0.5;
				ctx.drawImage(noiseCanvas, 0, 0, w, h);
				ctx.globalAlpha = 1;
			}

			// ── VIGNETTE ──
			const vigR = Math.min(cx, cy) * 0.5;
			const vigGrad = ctx.createRadialGradient(cx, cy, vigR, cx, cy, Math.max(w, h) * 0.72);
			vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
			vigGrad.addColorStop(0.7, 'rgba(0,0,0,0.15)');
			vigGrad.addColorStop(1, 'rgba(0,0,0,0.55)');
			ctx.fillStyle = vigGrad;
			ctx.fillRect(0, 0, w, h);

			// ── SCANLINE FLICKER ──
			if (frameCount % 120 < 2) {
				const glitchY = Math.random() * h;
				ctx.fillStyle = 'rgba(194, 254, 12, 0.03)';
				ctx.fillRect(0, glitchY, w, 1);
			}

			t += speed;
			frameCount++;
			animId = requestAnimationFrame(draw);
		}

		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		draw();

		return () => {
			cancelAnimationFrame(animId);
			window.removeEventListener('resize', resize);
			ro.disconnect();
		};
	});

	onDestroy(() => {
		if (animId) cancelAnimationFrame(animId);
	});
</script>

<div class="viz-layout">
	<!-- Full-viewport canvas — pointer-events: none so UI is tappable -->
	<canvas bind:this={canvas} class="viz-canvas"></canvas>

	<!-- Quiz UI overlay — pointer-events: auto on children -->
	<div class="viz-overlay">
		{#if children}
			{@render children()}
		{/if}
	</div>
</div>

<style>
	.viz-layout {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: #000;
	}
	.viz-canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 0;
	}
	.viz-overlay {
		position: relative;
		z-index: 1;
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		pointer-events: none;
	}
	/* Children get pointer-events back */
	.viz-overlay :global(*) {
		pointer-events: auto;
	}
</style>
