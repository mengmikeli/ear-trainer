# Scale System — v3.4 Design Doc

**Author:** Pixi  
**Date:** 2026-03-23  
**Status:** Draft — for review

---

## Goal

Add scale identification as a third content type alongside intervals and chords. Scales get their own progression track, mastery system, and quiz flow. The adaptive engine architecture (SM-2, weakness weighting, tier unlocks) carries over.

### How scales differ from intervals/chords

- **More notes** — scales are 5-8 notes vs 2 (interval) or 3-4 (chord)
- **Sequential by nature** — scales are always played ascending/descending, never "harmonic"
- **Identity is in the pattern** — a scale's character comes from its sequence of whole/half steps, not a single sonority
- **Confusability clusters** — major vs mixolydian (one note different) is much harder than major vs pentatonic (different note count)

---

## Data Model

### ScaleDef — static definition

```typescript
interface ScaleDef {
  id: string;           // e.g. "major", "nat-min", "pent-maj", "blues"
  name: string;         // e.g. "Major", "Natural Minor", "Blues"
  intervals: number[];  // semitones from root, e.g. [0, 2, 4, 5, 7, 9, 11] for major
  tier: number;         // 1-4 unlock tier
  category: 'diatonic' | 'pentatonic' | 'modal' | 'other';
  noteCount: number;    // 5 for pentatonic, 7 for diatonic, 6 for blues
}
```

### ScaleState — per-scale progress

```typescript
type ScaleDirection = 'ascending' | 'descending';

interface ScaleState {
  scale: string;        // scale id
  unlocked: boolean;
  enabled: boolean;
  // Aggregate stats
  attempts: number;
  correct: number;
  easeFactor: number;
  nextReview: number;
  streak: number;
  lastSeen: number;
  // Per-direction tracking (scales are sequential — ascending/descending are the sub-skills)
  directions: {
    ascending: ModeStats;
    descending: ModeStats;
  };
}
```

**Why directions instead of voicings:** Scales don't have inversions. The sub-skill axis is direction — ascending and descending sound quite different for scales like harmonic minor (the augmented 2nd jumps out descending). Two sub-skills instead of three means mastery is: Bronze (1 direction) / Gold (both). No Silver — keeping it binary.

### Integration with UserState

```typescript
interface UserState {
  intervals: Record<string, IntervalState>;  // unchanged
  chords: Record<string, ChordState>;        // unchanged
  scales: Record<string, ScaleState>;        // NEW
  settings: Settings;
  stats: GlobalStats;
}
```

### Settings additions

```typescript
interface Settings {
  // ... existing fields ...
  // v3.4: scale directions
  enabledScaleDirections: {
    ascending: boolean;
    descending: boolean;
  };
  // activeContent extends to include scales
  activeContent: 'intervals' | 'chords' | 'scales';
}
```

---

## Scale Content — Tier Progression

**Prerequisite:** Scale system is LOCKED until chord mastery threshold is reached (e.g. Bronze mastery on 3+ chords). Same "hidden mystery" pattern as chords.

| Tier | Scales | Unlock Condition |
|------|--------|------------------|
| 1 (start) | Major, Natural Minor | Scale system unlock (from chord mastery) |
| 2 | Pentatonic Major, Pentatonic Minor | Tier 1: 10q + 70% acc |
| 3 | Harmonic Minor, Melodic Minor, Blues | Tier 2: 30q + 70% |
| 4 | Dorian, Mixolydian, Lydian | Tier 3: 60q + 70% |

### SCALES constant

