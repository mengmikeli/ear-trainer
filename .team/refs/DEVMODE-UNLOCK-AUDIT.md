# Dev Mode & Unlock Logic Audit

Generated: 2026-04-05  
Branch: `feat/s5.1-design-system`

---

## 1. Dev Mode Consistency Matrix

| Function / Derived | Checks devMode? | What devMode bypasses | Correct? |
|---|---|---|---|
| **gate.ts — `getUserTier`** | ✅ `settings.devMode` → returns `'pro'` | User tier → treated as Pro | ✅ |
| **gate.ts — `canAccess`** | ✅ `devMode && flag.devOverride !== false` → true | Pro gate for all features | ✅ |
| **content-access.ts — `isContentKindAvailable`** | ✅ Early return `if (devMode) return true` | Content kind mastery gates + Pro | ✅ |
| **progression.ts — `unlockIntervalTiers`** | ✅ via `canAccess(…, devMode)` | Pro gate on T3/T4 | ✅ (thresholds still apply) |
| **progression.ts — `unlockChordTiers`** | ✅ via `canAccess(…, devMode)` | Pro gate on T2-T4 | ✅ |
| **progression.ts — `unlockScaleTiers`** | ✅ via `canAccess(…, devMode)` | Pro gate on T2-T3 | ✅ |
| **progression.ts — `unlockModes`** | ✅ via `canAccess(…, devMode)` | Pro gate on modes | ✅ |
| **progression.ts — `getNextUnlockProgress`** | ✅ via `canAccess(…, devMode)` | Pro gate on next-tier display | ✅ |
| **intervals.ts — `getEnabledIntervalsV4`** | ✅ `if (devMode) return true` | Unlock + enabled checks | ✅ |
| **chords.ts — `getEnabledChordsV4`** | ✅ `if (devMode) return true` | Unlock + enabled checks | ✅ |
| **scales.ts — `getEnabledScalesV4`** | ✅ `if (devMode) return true` | Unlock + enabled checks | ✅ |
| **modes.ts — `getEnabledModesV4`** | ✅ `if (devMode) return MODES` | Unlock + enabled checks | ✅ |
| **adaptive.ts — `buildCandidates`** | ✅ per-kind `devMode` check | Unlock + enabled per kind | ✅ |
| **adaptive.ts — `generateDistractorsForKind`** | ✅ per-kind `devMode` check | Unlock + enabled for distractor pool | ✅ |
| **adaptive.ts — `getUnlockedKinds`** | ✅ via `isContentKindAvailable` | Content kind gates | ✅ |
| **adaptive.ts — `onAnswer`** | ❌ No devMode check | Nothing — stats always recorded | ✅ Correct — devMode should NOT bypass recording |
| **intervals.ts — `onAnswer`** | ❌ No devMode check | Nothing — stats always recorded | ✅ |
| **chords.ts — `onAnswer`** | ❌ No devMode check | Nothing — stats always recorded | ✅ |
| **scales.ts — `onAnswer`** | ❌ No devMode check | Nothing — stats always recorded | ✅ |
| **modes.ts — `onAnswer`** | ❌ No devMode check | Nothing — stats always recorded | ✅ |
| **+page.svelte — `activeContent`** | ✅ `if (devMode) return content` | Fallback-to-intervals logic | ✅ |
| **+page.svelte — `chordsUnlocked` etc.** | ✅ via `isContentKindAvailable` | Content kind mastery gates | ✅ |
| **progress/+page.svelte — `devUnlock`** | ✅ Forces `unlocked: true` | Display unlock status | ✅ |
| **progress/+page.svelte — toggle functions** | ✅ `!ds.unlocked && !state.settings.devMode` | Allows toggling locked items | ✅ |
| **progress/+page.svelte — mode card display** | ✅ `…unlocked \|\| state.settings.devMode` | Shows all modes | ✅ |
| **progress/+page.svelte — `canAccess` calls** | ✅ passes `devMode()` | Pro gate display | ✅ |
| **compat.ts — `isModeMastered` / `getMasteryLevel`** | ❌ Pure stat functions | Nothing — compute from stats only | ✅ N/A — these don't gate anything |

### Specific Checks

| Concern | devMode handled? | Notes |
|---|---|---|
| **Question picking** | ✅ All quiz configs bypass unlock+enabled | All items available as questions |
| **Distractor picking** | ✅ All quiz configs bypass unlock+enabled for pool | Full distractor pool |
| **Content kind availability** | ✅ `isContentKindAvailable` early return | All 4 content types shown |
| **Tier unlock progression** | ⚠️ Partially | Pro gates bypassed, but **thresholds still apply** — tiers aren't auto-unlocked |
| **Pro gate checks** | ✅ `getUserTier` returns 'pro' + `canAccess` devOverride | Full Pro access |
| **Stats recording** | ✅ No bypass — stats always recorded | Correct behavior |
| **UI display (home)** | ✅ All tiles shown + selectable | devMode skips fallback logic |
| **UI display (progress)** | ✅ `devUnlock()` + devMode checks | All items shown as unlocked |

