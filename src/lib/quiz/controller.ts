/**
 * Quiz controller — pure-logic state machine driving all quiz sessions.
 *
 * This is a plain TypeScript class (no Svelte runes) so it can be unit-tested
 * directly. Components wrap it with `$state()` for reactivity.
 *
 * Phase transitions:
 *   idle → playing → awaiting_answer
 *     → feedback_correct → (auto-advance) → playing  (next question)
 *     → feedback_wrong → result_mode → (countdown) → playing  (next question)
 *   (any) → debrief  (session complete)
 *
 * The controller does NOT own audio or UI — it delegates to QuizSessionConfig
 * callbacks for content-specific playback and stat recording.
 */

import { loadStateV4, saveStateV4 } from '$lib/state/storage';
import { checkTierUnlockV4 } from '$lib/state/progression';
import type { UserStateV4 } from '$lib/state/schema';
import type {
	QuizSessionConfig,
	UnifiedQuestion,
	QuestionResult,
	QuizPhase,
	PlaybackInfo,
} from './types';

// ─── Audio imports (thin — only gate + chime) ───────────────────────────────

import { ensureResumed, isAudioReady, playFeedbackChime } from '$lib/audio';

// ─── Controller class ───────────────────────────────────────────────────────

export class QuizController {
	// ── Configuration ──────────────────────────────────────────────────────
	private config: QuizSessionConfig;
	private countdownDuration: number;
	private correctAdvanceDelay: number;

	// ── Public state (read by components) ──────────────────────────────────
	userState: UserStateV4;
	phase: QuizPhase = 'idle';
	question: UnifiedQuestion | null = null;
	questionNum: number = 0;
	totalQuestions: number;
	hasPlayed: boolean = false;
	needsTap: boolean = false;
	selectedId: string | null = null;
	sessionCorrect: number = 0;
	isPlaying: boolean = false;
	isGlitching: boolean = false;
	countdownPct: number = 1.0;
	results: QuestionResult[] = [];

	// ── Internal state ─────────────────────────────────────────────────────
	private audioUnlocked: boolean = false;
	private startTime: number = 0;
	private correctTimeout: ReturnType<typeof setTimeout> | null = null;
	private countdownStart: number = 0;
	private rafId: number | null = null;
	private _disposed: boolean = false;

	// ── Derived (computed on access) ───────────────────────────────────────

	get vizPhase(): 'rest' | 'playing' | 'correct' | 'wrong' | 'transition' {
		if (this.isGlitching) return 'transition';
		if (this.phase === 'feedback_correct') return 'correct';
		if (this.phase === 'feedback_wrong' || this.phase === 'result_mode') return 'wrong';
		if (this.isPlaying) return 'playing';
		return 'rest';
	}

	get summaryAccuracy(): number {
		return this.results.length > 0
			? Math.round((this.sessionCorrect / this.results.length) * 100)
			: 0;
	}

	get wrongAnswers(): QuestionResult[] {
		return this.results.filter((r) => !r.correct);
	}

	// ── Constructor ────────────────────────────────────────────────────────

	constructor(config: QuizSessionConfig, initialState?: UserStateV4) {
		this.config = config;
		this.countdownDuration = config.countdownDuration ?? 8000;
		this.correctAdvanceDelay = config.correctAdvanceDelay ?? 1350;
		this.userState = initialState ?? loadStateV4();
		this.totalQuestions = config.sessionLength;

		// Lifecycle callback
		config.onPageEnter?.();
	}

	// ── Public methods ─────────────────────────────────────────────────────

	/**
	 * Advance to the next question, or finish the session if done.
	 * Triggers glitch transition → auto-play.
	 */
	nextQuestion(): void {
		this._cancelCountdown();

		if (this.questionNum >= this.totalQuestions) {
			this.finishSession();
			return;
		}

		// Reset per-question state
		this.isPlaying = false;
		this.phase = 'idle';
		this.questionNum++;

		// Generate question via config
		const nextQ = this.config.generateQuestion(this.userState);

		// Glitch transition
		this.isGlitching = true;

		// Use rAF-like deferral for state update, then auto-play after glitch
		// In non-browser contexts (tests), execute synchronously
		if (typeof requestAnimationFrame === 'function') {
			requestAnimationFrame(() => {
				this._applyNextQuestion(nextQ);
				setTimeout(() => {
					if (!this._disposed) {
						this.isGlitching = false;
						if (this.config.autoPlay !== false) {
							this.play();
						}
					}
				}, 600);
			});
		} else {
			// Synchronous fallback (tests)
			this._applyNextQuestion(nextQ);
			this.isGlitching = false;
		}
	}

