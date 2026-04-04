# Architecture Review — V4.2

**Date:** 2026-04-04
**Scope:** Data model, front-end components, pedagogical consistency
**Status:** DONE

---

## 1. Executive Summary

The Ear Trainer v4 architecture is in **solid shape**. The v3→v4 migration was well-executed: the unified `UserStateV4` schema is clean, the quiz controller/config pattern is well-designed, and the content hierarchy is pedagogically sound. The codebase reads like it was designed by someone who cares — there's intentionality in the abstractions.

That said, there are structural issues worth addressing before the next phase of growth. The top concerns:

### Top 5 Issues

1. **Duplicated unlock logic across 3+ locations** — The "bronze mastery → chord/scale unlock" check is copy-pasted in `+page.svelte` (home), `progress/+page.svelte`, and `adaptive.ts`. Any change must be synchronized manually. This is the single biggest maintenance risk.

2. **Compat layer entanglement** — `buildIntervalState()` / `buildChordState()` / `isModeMastered()` are used for both progress display AND content unlock gating (home page, adaptive quiz). The compat layer was supposed to be a bridge for old components, but it's now load-bearing for core business logic.

3. **State loaded at page-level, not shared** — Every page calls `loadStateV4()` independently. Quiz pages create config objects at module scope (outside `onMount`), meaning state is captured at import time. If the user changes settings on the settings page and navigates to quiz, they get stale state until full page reload.

4. **Feature gate registry is incomplete** — The gate registry doesn't have entries for `content:chords` or `content:scales` as top-level categories, only tier-level entries. Chord/scale system unlock relies on the bronze mastery check (compat layer), not the feature gate system. Two parallel gating systems.

5. **CONTENT-HIERARCHY.md tier 4 chords don't match gate.ts** — The content hierarchy doc lists Dim7, Half-dim7, Aug7 as tier 4, but the gate registry only has entries up to `content:chords:tier4`. The actual tier assignments in definitions match the doc, but the fact that all tier 4 items (Dim7, hDim7, Aug7, Sus2, Sus4, Power) are a single Pro gate means the pedagogical intent (extended 7ths vs suspended/power) is flattened.

---

## 2. Data Model

### 2.1 Schema (UserStateV4)

**Verdict: Clean and well-designed.**

The schema is excellent. Key strengths:
- Clean separation: `stats` (flat composite-keyed), `definitions` (unlock/enable per kind), `settings`, `globalStats`, `sessionHistory`
- Composite stat keys (`interval:P5:ascending`, `chord:maj:root`, `scale:major`, `mode:dorian`) handle variant dimensions naturally
- `ContentStats` includes SM-2 fields (`easeFactor`, `nextReview`) — forward-looking
- `DefinitionState` is beautifully minimal (`unlocked` + `enabled`)

**Issues found:**

| ID | Severity | Issue |
|----|----------|-------|
| DM-1 | Low | `ContentStats.relatedItems` is never populated anywhere in the codebase. Dead field. |
| DM-2 | Low | `Settings.activeContent` uses plural nouns (`'intervals'`, `'chords'`) while `ContentKind` uses singular (`'interval'`, `'chord'`). Minor inconsistency but could cause bugs if someone assumes they match. |
| DM-3 | Low | `Settings.proUnlocked` and `Settings.devMode` are optional (`?`) while `hasCompletedFRE` is also optional. These three booleans are semantically different from audio/display preferences — they're access control flags living in a display preferences object. |
| DM-4 | Info | `SessionRecord.kinds` is typed as `ContentKind[]` but only the adaptive quiz populates this with multiple kinds. Single-content quizzes always have `[kind]`. Not wrong, just unused flexibility. |

**Recommendation:** Consider moving `proUnlocked`, `devMode`, and `hasCompletedFRE` to a separate `access` or `flags` section. Not urgent — the current shape works, it's just semantically muddled.

### 2.2 Stat Key Consistency

**Verdict: Consistent and well-handled.**

| Kind | Key Pattern | Variants | Example |
|------|------------|----------|---------|
| Interval | `interval:{id}:{mode}` | ascending, descending, harmonic | `interval:P5:ascending` |
| Chord | `chord:{id}:{voicing}` | root, first, second | `chord:maj:root` |
| Scale | `scale:{id}` | none | `scale:major` |
| Mode | `mode:{id}` | none | `mode:dorian` |

The `getStatsForDef()` function correctly handles both flat keys and multi-variant keys by matching `{kind}:{defId}` exactly OR as prefix `{kind}:{defId}:`. This is elegant.

