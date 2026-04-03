# Frontend & Visual Identity Audit

*Generated 2026-04-03 by Moto · Drives the design system cleanup sprint*

---

## 1. Executive Summary

**Overall health: 6/10 — Functional but accumulating debt fast.**

The app's visual identity is strong in concept (Marathon "Graphic Realism" is distinctive and well-realized) but the implementation has drifted from the spec in several places, and organic growth has created significant duplication and inconsistency. The codebase feels like a fast prototype that's outgrown its scaffolding — it works, but every new component copy-pastes CSS rather than extending a shared system.

### Top 5 Issues (by impact)

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 1 | **Card component CSS duplication** — IntervalCard, ChordCard, ScaleCard, ModeCard share ~95% identical CSS (~120 lines each × 4) | Critical | Every card change requires 4 edits. Bugs guaranteed. |
| 2 | **System fonts in `--font` variable** — `'Inter', system-ui, -apple-system` violate VISUAL-IDENTITY.md | High | Body text renders in Inter/system fonts, not brand fonts. |
| 3 | **Color token drift** — `--base`, `--surface`, `--correct`, `--hot`, `--text-primary` all differ from VISUAL-IDENTITY.md | High | Design reference is out of sync with reality. |
| 4 | **No type scale or spacing scale** — 25+ unique font-sizes, 20+ unique spacing values, all ad-hoc | Medium | Inconsistent sizing across similar elements. |
| 5 | **~15 different button patterns** — no shared button component or utility classes | Medium | Visual inconsistency, high maintenance cost. |

---

## 2. Design Token Inventory

### 2.1 Colors

#### CSS Variables (`:root` in app.css)

| Token | Value | VI Spec | Match? |
|-------|-------|---------|--------|
| `--base` | `#000000` | `#0A0A0A` | ⚠️ **DIFFERS** — pure black vs deep charcoal |
| `--surface` | `#0D0D0D` | `#1A1A1A` | ⚠️ **DIFFERS** — darker than spec |
| `--surface-raised` | `#1A1A1A` | *(not in VI)* | ℹ️ Matches VI's `--surface` value |
| `--border` | `#1F1F1F` | *(not in VI)* | ℹ️ New token |
| `--border-heavy` | `#333333` | `#333333` | ✅ |
| `--accent` | `#C2FE0C` | `#C2FE0C` | ✅ |
| `--accent-dim` | `#C2FE0C15` | *(not in VI)* | ℹ️ New token |
| `--hot` | `#ED174F` | `#FF3355` | ⚠️ **DIFFERS** — Spanish crimson vs neon red |
| `--marathon-blue` | `#3A2CFF` | "(check CSS)" | ℹ️ VI defers to CSS |
| `--correct` | `#C2FE0C` | `#00FF88` | ⚠️ **DIFFERS** — now accent green, not mint green |
| `--wrong` | `#ED174F` | *(not in VI, implied = hot)* | ✅ Matches `--hot` |
| `--text-primary` | `#F0F0F0` | `#E8E8E8` | ⚠️ **DIFFERS** — slightly brighter |
| `--text-secondary` | `#666666` | `#666666` | ✅ |

**Verdict:** 5 of 12 color tokens differ from VISUAL-IDENTITY.md. Either the code or the spec needs updating — they must agree. Most likely the code is "correct" (evolved intentionally) and the VI doc is stale.

#### Hardcoded Colors (not using CSS variables)

