<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { ensureResumed } from '$lib/audio/context';
	import { playInterval, playFeedbackChime } from '$lib/audio/playback';
	import { loadStateV4, saveStateV4 } from '$lib/state/storage';
	import type { UserStateV4 } from '$lib/state/schema';

	// ─── Types ────────────────────────────────────────────────────────

	type Stage = 'welcome' | 'quiz' | 'teaser';

	interface QuizQuestion {
		/** Interval ID (for display) */
		id: string;
		name: string;
		semitones: number;
		choices: { id: string; name: string }[];
		correctId: string;
		hintCorrect: boolean;
		msgCorrect: string;
		msgWrong: string;
	}

	// ─── State ────────────────────────────────────────────────────────

	let stage: Stage = $state('welcome');
	let questionIndex = $state(0);
	let selectedId: string | null = $state(null);
	let isCorrect: boolean | null = $state(null);
	let showFeedback = $state(false);
	let feedbackMsg = $state('');
	let answersLocked = $state(false);
	let results: boolean[] = $state([]);

	// ─── Quiz data (hardcoded tutorial) ───────────────────────────────

	const questions: QuizQuestion[] = [
		{
			id: 'P8',
			name: 'Octave',
			semitones: 12,
			choices: [
				{ id: 'P1', name: 'Unison' },
				{ id: 'P5', name: 'Perfect 5th' },
				{ id: 'P8', name: 'Octave' },
				{ id: 'M3', name: 'Major 3rd' },
			],
			correctId: 'P8',
			hintCorrect: true,
			msgCorrect: "That's an Octave — the same note, one pitch higher.",
			msgWrong: "That was an Octave. You'll learn to hear it.",
		},
		{
			id: 'P5',
			name: 'Perfect 5th',
			semitones: 7,
			choices: [
				{ id: 'P4', name: 'Perfect 4th' },
				{ id: 'P5', name: 'Perfect 5th' },
				{ id: 'M3', name: 'Major 3rd' },
				{ id: 'P8', name: 'Octave' },
			],
			correctId: 'P5',
			hintCorrect: false,
			msgCorrect: "You're a natural!",
			msgWrong: 'That was a Perfect 5th. Practice makes perfect.',
		},
	];

	const currentQ = $derived(stage === 'quiz' ? questions[questionIndex] : null);

	// ─── Root note: C4 = MIDI 60 ─────────────────────────────────────

	const ROOT_MIDI = 60;

	// ─── Actions ──────────────────────────────────────────────────────

	async function startQuiz() {
		await ensureResumed();
		stage = 'quiz';
		questionIndex = 0;
		selectedId = null;
		isCorrect = null;
		showFeedback = false;
		answersLocked = false;
		// Small delay then play the first interval
		setTimeout(() => {
			playInterval(ROOT_MIDI, questions[0].semitones, 'ascending', 'epiano');
		}, 400);
	}

	async function handleAnswer(choiceId: string) {
		if (answersLocked || !currentQ) return;
		answersLocked = true;
		selectedId = choiceId;
		const correct = choiceId === currentQ.correctId;
		isCorrect = correct;
		feedbackMsg = correct ? currentQ.msgCorrect : currentQ.msgWrong;
		showFeedback = true;
		results = [...results, correct];

		playFeedbackChime(correct);

		// 2s pause then advance
		setTimeout(() => {
			if (questionIndex < questions.length - 1) {
				// Next question
				questionIndex++;
				selectedId = null;
				isCorrect = null;
				showFeedback = false;
				answersLocked = false;
				setTimeout(() => {
					playInterval(ROOT_MIDI, questions[questionIndex].semitones, 'ascending', 'epiano');
				}, 300);
			} else {
				// Done — show teaser
				stage = 'teaser';
			}
		}, 2000);
	}

	async function handleReplay() {
		if (!currentQ) return;
		await ensureResumed();
		playInterval(ROOT_MIDI, currentQ.semitones, 'ascending', 'epiano');
	}

	function finishFRE() {
		const state = loadStateV4();
		state.settings.hasCompletedFRE = true;
		saveStateV4(state);
		goto(`${base}/`);
	}

	// ─── Redirect if FRE already completed ────────────────────────────

	onMount(() => {
		const state = loadStateV4();
		if (state.settings.hasCompletedFRE) {
			goto(`${base}/`);
		}
	});
</script>