### 2.3 Defaults Factory

**Verdict: Clean, matches schema.**

`createDefaultStateV4()` and `freshV4State()` are nearly identical. `freshV4State()` exists in `migration.ts` as a fallback.

**Issue:**

| ID | Severity | Issue |
|----|----------|-------|
| DM-5 | Medium | `createDefaultStateV4()` and `freshV4State()` are duplicated logic. `freshV4State()` in `migration.ts` should call `createDefaultStateV4()` from `defaults.ts` instead of reimplementing it. If a new default setting is added to one but not the other, they'll diverge silently. |

### 2.4 Migration (v3→v4)

**Verdict: Thorough and defensive.**

Strengths:
- Wraps everything in try/catch with `freshV4State()` fallback
- Handles multiple legacy shapes (v1/v2/v3/v3.3/v3.4/v3.5)
- `patchMissingDefinitions()` handles new content added after v4 migration
- Migrated users get `hasCompletedFRE: true` (skip onboarding)

**Issues:**

| ID | Severity | Issue |
|----|----------|-------|
| DM-6 | Low | When patching missing definitions for existing v4 users, new tier-1 items auto-unlock (correct), but items in higher tiers that the user has already earned also auto-unlock. Example: If a new tier-2 interval is added and the user already has tier-2 unlocked, the new item gets `defaultDefinitionState(def.tier === 1)` = locked. The user must re-earn it or it sits locked while siblings are unlocked. This is actually correct behavior (make them earn it), but might feel odd. Worth documenting the design decision. |
| DM-7 | Low | `proUnlocked` is NOT migrated from legacy state — the migration only carries it over if it exists in `raw.settings`. If a legacy user had pro access stored differently, it's lost. Probably fine since Pro wasn't in v3, but worth verifying. |

### 2.5 Progression Logic

**Verdict: Well-structured, consistent thresholds.**

Threshold table:
| Content | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|---------|--------|--------|--------|--------|
| Intervals | 10q/70% | 30q/70% | 60q/70% | 100q/70% |
| Chords | 10q/70% | 30q/70% | 60q/70% | — |
| Scales | 10q/70% | 30q/70% | 60q/70% | — |
| Modes | Prereq: all scales + 60q/70% | 10q/70% | 30q/70% | — |

Per-item mastery: 5 attempts, 70% accuracy, 70% of tier items mastered.

**Issues:**

| ID | Severity | Issue |
|----|----------|-------|
| PR-1 | Medium | `unlockIntervalTiers()` loops tiers 2-4, but INTERVALS has a tier 5 threshold defined (`5: { questions: 100, accuracy: 0.7 }`). However, there are no tier-5 intervals in the definitions. The threshold entry is dead code. |
| PR-2 | Low | `checkTierUnlockV4()` does a `JSON.parse(JSON.stringify(state))` deep clone every call. This is called after every answer (`selectAnswer()`). With large sessionHistory arrays, this could become expensive. Structured clone or selective copying would be more efficient. |
| PR-3 | Medium | Progression pools stats across ALL unlocked items, not just the current tier. If a user has 100 questions on tier-1 intervals at 80% but only 2 questions on tier-2, the pooled average still meets tier-3 thresholds. The per-item mastery check on the prerequisite tier partially addresses this, but pooled stats from lower tiers inflate the numbers. |
| PR-4 | Low | devMode bypass: `getUserTier()` returns `'pro'` for devMode users, and `canAccess()` also checks `devMode` separately. Double bypass — harmless but redundant. |

### 2.6 Compat Layer

**Verdict: Should be phased out, but currently load-bearing.**

The compat layer (`buildIntervalState`, `buildChordState`, `buildScaleState`, `buildModeState`) converts v4 stats back into legacy shapes for:
1. **Progress page ContentCard** — needs aggregated stats per item
2. **Home page unlock checks** — uses `isModeMastered()` on legacy interval states
3. **Adaptive quiz** — uses `buildIntervalState()` + `isModeMastered()` to determine which content kinds are available

**Issues:**

