<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { INTERVALS } from '$lib/intervals';
	import { playInterval, getAnalyser, getAmplitude } from '$lib/audio';
	import { loadState } from '$lib/state';

	// Just intonation ratios — [numerator, denominator]
	const RATIOS: Record<string, [number, number]> = {
		P1: [1, 1],
		m2: [16, 15],
		M2: [9, 8],
		m3: [6, 5],
		M3: [5, 4],
		P4: [4, 3],
		TT: [7, 5],
		P5: [3, 2],
		m6: [8, 5],
		M6: [5, 3],
		m7: [9, 5],
		M7: [15, 8],
		P8: [2, 1],
	};

	const sortedIntervals = [...INTERVALS].sort((a, b) => a.semitones - b.semitones);

	let mainCanvas: HTMLCanvasElement;
	let burnCanvas: HTMLCanvasElement;  // offscreen burn-in accumulator
	let animId: number;
	let phase = 0;
	let selected = $state('P1');

	let freqX = $derived(RATIOS[selected][0]);
	let freqY = $derived(RATIOS[selected][1]);
	let ratioLabel = $derived(`${RATIOS[selected][0]} : ${RATIOS[selected][1]}`);
	let intervalName = $derived(INTERVALS.find(i => i.id === selected)?.name ?? selected);
	let intervalSemitones = $derived(INTERVALS.find(i => i.id === selected)?.semitones ?? 7);

	const PHASE_DELTA = Math.PI / 2;
	const TRAIL_POINTS = 600;
	const TARGET_LOOPS = 1.5;  // constant visual complexity across all intervals
	const BASE_SPEED = 0.006;
	// Scale speed by ratio complexity — busier ratios move slower
	let SPEED = $derived(BASE_SPEED / Math.max(RATIOS[selected][0], RATIOS[selected][1]));
	// Trail arc: always show ~1.5 loops regardless of ratio complexity
	let TRAIL_STEP = $derived((Math.PI * 2 * TARGET_LOOPS / Math.max(RATIOS[selected][0], RATIOS[selected][1])) / TRAIL_POINTS);

	// Audio-reactive state
	let analyserRef: AnalyserNode | null = null;
	let dataArrayRef: Uint8Array | null = null;
	let amplitude = 0;

	// Layer visibility toggles
	let showLissajous = $state(true);
	let showChladni = $state(true);
	let lissajousOpacity = 1;
	let chladniOpacity = 1;

	// Dissolve state — Lissajous points become particles
	let dissolveProgress = 0;  // 0 = solid line, 1 = fully dissolved
	const dissolveOffsets: { x: number; y: number }[] = [];
	for (let i = 0; i < 600; i++) dissolveOffsets.push({ x: 0, y: 0 });
	let isPlaying = $state(false);

	// Lissajous morphing — rest state is 1:1 circle, playing morphs to interval ratio
	let morphT = $state(0);  // 0 = rest (circle), 1 = full interval shape
	let morphTarget = 0;
	let morphTimer: ReturnType<typeof setTimeout> | null = null;

	function handlePlay() {
		if (!analyserRef) {
			const { analyser, dataArray } = getAnalyser();
			analyserRef = analyser;
			dataArrayRef = dataArray;
		}

		const state = loadState();
		const rootMidi = 60;
		const secondMidi = rootMidi + intervalSemitones;
		isPlaying = true;

		// Morph: first note = circle (rest), second note = interval shape
		morphTarget = 0;
		morphT = 0;
		if (morphTimer) clearTimeout(morphTimer);
		morphTimer = setTimeout(() => {
			morphTarget = 1;
			phase = phase % (Math.PI * 2);  // modulate to first cycle on interval entry
		}, 500);

		// Chladni: switch pattern per note
		// Root note → root's Chladni mode
		const [rootN, rootM] = midiToChladniMode(rootMidi);
		chladniN = rootN;
		chladniM = rootM;
		settleSpeed = SETTLE_SPEED_BOOST;
		migrateTimer = 90;

		// Second note (~0.7s later) → second note's Chladni mode
		if (chladniTimer) clearTimeout(chladniTimer);
		chladniTimer = setTimeout(() => {
			const [secN, secM] = midiToChladniMode(secondMidi);
			chladniN = secN;
			chladniM = secM;
			settleSpeed = SETTLE_SPEED_BOOST;
			migrateTimer = 90;
		}, 700);

		playInterval(rootMidi, intervalSemitones, 'ascending', state.settings.toneType);
		setTimeout(() => { isPlaying = false; }, 2000);
	}

	// Chladni — reduce particles on mobile for perf
	const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
	const PARTICLE_COUNT = isMobile ? 1200 : 3000;
	const SETTLE_SPEED_BASE = 0.004;
	const SETTLE_SPEED_BOOST = 0.025;
	const JITTER = 0.001;
	const SHAKE_BASE = 0.02;
	const SHAKE_AUDIO = 0.06;
	let particles: { x: number; y: number }[] = [];
	let settleSpeed = SETTLE_SPEED_BASE;
	let migrateTimer = 0;

	// Chladni note-mapped modes: MIDI note → (n,m) plate modes
	// Lower notes → simpler modes, higher → more complex
	function midiToChladniMode(midi: number): [number, number] {
		const note = midi % 12;
		const modes: [number, number][] = [
			[1, 2], [2, 3], [1, 3], [3, 4], [2, 4], [1, 4],
			[3, 5], [2, 5], [4, 5], [3, 6], [2, 6], [5, 6],
		];
		return modes[note];
	}

	// Active Chladni mode — changes per note played
	let chladniN = $state(1);  // n=m → zero gradient → random scatter (rest state)
	let chladniM = $state(1);
	let chladniTimer: ReturnType<typeof setTimeout> | null = null;

	function chladni(x: number, y: number, n: number, m: number): number {
		return Math.cos(n * x) * Math.cos(m * y) - Math.cos(m * x) * Math.cos(n * y);
	}

	function chladniGrad(x: number, y: number, n: number, m: number): [number, number] {
		const h = 0.01;
		const dx = (chladni(x + h, y, n, m) - chladni(x - h, y, n, m)) / (2 * h);
		const dy = (chladni(x, y + h, n, m) - chladni(x, y - h, n, m)) / (2 * h);
		return [dx, dy];
	}

	function initParticles() {
		particles = [];
		for (let i = 0; i < PARTICLE_COUNT; i++) {
			particles.push({
				x: Math.random() * Math.PI * 2,
				y: Math.random() * Math.PI * 2,
			});
		}
	}

	// Draw-loop state
	// Initial draw state — P1 (circle)
	let currentFx = $state(1);
	let currentFy = $state(1);

	// On interval change: update ratios, boost migration, auto-play
	let firstRun = true;
	$effect(() => {
		currentFx = RATIOS[selected][0];
		currentFy = RATIOS[selected][1];
		// On first run: keep Chladni in rest state (random scatter)
		if (!firstRun) {
			const [n, m] = midiToChladniMode(60);
			chladniN = n;
			chladniM = m;
		}
		// Boost settle speed for visible migration
		settleSpeed = SETTLE_SPEED_BOOST;
		migrateTimer = 120;
		// Only init if empty
		if (particles.length === 0) initParticles();
		// Auto-play + morph on interval switch (skip first load)
		if (!firstRun) {
			// Start morph from current shape, will morph to new interval via handlePlay
			morphTarget = 1;  // aim for full interval shape
			morphT = 0.3;     // partial reset so you see the transition
			handlePlay();
		} else {
			// First load — go straight to interval shape
			morphT = 1;
			morphTarget = 1;
		}
		firstRun = false;
	});

	// Noise texture — use offscreen canvas for proper compositing
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
			d[i] = v;
			d[i + 1] = v;
			d[i + 2] = v;
			d[i + 3] = Math.random() < 0.4 ? 14 : 0;
		}
		noiseCtx.putImageData(imgData, 0, 0);
	}

	onMount(() => {
		const ctx = mainCanvas.getContext('2d')!;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);  // cap at 2x for perf

		// Offscreen burn-in canvas
		burnCanvas = document.createElement('canvas');
		const burnCtx = burnCanvas.getContext('2d')!;

		function resize() {
			const rect = mainCanvas.getBoundingClientRect();
			const pw = rect.width * dpr;
			const ph = rect.height * dpr;
			mainCanvas.width = pw;
			mainCanvas.height = ph;
			burnCanvas.width = pw;
			burnCanvas.height = ph;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			burnCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
			generateNoise(Math.ceil(rect.width), Math.ceil(rect.height));
		}

		resize();
		window.addEventListener('resize', resize);
		initParticles();

		let frameCount = 0;
		let prevBurnX = 0;
		let prevBurnY = 0;
		let burnInitialized = false;

		function draw() {
			const w = mainCanvas.width / dpr;
			const h = mainCanvas.height / dpr;
			const cx = w / 2;
			const cy = h / 2;
			const fx = currentFx;
			const fy = currentFy;

			// === Audio-reactive amplitude ===
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

			// Morph Lissajous between rest (1:1) and interval ratio
			// Faster interpolation — head leads aggressively
			morphT += (morphTarget - morphT) * 0.08;
			const drawFx = 1 + (fx - 1) * morphT;
			const drawFy = 1 + (fy - 1) * morphT;

			const radius = Math.min(cx, cy) * 0.78 * radiusPulse;

			// === MAIN CANVAS ===
			ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
			ctx.fillRect(0, 0, w, h);

			// --- Migration timer decay ---
			if (migrateTimer > 0) {
				migrateTimer--;
				if (migrateTimer < 30) {
					const t = migrateTimer / 30;
					settleSpeed = SETTLE_SPEED_BASE + (SETTLE_SPEED_BOOST - SETTLE_SPEED_BASE) * t;
				}
				if (migrateTimer === 0) settleSpeed = SETTLE_SPEED_BASE;
			}

			// Smooth fade for layer toggles
			chladniOpacity += ((showChladni ? 1 : 0) - chladniOpacity) * 0.06;
			lissajousOpacity += ((showLissajous ? 1 : 0) - lissajousOpacity) * 0.04;

			// --- Chladni particles (electric indigo, behind Lissajous) ---
			if (chladniOpacity > 0.01) {
			const TAU = Math.PI * 2;
			const currentShake = SHAKE_BASE + amp * SHAKE_AUDIO;  // audio-reactive shake
			ctx.shadowColor = '#3A2CFF';
			ctx.shadowBlur = 2;
			for (const p of particles) {
				const val = chladni(p.x, p.y, chladniN, chladniM);
				const [gx, gy] = chladniGrad(p.x, p.y, chladniN, chladniM);

				// Drift toward nodal lines (boosted during migration)
				p.x -= gx * val * settleSpeed;
				p.y -= gy * val * settleSpeed;

				// Micro-shake — stronger near nodal lines + boosted by audio
				const nearLine = Math.max(0.3, 1 - Math.abs(val) * 3);
				const shakeAmp = currentShake * nearLine;
				p.x += (Math.random() - 0.5) * shakeAmp;
				p.y += (Math.random() - 0.5) * shakeAmp;

				// Small directional jitter
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
				// During migration: particles glow brighter as they move
				const migrating = migrateTimer > 0;
				const migrateGlow = migrating ? 0.3 * (dist * 2) : 0;  // farther from line = brighter
				const alpha = Math.min(0.6, Math.max(0.05, 0.4 - dist * 2) + migrateGlow);

				ctx.globalAlpha = alpha * chladniOpacity;
				ctx.fillStyle = migrating ? '#5A4CFF' : '#3A2CFF';  // brighter blue during migration
				const pSize = migrating ? 1.6 : 1.2;
				ctx.fillRect(sx, sy, pSize, pSize);
			}
			ctx.globalAlpha = 1;
			ctx.shadowBlur = 0;
			} // end showChladni

			// --- Lissajous trail — calculate once, fade in/out ---
			if (lissajousOpacity > 0.01) {
			ctx.shadowColor = '#C2FE0C';
			// Pre-compute points once
			const circleStep = (Math.PI * 2) / TRAIL_POINTS;
			const activeStep = TRAIL_STEP;
			const currentStep = circleStep + (activeStep - circleStep) * morphT;
			const lissPoints: [number, number][] = [];
			for (let i = 0; i < TRAIL_POINTS; i++) {
				const t = phase - i * currentStep;
				const pointMorph = Math.max(0, morphT - (i / TRAIL_POINTS) * 0.3);
				const ptFx = 1 + (fx - 1) * pointMorph;
				const ptFy = 1 + (fy - 1) * pointMorph;
				const dx = radius * Math.sin(ptFx * t + PHASE_DELTA);
				const dy = radius * Math.sin(ptFy * t);
				lissPoints.push([dx, dy]);
			}

			const mirrors: [number, number, number][] = [
				[1, 1, 0.85],
				[-1, 1, 0.5],
				[1, -1, 0.5],
				[-1, -1, 0.35],
			];

			for (const [mx, my, baseAlpha] of mirrors) {
				ctx.beginPath();
				for (let i = 0; i < lissPoints.length; i++) {
					const x = cx + mx * lissPoints[i][0];
					const y = cy + my * lissPoints[i][1];
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				}
				ctx.strokeStyle = '#C2FE0C';
				ctx.lineWidth = 1.2 + lwBoost;
				ctx.globalAlpha = Math.min(1, baseAlpha + alphaBoost) * lissajousOpacity;
				ctx.shadowBlur = 2 + glowBoost * 0.5;
				ctx.stroke();
			}

			ctx.globalAlpha = 1;
			ctx.shadowBlur = 0;

			// Head dot
			const headX = cx + radius * Math.sin(drawFx * phase + PHASE_DELTA);
			const headY = cy + radius * Math.sin(drawFy * phase);
			ctx.beginPath();
			ctx.arc(headX, headY, 3, 0, Math.PI * 2);
			ctx.fillStyle = '#C2FE0C';
			ctx.shadowBlur = 6 + glowBoost;
			ctx.globalAlpha = lissajousOpacity;
			ctx.fill();
			ctx.globalAlpha = 1;
			ctx.shadowBlur = 0;
			} // end showLissajous

			// --- Digital noise grain (every 3rd frame, composited properly) ---
			if (noiseCanvas && frameCount % 3 === 0) {
				refreshNoise(Math.ceil(w), Math.ceil(h));
				ctx.globalAlpha = 0.6;
				ctx.drawImage(noiseCanvas, 0, 0, w, h);
				ctx.globalAlpha = 1;
			}

			// --- Vignette — radial gradient darkening corners ---
			const vigGrad = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, Math.max(w, h) * 0.72);
			vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
			vigGrad.addColorStop(0.7, 'rgba(0,0,0,0.15)');
			vigGrad.addColorStop(1, 'rgba(0,0,0,0.55)');
			ctx.fillStyle = vigGrad;
			ctx.fillRect(0, 0, w, h);

			// --- Iodide burn scanline flicker ---
			if (frameCount % 120 < 2) {
				// Occasional horizontal scanline glitch
				const glitchY = Math.random() * h;
				ctx.fillStyle = 'rgba(194, 254, 12, 0.03)';
				ctx.fillRect(0, glitchY, w, 1);
			}

			phase += SPEED;
			frameCount++;
			animId = requestAnimationFrame(draw);
		}

		ctx.fillStyle = '#000000';
		ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
		burnCtx.fillStyle = '#000000';
		burnCtx.fillRect(0, 0, burnCanvas.width, burnCanvas.height);

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
			<a href="{base}/lab" class="lab-nav-link active" aria-label="Intervals">INT</a>
			<a href="{base}/lab/chords" class="lab-nav-link" aria-label="Chords">CHRD</a>
			<a href="{base}/lab/scales" class="lab-nav-link" aria-label="Scales">SCALE</a>
		</nav>
	</header>

	<div class="canvas-frame">
		<canvas bind:this={mainCanvas}></canvas>
		<button class="play-btn" class:playing={isPlaying} onclick={handlePlay} aria-label="Play interval">
			{#if isPlaying}
				<span class="play-icon pulse">◉</span>
			{:else}
				<span class="play-icon">▶</span>
			{/if}
		</button>
		<div class="frame-corner tl"></div>
		<div class="frame-corner tr"></div>
		<div class="frame-corner bl"></div>
		<div class="frame-corner br"></div>
	</div>

	<div class="selector">
		{#each sortedIntervals as iv (iv.id)}
			<button
				class="interval-btn"
				class:active={selected === iv.id}
				onclick={() => { if (selected === iv.id) handlePlay(); else selected = iv.id; }}
				aria-label="{iv.name} — {RATIOS[iv.id][0]}:{RATIOS[iv.id][1]}"
			>
				{iv.id}
			</button>
		{/each}
	</div>

	<footer class="lab-footer">
		<div class="footer-tags">
			<button class="hud-tag" class:dimmed={!showLissajous} onclick={() => showLissajous = !showLissajous}>LISSAJOUS</button>
			<button class="hud-tag hud-tag--blue" class:dimmed={!showChladni} onclick={() => showChladni = !showChladni}>CHLADNI</button>
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

	.lab-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.interval-tag {
		font-family: 'BPdots', var(--mono);
		font-size: 2.2rem;
		font-weight: 900;
		color: var(--accent);
		border: 1px solid var(--accent);
		padding: 0.1rem 0.4rem 0.45rem 0.6rem;
		letter-spacing: 0.05em;
		text-transform: none;
		line-height: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.ratio {
		font-family: var(--mono);
		font-size: 0.75rem;
		color: var(--text-secondary);
		letter-spacing: 0.1em;
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

	.interval-btn {
		font-family: 'BPdots', var(--mono);
		font-size: 1.5rem;
		font-weight: 900;
		letter-spacing: 0.03em;
		text-transform: none;
		padding: 0.1rem 0.35rem 0.4rem 0.55rem;
		border: 1px solid var(--border-heavy);
		color: var(--text-secondary);
		background: var(--surface);
		transition: all 0.15s ease;
		min-width: 2.6rem;
		text-align: center;
		line-height: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.interval-btn:hover {
		border-color: var(--accent);
		color: var(--text-primary);
	}

	.interval-btn.active {
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

	.footer-tags .hud-tag {
		cursor: pointer;
		transition: opacity 0.15s ease;
	}

	.footer-tags .hud-tag.dimmed {
		opacity: 0.3;
	}

	.freq-label {
		font-family: var(--mono);
		font-size: 0.65rem;
		color: var(--text-secondary);
		letter-spacing: 0.05em;
	}

	/* Play button — overlaid on canvas */
	.play-btn {
		position: absolute;
		bottom: 0.75rem;
		right: 0.75rem;
		z-index: 2;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		border: 1px solid var(--accent);
		background: rgba(0, 0, 0, 0.6);
		color: var(--accent);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
		backdrop-filter: blur(4px);
	}

	.play-btn:hover {
		background: rgba(194, 254, 12, 0.15);
		box-shadow: 0 0 12px rgba(194, 254, 12, 0.3);
	}

	.play-btn.playing {
		border-color: var(--accent);
		box-shadow: 0 0 16px rgba(194, 254, 12, 0.4);
	}

	.play-icon {
		font-size: 0.9rem;
		line-height: 1;
	}

	.play-icon.pulse {
		animation: pulse-glow 0.6s ease-in-out infinite alternate;
	}

	@keyframes pulse-glow {
		from { text-shadow: 0 0 4px var(--accent); }
		to { text-shadow: 0 0 16px var(--accent), 0 0 24px var(--accent); }
	}
</style>
