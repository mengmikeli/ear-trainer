<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { chladniSuper, chladniGradSuper, midiToChladniMode } from '$lib/viz';
	import type { ChladniMode } from '$lib/viz';
	import { getAnalyser, getAmplitude } from '$lib/audio';

	// ── Scale definitions ──
	interface ScaleDef {
		id: string;
		name: string;
		intervals: number[]; // semitones from root
	}

	const SCALES: ScaleDef[] = [
		{ id: 'major', name: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11, 12] },
		{ id: 'minor', name: 'Natural Minor', intervals: [0, 2, 3, 5, 7, 8, 10, 12] },
		{ id: 'harm-minor', name: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11, 12] },
		{ id: 'mel-minor', name: 'Melodic Minor', intervals: [0, 2, 3, 5, 7, 9, 11, 12] },
		{ id: 'dorian', name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10, 12] },
		{ id: 'mixolydian', name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10, 12] },
		{ id: 'penta-maj', name: 'Major Pentatonic', intervals: [0, 2, 4, 7, 9, 12] },
		{ id: 'penta-min', name: 'Minor Pentatonic', intervals: [0, 3, 5, 7, 10, 12] },
		{ id: 'blues', name: 'Blues', intervals: [0, 3, 5, 6, 7, 10, 12] },
		{ id: 'chromatic', name: 'Chromatic', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
	];

	const ROOT_MIDI = 60;

	// ── State ──
	let selected = $state('major');
	let isPlaying = $state(false);
	let currentStep = $state(-1); // -1 = idle, 0..n = playing step
	let mainCanvas: HTMLCanvasElement;
	let animId: number;

	let scale = $derived(SCALES.find(s => s.id === selected)!);

	// ── Particles ──
	const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
	const PARTICLE_COUNT = isMobile ? 1500 : 3500;
	const SETTLE_SPEED_BASE = 0.003;
	const SETTLE_SPEED_BOOST = 0.025;
	const JITTER = 0.001;
	const SHAKE_BASE = 0.012;
	let particles: { x: number; y: number }[] = [];
	let settleSpeed = SETTLE_SPEED_BASE;
	let migrateTimer = 0;

	// ── Ghost trail: offscreen canvas accumulates past positions ──
	let ghostCanvas: HTMLCanvasElement | null = null;
	let ghostCtx: CanvasRenderingContext2D | null = null;

	// ── Playback generation (for aborting mid-play) ──
	let playGeneration = 0;

	// ── Audio ──
	let analyserRef: AnalyserNode | null = null;
	let dataArrayRef: Uint8Array | null = null;
	let amplitude = 0;

	// ── Current mode for draw loop ──
	let currentModes: ChladniMode[] = [{ n: 1, m: 1, amp: 1 }]; // rest state

	function initParticles() {
		particles = [];
		const TAU = Math.PI * 2;
		for (let i = 0; i < PARTICLE_COUNT; i++) {
			particles.push({ x: Math.random() * TAU, y: Math.random() * TAU });
		}
	}

	/** Stamp current particle positions onto ghost canvas */
	function stampGhost(w: number, h: number, color: string, alpha: number) {
		if (!ghostCtx) return;
		const TAU = Math.PI * 2;
		ghostCtx.fillStyle = color;
		ghostCtx.globalAlpha = alpha;
		for (const p of particles) {
			const sx = (p.x / TAU) * w;
			const sy = (p.y / TAU) * h;
			ghostCtx.fillRect(sx, sy, 1, 1);
		}
		ghostCtx.globalAlpha = 1;
	}

	/** Play the scale sequentially — one mode per step. Interruptible. */
	function playScale() {
		// Abort any in-progress playback
		playGeneration++;
		const thisGen = playGeneration;

		isPlaying = true;
		currentStep = 0;

		// Clear ghost trail
		if (ghostCtx && ghostCanvas) {
			ghostCtx.fillStyle = '#000';
			ghostCtx.fillRect(0, 0, ghostCanvas.width, ghostCanvas.height);
		}

		const intervals = scale.intervals;
		let step = 0;

		function nextStep() {
			// Abort if a newer playScale() was called
			if (thisGen !== playGeneration) return;

			if (step >= intervals.length) {
				currentStep = -1;
				// Short tail pause — same as inter-note gap (500ms)
				setTimeout(() => {
					if (thisGen === playGeneration) isPlaying = false;
				}, 500);
				return;
			}

			const midi = ROOT_MIDI + intervals[step];
			const [n, m] = midiToChladniMode(midi);
			currentModes = [{ n, m, amp: 1 }];
			currentStep = step;

			// Stamp ghost of current position before migration
			if (mainCanvas) {
				const dpr = Math.min(window.devicePixelRatio || 1, 2);
				const w = mainCanvas.width / dpr;
				const h = mainCanvas.height / dpr;
				// Color cycles through scale degrees — blue tones throughout
				const lightness = 40 + (step / intervals.length) * 20; // 40%→60% lightness
				stampGhost(w, h, `hsl(240, 80%, ${lightness}%)`, 0.15);
			}

			// Boost settle for migration
			settleSpeed = SETTLE_SPEED_BOOST;
			migrateTimer = 60;

			// Play the note (simple sine via AudioContext)
			playNote(midi);

			step++;
			setTimeout(nextStep, 500); // 500ms per note
		}

		nextStep();
	}

	/** Simple note playback for scale demo */
	function playNote(midi: number) {
		const freq = 440 * Math.pow(2, (midi - 69) / 12);
		const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
		const osc = audioCtx.createOscillator();
		const gain = audioCtx.createGain();
		osc.type = 'triangle';
		osc.frequency.value = freq;
		gain.gain.setValueAtTime(0, audioCtx.currentTime);
		gain.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + 0.02);
		gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.45);
		osc.connect(gain);
		gain.connect(audioCtx.destination);
		osc.start();
		osc.stop(audioCtx.currentTime + 0.5);
	}

	// React to scale selection change
	let firstRun = true;
	$effect(() => {
		const s = scale;
		// Reset to root mode
		const [n, m] = midiToChladniMode(ROOT_MIDI + s.intervals[0]);
		currentModes = [{ n, m, amp: 1 }];
		settleSpeed = SETTLE_SPEED_BOOST;
		migrateTimer = 90;
		if (particles.length === 0) initParticles();
		// Auto-play on scale switch (skip first load)
		if (!firstRun) {
			// Small delay to let particles resettle before playing
			setTimeout(() => playScale(), 100);
		}
		firstRun = false;
	});

	// ── Noise ──
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
		const ctx = mainCanvas.getContext('2d')!;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);

		// Ghost trail canvas
		ghostCanvas = document.createElement('canvas');
		ghostCtx = ghostCanvas.getContext('2d')!;

		function resize() {
			const rect = mainCanvas.getBoundingClientRect();
			const pw = rect.width * dpr;
			const ph = rect.height * dpr;
			mainCanvas.width = pw;
			mainCanvas.height = ph;
			ghostCanvas!.width = pw;
			ghostCanvas!.height = ph;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ghostCtx!.setTransform(dpr, 0, 0, dpr, 0, 0);
			generateNoise(Math.ceil(rect.width), Math.ceil(rect.height));
		}

		resize();
		window.addEventListener('resize', resize);
		initParticles();

		let frameCount = 0;

		function draw() {
			const w = mainCanvas.width / dpr;
			const h = mainCanvas.height / dpr;

			// Audio amplitude
			if (analyserRef && dataArrayRef) {
				amplitude = getAmplitude(analyserRef, dataArrayRef);
			} else {
				amplitude *= 0.95;
			}

			// Fade
			ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
			ctx.fillRect(0, 0, w, h);

			// Migration timer decay
			if (migrateTimer > 0) {
				migrateTimer--;
				if (migrateTimer < 20) {
					settleSpeed = SETTLE_SPEED_BASE + (SETTLE_SPEED_BOOST - SETTLE_SPEED_BASE) * (migrateTimer / 20);
				}
				if (migrateTimer === 0) settleSpeed = SETTLE_SPEED_BASE;
			}

			// ── Draw ghost trail (underneath everything) ──
			if (ghostCanvas) {
				ctx.globalAlpha = 0.6;
				ctx.drawImage(ghostCanvas, 0, 0, w, h);
				ctx.globalAlpha = 1;
			}

			// ── Chladni particles ──
			const TAU = Math.PI * 2;
			const useModes = currentModes;
			const migrating = migrateTimer > 0;

			for (const p of particles) {
				const val = chladniSuper(p.x, p.y, useModes);
				const [gx, gy] = chladniGradSuper(p.x, p.y, useModes);

				p.x -= gx * val * settleSpeed;
				p.y -= gy * val * settleSpeed;

				const nearLine = Math.max(0.3, 1 - Math.abs(val) * 2);
				const shakeAmp = SHAKE_BASE * nearLine;
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
				const alpha = Math.min(0.7, Math.max(0.05, 0.4 - dist * 1.5) + migrateGlow);

				ctx.globalAlpha = alpha;
				ctx.fillStyle = migrating ? '#5A4CFF' : '#3A2CFF';
				const pSize = migrating ? 1.6 : 1.2;
				ctx.fillRect(sx, sy, pSize, pSize);
			}
			ctx.globalAlpha = 1;

			// ── Step indicator ──
			if (currentStep >= 0 && isPlaying) {
				const stepFrac = currentStep / (scale.intervals.length - 1);
				ctx.fillStyle = `hsl(${stepFrac * 240}, 80%, 60%)`;
				ctx.font = '11px var(--mono)';
				ctx.globalAlpha = 0.8;
				const label = `♪ ${currentStep + 1}/${scale.intervals.length}`;
				ctx.fillText(label, 8, h - 8);
				ctx.globalAlpha = 1;
			}

			// ── Noise grain ──
			if (noiseCanvas && frameCount % 3 === 0) {
				refreshNoise(Math.ceil(w), Math.ceil(h));
				ctx.globalAlpha = 0.5;
				ctx.drawImage(noiseCanvas, 0, 0, w, h);
				ctx.globalAlpha = 1;
			}

			// ── Vignette ──
			const cx = w / 2, cy = h / 2;
			const vigR = Math.min(cx, cy) * 0.5;
			const vigGrad = ctx.createRadialGradient(cx, cy, vigR, cx, cy, Math.max(w, h) * 0.72);
			vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
			vigGrad.addColorStop(0.7, 'rgba(0,0,0,0.15)');
			vigGrad.addColorStop(1, 'rgba(0,0,0,0.55)');
			ctx.fillStyle = vigGrad;
			ctx.fillRect(0, 0, w, h);

			frameCount++;
			animId = requestAnimationFrame(draw);
		}

		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
		draw();

		return () => {
			cancelAnimationFrame(animId);
			window.removeEventListener('resize', resize);
		};
	});
