# DESIGN-SCALES.md — Scale Identification System

**Date:** 2026-03-24
**Status:** ✅ Approved (2026-03-24)
**Author:** Pixi

---

## TL;DR — Recommendation

**The current quiz template (play sound → pick from 4 choices) does NOT work well for scales in its current form.** Intervals and chords are point-in-time sounds — you hear it, you classify it. A scale is a *sequence*. The skill being trained is fundamentally different: recognizing the *pattern of intervals* that gives each scale its character, not a single sonic event.

**Proposed interaction model: "Hear the scale → identify the quality."** Same 4-choice grid, but the *stimulus* changes significantly — we play the full ascending scale over a fixed root, and the user identifies which scale type it is. This reuses the existing quiz infrastructure (~80% shared) but with a different audio engine and a curated question space.

I'm also recommending we **start narrow**: major vs natural minor vs harmonic minor. NOT modes. Here's why.

---

## What Skill Are We Actually Training?

### Intervals: "What's the distance between two notes?"
- Stimulus: 2 notes → instant classification
- Pool: 13 items, all can be compared directly

### Chords: "What's the quality of this stack of notes?"
- Stimulus: 3-4 simultaneous notes → instant classification
- Pool: 10 items, grouped by category

### Scales: "What's the pattern/flavor of this sequence?"
- Stimulus: 5-8 notes played in sequence → temporal pattern recognition
- Pool: Potentially huge (major, 3 minors, 7 modes, pentatonics, blues, whole tone, diminished…)
- The distinguishing features between scales can be extremely subtle (Dorian vs Aeolian = one note difference)

**Key insight:** The user needs to hear *enough of the scale* to recognize its character. For intervals, 2 notes suffice. For scales, you need the full ascending run (or at least the characteristic degrees) to form a mental image.

---

## Why "Just Add Modes" Is a Trap

Modes are the obvious first thought, but they're pedagogically dangerous for a multiple-choice quiz:

1. **Too similar to distinguish.** Dorian vs Aeolian differs by one note (♮6 vs ♭6). In a 4-choice format, the user is guessing, not training. Interval training works because P5 vs TT *sound* fundamentally different. Dorian vs Mixolydian? Even trained musicians need context.

2. **Modes need harmonic context.** In real music, you identify modes by how they relate to a chord progression or tonal center — not from an isolated ascending run. Playing C-D-E-F-G-A-B-C and asking "is this Ionian or just major?" is a trick question, not training.

3. **The answer pool is too uniform.** Seven modes, all using the same 7 white keys in different rotations. The 4-choice grid becomes a guessing game because the sounds are too close.

**Bottom line:** Modes are a Phase 2 feature that requires a fundamentally different interaction (playing scales *over a drone/chord*, or "which degree is different?"). For MVP, we should train something that actually works in a 4-choice format.

---

## What Works: Scale Quality Recognition

Focus on scales that sound **categorically different** from each other:

| Scale | Formula (semitones from root) | Character |
|-------|-------------------------------|-----------|
| Major (Ionian) | 0-2-4-5-7-9-11-12 | Bright, happy |
| Natural Minor (Aeolian) | 0-2-3-5-7-8-10-12 | Dark, sad |
| Harmonic Minor | 0-2-3-5-7-8-11-12 | Exotic, Middle Eastern |
| Melodic Minor (ascending) | 0-2-3-5-7-9-11-12 | Jazz, sophisticated |
| Major Pentatonic | 0-2-4-7-9-12 | Open, folk |
| Minor Pentatonic | 0-3-5-7-10-12 | Bluesy, rock |
| Blues | 0-3-5-6-7-10-12 | Blues (duh) |
| Whole Tone | 0-2-4-6-8-10-12 | Dreamy, floating |
| Chromatic | 0-1-2-3-4-5-6-7-8-9-10-11-12 | Tense, atonal |

These scales sound *genuinely distinct* — a user can learn to tell them apart because they have different emotional/tonal fingerprints, not just one shifted note.

---

## Proposed Tier System

### Tier 1 (start): The Big Three
- Major
- Natural Minor
- Major Pentatonic

