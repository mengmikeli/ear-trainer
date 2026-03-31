# Ear Trainer Review, Refactor Plan, and Feature Roadmap

## Executive Summary

Ear Trainer is better than a toy, but not yet as disciplined as a product.

It has real taste, a distinct aesthetic point of view, thoughtful audio work, real progression mechanics, and evidence of engineering care around migrations and tests. It does not feel like a tutorial app or a generic shell. It feels authored.

At the same time, the codebase is beginning to outgrow its current structure. The biggest issues are duplicated quiz-route logic, an increasingly overloaded state module, underexplained pedagogy in the UI, and a testing/documentation story that has not yet caught up to the ambition of the app.

### High-level judgment
- **Taste / identity:** 9/10
- **Technical foundation:** 7.5/10
- **Audio implementation:** 8.5/10
- **Product coherence:** 7/10
- **Pedagogical rigor:** 6.5/10
- **Maintainability right now:** 6.5/10
- **Upside / potential:** 9/10

### Bottom line
This is a very promising repo with real character. It needs one architecture cleanup pass and one pedagogy/clarity pass before the next serious wave of features.

---

## What Is Genuinely Strong

### 1. The product has a point of view
The terminal / radar / glitch / telemetry / debrief language gives the app a real identity. Many ear trainers are sterile; this one is not. Practice feels like entering a system, not opening a worksheet.

### 2. The stack choice is solid
SvelteKit + TypeScript + Vitest is a sane, modern stack for this app. The setup is lean and avoids obvious dependency bloat.

### 3. The audio layer is unusually thoughtful
The audio implementation shows care about:
- iOS Safari quirks
- resume/suspend lifecycle
- media session metadata
- synth personality
- clipping/gain management
- analyzer support for visuals

This is one of the strongest technical parts of the repo.

### 4. The learning system has real structure
There is actual training design here, not random drill spam. The app includes:
- interval / chord / scale tracks
- mode-specific stats
- unlock tiers
- weighted question selection
- replay-aware scoring
- a simplified spaced-repetition flavor

### 5. Migration awareness is good
The state layer includes migration logic. That is a strong sign of product thinking and data durability awareness.

### 6. Some UX ideas are genuinely smart
Standout examples:
- session debrief screens
- replaying missed items
- scale A/B comparison after wrong answers
- chord arpeggiated vs block mode
- dev/lab affordances
- compact, low-friction settings

---

## What Feels Weak or Risky

### 1. The quiz logic is duplicated too much
The three quiz routes replicate the same session/state machine structure:
- load state
- generate next question
- play audio
- handle selection
- update stats
- handle result mode
- finish session
- restart session

This is the biggest maintainability risk in the repo.

### 2. The state layer is conceptually muddy
`src/lib/state.ts` currently mixes:
- default creation
- persistence
- migration logic
- unlock logic
- stat helpers
- compatibility fields

It is becoming a god file.

### 3. Canonical vs compatibility stats are not cleanly separated
The code still carries flat aggregate stats alongside richer per-mode/per-voicing data. That is understandable for migration, but it muddies the true source of truth.

### 4. Progression can be gamed
Unlock logic appears to rely heavily on pooled attempts and pooled accuracy across unlocked material. That means users can advance through aggregate success instead of demonstrating balanced mastery.

### 5. Style sometimes beats clarity
The visual identity is strong, but the UI sometimes asks users to learn the interface dialect at the same time they are learning music. Small text, abbreviations, glyph-heavy labeling, and all-caps condensed type increase friction.

### 6. README is weak relative to repo ambition
The scaffold README undersells the work and fails to explain the app, the progression model, deployment assumptions, browser/audio quirks, and current scope.

### 7. Tests are encouraging but narrow
State migration and unlock logic have coverage, which is good, but the testing story is still thin relative to the app’s ambition.

---

## File-by-File Architecture Review

## `package.json`
### Good
- Clean, standard scripts
- `build`, `check`, `test` present
- Modest dependency set

### Concern
Both `@sveltejs/adapter-auto` and `@sveltejs/adapter-static` are installed, but only static is used.

### Verdict
Healthy package file; minor cleanup opportunity.

---

## `README.md`
### Problem
It is still the scaffold README.

### Why it matters
This repo has custom logic around:
- audio engine behavior
- progression and mastery
- persistence and migrations
- mobile/browser constraints

The README should explain those and currently does not.

