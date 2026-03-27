<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { chladniSuper, chladniGradSuper, midiToChladniMode } from '$lib/viz';
	import type { ChladniMode } from '$lib/viz';
	import { getAnalyser, getAmplitude, playNote, stopAudio } from '$lib/audio';
	import { loadState } from '$lib/state';

	// ── Scale definitions ──
	interface ScaleDef {
		id: string;
		name: string;
		intervals: number[]; // semitones from root
	}

	const SCALES: ScaleDef[] = [
		{ id: 'Maj', name: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11, 12] },
		{ id: 'Min', name: 'Natural Minor', intervals: [0, 2, 3, 5, 7, 8, 10, 12] },
		{ id: 'hMin', name: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11, 12] },
		{ id: 'mMin', name: 'Melodic Minor', intervals: [0, 2, 3, 5, 7, 9, 11, 12] },
		{ id: 'Dor', name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10, 12] },
		{ id: 'Mix', name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10, 12] },
		{ id: 'MajP', name: 'Major Pentatonic', intervals: [0, 2, 4, 7, 9, 12] },
		{ id: 'MinP', name: 'Minor Pentatonic', intervals: [0, 3, 5, 7, 10, 12] },
		{ id: 'Blu', name: 'Blues', intervals: [0, 3, 5, 6, 7, 10, 12] },
		{ id: 'Chr', name: 'Chromatic', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
	];

	const ROOT_MIDI = 60;

	// ── State ──
	let selected = $state('Maj');
	let isPlaying = $state(false);
	let showChladni = $state(true);
	let showCircle = $state(true);
	let chladniOpacity = 1;
	let circleOpacity = 1;
	let currentStep = $state(-1); // -1 = idle, 0..n = playing step
	let dotProgress = $state(0); // smooth interpolation toward currentStep
	let dotTarget = $state(0);   // where the dot is heading
	let mainCanvas: HTMLCanvasElement;
	let animId: number;

	let scale = $derived(SCALES.find(s => s.id === selected)!);

	// ── Chromatic circle state machine ──
	type CirclePhase = 'rest-empty' | 'playing' | 'fade-in' | 'hold' | 'fade-out' | 'rest-visited';
	let circlePhase: CirclePhase = 'rest-empty';
	let circleTimer = 0;          // frames in current phase
	let circleFadeAlpha = 0;      // 0→1 for shade fade-in/out
	let completionTimer = 0;      // total frames since completion started (for perimeter dot)
	let visitedPitchClasses: number[] = []; // which PCs were played (persists after fade)
	// ── Random electron pulse system (2 simultaneous, can overlap) ──
	let pulseDots: { pc: number; phase: number }[] = []; // active pulses
	const PULSE_DURATION = 90;    // frames per pulse (~1.5s)
	const PULSE_SPAWN_RATE = 45;  // frames between spawns (~0.75s)
	let pulseSpawnTimer = 0;
	let pulsePool: number[] = Array.from({ length: 12 }, (_, i) => i); // which dots can pulse
	const FADE_IN_FRAMES = 30;    // ~0.5s
	const HOLD_FRAMES = 45;       // ~0.75s
	const FADE_OUT_FRAMES = 120;   // ~2s
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
	let currentModes: ChladniMode[] = [{ n: 1, m: 1, amp: 1 }]; // rest = random scatter

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

		// Init audio analyser for reactive particles
		if (!analyserRef) {
			const { analyser, dataArray } = getAnalyser();
			analyserRef = analyser;
			dataArrayRef = dataArray;
		}

		isPlaying = true;
		currentStep = 0;
		dotProgress = 0;
		dotTarget = 0;
		circlePhase = 'playing';
		circleFadeAlpha = 0;
		visitedPitchClasses = [];

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
				// Store visited pitch classes for rest state
				visitedPitchClasses = [...new Set(intervals.map(s => s % 12))];
				// Trigger fade-in sequence
				circlePhase = 'fade-in';
				circleTimer = 0;
				circleFadeAlpha = 0;
				completionTimer = 0;
				setTimeout(() => {
					if (thisGen === playGeneration) isPlaying = false;
				}, 500);
				return;
			}

			const midi = ROOT_MIDI + intervals[step];
			const [n, m] = midiToChladniMode(midi);
			currentModes = [{ n, m, amp: 1 }];
			currentStep = step;
			dotTarget = step;

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

			// Play the note through shared audio (analyser-connected, respects tone setting)
			const state = loadState();
			playNote(midi, state.settings.toneType, 0.45);

			step++;
			setTimeout(nextStep, 500); // 500ms per note
		}

		nextStep();
	}

	// React to scale selection change
	let firstRun = true;
	$effect(() => {
		const s = scale;
		// Reset chromatic circle state
		currentStep = -1;
		dotProgress = 0;
		dotTarget = 0;
		circlePhase = 'rest-empty';
		circleFadeAlpha = 0;
		visitedPitchClasses = [];
		if (particles.length === 0) initParticles();
		if (!firstRun) {
			const [n, m] = midiToChladniMode(ROOT_MIDI + s.intervals[0]);
			currentModes = [{ n, m, amp: 1 }];
			settleSpeed = SETTLE_SPEED_BOOST;
			migrateTimer = 90;
			setTimeout(() => playScale(), 100);
		} else {
			// First load — start settling immediately
			const [n, m] = midiToChladniMode(ROOT_MIDI + s.intervals[0]);
			currentModes = [{ n, m, amp: 1 }];
			settleSpeed = SETTLE_SPEED_BOOST;
			migrateTimer = 90;		}
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
		const ro = new ResizeObserver(() => resize());
		ro.observe(mainCanvas);
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

			const amp = Math.min(1, amplitude * 3);

			// Smooth layer transitions
			chladniOpacity += ((showChladni ? 1 : 0) - chladniOpacity) * 0.06;
			circleOpacity += ((showCircle ? 1 : 0) - circleOpacity) * 0.06;

			// ── Chladni particles ──
			if (chladniOpacity > 0.01) {
			const TAU = Math.PI * 2;
			const useModes = currentModes;
			const migrating = migrateTimer > 0;
			const currentShake = SHAKE_BASE + amp * SHAKE_AUDIO;

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
				const migrateGlow = migrating ? 0.3 * (dist * 2) : 0;
				const alpha = Math.min(0.7, Math.max(0.05, 0.4 - dist * 1.5) + migrateGlow);

				ctx.globalAlpha = alpha * chladniOpacity;
				ctx.fillStyle = migrating ? '#5A4CFF' : '#3A2CFF';
				const pSize = migrating ? 1.6 : 1.2;
				ctx.fillRect(sx, sy, pSize, pSize);
			}
			ctx.globalAlpha = 1;
			} // end chladniOpacity

			const cx = w / 2, cy = h / 2;

			// ── CHROMATIC CIRCLE (state machine) ──
			if (circleOpacity > 0.01) {
			const circleRadius = Math.min(cx, cy) * 0.78;
			const radiusPulse = 1 + amp * 0.12;
			const activeRadius = circleRadius * radiusPulse;
			const scaleIntervals = scale.intervals;

			// State machine transitions
			if (circlePhase === 'fade-in') {
				circleTimer++;
				completionTimer++;
				circleFadeAlpha = Math.min(1, circleTimer / FADE_IN_FRAMES);
				if (circleTimer >= FADE_IN_FRAMES) {
					circlePhase = 'hold';
					circleTimer = 0;
				}
			} else if (circlePhase === 'hold') {
				circleTimer++;
				completionTimer++;
				if (circleTimer >= HOLD_FRAMES) {
					circlePhase = 'fade-out';
					circleTimer = 0;
				}
			} else if (circlePhase === 'fade-out') {
				circleTimer++;
				completionTimer++;
				circleFadeAlpha = Math.max(0, 1 - circleTimer / FADE_OUT_FRAMES);
				if (circleTimer >= FADE_OUT_FRAMES) {
					circlePhase = 'rest-visited';
					circleTimer = 0;
					completionTimer = 0;
				}
			}

			// Smooth dot traversal
			dotProgress += (dotTarget - dotProgress) * 0.12;

			// Random electron pulse system
			const showPulses = circlePhase === 'rest-empty' || circlePhase === 'rest-visited';
			if (showPulses) {
				// Spawn new pulse
				pulseSpawnTimer++;
				if (pulseSpawnTimer >= PULSE_SPAWN_RATE && pulseDots.length < 2) {
					pulseSpawnTimer = 0;
					const pool = (circlePhase === 'rest-visited' && visitedPitchClasses.length > 0)
						? visitedPitchClasses
						: pulsePool;
					const pc = pool[Math.floor(Math.random() * pool.length)];
					pulseDots.push({ pc, phase: 0 });
				}
				// Update + remove expired
				pulseDots = pulseDots.filter(p => {
					p.phase++;
					return p.phase < PULSE_DURATION;
				});
			} else if (circlePhase === 'fade-out') {
				// Smooth transition: let existing pulses finish but don't spawn new
				pulseDots = pulseDots.filter(p => {
					p.phase++;
					return p.phase < PULSE_DURATION;
				});
			} else {
				pulseDots = [];
			}

			function pcAngle(pc: number): number {
				return (pc / 12) * Math.PI * 2 - Math.PI / 2;
			}
			function chromaticPos(pc: number): [number, number] {
				const a = pcAngle(pc);
				return [cx + Math.cos(a) * activeRadius, cy + Math.sin(a) * activeRadius];
			}

			// Outer ring — multi-layer glow (matching interval Lissajous depth)
			ctx.strokeStyle = '#C2FE0C';
			ctx.shadowColor = '#C2FE0C';
			// Pass 3: outer glow (widest, dimmest)
			ctx.lineWidth = 3;
			ctx.shadowBlur = 8;
			ctx.globalAlpha = 0.08;
			ctx.beginPath();
			ctx.arc(cx, cy, activeRadius, 0, Math.PI * 2);
			ctx.stroke();
			// Pass 2: bloom
			ctx.lineWidth = 1.8;
			ctx.shadowBlur = 4;
			ctx.globalAlpha = 0.25;
			ctx.beginPath();
			ctx.arc(cx, cy, activeRadius, 0, Math.PI * 2);
			ctx.stroke();
			// Pass 1: primary stroke
			ctx.lineWidth = 1.2;
			ctx.shadowBlur = 2;
			ctx.globalAlpha = 0.8;
			ctx.beginPath();
			ctx.arc(cx, cy, activeRadius, 0, Math.PI * 2);
			ctx.stroke();
			ctx.globalAlpha = 1;
			ctx.shadowBlur = 0;

			// 12 chromatic dots (dim, with random pulse glow)
			for (let pc = 0; pc < 12; pc++) {
				const [dx, dy] = chromaticPos(pc);
				const isVisited = visitedPitchClasses.includes(pc);
				const isCompletionPulse = isVisited && (circlePhase === 'fade-in' || circlePhase === 'hold' || circlePhase === 'fade-out');

				// Check if this dot has an active pulse
				const activePulse = pulseDots.find(p => p.pc === pc);
				const pulseAlpha = activePulse
					? Math.sin((activePulse.phase / PULSE_DURATION) * Math.PI) // smooth 0→1→0
					: 0;

				let dotAlpha = 0.12;
				let dotSize = 1.5;

				if (isVisited && (circlePhase === 'rest-visited')) {
					dotAlpha = 0.4;
					dotSize = 2.5;
				}
				if (isCompletionPulse) {
					dotAlpha = 0.5 + circleFadeAlpha * 0.5;
					dotSize = 3 + circleFadeAlpha * 1.5;
				}
				if (pulseAlpha > 0) {
					dotAlpha = Math.max(dotAlpha, 0.15 + pulseAlpha * 0.7);
					dotSize = Math.max(dotSize, 2 + pulseAlpha * 2.5);
				}

				ctx.beginPath();
				ctx.arc(dx, dy, dotSize, 0, Math.PI * 2);
				ctx.fillStyle = '#C2FE0C';
				ctx.globalAlpha = dotAlpha;
				if (pulseAlpha > 0.3) {
					ctx.shadowColor = '#C2FE0C';
					ctx.shadowBlur = pulseAlpha * 12;
				}
				if (isCompletionPulse) {
					ctx.shadowColor = '#C2FE0C';
					ctx.shadowBlur = circleFadeAlpha * 8;
				}
				ctx.fill();
				ctx.shadowBlur = 0;
				ctx.globalAlpha = 1;
			}

			// Edge count for progressive drawing
			const edgesDrawn = (circlePhase === 'playing' && currentStep >= 0)
				? currentStep
				: (circlePhase !== 'rest-empty' ? scaleIntervals.length - 1 : 0);

			// Progressive arc edges + fade
			const edgeAlpha = (circlePhase === 'fade-out') ? circleFadeAlpha
				: (circlePhase === 'rest-empty') ? 0 : 1;

			if (edgesDrawn > 0 && edgeAlpha > 0.01) {
				ctx.strokeStyle = '#C2FE0C';
				ctx.lineWidth = 1.5 + amp * 1;
				ctx.shadowColor = '#C2FE0C';
				ctx.shadowBlur = 3 + amp * 6;
				ctx.globalAlpha = (0.5 + amp * 0.3) * edgeAlpha;

				for (let i = 0; i < edgesDrawn; i++) {
					const fromPC = scaleIntervals[i] % 12;
					const toPC = scaleIntervals[i + 1] % 12;
					let startAngle = pcAngle(fromPC);
					let endAngle = pcAngle(toPC);
					if (endAngle <= startAngle) endAngle += Math.PI * 2;
					ctx.beginPath();
					ctx.arc(cx, cy, activeRadius, startAngle, endAngle);
					ctx.stroke();
				}
				ctx.globalAlpha = 1;
				ctx.shadowBlur = 0;
			}

			// Gradient shade (radial: brighter center → dim edges)
			const shadeAlpha = (circlePhase === 'fade-in' || circlePhase === 'hold') ? circleFadeAlpha
				: (circlePhase === 'fade-out') ? circleFadeAlpha
				: 0;

			if (shadeAlpha > 0.01 && visitedPitchClasses.length >= 3) {
				const uniquePCs = [...new Set(scaleIntervals.map(s => s % 12))];

				// Build polygon path
				ctx.beginPath();
				for (let i = 0; i < uniquePCs.length; i++) {
					const [px, py] = chromaticPos(uniquePCs[i]);
					if (i === 0) ctx.moveTo(px, py);
					else ctx.lineTo(px, py);
				}
				ctx.closePath();

				// Pass 1: Outer glow (bloom behind the shape)
				ctx.save();
				ctx.shadowColor = '#C2FE0C';
				ctx.shadowBlur = 20 * shadeAlpha;
				ctx.fillStyle = `rgba(194, 254, 12, ${0.15 * shadeAlpha})`;
				ctx.fill();
				ctx.restore();

				// Pass 2: Radial gradient fill (bright center → dim edges)
				ctx.save();
				ctx.beginPath();
				for (let i = 0; i < uniquePCs.length; i++) {
					const [px, py] = chromaticPos(uniquePCs[i]);
					if (i === 0) ctx.moveTo(px, py);
					else ctx.lineTo(px, py);
				}
				ctx.closePath();
				ctx.clip();
				const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, activeRadius);
				grad.addColorStop(0, `rgba(194, 254, 12, ${0.5 * shadeAlpha})`);
				grad.addColorStop(0.4, `rgba(194, 254, 12, ${0.25 * shadeAlpha})`);
				grad.addColorStop(0.8, `rgba(194, 254, 12, ${0.10 * shadeAlpha})`);
				grad.addColorStop(1, `rgba(194, 254, 12, ${0.03 * shadeAlpha})`);
				ctx.fillStyle = grad;
				ctx.fillRect(0, 0, w, h);
				ctx.restore();

				// Trail-based polygon border (dot traces perimeter with fading tail)
				const totalCycleFrames = FADE_IN_FRAMES + HOLD_FRAMES + FADE_OUT_FRAMES;
				if (completionTimer > 0 && completionTimer <= totalCycleFrames) {
					const rawProgress = Math.min(completionTimer / totalCycleFrames, 1);
					const easedProgress = 1 - Math.pow(1 - rawProgress, 2.5); // ease-out

					const totalEdges = uniquePCs.length;
					const headPos = easedProgress * totalEdges; // how far the head has traveled

					// Trail length: covers ~40% of the perimeter
					const trailLength = totalEdges * 0.4;

					// Draw trail as segmented path with alpha decay
					const TRAIL_SEGMENTS = 30;
					ctx.strokeStyle = '#C2FE0C';
					ctx.shadowColor = '#C2FE0C';

					for (let seg = 0; seg < TRAIL_SEGMENTS; seg++) {
						const segStart = headPos - (seg / TRAIL_SEGMENTS) * trailLength;
						const segEnd = headPos - ((seg + 1) / TRAIL_SEGMENTS) * trailLength;
						if (segStart < 0) break; // trail hasn't extended this far yet

						const segAlpha = (1 - seg / TRAIL_SEGMENTS);
						const quadAlpha = segAlpha * segAlpha; // quadratic decay

						// Get positions along polygon
						function polyPos(edgePos: number): [number, number] {
							const clamped = Math.max(0, edgePos);
							const idx = Math.min(Math.floor(clamped), totalEdges - 1);
							const frac = clamped - idx;
							const from = uniquePCs[idx];
							const to = uniquePCs[(idx + 1) % totalEdges];
							const [fx2, fy2] = chromaticPos(from);
							const [tx2, ty2] = chromaticPos(to);
							return [fx2 + (tx2 - fx2) * frac, fy2 + (ty2 - fy2) * frac];
						}

						const [sx, sy] = polyPos(Math.max(segEnd, 0));
						const [ex, ey] = polyPos(segStart);

						ctx.beginPath();
						ctx.moveTo(sx, sy);
						ctx.lineTo(ex, ey);
						ctx.lineWidth = 1.2 + quadAlpha * 0.8;
						ctx.shadowBlur = 2 + quadAlpha * 6;
						ctx.globalAlpha = quadAlpha * 0.8 * shadeAlpha;
						ctx.stroke();
					}

					// Head dot
					const headEdgePos = Math.min(headPos, totalEdges);
					const hIdx = Math.min(Math.floor(headEdgePos), totalEdges - 1);
					const hFrac = headEdgePos - hIdx;
					const hFrom = uniquePCs[hIdx];
					const hTo = uniquePCs[(hIdx + 1) % totalEdges];
					const [hfx, hfy] = chromaticPos(hFrom);
					const [htx, hty] = chromaticPos(hTo);
					const hdx = hfx + (htx - hfx) * hFrac;
					const hdy = hfy + (hty - hfy) * hFrac;

					ctx.beginPath();
					ctx.arc(hdx, hdy, 3.5, 0, Math.PI * 2);
					ctx.fillStyle = '#C2FE0C';
					ctx.shadowBlur = 10 * shadeAlpha;
					ctx.globalAlpha = 0.9 * shadeAlpha;
					ctx.fill();

					ctx.globalAlpha = 1;
					ctx.shadowBlur = 0;
				}
			}

			// Lit dots for currently playing notes
			if (circlePhase === 'playing' && currentStep >= 0) {
				const playedPCs = [...new Set(scaleIntervals.slice(0, currentStep + 1).map(s => s % 12))];
				for (let i = 0; i < playedPCs.length; i++) {
					const pc = playedPCs[i];
					const [dx, dy] = chromaticPos(pc);
					const isRoot = pc === 0;
					ctx.beginPath();
					ctx.arc(dx, dy, isRoot ? 4 : 3, 0, Math.PI * 2);
					ctx.fillStyle = '#C2FE0C';
					ctx.globalAlpha = isRoot ? 1 : 0.7;
					if (isRoot) {
						ctx.shadowColor = '#C2FE0C';
						ctx.shadowBlur = 6 + amp * 4;
					}
					ctx.fill();
					ctx.shadowBlur = 0;
					ctx.globalAlpha = 1;
				}
			}

			// Animated traversal dot
			if (circlePhase === 'playing' && currentStep >= 0) {
				const fromIdx = Math.floor(dotProgress);
				const toIdx = Math.min(fromIdx + 1, scaleIntervals.length - 1);
				const frac = dotProgress - fromIdx;
				const eased = frac < 0.5
					? 4 * frac * frac * frac
					: 1 - Math.pow(-2 * frac + 2, 3) / 2;

				const fromPC = scaleIntervals[fromIdx] % 12;
				const toPC = scaleIntervals[toIdx] % 12;
				let fromAngle = pcAngle(fromPC);
				let toAngle = pcAngle(toPC);
				if (toAngle <= fromAngle) toAngle += Math.PI * 2;
				const angle = fromAngle + (toAngle - fromAngle) * eased;
				const tx = cx + Math.cos(angle) * activeRadius;
				const ty = cy + Math.sin(angle) * activeRadius;

				ctx.beginPath();
				ctx.arc(tx, ty, 5 + amp * 3, 0, Math.PI * 2);
				ctx.fillStyle = '#C2FE0C';
				ctx.shadowColor = '#C2FE0C';
				ctx.shadowBlur = 10 + amp * 12;
				ctx.globalAlpha = 0.9;
				ctx.fill();
				ctx.globalAlpha = 1;
				ctx.shadowBlur = 0;
			}
			} // end circleOpacity

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

			// ── Scanline flicker ──
			if (frameCount % 120 < 2) {
				const glitchY = Math.random() * h;
				ctx.fillStyle = 'rgba(194, 254, 12, 0.03)';
				ctx.fillRect(0, glitchY, w, 1);
			}

			frameCount++;
			animId = requestAnimationFrame(draw);
		}

		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);

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
			window.removeEventListener('resize', resize);
			ro.disconnect();
			// Kill any in-progress scale playback
			playGeneration++;
			isPlaying = false;
			analyserRef = null;
			dataArrayRef = null;
			stopAudio();
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
			<a href="{base}/lab/chords" class="lab-nav-link" aria-label="Chords">CHD</a>
			<a href="{base}/lab/scales" class="lab-nav-link active" aria-label="Scales">SCL</a>
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
			<button class="hud-tag hud-tag--blue" class:dimmed={!showChladni} onclick={() => showChladni = !showChladni}>
				<span class="toggle-dot" class:on={showChladni}></span>CHLADNI
			</button>
			<button class="hud-tag" class:dimmed={!showCircle} onclick={() => showCircle = !showCircle}>
				<span class="toggle-dot" class:on={showCircle}></span>CHROMATIC
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
		gap: 0.75rem;
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
		margin-top: auto;
	}	.scale-btn {
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
		width: calc((100% - 12px) / 4);
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

</style>
