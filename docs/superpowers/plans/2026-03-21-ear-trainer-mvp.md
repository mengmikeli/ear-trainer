# Ear Trainer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an adaptive interval ear training web app (MVP: multiple choice mode) with SM-2 spaced repetition and a Marathon-inspired industrial UI.

**Architecture:** SvelteKit SPA with client-side only logic. Web Audio API generates tones. An adaptive engine (SM-2 + tier unlocks + weakness weighting) selects questions. All state persisted in localStorage. Four screens: Home, Quiz, Progress, Settings.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), TypeScript, Web Audio API, Vitest, localStorage

**Spec:** `DESIGN.md` (in repo root)

---

## File Structure

```
ear-trainer/
├── DESIGN.md                          # Existing spec
├── package.json
├── svelte.config.js
├── vite.config.ts
├── tsconfig.json
├── static/
│   └── favicon.svg
├── src/
│   ├── app.html                       # Shell HTML
│   ├── app.css                        # Global styles (palette, typography, reset)
│   ├── lib/
│   │   ├── audio.ts                   # Web Audio engine (play tones, intervals)
│   │   ├── intervals.ts               # Interval definitions (names, semitones, tiers)
│   │   ├── sm2.ts                     # SM-2 algorithm (ease factor, next review)
│   │   ├── engine.ts                  # Adaptive question selection engine
│   │   ├── state.ts                   # State management (localStorage read/write, UserState)
│   │   └── types.ts                   # Shared TypeScript types
│   ├── routes/
│   │   ├── +layout.svelte             # Root layout (bottom nav, global wrapper)
│   │   ├── +page.svelte               # Home screen
│   │   ├── quiz/
│   │   │   └── +page.svelte           # Quiz (practice) screen
│   │   ├── progress/
│   │   │   └── +page.svelte           # Progress screen
│   │   └── settings/
│   │       └── +page.svelte           # Settings screen
│   └── components/
│       ├── PlayButton.svelte           # Play/replay audio button
│       ├── AnswerGrid.svelte           # 4-choice answer buttons
│       ├── Feedback.svelte             # Correct/wrong flash overlay
│       ├── ProgressBar.svelte          # Question N/total bar
│       ├── IntervalCard.svelte         # Single interval row on Progress screen
│       └── BottomNav.svelte            # Bottom navigation tabs
├── tests/
│   ├── intervals.test.ts
│   ├── sm2.test.ts
│   ├── engine.test.ts
│   ├── state.test.ts
│   └── audio.test.ts
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `src/app.html`, `src/app.css`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `static/favicon.svg`

- [ ] **Step 1: Initialize SvelteKit project**

```bash
cd ~/Projects/ear-trainer
npx sv create . --template minimal --types ts --no-add-ons
```

Accept overwrite prompts. This scaffolds the SvelteKit project.

- [ ] **Step 2: Install dependencies**

```bash
npm install
```

- [ ] **Step 3: Install Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 4: Add vitest config to `vite.config.ts`**

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['tests/**/*.test.ts']
	}
});
```

- [ ] **Step 5: Add test script to `package.json`**

Add to scripts: `"test": "vitest run", "test:watch": "vitest"`

- [ ] **Step 6: Verify dev server starts**

```bash
npm run dev -- --open
```
Expected: SvelteKit welcome page at localhost:5173

- [ ] **Step 7: Set up global styles in `src/app.css`**

```css
:root {
	--base: #0A0A0A;
	--surface: #1A1A1A;
	--text-primary: #E8E8E8;
	--text-secondary: #666666;
	--accent: #00D4FF;
	--correct: #00FF88;
	--wrong: #FF3355;
	--font: 'Inter', 'Barlow', system-ui, -apple-system, sans-serif;
}

* {
	margin: 0;
	padding: 0;
	box-sizing: border-box;
}

html, body {
	height: 100%;
	background: var(--base);
	color: var(--text-primary);
	font-family: var(--font);
	font-size: 16px;
	line-height: 1.5;
	-webkit-font-smoothing: antialiased;
}

a {
	color: inherit;
	text-decoration: none;
}

button {
	font-family: inherit;
	cursor: pointer;
	border: none;
	background: none;
	color: inherit;
}
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold SvelteKit project with global styles"
```

---

## Task 2: Types & Interval Definitions

**Files:**
- Create: `src/lib/types.ts`, `src/lib/intervals.ts`
- Test: `tests/intervals.test.ts`

- [ ] **Step 1: Write types**

```ts
// src/lib/types.ts
export interface IntervalDef {
	id: string;          // e.g. "P5", "m3", "TT"
	name: string;        // e.g. "Perfect 5th"
	semitones: number;   // 0-12
	tier: number;        // 1-5
}

export interface IntervalState {
	interval: string;
	mode: 'choice' | 'free';
	unlocked: boolean;
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
	rootNote: number;       // MIDI note number
	interval: IntervalDef;
	direction: 'ascending' | 'descending';
	choices: IntervalDef[]; // 4 choices including correct
	replays: number;
}
```

- [ ] **Step 2: Write the failing test for intervals**