</script>

<div class="lab">
	<header class="lab-header">
		<div class="lab-title">
			<span class="hud-tag">LAB</span>
			<h1>VISUALIZATION</h1>
		</div>
		<nav class="lab-nav">
			<a href="{base}/lab" class="lab-nav-link" aria-label="Intervals">INT</a>
			<a href="{base}/lab/chords" class="lab-nav-link" aria-label="Chords">CHRD</a>
			<a href="{base}/lab/scales" class="lab-nav-link active" aria-label="Scales">SCALE</a>
		</nav>
	</header>

	<div class="canvas-frame">
		<div class="scale-info">
			<span class="scale-name">{scale.name}</span>
			<span class="scale-formula">{scale.intervals.join(' ')}</span>
		</div>
		<canvas bind:this={mainCanvas}></canvas>
		<div class="frame-corner tl"></div>
		<div class="frame-corner tr"></div>
		<div class="frame-corner bl"></div>
		<div class="frame-corner br"></div>
	</div>

	<div class="selector">
		{#each SCALES as s (s.id)}
			<button
				class="scale-btn"
				class:active={selected === s.id}
				onclick={() => { if (selected === s.id) playScale(); else selected = s.id; }}
				aria-label="{s.name}"
			>
				{s.id}
			</button>
		{/each}
	</div>

	<footer class="lab-footer">
		<div class="footer-tags">
			<span class="hud-tag hud-tag--blue">
				<span class="toggle-dot on"></span>PROGRESSIVE CHLADNI
			</span>
		</div>
	</footer>
</div>

<style>
	.lab {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		height: 100%;
	}

	.lab-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.lab-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.lab-title h1 {
		font-family: var(--font-display);
		font-size: 1.2rem;
		letter-spacing: 0.15em;
		color: var(--text-primary);
	}

	.lab-nav {
		display: flex;
		gap: 0.25rem;
	}

	.lab-nav-link {
		font-family: var(--mono);
		font-size: 0.6rem;
		letter-spacing: 0.08em;
		padding: 0.2rem 0.4rem;
		border: 1px solid var(--border-heavy);
		color: var(--text-secondary);
		text-decoration: none;
		transition: all 0.15s ease;
	}

	.lab-nav-link:hover {
		border-color: var(--accent);
		color: var(--text-primary);
	}

	.lab-nav-link.active {
		border-color: var(--accent);
		color: var(--accent);
		background: var(--accent-dim);
	}

	.scale-info {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		z-index: 2;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.scale-name {
		font-family: var(--mono);
		font-size: 0.8rem;
		color: var(--accent);
		letter-spacing: 0.05em;
	}

	.scale-formula {
		font-family: var(--mono);
		font-size: 0.6rem;
		color: var(--text-secondary);
		letter-spacing: 0.06em;
		opacity: 0.7;
	}

	.canvas-frame {
		position: relative;
		flex: 1;
		min-height: 0;
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
		border-color: var(--accent);
		border-style: solid;
		opacity: 0.4;
	}
	.frame-corner.tl { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
	.frame-corner.tr { top: -1px; right: -1px; border-width: 2px 2px 0 0; }
	.frame-corner.bl { bottom: -1px; left: -1px; border-width: 0 0 2px 2px; }
	.frame-corner.br { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }

	.selector {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		justify-content: center;
	}

	.scale-btn {
		font-family: 'BPdots', var(--mono);
		font-size: 1.3rem;
		font-weight: 900;
		letter-spacing: 0.03em;
		text-transform: none;
		padding: 0.15rem 0.4rem 0.35rem 0.5rem;
		border: 1px solid var(--border-heavy);
		color: var(--text-secondary);
		background: var(--surface);
		transition: all 0.15s ease;
		min-width: 3rem;
		text-align: center;
		line-height: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.scale-btn:hover {
		border-color: var(--accent);
		color: var(--text-primary);
	}

	.scale-btn.active {
		border-color: var(--accent);
		color: var(--accent);
		background: var(--accent-dim);
	}

	.lab-footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
	}

	.footer-tags {
		display: flex;
		gap: 0.35rem;
	}

	.toggle-dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		border: 1px solid currentColor;
		margin-right: 0.3rem;
		vertical-align: middle;
		transition: all 0.15s ease;
	}

	.toggle-dot.on {
		background: currentColor;
		box-shadow: 0 0 4px currentColor;
	}

</style>
