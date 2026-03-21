import type { UserState, IntervalState, Settings, GlobalStats } from './types';
import { INTERVALS, getIntervalsByTier } from './intervals';

const STORAGE_KEY = 'ear-trainer-state';

export function createDefaultState(): UserState {
	const intervals: Record<string, IntervalState> = {};
	for (const def of INTERVALS) {
		intervals[def.id] = {
			interval: def.id,
			mode: 'choice',
			unlocked: def.tier === 1,
			attempts: 0,
			correct: 0,
			easeFactor: 2.5,
			nextReview: 0,
			streak: 0,
			lastSeen: 0,
		};
	}

	const settings: Settings = {
		toneType: 'sine',
		direction: 'ascending',
		sessionLength: 20,
	};

	const stats: GlobalStats = {
		totalSessions: 0,
		totalQuestions: 0,
		currentStreak: 0,
		bestStreak: 0,
		lastPractice: 0,
	};

	return { intervals, settings, stats };
}

export function loadState(storage: Storage = localStorage): UserState {
	try {
		const raw = storage.getItem(STORAGE_KEY);
		if (!raw) return createDefaultState();
		return JSON.parse(raw) as UserState;
	} catch {
		return createDefaultState();
	}
}

export function saveState(state: UserState, storage: Storage = localStorage): void {
	storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function checkTierUnlock(state: UserState): UserState {
	const updated = JSON.parse(JSON.stringify(state)) as UserState;

	for (let tier = 2; tier <= 5; tier++) {
		const prevTierIntervals = getIntervalsByTier(tier - 1);
		const allQualified = prevTierIntervals.every((def) => {
			const s = updated.intervals[def.id];
			return s && s.attempts >= 10 && s.correct / s.attempts >= 0.8;
		});

		if (allQualified) {
			for (const def of getIntervalsByTier(tier)) {
				updated.intervals[def.id].unlocked = true;
			}
		}
	}

	return updated;
}