| ID | Severity | Issue |
|----|----------|-------|
| CL-1 | High | `isModeMastered()` has different thresholds than progression mastery. Compat mastery: 20 attempts, 85% accuracy. Progression mastery: 5 attempts, 70% accuracy. These serve different purposes (display badge vs tier unlock), but the home page uses compat mastery (20/85%) for content-type unlock gating. This means a user needs significantly more practice on intervals before chords/scales unlock on the home page than what progression.ts would require. |
| CL-2 | High | `getMasteryLevel()` returns bronze/silver/gold based on how many play modes (asc/desc/harm) are mastered. But users start with only ascending enabled. Gold mastery requires mastering all three modes, but descending and harmonic are off by default. Users who never enable them can never get above bronze — which means the home page "5 bronze" check for chord unlock is actually "5 intervals with ascending mastery at 20/85%." This is fine pedagogically but should be documented. |
| CL-3 | Medium | The compat layer can't be eliminated yet because the home page and progress page depend on it for unlock gating and display. Recommend creating v4-native equivalents of `isContentTypeUnlocked()` and `getItemMasteryDisplay()` that operate directly on v4 stats. |

### 2.7 Feature Gating

**Verdict: Partially complete — two parallel gating systems.**

The `gate.ts` registry covers:
- `content:intervals:tier3`, `content:intervals:tier4` (Pro)
- `content:chords:tier2-4` (Pro)
- `content:scales:tier2-4` (Pro)
- `content:modes` (all Pro)
- `quiz:session_length_30`, `lab:ascii`, `settings:tone_piano` (registered but not enforced anywhere)

**Issues:**

| ID | Severity | Issue |
|----|----------|-------|
| FG-1 | High | Two parallel gating systems: (a) gate.ts feature flags for tier-level Pro gating, (b) bronze mastery check in home/progress pages for content-type unlocking. These are conceptually different (paid vs earned), but both control what users can access. They're not unified. |
| FG-2 | Medium | `quiz:session_length_30`, `lab:ascii`, `settings:tone_piano` are in the flag registry but NEVER checked anywhere. Dead feature flags. Settings page allows session length 30 for everyone. |
| FG-3 | Medium | Chord tier 1 is marked as "Free" in CONTENT-HIERARCHY.md, and there's no gate flag for `content:chords:tier1`. But chord access on the home page is gated behind the bronze mastery check (5 intervals mastered). So tier-1 chords are "free but locked behind mastery" — this is correct behavior but the gate registry doesn't represent this at all. |
| FG-4 | Low | No gate for `content:adaptive`. The flag `content:adaptive` exists in the type but not in the FLAGS array. Adaptive quiz is accessible to everyone who can reach `/quiz`. |

---

## 3. Front-end Components

### 3.1 Component Responsibilities

**QuizSession.svelte — 400+ lines, does too much.**

This is the most complex component and the biggest maintenance risk. It handles:
- Controller lifecycle (create, cleanup, restart)
- Viz note scheduling (syncing MIDI notes to animation)
- FRE terminal overlay (boot sequence, guidance messages, dismiss logic)
- Glitch text animation
- Bounce animation (physics-based)
- Audio gate / needsTap banner
- Debrief screen (two variants: normal + FRE conclusion)
- Extra controls reactivity hack (`extraControlTick`)
- Background/foreground audio recovery
- Desktop responsive layout (two-column grid)

**Recommendation:** Extract these into sub-components:
1. `DebriefScreen.svelte` — debrief panels, missed cards, replay
2. `FRETerminal.svelte` — terminal overlay, boot sequence, guidance
3. `QuizHUD.svelte` — top bar, progress, exit button, extra controls, mode icon

**Issues:**

| ID | Severity | Issue |
|----|----------|-------|
| FE-1 | High | The FRE guidance overlay uses a "sticky capture" pattern that's fragile. It captures guidance messages into `$state` and uses `dismissedKey` to prevent re-capture. This works but is a state machine bolted onto a reactive system — the interplay between `rawGuidanceMsg`, `capturedMsg`, `dismissedKey`, and the controller's phase is hard to reason about. |
| FE-2 | Medium | `extraControlTick` is a reactivity hack. Extra controls use closures (`getState()`, `getLabel()`) that Svelte can't track. The tick counter forces re-evaluation. This works but is a code smell — the extra controls API should use reactive primitives. |
| FE-3 | Low | `scheduleNotesSync()` duplicates playback timing logic that also exists in the config's `playAudio()`. If timing constants change in one place but not the other, viz desync. |
| FE-4 | Low | The component renders both debrief variants (normal + FRE) with `{#if isFRE}` blocks. These share no markup — they should be separate components. |

### 3.2 Other Components

**ContentCard.svelte** — Clean. Single responsibility (display card). Props are well-defined. The "pending flip" optimistic toggle is a nice touch.

**AnswerGrid.svelte** — Clean. The `ChoiceItem` interface is loosely typed (`[key: string]: unknown`) which allows flexibility but loses type safety on the `label` field (accessed via `choice.label ?? choice.id`).

