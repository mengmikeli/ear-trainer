<script lang="ts">
	import { onDestroy } from 'svelte';
	import {
		playInterval, playChord, playScale,
		startDrone, stopDrone, playFeedbackChime,
	} from '$lib/audio';
	import {
		type ContentItem, type ContentStats,
		getItemDisplayName, getItemLabel,
		defaultContentStats,
	} from '$lib/adaptive';
	import { getConnectionDescription, CURATED_CONNECTIONS } from '$lib/connections';
	import { INTERVALS } from '$lib/intervals';
	import { CHORDS, applyInversion } from '$lib/chords';
	import { SCALES } from '$lib/scales';
	import { MODES } from '$lib/modes';
	import type { UserState, ToneType, ChordVoicing } from '$lib/types';
	import type { DroneHandle } from '$lib/audio';

	interface Props {
		item: ContentItem;
		neighbor: ContentItem | null;
		state: UserState;
		onComplete: (correct: boolean) => void;
	}

	let { item, neighbor, state, onComplete }: Props = $props();

	// Step: 1=hear, 2=compare, 3=quiz, 4=done
	let step = $state(1);
	let isPlaying = $state(false);
	let abSelection: 'item' | 'neighbor' | null = $state(null);
	let quizAnswer: 'correct' | 'wrong' | null = $state(null);
	let retries = $state(0);
	let quizTarget: 'item' | 'neighbor' = $state('item');
	let quizPlayed = $state(false);
	let drone: DroneHandle | null = $state(null);

	const MAX_RETRIES = 2;

	// Root note for consistent playback across steps
	const rootNote = $derived.by(() => {
		if (item.kind === 'mode') {
			return 48 + Math.floor(Math.random() * 13);
		}
		if (item.kind === 'interval') {
			const def = INTERVALS.find(i => i.id === item.defId);
			const semitones = def?.semitones ?? 7;
			return 48 + Math.floor(Math.random() * (84 - 48 - semitones));
		}
		if (item.kind === 'chord') {
			const def = CHORDS.find(c => c.id === item.defId);
			const maxSemitone = Math.max(...(def?.intervals ?? [7]));
			return 48 + Math.floor(Math.random() * Math.max(1, 72 - 48 - maxSemitone));
		}
		if (item.kind === 'scale') {
			const def = SCALES.find(s => s.id === item.defId);
			const highestInterval = Math.max(...(def?.intervals ?? [12]));
			return 48 + Math.floor(Math.random() * Math.max(1, 72 - 48 - highestInterval));
		}
		return 60;
	});

	const itemName = $derived(getItemDisplayName(item));
	const itemLabel = $derived(getItemLabel(item));
	const neighborName = $derived(neighbor ? getItemDisplayName(neighbor) : '');
	const neighborLabel = $derived(neighbor ? getItemLabel(neighbor) : '');

	// Connection description between item and neighbor
	const connectionText = $derived.by(() => {
		if (!neighbor) return null;
		const desc = getConnectionDescription(item.id, neighbor.id);
		if (desc) return desc;
		// Try with just kind:defId prefix
		const fromPrefix = `${item.kind}:${item.defId}`;
		const toPrefix = `${neighbor.kind}:${neighbor.defId}`;
		for (const conn of CURATED_CONNECTIONS) {
			if (
				(conn.from === fromPrefix && conn.to === toPrefix) ||
				(conn.from === toPrefix && conn.to === fromPrefix)
			) {
				return conn.description;
			}
		}
		return null;
	});

	const toneType: ToneType = $derived(state.settings.toneType);
	const SCALE_TEMPO = 150;
	const MODE_TEMPO = 180;

	// If no neighbor, skip compare step (go 1 → 3, or 1 → 4 for cold start first item)
	const skipCompare = $derived(!neighbor);
	// For the very first item in cold start, skip quiz too (just hear + done)
	const skipQuiz = $derived(!neighbor);

	function playItem(target: ContentItem) {
		isPlaying = true;
		const kind = target.kind;
		const defId = target.defId;

		if (kind === 'interval') {
			const def = INTERVALS.find(i => i.id === defId)!;
			const mode = (target.variant as 'ascending' | 'descending' | 'harmonic') ?? 'ascending';
			playInterval(rootNote, def.semitones, mode, toneType);
			setTimeout(() => { isPlaying = false; }, 1500);
		} else if (kind === 'chord') {
			const def = CHORDS.find(c => c.id === defId)!;
			const voicing = (target.variant as ChordVoicing) ?? 'root';
			playChord(rootNote, def.intervals, voicing, toneType);
			setTimeout(() => { isPlaying = false; }, 1500);
		} else if (kind === 'scale') {
			const def = SCALES.find(s => s.id === defId)!;
			playScale(rootNote, def.intervals, toneType, SCALE_TEMPO);
			setTimeout(() => { isPlaying = false; }, def.intervals.length * SCALE_TEMPO + 400);
		} else if (kind === 'mode') {
			const def = MODES.find(m => m.id === defId)!;
			// Ensure drone is running for modes
			if (!drone) {
				startDrone(rootNote).then(h => { drone = h; });
			}
			playScale(rootNote, def.intervals, toneType, MODE_TEMPO);
			setTimeout(() => { isPlaying = false; }, def.intervals.length * MODE_TEMPO + 400);
		}
	}

	function handleHearIt() {
		playItem(item);
	}

	function handleCompareA() {
		abSelection = 'item';
		playItem(item);
	}

	function handleCompareB() {
		if (!neighbor) return;
		abSelection = 'neighbor';
		playItem(neighbor);
	}

	function handleHearBoth() {
		if (!neighbor) return;
		playItem(item);
		const delay = item.kind === 'scale' || item.kind === 'mode' ? 2000 : 1600;
		setTimeout(() => {
			playItem(neighbor);
		}, delay);
	}

	function startQuiz() {
		quizTarget = Math.random() > 0.5 ? 'item' : 'neighbor';
		quizPlayed = false;
		quizAnswer = null;
	}

	function playQuizAudio() {
		const target = quizTarget === 'item' ? item : neighbor!;
		playItem(target);
		quizPlayed = true;
	}

	function submitQuizAnswer(answer: 'item' | 'neighbor') {
		const correct = answer === quizTarget;
		if (correct) {
			quizAnswer = 'correct';
			playFeedbackChime(true);
			setTimeout(() => {
				step = 4;
				setTimeout(() => onComplete(true), 1500);
			}, 800);
		} else {
			quizAnswer = 'wrong';
			playFeedbackChime(false);
			retries++;
			if (retries >= MAX_RETRIES) {
				// Exhausted retries → record as incorrect
				setTimeout(() => {
					step = 4;
					setTimeout(() => onComplete(false), 1500);
				}, 800);
			} else {
				// Allow retry
				setTimeout(() => {
					quizAnswer = null;
					quizTarget = Math.random() > 0.5 ? 'item' : 'neighbor';
					quizPlayed = false;
				}, 1200);
			}
		}
	}

	function advanceStep() {
		if (step === 1) {
			if (skipCompare) {
				if (skipQuiz) {
					// Cold start first item — just mark done
					step = 4;
					setTimeout(() => onComplete(true), 1500);
				} else {
					step = 3;
					startQuiz();
				}
			} else {
				step = 2;
			}
		} else if (step === 2) {
			step = 3;
			startQuiz();
		}
	}

	onDestroy(() => {
		if (drone) {
			stopDrone();
			drone = null;
		}
	});
