/**
 * Mode quiz config factory.
 *
 * Bridges mode quiz logic to the unified QuizSessionConfig.
 * Manages drone lifecycle via onPageEnter/onPageExit/extraControls.
 */

import type { QuizSessionConfig, UnifiedQuestion, QuestionResult, PlaybackInfo } from '../types';
import type { UserStateV4 } from '$lib/state/schema';
import { defaultContentStats } from '$lib/state/schema';
import { getStats } from '$lib/state/stats';
import { playScale } from '$lib/audio/playback';
import { startDrone, stopDrone, forceStopDrone, type DroneHandle } from '$lib/audio/drone';
import { responseQuality, calculateSm2 } from '$lib/learning/sm2';
import { MODES, type ModeDef } from '$lib/definitions/modes';

import { MODE_TEMPO } from '$lib/audio/tempo';
const TEMPO = MODE_TEMPO;

// ─── Helpers ────────────────────────────────────────────────────────────────

function getEnabledModesV4(state: UserStateV4): ModeDef[] {
	const devMode = state.settings.devMode;
	if (devMode) return MODES;
	return MODES.filter((def) => {
		const d = state.definitions.modes[def.id];
		return d?.unlocked && d?.enabled;
	});
}

function weightedPick<T>(items: { item: T; weight: number }[]): T {
	const total = items.reduce((s, w) => s + w.weight, 0);
	let roll = Math.random() * total;
	for (const w of items) {
		roll -= w.weight;
		if (roll <= 0) return w.item;
	}
	return items[items.length - 1].item;
}

function generateModeDistractorsV4(correctId: string, state: UserStateV4): ModeDef[] {
	const correctDef = MODES.find((m) => m.id === correctId);
	const correctIntervals = new Set(correctDef?.intervals ?? []);

	const enabled = getEnabledModesV4(state).filter((m) => m.id !== correctId);
	const shuffled = [...enabled].sort(() => Math.random() - 0.5);
	if (shuffled.length >= 3) return shuffled.slice(0, 3);

	const usedIds = new Set([correctId, ...shuffled.map((m) => m.id)]);
	const remaining = MODES.filter((m) => !usedIds.has(m.id)).sort((a, b) => {
		const sharedA = a.intervals.filter((i) => correctIntervals.has(i)).length;
		const sharedB = b.intervals.filter((i) => correctIntervals.has(i)).length;
		return sharedB - sharedA;
	});

	const result = [...shuffled];
	for (const def of remaining) {
		if (result.length >= 3) break;
		result.push(def);
	}
	return result;
}

// ─── Config factory ─────────────────────────────────────────────────────────