```ts
// tests/intervals.test.ts
import { describe, it, expect } from 'vitest';
import { INTERVALS, getIntervalsByTier, getUnlockedIntervals } from '$lib/intervals';
import type { IntervalState } from '$lib/types';

describe('INTERVALS', () => {
	it('has 13 intervals (P1 through P8)', () => {
		expect(INTERVALS).toHaveLength(13);
	});

	it('each interval has required fields', () => {
		for (const interval of INTERVALS) {
			expect(interval.id).toBeTruthy();
			expect(interval.name).toBeTruthy();
			expect(interval.semitones).toBeGreaterThanOrEqual(0);
			expect(interval.semitones).toBeLessThanOrEqual(12);
			expect(interval.tier).toBeGreaterThanOrEqual(1);
			expect(interval.tier).toBeLessThanOrEqual(5);
		}
	});

	it('tier 1 has P1, P5, P8', () => {
		const tier1 = getIntervalsByTier(1);
		const ids = tier1.map(i => i.id);
		expect(ids).toContain('P1');
		expect(ids).toContain('P5');
		expect(ids).toContain('P8');
		expect(tier1).toHaveLength(3);
	});
});

describe('getUnlockedIntervals', () => {
	it('returns only unlocked intervals', () => {
		const states: Record<string, IntervalState> = {
			P1: { interval: 'P1', mode: 'choice', unlocked: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
			P5: { interval: 'P5', mode: 'choice', unlocked: true, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
			m3: { interval: 'm3', mode: 'choice', unlocked: false, attempts: 0, correct: 0, easeFactor: 2.5, nextReview: 0, streak: 0, lastSeen: 0 },
		};
		const unlocked = getUnlockedIntervals(states);
		expect(unlocked).toHaveLength(2);
	});
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run tests/intervals.test.ts
```
Expected: FAIL

- [ ] **Step 4: Implement intervals**

```ts
// src/lib/intervals.ts
import type { IntervalDef, IntervalState } from './types';

export const INTERVALS: IntervalDef[] = [
	{ id: 'P1',  name: 'Unison',       semitones: 0,  tier: 1 },
	{ id: 'P5',  name: 'Perfect 5th',  semitones: 7,  tier: 1 },
	{ id: 'P8',  name: 'Octave',       semitones: 12, tier: 1 },
	{ id: 'M3',  name: 'Major 3rd',    semitones: 4,  tier: 2 },
	{ id: 'P4',  name: 'Perfect 4th',  semitones: 5,  tier: 2 },
	{ id: 'm3',  name: 'Minor 3rd',    semitones: 3,  tier: 3 },
	{ id: 'M6',  name: 'Major 6th',    semitones: 9,  tier: 3 },
	{ id: 'm7',  name: 'Minor 7th',    semitones: 10, tier: 4 },
	{ id: 'M2',  name: 'Major 2nd',    semitones: 2,  tier: 4 },
	{ id: 'm6',  name: 'Minor 6th',    semitones: 8,  tier: 5 },
	{ id: 'M7',  name: 'Major 7th',    semitones: 11, tier: 5 },
	{ id: 'm2',  name: 'Minor 2nd',    semitones: 1,  tier: 5 },
	{ id: 'TT',  name: 'Tritone',      semitones: 6,  tier: 5 },
];

export function getIntervalsByTier(tier: number): IntervalDef[] {
	return INTERVALS.filter(i => i.tier === tier);
}

export function getIntervalById(id: string): IntervalDef | undefined {
	return INTERVALS.find(i => i.id === id);
}

export function getUnlockedIntervals(states: Record<string, IntervalState>): IntervalDef[] {
	return INTERVALS.filter(i => states[i.id]?.unlocked);
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run tests/intervals.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add interval definitions and types"
```

---

## Task 3: SM-2 Algorithm

**Files:**
- Create: `src/lib/sm2.ts`
- Test: `tests/sm2.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/sm2.test.ts
import { describe, it, expect } from 'vitest';
import { calculateSm2, responseQuality } from '$lib/sm2';

describe('responseQuality', () => {
	it('returns 5 for correct on first listen', () => {
		expect(responseQuality({ correct: true, replays: 0, responseTimeMs: 2000 })).toBe(5);
	});
	it('returns 4 for correct after replay', () => {
		expect(responseQuality({ correct: true, replays: 1, responseTimeMs: 2000 })).toBe(4);
	});
	it('returns 3 for correct but slow (>5s)', () => {
		expect(responseQuality({ correct: true, replays: 0, responseTimeMs: 6000 })).toBe(3);
	});
	it('returns 1 for wrong', () => {
		expect(responseQuality({ correct: false, replays: 0, responseTimeMs: 1000 })).toBe(1);
	});
});

describe('calculateSm2', () => {
	it('increases ease factor for quality 5', () => {
		const result = calculateSm2(2.5, 5);
		expect(result.easeFactor).toBeGreaterThan(2.5);
	});
	it('decreases ease factor for quality 1', () => {
		const result = calculateSm2(2.5, 1);
		expect(result.easeFactor).toBeLessThan(2.5);
	});
	it('never drops ease factor below 1.3', () => {
		const result = calculateSm2(1.3, 1);
		expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
	});
	it('returns interval in ms', () => {
		const result = calculateSm2(2.5, 5);
		expect(result.intervalMs).toBeGreaterThan(0);
	});
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/sm2.test.ts
```

- [ ] **Step 3: Implement SM-2**

```ts
// src/lib/sm2.ts
export interface ResponseInput {
	correct: boolean;
	replays: number;
	responseTimeMs: number;
}

export function responseQuality(input: ResponseInput): number {
	if (!input.correct) return 1;
	if (input.replays > 0) return 4;
	if (input.responseTimeMs > 5000) return 3;
	return 5;
}

export interface Sm2Result {
	easeFactor: number;
	intervalMs: number;
}

export function calculateSm2(easeFactor: number, quality: number): Sm2Result {
	// SM-2 formula
	const newEf = Math.max(
		1.3,
		easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
	);

	// Interval based on quality
	let intervalDays: number;
	if (quality < 3) {
		intervalDays = 0.0007; // ~1 minute — review soon
	} else {
		// Base interval scales with ease factor
		intervalDays = newEf * 0.5; // ~1-2 days for typical ease
	}

	return {
		easeFactor: newEf,
		intervalMs: Math.round(intervalDays * 24 * 60 * 60 * 1000),
	};
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/sm2.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: implement SM-2 spaced repetition algorithm"
```

---

## Task 4: State Management (localStorage)

