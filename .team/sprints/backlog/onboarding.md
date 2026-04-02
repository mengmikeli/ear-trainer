# DESIGN-ONBOARDING.md — S4 Learn Layer + Onboarding

**Date:** 2026-03-30  
**Status:** Draft  
**Author:** Pixi  
**Branch:** `feat/onboarding`  
**Sprint:** S4

---

## Problem

The app drops users straight into a quiz with zero context. A first-time user tapping GO hears two notes and sees four cryptic labels like "P5", "m3", "M6", "TT" — they have no idea what any of these mean. The adaptive engine treats `attempts === 0` items as "new" with a 0.5 weight boost, but that just means the user gets thrown at unfamiliar content *faster*. There's no teaching, only testing.

Non-musicians — the audience we need to reach if we're charging for this — will bounce immediately.

## Goal

Every content item (interval, chord, scale, mode) gets a **micro-lesson** on first encounter. The user *learns* the item before they're *tested* on it. After the lesson, the item enters the normal SM-2 quiz loop. The result: "Learn → Quiz → Master" as a natural pipeline.

### Success criteria (binary, testable)
1. First encounter with any `attempts === 0` item shows a learn card, not a quiz question
2. Learn card plays audio, shows the item's name/label, and runs a simple binary comparison quiz
3. After completing a learn card, the item's stats update (`attempts > 0`) and it enters normal SM-2 flow
4. Existing users with progress are unaffected (all their items already have `attempts > 0`)
5. Smart session planner (TRAIN) integrates learn cards as the first phase
6. Dev mode bypasses learn cards (jump straight to quiz)

---

## Design

### The Learn Card

When the adaptive engine (or any content-specific quiz page) encounters an item with `attempts === 0`, it renders a **learn card** instead of a quiz question. The learn card has four steps:

#### Step 1: "Hear It" — Introduction
- Auto-play the item with its label visible
- For intervals: play ascending, show name + shorthand (e.g. "Perfect Fifth — P5")
- For chords: play block voicing, show name (e.g. "Minor Chord — min")
- For scales: play ascending, show name (e.g. "Natural Minor — NatMin")
- For modes: start drone, play mode ascending, show name (e.g. "Dorian — Dor")
- Replay button available (unlimited)
- Big label in the center, Marathon-style industrial typography
- Subtle "NEW" badge in corner

#### Step 2: "Compare" — Neighbor Contrast
- Play the new item, then play a *neighbor* item the user already knows
- Neighbor selection: closest item the user has `attempts > 0` on, preferring same content kind
  - Intervals: compare by semitone distance (e.g. learning P5? compare with P4 if known)
  - Chords: compare by type similarity (e.g. learning min? compare with maj)
  - Scales: compare by shared intervals (e.g. learning nat_min? compare with major)
  - Modes: compare with parent scale or closest mode
- Display: split-screen style — left = new item label, right = known item label
- User taps each side to hear the difference (A/B toggle)
- "Hear both" button plays them back-to-back

#### Step 3: "Quick Quiz" — Binary Check
- Simple 2-choice question: "Which one is [new item]?"
- Play one of the two items (new or neighbor) at random
- Two buttons: [New Item Label] vs [Neighbor Label]
- Correct → green flash, advance
- Wrong → red flash, replay both, retry (max 2 retries, then advance anyway)
- This is intentionally easy — 50/50 chance, just building the initial association

#### Step 4: "Got It" — Confirmation + Transition
- Brief summary: "[Item Name] — unlocked. You'll see this in your quizzes now."
- Auto-advance to next question after 1.5s (or tap to skip)
- The item's `ContentStats.attempts` is now ≥ 1, so it enters normal SM-2 flow

### Learn Card Appearance

Follows Marathon aesthetic but with a distinct visual treatment so the user knows they're in "learn mode":

- Background: slightly different shade (dark blue-grey vs pure charcoal) or a subtle gradient border
- "LEARN" label in top bar where "QUIZ" normally appears
- Progress indicator shows learn step (1/4, 2/4, 3/4, 4/4)
- Same typography, same layout grid — not a separate app, just a different mode of the same interface

---

## Integration with Adaptive Engine

### `attempts === 0` Detection

The adaptive engine's `pickNextItem()` already boosts items with `attempts === 0` via the `newBoost` weight. The change: instead of rendering a normal quiz question for these items, the quiz route checks `stats[item.id].attempts === 0` and renders a learn card.

```typescript
// Pseudocode — quiz route rendering logic

if (currentItem && getStats(currentItem).attempts === 0) {
  // Render <LearnCard item={currentItem} neighbor={findNeighbor(currentItem)} />
} else {
  // Render normal quiz question
}
```

### Neighbor Selection Algorithm

