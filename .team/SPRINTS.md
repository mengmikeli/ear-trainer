# Sprint History — LISSA

| Sprint | Status | Version | Dates | Model |
|--------|--------|---------|-------|-------|
| v1-mvp | ✅ Done | v1.0 | Mar 21 | Single agent |
| v2-hud | ✅ Done | v2.0 | Mar 22 | Single agent |
| v3-chords | ✅ Done | v3.2 | Mar 24 | Multi-agent (Pixi + Noki) |
| v3.4-scales | ✅ Done | v3.4 | Mar 28 | Multi-agent (Pixi) |
| v4-rearch | ✅ Done | v4.0 | Mar 31–Apr 1 | Subagent swarm (25 tasks, 2.5h) |
| s5-release-polish | ✅ Done | v4.2 | Apr 1–7 | Hybrid (subagent + Noki + Moto) |
| s6-content-paths | ✅ Done | v4.2 | Apr 1–7 | Rolled into S5 |
| s7-visual-identity | ✅ Done | v4.2 | Apr 1–7 | Rolled into S5 |

## S5–S7 Summary (v4.2)

S6 (content paths) and S7 (path colors + LISSA rebrand) were implemented alongside S5 rather than as separate sprints.

**What shipped:**
- Content hierarchy redesign — intervals (4 tiers), chords (4 tiers + Sus2/Sus4/Power), scales (4 tiers + Dorian/Mixolydian), modes (3 tiers)
- Content paths — BEGINNER (free), BLUES, JAZZ, ADVANCED with pack-based definitions and cumulative filtering
- Practice sub-home (`/quiz`) — path cards, type filters, Quick Start adaptive
- Path-colored quiz — each pack has its own accent color (green/pink/lavender/orange)
- LISSA rebrand — SideNav, manifest, meta tags, FRE terminal
- Pro/Free gating — 10 free items, Pro unlocks 40+
- Per-item unlock fairness — thresholds replace pooled accuracy
- First-run experience — guided onboarding (2 scripted questions + progress teaser)
- Pedagogy microcopy — 50 listening tips, tap-to-expand labels
- Desktop layout — sidebar nav + two-column quiz at ≥768px
- Design system cleanup (~700 lines deduplication, shared components)
- Route smoke tests — 18 Playwright tests covering every route
- iOS build — Capacitor 8 synced and building

## Backlog

See `sprints/backlog/` for deferred items:
- **Sub-modes** — ascending/descending scales, modes over chord (`sub-modes.md`)
- **Adaptive quiz tuning** — difficulty curve refinement (`adaptive.md`)
- **Onboarding v2** — post-FRE retention (`onboarding.md`)
- **iOS App Store** — metadata, screenshots, TestFlight, Apple IAP
- **Cloud sync / accounts** — cross-device progress
- **Payment infrastructure** — Stripe / Apple IAP for Pro tier
