# Content Hierarchy — Ear Trainer

## Design Principles
- Beginner → intermediate audience
- Hub and spoke: intervals are the foundation, other tracks branch independently
- Free tier includes one unlock moment (tier 1 → tier 2 intervals) to teach the mechanic
- Every tier has a pedagogical theme
- Content dependencies: interval skills unlock before the chords/scales that use them

## Intervals (4 tiers, 17 items)

| Tier | Items | Theme | Gate |
|------|-------|-------|------|
| 1 | P1, P5, P8 | Anchors — unison, fifth, octave | Free |
| 2 | M3, m3, P4 | Color — thirds + fourth, preps for chords | Free |
| 3 | M2, M6, m7, M7 | Steps + tension — scale movement, preps for 7th chords | Pro |
| 4 | m2, m6, TT, m9, M9, m10, M10 | The hard ones + compound intervals | Pro |

## Chords (4 tiers, 15 items)

| Tier | Items | Theme | Gate |
|------|-------|-------|------|
| 1 | Major, Minor | The two fundamental colors | Free |
| 2 | Diminished, Augmented | Tense / unstable | Pro |
| 3 | Maj7, Min7, Dom7 | Basic extensions (requires m7 + M7 intervals) | Pro |
| 4 | Sus2, Sus4, Power, Dim7, Half-dim7, Aug7, Add9, Maj6 | Ambiguous / modern + extended 7ths | Pro |

New items needed: Sus2, Sus4, Power chord, Dim7, Half-dim7, Aug7

## Scales (3 tiers, 11 items)

| Tier | Items | Theme | Gate |
|------|-------|-------|------|
| 1 | Major, Natural Minor | The two fundamentals | Free |
| 2 | Major Pentatonic, Minor Pentatonic | Pattern-based, common | Pro |
| 3 | Harmonic Minor, Blues, Whole Tone, Melodic Minor, Chromatic, Major Blues, Bebop | Character scales | Pro |

New items needed: Whole Tone, Melodic Minor, Chromatic

## Modes (3 tiers, 7 items, all Pro)

| Tier | Items | Theme | Gate |
|------|-------|-------|------|
| 1 | Ionian, Aeolian | Major vs minor over drone | Pro |
| 2 | Dorian, Mixolydian | Popular jazz/rock modes | Pro |
| 3 | Phrygian, Lydian, Locrian | Distinctive colors | Pro |

Prerequisite: scale mastery (tier 2+ scales)

## Summary

| | Free | Pro | Total |
|---|---|---|---|
| Intervals | 6 | 11 | 17 |
| Chords | 2 | 13 | 15 |
| Scales | 2 | 9 | 11 |
| Modes | 0 | 7 | 7 |
| **Total** | **10** | **40** | **50** |

Free: 10 items with one unlock moment
Pro: 40 items ($4.99 one-time)
Ratio: 4.0:1 Pro-to-free

## Cross-content dependencies

These are enforced in `progression.ts`:

```
Intervals Tier 2 (M3, m3) ──→ Chords Tier 1 (Major, Minor)   [enforced: unlockChordTiers gate]
Intervals Tier 3 (m7, M7) ──→ Chords Tier 3 (7th chords)     [enforced: per-tier gate in loop]
Scales Tier 2+ ──────────────→ Modes Tier 1                   [enforced: unlockModes prerequisite]
```

Free users experience: intervals → unlock tier 2 → try chords + scales → hit Pro wall at depth
