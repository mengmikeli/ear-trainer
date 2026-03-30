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

	// Grid dimensions — computed on mount from container size
	let COLS = $state(80);
	let ROWS = $state(40);
	let cellAspect = 0.48;
	const MAX_COLS = 120;
	const MAX_ROWS = 80;

	const PHASE_DELTA = Math.PI / 2;
	const RAMP = ' .`-_:,;^=+/|)\\!?0oOQ#%@';

	const TRAIL_POINTS = 1200;
	const TARGET_LOOPS = 2;
	const BASE_SPEED = 0.006;

	// Viz source (mono only)
	type VizMode = 'lissajous' | 'chladni';
	let vizMode = $state<VizMode>('lissajous');

	// Render mode
	type RenderMode = 'mono' | 'typo';
	let renderMode = $state<RenderMode>('mono');

	let selected = $state('P5');
	let isPlaying = $state(false);
	let playGeneration = 0;
	let gridText = $state('');
	let frameRef: HTMLDivElement | undefined = $state();

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

	let field = new Float32Array(COLS * ROWS);

	// --- Poem Spotlight (TYPO mode) ---
	const POEM = `Do you know how the air trembles
when a string is touched? How the room
fills with a shape you cannot see
but feel behind your ribs, a curve
that bends the silence into something
almost like a name? Listen—
the interval between two notes
is not emptiness. It is the distance
a wave must travel to become
its own reflection, the breath held
between recognition and surprise.
Every fifth is a cathedral door
swung wide. Every minor second,
a whisper pressed against the ear.
The octave is the self returned,
older, knowing what it knew before
but hearing it as if for the first time.
And the tritone—restless, unstable—
is the question music asks
when it has forgotten how to end.
So when you listen, do not count
the semitones. Feel the geometry—
the spirals and the intersections,
the places where two frequencies
agree to build a momentary room
and then, just as gently, let it go.`;

	// Poem character grid for spotlight — built on mount
	let poemChars: { char: string; col: number; row: number }[] = [];
	let poemSpanIds: number[] = []; // flat array COLS*ROWS → poemChars index (-1 = empty)
	let poemHtmlBase = ''; // static poem spans, opacity set per-frame
	let poemLineCount = 0;
	let pretextReady = false;

	function buildPoemGrid(prepareWithSegments: Function, containerW: number) {
		const fontSpec = `400 ${POEM_FONT_SIZE} ${PROP_FONT_FAMILY}`;
		const prepared = prepareWithSegments(POEM, fontSpec);

		// Use pretext to get lines at the container width
		const { layoutWithLines } = prepareWithSegments === undefined ? { layoutWithLines: null } : { layoutWithLines: null };

		// Fallback: manually wrap the poem into COLS-width lines
		// Each character maps to a grid cell
		poemChars = [];
		poemSpanIds = new Array(COLS * ROWS).fill(-1);

		const words = POEM.split(/(\s+)/);
		let col = 0;
		let row = 0;
		let charIdx = 0;

		for (const segment of words) {
			for (const ch of segment) {
				if (ch === '\n') {
					col = 0;
					row++;
					if (row >= ROWS) break;
					continue;
				}

				if (col >= COLS) {
					col = 0;
					row++;
					if (row >= ROWS) break;
				}

				const idx = charIdx;
				poemChars.push({ char: ch, col, row });
				poemSpanIds[row * COLS + col] = idx;
				col++;
				charIdx++;
			}
			if (row >= ROWS) break;
		}
		poemLineCount = row + 1;
	}

	const PROP_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
	const POEM_FONT_SIZE = 'clamp(0.4rem, 1.3vw, 0.65rem)';
	const POEM_DIM_OPACITY = 0.06;
	const POEM_MAX_OPACITY = 1.0;

	// --- Chladni math ---
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
		const state = loadState();
		const rootMidi = 60;
		isPlaying = true;

		morphTarget = 0;
		morphT = 0;
		if (morphTimer) clearTimeout(morphTimer);
		morphTimer = setTimeout(() => { morphTarget = 1; }, 500);

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

	// --- Grid measurement ---
	function measureCharCell(container: HTMLElement): { charW: number; charH: number } {
		const probe = document.createElement('pre');
		probe.style.cssText = `
			position: absolute; visibility: hidden; white-space: pre;
			font-family: 'Matrix Mono', 'JetBrains Mono', 'Fira Code', monospace;
			font-size: clamp(0.35rem, 1.4vw, 0.7rem);
			line-height: 1.15; letter-spacing: 0.02em; padding: 0; margin: 0;
		`;
		probe.textContent = 'M';
		container.appendChild(probe);
		const rect = probe.getBoundingClientRect();
		container.removeChild(probe);
		if (rect.width > 0 && rect.height > 0) {
			cellAspect = rect.width / rect.height;
		}
		return { charW: rect.width, charH: rect.height };
	}

	function computeGridSize(container: HTMLElement): { cols: number; rows: number } {
		const { charW, charH } = measureCharCell(container);
		if (charW <= 0 || charH <= 0) return { cols: 80, rows: 40 };
		const style = getComputedStyle(container);
		const padPx = parseFloat(style.fontSize) || 16;
		const availW = container.clientWidth - padPx * 2;
		const availH = container.clientHeight - padPx * 2;
		const cols = Math.min(MAX_COLS, Math.max(20, Math.floor(availW / charW)));
		const rows = Math.min(MAX_ROWS, Math.max(10, Math.floor(availH / charH)));
		return { cols, rows };
	}

	function esc(ch: string): string {
		if (ch === '<') return '&lt;';
		if (ch === '>') return '&gt;';
		if (ch === '&') return '&amp;';
		if (ch === '"') return '&quot;';
		return ch;
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
			const [n, m] = midiToChladniMode(60);
			chladniN = n;
			chladniM = m;
			settleSpeed = SETTLE_SPEED_BOOST;
			migrateTimer = 120;
		}
		firstRun = false;
	});

	onMount(async () => {
		let phase = 0;
		let animId: number;
		const LISSAJOUS_DECAY = 0.88;

		initParticles();

		if (frameRef) {
			const size = computeGridSize(frameRef);
			COLS = size.cols;
			ROWS = size.rows;
			field = new Float32Array(COLS * ROWS);
		}

		// Load pretext and build poem grid
		try {
			const pretext = await import('@chenglou/pretext');
			buildPoemGrid(pretext.prepareWithSegments, frameRef?.clientWidth ?? 600);
			pretextReady = true;
		} catch (e) {
			console.warn('pretext not available', e);
		}

		let ro: ResizeObserver | null = null;
		if (frameRef) {
			ro = new ResizeObserver(() => {
				if (!frameRef) return;
				const size = computeGridSize(frameRef);
				if (size.cols !== COLS || size.rows !== ROWS) {
					COLS = size.cols;
					ROWS = size.rows;
					field = new Float32Array(COLS * ROWS);
					if (pretextReady) {
						const pretext = (globalThis as any).__pretextModule;
						if (pretext) buildPoemGrid(pretext.prepareWithSegments, frameRef.clientWidth);
					}
				}
			});
			ro.observe(frameRef);
		}

		// Cache pretext module for resize rebuilds
		try {
			(globalThis as any).__pretextModule = await import('@chenglou/pretext');
		} catch {}

		let typoFrameCount = 0;

		function draw() {
			const fx = RATIOS[selected][0];
			const fy = RATIOS[selected][1];

			if (analyserRef && dataArrayRef) {
				amplitude = getAmplitude(analyserRef, dataArrayRef);
			} else {
				amplitude *= 0.95;
			}
			const amp = Math.min(1, amplitude * 3);

			if (field.length !== COLS * ROWS) {
				field = new Float32Array(COLS * ROWS);
			}

			// Always compute Lissajous field (used by both mono lissajous and typo spotlight)
			if (renderMode === 'mono' && vizMode === 'chladni') {
				for (let i = 0; i < field.length; i++) field[i] = 0;
				drawChladni(field, amp);
			} else {
				for (let i = 0; i < field.length; i++) field[i] *= LISSAJOUS_DECAY;
				drawLissajous(field, fx, fy, phase, amp);
			}

			if (amp > 0.05) {
				for (let i = 0; i < field.length; i++) {
					field[i] = Math.min(1, field[i] * (1 + amp * 0.15));
				}
			}

			if (renderMode === 'typo' && pretextReady) {
				typoFrameCount++;
				if (typoFrameCount % 3 === 0) {
					gridText = renderPoemSpotlight(field);
				}
			} else {
				gridText = renderMonospace(field);
			}

			phase += SPEED;
			animId = requestAnimationFrame(draw);
		}

		function drawLissajous(field: Float32Array, fx: number, fy: number, phase: number, amp: number) {
			morphT += (morphTarget - morphT) * 0.08;
			const drawFx = 1 + (fx - 1) * morphT;
			const drawFy = 1 + (fy - 1) * morphT;

			const maxR = Math.min(COLS, ROWS / cellAspect) / 2 - 1;
			const radiusX = maxR;
			const radiusY = maxR * cellAspect;
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

			if (migrateTimer > 0) {
				migrateTimer--;
				if (migrateTimer < 30) {
					settleSpeed = SETTLE_SPEED_BASE + (SETTLE_SPEED_BOOST - SETTLE_SPEED_BASE) * (migrateTimer / 30);
				}
				if (migrateTimer === 0) settleSpeed = SETTLE_SPEED_BASE;
			}

			for (const p of particles) {
				const val = chladniFn(p.x, p.y, chladniN, chladniM);
				const [gx, gy] = chladniGrad(p.x, p.y, chladniN, chladniM);

				p.x -= gx * val * settleSpeed;
				p.y -= gy * val * settleSpeed;

				const nearLine = Math.max(0.3, 1 - Math.abs(val) * 3);
				const shakeAmp = currentShake * nearLine;
				p.x += (Math.random() - 0.5) * shakeAmp;
				p.y += (Math.random() - 0.5) * shakeAmp;
				p.x += (Math.random() - 0.5) * JITTER;
				p.y += (Math.random() - 0.5) * JITTER;

				if (p.x < 0) p.x += TAU; if (p.x > TAU) p.x -= TAU;
				if (p.y < 0) p.y += TAU; if (p.y > TAU) p.y -= TAU;

				const col = Math.floor((p.x / TAU) * COLS);
				const row = Math.floor((p.y / TAU) * ROWS);
				if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
					const idx = row * COLS + col;
					const glow = migrateTimer > 0 ? 0.12 + Math.abs(val) * 0.1 : 0.08;
					field[idx] = Math.min(1, field[idx] + glow);
				}
			}
		}

		animId = requestAnimationFrame(draw);

		let paused = false;
		function handleVis() {
			if (document.hidden) { paused = true; cancelAnimationFrame(animId); }
			else if (paused) { paused = false; animId = requestAnimationFrame(draw); }
		}
		document.addEventListener('visibilitychange', handleVis);

		return () => {
			cancelAnimationFrame(animId);
			document.removeEventListener('visibilitychange', handleVis);
			if (ro) ro.disconnect();
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

	function renderPoemSpotlight(field: Float32Array): string {
		// Build HTML: each row is a div, each char is a span with brightness-driven opacity
		let html = '';
		for (let y = 0; y < ROWS; y++) {
			html += '<div class="pr">';
			for (let x = 0; x < COLS; x++) {
				const cellIdx = y * COLS + x;
				const charInfo = poemSpanIds[cellIdx];
				const brightness = field[cellIdx];

				if (charInfo === -1 || charInfo === undefined || !poemChars[charInfo]) {
					html += '<span class="pc"> </span>';
					continue;
				}

				const ch = poemChars[charInfo].char;
				// Map brightness: dim background → full glow
				const opacity = POEM_DIM_OPACITY + brightness * (POEM_MAX_OPACITY - POEM_DIM_OPACITY);
				const glow = brightness > 0.3 ? `text-shadow:0 0 ${(brightness * 8).toFixed(0)}px rgba(194,254,12,${(brightness * 0.6).toFixed(2)})` : '';
				html += `<span class="pc" style="opacity:${opacity.toFixed(3)}${glow ? ';' + glow : ''}">${esc(ch)}</span>`;
			}
			html += '</div>';
		}
		return html;
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

	<div class="canvas-frame" bind:this={frameRef}>
		<div class="interval-info">
			<span class="interval-name">{intervalName}</span>
			<span class="interval-ratio">{ratioLabel}</span>
		</div>

		{#if renderMode === 'mono'}
			<pre class="ascii-grid">{gridText}</pre>
		{:else}
			<div class="ascii-grid poem-grid">{@html gridText}</div>
		{/if}

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
			{#if renderMode === 'mono'}
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
			{/if}
			<span class="footer-sep">·</span>
			<button
				class="hud-tag"
				class:dimmed={renderMode !== 'mono'}
				onclick={() => renderMode = 'mono'}
			>
				<span class="toggle-dot" class:on={renderMode === 'mono'}></span>MONO
			</button>
			<button
				class="hud-tag"
				class:dimmed={renderMode !== 'typo'}
				onclick={() => { if (pretextReady) renderMode = 'typo'; }}
				class:unavailable={!pretextReady}
			>
				<span class="toggle-dot" class:on={renderMode === 'typo'}></span>POEM
			</button>
		</div>
		<span class="grid-info">{COLS}×{ROWS}{renderMode === 'typo' ? ' · pretext spotlight' : ''}</span>
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

	.lab-nav { display: flex; gap: 0.25rem; }

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

	.lab-nav-link:hover { border-color: var(--accent); color: var(--text-primary); }
	.lab-nav-link.active { border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }

	.lab-title { display: flex; align-items: center; gap: 0.75rem; }
	.lab-title h1 {
		font-family: var(--font-display);
		font-size: 1.2rem;
		letter-spacing: 0.15em;
		color: var(--text-primary);
	}

	.interval-info {
		position: absolute; top: 0.5rem; left: 0.5rem; z-index: 2;
		display: flex; flex-direction: column; gap: 0.1rem;
	}
	.interval-name { font-family: var(--mono); font-size: 0.8rem; color: var(--accent); letter-spacing: 0.05em; }
	.interval-ratio { font-family: var(--mono); font-size: 0.6rem; color: var(--text-secondary); letter-spacing: 0.08em; opacity: 0.7; }

	.canvas-frame {
		position: relative; flex: 1; min-height: 0;
		border: 1px solid var(--border-heavy);
		background: var(--surface, #000);
		overflow: hidden;
		display: flex; align-items: center; justify-content: center;
	}

	/* Monospace mode */
	pre.ascii-grid {
		font-family: 'Matrix Mono', 'JetBrains Mono', 'Fira Code', monospace;
		font-size: clamp(0.35rem, 1.4vw, 0.7rem);
		line-height: 1.15;
		color: var(--accent);
		letter-spacing: 0.02em;
		margin: 0; padding: 1rem;
		white-space: pre; overflow: hidden;
		text-shadow: 0 0 4px rgba(194, 254, 12, 0.3);
		background: repeating-linear-gradient(
			0deg, transparent, transparent 2px,
			rgba(0, 0, 0, 0.08) 2px, rgba(0, 0, 0, 0.08) 4px
		);
	}

	/* Poem spotlight mode */
	.poem-grid {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		font-size: clamp(0.4rem, 1.3vw, 0.65rem);
		line-height: 1.35;
		color: var(--accent);
		margin: 0; padding: 1rem 1.5rem;
		overflow: hidden;
		background: repeating-linear-gradient(
			0deg, transparent, transparent 2px,
			rgba(0, 0, 0, 0.04) 2px, rgba(0, 0, 0, 0.04) 4px
		);
	}

	.poem-grid :global(.pr) {
		white-space: nowrap;
		overflow: hidden;
	}

	.poem-grid :global(.pc) {
		display: inline;
		transition: none;
	}

	.frame-corner {
		position: absolute; width: 12px; height: 12px;
		border-color: var(--accent); border-style: solid; opacity: 0.4;
	}
	.frame-corner.tl { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
	.frame-corner.tr { top: -1px; right: -1px; border-width: 2px 2px 0 0; }
	.frame-corner.bl { bottom: -1px; left: -1px; border-width: 0 0 2px 2px; }
	.frame-corner.br { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }

	.selector {
		display: flex; flex-wrap: wrap; gap: 4px;
		justify-content: center; margin-top: auto;
	}

	.interval-btn {
		font-family: 'BPdots', var(--mono);
		font-size: 1.3rem; font-weight: 900;
		letter-spacing: 0.03em; text-transform: none;
		padding: 0.15rem 0.4rem 0.35rem 0.5rem;
		border: 1px solid var(--border-heavy);
		color: var(--text-secondary);
		background: var(--surface);
		transition: all 0.15s ease;
		width: calc((100% - 16px) / 5);
		text-align: center; line-height: 1;
		display: inline-flex; align-items: center; justify-content: center;
	}

	.interval-btn:hover { border-color: var(--accent); color: var(--text-primary); }
	.interval-btn.active { border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }

	.lab-footer {
		display: flex; align-items: center; justify-content: center;
		gap: 0.75rem; margin-bottom: -0.75rem; flex-direction: column;
	}

	.footer-tags { display: flex; gap: 0.35rem; align-items: center; }
	.footer-sep { color: var(--text-secondary); opacity: 0.3; font-size: 0.6rem; }

	.footer-tags .hud-tag { cursor: pointer; transition: opacity 0.15s ease; }
	.footer-tags .hud-tag.dimmed { opacity: 0.3; }
	.footer-tags .hud-tag.unavailable { opacity: 0.15; cursor: not-allowed; }

	.toggle-dot {
		display: inline-block; width: 6px; height: 6px;
		border-radius: 50%; border: 1px solid currentColor;
		margin-right: 0.3rem; vertical-align: middle;
		transition: all 0.15s ease;
	}
	.toggle-dot.on { background: currentColor; box-shadow: 0 0 4px currentColor; }

	.grid-info {
		font-family: var(--mono); font-size: 0.5rem;
		color: var(--text-secondary); letter-spacing: 0.08em; opacity: 0.4;
	}

	.play-btn {
		position: absolute; bottom: 0.75rem; right: 0.75rem; z-index: 2;
		width: 2.5rem; height: 2.5rem; border-radius: 50%;
		border: 1px solid var(--accent);
		background: rgba(0, 0, 0, 0.6); color: var(--accent);
		display: flex; align-items: center; justify-content: center;
		transition: all 0.15s ease; backdrop-filter: blur(4px);
	}
	.play-btn:hover { background: rgba(194, 254, 12, 0.15); box-shadow: 0 0 12px rgba(194, 254, 12, 0.3); }
	.play-btn.playing { border-color: var(--accent); box-shadow: 0 0 16px rgba(194, 254, 12, 0.4); }

	.play-icon { display: flex; align-items: center; justify-content: center; line-height: 0; }
	.play-icon svg { display: block; }
	.play-icon.pulse { animation: pulse-glow 0.6s ease-in-out infinite alternate; }

	@keyframes pulse-glow {
		from { filter: drop-shadow(0 0 4px var(--accent)); }
		to { filter: drop-shadow(0 0 16px var(--accent)) drop-shadow(0 0 24px var(--accent)); }
	}
</style>
