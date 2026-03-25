<script lang="ts">
	import { onMount } from 'svelte';

	// Props — frequency ratio from parent
	let { freqA = 3, freqB = 2 }: { freqA?: number; freqB?: number } = $props();

	let canvas: HTMLCanvasElement;
	let animId: number;

	const PARTICLE_COUNT = 3000;
	const SETTLE_SPEED = 0.004;    // how fast particles drift to nodal lines
	const JITTER = 0.001;          // random noise to keep things alive

	// Chladni equation: cos(n*x)*cos(m*y) - cos(m*x)*cos(n*y)
	// Nodal lines are where this equals zero
	function chladni(x: number, y: number, n: number, m: number): number {
		return Math.cos(n * x) * Math.cos(m * y) - Math.cos(m * x) * Math.cos(n * y);
	}

	// Gradient of the Chladni function (for particle drift)
	function chladniGrad(x: number, y: number, n: number, m: number): [number, number] {
		const h = 0.01;
		const dx = (chladni(x + h, y, n, m) - chladni(x - h, y, n, m)) / (2 * h);
		const dy = (chladni(x, y + h, n, m) - chladni(x, y - h, n, m)) / (2 * h);
		return [dx, dy];
	}

	let particles: { x: number; y: number }[] = [];
	let currentN = $state(3);
	let currentM = $state(2);

	function initParticles() {
		particles = [];
		for (let i = 0; i < PARTICLE_COUNT; i++) {
			particles.push({
				x: Math.random() * Math.PI * 2,
				y: Math.random() * Math.PI * 2,
			});
		}
	}

	// React to prop changes — sync to local state for draw loop
	$effect(() => {
		const n = freqA;
		const m = freqB;
		currentN = n;
		currentM = m;
		initParticles();
		if (canvas) {
			const ctx = canvas.getContext('2d');
			if (ctx) {
				ctx.fillStyle = '#000000';
				ctx.fillRect(0, 0, canvas.width, canvas.height);
			}
		}
	});

	onMount(() => {
		const ctx = canvas.getContext('2d')!;
		const dpr = window.devicePixelRatio || 1;

		function resize() {
			const rect = canvas.getBoundingClientRect();
			canvas.width = rect.width * dpr;
			canvas.height = rect.height * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		}

		resize();
		window.addEventListener('resize', resize);
		initParticles();

		function draw() {
			const w = canvas.width / dpr;
			const h = canvas.height / dpr;
			const n = currentN;
			const m = currentM;

			// Soft fade — particles leave faint trails
			ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
			ctx.fillRect(0, 0, w, h);

			// Update + draw particles
			ctx.fillStyle = '#C2FE0C';
			ctx.shadowColor = '#C2FE0C';
			ctx.shadowBlur = 2;

			for (const p of particles) {
				// Compute gradient and drift toward nodal line
				const [gx, gy] = chladniGrad(p.x, p.y, n, m);
				const val = chladni(p.x, p.y, n, m);

				// Move against gradient (toward zero) proportional to value
				p.x -= gx * val * SETTLE_SPEED;
				p.y -= gy * val * SETTLE_SPEED;

				// Add tiny jitter to prevent dead stops
				p.x += (Math.random() - 0.5) * JITTER;
				p.y += (Math.random() - 0.5) * JITTER;

				// Wrap around
				const TAU = Math.PI * 2;
				if (p.x < 0) p.x += TAU;
				if (p.x > TAU) p.x -= TAU;
				if (p.y < 0) p.y += TAU;
				if (p.y > TAU) p.y -= TAU;

				// Map to screen
				const sx = (p.x / TAU) * w;
				const sy = (p.y / TAU) * h;

				// Distance from nodal line = brightness
				const dist = Math.abs(val);
				const alpha = Math.max(0.1, 1 - dist * 2);

				ctx.globalAlpha = alpha;
				ctx.fillRect(sx, sy, 1.2, 1.2);
			}

			ctx.globalAlpha = 1;
			ctx.shadowBlur = 0;

			animId = requestAnimationFrame(draw);
		}

		ctx.fillStyle = '#000000';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		draw();

		return () => {
			cancelAnimationFrame(animId);
			window.removeEventListener('resize', resize);
		};
	});
</script>

<div class="chladni-frame">
	<canvas bind:this={canvas}></canvas>
	<div class="frame-corner tl"></div>
	<div class="frame-corner tr"></div>
	<div class="frame-corner bl"></div>
	<div class="frame-corner br"></div>
</div>

<style>
	.chladni-frame {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		border: 1px solid var(--border-heavy);
		background: #000;
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}

	.frame-corner {
		position: absolute;
		width: 12px;
		height: 12px;
		border-color: var(--hot);
		border-style: solid;
		opacity: 0.4;
	}
	.frame-corner.tl { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
	.frame-corner.tr { top: -1px; right: -1px; border-width: 2px 2px 0 0; }
	.frame-corner.bl { bottom: -1px; left: -1px; border-width: 0 0 2px 2px; }
	.frame-corner.br { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }
</style>
