/**
 * Unified quiz type definitions for v4.
 *
 * These types decouple quiz session logic from specific content types
 * (intervals, chords, scales, modes). The QuizSessionConfig interface
 * lets each content type plug its own question generation, audio playback,
 * and stat recording into a shared controller state machine.
 */

import type { ContentKind, ToneType, ChordVoicing, PlayMode, UserStateV4 } from '$lib/state/schema';

// ─── Quiz phases (state machine) ────────────────────────────────────────────

export type QuizPhase =
	| 'idle'
	| 'playing'
	| 'awaiting_answer'
	| 'feedback_correct'
	| 'feedback_wrong'
	| 'result_mode'
	| 'debrief';

// ─── Choice / question types ────────────────────────────────────────────────

export interface ChoiceItem {
	id: string;
	name: string;
	label: string;
}

export interface PlaybackParams {
	type: 'interval' | 'chord' | 'scale';
	rootNote: number;
	intervals: number[];
	toneType: ToneType;
	direction?: PlayMode;
	voicing?: ChordVoicing;
	arpeggiated?: boolean;
	tempo?: number;
	drone?: { note: number };
}

export interface PlaybackInfo {
	durationMs: number;
	notes: number[]; // MIDI notes being played (for viz sync)
}

export interface UnifiedQuestion {
	id: string; // content item ID (e.g., "interval:P5:ascending")
	kind: ContentKind;
	rootNote: number;
	playback: PlaybackParams;
	correctAnswer: ChoiceItem;
	choices: ChoiceItem[];
	replays: number;
	metadata?: Record<string, unknown>;
}

// ─── Results ────────────────────────────────────────────────────────────────

export interface QuestionResult {
	question: UnifiedQuestion;
	correct: boolean;
	selectedId: string;
	responseTimeMs: number;
}

export interface DebriefSection {
	label: string;
	items: { label: string; value: string }[];
}

// ─── Extra controls (e.g., ARP toggle, drone mute) ─────────────────────────

export interface ExtraControl {
	id: string;
	getLabel: () => string;
	getState: () => boolean;
	toggle: () => void;
}

// ─── Session config ─────────────────────────────────────────────────────────

export interface QuizSessionConfig {
	/** Page heading: "PRACTICE", "CHORDS", "SCALES", "MODES" */
	heading: string;
	/** Content kinds this quiz session covers. */
	contentKinds: ContentKind[];
	/** Number of questions for this session. */
	sessionLength: number;
	/** Generate the next question from current user state. */
	generateQuestion: (state: UserStateV4) => UnifiedQuestion;
	/** Play the question audio and return playback info. */
	playAudio: (question: UnifiedQuestion, state: UserStateV4) => Promise<PlaybackInfo>;
	/** Called after each answer — update stats, SM-2, etc. */
	onAnswer?: (state: UserStateV4, question: UnifiedQuestion, result: QuestionResult) => void;
	/** Format the debrief screen sections. */
	formatDebrief?: (results: QuestionResult[], state: UserStateV4) => DebriefSection[];
	/** Extra per-quiz-type controls (e.g., arp toggle, drone mute). */
	extraControls?: ExtraControl[];
	/** Countdown duration for wrong-answer result mode (ms, default 8000). */
	countdownDuration?: number;
	/** Delay before auto-advance on correct answer (ms, default 1350). */
	correctAdvanceDelay?: number;
	/** Called when the session finishes (all questions answered). */
	onSessionEnd?: (state: UserStateV4) => void;
	/** Called on mount (e.g., start drone, set up listeners). */
	onPageEnter?: () => void;
	/** Called on unmount (e.g., stop drone, tear down listeners). */
	onPageExit?: () => void;
	/** Optional guidance overlay text (e.g., FRE tutorial messages). */
	getGuidanceMessage?: (questionNum: number, phase: QuizPhase, correct?: boolean) => string | null;
	/** If true, skip debrief screen and call onSessionEnd immediately. */
	skipDebrief?: boolean;
	/** FRE mode: boot sequence, auto-play on dismiss, answer blocking during overlay. */
	freMode?: boolean;
	/** If false, nextQuestion() won't auto-play after glitch (default true). */
	autoPlay?: boolean;
	/** Replay a specific answer choice's sound (for answer card tap in result mode). */
	replayChoice?: (choiceId: string, question: UnifiedQuestion, state: UserStateV4) => Promise<void>;
	/** Path color override — if set, replaces var(--accent) for quiz visuals. */
	accentColor?: string;
}
