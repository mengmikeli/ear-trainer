# Sprint: S5.1 — Design System Foundation

## Goal
Fix the CSS architecture so every visual element is built on shared tokens and components. Zero visual regression — same look, cleaner code.

## Scope

### 1. Design Tokens (`app.css`)
- Reconcile color tokens with VISUAL-IDENTITY.md (fix 5 drifted values)
- Remove system fonts from `--font` (Inter, system-ui, -apple-system)
- Define type scale: 6 sizes (xs: 0.35rem, sm: 0.45rem, md: 0.6rem, lg: 0.85rem, xl: 1.5rem, 2xl: 3rem)
- Define spacing scale: 5 values (xs: 0.25rem, sm: 0.5rem, md: 0.75rem, lg: 1.25rem, xl: 2rem)
- Shared heading class `.page-heading`
- Shared button classes (`.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-toggle`)

### 2. Shared ContentCard Component
- Replace IntervalCard/ChordCard/ScaleCard/ModeCard with one `ContentCard.svelte`
- Props: content type, definition, state, mode filter, callbacks
- Kills ~480 lines of CSS duplication

### 3. Shared LongPressButton Component
- Replace 4 duplicated long-press implementations in settings
- Props: label, duration, onExecute, color scheme
- Kills ~280 lines of duplication

### 4. Dead CSS Cleanup
- Remove unused classes from QuizSession, AnswerGrid
- Remove standard emoji from settings credits

## Out of scope
- Home redesign (PR #100, ships after this)
- New visual features
- Layout changes

## Execution model
Subagent swarm — mechanical refactoring with clear specs.

## Done when
- [ ] All color tokens match VISUAL-IDENTITY.md
- [ ] No system fonts in CSS
- [ ] Type scale defined and used (25+ sizes → 6)
- [ ] Spacing scale defined (20+ values → 5 base values)
- [ ] ContentCard replaces 4 card components
- [ ] LongPressButton replaces 4 settings implementations
- [ ] Heading style shared across all pages
- [ ] Dead CSS removed
- [ ] Zero visual regression — app looks identical
- [ ] All tests pass, build clean
