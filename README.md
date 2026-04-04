# Lissa

Adaptive ear training app. Identify intervals, chords, scales, and modes by sound.

Built with SvelteKit + Web Audio API. Marathon "Graphic Realism" visual identity.

## Quick start

```bash
npm install
npm run dev
```

## Test

```bash
npm run test        # Unit tests (Vitest)
npm run test:e2e    # E2E tests (Playwright)
```

## Deploy

- **Staging:** Auto-deploys from `main` via GitHub Pages
- **Production:** `npx wrangler pages deploy build --project-name=ear-trainer`

## Architecture

See `.team/` for project docs:
- `.team/PROJECT.md` — project config
- `.team/AGENTS.md` — team roles
- `.team/SPRINTS.md` — sprint history
- `.team/refs/` — architecture reviews, visual identity, shorthands
