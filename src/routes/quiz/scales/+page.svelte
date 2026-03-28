<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { loadState, saveState, checkTierUnlock } from '$lib/state';
	import { generateScaleQuestion } from '$lib/engine';
	import { playScale, playFeedbackChime, suspendAudio } from '$lib/audio';
	import { responseQuality, calculateSm2 } from '$lib/sm2';
	import type { UserState, ScaleQuestion, ScaleDef } from '$lib/types';
	import AnswerGrid from '../../../components/AnswerGrid.svelte';
	import ProgressBar from '../../../components/ProgressBar.svelte';
	import TelemetryBar from '../../../components/TelemetryBar.svelte';
	import VizQuizLayout from '../../../components/VizQuizLayout.svelte';

	const TEMPO = 150; // ms per note

	interface QuestionResult {
		scale: ScaleDef;
		correct: boolean;
		selectedId: string;
	}

	let state: UserState | null = $state(null);
	let question: ScaleQuestion | null = $state(null);
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
	let countdownDuration = 10000; // 10s for A/B replay
	let rafId: number | null = null;
	let isGlitching = $state(false);
	let correctTimeout: ReturnType<typeof setTimeout> | null = null;
	let abTimeouts: ReturnType<typeof setTimeout>[] = [];

	const vizPhase = $derived.by((): 'rest' | 'playing' | 'correct' | 'wrong' | 'transition' => {
		if (isGlitching) return 'transition';
		if (feedbackState === 'correct') return 'correct';
		if (feedbackState === 'wrong') return 'wrong';
		if (isPlaying) return 'playing';
		return 'rest';
	});

	function handleTransitionEnd() {}

	let playingNotes: number[] = $state([]);

	let isBouncing = $state(false);
	function triggerBounce() { isBouncing = false; requestAnimationFrame(() => { isBouncing = true; }); setTimeout(() => { isBouncing = false; }, 200); }
	

	const glitchChars = ['\uE000', '\uE001', '\uE002', '\uE003', '\uE004', '\uE005', '\uE006', '\uE007', '\uE008', '\uE010', '\uE017'];
	let glitchText = $state('');
	let glitchStartTime = 0;
	$effect(() => {
		const shouldGlitch = isGlitching || feedbackState === 'wrong' || feedbackState === 'correct';
		if (shouldGlitch) {
			glitchStartTime = Date.now();
			const realText = `Q${questionNum}`;
			const id = setInterval(() => {
				const elapsed = Date.now() - glitchStartTime;
				const settleBias = Math.min(1, elapsed / 600);
				if (Math.random() < settleBias * 0.7) {
					glitchText = realText;
				} else {
					const len = 1 + Math.floor(Math.random() * 3);
					let t = '';
					for (let i = 0; i < len; i++) {
						t += Math.random() < 0.3 ? realText[Math.floor(Math.random() * realText.length)] : glitchChars[Math.floor(Math.random() * glitchChars.length)];
					}
					glitchText = t;
				}
			}, 50);
			return () => { clearInterval(id); glitchText = ''; };
		} else {
			glitchText = '';
		}
	});
	const showGlitch = $derived(isGlitching || feedbackState === 'wrong' || feedbackState === 'correct');
	const displayText = $derived(glitchText || `Q${questionNum}`);

	let showSummary = $state(false);
	let results: QuestionResult[] = $state([]);

	let replayingIndex: number | null = $state(null);

	onMount(() => {
		state = loadState();
		totalQuestions = state.settings.sessionLength;
		nextQuestion();

		return () => {
			if (rafId) cancelAnimationFrame(rafId);
			if (correctTimeout) clearTimeout(correctTimeout);
			suspendAudio();
		};
	});

	function nextQuestion() {
		console.log('[scales] nextQuestion', { questionNum, hasPlayed, inResultMode });
		if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
		if (!state) return;
		if (questionNum >= totalQuestions) {
			finishSession();
			return;
		}

		// Stop any currently-playing audio (Web Audio scheduled notes)
		// Suspend (not destroy) audio — keeps AudioContext alive for next auto-play
		suspendAudio();
		// Kill any lingering A/B replay timeouts
		for (const t of abTimeouts) clearTimeout(t);
		abTimeouts = [];
		playingNotes = [];

		isGlitching = true;
		feedbackState = null;
		questionNum++;

		requestAnimationFrame(() => {
			inResultMode = false;
			question = generateScaleQuestion(state!);
			hasPlayed = false;
			selectedId = null;
			countdownPct = 1.0;

			// Play after question is guaranteed to exist
			setTimeout(() => {
				isGlitching = false;
				play();
			}, 600);
		});
	}

	function play() {
		if (!question || !state) return;
		const rootMidi = question.rootNote;
		console.log('[scales] play', { questionNum, rootMidi, hasPlayed });
		const intervals = question.scale.intervals;

		playScale(
			rootMidi,
			intervals,
			state.settings.toneType,
			TEMPO
		);
		if (!hasPlayed) {
			hasPlayed = true;
			startTime = Date.now();
		} else {
			question.replays++;
		}
		isPlaying = true;
		const totalMs = intervals.length * TEMPO + 200;

		// Sync Chladni with scale notes
		intervals.forEach((semitone: number, i: number) => {
			abTimeouts.push(setTimeout(() => {
				playingNotes = [rootMidi + semitone]; triggerBounce();
			}, i * TEMPO));
		});
		abTimeouts.push(setTimeout(() => { isPlaying = false; playingNotes = []; }, totalMs));
	}

	function selectAnswer(choice: { id: string; name: string }) {
		if (!question || !state || selectedId) return;
		const correct = choice.id === question.scale.id;
		console.log('[scales] selectAnswer', { correct, selectedId: choice.id, feedbackState });

		selectedId = choice.id;
		isCorrect = correct;
		feedbackState = correct ? 'correct' : 'wrong';

		if (correct) sessionCorrect++;

		results.push({
			scale: question.scale,
			correct,
			selectedId: choice.id,
		});

		playFeedbackChime(correct);

		// Update scale state (flat fields)
		const s = state.scales[question.scale.id];
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

		state = checkTierUnlock(state);
		state.stats.totalQuestions++;
		saveState(state);

		if (correct) {
			correctTimeout = setTimeout(() => nextQuestion(), 1350);
		} else {
			enterResultMode();
		}
	}

	function enterResultMode() {
		console.log('[scales] enterResultMode');
		inResultMode = true;
		countdownStart = performance.now();
		countdownDuration = 10000;
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
		if (!question || !state) return;
		const rootMidi = question.rootNote;
		const intervals = question.scale.intervals;

		playScale(rootMidi, intervals, state.settings.toneType, TEMPO);
		isPlaying = true;
		const totalMs = intervals.length * TEMPO + 200;

		// Sync Chladni + bounce on replay
		intervals.forEach((semitone: number, i: number) => {
			abTimeouts.push(setTimeout(() => {
				playingNotes = [rootMidi + semitone];
				triggerBounce();
			}, i * TEMPO));
		});
		abTimeouts.push(setTimeout(() => { isPlaying = false; playingNotes = []; }, totalMs));
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
		showSummary = true;
	}

	function restartQuiz() {
		showSummary = false;
		sessionCorrect = 0;
		questionNum = 0;
		results = [];
		state = loadState();
		nextQuestion();
	}

	function skipCorrect() {
		if (correctTimeout) { clearTimeout(correctTimeout); correctTimeout = null; }
		nextQuestion();
	}

	function endEarly() {
		if (questionNum > 1 && state) {
			state.stats.totalSessions++;
			state.stats.lastPractice = Date.now();
			saveState(state);
		}
		goto(`${base}/`);
	}

	const summaryAccuracy = $derived(results.length > 0 ? Math.round((sessionCorrect / results.length) * 100) : 0);
	const wrongAnswers = $derived(results.filter(r => !r.correct));

	function replayMissed(r: QuestionResult) {
		if (replayingIndex !== null || !state) return;
		const idx = wrongAnswers.indexOf(r);
		replayingIndex = idx;
		playScale(
			60,
			r.scale.intervals,
			state.settings.toneType,
			TEMPO
		);
		const dur = r.scale.intervals.length * TEMPO + 200;
		setTimeout(() => { replayingIndex = null; }, dur);
	}
