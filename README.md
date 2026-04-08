# LISSA

Ear training for musicians who want to hear better. LISSA teaches you to recognize intervals, chords, scales, and modes by sound — using adaptive quizzes and real-time Lissajous visualizations that show the math behind what you hear.

For instrumentalists, producers, music students, or anyone who wants to sharpen their ear. Start free with 10 items, unlock 50+ with Pro.

Built with SvelteKit 5 + Web Audio API. Runs on web and iOS.

## Features

- **Adaptive quiz engine** — SM-2 spaced repetition across 50 items (intervals, chords, scales, modes)
- **Lissajous visualizations** — real-time frequency ratio curves on every question
- **Tiered progression** — unlock new content by mastering what you have, not by grinding
- **First-run experience** — guided onboarding that teaches the loop in 30 seconds
- **Lab** — explore Lissajous patterns, Chladni figures, scales, and chords interactively
- **Free tier** — 10 items across 3 content types, no account required
- **Desktop + mobile** — responsive layout with sidebar nav on desktop, bottom nav on mobile

## Visual identity

Marathon "Graphic Realism" — industrial, high-contrast, inspired by Bungie's Marathon reboot and the Designers Republic. Custom type system: Maratype (display), Matrix Mono (UI/glyphs), BPdots (identifiers). No emoji, no rounded corners, no gradients.

## Stack

- **Framework:** SvelteKit 2 + Svelte 5 (runes mode)
- **Audio:** Web Audio API (oscillator synthesis, e-piano samples)
- **State:** localStorage with versioned migration
- **Tests:** Vitest (unit) + Playwright (E2E, 18 route smoke tests)
- **Mobile:** Capacitor 8 (iOS)
- **Deploy:** Cloudflare Pages (production), GitHub Pages (staging/PR previews)

## Quick start

```bash
npm install
npm run dev
```

## Test

```bash
npm test           # Unit tests (Vitest)
npm run test:e2e   # E2E tests (Playwright)
```

## iOS build

```bash
npm run build
npx cap sync ios
npx cap open ios   # Opens Xcode — build to device from there
```

## Deploy

- **Staging:** Auto-deploys from `main` via GitHub Pages
- **Production:** `npx wrangler pages deploy build --project-name=ear-trainer`
- **PR Preview:** Auto-generated at `mengmikeli.github.io/ear-trainer/pr/pr-{N}/`

## Project docs

See `.team/` for internal docs:

- `.team/PROJECT.md` — project config and deploy targets
- `.team/AGENTS.md` — team roles (Moto, Noki, Palm)
- `.team/SPRINTS.md` — sprint history and roadmap
- `.team/refs/VISUAL-IDENTITY.md` — design system, color palette, fonts, glyph inventory
- `.team/refs/ARCH-REVIEW-V4.2.md` — architecture review
- `.team/refs/SHORTHANDS.md` — content abbreviation reference
