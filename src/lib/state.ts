import type { UserState, IntervalState, Settings, GlobalStats, ModeStats } from './types';
import { INTERVALS, getIntervalsByTier } from './intervals';

const STORAGE_KEY = 'ear-trainer-state';

function createDefaultModeStats(): ModeStats {
	return {
		attempts: 0,
		correct: 0,
		streak: 0,
		lastSeen: 0,
		easeFactor: 2.5,
		nextReview: 0,
	};
}

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
			modes: {
				ascending: createDefaultModeStats(),
				descending: createDefaultModeStats(),
				harmonic: createDefaultModeStats(),
			},
		};
	}

	const settings: Settings = {
		toneType: 'epiano',
		direction: 'ascending',
		sessionLength: 20,
		theme: 'dark',
		enabledModes: {
			ascending: true,
			descending: true,
			harmonic: true,
		},
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
		const parsed = JSON.parse(raw) as any;

		// Migrate: add enabled field if missing (v1 compat)
		for (const id of Object.keys(parsed.intervals)) {
			if (parsed.intervals[id].enabled === undefined) {
				parsed.intervals[id].enabled = true;
			}
		}
		if (parsed.settings.theme === undefined) {
			parsed.settings.theme = 'dark';
		}

		// Migrate v2 → v3: add per-mode stats if missing
		for (const id of Object.keys(parsed.intervals)) {
			const interval = parsed.intervals[id];
			if (!interval.modes) {
				const oldDirection = parsed.settings?.direction ?? 'ascending';

				// Determine which mode gets the existing stats
				const targetMode: 'ascending' | 'descending' =
					oldDirection === 'descending' ? 'descending' : 'ascending';

				const existingStats: ModeStats = {
					attempts: interval.attempts ?? 0,
					correct: interval.correct ?? 0,
					streak: interval.streak ?? 0,
					lastSeen: interval.lastSeen ?? 0,
					easeFactor: interval.easeFactor ?? 2.5,
					nextReview: interval.nextReview ?? 0,
				};

				interval.modes = {
					ascending: targetMode === 'ascending' ? { ...existingStats } : createDefaultModeStats(),
					descending: targetMode === 'descending' ? { ...existingStats } : createDefaultModeStats(),
					harmonic: createDefaultModeStats(),
				};
			}
		}

		// Migrate settings: add enabledModes if missing
		if (!parsed.settings.enabledModes) {
			const oldDirection = parsed.settings?.direction ?? 'ascending';
			if (oldDirection === 'descending') {
				parsed.settings.enabledModes = { ascending: false, descending: true, harmonic: false };
			} else if (oldDirection === 'random') {
				parsed.settings.enabledModes = { ascending: true, descending: true, harmonic: false };
			} else {
				// ascending or any unknown
				parsed.settings.enabledModes = { ascending: true, descending: false, harmonic: false };
			}
		}

		const result = checkTierUnlock(parsed as UserState);
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

export function getAggregateStats(state: IntervalState): { attempts: number; correct: number; accuracy: number } {
	const attempts = state.modes.ascending.attempts + state.modes.descending.attempts + state.modes.harmonic.attempts;
	const correct = state.modes.ascending.correct + state.modes.descending.correct + state.modes.harmonic.correct;
	const accuracy = attempts > 0 ? correct / attempts : 0;
	return { attempts, correct, accuracy };
}

const TIER_THRESHOLDS: Record<number, { questions: number; accuracy: number }> = {
	2: { questions: 10, accuracy: 0.7 },
	3: { questions: 30, accuracy: 0.7 },
	4: { questions: 60, accuracy: 0.7 },
	5: { questions: 100, accuracy: 0.7 },
};

export function checkTierUnlock(state: UserState): UserState {
	const updated = JSON.parse(JSON.stringify(state)) as UserState;

	// Count total attempts and correct across all unlocked intervals using aggregate stats from modes
	let totalAttempts = 0;
	let totalCorrect = 0;
	for (const def of INTERVALS) {
		const s = updated.intervals[def.id];
		if (s.unlocked) {
			const agg = getAggregateStats(s);
			totalAttempts += agg.attempts;
			totalCorrect += agg.correct;
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
