# Design: Content Paths + Practice Sub-Home

## Vision
Replace linear tiers with themed learning paths. Users progress through musical contexts (Basic → Blues → Jazz → Advanced) instead of abstract tier numbers.

## Practice Sub-Home (`/quiz`)
Replaces current direct-to-quiz behavior. Same layout style as settings/progress.

```
PRACTICE
---

QUICK START          ← adaptive across all unlocked paths
---

PATHS
[BASIC]  [BLUES]  [JAZZ]  [ADVANCED]
---

BY TYPE
[INT]  [CRD]  [SCL]  [MODE]
```

## Content Paths

### BEGINNER (Free)
| Type | Items |
|------|-------|
| Intervals | P1, P5, P8, M3, m3, P4 |
| Chords | Major, Minor |
| Scales | Major, Natural Minor |
| **Total** | **10 items** |

### BLUES (Pro)
| Type | Items |
|------|-------|
| Intervals | m7, M2, TT |
| Chords | Dom7, Sus4, Power |
| Scales | Blues, Major Blues, Minor Pentatonic, Major Pentatonic |
| Modes | Mixolydian, Dorian |
| **Total** | **12 items** |

### JAZZ (Pro)
| Type | Items |
|------|-------|
| Intervals | M6, M7, m9, M9 |
| Chords | Maj7, Min7, Add9, Maj6, Dim, Aug |
| Scales | Bebop, Harmonic Minor, Melodic Minor |
| Modes | Lydian, Phrygian, Locrian |
| **Total** | **16 items** |

### ADVANCED (Pro)
| Type | Items |
|------|-------|
| Intervals | m2, m6, m10, M10 |
| Chords | Dim7, hDim7, Aug7, Sus2 |
| Scales | Whole Tone, Chromatic |
| Modes | Ionian, Aeolian (review in modal context) |
| **Total** | **12 items** |

## Unlock Flow
1. BEGINNER -- always available (free). Beginner content only.
2. BLUES -- unlocks when BEGINNER is mastered (or Pro). Includes BEGINNER + Blues content.
3. JAZZ -- unlocks when BLUES is mastered (or Pro). Includes BEGINNER + Blues + Jazz content.
4. ADVANCED -- unlocks when JAZZ started (or Pro). Includes EVERYTHING (all 50 items).
5. QUICK START -- mixes all unlocked path content adaptively
6. BY TYPE -- filters by content type across all unlocked paths

Paths are ADDITIVE -- each includes all previous path content plus its own new items. ADVANCED is the ultimate challenge with the full 50-item pool.

## Data Model Impact
- Replace `tier` field on definitions with `path` field ('beginner' | 'blues' | 'jazz' | 'advanced')
- Feature gates map to paths, not tier numbers
- Progression is path-based mastery
- Quiz configs can be path-scoped

## UX Flow
Home (Lissa hero + GO) → Practice sub-home → pick path or quick start → quiz

## Status
**Deferred to S6.** Current tier system ships as v4.3. This design will be implemented as a content + UX redesign sprint.
