# S5 Release Polish — Implementation Plan

**Goal:** Make the free experience polished enough to charge for.
**Execution model:** Hybrid — subagent swarm for sequential work, Noki for desktop creative work.
**Branch:** `feat/s5-release-polish` (main track), `feat/s5-desktop` (Noki)

---

## Phase 0: Branch Setup + Baseline

### Task 0.1: Create branches + verify baseline
- [ ] Create `feat/s5-release-polish` from main
- [ ] Run `npx vitest run` — record test count
- [ ] Run `npm run build` — verify clean
- [ ] Commit

---

## Phase 1: Content Hierarchy Redesign (subagent swarm)

Foundation for everything else — tiers must be right before gating or fairness.

### Task 1.1: Update interval definitions

**Files:**
- Modify: `src/lib/definitions/intervals.ts`

- [ ] Reassign tiers:
  - Tier 1: P1, P5, P8 (unchanged)
  - Tier 2: M3, m3, P4 (M3 moved from tier 2, m3 from tier 3)
  - Tier 3: M2, M6, m7, M7 (M2 from tier 4, M6 from tier 3, M7 from tier 5)
  - Tier 4: m2, m6, TT (m2 from tier 5, m6 from tier 4, TT from tier 5)
- [ ] Run tests — some tier-specific tests may need updating
- [ ] Commit

### Task 1.2: Add new chord definitions

**Files:**
- Modify: `src/lib/definitions/chords.ts`

- [ ] Add Sus2: `{ id: 'sus2', name: 'Suspended 2nd', intervals: [0, 2, 7], tier: 4, category: 'triad' }`
- [ ] Add Sus4: `{ id: 'sus4', name: 'Suspended 4th', intervals: [0, 5, 7], tier: 4, category: 'triad' }`
- [ ] Add Power: `{ id: 'pow', name: 'Power Chord', intervals: [0, 7], tier: 4, category: 'triad' }`
- [ ] Verify existing chord tier assignments match CONTENT-HIERARCHY.md
- [ ] Run tests, commit

### Task 1.3: Update scale definitions

**Files:**
- Modify: `src/lib/definitions/scales.ts`

- [ ] Add Dorian scale: `{ id: 'dorian_scale', intervals: [0,2,3,5,7,9,10,12], tier: 4 }`
- [ ] Add Mixolydian scale: `{ id: 'mixolydian_scale', intervals: [0,2,4,5,7,9,10,12], tier: 4 }`
- [ ] Reorganize tiers to match CONTENT-HIERARCHY.md (4 tiers instead of 3)
- [ ] Run tests, commit

### Task 1.4: Restructure mode tiers

**Files:**
- Modify: `src/lib/definitions/modes.ts`

- [ ] Tier 1: Ionian, Aeolian
- [ ] Tier 2: Dorian, Mixolydian
- [ ] Tier 3: Phrygian, Lydian, Locrian
- [ ] Run tests, commit

### Task 1.5: Update progression logic for new tiers

**Files:**
- Modify: `src/lib/state/progression.ts`
- Modify: `src/lib/state/defaults.ts`

- [ ] Update interval tier thresholds (4 tiers instead of 5)
- [ ] Update chord tier thresholds (new items in tier 4)
- [ ] Update scale tier thresholds (4 tiers instead of 3)
- [ ] Update mode tier thresholds (3 tiers instead of 1)
- [ ] Update cross-content dependencies (interval tier 2 mastery → chords unlock, scale mastery → modes)
- [ ] Update `createDefaultStateV4` for new items (sus2, sus4, power, dorian_scale, mixolydian_scale)
- [ ] Write v4→v4.1 migration for new items (add default states for new content)
- [ ] Run all tests, commit

### Task 1.6: Update chord audio (new items need sound)

**Files:**
- Modify: `src/lib/audio/playback.ts` (if chord playback needs changes)
- Modify: `src/lib/quiz/configs/chords.ts`

- [ ] Verify Sus2, Sus4, Power chord play correctly through existing `playChord()` — they should, since playback is interval-based
- [ ] Power chord has only 2 notes — verify AnswerGrid and quiz still work with 2-note chords
- [ ] Manual audio test, commit

---

## Phase 2: Pro/Free Feature Gating (subagent swarm)

### Task 2.1: Define gate registry

**Files:**
- Modify: `src/lib/features/gate.ts`
- Modify: `src/lib/state/schema.ts`

- [ ] Populate FLAGS with tier-based gates:
  - Intervals tier 3, 4 → Pro
  - Chords tier 2, 3, 4 → Pro
  - Scales tier 2, 3, 4 → Pro
  - Modes all tiers → Pro
- [ ] Add `proUnlocked: boolean` to UserStateV4 settings (default false)
- [ ] Add `getUserTier()` helper
- [ ] Run tests, commit

### Task 2.2: Wire gates into progression + quiz

**Files:**
- Modify: `src/lib/state/progression.ts`
- Modify: `src/lib/quiz/configs/adaptive.ts`

- [ ] Tier unlock respects Pro gate
- [ ] Adaptive quiz respects Pro gate
- [ ] Free users: tier 1-2 intervals + tier 1 chords/scales, no modes
- [ ] Run tests, commit

### Task 2.3: Wire LockedCard into UI

