<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { CHORDS } from '$lib/chords';
	import { chladniSuper, chladniGradSuper, chordToModes, harmonograph3D } from '$lib/viz';
	import type { ChladniMode } from '$lib/viz';
	import { playChord } from '$lib/audio';
	import { getAnalyser, getAmplitude } from '$lib/audio';

	// ── State ──
	let selected = $state('maj');
	let showChladni = $state(true);
	let showHarmonograph = $state(true);
	let isPlaying = $state(false);

	// Playback generation counter (for aborting overlapping plays)
	let playGeneration = 0;

	const ROOT_MIDI = 60; // C4

	let chord = $derived(CHORDS.find(c => c.id === selected)!);
	let modes = $derived(chordToModes(ROOT_MIDI, chord.intervals));

	// ── Canvas refs ──
	let mainCanvas: HTMLCanvasElement;
	let animId: number;

	// ── Chladni particles ──
	const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
	const PARTICLE_COUNT = isMobile ? 1500 : 3500;
	const SETTLE_SPEED_BASE = 0.003;
	const SETTLE_SPEED_BOOST = 0.02;
	const JITTER = 0.001;
	const SHAKE_BASE = 0.015;
	const SHAKE_AUDIO = 0.05;
	let particles: { x: number; y: number }[] = [];
	let settleSpeed = SETTLE_SPEED_BASE;
	let migrateTimer = 0;

	// ── Harmonograph state ──
	let hPhase = Math.PI * 4;  // start with some history so trail is visible immediately
	const H_TRAIL = 500;
	const H_SPEED_BASE = 0.004;
	let rotAngle = 0;

	// ── Audio reactive ──
	let analyserRef: AnalyserNode | null = null;
	let dataArrayRef: Uint8Array | null = null;
	let amplitude = 0;

	// ── Layer opacity (smooth transitions) ──
	let chladniOpacity = 1;
	let harmonographOpacity = 1;

	// ── Current modes for draw loop (avoid reactivity overhead in hot path) ──
	let currentModes: ChladniMode[] = chordToModes(ROOT_MIDI, CHORDS[0].intervals);
	let currentIntervals: number[] = CHORDS[0].intervals;

	function initParticles() {
		particles = [];
		const TAU = Math.PI * 2;
		for (let i = 0; i < PARTICLE_COUNT; i++) {
			particles.push({ x: Math.random() * TAU, y: Math.random() * TAU });
		}
	}

	function handlePlay() {
		if (!analyserRef) {
			const { analyser, dataArray } = getAnalyser();
			analyserRef = analyser;
			dataArrayRef = dataArray;
		}
		playGeneration++;
		const thisGen = playGeneration;
		isPlaying = true;
		playChord(ROOT_MIDI, chord.intervals, 'root', 'epiano', false);
		settleSpeed = SETTLE_SPEED_BOOST;
		migrateTimer = 120;
		setTimeout(() => { if (thisGen === playGeneration) isPlaying = false; }, 2000);
	}

	// React to chord changes
	let firstRun = true;
	$effect(() => {
		currentModes = chordToModes(ROOT_MIDI, chord.intervals);
		currentIntervals = chord.intervals;
		settleSpeed = SETTLE_SPEED_BOOST;
		migrateTimer = 120;
		if (particles.length === 0) initParticles();
		if (!firstRun) {
			handlePlay();
		}
		firstRun = false;
	});

	// ── Noise texture ──
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

		function resize() {
			const rect = mainCanvas.getBoundingClientRect();
			mainCanvas.width = rect.width * dpr;
			mainCanvas.height = rect.height * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			generateNoise(Math.ceil(rect.width), Math.ceil(rect.height));
		}

		resize();
		window.addEventListener('resize', resize);
		initParticles();

		let frameCount = 0;

		function draw() {
			const w = mainCanvas.width / dpr;
			const h = mainCanvas.height / dpr;
			const cx = w / 2;
			const cy = h / 2;

			// Audio amplitude
			if (analyserRef && dataArrayRef) {
				amplitude = getAmplitude(analyserRef, dataArrayRef);
			} else {
				amplitude *= 0.95;
			}
			const amp = Math.min(1, amplitude * 3);

			// Fade
			ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
			ctx.fillRect(0, 0, w, h);

			// Migration timer decay
			if (migrateTimer > 0) {
				migrateTimer--;
				if (migrateTimer < 30) {
					const t = migrateTimer / 30;
					settleSpeed = SETTLE_SPEED_BASE + (SETTLE_SPEED_BOOST - SETTLE_SPEED_BASE) * t;
				}
				if (migrateTimer === 0) settleSpeed = SETTLE_SPEED_BASE;
			}

			// Smooth layer toggles
			chladniOpacity += ((showChladni ? 1 : 0) - chladniOpacity) * 0.06;
			harmonographOpacity += ((showHarmonograph ? 1 : 0) - harmonographOpacity) * 0.06;

			const useModes = currentModes;
			const useIntervals = currentIntervals;

			// ── CHLADNI PARTICLES (background) ──
			if (chladniOpacity > 0.01) {
				const TAU = Math.PI * 2;
				const currentShake = SHAKE_BASE + amp * SHAKE_AUDIO;
				const migrating = migrateTimer > 0;

				for (const p of particles) {
					const val = chladniSuper(p.x, p.y, useModes);
					const [gx, gy] = chladniGradSuper(p.x, p.y, useModes);

					p.x -= gx * val * settleSpeed;
					p.y -= gy * val * settleSpeed;

					const nearLine = Math.max(0.3, 1 - Math.abs(val) * 2);
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
					const migrateGlow = migrating ? 0.25 * (dist * 2) : 0;
					const alpha = Math.min(0.6, Math.max(0.04, 0.35 - dist * 1.5) + migrateGlow);

					ctx.globalAlpha = alpha * chladniOpacity;
					ctx.fillStyle = migrating ? '#5A4CFF' : '#3A2CFF';
					ctx.fillRect(sx, sy, migrating ? 1.5 : 1.2, migrating ? 1.5 : 1.2);
				}
				ctx.globalAlpha = 1;
			}

			// ── HARMONOGRAPH (foreground) ──
			if (harmonographOpacity > 0.01) {
				const radius = Math.min(cx, cy) * 0.65;
				const radiusPulse = 1 + amp * 0.12;
				const glowBoost = amp * 8;
				const lwBoost = amp * 1.5;

				// Slow rotation
				rotAngle += 0.0008;

				// Compute trail points
				const speed = H_SPEED_BASE / Math.max(...useIntervals.map(s => Math.abs(s) || 1), 1);

				// Double-pass rendering: dim wide stroke for bloom, bright thin stroke on top
				ctx.shadowColor = '#C2FE0C';

				// Pass 1: bloom/glow underlay — wide, dim
				ctx.shadowBlur = 8 + glowBoost;
				ctx.strokeStyle = 'rgba(194, 254, 12, 0.25)';
				ctx.lineWidth = 4.0 + lwBoost;

				const mirrors: [number, number, number][] = [
					[1, 1, 0.9],
					[-1, 1, 0.55],
					[1, -1, 0.55],
					[-1, -1, 0.35],
				];

				for (const [mx, my, baseAlpha] of mirrors) {
					ctx.beginPath();
					for (let i = 0; i < H_TRAIL; i++) {
						const t = hPhase - i * speed * 0.5;
						const [px, py] = harmonograph3D(t, useIntervals, radius * radiusPulse, Math.PI / 4, rotAngle);
						const x = cx + mx * px;
						const y = cy + my * py;
						if (i === 0) ctx.moveTo(x, y);
						else ctx.lineTo(x, y);
					}
					ctx.globalAlpha = Math.min(1, baseAlpha * 0.4) * harmonographOpacity;
					ctx.stroke();
				}

				// Pass 2: crisp bright line on top
				ctx.shadowBlur = 3 + glowBoost * 0.4;
				ctx.strokeStyle = '#C2FE0C';
				ctx.lineWidth = 1.5 + lwBoost * 0.5;

				for (const [mx, my, baseAlpha] of mirrors) {
					ctx.beginPath();
					for (let i = 0; i < H_TRAIL; i++) {
						const t = hPhase - i * speed * 0.5;
						const [px, py] = harmonograph3D(t, useIntervals, radius * radiusPulse, Math.PI / 4, rotAngle);
						const x = cx + mx * px;
						const y = cy + my * py;
						if (i === 0) ctx.moveTo(x, y);
						else ctx.lineTo(x, y);
					}
					ctx.globalAlpha = Math.min(1, baseAlpha) * harmonographOpacity;
					ctx.stroke();
				}

				// Head dot
				const [hx, hy] = harmonograph3D(hPhase, useIntervals, radius * radiusPulse, Math.PI / 4, rotAngle);
				ctx.beginPath();
				ctx.arc(cx + hx, cy + hy, 3, 0, Math.PI * 2);
				ctx.fillStyle = '#C2FE0C';
				ctx.shadowBlur = 8 + glowBoost;
				ctx.globalAlpha = harmonographOpacity;
				ctx.fill();

				ctx.globalAlpha = 1;
				ctx.shadowBlur = 0;

				hPhase += speed;
			}

			// ── Noise grain ──
			if (noiseCanvas && frameCount % 3 === 0) {
				refreshNoise(Math.ceil(w), Math.ceil(h));
				ctx.globalAlpha = 0.5;
				ctx.drawImage(noiseCanvas, 0, 0, w, h);
				ctx.globalAlpha = 1;
			}

			// ── Vignette ──
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
			<a href="{base}/lab/chords" class="lab-nav-link active" aria-label="Chords">CHRD</a>
			<a href="{base}/lab/scales" class="lab-nav-link" aria-label="Scales">SCALE</a>
		</nav>
	</header>

	<div class="canvas-frame">
		<div class="chord-info">
			<span class="chord-name">{chord.name}</span>
			<span class="chord-formula">[{chord.intervals.join(', ')}]</span>
		</div>
		<canvas bind:this={mainCanvas}></canvas>
		<button class="play-btn" class:playing={isPlaying} onclick={handlePlay} aria-label="Play chord">
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
		{#each CHORDS as ch (ch.id)}
			<button
				class="chord-btn"
				class:active={selected === ch.id}
				onclick={() => { if (selected === ch.id) handlePlay(); else selected = ch.id; }}
				aria-label="{ch.name}"
			>
				{ch.id}
			</button>
		{/each}
	</div>

	<footer class="lab-footer">
		<div class="footer-tags">
			<button class="hud-tag hud-tag--blue" class:dimmed={!showChladni} onclick={() => showChladni = !showChladni}>
				<span class="toggle-dot" class:on={showChladni}></span>CHLADNI
			</button>
			<button class="hud-tag" class:dimmed={!showHarmonograph} onclick={() => showHarmonograph = !showHarmonograph}>
				<span class="toggle-dot" class:on={showHarmonograph}></span>HARMONOGRAPH
			</button>
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

	.chord-info {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		z-index: 2;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.chord-name {
		font-family: var(--mono);
		font-size: 0.8rem;
		color: var(--accent);
		letter-spacing: 0.05em;
	}

	.chord-formula {
		font-family: var(--mono);
		font-size: 0.6rem;
		color: var(--text-secondary);
		letter-spacing: 0.08em;
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

	.chord-btn {
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

	.chord-btn:hover {
		border-color: var(--accent);
		color: var(--text-primary);
	}

	.chord-btn.active {
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