---

## 2. Free User Walkthrough (no devMode, no Pro)

### Content tier structure

| Content | T1 (Free) | T2 | T3 | T4 |
|---|---|---|---|---|
| **Intervals** | P1, P5, P8 | M3, m3, P4 (Free) | M2, M6, m7, M7 (**Pro**) | m2, m6, TT, m9, M9, m10, M10 (**Pro**) |
| **Chords** | maj, min | dim, aug (**Pro**) | dom7, maj7, min7 (**Pro**) | dim7, hdim7, aug7, sus2, sus4, pow, add9, maj6 (**Pro**) |
| **Scales** | major, nat_min | maj_pent, min_pent (**Pro**) | harm_min, blues, whole, mel_min, chromatic, maj_blues, bebop (**Pro**) |
| **Modes** | ionian, aeolian (**Pro**) | dorian, mixolydian (**Pro**) | phrygian, lydian, locrian (**Pro**) |

### Step-by-step

**Step 1 — Fresh start:**
- Interval T1 unlocked: P1, P5, P8 (3 items)
- No chords, scales, or modes visible (content kind gates not met)
- Home page: only INTERVALS tile active; CRD/SCL/MOD tiles locked

**Step 2 — After ~15 questions at 70%:**
- Each T1 item needs ≥5 attempts at ≥70% (per-item mastery: `PER_ITEM_MIN_ATTEMPTS=5, PER_ITEM_MIN_ACCURACY=0.7`)
- With 3 T1 items, need 3/3 mastered (since `2/3 = 0.67 < 0.7` ratio threshold)
- Pooled total needs ≥10 questions at ≥70%
- **Interval T2 unlocks: M3, m3, P4** → now 6 intervals

**Step 3 — After bronze-mastering 3 intervals:**
- Bronze = ≥1 mode mastered per interval (10 attempts, 70% on ascending OR descending OR harmonic)
- Once `bronzeCount ≥ 3`: **SCALES tile appears** on home + progress
- Scale T1 (major, nat_min) playable
- Only 2 scales available — minimum enabled count = 2, can't disable either

**Step 4 — After bronze-mastering 5 intervals:**
- `bronzeCount ≥ 5`: **CHORDS tile appears**
- Chord T1 (maj, min) playable — pre-unlocked in definitions
- Only 2 chords available — minimum enabled count = 2

**Step 5 — Pro wall:**
- **Interval T3+** (M2, M6, m7, M7, m2, m6, TT, compounds): Pro-gated
- **Chord T2+** (dim, aug, all 7ths, sus, power): Pro-gated
- **Scale T2+** (pentatonics, harmonic minor, blues, etc.): Pro-gated
- **ALL modes**: Pro-gated

**Free user total content:** 6 intervals + 2 chords + 2 scales = **10 items**

**Step 6 — Can they get stuck?**
- **No hard stuck state.** They can always practice their 10 items.
- However, with only 2 chords and 2 scales, the experience is very limited.
- The quiz always has enough distractors (fallback fills from locked items if needed).
- No dead ends in progression — just a ceiling.

---

## 3. Pro User Walkthrough (no devMode, has Pro)

### Step 7 — Full unlock path

**Intervals:**

| Tier | Unlock requirement | Items unlocked | Cumulative |
|---|---|---|---|
| T1 | Pre-unlocked | P1, P5, P8 | 3 |
| T2 | ≥10 pooled Q at 70% + T1 per-item mastery (3/3 items, 5 att each at 70%) | M3, m3, P4 | 6 |
| T3 | ≥30 pooled Q at 70% + T2 per-item mastery (3/3 items, 5 att each) | M2, M6, m7, M7 | 10 |
| T4 | ≥60 pooled Q at 70% + T3 per-item mastery (3/4 items = 0.75 ≥ 0.7) | m2, m6, TT, m9, M9, m10, M10 | 17 |

**Chords (requires interval T2 unlocked as prerequisite):**

| Tier | Unlock requirement | Items | Cumulative |
|---|---|---|---|
| T1 | Pre-unlocked (available once bronzeCount ≥ 5) | maj, min | 2 |
| T2 | Interval T2 unlocked ✓ + ≥10 chord Q at 70% + T1 mastery (2/2) | dim, aug | 4 |
| T3 | **Interval T3 unlocked** + ≥30 chord Q at 70% + T2 mastery (2/2) | dom7, maj7, min7 | 7 |
| T4 | ≥60 chord Q at 70% + T3 mastery (3/3) | dim7, hdim7, aug7, sus2, sus4, pow, add9, maj6 | 15 |