### What it should contain
- what Ear Trainer is
- current scope: intervals / chords / scales
- how progression works
- how mastery works
- how local state is stored
- supported browsers/device notes
- run/test/deploy instructions
- roadmap / limitations

### Verdict
Most obvious maturity gap from the outside.

---

## `svelte.config.js`
### Good
- Static adapter config is deliberate
- `BASE_PATH` support is smart for subpath deploys
- runes config appears intentional

### Concern
`fallback: 'index.html'` commits the app more strongly to SPA-style behavior, which is fine if deployment matches.

### Verdict
Good config.

---

## `vite.config.ts`
### Good
- Minimal and readable
- Explicit test include path

### Concern
Testing scope looks narrow; no sign of browser/e2e coverage.

### Verdict
Healthy minimal setup.

---

## `src/routes/+page.svelte`
### Strong
- Strong aesthetic identity
- Good derived values for telemetry-like state
- intuitive switching between intervals / chords / scales
- unlock-aware home screen behavior

### Weak
The page does too much:
- data loading
- stat computation
- content switching
- navigation behavior
- animation logic
- UI rendering

### Product note
It feels cool, but not explanatory enough for first-time users.

### Verdict
Great vibe, somewhat overloaded logic.

---

## `src/routes/quiz/+page.svelte`
## `src/routes/quiz/chords/+page.svelte`
## `src/routes/quiz/scales/+page.svelte`
### Strong
All three routes have coherent session flows and show real product design.

### Weak
They are structurally parallel and duplicated. The same session mechanics appear in slightly different forms.

### Risk
Any future change to timing, summary behavior, replay handling, streaks, save rules, or analytics will likely require three edits.

### Recommendation
Extract shared quiz-session machinery into a controller/helper layer while keeping content-specific rendering separate.

### Verdict
Best functional core in the app, but also the clearest maintainability hotspot.

---

## `src/routes/settings/+page.svelte`
### Strong
Memorable, handcrafted, rich with personality.

### Weak
It is serving too many roles at once:
- actual settings page
- release notes viewer
- about/credits page
- dev mode switchboard
- reset surface
- hidden lab entry

### Verdict
Charming but overloaded.

---

## `src/lib/state.ts`
### Strong
Centralizes:
- default state creation
- persistence
- migration logic
- tier/unlock logic
- aggregate helpers

### Weak
Too many responsibilities for one file.

### Debt
The mixture of compatibility fields and richer canonical fields weakens conceptual clarity.

### Recommendation
Split into focused modules:
- defaults
- storage
- migrations
- progression
- stats

### Verdict
Good instincts; drifting toward a god file.

---

## `src/lib/types.ts`
### Good
Readable, useful, and mostly clear.

### Weak
The types reflect transitional product history and compatibility concerns. The model is understandable, but not yet fully clean.

### Verdict
Serviceable now; worth cleaning once canonical state shape is finalized.

---

## `src/lib/mastery.ts`
### Good
Simple and understandable mastery model.

### Weak
Mastery thresholds are clear but maybe too simple for a teaching-first product. Also, mastery and unlock are separate systems with overlapping implications.

### Verdict
Good MVP logic.

---

## `src/lib/intervals.ts`, `src/lib/chords.ts`, `src/lib/scales.ts`
### Good
Domain definitions are cleanly separated from behavior.

### Notes
- Interval tiering is opinionated but fine for a game-like progression model.
- Chord content includes sevenths, but voicing support stops at second inversion.
- Scale content is musically interesting but still more content-driven than pedagogy-driven.

### Verdict
Among the cleaner parts of the repo.

---

## `src/lib/engine.ts`
### Strong
- weighted selection
- enabled/unlocked filtering
- distractor fallback logic
- some notion of confusability
- pitch-range constraints

### Weak
Weighting is pragmatic but shallow. It is adaptive enough for an MVP but not deeply pedagogical yet.

### Verdict
One of the better-designed files.

---

## `src/lib/audio.ts`
### Strong
Likely the most technically impressive file in the repo.

### Weak
It is long and dense enough that it now wants submodules for readability.

### Verdict
Real craft here.

---

## `src/lib/sm2.ts`
### Strong
Simple, readable, understandable.

### Weak
This is more SM-2-inspired than true SM-2. The scheduler is useful but shallow.

### Verdict
Fine for MVP; not yet a robust learning scheduler.

---

## `src/lib/theme.ts`
### Verdict
Small, clear, appropriate.

---

