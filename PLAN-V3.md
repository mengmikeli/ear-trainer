# Ear Trainer v3 — Learning Focus

## Scope

Phase 1 only (chords/scales deferred to v4). Three pillars:

1. **Three play modes** — ascending, descending, harmonic (simultaneous)
2. **Mastery system** — separate from unlock, tracks real proficiency
3. **Home page redesign** — shows learning dimensions, not just "PRACTICE"

---

## 1. Three Play Modes

### Current
- `direction` is a global setting (ascending / descending / random)
- No harmonic (simultaneous) mode

### v3
- Each interval tracks stats **per mode**: ascending, descending, harmonic
- Quiz randomly mixes modes within a session (weighted by weakness)
- Settings: toggle each mode on/off (all three default ON)
- Audio: harmonic mode plays both notes at once (simple — same oscillators, same `startTime`)

### Data model changes

```typescript
// IntervalState gains per-mode stats
interface ModeStats {
  attempts: number;
  correct: number;
  streak: number;
  lastSeen: number;
  easeFactor: number;
  nextReview: number;
}

interface IntervalState {
  // ... existing fields become the "aggregate" view
  unlocked: boolean;
  enabled: boolean;
  // Per-mode tracking
  modes: {
    ascending: ModeStats;
    descending: ModeStats;
    harmonic: ModeStats;
  };
}
```

Existing `attempts/correct/streak/etc` computed as sum across modes (backward-compatible for unlock logic).

### Migration
- On load, if `state.intervals.P5.modes` is undefined → create `modes` from existing flat stats (assigned to ascending, others zeroed)

### Audio changes
- `playInterval()` gains `direction: 'ascending' | 'descending' | 'harmonic'`
- Harmonic: both notes start at same time, both play for `noteDuration`
- Already have ascending/descending logic

### Question model
- `Question.direction` adds `'harmonic'`
- Engine picks mode based on enabled modes + weakness weighting
- Display: show mode icon on PlayButton during quiz (▲ / ▼ / ═)

---

## 2. Mastery System

### Philosophy
- **Unlock** stays easy (cumulative questions + 70%) — keeps engagement
- **Mastery** is hard — tracks real proficiency, doesn't gate progression
- Visual reward: mastery badge on IntervalCard + home page stats

### Mastery criteria (per interval, per mode)
- 85%+ accuracy over last 20 attempts in that mode
- Streak of 5+ correct in that mode at some point
- At least 20 attempts total in that mode

### Mastery levels
- **None**: < 20 attempts or < 85% accuracy
- **Bronze ●**: 85%+ accuracy, 20+ attempts (one mode)
- **Silver ●●**: Bronze in 2 of 3 modes
- **Gold ●●●**: Bronze in all 3 modes

### Data model
- Mastery is computed (derived), not stored — calculated from `modes` stats
- No new fields needed beyond the per-mode stats

### Display
- IntervalCard: mastery dots (●/●●/●●●) next to interval ID, colored bronze/silver/gold
- Home page: "12/39 mastered" (13 intervals × 3 modes = 39 total masterable skills)
- Progress page: filter by mode, see per-mode accuracy

---

## 3. Home Page Redesign

### Current
- Title block + PRACTICE button + basic stats (streak, accuracy, tier)

### v3
- Title block (keep)
- **Skill rings**: visual summary of mastery across the three modes
  - Three horizontal bars or ring segments: Ascending / Descending / Harmonic
  - Each shows fill % based on mastery progress (0-13 per mode)
- **Quick stats**: sessions, streak, overall accuracy, mastery count
- **PRACTICE button** (keep, still the primary CTA)
- **Mode toggles**: quick on/off for each mode right on home page (saves going to settings)

---

## 4. Settings Changes

- Remove old `direction` dropdown (ascending/descending/random)
- Add three mode toggles: Ascending ▲ / Descending ▼ / Harmonic ═
  - At least one must be enabled
- Keep: tone type, session length, theme

---

## Tasks

### T1: Data model + migration (types.ts, state.ts)
- Add `ModeStats` interface, update `IntervalState`
- Migration: detect old format → create `modes` from flat stats
- Update `checkTierUnlock` to use aggregate stats
- Update tests

### T2: Audio — harmonic mode (audio.ts)
- Add harmonic playback to `playInterval()`
- Both notes at same time, same duration

### T3: Engine — mode-aware questions (engine.ts)
- `pickInterval()` also picks a mode (weighted by per-mode weakness)
- `Question` type includes mode
- Distractors unchanged (intervals, not modes)

### T4: Quiz page — mode display + per-mode stat recording
- Show mode indicator on PlayButton (▲/▼/═)
- Record stats to correct `modes[mode]` bucket
- Auto-play works with all three modes

### T5: Mastery computation + IntervalCard display
- Derived mastery level function
- Mastery dots on IntervalCard
- Per-mode accuracy in stats line

### T6: Home page redesign
- Skill ring bars for 3 modes
- Mastery count stat
- Mode quick-toggles

### T7: Settings — replace direction with mode toggles
- Three toggle buttons (▲/▼/═)
- Min-1-enabled validation
- Migration: map old `direction` setting to new mode toggles

### Execution order
T1 → T2 → T3 → T4 → T5 → T6 → T7

T1-T2 are independent (data + audio).
T3 depends on T1.
T4 depends on T2 + T3.
T5-T7 are UI, depend on T1.