These are the most common scales in Western music and sound clearly different from each other.

### Tier 2: Extended Palette
- Harmonic Minor
- Minor Pentatonic

Harmonic minor has a very distinctive augmented 2nd (exotic sound). Minor pentatonic is ubiquitous and sounds different from natural minor due to missing degrees.

### Tier 3: Color Scales
- Blues
- Whole Tone
- Melodic Minor (ascending)

Blues is minor pentatonic + blue note. Whole tone is unmistakable. Melodic minor is the subtlest here but differs enough from natural minor.

### Tier 4 (advanced): Modes — but only the distinctive ones
- Dorian (minor with ♮6 — jazzy minor)
- Mixolydian (major with ♭7 — dominant/rock)
- Phrygian (minor with ♭2 — Spanish/dark)

These three modes have the most distinctive characters. We'd play them over a **drone note** to give harmonic context (different from tiers 1-3 which use isolated runs).

**Tier 4 is deliberately deferred for Phase 2.** It requires the drone mechanism and is a different pedagogical challenge.

---

## Interaction Model

### Quiz Flow (same bones as intervals/chords)

1. Press Play → hear the scale ascending from a random root
2. Replay unlimited (no penalty, but tracked for SM-2 quality)
3. Pick from 4 choices
4. Immediate feedback → correct answer highlighted
5. Wrong answer → replay both the heard scale AND the correct scale for comparison (key learning moment)

### Audio: Scale Playback

```
Root note: random from C3–C5
Tempo: ~150ms per note (ascending run takes ~1-1.5s for 7-8 notes)
Tone: uses existing tone engines (epiano/sine/pad)
Direction: ascending only for MVP (descending adds confusion without learning value at this stage)
```

Notes are played sequentially (like an arpeggiated chord but with scale degrees). Each note sustains briefly with slight overlap for smoothness.

### What's Different From Intervals/Chords

| Aspect | Intervals | Chords | Scales |
|--------|-----------|--------|--------|
| Stimulus | 2 notes | 3-4 simultaneous | 5-8 sequential |
| Duration | ~1.2s | ~1.2s | ~1.5-2s |
| What you identify | Distance | Quality | Pattern/flavor |
| Play modes | Asc/Desc/Harmonic | Root/Inv1/Inv2 | Ascending only (MVP) |
| Learning on wrong | Hear correct interval | Hear correct chord | **Hear both scales back-to-back** |

### Wrong Answer UX — The Key Differentiator

When the user gets a scale wrong, the feedback mode should:
1. Show the correct answer (as now)
2. Auto-play: "You heard: [correct scale]. You picked: [wrong scale]."
3. Play the correct scale first, brief pause, then the user's wrong answer
4. This A/B comparison is the most powerful learning tool for scales

This is different from intervals (where you just hear the correct one) because scales need *comparison* to build the mental model.

---

## Data Model

### ScaleDef
```typescript
interface ScaleDef {
  id: string;              // e.g. "major", "nat_minor", "harm_minor"
  name: string;            // e.g. "Major", "Natural Minor"
  intervals: number[];     // semitones from root: [0, 2, 4, 5, 7, 9, 11, 12]
  tier: number;            // 1-4
  category: ScaleCategory;
  noteCount: number;       // 6 for pentatonics, 7 for heptatonic, etc.
}

type ScaleCategory = 'diatonic' | 'pentatonic' | 'symmetric' | 'modal';
```

### ScaleState (same pattern as IntervalState/ChordState)
```typescript
interface ScaleState {
  scale: string;           // scale id
  unlocked: boolean;
  enabled: boolean;
  attempts: number;
  correct: number;
  easeFactor: number;      // SM-2
  nextReview: number;
  streak: number;
  lastSeen: number;
  // No per-mode subdivision for MVP (ascending only)
}
```

### UserState Extension
```typescript
interface UserState {
  intervals: Record<string, IntervalState>;
  chords: Record<string, ChordState>;
  scales: Record<string, ScaleState>;  // NEW
  settings: Settings;
  stats: GlobalStats;
}
```

### Settings Addition
```typescript
interface Settings {
  // ... existing fields ...
  activeContent: 'intervals' | 'chords' | 'scales';  // extended
}
```

