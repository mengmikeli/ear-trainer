/**
 * Adaptive quiz config factory.
 *
 * Mixed-content quiz that draws from all enabled content types.
 * Uses weighted pick across all content kinds rather than the old
 * planSession() (which depends on legacy UserState types).
 *
 * This will be upgraded to use a v4-native session planner in Phase 5.
 */

import type { QuizSessionConfig, UnifiedQuestion, QuestionResult, DebriefSection, PlaybackInfo } from '../types';
import type { UserStateV4, ContentKind, ChordVoicing } from '$lib/state/schema';
import { defaultContentStats } from '$lib/state/schema';
import { getStats, getStatsByKind, aggregateStats } from '$lib/state/stats';
import { playInterval } from '$lib/audio/playback';
import { playChord } from '$lib/audio/playback';
import { playScale } from '$lib/audio/playback';
import { startDrone, stopDrone, type DroneHandle } from '$lib/audio/drone';
import { responseQuality, calculateSm2 } from '$lib/learning/sm2';
import { INTERVALS, type IntervalDef } from '$lib/definitions/intervals';
import { CHORDS, type ChordDef } from '$lib/definitions/chords';
import { SCALES, type ScaleDef } from '$lib/definitions/scales';
import { MODES, type ModeDef } from '$lib/definitions/modes';
import { isContentKindAvailable } from '$lib/features/content-access';
import type { PlayMode } from '$lib/state/schema';
import { SCALE_TEMPO, MODE_TEMPO } from '$lib/audio/tempo';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Determine which content kinds the user has earned access to (uses shared isContentKindAvailable). */
function getUnlockedKinds(state: UserStateV4): ContentKind[] {
	const allKinds: ContentKind[] = ['interval', 'chord', 'scale', 'mode'];
	return allKinds.filter(kind => isContentKindAvailable(state, kind));
}

interface Weighted<T> { item: T; weight: number }

function weightedPick<T>(items: Weighted<T>[]): T {
	const total = items.reduce((s, w) => s + w.weight, 0);
	let roll = Math.random() * total;
	for (const w of items) {
		roll -= w.weight;
		if (roll <= 0) return w.item;
	}
	return items[items.length - 1].item;
}

interface ContentCandidate {
	kind: ContentKind;
	defId: string;
	variant?: string;
	statsKey: string;
}

function buildCandidates(state: UserStateV4, unlockedKinds: ContentKind[]): ContentCandidate[] {
	const candidates: ContentCandidate[] = [];
	const kindSet = new Set(unlockedKinds);

	// Intervals
	if (kindSet.has('interval')) {
	const devMode = state.settings.devMode;
	for (const def of INTERVALS) {
		const d = state.definitions.intervals[def.id];
		if (!devMode && (!d?.unlocked || !d?.enabled)) continue;
		for (const mode of ['ascending', 'descending', 'harmonic'] as const) {
			if (!state.settings.enabledModes[mode]) continue;
			candidates.push({
				kind: 'interval',
				defId: def.id,
				variant: mode,
				statsKey: `interval:${def.id}:${mode}`,
			});
		}
	}
	}

	// Chords
	if (kindSet.has('chord')) {
	const devMode = state.settings.devMode;
	for (const def of CHORDS) {
		const d = state.definitions.chords[def.id];
		if (!devMode && (!d?.unlocked || !d?.enabled)) continue;
		for (const voicing of ['root', 'first', 'second'] as const) {
			if (!state.settings.enabledVoicings[voicing]) continue;
			candidates.push({
				kind: 'chord',
				defId: def.id,
				variant: voicing,
				statsKey: `chord:${def.id}:${voicing}`,
			});
		}
	}
	}

	// Scales
	if (kindSet.has('scale')) {
	const devMode = state.settings.devMode;
	for (const def of SCALES) {
		const d = state.definitions.scales[def.id];
		if (!devMode && (!d?.unlocked || !d?.enabled)) continue;
		candidates.push({
			kind: 'scale',
			defId: def.id,
			statsKey: `scale:${def.id}`,
		});
	}
	}

	// Modes
	if (kindSet.has('mode')) {
	const devMode = state.settings.devMode;
	for (const def of MODES) {
		const d = state.definitions.modes[def.id];
		if (!devMode && (!d?.unlocked || !d?.enabled)) continue;
		candidates.push({
			kind: 'mode',
			defId: def.id,
			statsKey: `mode:${def.id}`,
		});
	}
	}

	return candidates;
}