```typescript
interface NeighborCandidate {
  item: ContentItem;
  similarity: number; // 0-1, higher = more similar
}

function findNeighbor(
  newItem: ContentItem,
  allItems: ContentItem[],
  stats: Record<string, ContentStats>,
): ContentItem | null {
  // 1. Filter to same kind (interval vs interval, chord vs chord)
  // 2. Filter to items with attempts > 0 (user knows them)
  // 3. Score by musical similarity:
  //    - Intervals: |semitone_a - semitone_b| inverse
  //    - Chords: count shared intervals
  //    - Scales: count shared scale degrees
  //    - Modes: same parent scale = high similarity
  // 4. Return highest similarity match
  // 5. Fallback: if no same-kind neighbor exists (first item ever),
  //    skip the Compare step entirely (steps 1, 3, 4 only)
}
```

### Smart Session Integration

The session planner in `adaptive.ts` already has warmup/focus/review phases. Learn cards integrate as a natural extension:

```typescript
// Modified planSession logic

function planSession(state: UserState, config: SessionConfig): SessionPlan {
  // ... existing logic ...

  // NEW: Items with attempts === 0 get tagged as 'learn' phase
  // They're placed at the start of the session (before warmup)
  // Max 3 learn cards per session (don't overwhelm)
  const newItems = eligible.filter(item => {
    const s = stats[item.id] ?? defaultContentStats();
    return s.attempts === 0;
  });

  const learnSlots = Math.min(3, newItems.length);
  const learnItems = newItems
    .sort((a, b) => a.tier - b.tier) // introduce lower tiers first
    .slice(0, learnSlots)
    .map(item => ({ item, phase: 'learn' as const }));

  // Remaining session length filled with normal warmup/focus/review
  const remainingLength = config.length - learnSlots;
  // ... existing planning for warmup/focus/review with remainingLength ...

  return {
    questions: [...learnItems, ...warmupItems, ...focusItems, ...reviewItems],
    summary: learnSlots > 0
      ? `${learnSlots} new + ${remainingLength} review`
      : existingSummary,
  };
}
```

### Session Phase Enum Update

```typescript
// Current phases
type SessionPhase = 'warmup' | 'focus' | 'review';

// Updated
type SessionPhase = 'learn' | 'warmup' | 'focus' | 'review';
```

### Stats Update After Learn Card

After completing a learn card's binary quiz (step 3):
- Record as 1 attempt (correct or not based on final answer)
- Set `easeFactor` to 2.5 (default — no SM-2 adjustment on first encounter)
- Set `nextReview` to now + 5 minutes (review soon while fresh)
- The item will likely appear again in the same session during the review phase

---

## Connection Toasts in Learn Context

DESIGN-ADAPTIVE.md deferred connection toasts from the v3.5 UI. In the learn layer, we resurface them naturally:

**During Step 2 (Compare)**, if the new item has a connection to the neighbor:
- Show a one-liner below the A/B toggle: *"Minor 3rd defines the minor chord"*
- Same terse/industrial tone as the rest of the UI
- Only shown when the connection is meaningful (from `connections.ts` map)
- Not a toast — it's part of the learn card layout, always visible during Compare

This is different from the popup-toast pattern that was cut. It's contextual text within the lesson, not an interruption.

---

## Content-Specific Learn Behaviors

### Intervals
- **Hear It:** Play the interval ascending from a random root in C3-C5 range
- **Compare:** Play neighbor interval from same root (so the user hears the difference in distance, not pitch)
- **Quick Quiz:** "Which one is the Perfect Fifth?" — play one, pick from 2

### Chords
- **Hear It:** Play block chord (root position), then arpeggiated
- **Compare:** Play neighbor chord from same root (e.g. major vs minor — hear the 3rd change)
- **Quick Quiz:** "Which one is the Minor chord?" — play one, pick from 2

### Scales
- **Hear It:** Play ascending scale from C4
- **Compare:** Play neighbor scale from same root
- **Quick Quiz:** "Which one is Natural Minor?" — play one, pick from 2

### Modes
- **Hear It:** Start drone on root, play mode ascending
- **Compare:** Play neighbor mode over same drone (e.g. Dorian vs Aeolian — hear the 6th change)
- **Quick Quiz:** "Which one is Dorian?" — play one over drone, pick from 2
- Drone runs continuously through all 4 steps, fades out at Step 4

---

## First-Time User Flow (Cold Start)

For a brand-new user with zero progress:

1. User opens app, sees home screen with TRAIN button
2. Taps TRAIN → smart session starts
3. First 3 items are all `attempts === 0` → 3 learn cards in a row
4. **Problem:** no neighbors exist for Compare step (nothing has `attempts > 0`)
5. **Solution:** for the very first item (Unison/P1), skip Compare and Quick Quiz entirely — just play it, label it, and mark it learned. Then the second item (P5) can compare against P1. Third item (P8) compares against P5.

Alternatively: the very first session could be a hard-coded "intro session" that teaches Tier 1 intervals in a fixed sequence:
1. Learn P1 (unison) — no comparison
2. Learn P8 (octave) — compare with P1 ("same note vs same note one octave up")
3. Learn P5 (fifth) — compare with P8 ("not quite an octave — that's a fifth")
4. Quiz: 5 questions mixing P1, P5, P8 — normal quiz flow