	/**
	 * Play (or replay) the current question's audio.
	 * Handles iOS audio gate (needsTap flow).
	 */
	async play(): Promise<void> {
		if (!this.question) return;

		// Attempt to resume AudioContext
		try {
			await ensureResumed();
		} catch {
			/* fall through to gate check */
		}

		// iOS audio gate: block until first user gesture
		if (!this.audioUnlocked && !isAudioReady() && !this.needsTap) {
			this.needsTap = true;
			return;
		}
		if (this.needsTap) {
			this.audioUnlocked = true;
			this.needsTap = false;
		}
		if (!this.audioUnlocked) this.audioUnlocked = true;

		// Reset auto-advance timer on replay during correct feedback
		if (this.phase === 'feedback_correct' && this.correctTimeout) {
			clearTimeout(this.correctTimeout);
			this.correctTimeout = setTimeout(
				() => this.nextQuestion(),
				this.correctAdvanceDelay,
			);
			// Don't re-trigger the full play flow — just replay audio
		}

		// Record timing
		if (!this.hasPlayed) {
			this.hasPlayed = true;
			this.startTime = Date.now();
			this.phase = 'playing';
		} else {
			this.question.replays++;
		}

		// Delegate audio to config
		this.isPlaying = true;
		try {
			const info: PlaybackInfo = await this.config.playAudio(
				this.question,
				this.userState,
			);
			// Auto-clear isPlaying after playback duration
			if (typeof setTimeout === 'function') {
				setTimeout(() => {
					if (!this._disposed) {
						this.isPlaying = false;
						// Move to awaiting_answer if still in playing phase
						if (this.phase === 'playing') {
							this.phase = 'awaiting_answer';
						}
					}
				}, info.durationMs);
			}
		} catch {
			this.isPlaying = false;
			if (this.phase === 'playing') {
				this.phase = 'awaiting_answer';
			}
		}
	}

	/**
	 * Handle answer selection. Updates stats, plays chime, transitions phase.
	 */
	selectAnswer(choiceId: string): void {
		if (!this.question || this.selectedId) return;

		const correct = choiceId === this.question.correctAnswer.id;
		this.selectedId = choiceId;
		this.phase = correct ? 'feedback_correct' : 'feedback_wrong';

		if (correct) this.sessionCorrect++;

		const responseTimeMs = Date.now() - this.startTime;

		// Record result
		const result: QuestionResult = {
			question: this.question,
			correct,
			selectedId: choiceId,
			responseTimeMs,
		};
		this.results.push(result);

		// Feedback chime
		playFeedbackChime(correct);

		// Delegate stat recording to config
		this.config.onAnswer?.(this.userState, this.question, result);

		// Tier unlock check + save
		this.userState = checkTierUnlockV4(this.userState);
		this.userState.globalStats.totalQuestions++;
		saveStateV4(this.userState);

		// Flow control
		if (correct) {
			this.correctTimeout = setTimeout(
				() => this.nextQuestion(),
				this.correctAdvanceDelay,
			);
		} else {
			this._enterResultMode();
		}
	}

	/**
	 * Replay audio while in result mode (wrong answer review).
	 * Restarts the countdown timer.
	 */
	replayInResult(): void {
		this.play();
		this.countdownStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
		this.countdownPct = 1.0;
	}

	/**
	 * Skip the correct-answer auto-advance delay.
	 */
	skipCorrect(): void {
		if (this.phase === 'feedback_correct' && this.correctTimeout) {
			clearTimeout(this.correctTimeout);
			this.correctTimeout = null;
		}
		this.nextQuestion();
	}