function pickCandidate(state: UserStateV4, candidates: ContentCandidate[]): ContentCandidate {
	const now = Date.now();
	const weights = candidates.map((c) => {
		const s = getStats(state.stats, c.statsKey);
		const accuracy = s.attempts > 0 ? s.correct / s.attempts : 0.5;
		const weaknessWeight = 1 - accuracy;
		const overdue = s.nextReview > 0 ? Math.max(0, now - s.nextReview) : 0;
		const reviewWeight = Math.min(1, overdue / (24 * 60 * 60 * 1000));
		const newBoost = s.attempts === 0 ? 0.5 : 0;
		return { item: c, weight: 0.1 + weaknessWeight * 0.5 + reviewWeight * 0.3 + newBoost };
	});
	return weightedPick(weights);
}

function generateDistractorsForKind(
	kind: ContentKind,
	correctId: string,
	state: UserStateV4,
): { id: string; name: string; label: string }[] {
	if (kind === 'interval') {
		const correctDef = INTERVALS.find((i) => i.id === correctId);
		const sem = correctDef?.semitones ?? 0;
		const devMode = state.settings.devMode;
		const enabled = INTERVALS.filter(
			(i) => i.id !== correctId && (devMode || (state.definitions.intervals[i.id]?.unlocked && state.definitions.intervals[i.id]?.enabled)),
		);
		// Sort by proximity (closest semitones = most confusable)
		// Take top ~8 closest, then randomly pick 3
		const byProximity = [...enabled].sort((a, b) => {
			const distA = Math.abs(a.semitones - sem);
			const distB = Math.abs(b.semitones - sem);
			return distA - distB;
		});
		const pool = byProximity.slice(0, Math.min(8, byProximity.length));
		const shuffled = pool.sort(() => Math.random() - 0.5);
		const result = shuffled.length >= 3 ? shuffled.slice(0, 3) : shuffled;
		if (result.length < 3) {
			const usedIds = new Set([correctId, ...result.map((i) => i.id)]);
			const locked = INTERVALS.filter((i) => !usedIds.has(i.id))
				.sort((a, b) => Math.abs(a.semitones - sem) - Math.abs(b.semitones - sem));
			for (const d of locked) {
				if (result.length >= 3) break;
				result.push(d);
			}
		}
		return result.map((i) => ({ id: i.id, name: i.name, label: i.id }));
	}

	if (kind === 'chord') {
		const correctDef = CHORDS.find((c) => c.id === correctId);
		const correctInts = new Set(correctDef?.intervals ?? []);
		const devMode = state.settings.devMode;
		const enabled = CHORDS.filter(
			(c) => c.id !== correctId && (devMode || (state.definitions.chords[c.id]?.unlocked && state.definitions.chords[c.id]?.enabled)),
		);
		const sorted = [...enabled].sort(() => Math.random() - 0.5);
		const result = sorted.length >= 3 ? sorted.slice(0, 3) : sorted;
		if (result.length < 3) {
			const usedIds = new Set([correctId, ...result.map((c) => c.id)]);
			const locked = CHORDS.filter((c) => !usedIds.has(c.id))
				.sort((a, b) => {
					const sharedA = a.intervals.filter((i) => correctInts.has(i)).length;
					const sharedB = b.intervals.filter((i) => correctInts.has(i)).length;
					return sharedB - sharedA;
				});
			for (const d of locked) {
				if (result.length >= 3) break;
				result.push(d);
			}
		}
		return result.map((c) => ({ id: c.id, name: c.name, label: c.label ?? c.id.toUpperCase() }));
	}

	if (kind === 'scale') {
		const correctDef = SCALES.find((s) => s.id === correctId);
		const correctInts = new Set(correctDef?.intervals ?? []);
		const devMode = state.settings.devMode;
		const enabled = SCALES.filter(
			(s) => s.id !== correctId && (devMode || (state.definitions.scales[s.id]?.unlocked && state.definitions.scales[s.id]?.enabled)),
		);
		const sorted = [...enabled].sort(() => Math.random() - 0.5);
		const result = sorted.length >= 3 ? sorted.slice(0, 3) : sorted;
		if (result.length < 3) {
			const usedIds = new Set([correctId, ...result.map((s) => s.id)]);
			const locked = SCALES.filter((s) => !usedIds.has(s.id))
				.sort((a, b) => {
					const sharedA = a.intervals.filter((i) => correctInts.has(i)).length;
					const sharedB = b.intervals.filter((i) => correctInts.has(i)).length;
					return sharedB - sharedA;
				});
			for (const d of locked) {
				if (result.length >= 3) break;
				result.push(d);
			}
		}
		return result.map((s) => ({ id: s.id, name: s.name, label: s.label }));
	}

	// mode
	const correctDef = MODES.find((m) => m.id === correctId);
	const correctInts = new Set(correctDef?.intervals ?? []);
	const devMode = state.settings.devMode;
	const enabled = MODES.filter((m) => {
		if (m.id === correctId) return false;
		if (devMode) return true;
		const d = state.definitions.modes[m.id];
		return d?.unlocked && d?.enabled;
	});
	const sorted = [...enabled].sort(() => Math.random() - 0.5);
	const result = sorted.length >= 3 ? sorted.slice(0, 3) : sorted;
	if (result.length < 3) {
		const usedIds = new Set([correctId, ...result.map((m) => m.id)]);
		const remaining = MODES.filter((m) => !usedIds.has(m.id))
			.sort((a, b) => {
				const sharedA = a.intervals.filter((i) => correctInts.has(i)).length;
				const sharedB = b.intervals.filter((i) => correctInts.has(i)).length;
				return sharedB - sharedA;
			});
		for (const d of remaining) {
			if (result.length >= 3) break;
			result.push(d);
		}
	}
	return result.map((m) => ({ id: m.id, name: m.name, label: m.label }));
}