| Color | Where | Should be |
|-------|-------|-----------|
| `#C2FE0C08` | app.css `.hazard-stripe` | `var(--accent)` with opacity |
| `#C2FE0C10` | AnswerGrid `.correct` | `var(--accent)` with opacity |
| `#ED174F10` | AnswerGrid `.wrong`, 4× card `.toggle-off`, settings buttons | `var(--hot)` with opacity |
| `#3A2CFF` | RadarGrid SVG `stroke` attribute | Should use CSS variable |
| `#3A2CFF10` | Settings `.toggle-group button.active` | `var(--marathon-blue)` with opacity |
| `rgba(194, 254, 12, 0.03)` | VizQuizLayout scanline flicker | `var(--accent)` with opacity |
| `rgba(194, 254, 12, 0.4)` | app.css `.interference` | `var(--accent)` with opacity |
| `rgba(237, 23, 79, 0.3)` | app.css `.interference` | `var(--hot)` with opacity |
| `rgba(58, 44, 255, 0.08)` | Progress `.tab.active` | `var(--marathon-blue)` with opacity |
| `#5A4CFF` | VizQuizLayout migrating particle | New token or derive from `--marathon-blue` |
| `#3A2CFF` | VizQuizLayout resting particle | `var(--marathon-blue)` |
| `#fff` | Home `.version-badge` | `var(--text-primary)` or new token |

#### Colors Outside VISUAL-IDENTITY Palette

| Color | Where | Purpose |
|-------|-------|---------|
| `#FFD700` | IntervalCard, ChordCard mastery dots | Gold mastery |
| `#C0C0C0` | IntervalCard, ChordCard mastery dots | Silver mastery |
| `#CD7F32` | IntervalCard, ChordCard mastery dots | Bronze mastery |
| `#FF6B2C` | Home page content type for Scales | Warm orange |
| `#9B59B6` | Home page content type for Modes | Deep purple |
| `#5A4CFF` | VizQuizLayout | Lighter marathon-blue variant |

**Recommendation:** Define `--mastery-gold`, `--mastery-silver`, `--mastery-bronze`, `--content-scales`, `--content-modes` as official palette extensions in both CSS and VISUAL-IDENTITY.md.

### 2.2 Fonts

#### Font Variables (app.css)

| Token | Value | VI Spec | Match? |
|-------|-------|---------|--------|
| `--font-display` | `'Maratype', 'Barlow Condensed', sans-serif` | Maratype | ⚠️ Fallback includes `sans-serif` |
| `--font` | `'Inter', system-ui, -apple-system, sans-serif` | *(not in VI)* | ❌ **VIOLATION** — VI says "NO system fonts in UI" |
| `--mono` | `'Matrix Mono', 'JetBrains Mono', monospace` | Matrix Mono | ⚠️ Fallback includes `monospace` |

**Critical issue:** The `--font` variable is the body default. All general text renders in Inter (a system-like font) which directly violates the visual identity. The VI specifies only Maratype (display), Matrix Mono (UI), and BPdots (IDs). There is no "body text" font in the VI — everything should be one of those three.

#### Font Usage by Component

| Component | Display (`--font-display`) | Mono (`--mono`) | BPdots (direct) | Body (`--font`) | Notes |
|-----------|---------------------------|-----------------|-----------------|-----------------|-------|
| app.css (body) | — | — | — | ✅ Default | Everything inherits Inter |
| SideNav | `.brand-title`, `.brand-accent`, `.nav-item` | `.icon`, `.sys-label` | — | — | ✅ Good |
| BottomNav | `a`, `.nav-item` | `.icon` | — | — | ✅ Good |
| QuizSession | `.heading`, `.missed-name` | Most UI elements | — | — | ✅ Good |
| AnswerGrid | `.name` | `.skip-arrow` | `.id` (direct) | — | ⚠️ BPdots has `'JetBrains Mono'` fallback, not `var(--mono)` |
| IntervalCard | `.name` | Most UI | `.id` (direct) | — | ⚠️ Same BPdots issue |
| ChordCard | `.name` | Most UI | `.id` (direct) | — | ⚠️ Same BPdots issue |
| ScaleCard | `.name` | Most UI | — | — | `.id` uses BPdots direct |
| ModeCard | `.name` | Most UI | — | — | `.id` uses BPdots direct |
| ProgressBar | — | `.label` | — | — | ✅ |
| TelemetryBar | — | `.tag`, `.val` | — | — | ⚠️ Inline fallbacks: `var(--mono, 'Matrix Mono', 'JetBrains Mono', monospace)` |
| TickerBanner | — | ✅ | — | — | ✅ |
| VizQuizLayout | — | — | — | — | No text |
| LockedCard | — | ✅ (all text) | — | — | ⚠️ Inline fallbacks |
| Home page | `.title` (display), `.char.resolved` (display) | Most UI | — | — | `.char` (unresolved) uses mono ✅ |
| Progress page | `.heading` (display) | `.tab`, stats | — | — | ✅ |
| Settings page | `.heading`, `.field-label` (display) | All buttons/labels | — | — | ✅ |

