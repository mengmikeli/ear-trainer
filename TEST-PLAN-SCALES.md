# TEST-PLAN-SCALES.md — QA Plan for Scale System (v3.4)

**Date:** 2026-03-24
**Author:** Palm 🌴
**Design doc:** `DESIGN-SCALES.md` (Approved)
**Status:** Ready — waiting for build

---

## Scope

Covers all testable surface area introduced by the scales feature:
- Scale definitions (`scales.ts`)
- State management (default state, tier unlock, migration)
- Question engine (pick, distractors, question generation)
- Audio (`playScale()`)
- A/B comparison on wrong answers
- Quiz page UX (`/quiz/scales/+page.svelte`)
- Home page content switcher update
- Progress page scales section
- Cross-content isolation
- Unlock gate (Bronze on 3 intervals)

---

## 1. Unit Tests — Scale Definitions (`scales.test.ts`)

Mirrors `chords.test.ts` pattern.

| # | Test | What it verifies |
|---|------|-----------------|
| 1.1 | `SCALES` has exactly 9 definitions | Tiers 1-3, no modes |
| 1.2 | All scales have required fields (`id`, `name`, `intervals`, `tier`, `category`, `noteCount`) | Type completeness |
| 1.3 | All `intervals` arrays start with 0 (root) and end with 12 (octave) | Musical correctness |
| 1.4 | `noteCount` matches `intervals.length` | Consistency |
| 1.5 | Tier 1: Major, Natural Minor, Major Pentatonic | Correct grouping |
| 1.6 | Tier 2: Harmonic Minor, Minor Pentatonic | Correct grouping |
| 1.7 | Tier 3: Blues, Whole Tone, Melodic Minor | Correct grouping |
| 1.8 | No duplicate `id` values | Uniqueness |
| 1.9 | `getScalesByTier(n)` returns correct scales | Utility function |
| 1.10 | `getScaleById(id)` finds existing, returns undefined for unknown | Utility function |
| 1.11 | `getUnlockedScales(states)` filters correctly | State-aware helper |
| 1.12 | `getEnabledScales(states)` filters out disabled | State-aware helper |
| 1.13 | Pentatonics have 6 notes, heptatonics have 8, blues has 7, whole tone has 7 | Note count validation |
| 1.14 | Intervals are strictly ascending within each scale | Semitone ordering |
| 1.15 | Category values are valid (`'diatonic' \| 'pentatonic' \| 'symmetric'`) | Enum validity |

---

## 2. Unit Tests — State Management (`state.test.ts` additions)

### 2.1 Default State

| # | Test | What it verifies |
|---|------|-----------------|
| 2.1.1 | `createDefaultState()` has all 9 scales in `state.scales` | Scale state initialization |
| 2.1.2 | Tier 1 scales (major, nat_minor, maj_pent) are unlocked | Default unlock |
| 2.1.3 | Tier 2-3 scales are locked | Default lock |
| 2.1.4 | All scales have zeroed stats (`attempts: 0`, `correct: 0`, `easeFactor: 2.5`, etc.) | Clean init |
| 2.1.5 | `settings.activeContent` now accepts `'scales'` (type extends to 3 values) | Settings extension |

### 2.2 Migration (v3.3 → v3.4)

| # | Test | What it verifies |
|---|------|-----------------|
| 2.2.1 | Old state without `scales` field gets `scales` added on load | Migration adds scales |
| 2.2.2 | Existing interval data preserved during migration | No data loss |
| 2.2.3 | Existing chord data preserved during migration | No data loss |
| 2.2.4 | `settings.activeContent` stays at old value if present | No forced change |
| 2.2.5 | Round-trip: save → load preserves scale state | Serialization |

### 2.3 Tier Unlock — Scales

| # | Test | What it verifies |
|---|------|-----------------|
| 2.3.1 | Tier 2 unlocks after 10+ scale questions with ≥70% accuracy | Standard gate |
| 2.3.2 | Tier 2 stays locked with <10 questions | Insufficient data |
| 2.3.3 | Tier 2 stays locked with <70% accuracy | Insufficient mastery |
| 2.3.4 | Tier 3 unlocks after 30+ questions with ≥70% (cascading through tier 2) | Progressive unlock |
| 2.3.5 | Scale tier unlock is independent of interval/chord tiers | Cross-content isolation |

### 2.4 Content Unlock Gate

| # | Test | What it verifies |
|---|------|-----------------|
| 2.4.1 | Scales content is locked when <3 intervals have Bronze mastery | Gate enforced |
| 2.4.2 | Scales content unlocks when ≥3 intervals reach Bronze | Gate passes |
| 2.4.3 | "Bronze" = the mastery threshold already used for chord unlock gate | Consistent definition |

---

## 3. Unit Tests — Engine (`engine.test.ts` additions)

| # | Test | What it verifies |
|---|------|-----------------|
| 3.1 | `pickScale(state)` only picks from unlocked+enabled scales | Respects state |
| 3.2 | `pickScale` prefers weaker scales (lower accuracy) | SM-2 weighting |
| 3.3 | `generateScaleDistractors(correctId, state)` returns exactly 3 | Distractor count |
| 3.4 | Distractors don't include the correct answer | Exclusion |
| 3.5 | Distractors prefer unlocked scales, fill from locked if needed | Same pattern as intervals |
| 3.6 | `generateScaleQuestion(state)` returns valid question structure | Integration |
| 3.7 | Question `rootNote` is within expected MIDI range (C3–C5 per design) | Root range |
| 3.8 | Question `choices` has exactly 4 items including the correct scale | Choice count |
| 3.9 | Choices are shuffled (not always correct-first) — statistical test | Randomness |

---

## 4. Unit Tests — Audio (`audio.test.ts` additions)

