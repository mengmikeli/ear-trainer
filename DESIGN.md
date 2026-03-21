# Ear Trainer — Design Spec

**Date:** 2026-03-18
**Status:** Draft
**Author:** Moto + Mike

---

## Overview

An adaptive interval ear training web app that progressively teaches users to identify musical intervals. Starts with multiple choice, graduates to freeform input as skill improves. Visual identity inspired by Marathon's "Graphic Realism" art style — high-contrast, industrial, maximum minimalist.

## Goals

- Help musicians develop interval recognition from scratch to advanced
- Adapt difficulty to the user's actual performance (no manual level selection)
- Ship a focused MVP (multiple choice only), designed to extend to freeform input in phase 2
- Look and feel like a sleek training terminal, not an edu-tech toy

## Non-Goals (MVP)

- No backend / user accounts (all state in localStorage)
- No freeform piano input (phase 2)
- No chord identification (future feature)
- No social features / leaderboards

---

## Platform & Stack

- **SvelteKit** — single-page app, static build, no server required
- **Web Audio API** — synthesized tones (sine wave + piano envelope)
- **localStorage** — all user progress persisted client-side
- **Mobile-responsive** — mobile-first layout, max-width ~480px centered on desktop
- **Deployment:** any static host (Vercel, Netlify, GitHub Pages)

---

## Core Mechanic — Interval Identification

### Flow

1. User taps "Play" → hears two notes (an interval)
2. User taps "Replay" to hear again (unlimited, no penalty)
3. User selects an answer:
   - **Choice mode (MVP):** 4 buttons — 1 correct + 3 distractors from unlocked pool
   - **Freeform mode (phase 2):** mini piano keyboard, tap the second note
4. Immediate feedback:
   - ✅ Correct: green flash, short chime, auto-advance after 1s
   - ❌ Wrong: red flash, show correct answer, "Hear it again" option, advance after 2s
5. Progress bar updates (e.g. 7/20)
6. After session: summary screen

### Sound Generation

- **Engine:** Web Audio API (OscillatorNode + GainNode envelope)
- **Tone modes:** sine wave (clean) or piano synthesis (oscillator + ADSR envelope)
- **Reference pitch:** A4 = 440Hz
- **Root note randomization:** C3–C6 range per question
- **Direction setting:** ascending / descending / random (user configurable)

---

## Adaptive Engine

### Interval Progression (Unlock Tiers)

| Tier | Intervals | Unlock Condition |
|------|-----------|------------------|
| 1 (start) | Unison (P1), Perfect 5th (P5), Octave (P8) | Unlocked by default |
| 2 | Major 3rd (M3), Perfect 4th (P4) | Tier 1 all ≥80% over 10+ attempts |
| 3 | Minor 3rd (m3), Major 6th (M6) | Tier 2 all ≥80% over 10+ attempts |
| 4 | Minor 7th (m7), Major 2nd (M2) | Tier 3 all ≥80% over 10+ attempts |
| 5 | Minor 6th (m6), Major 7th (M7), Minor 2nd (m2), Tritone (TT) | Tier 4 all ≥80% over 10+ attempts |

### Question Selection Algorithm

1. Pick from unlocked intervals only
2. Weight by weakness — lower accuracy intervals get picked more often
3. SM-2 scheduling layer — intervals "due" for review get priority
4. Newly unlocked intervals get an introduction phase (3 guaranteed easy rounds with hints)

### SM-2 Adaptation

Each interval tracks:
- `attempts` / `correct` — running counts
- `easeFactor` — SM-2 ease (starts at 2.5, adjusts per response quality)
- `nextReview` — timestamp for next scheduled review
- `streak` — consecutive correct answers

Response quality mapping:
- Correct on first listen → quality 5
- Correct after replay → quality 4
- Correct but slow (>5s) → quality 3
- Wrong → quality 1

### Mode Graduation (Phase 2)

- Interval hits 90% accuracy over 20+ attempts in choice mode → graduates to freeform
- Freeform accuracy drops below 60% → temporary fallback to choice mode

### Session Structure

- Default: 20 questions per session
- Configurable: 10 / 20 / 30
- User can quit anytime — progress saves per-question
- End-of-session summary: accuracy, new unlocks, weak spots highlighted

---

