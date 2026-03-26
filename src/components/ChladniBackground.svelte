<script lang="ts">
	/**
	 * ChladniBackground — Full-screen Chladni particle background.
	 * Extracted from lab pages. Same constants, same drift/shake/migration logic.
	 *
	 * Usage:
	 *   <ChladniBackground {semitones} {playing} {glitching} />           — intervals
	 *   <ChladniBackground {chordIntervals} {playing} {glitching} />      — chords (superposition)
	 *   <ChladniBackground {scaleIntervals} {playing} {glitching} />      — scales (per-note modes)
	 */
	import { onMount, onDestroy } from 'svelte';
	import { chladni, chladniGrad, chladniSuper, chladniGradSuper, chordToModes, midiToChladniMode } from '$lib/viz';
	import type { ChladniMode } from '$lib/viz';
	import { getAnalyser, getAmplitude } from '$lib/audio';

	interface Props {
		semitones?: number;
		chordIntervals?: number[];
		scaleIntervals?: number[];
		playing?: boolean;
		glitching?: boolean;
	}

	let {
		semitones = 0,
		chordIntervals,
		scaleIntervals,
		playing = false,
		glitching = false,
	}: Props = $props();

	let canvas: HTMLCanvasElement;
	let animId: number;

	// Audio analyser
	let analyserRef: AnalyserNode | null = null;
	let dataArrayRef: Uint8Array | null = null;

	// ── Constants — matched to lab pages ──
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

	// Current mode(s) for the draw loop
	let currentModes: ChladniMode[] = [{ n: 1, m: 1, amp: 1 }];
	let useSuperposition = false;

	function initParticles() {
		particles = [];
		const TAU = Math.PI * 2;
		for (let i = 0; i < PARTICLE_COUNT; i++) {
			particles.push({ x: Math.random() * TAU, y: Math.random() * TAU });
		}
	}

	function updateModes() {
		if (chordIntervals && chordIntervals.length > 1) {
			// Chord: superposition of all chord tones
			currentModes = chordToModes(60, chordIntervals);
			useSuperposition = true;
		} else if (scaleIntervals && scaleIntervals.length > 1) {
			// Scale: use dominant degree (5th if present, else largest sub-octave)
			const filtered = scaleIntervals.filter(s => s > 0 && s < 12);
			const dominant = filtered.includes(7) ? 7 : Math.max(...filtered, 0);
			const [n, m] = midiToChladniMode(60 + dominant);
			currentModes = [{ n, m, amp: 1 }];
			useSuperposition = false;
		} else {
			// Interval: single mode
			const [n, m] = midiToChladniMode(60 + semitones);
			currentModes = [{ n, m, amp: 1 }];
			useSuperposition = false;
		}
	}

	// React to prop changes — boost migration
	$effect(() => {
		const _s = semitones;
		const _c = chordIntervals;
		const _sc = scaleIntervals;
		updateModes();
		settleSpeed = SETTLE_SPEED_BOOST;
		migrateTimer = 90;
		if (particles.length === 0) initParticles();
	});

	// Init analyser when playing
	$effect(() => {
		if (playing && !analyserRef) {
			try {
				const { analyser, dataArray } = getAnalyser();
				analyserRef = analyser;
				dataArrayRef = dataArray;
			} catch { /* not ready */ }
		}
	});

	// Noise texture (matches lab)
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

			// Audio amplitude
			let amplitude = 0;
			if (analyserRef && dataArrayRef) {
				amplitude = getAmplitude(analyserRef, dataArrayRef);
			}
			const amp = Math.min(1, amplitude * 3);

			// Fade
			ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
			ctx.fillRect(0, 0, w, h);

			// Migration timer decay (same as lab)
			if (migrateTimer > 0) {
				migrateTimer--;
				if (migrateTimer < 30) {
					const t = migrateTimer / 30;
					settleSpeed = SETTLE_SPEED_BASE + (SETTLE_SPEED_BOOST - SETTLE_SPEED_BASE) * t;
				}
				if (migrateTimer === 0) settleSpeed = SETTLE_SPEED_BASE;
			}

			// Glitch: extra jitter
			const glitchBoost = glitching ? 0.015 : 0;
			const currentShake = SHAKE_BASE + amp * SHAKE_AUDIO + glitchBoost;
			const migrating = migrateTimer > 0;

			const TAU = Math.PI * 2;
			const modes = currentModes;

			ctx.shadowColor = '#3A2CFF';
			ctx.shadowBlur = 2;

			for (const p of particles) {
				// Use superposition or single mode (same as lab pages)
				const val = useSuperposition
					? chladniSuper(p.x, p.y, modes)
					: chladni(p.x, p.y, modes[0].n, modes[0].m);
				const [gx, gy] = useSuperposition
					? chladniGradSuper(p.x, p.y, modes)
					: chladniGrad(p.x, p.y, modes[0].n, modes[0].m);

				// Drift toward nodal lines
				p.x -= gx * val * settleSpeed;
				p.y -= gy * val * settleSpeed;

				// Micro-shake — stronger near nodal lines + audio reactive
				const nearLine = Math.max(0.3, 1 - Math.abs(val) * 3);
				const shakeAmp = currentShake * nearLine;
				p.x += (Math.random() - 0.5) * shakeAmp;
				p.y += (Math.random() - 0.5) * shakeAmp;

				// Jitter
				p.x += (Math.random() - 0.5) * JITTER;
				p.y += (Math.random() - 0.5) * JITTER;

				// Wrap
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
				const pSize = migrating ? 1.6 : 1.2;
				ctx.fillRect(sx, sy, pSize, pSize);
			}
			ctx.globalAlpha = 1;
			ctx.shadowBlur = 0;

			// Noise grain (every 3rd frame, same as lab)
			if (noiseCanvas && frameCount % 3 === 0) {
				refreshNoise(Math.ceil(w), Math.ceil(h));
				ctx.globalAlpha = 0.5;
				ctx.drawImage(noiseCanvas, 0, 0, w, h);
				ctx.globalAlpha = 1;
			}

			// Vignette (same as lab)
			const vigR = Math.min(cx, cy) * 0.5;
			const vigGrad = ctx.createRadialGradient(cx, cy, vigR, cx, cy, Math.max(w, h) * 0.72);
			vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
			vigGrad.addColorStop(0.7, 'rgba(0,0,0,0.15)');
			vigGrad.addColorStop(1, 'rgba(0,0,0,0.55)');
			ctx.fillStyle = vigGrad;
			ctx.fillRect(0, 0, w, h);

			// Scanline flicker (same as lab)
			if (frameCount % 120 < 2) {
				const glitchY = Math.random() * h;
				ctx.fillStyle = 'rgba(194, 254, 12, 0.03)';
				ctx.fillRect(0, glitchY, w, 1);
			}

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

<canvas bind:this={canvas} class="chladni-bg"></canvas>

<style>
	.chladni-bg {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100dvh;
		z-index: 0;
		pointer-events: none;
		opacity: 0.6;
	}
</style>