## `src/components/AnswerGrid.svelte`
### Strong
Clear responsibility and usable interface.

### Weak
Contains a little more behavior convention than a pure presentational component, but still reasonable.

### Verdict
Solid component.

---

## `src/components/PlayButton.svelte`
### Strong
Good encapsulation of a branded, stateful control.

### Weak
It is becoming a mini state machine due to glitching, countdown, replay, and feedback behavior.

### Verdict
Useful and effective, but denser than it first appears.

---

## `tests/state.test.ts`
### Strong
Better than average early-stage testing, especially around migration and progression.

### Weak
Coverage is narrow relative to product scope.

### Verdict
Encouraging foundation, not enough protection yet.

---

## Pedagogy Critique

## What is already good
- The app is not random drill spam.
- It distinguishes interval play modes that are genuinely different skills.
- It includes review behavior after mistakes.
- It paces complexity in a motivating way.

## Where pedagogy is weaker
### 1. Unlocking is too pooled
Pooled attempts and accuracy make advancement possible without broad or balanced mastery.

### 2. Pedagogy is underexplained
Users likely do not know clearly:
- what unlocks content
- why items repeat
- what mastery means
- what improves progress

### 3. Scheduler is plausible but shallow
The scheduler is useful, but coarse-grained and not deeply tuned.

### 4. Chords and scales need stronger instructional framing
Recognition is present, but the listening strategy is not well externalized.

### 5. Mastery vs unlock should either align or be explicitly distinguished
Right now the systems can feel related but not fully integrated.

### Pedagogical conclusion
The training system is good enough to be compelling and not yet rigorous enough to be authoritative.

---

## Brutally Honest UI/UX Review

## What is good
- Strong visual language
- Clear primary action surfaces
- Session feedback has emotional texture
- The app feels like a world, not a worksheet

## What is weak
### 1. Readability is taxed by the aesthetic
- small text
- condensed all-caps
- low-contrast support text
- cryptic abbreviations
- heavy symbolic/glyph language

### 2. Labels are sometimes too encoded
Examples include:
- `INT`
- `CRD`
- `SCL`
- `STK`
- `ACC`
- `SES`
- various mode glyphs

### 3. The system does not explain enough
A learner should quickly understand:
- why content is locked
- what to do next
- what the app is measuring
- why they are seeing a repeated item

### 4. Settings are a little too clever
The long-press reset/lab interactions are fun but feel insider-ish.

### 5. Emotional register is narrow
The app is stylishly stern and intense. It could use a little more softness and guidance without losing identity.

### 6. Accessibility likely needs work
Potential concerns:
- font size
- contrast
- all-caps burden
- glyphs as meaning carriers
- screen-reader clarity

### UX conclusion
The app is memorable and beautiful, but somewhat harder to understand than it should be.

---

# Refactor Plan

## Refactor Goals
1. Reduce duplicated session logic
2. Clarify the canonical data model
3. Separate learning policy from persistence details
4. Improve test coverage around product-critical logic
5. Preserve the current visual identity while improving clarity and maintainability

---

## Phase 1 — Stabilize the architecture

### Task 1: Extract shared quiz-session logic
**Why first:** This is the highest leverage refactor.

**Create/modify:**
- Create: `src/lib/quiz/session.ts`
- Create: `src/lib/quiz/types.ts`
- Modify: `src/routes/quiz/+page.svelte`
- Modify: `src/routes/quiz/chords/+page.svelte`
- Modify: `src/routes/quiz/scales/+page.svelte`

**What to extract:**
- question index tracking
- correct/wrong result handling
- result-mode countdown logic
- finish/restart logic
- session stats accumulation
- early exit / save behavior

**Keep route-specific:**
- question generation
- playback behavior
- summary-specific content rendering
- content-specific feedback details

**Success criteria:**
- all 3 quiz routes use a shared session controller/helper
- duplicate logic is materially reduced
- behavior remains unchanged from the user’s perspective

---

### Task 2: Split `state.ts` into focused modules
**Create/modify:**
- Create: `src/lib/state/defaults.ts`
- Create: `src/lib/state/storage.ts`
- Create: `src/lib/state/migrations.ts`
- Create: `src/lib/state/progression.ts`
- Create: `src/lib/state/stats.ts`
- Create: `src/lib/state/index.ts`
- Modify: files importing `$lib/state`

**Move responsibilities:**
- default creation → `defaults.ts`
- load/save → `storage.ts`
- migrations → `migrations.ts`
- unlock rules → `progression.ts`
- aggregate helpers → `stats.ts`

