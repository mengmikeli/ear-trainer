/**
 * Chord quiz config factory.
 *
 * Bridges chord quiz logic to the unified QuizSessionConfig.
 */

import type { QuizSessionConfig, UnifiedQuestion, QuestionResult, DebriefSection, PlaybackInfo } from '../types';
import type { UserStateV4, ContentStats, ChordVoicing } from '$lib/state/schema';
import { defaultContentStats } from '$lib/state/schema';
import { getStats, getStatsForDef, aggregateStats } from '$lib/state/stats';
import { playChord } from '$lib/audio/playback';
import { responseQuality, calculateSm2 } from '$lib/learning/sm2';
import { CHORDS, type ChordDef } from '$lib/definitions/chords';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getEnabledChordsV4(state: UserStateV4): ChordDef[] {
	return CHORDS.filter((def) => {
		const d = state.definitions.chords[def.id];
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

function pickChordV4(state: UserStateV4): ChordDef {
	const enabled = getEnabledChordsV4(state);
	if (enabled.length === 0) throw new Error('No enabled chords');
	const now = Date.now();

	const weights = enabled.map((def) => {
		const entries = getStatsForDef(state.stats, 'chord', def.id);
		const agg = aggregateStats(entries);
		const accuracy = agg.attempts > 0 ? agg.correct / agg.attempts : 0.5;
		const weaknessWeight = 1 - accuracy;

		let minNextReview = 0;
		for (const [, s] of entries) {
			if (s.nextReview > 0 && (minNextReview === 0 || s.nextReview < minNextReview)) {
				minNextReview = s.nextReview;
			}
		}
		const overdue = minNextReview > 0 ? Math.max(0, now - minNextReview) : 0;
		const reviewWeight = Math.min(1, overdue / (24 * 60 * 60 * 1000));
		const newBoost = agg.attempts === 0 ? 0.5 : 0;

		return { item: def, weight: 0.1 + weaknessWeight * 0.5 + reviewWeight * 0.3 + newBoost };
	});

	return weightedPick(weights);
}

function pickVoicingV4(state: UserStateV4, chord: ChordDef): ChordVoicing {
	const ev = state.settings.enabledVoicings;
	const voicings = (['root', 'first', 'second'] as ChordVoicing[]).filter((v) => ev[v]);
	if (voicings.length === 0) throw new Error('No enabled voicings');
	if (voicings.length === 1) return voicings[0];

	const weights = voicings.map((v) => {
		const s = getStats(state.stats, `chord:${chord.id}:${v}`);
		const accuracy = s.attempts > 0 ? s.correct / s.attempts : 0.5;
		const weaknessWeight = 1 - accuracy;
		const newBoost = s.attempts === 0 ? 0.5 : 0;
		return { item: v, weight: 0.1 + weaknessWeight + newBoost };
	});

	return weightedPick(weights);
}

function generateChordDistractorsV4(correctId: string, state: UserStateV4): ChordDef[] {
	const correctDef = CHORDS.find((c) => c.id === correctId);
	const correctIntervals = new Set(correctDef?.intervals ?? []);

	const enabled = getEnabledChordsV4(state).filter((c) => c.id !== correctId);
	const shuffled = [...enabled].sort(() => Math.random() - 0.5);
	if (shuffled.length >= 3) return shuffled.slice(0, 3);

	const usedIds = new Set([correctId, ...shuffled.map((c) => c.id)]);
	const locked = CHORDS.filter((c) => !usedIds.has(c.id)).sort((a, b) => {
		const sharedA = a.intervals.filter((i) => correctIntervals.has(i)).length;
		const sharedB = b.intervals.filter((i) => correctIntervals.has(i)).length;
		return sharedB - sharedA;
	});

	const result = [...shuffled];
	for (const def of locked) {
		if (result.length >= 3) break;
		result.push(def);
	}
	return result;
}

// ─── Config factory ─────────────────────────────────────────────────────────

const voicingLabel: Record<string, string> = {
	root: 'ROOT',
	first: 'INV1',
	second: 'INV2',
};

export function createChordConfig(state: UserStateV4): QuizSessionConfig {
	let isArpeggiated = false;

	return {
		heading: 'CHORDS',
		contentKinds: ['chord'],
		sessionLength: state.settings.sessionLength,

		extraControls: [
			{
				id: 'arp',
				getLabel: () => isArpeggiated ? 'ARP' : 'BLK',
				getState: () => isArpeggiated,
				toggle: () => {
					isArpeggiated = !isArpeggiated;
				},
			},
		],

		generateQuestion(s: UserStateV4): UnifiedQuestion {
			const chord = pickChordV4(s);
			const voicing = pickVoicingV4(s, chord);

			const maxSemitone = Math.max(...chord.intervals);
			const inversionBoost = voicing === 'second' ? 12 : voicing === 'first' ? 12 : 0;
			const maxRoot = Math.min(72, 84 - maxSemitone - inversionBoost);
			const rootNote = 48 + Math.floor(Math.random() * Math.max(1, maxRoot - 48 + 1));

			const distractors = generateChordDistractorsV4(chord.id, s);
			const seen = new Set<string>();
			const raw = [chord, ...distractors].filter((c) => {
				if (seen.has(c.id)) return false;
				seen.add(c.id);
				return true;
			});
			const choices = raw.sort(() => Math.random() - 0.5);

			return {
				id: `chord:${chord.id}:${voicing}`,
				kind: 'chord',
				rootNote,
				playback: {
					type: 'chord',
					rootNote,
					intervals: chord.intervals,
					toneType: s.settings.toneType,
					voicing,
					arpeggiated: isArpeggiated,
				},
				correctAnswer: {
					id: chord.id,
					name: chord.name,
					label: chord.label ?? chord.id.toUpperCase(),
				},
				choices: choices.map((c) => ({
					id: c.id,
					name: c.name,
					label: c.label ?? c.id.toUpperCase(),
				})),
				replays: 0,
				metadata: { voicing, chordIntervals: chord.intervals },
			};
		},

		async playAudio(q: UnifiedQuestion): Promise<PlaybackInfo> {
			const voicing = (q.playback.voicing ?? 'root') as ChordVoicing;
			const arp = isArpeggiated;
			await playChord(
				q.rootNote,
				q.playback.intervals,
				voicing,
				q.playback.toneType,
				arp,
			);
			const midis = q.playback.intervals.map((s: number) => q.rootNote + s);
			const noteCount = midis.length;
			const durationMs = arp ? noteCount * 150 + 800 + 200 : 1400;
			return { durationMs, notes: midis };
		},

		onAnswer(s: UserStateV4, q: UnifiedQuestion, result: QuestionResult) {
			const voicing = q.metadata?.voicing as ChordVoicing;
			const statsKey = `chord:${q.correctAnswer.id}:${voicing}`;

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
		},

		formatDebrief(results: QuestionResult[]): DebriefSection[] {
			const voicings: Record<string, { total: number; correct: number }> = {};
			for (const r of results) {
				const v = (r.question.metadata?.voicing as string) ?? 'root';
				if (!voicings[v]) voicings[v] = { total: 0, correct: 0 };
				voicings[v].total++;
				if (r.correct) voicings[v].correct++;
			}

			if (Object.keys(voicings).length <= 1) return [];

			return [
				{
					label: 'PER VOICING',
					items: Object.entries(voicings).map(([v, stats]) => ({
						label: voicingLabel[v] ?? v,
						value: `${stats.correct}/${stats.total}  ${Math.round((stats.correct / stats.total) * 100)}%`,
					})),
				},
			];
		},
	};
}
