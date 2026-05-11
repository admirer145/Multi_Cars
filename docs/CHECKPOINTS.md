# Multi Cars Checkpoints

This file tracks where the project currently stands against the implementation plan. Update it whenever a milestone starts, completes, or changes scope.

## Current Status

Current checkpoint: **Classic Car Count Selection**

Status: **Completed Classic Car Count Selection**

The basic playable version is working, the deterministic pattern foundation is in place, Classic mode is endless with 1-car and 2-car options, Challenge mode has categorized road selection with level progression, Practice mode has focused deterministic drills, Daily Challenge has a date-seeded offline route, local achievements/cosmetic skins are in place, Control Room gates optional modifiers, failed runs can open a local non-interactive replay of the final mistake window, and the app can install/cache its shell for offline reloads after a first visit.

## Progress Summary

| Milestone | Status | Notes |
| --- | --- | --- |
| 0. Project Setup | Done | Vite, TypeScript, Phaser, Vitest, Playwright, scripts, and project structure are in place. |
| 1. Playable Core Prototype | Done | Two cars, lane switching, collectibles, obstacles, score, game over, pause, restart, and high score are working. |
| 2. Deterministic Pattern Engine | Done | Named pattern families, validation, authored track foundation, metadata, and safety tests are in place. |
| 3. Classic Mode | Done | Stable Classic run factory, deterministic restart seeds, speed level display, clearer failure summary, and mode tests are in place. |
| 4. Menu And UX Foundation | Done | Menu, Classic start flow, settings entry, pause-to-menu flow, summary scene foundation, and navigation tests are in place. |
| 5. Challenge Mode | Done | Starter authored Challenge track, progress/stars logic, local progress storage, menu entry, gameplay routing, summary routing, and tests are in place. |
| 6. Practice Mode | Done | Focused deterministic drills, Practice menu flow, gameplay routing, summary/replay, local best progress, and tests are in place. |
| 7. Daily Challenge | Done | Date-seeded Daily route, local daily progress, home entry, gameplay routing, summary/replay, and tests are in place. |
| 8. Engagement Layer | Done | Local achievements, cosmetic-only car skins, Garage surface, optional gameplay modifiers, summary unlock callouts, persistence, and tests are in place. |
| 9. Replay Last Mistake | Done | Rolling replay capture, summary replay action, non-interactive replay overlay, unit tests, and browser coverage are in place. |
| 10. PWA And Offline Hardening | Done | Manifest, install metadata, service worker shell caching, local-first offline reload coverage, and docs are in place. |

## Current Product Direction

Classic is moving toward scalable car-count selection. The first shipped step supports 1-car and 2-car Classic runs; future expansion can add 3-car and 4-car options once the renderer, input model, and pattern generator are extended beyond the current two active road groups.

## Completed Checkpoint Details

### Milestone 0: Project Setup

Completed:

- `package.json` with dev, build, test, e2e, lint, and format scripts.
- Vite TypeScript app entry.
- Phaser game config.
- Strict TypeScript configuration.
- Vitest configuration.
- Playwright configuration for desktop and mobile Chrome profiles.
- `.gitignore`.
- Planning document.

Verification:

- `npm install` completed.
- `npm run build` passed.
- `npm run test` passed.
- `npm run test:e2e` passed.

### Milestone 1: Playable Core Prototype

Completed:

- Two road groups.
- Two lanes per road group.
- Left and right car rendering.
- Keyboard controls.
- Pointer/touch controls by screen half.
- Collectibles.
- Obstacles.
- Score updates.
- Missed collectible failure.
- Obstacle collision failure.
- Pause and resume.
- Restart after failure.
- Local high score persistence.

Verification:

- Unit tests cover deterministic generation and simulation behavior.
- Browser smoke tests verify boot, canvas visibility, keyboard input, and pause.
- Production build succeeds.

Known limitations:

- The app currently boots directly into gameplay.
- Placeholder visuals are used.
- Pattern generation is deterministic but still simple.
- No menu, challenge, practice, daily, PWA, replay, or cosmetic systems yet.
- No manual phone-device QA has been recorded yet.

### Milestone 2: Deterministic Pattern Engine

Goal:

Make the pattern system strong enough to support Classic, Challenge, Daily, Practice, and future offline 1v1 without rewriting core gameplay.

Completed:

- Added named pattern families: focus, sync, mirror, alternating, delayed, deceptive, pressure, and recovery.
- Added pattern family metadata and skill tags.
- Added validation for empty patterns, invalid event data, duplicate ids, same-side conflicts, and unsafe same-side timing gaps.
- Added authored starter track foundation.
- Updated generated patterns to validate before use.
- Fixed delayed-pattern scheduling so late delayed events do not crowd the next beat.
- Added tests for deterministic generation, family metadata, family-specific generation, authored tracks, validation failures, and direct `Math.random()` usage in core logic.

Verification:

- `npm run test` passed with 12 tests.
- `npm run build` passed.
- `npm run test:e2e` passed with 3 tests and 1 expected mobile keyboard skip.

Known limitations:

- Authored tracks are defined but not yet exposed in UI.
- Difficulty tiers exist as generator inputs, but Classic mode still needs a polished progression model.
- Validation catches structural pattern issues, not full human playability tuning.

### Milestone 3: Classic Mode

Goal:

Turn the current endless-like prototype into a polished Classic mode that is fun, readable, persistent, and ready to sit behind a real menu.

Completed:

- Added `classicMode` module with Classic run factory, stable run seeds, speed levels, and run summaries.
- Removed timestamp-based Classic run seeds from gameplay.
- Restart now advances a deterministic run index.
- Classic UI now shows speed level.
- Failure summary now includes reason, side, lane, pattern family, score, and best score.
- Failure state now carries pattern family metadata.
- High score persistence is injectable and unit-tested.
- Added tests for Classic run determinism, seed generation, speed curve, run summaries, high-score boundaries, and pause time integrity.

Verification:

- `npm run test` passed with 20 tests.
- `npm run build` passed.
- `npm run test:e2e` passed with 3 tests and 1 expected mobile keyboard skip.

Known limitations:

- Classic difficulty progression is functional but still needs deeper long-run tuning.
- Visual polish is improved later in the React/Tailwind and gameplay polish passes.
- Run summaries are handled by the React overlay added in later checkpoints.

### Milestone 4: Menu And UX Foundation

Goal:

Add the app navigation shell needed before Challenge, Practice, Daily, themes, and settings can be integrated cleanly.

Completed:

- Added `MenuScene`.
- App now boots to menu instead of active gameplay.
- Added Classic start flow from menu.
- Added settings entry point with sound and reduced-motion placeholders.
- Added `SummaryScene` foundation for post-run results.
- Gameplay now routes failed/completed runs to Summary.
- Pause overlay remains minimal.
- Gameplay can return to menu from pause.
- Browser tests now cover menu boot, Classic start, settings open/back, pause, and return to menu.

Verification:

- `npm run test` passed with 20 tests.
- `npm run build` passed.
- `npm run test:e2e` passed with 8 tests and 2 expected mobile keyboard skips.

Known limitations:

- Summary scene is wired, but there is not yet a deterministic e2e shortcut to force a completed/failed run into Summary.
- Settings are placeholders and not persisted yet.
- Menu is Phaser-native; a future HTML/React overlay can replace it if richer UI becomes useful.

### Milestone 5: Challenge Mode

Goal:

Add finite skill-based challenge tracks using the authored-track foundation and the new navigation flow.

Completed:

- Added `challengeMode` module.
- Added deterministic Challenge runs from authored tracks.
- Added Challenge progress model with best percent, stars, completion, and attempts.
- Added local Challenge progress save/load helpers.
- Added Challenge entry on the menu.
- Gameplay can now run either Classic or Challenge.
- Summary scene can display Challenge progress, best percent, and stars.
- Challenge failure routes through Summary.
- Added unit tests for challenge run determinism, stars, progress updates, summaries, and storage.
- Added browser tests for Challenge start and Challenge-to-Summary routing on desktop and mobile profiles.

Verification:

- `npm run test` passed with 26 tests.
- `npm run build` passed.
- `npm run test:e2e` passed with 12 tests and 2 expected mobile keyboard skips.

Known limitations:

- Challenge categories now exist, but more levels should be authored per category.
- Challenge progress is stored locally and displayed on road cards, but category completion summaries are not shown yet.
- Challenge completion is possible through gameplay, but current e2e only verifies natural failure routing.

### UI/UX Improvement Pass After Milestone 5

Completed:

- Reworked the main menu into a more game-like first screen with road art, stronger mode cards, and clearer hierarchy.
- Added Challenge road selection with categories, level cards, road themes, local progress, and locked higher-level roads.
- Added more authored Challenge roads across focus, coordination, recognition, and reaction categories.
- Reworked Settings into scalable sections for gameplay, comfort, audio, visuals, and save-data options.
- Improved gameplay visuals with richer roads, animated lane dashes, stronger car styling, object shadows, highlights, and clearer collection zone.
- Updated Summary so the final gameplay state remains visible behind an opaque score card.
- Updated e2e click targets and flow coverage for the redesigned UI.

Verification:

- `npm run test` passed with 26 tests.
- `npm run build` passed.
- `npm run test:e2e` passed with 12 tests and 2 expected mobile keyboard skips.

### React/Tailwind UI Migration

Completed:

- Added React, Tailwind, and the Vite React plugin.
- Moved menu, challenge selection, settings, and summary UI out of Phaser and into React/Tailwind.
- Kept Phaser focused on the gameplay canvas only.
- Added a small event bridge so Phaser emits run-ended/menu-request events and React owns screen navigation.
- Summary now overlays the live/final Phaser canvas instead of replacing it, keeping the final game state visible behind the score card.
- Updated browser tests to use real DOM interactions instead of canvas-coordinate clicks for menus.
- Kept Challenge category/level selection, locked roads, and scalable settings in the React shell.

Verification:

- `npm run test` passed with 26 tests.
- `npm run build` passed.
- `npm run test:e2e` passed with 12 tests and 2 expected mobile keyboard skips.

### Gameplay Feel Polish

Completed:

- Moved gameplay HUD into a compact top cockpit strip so it no longer fights with road content.
- Removed redundant mode labels from the active HUD.
- Replaced multiline plain HUD text with focused score/progress chips and a subtle progress bar.
- Removed the disliked car under-highlight.
- Added smoothed visual lane movement so cars glide toward the new lane while the simulation remains deterministic.
- Added slight car lean and bob during lane changes to make the cars feel alive.
- Updated lane-change rendering so the front of the car leads the move and the rear follows, making turns feel more physical.
- Reworked car rendering from a rounded box into a top-down arcade racer silhouette with tapered hood, cockpit glass, fenders, visible tires, spoiler, headlights, and rear lights.
- Removed the horizontal collection-zone lane ticks under the cars so the road remains visually continuous.
- Added faster moving lane dashes and side streaks so the road communicates speed more clearly.
- Reserved a top visual band for HUD readability and delayed object drawing until objects enter the road area.

Verification:

- `npm run test` passed with 26 tests.
- `npm run build` passed.
- `npm run test:e2e` passed with 12 tests and 2 expected mobile keyboard skips.

### Mobile Scroll Fix

Completed:

- Removed the global scroll lock from React UI screens.
- Kept scroll/touch locking only for active gameplay and the summary overlay.
- Changed the app root to support scrollable content on mobile.
- Added mobile e2e coverage for scrolling the Settings screen to hidden lower content.
- Reset stale page scroll when entering gameplay or summary so the fixed-height game starts at the top even if the menu was previously scrolled.
- Fixed the gameplay canvas and summary overlay to the viewport so active gameplay does not inherit menu scroll position.

Verification:

- `npm run test` passed with 27 tests.
- `npm run build` passed.
- `npm run test:e2e` passed with 16 tests and 6 expected project-specific skips.

### Summary Replay Keyboard Fix

Completed:

- Prevented Phaser from handling restart input after it has handed off to the React summary overlay.
- Added React-owned summary keyboard shortcuts: `R`/Enter replay and `M`/Escape return to menu.
- Added e2e coverage to verify pressing `R` on the Run Ended overlay dismisses it and starts a new run.

Verification:

- `npm run test` passed with 26 tests.
- `npm run build` passed.
- `npm run test:e2e` passed with 14 tests and 4 expected project-specific skips.

### Mobile Touch Split Fix

Completed:

- Corrected gameplay pointer handling so Phaser uses the canvas-space pointer position directly.
- Fixed the mobile touch split so the left and right halves of the canvas map cleanly to the left and right cars.
- Added DOM lane state markers for reliable browser-level touch control verification.
- Added mobile e2e coverage proving that left-side taps move only the left car and right-side taps move only the right car.

Verification:

- `npm run test` passed with 26 tests.
- `npm run build` passed.
- `npm run test:e2e` passed with 15 tests and 5 expected project-specific skips.

### Classic Endless And Challenge Progress Fix

Completed:

- Marked Classic mode as endless so it can no longer emit the Challenge-style completed state.
- Updated the simulation lifecycle so finite completion only applies to non-endless modes.
- Added endless pattern cycling for Classic so the generated route can continue past the original pattern window.
- Extended Challenge road duration targets so progress and road clearing no longer move through a short starter pattern too quickly.
- Repeated authored Challenge road motifs across the full route duration while keeping validation intact.
- Reserved a short Challenge route clear-out tail so completion happens after the final spawned targets have time to reach the decision zone.
- Synced Challenge summary and HUD stars to the current run progress; saved road-card mastery still tracks best progress.
- Added tests for Classic continuing past its configured pattern window and the new authored road repetition behavior.

Verification:

- `npm run test` passed with 27 tests.
- `npm run build` passed.
- `npm run test:e2e` passed with 15 tests and 5 expected project-specific skips.

### Milestone 6: Practice Mode

Goal:

Add low-friction drills that train specific skills without weakening Classic or Challenge rules.

Completed:

- Added `practiceMode` module with five starter drills: left-hand focus, right-hand focus, mirror switches, sync lanes, and alternating rhythm.
- Built Practice runs from deterministic repeated drill patterns.
- Added Practice mode to the shared boot config, run-ended bridge, and replay flow.
- Added Practice entry on the home screen and a dedicated drill selection screen.
- Wired Practice into Phaser gameplay with drill-specific road themes, HUD progress, finite completion, and normal fail conditions.
- Kept Practice separate from Classic high score and Challenge progress persistence.
- Added unit tests for drill definitions, deterministic patterns, validation, one-hand drill scoping, and summaries.
- Added browser coverage for starting a Practice drill on desktop and mobile profiles.
- Added a deterministic browser-test failure hook so summary routing tests no longer depend on real-time failure duration.
- Added local best progress persistence per Practice drill.

Verification:

- `npm run test` passed with 32 tests.
- `npm run build` passed.
- `npm run test:e2e` passed with 18 tests and 6 expected project-specific skips.

### Milestone 7: Daily Challenge

Goal:

Add a date-seeded finite road that can be played offline and reproduced consistently for a local calendar day.

Completed:

- Added `dailyMode` module with local-date seed integration, deterministic route generation, daily progress updates, stars, and summaries.
- Added local Daily progress persistence separate from Classic high score, Challenge progress, and Practice drills.
- Added Daily Road entry on the home screen with today's local best percent and stars.
- Wired Daily into the shared boot config, gameplay scene, HUD, road theme, summary, replay, and progress save flow.
- Added unit tests for same-date determinism, different-date routes, stars, progress updates, summaries, and storage.
- Added browser coverage for starting Daily Road on desktop and mobile profiles.

Verification:

- `npm run test` passed with 39 tests.
- `npm run build` passed.
- `npm run test:e2e` passed with 20 tests and 6 expected project-specific skips.

### Milestone 8: Engagement Layer

Goal:

Add non-advantage rewards and lightweight long-term motivation without diluting the core fail conditions.

Completed:

- Added achievement definitions and deterministic unlock rules for first run, Classic score, Challenge progress, Practice play, and Daily play.
- Added cosmetic-only car skin definitions gated by achievements.
- Added local achievement state persistence and selected car skin persistence.
- Added Garage screen with achievements and car skins.
- Added summary unlock callouts for newly earned achievements and cosmetic rewards.
- Applied selected car skin colors to gameplay cars without changing speed, hitboxes, lives, scoring, or fail conditions.
- Added Control Room toggles for shield, slow motion, magnet, score multiplier, dual collect, moving obstacles, fake collectibles, timed gates, and color matching. Shield is default-on; the rest are opt-in.
- Added deterministic modifier decoration for generated Classic/Daily roads, plus simulation behavior for active power-up effects and advanced hazard/collectible variants.
- Added unit tests for achievement unlocks, locked/unlocked skin normalization, and persistence.
- Added unit tests for modifier defaults, persistence, generated-road decoration, shield, fake-collectible shielding, magnet safety, wrong-color traps, and score multiplier behavior.
- Added browser coverage for opening the Garage surface on desktop and mobile profiles.