**Recommendation:** go with the hard-coded intro for the first 3 items, then let the adaptive engine take over. Keeps the cold start smooth without over-engineering the neighbor-finding fallback.

---

## New Components

### `LearnCard.svelte`
- Props: `item: ContentItem`, `neighbor: ContentItem | null`, `onComplete: (correct: boolean) => void`
- Internal state machine: step 1 → 2 → 3 → 4
- Handles audio playback for both item and neighbor
- Handles A/B toggle and binary quiz
- Emits completion event with correct/incorrect result

### Modifications to Existing Components

- **`quiz/adaptive/+page.svelte`** — Check `attempts === 0` before rendering question, use `<LearnCard>` when true
- **`quiz/+page.svelte`** (intervals) — Same check for interval-only sessions
- **`quiz/chords/+page.svelte`** — Same check for chord-only sessions
- **`quiz/scales/+page.svelte`** — Same check for scale-only sessions
- **`quiz/modes/+page.svelte`** — Same check for mode-only sessions
- **`adaptive.ts`** — Add `'learn'` phase to session planner, cap at 3 per session
- **`types.ts`** — Add `SessionPhase = 'learn' | 'warmup' | 'focus' | 'review'`

---

## Data Model Changes

No new persistent state required. The learn layer reads `attempts === 0` from existing `ContentStats` and writes the first attempt result through the existing SM-2 update path.

One optional addition for tracking:

```typescript
// In AdaptiveState (optional — for analytics/debrief)
interface AdaptiveState {
  // ... existing fields ...
  learnHistory?: string[];  // ContentItem ids that have been through learn cards
}
```

This lets the debrief screen show "3 new items learned this session" without re-scanning.

---

## Dev Mode

When `settings.devMode === true`:
- Learn cards are skipped entirely (all items treated as `attempts > 0`)
- Existing dev mode bypass continues to work
- Manual trigger in settings: "Reset item to new" button that sets a specific item's `attempts = 0` for testing learn cards

---

## Testing Plan

### Unit Tests
- `findNeighbor()` — returns closest same-kind item with attempts > 0
- `findNeighbor()` — returns null when no neighbors exist
- `planSession()` — places learn items before warmup phase
- `planSession()` — caps learn items at 3 per session
- `planSession()` — learn items sorted by tier (lowest first)
- Stats update after learn card — `attempts === 1`, `nextReview` set to near-future
- Dev mode bypass — learn card skipped when devMode is true

### Integration Tests (Palm QA)
- Cold start: first session shows learn cards for Tier 1 intervals
- Warm start: existing user sees learn cards only for newly unlocked items
- A/B toggle plays correct audio for each item
- Binary quiz accepts answer correctly
- After learn card, item appears in normal quiz flow
- Connection text shows during Compare step when relevant
- Mobile layout: learn card steps don't overflow, buttons are tappable

---

## Implementation Plan

### Phase 1: LearnCard Component (day 1)
- [ ] `LearnCard.svelte` — 4-step state machine, audio integration, A/B toggle
- [ ] `findNeighbor()` utility in `adaptive.ts`
- [ ] Unit tests for neighbor selection
- [ ] Wire into `quiz/adaptive/+page.svelte` with `attempts === 0` check

### Phase 2: Session Planner Integration (day 2)
- [ ] Add `'learn'` phase to `planSession()`
- [ ] Cap at 3 learn items per session
- [ ] Cold start intro sequence for first 3 Tier 1 intervals
- [ ] Debrief screen: "N new items learned" row
- [ ] Unit tests for planner changes

### Phase 3: All Quiz Routes + Polish (day 3)
- [ ] Wire learn card into interval, chord, scale, mode quiz pages
- [ ] Connection text during Compare step
- [ ] Dev mode bypass + "Reset to new" debug button
- [ ] Visual polish: LEARN label, step indicator, distinct background treatment
- [ ] Mobile responsive check

### Phase 4: QA (day 4)
- [ ] Self-QA: build check, visual check, cold start walkthrough
- [ ] Tag <@1485281883440021605> for QA
- [ ] Tag <@1483049786612519074> for gate review

---

## Non-Goals
- No video or animated tutorials (text + audio only)
- No "course" structure (individual item lessons, not sequenced curriculum)
- No theory explanations beyond connection one-liners (the app teaches by *hearing*, not reading)
- No onboarding wizard or welcome screens (the learn card IS the onboarding)

---

## Open Questions for Mike

1. **Hard-coded intro session vs. dynamic fallback?** I recommend the hard-coded intro for the first 3 items (P1 → P8 → P5). Simpler, more controlled experience. The adaptive engine takes over from item 4 onwards.
2. **Learn card in focused sessions?** If a user manually picks "Intervals" and hits GO, should they see learn cards for new intervals? I lean yes — same logic regardless of session type.
3. **Max learn cards per session — 3 enough?** For a 20-question session, 3 learn cards + 17 quiz questions feels right. For a 10-question session, maybe cap at 2?
4. **Connection text tone check:** *"Minor 3rd defines the minor chord"* — is that the right level of terse? Or more like *"m3 → min chord foundation"*?
