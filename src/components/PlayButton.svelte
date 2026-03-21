<script lang="ts">
	import { onDestroy } from 'svelte';

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
	const maxBias = $derived((semitones / 12) * 15);

	// Discrete wave bursts — one per note event
	interface WaveBurst {
		id: number;
		originX: number;
		originY: number;
	}
	let bursts: WaveBurst[] = $state([]);
	let burstCounter = 0;
	let burstTimeouts: ReturnType<typeof setTimeout>[] = [];

	$effect(() => {
		if (playing) {
			burstCounter = 0;
			bursts = [];
			burstTimeouts.forEach(t => clearTimeout(t));
			burstTimeouts = [];

			// Burst 1: root note — centered (0ms)
			const b1: WaveBurst = { id: ++burstCounter, originX: 75, originY: 75 };
			bursts = [b1];

			// Burst 2: interval note — biased (~750ms after)
			burstTimeouts.push(setTimeout(() => {
				const bias = maxBias;
				const ox = 75 - Math.sin(ringAngle * Math.PI / 180) * bias;
				const oy = 75 + Math.cos(ringAngle * Math.PI / 180) * bias;
				const b2: WaveBurst = { id: ++burstCounter, originX: ox, originY: oy };
				bursts = [b1, b2];
			}, 750));

			// Clean up bursts after they've fully expanded (2.5s after second burst)
			burstTimeouts.push(setTimeout(() => {
				bursts = [];
			}, 3500));
		}
	});

	let glitchText = $state('');
	let feedbackGlyph = $state('');
	let glitchInterval: ReturnType<typeof setInterval> | null = null;
	let feedbackInterval: ReturnType<typeof setInterval> | null = null;

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

	onDestroy(() => {
		if (glitchInterval) clearInterval(glitchInterval);
		if (feedbackInterval) clearInterval(feedbackInterval);
		burstTimeouts.forEach(t => clearTimeout(t));
	});

	const displayText = $derived.by(() => {
		if (feedbackGlyph) return feedbackGlyph;
		if (glitching) return glitchText;
		return `Q${questionNum}`;
	});

	const feedbackCorrect = $derived(feedback === 'correct');
	const feedbackWrong = $derived(feedback === 'wrong');
</script>

<div class="play-wrapper">
	{#each bursts as burst (burst.id)}
		<svg class="wave-rings" viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg">
			<circle cx="75" cy="75" r="42" fill="none" stroke="var(--accent)" stroke-width="1.5"
				style="transform-origin: {burst.originX}px {burst.originY}px" class="burst-ring" />
			<circle cx="75" cy="75" r="52" fill="none" stroke="var(--accent)" stroke-width="1.5"
				style="transform-origin: {burst.originX}px {burst.originY}px" class="burst-ring delay-1" />
			<circle cx="75" cy="75" r="62" fill="none" stroke="var(--accent)" stroke-width="1.5"
				style="transform-origin: {burst.originX}px {burst.originY}px" class="burst-ring delay-2" />
		</svg>
	{/each}
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
	}
	.burst-ring {
		opacity: 0;
		animation: burst-expand 2s ease-out forwards;
	}
	.burst-ring.delay-1 {
		animation-delay: 0.15s;
	}
	.burst-ring.delay-2 {
		animation-delay: 0.3s;
	}
	@keyframes burst-expand {
		0% { opacity: 0.5; transform: scale(1); }
		70% { opacity: 0.2; transform: scale(1.6); }
		100% { opacity: 0; transform: scale(2); }
	}
	.countdown-ring {
		position: absolute;
		inset: 0;
		width: 100px; height: 100px;
		pointer-events: none;
		z-index: 2;
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
