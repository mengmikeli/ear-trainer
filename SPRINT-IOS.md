# Sprint: iOS Tech Demo (v4.0)

Branch: `feat/ios` (based on v3.3 release — commit `3e93666`)

## Goal
Get the ear trainer running in the iOS Simulator via Capacitor. No App Store, no TestFlight. Just prove it works natively.

## Team
- **Pixi** 🌉 — Dev (Capacitor scaffold, build pipeline, iOS fixes)
- **Palm** 🌴 — QA (simulator testing, audio verification, screenshot)
- **Moto** 🗝️ — Coordination

## Scope
✅ In scope:
- Capacitor scaffold (`@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`)
- SvelteKit static build → Capacitor sync
- Xcode project generation
- iOS Simulator launch + working audio
- Screenshot of app running in simulator
- Document any iOS-specific gotchas (Web Audio autoplay, safe areas, etc.)

❌ Out of scope:
- App Store / TestFlight
- Physical device testing
- PWA features (this branch predates PWA work)
- New features — this is a scaffold only

## Dev Steps (Pixi)
1. `npm install @capacitor/core @capacitor/cli @capacitor/ios`
2. `npx cap init "Ear Trainer" "work.tasteful.ear-trainer" --web-dir build`
3. `npx cap add ios`
4. `npm run build` → `npx cap sync`
5. `npx cap open ios` → run in simulator
6. Fix any Web Audio issues (autoplay policy, AudioContext resume on tap)
7. Commit working scaffold

## QA Steps (Palm)
1. Pull `feat/ios`, `npm install`, `npm run build`, `npx cap sync`
2. Open in Xcode → run on iPhone 15 Pro simulator
3. Verify: app loads, audio plays, interval quiz works end-to-end
4. Screenshot the simulator with app running
5. Note any bugs or visual issues

## Known Risks
- Web Audio autoplay may need a user gesture to start AudioContext
- Safe area insets handled differently in Capacitor vs PWA
- v3.3 base doesn't have PWA safe area fixes (intentional — cleaner base)

## Definition of Done
- [ ] App runs in iOS Simulator
- [ ] Audio works (intervals play correctly)
- [ ] Screenshot captured
- [ ] Gotchas documented