**BPdots inconsistency:** Card `.id` elements use `font-family: 'BPdots', 'JetBrains Mono', monospace` — the fallback should be `var(--mono)` or at minimum `'Matrix Mono', monospace`. Having `JetBrains Mono` as direct fallback is an artifact.

**Missing `--font-id` token:** BPdots is used in 5+ components but has no CSS variable. Should define `--font-id: 'BPdots', var(--mono)`.

### 2.3 Font Sizes (Complete Inventory)

**25 unique `font-size` values found.** Grouped by approximate role:

| Role | Sizes Used | Count |
|------|-----------|-------|
| **Micro labels** | `0.3rem`, `0.35rem` | 2 |
| **Small UI** | `0.4rem`, `0.45rem` | 2 |
| **Body/labels** | `0.5rem`, `0.55rem`, `0.6rem`, `0.65rem` | 4 |
| **Medium UI** | `0.7rem`, `0.75rem`, `0.8rem`, `0.85rem` | 4 |
| **Icons** | `1.1rem`, `1.25rem`, `1.4rem` | 3 |
| **Feature text** | `1.5rem`, `1.6rem`, `1.8rem` | 3 |
| **IDs/scores** | `2rem`, `2.5rem`, `3rem`, `3.5rem` | 4 |
| **Hero** | `4rem`, `5rem` | 2 |
| **Base** | `16px` (html) | 1 |

**Problem:** No defined type scale. Similar elements use different sizes (e.g., card `.name` is `0.85rem` but AnswerGrid `.name` is `0.65rem`). A 6–8 step scale would cover all needs.

**Proposed type scale (8 steps):**

| Step | Size | Use |
|------|------|-----|
| `--text-xs` | `0.35rem` | Micro labels, stat tags |
| `--text-sm` | `0.45rem` | UI labels, buttons, counters |
| `--text-base` | `0.6rem` | Section labels, nav labels |
| `--text-md` | `0.75rem` | Card names, descriptions |
| `--text-lg` | `1.1rem` | Nav icons |
| `--text-xl` | `1.8rem` | Page headings (mobile) |
| `--text-2xl` | `3rem` | Page headings |
| `--text-3xl` | `4rem` | Scores, hero numbers |

### 2.4 Spacing Values

**20+ unique spacing values, no scale.** Common values:

| Value | Usage Count (approx) |
|-------|---------------------|
| `0` | Many (resets) |
| `2px` | Gap in nav tabs, tile grid |
| `0.1rem` | Small gaps |
| `0.15rem` | Small gaps |
| `0.2rem` | Small gaps |
| `0.25rem` | Various padding/margin |
| `0.3rem` | Various |
| `0.35rem` | Various padding |
| `0.4rem` | Various |
| `0.5rem` | Very common gap/padding |
| `0.6rem` | Various |
| `0.65rem` | Nav item padding |
| `0.75rem` | Very common gap/padding |
| `0.85rem` | Card content padding |
| `1rem` | Common gap/padding |
| `1.25rem` | Content padding, gaps |
| `1.5rem` | Content padding, gaps |
| `2rem` | Desktop padding, sidebar padding |
| `2.5rem` | Desktop content padding |
| `3rem` | Wide desktop padding |

**Assessment:** Ad-hoc. A 4px-base spacing scale (`0.25rem` increments: 4, 8, 12, 16, 24, 32, 48, 64) would rationalize this.

### 2.5 Media Query Breakpoints