**VizQuizLayout.svelte** — 350+ lines of canvas rendering. This is the visualization engine. It's complex but well-structured. The Chladni particle system is impressive. One concern: it reads `superchargeViz` from localStorage directly at module level, which means it doesn't react to settings changes.

**TickerBanner.svelte** — Simple, clean. Only concern: the ticker animation uses `translateX(-16.67%)` which assumes 6 copies of the text. This is correct for the current implementation but brittle if the repeat count changes.

**TelemetryBar.svelte** — Clean, with a nice tap-to-expand feature for abbreviated labels.

**ProgressBar.svelte** — Minimal, clean.

**LongPressButton.svelte** — Well-designed reusable component. The glitch text effect during hold is a nice aesthetic touch.

**LockedCard.svelte** — Minimal. Only shows "PRO" badge and optional dev unlock button.

**RadarGrid.svelte** — Pure SVG decoration. No logic issues.

**SideNav.svelte + BottomNav.svelte** — Work well as a pair. One concern:

| ID | Severity | Issue |
|----|----------|-------|
| FE-5 | Medium | SideNav and BottomNav have inconsistent `href` values. SideNav: Practice → `/quiz`, BottomNav: Practice → `/`. They handle this with `isActive()` but it means navigating via sidebar goes to `/quiz` while bottom nav goes to `/` (home). Both mark as "active" for quiz routes, but the destinations differ. |
| FE-6 | Low | SideNav links to `/quiz` for Practice but during an active quiz it shows as a disabled span. BottomNav links to `/` for Practice and also disables during quiz. The disabled-during-quiz logic works but the different hrefs are confusing. |

### 3.3 State Management

**Verdict: Page-level loading, no shared store. Works but has sync issues.**

| ID | Severity | Issue |
|----|----------|-------|
| SM-1 | High | Every page calls `loadStateV4()` independently. State changes on settings page don't propagate to other pages without navigation + reload. This is partially mitigated by SvelteKit's page-level lifecycle (pages unmount/remount on navigation), but there's a subtle bug: quiz pages create configs at module scope (`const state = loadStateV4()`) which runs once when the module is first imported, not on every navigation. |
| SM-2 | Medium | Quiz page modules (`/quiz/+page.svelte`, `/quiz/intervals/+page.svelte`, etc.) call `loadStateV4()` and `createXConfig(state)` at the top-level `<script>` block. In SvelteKit, this runs once per component instance. If the component is cached or reused across navigations, the state could be stale. |
| SM-3 | Medium | The quiz controller mutates `userState` directly and calls `saveStateV4()`. This works because the controller owns the state for the duration of the quiz session. But if two browser tabs are open, they'll overwrite each other's state. |
| SM-4 | Low | Home page (`+page.svelte`) loads state in `onMount` and stores it in `$state(null)`. This is correct. But it creates state reactivity via `$state` for a value that's only updated via `setActiveContent()` — the rest of the derived values use function calls (`chordsUnlocked()`, `overallAccuracy()`, etc.) which re-execute on any state change, even unrelated ones. |

### 3.4 Layout System

**Verdict: Clean mobile-first design with desktop sidebar.**

The responsive breakpoints:
- `< 768px`: Bottom nav, max-width 480px centered, mobile layout
- `≥ 768px`: Sidebar visible, bottom nav hidden, max-width 720px content
- `≥ 1200px`: Max-width 880px content, quiz uses two-column grid

**Issues:**

| ID | Severity | Issue |
|----|----------|-------|
| LY-1 | Low | Home page hides the header strip on desktop (`display: none` at 768px+) because the sidebar has the brand. But if sidebar is disabled (onboarding), there's no brand visible on desktop. |
| LY-2 | Low | The quiz two-column layout (`quiz-panels` grid) at 1200px+ puts viz at 3fr and answers at 2fr. This works but the landscape phone breakpoint (`(orientation: landscape) and (min-width: 568px) and (max-height: 500px)`) also triggers the same grid. On a landscape phone, this could make answer buttons too small. |
| LY-3 | Info | No z-index issues found. The TickerBanner uses `z-index: 100` (fixed, top), terminal overlay is `z-index: 0` within the canvas frame, and nav is in normal flow. Clean layering. |

### 3.5 QuizController/Config Split

**Verdict: Excellent architecture. The strategy pattern is well-applied.**

The `QuizController` is a pure state machine. The `QuizSessionConfig` is a strategy interface that plugs in content-specific behavior. This is the best part of the architecture.