**Success criteria:**
- no behavior change
- clearer import boundaries
- tests still pass

---

### Task 3: Define canonical stat ownership
**Goal:** Stop carrying ambiguity between flat aggregate fields and richer nested fields.

**Approach:**
- Decide whether nested stats are canonical for intervals/chords
- If yes, compute flat fields or deprecate them internally
- Keep migration compatibility, but document what is authoritative

**Files likely touched:**
- `src/lib/types.ts`
- `src/lib/state/migrations.ts`
- `src/lib/state/stats.ts`
- `src/lib/engine.ts`
- quiz routes

**Success criteria:**
- one clearly documented source of truth
- engine and progression logic use the canonical model consistently

---

## Phase 2 — Strengthen learning logic

### Task 4: Separate progression rules from storage concerns
**Goal:** Make pedagogy inspectable and editable.

**Create/modify:**
- Create: `src/lib/learning/unlocks.ts`
- Create: `src/lib/learning/mastery.ts`
- Create: `src/lib/learning/review.ts`
- Modify: `src/lib/state/progression.ts`
- Modify: `src/lib/mastery.ts` or replace it
- Modify: `src/lib/sm2.ts`

**Changes:**
- keep unlock rules in learning policy layer
- keep mastery logic in learning policy layer
- keep spaced review logic in learning policy layer
- leave persistence layer dumb

**Success criteria:**
- learning logic is centralized
- changing pedagogy does not require editing persistence code

---

### Task 5: Improve unlock fairness
**Goal:** Reduce pooled-accuracy gaming.

**Potential direction:**
- require minimum attempts per item or per subgroup
- require minimum mastery count, not just pooled accuracy
- require X of Y items in a tier to be stabilized before next-tier unlock

**Files likely touched:**
- `src/lib/learning/unlocks.ts`
- `tests/learning/unlocks.test.ts`
- home/settings UI explanation surfaces

**Success criteria:**
- progression remains motivating
- advancement better reflects balanced learning

---

## Phase 3 — Improve clarity without killing personality

### Task 6: Add explanatory microcopy and unlock clarity
**Create/modify:**
- `src/routes/+page.svelte`
- possibly a small `src/components/UnlockHint.svelte`
- settings/help surfaces

**Add:**
- what unlocks chords
- what unlocks scales
- what bronze/silver/gold mean
- why items repeat more often

**Success criteria:**
- first-time users can understand the progression loop without reading code

---

### Task 7: Tame the settings page
**Approach options:**
- split into tabs/sections
- or preserve single page but group into clearer cards

**Recommended sections:**
1. Practice preferences
2. Learning options / modes
3. Data + dev tools
4. About / release notes / credits

**Success criteria:**
- easier scanning
- reduced insider-feeling UX
- no loss of personality

---

## Phase 4 — Testing and docs

### Task 8: Expand tests around engine and progression
**Create:**
- `tests/engine.test.ts`
- `tests/chords.test.ts`
- `tests/scales.test.ts`
- `tests/unlocks.test.ts`
- `tests/sm2.test.ts`

**Cover:**
- question generation
- distractor uniqueness
- enabled/unlocked filtering
- weighting behavior
- unlock logic across intervals/chords/scales
- scheduler edge cases

**Success criteria:**
- product-critical logic is protected
- regressions are caught before UI symptoms appear

---

### Task 9: Add a real README
**Create/modify:**
- `README.md`

**Include:**
- product description
- current scope
- architecture overview
- audio/browser notes
- progression explanation
- local dev commands
- test commands
- deployment notes
- roadmap / limitations

**Success criteria:**
- a new contributor can understand the app in under 10 minutes

---

## Phase 5 — Optional technical refinement

### Task 10: Modularize audio layer
**Create/modify:**
- `src/lib/audio/context.ts`
- `src/lib/audio/synths.ts`
- `src/lib/audio/playback.ts`
- `src/lib/audio/feedback.ts`
- re-export from `src/lib/audio/index.ts`

**Why optional:**
The audio code is strong already. This is about readability more than correctness.

---

## Suggested sequencing
1. Shared quiz-session extraction
2. Split state module
3. Canonical stats cleanup
4. Learning-policy separation
5. Unlock fairness improvement
6. UX clarity pass
7. Tests expansion
8. README rewrite
9. Audio modularization (optional)

---

# Feature Roadmap