export function createModeConfig(state: UserStateV4): QuizSessionConfig {
	let drone: DroneHandle | null = null;
	let droneMuted = false;
	let noteTimeouts: ReturnType<typeof setTimeout>[] = [];

	return {
		heading: 'MODES',
		contentKinds: ['mode'],
		sessionLength: state.settings.sessionLength,

		extraControls: [
			{
				id: 'drone',
				getLabel: () => 'DRN',
				getState: () => !droneMuted,
				toggle: () => {
					droneMuted = !droneMuted;
					if (drone) drone.setMuted(droneMuted);
				},
			},
		],

		onPageExit() {
			forceStopDrone();
			drone = null;
			noteTimeouts.forEach(clearTimeout);
			noteTimeouts = [];
		},

		onSessionEnd() {
			stopDrone();
			drone = null;
			noteTimeouts.forEach(clearTimeout);
			noteTimeouts = [];
		},

		generateQuestion(s: UserStateV4): UnifiedQuestion {
			const enabled = getEnabledModesV4(s);
			if (enabled.length === 0) throw new Error('No enabled modes');
			const now = Date.now();

			const weights = enabled.map((def) => {
				const st = getStats(s.stats, `mode:${def.id}`);
				const accuracy = st.attempts > 0 ? st.correct / st.attempts : 0.5;
				const weaknessWeight = 1 - accuracy;
				const overdue = st.nextReview > 0 ? Math.max(0, now - st.nextReview) : 0;
				const reviewWeight = Math.min(1, overdue / (24 * 60 * 60 * 1000));
				const newBoost = st.attempts === 0 ? 0.5 : 0;
				return { item: def, weight: 0.1 + weaknessWeight * 0.5 + reviewWeight * 0.3 + newBoost };
			});

			const mode = weightedPick(weights);
			const rootNote = 48 + Math.floor(Math.random() * 13);

			const distractors = generateModeDistractorsV4(mode.id, s);
			const seen = new Set<string>();
			const raw = [mode, ...distractors].filter((c) => {
				if (seen.has(c.id)) return false;
				seen.add(c.id);
				return true;
			});
			const choices = raw.sort(() => Math.random() - 0.5);

			return {
				id: `mode:${mode.id}`,
				kind: 'mode',
				rootNote,
				playback: {
					type: 'scale',
					rootNote,
					intervals: mode.intervals,
					toneType: s.settings.toneType,
					tempo: TEMPO,
					drone: { note: rootNote },
				},
				correctAnswer: { id: mode.id, name: mode.name, label: mode.label },
				choices: choices.map((c) => ({ id: c.id, name: c.name, label: c.label })),
				replays: 0,
				metadata: { modeIntervals: mode.intervals, droneNote: rootNote },
			};
		},

		async playAudio(q: UnifiedQuestion): Promise<PlaybackInfo> {
			// Clear pending note timeouts
			noteTimeouts.forEach(clearTimeout);
			noteTimeouts = [];

			// Drone management
			const droneLeadIn = 400;
			const droneTail = 300; // short tail — just enough to let last note ring

			stopDrone();
			drone = null;
			const droneNote = (q.metadata?.droneNote as number) ?? q.rootNote;
			startDrone(droneNote).then((h) => {
				drone = h;
				if (droneMuted) h.setMuted(true);
			});

			// Delay scale notes for drone lead-in
			const tempo = q.playback.tempo ?? TEMPO;
			await new Promise<void>((resolve) => {
				noteTimeouts.push(
					setTimeout(() => {
						playScale(q.rootNote, q.playback.intervals, q.playback.toneType, tempo);
						resolve();
					}, droneLeadIn),
				);
			});

			const notesDur = q.playback.intervals.length * tempo + 400;

			// Stop drone after notes + tail
			noteTimeouts.push(
				setTimeout(() => {
					stopDrone();
					drone = null;
				}, notesDur + droneTail),
			);

			return {
				durationMs: droneLeadIn + notesDur,
				notes: q.playback.intervals.map((s: number) => q.rootNote + s),
			};
		},

		async replayChoice(choiceId: string, question: UnifiedQuestion): Promise<void> {
			const def = MODES.find((m) => m.id === choiceId);
			if (!def) return;

			// Clear pending note timeouts
			noteTimeouts.forEach(clearTimeout);
			noteTimeouts = [];

			// Drone management — same as playAudio
			const droneLeadIn = 400;
			const droneTail = 300;

			stopDrone();
			drone = null;
			const droneNote = (question.metadata?.droneNote as number) ?? question.rootNote;
			startDrone(droneNote).then((h) => {
				drone = h;
				if (droneMuted) h.setMuted(true);
			});

			const tempo = question.playback.tempo ?? TEMPO;
			await new Promise<void>((resolve) => {
				noteTimeouts.push(
					setTimeout(() => {
						playScale(question.rootNote, def.intervals, question.playback.toneType, tempo);
						resolve();
					}, droneLeadIn),
				);
			});

			const notesDur = def.intervals.length * tempo + 400;
			noteTimeouts.push(
				setTimeout(() => {
					stopDrone();
					drone = null;
				}, notesDur + droneTail),
			);
		},

		onAnswer(s: UserStateV4, q: UnifiedQuestion, result: QuestionResult) {
			const statsKey = `mode:${q.correctAnswer.id}`;
			if (!s.stats[statsKey]) s.stats[statsKey] = defaultContentStats();
			const st = s.stats[statsKey];
			st.attempts++;
			if (result.correct) {
				st.correct++;
				st.streak++;
			} else {
				st.streak = 0;
			}
			st.lastSeen = Date.now();

			const quality = responseQuality({
				correct: result.correct,
				replays: q.replays,
				responseTimeMs: result.responseTimeMs,
			});
			const sm2 = calculateSm2(st.easeFactor, quality);
			st.easeFactor = sm2.easeFactor;
			st.nextReview = Date.now() + sm2.intervalMs;

			// Stop drone on correct (moving to next question)
			if (result.correct) {
				stopDrone();
				drone = null;
			}
		},
	};
}