| Breakpoint | Where Used |
|-----------|------------|
| `min-width: 768px` | +layout.svelte, BottomNav, Progress, Settings, Home, VizQuizLayout (JS `window.innerWidth < 768`) |
| `min-width: 1200px` | +layout.svelte, QuizSession, VizQuizLayout |
| `(orientation: landscape) and (min-width: 568px) and (max-height: 500px)` | QuizSession (landscape phone) |

**Assessment:** Consistent — only 2 main breakpoints (768, 1200) plus one edge case. Good.

**Issue:** VizQuizLayout reads `window.innerWidth` in JS at mount time for `isMobile` check — this won't update on resize. Should use a CSS media query or reactive check.

---

## 3. Component Consistency Matrix

| Component | Uses tokens? | Font correct? | Colors correct? | Follows card pattern? | Duplicated CSS? |
|-----------|-------------|---------------|----------------|----------------------|----------------|
| **SideNav** | ✅ | ✅ | ✅ | N/A | — |
| **BottomNav** | ✅ | ✅ | ✅ | N/A | — |
| **QuizSession** | Mostly | ✅ | ⚠️ Some hardcoded | N/A | ⚠️ Duplicates TickerBanner CSS |
| **AnswerGrid** | Mostly | ⚠️ BPdots fallback | ⚠️ `#C2FE0C10`, `#ED174F10` | N/A | — |
| **ProgressBar** | ✅ | ✅ | ✅ | N/A | — |
| **TelemetryBar** | ⚠️ Inline fallbacks | ⚠️ Inline fallbacks | ⚠️ Inline fallbacks | N/A | — |
| **VizQuizLayout** | Mostly | ✅ | ⚠️ Hardcoded canvas colors | N/A | — |
| **TickerBanner** | ✅ | ✅ | ✅ | N/A | — |
| **LockedCard** | ⚠️ Inline fallbacks | ⚠️ Inline fallbacks | ⚠️ `color-mix` | Own pattern | — |
| **IntervalCard** | Mostly | ⚠️ BPdots | ⚠️ Mastery colors | Card pattern | ❌ **~120 lines duplicated** |
| **ChordCard** | Mostly | ⚠️ BPdots | ⚠️ Mastery colors | Card pattern | ❌ **~120 lines duplicated** |
| **ScaleCard** | Mostly | ⚠️ BPdots | ✅ | Card pattern | ❌ **~120 lines duplicated** |
| **ModeCard** | Mostly | ⚠️ BPdots | ✅ | Card pattern | ❌ **~120 lines duplicated** |
| **RadarGrid** | ❌ Hardcoded | N/A | ❌ `#3A2CFF` hardcoded | N/A | — |
| **Home page** | Mostly | ⚠️ `--font` body | ⚠️ Palette-external colors | N/A | — |
| **Progress page** | ✅ | ✅ | ⚠️ `rgba()` hardcoded | N/A | ⚠️ Heading duplicated |
| **Settings page** | ✅ | ✅ | ⚠️ `#3A2CFF10` | N/A | ⚠️ Heading + 4× hold-button CSS |
| **Welcome page** | N/A (just mounts QuizSession) | N/A | N/A | N/A | — |
| **Quiz page** | N/A (just mounts QuizSession) | N/A | N/A | N/A | — |

---

## 4. Specific Issues

### 4.1 CSS Architecture Issues

#### A. Card Component Mega-Duplication (P0 — Critical)
**IntervalCard, ChordCard, ScaleCard, and ModeCard** have nearly identical `<style>` blocks. The following classes are duplicated verbatim across all 4 files:

`.card`, `.card.playing`, `.card-fill`, `.card-content`, `.locked`, `.disabled`, `.disabled .id`, `.disabled .name`, `.disabled .toggle`, `.id`, `.locked .id`, `.name`, `.stats`, `.stat-tag`, `.stat-value`, `.new`, `.tier-tag`, `.acc-value`, `.toggle`, `.toggle-off`

**~120 lines × 4 = ~480 lines of pure duplication.** IntervalCard has 2 extra rules (`.mastery-dots`, `border-radius: 0`). ChordCard is identical to IntervalCard. ScaleCard/ModeCard lack mastery dots but are otherwise identical.

