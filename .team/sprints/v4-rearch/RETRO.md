# Retro: v4-rearch

## What shipped
Full architecture redesign: unified quiz controller, new data model (UserStateV4), persistent AudioContext, modular code structure, feature gate plumbing. ~7,100 lines deleted net.

## Timeline
- Brainstorm: 40 min (8 design questions, one at a time)
- Spec: 20 min (written during brainstorm)
- Plan: 15 min (25 tasks across 7 phases)
- Execute: 2.5 hours (subagent per task)
- QA: 2 hours (Palm headless + Mike iOS)
- Ship: 10 min (merge + deploy)
- Post-merge polish: 1.5 hours (12 fixes from Mike's device testing)

## What worked
- Subagent swarm was dramatically faster than multi-agent for this type of work
- ~6 min average per task including dispatch overhead
- Design-first brainstorming produced zero rework from unclear requirements
- Single branch eliminated merge conflicts entirely
- Discord channel as status board — lightweight, scannable
- Palm caught P0 blank screen bug before Mike tested
- Rapid fix cycle during QA (2-5 min per fix, direct edits)

## What didn't
- iOS audio recovery took 4 iterations (optimistic → always reset → time-based → session claim ordering)
- Svelte 5 $state() proxy reactivity stumped subagents — needed coordinator-level debugging
- Exec approval friction was the #1 speed bottleneck (~30s per command × dozens of commands)
- Phase 0 snapshot tests got deleted in Phase 6 (imported from old modules) — test count dropped from 600+ to 206
- Dual state risk between Phase 4 and Phase 6 (some pages v3, some v4)

## What to change
- For platform-specific behavior (iOS audio), plan for iteration — don't expect first fix to work
- Write snapshot tests importing from barrel re-exports, not internal module paths
- Investigate exec allow-always policies for common commands (build, test, push)
- When phases create intermediate broken states, consider tighter batching

## Execution model used
Subagent swarm (25 tasks, sequential, single branch)

## Execution model verdict
Exactly right for this work. Sequential dependencies, clear spec, time-sensitive. Multi-agent would have been slower with more coordination overhead. The v4 sprint validated subagent swarm as the go-to for architecture refactors.
