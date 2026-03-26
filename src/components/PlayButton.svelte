<script lang="ts">
	import { onDestroy } from 'svelte';
	import LissajousRing from './LissajousRing.svelte';

	interface Props {
		onplay: () => void;
		replaying?: boolean;
		playing?: boolean;
		questionNum?: number;
		glitching?: boolean;
		countdownPct?: number;
		feedback?: 'correct' | 'wrong' | null;
		semitones?: number;
		chordIntervals?: number[];
		scaleIntervals?: number[];
	}
	let { onplay, replaying = false, playing = false, questionNum = 1, glitching = false, countdownPct = -1, feedback = null, semitones = 0, chordIntervals, scaleIntervals }: Props = $props();

	function handlePlay() {
		onplay();
	}

	let glitchText = $state('');
	let feedbackGlyph = $state('');
	let glitchInterval: ReturnType<typeof setInterval> | null = null;
	let feedbackInterval: ReturnType<typeof setInterval> | null = null;

	const correctGlyphs = ['\uE018', '\uE013', '\uE014', '\uE012', '\uE011'];
	const wrongGlyphs = ['\uE019', '\uE015', '\uE016'];
	const glitchChars = ['\uE000', '\uE001', '\uE002', '\uE003', '\uE004', '\uE005', '\uE006', '\uE007', '\uE008', '\uE010', '\uE017'];

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
			let tick = 0;
			feedbackGlyph = glitchChars[Math.floor(Math.random() * glitchChars.length)];
			feedbackInterval = setInterval(() => {
				tick++;
				if (tick < 6) {
					feedbackGlyph = glitchChars[Math.floor(Math.random() * glitchChars.length)];
				} else if (tick < 10) {
					feedbackGlyph = Math.random() > 0.4
						? pool[Math.floor(Math.random() * pool.length)]
						: glitchChars[Math.floor(Math.random() * glitchChars.length)];
				} else {
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
	});

	const displayText = $derived.by(() => {
		if (feedbackGlyph) return feedbackGlyph;
		if (glitching) return glitchText;
		return `Q${questionNum}`;
	});

	const feedbackCorrect = $derived(feedback === 'correct');
	const feedbackWrong = $derived(feedback === 'wrong');

	const vizPhase = $derived.by((): 'rest' | 'playing' | 'correct' | 'wrong' | 'glitch' => {
		if (glitching) return 'glitch';
		if (feedback === 'correct') return 'correct';
		if (feedback === 'wrong') return 'wrong';
		if (playing) return 'playing';
		return 'rest';
	});
</script>

<!--
  Two layers, one visual circle:
  1. Play button — tap target + solid fill for feedback colors
  2. Lissajous ring — animated border overlay (same center, same size)
-->
<div class="play-wrapper">
	<!-- Layer 1: Play button circle — provides fill + tap target -->
	<button
		class="play-btn"
		class:replay={replaying}
		class:glitch-fill={glitching}
		class:feedback-correct={feedbackCorrect}
		class:feedback-wrong={feedbackWrong}
		class:feedback-glitch={!!feedback}
		onclick={handlePlay}
	>
		<span class="q-text">{displayText}</span>
	</button>

	<!-- Layer 2: Lissajous ring — animated border, trail IS the countdown -->
	<LissajousRing
		size={160}
		{semitones}
		{chordIntervals}
		{scaleIntervals}
		phase={vizPhase}
		countdownPct={vizPhase === 'wrong' ? countdownPct : -1}
	/>
</div>

<style>
	.play-wrapper {
		position: relative;
		display: flex; align-items: center; justify-content: center;
		width: min(40vw, 160px); height: min(40vw, 160px);
		overflow: visible;
	}
	/* Play button: solid fill circle, sits underneath Lissajous */
	.play-btn {
		position: absolute;
		inset: 0;
		z-index: 1;
		width: 100%; height: 100%;
		border-radius: 50%;
		background: transparent;
		border: none;  /* Lissajous IS the border */
		display: flex; align-items: center; justify-content: center;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		transition: background 0.3s ease-out;
	}
	.play-btn:active { transform: scale(0.95); }
	/* Feedback fills */
	.feedback-correct {
		background: var(--correct) !important;
	}
	.feedback-wrong {
		background: rgba(237, 23, 79, 0.15) !important; /* subtle --hot red fill */
	}
	.glitch-fill {
		background: var(--surface) !important;
	}
	/* Q# text */
	.q-text {
		position: relative;
		z-index: 3;
		color: var(--accent);
		font-size: 1.1rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		font-family: var(--mono);
		line-height: 1;
		transition: color 0.3s ease-out;
	}
	.feedback-correct .q-text {
		color: var(--base) !important;
	}
	.feedback-wrong .q-text {
		color: var(--wrong) !important;
	}
	.feedback-glitch .q-text {
		text-shadow: -2px 0 var(--accent), 2px 0 var(--hot);
		animation: feedback-shake 80ms infinite;
	}
	.glitch-fill .q-text {
		color: var(--accent) !important;
		text-shadow: -2px 0 var(--accent), 2px 0 var(--hot);
		animation: glitch-shake 50ms infinite;
	}
	@keyframes feedback-shake {
		0% { transform: translate(0) rotate(0); }
		20% { transform: translate(-1px, 1px) rotate(-0.5deg); }
		40% { transform: translate(1px, -1px) rotate(0.5deg); }
		60% { transform: translate(-1px, 0) rotate(-0.3deg); }
		80% { transform: translate(1px, 1px) rotate(0.3deg); }
		100% { transform: translate(0) rotate(0); }
	}
	@keyframes glitch-shake {
		0% { transform: translate(0); }
		25% { transform: translate(-1px, 1px); }
		50% { transform: translate(1px, -1px); }
		75% { transform: translate(-1px, -1px); }
		100% { transform: translate(0); }
	}
	/* Lissajous canvas overlays button at same position */
	.play-wrapper :global(.lissajous-ring) {
		z-index: 2;
		pointer-events: none;
	}
	/* Countdown ring */
	.countdown-ring {
		position: absolute;
		inset: -4px;
		width: calc(100% + 8px); height: calc(100% + 8px);
		pointer-events: none;
		z-index: 4;
		opacity: 0;
		transition: opacity 0.3s ease-out;
	}
	.countdown-ring.ring-visible {
		opacity: 1;
	}
	.countdown-ring.ring-fading {
		opacity: 0;
		transition: opacity 0.3s ease-out;
	}
</style>
