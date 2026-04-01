# Sprint: S5 — Release Polish

## Goal
Make Ear Trainer's free experience polished enough to charge for. Ship the product that justifies a paywall — before adding the paywall itself.

## Scope

### Stream A — UX Polish

**1. First-Run Experience (FRE)**
- Welcome screen: app name, one-liner, "Let's try one" button
- Guided question 1: scripted P8, correct answer hinted → success feedback
- Guided question 2: scripted P5, no hints → correct = "natural", wrong = "you'll get faster"
- Progress teaser: show progress page with real data from guided session
- Handoff: "Ready? Your first real session starts now" → home page
- Total: ~30 seconds, teaches play→answer→feedback→progress
- FRE only shows once (flag in localStorage/state)

**2. Content Hierarchy Redesign**
- Intervals: collapse from 5 tiers → 4 (Anchors, Color, Steps+Tension, Hard)
- Chords: add Sus2, Sus4, Power chord (10 → 13 items)
- Scales: add Dorian, Mixolydian as scales (9 → 10 items, 3 → 4 tiers)
- Modes: restructure into 3 tiers (was 1 flat tier)
- Cross-content dependencies: interval thirds → chord major/minor, interval 7ths → 7th chords, scale mastery → modes
- See CONTENT-HIERARCHY.md for full breakdown

**3. Unlock Fairness**
- Replace pooled-accuracy progression with per-item thresholds
- Require minimum attempts per item before tier unlock
- Require X of Y items in a tier to be stabilized
- Respect cross-content dependencies from content hierarchy

**4. Desktop Layout**
- Two-column quiz layout (≥768px): viz/play on left, answer grid on right
- Sidebar navigation on desktop: replace bottom nav with left sidebar
- Debrief gets richer desktop layout
- Mobile layout unchanged

### Stream B — Value Proposition

**5. Pro/Free Content Split**
- Free: interval tiers 1-2 (6 items) + chord tier 1 (2) + scale tier 1 (2) = 10 items
- Pro: everything else (33 items, $4.99 one-time)
- Wire existing feature gate system
- LockedCard inline with "Unlock with Pro" button
- Mock purchase for now (real payment in S6)

**6. Pedagogy Microcopy**
- Explain what unlocks content (on home page, progress page)
- Show mastery requirements ("Practice 2 more intervals to unlock Chords")
- Brief listening tips when new content unlocks
- Label clarity: expand abbreviations on first encounter

## Out of scope
- Payment infrastructure (Stripe, Apple IAP) → S6
- App Store submission (Capacitor build, metadata) → S6
- Cloud sync / accounts → deferred
- Labs / design refresh → separate sprint
- New content beyond what's in CONTENT-HIERARCHY.md

## Execution model
**Hybrid** — Desktop layout (item 4) is creative/exploratory work suited for Noki. Content hierarchy, FRE, unlock fairness, feature gating, and microcopy are sequential/structured work suited for subagent swarm.

## Done when
- [ ] FRE works end-to-end on fresh install (iOS + Chrome)
- [ ] Content tiers match CONTENT-HIERARCHY.md (intervals 4 tiers, chords 4 tiers with new items, scales 4 tiers, modes 3 tiers)
- [ ] Unlock fairness: per-item thresholds, not pooled
- [ ] Desktop: two-column quiz + sidebar nav at ≥768px
- [ ] Free tier is playable and compelling (10 items across 3 content types)
- [ ] Pro gate shows on tier 3+ intervals, tier 2+ chords/scales, all modes
- [ ] Microcopy explains progression to a first-time user
- [ ] Palm QA: PASS on Chrome desktop + responsive
- [ ] Mike QA: PASS on iOS Safari
- [ ] All tests pass, build clean
- [ ] Deployed to staging for review
