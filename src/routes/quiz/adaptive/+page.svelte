<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { loadState, saveState, checkTierUnlock } from '$lib/state';
	import { playInterval, playChord, playScale, playFeedbackChime, startDrone, stopDrone, type DroneHandle } from '$lib/audio';
	import { generateDistractors, generateChordDistractors, generateScaleDistractors, generateModeDistractors } from '$lib/engine';
	import { planSession, recordAdaptiveAnswer, type ContentItem, type PlannedQuestion, type SessionPlan, type SessionConfig } from '$lib/adaptive';
	import { INTERVALS } from '$lib/intervals';
	import { CHORDS, applyInversion } from '$lib/chords';
	import { SCALES } from '$lib/scales';
	import { MODES } from '$lib/modes';
	import type { UserState, IntervalDef, ChordDef, ScaleDef, PlayMode, ChordVoicing } from '$lib/types';
	import PlayButton from '../../../components/PlayButton.svelte';
	import AnswerGrid from '../../../components/AnswerGrid.svelte';
	import ProgressBar from '../../../components/ProgressBar.svelte';
	import TelemetryBar from '../../../components/TelemetryBar.svelte';

	const SCALE_TEMPO = 150;
	const MODE_TEMPO = 180;

	interface AdaptiveResult {
		item: ContentItem;
		correct: boolean;
		selectedId: string;
		correctId: string;
		correctName: string;
	}

	// Quiz state
	let state: UserState | null = $state(null);
	let plan: SessionPlan | null = $state(null);
	let questionIdx = $state(0);
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
	let countdownDuration = 6000;
	let rafId: number | null = null;
	let isGlitching = $state(false);
	let correctTimeout: ReturnType<typeof setTimeout> | null = null;

	// Current question data
	let currentItem: ContentItem | null = $state(null);
	let choices: { id: string; name: string; label?: string }[] = $state([]);
	let correctDefId: string = $state('');
	let rootNote: number = $state(60);
	let replays = $state(0);

	// Derived: interval mode or chord voicing for current question
	let currentPlayMode: PlayMode = $state('ascending');
	let currentVoicing: ChordVoicing = $state('root');

	// Drone for mode questions
	let drone: DroneHandle | null = $state(null);
	let droneMuted = $state(false);

	function toggleDroneMute() {
		if (!drone) return;
		droneMuted = !droneMuted;
		drone.setMuted(droneMuted);
	}

	// Summary
	let showSummary = $state(false);
	let results: AdaptiveResult[] = $state([]);

	onMount(() => {
		state = loadState();
		totalQuestions = state.settings.sessionLength;

		const config: SessionConfig = {
			length: totalQuestions,
			allowedKinds: ['interval', 'chord', 'scale', 'mode'],
			mixStrategy: 'adaptive',
		};

		plan = planSession(state, config);
		nextQuestion();
	});

	onDestroy(() => {
		stopDrone();
	});

	function nextQuestion() {
		if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
		if (!state || !plan) return;
		if (questionIdx >= plan.questions.length) {
			finishSession();
			return;
		}

		// Stop drone from previous mode question (if any)
		if (drone) { stopDrone(); drone = null; droneMuted = false; }

		isGlitching = true;
		feedbackState = null;
		questionIdx++;

		requestAnimationFrame(() => {
			inResultMode = false;
			setupQuestion();
		});

		setTimeout(() => {
			isGlitching = false;
			play();
		}, 100);
	}

	function setupQuestion() {
		if (!state || !plan) return;
		const planned = plan.questions[questionIdx - 1];
		currentItem = planned.item;
		replays = 0;

		const kind = currentItem.kind;
		const defId = currentItem.defId;
		const variant = currentItem.variant;

		if (kind === 'interval') {
			const def = INTERVALS.find(i => i.id === defId)!;
			currentPlayMode = (variant as PlayMode) ?? 'ascending';
			correctDefId = def.id;

			// Generate root note
			const direction = currentPlayMode === 'descending' ? 'descending' : 'ascending';
			const maxRoot = direction === 'ascending' || currentPlayMode === 'harmonic' ? 84 - def.semitones : 84;
			const minRoot = direction === 'descending' ? 48 + def.semitones : 48;
			rootNote = minRoot + Math.floor(Math.random() * (maxRoot - minRoot + 1));

			// Generate choices
			const distractors = generateDistractors(def.id, state);
			const seen = new Set<string>();
			const raw = [def, ...distractors].filter(c => {
				if (seen.has(c.id)) return false;
				seen.add(c.id);
				return true;
			});
			choices = raw.sort(() => Math.random() - 0.5).map(c => ({ id: c.id, name: c.name, label: c.id }));

		} else if (kind === 'chord') {
			const def = CHORDS.find(c => c.id === defId)!;
			currentVoicing = (variant as ChordVoicing) ?? 'root';
			correctDefId = def.id;

			const maxSemitone = Math.max(...def.intervals);
			const inversionBoost = currentVoicing === 'second' ? 12 : currentVoicing === 'first' ? 12 : 0;
			const maxRoot = Math.min(72, 84 - maxSemitone - inversionBoost);
			rootNote = 48 + Math.floor(Math.random() * (Math.max(1, maxRoot - 48 + 1)));

			const distractors = generateChordDistractors(def.id, state);
			const seen = new Set<string>();
			const raw = [def, ...distractors].filter(c => {
				if (seen.has(c.id)) return false;
				seen.add(c.id);
				return true;
			});
			choices = raw.sort(() => Math.random() - 0.5).map(c => ({ id: c.id, name: c.name, label: c.label ?? c.id.toUpperCase() }));

		} else if (kind === 'scale') {
			const def = SCALES.find(s => s.id === defId)!;
			correctDefId = def.id;

			const highestInterval = Math.max(...def.intervals);
			const maxRoot = 72 - highestInterval;
			rootNote = 48 + Math.floor(Math.random() * (Math.max(1, maxRoot - 48 + 1)));

			const distractors = generateScaleDistractors(def.id, state);
			const seen = new Set<string>();
			const raw = [def, ...distractors].filter(c => {
				if (seen.has(c.id)) return false;
				seen.add(c.id);
				return true;
			});
			choices = raw.sort(() => Math.random() - 0.5).map(c => ({ id: c.id, name: c.name, label: c.label ?? c.id.toUpperCase() }));

		} else if (kind === 'mode') {
			const def = MODES.find(m => m.id === defId)!;
			correctDefId = def.id;

			// Root note C3-C4 for comfortable drone register
			rootNote = 48 + Math.floor(Math.random() * 13);

			const distractors = generateModeDistractors(def.id, state.modes);
			const seen = new Set<string>();
			const raw = [def, ...distractors].filter(c => {
				if (seen.has(c.id)) return false;
				seen.add(c.id);
				return true;
			});
			choices = raw.sort(() => Math.random() - 0.5).map(c => ({ id: c.id, name: c.name, label: c.label }));

			// Start drone for mode questions
			stopDrone();
			drone = startDrone(rootNote);
		}

		hasPlayed = false;
		selectedId = null;
	}

	function play() {
		if (!state || !currentItem) return;

		const kind = currentItem.kind;
		const defId = currentItem.defId;

		if (kind === 'interval') {
			const def = INTERVALS.find(i => i.id === defId)!;
			playInterval(rootNote, def.semitones, currentPlayMode, state.settings.toneType);
			isPlaying = true;
			const dur = currentPlayMode === 'harmonic' ? 1500 : 1500;
			setTimeout(() => { isPlaying = false; }, dur);

		} else if (kind === 'chord') {
			const def = CHORDS.find(c => c.id === defId)!;
			playChord(rootNote, def.intervals, currentVoicing, state.settings.toneType);
			isPlaying = true;
			setTimeout(() => { isPlaying = false; }, 1500);

		} else if (kind === 'scale') {
			const def = SCALES.find(s => s.id === defId)!;
			playScale(rootNote, def.intervals, state.settings.toneType, SCALE_TEMPO);
			isPlaying = true;
			const dur = def.intervals.length * SCALE_TEMPO + 400;
			setTimeout(() => { isPlaying = false; }, dur);

		} else if (kind === 'mode') {
			const def = MODES.find(m => m.id === defId)!;
			playScale(rootNote, def.intervals, state.settings.toneType, MODE_TEMPO);
			isPlaying = true;
			const dur = def.intervals.length * MODE_TEMPO + 400;
			setTimeout(() => { isPlaying = false; }, dur);
		}

		if (!hasPlayed) {
			hasPlayed = true;
			startTime = Date.now();
		} else {
			replays++;
		}
	}

	function selectAnswer(choice: { id: string; name: string }) {
		if (!state || !currentItem || selectedId) return;

		const correct = choice.id === correctDefId;
		selectedId = choice.id;
		isCorrect = correct;
		feedbackState = correct ? 'correct' : 'wrong';

		if (correct) sessionCorrect++;

		const correctDef = choices.find(c => c.id === correctDefId);
		results.push({
			item: currentItem,
			correct,
			selectedId: choice.id,
			correctId: correctDefId,
			correctName: correctDef?.name ?? correctDefId,
		});

		playFeedbackChime(correct);

		// Record in adaptive engine (handles dual-write to legacy)
		recordAdaptiveAnswer(state, currentItem.id, {
			correct,
			replays,
			responseTimeMs: Date.now() - startTime,
		});

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
		stopDrone(); drone = null; droneMuted = false;
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

		// Record session in adaptive history
		if (state.adaptive) {
			const kinds = [...new Set(results.map(r => r.item.kind))];
			const accuracy = results.length > 0 ? sessionCorrect / results.length : 0;
			const weakest = results.filter(r => !r.correct)[0]?.item.id ?? '';
			const strongest = results.filter(r => r.correct).slice(-1)[0]?.item.id ?? '';
			state.adaptive.sessionHistory.push({
				date: Date.now(),
				length: results.length,
				kinds: kinds as any,
				accuracy,
				weakestItem: weakest,
				strongestItem: strongest,
			});
			// Keep last 20 sessions
			if (state.adaptive.sessionHistory.length > 20) {
				state.adaptive.sessionHistory = state.adaptive.sessionHistory.slice(-20);
			}
			state.adaptive.lastSessionDate = Date.now();
		}

		saveState(state);
		showSummary = true;
	}

	function restartQuiz() {
		showSummary = false;
		sessionCorrect = 0;
		questionIdx = 0;
		results = [];
		state = loadState();
		totalQuestions = state.settings.sessionLength;

		const config: SessionConfig = {
			length: totalQuestions,
			allowedKinds: ['interval', 'chord', 'scale', 'mode'],
			mixStrategy: 'adaptive',
		};
		plan = planSession(state, config);
		nextQuestion();
	}

	function skipCorrect() {
		if (correctTimeout) { clearTimeout(correctTimeout); correctTimeout = null; }
		nextQuestion();
	}

	function endEarly() {
		stopDrone(); drone = null; droneMuted = false;
		if (questionIdx > 1 && state) {
			state.stats.totalSessions++;
			state.stats.lastPractice = Date.now();
			saveState(state);
		}
		goto(`${base}/`);
	}

	// Summary
	const summaryAccuracy = $derived(results.length > 0 ? Math.round((sessionCorrect / results.length) * 100) : 0);
	const wrongAnswers = $derived(results.filter(r => !r.correct));

	const kindBreakdown = $derived(() => {
		const kinds: Record<string, { total: number; correct: number }> = {};
		for (const r of results) {
			const k = r.item.kind;
			if (!kinds[k]) kinds[k] = { total: 0, correct: 0 };
			kinds[k].total++;
			if (r.correct) kinds[k].correct++;
		}
		return kinds;
	});

	const kindGlyph: Record<string, string> = {
		interval: '\uE007',
		chord: '\uE000',
		scale: '\uE013',
		mode: '\uE014',
	};

	const kindLabel: Record<string, string> = {
		interval: 'INTERVALS',
		chord: 'CHORDS',
		scale: 'SCALES',
		mode: 'MODES',
	};

	// Content type indicator for current question
	const contentIndicator = $derived(() => {
		if (!currentItem) return '';
		return kindLabel[currentItem.kind] ?? currentItem.kind.toUpperCase();
	});

	// Semitones for PlayButton visualization (interval only)
	const currentSemitones = $derived(() => {
		if (!currentItem || currentItem.kind !== 'interval') return 0;
		const def = INTERVALS.find(i => i.id === currentItem!.defId);
		return def?.semitones ?? 0;
	});
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

	{#if Object.keys(kindBreakdown()).length > 1}
		<div class="section-label">PER TYPE</div>
		<div class="mode-rows">
			{#each Object.entries(kindBreakdown()) as [kind, stats]}
				<div class="mode-row">
					<span class="mode-glyph">{kindGlyph[kind] ?? '•'}</span>
					<span class="kind-name">{kindLabel[kind] ?? kind}</span>
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
				<div class="missed-card">
					<div class="missed-card-content">
						<span class="missed-id">{r.correctId}</span>
						<div class="missed-info">
							<span class="missed-name">{r.correctName}</span>
							<span class="missed-detail">{r.item.kind} • answered {r.selectedId}</span>
						</div>
						<span class="missed-mode">{kindGlyph[r.item.kind] ?? '•'}</span>
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
	<h2 class="heading">TRAIN</h2>
	<div class="top">
		<div class="bar-track-full">
			<ProgressBar current={questionIdx} total={plan?.questions.length ?? totalQuestions} />
		</div>
		<div class="top-controls">
			<button class="close exit" onclick={endEarly}>EXIT</button>
			{#if currentItem?.kind === 'mode' && drone}
				<button class="drone-btn" class:muted={droneMuted} onclick={toggleDroneMute}>
					{droneMuted ? 'DRONE OFF' : 'DRONE ON'}
				</button>
			{:else}
				<span class="content-badge">{contentIndicator()}</span>
			{/if}
			<span class="counter">{String(questionIdx).padStart(2, '0')}/{String(plan?.questions.length ?? totalQuestions).padStart(2, '0')}</span>
		</div>
	</div>

	{#if currentItem}
		<div class="play-area">
			<PlayButton
				onplay={hasPlayed && inResultMode ? replayInResult : play}
				replaying={hasPlayed}
				playing={isPlaying}
				noBorder={hasPlayed && inResultMode}
				questionNum={questionIdx}
				countdownPct={hasPlayed && inResultMode ? countdownPct : -1}
				glitching={isGlitching}
				feedback={feedbackState}
				semitones={currentSemitones()}
			/>
		</div>

		<div class="answer-area" class:hidden={!hasPlayed}>
			<AnswerGrid
				{choices}
				onselect={selectAnswer}
				disabled={!hasPlayed || !!selectedId}
				correctId={selectedId ? correctDefId : null}
				{selectedId}
				onCorrectClick={selectedId ? (inResultMode ? nextQuestion : skipCorrect) : null}
			/>
		</div>
	{/if}
</div>
{/if}

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
	.content-badge {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		font-size: 0.35rem;
		font-family: var(--mono);
		color: var(--marathon-blue);
		letter-spacing: 0.15em;
		font-weight: 900;
		border: 1px solid var(--marathon-blue);
		padding: 0 6px;
		line-height: 1.6;
		opacity: 0.7;
	}
	.drone-btn {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
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
	.drone-btn.muted {
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
	.kind-name {
		font-size: 0.35rem; letter-spacing: 0.1em; color: var(--text-secondary);
		width: 5rem;
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
		text-align: left; width: 100%;
	}
	.missed-card-content {
		position: relative;
		display: grid; grid-template-columns: 4rem 1fr auto;
		align-items: center; gap: 0.75rem; padding: 0.7rem 0.85rem;
	}
	.missed-id {
		font-size: 1.5rem; font-weight: 900;
		font-family: 'BPdots', var(--mono); text-align: center;
		color: var(--hot); line-height: 1;
		transform: translateY(-4px);
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
	.missed-mode {
		font-size: 0.55rem; font-family: var(--mono);
		color: var(--hot); opacity: 0.6;
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