**Files:**
- Create: `src/lib/state.ts`
- Test: `tests/state.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/state.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createDefaultState, loadState, saveState, checkTierUnlock } from '$lib/state';

// Mock localStorage
const storage = new Map<string, string>();
const mockLocalStorage = {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => storage.set(key, value),
	removeItem: (key: string) => storage.delete(key),
	clear: () => storage.clear(),
} as Storage;

describe('createDefaultState', () => {
	it('has all 13 intervals', () => {
		const state = createDefaultState();
		expect(Object.keys(state.intervals)).toHaveLength(13);
	});
	it('tier 1 intervals are unlocked by default', () => {
		const state = createDefaultState();
		expect(state.intervals['P1'].unlocked).toBe(true);
		expect(state.intervals['P5'].unlocked).toBe(true);
		expect(state.intervals['P8'].unlocked).toBe(true);
	});
	it('tier 2+ intervals are locked by default', () => {
		const state = createDefaultState();
		expect(state.intervals['M3'].unlocked).toBe(false);
		expect(state.intervals['TT'].unlocked).toBe(false);
	});
});

describe('loadState / saveState', () => {
	beforeEach(() => storage.clear());

	it('returns default state when nothing saved', () => {
		const state = loadState(mockLocalStorage);
		expect(state.stats.totalSessions).toBe(0);
	});
	it('round-trips state through save/load', () => {
		const state = createDefaultState();
		state.stats.totalSessions = 5;
		saveState(state, mockLocalStorage);
		const loaded = loadState(mockLocalStorage);
		expect(loaded.stats.totalSessions).toBe(5);
	});
});

describe('checkTierUnlock', () => {
	it('unlocks tier 2 when tier 1 all >= 80% over 10+ attempts', () => {
		const state = createDefaultState();
		// Simulate: P1, P5, P8 all at 80%+ with 10+ attempts
		for (const id of ['P1', 'P5', 'P8']) {
			state.intervals[id].attempts = 10;
			state.intervals[id].correct = 8;
		}
		const updated = checkTierUnlock(state);
		expect(updated.intervals['M3'].unlocked).toBe(true);
		expect(updated.intervals['P4'].unlocked).toBe(true);
	});
	it('does not unlock tier 2 if attempts < 10', () => {
		const state = createDefaultState();
		for (const id of ['P1', 'P5', 'P8']) {
			state.intervals[id].attempts = 5;
			state.intervals[id].correct = 5;
		}
		const updated = checkTierUnlock(state);
		expect(updated.intervals['M3'].unlocked).toBe(false);
	});
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/state.test.ts
```

- [ ] **Step 3: Implement state**

```ts
// src/lib/state.ts
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
	const updated = structuredClone(state);

	for (let tier = 2; tier <= 5; tier++) {
		const prevTierIntervals = getIntervalsByTier(tier - 1);
		const allQualified = prevTierIntervals.every(def => {
			const s = updated.intervals[def.id];
			return s && s.attempts >= 10 && (s.correct / s.attempts) >= 0.8;
		});

		if (allQualified) {
			for (const def of getIntervalsByTier(tier)) {
				updated.intervals[def.id].unlocked = true;
			}
		}
	}

	return updated;
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/state.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: state management with localStorage and tier unlock logic"
```

---

## Task 5: Adaptive Question Engine

**Files:**
- Create: `src/lib/engine.ts`
- Test: `tests/engine.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/engine.test.ts
import { describe, it, expect } from 'vitest';
import { pickInterval, generateQuestion, generateDistractors } from '$lib/engine';
import { createDefaultState } from '$lib/state';

describe('pickInterval', () => {
	it('only picks from unlocked intervals', () => {
		const state = createDefaultState();
		for (let i = 0; i < 50; i++) {
			const picked = pickInterval(state);
			expect(['P1', 'P5', 'P8']).toContain(picked.id);
		}
	});
	it('prefers weaker intervals (lower accuracy)', () => {
		const state = createDefaultState();
		state.intervals['P1'].attempts = 20;
		state.intervals['P1'].correct = 20; // 100%
		state.intervals['P5'].attempts = 20;
		state.intervals['P5'].correct = 5;  // 25%
		state.intervals['P8'].attempts = 20;
		state.intervals['P8'].correct = 20; // 100%

		const counts: Record<string, number> = { P1: 0, P5: 0, P8: 0 };
		for (let i = 0; i < 200; i++) {
			const picked = pickInterval(state);
			counts[picked.id]++;
		}
		// P5 should be picked significantly more often
		expect(counts['P5']).toBeGreaterThan(counts['P1']);
	});
});

describe('generateDistractors', () => {
	it('returns exactly 3 distractors', () => {
		const state = createDefaultState();
		const distractors = generateDistractors('P5', state);
		expect(distractors).toHaveLength(3);
	});
	it('does not include the correct answer', () => {
		const state = createDefaultState();
		const distractors = generateDistractors('P5', state);
		expect(distractors.map(d => d.id)).not.toContain('P5');
	});
});

describe('generateQuestion', () => {
	it('returns a valid question', () => {
		const state = createDefaultState();
		const q = generateQuestion(state);
		expect(q.rootNote).toBeGreaterThanOrEqual(48); // C3
		expect(q.rootNote).toBeLessThanOrEqual(84);    // C6
		expect(q.choices).toHaveLength(4);
		expect(q.choices.map(c => c.id)).toContain(q.interval.id);
	});
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/engine.test.ts
```

- [ ] **Step 3: Implement engine**

