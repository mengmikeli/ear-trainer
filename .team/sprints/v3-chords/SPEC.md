# Chord System — v3.3 Design Doc

**Author:** Pixi  
**Date:** 2026-03-22  
**Status:** Draft — for review

---

## Goal

Add chord identification as a new content type alongside intervals. Chords get their own progression track, mastery system, and quiz flow — but share the adaptive engine architecture (SM-2, weakness weighting, tier unlocks) so the codebase stays unified.

---

## Data Model

### ChordDef — static definition (like IntervalDef)

```typescript
interface ChordDef {
  id: string;          // e.g. "maj", "min", "dim", "aug", "dom7", "maj7", "min7"
  name: string;        // e.g. "Major Triad", "Minor 7th"
  intervals: number[]; // semitones from root, e.g. [0, 4, 7] for major
  tier: number;        // 1-4 unlock tier (chord-specific, separate from interval tiers)
  category: 'triad' | 'seventh' | 'extended';  // for grouping in UI
}
```

### ChordState — per-chord progress (mirrors IntervalState shape)

```typescript
interface ChordModeStats {
  attempts: number;
  correct: number;
  streak: number;
  lastSeen: number;
  easeFactor: number;   // SM-2
  nextReview: number;   // timestamp ms
}

interface ChordState {
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
    root: ChordModeStats;      // root position
    first: ChordModeStats;     // 1st inversion
    second: ChordModeStats;    // 2nd inversion (triads) / 3rd inv for 7ths later
  };
}
```

### Integration with UserState

```typescript
interface UserState {
  intervals: Record<string, IntervalState>;  // unchanged
  chords: Record<string, ChordState>;        // NEW
  settings: Settings;
  stats: GlobalStats;
}
```

`chords` defaults to `{}` on first load → migration creates entries from `CHORDS` array (same pattern as intervals).

### Settings additions

```typescript
interface Settings {
  // ... existing fields ...
  // Chord-specific
  enabledVoicings: {
    root: boolean;       // root position
    first: boolean;      // 1st inversion
    second: boolean;     // 2nd inversion
  };
  activeMode: 'intervals' | 'chords';  // which quiz to launch from Practice
}
```

---

## Chord Content — Tier Progression

**Prerequisite:** Chord system is LOCKED until interval mastery threshold is reached (exact trigger TBD — e.g. all Tier 3 intervals unlocked + Bronze mastery on 5+ intervals).

| Tier | Chords | Unlock Condition |
|------|--------|------------------|
| 1 (start) | Major, Minor | Chord system unlock (from interval mastery) |
| 2 | Diminished, Augmented | Tier 1 chords: 10q + 70% acc |
| 3 | Dominant 7th, Major 7th, Minor 7th | Tier 2 chords: 30q + 70% |
| 4 | Diminished 7th, Half-dim 7th, Augmented 7th | Tier 3 chords: 60q + 70% |

**Threshold pattern:** same cumulative question count + accuracy gates as intervals (10/30/60/100 questions, 70% accuracy). The `checkTierUnlock` logic is reusable — just needs to be parameterized by content type.

### CHORDS constant (like INTERVALS)

```typescript
const CHORDS: ChordDef[] = [
  { id: 'maj',   name: 'Major',          intervals: [0, 4, 7],     tier: 1, category: 'triad' },
  { id: 'min',   name: 'Minor',          intervals: [0, 3, 7],     tier: 1, category: 'triad' },
  { id: 'dim',   name: 'Diminished',     intervals: [0, 3, 6],     tier: 2, category: 'triad' },
  { id: 'aug',   name: 'Augmented',      intervals: [0, 4, 8],     tier: 2, category: 'triad' },
  { id: 'dom7',  name: 'Dominant 7th',   intervals: [0, 4, 7, 10], tier: 3, category: 'seventh' },
  { id: 'maj7',  name: 'Major 7th',      intervals: [0, 4, 7, 11], tier: 3, category: 'seventh' },
  { id: 'min7',  name: 'Minor 7th',      intervals: [0, 3, 7, 10], tier: 3, category: 'seventh' },
  { id: 'dim7',  name: 'Diminished 7th', intervals: [0, 3, 6, 9],  tier: 4, category: 'seventh' },
  { id: 'hdim7', name: 'Half-dim 7th',   intervals: [0, 3, 6, 10], tier: 4, category: 'seventh' },
  { id: 'aug7',  name: 'Augmented 7th',  intervals: [0, 4, 8, 10], tier: 4, category: 'seventh' },
];
```

