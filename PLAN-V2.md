# EAR TRAINER v2.0 — HUD Chrome Overhaul

**Inspiration**: [tauceti.world/explorer](https://tauceti.world/explorer) — Marathon Graphic Realism HUD aesthetic
**Goal**: Elevate from "polished dark app" → "military sonar HUD terminal" feel

---

## Design Language (from Tau Ceti reference)

### Core Principles
- **1px acid green borders** on data elements (not 2px gray)
- **Boxed label tags** — small bordered rectangles for metadata labels (`[TIER]`, `[ACC]`, `[Q]`)
- **Floating telemetry** — scattered mono data readouts
- **Wireframe geometry** — concentric circles, grid lines as backgrounds
- **PPFraktion-style mono** — everything data-related is tight, small, uppercase mono
- **Two-color purity** — acid green `#C2FE0C` + black `#000000`, with blue wireframe accent

---

## Task Breakdown (7 tasks)

### TASK 1: Radar Background Component — `RadarGrid.svelte`
**Files**: NEW `src/components/RadarGrid.svelte`
**Description**: SVG component — concentric circles + radial grid lines. Low-opacity `--marathon-blue` wireframe (like the Tau Ceti globe). Slow CSS rotation animation (120s full turn). Used as background on home page behind the PRACTICE button, and potentially on quiz page behind the play button.

**Specs**:
- SVG, `viewBox="0 0 400 400"`, center at 200,200
- 6 concentric circles: radii 30, 60, 100, 140, 190, 200
- 12 radial lines (every 30°) from center to outermost circle
- Stroke: `var(--marathon-blue)`, opacity 0.12
- Stroke width: 0.5px (thin wireframe look)
- Optional: 4 crosshair ticks at N/S/E/W extending slightly past outermost circle
- CSS `animation: rotate 120s linear infinite` on the whole SVG
- Component accepts `size` prop (CSS width/height, default `100%`)
- `position: absolute`, centered, `pointer-events: none`, `z-index: 0`

### TASK 2: HUD Telemetry Bar Component — `TelemetryBar.svelte`
**Files**: NEW `src/components/TelemetryBar.svelte`
**Description**: Horizontal row of boxed data readouts, inspired by the Tau Ceti `[ZOOM] 50% [X] -17 [Y] 3 [R] 239°` bar. Each segment: a 1px green-bordered label tag followed by a mono value.

**Specs**:
- Props: `segments: Array<{ label: string, value: string | number }>`
- Each segment renders as: `<span class="tag">{label}</span><span class="val">{value}</span>`
- `.tag`: 1px solid `var(--accent)` border, padding `0 6px`, font-size `0.4rem`, `var(--mono)`, uppercase, `var(--accent)` color
- `.val`: no border, font-size `0.4rem`, `var(--mono)`, `var(--text-primary)` color, padding `0 8px`
- Segments separated by `gap: 2px` (tight, like Tau Ceti)
- Container: `display: flex`, `align-items: center`, `justify-content: center`
- Whole bar has subtle opacity (0.7) to not compete with main content

### TASK 3: Home Page HUD Upgrade — `+page.svelte` (home)
**Files**: `src/routes/+page.svelte`
**Description**: Layer RadarGrid behind the PRACTICE button. Replace the current stats box with a TelemetryBar. Add floating coordinate labels.

**Changes**:
1. Import `RadarGrid` and `TelemetryBar`
2. Wrap the center area (stats + button) in a `position: relative` container
3. Place `<RadarGrid />` as absolute background behind the PRACTICE button
4. Replace `.stats` div with `<TelemetryBar segments={[{label:'STK', value:streak}, {label:'ACC', value:accuracy+'%'}, {label:'Q', value:totalQ}, {label:'T', value:tier}]} />`
5. Move TelemetryBar BELOW the PRACTICE button (reads as data readout of your status)
6. Add 2-3 small floating `.coord` labels around the radar (mono, 0.35rem, green, opacity 0.3) — these show computed stats like current tier number, total semitones mastered, etc. Positioned absolute.
7. Keep EAR/TRAINER title block and SYS v1.0 tag above

### TASK 4: Progress Page HUD Upgrade — `+page.svelte` (progress)
**Files**: `src/routes/progress/+page.svelte`
**Description**: Replace the current `.global-stats` box with a TelemetryBar. Add boxed tags to interval cards.

**Changes**:
1. Import `TelemetryBar`
2. Replace `.global-stats` div with `<TelemetryBar segments={[{label:'SES', value:sessions}, {label:'Q', value:questions}, {label:'BST', value:bestStreak}]} />`
3. TelemetryBar sits right below the heading, before the interval list

### TASK 5: IntervalCard HUD Upgrade
**Files**: `src/components/IntervalCard.svelte`
**Description**: Add boxed label tags to the card data. Make the tier indicator a bordered tag.

**Changes**:
1. Locked cards: replace `TIER {n} // LOCKED` text with boxed tag: `<span class="tier-tag">T{tier}</span> LOCKED`
2. `.tier-tag`: 1px solid `var(--hot)` border, padding `0 4px`, font-size `0.35rem`, mono
3. Unlocked card stats: wrap accuracy in a boxed tag — `<span class="acc-tag">{accuracy}%</span>` with 1px green border
4. Add small semitone distance label at far right of locked cards: `{def.semitones}st` in tiny mono (0.3rem, `--text-secondary`)

### TASK 6: Bottom Nav HUD Upgrade
**Files**: `src/components/BottomNav.svelte`
**Description**: Add 1px green border segments around each nav tab (like Tau Ceti's nav buttons). Add a subtle tick ruler above the nav.

**Changes**:
1. Each nav item gets `border: 1px solid var(--border-heavy)` (inactive) or `border: 1px solid var(--accent)` (active) — replacing the current top-border-only indicator
2. Active tab: border color `var(--accent)` (NOT blue — matches Tau Ceti's green-everything approach for nav)
3. Add a `.tick-ruler` div above the nav: a thin (4px) strip with repeating vertical tick marks (via CSS `repeating-linear-gradient`), acid green, very low opacity (0.15)
4. Remove the current `border-top: 2px solid var(--border-heavy)` on `.bottom-nav` — the tick ruler replaces it
5. Slight gap between tabs (2px)
6. **NOTE**: The nav active state switching from blue to green is a deliberate design evolution. The Tau Ceti reference uses green-only chrome. Blue (`--marathon-blue`) stays for: SYS v1.0 bar, quiz progress bar, and the radar wireframe background only.

### TASK 7: Global CSS + Scanline Enhancement
**Files**: `src/app.css`
**Description**: Enhance the existing scanline overlay and add a HUD utility class.

**Changes**:
1. Strengthen scanline opacity: `rgba(0,0,0,0.03)` → `rgba(0,0,0,0.05)` (slightly more visible)
2. Add `.hud-tag` utility class: `display: inline-flex; border: 1px solid var(--accent); padding: 0 6px; font-family: var(--mono); font-size: 0.4rem; letter-spacing: 0.05em; color: var(--accent); text-transform: uppercase;`
3. Add `.hud-tag--hot` variant with `border-color: var(--hot); color: var(--hot);`
4. Add `.hud-tag--blue` variant with `border-color: var(--marathon-blue); color: var(--marathon-blue);`
5. Add `.tick-ruler` class: `height: 4px; background: repeating-linear-gradient(90deg, var(--accent) 0px, var(--accent) 1px, transparent 1px, transparent 8px); opacity: 0.15;`

---

## Task Dependencies

```
TASK 7 (CSS utilities)     ─┐
TASK 1 (RadarGrid)         ─┤
TASK 2 (TelemetryBar)      ─┼─→ TASK 3 (Home page) ─→ TASK 6 (Nav)
                            │
                            └─→ TASK 4 (Progress) ─→ TASK 5 (IntervalCard)
```

- Tasks 1, 2, 7 can run in **parallel** (no shared files, independent components)
- Task 3 depends on 1 + 2 + 7
- Task 4 depends on 2 + 7
- Task 5 depends on 7
- Task 6 depends on 7

## Execution Strategy

**Phase 1** (parallel): Tasks 1, 2, 7 — new components + CSS utilities
**Phase 2** (sequential): Tasks 3, 4, 5, 6 — integration into pages

Phase 2 must be sequential to avoid git conflicts (all touch different files but need Phase 1 committed first).

---

## Files Modified (summary)
| File | Tasks |
|------|-------|
| NEW `src/components/RadarGrid.svelte` | T1 |
| NEW `src/components/TelemetryBar.svelte` | T2 |
| `src/app.css` | T7 |
| `src/routes/+page.svelte` | T3 |
| `src/routes/progress/+page.svelte` | T4 |
| `src/components/IntervalCard.svelte` | T5 |
| `src/components/BottomNav.svelte` | T6 |

**7 files total** (2 new, 5 modified). No test changes expected (all visual).

---

## What This Does NOT Touch
- Quiz page (`/quiz`) — already has strong identity with PlayButton, countdown, glyphs
- Settings page — recently polished (long-press reset, DANGER ZONE)
- Audio/engine logic — purely visual
- PlayButton component — no changes

## Color Evolution Note
Nav active state moves from `--marathon-blue` to `--accent` (green). This aligns with Tau Ceti's mono-green HUD chrome. Blue is reserved for:
- SYS v1.0 version bar
- Quiz progress bar fill
- RadarGrid wireframe circles (subtle)
- Future: tier badges (TBD)
