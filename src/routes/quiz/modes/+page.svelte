<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { loadState, saveState, checkTierUnlock } from '$lib/state';
	import { generateModeQuestion } from '$lib/engine';
	import { playScale, playFeedbackChime, startDrone, stopDrone, type DroneHandle } from '$lib/audio';
	import { responseQuality, calculateSm2 } from '$lib/sm2';
	import {
		needsLearnCard, findNeighbor, buildAllItems, recordAdaptiveAnswer,
		type ContentItem,
	} from '$lib/adaptive';
	import type { UserState, ModeQuestion } from '$lib/types';
	import type { ModeDef } from '$lib/modes';
	import { MODES } from '$lib/modes';
	import AnswerGrid from '../../../components/AnswerGrid.svelte';
	import ProgressBar from '../../../components/ProgressBar.svelte';
	import TelemetryBar from '../../../components/TelemetryBar.svelte';
	import LearnCard from '../../../components/LearnCard.svelte';
	import VizQuizLayout from '../../../components/VizQuizLayout.svelte';

	const TEMPO = 180; // ms per note — slightly slower than scales for clarity over drone

	interface QuestionResult {
		mode: ModeDef;
		correct: boolean;
		selectedId: string;
	}

	let state: UserState | null = $state(null);
	let question: ModeQuestion | null = $state(null);
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
	let countdownDuration = 10000; // longer for A/B comparison
	let rafId: number | null = null;
	let isGlitching = $state(false);
	let correctTimeout: ReturnType<typeof setTimeout> | null = null;

	// Learn card state
	let isLearnPhase = $state(false);
	let learnItem: ContentItem | null = $state(null);
	let learnNeighbor: ContentItem | null = $state(null);

	let showSummary = $state(false);
	let results: QuestionResult[] = $state([]);
	let replayingIndex: number | null = $state(null);

	// Drone state
	let drone: DroneHandle | null = $state(null);
	let droneMuted = $state(false);

	// A/B comparison state (for wrong answers)
	let abPlaying: string | null = $state(null);

	// Viz phase — maps quiz state to VizQuizLayout phase
	const vizPhase = $derived.by((): 'rest' | 'playing' | 'correct' | 'wrong' | 'transition' => {
		if (isGlitching) return 'transition';
		if (feedbackState === 'correct') return 'correct';
		if (feedbackState === 'wrong') return 'wrong';
		if (isPlaying) return 'playing';
		return 'rest';
	});

	function handleTransitionEnd() {}

	let playingNotes: number[] = $state([]);
	let noteTimeouts: ReturnType<typeof setTimeout>[] = [];

	// Per-note bounce
	let bounceStartTime = 0;
	let bounceDuration = 0;
	let bounceAnimId = 0;
	let playBtnEl: HTMLButtonElement | undefined = $state();
	function triggerBounce(sustained = false) {
		bounceStartTime = performance.now();
		bounceDuration = sustained ? 1200 : 300;
		if (!bounceAnimId) bounceLoop();
	}
	function bounceLoop() {
		const elapsed = performance.now() - bounceStartTime;
		if (elapsed < bounceDuration && playBtnEl) {
			const t = elapsed / bounceDuration;
			const scale = 1 + 0.06 * Math.cos(40 * t) * Math.exp(-4 * t);
			playBtnEl.style.transform = `scale(${scale})`;
			bounceAnimId = requestAnimationFrame(bounceLoop);
		} else {
			if (playBtnEl) playBtnEl.style.transform = '';
			bounceAnimId = 0;
		}
	}

	// Glitch text
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

	onMount(() => {
		state = loadState();
		totalQuestions = state.settings.sessionLength;
		nextQuestion();
	});

	onDestroy(() => {
		stopDrone();
		if (rafId) cancelAnimationFrame(rafId);
		noteTimeouts.forEach(clearTimeout);
	});

	function nextQuestion() {
		if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
		noteTimeouts.forEach(clearTimeout);
		noteTimeouts = [];
		if (!state) return;
		if (questionNum >= totalQuestions) {
			finishSession();
			return;
		}

		feedbackState = null;
		abPlaying = null;
		isPlaying = false;
		playingNotes = [];
		questionNum++;

		const nextQ = generateModeQuestion(state);
		const stats = state.adaptive?.stats ?? {};
		const adaptiveId = `mode:${nextQ.mode.id}`;
		const devMode = state.settings.devMode ?? false;

		if (needsLearnCard(adaptiveId, stats, devMode)) {
			isLearnPhase = true;
			isGlitching = false;
			learnItem = {
				kind: 'mode',
				id: adaptiveId,
				defId: nextQ.mode.id,
				tier: nextQ.mode.tier,
				category: 'mode',
			};
			const allItems = buildAllItems(state);
			learnNeighbor = findNeighbor(learnItem, allItems, stats);
			question = nextQ;
			inResultMode = false;
			hasPlayed = false;
			selectedId = null;
			// Stop drone — LearnCard manages its own
			stopDrone();
			drone = null;
			return;
		}

		isLearnPhase = false;
		isGlitching = true;

		requestAnimationFrame(() => {
			inResultMode = false;
			question = nextQ;
			hasPlayed = false;
			selectedId = null;
			countdownPct = 1.0;

			// Start drone on root note
			if (question) {
				stopDrone();
				startDrone(question.droneNote).then(h => { drone = h; });
				droneMuted = false;
			}
		});

		setTimeout(() => {
			isGlitching = false;
			play();
		}, 1200);
	}

	function handleLearnComplete(correct: boolean) {
		if (!state || !learnItem) return;

		recordAdaptiveAnswer(state, learnItem.id, {
			correct,
			replays: 0,
			responseTimeMs: 0,
		});

		if (state.adaptive?.stats[learnItem.id]) {
			state.adaptive.stats[learnItem.id].nextReview = Date.now() + 5 * 60 * 1000;
		}

		state = checkTierUnlock(state);
		state.stats.totalQuestions++;
		saveState(state);

		isLearnPhase = false;
		nextQuestion();
	}

	function play() {
		if (!question || !state) return;
		// Clear pending note timeouts
		noteTimeouts.forEach(clearTimeout);
		noteTimeouts = [];

		playScale(
			question.rootNote,
			question.mode.intervals,
			state.settings.toneType,
			TEMPO,
		);
		if (!hasPlayed) {
			hasPlayed = true;
			startTime = Date.now();
		} else {
			question.replays++;
		}
		isPlaying = true;
		const dur = question.mode.intervals.length * TEMPO + 400;

		// Sync Chladni with mode notes
		question.mode.intervals.forEach((semitone: number, i: number) => {
			noteTimeouts.push(setTimeout(() => {
				playingNotes = [question!.rootNote + semitone]; triggerBounce();
			}, i * TEMPO));
		});
		noteTimeouts.push(setTimeout(() => { isPlaying = false; playingNotes = []; }, dur));
	}

	function playAB(modeId: string) {
		if (!question || !state || abPlaying) return;
		const mode = MODES.find(m => m.id === modeId);
		if (!mode) return;

		abPlaying = modeId;
		playScale(
			question.rootNote,
			mode.intervals,
			state.settings.toneType,
			TEMPO,
		);
		const dur = mode.intervals.length * TEMPO + 400;
		setTimeout(() => { abPlaying = null; }, dur);

		// Reset countdown on A/B play
		countdownStart = performance.now();
		countdownPct = 1.0;
	}

	function toggleDroneMute() {
		if (!drone) return;
		droneMuted = !droneMuted;
		drone.setMuted(droneMuted);
	}

	function selectAnswer(choice: { id: string; name: string }) {
		if (!question || !state || selectedId) return;

		const correct = choice.id === question.mode.id;
		selectedId = choice.id;
		isCorrect = correct;
		feedbackState = correct ? 'correct' : 'wrong';

		if (correct) sessionCorrect++;

		results.push({
			mode: question.mode,
			correct,
			selectedId: choice.id,
		});

		playFeedbackChime(correct);

		// Update mode state
		if (state.modes) {
			const s = state.modes[question.mode.id];
			if (s) {
				s.attempts++;
				if (correct) { s.correct++; s.streak++; }
				else { s.streak = 0; }
				s.lastSeen = Date.now();

				const quality = responseQuality({
					correct,
					replays: question.replays,
					responseTimeMs: Date.now() - startTime,
				});
				const sm2 = calculateSm2(s.easeFactor, quality);
				s.easeFactor = sm2.easeFactor;
				s.nextReview = Date.now() + sm2.intervalMs;
			}
		}

		// Also record in adaptive engine if present
		if (state.adaptive) {
			const itemId = `mode:${question.mode.id}`;
			if (!state.adaptive.stats[itemId]) {
				state.adaptive.stats[itemId] = {
					attempts: 0,
					correct: 0,
					streak: 0,
					lastSeen: 0,
					easeFactor: 2.5,
					nextReview: 0,
					relatedItems: [],
				};
			}
			const as = state.adaptive.stats[itemId];
			as.attempts++;
			if (correct) { as.correct++; as.streak++; }
			else { as.streak = 0; }
			as.lastSeen = Date.now();
			const quality = responseQuality({
				correct,
				replays: question.replays,
				responseTimeMs: Date.now() - startTime,
			});
			const sm2 = calculateSm2(as.easeFactor, quality);
			as.easeFactor = sm2.easeFactor;
			as.nextReview = Date.now() + sm2.intervalMs;
		}

		state = checkTierUnlock(state);
		state.stats.totalQuestions++;
		saveState(state);

		if (correct) {
			// Stop drone on correct → moving to next question
			correctTimeout = setTimeout(() => {
				stopDrone();
				drone = null;
				nextQuestion();
			}, 1350);
		} else {
			enterResultMode();
		}
	}

	function enterResultMode() {
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
			stopDrone();
			drone = null;
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
		stopDrone();
		drone = null;

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

	function endEarly() {
		stopDrone();
		if (questionNum > 1 && state) {
			state.stats.totalSessions++;
			state.stats.lastPractice = Date.now();
			saveState(state);
		}
		goto(`${base}/`);
	}

	// Summary
	const summaryAccuracy = $derived(results.length > 0 ? Math.round((sessionCorrect / results.length) * 100) : 0);
	const wrongAnswers = $derived(results.filter(r => !r.correct));
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
				<div class="missed-card">
					<div class="missed-card-content">
						<span class="missed-id">{r.mode.label}</span>
						<div class="missed-info">
							<span class="missed-name">{r.mode.name}</span>
							<span class="missed-detail">answered {MODES.find(m => m.id === r.selectedId)?.name ?? r.selectedId}</span>
						</div>
					</div>
				</div>
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
	<h2 class="heading">MODES</h2>
	<div class="top">
		<div class="bar-track-full">
			<ProgressBar current={questionNum} total={totalQuestions} />
		</div>
		<div class="top-controls">
			<button class="close exit" onclick={endEarly}>EXIT</button>
			<div class="drone-indicator" class:muted={droneMuted}>
				<button class="drone-btn" onclick={toggleDroneMute}>
					{droneMuted ? 'DRONE OFF' : 'DRONE ON'}
				</button>
			</div>
			<span class="counter">{String(questionNum).padStart(2, '0')}/{String(totalQuestions).padStart(2, '0')}</span>
		</div>
	</div>

	{#if question && isLearnPhase && learnItem}
		<div class="learn-area">
			{#key learnItem?.id}
			<LearnCard
				item={learnItem}
				neighbor={learnNeighbor}
				userState={state}
				onComplete={handleLearnComplete}
			/>
			{/key}
		</div>
	{:else if question}
		<VizQuizLayout
			superchargeViz={state?.settings?.superchargeViz}
			mode="scale"
			phase={vizPhase}
			scaleIntervals={question.mode.intervals}
			countdownPct={hasPlayed && inResultMode ? countdownPct : -1}
			ontransitionend={handleTransitionEnd}
			{playingNotes}
		>
			<button bind:this={playBtnEl} class="play-tap" class:feedback-correct={feedbackState === 'correct'} class:feedback-wrong={feedbackState === 'wrong'} onclick={hasPlayed && inResultMode ? replayInResult : play}>
				<div class="orbit-track"><div class="orbit-dot"></div></div>
				<span class="q-text" class:feedback-correct={feedbackState === 'correct'} class:feedback-wrong={feedbackState === 'wrong'} class:glitch-text={showGlitch}>
					{displayText}
				</span>
			</button>
		</VizQuizLayout>

		<div class="answer-area" class:hidden={!hasPlayed}>
			{#if inResultMode && selectedId}
				<!-- A/B comparison buttons for wrong answers -->
				<div class="ab-section">
					<div class="section-label">COMPARE</div>
					<div class="ab-grid">
						{#each [question.mode, ...question.choices.filter(c => c.id !== question?.mode.id).slice(0, 1)] as comp}
							<button
								class="ab-btn"
								class:playing={abPlaying === comp.id}
								class:correct-ab={comp.id === question.mode.id}
								onclick={() => playAB(comp.id)}
								disabled={!!abPlaying}
							>
								<span class="ab-label">{comp.label}</span>
								<span class="ab-name">{comp.name}</span>
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<AnswerGrid
				choices={question.choices.map(c => ({ id: c.id, name: c.name, label: c.label }))}
				onselect={selectAnswer}
				disabled={!hasPlayed || !!selectedId}
				correctId={selectedId ? question.mode.id : null}
				{selectedId}
				onCorrectClick={selectedId ? (inResultMode ? () => { stopDrone(); drone = null; nextQuestion(); } : () => { if (correctTimeout) { clearTimeout(correctTimeout); correctTimeout = null; } stopDrone(); drone = null; nextQuestion(); }) : null}
			/>
		</div>
	{/if}
</div>
{/if}

<style>
	.learn-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 1;
		justify-content: center;
		width: 100%;
		padding: 0 1rem;
	}
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
	.drone-indicator {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
	}
	.drone-btn {
		font-size: 0.35rem;
		font-family: var(--mono);
		font-weight: 900;
		letter-spacing: 0.1em;
		color: var(--accent);
		background: transparent;
		border: 1px solid var(--accent);
		padding: 0 8px;
		line-height: 1.6;
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s, opacity 0.15s;
	}
	.drone-indicator.muted .drone-btn {
		color: var(--text-secondary);
		border-color: var(--border-heavy);
		opacity: 0.5;
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
	.q-text.glitch-text { /* clean glyph cycling */ }
	.answer-area {
		width: 100%;
	}
	.answer-area.hidden {
		visibility: hidden;
	}

	/* A/B comparison */
	.ab-section {
		margin-bottom: 0.75rem;
	}
	.ab-section .section-label {
		font-size: 0.35rem; font-weight: 900;
		font-family: var(--mono); color: var(--marathon-blue);
		letter-spacing: 0.15em;
		margin-bottom: 0.5rem;
	}
	.ab-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}
	.ab-btn {
		padding: 0.5rem;
		background: var(--surface);
		border: 1px solid var(--border-heavy);
		text-align: center;
		cursor: pointer;
		transition: border-color 0.15s;
	}
	.ab-btn:not(:disabled):active {
		border-color: var(--accent);
	}
	.ab-btn.playing {
		border-color: var(--accent);
		background: rgba(194, 254, 12, 0.05);
	}
	.ab-btn.correct-ab {
		border-color: var(--correct);
	}
	.ab-btn.correct-ab .ab-label {
		color: var(--correct);
	}
	.ab-label {
		display: block;
		font-size: 1.2rem;
		font-weight: 900;
		font-family: 'BPdots', var(--mono);
		color: var(--accent);
		line-height: 1;
	}
	.ab-name {
		display: block;
		font-size: 0.5rem;
		color: var(--text-secondary);
		font-family: var(--font-display);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		margin-top: 0.15rem;
	}

	/* Summary */
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
		text-align: left; width: 100%;
	}
	.missed-card-content {
		position: relative;
		display: grid; grid-template-columns: 4rem 1fr;
		align-items: center; gap: 0.75rem; padding: 0.7rem 0.85rem;
	}
	.missed-id {
		font-size: 1.5rem; font-weight: 900;
		font-family: 'BPdots', var(--mono); text-align: center;
		color: var(--hot); line-height: 1;
	}
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
