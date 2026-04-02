<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { createQuizController } from '$lib/quiz/controller.svelte';
	import type { QuizSessionConfig, QuestionResult } from '$lib/quiz/types';
	import type { UserStateV4 } from '$lib/state/schema';
	import { isAudioReady, resetContext } from '$lib/audio/context';
	import { saveStateV4 } from '$lib/state/storage';
	import AnswerGrid from './AnswerGrid.svelte';
	import ProgressBar from './ProgressBar.svelte';
	import TelemetryBar from './TelemetryBar.svelte';
	import VizQuizLayout from './VizQuizLayout.svelte';
	import TickerBanner from './TickerBanner.svelte';

	let { config, initialState }: { config: QuizSessionConfig; initialState?: UserStateV4 } = $props();

	// ── Wrap config.playAudio to capture note schedule ─────────────────
	let playingNotes: number[] = $state([]);
	let noteTimeouts: ReturnType<typeof setTimeout>[] = [];

	function clearNoteTimeouts() {
		noteTimeouts.forEach(clearTimeout);
		noteTimeouts = [];
	}

	function scheduleNotesSync(q: typeof ctrl.question) {
		if (!q) return;
		clearNoteTimeouts();

		const root = q.rootNote;
		const pb = q.playback;

		if (pb.type === 'interval') {
			const semitones = pb.intervals[0];
			const secondMidi = pb.direction === 'descending' ? root - semitones : root + semitones;
			const isHarmonic = pb.direction === 'harmonic';

			if (isHarmonic) {
				playingNotes = [root, secondMidi];
				triggerBounce(true);
			} else {
				playingNotes = [root];
				triggerBounce();
				const gap = pb.toneType === 'piano' ? 0.3 : 0.15;
				const secondDelay = (0.6 + gap) * 1000;
				noteTimeouts.push(setTimeout(() => {
					playingNotes = [secondMidi];
					triggerBounce();
				}, secondDelay));
			}
			const totalMs = isHarmonic ? 1200 : (0.6 * 2 + (pb.toneType === 'piano' ? 0.3 : 0.15)) * 1000 + 200;
			noteTimeouts.push(setTimeout(() => { playingNotes = []; }, totalMs));

		} else if (pb.type === 'chord') {
			const midis = pb.intervals.map((s: number) => root + s);
			if (pb.arpeggiated) {
				midis.forEach((midi: number, i: number) => {
					noteTimeouts.push(setTimeout(() => {
						playingNotes = midis.slice(0, i + 1);
						triggerBounce();
					}, i * 150));
				});
				const totalMs = midis.length * 150 + 800 + 200;
				noteTimeouts.push(setTimeout(() => { playingNotes = []; }, totalMs));
			} else {
				playingNotes = midis;
				triggerBounce(true);
				noteTimeouts.push(setTimeout(() => { playingNotes = []; }, 1400));
			}

		} else if (pb.type === 'scale') {
			const tempo = pb.tempo ?? 150;
			// No offset needed — playAudio already handles drone lead-in internally
			pb.intervals.forEach((semitone: number, i: number) => {
				noteTimeouts.push(setTimeout(() => {
					playingNotes = [root + semitone];
					triggerBounce();
				}, i * tempo));
			});
			const totalMs = pb.intervals.length * tempo + 200;
			noteTimeouts.push(setTimeout(() => { playingNotes = []; }, totalMs));
		}
	}

	// Capture props at init time (they won't change for the session lifetime)
	const sessionConfig = config;
	const sessionInitialState = initialState;

	const wrappedConfig: QuizSessionConfig = {
		...sessionConfig,
		async playAudio(q, s) {
			const info = await sessionConfig.playAudio(q, s);
			scheduleNotesSync(q);
			return info;
		},
	};

	const ctrl = createQuizController(wrappedConfig, sessionInitialState);

	// ── VizQuizLayout mode + props derived from question ──────────────
	const vizMode = $derived.by((): 'interval' | 'chord' | 'scale' => {
		if (!ctrl.question) return 'interval';
		if (ctrl.question.kind === 'chord') return 'chord';
		if (ctrl.question.kind === 'scale' || ctrl.question.kind === 'mode') return 'scale';
		return 'interval';
	});
	const vizSemitones = $derived(ctrl.question?.kind === 'interval' ? (ctrl.question.playback.intervals[0] ?? 0) : 0);
	const vizChordIntervals = $derived(ctrl.question?.kind === 'chord' ? ctrl.question.playback.intervals : undefined);
	const vizScaleIntervals = $derived(
		ctrl.question?.kind === 'scale' || ctrl.question?.kind === 'mode'
			? ctrl.question.playback.intervals
			: undefined
	);

	// ── Extra controls reactivity ─────────────────────────────────────
	let extraControlTick = $state(0);

	// ── Mode icon for top controls ────────────────────────────────────
	const modeGlyph: Record<string, string> = {
		ascending: '\uE007',
		descending: '\uE008',
		harmonic: '\uE000',
	};
	const modeIcon = $derived.by((): string => {
		if (!ctrl.question) return '';
		if (ctrl.question.kind === 'interval') {
			const pm = ctrl.question.playback.direction;
			return pm ? (modeGlyph[pm] ?? '') : '';
		}
		if (ctrl.question.kind === 'chord') {
			const v = ctrl.question.playback.voicing;
			const labels: Record<string, string> = { root: 'ROOT', first: 'INV1', second: 'INV2' };
			return v ? (labels[v] ?? '') : '';
		}
		return '';
	});

	// ── Bounce animation (physics-based damped oscillation) ───────────
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

	// ── Glitch text effect ────────────────────────────────────────────
	const glitchChars = ['\uE000', '\uE001', '\uE002', '\uE003', '\uE004', '\uE005', '\uE006', '\uE007', '\uE008', '\uE010', '\uE017'];
	let glitchText = $state('');
	let glitchStartTime = 0;

	const feedbackState = $derived.by((): 'correct' | 'wrong' | null => {
		if (ctrl.phase === 'feedback_correct') return 'correct';
		if (ctrl.phase === 'feedback_wrong' || ctrl.phase === 'result_mode') return 'wrong';
		return null;
	});
	const inResultMode = $derived(ctrl.phase === 'result_mode');

	$effect(() => {
		const shouldGlitch = ctrl.isGlitching || feedbackState === 'wrong' || feedbackState === 'correct' || ctrl.needsTap;
		if (shouldGlitch) {
			glitchStartTime = Date.now();
			const realText = `Q${ctrl.questionNum}`;
			const id = setInterval(() => {
				if (ctrl.needsTap) {
					const len = 1 + Math.floor(Math.random() * 3);
					let t = '';
					for (let i = 0; i < len; i++) t += glitchChars[Math.floor(Math.random() * glitchChars.length)];
					glitchText = t;
					return;
				}
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
	const showGlitch = $derived(ctrl.isGlitching || feedbackState === 'wrong' || feedbackState === 'correct' || ctrl.needsTap);
	const displayText = $derived(glitchText || `Q${ctrl.questionNum}`);

	// ── FRE guidance overlay (sticky capture system) ─────────────────
	// The config's getGuidanceMessage is a pure function of controller state.
	// We "capture" its output into $state so the terminal stays visible
	// until the user explicitly taps to dismiss — even if the underlying
	// controller state changes (e.g. auto-play changing phase).
	const isFRE = $derived(!!sessionConfig.freMode);

	// What the config wants to show right now (reactive, may flicker)
	const rawGuidanceMsg = $derived.by((): string | null => {
		if (!sessionConfig.getGuidanceMessage) return null;
		const correct = feedbackState === 'correct' ? true : feedbackState === 'wrong' ? false : undefined;
		return sessionConfig.getGuidanceMessage(ctrl.questionNum, ctrl.phase, correct);
	});

	// Sticky captured state — holds until dismissed
	let capturedMsg: string | null = $state(null);
	let capturedBoot = $state(false);
	let capturedLines: string[] = $state([]);
	let dismissedKey = ''; // prevents re-capture of same (questionNum:phase) after dismiss

	// Capture new guidance messages when nothing is currently showing
	$effect(() => {
		const msg = rawGuidanceMsg;
		const key = `${ctrl.questionNum}:${ctrl.phase}`;
		if (isFRE && msg && !capturedMsg && key !== dismissedKey) {
			capturedMsg = msg;
			capturedBoot = msg.startsWith('BOOT:');
			const text = capturedBoot ? msg.slice(5) : msg;
			capturedLines = text.split('\n');

			// Pause auto-advance for feedback phases
			if (ctrl.phase === 'feedback_correct' || ctrl.phase === 'feedback_wrong' || ctrl.phase === 'result_mode') {
				ctrl.pauseAutoAdvance();
			}
		}
	});

	const showTerminal = $derived(capturedMsg !== null);
	// Block answer grid only during pre-play overlays (boot/idle), NOT during feedback
	const isFeedbackOverlay = $derived(
		ctrl.phase === 'feedback_correct' || ctrl.phase === 'feedback_wrong' || ctrl.phase === 'result_mode'
	);
	const answersBlocked = $derived(isFRE && showTerminal && !isFeedbackOverlay);

	// Dismiss terminal → trigger the appropriate next action synchronously
	// (synchronous so Svelte batches the state change with the controller
	//  mutation, preventing the old message from being re-captured)
	function dismissGuidance() {
		const wasBoot = capturedBoot;
		const phase = ctrl.phase;
		dismissedKey = `${ctrl.questionNum}:${ctrl.phase}`;
		capturedMsg = null;
		capturedLines = [];
		capturedBoot = false;

		if (phase === 'idle' || wasBoot) {
			// After boot/idle guidance: play the question
			handlePlay();
		} else if (phase === 'feedback_correct' || phase === 'feedback_wrong' || phase === 'result_mode') {
			// After feedback guidance: advance to next question (or finish)
			handleNextQuestion();
		}
	}


	// ── Lifecycle ─────────────────────────────────────────────────────
	onMount(() => {
		ctrl.nextQuestion();

		// On foreground return: reset audio only after long background (≥15s).
		// Short resumes (quick app switch) work fine — iOS keeps the context alive.
		// Long resumes (≥30s) cause iOS to silently kill audio output even though
		// ctx.state reports 'running'. 15s threshold is conservative.
		let backgroundedAt = 0;
		const BACKGROUND_THRESHOLD_MS = 15_000;

		const onVisible = () => {
			if (document.hidden) {
				backgroundedAt = Date.now();
			} else if (backgroundedAt > 0) {
				const elapsed = Date.now() - backgroundedAt;
				backgroundedAt = 0;
				if (elapsed >= BACKGROUND_THRESHOLD_MS) {
					resetContext();
					ctrl.forceNeedsTap();
					extraControlTick++;
				}
			}
		};
		document.addEventListener('visibilitychange', onVisible);

		return () => {
			document.removeEventListener('visibilitychange', onVisible);
			clearNoteTimeouts();
			ctrl.cleanup();
		};
	});

	// ── Actions ───────────────────────────────────────────────────────
	function handlePlay() {
		ctrl.play();
	}

	function handleReplayInResult() {
		ctrl.replayInResult();
	}

	function handleSelectAnswer(choice: { id: string; name: string }) {
		ctrl.selectAnswer(choice.id);
	}

	function handleSkipCorrect() {
		ctrl.skipCorrect();
	}

	function handleNextQuestion() {
		ctrl.nextQuestion();
	}

	function handleRestart() {
		clearNoteTimeouts();
		playingNotes = [];
		ctrl.restartQuiz();
	}

	function handleEndEarly() {
		clearNoteTimeouts();
		// In FRE mode: "exit" means "skip onboarding" — mark complete so it doesn't restart
		if (isFRE) {
			const state = ctrl.userState;
			state.settings.hasCompletedFRE = true;
			saveStateV4(state);
		}
		ctrl.endEarly();
		goto(`${base}/`);
	}

	function handleTransitionEnd() {}

	// ── Replay missed in debrief ──────────────────────────────────────
	let replayingIndex: number | null = $state(null);
	function replayMissed(r: QuestionResult, idx: number) {
		if (replayingIndex !== null) return;
		replayingIndex = idx;
		sessionConfig.playAudio(r.question, ctrl.userState).then((info) => {
			setTimeout(() => { replayingIndex = null; }, info.durationMs);
		}).catch(() => { replayingIndex = null; });
	}

	// ── Debrief derived data ──────────────────────────────────────────
	const debriefSections = $derived(
		sessionConfig.formatDebrief ? sessionConfig.formatDebrief(ctrl.results, ctrl.userState) : []
	);
</script>

{#if ctrl.phase === 'debrief'}
{#if isFRE}
<!-- FRE conclusion — terminal-style calibration complete screen -->
<div class="summary fre-conclusion">
	<div class="fre-terminal">
		<span class="corner-mark tl">+</span>
		<span class="corner-mark tr">+</span>
		<span class="corner-mark bl">+</span>
		<span class="corner-mark br">+</span>

		<div class="fre-score">{ctrl.sessionCorrect}/{ctrl.results.length}</div>

		<div class="terminal-line" style="animation-delay: 200ms">
			<span class="terminal-prompt">&gt;</span> CALIBRATION COMPLETE
		</div>
		<div class="terminal-line terminal-blank" style="animation-delay: 350ms"></div>
		<div class="terminal-line" style="animation-delay: 500ms">
			<span class="terminal-prompt">&gt;</span> {ctrl.results.length} INTERVALS ANALYZED
		</div>
		<div class="terminal-line" style="animation-delay: 650ms">
			<span class="terminal-prompt">&gt;</span> ACCURACY: {ctrl.summaryAccuracy}%
		</div>
		<div class="terminal-line terminal-blank" style="animation-delay: 800ms"></div>
		<div class="terminal-line" style="animation-delay: 950ms">
			<span class="terminal-prompt">&gt;</span> NEURAL LINK ESTABLISHED
		</div>
		<div class="terminal-line" style="animation-delay: 1100ms">
			<span class="terminal-prompt">&gt;</span> ALL SYSTEMS OPERATIONAL
		</div>
	</div>

	<div class="summary-actions fre-actions">
		<button class="action-btn primary" onclick={() => goto(`${base}/`)}>BEGIN TRAINING</button>
	</div>
</div>
{:else}
<div class="summary">
	<h2 class="heading">DEBRIEF</h2>

	<div class="debrief-panels">
		<div class="debrief-stats">
			<div class="score-block">
				<span class="score-big">{ctrl.sessionCorrect}/{ctrl.results.length}</span>
			</div>

			<TelemetryBar segments={[
				{ label: 'ACC', value: ctrl.summaryAccuracy + '%' },
				{ label: 'STK', value: ctrl.userState.globalStats.currentStreak },
				{ label: 'SES', value: ctrl.userState.globalStats.totalSessions },
			]} />

			{#each debriefSections as section}
				<div class="section-label">{section.label}</div>
				<div class="mode-rows">
					{#each section.items as row}
						<div class="mode-row">
							<span class="mode-glyph">{row.label}</span>
							<span class="mode-stat">{row.value}</span>
						</div>
					{/each}
				</div>
			{/each}
		</div>

		<div class="debrief-missed">
			{#if ctrl.wrongAnswers.length > 0}
				<div class="section-label missed-label">MISSED</div>
				<div class="missed-list">
					{#each ctrl.wrongAnswers as r, i}
						<button class="missed-card" class:replaying={replayingIndex === i} onclick={() => replayMissed(r, i)}>
							<div class="missed-card-fill" style="width: 0%"></div>
							<div class="missed-card-content">
								<span class="missed-id">{r.question.correctAnswer.label}</span>
								<div class="missed-info">
									<span class="missed-name">{r.question.correctAnswer.name}</span>
									<span class="missed-detail">answered {r.selectedId}</span>
								</div>
							</div>
						</button>
					{/each}
				</div>
			{:else}
				<div class="perfect">PERFECT SESSION</div>
			{/if}
		</div>
	</div>

	<div class="summary-actions">
		<button class="action-btn primary" onclick={handleRestart}>AGAIN</button>
		<button class="action-btn" onclick={() => goto(`${base}/`)}>HOME</button>
	</div>
</div>
{/if}
{:else}
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="quiz" onclick={() => { if (ctrl.needsTap) handlePlay(); }}>
	{#if ctrl.needsTap}
		<TickerBanner message="NEURAL LINK OFFLINE -- TAP TO RECONNECT" onclick={() => handlePlay()} />
	{/if}
	<h2 class="heading">{sessionConfig.heading}</h2>
	<div class="top">
		<div class="bar-track-full">
			<ProgressBar current={ctrl.questionNum} total={ctrl.totalQuestions} />
		</div>
		<div class="top-controls">
			<button class="close exit" onclick={handleEndEarly}>EXIT</button>
			<span class="mode-icon">{modeIcon}</span>
			<div class="top-right">
				{#each sessionConfig.extraControls ?? [] as ec}
					<button class="extra-toggle" class:active={(void extraControlTick, ec.getState())} onclick={() => { ec.toggle(); extraControlTick++; }}>
						{void extraControlTick, ec.getLabel()}
					</button>
				{/each}
				<span class="counter">{String(ctrl.questionNum).padStart(2, '0')}/{String(ctrl.totalQuestions).padStart(2, '0')}</span>
			</div>
		</div>
	</div>

	{#if ctrl.question}
		<div class="quiz-panels">
		<VizQuizLayout
			mode={vizMode}
			phase={ctrl.vizPhase}
			semitones={vizSemitones}
			chordIntervals={vizChordIntervals}
			scaleIntervals={vizScaleIntervals}
			countdownPct={ctrl.hasPlayed && inResultMode ? ctrl.countdownPct : -1}
			ontransitionend={handleTransitionEnd}
			{playingNotes}
		>
			{#if showTerminal}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="terminal-screen" onclick={dismissGuidance}>
					<span class="corner-mark tl">+</span>
					<span class="corner-mark tr">+</span>
					<span class="corner-mark bl">+</span>
					<span class="corner-mark br">+</span>
					{#if capturedBoot}
						<div class="boot-cursor" style="animation-delay: 0ms">█</div>
						{#each capturedLines as line, i}
							{#if line === ''}
								<div class="terminal-line terminal-blank" style="animation-delay: {(i + 1) * 400 + 600}ms"></div>
							{:else}
								<div class="terminal-line boot-line" style="animation-delay: {(i + 1) * 400 + 600}ms">
									<span class="terminal-prompt">&gt;</span> {line}
								</div>
							{/if}
						{/each}
					{:else}
						{#each capturedLines as line, i}
							{#if line === ''}
								<div class="terminal-line terminal-blank" style="animation-delay: {i * 150}ms"></div>
							{:else}
								<div class="terminal-line" style="animation-delay: {i * 150}ms">
									<span class="terminal-prompt">&gt;</span> {line}
								</div>
							{/if}
						{/each}
					{/if}
					<div class="terminal-continue" style="animation-delay: {capturedBoot ? capturedLines.length * 400 + 1200 : capturedLines.length * 150 + 300}ms">
						TAP TO CONTINUE
					</div>
				</div>
			{/if}
			<button bind:this={playBtnEl} class="play-tap" class:hidden-by-terminal={showTerminal} class:feedback-correct={feedbackState === 'correct'} class:feedback-wrong={feedbackState === 'wrong'} onclick={ctrl.hasPlayed && inResultMode ? handleReplayInResult : handlePlay}>
				<div class="orbit-track"><div class="orbit-dot"></div></div>
				<span class="q-text" class:feedback-correct={feedbackState === 'correct'} class:feedback-wrong={feedbackState === 'wrong'} class:glitch-text={showGlitch}>
					{displayText}
				</span>
			</button>
		</VizQuizLayout>

		<div class="answer-area" class:hidden={!ctrl.question} class:blocked={answersBlocked}>
			<AnswerGrid
				choices={(ctrl.needsTap || answersBlocked) ? ctrl.question.choices.map(c => ({ ...c, label: 'NA', name: 'UNAVAILABLE' })) : ctrl.question.choices}
				onselect={handleSelectAnswer}
					disabled={ctrl.needsTap || answersBlocked || !ctrl.hasPlayed || !!ctrl.selectedId}
					offline={ctrl.needsTap || answersBlocked}
					correctId={ctrl.selectedId ? ctrl.question.correctAnswer.id : null}
					selectedId={ctrl.selectedId}
					onCorrectClick={ctrl.selectedId ? (inResultMode ? handleNextQuestion : handleSkipCorrect) : null}
					countdownPct={inResultMode ? ctrl.countdownPct : -1}
					onWrongClick={inResultMode ? handleReplayInResult : null}
				/>
			</div>
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
	.audio-banner {
		position: fixed;
		top: env(safe-area-inset-top, 0px);
		left: 0;
		right: 0;
		z-index: 100;
		height: 24px;
		background: var(--accent);
		color: var(--base);
		font-family: var(--mono);
		font-size: 0.4rem;
		font-weight: 900;
		letter-spacing: 0.15em;
		border: none;
		cursor: pointer;
		overflow: hidden;
		white-space: nowrap;
		display: flex;
		align-items: center;
	}
	.ticker-text {
		display: inline-block;
		animation: ticker 12s linear infinite;
	}
	@keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-33.33%); } }
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
		font-weight: 900;
		font-family: var(--mono);
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
	.extra-toggle {
		font-size: 0.4rem;
		font-weight: 800;
		font-family: var(--mono);
		letter-spacing: 0.05em;
		padding: 0 6px;
		line-height: 1.6;
		background: transparent;
		color: var(--text-secondary);
		border: 1px solid var(--border-heavy);
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
	}
	.extra-toggle.active {
		color: var(--correct, #00FF88);
		border-color: var(--correct, #00FF88);
	}
	.extra-toggle:not(.active) {
		color: var(--text-secondary, #666);
		border-color: var(--border-heavy, #333);
		opacity: 0.6;
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
	.play-tap.hidden-by-terminal {
		opacity: 0;
		pointer-events: none;
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
	.q-text.glitch-text { /* clean glyph cycling, no effects */ }
	.terminal-screen {
		position: absolute;
		inset: 0;
		background: var(--base, #0A0A0A);
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 1.5rem;
		z-index: 0;
	}
	.terminal-line {
		font-family: var(--mono);
		font-size: 0.45rem;
		font-weight: 900;
		letter-spacing: 0.12em;
		color: var(--accent, #C2FE0C);
		line-height: 1.8;
		text-transform: uppercase;
		opacity: 0;
		animation: terminal-appear 0.3s ease-out forwards;
	}
	.terminal-blank {
		height: 0.5rem;
	}
	.terminal-prompt {
		color: var(--marathon-blue);
		margin-right: 0.3rem;
	}
	@keyframes terminal-appear {
		from { opacity: 0; transform: translateY(4px); }
		to { opacity: 1; transform: translateY(0); }
	}
	.terminal-continue {
		font-family: var(--mono);
		font-size: 0.45rem;
		font-weight: 900;
		letter-spacing: 0.15em;
		color: var(--text-secondary);
		text-align: center;
		margin-top: auto;
		padding-top: 1rem;
		opacity: 0;
		animation: terminal-appear 0.3s ease-out forwards, terminal-blink 1.5s ease-in-out infinite 1s;
	}
	@keyframes terminal-blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}
	.terminal-screen {
		cursor: pointer;
	}
	/* ── Corner markers (Marathon aesthetic) ── */
	.corner-mark {
		position: absolute;
		font-family: var(--mono);
		font-size: 0.5rem;
		font-weight: 400;
		color: var(--accent);
		opacity: 0.4;
		line-height: 1;
		pointer-events: none;
	}
	.corner-mark.tl { top: 0.6rem; left: 0.6rem; }
	.corner-mark.tr { top: 0.6rem; right: 0.6rem; }
	.corner-mark.bl { bottom: 0.6rem; left: 0.6rem; }
	.corner-mark.br { bottom: 0.6rem; right: 0.6rem; }
	/* ── Boot sequence cursor ── */
	.boot-cursor {
		font-family: var(--mono);
		font-size: 0.5rem;
		color: var(--accent);
		line-height: 1.8;
		animation: cursor-blink 0.6s step-end infinite;
		margin-bottom: 0.25rem;
	}
	@keyframes cursor-blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0; }
	}
	.boot-line {
		/* Slower typewriter appearance for boot lines */
	}
	/* On mobile: transparent wrapper, just passes through */
	.quiz-panels {
		display: contents;
	}
	.answer-area {
		width: 100%;
		margin-top: auto;
	}
	.answer-area.hidden {
		visibility: hidden;
	}
	.answer-area.blocked {
		opacity: 0.3;
		pointer-events: none;
	}

	/* Summary screen */
	.summary {
		display: flex; flex-direction: column; align-items: center;
		gap: 1.25rem; width: 100%; min-height: 100%;
	}
	.debrief-panels {
		display: contents; /* On mobile: acts like the elements are directly in .summary */
	}
	.debrief-stats {
		display: flex; flex-direction: column; align-items: center;
		gap: 1.25rem; width: 100%;
	}
	.debrief-missed {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
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

	/* ── FRE conclusion screen ── */
	.fre-conclusion {
		justify-content: center;
	}
	.fre-terminal {
		position: relative;
		width: 100%;
		background: var(--base);
		border: 1px solid var(--border-heavy);
		padding: 2rem 1.5rem;
		display: flex;
		flex-direction: column;
	}
	.fre-score {
		font-size: 5rem;
		font-weight: 900;
		font-family: var(--mono);
		color: var(--accent);
		letter-spacing: -0.02em;
		line-height: 1;
		text-align: center;
		margin-bottom: 1.5rem;
	}
	.fre-actions {
		opacity: 0;
		animation: terminal-appear 0.3s ease-out 1.5s forwards;
	}

	/* Desktop: wider layout (≥1200px — sidebar + enough content for two-column) */
	@media (min-width: 1200px) {
		.heading { font-size: 3.5rem; }

		.summary {
			max-width: none;
			margin: 0;
		}
	}

	/* Desktop (≥1200px) + landscape phone (actual phone, short viewport) */
	@media (min-width: 1200px), (orientation: landscape) and (min-width: 568px) and (max-height: 500px) {
		/* Quiz stays column — heading + top bar above, panels below */
		.quiz {
			flex-direction: column;
			gap: 1rem;
		}
		/* Two-column container for viz + answers — grid for precise alignment */
		.quiz-panels {
			display: grid;
			grid-template-columns: 3fr 2fr;
			gap: 1.5rem;
		}
		/* Answer grid — height-matched to viewpod via grid row */
		.quiz-panels .answer-area {
			min-width: 0;
			margin-top: 0;
			display: flex;
			flex-direction: column;
		}
		.quiz-panels .answer-area.hidden {
			visibility: hidden;
		}
		/* Stack answer cards single-column, fill height, equal rows */
		.quiz-panels .answer-area :global(.grid) {
			grid-template-columns: 1fr;
			grid-template-rows: repeat(4, 1fr);
			flex: 1;
		}
		.debrief-panels {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 2rem;
			width: 100%;
			align-items: start;
		}
	}
</style>
