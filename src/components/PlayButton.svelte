<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		onplay: () => void;
		replaying?: boolean;
		playing?: boolean;
		noBorder?: boolean;
		questionNum?: number;
		glitching?: boolean;
		countdownPct?: number;
		feedback?: 'correct' | 'wrong' | null;
		semitones?: number;
	}
	let { onplay, replaying = false, playing = false, noBorder = false, questionNum = 1, glitching = false, countdownPct = -1, feedback = null, semitones = 0 }: Props = $props();

	// Map semitones (0-12) to angle: 0=top (P1), clockwise
	const ringAngle = $derived((semitones / 12) * 360);
	// Offset strength scales with semitones — P1 (0) has no bias, TT (6) has max
	const maxBias = $derived((semitones / 12) * 15);

	// Phase: root note = centered, interval note = biased
	let ringPhase: 'root' | 'interval' = $state('root');
	let phaseTimeout: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		if (playing) {
			ringPhase = 'root';
			if (phaseTimeout) clearTimeout(phaseTimeout);
			// Switch to interval bias after first note + gap (~750ms)
			phaseTimeout = setTimeout(() => { ringPhase = 'interval'; }, 750);
		} else {
			ringPhase = 'root';
			if (phaseTimeout) { clearTimeout(phaseTimeout); phaseTimeout = null; }
		}
	});

	const activeBias = $derived(ringPhase === 'interval' ? maxBias : 0);
	const originX = $derived(75 - Math.sin(ringAngle * Math.PI / 180) * activeBias);
	const originY = $derived(75 + Math.cos(ringAngle * Math.PI / 180) * activeBias);

	let phase = $state(0);
	let animFrame: number | null = null;
	let glitchText = $state('');
	let feedbackGlyph = $state('');
	let glitchInterval: ReturnType<typeof setInterval> | null = null;
	let feedbackInterval: ReturnType<typeof setInterval> | null = null;
	let showRings = $state(false);
	let ringsFading = $state(false);
	let fadeTimeout: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		if (playing) {
			if (fadeTimeout) { clearTimeout(fadeTimeout); fadeTimeout = null; }
			ringsFading = false;
			showRings = true;
		} else if (showRings) {
			ringsFading = true;
			fadeTimeout = setTimeout(() => {
				showRings = false;
				ringsFading = false;
			}, 600);
		}
	});

	// Matrix Mono PUA glyphs
	const correctGlyphs = ['\uE018', '\uE013', '\uE014', '\uE012', '\uE011']; // FaceHappy, Crosshair, Target, Frame, ArrowRight
	const wrongGlyphs = ['\uE019', '\uE015', '\uE016']; // FaceSad, Star, QR
	const glitchChars = ['\uE000', '\uE001', '\uE002', '\uE003', '\uE004', '\uE005', '\uE006', '\uE007', '\uE008', '\uE010', '\uE017']; // Checker, Grid, Arrows, Swoosh

	$effect(() => {
		if (glitching) {
			glitchInterval = setInterval(() => {
				glitchText = glitchChars[Math.floor(Math.random() * glitchChars.length)];
			}, 50);
		} else {
			if (glitchInterval) {
				clearInterval(glitchInterval);
				glitchInterval = null;
			}
			glitchText = '';
		}
	});

	$effect(() => {
		if (feedback) {
			const pool = feedback === 'correct' ? correctGlyphs : wrongGlyphs;
			// Initial fast glitch through random glyphs, then settle
			let tick = 0;
			feedbackGlyph = glitchChars[Math.floor(Math.random() * glitchChars.length)];
			feedbackInterval = setInterval(() => {
				tick++;
				if (tick < 6) {
					// Fast glitch: random from all glyphs
					feedbackGlyph = glitchChars[Math.floor(Math.random() * glitchChars.length)];
				} else if (tick < 10) {
					// Settling: mix of target pool and glitch
					feedbackGlyph = Math.random() > 0.4
						? pool[Math.floor(Math.random() * pool.length)]
						: glitchChars[Math.floor(Math.random() * glitchChars.length)];
				} else {
					// Settled: cycle through target pool
					feedbackGlyph = pool[Math.floor(Math.random() * pool.length)];
				}
			}, 60);
		} else {
			if (feedbackInterval) {
				clearInterval(feedbackInterval);
				feedbackInterval = null;
			}
			feedbackGlyph = '';
		}
	});

	// Seeded pseudo-random for deterministic but organic-looking waves
	function seededRandom(seed: number): number {
		const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
		return x - Math.floor(x);
	}

	function generateWavyCircle(cx: number, cy: number, baseRadius: number, amplitude: number, frequency: number, phaseOffset: number, seed: number): string {
		const points: string[] = [];
		const steps = 120;
		for (let i = 0; i <= steps; i++) {
			const angle = (i / steps) * Math.PI * 2;
			const wave1 = Math.sin(angle * frequency + phaseOffset) * amplitude;
			const wave2 = Math.sin(angle * (frequency * 1.7) + phaseOffset * 0.6 + 3.1) * amplitude * 0.5;
			const wave3 = Math.sin(angle * (frequency * 3.1) + phaseOffset * 1.3 + 1.7) * amplitude * 0.3;
			const noise = (seededRandom(i + seed + Math.floor(phaseOffset * 2)) - 0.5) * amplitude * 0.6;
			const r = baseRadius + wave1 + wave2 + wave3 + noise;
			const x = cx + Math.cos(angle) * r;
			const y = cy + Math.sin(angle) * r;
			points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`);
		}
		return points.join(' ') + 'Z';
	}

	function animate() {
		phase += 0.04;
		animFrame = requestAnimationFrame(animate);
	}

	onMount(() => {
		animFrame = requestAnimationFrame(animate);
	});

	onDestroy(() => {
		if (animFrame !== null) cancelAnimationFrame(animFrame);
		if (glitchInterval) clearInterval(glitchInterval);
		if (feedbackInterval) clearInterval(feedbackInterval);
		if (fadeTimeout) clearTimeout(fadeTimeout);
		if (phaseTimeout) clearTimeout(phaseTimeout);
	});

	const ring1 = $derived(generateWavyCircle(75, 75, 42, 4, 6, phase, 1));
	const ring2 = $derived(generateWavyCircle(75, 75, 52, 5, 5, phase * 0.7 + 1, 2));
	const ring3 = $derived(generateWavyCircle(75, 75, 62, 6, 7, phase * 1.1 + 2, 3));

	const displayText = $derived.by(() => {
		if (feedbackGlyph) return feedbackGlyph;
		if (glitching) return glitchText;
		return `Q${questionNum}`;
	});

	const feedbackCorrect = $derived(feedback === 'correct');
	const feedbackWrong = $derived(feedback === 'wrong');
</script>

<div class="play-wrapper">
	{#if showRings}
		<svg class="wave-rings" class:fading={ringsFading} viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg"
			style="--ring-origin: {originX}px {originY}px">>>
			<path d={ring1} class="ring ring-1" />
			<path d={ring2} class="ring ring-2" />
			<path d={ring3} class="ring ring-3" />
		</svg>
	{/if}
	{#if countdownPct >= 0}
		<svg class="countdown-ring" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
			<circle cx="50" cy="50" r="49"
				stroke="var(--border-heavy)" stroke-width="2" fill="none"
			/>
			<circle cx="50" cy="50" r="49"
				stroke="var(--hot)"
				stroke-width="2" fill="none"
				stroke-dasharray={2 * Math.PI * 49}
				stroke-dashoffset={2 * Math.PI * 49 * (1 - countdownPct)}
				transform="rotate(-90 50 50)"
			/>
		</svg>
	{/if}
	<button
		class="play-btn"
		class:replay={replaying}
		class:no-border={noBorder}
		class:pulsing={playing}
		class:glitch-text={glitching}
		class:feedback-correct={feedbackCorrect}
		class:feedback-wrong={feedbackWrong}
		class:feedback-glitch={!!feedback}
		onclick={onplay}
	>
		{displayText}
	</button>
</div>

<style>
	.play-wrapper {
		position: relative;
		display: flex; align-items: center; justify-content: center;
		width: 100px; height: 100px;
		overflow: visible;
	}
	.wave-rings {
		position: absolute;
		width: 150px; height: 150px;
		pointer-events: none;
		overflow: visible;
		transition: opacity 0.6s ease-out;
	}
	.wave-rings.fading {
		opacity: 0;
	}
	.countdown-ring {
		position: absolute;
		inset: 0;
		width: 100px; height: 100px;
		pointer-events: none;
		z-index: 2;
	}
	.ring {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1.5;
		opacity: 0;
		transform-origin: var(--ring-origin, center);
	}
	.ring-1 {
		animation: ring-propagate 3s linear infinite;
	}
	.ring-2 {
		animation: ring-propagate 3s linear infinite 1s;
	}
	.ring-3 {
		animation: ring-propagate 3s linear infinite 2s;
	}
	@keyframes ring-propagate {
		0% { opacity: 0.5; transform: scale(1); }
		80% { opacity: 0.3; transform: scale(1.8); }
		100% { opacity: 0; transform: scale(2.2); }
	}
	.play-btn {
		position: relative; z-index: 1;
		width: 100px; height: 100px; border-radius: 50%;
		background: var(--accent); border: none;
		color: var(--base); font-size: 1rem; font-weight: 700;
		letter-spacing: 0.05em; transition: transform 0.3s ease-out, opacity 0.15s;
		font-family: var(--mono);
		display: flex; align-items: center; justify-content: center;
		text-align: center; line-height: 1;
	}
	.play-btn:active { transform: scale(0.93); opacity: 0.9; }
	.pulsing {
		animation: btn-membrane 1.5s ease-in-out;
	}
	@keyframes btn-membrane {
		/* Note 1 attack */
		0%  { transform: scale(1); }
		3%  { transform: scale(1.07); }
		6%  { transform: scale(1.04); }
		9%  { transform: scale(1.06); }
		12% { transform: scale(1.03); }
		15% { transform: scale(1.05); }
		18% { transform: scale(1.03); }
		21% { transform: scale(1.04); }
		24% { transform: scale(1.02); }
		27% { transform: scale(1.03); }
		30% { transform: scale(1.02); }
		/* Decay to gap */
		36% { transform: scale(1.01); }
		42% { transform: scale(1); }
		48% { transform: scale(1); }
		/* Note 2 attack */
		51% { transform: scale(1.07); }
		54% { transform: scale(1.04); }
		57% { transform: scale(1.06); }
		60% { transform: scale(1.03); }
		63% { transform: scale(1.05); }
		66% { transform: scale(1.03); }
		69% { transform: scale(1.04); }
		72% { transform: scale(1.02); }
		75% { transform: scale(1.03); }
		78% { transform: scale(1.02); }
		/* Decay to rest */
		84% { transform: scale(1.01); }
		90% { transform: scale(1); }
		100% { transform: scale(1); }
	}
	.replay {
		background: transparent; border: 2px solid var(--accent);
		color: var(--accent);
	}
	.replay:active { background: var(--accent-dim); }
	.no-border {
		border: none !important;
	}
	/* Feedback states */
	.feedback-correct {
		background: var(--correct) !important;
		color: var(--base) !important;
		border-color: var(--correct) !important;
	}
	.feedback-wrong {
		background: transparent !important;
		color: var(--wrong) !important;
		border: 2px solid var(--wrong) !important;
	}
	.feedback-glitch {
		text-shadow: -2px 0 var(--accent), 2px 0 var(--hot);
		animation: feedback-shake 80ms infinite;
	}
	@keyframes feedback-shake {
		0% { transform: translate(0) rotate(0); }
		20% { transform: translate(-1px, 1px) rotate(-0.5deg); }
		40% { transform: translate(1px, -1px) rotate(0.5deg); }
		60% { transform: translate(-1px, 0) rotate(-0.3deg); }
		80% { transform: translate(1px, 1px) rotate(0.3deg); }
		100% { transform: translate(0) rotate(0); }
	}
	/* Transition glitch */
	.glitch-text {
		text-shadow: -2px 0 var(--accent), 2px 0 var(--hot);
		animation: glitch-shake 50ms infinite;
	}
	@keyframes glitch-shake {
		0% { transform: translate(0); }
		25% { transform: translate(-1px, 1px); }
		50% { transform: translate(1px, -1px); }
		75% { transform: translate(-1px, -1px); }
		100% { transform: translate(0); }
	}
</style>