**Scales:**

| Tier | Unlock requirement | Items | Cumulative |
|---|---|---|---|
| T1 | Pre-unlocked (available once bronzeCount ≥ 3) | major, nat_min | 2 |
| T2 | ≥10 scale Q at 70% + T1 mastery (2/2) | maj_pent, min_pent | 4 |
| T3 | ≥30 scale Q at 70% + T2 mastery (2/2) | harm_min, blues, whole, mel_min, chromatic, maj_blues, bebop | 11 |

**Modes (requires ALL scales unlocked + 60 scale Q at 70% + max-tier scale mastery):**

| Tier | Unlock requirement | Items | Cumulative |
|---|---|---|---|
| T1 | All scale T3 unlocked + 60 scale Q at 70% + T3 scale per-item mastery | ionian, aeolian | 2 |
| T2 | ≥10 mode Q at 70% + T1 mode mastery (2/2) | dorian, mixolydian | 4 |
| T3 | ≥30 mode Q at 70% + T2 mode mastery (2/2) | phrygian, lydian, locrian | 7 |

### Step 8 — When does each content type appear?

| Content | Appears when | Typical timing |
|---|---|---|
| **Intervals** | Always available | Immediately |
| **Scales** | bronzeCount ≥ 3 (3 intervals with ≥1 mode at 10att/70%) | ~30-40 mode-specific attempts |
| **Chords** | bronzeCount ≥ 5 (5 intervals at bronze) | ~50-60 mode-specific attempts |
| **Modes** | All T3 scales unlocked + 60 scale Q at 70% + scale T3 mastery + Pro | Very late — after significant scale investment |

### Step 9 — Cross-content dependencies

| Dependency | Mechanism | Working? |
|---|---|---|
| Interval T2 → Chord system | `unlockChordTiers` checks `intervalT2Unlocked` at top → returns early if false | ✅ No chord T2+ until interval T2 earned |
| Interval T3 → Chord T3 | Explicit check `intervalT3Unlocked` for tier === 3 | ✅ No 7th chords until m7/M7 intervals unlocked |
| Interval T4 → Chord T4 | **No explicit check** — only needs chord T3 unlocked | ⚠️ By design, but chord T4 (sus, power, add9) doesn't need compound intervals |
| All scales → Mode T1 | `unlockModes` checks all max-tier scales unlocked | ✅ |
| Scale mastery → Mode T1 | 60 scale Q at 70% + per-item mastery on max scale tier | ✅ |

### Step 10 — Can they access chord 7ths without practicing m7/M7?

**No.** Chord T3 (dom7, maj7, min7) explicitly requires interval T3 to be unlocked. Interval T3 includes m7 and M7. To unlock interval T3, the user must:
1. Have ≥30 pooled interval questions at ≥70%
2. Have per-item mastery on T2 (M3, m3, P4 all at 5 att/70%)

Once interval T3 is unlocked, m7 and M7 appear in the question pool. They don't need to be individually mastered before chord T3 — just available. This is by design: the gate ensures the user has progressed far enough in intervals to handle 7th chord content.

---

## 4. Dev Mode Walkthrough

### Step 11 — What's immediately available?

**Everything.**

| Layer | What happens |
|---|---|
| `getUserTier` | Returns `'pro'` |
| `canAccess` | Returns `true` for all features (devOverride) |
| `isContentKindAvailable` | Returns `true` for all 4 kinds (early return) |
| Quiz `getEnabled*V4` | Returns ALL definitions (bypasses unlock + enabled) |
| Quiz `buildCandidates` | Includes all items across all kinds |
| Quiz `generateDistractors*` | Draws from full definition pool |
| Home page tiles | All 4 content types unlocked + selectable |
| Home `activeContent` | Returns raw value without fallback (can reach adaptive quiz) |
| Progress page | All items shown via `devUnlock()` helper |

### Step 12 — Any content still locked?

**In state.definitions**: Yes — items remain locked in the persisted state. devMode doesn't mutate `state.definitions`. Tiers only unlock through normal progression thresholds.

**In practice**: No — every read path that checks unlock status has a devMode bypass. The user experiences everything as fully unlocked.

**One subtle gap**: `state.definitions` items stay locked, so if devMode is toggled OFF, the user reverts to their actual progression state. This is correct behavior — devMode is a viewport, not a mutation.

### Step 13 — Stats recording

**Stats are recorded normally in devMode.** ✅

- All `onAnswer` handlers write to `s.stats[statsKey]` unconditionally
- `checkTierUnlockV4` still runs, respects devMode for Pro gates → tiers CAN unlock through play
- SM2 scheduling (easeFactor, nextReview) updates normally
- Global stats (totalQuestions, streaks) update normally

This means: devMode play → real stats → real progression. Toggling devMode off reveals actual earned state plus any stats accumulated during dev play.

