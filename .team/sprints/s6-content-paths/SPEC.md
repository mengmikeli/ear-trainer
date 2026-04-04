# Sprint: S6 — Content Paths

## Goal
Replace linear tiers with themed learning paths (BEGINNER/BLUES/JAZZ/ADVANCED). Add Practice sub-home page for path selection.

## Content Packs

### BEGINNER (Free, 10 items)
- Intervals: P1, P5, P8, M3, m3, P4
- Chords: Major, Minor
- Scales: Major, Natural Minor

### BLUES/ROCK (Pro, 12 new = 22 cumulative)
- Intervals: m7, M2, TT
- Chords: Dom7, Sus4, Power
- Scales: Blues, Major Blues, Minor Pent, Major Pent, Dorian, Mixolydian

### JAZZ (Pro, 15 new = 25 cumulative)
- Intervals: M6, M7, m9, M9
- Chords: Maj7, Min7, Add9, Maj6, Dim, Aug
- Scales: Bebop, Harmonic Minor, Melodic Minor, Lydian, Phrygian

### ADVANCED (Pro, all 50)
- Everything above
- Plus: m2, m6, m10, M10, Dim7, hDim7, Aug7, Sus2, Whole Tone, Chromatic, Locrian
- Plus: all 7 modes OVER DRONE (Ionian, Aeolian, Dorian, Mixolydian, Phrygian, Lydian, Locrian)

## Pack Rules
- Packs are ADDITIVE (BLUES includes BEGINNER content, JAZZ includes BEGINNER, etc.)
- BLUES and JAZZ are PARALLEL (independent, both include BEGINNER)
- ADVANCED includes EVERYTHING
- Pro purchase unlocks all packs at once
- No mastery gates between packs

## Practice Sub-Home (`/quiz`)
Replaces current adaptive quiz route. Same layout as settings/progress.

Sections:
1. QUICK START — adaptive across all unlocked content
2. PATHS — BEGINNER, BLUES/ROCK, JAZZ, ADVANCED cards (locked ones show PRO badge)
3. BY TYPE — Intervals, Chords, Scales, Modes (existing content switcher style)

Selecting a path starts quiz with that pack's content filter.
Selecting a type starts quiz filtered to that content type across all unlocked packs.

## Data Model Changes
- Add `pack` field to all definitions: 'beginner' | 'blues' | 'jazz' | 'advanced'
- Add Dorian/Mixolydian back to scales (removed in v4.3, re-added for blues pack)
- Add Lydian/Phrygian to scales (new, for jazz pack)
- Add Locrian to scales (new, for advanced pack)
- Feature gates: replace tier-based gates with pack-based gates
- Remove `tier` field from definitions (replaced by `pack`)

## Execution model
Subagent swarm — sequential, well-specified.

## Done when
- [ ] All definitions have `pack` field
- [ ] Practice sub-home renders with path cards + type filter
- [ ] Quick Start works (adaptive across unlocked packs)
- [ ] Pack selection filters quiz content correctly
- [ ] Pro gate on BLUES/JAZZ/ADVANCED packs
- [ ] BEGINNER free, no gate
- [ ] Dorian/Mixolydian/Lydian/Phrygian/Locrian in scales definitions
- [ ] All tests pass, build clean
- [ ] Deploy verified
