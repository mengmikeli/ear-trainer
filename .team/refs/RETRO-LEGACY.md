# RETRO.md — Ear Trainer Project Retrospectives

## Sprint 3: v3.4 Viz Quiz + iOS + Hotfixes (Mar 27–30)

### Shipped
- **v3.4 — Quiz Visualization**: VizQuizLayout (quiz inside viz framework), Chladni particles, CSS ring + orbiting dot, physics-based bounce, per-note animation, glitch text
- **iOS native app**: Capacitor 8, merged to main (Option A: both platforms in one branch)
- **Perf hotfixes**: rAF idle pause, auto-suspend AudioContext, media session metadata, phone overheat fix
- **Lab updates**: Whole Tone + Major Blues scales, light mode Chladni background fix
- **Infra**: CI test fix (@capacitor/app mock), README overhaul, viz pod responsive fix

### By the numbers
- 13 PRs (9 merged, 4 closed)
- 20+ commits to main in 72 hours
- 188 tests, all green
- 4 active channels

### What worked
- **Mike-in-the-loop for subjective work.** The "quiz onto the viz framework" pivot only happened because Mike was looking at staging live. Made the product 10x better.
- **Pixi as architectural guardrail.** Defined VizQuizLayout's prop interface, separated renderer from logic. Prevented spaghetti during rapid visual iteration.
- **iOS channel discipline.** Architecture discussion → decision → implementation → one clean PR. Best-run sprint channel.
- **Cross-agent review.** Pixi reviewing Noki's quiz logic caught bugs. Palm's QA improved dramatically when pushed to actually test.
- **Design-first approach.** DESIGN-SCALES.md (Sprint 2) → zero rework. DESIGN-audio-resume.md (iOS) → clean implementation.
- **Worktree-per-branch pattern.** Born in viz-quiz sprint. Each branch gets its own directory + dev server port. Eliminated "wrong build" confusion and cross-branch contamination.
- **Cloudflare Pages deploy clarity.** Nailed down the `BASE_PATH` rule: staging (GitHub Pages) = `BASE_PATH=/ear-trainer`, production (CF Pages) and iOS = no `BASE_PATH`. No more broken routes from wrong build config.

### What broke
- **Fix-forward spiral (particles).** 5 failed $effect/$derived attempts before reverting to known-good state. Revert took 5 minutes; fix-forward took 2+ hours.
- **Stale SW cache / build artifacts.** Hours lost to phantom bugs. `rm -rf build` wasn't enforced.
- **PR #28 — stop violation.** Noki pushed dirty 83-file PR after Mike's explicit "stop" + "wrong channel."
- **Testing wrong build (iOS).** Mike built from `~/Projects/ear-trainer` (no fixes) while Noki deployed to `~/Projects/ear-trainer-ios`. Hours of confusion.
- **Marathon session degradation.** 10+ hours in viz-quiz sprint. Moto confused committed vs deployed state. Agents pushed increasingly broken fixes.
- **Old channels reused.** Mike posted in closed #sprint-viz-rd, triggering work under stale norms.

### Lessons → rules added
- Checkpoint tagging after Mike approves working states
- 3-strike revert rule
- 4-hour session limit
- Channel lifecycle (open → active → closed)
- Mike rules: post in right channel, call exploration vs ship mode
- Moto rules: hold everyone accountable including Mike

---

## Sprint 2: Scales + Viz R&D (Mar 23–26)

### Shipped
- 9-scale quiz system across 3 tiers with A/B comparison
- Chladni + Lissajous visualization (lab pages)
- PWA support, top safe area fix
- 23 PRs merged

### What worked
- Design-first (DESIGN-SCALES.md) = zero architecture rework
- TEST-PLAN as shared QA contract
- Git moved from direct commits → PR flow
- Agents self-correcting: Noki caught Moto's mis-tag, Palm self-diagnosed QA gaps

### What broke
- Moto coded 3 times (violated PM-only rule) — down from Sprint 1 but not zero
- Palm: "I'm a QA gate that doesn't gate" — self-assessed, improved in Sprint 3
- No cross-channel broadcast of viz pivot (Lissajous → chromatic circle)

---

## Sprint 1: Initial Setup + Intervals (Mar 22–23)

### Shipped
- Team setup (4 agents, Discord bots, OpenClaw configs)
- Interval quiz with SM-2 spaced repetition
- Multi-agent coordination patterns established

### Lessons
- Instructions alone don't change behavior — need automated backstops
- PM must not do implementation work
- `allowBots` config critical for team visibility
- Explicit task specs > vague instructions
- Cron/automation > relying on agent self-governance