Strengths:
- Controller doesn't know about audio, intervals, chords, etc.
- Config factories (`createIntervalConfig`, etc.) encapsulate all content-specific logic
- `playAudio`, `generateQuestion`, `onAnswer`, `formatDebrief` are clean extension points
- `extraControls` lets chords add ARP toggle and modes add DRN toggle without controller changes
- `getGuidanceMessage` + `freMode` + `skipDebrief` let FRE work through the same system

**Issues:**

| ID | Severity | Issue |
|----|----------|-------|
| QC-1 | Medium | The `controller.svelte.ts` Proxy wrapper is clever but creates a maintenance trap. The Proxy intercepts ALL property access (including internal method calls), which means every method call on the controller creates reactive dependencies on every property it reads. This could cause over-rendering if Svelte tracks more dependencies than necessary. |
| QC-2 | Low | `finishSession()` counts daily streak using a 2-day window (`< 2 * 24 * 60 * 60 * 1000`). This means if you practice at 11pm on Monday and 1am on Wednesday, it counts as consecutive. Probably intentional (lenient) but worth documenting. |
| QC-3 | Low | `endEarly()` increments `totalSessions` but doesn't add to `sessionHistory`. A user who exits early gets credit for a session but no record of it. |

---

## 4. Pedagogical Consistency

### 4.1 Content Hierarchy vs Implementation

**Comparing CONTENT-HIERARCHY.md with actual definition files:**

| Content | Doc Tiers | Implementation | Match? |
|---------|-----------|---------------|--------|
| Intervals T1 | P1, P5, P8 | P1, P5, P8 | ✅ |
| Intervals T2 | M3, m3, P4 | M3, m3, P4 | ✅ |
| Intervals T3 | M2, M6, m7, M7 | M2, M6, m7, M7 | ✅ |
| Intervals T4 | m2, m6, TT | m2, m6, TT | ✅ |
| Chords T1 | Maj, Min | maj, min | ✅ |
| Chords T2 | Dim, Aug | dim, aug | ✅ |
| Chords T3 | Maj7, Min7, Dom7 | dom7, maj7, min7 | ✅ |
| Chords T4 | Sus2, Sus4, Power, Dim7, hDim7, Aug7 | dim7, hdim7, aug7, sus2, sus4, pow | ✅ |
| Scales T1 | Major, Natural Minor | major, nat_min | ✅ |
| Scales T2 | Maj Pent, Min Pent | maj_pent, min_pent | ✅ |
| Scales T3 | Harmonic Min, Blues + 3 more | harm_min, blues, whole, mel_min, chromatic | ✅ |
| Scales T4 | Dorian, Mixolydian | dorian_scale, mixolydian_scale | ✅ |
| Modes T1 | Ionian, Aeolian | ionian, aeolian | ✅ |
| Modes T2 | Dorian, Mixolydian | dorian, mixolydian | ✅ |
| Modes T3 | Phrygian, Lydian, Locrian | phrygian, lydian, locrian | ✅ |

**Doc says chords T4 is "Sus2, Sus4, Power" but implementation also includes Dim7, hDim7, Aug7 in tier 4.** The doc is slightly outdated — it was written before the seventh chord extensions were added to tier 4. The implementation has the correct grouping.

**Scales tier 3 has 5 items in implementation but doc only mentions "Harmonic Minor, Blues" and "Character scales."** The doc needs updating to reflect Whole Tone, Melodic Minor, and Chromatic being added.

### 4.2 Cross-Content Dependencies

**Doc specifies:**
1. Intervals T2 (M3, m3) → Chords T1 (Major, Minor)
2. Intervals T3 (m7, M7) → Chords T3 (7th chords)
3. Scales T2+ → Modes T1

**Implementation check:**

| Dependency | Implemented? | How? |
|-----------|-------------|------|
| Intervals → Chords | **Sort of** | Home page uses bronze mastery (5 intervals × 20 att × 85% acc) to unlock chord section. But this isn't "interval tier 2 must be unlocked" — it's a separate mastery check. A user could get bronze on 5 tier-1 intervals without ever unlocking tier 2. |
| Intervals → Chord T3 | **No** | Chord T3 unlocks based on chord-internal stats (30q/70% on chords), not interval tier 3 mastery. The pedagogical intent (m7/M7 knowledge for 7th chords) is not enforced. |
| Scales → Modes | **Yes** | `unlockModes()` requires all max-tier scales unlocked + 60 questions at 70%. |

**Issues:**