**Fix:** Extract a shared `BaseCard.svelte` component or `card.css` shared stylesheet.

#### B. Heading CSS Duplication (P1 — High)
The `.heading` class is defined identically in QuizSession, Progress page, and Settings page:
```css
.heading {
    font-size: 3rem; font-weight: 400;
    letter-spacing: 0.12em; color: var(--text-primary);
    padding-bottom: 0.5rem; border-bottom: 2px solid var(--border-heavy);
    text-transform: uppercase; font-family: var(--font-display);
}
```
**Fix:** Move to `app.css` as a global `.heading` class or extract a `<PageHeading>` component.

#### C. Settings Page Hold-Button Duplication (P1 — High)
The settings page has 4 near-identical long-press button implementations (reset, lab, train, onboard), each with its own:
- `$state` variables (holdProgress, holdActive, holdStart, holdRaf, done, glitchText, glitchInterval)
- Start/tick/cancel/execute functions
- CSS classes (`.reset-btn`/`.lab-btn`/`.train-btn`/`.onboard-btn` + `-fill`/`-text`)

**~200 lines of JS + ~80 lines of CSS duplicated 4 times.**

**Fix:** Extract a `<LongPressButton>` component that accepts `label`, `duration`, `color`, `onComplete`.

#### D. TickerBanner CSS Duplicated in QuizSession (P2 — Medium)
QuizSession has `.audio-banner` and `.ticker-text` styles that duplicate TickerBanner.svelte's styles identically. The QuizSession already imports TickerBanner — this appears to be dead CSS.

**Fix:** Remove `.audio-banner` and `.ticker-text` from QuizSession.

#### E. No Shared Utility Classes for Common Patterns (P2 — Medium)
Repeated inline patterns that could be extracted:
- **HUD tag** — `.hud-tag` exists in app.css but many components redefine the same pattern (`.stat-tag`, `.telem-tag`, `.counter`, `.close`, `.tier-tag`). All follow the same pattern: `border: 1px solid [color]; padding: 0 Xpx; font-family: var(--mono); font-size: 0.35-0.45rem; letter-spacing; text-transform: uppercase; line-height: 1.6`.
- **Section label** — pattern of mono font + color + border-bottom repeated across components.

### 4.2 Font Issues

#### F. System Fonts in `--font` Variable (P0 — Critical)
```css
--font: 'Inter', system-ui, -apple-system, sans-serif;
```
VISUAL-IDENTITY.md explicitly states: **"NO system fonts in UI (no -apple-system, no Segoe UI)"**. The `--font` variable is applied to `html, body` and inherited everywhere.

**Impact:** All body text, button text (via `font-family: inherit`), and any element not explicitly overridden renders in Inter or system fonts.

**Decision needed:** Either:
1. Change `--font` to `'Matrix Mono', monospace` (everything mono — very industrial)
2. Change `--font` to `'Maratype', sans-serif` (body text in display font)
3. Update VISUAL-IDENTITY.md to legitimize Inter for body text
4. Add a 4th brand font for body/description text

#### G. BPdots Font Fallback Inconsistency (P2 — Medium)
Card `.id` elements use:
```css
font-family: 'BPdots', 'JetBrains Mono', monospace;
```
The fallback should reference `var(--mono)` or at minimum use `'Matrix Mono'` instead of `'JetBrains Mono'`. JetBrains Mono is a development dependency, not a brand font.

**Fix:** Define `--font-id: 'BPdots', 'Matrix Mono', monospace;` in `:root` and use it everywhere.

#### H. TelemetryBar / LockedCard Inline Fallbacks (P3 — Low)
These components define inline font fallbacks like `var(--mono, 'Matrix Mono', 'JetBrains Mono', monospace)` instead of just `var(--mono)`. The CSS variable has its own fallback chain. These inline fallbacks are redundant and create maintenance burden.

### 4.3 Color Issues

#### I. Color Token Drift from VISUAL-IDENTITY.md (P1 — High)
5 tokens differ between code and spec (see Section 2.1). This creates confusion — which is canonical?

