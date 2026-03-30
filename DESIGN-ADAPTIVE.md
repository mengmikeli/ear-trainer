# DESIGN-ADAPTIVE.md — v3.5 Adaptive Learning Engine

**Date:** 2026-03-27  
**Status:** Approved (2026-03-27)  
**Author:** Pixi  
**Branch:** `feat/adaptive`  
**Sprint:** 3

### Decisions (from review)
- **Progressions** → deferred to v3.6
- **Locrian mode** → skipped (low ROI)
- **Drone volume** → fixed level + mute toggle (no slider)
- **Smart session length** → keep 10/20/30 (no auto)
- **Connection toasts** → cut from v3.5 UI (connections still power engine weighting internally)
- **Connection toast tone** → N/A (cut), but if added later: terse/industrial (`"m3 → defines minor chords"`)

---

## Overview

v3.5 unifies the three independent training systems (intervals, chords, scales) under a single adaptive learning engine. Today each content type has its own isolated SM-2 tracker, its own tier unlock logic, and its own session flow. The user manually picks what to practice. This sprint replaces that with:

1. A **unified adaptive engine** that tracks mastery across all content in one model
2. A **smart session planner** that generates "today's practice" based on cross-content weaknesses
3. **Cross-content connections** that surface relationships between intervals, chords, and scales
4. **Modes with drone** (Tier 4 scales) — modal hearing over a sustained root
5. Stretch goal: **chord progression identification**

Design principle: the user should be able to tap GO and get a session that makes them better at *hearing music*, not just better at one quiz type.

---

## 1. Unified Adaptive Engine

### Problem

Currently `engine.ts` has three nearly identical implementations:
- `pickInterval()` / `generateQuestion()`
- `pickChord()` / `generateChordQuestion()`
- `pickScale()` / `generateScaleQuestion()`

Each uses the same weighting formula (weakness × 0.5 + review × 0.3 + newBoost) but operates on its own state silo. SM-2 parameters are duplicated across `IntervalState`, `ChordState`, and `ScaleState`. Tier unlock logic is copy-pasted three times in `state.ts`.

### Solution: ContentItem abstraction

Introduce a single `ContentItem` type that wraps any quiz-able thing:

```typescript
// New: src/lib/adaptive.ts

type ContentKind = 'interval' | 'chord' | 'scale' | 'mode';

interface ContentItem {
  kind: ContentKind;
  id: string;           // e.g. "interval:P5:ascending", "chord:min7:root", "scale:blues"
  defId: string;        // e.g. "P5", "min7", "blues"
  variant?: string;     // e.g. "ascending", "root" (mode/voicing)
  tier: number;
  category?: string;    // e.g. "diatonic", "triad", "pentatonic"
}

interface ContentStats {
  attempts: number;
  correct: number;
  streak: number;
  lastSeen: number;     // timestamp ms
  easeFactor: number;   // SM-2 (default 2.5)
  nextReview: number;   // timestamp ms
  // Cross-content linkage (populated by the connection engine)
  relatedItems: string[];  // ContentItem ids that share musical DNA
}
```

**Composite IDs** encode kind + definition + variant: `"interval:m3:descending"`, `"chord:dom7:first"`, `"scale:nat_min"`. This makes every quiz-able skill a unique node in one flat map.

### Unified pick function

```typescript
function pickNextItem(
  items: ContentItem[],
  stats: Record<string, ContentStats>,
  config: SessionConfig
): ContentItem {
  const now = Date.now();

  const weights = items.map(item => {
    const s = stats[item.id] ?? defaultStats();
    const accuracy = s.attempts > 0 ? s.correct / s.attempts : 0.5;
    const weaknessWeight = 1 - accuracy;

    const overdue = s.nextReview > 0 ? Math.max(0, now - s.nextReview) : 0;
    const reviewWeight = Math.min(1, overdue / (24 * 60 * 60 * 1000));

    const newBoost = s.attempts === 0 ? 0.5 : 0;

    // Cross-content boost: if a related item was recently failed,
    // boost this item to reinforce the connection
    const connectionBoost = getConnectionBoost(item, stats);

    return {
      item,
      weight: 0.1
        + weaknessWeight * 0.4
        + reviewWeight * 0.3
        + newBoost
        + connectionBoost * 0.2
    };
  });

  // Weighted random selection (same pattern as current engine)
  return weightedPick(weights);
}
```

