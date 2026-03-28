# Ear Trainer

Adaptive ear training web app for intervals, chords, and scales.

**Live:** [hear.tasteful.work](https://hear.tasteful.work) | **Staging:** [mengmikeli.github.io/ear-trainer](https://mengmikeli.github.io/ear-trainer/)

## Features

- **Interval Quiz** — 13 intervals across 5 tiers, ascending/descending/harmonic modes
- **Chord Quiz** — Major, Minor, Dim, Aug + 7th chords with voicing inversions
- **Scale Quiz** — 8 scales across 3 tiers with A/B comparison
- **SM-2 Spaced Repetition** — adaptive question selection based on mastery
- **Visualization** — Chladni particle patterns synced to audio, Lissajous ring with per-note bounce
- **Lab** — Interactive visualization sandbox for intervals, chords, and scales
- **PWA** — Installable, works offline

## Stack

- SvelteKit + Web Audio API + localStorage (no backend)
- Cloudflare Pages (production) + GitHub Pages (staging)
- Marathon "Graphic Realism" aesthetic — Designers Republic inspired

## Development

```sh
npm install
npm run dev -- --port 5173
```

## Deploy

```sh
# Staging (GitHub Pages)
BASE_PATH=/ear-trainer npm run build && npx gh-pages -d build

# Production (Cloudflare Pages)
npm run build && npx wrangler pages deploy build --project-name ear-trainer
```

## Architecture

- `src/lib/` — Audio engine, SM-2 algorithm, quiz logic, visualization math
- `src/components/` — VizQuizLayout, AnswerGrid, ProgressBar, BottomNav
- `src/routes/quiz/` — Interval, chord, and scale quiz pages
- `src/routes/lab/` — Visualization sandbox pages
