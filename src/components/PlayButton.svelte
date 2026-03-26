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

	// Size: 160px desktop, scales down on small screens
	const SIZE = 160;

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

	// Map state → LissajousRing phase
	const vizPhase = $derived.by((): 'rest' | 'playing' | 'correct' | 'wrong' | 'glitch' => {
		if (glitching) return 'glitch';
		if (feedback === 'correct') return 'correct';
		if (feedback === 'wrong') return 'wrong';
		if (playing) return 'playing';
		return 'rest';
	});
</script>

<!-- One circle. One element. Tap anywhere inside to play. -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="play-circle" onclick={handlePlay}>
	<!-- Lissajous canvas — fills the entire circle, IS the visual -->
	<LissajousRing
		size={SIZE}
		{semitones}
		{chordIntervals}
		{scaleIntervals}
		phase={vizPhase}
	/>

	<!-- Countdown ring (SVG, outer edge) -->
	<svg class="countdown-ring" class:ring-visible={countdownPct >= 0} class:ring-fading={glitching} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
		<circle cx="50" cy="50" r="49"
			stroke="var(--border-heavy)" stroke-width="1.5" fill="none"
		/>
		<circle cx="50" cy="50" r="49"
			stroke="var(--hot)"
			stroke-width="1.5" fill="none"
			stroke-dasharray={2 * Math.PI * 49}
			stroke-dashoffset={2 * Math.PI * 49 * (1 - Math.max(0, countdownPct))}
			transform="rotate(-90 50 50)"
		/>
	</svg>

	<!-- Q# text centered inside -->
	<span
		class="q-text"
		class:glitch-text={glitching}
		class:feedback-correct={feedbackCorrect}
		class:feedback-wrong={feedbackWrong}
		class:feedback-glitch={!!feedback}
	>
		{displayText}
	</span>
</div>

<style>
	.play-circle {
		position: relative;
		width: min(40vw, 160px);
		height: min(40vw, 160px);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		/* Tap target = entire circle */
		border-radius: 50%;
		-webkit-tap-highlight-color: transparent;
	}
	.play-circle:active {
		transform: scale(0.95);
	}
	.countdown-ring {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
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
	.q-text {
		position: relative;
		z-index: 1;
		color: var(--accent);
		font-size: 1.1rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		font-family: var(--mono);
		line-height: 1;
		pointer-events: none;
		transition: color 0.3s ease-out;
	}
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
