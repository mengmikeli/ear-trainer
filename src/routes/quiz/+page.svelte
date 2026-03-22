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

	let state: UserState | null = $state(null);
	let question: Question | null = $state(null);
	let questionNum = $state(0);
	let totalQuestions = $state(20);
	let hasPlayed = $state(false);
	let selectedId: string | null = $state(null);
	let feedbackState: 'correct' | 'wrong' | null = $state(null);
	let isCorrect = $state(false);
	let startTime = $state(0);
	let sessionCorrect = $state(0);
	let isPlaying = $state(false);
	let inResultMode = $state(false);
	let countdownPct = $state(1.0);
	let countdownStart = 0;
	let countdownDuration = 4000;
	let rafId: number | null = null;
	let isGlitching = $state(false);

	onMount(() => {
		state = loadState();
		totalQuestions = state.settings.sessionLength;
		nextQuestion();
	});

	function nextQuestion() {
		if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
		if (!state) return;
		if (questionNum >= totalQuestions) {
			finishSession();
			return;
		}

		// Start glitch BEFORE clearing state — covers the visual transition
		isGlitching = true;
		feedbackState = null; // clear feedback immediately so glitch style takes over
		questionNum++;

		// Clear remaining state on next frame
		requestAnimationFrame(() => {
			inResultMode = false;
			question = generateQuestion(state!);
			hasPlayed = false;
			selectedId = null;
			countdownPct = 1.0;
		});

		setTimeout(() => {
			isGlitching = false;
			// Auto-play the interval right after glitch settles
			play();
		}, 100);
	}

	function play() {
		if (!question || !state) return;
		playInterval(
			question.rootNote,
			question.interval.semitones,
			question.playMode,
			state.settings.toneType
		);
		if (!hasPlayed) {
			hasPlayed = true;
			startTime = Date.now();
		} else {
			question.replays++;
		}
		isPlaying = true;
		const noteDuration = 0.6;
		const gap = 0.15;
		const totalMs = (noteDuration * 2 + gap) * 1000 + 200;
		setTimeout(() => { isPlaying = false; }, totalMs);
	}

	function selectAnswer(choice: IntervalDef) {
		if (!question || !state || selectedId) return;

		const correct = choice.id === question.interval.id;
		selectedId = choice.id;
		isCorrect = correct;
		feedbackState = correct ? 'correct' : 'wrong';

		if (correct) sessionCorrect++;

		playFeedbackChime(correct);

		// Update interval state (flat fields for backward compat)
		const s = state.intervals[question.interval.id];
		s.attempts++;
		if (correct) {
			s.correct++;
			s.streak++;
		} else {
			s.streak = 0;
		}
		s.lastSeen = Date.now();

		// SM-2 update (flat)
		const quality = responseQuality({
			correct,
			replays: question.replays,
			responseTimeMs: Date.now() - startTime,
		});
		const sm2 = calculateSm2(s.easeFactor, quality);
		s.easeFactor = sm2.easeFactor;
		s.nextReview = Date.now() + sm2.intervalMs;

		// Per-mode stat recording
		const mode = question.playMode;
		const modeStats = s.modes[mode];
		modeStats.attempts++;
		if (correct) {
			modeStats.correct++;
			modeStats.streak++;
		} else {
			modeStats.streak = 0;
		}
		modeStats.lastSeen = Date.now();

		// SM-2 update per mode
		const sm2mode = calculateSm2(modeStats.easeFactor, quality);
		modeStats.easeFactor = sm2mode.easeFactor;
		modeStats.nextReview = Date.now() + sm2mode.intervalMs;

		// Check tier unlocks
		state = checkTierUnlock(state);
		state.stats.totalQuestions++;
		saveState(state);

		if (correct) {
			setTimeout(() => nextQuestion(), 1350);
		} else {
			enterResultMode();
		}
	}

	function enterResultMode() {
		inResultMode = true;
		countdownStart = performance.now();
		countdownDuration = 8000;
		countdownPct = 1.0;
		rafId = requestAnimationFrame(tickCountdown);
	}

	function tickCountdown(now: number) {
		const elapsed = now - countdownStart;
		countdownPct = Math.max(0, 1 - elapsed / countdownDuration);
		if (countdownPct <= 0) {
			inResultMode = false;
			nextQuestion();
			return;
		}
		rafId = requestAnimationFrame(tickCountdown);
	}

	function replayInResult() {
		play();
		countdownStart = performance.now();
		countdownPct = 1.0;
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
		goto('/');
	}

	function endEarly() {
		if (questionNum > 1 && state) {
			state.stats.totalSessions++;
			state.stats.lastPractice = Date.now();
			saveState(state);
		}
		goto('/');
	}
