# Agent Roles — Ear Trainer

## Moto (coordinator)
- Architecture decisions, sprint planning, spec writing
- Subagent dispatch for implementation
- Direct fixes for small changes during QA
- Does NOT write feature code in multi-agent sprints

## Pixi (implementer — audio/quiz/learning)
- Audio engine, quiz flow, adaptive system
- Main branch features

## Noki (implementer — viz/creative)
- Visualization, ASCII lab, design experiments
- Exploration branches

## Palm (QA)
- Headless browser testing (Chrome desktop)
- Screenshot comparison, regression detection
- Cannot test: audio output, iOS Safari, real device touch

## Mike (operator)
- Real device testing (iOS Safari, BT audio)
- Design/UX decisions
- Final merge approval
- Production deploy authorization

## Sprint Workflow

All agents MUST follow the sprint-lifecycle skill:

1. **Starting work** — invoke `sprint-lifecycle init` before `writing-plans`. Creates sprint dir, updates SPRINTS.md + PROJECT.md.
2. **Merging PRs** — if the PR completes a sprint phase, update SPEC.md checklist and SPRINTS.md in the merge commit.
3. **Finishing a sprint** — invoke `sprint-lifecycle close` after `finishing-a-development-branch`. Marks done, writes shipped summary, bumps version.
4. **Drift detected** — if SPRINTS.md is stale, fix it immediately. Don't flag it, fix it.