```ts
// src/lib/engine.ts
import type { UserState, Question, IntervalDef } from './types';
import { INTERVALS, getUnlockedIntervals, getIntervalById } from './intervals';

export function pickInterval(state: UserState): IntervalDef {
	const unlocked = getUnlockedIntervals(state.intervals);
	if (unlocked.length === 0) throw new Error('No unlocked intervals');

	const now = Date.now();

	// Calculate weight for each interval: lower accuracy + due for review = higher weight
	const weights = unlocked.map(def => {
		const s = state.intervals[def.id];
		const accuracy = s.attempts > 0 ? s.correct / s.attempts : 0.5;
		const weaknessWeight = 1 - accuracy; // 0..1, higher = weaker

		// SM-2 review urgency
		const overdue = s.nextReview > 0 ? Math.max(0, now - s.nextReview) : 0;
		const reviewWeight = Math.min(1, overdue / (24 * 60 * 60 * 1000)); // 0..1

		// New intervals (0 attempts) get a boost
		const newBoost = s.attempts === 0 ? 0.5 : 0;

		return {
			def,
			weight: 0.1 + weaknessWeight * 0.5 + reviewWeight * 0.3 + newBoost,
		};
	});

	// Weighted random selection
	const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
	let roll = Math.random() * totalWeight;
	for (const w of weights) {
		roll -= w.weight;
		if (roll <= 0) return w.def;
	}
	return weights[weights.length - 1].def;
}

export function generateDistractors(correctId: string, state: UserState): IntervalDef[] {
	const unlocked = getUnlockedIntervals(state.intervals).filter(i => i.id !== correctId);

	// If not enough unlocked intervals, pull from all intervals
	const pool = unlocked.length >= 3 ? unlocked : INTERVALS.filter(i => i.id !== correctId);

	// Shuffle and take 3
	const shuffled = [...pool].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, 3);
}

export function generateQuestion(state: UserState): Question {
	const interval = pickInterval(state);
	const direction: 'ascending' | 'descending' =
		state.settings.direction === 'random'
			? Math.random() < 0.5 ? 'ascending' : 'descending'
			: state.settings.direction;

	// Root note: C3 (48) to C6 (84), clamped so interval fits
	const maxRoot = direction === 'ascending' ? 84 - interval.semitones : 84;
	const minRoot = direction === 'descending' ? 48 + interval.semitones : 48;
	const rootNote = minRoot + Math.floor(Math.random() * (maxRoot - minRoot + 1));

	const distractors = generateDistractors(interval.id, state);
	const choices = [interval, ...distractors].sort(() => Math.random() - 0.5);

	return {
		rootNote,
		interval,
		direction,
		choices,
		replays: 0,
	};
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/engine.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: adaptive question selection engine"
```

---

## Task 6: Web Audio Engine

**Files:**
- Create: `src/lib/audio.ts`
- Test: `tests/audio.test.ts`

- [ ] **Step 1: Write tests for utility functions**

```ts
// tests/audio.test.ts
import { describe, it, expect } from 'vitest';
import { midiToFreq } from '$lib/audio';

describe('midiToFreq', () => {
	it('converts A4 (MIDI 69) to 440Hz', () => {
		expect(midiToFreq(69)).toBeCloseTo(440, 1);
	});
	it('converts C4 (MIDI 60) to ~261.6Hz', () => {
		expect(midiToFreq(60)).toBeCloseTo(261.63, 0);
	});
	it('converts C3 (MIDI 48) to ~130.8Hz', () => {
		expect(midiToFreq(48)).toBeCloseTo(130.81, 0);
	});
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/audio.test.ts
```

- [ ] **Step 3: Implement audio engine**

```ts
// src/lib/audio.ts
import type { ToneType } from './types';

let ctx: AudioContext | null = null;

function getContext(): AudioContext {
	if (!ctx) ctx = new AudioContext();
	if (ctx.state === 'suspended') ctx.resume();
	return ctx;
}

export function midiToFreq(midi: number): number {
	return 440 * Math.pow(2, (midi - 69) / 12);
}

function playSineTone(freq: number, startTime: number, duration: number, audioCtx: AudioContext): void {
	const osc = audioCtx.createOscillator();
	const gain = audioCtx.createGain();
	osc.type = 'sine';
	osc.frequency.value = freq;
	gain.gain.setValueAtTime(0, startTime);
	gain.gain.linearRampToValueAtTime(0.5, startTime + 0.02);
	gain.gain.setValueAtTime(0.5, startTime + duration - 0.05);
	gain.gain.linearRampToValueAtTime(0, startTime + duration);
	osc.connect(gain);
	gain.connect(audioCtx.destination);
	osc.start(startTime);
	osc.stop(startTime + duration);
}

function playPianoTone(freq: number, startTime: number, duration: number, audioCtx: AudioContext): void {
	// Simple piano-like synthesis: multiple harmonics + ADSR
	const harmonics = [1, 2, 3, 4];
	const amplitudes = [0.5, 0.2, 0.1, 0.05];

	for (let i = 0; i < harmonics.length; i++) {
		const osc = audioCtx.createOscillator();
		const gain = audioCtx.createGain();
		osc.type = 'sine';
		osc.frequency.value = freq * harmonics[i];
		// ADSR envelope
		const attack = 0.01;
		const decay = 0.1;
		const sustain = amplitudes[i] * 0.6;
		gain.gain.setValueAtTime(0, startTime);
		gain.gain.linearRampToValueAtTime(amplitudes[i], startTime + attack);
		gain.gain.linearRampToValueAtTime(sustain, startTime + attack + decay);
		gain.gain.setValueAtTime(sustain, startTime + duration - 0.1);
		gain.gain.linearRampToValueAtTime(0, startTime + duration);
		osc.connect(gain);
		gain.connect(audioCtx.destination);
		osc.start(startTime);
		osc.stop(startTime + duration);
	}
}

export function playInterval(
	rootMidi: number,
	semitones: number,
	direction: 'ascending' | 'descending',
	toneType: ToneType = 'sine'
): void {
	const audioCtx = getContext();
	const now = audioCtx.currentTime;

	const freq1 = midiToFreq(rootMidi);
	const secondMidi = direction === 'ascending' ? rootMidi + semitones : rootMidi - semitones;
	const freq2 = midiToFreq(secondMidi);

	const noteDuration = 0.6;
	const gap = 0.15;

	const playFn = toneType === 'piano' ? playPianoTone : playSineTone;
	playFn(freq1, now, noteDuration, audioCtx);
	playFn(freq2, now + noteDuration + gap, noteDuration, audioCtx);
}

export function playFeedbackChime(correct: boolean): void {
	const audioCtx = getContext();
	const now = audioCtx.currentTime;
	const osc = audioCtx.createOscillator();
	const gain = audioCtx.createGain();
	osc.type = 'sine';
	osc.frequency.value = correct ? 880 : 220;
	gain.gain.setValueAtTime(0.2, now);
	gain.gain.linearRampToValueAtTime(0, now + 0.3);
	osc.connect(gain);
	gain.connect(audioCtx.destination);
	osc.start(now);
	osc.stop(now + 0.3);
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/audio.test.ts
```
Expected: PASS (utility tests; audio playback requires browser)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Web Audio engine for interval playback"
```

---

## Task 7: UI Components

**Files:**
- Create: `src/components/PlayButton.svelte`, `AnswerGrid.svelte`, `Feedback.svelte`, `ProgressBar.svelte`, `IntervalCard.svelte`, `BottomNav.svelte`

- [ ] **Step 1: BottomNav**

```svelte
<!-- src/components/BottomNav.svelte -->
<script lang="ts">
	import { page } from '$app/state';

	const tabs = [
		{ href: '/', label: 'PRACTICE', icon: '▶' },
		{ href: '/progress', label: 'PROGRESS', icon: '◉' },
		{ href: '/settings', label: 'SETTINGS', icon: '⚙' },
	];