// ─── Config factory ─────────────────────────────────────────────────────────

const kindLabel: Record<string, string> = {
	interval: 'INTERVALS',
	chord: 'CHORDS',
	scale: 'SCALES',
	mode: 'MODES',
};

const kindGlyph: Record<string, string> = {
	interval: '\uE007',
	chord: '\uE000',
	scale: '\uE013',
	mode: '\uE014',
};

export function createAdaptiveConfig(state: UserStateV4): QuizSessionConfig {
	let drone: DroneHandle | null = null;
	let noteTimeouts: ReturnType<typeof setTimeout>[] = [];
	let lastKind: ContentKind | null = null;

	return {
		heading: 'PRACTICE',
		contentKinds: ['interval', 'chord', 'scale', 'mode'],
		sessionLength: state.settings.sessionLength,

		onPageExit() {
			stopDrone();
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
			const unlockedKinds = getUnlockedKinds(s);
			const candidates = buildCandidates(s, unlockedKinds);
			if (candidates.length === 0) throw new Error('No content available');

			// Prefer different kind from last question for variety
			let pool = candidates;
			if (lastKind && candidates.filter((c) => c.kind !== lastKind).length >= 4) {
				pool = candidates.filter((c) => c.kind !== lastKind);
			}

			const picked = pickCandidate(s, pool);
			lastKind = picked.kind;

			if (picked.kind === 'interval') {
				const def = INTERVALS.find((i) => i.id === picked.defId)!;
				const playMode = (picked.variant ?? 'ascending') as PlayMode;
				const direction = playMode as 'ascending' | 'descending';
				const maxRoot = direction === 'ascending' || playMode === 'harmonic' ? 84 - def.semitones : 84;
				const minRoot = direction === 'descending' ? 48 + def.semitones : 48;
				const rootNote = minRoot + Math.floor(Math.random() * (maxRoot - minRoot + 1));

				const distractors = generateDistractorsForKind('interval', def.id, s);
				const correct = { id: def.id, name: def.name, label: def.id };
				const seen = new Set<string>();
				const choices = [correct, ...distractors]
					.filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; })
					.sort(() => Math.random() - 0.5);

				return {
					id: picked.statsKey,
					kind: 'interval',
					rootNote,
					playback: { type: 'interval', rootNote, intervals: [def.semitones], toneType: s.settings.toneType, direction: playMode },
					correctAnswer: correct,
					choices,
					replays: 0,
					metadata: { playMode, semitones: def.semitones },
				};
			}

			if (picked.kind === 'chord') {
				const def = CHORDS.find((c) => c.id === picked.defId)!;
				const voicing = (picked.variant ?? 'root') as ChordVoicing;
				const maxSemitone = Math.max(...def.intervals);
				const inversionBoost = voicing === 'second' ? 12 : voicing === 'first' ? 12 : 0;
				const maxRoot = Math.min(72, 84 - maxSemitone - inversionBoost);
				const rootNote = 48 + Math.floor(Math.random() * Math.max(1, maxRoot - 48 + 1));

				const distractors = generateDistractorsForKind('chord', def.id, s);
				const correct = { id: def.id, name: def.name, label: def.label ?? def.id.toUpperCase() };
				const seen = new Set<string>();
				const choices = [correct, ...distractors]
					.filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; })
					.sort(() => Math.random() - 0.5);

				return {
					id: picked.statsKey,
					kind: 'chord',
					rootNote,
					playback: { type: 'chord', rootNote, intervals: def.intervals, toneType: s.settings.toneType, voicing },
					correctAnswer: correct,
					choices,
					replays: 0,
					metadata: { voicing, chordIntervals: def.intervals },
				};
			}

			if (picked.kind === 'scale') {
				const def = SCALES.find((sc) => sc.id === picked.defId)!;
				const highestInterval = Math.max(...def.intervals);
				const maxRoot = 72 - highestInterval;
				const rootNote = 48 + Math.floor(Math.random() * Math.max(1, maxRoot - 48 + 1));

				const distractors = generateDistractorsForKind('scale', def.id, s);
				const correct = { id: def.id, name: def.name, label: def.label };
				const seen = new Set<string>();
				const choices = [correct, ...distractors]
					.filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; })
					.sort(() => Math.random() - 0.5);

				return {
					id: picked.statsKey,
					kind: 'scale',
					rootNote,
					playback: { type: 'scale', rootNote, intervals: def.intervals, toneType: s.settings.toneType, tempo: SCALE_TEMPO },
					correctAnswer: correct,
					choices,
					replays: 0,
					metadata: { scaleIntervals: def.intervals },
				};
			}

			// mode
			const def = MODES.find((m) => m.id === picked.defId)!;
			const rootNote = 48 + Math.floor(Math.random() * 13);

			const distractors = generateDistractorsForKind('mode', def.id, s);
			const correct = { id: def.id, name: def.name, label: def.label };
			const seen = new Set<string>();
			const choices = [correct, ...distractors]
				.filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; })
				.sort(() => Math.random() - 0.5);

			return {
				id: picked.statsKey,
				kind: 'mode',
				rootNote,
				playback: { type: 'scale', rootNote, intervals: def.intervals, toneType: s.settings.toneType, tempo: MODE_TEMPO, drone: { note: rootNote } },
				correctAnswer: correct,
				choices,
				replays: 0,
				metadata: { modeIntervals: def.intervals, droneNote: rootNote },
			};
		},

		async playAudio(q: UnifiedQuestion): Promise<PlaybackInfo> {
			noteTimeouts.forEach(clearTimeout);
			noteTimeouts = [];

			// Stop previous drone if switching away from mode
			if (q.kind !== 'mode') {
				stopDrone();
				drone = null;
			}

			if (q.playback.type === 'interval') {
				const semitones = q.playback.intervals[0];
				await playInterval(
					q.rootNote, semitones,
					q.playback.direction! as 'ascending' | 'descending' | 'harmonic',
					q.playback.toneType,
				);
				const secondMidi = q.playback.direction === 'descending' ? q.rootNote - semitones : q.rootNote + semitones;
				const isHarmonic = q.playback.direction === 'harmonic';
				const gap = q.playback.toneType === 'piano' ? 0.3 : 0.15;
				return {
					durationMs: isHarmonic ? 1200 : (0.6 * 2 + gap) * 1000 + 200,
					notes: isHarmonic ? [q.rootNote, secondMidi] : [q.rootNote],
				};
			}

			if (q.playback.type === 'chord') {
				const voicing = (q.playback.voicing ?? 'root') as ChordVoicing;
				await playChord(q.rootNote, q.playback.intervals, voicing, q.playback.toneType);
				return {
					durationMs: 1400,
					notes: q.playback.intervals.map((s: number) => q.rootNote + s),
				};
			}

			// scale or mode
			if (q.kind === 'mode' && q.playback.drone) {
				stopDrone();
				drone = null;
				startDrone(q.playback.drone.note).then((h) => { drone = h; });
				const tempo = q.playback.tempo ?? MODE_TEMPO;
				const droneLeadIn = 400;
				await new Promise<void>((resolve) => {
					noteTimeouts.push(setTimeout(() => {
						playScale(q.rootNote, q.playback.intervals, q.playback.toneType, tempo);
						resolve();
					}, droneLeadIn));
				});
				const notesDur = q.playback.intervals.length * tempo + 400;
				noteTimeouts.push(setTimeout(() => { stopDrone(); drone = null; }, notesDur + 300));
				return { durationMs: droneLeadIn + notesDur, notes: q.playback.intervals.map((s: number) => q.rootNote + s) };
			}

			const tempo = q.playback.tempo ?? SCALE_TEMPO;
			await playScale(q.rootNote, q.playback.intervals, q.playback.toneType, tempo);
			return {
				durationMs: q.playback.intervals.length * tempo + 200,
				notes: q.playback.intervals.map((s: number) => q.rootNote + s),
			};
		},

		onAnswer(s: UserStateV4, q: UnifiedQuestion, result: QuestionResult) {
			const statsKey = q.id;
			if (!s.stats[statsKey]) s.stats[statsKey] = defaultContentStats();
			const st = s.stats[statsKey];
			st.attempts++;
			if (result.correct) { st.correct++; st.streak++; } else { st.streak = 0; }
			st.lastSeen = Date.now();

			const quality = responseQuality({
				correct: result.correct,
				replays: q.replays,
				responseTimeMs: result.responseTimeMs,
			});
			const sm2 = calculateSm2(st.easeFactor, quality);
			st.easeFactor = sm2.easeFactor;
			st.nextReview = Date.now() + sm2.intervalMs;

			// Stop drone on correct mode answer
			if (result.correct && q.kind === 'mode') {
				stopDrone();
				drone = null;
			}
		},

		formatDebrief(results: QuestionResult[]): DebriefSection[] {
			const kinds: Record<string, { total: number; correct: number }> = {};
			for (const r of results) {
				const k = r.question.kind;
				if (!kinds[k]) kinds[k] = { total: 0, correct: 0 };
				kinds[k].total++;
				if (r.correct) kinds[k].correct++;
			}
			if (Object.keys(kinds).length <= 1) return [];

			return [{
				label: 'PER TYPE',
				items: Object.entries(kinds).map(([kind, stats]) => ({
					label: `${kindGlyph[kind] ?? '-'} ${kindLabel[kind] ?? kind}`,
					value: `${stats.correct}/${stats.total}  ${Math.round((stats.correct / stats.total) * 100)}%`,
				})),
			}];
		},
	};
}
