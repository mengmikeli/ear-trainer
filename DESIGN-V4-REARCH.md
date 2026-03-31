# Ear Trainer v4.0 — Architecture Redesign Spec

**Date:** 2026-03-31
**Status:** Approved
**Authors:** Mike + Moto
**Branch:** `feat/v4-rearch`
**Closes:** #86, #55, #56

---

## Overview

v4.0 is a foundation-only architecture redesign. From the user's perspective, the app looks and behaves identically. Under the hood, five duplicated quiz pages collapse into one shared controller, the data model is unified, audio becomes persistent, and the module structure is reorganized for maintainability.

### Goals
- Eliminate quiz page duplication (5 pages → 1 shared controller + thin route shells)
- Unify the data model (promote `adaptive.stats` to canonical, drop legacy dual-write)
- Make AudioContext persistent (fixes #86, #55, #56)
- Reorganize `src/lib/` into focused modules
- Create feature gate plumbing for future Pro/Free split
- Zero UX regression — guaranteed by snapshot tests written before refactor

### Non-Goals (v4.0)
- No new features, no new content
- No FRE/onboarding flow (backlog)
- No actual Pro/Free content split decisions (backlog)
- No unlock fairness improvements (backlog)
- No pedagogy/microcopy changes (backlog)
- No visual changes

### Version
v4.0 — major version bump due to breaking localStorage schema migration.

---

## 1. Data Model

### Current Problems
- `UserState` has 5 separate top-level records: `intervals`, `chords`, `scales`, `modes`, `adaptive`
- Each per-category record duplicates the same fields: `attempts`, `correct`, `streak`, `easeFactor`, `nextReview`, `lastSeen`
- `adaptive.stats` was bolted on as a unified overlay but dual-writes back to legacy state
- `state.ts` is a god file mixing defaults, persistence, migrations, unlock logic, and stat helpers
- Migration code grows linearly with each new content type

### New Schema (v4)

```typescript
interface UserStateV4 {
  version: 4;

  // Canonical performance stats — keyed by composite ID
  // Examples: "interval:P5:ascending", "chord:min7:root", "scale:blues", "mode:dorian"
  stats: Record<string, ContentStats>;

  // Unlock/enable state per definition — separated from performance data
  definitions: {
    intervals: Record<string, DefinitionState>;
    chords: Record<string, DefinitionState>;
    scales: Record<string, DefinitionState>;
    modes: Record<string, DefinitionState>;
  };

  // User preferences
  settings: Settings;

  // Global counters
  globalStats: GlobalStats;

  // Session history for adaptive planner
  sessionHistory: SessionRecord[];
}

interface DefinitionState {
  unlocked: boolean;
  enabled: boolean;
}

interface ContentStats {
  attempts: number;
  correct: number;
  streak: number;
  lastSeen: number;       // timestamp ms
  easeFactor: number;     // SM-2 (default 2.5)
  nextReview: number;     // timestamp ms
  relatedItems: string[]; // cross-content connections
}

interface Settings {
  toneType: ToneType;
  sessionLength: SessionLength;
  theme: ThemeMode;
  enabledModes: { ascending: boolean; descending: boolean; harmonic: boolean };
  enabledVoicings: { root: boolean; first: boolean; second: boolean };
  activeContent: 'intervals' | 'chords' | 'scales' | 'modes' | 'adaptive';
  devMode?: boolean;
  superchargeViz?: boolean;
}

interface GlobalStats {
  totalSessions: number;
  totalQuestions: number;
  currentStreak: number;
  bestStreak: number;
  lastPractice: number;   // timestamp ms
}

interface SessionRecord {
  date: number;
  length: number;
  kinds: ContentKind[];
  accuracy: number;
  weakestItem: string;
  strongestItem: string;
}
```

### Key Design Decisions
- **One stats record** — `ContentStats` keyed by composite ID. No more dual-write.
- **Definitions separate from stats** — unlock/enable state in `definitions`, performance data in `stats`. Clean separation.
- **Version field** — enables future migrations. `loadState()` checks version, runs migrator chain.
- **Removed**: `direction` setting (superseded by `enabledModes`), `mode: 'choice' | 'free'` on intervals (phase 2 freeform deferred indefinitely), flat aggregate fields on per-category records.

### Migration (v3 → v4)
- One-time migration on first `loadState()` call
- Reads current localStorage, maps legacy state into new shape
- `adaptive.stats` already contains canonical performance data — promote directly
- `intervals[id].unlocked/enabled` → `definitions.intervals[id]`
- Same for chords, scales, modes
- Writes with `version: 4`
- If no existing state (fresh install), creates v4 defaults directly

---

## 2. Quiz Architecture

### Current Problems
- 5 quiz pages (intervals, chords, scales, modes, adaptive) with ~90% duplicated code
- Same 20+ state variables copy-pasted across all pages
- Same functions reimplemented 5×: `nextQuestion()`, `selectAnswer()`, `enterResultMode()`, `tickCountdown()`, `finishSession()`, `restartQuiz()`, `play()`
- Same glitch text system, bounce animation, visibility handler — verbatim
- Same DEBRIEF template
- Same CSS blocks (~150 lines duplicated per page)
- Small per-category variations: chord has ARP/BLK toggle, modes has DRN toggle + drone lifecycle

### Design

**Shared `<QuizSession>` component** — one quiz loop, all routes are thin shells.

**Quiz Controller** (`src/lib/quiz/controller.ts`):

State machine:
```
idle → playing → awaiting_answer → feedback_correct → debrief
                                 → feedback_wrong → result_mode → next_question
                                                                → debrief
```

Responsibilities:
- Question index tracking
- Correct/wrong result handling with timing
- Result-mode countdown logic
- Auto-advance timers (1350ms correct, 8000ms wrong result mode)
- Session stats accumulation
- Finish/restart logic
- Early exit with save

Content-agnostic: receives questions via config callbacks, emits events. Does not know about intervals vs chords.

Exposes a reactive store/object that the `<QuizSession>` UI component binds to.

**Quiz Session Config** (`QuizSessionConfig`):

```typescript
interface QuizSessionConfig {
  contentKinds: ContentKind[];
  sessionLength: number;
  generateQuestion: (state: UserStateV4) => UnifiedQuestion;
  playAudio: (question: UnifiedQuestion, state: UserStateV4) => Promise<PlaybackInfo>;
  formatDebrief?: (results: QuestionResult[]) => DebriefSection[];
  extraControls?: ExtraControl[];   // e.g. drone toggle, arp toggle
  countdownDuration?: number;       // override default (e.g. 10s for scales A/B)
}

interface ExtraControl {
  id: string;           // 'drone' | 'arpeggio'
  label: string;        // 'DRN' | 'ARP/BLK'
  getState: () => boolean;
  toggle: () => void;
}
```

**Unified Question Type**:

```typescript
interface UnifiedQuestion {
  id: string;                   // content item ID (e.g. "interval:P5:ascending")
  kind: ContentKind;
  rootNote: number;
  playback: PlaybackParams;     // everything audio needs
  correctAnswer: ChoiceItem;
  choices: ChoiceItem[];
  replays: number;
  metadata?: Record<string, any>;  // kind-specific (e.g. droneNote, voicing)
}

interface ChoiceItem {
  id: string;
  name: string;
  label: string;
}

interface PlaybackParams {
  type: 'interval' | 'chord' | 'scale';
  rootNote: number;
  intervals: number[];          // semitones
  toneType: ToneType;
  direction?: PlayMode;         // for intervals
  voicing?: ChordVoicing;       // for chords
  arpeggiated?: boolean;        // for chords
  tempo?: number;               // for scales/modes
  drone?: { note: number };     // for modes
}
```

**Route Shells** — each ~20-30 lines:

```
/quiz/intervals/+page.svelte  → <QuizSession config={intervalConfig} />
/quiz/chords/+page.svelte     → <QuizSession config={chordConfig} />
/quiz/scales/+page.svelte     → <QuizSession config={scaleConfig} />
/quiz/modes/+page.svelte      → <QuizSession config={modeConfig} />
/quiz/adaptive/+page.svelte   → <QuizSession config={adaptiveConfig} />
```

Adaptive is the default "GO" path. Per-category routes are adaptive with `contentKinds` filtered to one type.

**What varies per content type** (passed via config):
- How to generate a question (different engine calls)
- How to play audio (playInterval vs playChord vs playScale + optional drone)
- Extra UI controls (drone toggle for modes, arp toggle for chords)
- Debrief grouping (per-mode breakdown for intervals, per-voicing for chords)
- Countdown duration overrides

**What's shared** (in controller + `<QuizSession>`):
- Question progression and answer handling
- Feedback timing (correct: 1350ms auto-advance, wrong: result mode with countdown)
- Audio unlock / iOS gate / visibility handler
- Glitch text effect, play button bounce animation
- Progress bar, answer grid layout, debrief screen
- All CSS

---

## 3. Audio Architecture

### Current Problems
- AudioContext created per page, destroyed on navigation (`ctx.close()`)
- `suspendAudio()` / `scheduleSuspend()` fires after every playback — causes OS media session churn
- Each quiz page manages its own `visibilitychange` handler for audio resume
- Feedback chimes bypass master gain chain (connect directly to `destination`)
- BT headsets miss first play (#55) because audio route needs warmup
- Dynamic Island flickers (#56) from rapid start/stop cycles

### Design

**Persistent AudioContext** — created once on first user gesture, lives in `+layout.svelte`, never closed during app lifecycle.

**Module split** (`src/lib/audio/`):

| Module | Responsibility |
|--------|---------------|
| `context.ts` | Singleton AudioContext, master gain, analyser. `getContext()`, `getMasterOutput()`, `getAnalyser()` |
| `synths.ts` | Tone generators (epiano, sine, piano). Pure functions: take AudioContext + destination + params, return nothing. No global state. |
| `playback.ts` | High-level: `playInterval()`, `playChord()`, `playScale()`, `playNote()`, `playFeedbackChime()`. Orchestrates synths → master output. Implements generation-based cancellation. |
| `drone.ts` | Drone lifecycle: `startDrone()`, `stopDrone()`, `forceStopDrone()`. Own gain chain, routes through master output. |
| `session.ts` | Media session metadata, iOS audio session type, visibility handling. The "make the OS happy" layer. |
| `index.ts` | Re-exports public API |

**Key Behavior Changes**:

1. **No more `stopAudio()`** — replaced by `muteAll()` which ramps master gain to 0. Context stays alive.
2. **No more `suspendAudio()` / `scheduleSuspend()` cycle** — context stays `running`. OS media session stays active while app is in foreground.
3. **Media session set once** on first play, cleared only on app background.
4. **Page navigation does nothing to audio** — currently-playing oscillators finish their natural time-bounded envelope. No mute, no kill, no interference.
5. **Drone exception** — navigating away from modes fades out the drone (sustained oscillator with no natural end). This is a modes route cleanup, not a global kill.
6. **Visibility handler moves to `+layout.svelte`** — one handler instead of 5. On background: just let iOS suspend. On foreground: `resume()`.
7. **All audio routes through master output** — including feedback chimes (currently bypasses).

**Generation-Based Playback Cancellation**:

When `play*()` is called, any still-sounding notes from a previous play should go silent immediately, then the new notes start.

```
play() called:
  1. Create a new per-playback GainNode ("playback gain")
  2. Connect it to master output
  3. Ramp previous playback gain to 0 over ~30ms (quick crossfade, no click)
  4. Schedule new oscillators through the new playback gain
  5. Store reference to current playback gain for next cancellation
```

Behaviors:
- Tap play twice quickly → first interval crossfades out, second starts clean
- New question auto-plays → previous question's audio silenced
- Navigate to another page → current notes finish naturally (no playback gain change)
- Navigate to another page, then tap play → previous page's notes crossfaded out by new play
- Drone is separate — has its own gain chain. `playScale()` on modes doesn't cancel drone.

**iOS Considerations**:
- AudioContext still needs first user gesture to create — `warmUpAudio()` in layout stays
- Background: iOS suspends AudioContext automatically; `resume()` on foreground return
- No `ctx.close()` ever called during app lifecycle

**Closes**: #86 (persistent AudioContext), #55 (BT first-play), #56 (Dynamic Island flicker)

---

## 4. Module Structure

### Current Problems
- `state.ts` is a god file (~400 lines mixing 5 concerns)
- `audio.ts` is ~580 lines of mixed concerns
- `engine.ts` has 4 duplicate pick/generate/distractor functions
- Definition files (intervals.ts, chords.ts, scales.ts) mix data with state-query helpers
- No clear dependency direction between modules

### New Structure

```
src/lib/
├── audio/
│   ├── context.ts          # Singleton AudioContext, master gain, analyser
│   ├── synths.ts           # Tone generators (epiano, sine, piano)
│   ├── playback.ts         # playInterval, playChord, playScale, playNote, chime
│   ├── drone.ts            # Drone lifecycle
│   ├── session.ts          # Media session, iOS audio session, visibility
│   └── index.ts            # Re-exports
│
├── state/
│   ├── schema.ts           # UserStateV4 type + version constant
│   ├── defaults.ts         # createDefaultState()
│   ├── storage.ts          # load/save from localStorage
│   ├── migration.ts        # v3→v4 migrator chain
│   ├── progression.ts      # Tier unlock logic (all content types, unified)
│   ├── stats.ts            # Aggregate helpers, accuracy calculations
│   └── index.ts            # Re-exports
│
├── quiz/
│   ├── controller.ts       # State machine, session flow, timing
│   ├── types.ts            # QuizSessionConfig, UnifiedQuestion, ChoiceItem
│   ├── configs/
│   │   ├── intervals.ts    # Config factory for interval quiz
│   │   ├── chords.ts       # Config factory for chord quiz
│   │   ├── scales.ts       # Config factory for scale quiz
│   │   ├── modes.ts        # Config factory for mode quiz
│   │   └── adaptive.ts     # Config factory for mixed adaptive
│   └── index.ts
│
├── learning/
│   ├── engine.ts           # Unified pick + distractor generation (generic)
│   ├── sm2.ts              # SM-2 calculations
│   ├── connections.ts      # Cross-content relationships
│   └── index.ts
│
├── definitions/
│   ├── intervals.ts        # IntervalDef[] — pure data, no state logic
│   ├── chords.ts           # ChordDef[] + applyInversion()
│   ├── scales.ts           # ScaleDef[]
│   ├── modes.ts            # ModeDef[]
│   └── index.ts
│
├── features/
│   ├── gate.ts             # Feature flag registry + access API
│   └── index.ts
│
├── theme.ts                # Unchanged
└── version.ts              # Unchanged
```

### Dependency Rules
- **definitions/** → imports nothing from src/lib (pure data)
- **learning/** → imports from definitions/ only
- **state/** → imports from definitions/, learning/ (for migration/progression)
- **audio/** → imports nothing from src/lib (receives params, plays sound)
- **quiz/** → imports from state/, learning/, audio/, definitions/
- **features/** → imports nothing (self-contained registry)
- No circular dependencies. Strict unidirectional flow.

---

## 5. Feature Gate System

### Design

Plumbing for future Pro/Free split. v4.0 ships with an empty registry (everything defaults to `free` + `enabled`). Actual gating decisions deferred to monetization sprint.

```typescript
// features/gate.ts

type FeatureId =
  | 'content:chords'
  | 'content:scales'
  | 'content:modes'
  | 'content:adaptive'
  | 'quiz:session_length_30'
  | 'lab:ascii'
  | 'settings:tone_piano'
  | string;                    // extensible

type Tier = 'free' | 'pro';

interface FeatureFlag {
  id: FeatureId;
  tier: Tier;                  // minimum tier required
  enabled: boolean;            // kill switch — can disable for everyone
  devOverride?: boolean;       // devMode bypasses tier check
}

// Registry — single source of truth
const FLAGS: FeatureFlag[] = [
  // v4.0: everything free + enabled. Edit this array to gate features.
];

// Public API
function canAccess(id: FeatureId, userTier: Tier, devMode: boolean): boolean;
function isProFeature(id: FeatureId): boolean;
function getAvailableFeatures(userTier: Tier): FeatureId[];
```

### UI Component

```svelte
<!-- LockedCard.svelte — placeholder for gated content -->
<LockedCard feature="content:modes" />
```

Renders a styled locked indicator when `canAccess()` returns false. Exact design TBD in monetization sprint.

---

## 6. Testing Strategy

### Phase 0 — Snapshot Current Behavior (before any refactor)

All tests written against current codebase on `main`. This is the regression safety net.

**State & Migration:**
- `loadState()` with empty localStorage → valid defaults
- `loadState()` with v3 data → all fields present and correct
- `saveState()` → `loadState()` roundtrip preserves data
- Tier unlock thresholds: intervals (tiers 2-5), chords (tiers 2-4), scales (tiers 2-3), modes
- Edge cases: corrupt JSON, partial state, missing fields, unknown keys

**Engine:**
- `generateQuestion()` only returns unlocked/enabled intervals
- `generateChordQuestion()` respects voicing settings
- `generateScaleQuestion()` / `generateModeQuestion()` same
- Distractors always unique, always 3 (or max available)
- Weighted pick favors weak items (statistical test, N=1000)
- Root note stays within MIDI range bounds per direction

**SM-2:**
- Response quality mapping (correct/wrong × replays × response time)
- Ease factor never drops below 1.3
- Interval calculation at quality levels 1-5
- Edge: 0 attempts, first attempt

**Adaptive:**
- `buildAllItems()` only includes unlocked + enabled, respects enabledModes/Voicings
- `pickNextItem()` weights: weakness > overdue > new > connection
- `recordAdaptiveAnswer()` updates stats correctly
- `migrateToAdaptive()` converts all legacy state
- `findNeighbor()` picks musically close, different-defId items

**Audio (unit-level, mocked AudioContext):**
- `playInterval` / `playChord` / `playScale` create correct oscillator configs
- Generation-based mute: new play ramps previous gain to 0
- Drone start → stop lifecycle, mute/unmute

**Browser QA (Palm, post-refactor):**
- Full regression on staging: all 5 quiz types
- iOS Safari + Chrome desktop
- Audio plays on first tap (BT headset test)
- No Dynamic Island flicker
- Page navigation doesn't cut audio
- Debrief screen shows correct stats
- Progress page reflects session results
- Settings persist across reload

---

## 7. Implementation Phases

All work on branch `feat/v4-rearch`. Merged to main only when all tests pass + Palm QA signs off on staging.

### Phase 0 — Test Scaffold (~1-2 days)
- Write snapshot tests against current codebase
- Ensure all pass on current `main`
- Commit test files

### Phase 1 — Data Model (~1 day)
- Create `src/lib/state/` module structure
- Define `UserStateV4` schema in `schema.ts`
- Write v3→v4 migrator in `migration.ts`
- Move defaults, storage, progression, stats into their modules
- Update all imports across codebase
- All Phase 0 tests pass (migration tests updated for new shape)

### Phase 2 — Definitions & Learning (~0.5 day)
- Move definition data to `src/lib/definitions/`
- Move engine + SM-2 + connections to `src/lib/learning/`
- Unify pick/distractor logic into single generic functions parameterized by content kind
- All engine tests pass

### Phase 3 — Audio (~1 day)
- Create `src/lib/audio/` module structure
- Implement persistent AudioContext in `context.ts`
- Implement generation-based playback cancellation in `playback.ts`
- Extract drone to `drone.ts`
- Move media session / visibility to `session.ts` + `+layout.svelte`
- Remove all per-page audio lifecycle code
- Audio tests pass

### Phase 4 — Quiz Controller (~1-2 days)
- Build `src/lib/quiz/controller.ts` state machine
- Build `<QuizSession>` Svelte component with shared UI
- Create config factories in `quiz/configs/` for each content type
- Rewrite all 5 quiz routes as thin shells
- All quiz behavior tests pass
- Manual verification: identical UX to current

### Phase 5 — Feature Gate Plumbing (~0.5 day)
- Create `src/lib/features/gate.ts` with API + empty registry
- Create `<LockedCard>` placeholder component
- No behavioral change

### Phase 6 — Cleanup & QA (~1 day)
- Delete all dead code (old quiz pages, old audio functions, old state helpers)
- Version bump to v4.0
- Update `VERSION_STRING`
- README update with architecture overview
- Palm full regression pass on staging
- Deploy to production

### Total Estimate
~6-8 days of agent work.

---

## 8. Backlog (Post-v4.0)

Items from the design discussion, saved for future sprints:

- FRE/onboarding flow
- Actual Pro/Free content split decisions
- Unlock fairness improvements (per-item thresholds vs pooled)
- Pedagogy microcopy pass
- Guided listening tips
- Desktop two-column layout
- Labs as feature incubation space
- App Store preparation
- Cloud sync (Pro+ tier)

---

## 9. Risk Assessment

| Risk | Mitigation |
|------|-----------|
| localStorage migration corrupts user data | Phase 0 tests cover all migration paths; v3 data preserved until migration confirmed |
| Quiz behavior subtly changes | Snapshot tests capture exact timing, scoring, unlock thresholds |
| iOS audio regression | Dedicated audio unit tests + Palm QA on real iOS device |
| Scope creep during refactor | Foundation-only scope — no features, no visual changes |
| Agent coordination (5 agents) | Single branch, Moto coordinates, phases are sequential not parallel |
