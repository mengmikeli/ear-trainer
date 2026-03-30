<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { INTERVALS } from '$lib/intervals';
	import { playInterval, getAnalyser, getAmplitude, stopAudio } from '$lib/audio';
	import { loadState } from '$lib/state';

	// Just intonation ratios
	const RATIOS: Record<string, [number, number]> = {
		P1: [1, 1], m2: [16, 15], M2: [9, 8], m3: [6, 5], M3: [5, 4],
		P4: [4, 3], TT: [7, 5], P5: [3, 2], m6: [8, 5], M6: [5, 3],
		m7: [9, 5], M7: [15, 8], P8: [2, 1],
	};

	const sortedIntervals = [...INTERVALS].sort((a, b) => a.semitones - b.semitones);

	// Grid dimensions
	const COLS = 80;
	const ROWS = 40;
	// Monospace character aspect ratio correction (cells ~2× taller than wide)
	const CELL_ASPECT = 0.48;

	const PHASE_DELTA = Math.PI / 2;

	// ASCII brightness ramp — dark to bright
	const RAMP = ' .`-_:,;^=+/|)\\!?0oOQ#%@';

	// Trail settings
	const TRAIL_POINTS = 1200;
	const TARGET_LOOPS = 2;
	const BASE_SPEED = 0.006;

	// Viz mode
	type VizMode = 'lissajous' | 'chladni';
	let vizMode = $state<VizMode>('lissajous');

	let selected = $state('P5');
	let isPlaying = $state(false);
	let playGeneration = 0;
	let gridText = $state('');

	let freqX = $derived(RATIOS[selected][0]);
	let freqY = $derived(RATIOS[selected][1]);
	let ratioLabel = $derived(`${RATIOS[selected][0]} : ${RATIOS[selected][1]}`);
	let intervalName = $derived(INTERVALS.find(i => i.id === selected)?.name ?? selected);
	let intervalSemitones = $derived(INTERVALS.find(i => i.id === selected)?.semitones ?? 7);
	let SPEED = $derived(BASE_SPEED / Math.max(RATIOS[selected][0], RATIOS[selected][1]));
	let TRAIL_STEP = $derived(
		(Math.PI * 2 * TARGET_LOOPS / Math.max(RATIOS[selected][0], RATIOS[selected][1])) / TRAIL_POINTS
	);

	// Audio
	let analyserRef: AnalyserNode | null = null;
	let dataArrayRef: Uint8Array | null = null;
	let amplitude = 0;

	// Lissajous morphing
	let morphT = 0;
	let morphTarget = 1;
	let morphTimer: ReturnType<typeof setTimeout> | null = null;

	// Chladni state
	const TAU = Math.PI * 2;
	const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
	const PARTICLE_COUNT = isMobile ? 1500 : 3000;
	const SETTLE_SPEED_BASE = 0.003;
	const SETTLE_SPEED_BOOST = 0.025;
	const JITTER = 0.001;
	const SHAKE_BASE = 0.02;
	const SHAKE_AUDIO = 0.05;
	let particles: { x: number; y: number }[] = [];
	let settleSpeed = SETTLE_SPEED_BASE;
	let migrateTimer = 0;
	let chladniN = 1;
	let chladniM = 1;
	let chladniTimer: ReturnType<typeof setTimeout> | null = null;

	function midiToChladniMode(midi: number): [number, number] {
		const note = midi % 12;
		const modes: [number, number][] = [
			[1, 2], [2, 3], [1, 3], [3, 4], [2, 4], [1, 4],
			[3, 5], [2, 5], [4, 5], [3, 6], [2, 6], [5, 6],
		];
		return modes[note];
	}

	function chladniFn(x: number, y: number, n: number, m: number): number {
		return Math.cos(n * x) * Math.cos(m * y) - Math.cos(m * x) * Math.cos(n * y);
	}

	function chladniGrad(x: number, y: number, n: number, m: number): [number, number] {
		const h = 0.01;
		const dx = (chladniFn(x + h, y, n, m) - chladniFn(x - h, y, n, m)) / (2 * h);
		const dy = (chladniFn(x, y + h, n, m) - chladniFn(x, y - h, n, m)) / (2 * h);
		return [dx, dy];
	}

	function initParticles() {
		particles = [];
		for (let i = 0; i < PARTICLE_COUNT; i++) {
			particles.push({
				x: Math.random() * TAU,
				y: Math.random() * TAU,
			});
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
		const state = loadState();
		const rootMidi = 60;
		isPlaying = true;

		// Lissajous morph
		morphTarget = 0;
		morphT = 0;
		if (morphTimer) clearTimeout(morphTimer);
		morphTimer = setTimeout(() => { morphTarget = 1; }, 500);

		// Chladni: root note pattern, then second note
		const [rootN, rootM] = midiToChladniMode(rootMidi);
		chladniN = rootN;
		chladniM = rootM;
		settleSpeed = SETTLE_SPEED_BOOST;
		migrateTimer = 90;

		if (chladniTimer) clearTimeout(chladniTimer);
		chladniTimer = setTimeout(() => {
			const [secN, secM] = midiToChladniMode(rootMidi + intervalSemitones);
			chladniN = secN;
			chladniM = secM;
			settleSpeed = SETTLE_SPEED_BOOST;
			migrateTimer = 90;
		}, 700);

		playInterval(rootMidi, intervalSemitones, 'ascending', state.settings.toneType);
		setTimeout(() => { if (thisGen === playGeneration) isPlaying = false; }, 2000);
	}

	let firstRun = true;
	$effect(() => {
		const _ = selected;
		if (!firstRun) {
			morphTarget = 1;
			morphT = 0.3;
			handlePlay();
		} else {
			morphT = 1;
			morphTarget = 1;
			// Init Chladni with a real pattern on first load
			const [n, m] = midiToChladniMode(60);
			chladniN = n;
			chladniM = m;
			settleSpeed = SETTLE_SPEED_BOOST;
			migrateTimer = 120;
		}
		firstRun = false;
	});

	onMount(() => {
		let phase = 0;
		let animId: number;

		// Brightness field
		const field = new Float32Array(COLS * ROWS);
		const LISSAJOUS_DECAY = 0.88;

		initParticles();

		function draw() {
			const fx = RATIOS[selected][0];
			const fy = RATIOS[selected][1];

			// Audio amplitude
			if (analyserRef && dataArrayRef) {
				amplitude = getAmplitude(analyserRef, dataArrayRef);
			} else {
				amplitude *= 0.95;
			}
			const amp = Math.min(1, amplitude * 3);

			// Clear field
			if (vizMode === 'lissajous') {
				// Decay for trail persistence
				for (let i = 0; i < field.length; i++) field[i] *= LISSAJOUS_DECAY;
				drawLissajous(field, fx, fy, phase, amp);
			} else {
				// Chladni: zero field each frame, accumulate from particles
				for (let i = 0; i < field.length; i++) field[i] = 0;
				drawChladni(field, amp);
			}

			// Audio pulse — subtle global brightness boost
			if (amp > 0.05) {
				for (let i = 0; i < field.length; i++) {
					field[i] = Math.min(1, field[i] * (1 + amp * 0.15));
				}
			}

			gridText = renderMonospace(field);
			phase += SPEED;
			animId = requestAnimationFrame(draw);
		}

		function drawLissajous(field: Float32Array, fx: number, fy: number, phase: number, amp: number) {
			morphT += (morphTarget - morphT) * 0.08;
			const drawFx = 1 + (fx - 1) * morphT;
			const drawFy = 1 + (fy - 1) * morphT;

			// Aspect-corrected radii: fit a square coordinate space into the rectangular grid
			const maxR = Math.min(COLS, ROWS / CELL_ASPECT) / 2 - 1;
			const radiusX = maxR;
			const radiusY = maxR * CELL_ASPECT;
			const cx = COLS / 2;
			const cy = ROWS / 2;

			const circleStep = (Math.PI * 2) / TRAIL_POINTS;
			const activeStep = TRAIL_STEP;
			const currentStep = circleStep + (activeStep - circleStep) * morphT;

			for (let i = 0; i < TRAIL_POINTS; i++) {
				const t = phase - i * currentStep;
				const pointMorph = Math.max(0, morphT - (i / TRAIL_POINTS) * 0.3);
				const ptFx = 1 + (fx - 1) * pointMorph;
				const ptFy = 1 + (fy - 1) * pointMorph;

				const px = cx + radiusX * Math.sin(ptFx * t + PHASE_DELTA);
				const py = cy + radiusY * Math.sin(ptFy * t);

				const age = i / TRAIL_POINTS;
				const intensity = (1 - age * age) * (0.6 + amp * 0.4);

				// Sub-pixel splat
				const gx = Math.floor(px);
				const gy = Math.floor(py);
				const fx2 = px - gx;
				const fy2 = py - gy;

				const weights = [
					[(1 - fx2) * (1 - fy2), gx, gy],
					[fx2 * (1 - fy2), gx + 1, gy],
					[(1 - fx2) * fy2, gx, gy + 1],
					[fx2 * fy2, gx + 1, gy + 1],
				] as const;

				for (const [w, xi, yi] of weights) {
					if (xi >= 0 && xi < COLS && yi >= 0 && yi < ROWS) {
						const idx = yi * COLS + xi;
						field[idx] = Math.min(1, field[idx] + intensity * w * 0.15);
					}
				}
			}

			// Head dot
			const headX = cx + radiusX * Math.sin(drawFx * phase + PHASE_DELTA);
			const headY = cy + radiusY * Math.sin(drawFy * phase);
			const hgx = Math.round(headX);
			const hgy = Math.round(headY);
			for (let dy = -1; dy <= 1; dy++) {
				for (let dx = -1; dx <= 1; dx++) {
					const xi = hgx + dx;
					const yi = hgy + dy;
					if (xi >= 0 && xi < COLS && yi >= 0 && yi < ROWS) {
						const dist = Math.sqrt(dx * dx + dy * dy);
						const headIntensity = dist === 0 ? 1 : 0.5 / dist;
						const idx = yi * COLS + xi;
						field[idx] = Math.min(1, field[idx] + headIntensity);
					}
				}
			}
		}

		function drawChladni(field: Float32Array, amp: number) {
			const currentShake = SHAKE_BASE + amp * SHAKE_AUDIO;

			// Migration timer decay
			if (migrateTimer > 0) {
				migrateTimer--;
				if (migrateTimer < 30) {
					const t = migrateTimer / 30;
					settleSpeed = SETTLE_SPEED_BASE + (SETTLE_SPEED_BOOST - SETTLE_SPEED_BASE) * t;
				}
				if (migrateTimer === 0) settleSpeed = SETTLE_SPEED_BASE;
			}

			// Simulate particles
			for (const p of particles) {
				const val = chladniFn(p.x, p.y, chladniN, chladniM);
				const [gx, gy] = chladniGrad(p.x, p.y, chladniN, chladniM);

				// Drift toward nodal lines
				p.x -= gx * val * settleSpeed;
				p.y -= gy * val * settleSpeed;

				// Micro-shake — stronger near nodal lines + audio
				const nearLine = Math.max(0.3, 1 - Math.abs(val) * 3);
				const shakeAmp = currentShake * nearLine;
				p.x += (Math.random() - 0.5) * shakeAmp;
				p.y += (Math.random() - 0.5) * shakeAmp;

				p.x += (Math.random() - 0.5) * JITTER;
				p.y += (Math.random() - 0.5) * JITTER;

				// Wrap
				if (p.x < 0) p.x += TAU;
				if (p.x > TAU) p.x -= TAU;
				if (p.y < 0) p.y += TAU;
				if (p.y > TAU) p.y -= TAU;

				// Map particle to grid cell
				const col = Math.floor((p.x / TAU) * COLS);
				const row = Math.floor((p.y / TAU) * ROWS);
				if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
					const idx = row * COLS + col;
					const dist = Math.abs(val);
					const migrating = migrateTimer > 0;
					const glow = migrating ? 0.12 + dist * 0.1 : 0.08;
					field[idx] = Math.min(1, field[idx] + glow);
				}
			}
		}

		animId = requestAnimationFrame(draw);

		// Pause when hidden
		let paused = false;
		function handleVis() {
			if (document.hidden) {
				paused = true;
				cancelAnimationFrame(animId);
			} else if (paused) {
				paused = false;
				animId = requestAnimationFrame(draw);
			}
		}
		document.addEventListener('visibilitychange', handleVis);

		return () => {
			cancelAnimationFrame(animId);
			document.removeEventListener('visibilitychange', handleVis);
			analyserRef = null;
			dataArrayRef = null;
			stopAudio();
		};
	});

	function renderMonospace(field: Float32Array): string {
		let out = '';
		for (let y = 0; y < ROWS; y++) {
			for (let x = 0; x < COLS; x++) {
				const v = field[y * COLS + x];
				const idx = Math.min(RAMP.length - 1, Math.floor(v * RAMP.length));
				out += RAMP[idx];
			}
			out += '\n';
		}
		return out;
	}