</script>

<nav class="bottom-nav">
	{#each tabs as tab}
		<a href={tab.href} class:active={page.url.pathname === tab.href}>
			<span class="icon">{tab.icon}</span>
			<span class="label">{tab.label}</span>
		</a>
	{/each}
</nav>

<style>
	.bottom-nav {
		display: flex;
		justify-content: center;
		gap: 2rem;
		padding: 0.75rem 1rem;
		background: var(--surface);
		border-top: 1px solid #222;
	}
	a {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		color: var(--text-secondary);
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		transition: color 0.15s;
	}
	a.active { color: var(--accent); }
	.icon { font-size: 1.25rem; }
</style>
```

- [ ] **Step 2: PlayButton**

```svelte
<!-- src/components/PlayButton.svelte -->
<script lang="ts">
	interface Props {
		onplay: () => void;
		replaying?: boolean;
	}
	let { onplay, replaying = false }: Props = $props();
</script>

<button class="play-btn" class:replay={replaying} onclick={onplay}>
	{replaying ? '↻ REPLAY' : '▶ PLAY'}
</button>

<style>
	.play-btn {
		width: 120px;
		height: 120px;
		border-radius: 50%;
		background: var(--surface);
		border: 2px solid var(--accent);
		color: var(--accent);
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		transition: background 0.15s, transform 0.1s;
	}
	.play-btn:active { transform: scale(0.95); }
	.replay {
		width: 80px;
		height: 80px;
		font-size: 0.8rem;
		border-color: var(--text-secondary);
		color: var(--text-secondary);
	}
</style>
```

- [ ] **Step 3: AnswerGrid**

```svelte
<!-- src/components/AnswerGrid.svelte -->
<script lang="ts">
	import type { IntervalDef } from '$lib/types';

	interface Props {
		choices: IntervalDef[];
		onselect: (choice: IntervalDef) => void;
		disabled?: boolean;
		correctId?: string | null;
		selectedId?: string | null;
	}
	let { choices, onselect, disabled = false, correctId = null, selectedId = null }: Props = $props();

	function btnClass(id: string): string {
		if (!selectedId) return '';
		if (id === correctId) return 'correct';
		if (id === selectedId && id !== correctId) return 'wrong';
		return 'dim';
	}
</script>

<div class="grid">
	{#each choices as choice}
		<button
			class="answer {btnClass(choice.id)}"
			onclick={() => onselect(choice)}
			disabled={disabled}
		>
			<span class="id">{choice.id}</span>
			<span class="name">{choice.name}</span>
		</button>
	{/each}
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		width: 100%;
	}
	.answer {
		padding: 1.25rem 0.5rem;
		background: var(--surface);
		border: 1px solid #333;
		border-radius: 4px;
		text-align: center;
		transition: border-color 0.15s, background 0.15s;
	}
	.answer:not(:disabled):active { background: #252525; }
	.id {
		display: block;
		font-size: 1.25rem;
		font-weight: 700;
		font-family: 'SF Mono', 'Fira Code', monospace;
		letter-spacing: -0.02em;
	}
	.name {
		display: block;
		font-size: 0.75rem;
		color: var(--text-secondary);
		margin-top: 0.25rem;
	}
	.correct { border-color: var(--correct); background: #00ff8810; }
	.wrong { border-color: var(--wrong); background: #ff335510; }
	.dim { opacity: 0.3; }
</style>
```

- [ ] **Step 4: ProgressBar**

```svelte
<!-- src/components/ProgressBar.svelte -->
<script lang="ts">
	interface Props { current: number; total: number; }
	let { current, total }: Props = $props();
</script>

<div class="progress-bar">
	<div class="track">
		<div class="fill" style="width: {(current / total) * 100}%"></div>
	</div>
	<span class="label">{current}/{total}</span>
</div>

<style>
	.progress-bar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
	}
	.track {
		flex: 1;
		height: 4px;
		background: #222;
		border-radius: 2px;
		overflow: hidden;
	}
	.fill {
		height: 100%;
		background: var(--accent);
		transition: width 0.3s ease;
	}
	.label {
		font-size: 0.8rem;
		font-weight: 600;
		font-family: 'SF Mono', 'Fira Code', monospace;
		color: var(--text-secondary);
		min-width: 3rem;
		text-align: right;
	}
</style>
```

- [ ] **Step 5: Feedback overlay**

```svelte
<!-- src/components/Feedback.svelte -->
<script lang="ts">
	interface Props {
		correct: boolean;
		correctAnswer: string;
		visible: boolean;
	}
	let { correct, correctAnswer, visible }: Props = $props();
</script>

{#if visible}
	<div class="feedback" class:correct class:wrong={!correct}>
		<span class="icon">{correct ? '✓' : '✗'}</span>
		{#if !correct}
			<span class="answer">{correctAnswer}</span>
		{/if}
	</div>
{/if}

<style>
	.feedback {
		position: fixed;
		top: 0; left: 0; right: 0; bottom: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		z-index: 100;
		animation: flash 0.3s ease-out;
	}
	.correct { background: #00ff8815; }
	.wrong { background: #ff335515; }
	.icon {
		font-size: 4rem;
		font-weight: 700;
	}
	.correct .icon { color: var(--correct); }
	.wrong .icon { color: var(--wrong); }
	.answer {
		font-size: 1.25rem;
		font-weight: 600;
		margin-top: 0.5rem;
		color: var(--text-primary);
	}
	@keyframes flash {
		from { opacity: 0; }
		to { opacity: 1; }
	}
</style>
```

- [ ] **Step 6: IntervalCard (for Progress screen)**

```svelte
<!-- src/components/IntervalCard.svelte -->
<script lang="ts">
	import type { IntervalDef, IntervalState } from '$lib/types';

	interface Props { def: IntervalDef; state: IntervalState; }
	let { def, state }: Props = $props();

	const accuracy = $derived(state.attempts > 0 ? Math.round((state.correct / state.attempts) * 100) : 0);
</script>

<div class="card" class:locked={!state.unlocked}>
	<div class="id">{state.unlocked ? def.id : '🔒'}</div>
	<div class="info">
		<div class="name">{def.name}</div>
		{#if state.unlocked}
			<div class="stats">{accuracy}% · {state.attempts} attempts</div>
		{:else}
			<div class="stats">Tier {def.tier} — locked</div>
		{/if}
	</div>
	{#if state.unlocked}
		<div class="bar">
			<div class="bar-fill" style="width: {accuracy}%"></div>
		</div>
	{/if}
</div>

<style>
	.card {
		display: grid;
		grid-template-columns: 3rem 1fr 60px;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: var(--surface);
		border-radius: 4px;
	}
	.locked { opacity: 0.4; }
	.id {
		font-size: 1.1rem;
		font-weight: 700;
		font-family: 'SF Mono', 'Fira Code', monospace;
		text-align: center;
	}
	.name { font-weight: 600; font-size: 0.9rem; }
	.stats { font-size: 0.75rem; color: var(--text-secondary); }
	.bar {
		height: 4px;
		background: #222;
		border-radius: 2px;
		overflow: hidden;
	}
	.bar-fill {
		height: 100%;
		background: var(--accent);
	}
</style>
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add all UI components"
```

---

## Task 8: Root Layout + Home Screen

**Files:**
- Modify: `src/routes/+layout.svelte`, `src/routes/+page.svelte`

- [ ] **Step 1: Root layout**

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import '../app.css';
	import BottomNav from '../components/BottomNav.svelte';

	let { children } = $props();
</script>

<div class="app">
	<main class="content">
		{@render children()}
	</main>
	<BottomNav />
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		max-width: 480px;
		margin: 0 auto;
	}
	.content {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem 1rem;
	}
</style>
```

- [ ] **Step 2: Home screen**

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { loadState } from '$lib/state';
	import type { UserState } from '$lib/types';

	let state: UserState | null = $state(null);

	onMount(() => {
		state = loadState();
	});

	const accuracy = $derived(() => {
		if (!state) return 0;
		const vals = Object.values(state.intervals).filter(s => s.attempts > 0);
		if (vals.length === 0) return 0;
		const total = vals.reduce((sum, s) => sum + s.correct, 0);
		const attempts = vals.reduce((sum, s) => sum + s.attempts, 0);
		return Math.round((total / attempts) * 100);
	});
</script>

<div class="home">
	<header>
		<h1 class="title">EAR<br/>TRAINER</h1>
		<span class="version">v1.0</span>
	</header>

	{#if state}
		<div class="stats">
			<div class="stat">
				<span class="value">{state.stats.currentStreak}</span>
				<span class="label">DAY STREAK</span>
			</div>
			<div class="stat">
				<span class="value">{accuracy()}%</span>
				<span class="label">ACCURACY</span>
			</div>
		</div>

		<a href="/quiz" class="start-btn">▶ PRACTICE</a>
	{/if}
</div>

<style>
	.home {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 2.5rem;
		text-align: center;
	}
	.title {
		font-size: 3rem;
		font-weight: 700;
		letter-spacing: -0.03em;
		line-height: 1;
		color: var(--text-primary);
	}
	.version {
		font-size: 0.7rem;
		color: var(--text-secondary);
		font-family: 'SF Mono', 'Fira Code', monospace;
	}
	.stats {
		display: flex;
		gap: 3rem;
	}
	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.value {
		font-size: 2rem;
		font-weight: 700;
		font-family: 'SF Mono', 'Fira Code', monospace;
	}
	.label {
		font-size: 0.6rem;
		color: var(--text-secondary);
		letter-spacing: 0.15em;
		font-weight: 600;
	}
	.start-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 180px;
		height: 180px;
		border-radius: 50%;
		background: var(--surface);
		border: 2px solid var(--accent);
		color: var(--accent);
		font-size: 1.1rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		transition: transform 0.1s;
	}
	.start-btn:active { transform: scale(0.95); }
</style>
```

- [ ] **Step 3: Verify home screen renders**

```bash
npm run dev
```
Expected: dark industrial home screen with title, stats, practice button

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: root layout and home screen"
```

---

## Task 9: Quiz Screen (Core Loop)

**Files:**
- Create: `src/routes/quiz/+page.svelte`

- [ ] **Step 1: Build quiz page**

```svelte
<!-- src/routes/quiz/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { loadState, saveState, checkTierUnlock } from '$lib/state';
	import { generateQuestion } from '$lib/engine';
	import { playInterval, playFeedbackChime } from '$lib/audio';
	import { responseQuality, calculateSm2 } from '$lib/sm2';
	import type { UserState, Question, IntervalDef } from '$lib/types';
	import PlayButton from '../../components/PlayButton.svelte';
	import AnswerGrid from '../../components/AnswerGrid.svelte';
	import ProgressBar from '../../components/ProgressBar.svelte';
	import Feedback from '../../components/Feedback.svelte';

	let state: UserState | null = $state(null);
	let question: Question | null = $state(null);
	let questionNum = $state(0);
	let totalQuestions = $state(20);
	let hasPlayed = $state(false);
	let selectedId: string | null = $state(null);
	let showFeedback = $state(false);
	let isCorrect = $state(false);
	let startTime = $state(0);
	let sessionCorrect = $state(0);

	onMount(() => {
		state = loadState();
		totalQuestions = state.settings.sessionLength;
		nextQuestion();
	});

	function nextQuestion() {
		if (!state) return;
		if (questionNum >= totalQuestions) {
			finishSession();
			return;
		}
		question = generateQuestion(state);
		hasPlayed = false;
		selectedId = null;
		showFeedback = false;
		questionNum++;
	}

	function play() {
		if (!question || !state) return;
		playInterval(
			question.rootNote,
			question.interval.semitones,
			question.direction,
			state.settings.toneType
		);
		if (!hasPlayed) {
			hasPlayed = true;
			startTime = Date.now();
		} else {
			question.replays++;
		}
	}

	function selectAnswer(choice: IntervalDef) {
		if (!question || !state || selectedId) return;

		const correct = choice.id === question.interval.id;
		selectedId = choice.id;
		isCorrect = correct;
		showFeedback = true;

		if (correct) sessionCorrect++;

		playFeedbackChime(correct);

		// Update interval state
		const s = state.intervals[question.interval.id];
		s.attempts++;
		if (correct) {
			s.correct++;
			s.streak++;
		} else {
			s.streak = 0;
		}
		s.lastSeen = Date.now();

		// SM-2 update
		const quality = responseQuality({
			correct,
			replays: question.replays,
			responseTimeMs: Date.now() - startTime,
		});
		const sm2 = calculateSm2(s.easeFactor, quality);
		s.easeFactor = sm2.easeFactor;
		s.nextReview = Date.now() + sm2.intervalMs;

		// Check tier unlocks
		state = checkTierUnlock(state);
		state.stats.totalQuestions++;
		saveState(state);

		// Auto-advance
		setTimeout(() => nextQuestion(), correct ? 1000 : 2000);
	}

	function finishSession() {
		if (!state) return;
		state.stats.totalSessions++;

		// Update day streak
		const now = new Date();
		const last = state.stats.lastPractice ? new Date(state.stats.lastPractice) : null;
		const isConsecutive = last &&
			(now.getTime() - last.getTime()) < 2 * 24 * 60 * 60 * 1000 &&
			now.toDateString() !== last.toDateString();

		if (isConsecutive) {
			state.stats.currentStreak++;
		} else if (!last || now.toDateString() !== last.toDateString()) {
			state.stats.currentStreak = 1;
		}
		state.stats.bestStreak = Math.max(state.stats.bestStreak, state.stats.currentStreak);
		state.stats.lastPractice = Date.now();

		saveState(state);
		goto('/');
	}

	function endEarly() {
		if (questionNum > 1 && state) {
			state.stats.totalSessions++;
			state.stats.lastPractice = Date.now();
			saveState(state);
		}
		goto('/');
	}
</script>

<div class="quiz">
	<div class="top">
		<button class="close" onclick={endEarly}>✕</button>
		<ProgressBar current={questionNum} total={totalQuestions} />
	</div>

	{#if question}
		<div class="play-area">
			<PlayButton onplay={play} replaying={hasPlayed} />
			{#if hasPlayed}
				<PlayButton onplay={play} replaying={true} />
			{/if}
		</div>

		{#if hasPlayed}
			<AnswerGrid
				choices={question.choices}
				onselect={selectAnswer}
				disabled={!!selectedId}
				correctId={selectedId ? question.interval.id : null}
				{selectedId}
			/>
		{/if}
	{/if}

	<Feedback
		correct={isCorrect}
		correctAnswer={question?.interval.name ?? ''}
		visible={showFeedback}
	/>
</div>

<style>
	.quiz {
		display: flex;
		flex-direction: column;
		align-items: center;
		height: 100%;
		gap: 2rem;
	}
	.top {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
	}
	.close {
		font-size: 1.25rem;
		color: var(--text-secondary);
		padding: 0.25rem;
	}
	.play-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		flex: 1;
		justify-content: center;
	}
</style>
```

- [ ] **Step 2: Test the full quiz loop manually**

```bash
npm run dev
```
Expected: Navigate to /quiz, tap Play to hear interval, tap answer, see feedback, auto-advance

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: quiz screen with full practice loop"
```

---

## Task 10: Progress Screen

**Files:**
- Create: `src/routes/progress/+page.svelte`

- [ ] **Step 1: Build progress page**

```svelte
<!-- src/routes/progress/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { loadState } from '$lib/state';
	import { INTERVALS } from '$lib/intervals';
	import IntervalCard from '../../components/IntervalCard.svelte';
	import type { UserState } from '$lib/types';

	let state: UserState | null = $state(null);

	onMount(() => {
		state = loadState();
	});
</script>

<div class="progress-page">
	<h2 class="heading">PROGRESS</h2>

	{#if state}
		<div class="global-stats">
			<div class="stat">
				<span class="value">{state.stats.totalSessions}</span>
				<span class="label">SESSIONS</span>
			</div>
			<div class="stat">
				<span class="value">{state.stats.totalQuestions}</span>
				<span class="label">QUESTIONS</span>
			</div>
			<div class="stat">
				<span class="value">{state.stats.bestStreak}</span>
				<span class="label">BEST STREAK</span>
			</div>
		</div>

		<div class="interval-list">
			{#each INTERVALS as def}
				<IntervalCard {def} state={state.intervals[def.id]} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.progress-page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.heading {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.15em;
		color: var(--text-secondary);
	}
	.global-stats {
		display: flex;
		justify-content: space-around;
		padding: 1rem;
		background: var(--surface);
		border-radius: 4px;
	}
	.stat { display: flex; flex-direction: column; align-items: center; }
	.value {
		font-size: 1.5rem;
		font-weight: 700;
		font-family: 'SF Mono', 'Fira Code', monospace;
	}
	.label {
		font-size: 0.55rem;
		color: var(--text-secondary);
		letter-spacing: 0.15em;
		font-weight: 600;
	}
	.interval-list { display: flex; flex-direction: column; gap: 0.5rem; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: progress screen with interval cards and stats"
```

---

## Task 11: Settings Screen

**Files:**
- Create: `src/routes/settings/+page.svelte`

- [ ] **Step 1: Build settings page**

```svelte
<!-- src/routes/settings/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { loadState, saveState, createDefaultState } from '$lib/state';
	import type { UserState, ToneType, Direction, SessionLength } from '$lib/types';

	let state: UserState | null = $state(null);
	let showResetConfirm = $state(false);

	onMount(() => {
		state = loadState();
	});

	function update() {
		if (state) saveState(state);
	}

	function resetProgress() {
		const fresh = createDefaultState();
		if (state) fresh.settings = state.settings; // keep settings
		state = fresh;
		saveState(state);
		showResetConfirm = false;
	}
</script>

<div class="settings-page">
	<h2 class="heading">SETTINGS</h2>

	{#if state}
		<div class="section">
			<label class="field-label">TONE TYPE</label>
			<div class="toggle-group">
				<button class:active={state.settings.toneType === 'sine'}
					onclick={() => { state!.settings.toneType = 'sine'; update(); }}>SINE</button>
				<button class:active={state.settings.toneType === 'piano'}
					onclick={() => { state!.settings.toneType = 'piano'; update(); }}>PIANO</button>
			</div>
		</div>

		<div class="section">
			<label class="field-label">DIRECTION</label>
			<div class="toggle-group">
				{#each ['ascending', 'descending', 'random'] as dir}
					<button class:active={state.settings.direction === dir}
						onclick={() => { state!.settings.direction = dir as Direction; update(); }}>
						{dir.toUpperCase()}
					</button>
				{/each}
			</div>
		</div>

		<div class="section">
			<label class="field-label">SESSION LENGTH</label>
			<div class="toggle-group">
				{#each [10, 20, 30] as len}
					<button class:active={state.settings.sessionLength === len}
						onclick={() => { state!.settings.sessionLength = len as SessionLength; update(); }}>
						{len}
					</button>
				{/each}
			</div>
		</div>

		<div class="section danger">
			{#if showResetConfirm}
				<p class="warn">This will erase all progress. Are you sure?</p>
				<div class="toggle-group">
					<button class="reset-yes" onclick={resetProgress}>RESET</button>
					<button onclick={() => showResetConfirm = false}>CANCEL</button>
				</div>
			{:else}
				<button class="reset-btn" onclick={() => showResetConfirm = true}>
					RESET PROGRESS
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.settings-page { display: flex; flex-direction: column; gap: 1.5rem; }
	.heading {
		font-size: 0.75rem; font-weight: 700;
		letter-spacing: 0.15em; color: var(--text-secondary);
	}
	.section { display: flex; flex-direction: column; gap: 0.5rem; }
	.field-label {
		font-size: 0.6rem; font-weight: 700;
		letter-spacing: 0.15em; color: var(--text-secondary);
	}
	.toggle-group { display: flex; gap: 0.5rem; }
	.toggle-group button {
		flex: 1; padding: 0.75rem;
		background: var(--surface); border: 1px solid #333;
		border-radius: 4px; font-size: 0.75rem;
		font-weight: 600; letter-spacing: 0.05em;
		color: var(--text-secondary);
		transition: border-color 0.15s, color 0.15s;
	}
	.toggle-group button.active {
		border-color: var(--accent); color: var(--accent);
	}
	.danger { margin-top: 2rem; }
	.reset-btn {
		padding: 0.75rem; background: var(--surface);
		border: 1px solid var(--wrong); border-radius: 4px;
		color: var(--wrong); font-size: 0.75rem;
		font-weight: 700; letter-spacing: 0.1em;
	}
	.reset-yes {
		border-color: var(--wrong) !important;
		color: var(--wrong) !important;
	}
	.warn { font-size: 0.8rem; color: var(--wrong); }
</style>
```

- [ ] **Step 2: Full manual test of all 4 screens**

```bash
npm run dev
```
Expected: Home → Quiz (play, answer, feedback, advance) → Progress (cards, stats) → Settings (toggles, reset)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: settings screen with tone, direction, length, and reset"
```

---

## Task 12: Static Adapter + Final Polish

**Files:**
- Modify: `svelte.config.js`

- [ ] **Step 1: Install static adapter**

```bash
npm install -D @sveltejs/adapter-static
```

- [ ] **Step 2: Configure static adapter**

```js
// svelte.config.js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			fallback: 'index.html'
		})
	}
};
```

- [ ] **Step 3: Add prerender config**

Create `src/routes/+layout.ts`:
```ts
export const prerender = true;
export const ssr = false;
```

- [ ] **Step 4: Build and verify**

```bash
npm run build
npx serve build
```
Expected: Static site serves at localhost:3000, all routes work

- [ ] **Step 5: Run all tests**

```bash
npm test
```
Expected: All tests pass

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: static adapter, build config, ear trainer MVP complete"
```