---

## Mastery System — Reuse Pattern

Intervals have mastery across 3 **play modes** (ascending, descending, harmonic).  
Chords have mastery across 3 **voicings** (root, 1st inversion, 2nd inversion).

The shape is identical — `ChordModeStats` has the same fields as `ModeStats`. This means:

- `isModeMastered()` works on both — it just takes a stats object
- `getMasteryLevel()` gets a generic version that counts mastered sub-skills out of 3
- Bronze/Silver/Gold maps naturally: 1/2/3 voicings mastered

```typescript
// Generalized — works for both intervals and chords
function getMasteryLevel(substats: ModeStats[]): MasteryLevel {
  const mastered = substats.filter(s => isModeMastered(s)).length;
  if (mastered === 0) return 'none';
  if (mastered === 1) return 'bronze';
  if (mastered === 2) return 'silver';
  return 'gold';
}
```

---

## Audio — Chord Playback

Chords are played by triggering multiple notes simultaneously using the existing audio engine.

```typescript
function playChord(
  rootNote: number,
  intervals: number[],      // [0, 4, 7] for major triad
  voicing: 'root' | 'first' | 'second',
  toneType: ToneType,
  arpeggiated: boolean       // block vs arpeggiated
): void
```

**Voicing logic:**
- **Root position:** play intervals as-is from root
- **1st inversion:** move bottom note up an octave → e.g. major becomes [4, 7, 12]
- **2nd inversion:** move bottom two notes up → e.g. major becomes [7, 12, 16]
- **Inversion unlock:** root available by default; 1st inv unlocks at Bronze mastery; 2nd inv at Silver

**Playback modes:**
- **Block chord:** all notes trigger simultaneously with slight humanization offset (0–15ms random per note)
- **Arpeggiated:** notes play bottom-to-top with ~150ms spacing per note. User toggles between block/arpeggio in quiz UI.

The existing `playInterval()` creates oscillators — `playChord()` creates N oscillators (one per note in the chord) with the same envelope.

**Root range:** C3–C5 for triads (narrower than intervals to keep chords in a pleasant register).

---

## Engine — Question Generation

### pickChord() — weighted selection (mirrors pickInterval)

Same algorithm: weakness weight + SM-2 review weight + new boost. Operates on `ChordState` entries.

### pickVoicing() — per-chord voicing selection (mirrors pickMode)

Selects voicing based on enabled voicings and per-voicing weakness. Same pattern as `pickMode()`.

### generateChordQuestion()

```typescript
interface ChordQuestion {
  rootNote: number;
  chord: ChordDef;
  voicing: 'root' | 'first' | 'second';
  choices: ChordDef[];
  replays: number;
}
```

Distractor generation: same confusable-distance approach. For chords, "distance" = number of different intervals. Major vs minor (1 note different) is a closer confusable than major vs diminished (2 notes different).

---

## Quiz Flow

The quiz page needs to support both content types. Options:

### Option A: Separate quiz routes
- `/quiz/intervals` and `/quiz/chords`
- Practice button on home launches whichever `activeMode` is set
- Simplest to implement, no conditional branching in quiz logic

### Option B: Unified quiz with content type parameter
- `/quiz?type=chords`
- One quiz component that accepts a content type and renders accordingly
- More DRY but adds branching complexity

**Recommendation: Option A.** The quiz pages share visual structure but differ enough (answer display, audio playback, voicing indicator vs mode indicator) that separate routes are cleaner. Extract shared components (ProgressBar, TelemetryBar, PlayButton, Feedback) — they're already components.

---

## UI — Chord-Specific Elements

