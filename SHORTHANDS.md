# SHORTHANDS.md — Content ID Reference

Max 4 characters. Used in progress cards, quiz UI, and telemetry.

## Intervals (2 chars)
| ID | Name | Semitones |
|----|------|-----------|
| P1 | Unison | 0 |
| m2 | Minor 2nd | 1 |
| M2 | Major 2nd | 2 |
| m3 | Minor 3rd | 3 |
| M3 | Major 3rd | 4 |
| P4 | Perfect 4th | 5 |
| TT | Tritone | 6 |
| P5 | Perfect 5th | 7 |
| m6 | Minor 6th | 8 |
| M6 | Major 6th | 9 |
| m7 | Minor 7th | 10 |
| M7 | Major 7th | 11 |
| P8 | Octave | 12 |

## Chords (3-4 chars)
| ID | Name | Intervals |
|----|------|-----------|
| maj | Major | 0,4,7 |
| min | Minor | 0,3,7 |
| dim | Diminished | 0,3,6 |
| aug | Augmented | 0,4,8 |
| dom7 | Dominant 7th | 0,4,7,10 |
| maj7 | Major 7th | 0,4,7,11 |
| min7 | Minor 7th | 0,3,7,10 |
| dim7 | Diminished 7th | 0,3,6,9 |
| hd7 | Half-dim 7th | 0,3,6,10 |
| aug7 | Augmented 7th | 0,4,8,10 |

### Future chords
| ID | Name |
|----|------|
| sus2 | Suspended 2nd |
| sus4 | Suspended 4th |
| add9 | Added 9th |
| 6 | Major 6th |
| m6 | Minor 6th |

## Scales (3-4 chars)
| ID | Name | Tier |
|----|------|------|
| MAJ | Major | 1 |
| MIN | Natural Minor | 1 |
| MAJP | Major Pentatonic | 1 |
| HMIN | Harmonic Minor | 2 |
| MINP | Minor Pentatonic | 2 |
| BLU | Blues | 3 |
| WHL | Whole Tone | 3 |
| MMIN | Melodic Minor | 3 |

### Future scales (modes — Tier 4, needs drone)
| ID | Name |
|----|------|
| DOR | Dorian |
| MIX | Mixolydian |
| PHR | Phrygian |
| LYD | Lydian |
| LOC | Locrian |
| AEO | Aeolian |
