# Ear Trainer

An adaptive ear training app that teaches you to identify musical intervals, chords, and scales. Built for musicians who want to develop their ear — from beginner to advanced.

**Live:** [hear.tasteful.work](https://hear.tasteful.work) · **Staging:** [mengmikeli.github.io/ear-trainer](https://mengmikeli.github.io/ear-trainer/)

## What It Does

- **Interval Quiz** — 13 intervals across 5 difficulty tiers (P1/P5/P8 → tritones and minor 2nds). Ascending, descending, and harmonic modes.
- **Chord Quiz** — Triads (major, minor, dim, aug) and 7th chords with voicing inversions.
- **Scale Quiz** — 9 scales across 3 tiers with A/B comparison (hear reference → hear mystery → identify).
- **Adaptive Engine** — SM-2 spaced repetition selects questions based on your actual performance. Weak intervals come up more often. New content unlocks as you prove mastery.
- **Visualization Lab** — Chladni particle patterns synced to intervals, Lissajous ring with per-note bounce. Interactive sandbox for exploration.
- **PWA** — Installable on any device, works offline. All progress saved in localStorage.

## Design

Visual identity: Marathon "Graphic Realism" — high-contrast, industrial, [Designers Republic](https://en.wikipedia.org/wiki/The_Designers_Republic) inspired. Not an edu-tech toy.

No backend, no accounts, no sign-up. Open the app and start training.

## Stack

| Layer | Tech |
|-------|------|
| Framework | SvelteKit (static adapter) |
| Audio | Web Audio API (oscillator + ADSR envelope synthesis) |
| State | localStorage (JSON) |
| Adaptive | SM-2 spaced repetition + weakness weighting + tier unlocks |
| Visualization | Canvas 2D (Chladni patterns, Lissajous curves) |
| iOS | Capacitor 8 (same web app, native shell) |
| Production | Cloudflare Pages |
| Staging | GitHub Pages |

## Development

```sh
npm install
npm run dev -- --port 5173
```

### Tests

188 tests across 12 test files:

```sh
npm test           # watch mode
npm test -- --run  # single run
```

### Deploy

```sh
# Production (Cloudflare Pages)
npm run build
npx wrangler pages deploy build --project-name ear-trainer

# Staging (GitHub Pages)
BASE_PATH=/ear-trainer npm run build
npx gh-pages -d build
```

### iOS (Capacitor)

The same web app runs as a native iOS app via [Capacitor](https://capacitorjs.com/). The `ios/` directory contains the Xcode project and lives in main alongside the web code.

```sh
# Build web + sync to iOS
npm run build
npx cap sync

# Run on connected device
npx cap run ios --target <device-id>

# Open in Xcode (for debugging, signing, etc.)
npx cap open ios
```

Requires Xcode 15+ and an Apple Developer account for device deployment. Capacitor 8 with Swift Package Manager.

## Architecture

```
src/
├── routes/
│   ├── quiz/           # Interval, chord, scale quiz pages
│   │   ├── chords/
│   │   └── scales/
│   ├── lab/            # Visualization sandbox
│   │   ├── chords/
│   │   └── scales/
│   ├── progress/       # Mastery dashboard
│   └── settings/       # Preferences
├── lib/
│   ├── audio.ts        # Web Audio synthesis engine + iOS resume
│   ├── engine.ts       # Quiz engine (question selection, scoring)
│   ├── sm2.ts          # SM-2 spaced repetition algorithm
│   ├── intervals.ts    # Interval definitions + tier config
│   ├── chords.ts       # Chord definitions + voicings
│   ├── scales.ts       # Scale definitions + tier config
│   ├── mastery.ts      # Tier unlock logic
│   ├── state.ts        # localStorage persistence
│   ├── viz.ts          # Chladni + Lissajous math
│   └── viz-config.ts   # Visualization parameters
└── components/
    ├── VizQuizLayout   # Shared quiz page structure
    ├── AnswerGrid      # 4-choice answer buttons
    ├── ChladniCanvas   # Particle visualization
    ├── LissajousRing   # Ring visualization
    ├── BottomNav       # App navigation
    └── ...
ios/                    # Capacitor iOS project (Xcode)
capacitor.config.ts     # Capacitor configuration
```

### How the Adaptive Engine Works

1. **Tier system** — Content is gated behind tiers. You start with easy intervals (unison, P5, octave) and unlock harder ones as you prove ≥80% accuracy over 10+ attempts.
2. **SM-2 scheduling** — Each item tracks ease factor, next review date, and streak. Items due for review get priority.
3. **Weakness weighting** — Lower accuracy items are selected more frequently.
4. **Per-content tracking** — Intervals, chords, and scales each have independent progression. Mastering intervals doesn't affect chord difficulty.

## Design Docs

- [`DESIGN.md`](DESIGN.md) — Original spec (intervals, adaptive engine, visual identity)
- [`DESIGN-CHORDS.md`](DESIGN-CHORDS.md) — Chord system design
- [`DESIGN-SCALES.md`](DESIGN-SCALES.md) — Scale system design + A/B comparison rationale

## Known Limitations

- **Bottom safe area (iOS PWA)** — `env(safe-area-inset-bottom)` returns full toolbar height on initial load in standalone mode. WebKit bug, no clean workaround. Deferred.
- **Audio resume (iOS)** — WKWebView suspends AudioContext on background/lock. ~2s warm-up delay on resume. Future fix: native AVAudioEngine or visual "Resuming audio..." indicator.

## License

MIT
