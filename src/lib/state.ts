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
			enabled: true,
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
		theme: 'dark',
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
		// Migrate: add enabled field if missing (backwards compat)
		const parsed = JSON.parse(raw) as UserState;
		for (const id of Object.keys(parsed.intervals)) {
			if (parsed.intervals[id].enabled === undefined) {
				parsed.intervals[id].enabled = true;
			}
		}
		if (parsed.settings.theme === undefined) {
			(parsed.settings as any).theme = 'dark';
		}
		const result = checkTierUnlock(parsed);
		// Persist any newly unlocked tiers
		if (JSON.stringify(result) !== JSON.stringify(parsed)) {
			try { storage.setItem(STORAGE_KEY, JSON.stringify(result)); } catch {}
		}
		return result;
	} catch {
		return createDefaultState();
	}
}

export function saveState(state: UserState, storage: Storage = localStorage): void {
	storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const TIER_THRESHOLDS: Record<number, { questions: number; accuracy: number }> = {
	2: { questions: 10, accuracy: 0.7 },
	3: { questions: 30, accuracy: 0.7 },
	4: { questions: 60, accuracy: 0.7 },
	5: { questions: 100, accuracy: 0.7 },
};

export function checkTierUnlock(state: UserState): UserState {
	const updated = JSON.parse(JSON.stringify(state)) as UserState;

	// Count total attempts and correct across all unlocked intervals
	let totalAttempts = 0;
	let totalCorrect = 0;
	for (const def of INTERVALS) {
		const s = updated.intervals[def.id];
		if (s.unlocked) {
			totalAttempts += s.attempts;
			totalCorrect += s.correct;
		}
	}
	const overallAccuracy = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;

	for (let tier = 2; tier <= 5; tier++) {
		const threshold = TIER_THRESHOLDS[tier];
		// Check if already unlocked (skip re-checking)
		const tierIntervals = getIntervalsByTier(tier);
		const alreadyUnlocked = tierIntervals.every(def => updated.intervals[def.id].unlocked);
		if (alreadyUnlocked) continue;

		// Previous tier must be unlocked first
		const prevTierUnlocked = getIntervalsByTier(tier - 1).every(
			def => updated.intervals[def.id].unlocked
		);
		if (!prevTierUnlocked) continue;

		if (totalAttempts >= threshold.questions && overallAccuracy >= threshold.accuracy) {
			for (const def of tierIntervals) {
				updated.intervals[def.id].unlocked = true;
			}
			// Recalculate totals to include newly unlocked intervals (they start at 0)
		}
	}

	return updated;
}