---

## 5. Issues Found

### 🔴 P1 — Progress page hides locked modes for Pro users

**File**: `src/routes/progress/+page.svelte`  
**Code**:
```svelte
{:else if state.definitions.modes[def.id]?.unlocked || state.settings.devMode}
```

**Problem**: For a Pro user (not devMode) who has unlocked modes via scale mastery, only tier 1 modes (Ionian, Aeolian) are visible. Tier 2-3 modes (Dorian, Mixolydian, Phrygian, Lydian, Locrian) are **completely invisible** — no card rendered at all.

**Contrast**: For intervals/chords/scales, all accessible items are shown regardless of unlock status (ContentCard handles locked display via the `unlocked` prop). For modes, the extra `?.unlocked` check hides them entirely.

**Fix**: Remove the unlock guard for modes, or show a locked ContentCard for not-yet-unlocked modes:
```svelte
{:else}
  {@const props = modeCardProps(def.id)}
  {#if props}
    <ContentCard {...props} ontoggle={toggleMode} onplay={playModePreview} playing={playingId === def.id} />
  {/if}
{/if}
```

### 🟡 P2 — `isContentKindAvailable` hardcodes `devMode=false` for mode Pro check

**File**: `src/lib/features/content-access.ts`  
**Code**:
```ts
if (kind === 'mode') {
  return anyModeUnlocked && bronzeCount >= 5 && canAccess('content:modes', userTier, false);
  //                                                                              ^^^^^
}
```

**Problem**: The `false` is technically safe because the early return catches devMode. But it's fragile — if someone refactors the early return, this line would incorrectly block devMode users from modes.

**Fix**: Pass actual devMode state:
```ts
const devMode = state.settings.devMode ?? false;
// early return...
if (kind === 'mode') {
  return anyModeUnlocked && bronzeCount >= 5 && canAccess('content:modes', userTier, devMode);
}
```

### 🟡 P2 — Adaptive quiz only reachable in devMode

**File**: `src/routes/+page.svelte`  
**Code**:
```ts
const activeContent = $derived(() => {
  const content = state?.settings?.activeContent ?? 'adaptive';
  if (devMode) return content;
  // ...
  if (content === 'adaptive') return 'intervals'; // ← always falls back
});
```

**Problem**: The adaptive quiz route (`/quiz`) exists and works, but non-devMode users can never reach it. When `activeContent` is `'adaptive'`, it maps to `'intervals'` for normal users. This may be intentional (WIP feature), but should be documented.

**Impact**: Low — the adaptive quiz combines all available content types, so for a user with only intervals it would behave identically to the interval quiz.

### 🟢 P3 — Per-item mastery ratio edge case with 3-item tiers

**File**: `src/lib/state/progression.ts`  
**Detail**: With `PER_ITEM_MIN_MASTERED_RATIO = 0.7` and 3-item tiers (interval T1, T2, T3; chord T1-T3 except T1 which has 2):

| Tier size | 70% threshold | Items needed |
|---|---|---|
| 2 items | 1.4 → 2/2 = 100% | Both must be mastered |
| 3 items | 2.1 → 3/3 = 100% | All must be mastered (since 2/3 = 0.67 < 0.7) |
| 4 items | 2.8 → 3/4 = 75% | 3 of 4 sufficient |
| 7 items | 4.9 → 5/7 = 71% | 5 of 7 sufficient |

**Impact**: For tiers with ≤3 items, the 70% ratio effectively requires 100% mastery. This makes small tiers harder to complete than intended. Not a bug per se, but the user experience is "master ALL items" even though the threshold suggests 70% would suffice.

### 🟢 P3 — Progress page telemetry doesn't account for devMode stats on locked items

**File**: `src/routes/progress/+page.svelte`  
**Detail**: When filtering stats by voicing/mode tab, the code checks `state.definitions.X[def.id]?.unlocked` to filter items. In devMode, items can accumulate stats while remaining locked in definitions. Switching to a filtered tab may undercount totals.

**Impact**: Minor — only affects devMode telemetry accuracy, and only in filtered views.

---

## Summary

| Category | Status |
|---|---|
| devMode question picking | ✅ Consistent |
| devMode distractor picking | ✅ Consistent |
| devMode content kind access | ✅ Consistent |
| devMode Pro gates | ✅ Consistent |
| devMode stats recording | ✅ Correct (not bypassed) |
| devMode UI home | ✅ Consistent |
| devMode UI progress | ⚠️ One gap (modes hidden for Pro users — P1) |
| Free user flow | ✅ No stuck states, clear Pro wall |
| Pro user flow | ✅ Full progression path works |
| Cross-content deps | ✅ interval→chord gates work correctly |
| Fragile code | ⚠️ Hardcoded devMode=false in content-access (P2) |
