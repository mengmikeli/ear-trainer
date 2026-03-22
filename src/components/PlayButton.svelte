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
		modeLabel?: string;
	}
	let { onplay, replaying = false, playing = false, noBorder = false, questionNum = 1, glitching = false, countdownPct = -1, feedback = null, semitones = 0, modeLabel = '' }: Props = $props();

	// Map semitones (0-12) to angle: 0=top (P1), clockwise
	const ringAngle = $derived((semitones / 12) * 360);
	const maxBias = $derived((semitones / 12) * 15);

	function handlePlay() {
		onplay();
	}

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
		class:glitch-text={glitching}
		class:feedback-correct={feedbackCorrect}
		class:feedback-wrong={feedbackWrong}
		class:feedback-glitch={!!feedback}
		onclick={handlePlay}
	>
		<span class="btn-main">{displayText}</span>
		{#if modeLabel}
			<span class="mode-label">{modeLabel}</span>
		{/if}
	</button>
</div>

<style>
	.play-wrapper {
		position: relative;
		display: flex; align-items: center; justify-content: center;
		width: 100px; height: 100px;
		overflow: visible;
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
		flex-direction: column;
		text-align: center; line-height: 1;
	}
	.btn-main {
		display: block;
	}
	.mode-label {
		display: block;
		font-size: 0.5rem;
		color: var(--text-secondary);
		font-family: var(--mono);
		line-height: 1;
		margin-top: 2px;
	}
	.play-btn:active { transform: scale(0.93); opacity: 0.9; }
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
