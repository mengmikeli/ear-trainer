export interface IntervalDef {
	id: string; // e.g. "P5", "m3", "TT"
	name: string; // e.g. "Perfect 5th"
	semitones: number; // 0-12
	tier: number; // 1-5
}

export interface IntervalState {
	interval: string;
	mode: 'choice' | 'free';
	unlocked: boolean;
	enabled: boolean;
	attempts: number;
	correct: number;
	easeFactor: number;
	nextReview: number;
	streak: number;
	lastSeen: number;
}

export type ToneType = 'sine' | 'piano';
export type Direction = 'ascending' | 'descending' | 'random';
export type SessionLength = 10 | 20 | 30;

export interface Settings {
	toneType: ToneType;
	direction: Direction;
	sessionLength: SessionLength;
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
	settings: Settings;
	stats: GlobalStats;
}

export interface Question {
	rootNote: number;
	interval: IntervalDef;
	direction: 'ascending' | 'descending';
	choices: IntervalDef[];
	replays: number;
}