### ScaleQuestion
```typescript
interface ScaleQuestion {
  rootNote: number;        // MIDI root
  scale: ScaleDef;
  choices: ScaleDef[];
  replays: number;
}
```

---

## Audio Implementation

New function in `audio.ts`:

```typescript
function playScale(
  rootMidi: number,
  intervals: number[],    // semitones from root
  toneType: ToneType,
  tempo: number = 150     // ms per note
): void
```

Each note plays for `tempo` ms with a slight overlap (~30ms) for legato feel. Total duration = `intervals.length * tempo`.

The existing `playEpianoToneToNode` / `playSineToneToNode` / `playPianoToneToNode` functions work as-is for individual notes. We just schedule them sequentially.

---

## Unlock Condition

Scales unlock after the user has **Bronze mastery on 3+ intervals** (lower bar than chords' 5-interval requirement). Scale recognition is arguably easier to start than chord recognition, so we can introduce it earlier.

Home screen gets a 3-way content switcher: `INTERVALS | CHORDS | SCALES`

---

## Reuse Assessment

| Component | Reusable? | Changes Needed |
|-----------|-----------|----------------|
| `AnswerGrid.svelte` | ✅ Yes | Already generic ({id, name} interface) |
| `PlayButton.svelte` | ✅ Yes | No changes |
| `ProgressBar.svelte` | ✅ Yes | No changes |
| `TelemetryBar.svelte` | ✅ Yes | No changes |
| `Feedback.svelte` | ✅ Yes | No changes |
| `sm2.ts` | ✅ Yes | No changes |
| `engine.ts` | ➕ Add | `generateScaleQuestion()`, `pickScale()`, `generateScaleDistractors()` |
| `audio.ts` | ➕ Add | `playScale()` function |
| `state.ts` | 🔧 Extend | Add `scales` to `UserState`, migration, tier unlock |
| `types.ts` | ➕ Add | `ScaleDef`, `ScaleState`, `ScaleQuestion`, `ScaleCategory` |
| Quiz page | 🆕 New | `/quiz/scales/+page.svelte` (fork of chords quiz, simpler) |
| Home page | 🔧 Extend | Add "SCALES" to content switcher |
| Progress page | 🔧 Extend | Add scales section |
| Settings page | 🔧 Extend | Scale-specific settings (if any) |

**Estimated work: ~70% reuse, ~30% new code.** Most new code is the scale definitions + `playScale()` audio function.

---

## Open Questions for Mike

1. **Starting scope: Tiers 1-3 only (9 scales) or include Tier 4 modes?**
   My recommendation: ship Tiers 1-3, defer modes to a dedicated sprint. Modes need a drone/pedal mechanism that doesn't exist yet.

2. **Scale playback speed?** 150ms/note feels natural but might be too fast for beginners. Should we offer a "slow replay" option (250ms/note)?

3. **Wrong-answer comparison playback** — do we auto-play the A/B comparison, or let the user tap to hear each? Auto-play is more instructive but adds ~3s to the wrong-answer flow.

4. **Unlock threshold** — should scales be gated behind interval mastery (like chords are), or available from the start as a parallel track? I've proposed Bronze mastery on 3 intervals, but Mike might want it available immediately.

5. **Content switcher UX** — with 3 content types (intervals/chords/scales), does the switcher still work as inline buttons, or should we move to a tab bar or cards on the home screen?

---

## What This Design Does NOT Cover (Future)

- **Descending scales** — useful but adds complexity without proportional learning value in MVP
- **Modes with drone** — Phase 2, requires new audio infrastructure
- **Scale degree identification** ("which note is the 3rd?") — different exercise entirely
- **Scale singing/input** — freeform mode equivalent for scales
- **Relative scale comparison** ("is this scale major or minor relative to [chord]?") — contextual training

---

## Summary

Ship a scale quiz that reuses the existing 4-choice infrastructure, with 9 scales across 3 tiers, sequential note playback, and A/B comparison on wrong answers. Defer modes until we have a drone mechanism. The system slots cleanly into the existing architecture as a third content type alongside intervals and chords.
