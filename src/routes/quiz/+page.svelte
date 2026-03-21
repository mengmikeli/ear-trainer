<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { loadState, saveState, checkTierUnlock } from '$lib/state';
	import { generateQuestion } from '$lib/engine';
	import { playInterval, playFeedbackChime } from '$lib/audio';
	import { responseQuality, calculateSm2 } from '$lib/sm2';
	import type { UserState, Question, IntervalDef } from '$lib/types';
	import PlayButton from '../../components/PlayButton.svelte';
	import AnswerGrid from '../../components/AnswerGrid.svelte';
	import ProgressBar from '../../components/ProgressBar.svelte';
	import Feedback from '../../components/Feedback.svelte';

	let state: UserState | null = $state(null);
	let question: Question | null = $state(null);
	let questionNum = $state(0);
	let totalQuestions = $state(20);
	let hasPlayed = $state(false);
	let selectedId: string | null = $state(null);
	let showFeedback = $state(false);
	let isCorrect = $state(false);
	let startTime = $state(0);
	let sessionCorrect = $state(0);
	let showSummary = $state(false);
	let glitchScreen = $state(false);
	let newUnlocks: string[] = $state([]);
	let showUnlockBanner = $state(false);
	let unlockText = $state('');

	onMount(() => {
		state = loadState();
		totalQuestions = state.settings.sessionLength;
		nextQuestion();
	});

	function nextQuestion() {
		if (!state) return;
		if (questionNum >= totalQuestions) {
			finishSession();
			return;
		}
		question = generateQuestion(state);
		hasPlayed = false;
		selectedId = null;
		showFeedback = false;
		glitchScreen = false;
		questionNum++;
	}

	function play() {
		if (!question || !state) return;
		playInterval(
			question.rootNote,
			question.interval.semitones,
			question.direction,
			state.settings.toneType
		);
		if (!hasPlayed) {
			hasPlayed = true;
			startTime = Date.now();
		} else {
			question.replays++;
		}
	}

	function selectAnswer(choice: IntervalDef) {
		if (!question || !state || selectedId) return;

		const correct = choice.id === question.interval.id;
		selectedId = choice.id;
		isCorrect = correct;
		showFeedback = true;

		if (correct) {
			sessionCorrect++;
		} else {
			// Trigger glitch on wrong answer
			glitchScreen = true;
			setTimeout(() => { glitchScreen = false; }, 250);
		}

		playFeedbackChime(correct);

		// Update interval state
		const s = state.intervals[question.interval.id];
		s.attempts++;
		if (correct) {
			s.correct++;
			s.streak++;
		} else {
			s.streak = 0;
		}
		s.lastSeen = Date.now();

		// SM-2 update
		const quality = responseQuality({
			correct,
			replays: question.replays,
			responseTimeMs: Date.now() - startTime,
		});
		const sm2 = calculateSm2(s.easeFactor, quality);
		s.easeFactor = sm2.easeFactor;
		s.nextReview = Date.now() + sm2.intervalMs;

		// Check for new unlocks
		const prevUnlocked = new Set(
			Object.entries(state.intervals).filter(([_, v]) => v.unlocked).map(([k]) => k)
		);
		state = checkTierUnlock(state);
		const newlyUnlocked = Object.entries(state.intervals)
			.filter(([k, v]) => v.unlocked && !prevUnlocked.has(k))
			.map(([k]) => k);

		if (newlyUnlocked.length > 0) {
			newUnlocks = newlyUnlocked;
		}

		state.stats.totalQuestions++;
		saveState(state);

		// Auto-advance
		const delay = correct ? 1000 : 2000;
		setTimeout(() => {
			// Show unlock banner if new intervals unlocked
			if (newUnlocks.length > 0) {
				showUnlockBanner = true;
				typeInUnlock(newUnlocks.join(', '));
				newUnlocks = [];
				setTimeout(() => {
					showUnlockBanner = false;
					unlockText = '';
					nextQuestion();
				}, 2500);
			} else {
				nextQuestion();
			}
		}, delay);
	}

	function typeInUnlock(text: string) {
		unlockText = '';
		let i = 0;
		const interval = setInterval(() => {
			if (i < text.length) {
				unlockText += text[i];
				i++;
			} else {
				clearInterval(interval);
			}
		}, 60);
	}

	function finishSession() {
		if (!state) return;
		state.stats.totalSessions++;

		const now = new Date();
		const last = state.stats.lastPractice ? new Date(state.stats.lastPractice) : null;
		const isConsecutive = last &&
			(now.getTime() - last.getTime()) < 2 * 24 * 60 * 60 * 1000 &&
			now.toDateString() !== last.toDateString();

		if (isConsecutive) {
			state.stats.currentStreak++;
		} else if (!last || now.toDateString() !== last.toDateString()) {
			state.stats.currentStreak = 1;
		}
		state.stats.bestStreak = Math.max(state.stats.bestStreak, state.stats.currentStreak);
		state.stats.lastPractice = Date.now();

		saveState(state);
		showSummary = true;
	}

	function endEarly() {
		if (questionNum > 1 && state) {
			state.stats.totalSessions++;
			state.stats.lastPractice = Date.now();
			saveState(state);
		}
		goto('/');
	}

	const sessionAccuracy = $derived(
		questionNum > 0 ? Math.round((sessionCorrect / Math.max(questionNum - (showSummary ? 0 : 1), 1)) * 100) : 0
	);