</script>

<div class="quiz">
	<h2 class="heading">PRACTICE</h2>
	<div class="top">
		<div class="bar-track-full">
			<ProgressBar current={questionNum} total={totalQuestions} />
		</div>
		<div class="top-controls">
			<button class="close exit" onclick={endEarly}>EXIT</button>
			<span class="mode-icon">{question ? (question.playMode === 'ascending' ? '\uE007' : question.playMode === 'descending' ? '\uE008' : '\uE000') : ''}</span>
			<span class="counter">{String(questionNum).padStart(2, '0')}/{String(totalQuestions).padStart(2, '0')}</span>
		</div>
	</div>

	{#if question}
		<div class="play-area">
			<PlayButton
				onplay={hasPlayed && inResultMode ? replayInResult : play}
				replaying={hasPlayed}
				playing={isPlaying}
				noBorder={hasPlayed && inResultMode}
				questionNum={questionNum}
				countdownPct={hasPlayed && inResultMode ? countdownPct : -1}
				glitching={isGlitching}
				feedback={feedbackState}
				semitones={question.interval.semitones}
			/>
		</div>

		<div class="answer-area" class:hidden={!hasPlayed}>
			<AnswerGrid
				choices={question.choices}
				onselect={selectAnswer}
				disabled={!hasPlayed || !!selectedId}
				correctId={selectedId ? question.interval.id : null}
				{selectedId}
				onCorrectClick={inResultMode ? nextQuestion : null}
			/>
		</div>
	{/if}
</div>

<style>
	.quiz {
		display: flex;
		flex-direction: column;
		align-items: center;
		height: 100%;
		gap: 1rem;
	}
	.heading {
		font-size: 3rem; font-weight: 400;
		letter-spacing: 0.12em; color: var(--text-primary);
		padding-bottom: 0.5rem;
		text-transform: uppercase; font-family: var(--font-display);
		width: 100%;
		margin-bottom: 0;
	}
	.top {
		width: 100%;
		margin-top: -1rem;
	}
	.bar-track-full {
		width: 100%;
	}
	.bar-track-full :global(.progress-bar) {
		gap: 0;
	}
	.bar-track-full :global(.label) {
		display: none;
	}
	.bar-track-full :global(.track) {
		height: 2px;
	}
	.top-controls {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		margin-top: 0.5rem;
	}
	.counter {
		font-size: 0.4rem; font-weight: 800;
		font-family: var(--mono); color: var(--marathon-blue);
		letter-spacing: 0.05em;
		border: 1px solid var(--marathon-blue);
		padding: 0 6px;
		line-height: 1.6;
	}
	.mode-icon {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		font-size: 0.7rem;
		font-family: var(--mono);
		color: var(--marathon-blue);
		line-height: 1;
	}
	.close {
		font-size: 0.4rem;
		color: var(--marathon-blue);
		padding: 0 6px;
		font-weight: 900;
		font-family: var(--mono);
		letter-spacing: 0.08em;
		border: 1px solid var(--marathon-blue);
		line-height: 1.6;
		background: transparent;
	}
	.exit {
		color: var(--hot);
		border-color: var(--hot);
	}
	.play-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		flex: 1;
		justify-content: center;
	}
	.answer-area {
		width: 100%;
	}
	.answer-area.hidden {
		visibility: hidden;
	}
</style>