Using mocked Web Audio API (same pattern as chord audio tests).

| # | Test | What it verifies |
|---|------|-----------------|
| 4.1 | `playScale(root, intervals, tone, 150)` does not throw | Basic invocation |
| 4.2 | Works with all tone types (sine, epiano, piano) | Tone type coverage |
| 4.3 | 5-note scale (pentatonic) creates ≥5 oscillators | Note count |
| 4.4 | 8-note scale (heptatonic + octave) creates ≥8 oscillators | Note count |
| 4.5 | 7-note scale (blues/whole tone) creates ≥7 oscillators | Note count |
| 4.6 | Slow replay (250ms) does not throw | Tempo param |
| 4.7 | `playScale` with default tempo (150ms) and explicit tempo (150) behave the same | Default param |

---

## 5. Unit Tests — A/B Comparison

| # | Test | What it verifies |
|---|------|-----------------|
| 5.1 | Comparison function plays correct scale first, then wrong scale | Order |
| 5.2 | Total duration accounts for both scales + pause between | Timing |
| 5.3 | Does not throw when correct and wrong are the same scale def (edge case) | Robustness |

---

## 6. Integration / Component Tests — Quiz Page

These depend on the component testing approach (Vitest + testing-library or Playwright component tests). If the project doesn't have component tests yet, these become manual/E2E.

| # | Test | What it verifies |
|---|------|-----------------|
| 6.1 | Quiz page renders 4 answer choices | Grid renders |
| 6.2 | Clicking Play triggers `playScale()` | Audio wired |
| 6.3 | Selecting correct answer → green highlight + next question | Correct flow |
| 6.4 | Selecting wrong answer → red highlight + auto-play A/B comparison | Wrong flow |
| 6.5 | After wrong answer, "Replay Comparison" button is available | Replay access |
| 6.6 | Slow replay button plays at 250ms/note | Slow mode |
| 6.7 | Progress bar advances after each answer | Progress tracking |
| 6.8 | Session completes after `sessionLength` questions | Session end |
| 6.9 | SM-2 state updates saved after each answer | Persistence |

---

## 7. Manual / Visual QA

| # | Test | What it verifies |
|---|------|-----------------|
| 7.1 | Each of the 9 scales plays the correct notes (listen + verify against piano) | Audio accuracy — **most critical** |
| 7.2 | Scale playback sounds legato (slight overlap, not staccato gaps) | Audio quality |
| 7.3 | A/B comparison has clear pause between the two scales | UX clarity |
| 7.4 | Content switcher shows INTERVALS \| CHORDS \| SCALES | UI update |
| 7.5 | SCALES option is disabled/hidden when gate not met | Gate UX |
| 7.6 | Progress page shows scale stats section | Progress display |
| 7.7 | Marathon theme consistency — scale UI matches existing interval/chord aesthetic | Visual consistency |
| 7.8 | Mobile layout — answer grid doesn't overflow on small screens with longer scale names | Responsive |

---

## 8. Cross-Content Isolation

| # | Test | What it verifies |
|---|------|-----------------|
| 8.1 | Answering scale questions does not change interval stats | No bleed |
| 8.2 | Answering scale questions does not change chord stats | No bleed |
| 8.3 | Scale tier unlock doesn't affect interval/chord tiers | Independent tiers |
| 8.4 | Switching `activeContent` between all 3 types preserves each type's state | State preservation |
| 8.5 | Session stats (`totalQuestions`, `totalSessions`) count across all content types | Global stats work |

---

## 9. Edge Cases

| # | Test | What it verifies |
|---|------|-----------------|
| 9.1 | Only 3 scales unlocked → distractors fill from locked pool | Early state |
| 9.2 | All 9 scales unlocked → distractors always from unlocked pool | Late state |
| 9.3 | User disables all but 1 scale → quiz still generates (uses locked as distractors) | Degenerate config |
| 9.4 | Fresh install → scales locked behind interval gate → no crash on home page | New user flow |
| 9.5 | `playScale` with root at boundary MIDI values (C3=48, C5=72) | Boundary audio |

---

## Test File Plan

New test files:
- `tests/scales.test.ts` — scale definitions (section 1)
- `tests/scales-engine.test.ts` — or add to `engine.test.ts` (section 3)

Additions to existing files:
- `tests/state.test.ts` — sections 2.1–2.4
- `tests/audio.test.ts` — section 4
- `tests/chord-system.test.ts` pattern → `tests/scale-system.test.ts` — section 2.3, 2.4, 8

---

## Priority Order

If we need to ship fast, this is the test order by impact:

1. **Scale definitions correctness** (1.1–1.15) — wrong intervals = wrong sounds = useless app
2. **State migration** (2.2.1–2.2.5) — data loss on upgrade is a showstopper
3. **Cross-content isolation** (8.1–8.5) — regression risk for existing features
4. **Engine logic** (3.1–3.9) — wrong question generation = bad UX
5. **Audio invocation** (4.1–4.7) — crashes on play = broken app
6. **Tier unlock** (2.3.1–2.3.5) — progression system integrity
7. **A/B comparison** (5.1–5.3) — key learning feature
8. **Quiz page UX** (6.1–6.9) — integration layer
9. **Manual audio verification** (7.1–7.3) — can't automate, but critical
10. **Edge cases** (9.1–9.5) — robustness

---

## Notes

- No Tier 4 / modes coverage needed — explicitly deferred.
- Descending scales explicitly excluded per design (ascending only for MVP).
- SM-2 algorithm itself already has full test coverage (`sm2.test.ts`); we only test that scale answers flow through it correctly.
- The A/B comparison is the biggest new UX pattern — it deserves focused manual testing beyond unit tests.