**Fix:** Update VISUAL-IDENTITY.md to match current CSS (the code has evolved intentionally). Add a note that the VI doc is the source of truth going forward.

#### J. Mastery Colors Not in Palette (P2 — Medium)
`#FFD700` (gold), `#C0C0C0` (silver), `#CD7F32` (bronze) are used in IntervalCard and ChordCard but not defined as CSS variables or documented in VISUAL-IDENTITY.md.

**Fix:** Add to `:root` and VI:
```css
--mastery-gold: #FFD700;
--mastery-silver: #C0C0C0;
--mastery-bronze: #CD7F32;
```

#### K. Content Type Colors Not in Palette (P2 — Medium)
Home page defines `#FF6B2C` (scales) and `#9B59B6` (modes) as inline constants, not CSS variables.

**Fix:** Add `--content-scales: #FF6B2C; --content-modes: #9B59B6;` to `:root` and VI.

#### L. RadarGrid Hardcoded Colors (P3 — Low)
SVG `stroke` attribute uses literal `#3A2CFF`. SVG attributes don't accept CSS variables directly, but could use `currentColor` with a CSS `color` override, or be set via JS.

### 4.4 Layout Issues

#### M. Inconsistent Max-Width Constraints (P2 — Medium)
Multiple different max-width values for content containers:

| Context | Max-Width |
|---------|-----------|
| `.app-main` (mobile) | `480px` |
| `.content` (desktop 768+) | `720px` |
| `.content` (wide 1200+) | `880px` |
| Progress page (desktop) | `800px` |
| Home page | None |
| QuizSession debrief | None (set to `none` explicitly) |

**Fix:** Define `--content-max-width-sm`, `--content-max-width-md`, `--content-max-width-lg` tokens or settle on 1–2 widths.

#### N. Home Page Lacks Content Width Constraint (P3 — Low)
On desktop, the home page has no max-width on its outer container — it relies on the layout shell's `.content` constraint. But since `.home-content` removes padding, the home page expands to fill `.app-main` which removes its max-width on desktop.

### 4.5 Responsive Design Issues

#### O. VizQuizLayout `isMobile` is Static (P2 — Medium)
```js
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
```
Evaluated once at import time. Won't respond to resize or orientation change. Affects particle count and frame skip behavior.

**Fix:** Use `$effect` with `window.matchMedia` or a reactive media query store.

#### P. Standard Emoji in Settings Credits (P3 — Low)
Settings page credits section uses standard emoji: `🧑‍💻`, `🗝️`, `🌉`, `🇫🇮`, `🌴`. VISUAL-IDENTITY.md states: **"NO standard emoji"**.

**Fix:** Replace with Matrix Mono PUA glyphs or remove emoji from credits.

### 4.6 Animation/Motion Issues

#### Q. Animation Timing Inconsistency (P3 — Low)
Transitions mostly use `0.15s` which is good, but some outliers:
- Card fill: `0.35s ease-out`
- Disabled opacity: `0.3s ease 0.3s` (with delay)
- Home page opacity: `0.4s ease`
- Theme transitions: `0.3s`

Not a major issue — the 0.15s default for interactions is well-established. The longer durations are for background/ambient effects, which is appropriate.

#### R. No Defined Animation Tokens (P3 — Low)
There are no CSS custom properties for animation durations or easing. E.g.:
```css
--transition-fast: 0.15s;
--transition-normal: 0.3s;
--easing-out: ease-out;
```
This would help consistency as the system grows.

---

## 5. Recommendations (Priority Order)

### Sprint 1 — Critical (do first)

| # | Task | Files | Est. |
|---|------|-------|------|
| 1 | **Extract shared card CSS** — Create `BaseCard.svelte` or `card.css` shared by IntervalCard, ChordCard, ScaleCard, ModeCard. Each variant only overrides what's unique (mastery dots for Interval/Chord). | 4 card components + new shared file | M |
| 2 | **Fix `--font` variable** — Decide on body font strategy and update. Either legitimize Inter in VI, or replace with a brand font. | `app.css`, VISUAL-IDENTITY.md | S |
| 3 | **Sync VISUAL-IDENTITY.md with actual CSS values** — Update the VI doc to reflect the current palette (which has evolved intentionally). Mark VI as canonical going forward. | VISUAL-IDENTITY.md | S |