</script>

<div class="learn-card">
	<div class="learn-header">
		<span class="learn-badge">LEARN</span>
		<span class="learn-step">{step}/{skipCompare ? (skipQuiz ? 2 : 3) : 4}</span>
	</div>

	{#if step === 1}
		<!-- Step 1: Hear It -->
		<div class="learn-body">
			<div class="new-badge">NEW</div>
			<div class="item-label">{itemLabel}</div>
			<div class="item-name">{itemName}</div>
			{#if item.variant}
				<div class="item-variant">{item.variant}</div>
			{/if}
			<div class="learn-actions">
				<button class="learn-btn primary" onclick={handleHearIt} disabled={isPlaying}>
					{isPlaying ? '···' : '▶ HEAR IT'}
				</button>
			</div>
			<button class="learn-btn advance" onclick={advanceStep}>
				NEXT →
			</button>
		</div>

	{:else if step === 2}
		<!-- Step 2: Compare -->
		<div class="learn-body compare-body">
			<div class="compare-label">COMPARE</div>
			<div class="ab-grid">
				<button
					class="ab-btn"
					class:ab-active={abSelection === 'item'}
					onclick={handleCompareA}
					disabled={isPlaying}
				>
					<span class="ab-letter">A</span>
					<span class="ab-item-label">{itemLabel}</span>
					<span class="ab-item-name">{itemName}</span>
				</button>
				<button
					class="ab-btn"
					class:ab-active={abSelection === 'neighbor'}
					onclick={handleCompareB}
					disabled={isPlaying}
				>
					<span class="ab-letter">B</span>
					<span class="ab-item-label">{neighborLabel}</span>
					<span class="ab-item-name">{neighborName}</span>
				</button>
			</div>
			{#if connectionText}
				<div class="connection-text">{connectionText}</div>
			{/if}
			<div class="learn-actions">
				<button class="learn-btn secondary" onclick={handleHearBoth} disabled={isPlaying}>
					HEAR BOTH
				</button>
			</div>
			<button class="learn-btn advance" onclick={advanceStep}>
				NEXT →
			</button>
		</div>

	{:else if step === 3}
		<!-- Step 3: Quick Quiz -->
		<div class="learn-body">
			<div class="quiz-prompt">WHICH ONE IS</div>
			<div class="quiz-target-label">{itemLabel}</div>
			<div class="quiz-target-name">{itemName}?</div>

			<div class="learn-actions">
				<button class="learn-btn secondary" onclick={playQuizAudio} disabled={isPlaying}>
					{quizPlayed ? '↻ REPLAY' : '▶ PLAY'}
				</button>
			</div>

			{#if quizPlayed}
				<div class="quiz-choices">
					<button
						class="quiz-choice"
						class:quiz-correct={quizAnswer === 'correct' && true}
						class:quiz-wrong={quizAnswer === 'wrong' && true}
						onclick={() => submitQuizAnswer('item')}
						disabled={quizAnswer !== null}
					>
						<span class="choice-label">{itemLabel}</span>
						<span class="choice-name">{itemName}</span>
					</button>
					<button
						class="quiz-choice"
						class:quiz-correct={quizAnswer === 'correct' && false}
						class:quiz-wrong={quizAnswer === 'wrong' && false}
						onclick={() => submitQuizAnswer('neighbor')}
						disabled={quizAnswer !== null}
					>
						<span class="choice-label">{neighborLabel}</span>
						<span class="choice-name">{neighborName}</span>
					</button>
				</div>
			{/if}

			{#if retries > 0 && quizAnswer === null}
				<div class="retry-hint">Try again ({MAX_RETRIES - retries} left)</div>
			{/if}
		</div>

	{:else if step === 4}
		<!-- Step 4: Got It -->
		<div class="learn-body done-body">
			<div class="done-check">{'\uE018'}</div>
			<div class="item-label">{itemLabel}</div>
			<div class="done-text">UNLOCKED</div>
			<div class="done-subtext">Now entering quiz rotation</div>
		</div>
	{/if}
</div>

<style>
	.learn-card {
		width: 100%;
		max-width: 400px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.learn-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--border-heavy);
		margin-bottom: 1.5rem;
	}

	.learn-badge {
		font-family: var(--mono);
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		color: var(--marathon-blue);
		background: rgba(58, 44, 255, 0.1);
		padding: 0.2rem 0.6rem;
	}

	.learn-step {
		font-family: var(--mono);
		font-size: 0.6rem;
		color: var(--text-secondary);
		letter-spacing: 0.1em;
	}

	.learn-body {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 0 1rem;
	}

	.new-badge {
		font-family: var(--mono);
		font-size: 0.5rem;
		font-weight: 700;
		letter-spacing: 0.3em;
		color: var(--accent);
		opacity: 0.6;
	}

	.item-label {
		font-family: 'BPdots', var(--mono);
		font-size: 4rem;
		font-weight: 900;
		color: var(--accent);
		line-height: 1;
		letter-spacing: -0.02em;
	}

	.item-name {
		font-family: var(--font-display);
		font-size: 0.9rem;
		color: var(--text-secondary);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.item-variant {
		font-family: var(--mono);
		font-size: 0.55rem;
		color: var(--text-secondary);
		opacity: 0.5;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}

	.learn-actions {
		display: flex;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	.learn-btn {
		font-family: var(--mono);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		padding: 0.75rem 1.5rem;
		border: 1px solid var(--border-heavy);
		background: var(--surface);
		color: var(--text-primary);
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
	}

	.learn-btn:not(:disabled):active {
		background: var(--surface-raised);
		border-color: var(--accent);
	}

	.learn-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.learn-btn.primary {
		border-color: var(--accent);
		color: var(--accent);
	}

	.learn-btn.secondary {
		border-color: var(--border-heavy);
		color: var(--text-primary);
	}

	.learn-btn.advance {
		margin-top: 1rem;
		border: none;
		background: none;
		color: var(--text-secondary);
		font-size: 0.65rem;
		letter-spacing: 0.15em;
		padding: 0.5rem 1rem;
	}

	.learn-btn.advance:active {
		color: var(--accent);
		background: none;
	}

	/* Step 2: Compare */
	.compare-body { gap: 1.25rem; }

	.compare-label {
		font-family: var(--mono);
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.25em;
		color: var(--text-secondary);
	}

	.ab-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		width: 100%;
	}

	.ab-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		padding: 1.25rem 0.5rem;
		background: var(--surface);
		border: 1px solid var(--border-heavy);
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
	}

	.ab-btn:active {
		background: var(--surface-raised);
	}

	.ab-btn.ab-active {
		border-color: var(--accent);
		background: var(--accent-dim);
	}

	.ab-letter {
		font-family: var(--mono);
		font-size: 0.5rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		color: var(--text-secondary);
		opacity: 0.5;
	}

	.ab-item-label {
		font-family: 'BPdots', var(--mono);
		font-size: 2rem;
		font-weight: 900;
		color: var(--accent);
		line-height: 1;
	}

	.ab-item-name {
		font-size: 0.6rem;
		color: var(--text-secondary);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		font-family: var(--font-display);
	}

	.connection-text {
		font-family: var(--mono);
		font-size: 0.6rem;
		color: var(--marathon-blue);
		letter-spacing: 0.05em;
		text-align: center;
		padding: 0.5rem;
		border-left: 2px solid rgba(58, 44, 255, 0.3);
	}

	/* Step 3: Quiz */
	.quiz-prompt {
		font-family: var(--mono);
		font-size: 0.55rem;
		font-weight: 700;
		letter-spacing: 0.25em;
		color: var(--text-secondary);
	}

	.quiz-target-label {
		font-family: 'BPdots', var(--mono);
		font-size: 3rem;
		font-weight: 900;
		color: var(--accent);
		line-height: 1;
	}

	.quiz-target-name {
		font-family: var(--font-display);
		font-size: 0.85rem;
		color: var(--text-secondary);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.quiz-choices {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		width: 100%;
		margin-top: 0.5rem;
	}

	.quiz-choice {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		padding: 1.25rem 0.5rem;
		background: var(--surface);
		border: 1px solid var(--border-heavy);
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
	}

	.quiz-choice:not(:disabled):active {
		background: var(--surface-raised);
		border-color: var(--accent);
	}

	.quiz-choice:disabled {
		cursor: not-allowed;
	}

	.quiz-choice.quiz-correct {
		border-color: var(--correct);
		background: #C2FE0C10;
	}

	.quiz-choice.quiz-wrong {
		border-color: var(--wrong);
		background: #ED174F10;
	}

	.choice-label {
		font-family: 'BPdots', var(--mono);
		font-size: 1.5rem;
		font-weight: 900;
		color: var(--accent);
		line-height: 1;
	}

	.choice-name {
		font-size: 0.55rem;
		color: var(--text-secondary);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		font-family: var(--font-display);
	}

	.retry-hint {
		font-family: var(--mono);
		font-size: 0.55rem;
		color: var(--hot);
		letter-spacing: 0.1em;
	}

	/* Step 4: Done */
	.done-body {
		gap: 0.75rem;
		padding-top: 2rem;
	}

	.done-check {
		font-family: var(--mono);
		font-size: 2.5rem;
		color: var(--correct);
		line-height: 1;
	}

	.done-text {
		font-family: var(--mono);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.3em;
		color: var(--correct);
	}

	.done-subtext {
		font-family: var(--font);
		font-size: 0.65rem;
		color: var(--text-secondary);
		letter-spacing: 0.05em;
	}
</style>
