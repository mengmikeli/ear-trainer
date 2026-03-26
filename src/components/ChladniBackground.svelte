<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { chladni, chladniGrad, midiToChladniMode } from '$lib/viz';
	import { getAnalyser, getAmplitude } from '$lib/audio';

	interface Props {
		/** Current semitones — drives Chladni pattern */
		semitones?: number;
		/** Chord intervals (multi-mode superposition) */
		chordIntervals?: number[];
		/** Scale intervals (multi-mode superposition) */
		scaleIntervals?: number[];
		/** Whether audio is playing */
		playing?: boolean;
		/** Glitch transition */
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

	// Particle system
	const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
	const PARTICLE_COUNT = isMobile ? 800 : 2000;
	const SETTLE_SPEED_BASE = 0.003;
	const SETTLE_SPEED_BOOST = 0.02;
	const JITTER = 0.001;
	let particles: { x: number; y: number }[] = [];
	let settleSpeed = SETTLE_SPEED_BASE;
	let migrateTimer = 0;

	// Current Chladni mode
	let currentN = 1;
	let currentM = 1;

	function initParticles() {
		particles = [];
		const TAU = Math.PI * 2;
		for (let i = 0; i < PARTICLE_COUNT; i++) {
			particles.push({ x: Math.random() * TAU, y: Math.random() * TAU });
		}
	}

	function getChladniMode(): [number, number] {
		if (chordIntervals && chordIntervals.length > 1) {
			// Use the root + largest interval
			const maxSt = Math.max(...chordIntervals);
			return midiToChladniMode(60 + maxSt);
		}
		if (scaleIntervals && scaleIntervals.length > 1) {
			// Use the characteristic degree
			const filtered = scaleIntervals.filter(s => s > 0 && s < 12);
			const dominant = filtered.includes(7) ? 7 : Math.max(...filtered, 0);
			return midiToChladniMode(60 + dominant);
		}
		return midiToChladniMode(60 + semitones);
	}

	// React to interval changes
	$effect(() => {
		const _s = semitones;
		const _c = chordIntervals;
		const _sc = scaleIntervals;
		const [n, m] = getChladniMode();
		currentN = n;
		currentM = m;
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

	onMount(() => {
		const ctx = canvas.getContext('2d')!;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);

		function resize() {
			const rect = canvas.getBoundingClientRect();
			canvas.width = rect.width * dpr;
			canvas.height = rect.height * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		}

		resize();
		window.addEventListener('resize', resize);
		const ro = new ResizeObserver(() => resize());
		ro.observe(canvas);
		initParticles();

		function draw() {
			const w = canvas.width / dpr;
			const h = canvas.height / dpr;

			// Audio amplitude
			let amp = 0;
			if (analyserRef && dataArrayRef) {
				amp = Math.min(1, getAmplitude(analyserRef, dataArrayRef) * 3);
			}

			// Soft fade
			ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
			ctx.fillRect(0, 0, w, h);

			// Migration timer decay
			if (migrateTimer > 0) {
				migrateTimer--;
				if (migrateTimer < 25) {
					settleSpeed = SETTLE_SPEED_BASE + (SETTLE_SPEED_BOOST - SETTLE_SPEED_BASE) * (migrateTimer / 25);
				}
				if (migrateTimer === 0) settleSpeed = SETTLE_SPEED_BASE;
			}

			// Glitch: stronger jitter + color shift
			const glitchBoost = glitching ? 0.015 : 0;
			const particleColor = glitching ? '#5A4CFF' : (migrateTimer > 0 ? '#4A3CFF' : '#2A1CFF');

			const TAU = Math.PI * 2;
			const SHAKE_BASE = 0.015;
			const SHAKE_AUDIO = 0.04;
			const currentShake = SHAKE_BASE + amp * SHAKE_AUDIO + glitchBoost;

			ctx.shadowColor = '#3A2CFF';
			ctx.shadowBlur = 1;

			for (const p of particles) {
				const val = chladni(p.x, p.y, currentN, currentM);
				const [gx, gy] = chladniGrad(p.x, p.y, currentN, currentM);

				// Drift toward nodal lines
				p.x -= gx * val * settleSpeed;
				p.y -= gy * val * settleSpeed;

				// Shake
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
				const alpha = Math.min(0.35, Math.max(0.03, 0.25 - dist * 2));

				ctx.globalAlpha = alpha;
				ctx.fillStyle = particleColor;
				ctx.fillRect(sx, sy, 1.2, 1.2);
			}

			ctx.globalAlpha = 1;
			ctx.shadowBlur = 0;

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