## Product North Star
Make Ear Trainer feel like a **beautiful, habit-forming listening practice system** that is both emotionally distinct and pedagogically trustworthy.

---

## Version 0.1.x — Cleanup and clarity release
**Theme:** Stabilize what already exists.

### Goals
- reduce architectural duplication
- clarify progression and mastery in the UI
- strengthen tests
- document the product properly

### Candidate features
- improved home-page progression explanation
- visible unlock requirements
- better session summary explanations
- more readable labels/tooltips for telemetry abbreviations
- proper README

### Success metric
Users understand what they are practicing and why without needing external explanation.

---

## Version 0.2.x — Better learning system
**Theme:** Make the trainer smarter, not just bigger.

### Features
- improved unlock fairness
- stronger spaced review tuning
- better mode-specific recommendations
- “focus weak spots” session mode
- “review due items” session mode
- item-level mastery explanations

### Optional UX additions
- recommended next practice surface on the home page
- adaptive daily goal or suggested session

### Success metric
Practice feels more personalized and progression feels more earned.

---

## Version 0.3.x — Guided learning layer
**Theme:** Teach, don’t just test.

### Features
- listening tips for each interval/chord/scale
- “what to listen for” hints
- contrast drills (e.g. major vs minor, natural minor vs harmonic minor)
- guided discovery mode for new content
- short instructional blurbs when content unlocks

### Why this matters
This is the shift from pure recognition game toward more meaningful ear training.

### Success metric
Users can improve not only by repetition but by understanding the perceptual differences being tested.

---

## Version 0.4.x — Session variety and retention
**Theme:** Make the app stickier.

### Features
- daily challenge
- streak-aware practice prompts
- custom practice presets
- short sprint mode / deep review mode
- end-of-session recommendations
- “recent misses” queue

### Optional
- lightweight achievements that align with learning instead of vanity

### Success metric
Users return because the app feels alive, not because it is merely novel.

---

## Version 0.5.x — Analytics and learner trust
**Theme:** Make progress legible.

### Features
- richer stats page
- mastery heatmaps
- per-mode performance trends
- trouble-item tracking
- review backlog visibility
- unlock history / milestone history

### UX note
This should be legible and encouraging, not spreadsheet-heavy.

### Success metric
Users can answer: “What am I better at now, and what should I do next?”

---

## Version 0.6.x — Content depth expansion
**Theme:** Expand carefully.

### Possible content additions
- third inversion for seventh chords
- melodic patterns / motifs
- cadence recognition
- scale degree / functional hearing drills
- chord progression quality recognition
- modal content (Dorian, Mixolydian, etc.)

### Guardrail
Do not add broad content until the existing progression model and architecture are stable.

### Success metric
New content feels integrated into the learning system rather than bolted on.

---

## Version 0.7.x — Premium polish / trust layer
**Theme:** Make it feel finished.

### Features
- onboarding flow
- first-session guidance
- accessibility pass
- typography/contrast/readability improvements
- consistent help affordances
- more polished deployment/PWA guidance

### Success metric
The app becomes easier to recommend to someone who did not build it.

---

# What Should Be Cut, Delayed, or Protected

## Protect
- aesthetic identity
- audio craftsmanship
- strong sense of world/voice
- debrief / replay ideas

## Delay until architecture is cleaner
- major new content systems
- complex analytics surfaces
- social/sharing features
- too many new play modes

## Cut or reconsider if they start adding drag
- overly cryptic labels with no explanatory payoff
- hidden/insider UX for important behavior
- progression rules that are fun but pedagogically misleading

---

# Recommended Next Moves

## If focusing on engineering first
1. extract shared quiz-session logic
2. split `state.ts`
3. expand engine/progression tests
4. rewrite README

## If focusing on product first
1. clarify unlock/mastery rules in UI
2. improve readability and microcopy
3. add guided listening hints
4. refine progression fairness

## If focusing on fastest visible improvement
1. real README
2. unlock explanations
3. better stats/summary clarity
4. label cleanup for abbreviations and glyph-heavy surfaces

---

# Final Conclusion

Ear Trainer already has something many technically cleaner projects do not: character, taste, and a reason to exist.

Its next challenge is not “become more impressive.” It is “become more legible, more maintainable, and more trustworthy as it grows.”

The right move is not to flatten its identity. The right move is to preserve the identity while tightening the architecture, clarifying the pedagogy, and reducing the accidental complexity that comes from growth.