Verification:

- `npm run test` passed with 63 tests.
- `npm run build` passed.
- `npm run test:e2e` passed with 31 tests and 7 expected project-specific skips.

### Milestone 9: Replay Last Mistake

Goal:

Add an optional post-run replay of the final mistake window so players can see what they missed without changing the run result.

Completed:

- Added `ReplayBuffer` with bounded rolling simulation-state snapshots.
- Gameplay now records replay frames during active runs and attaches a replay clip to failed/completed run details.
- Summary now offers `Replay Mistake` for failed runs with a captured clip.
- Added a local non-interactive canvas replay overlay that loops the final mistake window.
- Replay is local-only, does not restart Phaser, and does not write progress or scores.
- Added unit tests for replay window trimming, sampling, final-state inclusion, and cloned replay frames.
- Added browser coverage for opening replay from summary on desktop and mobile profiles.

Verification:

- `npm run test` passed with 67 tests.
- `npm run build` passed.
- `npm run test:e2e` passed with 33 tests and 7 expected project-specific skips.

### Milestone 10: PWA And Offline Hardening

Goal:

Make the game installable and more resilient offline while keeping the current local-first architecture.

Completed:

- Added a web app manifest, app metadata, theme color, icon, and mobile install tags.
- Added a same-origin service worker that precaches the app shell and uses network-first caching with cached fallbacks for offline reloads.
- Kept progress, settings, achievements, and cosmetic state browser-local through the existing local storage persistence layer.
- Added browser smoke coverage that primes the service worker, changes a local setting, reloads offline, and verifies the setting remains available.
- Documented install/offline behavior and limitations in the README.

Known limitations:

- Offline play requires at least one successful online visit first.
- Save data remains local to the browser profile and is not synced across devices.
- Fresh uncached routes or assets still require network before they can be served offline.

Verification:

- `npm run test` passed with 67 tests.
- `npm run build` passed.
- `npm run test:e2e` passed with 35 tests and 7 expected project-specific skips.

### Classic Car Count Selection

Goal:

Add a Classic run selection step that starts either a single-car two-lane run or the existing two-car four-lane run.

Completed:

- Added a Classic selection screen with 1-car and 2-car options.
- Preserved the existing 2-car Classic flow, seed format, controls, four-lane renderer, and replay behavior.
- Added 1-car Classic with one centered two-lane road, one visible car, full-canvas tap control, and single-key keyboard support.
- Added car-count-aware Classic run config, generated patterns, simulation state, DOM status, replay drawing, and per-car-count Classic high score helpers.
- Removed the previously planned Polish And Device QA milestone from the active roadmap.

Known limitations:

- Only 1-car and 2-car Classic options are currently selectable.
- The core road-side model still has two active road groups; future 3-car and 4-car support will need the planned renderer/input/model expansion.
- Challenge, Practice, and Daily remain on the existing two-car rules.

Verification:

- `npm run test` passed with 69 tests.
- `npm run build` passed.
- `npm run test:e2e` passed with 37 tests and 7 expected project-specific skips.

## Checkpoint Rules

Every milestone should include:

- Scope completed.
- Files or modules touched.
- Verification commands run.
- Known limitations.
- Next checkpoint.

Before moving to a new milestone:

- `npm run test` must pass.
- `npm run build` must pass.
- `npm run test:e2e` should pass when browser behavior changed.
- The checkpoint status must be updated.

## Latest Verification

Last verified after Classic Car Count Selection:

```text
npm run test      -> passed, 71 tests
npm run build     -> passed
npm run test:e2e  -> passed, 37 browser tests, 7 expected project-specific skips
```

Current local dev URL:

```text
http://127.0.0.1:5173/
```
