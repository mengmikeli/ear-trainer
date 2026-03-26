<script lang="ts">
	import { onDestroy } from 'svelte';
	import LissajousRing from './LissajousRing.svelte';

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
		/** Chord intervals — passed to Lissajous for shape */
		chordIntervals?: number[];
		/** Scale intervals — passed to Lissajous for shape */
		scaleIntervals?: number[];
	}
	let { onplay, replaying = false, playing = false, noBorder = false, questionNum = 1, glitching = false, countdownPct = -1, feedback = null, semitones = 0, chordIntervals, scaleIntervals }: Props = $props();

	function handlePlay() {
		onplay();
	}

	let glitchText = $state('');
	let feedbackGlyph = $state('');
	let glitchInterval: ReturnType<typeof setInterval> | null = null;
	let feedbackInterval: ReturnType<typeof setInterval> | null = null;

	// Matrix Mono PUA glyphs
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
</script>

<div class="play-wrapper">
	<!-- Lissajous ring replaces the old CSS border -->
	<LissajousRing
		size={120}
		{semitones}
		{chordIntervals}
		{scaleIntervals}
		{playing}
		{glitching}
		{feedback}
	/>

	<!-- Countdown ring (SVG overlay) -->
	<svg class="countdown-ring" class:ring-visible={countdownPct >= 0} class:ring-fading={glitching} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
		<circle cx="50" cy="50" r="49"
			stroke="var(--border-heavy)" stroke-width="2" fill="none"
		/>
		<circle cx="50" cy="50" r="49"
			stroke="var(--hot)"
			stroke-width="2" fill="none"
			stroke-dasharray={2 * Math.PI * 49}
			stroke-dashoffset={2 * Math.PI * 49 * (1 - Math.max(0, countdownPct))}
			transform="rotate(-90 50 50)"
		/>
	</svg>

	<!-- The button itself — no border, transparent bg, just the text -->
	<button
		class="play-btn"
		class:replay={replaying}
		class:no-border={noBorder}
		class:glitch-text={glitching}
		class:feedback-correct={feedbackCorrect}
		class:feedback-wrong={feedbackWrong}
		class:feedback-glitch={!!feedback}
		onclick={handlePlay}
	>
		{displayText}
	</button>
</div>

<style>
	.play-wrapper {
		position: relative;
		display: flex; align-items: center; justify-content: center;
		width: 120px; height: 120px;
		overflow: visible;
	}
	.countdown-ring {
		position: absolute;
		inset: 0;
		width: 120px; height: 120px;
		pointer-events: none;
		z-index: 2;
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
	.play-btn {
		position: relative; z-index: 1;
		width: 100px; height: 100px; border-radius: 50%;
		/* Transparent bg — the Lissajous ring IS the visual */
		background: transparent;
		border: none;
		color: var(--accent); font-size: 1rem; font-weight: 700;
		letter-spacing: 0.05em;
		transition: transform 0.3s ease-out, opacity 0.15s, color 0.3s ease-out;
		font-family: var(--mono);
		display: flex; align-items: center; justify-content: center;
		text-align: center; line-height: 1;
		cursor: pointer;
	}
	.play-btn:active { transform: scale(0.93); opacity: 0.9; }
	.replay {
		color: var(--accent);
	}
	/* Feedback states */
	.feedback-correct {
		color: var(--correct) !important;
	}
	.feedback-wrong {
		color: var(--wrong) !important;
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
		color: var(--accent) !important;
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