| ID | Severity | Issue |
|----|----------|-------|
| PD-1 | Medium | The cross-content dependency "interval tier 2 → chord tier 1" from the doc is NOT enforced in progression.ts. Chords unlock from the home page via bronze mastery (compat layer), which is a different mechanism. A user can technically unlock chords by mastering P1, P5, P8 + two more tier-1 items if they existed, but there are only 3 tier-1 intervals. So in practice, you MUST unlock tier 2 to get 5 intervals to bronze-master. This is an accidental enforcement, not an explicit one. |
| PD-2 | Medium | The cross-content dependency "interval tier 3 → chord tier 3" is NOT enforced at all. A user with Pro access can progress through chord tiers purely on chord stats, without ever learning m7/M7 intervals. |
| PD-3 | Low | Mode prerequisite requires "all scales at max tier" — but max tier is 4, which is Pro-gated. Free users can never reach modes even if they somehow had Pro for modes. This is consistent since modes are all Pro, but it means the prerequisite chain is: Pro + scales T4 + 60 questions → modes T1. |

### 4.3 Quiz Generation

**Weighted pick analysis:**

All quiz configs use the same weighting formula:
```
weight = 0.1 + weakness * 0.5 + reviewOverdue * 0.3 + newBoost(0.5)
```

Where:
- `weakness = 1 - accuracy` (range 0-1)
- `reviewOverdue = min(1, (now - nextReview) / 24h)` (range 0-1)
- `newBoost = 0.5` if attempts === 0

This means:
- New items get weight ~1.1 (0.1 + 0.5*0.5 + 0 + 0.5)
- Perfect items get weight ~0.1-0.4
- Weak items get weight ~0.6-0.9
- Overdue items get weight ~0.4-0.7

**This is well-balanced.** New items are prioritized but not overwhelming. Weak items get appropriate boost.

**Distractor analysis:**

| Quiz | Distractor Strategy |
|------|-------------------|
| Intervals | Random from enabled intervals, fallback to locked (sorted by semitone proximity) |
| Chords | Random from enabled, fallback to locked (sorted by shared intervals) |
| Scales | Random from enabled, fallback to locked (sorted by shared intervals) |
| Modes | Random from enabled, fallback to all modes (sorted by shared intervals) |

**Issues:**

| ID | Severity | Issue |
|----|----------|-------|
| QG-1 | Medium | Interval distractors are selected randomly, NOT by proximity. The fallback sort is by semitone proximity, but the primary selection is shuffled. This means a user identifying P5 (7 semitones) could get P1 (0 semitones) as a distractor, which is trivially different. Pedagogically, distractors should be confusable (close in semitones). |
| QG-2 | Low | All configs have the same distractor count (3 distractors + 1 correct = 4 choices). If a content type has fewer than 4 items enabled, it falls back to locked items as distractors. This means a new user with only tier-1 intervals (P1, P5, P8) sees the same 3 choices every time — no variety until tier 2 unlocks. |
| QG-3 | Low | Adaptive quiz `getUnlockedKinds()` uses compat layer mastery (20/85%) to determine if chords/scales are available. This is the same check as the home page. But it doesn't check feature gates for chords/scales — only for modes. A user who hasn't earned bronze on 5 intervals won't see chords in adaptive, even if they've manually navigated to /quiz/chords and practiced there. |

### 4.4 Unlock Flow for Free Users

**Intended flow:**
1. Start with T1 intervals (P1, P5, P8) → practice → master
2. Unlock T2 intervals (M3, m3, P4) → first unlock moment
3. Bronze-master 5 intervals → chords/scales appear on home page
4. Try T1 chords (Maj, Min) and T1 scales (Major, Natural Minor)
5. Hit Pro wall at T2 chords, T2 scales, T3 intervals

**Actual flow:**
1. ✅ Start with T1 intervals
2. ✅ T2 unlock works: 10 questions at 70% + per-item mastery on T1 (5 att each, 70%)
3. ⚠️ Bronze mastery requires 20 attempts at 85% per interval. With only ascending mode enabled, user needs roughly 100+ questions before 5 intervals reach bronze. This is a significant grind.
4. ✅ Once unlocked, T1 chords and scales are available
5. ✅ Pro wall is at T2 chords, T2 scales, T3 intervals

**Issues:**