### Migration strategy

- `UserState` keeps existing `intervals`, `chords`, `scales` fields for backward compat
- New `adaptive` field holds the unified `Record<string, ContentStats>` map
- On first load after update, a migration function builds the adaptive map from existing per-content states
- Existing quiz pages continue to work (they read from their content-specific state); the adaptive engine *also* writes back to those states for backward compat during the transition
- Once stable, the content-specific stats become derived views of the unified map

```typescript
// UserState addition
interface UserState {
  // ... existing fields ...
  adaptive?: {
    stats: Record<string, ContentStats>;
    sessionHistory: SessionRecord[];  // last N sessions for planning
    lastSessionDate: number;
  };
}
```

---

## 2. Smart Session Planner

### Concept: "Today's Session"

Instead of the user choosing intervals/chords/scales and tapping GO, the home screen offers a primary **"Train"** button that launches a mixed session optimized for their current learning state.

The user can still manually pick a content type (intervals-only, chords-only, etc.) — but the default path is the smart session.

### Session composition algorithm

```typescript
interface SessionConfig {
  length: number;           // 10/20/30 questions
  allowedKinds: ContentKind[];  // user can restrict if desired
  mixStrategy: 'adaptive' | 'focused';
}

interface SessionPlan {
  questions: PlannedQuestion[];
  rationale: string;        // human-readable "why this session"
}
```

Planning logic:

1. **Gather all unlocked ContentItems** across intervals, chords, scales, modes
2. **Score each by urgency** = overdue_factor × (1 - accuracy) × recency_penalty
3. **Bucket by kind** — ensure variety (no 20-question session of all intervals)
4. **Apply session structure rules:**
   - First 2-3 questions: warm-up (items the user is good at — builds confidence)
   - Middle 60%: weakness-focused (highest urgency items)
   - Last 20%: review of today's mistakes + newly introduced items
   - At least 2 content types represented if the user has unlocked them
5. **Interleaving** — don't cluster same-kind questions; alternate to force context switching (proven to improve retention: "interleaved practice" research)

### Session summary enhancements

After a smart session, the debrief screen shows:
- Performance breakdown by content type
- "Connections discovered" — e.g. "You nailed m3 ascending — that's the foundation of minor chords, which you're also improving!"
- Suggested next focus area

### Home screen changes

```
┌─────────────────────────┐
│     ◉ EAR TRAINER       │
│                         │
│   ▼ TODAY'S SESSION ▼   │
│  "Intervals + Scales    │
│   focus on weak m6"     │
│                         │
│      ┌─────────┐        │
│      │  TRAIN  │        │
│      └─────────┘        │
│                         │
│  [Intervals] [Chords]   │
│  [Scales]    [Modes]    │
│                         │
│   streak: 5d | 847 Qs   │
└─────────────────────────┘
```

The smaller content-type buttons let users drill specific areas. The big TRAIN button launches the smart session.

---

## 3. Cross-Content Connections

### Musical relationships

Intervals, chords, and scales are deeply linked. Recognizing these connections accelerates learning. The engine should surface them.

**Connection map (static, defined at build time):**

```typescript
// src/lib/connections.ts

interface Connection {
  from: string;       // ContentItem id pattern (e.g. "interval:M3:*")
  to: string;         // ContentItem id pattern (e.g. "chord:maj:*")
  relationship: string;
  description: string;
}

const CONNECTIONS: Connection[] = [
  // Intervals → Chords
  { from: "interval:M3", to: "chord:maj",
    relationship: "builds",
    description: "Major 3rd is the defining interval of major chords" },
  { from: "interval:m3", to: "chord:min",
    relationship: "builds",
    description: "Minor 3rd is the defining interval of minor chords" },
  { from: "interval:P5", to: "chord:maj",
    relationship: "builds",
    description: "Perfect 5th completes the major triad" },
  { from: "interval:TT", to: "chord:dim",
    relationship: "builds",
    description: "Tritone defines the diminished triad" },
  { from: "interval:m7", to: "chord:dom7",
    relationship: "builds",
    description: "Minor 7th on top of a major triad = dominant 7th" },

  // Intervals → Scales
  { from: "interval:M2", to: "scale:major",
    relationship: "step",
    description: "Whole steps drive the major scale" },
  { from: "interval:m3", to: "scale:min_pent",
    relationship: "character",
    description: "Minor 3rd gives minor pentatonic its color" },
  { from: "interval:TT", to: "scale:blues",
    relationship: "character",
    description: "The blue note (tritone) defines the blues scale" },
  { from: "interval:m2", to: "scale:chromatic",
    relationship: "step",
    description: "Half steps build the chromatic scale" },

  // Chords → Scales
  { from: "chord:maj", to: "scale:major",
    relationship: "harmonic",
    description: "Major chord is the I chord of the major scale" },
  { from: "chord:min", to: "scale:nat_min",
    relationship: "harmonic",
    description: "Minor chord is the i chord of natural minor" },
  { from: "chord:dom7", to: "scale:blues",
    relationship: "harmonic",
    description: "Dominant 7th over blues scale = classic blues sound" },

  // ... more connections populated programmatically from interval content of each chord/scale
];
```