	/**
	 * Finish the session — update global stats, save, enter debrief.
	 */
	finishSession(): void {
		this._cancelCountdown();

		this.userState.globalStats.totalSessions++;

		const now = new Date();
		const lastMs = this.userState.globalStats.lastPractice;
		const last = lastMs ? new Date(lastMs) : null;

		const isConsecutive =
			last &&
			now.getTime() - last.getTime() < 2 * 24 * 60 * 60 * 1000 &&
			now.toDateString() !== last.toDateString();

		if (isConsecutive) {
			this.userState.globalStats.currentStreak++;
		} else if (!last || now.toDateString() !== last.toDateString()) {
			this.userState.globalStats.currentStreak = 1;
		}
		this.userState.globalStats.bestStreak = Math.max(
			this.userState.globalStats.bestStreak,
			this.userState.globalStats.currentStreak,
		);
		this.userState.globalStats.lastPractice = Date.now();

		// skipDebrief: call onSessionEnd and bail — no debrief phase, no extra save
		if (this.config.skipDebrief) {
			this.config.onSessionEnd?.(this.userState);
			return;
		}

		// Config hook
		this.config.onSessionEnd?.(this.userState);

		saveStateV4(this.userState);
		this.phase = 'debrief';
	}

	/**
	 * Restart the quiz — reset all session state, reload user state.
	 */
	restartQuiz(): void {
		this._cancelCountdown();
		this.phase = 'idle';
		this.sessionCorrect = 0;
		this.questionNum = 0;
		this.results = [];
		this.question = null;
		this.selectedId = null;
		this.hasPlayed = false;
		this.isPlaying = false;
		this.isGlitching = false;
		this.countdownPct = 1.0;
		this.userState = loadStateV4();
		this.totalQuestions = this.config.sessionLength;
		this.nextQuestion();
	}

	/**
	 * End the session early — save partial progress, don't enter debrief.
	 * The component handles navigation.
	 */
	endEarly(): void {
		this._cancelCountdown();
		if (this.questionNum > 1) {
			this.userState.globalStats.totalSessions++;
			this.userState.globalStats.lastPractice = Date.now();
			saveStateV4(this.userState);
		}
	}

	/**
	 * Cleanup — cancel timers, call onPageExit. Call on component unmount.
	 */
	cleanup(): void {
		this._disposed = true;
		this._cancelCountdown();
		if (this.correctTimeout) {
			clearTimeout(this.correctTimeout);
			this.correctTimeout = null;
		}
		this.config.onPageExit?.();
	}

	/**
	 * Cancel all auto-advance timers (correct timeout + wrong countdown).
	 * Used by FRE mode to let the terminal overlay control pacing.
	 */
	pauseAutoAdvance(): void {
		if (this.correctTimeout) {
			clearTimeout(this.correctTimeout);
			this.correctTimeout = null;
		}
		this._cancelCountdown();
	}

	/**
	 * Force the "tap to reconnect" banner — used when the component detects
	 * that iOS killed the AudioContext during background and resume() failed.
	 */
	forceNeedsTap(): void {
		this.audioUnlocked = false;
		this.needsTap = true;
		this.isPlaying = false;
	}

	// ── Private helpers ────────────────────────────────────────────────────

	private _applyNextQuestion(q: UnifiedQuestion): void {
		this.question = q;
		this.hasPlayed = false;
		this.selectedId = null;
		this.countdownPct = 1.0;
		this.phase = 'idle';
	}

	private _enterResultMode(): void {
		this.phase = 'result_mode';
		this.countdownStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
		this.countdownPct = 1.0;
		this._startCountdownLoop();
	}

	private _startCountdownLoop(): void {
		if (typeof requestAnimationFrame !== 'function') {
			// Non-browser env (tests) — skip RAF loop
			return;
		}
		const tick = (now: number): void => {
			if (this._disposed) return;
			const elapsed = now - this.countdownStart;
			this.countdownPct = Math.max(0, 1 - elapsed / this.countdownDuration);
			if (this.countdownPct <= 0) {
				this.rafId = null;
				this.nextQuestion();
				return;
			}
			this.rafId = requestAnimationFrame(tick);
		};
		this.rafId = requestAnimationFrame(tick);
	}

	private _cancelCountdown(): void {
		if (this.rafId !== null) {
			if (typeof cancelAnimationFrame === 'function') {
				cancelAnimationFrame(this.rafId);
			}
			this.rafId = null;
		}
	}
}
