export interface IntervalDef {
	id: string; // e.g. "P5", "m3", "TT"
	name: string; // e.g. "Perfect 5th"
	semitones: number; // 0-12
	tier: number; // 1-5
}

export type PlayMode = 'ascending' | 'descending' | 'harmonic';

export interface ModeStats {
	attempts: number;
	correct: number;
	streak: number;
	lastSeen: number;
	easeFactor: number;
	nextReview: number;
}

export interface IntervalState {
	interval: string;
	mode: 'choice' | 'free';
	unlocked: boolean;
	enabled: boolean;
	// Aggregate stats (computed from modes, kept for backward compat)
	attempts: number;
	correct: number;
	easeFactor: number;
	nextReview: number;
	streak: number;
	lastSeen: number;
	// Per-mode tracking (v3)
	modes: {
		ascending: ModeStats;
		descending: ModeStats;
		harmonic: ModeStats;
	};
}

export type ToneType = 'epiano' | 'sine' | 'piano';
export type Direction = 'ascending' | 'descending' | 'random';
export type SessionLength = 10 | 20 | 30;
export type ThemeMode = 'light' | 'dark' | 'system';

export interface Settings {
	toneType: ToneType;
	direction: Direction; // kept for backward compat during migration
	sessionLength: SessionLength;
	theme: ThemeMode;
	// v3: which modes are enabled
	enabledModes: {
		ascending: boolean;
		descending: boolean;
		harmonic: boolean;
	};
	// v3.3: chord voicings
	enabledVoicings: {
		root: boolean;
		first: boolean;
		second: boolean;
	};
	// v3.3: which content type the Practice button launches
	activeContent: 'intervals' | 'chords';
}

export interface GlobalStats {
	totalSessions: number;
	totalQuestions: number;
	currentStreak: number;
	bestStreak: number;
	lastPractice: number;
}

export interface UserState {
	intervals: Record<string, IntervalState>;
	chords: Record<string, ChordState>;
	settings: Settings;
	stats: GlobalStats;
}

export interface Question {
	rootNote: number;
	interval: IntervalDef;
	direction: 'ascending' | 'descending'; // keep for audio
	playMode: PlayMode; // the actual mode for this question
	choices: IntervalDef[];
	replays: number;
}

// --- Chord types (v3.3) ---

export type ChordCategory = 'triad' | 'seventh';

export interface ChordDef {
	id: string;            // e.g. "maj", "min", "dim", "aug", "dom7"
	name: string;          // e.g. "Major", "Minor 7th"
	intervals: number[];   // semitones from root, e.g. [0, 4, 7]
	tier: number;          // 1-4 unlock tier (chord-specific)
	category: ChordCategory;
}

export type ChordVoicing = 'root' | 'first' | 'second';

export interface ChordState {
	chord: string;         // chord id
	unlocked: boolean;
	enabled: boolean;
	// Aggregate stats (backward compat pattern)
	attempts: number;
	correct: number;
	easeFactor: number;
	nextReview: number;
	streak: number;
	lastSeen: number;
	// Per-voicing tracking
	voicings: {
		root: ModeStats;
		first: ModeStats;
		second: ModeStats;
	};
}

export interface ChordQuestion {
	rootNote: number;
	chord: ChordDef;
	voicing: ChordVoicing;
	choices: ChordDef[];
	replays: number;
}