### Programmatic connection generation

Beyond the hand-curated list, generate connections automatically:
- For each chord, find all intervals it contains → create `builds` connections
- For each scale, find its characteristic intervals → create `step`/`character` connections
- For each scale, find chords that can be built on its degrees → create `harmonic` connections

### Connection boost in question selection

When a user fails `interval:m3:ascending`, the engine boosts related items:
- `chord:min:*` gets a small urgency boost (the user might benefit from hearing m3 in a chord context)
- `scale:nat_min` gets a boost (m3 is characteristic)

This creates a natural "the app is teaching me music theory" feel without explicit lessons.

### UI: Connection toasts

When the user gets a correct answer on a connected item, occasionally show a brief toast:

> "Nice! That minor 3rd is the same interval that defines the minor chord you practiced earlier."

Rules:
- Max 1 toast per session (don't be annoying)
- Only on correct answers (positive reinforcement)
- Only when the related item was practiced in the last 3 sessions
- Dismissible, non-blocking

---

## 4. Modes with Drone (Tier 4 Scales)

### Concept

Musical modes (Dorian, Mixolydian, etc.) are scales defined *relative to a tonal center*. To hear modal color, you need a **drone** — a sustained root note that provides the tonal anchor while the mode plays over it.

### New content type

```typescript
// Addition to scales.ts or new modes.ts

interface ModeDef {
  id: string;            // e.g. "dorian", "mixolydian"
  name: string;          // e.g. "Dorian"
  label: string;         // e.g. "Dor"
  parent: string;        // parent scale id (e.g. "major")
  degree: number;        // which degree of parent scale (2 for Dorian)
  intervals: number[];   // semitones from root
  tier: number;          // always 4 (advanced)
  category: 'mode';
  characteristic: number[]; // the intervals that distinguish this mode
}

const MODES: ModeDef[] = [
  {
    id: 'dorian',
    name: 'Dorian',
    label: 'Dor',
    parent: 'major',
    degree: 2,
    intervals: [0, 2, 3, 5, 7, 9, 10, 12],
    tier: 4,
    category: 'mode',
    characteristic: [3, 10],  // minor 3rd + minor 7th (vs natural minor's minor 6th)
  },
  {
    id: 'mixolydian',
    name: 'Mixolydian',
    label: 'Mix',
    parent: 'major',
    degree: 5,
    intervals: [0, 2, 4, 5, 7, 9, 10, 12],
    tier: 4,
    category: 'mode',
    characteristic: [10],  // minor 7th (vs major's major 7th)
  },
  {
    id: 'phrygian',
    name: 'Phrygian',
    label: 'Phr',
    parent: 'major',
    degree: 3,
    intervals: [0, 1, 3, 5, 7, 8, 10, 12],
    tier: 4,
    category: 'mode',
    characteristic: [1],  // minor 2nd (the "Spanish" interval)
  },
  {
    id: 'lydian',
    name: 'Lydian',
    label: 'Lyd',
    parent: 'major',
    degree: 4,
    intervals: [0, 2, 4, 6, 7, 9, 11, 12],
    tier: 4,
    category: 'mode',
    characteristic: [6],  // augmented 4th (the "dreamy" interval)
  },
  // Aeolian = natural minor (already exists as scale)
  // Locrian deferred — rarely used, hard to hear without context
];
```

### Drone audio mechanism

```typescript
// Addition to audio.ts

interface DroneHandle {
  stop: () => void;
  setVolume: (v: number) => void;
}

/**
 * Start a continuous drone on a given MIDI note.
 * Uses layered sine + triangle with slow LFO for warmth.
 * Returns a handle to stop it.
 */
export function startDrone(midi: number, toneType: ToneType = 'epiano'): DroneHandle {
  const audioCtx = getContext();
  const master = getMasterOutput();

  // Fundamental — sine wave
  const osc1 = audioCtx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = midiToFreq(midi);

  // Fifth above — very quiet, adds richness
  const osc2 = audioCtx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = midiToFreq(midi + 7);

  // Slow LFO on gain for organic breathing feel
  const lfo = audioCtx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.15; // very slow

  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 0.03; // subtle

  lfo.connect(lfoGain);

  // Master drone gain
  const droneGain = audioCtx.createGain();
  droneGain.gain.value = 0; // start silent

  // Low-pass filter for warmth
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  filter.Q.value = 0.7;

  const osc1Gain = audioCtx.createGain();
  osc1Gain.gain.value = 0.15;
  const osc2Gain = audioCtx.createGain();
  osc2Gain.gain.value = 0.04;

  osc1.connect(osc1Gain);
  osc2.connect(osc2Gain);
  osc1Gain.connect(filter);
  osc2Gain.connect(filter);
  lfoGain.connect(droneGain.gain);
  filter.connect(droneGain);
  droneGain.connect(master);

  // Fade in over 1 second
  const now = audioCtx.currentTime;
  droneGain.gain.setValueAtTime(0, now);
  droneGain.gain.linearRampToValueAtTime(1, now + 1.0);

  osc1.start(now);
  osc2.start(now);
  lfo.start(now);

  return {
    stop() {
      const t = audioCtx.currentTime;
      droneGain.gain.setValueAtTime(droneGain.gain.value, t);
      droneGain.gain.linearRampToValueAtTime(0, t + 0.5);
      setTimeout(() => {
        osc1.stop();
        osc2.stop();
        lfo.stop();
        osc1.disconnect();
        osc2.disconnect();
        lfo.disconnect();
        droneGain.disconnect();
      }, 600);
    },
    setVolume(v: number) {
      droneGain.gain.linearRampToValueAtTime(
        Math.max(0, Math.min(1, v)),
        audioCtx.currentTime + 0.1
      );
    }
  };
}
```

### Mode quiz flow

1. Drone starts on root note (always the same root within a question for clarity)
2. Scale plays ascending over the drone
3. User identifies the mode from 4 choices
4. A/B comparison available: "Hear Dorian" / "Hear Mixolydian" (on wrong answers)
5. Drone fades out after answer feedback

### Mode unlock

Modes unlock as Scale Tier 4 when:
- All Tier 3 scales unlocked
- ≥60 total scale questions with ≥70% accuracy

---

## 5. Chord Progressions (Stretch Goal)

### Concept

Identify short (2-4 chord) progressions by their function (I-IV-V-I, ii-V-I, etc.).

### Why stretch goal

- Requires new audio playback logic (sequential chords with timing)
- Answer format is more complex (ordered sequence of Roman numerals)
- Needs a key context / drone to establish tonal center
- Significant new UI patterns

### If scope allows — minimal design

```typescript
interface ProgressionDef {
  id: string;             // e.g. "I-IV-V-I"
  name: string;           // e.g. "Classic"
  numerals: string[];     // ["I", "IV", "V", "I"]
  chordTypes: string[];   // ["maj", "maj", "maj", "maj"] (in major key)
  scaleDegrees: number[]; // [0, 5, 7, 0] (semitone offset from key root)
  tier: number;
}

// Tier 1 progressions (if implemented)
const PROGRESSIONS: ProgressionDef[] = [
  { id: "I-V-vi-IV", name: "Pop", numerals: ["I","V","vi","IV"],
    chordTypes: ["maj","maj","min","maj"], scaleDegrees: [0,7,9,5], tier: 1 },
  { id: "I-IV-V-I", name: "Classic", numerals: ["I","IV","V","I"],
    chordTypes: ["maj","maj","maj","maj"], scaleDegrees: [0,5,7,0], tier: 1 },
  { id: "ii-V-I", name: "Jazz", numerals: ["ii","V","I"],
    chordTypes: ["min7","dom7","maj7"], scaleDegrees: [2,7,0], tier: 2 },
];
```

Playback: drone on I + chords played sequentially (1 beat each at ~100 BPM).

**Decision needed from Mike:** include progressions in v3.5 scope or defer to v3.6?

---

## 6. Data Model Changes

### New types

```typescript
// src/lib/types.ts additions

interface AdaptiveStats {
  stats: Record<string, ContentStats>;    // unified stats map
  sessionHistory: SessionRecord[];         // last 20 sessions
  lastSessionDate: number;
  connectionsShown: string[];              // connection toast ids shown (don't repeat)
}

interface SessionRecord {
  date: number;
  length: number;
  kinds: ContentKind[];
  accuracy: number;
  weakestItem: string;    // ContentItem id
  strongestItem: string;
}

interface ContentStats {
  attempts: number;
  correct: number;
  streak: number;
  lastSeen: number;
  easeFactor: number;
  nextReview: number;
  relatedItems: string[];
}
```

### Migration

```typescript
// state.ts migration addition
function migrateToAdaptive(state: UserState): UserState {
  if (state.adaptive) return state; // already migrated

  const stats: Record<string, ContentStats> = {};

  // Intervals → adaptive stats (one entry per interval × mode)
  for (const [id, s] of Object.entries(state.intervals)) {
    for (const mode of ['ascending', 'descending', 'harmonic'] as const) {
      const ms = s.modes[mode];
      const key = `interval:${id}:${mode}`;
      stats[key] = {
        attempts: ms.attempts,
        correct: ms.correct,
        streak: ms.streak,
        lastSeen: ms.lastSeen,
        easeFactor: ms.easeFactor,
        nextReview: ms.nextReview,
        relatedItems: [],  // populated by connection engine on first load
      };
    }
  }

  // Chords → adaptive stats (one entry per chord × voicing)
  for (const [id, s] of Object.entries(state.chords)) {
    for (const voicing of ['root', 'first', 'second'] as const) {
      const vs = s.voicings[voicing];
      const key = `chord:${id}:${voicing}`;
      stats[key] = {
        attempts: vs.attempts,
        correct: vs.correct,
        streak: vs.streak,
        lastSeen: vs.lastSeen,
        easeFactor: vs.easeFactor,
        nextReview: vs.nextReview,
        relatedItems: [],
      };
    }
  }

  // Scales → adaptive stats (flat, no variant)
  for (const [id, s] of Object.entries(state.scales)) {
    const key = `scale:${id}`;
    stats[key] = {
      attempts: s.attempts,
      correct: s.correct,
      streak: s.streak,
      lastSeen: s.lastSeen,
      easeFactor: s.easeFactor,
      nextReview: s.nextReview,
      relatedItems: [],
    };
  }

  return {
    ...state,
    adaptive: {
      stats,
      sessionHistory: [],
      lastSessionDate: 0,
      connectionsShown: [],
    },
  };
}
```

### Backward compatibility

The adaptive engine writes back to the content-specific state objects after each answer so that:
- Existing quiz pages (intervals-only, chords-only, scales-only) continue to work unchanged
- Progress page aggregation logic continues to work
- Tier unlock logic continues to work from existing fields

This is a **dual-write** approach during the transition. Once all UI reads from the adaptive map, the legacy fields become optional/derived.

---

## 7. Tier Unlock Unification

### Current problem

Each content type has its own hardcoded unlock thresholds in `state.ts`. Adding modes requires another copy.

### Solution

```typescript
interface TierConfig {
  kind: ContentKind;
  tier: number;
  requirements: {
    totalQuestions: number;
    accuracy: number;
    // Optional: require specific items mastered
    prerequisiteMastery?: string[];  // ContentItem ids
  };
}

const TIER_CONFIGS: TierConfig[] = [
  // Intervals
  { kind: 'interval', tier: 2, requirements: { totalQuestions: 10, accuracy: 0.7 } },
  { kind: 'interval', tier: 3, requirements: { totalQuestions: 30, accuracy: 0.7 } },
  { kind: 'interval', tier: 4, requirements: { totalQuestions: 60, accuracy: 0.7 } },
  { kind: 'interval', tier: 5, requirements: { totalQuestions: 100, accuracy: 0.7 } },
  // Chords
  { kind: 'chord', tier: 2, requirements: { totalQuestions: 10, accuracy: 0.7 } },
  { kind: 'chord', tier: 3, requirements: { totalQuestions: 30, accuracy: 0.7 } },
  { kind: 'chord', tier: 4, requirements: { totalQuestions: 60, accuracy: 0.7 } },
  // Scales
  { kind: 'scale', tier: 2, requirements: { totalQuestions: 10, accuracy: 0.7 } },
  { kind: 'scale', tier: 3, requirements: { totalQuestions: 30, accuracy: 0.7 } },
  // Modes — requires scale mastery
  { kind: 'mode', tier: 4, requirements: {
    totalQuestions: 60,
    accuracy: 0.7,
    prerequisiteMastery: ['scale:major', 'scale:nat_min'],
  }},
];

function checkUnifiedTierUnlock(state: UserState): UserState {
  // Single function replaces 3 separate tier-unlock blocks
  // Reads from adaptive stats, writes back to per-content unlocked flags
}
```

---

## 8. Implementation Plan

### Phase 1: Foundation (days 1-2)
- [ ] Create `src/lib/adaptive.ts` — ContentItem types + unified pick function
- [ ] Create `src/lib/connections.ts` — connection map + boost logic
- [ ] Add `adaptive` field to UserState + migration in `state.ts`
- [ ] Unified tier unlock function
- [ ] Tests for adaptive engine + migration

### Phase 2: Smart Session (days 3-4)
- [ ] Session planner algorithm in `adaptive.ts`
- [ ] New "Train" (smart session) quiz route: `src/routes/quiz/adaptive/+page.svelte`
- [ ] Home screen update: TRAIN button + session preview text
- [ ] Mixed-content question rendering (needs to handle interval/chord/scale questions in one session)
- [ ] Debrief screen with cross-content breakdown

### Phase 3: Modes + Drone (days 4-5)
- [ ] `src/lib/modes.ts` — mode definitions
- [ ] `startDrone()` + `stopDrone()` in `audio.ts`
- [ ] Mode quiz page: `src/routes/quiz/modes/+page.svelte`
- [ ] A/B comparison on wrong mode answers
- [ ] Mode entries in the adaptive engine + connection map

### Phase 4: Polish + QA (days 5-6)
- [ ] Dev mode: bypass all tier locks, force-enable all content
- [ ] Migration tests with existing localStorage shapes
- [ ] Performance audit (adaptive map could grow — ensure O(n) not O(n²))
- [ ] Tag <@1485281883440021605> for QA

### Stretch: Progressions → deferred to v3.6

---

## 9. Open Questions for Mike

1. **Progressions in scope?** Minimal 2-chord progressions (I-V, I-IV) could be doable. Full 4-chord progressions are a v3.6 feature.
2. **Locrian mode?** It's rarely practical but theoretically complete. Include or skip?
3. **Drone volume control?** Slider in settings, or fixed level? (I lean toward a subtle fixed level with a mute toggle.)
4. **Session length for smart sessions?** Keep the 10/20/30 picker, or introduce an "auto" length that adapts to available time?
5. **Connection toasts — tone?** Currently written as encouraging/informational. Want them more terse/industrial to match the aesthetic?

---

## 10. Non-Goals

- No backend / user accounts (remains localStorage-only)
- No AI-powered recommendations (the algorithm is deterministic + random)
- No gamification beyond existing mastery badges
- No social/leaderboard features
- No freeform input mode (still phase 2, separate sprint)

---

## Visual Mockups

Not included in this doc — will implement directly in code following existing Marathon "Graphic Realism" patterns. The main new visual elements:

- **TRAIN button** on home (replaces GO or sits above it)
- **Session preview** text below TRAIN ("Focus: intervals + scales • 20 Qs")
- **Connection toast** — bottom toast bar, same style as current feedback flash
- **Drone indicator** — subtle pulsing icon during mode questions (shows drone is active)
- **Mixed debrief** — existing debrief layout extended with per-content-type breakdown rows
