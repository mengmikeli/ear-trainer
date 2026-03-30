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
	const COLS = 72;
	const ROWS = 36;
	const PHASE_DELTA = Math.PI / 2;

	// ASCII brightness ramp — dark to bright
	const RAMP = ' .`-_:,;^=+/|)\\!?0oOQ#%@';

	// Trail settings
	const TRAIL_POINTS = 1200;
	const TARGET_LOOPS = 2;
	const BASE_SPEED = 0.006;

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

	// Morphing
	let morphT = 0;
	let morphTarget = 1;
	let morphTimer: ReturnType<typeof setTimeout> | null = null;

	// Mode toggle: monospace vs proportional (pretext)
	let useProportional = $state(false);

	// Pretext palette for proportional mode
	type PaletteEntry = {
		char: string;
		weight: number;
		style: string;
		brightness: number;
		width: number;
	};

	let pretextReady = false;
	let palette: PaletteEntry[] = [];
	let brightnessLookup: { mono: string; prop: { char: string; weight: number; style: string; alpha: number } | null }[] = [];

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
		morphTimer = setTimeout(() => {
			morphTarget = 1;
		}, 500);

		playInterval(rootMidi, intervalSemitones, 'ascending', state.settings.toneType);
		setTimeout(() => { if (thisGen === playGeneration) isPlaying = false; }, 2000);
	}

	let firstRun = true;
	$effect(() => {
		// Track selected to trigger
		const _ = selected;
		if (!firstRun) {
			morphTarget = 1;
			morphT = 0.3;
			handlePlay();
		} else {
			morphT = 1;
			morphTarget = 1;
		}
		firstRun = false;
	});

	onMount(async () => {
		// Load pretext dynamically
		try {
			const pretext = await import('@chenglou/pretext');
			buildPalette(pretext.prepareWithSegments);
			pretextReady = true;
		} catch (e) {
			console.warn('pretext not available, using monospace only', e);
		}

		let phase = 0;
		let animId: number;

		// Brightness field with persistence
		const field = new Float32Array(COLS * ROWS);
		const FIELD_DECAY = 0.88;

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

			// Morph interpolation
			morphT += (morphTarget - morphT) * 0.08;
			const drawFx = 1 + (fx - 1) * morphT;
			const drawFy = 1 + (fy - 1) * morphT;

			// Decay field
			for (let i = 0; i < field.length; i++) {
				field[i] *= FIELD_DECAY;
			}

			// Compute Lissajous trail points → splat into brightness field
			const radiusX = (COLS - 2) / 2;
			const radiusY = (ROWS - 2) / 2;
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

				// Intensity falls off along trail
				const age = i / TRAIL_POINTS;
				const intensity = (1 - age * age) * (0.6 + amp * 0.4);

				// Splat with anti-aliased sub-pixel distribution
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

			// Head dot — extra bright
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

			// Audio pulse — subtle global brightness boost
			if (amp > 0.05) {
				for (let i = 0; i < field.length; i++) {
					field[i] = Math.min(1, field[i] * (1 + amp * 0.15));
				}
			}

			// Render to text
			if (useProportional && pretextReady) {
				gridText = renderProportional(field);
			} else {
				gridText = renderMonospace(field);
			}

			phase += SPEED;
			animId = requestAnimationFrame(draw);
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

	function renderProportional(field: Float32Array): string {
		// For proportional mode, we still output text but use the pretext-matched chars
		// The visual difference comes from the CSS font + weight/style classes
		let out = '';
		for (let y = 0; y < ROWS; y++) {
			for (let x = 0; x < COLS; x++) {
				const v = field[y * COLS + x];
				const byte = Math.min(255, Math.floor(v * 255));
				const entry = brightnessLookup[byte];
				if (entry && entry.prop) {
					out += entry.prop.char;
				} else {
					const idx = Math.min(RAMP.length - 1, Math.floor(v * RAMP.length));
					out += RAMP[idx];
				}
			}
			out += '\n';
		}
		return out;
	}

	function buildPalette(prepareWithSegments: any) {
		const FONT_SIZE = 14;
		const FAMILY = 'Georgia, Palatino, "Times New Roman", serif';
		const CHARSET = ' .,:;!+-=*#@%&abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
		const WEIGHTS = [300, 500, 800];
		const STYLES = ['normal', 'italic'];

		// Measure brightness via canvas
		const bc = document.createElement('canvas');
		bc.width = 28; bc.height = 28;
		const bctx = bc.getContext('2d', { willReadFrequently: true })!;

		palette = [];
		for (const style of STYLES) {
			for (const weight of WEIGHTS) {
				const font = `${style === 'italic' ? 'italic ' : ''}${weight} ${FONT_SIZE}px ${FAMILY}`;
				for (const ch of CHARSET) {
					if (ch === ' ') continue;
					const prepared = prepareWithSegments(ch, font);
					const width = prepared.widths.length > 0 ? prepared.widths[0] : 0;
					if (width <= 0) continue;

					// Measure brightness
					bctx.clearRect(0, 0, 28, 28);
					bctx.font = font;
					bctx.fillStyle = '#fff';
					bctx.textBaseline = 'middle';
					bctx.fillText(ch, 1, 14);
					const data = bctx.getImageData(0, 0, 28, 28).data;
					let sum = 0;
					for (let i = 3; i < data.length; i += 4) sum += data[i];
					const brightness = sum / (255 * 28 * 28);

					palette.push({ char: ch, weight, style, brightness, width });
				}
			}
		}

		// Normalize brightness
		const maxB = Math.max(...palette.map(e => e.brightness));
		if (maxB > 0) palette.forEach(e => e.brightness /= maxB);
		palette.sort((a, b) => a.brightness - b.brightness);

		// Build 256-entry lookup
		brightnessLookup = [];
		for (let b = 0; b < 256; b++) {
			const brightness = b / 255;
			const monoIdx = Math.min(RAMP.length - 1, Math.floor(brightness * RAMP.length));
			const mono = RAMP[monoIdx];

			if (brightness < 0.03) {
				brightnessLookup.push({ mono, prop: null });
				continue;
			}

			// Binary search for closest brightness
			let lo = 0, hi = palette.length - 1;
			while (lo < hi) {
				const mid = (lo + hi) >> 1;
				if (palette[mid].brightness < brightness) lo = mid + 1;
				else hi = mid;
			}

			let best = palette[lo];
			let bestScore = Infinity;
			const start = Math.max(0, lo - 10);
			const end = Math.min(palette.length, lo + 10);
			for (let i = start; i < end; i++) {
				const e = palette[i];
				const score = Math.abs(e.brightness - brightness);
				if (score < bestScore) { bestScore = score; best = e; }
			}

			brightnessLookup.push({
				mono,
				prop: {
					char: best.char,
					weight: best.weight,
					style: best.style,
					alpha: Math.max(0.1, Math.min(1, brightness)),
				}
			});
		}
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

		<pre class="ascii-grid" class:proportional={useProportional}>{gridText}</pre>

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
			<button class="hud-tag" class:dimmed={useProportional} onclick={() => useProportional = false}>
				<span class="toggle-dot" class:on={!useProportional}></span>MONO
			</button>
			<button class="hud-tag" class:dimmed={!useProportional} onclick={() => useProportional = true}>
				<span class="toggle-dot" class:on={useProportional}></span>PRETEXT
			</button>
		</div>
		<span class="pretext-credit">
			{#if useProportional}
				proportional layout by <a href="https://github.com/chenglou/pretext" target="_blank" rel="noopener">pretext</a>
			{:else}
				monospace · {COLS}×{ROWS}
			{/if}
		</span>
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

	.ascii-grid.proportional {
		font-family: Georgia, Palatino, 'Times New Roman', serif;
		letter-spacing: 0;
		text-shadow: 0 0 6px rgba(194, 254, 12, 0.4);
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
		flex-direction: column;
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

	.pretext-credit {
		font-family: var(--mono);
		font-size: 0.5rem;
		color: var(--text-secondary);
		letter-spacing: 0.08em;
		opacity: 0.5;
	}

	.pretext-credit a {
		color: var(--accent);
		text-decoration: underline;
		text-decoration-style: dotted;
		text-underline-offset: 2px;
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