**Files:**
- Modify: `src/components/LockedCard.svelte`
- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/progress/+page.svelte`

- [ ] LockedCard: "PRO — $4.99" + "Unlock" button (mock purchase)
- [ ] Home: lock icon on gated content in switcher
- [ ] Progress: LockedCard on gated tiers
- [ ] Build, commit

---

## Phase 3: Unlock Fairness (subagent swarm)

### Task 3.1: Per-item unlock criteria

**Files:**
- Modify: `src/lib/state/progression.ts`
- Create: `tests/state/unlock-fairness.test.ts`

- [ ] Write failing tests:
  - Each item in current tier needs ≥5 attempts
  - At least 70% of items in tier at ≥70% accuracy individually
  - Cross-content: chords don't unlock until interval tier 2 mastered
- [ ] Implement new logic
- [ ] Preserve backward compat (already-unlocked stays unlocked)
- [ ] Run tests, commit

### Task 3.2: Unlock progress indicators

**Files:**
- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/progress/+page.svelte`

- [ ] Home: "3/6 intervals mastered — 3 more to unlock Chords"
- [ ] Progress: per-item mastery indicator
- [ ] Show which items block next tier
- [ ] Build, commit

---

## Phase 4: FRE / Onboarding (subagent swarm)

### Task 4.1: FRE state + routing

**Files:**
- Modify: `src/lib/state/schema.ts`
- Modify: `src/lib/state/migration.ts`
- Create: `src/routes/welcome/+page.svelte`
- Modify: `src/routes/+page.svelte`

- [ ] Add `hasCompletedFRE: boolean` to state (default false)
- [ ] Existing users: migrate with `hasCompletedFRE: true`
- [ ] Home redirects to `/welcome` if not completed
- [ ] Run tests, commit

### Task 4.2: Welcome screen + guided quiz

**Files:**
- Modify: `src/routes/welcome/+page.svelte`

- [ ] Welcome screen with "Let's try one" button
- [ ] Guided question 1: P8, hinted correct answer
- [ ] Guided question 2: P5, no hints, adaptive message
- [ ] Use QuizSession with FRE config (2 scripted questions, no stats)
- [ ] Build, commit

### Task 4.3: Progress teaser + handoff

**Files:**
- Modify: `src/routes/welcome/+page.svelte`

- [ ] Show progress with guided session data
- [ ] "Ready?" → set hasCompletedFRE = true → home
- [ ] Build, commit

---

## Phase 5: Pedagogy Microcopy (subagent swarm)

### Task 5.1: Unlock explanations + listening tips

**Files:**
- Create: `src/lib/definitions/tips.ts`
- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/progress/+page.svelte`

- [ ] Define listening tips per content item (P5: "Star Wars", M3: "happy birthday", etc.)
- [ ] Home: unlock hints below switcher
- [ ] Progress: tips shown on newly unlocked items
- [ ] Build, commit

### Task 5.2: Label clarity

**Files:**
- Modify: `src/components/TelemetryBar.svelte`

- [ ] First encounter: full label, subsequent: abbreviation
- [ ] Or: tooltip on tap
- [ ] Build, commit

---

## Phase 6: Desktop Layout (Noki — parallel)

Runs in parallel with Phases 1-5 on `feat/s5-desktop`.

### Task 6.1: Sidebar navigation
- [ ] Desktop ≥768px: left sidebar replaces bottom nav
- [ ] Mobile: bottom nav unchanged
- [ ] Build, commit

### Task 6.2: Two-column quiz
- [ ] Desktop: viz/play left, answers right
- [ ] Debrief: two-column layout
- [ ] Mobile: unchanged
- [ ] Build, commit

### Task 6.3: Desktop home + progress polish
- [ ] Use wider layout effectively
- [ ] Build, commit

---

## Phase 7: Integration + QA

### Task 7.1: Merge desktop branch
- [ ] PR for `feat/s5-desktop`, Palm QA, resolve conflicts, merge

### Task 7.2: Full test suite + build
- [ ] All tests pass, build clean

### Task 7.3: Palm QA
- [ ] Chrome desktop + responsive: full regression
- [ ] FRE, pro gate, desktop layout, content hierarchy

### Task 7.4: Mike QA (iOS)
- [ ] FRE on fresh install, audio, pro gate, unlock feel
- [ ] "Would you pay for this?"

### Task 7.5: Ship
- [ ] Merge to main, staging → production, version bump, release tag, retro

---

## Summary

| Phase | Tasks | Model | Est. Time |
|-------|-------|-------|-----------|
| 0 — Setup | 0.1 | Setup | 10 min |
| 1 — Content Hierarchy | 1.1–1.6 | Subagent | 2-3 hours |
| 2 — Feature Gating | 2.1–2.3 | Subagent | 1-2 hours |
| 3 — Unlock Fairness | 3.1–3.2 | Subagent | 1-2 hours |
| 4 — FRE | 4.1–4.3 | Subagent | 2-3 hours |
| 5 — Microcopy | 5.1–5.2 | Subagent | 1 hour |
| 6 — Desktop | 6.1–6.3 | Noki (parallel) | 1-2 days |
| 7 — Integration + QA | 7.1–7.5 | Coordinator | 1 day |
| **Total** | **24 tasks** | **Hybrid** | **~3-5 days** |
