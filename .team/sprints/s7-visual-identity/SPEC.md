# Sprint: S7 — Visual Identity + Lissa Rebrand

## Goal
Path-colored quiz experience + Lissa rebrand. Each learning path has its own visual identity through the quiz flow.

## Path Color System

Colors (from Practice sub-home):
- BEGINNER: #C2FE0C (CyberAcme green — same as current accent)
- BLUES/ROCK: #FF3399 (NuCaloric pink)
- JAZZ: #3388FF (MIDA blue)
- ADVANCED: #FF8800 (Traxus orange)
- By-type quizzes: keep current green accent (unchanged)

### What changes per path quiz:
- [x] Play button ring color
- [x] Correct feedback color
- [x] Orbit dot color
- [x] Debrief accent (score, telemetry highlights)
- [x] Progress bar fill color
- [x] Answer card highlight (try it, adjust if needed)

### What does NOT change:
- Quiz heading (stays current color)
- Wrong answer (stays red/hot)
- Base/surface/text colors
- Font system
- By-type quiz accent (stays green)

## Lissa Rebrand
- App title: "EAR TRAINER" → "LISSA" (discuss "ear trainer" placement)
- SideNav brand text
- FRE terminal messages
- Meta tags, manifest, media session
- Home page title

## Out of scope
- Home page redesign (current home is final)
- PR #100 (abandoned)
- New content or quiz mechanics

## Execution model
Subagent swarm — well-specified visual changes.

## Done when
- [ ] Path quizzes use path color for ring, feedback, orbit, debrief, progress bar
- [ ] By-type quizzes unchanged (green accent)
- [ ] Lissa name across all surfaces
- [ ] All tests pass, build clean