<div class="welcome-page">
	{#if stage === 'welcome'}
		<!-- ─── Stage 1: Welcome ──────────────────────────────────── -->
		<div class="stage welcome-stage">
			<div class="title-block">
				<h1 class="title">EAR<br/><span class="title-accent">TRAINER</span></h1>
			</div>
			<p class="subtitle">Train your ears.<br/>Identify intervals by sound.</p>
			<button class="cta-btn" onclick={startQuiz}>LET'S TRY ONE</button>
		</div>

	{:else if stage === 'quiz' && currentQ}
		<!-- ─── Stage 2: Guided Quiz ──────────────────────────────── -->
		<div class="stage quiz-stage">
			<div class="quiz-header">
				<span class="q-counter">{questionIndex + 1} / {questions.length}</span>
			</div>

			<button class="play-circle" class:feedback-correct={isCorrect === true} class:feedback-wrong={isCorrect === false} onclick={handleReplay} disabled={answersLocked}>
				<span class="play-icon">▶</span>
			</button>

			{#if showFeedback}
				<p class="feedback-msg" class:correct={isCorrect} class:wrong={!isCorrect}>{feedbackMsg}</p>
			{:else}
				<p class="listen-prompt">Listen and pick the interval.</p>
			{/if}

			<div class="answer-grid">
				{#each currentQ.choices as choice}
					{@const isSelected = selectedId === choice.id}
					{@const isAnswer = choice.id === currentQ.correctId}
					{@const showCorrectReveal = showFeedback && isAnswer}
					{@const showWrongReveal = showFeedback && isSelected && !isCorrect}
					<button
						class="answer-btn"
						class:hint={currentQ.hintCorrect && isAnswer && !showFeedback}
						class:correct={showCorrectReveal}
						class:wrong={showWrongReveal}
						class:dimmed={showFeedback && !isAnswer && !isSelected}
						disabled={answersLocked}
						onclick={() => handleAnswer(choice.id)}
					>
						<span class="answer-id">{choice.id}</span>
						<span class="answer-name">{choice.name}</span>
					</button>
				{/each}
			</div>
		</div>

	{:else if stage === 'teaser'}
		<!-- ─── Stage 3: Progress Teaser ──────────────────────────── -->
		<div class="stage teaser-stage">
			<h2 class="teaser-title">NICE WORK</h2>
			<p class="teaser-sub">You just identified 2 intervals.<br/>This is where you'll track your progress.</p>

			<div class="mini-progress">
				{#each questions as q, i}
					<div class="progress-row">
						<span class="progress-id">{q.id}</span>
						<span class="progress-name">{q.name}</span>
						<span class="progress-result" class:pass={results[i]} class:fail={!results[i]}>
							{results[i] ? '✓' : '✗'}
						</span>
					</div>
				{/each}
			</div>

			<p class="teaser-hint">Keep practicing to unlock<br/>chords, scales, and more.</p>

			<button class="cta-btn" onclick={finishFRE}>START PRACTICING</button>
		</div>
	{/if}
</div>

<style>
	/* ─── Layout ──────────────────────────────────────────────────── */
	.welcome-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100%;
	}
	.stage {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 1.5rem;
		width: 100%;
		max-width: 360px;
	}

	/* ─── Stage 1: Welcome ───────────────────────────────────────── */
	.title-block { position: relative; }
	.title {
		font-size: 6.5rem;
		font-weight: 400;
		letter-spacing: 0.05em;
		line-height: 0.7;
		color: var(--text-primary);
		text-transform: uppercase;
		font-family: var(--font-display);
	}
	.title-accent {
		color: var(--accent);
		font-size: 3.5rem;
		letter-spacing: 0.12em;
		font-family: var(--font-display);
	}
	.subtitle {
		font-family: var(--mono);
		font-size: 0.5rem;
		color: var(--text-secondary, #999);
		letter-spacing: 0.08em;
		line-height: 1.6;
		margin-top: 0.5rem;
	}

	/* ─── CTA Button ─────────────────────────────────────────────── */
	.cta-btn {
		font-family: var(--mono);
		font-size: 0.5rem;
		font-weight: 900;
		letter-spacing: 0.15em;
		padding: 1rem 2.5rem;
		background: var(--accent);
		color: var(--base);
		border: none;
		cursor: pointer;
		transition: transform 0.1s, opacity 0.15s;
		margin-top: 1rem;
	}
	.cta-btn:active {
		transform: scale(0.96);
		opacity: 0.9;
	}

	/* ─── Stage 2: Quiz ──────────────────────────────────────────── */
	.quiz-stage {
		gap: 1rem;
	}
	.quiz-header {
		width: 100%;
		display: flex;
		justify-content: center;
	}
	.q-counter {
		font-family: var(--mono);
		font-size: 0.4rem;
		font-weight: 800;
		color: var(--marathon-blue);
		letter-spacing: 0.1em;
		border: 1px solid var(--marathon-blue);
		padding: 0.15rem 0.6rem;
	}

	/* Play circle */
	.play-circle {
		width: 100px;
		height: 100px;
		border-radius: 50%;
		background: transparent;
		border: 1.5px solid var(--accent);
		box-shadow: 0 0 8px rgba(194, 254, 12, 0.3);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
		-webkit-tap-highlight-color: transparent;
	}
	.play-circle:active { transform: scale(0.95); }
	.play-circle.feedback-correct {
		background: var(--correct);
		border-color: var(--correct);
		box-shadow: 0 0 12px var(--correct);
	}
	.play-circle.feedback-wrong {
		background: var(--hot);
		border-color: var(--hot);
		box-shadow: 0 0 12px var(--hot);
	}
	.play-icon {
		font-size: 1.5rem;
		color: var(--accent);
		margin-left: 3px; /* optical centering */
	}
	.play-circle.feedback-correct .play-icon,
	.play-circle.feedback-wrong .play-icon {
		color: var(--base);
	}

	/* Prompt & feedback text */
	.listen-prompt {
		font-family: var(--mono);
		font-size: 0.4rem;
		color: var(--text-secondary, #999);
		letter-spacing: 0.08em;
		min-height: 2.5rem;
	}
	.feedback-msg {
		font-family: var(--mono);
		font-size: 0.4rem;
		letter-spacing: 0.06em;
		line-height: 1.5;
		min-height: 2.5rem;
		padding: 0 0.5rem;
	}
	.feedback-msg.correct { color: var(--correct); }
	.feedback-msg.wrong { color: var(--hot); }

	/* ─── Answer Grid ────────────────────────────────────────────── */
	.answer-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
		width: 100%;
	}
	.answer-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.2rem;
		padding: 0.8rem 0.5rem;
		background: var(--surface);
		border: 1px solid var(--border-heavy, #333);
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s, opacity 0.15s;
		-webkit-tap-highlight-color: transparent;
	}
	.answer-btn:active:not(:disabled) {
		background: var(--surface-raised);
	}
	.answer-btn.hint {
		border-color: rgba(194, 254, 12, 0.3);
	}
	.answer-btn.correct {
		background: rgba(194, 254, 12, 0.12);
		border-color: var(--correct);
	}
	.answer-btn.wrong {
		background: rgba(237, 23, 79, 0.12);
		border-color: var(--hot);
	}
	.answer-btn.dimmed {
		opacity: 0.35;
	}
	.answer-btn:disabled {
		cursor: default;
	}
	.answer-id {
		font-family: var(--mono);
		font-size: 1.2rem;
		font-weight: 900;
		color: var(--text-primary);
		letter-spacing: 0.02em;
		line-height: 1;
	}
	.answer-name {
		font-family: var(--mono);
		font-size: 0.35rem;
		color: var(--text-secondary, #999);
		letter-spacing: 0.06em;
	}

	/* ─── Stage 3: Teaser ────────────────────────────────────────── */
	.teaser-stage {
		gap: 1.25rem;
	}
	.teaser-title {
		font-family: var(--font-display);
		font-size: 4rem;
		font-weight: 400;
		letter-spacing: 0.08em;
		color: var(--accent);
		line-height: 1;
	}
	.teaser-sub {
		font-family: var(--mono);
		font-size: 0.45rem;
		color: var(--text-secondary, #999);
		letter-spacing: 0.06em;
		line-height: 1.6;
	}

	/* Mini progress display */
	.mini-progress {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		width: 100%;
		max-width: 260px;
		padding: 0.75rem 1rem;
		border: 1px solid var(--border-heavy, #333);
		background: var(--surface);
	}
	.progress-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-family: var(--mono);
		font-size: 0.45rem;
	}
	.progress-id {
		font-weight: 900;
		color: var(--text-primary);
		width: 2rem;
		text-align: left;
	}
	.progress-name {
		flex: 1;
		color: var(--text-secondary, #999);
		text-align: left;
		letter-spacing: 0.04em;
	}
	.progress-result {
		font-weight: 900;
		font-size: 0.55rem;
	}
	.progress-result.pass { color: var(--correct); }
	.progress-result.fail { color: var(--hot); }

	.teaser-hint {
		font-family: var(--mono);
		font-size: 0.4rem;
		color: var(--text-secondary, #999);
		letter-spacing: 0.06em;
		line-height: 1.6;
	}

	/* ─── Desktop ────────────────────────────────────────────────── */
	@media (min-width: 768px) {
		.title { font-size: 8rem; }
		.title-accent { font-size: 4.5rem; }
		.stage { max-width: 440px; }
		.play-circle { width: 120px; height: 120px; }
		.play-icon { font-size: 1.8rem; }
		.teaser-title { font-size: 5rem; }
	}
</style>