## Data Model

```typescript
interface IntervalState {
  interval: string;        // e.g. "P5", "m3", "TT"
  mode: "choice" | "free"; // current mode
  unlocked: boolean;
  attempts: number;
  correct: number;
  easeFactor: number;      // SM-2 (default 2.5)
  nextReview: number;      // timestamp ms
  streak: number;
  lastSeen: number;        // timestamp ms
}

interface UserState {
  intervals: Record<string, IntervalState>;
  settings: Settings;
  stats: GlobalStats;
}

interface Settings {
  toneType: "sine" | "piano";
  direction: "ascending" | "descending" | "random";
  sessionLength: 10 | 20 | 30;
}

interface GlobalStats {
  totalSessions: number;
  totalQuestions: number;
  currentStreak: number;   // consecutive days practiced
  bestStreak: number;
  lastPractice: number;    // timestamp ms
}
```

Persisted as JSON in `localStorage` under a single key.

---

## Screens

### 1. Home

- App name / logo (industrial, typographic)
- Today's streak count
- Overall accuracy percentage
- Big "Practice" button (center)
- Bottom nav: **Practice** | **Progress** | **Settings**

### 2. Quiz (Practice)

- Top: progress bar (question N / total)
- Center: large "Play" button (🔊) + "Replay" button
- Below: 4 answer buttons (choice mode) or mini piano (freeform, phase 2)
- Immediate feedback overlay on answer
- "End session" (X) button — top corner

### 3. Progress

- All 13 intervals listed
- Locked intervals: greyed out with 🔒
- Each unlocked interval shows: accuracy %, attempt count, bar visualization
- Tier progress indicator — how close to next unlock
- Global stats: total sessions, streaks

### 4. Settings

- Tone type: sine / piano
- Direction: ascending / descending / random
- Session length: 10 / 20 / 30
- Reset progress (with confirmation dialog)

---

## Visual Design — Marathon "Graphic Realism"

### Principles

Inspired by Bungie's Marathon reboot art direction and the Designers Republic aesthetic (Warp Records, Wipeout). The app feels like a training interface from a fictional audio corporation — not an educational toy.

- **Maximum minimalist** — every element earns its place, generous negative space
- **High-contrast color blocking** — limited palette, bold statements
- **Clean geometric forms** — flat, no gradients, no skeuomorphism
- **Industrial typography** — bold sans-serif, tight tracking, interval labels styled as equipment designations
- **Branded aesthetic** — subtle version numbers, grid lines, decals. The app has an identity.
- **Precision motion** — sharp transitions, clean fades. Things snap. No bouncy/playful animation.

### Color Palette

- **Base:** deep charcoal (#0A0A0A) — not pure black
- **Surface:** dark grey (#1A1A1A) for cards/panels
- **Text:** off-white (#E8E8E8) primary, mid-grey (#666) secondary
- **Accent:** single saturated color (e.g. electric blue #00D4FF or hot orange #FF5722) — used for interactive elements, highlights
- **Feedback:** green (#00FF88) for correct, red (#FF3355) for wrong — high saturation, brief flash

### Typography

- **Primary:** Inter, Barlow, or similar geometric sans-serif
- **Weight:** Bold (700) for headings/labels, Medium (500) for body
- **Tracking:** tight (-0.02em) for headings, normal for body
- **Interval labels:** monospaced or tabular, styled as technical designations
- **Sizing:** large tap targets, minimum 16px body text

### Layout

- Dark background, content in contained panels/blocks
- Generous padding, clear visual hierarchy
- Grid lines or subtle dot patterns as background texture (optional)
- Mobile-first, single column, centered max-width ~480px

---

## Phase 2 Additions (Post-MVP)

- **Freeform input mode** — mini piano keyboard for answering
- **Mode graduation** — automatic switch from choice → freeform per interval
- **Chord identification** — new exercise type using same adaptive engine
- **Sound library** — real instrument samples (piano, guitar, etc.)
- **Export/import progress** — JSON export for backup
- **PWA support** — installable, offline capable

---

## Open Questions

- Exact accent color choice — test a few options during implementation
- Whether to include ascending + descending in the same question or separate exercises
- Session "warm-up" mechanic — start each session with 2-3 easy intervals before adaptive kicks in?