</script>

<div class="lab">
	<header class="lab-header">
		<div class="lab-title">
			<span class="hud-tag">LAB</span>
			<h1>ASCII</h1>
		</div>
		<nav class="lab-nav">
			<a href="{base}/lab" class="lab-nav-link" aria-label="Intervals">INT</a>
			<a href="{base}/lab/chords" class="lab-nav-link" aria-label="Chords">CHD</a>
			<a href="{base}/lab/scales" class="lab-nav-link" aria-label="Scales">SCL</a>
			<a href="{base}/lab/ascii" class="lab-nav-link active" aria-label="ASCII">ASC</a>
		</nav>
	</header>

	<div class="canvas-frame">
		<div class="interval-info">
			<span class="interval-name">{intervalName}</span>
			<span class="interval-ratio">{ratioLabel}</span>
		</div>

		<pre class="ascii-grid">{gridText}</pre>

		<button class="play-btn" class:playing={isPlaying} onclick={handlePlay} aria-label="Play interval">
			{#if isPlaying}
				<span class="play-icon pulse"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="5"/></svg></span>
			{:else}
				<span class="play-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="6,3 20,12 6,21"/></svg></span>
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
			<button
				class="hud-tag"
				class:dimmed={vizMode !== 'lissajous'}
				onclick={() => vizMode = 'lissajous'}
			>
				<span class="toggle-dot" class:on={vizMode === 'lissajous'}></span>LISSAJOUS
			</button>
			<button
				class="hud-tag hud-tag--blue"
				class:dimmed={vizMode !== 'chladni'}
				onclick={() => vizMode = 'chladni'}
			>
				<span class="toggle-dot" class:on={vizMode === 'chladni'}></span>CHLADNI
			</button>
		</div>
		<span class="grid-info">{COLS}×{ROWS}</span>
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
		gap: 0.75rem;
	}

	.lab-title h1 {
		font-family: var(--font-display);
		font-size: 1.2rem;
		letter-spacing: 0.15em;
		color: var(--text-primary);
	}

	.interval-info {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		z-index: 2;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.interval-name {
		font-family: var(--mono);
		font-size: 0.8rem;
		color: var(--accent);
		letter-spacing: 0.05em;
	}

	.interval-ratio {
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
		background: var(--surface, #000);
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ascii-grid {
		font-family: 'Matrix Mono', 'JetBrains Mono', 'Fira Code', monospace;
		font-size: clamp(0.35rem, 1.4vw, 0.7rem);
		line-height: 1.15;
		color: var(--accent);
		letter-spacing: 0.02em;
		margin: 0;
		padding: 1rem;
		white-space: pre;
		overflow: hidden;
		text-shadow: 0 0 4px rgba(194, 254, 12, 0.3);
		/* CRT scanline effect */
		background: repeating-linear-gradient(
			0deg,
			transparent,
			transparent 2px,
			rgba(0, 0, 0, 0.08) 2px,
			rgba(0, 0, 0, 0.08) 4px
		);
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
		margin-top: auto;
	}

	.interval-btn {
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
		width: calc((100% - 16px) / 5);
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
		margin-bottom: -0.75rem;
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

	.grid-info {
		font-family: var(--mono);
		font-size: 0.5rem;
		color: var(--text-secondary);
		letter-spacing: 0.08em;
		opacity: 0.4;
	}

	/* Play button */
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
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 0;
	}

	.play-icon svg { display: block; }

	.play-icon.pulse {
		animation: pulse-glow 0.6s ease-in-out infinite alternate;
	}

	@keyframes pulse-glow {
		from { filter: drop-shadow(0 0 4px var(--accent)); }
		to { filter: drop-shadow(0 0 16px var(--accent)) drop-shadow(0 0 24px var(--accent)); }
	}
</style>
