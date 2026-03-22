# Ear Trainer v3 — Learning Content Series

## Roadmap

| Version | Focus | Status |
|---------|-------|--------|
| 3.0 | Play modes (ASC/DESC/HARM) + mastery system | ✅ Shipped |
| 3.1 | Tabbed progress, epiano tone, quiz polish | ✅ Dev complete |
| 3.2 | End-of-quiz summary, tone visualization | 🔧 In progress |
| 3.3 | Chords | Planned |
| 3.4 | Scales | Planned |

---

## 3.0 — Play Modes + Mastery (shipped)

- Three play modes: ascending, descending, harmonic
- Per-mode stats tracking with weakness-weighted selection
- Mastery system: Bronze / Silver / Gold per interval
- Harmonic audio (simultaneous playback)
- Mode indicator glyph on quiz bar
- Restored RadarGrid cover page

## 3.1 — Progress + Polish (dev complete)

- Tabbed progress page — ALL / ASC / DESC / HARM filter
- Electric piano tone (FM synthesis Rhodes)
- Skip arrow on correct answer card
- Smooth button transitions between quiz states
- EXIT button on quiz bar
- Zero-padded question counter
- Accurate release notes

## 3.2 — Summary + Visualization

### End-of-quiz summary screen
- Replaces immediate `goto('/')` after quiz ends
- Shows: overall accuracy, questions correct/total, per-mode breakdown
- Highlights: weakest intervals, new unlocks, mastery progress
- Actions: AGAIN (restart quiz) / HOME (go to cover)
- Marathon aesthetic: telemetry-style data readout

### Tone visualization (exploratory)
- Research directions:
  - **Waveform**: Real-time oscilloscope via `AnalyserNode.getByteTimeDomainData()`
  - **Frequency spectrum**: FFT bar chart via `AnalyserNode.getByteFrequencyData()`
  - **3D spectrogram**: freq × amplitude × time (Canvas/WebGL, heavier)
  - **Lissajous figures**: Plot two tones on x/y — consonant intervals = clean patterns
- Lissajous is the most Marathon-aesthetic and musically meaningful
- Scope TBD after summary screen is done

## 3.3 — Chords (planned)

- New content type: chord identification
- Major, minor, diminished, augmented (start with triads)
- Separate progression/unlock track from intervals
- Reuse mastery system (per chord, per inversion?)

## 3.4 — Scales (planned)

- New content type: scale identification
- Major, natural minor, harmonic minor, pentatonic, blues
- Separate progression track
- Possibly: "which note changed?" exercises

---

## Architecture notes

- `ToneType` = `'epiano' | 'sine' | 'piano'`
- `PlayMode` = `'ascending' | 'descending' | 'harmonic'`
- Per-mode stats in `IntervalState.modes`
- Mastery computed (derived), not stored
- 68 tests across 7 files
- Fonts: Matrix Mono (UI/glyphs), BPdotsUnicaseSquare (interval IDs), Maratype (display)
