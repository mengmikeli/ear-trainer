<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { loadState, saveState, checkTierUnlock } from '$lib/state';
	import { generateQuestion } from '$lib/engine';
	import { playInterval, playFeedbackChime, suspendAudio } from '$lib/audio';
	import { responseQuality, calculateSm2 } from '$lib/sm2';
	import type { UserState, Question, IntervalDef, PlayMode } from '$lib/types';
	import AnswerGrid from '../../components/AnswerGrid.svelte';
	import ProgressBar from '../../components/ProgressBar.svelte';
	import TelemetryBar from '../../components/TelemetryBar.svelte';
	import VizQuizLayout from '../../components/VizQuizLayout.svelte';

	interface QuestionResult {
		interval: IntervalDef;
		mode: PlayMode;
		correct: boolean;
		selectedId: string;
	}

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
	let correctTimeout: ReturnType<typeof setTimeout> | null = null;

	// Viz phase — maps quiz state to VizQuizLayout phase
	const vizPhase = $derived.by((): 'rest' | 'playing' | 'correct' | 'wrong' | 'transition' => {
		if (isGlitching) return 'transition';
		if (feedbackState === 'correct') return 'correct';
		if (feedbackState === 'wrong') return 'wrong';
		if (isPlaying) return 'playing';
		return 'rest';
	});

	function handleTransitionEnd() {
		// VizQuizLayout settled to P1 — safe to show next question
	}

	// Track currently sounding MIDI notes for Chladni sync
	let playingNotes: number[] = $state([]);

	// Per-note bounce
	let bounceCount = $state(0);
	

	// Q# glitch text — settles toward real Q#
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

	// Summary state
	let showSummary = $state(false);
	let results: QuestionResult[] = $state([]);

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

			setTimeout(() => {
				isGlitching = false;
				play();
			}, 600);
		});
	}

	function play() {
		if (!question || !state) return;
		const rootMidi = question.rootNote;
		const secondMidi = rootMidi + question.interval.semitones;

		playInterval(
			rootMidi,
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

		// Sync Chladni with interval notes
		playingNotes = [rootMidi]; bounceCount++;
		const secondDelay = (noteDuration + gap) * 1000;
		setTimeout(() => { playingNotes = [secondMidi]; bounceCount++; }, secondDelay);
		setTimeout(() => { isPlaying = false; playingNotes = []; }, totalMs);
	}

	function selectAnswer(choice: IntervalDef) {
		if (!question || !state || selectedId) return;

		const correct = choice.id === question.interval.id;
		selectedId = choice.id;
		isCorrect = correct;
		feedbackState = correct ? 'correct' : 'wrong';

		if (correct) sessionCorrect++;

		// Track result for summary
		results.push({
			interval: question.interval,
			mode: question.playMode,
			correct,
			selectedId: choice.id,
		});

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
			correctTimeout = setTimeout(() => nextQuestion(), 1350);
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

	// Summary derived stats
	const summaryAccuracy = $derived(results.length > 0 ? Math.round((sessionCorrect / results.length) * 100) : 0);

	const wrongAnswers = $derived(results.filter(r => !r.correct));

	const modeBreakdown = $derived(() => {
		const modes: Record<string, { total: number; correct: number }> = {};
		for (const r of results) {
			if (!modes[r.mode]) modes[r.mode] = { total: 0, correct: 0 };
			modes[r.mode].total++;
			if (r.correct) modes[r.mode].correct++;
		}
		return modes;
	});

	const modeGlyph: Record<string, string> = {
		ascending: '\uE007',
		descending: '\uE008',
		harmonic: '\uE000',
	};

	let replayingIndex: number | null = $state(null);

	function replayMissed(r: QuestionResult) {
		if (replayingIndex !== null) return;
		const idx = wrongAnswers.indexOf(r);
		replayingIndex = idx;
		playInterval(
			r.interval.semitones + 60, // rootNote (middle C area)
			r.interval.semitones,
			r.mode,
			state?.settings.toneType ?? 'epiano'
		);
		const dur = r.mode === 'harmonic' ? 1500 : 1200;
		setTimeout(() => { replayingIndex = null; }, dur);
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

	{#if Object.keys(modeBreakdown()).length > 1}
		<div class="section-label">PER MODE</div>
		<div class="mode-rows">
			{#each Object.entries(modeBreakdown()) as [mode, stats]}
				<div class="mode-row">
					<span class="mode-glyph">{modeGlyph[mode] ?? mode}</span>
					<span class="mode-stat">{stats.correct}/{stats.total}</span>
					<span class="mode-acc">{Math.round((stats.correct / stats.total) * 100)}%</span>
				</div>
			{/each}
		</div>
	{/if}

	{#if wrongAnswers.length > 0}
		<div class="section-label missed-label">MISSED</div>
		<div class="missed-list">
			{#each wrongAnswers as r, i}
				<button class="missed-card" class:replaying={replayingIndex === i} onclick={() => replayMissed(r)}>
					<div class="missed-card-fill" style="width: 0%"></div>
					<div class="missed-card-content">
						<span class="missed-id">{r.interval.id}</span>
						<div class="missed-info">
							<span class="missed-name">{r.interval.name}</span>
							<span class="missed-detail">answered {r.selectedId}</span>
						</div>
						<span class="missed-mode">{modeGlyph[r.mode]}</span>
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
		<VizQuizLayout
			mode="interval"
			phase={vizPhase}
			semitones={question.interval.semitones}
			countdownPct={hasPlayed && inResultMode ? countdownPct : -1}
			ontransitionend={handleTransitionEnd}
			{playingNotes}
		>
			<button class="play-tap" class:feedback-correct={feedbackState === 'correct'} class:feedback-wrong={feedbackState === 'wrong'} onclick={hasPlayed && inResultMode ? replayInResult : play}>
				{#key bounceCount}<div class="bounce-ring"></div>{/key}
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
				correctId={selectedId ? question.interval.id : null}
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
		transition: background 0.3s, border-color 0.3s, box-shadow 0.3s;
	}
	.play-tap.feedback-correct { background: var(--correct); border-color: var(--correct); box-shadow: 0 0 12px var(--correct); }
	.play-tap.feedback-wrong { background: var(--hot); border-color: var(--hot); box-shadow: 0 0 12px var(--hot); }
	.play-tap:active { transform: scale(0.95); }
	.bounce-ring { position: absolute; inset: -2px; border-radius: 50%; border: 2px solid var(--accent); animation: note-bounce 0.2s ease-out; pointer-events: none; }
	@keyframes note-bounce { 0% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 0; } }
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
		transition: color 0.3s ease-out;
	}
	.q-text.feedback-correct { color: var(--base); }
	.q-text.feedback-wrong { color: var(--base); }
	.q-text.glitch-text { /* clean glyph cycling, no effects */ }
	.answer-area {
		width: 100%;
		margin-top: auto; /* push to bottom */
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
	.mode-rows {
		display: flex; flex-direction: column; gap: 0.4rem; width: 100%;
	}
	.mode-row {
		display: flex; align-items: baseline; gap: 0.75rem;
		font-family: var(--mono); font-size: 0.5rem;
		color: var(--text-primary);
	}
	.mode-glyph {
		font-size: 0.65rem; color: var(--marathon-blue); width: 1.5rem; text-align: center;
		transform: translateY(1px);
	}
	.mode-stat {
		font-weight: 900; letter-spacing: 0.05em;
	}
	.mode-acc {
		color: var(--text-secondary); font-size: 0.4rem;
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
		display: grid; grid-template-columns: 4rem 1fr auto;
		align-items: center; gap: 0.75rem; padding: 0.7rem 0.85rem;
	}
	.missed-id {
		font-size: 1.5rem; font-weight: 900;
		font-family: 'BPdots', var(--mono); text-align: center;
		color: var(--hot); line-height: 1;
		transform: translateY(-4px);
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
	.missed-mode {
		font-size: 0.55rem; font-family: var(--mono);
		color: var(--hot); opacity: 0.6;
	}
	.missed-card.replaying .missed-mode { color: var(--accent); }
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