### Home screen
- Mode switcher: **INTERVALS** | **CHORDS** toggle (sets `activeMode`)
- Practice button label stays "PRACTICE" — context is clear from mode
- Stats shown are for the active mode

### Quiz screen (chords)
- Voicing indicator in top bar (replaces mode glyph): `ROOT` / `INV1` / `INV2`
- Answer buttons show chord names (not interval names)
- Play button behavior identical

### Progress screen
- Tab addition: a top-level toggle for INTERVALS / CHORDS
- Chord progress shows: chord cards with voicing mastery (same Bronze/Silver/Gold)
- Tabs within chords: ALL / ROOT / INV1 / INV2 (mirrors ALL / ASC / DESC / HARM)

### Settings
- New section: "Chord Voicings" with toggles for root / 1st inv / 2nd inv
- Mode switcher (intervals vs chords) — or just put it on home screen

---

## State Migration

On load, if `state.chords` is undefined:
1. Initialize `chords: Record<string, ChordState>` from `CHORDS` array
2. Tier 1 chords start unlocked, rest locked
3. All voicing stats start at defaults (same as `createDefaultModeStats()`)
4. No existing data to migrate — purely additive

This is simpler than the v2→v3 interval migration since chords are new content.

---

## Shared Infrastructure — Refactor Opportunities

To avoid duplicating the engine:

| Current (interval-specific) | Generalized |
|---|---|
| `IntervalState` | `ContentState<T>` with generic sub-skill type |
| `pickInterval()` | `pickContent(states, enabled)` |
| `pickMode()` | `pickSubSkill(state, enabledSubSkills)` |
| `checkTierUnlock()` | `checkTierUnlock(states, tiers, thresholds)` |
| `isModeMastered()` | Already generic (takes `ModeStats`) |
| `getMasteryLevel()` | Already generalizable |

**Recommendation:** Do this refactor incrementally. Ship chords with some duplication first (chord-specific versions of engine functions), then DRY it up in a follow-up. Premature abstraction is worse than a bit of copy-paste.

---

## Decisions (confirmed by Mike 2026-03-23)

1. **Root-only to start.** Inversions unlock as mastery reward (Bronze → 1st inv, Silver → 2nd inv).
2. **Arpeggiated playback included in MVP.** Toggle between block chord and arpeggiated (~150ms note spacing).
3. **Combined streak, separate counts.** Practicing either content type keeps streak alive. Per-type question/session counts.
4. **Triads first.** 7th chords unlock later (tier 3+), not available from day one.
5. **Chords unlock FROM interval mastery.** Chords aren't visible from the start — the entire chord system is a hidden content track that reveals itself when the user hits a certain interval mastery threshold. Marathon-themed "uncovered mystery" — the user discovers it, they don't browse to it.
6. **Unified progression** — chord mastery feeds into one overall ear training level alongside intervals, but the chord section itself has a hidden/discovery feel. Think: classified section of the training terminal that decrypts as you prove yourself.
7. **Mixed mode** (intervals + chords interleaved) — deferred to v3.5.
8. **Chord quality hints** — TBD, not in MVP scope.

### Discovery UX direction (Marathon mystery theme)
The chord system should feel like uncovering a hidden sector of the app. Ideas to explore:
- Home screen doesn't show INTERVALS | CHORDS toggle until chords are unlocked
- Unlock moment: a glitch/decrypt animation reveals a new section — like a classified file being unsealed
- Progress page: chord section appears as redacted/encrypted blocks before unlock, teasing that something is there
- The unlock trigger needs to feel earned — tied to interval mastery, not just question count

---

## Implementation Order

1. **Data layer:** `ChordDef`, `ChordState`, `CHORDS` constant, state migration
2. **Audio:** `playChord()` with voicing logic
3. **Engine:** `pickChord()`, `pickVoicing()`, `generateChordQuestion()`, distractor gen
4. **Quiz route:** `/quiz/chords` with chord-specific UI
5. **Home screen:** mode switcher
6. **Progress:** chord tab on progress page
7. **Settings:** voicing toggles
8. **Tests:** mirror interval test suite for chords
