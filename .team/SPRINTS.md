# Sprint History — LISSA

| Sprint | Status | Version | Dates | Model |
|--------|--------|---------|-------|-------|
| v1-mvp | ✅ Done | v1.0 | Mar 21 | Single agent |
| v2-hud | ✅ Done | v2.0 | Mar 22 | Single agent |
| v3-chords | ✅ Done | v3.2 | Mar 24 | Multi-agent (Pixi + Noki) |
| v3.4-scales | ✅ Done | v3.4 | Mar 28 | Multi-agent (Pixi) |
| v4-rearch | ✅ Done | v4.0 | Mar 31–Apr 1 | Subagent swarm (25 tasks, 2.5h) |
| s5-release-polish | ✅ Done | v4.2 | Apr 1–7 | Hybrid (subagent + Noki + Moto) |
| **s6-content-paths** | 📋 Next | — | — | — |
| s7-visual-identity | 📋 Planned | — | — | — |

## Completed: S5 Release Polish (v4.2)

**Goal:** Make the free experience polished enough to justify a paywall.

**What shipped:**
- Content hierarchy redesign — intervals (4 tiers), chords (4 tiers + Sus2/Sus4/Power), scales (4 tiers + Dorian/Mixolydian), modes (3 tiers)
- Pro/Free gating — 10 free items across 3 content types, Pro unlocks 40+ more
- Per-item unlock fairness — thresholds replace pooled accuracy
- First-run experience — guided onboarding (2 scripted questions + progress teaser)
- Pedagogy microcopy — 50 listening tips, tap-to-expand labels
- Desktop layout — sidebar nav + two-column quiz at ≥768px
- Design system cleanup (~700 lines deduplication, shared components consolidated)
- Route smoke tests — 18 Playwright tests covering every route
- iOS build — Capacitor 8 synced and building

**Carried forward:** Home redesign (PR #100) abandoned — current home is final.

## Next: S6 Content Paths

Replace linear tiers with themed learning paths. See `sprints/s6-content-paths/SPEC.md`.

**Key changes:**
- BEGINNER (free, 10 items) → BLUES (Pro, +12) → JAZZ (Pro, +16) → ADVANCED (Pro, all 50)
- Practice sub-home at `/quiz` with path cards + type filters + Quick Start
- Paths are additive — each includes all previous content
- `tier` field → `pack` field on all definitions

## Planned: S7 Visual Identity + Rebrand

Path-colored quiz experience. See `sprints/s7-visual-identity/SPEC.md`.

- Each path gets its own accent color through the quiz flow
- Full LISSA rebrand across all surfaces
- BEGINNER = CyberAcme green, BLUES = NuCaloric pink, JAZZ = MIDA blue, ADVANCED = Traxus orange

## Backlog

See `sprints/backlog/` for deferred items:
- **Content paths** — detailed content pack breakdown (`content-paths.md`)
- **Sub-modes** — ascending/descending scales, modes over chord (`sub-modes.md`)
- **Adaptive quiz tuning** — difficulty curve refinement (`adaptive.md`)
- **Onboarding v2** — post-FRE retention (`onboarding.md`)
- **iOS App Store** — metadata, screenshots, TestFlight, Apple IAP
- **Cloud sync / accounts** — cross-device progress