</script>

<div class="quiz" class:glitch-burst={glitchScreen}>
	{#if showSummary}
		<!-- Session Summary -->
		<div class="summary screen-enter">
			<h2 class="summary-heading">SESSION COMPLETE</h2>

			<div class="summary-stats">
				<div class="summary-stat">
					<span class="summary-value">{sessionCorrect}/{totalQuestions}</span>
					<span class="summary-label">CORRECT</span>
				</div>
				<div class="summary-stat">
					<span class="summary-value">{sessionAccuracy}%</span>
					<span class="summary-label">ACCURACY</span>
				</div>
			</div>

			<a href="/" class="done-btn chromatic">RETURN</a>
		</div>
	{:else}
		<!-- Active Quiz -->
		<div class="top">
			<button class="close chromatic" onclick={endEarly}>✕</button>
			<ProgressBar current={questionNum} total={totalQuestions} />
		</div>

		{#if question}
			<div class="play-area">
				{#if !hasPlayed}
					<div class="prompt">
						<span class="prompt-text">TAP TO HEAR THE INTERVAL</span>
					</div>
					<PlayButton onplay={play} />
				{:else}
					<PlayButton onplay={play} replaying={true} />
				{/if}
			</div>

			{#if hasPlayed}
				<AnswerGrid
					choices={question.choices}
					onselect={selectAnswer}
					disabled={!!selectedId}
					correctId={selectedId ? question.interval.id : null}
					{selectedId}
				/>
			{/if}
		{/if}
	{/if}

	<!-- Unlock Banner -->
	{#if showUnlockBanner}
		<div class="unlock-banner crt-flicker">
			<span class="unlock-label">NEW INTERVAL UNLOCKED</span>
			<span class="unlock-ids">{unlockText}<span class="cursor">_</span></span>
		</div>
	{/if}

	<Feedback
		correct={isCorrect}
		correctAnswer={question?.interval.name ?? ''}
		visible={showFeedback}
	/>
</div>

<style>
	.quiz {
		display: flex;
		flex-direction: column;
		align-items: center;
		height: 100%;
		gap: 2rem;
	}

	.top {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
	}

	.close {
		font-size: 1.3rem;
		color: var(--text-secondary);
		padding: 0.25rem;
		font-weight: 500;
		transition: color 0.15s;
	}
	.close:hover { color: var(--hot); }

	.play-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		flex: 1;
		justify-content: center;
	}

	.prompt {
		text-align: center;
	}

	.prompt-text {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 500;
		color: var(--text-secondary);
		letter-spacing: 0.2em;
	}

	/* Summary */
	.summary {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 2.5rem;
		text-align: center;
	}

	.summary-heading {
		font-family: var(--font-display);
		font-size: 2rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--accent);
		text-transform: uppercase;
	}

	.summary-stats {
		display: flex;
		gap: 2.5rem;
	}

	.summary-stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
	}

	.summary-value {
		font-family: var(--font-mono);
		font-size: 2.5rem;
		font-weight: 700;
		color: var(--text-primary);
		font-variant-numeric: tabular-nums;
	}

	.summary-label {
		font-family: var(--font-mono);
		font-size: 0.55rem;
		font-weight: 500;
		color: var(--text-secondary);
		letter-spacing: 0.2em;
	}

	.done-btn {
		display: inline-block;
		padding: 1rem 2.5rem;
		background: var(--accent);
		color: var(--base);
		font-family: var(--font-display);
		font-size: 0.9rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		transition: box-shadow 0.15s;
	}
	.done-btn:hover {
		box-shadow: 0 0 30px rgba(0, 212, 255, 0.25);
	}

	/* Unlock Banner */
	.unlock-banner {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 200;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 2rem 2.5rem;
		background: var(--base);
		border: 1px solid var(--accent);
		box-shadow: 0 0 60px rgba(0, 212, 255, 0.2);
	}

	.unlock-label {
		font-family: var(--font-display);
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.25em;
		color: var(--accent);
	}

	.unlock-ids {
		font-family: var(--font-mono);
		font-size: 1.8rem;
		font-weight: 700;
		letter-spacing: 0.15em;
		color: var(--text-primary);
	}

	.cursor {
		animation: blink 0.6s steps(1) infinite;
		color: var(--accent);
	}

	@keyframes blink {
		0%, 50% { opacity: 1; }
		51%, 100% { opacity: 0; }
	}
</style>