| ID | Severity | Issue |
|----|----------|-------|
| UF-1 | Medium | The gap between "T2 intervals unlocked" (10q/70%) and "chords available" (5× bronze at 20att/85%) is too large. A new user unlocks T2 in ~15 questions but might need ~150+ questions before chords appear. The CONTENT-HIERARCHY doc says "free users experience: intervals → unlock tier 2 → try chords + scales" but the mastery requirement creates a long gap. |
| UF-2 | Low | There's no way to get stuck — if you keep practicing, you'll eventually meet the thresholds. But accuracy below 70% on pooled stats blocks tier unlocks, which could frustrate users who are exploring new content. The per-item mastery check (5 att, 70%) is reasonable, but the pooled accuracy across ALL unlocked items means one weak item can drag down the average. |
| UF-3 | Info | Scale unlock requires only 3 bronze intervals (easier than chords' 5). This means scales appear before chords for most users. This is actually good pedagogically — scales are more approachable than chords. |

### 4.5 FRE (First-Run Experience)

**Verdict: Well-designed but minimal.**

The FRE consists of:
1. Boot sequence (terminal text animation)
2. 2 scripted questions: Octave (P8) + Perfect 5th (P5)
3. Conclusion screen with calibration complete message
4. Navigate to home

**Issues:**

| ID | Severity | Issue |
|----|----------|-------|
| FRE-1 | Low | FRE doesn't record stats (`onAnswer` is not defined). This means the 2 FRE questions don't count toward unlock progress. Intentional? If so, the user starts at 0 questions after FRE. |
| FRE-2 | Low | FRE only teaches intervals (Octave and P5). It doesn't introduce the concept of "you'll unlock more content as you practice." After FRE, the user lands on the home page with just intervals and no guidance about what to do next. |
| FRE-3 | Low | The FRE uses tier 1-2 intervals as distractors (`TIER1 = INTERVALS.filter(i => i.tier <= 2)`), but tier 2 isn't unlocked yet for a new user. This means the FRE shows interval names the user hasn't earned, which could confuse them when they start real practice and only see 3 choices. |
| FRE-4 | Info | Welcome page (`/welcome`) redirects to FRE. The actual welcome page doesn't exist — it's just a QuizSession with FRE config. This is clean. |

### 4.6 Progress Page

**Verdict: Functional but has display inconsistencies.**

The progress page shows all content items with their unlock/enable/accuracy status. It supports content type switching and per-mode/voicing tab filtering.

**Issues:**

| ID | Severity | Issue |
|----|----------|-------|
| PP-1 | Medium | `modesUnlocked` on the progress page uses `scalesUnlocked()` (3 bronze intervals), NOT the actual mode unlock logic (all scales at max tier + 60 questions). This means the MODES tab appears in the content toggle before any modes are actually unlocked. The tab shows all modes as locked cards, which is correct, but it reveals the existence of modes prematurely. |
| PP-2 | Low | When viewing modes with all items locked (Pro gate + no prerequisite), the page shows nothing — no LockedCard, no explanation. The `{:else if state.definitions.modes[def.id]?.unlocked || state.settings.devMode}` block only renders unlocked modes. Locked modes behind the Pro gate get `LockedCard`, but locked modes that are Free-but-not-earned show nothing. |
| PP-3 | Low | Interval telemetry (ALL tab) shows `SES`, `Q`, `STK` from globalStats. But globalStats.totalQuestions counts ALL questions across all content types, not just intervals. This means the Q count is inflated when the user has also practiced chords/scales. |
| PP-4 | Low | The minimum enabled count differs: 3 for intervals, 2 for chords/scales/modes. This is fine but not explained to the user. |

---

## 5. Cross-cutting Issues

### 5.1 The Unlock Logic Triplication Problem

The single biggest architectural issue. "Is chords unlocked?" is answered in three different places:

1. **Home page (`+page.svelte`):** `chordsUnlocked` derived — 5 bronze intervals
2. **Progress page (`progress/+page.svelte`):** `chordsUnlocked` derived — identical copy
3. **Adaptive quiz (`adaptive.ts`):** `getUnlockedKinds()` — identical logic

**Recommendation:** Extract into a single function in `$lib/state/` or `$lib/features/`:

```typescript
export function isContentKindAvailable(state: UserStateV4, kind: ContentKind): boolean
```

This would be the single source of truth for "can this user access this content kind?"

### 5.2 Compat Layer as Business Logic

The compat layer was designed as a bridge from v3 to v4 UI. But `isModeMastered()` and `buildIntervalState()` are now used for:
- Content-type unlock gating (home + progress + adaptive)
- Mastery badge display (progress page)
- Adaptive quiz content selection

`isModeMastered()` uses 20/85% thresholds, while progression uses 5/70%. These are different concepts (display mastery vs progression mastery) but they're conflated in the unlock logic.

**Recommendation:** Create a v4-native content availability check that doesn't depend on compat types.

### 5.3 State Initialization Pattern

All quiz pages follow this pattern:
```svelte
<script>
  const state = loadStateV4();
  const config = createXConfig(state);
</script>
<QuizSession {config} initialState={state} />
```

This loads state at component script time (Svelte component initialization). If SvelteKit keeps the component mounted during navigation, the state is stale. Currently this works because SvelteKit destroys/recreates page components on navigation, but it's fragile.

**Recommendation:** Move state loading into `onMount` or use a shared reactive store. The home page already does it correctly (loads in `onMount`).

### 5.4 The `definitions` Key Mismatch

`UserStateV4.definitions` uses plural keys: `intervals`, `chords`, `scales`, `modes`.
`ContentKind` uses singular: `interval`, `chord`, `scale`, `mode`.
`Settings.activeContent` uses plural: `'intervals'`, `'chords'`, `'scales'`, `'modes'`.

This requires manual mapping in every function that bridges between them. `getNextUnlockProgress()` has a config map for this. Each quiz config hard-codes its own mapping.

**Recommendation:** Consider adding a mapping utility:
```typescript
const PLURAL: Record<ContentKind, keyof UserStateV4['definitions']> = {
  interval: 'intervals', chord: 'chords', scale: 'scales', mode: 'modes'
};
```

### 5.5 Documentation Drift

- CONTENT-HIERARCHY.md doesn't mention Whole Tone, Melodic Minor, Chromatic (scales T3)
- CONTENT-HIERARCHY.md T4 chords section is inconsistent with implementation (mentions only Sus2/Sus4/Power, not Dim7/hDim7/Aug7)
- FRONTEND-AUDIT.md doesn't exist (referenced in task but missing)
- VISUAL-IDENTITY.md references the brand name "Lissa" but the codebase still uses "EAR TRAINER" everywhere

---

## 6. Priority Recommendations

### P0 — Fix Before Next Feature Sprint

1. **Extract content-kind unlock logic into a shared utility.** Create `$lib/features/content-access.ts` with `isContentKindAvailable(state, kind)`. Replace the triplicated bronze mastery check. This is the highest-leverage change.

2. **Update CONTENT-HIERARCHY.md** to match actual definitions (T3 scales, T4 chords complete list).

### P1 — Should Fix Soon

3. **Eliminate `freshV4State()` duplication.** Have `migration.ts` import `createDefaultStateV4()` from `defaults.ts`.

4. **Add proximity-based distractor selection for intervals.** Sort enabled intervals by semitone distance from correct answer, then pick from the closest ones (with some randomization). This dramatically improves pedagogical value.

5. **Document the two mastery systems.** Add a comment or doc explaining: compat mastery (20/85%) = display badges + content-type unlock, progression mastery (5/70%) = tier unlock. Make it clear these are intentionally different.

### P2 — Should Fix Eventually

6. **Create v4-native display mastery functions.** Replace `buildIntervalState()` + `isModeMastered()` + `getMasteryLevel()` usage in progress page with functions that operate directly on v4 stats. This doesn't remove compat.ts but reduces dependence on it.

7. **Move state to a shared reactive store.** Create `$lib/state/store.svelte.ts` that loads state once and provides a reactive reference. Pages subscribe instead of loading independently.

8. **Split QuizSession.svelte.** Extract `DebriefScreen`, `FRETerminal`, `QuizHUD` components. Keep QuizSession as the orchestrator.

9. **Add `ContentKind ↔ plural` mapping utility.** Small change, big reduction in manual mapping.

10. **Clean up dead code.** Remove `ContentStats.relatedItems`, dead feature flags (`quiz:session_length_30`, `lab:ascii`, `settings:tone_piano`), and the interval tier 5 threshold.

### P3 — Nice to Have

11. **Consider reducing bronze mastery threshold** for content-type unlock (20/85% → something lower) to close the gap between "tier 2 unlocked" and "chords appear." Or add an alternative path (e.g., "complete 3 full sessions" as alternative to 5 bronze).

12. **Enforce cross-content dependencies explicitly.** If the design intent is "M3/m3 knowledge before chords," add an explicit check in progression.ts rather than relying on the accidental bronze mastery gate.

13. **Improve FRE** to teach the progression mechanic (show a preview of "more content unlocks as you master intervals").

14. **Audit the `QuizController` proxy wrapper** for over-rendering. Consider using `$state.snapshot()` or more targeted reactivity.