```typescript
const SCALES: ScaleDef[] = [
  // Tier 1 — Foundation
  { id: 'major',     name: 'Major',            intervals: [0, 2, 4, 5, 7, 9, 11],  tier: 1, category: 'diatonic',   noteCount: 7 },
  { id: 'nat-min',   name: 'Natural Minor',    intervals: [0, 2, 3, 5, 7, 8, 10],  tier: 1, category: 'diatonic',   noteCount: 7 },

  // Tier 2 — Pentatonic
  { id: 'pent-maj',  name: 'Pentatonic Major', intervals: [0, 2, 4, 7, 9],         tier: 2, category: 'pentatonic', noteCount: 5 },
  { id: 'pent-min',  name: 'Pentatonic Minor', intervals: [0, 3, 5, 7, 10],        tier: 2, category: 'pentatonic', noteCount: 5 },

  // Tier 3 — Extended
  { id: 'harm-min',  name: 'Harmonic Minor',   intervals: [0, 2, 3, 5, 7, 8, 11],  tier: 3, category: 'diatonic',   noteCount: 7 },
  { id: 'mel-min',   name: 'Melodic Minor',    intervals: [0, 2, 3, 5, 7, 9, 11],  tier: 3, category: 'diatonic',   noteCount: 7 },
  { id: 'blues',     name: 'Blues',             intervals: [0, 3, 5, 6, 7, 10],     tier: 3, category: 'other',      noteCount: 6 },

  // Tier 4 — Modes
  { id: 'dorian',    name: 'Dorian',           intervals: [0, 2, 3, 5, 7, 9, 10],  tier: 4, category: 'modal',      noteCount: 7 },
  { id: 'mixolyd',   name: 'Mixolydian',       intervals: [0, 2, 4, 5, 7, 9, 10],  tier: 4, category: 'modal',      noteCount: 7 },
  { id: 'lydian',    name: 'Lydian',           intervals: [0, 2, 4, 6, 7, 9, 11],  tier: 4, category: 'modal',      noteCount: 7 },
];
```

### Tier rationale

- **Tier 1:** Major and natural minor — the two most fundamental scales. If you can't hear these, nothing else makes sense.
- **Tier 2:** Pentatonic — fewer notes (5), very distinct sound. Good stepping stone before the harder diatonic variants.
- **Tier 3:** Harmonic/melodic minor + blues — each has a distinctive "fingerprint note" (raised 7th, raised 6th+7th, blue note). Learnable once major/minor are solid.
- **Tier 4:** Modes — these are the hard ones. Dorian/Mixolydian/Lydian differ from major by ONE note. You need a trained ear to catch the difference.

---

## Mastery System

Scales have 2 sub-skills (ascending/descending) instead of 3:
- **Bronze:** 1 direction mastered (20 attempts, 85% accuracy)
- **Gold:** Both directions mastered
- No Silver — two-state is cleaner

`isModeMastered()` works as-is (same `ModeStats` shape). Mastery level computation:

```typescript
function getScaleMasteryLevel(state: ScaleState): 'none' | 'bronze' | 'gold' {
  const asc = isModeMastered(state.directions.ascending);
  const desc = isModeMastered(state.directions.descending);
  if (asc && desc) return 'gold';
  if (asc || desc) return 'bronze';
  return 'none';
}
```

---

## Audio — Scale Playback

Scales are played as ascending or descending runs — each note sequentially.

```typescript
function playScale(
  rootMidi: number,
  intervals: number[],    // [0, 2, 4, 5, 7, 9, 11] for major
  direction: 'ascending' | 'descending',
  toneType: ToneType
): void
```

**Playback behavior:**
- **Ascending:** play each note bottom-to-top, ~200ms per note, slight overlap for legato feel
- **Descending:** reverse the interval array, play top-to-bottom
- **End on octave:** always append the octave (root + 12) at the end for ascending, start on octave for descending. This gives the ear the "resolution" it expects.
- **Note duration:** 250ms per note, 50ms overlap → ~200ms gap. Faster than chord arpeggio (150ms) since scales are longer.

**Root range:** C4–C5 (MIDI 60–72). Narrower than intervals — scales span a full octave so the top notes need headroom.

---

## Engine — Question Generation

