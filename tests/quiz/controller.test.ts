/**
 * Tests for QuizController — the unified quiz state machine.
 *
 * Tests the plain-class controller directly (no Svelte runes required).
 * Audio and storage are mocked; we verify state transitions and callbacks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QuizController } from '$lib/quiz/controller';
import type {
	QuizSessionConfig,
	UnifiedQuestion,
	QuestionResult,
	PlaybackInfo,
} from '$lib/quiz/types';
import type { UserStateV4 } from '$lib/state/schema';
import { createDefaultStateV4 } from '$lib/state/defaults';

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock audio module — prevent real AudioContext usage
vi.mock('$lib/audio', () => ({
	ensureResumed: vi.fn().mockResolvedValue(undefined),
	isAudioReady: vi.fn().mockReturnValue(true),
	playFeedbackChime: vi.fn(),
}));

// Mock storage — prevent localStorage access
const mockStore = new Map<string, string>();
vi.mock('$lib/state/storage', () => ({
	loadStateV4: vi.fn(() => {
		const raw = mockStore.get('ear-trainer-state');
		if (raw) return JSON.parse(raw);
		// Inline minimal default for test isolation
		return createTestState();
	}),
	saveStateV4: vi.fn((state: UserStateV4) => {
		mockStore.set('ear-trainer-state', JSON.stringify(state));
	}),
}));

// Mock progression — return state unchanged
vi.mock('$lib/state/progression', () => ({
	checkTierUnlockV4: vi.fn((s: UserStateV4) => ({ ...s })),
}));

// Re-import mocked modules so we can inspect calls
import { playFeedbackChime } from '$lib/audio';
import { saveStateV4 } from '$lib/state/storage';
import { checkTierUnlockV4 } from '$lib/state/progression';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createTestState(): UserStateV4 {
	const s = createDefaultStateV4();
	s.settings.sessionLength = 5;
	return s;
}

let questionCounter = 0;

function makeQuestion(overrides?: Partial<UnifiedQuestion>): UnifiedQuestion {
	questionCounter++;
	return {
		id: `interval:P5:ascending:${questionCounter}`,
		kind: 'interval',
		rootNote: 60,
		playback: {
			type: 'interval',
			rootNote: 60,
			intervals: [0, 7],
			toneType: 'epiano',
			direction: 'ascending',
		},
		correctAnswer: { id: 'P5', name: 'Perfect Fifth', label: 'P5' },
		choices: [
			{ id: 'P4', name: 'Perfect Fourth', label: 'P4' },
			{ id: 'P5', name: 'Perfect Fifth', label: 'P5' },
			{ id: 'M3', name: 'Major Third', label: 'M3' },
			{ id: 'm3', name: 'Minor Third', label: 'm3' },
		],
		replays: 0,
		...overrides,
	};
}

function createTestConfig(overrides?: Partial<QuizSessionConfig>): QuizSessionConfig {
	return {
		heading: 'TEST',
		contentKinds: ['interval'],
		sessionLength: 5,
		generateQuestion: vi.fn(() => makeQuestion()),
		playAudio: vi.fn().mockResolvedValue({ durationMs: 100, notes: [60, 67] } as PlaybackInfo),
		onAnswer: vi.fn(),
		onSessionEnd: vi.fn(),
		onPageEnter: vi.fn(),
		onPageExit: vi.fn(),
		countdownDuration: 8000,
		correctAdvanceDelay: 1350,
		...overrides,
	};
}

// ─── Test setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
	questionCounter = 0;
	mockStore.clear();
	vi.clearAllMocks();
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('QuizController — initialization', () => {
	it('initializes with correct defaults', () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		expect(ctrl.phase).toBe('idle');
		expect(ctrl.questionNum).toBe(0);
		expect(ctrl.totalQuestions).toBe(5); // from config.sessionLength
		expect(ctrl.hasPlayed).toBe(false);
		expect(ctrl.needsTap).toBe(false);
		expect(ctrl.selectedId).toBeNull();
		expect(ctrl.sessionCorrect).toBe(0);
		expect(ctrl.isPlaying).toBe(false);
		expect(ctrl.isGlitching).toBe(false);
		expect(ctrl.countdownPct).toBe(1.0);
		expect(ctrl.results).toEqual([]);
		expect(ctrl.question).toBeNull();
	});

	it('calls onPageEnter on construction', () => {
		const config = createTestConfig();
		const state = createTestState();
		new QuizController(config, state);
		expect(config.onPageEnter).toHaveBeenCalledOnce();
	});

	it('uses config.sessionLength for totalQuestions (not userState)', () => {
		const config = createTestConfig();
		config.sessionLength = 10;
		const state = createTestState();
		const ctrl = new QuizController(config, state);
		expect(ctrl.totalQuestions).toBe(10);
	});
});

describe('QuizController — nextQuestion', () => {
	it('generates a question using config.generateQuestion', () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		ctrl.nextQuestion();

		expect(config.generateQuestion).toHaveBeenCalledWith(state);
		// In test env (no rAF), question is set synchronously
		expect(ctrl.question).not.toBeNull();
		expect(ctrl.questionNum).toBe(1);
	});

	it('increments questionNum on each call', () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		ctrl.nextQuestion();
		expect(ctrl.questionNum).toBe(1);

		// Reset state for another question
		ctrl.selectedId = null;
		ctrl.nextQuestion();
		expect(ctrl.questionNum).toBe(2);
	});

	it('resets per-question state', () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		// Simulate having answered a question
		ctrl.hasPlayed = true;
		ctrl.selectedId = 'P5';
		ctrl.isPlaying = true;

		ctrl.nextQuestion();

		expect(ctrl.hasPlayed).toBe(false);
		expect(ctrl.selectedId).toBeNull();
		expect(ctrl.isPlaying).toBe(false);
	});

	it('calls finishSession when all questions answered', () => {
		const config = createTestConfig();
		const state = createTestState();
		state.settings.sessionLength = 2;
		const ctrl = new QuizController(config, state);
		ctrl.totalQuestions = 2;

		// Answer two questions
		ctrl.nextQuestion(); // Q1
		ctrl.questionNum = 2; // Pretend we're at Q2
		ctrl.nextQuestion(); // Should trigger finishSession

		expect(ctrl.phase).toBe('debrief');
	});
});

describe('QuizController — play', () => {
	it('calls config.playAudio and sets isPlaying', async () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		ctrl.nextQuestion(); // Set up question
		await ctrl.play();

		expect(config.playAudio).toHaveBeenCalledWith(ctrl.question, state);
		expect(ctrl.hasPlayed).toBe(true);
	});

	it('sets phase to playing on first play', async () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		ctrl.nextQuestion();
		await ctrl.play();

		// Phase should be 'playing' (until timeout clears it)
		expect(ctrl.isPlaying).toBe(true);
	});

	it('increments replays on subsequent plays', async () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		ctrl.nextQuestion();
		await ctrl.play(); // first play
		expect(ctrl.question!.replays).toBe(0);

		await ctrl.play(); // replay
		expect(ctrl.question!.replays).toBe(1);
	});

	it('does nothing when no question is set', async () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		await ctrl.play(); // no question
		expect(config.playAudio).not.toHaveBeenCalled();
	});
});

describe('QuizController — selectAnswer', () => {
	it('with correct answer → sets phase to feedback_correct', async () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		ctrl.nextQuestion();
		await ctrl.play();
		ctrl.selectAnswer('P5'); // correct

		expect(ctrl.phase).toBe('feedback_correct');
		expect(ctrl.selectedId).toBe('P5');
		expect(ctrl.sessionCorrect).toBe(1);
	});

	it('with wrong answer → sets phase to feedback_wrong then result_mode', async () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		ctrl.nextQuestion();
		await ctrl.play();
		ctrl.selectAnswer('P4'); // wrong

		// In the controller, feedback_wrong transitions to result_mode synchronously
		// (enterResultMode is called at end of selectAnswer for wrong answers)
		expect(ctrl.phase).toBe('result_mode');
		expect(ctrl.selectedId).toBe('P4');
		expect(ctrl.sessionCorrect).toBe(0);
	});

	it('records result in results array', async () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		ctrl.nextQuestion();
		await ctrl.play();
		ctrl.selectAnswer('P5');

		expect(ctrl.results).toHaveLength(1);
		expect(ctrl.results[0].correct).toBe(true);
		expect(ctrl.results[0].selectedId).toBe('P5');
		expect(ctrl.results[0].responseTimeMs).toBeGreaterThanOrEqual(0);
	});

	it('calls playFeedbackChime with correct flag', async () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		ctrl.nextQuestion();
		await ctrl.play();
		ctrl.selectAnswer('P5');

		expect(playFeedbackChime).toHaveBeenCalledWith(true);
	});

	it('calls config.onAnswer with state, question, and result', async () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		ctrl.nextQuestion();
		await ctrl.play();
		ctrl.selectAnswer('P5');

		expect(config.onAnswer).toHaveBeenCalledOnce();
		const [passedState, passedQ, passedResult] = (config.onAnswer as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(passedState).toBeDefined();
		expect(passedQ.correctAnswer.id).toBe('P5');
		expect(passedResult.correct).toBe(true);
	});

	it('calls checkTierUnlockV4 and saveStateV4', async () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		ctrl.nextQuestion();
		await ctrl.play();
		ctrl.selectAnswer('P5');

		expect(checkTierUnlockV4).toHaveBeenCalled();
		expect(saveStateV4).toHaveBeenCalled();
	});

	it('increments globalStats.totalQuestions', async () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		ctrl.nextQuestion();
		await ctrl.play();

		const before = ctrl.userState.globalStats.totalQuestions;
		ctrl.selectAnswer('P5');
		expect(ctrl.userState.globalStats.totalQuestions).toBe(before + 1);
	});

	it('ignores second selection (double-tap protection)', async () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		ctrl.nextQuestion();
		await ctrl.play();
		ctrl.selectAnswer('P5');
		ctrl.selectAnswer('P4'); // should be ignored

		expect(ctrl.results).toHaveLength(1);
		expect(ctrl.selectedId).toBe('P5');
	});

	it('correct answer sets auto-advance timeout', async () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		ctrl.nextQuestion();
		await ctrl.play();
		ctrl.selectAnswer('P5');

		expect(ctrl.phase).toBe('feedback_correct');

		// Advance timers past the correctAdvanceDelay
		vi.advanceTimersByTime(1400);

		// nextQuestion should have been called — questionNum advances
		expect(ctrl.questionNum).toBe(2);
	});

	it('wrong answer enters result mode (phase = result_mode)', async () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		ctrl.nextQuestion();
		await ctrl.play();
		ctrl.selectAnswer('P4'); // wrong

		// Phase transitions: feedback_wrong → result_mode
		// (enterResultMode is called synchronously from selectAnswer)
		expect(ctrl.phase).toBe('result_mode');
		expect(ctrl.countdownPct).toBe(1.0);
	});
});

describe('QuizController — skipCorrect', () => {
	it('clears timeout and advances to next question', async () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		ctrl.nextQuestion();
		await ctrl.play();
		ctrl.selectAnswer('P5');

		expect(ctrl.phase).toBe('feedback_correct');

		ctrl.skipCorrect();

		// Should have moved to next question
		expect(ctrl.questionNum).toBe(2);
	});
});

describe('QuizController — finishSession', () => {
	it('updates globalStats and sets phase to debrief', () => {
		const config = createTestConfig();
		const state = createTestState();
		state.globalStats.totalSessions = 5;
		state.globalStats.currentStreak = 0;
		state.globalStats.bestStreak = 3;
		const ctrl = new QuizController(config, state);

		ctrl.finishSession();

		expect(ctrl.phase).toBe('debrief');
		expect(ctrl.userState.globalStats.totalSessions).toBe(6);
		expect(ctrl.userState.globalStats.lastPractice).toBeGreaterThan(0);
		expect(ctrl.userState.globalStats.currentStreak).toBeGreaterThanOrEqual(1);
	});

	it('increments streak for consecutive days', () => {
		const config = createTestConfig();
		const state = createTestState();
		state.globalStats.currentStreak = 3;
		// Set lastPractice to yesterday
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		state.globalStats.lastPractice = yesterday.getTime();
		const ctrl = new QuizController(config, state);

		ctrl.finishSession();

		expect(ctrl.userState.globalStats.currentStreak).toBe(4);
	});

	it('resets streak for non-consecutive days', () => {
		const config = createTestConfig();
		const state = createTestState();
		state.globalStats.currentStreak = 5;
		// Set lastPractice to 3 days ago
		const threeDaysAgo = new Date();
		threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
		state.globalStats.lastPractice = threeDaysAgo.getTime();
		const ctrl = new QuizController(config, state);

		ctrl.finishSession();

		expect(ctrl.userState.globalStats.currentStreak).toBe(1);
	});

	it('updates bestStreak if current exceeds it', () => {
		const config = createTestConfig();
		const state = createTestState();
		state.globalStats.currentStreak = 9;
		state.globalStats.bestStreak = 5;
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		state.globalStats.lastPractice = yesterday.getTime();
		const ctrl = new QuizController(config, state);

		ctrl.finishSession();

		expect(ctrl.userState.globalStats.bestStreak).toBe(10);
	});

	it('calls config.onSessionEnd', () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		ctrl.finishSession();

		expect(config.onSessionEnd).toHaveBeenCalledOnce();
	});

	it('saves state', () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		ctrl.finishSession();

		expect(saveStateV4).toHaveBeenCalled();
	});
});

describe('QuizController — restartQuiz', () => {
	it('resets all session state', async () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		// Play through some questions
		ctrl.nextQuestion();
		await ctrl.play();
		ctrl.selectAnswer('P5');
		vi.advanceTimersByTime(1400);

		// Now restart
		ctrl.restartQuiz();

		expect(ctrl.phase).not.toBe('debrief');
		expect(ctrl.sessionCorrect).toBe(0);
		expect(ctrl.results).toEqual([]);
		// restartQuiz calls nextQuestion, so questionNum = 1
		expect(ctrl.questionNum).toBe(1);
	});
});

describe('QuizController — endEarly', () => {
	it('saves state when questionNum > 1', async () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		ctrl.nextQuestion();
		await ctrl.play();
		ctrl.selectAnswer('P5');
		vi.advanceTimersByTime(1400);
		// Now at Q2
		ctrl.nextQuestion();

		const sessionsBefore = ctrl.userState.globalStats.totalSessions;
		ctrl.endEarly();

		expect(ctrl.userState.globalStats.totalSessions).toBe(sessionsBefore + 1);
		expect(ctrl.userState.globalStats.lastPractice).toBeGreaterThan(0);
		expect(saveStateV4).toHaveBeenCalled();
	});

	it('does not save when questionNum <= 1', () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		ctrl.nextQuestion(); // Q1
		vi.clearAllMocks();
		ctrl.endEarly();

		expect(saveStateV4).not.toHaveBeenCalled();
	});
});

describe('QuizController — cleanup', () => {
	it('calls config.onPageExit', () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		ctrl.cleanup();

		expect(config.onPageExit).toHaveBeenCalledOnce();
	});

	it('marks controller as disposed', () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		ctrl.cleanup();

		// After cleanup, nextQuestion's deferred play should not fire
		// (Tested indirectly — disposed flag prevents state changes)
		expect(() => ctrl.cleanup()).not.toThrow(); // double cleanup is safe
	});
});

describe('QuizController — derived values', () => {
	it('vizPhase returns correct values for different phases', () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		expect(ctrl.vizPhase).toBe('rest');

		ctrl.isGlitching = true;
		expect(ctrl.vizPhase).toBe('transition');
		ctrl.isGlitching = false;

		ctrl.phase = 'feedback_correct';
		expect(ctrl.vizPhase).toBe('correct');

		ctrl.phase = 'feedback_wrong';
		expect(ctrl.vizPhase).toBe('wrong');

		ctrl.phase = 'result_mode';
		expect(ctrl.vizPhase).toBe('wrong');

		ctrl.phase = 'idle';
		ctrl.isPlaying = true;
		expect(ctrl.vizPhase).toBe('playing');
	});

	it('summaryAccuracy computes correctly', async () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		expect(ctrl.summaryAccuracy).toBe(0); // no results

		ctrl.nextQuestion();
		await ctrl.play();
		ctrl.selectAnswer('P5'); // correct
		vi.advanceTimersByTime(1400);

		ctrl.nextQuestion();
		await ctrl.play();
		ctrl.selectAnswer('P4'); // wrong

		expect(ctrl.summaryAccuracy).toBe(50); // 1/2
	});

	it('wrongAnswers filters correctly', async () => {
		const config = createTestConfig();
		const state = createTestState();
		const ctrl = new QuizController(config, state);

		ctrl.nextQuestion();
		await ctrl.play();
		ctrl.selectAnswer('P5'); // correct
		vi.advanceTimersByTime(1400);

		ctrl.nextQuestion();
		await ctrl.play();
		ctrl.selectAnswer('P4'); // wrong

		expect(ctrl.wrongAnswers).toHaveLength(1);
		expect(ctrl.wrongAnswers[0].selectedId).toBe('P4');
	});
});

describe('QuizController — full session flow', () => {
	it('completes a full 3-question session', async () => {
		const config = createTestConfig({ sessionLength: 3 });
		const state = createTestState();
		state.settings.sessionLength = 3;
		const ctrl = new QuizController(config, state);

		// Q1 — correct
		ctrl.nextQuestion();
		await ctrl.play();
		ctrl.selectAnswer('P5');
		vi.advanceTimersByTime(1400);

		// Q2 — wrong
		// nextQuestion was called by the timer
		await ctrl.play();
		ctrl.selectAnswer('P4');
		// In result_mode — we need to advance past countdown
		// Simulate countdown completing
		ctrl.phase = 'idle'; // force past result_mode for test

		// Q3 — correct
		ctrl.nextQuestion();
		await ctrl.play();
		ctrl.selectAnswer('P5');
		vi.advanceTimersByTime(1400);

		// Session should finish → debrief
		expect(ctrl.phase).toBe('debrief');
		expect(ctrl.results).toHaveLength(3);
		expect(ctrl.sessionCorrect).toBe(2);
		expect(ctrl.summaryAccuracy).toBe(67); // 2/3 rounded
	});
});
