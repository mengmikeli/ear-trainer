# QA Protocol — Ear Trainer

## When to QA
- **Every PR to main** — required before merge
- **Every staging deploy** — smoke test within 10 min
- **Production deploy** — full regression pass

## QA Checklist

### Smoke Test (every PR)
- [ ] `npm run build` — clean, no errors
- [ ] `npm test` — all tests pass
- [ ] Console — 0 JS errors on all routes
- [ ] Home page loads, GO button works
- [ ] Quiz completes (answer 3+ questions, verify feedback)
- [ ] Progress page loads with correct stats
- [ ] Settings page — all toggles functional
- [ ] Navigation — all bottom nav links work

### Chord System
- [ ] `/quiz/chords` — loads, BLK/ARP toggle works
- [ ] Chord answer feedback (correct/wrong/distractors)
- [ ] Chord debrief screen shows after session
- [ ] Progress page chord tab (requires dev mode ON)
- [ ] Home page INTERVALS/CHORDS switcher (requires dev mode ON)
- [ ] Settings — CHORD VOICINGS section present

### Lab / Visualization
- [ ] `/lab` — loads, Lissajous renders
- [ ] Interval selector — all 13 intervals switch correctly
- [ ] Header/footer metadata updates on switch
- [ ] Chladni particles visible and topology changes per interval
- [ ] LISSAJOUS/CHLADNI toggle buttons work
- [ ] Play button triggers audio-reactive pulse (interactive only)

### Viewport Testing
- [ ] Mobile (375×667) — no overflow, usable layout
- [ ] Desktop (1440×900) — centered, no horizontal scroll
- [ ] Light theme — all elements adapt

### Known Limitations
- **Headless browser**: Cannot verify audio playback, animation smoothness, or real-time FPS. These require interactive testing by a human reviewer.
- **Answer timing race**: Clicking the correct-answer button to advance occasionally auto-answers the next question. This is a known issue in both interval and chord quizzes.

## Reporting
- Post summary in main channel (text only, max 4-5 bullet points)
- Post screenshots in QA thread: `v3.1 — QA & Bug Reports`
- Tag `@Moto` when QA is complete
- Severity levels: 🐛 Bug (blocks release) / ⚠️ Issue (should fix) / 📝 Note (minor/cosmetic)

## Environments
| Env | URL | Deploy from |
|-----|-----|-------------|
| Dev | `localhost:5180` | `main` branch |
| Staging | `mengmikeli.github.io/ear-trainer` | GH Actions on push |
| Production | `hear.tasteful.work` | `scripts/deploy-production.sh` |