</script>

{#if showSummary}
<div class="summary">
	<h2 class="heading">DEBRIEF</h2>

	<div class="score-block">
		<span class="score-big">{sessionCorrect}/{results.length}</span>
	</div>

	<TelemetryBar segments={[
		{ label: 'ACC', value: summaryAccuracy + '%' },
		{ label: 'STK', value: state?.stats.currentStreak ?? 0 },
		{ label: 'SES', value: state?.stats.totalSessions ?? 0 },
	]} />

	{#if wrongAnswers.length > 0}
		<div class="section-label missed-label">MISSED</div>
		<div class="missed-list">
			{#each wrongAnswers as r, i}
				<button class="missed-card" class:replaying={replayingIndex === i} onclick={() => replayMissed(r)}>
					<div class="missed-card-fill" style="width: 0%"></div>
					<div class="missed-card-content">
						<span class="missed-id">{r.scale.label}</span>
						<div class="missed-info">
							<span class="missed-name">{r.scale.name}</span>
							<span class="missed-detail">answered {r.selectedId}</span>
						</div>
					</div>
				</button>
			{/each}
		</div>
	{:else}
		<div class="perfect">PERFECT SESSION</div>
	{/if}

	<div class="summary-actions">
		<button class="action-btn primary" onclick={restartQuiz}>AGAIN</button>
		<button class="action-btn" onclick={() => goto(`${base}/`)}>HOME</button>
	</div>
</div>
{:else}
<div class="quiz">
	<h2 class="heading">SCALES</h2>
	<div class="top">
		<div class="bar-track-full">
			<ProgressBar current={questionNum} total={totalQuestions} />
		</div>
		<div class="top-controls">
			<button class="close exit" onclick={endEarly}>EXIT</button>
			<span class="mode-icon"></span>
			<div class="top-right">
				<span class="counter">{String(questionNum).padStart(2, '0')}/{String(totalQuestions).padStart(2, '0')}</span>
			</div>
		</div>
	</div>

	{#if question}
		<VizQuizLayout
			mode="scale"
			phase={vizPhase}
			scaleIntervals={question.scale.intervals}
			countdownPct={hasPlayed && inResultMode ? countdownPct : -1}
			ontransitionend={handleTransitionEnd}
			{playingNotes}
		>
			<button class="play-tap" class:feedback-correct={feedbackState === 'correct'} class:feedback-wrong={feedbackState === 'wrong'} class:bouncing={isBouncing} onclick={hasPlayed && inResultMode ? replayInResult : play}>
				<div class="orbit-track"><div class="orbit-dot"></div></div>
				<span class="q-text" class:feedback-correct={feedbackState === 'correct'} class:feedback-wrong={feedbackState === 'wrong'} class:glitch-text={showGlitch}>
					{displayText}
				</span>
			</button>
		</VizQuizLayout>

		<div class="answer-area" class:hidden={!hasPlayed}>
			<AnswerGrid
				choices={question.choices}
				onselect={selectAnswer}
				disabled={!hasPlayed || !!selectedId}
				correctId={selectedId ? question.scale.id : null}
				{selectedId}
				onCorrectClick={selectedId ? (inResultMode ? nextQuestion : skipCorrect) : null}
				countdownPct={inResultMode ? countdownPct : -1}
				onWrongClick={inResultMode ? replayInResult : null}
			/>
		</div>
	{/if}
</div>
{/if}

<style>
	.quiz {
		position: relative;
		z-index: 1;
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
	.top-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
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
		font-size: 0.4rem;
		font-family: var(--mono);
		font-weight: 900;
		color: var(--marathon-blue);
		letter-spacing: 0.08em;
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
	.play-tap {
		position: relative;
		width: min(40vw, 160px);
		height: min(40vw, 160px);
		border-radius: 50%;
		background: transparent;
		border: 1.5px solid var(--accent);
		box-shadow: 0 0 8px rgba(194, 254, 12, 0.3);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		
	}
	.play-tap.feedback-correct { background: var(--correct); border-color: var(--correct); box-shadow: 0 0 12px var(--correct); }
	.play-tap.feedback-wrong { background: var(--hot); border-color: var(--hot); box-shadow: 0 0 12px var(--hot); transition: none; }
	.play-tap:active { transform: scale(0.95); }
	.play-tap.bouncing { animation: note-bounce 0.25s ease-in-out; }
	@keyframes note-bounce { 0% { transform: scale(1); } 25% { transform: scale(1.08); } 50% { transform: scale(0.97); } 75% { transform: scale(1.02); } 100% { transform: scale(1); } }
	.orbit-track { position: absolute; inset: 0; border-radius: 50%; animation: orbit 7s linear infinite; pointer-events: none; }
	.orbit-dot { position: absolute; top: -3px; left: 50%; transform: translateX(-50%); width: 6px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 6px var(--accent); }
	.play-tap.feedback-wrong .orbit-dot { background: var(--hot); box-shadow: 0 0 6px var(--hot); }
	@keyframes orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
	.q-text {
		font-family: var(--mono);
		font-size: 2rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		color: var(--accent);
		
	}
	.q-text.feedback-correct { color: var(--base); transition: none; }
	.q-text.feedback-wrong { color: var(--base); transition: none; }
	.q-text.glitch-text { }
	.answer-area {
		width: 100%;
		margin-top: auto;
	}
	.answer-area.hidden {
		visibility: hidden;
	}

	/* Summary screen */
	.summary {
		display: flex; flex-direction: column; align-items: center;
		gap: 1.25rem; width: 100%; min-height: 100%;
	}
	.summary .heading {
		border-bottom: 2px solid var(--border-heavy);
	}
	.score-block {
		display: flex; flex-direction: column; align-items: center;
		margin: 0.25rem 0;
	}
	.score-big {
		font-size: 4rem; font-weight: 900;
		font-family: var(--mono); color: var(--accent);
		letter-spacing: -0.02em; line-height: 1;
	}
	.section-label {
		font-size: 0.45rem; font-weight: 900;
		font-family: var(--mono); color: var(--marathon-blue);
		letter-spacing: 0.15em; align-self: flex-start;
		border-bottom: 1px solid var(--marathon-blue);
		padding-bottom: 0.2rem; width: 100%;
		margin-bottom: -0.75rem;
	}
	.section-label.missed-label {
		color: var(--hot);
		border-bottom-color: var(--hot);
	}
	.missed-list {
		display: flex; flex-direction: column; gap: 0.5rem; width: 100%;
	}
	.missed-card {
		position: relative; overflow: hidden;
		background: var(--surface);
		border-left: 3px solid var(--hot);
		border-top: none; border-right: none; border-bottom: none;
		cursor: pointer; text-align: left; width: 100%;
		transition: opacity 0.15s;
	}
	.missed-card:active { opacity: 0.8; }
	.missed-card.replaying { border-left-color: var(--accent); }
	.missed-card-fill {
		position: absolute; top: 0; left: 0; bottom: 0;
		background: var(--hot); opacity: 0.06;
	}
	.missed-card-content {
		position: relative; z-index: 1;
		display: grid; grid-template-columns: 4rem 1fr;
		align-items: center; gap: 0.75rem; padding: 0.7rem 0.85rem;
	}
	.missed-id {
		font-size: 1rem; font-weight: 900;
		font-family: 'BPdots', var(--mono); text-align: center;
		color: var(--hot); line-height: 1;
	}
	.missed-card.replaying .missed-id { color: var(--accent); }
	.missed-info {
		display: flex; flex-direction: column; gap: 0.1rem;
	}
	.missed-name {
		font-family: var(--font-display); color: var(--text-primary);
		font-size: 0.75rem; letter-spacing: 0.02em;
	}
	.missed-detail {
		font-family: var(--mono); font-size: 0.35rem;
		color: var(--hot); letter-spacing: 0.05em;
	}
	.perfect {
		font-size: 0.6rem; font-weight: 900;
		font-family: var(--mono); color: var(--accent);
		letter-spacing: 0.2em; padding: 1rem 0;
		text-align: center;
	}
	.summary-actions {
		display: flex; gap: 1rem; padding: 1rem 0;
		width: 100%; align-items: center; justify-content: center;
	}
	.action-btn {
		flex: 1; padding: 0.75rem;
		font-family: var(--mono); font-size: 0.5rem; font-weight: 900;
		letter-spacing: 0.12em; border: 1px solid var(--border-heavy);
		background: transparent; color: var(--text-primary);
		cursor: pointer; transition: background 0.15s, border-color 0.15s;
		text-align: center;
	}
	.action-btn:active { background: var(--surface-raised); }
	.action-btn.primary {
		background: var(--accent); color: var(--base);
		border-color: var(--accent);
	}
	.action-btn.primary:active { opacity: 0.85; }
</style>