### Sprint 2 — High Value

| # | Task | Files | Est. |
|---|------|-------|------|
| 4 | **Extract heading to global CSS** — Move `.heading` to `app.css`. Remove from QuizSession, Progress, Settings. | 4 files | S |
| 5 | **Extract `<LongPressButton>` component** — Replace 4 duplicated hold-button implementations in Settings. | Settings page + new component | M |
| 6 | **Define `--font-id` variable** — Add `--font-id: 'BPdots', 'Matrix Mono', monospace` to `:root`. Replace all `'BPdots', 'JetBrains Mono', monospace` occurrences. | `app.css` + 5 components | S |
| 7 | **Add missing color tokens** — Define `--mastery-gold/silver/bronze`, `--content-scales`, `--content-modes` as CSS variables. Replace all hardcoded hex values. | `app.css` + ~8 components | S |
| 8 | **Consolidate HUD tag pattern** — Extend `.hud-tag` to cover `.stat-tag`, `.telem-tag`, `.counter`, `.close`, `.tier-tag` patterns. Create `.hud-tag--sm`, `.hud-tag--accent`, etc. variants. | `app.css` + ~6 components | M |

### Sprint 3 — Cleanup

| # | Task | Files | Est. |
|---|------|-------|------|
| 9 | **Define type scale** — Add 8 `--text-*` variables, migrate existing font-size values to nearest step. | `app.css` + all components | L |
| 10 | **Define spacing scale** — Add `--space-*` variables (4px base), migrate common padding/gap values. | `app.css` + all components | L |
| 11 | **Add animation tokens** — Define `--transition-fast`, `--transition-normal`, `--easing-*` | `app.css` | S |
| 12 | **Remove dead CSS** — Delete `.audio-banner` and `.ticker-text` from QuizSession. Delete `.grid-container` and `.grid-label` from AnswerGrid. | 2 files | S |
| 13 | **Fix VizQuizLayout `isMobile`** — Replace static `window.innerWidth` check with reactive media query. | VizQuizLayout | S |
| 14 | **Replace standard emoji in credits** — Use PUA glyphs or text-only. | Settings page | S |
| 15 | **Remove inline fallbacks** — Clean up `var(--mono, 'Matrix Mono', ...)` patterns in TelemetryBar, LockedCard. Just use `var(--mono)`. | 2 components | S |
| 16 | **Rationalize max-width constraints** — Define 1–2 content width tokens. | `app.css`, layout, progress | S |

### Future Considerations

- **Shared button component or utility classes** — 15 button patterns is too many. A `<HUDButton variant="primary|danger|ghost">` component would cover most cases.
- **CSS layers or cascade management** — As the system grows, consider `@layer` for global vs component styles.
- **Light theme audit** — The `[data-theme="light"]` override only covers base palette tokens. Many hardcoded colors (mastery, content types) won't adapt. Need a full light theme pass.
- **Design tokens as JSON** — Consider a tokens.json → CSS variables build step for true multi-platform token management.

---

## Appendix: File-by-File Notes

### Files with most issues:
1. **Settings page** (`src/routes/settings/+page.svelte`) — 4× hold-button duplication, heading duplication, standard emoji
2. **IntervalCard** / **ChordCard** / **ScaleCard** / **ModeCard** — Card CSS duplication
3. **app.css** — `--font` system font issue, color token drift
4. **Home page** (`src/routes/+page.svelte`) — Undocumented palette colors, no max-width

### Files in good shape:
1. **TickerBanner** — Clean, minimal, well-tokenized
2. **ProgressBar** — Clean, minimal
3. **SideNav** / **BottomNav** — Good token usage, appropriate structure
4. **VizQuizLayout** — Complex but well-structured (aside from `isMobile` issue)
5. **Welcome page** / **Quiz page** — Thin wrappers, no issues
