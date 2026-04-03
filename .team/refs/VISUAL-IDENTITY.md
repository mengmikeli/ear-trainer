# Visual Identity — Lissa

*Formerly "Ear Trainer." Renamed to Lissa — short for Lissajous, the mathematical curves behind the app's visual identity. Also the name of the training AI who guides you.*

## Brand Name
**LISSA** — always uppercase in UI. Short for Lissajous. She's the AI, the brand, the voice of the terminal.

## Design Language
Marathon "Graphic Realism" — inspired by Bungie's Marathon reboot and the Designers Republic aesthetic (Warp Records, Wipeout). The app feels like a training interface from a fictional audio corporation, not an educational toy.

## Principles
- **Maximum minimalist** — every element earns its place, generous negative space
- **High-contrast color blocking** — limited palette, bold statements
- **Clean geometric forms** — flat, no gradients, no skeuomorphism
- **Industrial typography** — bold sans-serif, tight tracking, styled as equipment designations
- **Precision motion** — sharp transitions, clean fades. Things snap. No bouncy/playful animation.

## Color Palette
| Token | Hex | Use |
|-------|-----|-----|
| `--base` | #0A0A0A | Background (deep charcoal, not pure black) |
| `--surface` | #1A1A1A | Cards, panels |
| `--text-primary` | #E8E8E8 | Primary text |
| `--text-secondary` | #666666 | Secondary text |
| `--accent` | #C2FE0C | Interactive elements, highlights (neon green) |
| `--marathon-blue` | (check CSS) | Labels, borders, navigation active state |
| `--correct` | #00FF88 | Correct feedback |
| `--hot` | #FF3355 | Wrong feedback, errors |
| `--border-heavy` | #333333 | Card borders, dividers |

## Fonts
| Font | Use | Weight |
|------|-----|--------|
| **Maratype** | Display headings (EAR TRAINER, PRACTICE, DEBRIEF) | 400 |
| **Matrix Mono** | UI labels, counters, telemetry, ALL glyphs/icons | 700-900 |
| **BPdots** | Interval/chord/scale ID labels (P5, MAJ, etc.) | 900 |

### Font rules
- NO system fonts in UI (no -apple-system, no Segoe UI)
- NO standard Unicode emoji — use Matrix Mono PUA glyphs
- All UI text is uppercase unless it's a listening tip or description
- Tight letter-spacing on headings (-0.02em to 0.12em)
- Monospaced for all data/numbers

## Matrix Mono Glyph Inventory
Private Use Area characters available:

| Code | Glyph | Current use |
|------|-------|-------------|
| \uE000 | | Harmonic mode icon, glitch |
| \uE001-\uE006 | | Glitch characters |
| \uE007 | | Ascending mode icon |
| \uE008 | | Descending mode icon |
| \uE010 | | Glitch character |
| \uE011 | | Skip arrow (answer grid) |
| \uE012-\uE013 | | Correct glyphs |
| \uE014 | | Practice nav icon |
| \uE015 | | Settings nav icon |
| \uE016-\uE017 | | Wrong glyphs, glitch |
| \uE018-\uE019 | | Correct/wrong glyphs |
| \uE002 | | Progress nav icon |

**TODO:** Build full glyph map by rendering all PUA characters. Need to identify glyphs for: lock, check/pass, fail/cross, play triangle.

## What NOT to use
- ❌ Standard emoji (🔒, ✅, ❌, ⚠️, 🎵, etc.)
- ❌ Unicode symbols (✓, ✗, ⟳, ▶, ●, ○)
- ❌ System fonts
- ❌ Rounded corners (use sharp edges)
- ❌ Gradients or shadows
- ❌ Playful/bouncy animations
- ❌ Color outside the palette without explicit approval

## Component Patterns
- **Buttons:** flat, accent background or bordered, mono font, all caps
- **Cards:** dark surface, left accent bar (green = active, red = locked), no rounded corners
- **Banners:** ticker-scroll animation (TickerBanner component)
- **Labels:** mono font, all caps, tight spacing, accent or marathon-blue color
- **Toggles:** text-based (ARP, DRN), green active / gray inactive
- **Navigation:** bottom on mobile, sidebar on desktop. Mono font, glyph icons.

## Inspiration
- Marathon (Bungie) reboot art direction
- Designers Republic (Warp Records, Wipeout)
- Industrial control panels
- Military/aviation HUD displays

### References to review
- timeline.bumgie.org (Mike, 2026-04-01 — pending review)
- tauceti.world/explorer — Marathon fan project, excellent terminal HUD aesthetic. Acid green on black, wireframe globe as hero, full-width coordinate readout bars, color-blocked nav strip. (Noki, 2026-04-02)
- (add more as they come)
