<script lang="ts">
	import { onMount } from 'svelte';
	import { getRatio, chladni, chladniGrad } from '$lib/viz';
	import { getAnalyser, getAmplitude } from '$lib/audio';

	interface Props {
		intervalId?: string;
		playing?: boolean;
		size?: number;
	}
	let { intervalId = 'P5', playing = false, size = 200 }: Props = $props();

	let canvas: HTMLCanvasElement;
	let animId: number;
	let phase = 0;

	// Audio analyser — initialized on first play
	let analyserRef: AnalyserNode | null = null;
	let dataArrayRef: Uint8Array | null = null;

	// Chladni particles
	const PARTICLE_COUNT = 800;
	const SETTLE_SPEED_BASE = 0.004;
	const SETTLE_SPEED_BOOST = 0.025;
	let particles: { x: number; y: number }[] = [];
	let settleSpeed = SETTLE_SPEED_BASE;
	let migrateTimer = 0;

	// Track current ratio for draw loop
	let currentFx = $state(getRatio('P5')[0]);
	let currentFy = $state(getRatio('P5')[1]);

	function initParticles() {
		particles = [];
		const TAU = Math.PI * 2;
		for (let i = 0; i < PARTICLE_COUNT; i++) {
			particles.push({ x: Math.random() * TAU, y: Math.random() * TAU });
		}
	}

	// React to interval changes
	$effect(() => {
		const [fx, fy] = getRatio(intervalId);
		currentFx = fx;
		currentFy = fy;
		settleSpeed = SETTLE_SPEED_BOOST;
		migrateTimer = 90;
		if (particles.length === 0) initParticles();
	});

	// Init analyser when playing starts
	$effect(() => {
		if (playing && !analyserRef) {
			try {
				const { analyser, dataArray } = getAnalyser();
				analyserRef = analyser;
				dataArrayRef = dataArray;
			} catch { /* audio not ready yet */ }
		}
	});

	onMount(() => {
		const ctx = canvas.getContext('2d')!;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);

		canvas.width = size * dpr;
		canvas.height = size * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		initParticles();

		const PHASE_DELTA = Math.PI / 2;
		const LOOP_POINTS = 300;
		const BASE_SPEED = 0.003;

		function draw() {
			const w = size;
			const h = size;
			const cx = w / 2;
			const cy = h / 2;
			const radius = Math.min(cx, cy) * 0.75;
			const fx = currentFx;
			const fy = currentFy;

			// Audio amplitude
			let amp = 0;
			if (analyserRef && dataArrayRef) {
				amp = Math.min(1, getAmplitude(analyserRef, dataArrayRef) * 3);
			}
			const radiusPulse = 1 + amp * 0.1;
			const glowBoost = amp * 8;
			const rx = radius * radiusPulse;
			const ry = radius * radiusPulse;

			// Speed scaled by ratio complexity
			const speed = BASE_SPEED / Math.max(fx, fy);

			// Clear
			ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
			ctx.fillRect(0, 0, w, h);

			// Migration decay
			if (migrateTimer > 0) {
				migrateTimer--;
				if (migrateTimer < 20) {
					settleSpeed = SETTLE_SPEED_BASE + (SETTLE_SPEED_BOOST - SETTLE_SPEED_BASE) * (migrateTimer / 20);
				}
				if (migrateTimer === 0) settleSpeed = SETTLE_SPEED_BASE;
			}

			// --- Chladni particles ---
			const TAU = Math.PI * 2;
			const migrateIntensity = migrateTimer > 20 ? 1 : migrateTimer / 20;
			for (const p of particles) {
				const val = chladni(p.x, p.y, fx, fy);
				const [gx, gy] = chladniGrad(p.x, p.y, fx, fy);
				p.x -= gx * val * settleSpeed;
				p.y -= gy * val * settleSpeed;
				p.x += (Math.random() - 0.5) * 0.002;
				p.y += (Math.random() - 0.5) * 0.002;
				if (p.x < 0) p.x += TAU;
				if (p.x > TAU) p.x -= TAU;
				if (p.y < 0) p.y += TAU;
				if (p.y > TAU) p.y -= TAU;

				const sx = (p.x / TAU) * w;
				const sy = (p.y / TAU) * h;
				const dist = Math.abs(val);
				const alpha = Math.min(1, Math.max(0.05, 0.5 - dist * 2) + migrateIntensity * 0.2);
				ctx.globalAlpha = alpha;
				ctx.fillStyle = migrateIntensity > 0.1 ? '#5A4CFF' : '#3A2CFF';
				ctx.fillRect(sx, sy, 1, 1);
			}
			ctx.globalAlpha = 1;

			// --- 4-way mirrored Lissajous ---
			// Compute points once
			const pts: { x: number; y: number }[] = [];
			const sweepEnd = Math.PI * 2;
			for (let i = 0; i <= LOOP_POINTS; i++) {
				const t = (i / LOOP_POINTS) * sweepEnd;
				pts.push({
					x: rx * Math.sin(fx * t + PHASE_DELTA),
					y: ry * Math.sin(fy * t),
				});
			}

			// Draw 4 mirrors via canvas transform
			ctx.strokeStyle = '#C2FE0C';
			ctx.lineWidth = 1;
			ctx.shadowColor = '#C2FE0C';
			ctx.shadowBlur = 3 + glowBoost;
			ctx.globalAlpha = 0.8;

			const mirrors = [
				[1, 1], [-1, 1], [1, -1], [-1, -1]
			];

			for (const [sx, sy] of mirrors) {
				ctx.save();
				ctx.translate(cx, cy);
				ctx.scale(sx, sy);
				ctx.rotate(phase);
				ctx.beginPath();
				for (let i = 0; i < pts.length; i++) {
					if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
					else ctx.lineTo(pts[i].x, pts[i].y);
				}
				ctx.closePath();
				ctx.stroke();
				ctx.restore();
			}

			ctx.globalAlpha = 1;
			ctx.shadowBlur = 0;

			// --- Vignette ---
			const vig = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius * 1.1);
			vig.addColorStop(0, 'rgba(0,0,0,0)');
			vig.addColorStop(1, 'rgba(0,0,0,0.5)');
			ctx.fillStyle = vig;
			ctx.fillRect(0, 0, w, h);

			phase += speed;
			animId = requestAnimationFrame(draw);
		}

		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Pause animation when page is hidden (saves CPU/battery)
		let animPaused = false;
		function handleVisibility() {
			if (document.hidden) {
				animPaused = true;
				cancelAnimationFrame(animId);
			} else if (animPaused) {
				animPaused = false;
				animId = requestAnimationFrame(draw);
			}
		}
		document.addEventListener('visibilitychange', handleVisibility);

		draw();

		return () => {
			cancelAnimationFrame(animId);
			document.removeEventListener('visibilitychange', handleVisibility);
		};
	});
</script>

<canvas
	bind:this={canvas}
	class="quiz-viz"
	style="width: {size}px; height: {size}px;"
></canvas>

<style>
	.quiz-viz {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		z-index: 0;
		pointer-events: none;
	}
</style>
