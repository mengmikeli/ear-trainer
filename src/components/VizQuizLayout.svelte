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
		/** Currently sounding MIDI notes — drives Chladni pattern in sync with audio */
		playingNotes?: number[];
		/** Content overlaid inside the canvas viewport (e.g. Q# tap target) */
		children?: import('svelte').Snippet;
	}

	let {
		mode = 'interval',
		phase: vizPhase = 'rest',
		semitones = 0,
		chordIntervals,
		scaleIntervals,
		countdownPct = -1,
		playingNotes = [] as number[],
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
	const sv = JSON.parse(localStorage.getItem('ear-trainer-state') || '{}')?.settings?.superchargeViz;
	const PARTICLE_COUNT = isMobile ? (sv ? 1500 : 0) : (sv === false ? 0 : 3500);
	const SETTLE_SPEED_BASE = 0.003;
	const SETTLE_SPEED_BOOST = 0.025;
	const JITTER = 0.001;
	const SHAKE_BASE = 0.02;
	const SHAKE_AUDIO = 0.05;
	let particles: { x: number; y: number }[] = [];
	let settleSpeed = SETTLE_SPEED_BASE;
	let migrateTimer = 0;

	// Chladni mode — single mode for intervals, superposition for chords, sequential for scales
	let chladniN = $state(1);
	let chladniM = $state(1);
	let chladniModes: ChladniMode[] = []; // for chord superposition
	let useSuperposition = false;
	let chladniDriftEnabled = false; // plain mutable — set by $effect, read by rAF draw loop
	let chladniTimer: ReturnType<typeof setTimeout> | null = null;
	let scaleStepTimers: ReturnType<typeof setTimeout>[] = [];

	function initParticles() {
		particles = [];
		const TAU = Math.PI * 2;
		for (let i = 0; i < PARTICLE_COUNT; i++) {
			particles.push({ x: Math.random() * TAU, y: Math.random() * TAU });
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

	// ── React to interval/chord/scale changes (Lissajous ratio only) ──
	$effect(() => {
		const _s = semitones;
		const _c = chordIntervals;
		const _sc = scaleIntervals;
		const [fx, fy] = getTargetRatio();
		targetFx = fx;
		targetFy = fy;
		// Chladni modes ONLY update via playingNotes — not here (prevents ghost on mount)
		if (particles.length === 0) initParticles();
	});

	// ── Chladni driven by playingNotes (synced to actual audio) ──
	$effect(() => {
		const notes = playingNotes;
		if (!notes || notes.length === 0) {
			chladniDriftEnabled = false;
			return;
		}

		chladniDriftEnabled = true;

		if (notes.length === 1) {
			// Single note → single Chladni mode
			useSuperposition = false;
			const [n, m] = midiToChladniMode(notes[0]);
			chladniN = n;
			chladniM = m;
		} else {
			// Multiple notes → superposition
			useSuperposition = true;
			chladniModes = notes.map(midi => {
				const [n, m] = midiToChladniMode(midi);
				return { n, m, amp: 1 };
			});
		}
		// Migration burst — synced to note onset
		chladniDriftEnabled = true;
		settleSpeed = SETTLE_SPEED_BOOST;
		migrateTimer = 90;
	});

	// ── State machine (P1 ring static, Chladni driven by playingNotes) ──
	$effect(() => {
		// Ring stays P1 circle + accent color always
		morphTarget = 0;
		wrongTarget = 0;
		targetR = 194; targetG = 254; targetB = 12;

		if (vizPhase === 'playing' || vizPhase === 'playing-a' || vizPhase === 'playing-b') {
			// Init analyser
			if (!analyserRef) {
				try {
					const { analyser, dataArray } = getAnalyser();
					analyserRef = analyser;
					dataArrayRef = dataArray;
				} catch { /* not ready */ }
			}
			// Chladni is now driven by playingNotes prop — no timers here
		}
		if (vizPhase === 'transition') {
			transitionActive = true;
			transitionT = 0;
		} else {
			transitionActive = false;
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
			const radius = Math.min(cx, cy) * 0.70 * radiusPulse; // 10% smaller than lab

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

			// ── Migration decay (Chladni reacts to note changes) ──
			if (migrateTimer > 0) {
				migrateTimer--;
				if (migrateTimer < 30) {
					settleSpeed = SETTLE_SPEED_BASE + (SETTLE_SPEED_BOOST - SETTLE_SPEED_BASE) * (migrateTimer / 30);
				}
				if (migrateTimer === 0) settleSpeed = SETTLE_SPEED_BASE;
			}

			// ── CHLADNI PARTICLES (audio-reactive, disabled on mobile) ──
			if (particles.length > 0) {
			const chladniActive = chladniDriftEnabled;
			const TAU = Math.PI * 2;
			const currentShake = SHAKE_BASE + amp * SHAKE_AUDIO;
			const migrating = migrateTimer > 0;

			ctx.shadowColor = '#3A2CFF';
			ctx.shadowBlur = 2;

			for (const p of particles) {
				if (chladniActive) {
					const val = useSuperposition
						? chladniSuper(p.x, p.y, chladniModes)
						: chladni(p.x, p.y, chladniN, chladniM);
					const [gx, gy] = useSuperposition
						? chladniGradSuper(p.x, p.y, chladniModes)
						: chladniGrad(p.x, p.y, chladniN, chladniM);

					p.x -= gx * val * settleSpeed;
					p.y -= gy * val * settleSpeed;

					const nearLine = Math.max(0.3, 1 - Math.abs(val) * 3);
					const shakeAmp = currentShake * nearLine;
					p.x += (Math.random() - 0.5) * shakeAmp;
					p.y += (Math.random() - 0.5) * shakeAmp;
				}
				// Always apply jitter (keeps particles alive)
				p.x += (Math.random() - 0.5) * JITTER;
				p.y += (Math.random() - 0.5) * JITTER;

				if (p.x < 0) p.x += TAU;
				if (p.x > TAU) p.x -= TAU;
				if (p.y < 0) p.y += TAU;
				if (p.y > TAU) p.y -= TAU;

				const sx = (p.x / TAU) * w;
				const sy = (p.y / TAU) * h;

				// Uniform dim particles when inactive, organized when active
				const alpha = chladniActive ? 0.15 : 0.08;
				ctx.globalAlpha = alpha;
				ctx.fillStyle = migrating ? '#5A4CFF' : '#3A2CFF';
				ctx.fillRect(sx, sy, migrating ? 1.6 : 1.2, migrating ? 1.6 : 1.2);
			}
			ctx.globalAlpha = 1;
			ctx.shadowBlur = 0;
			} // end particles.length > 0

			// Ring + dot now CSS on .play-tap (removed canvas Lissajous)

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

<!-- Contained canvas viewport — lab style with frame corners -->
<div class="canvas-frame">
	<canvas bind:this={canvas} class="viz-canvas"></canvas>
	<!-- Overlay inside viewport (e.g. Q# tap target) -->
	<div class="viz-inner-overlay">
		{#if children}
			{@render children()}
		{/if}
	</div>
	<div class="frame-corner tl"></div>
	<div class="frame-corner tr"></div>
	<div class="frame-corner bl"></div>
	<div class="frame-corner br"></div>
</div>

<style>
	.canvas-frame {
		position: relative;
		flex: 1;
		min-height: 0;
		border: 1px solid var(--border-heavy);
		background: #000;
	}
	.viz-canvas {
		display: block;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	.viz-inner-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		z-index: 1;
	}
	.viz-inner-overlay :global(*) {
		pointer-events: auto;
	}
	.frame-corner {
		position: absolute;
		width: 12px;
		height: 12px;
		border-color: var(--accent);
		border-style: solid;
		opacity: 0.4;
	}
	.frame-corner.tl { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
	.frame-corner.tr { top: -1px; right: -1px; border-width: 2px 2px 0 0; }
	.frame-corner.bl { bottom: -1px; left: -1px; border-width: 0 0 2px 2px; }
	.frame-corner.br { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }
</style>