### pickScale() — weighted selection
Same algorithm as `pickChord()` / `pickInterval()`. Weakness + SM-2 review + new boost.

### pickScaleDirection() — ascending/descending selection
Same as `pickVoicing()` / `pickMode()`. Weakness-weighted from `state.directions`.

### generateScaleDistractors()
Confusability for scales = number of different notes between two scales. 

**Confusability matrix (examples):**
- Major vs Mixolydian: 1 note different (7th) → very confusable
- Major vs Dorian: 2 notes different (3rd, 7th) → moderate
- Major vs Pentatonic Major: different note counts → low confusability
- Natural Minor vs Dorian: 1 note different (6th) → very confusable

For distractor ranking, compute shared notes and prefer scales with more overlap.

### generateScaleQuestion()

```typescript
interface ScaleQuestion {
  rootNote: number;
  scale: ScaleDef;
  direction: 'ascending' | 'descending';
  choices: ScaleDef[];
  replays: number;
}
```

---

## Quiz Flow

Separate route: `/quiz/scales` (same pattern as `/quiz/chords`).

**Key differences from chord quiz:**
- No voicing indicator — replaced with direction indicator (ASC / DESC)
- No BLK/ARP toggle — scales are always sequential
- Longer playback time (7+ notes vs 3-4) → play button animation needs to account for ~1.5s total

**Quiz bar:** `EXIT` | `ASC/DESC` indicator | question counter — mirrors chord/interval quiz structure.

---

## UI

### Home screen
- Mode switcher extends: **INTERVALS** | **CHORDS** | **SCALES** (only after scales unlock)
- Stats context-aware per content type

### Progress screen
- Third content type in toggle: INTERVALS | CHORDS | SCALES
- Sub-tabs: ALL / ASC / DESC (two directions)
- ScaleCard component (same pattern as IntervalCard/ChordCard)

### Settings
- "Scale Directions" section: ASC / DESC toggles (at least 1 required)

---

## State Migration

On load, if `state.scales` is undefined:
1. Initialize `scales: Record<string, ScaleState>` from `SCALES` array
2. All scales start **locked** (unlocked via chord mastery discovery)
3. Direction stats at defaults
4. `enabledScaleDirections` defaults to `{ ascending: true, descending: true }`
5. `activeContent` type extends to include `'scales'`

Purely additive — no breaking changes.

---

## Discovery UX — Marathon Mystery (same pattern as chords)

- Scale system hidden until chord mastery threshold (Bronze on 3+ chords)
- Unlock moment: same glitch/decrypt reveal
- Progress page: scale section redacted until unlock
- The progression: Intervals → Chords → Scales creates a natural learning ladder

---

## Open Questions

1. **Melodic minor ascending vs descending?** Traditional melodic minor uses raised 6th+7th ascending but natural minor descending. Should we treat these as different scales or one scale with direction-dependent intervals?
2. **Octave resolution?** Always play the octave at the end, or stop on the 7th degree? The octave gives closure but adds time.
3. **Scale fragment exercises?** Instead of full scale, play 3-4 consecutive notes and ask "which scale?" — harder, more practical. Could be a phase 2 within scales.
4. **Which modes?** Current: Dorian, Mixolydian, Lydian. Should we include Phrygian (very distinctive flamenco sound) or is 3 modes enough for v3.4?
5. **Discovery threshold?** Bronze on 3+ chords to unlock scales — too easy? Too hard?

---

## Implementation Order

1. **Data layer:** `ScaleDef`, `ScaleState`, `SCALES` constant, state migration
2. **Audio:** `playScale()` with ascending/descending
3. **Engine:** `pickScale()`, `pickScaleDirection()`, `generateScaleQuestion()`, distractor gen
4. **Quiz route:** `/quiz/scales`
5. **Home screen:** extend mode switcher to 3 options
6. **Progress:** scale tab + ScaleCard component
7. **Settings:** direction toggles
8. **Tests:** mirror chord/interval test suites
