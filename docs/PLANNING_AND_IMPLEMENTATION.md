# Multi Cars Planning And Implementation Guide

This document is the source of truth for building the improved offline single-player Two Cars-inspired game. It is written to support step-by-step implementation without losing the original game's identity: concentration, accurate decision-making, both-hand coordination, and pattern recognition.

The project should be implemented in small vertical slices. Every milestone must leave the game runnable, testable, and structurally ready for the next feature.

Current project progress is tracked in [CHECKPOINTS.md](./CHECKPOINTS.md). Update that file whenever a milestone starts, completes, or changes scope.

## 1. Product Vision

Build a fast, focused, offline-first browser game where the player controls two cars at the same time. The game should preserve the original high-concentration rule set:

- Missing a required collectible ends the run.
- Hitting an obstacle ends the run.
- The player succeeds by reading patterns, coordinating both hands, and staying calm under pressure.
- Extra features must deepen mastery, not dilute the difficulty.

The improved version should add structure, progression, practice, replayability, and clean UX while keeping the active gameplay simple and intense.

## 2. Core Design Principles

### 2.1 Preserve The Original Difficulty

The game should not soften the central fail conditions. A missed required collectible or obstacle collision remains a game-ending mistake in normal play.

Allowed:

- Better onboarding.
- Practice drills.
- Challenge tracks.
- Replay of the final mistake.
- Skill feedback after failure.

Avoid:

- Lives in Classic or Challenge mode.
- Random power-ups that save the player.
- Timing bonuses that distract from the main decisions.
- Combo scoring that duplicates the existing no-miss rule.

### 2.2 Skill First, Reward Second

Rewards should motivate practice, but never create gameplay advantage. Unlockables should be cosmetic or informational.

Allowed rewards:

- Themes.
- Car skins.
- Road styles.
- Pattern library entries.
- Achievement badges.

Avoid:

- Faster cars.
- Wider hitboxes.
- Extra lives.
- Paid gameplay advantages.

### 2.3 Deterministic Gameplay

Any generated pattern should be reproducible from a seed.

This is required for:

- Daily challenges.
- Replay-last-mistake.
- Debugging.
- Fairness.
- Future offline 1v1 duel mode.

Same seed plus same mode config must produce the same track.

### 2.4 Offline First

The first complete product should work without network access after initial load/install.

Offline features:

- Classic mode.
- Challenge mode.
- Daily challenge generated from date seed.
- Practice mode.
- Local progress.
- Local high scores.
- Local achievements.
- Local settings.

Cloud, accounts, online leaderboards, and online multiplayer are explicitly out of scope for the first version.

## 3. Recommended Technology Stack

### 3.1 Runtime Stack

- Language: TypeScript.
- Build tool: Vite.
- Game engine: Phaser.
- UI layer: HTML/CSS or React overlay.
- Persistence: localStorage for small settings, IndexedDB for structured progress/replays.
- Offline installability: PWA service worker and web app manifest.
- Mobile packaging later: Capacitor.

### 3.2 Testing Stack

- Unit tests: Vitest.
- Browser and responsive tests: Playwright.
- Static quality: TypeScript strict mode, ESLint, Prettier.
- Optional visual regression later: Playwright screenshots.

### 3.3 Asset Strategy

Start with simple generated/vector-like placeholder assets inside Phaser. Replace with polished assets after gameplay is stable.

Asset requirements:

- All assets must have clear license/source.
- Gameplay-critical shapes must stay visually distinct.
- Collectibles, obstacles, cars, lanes, and failure states must be readable on small screens.

## 4. Target Platforms

### 4.1 Primary

- Mobile browser, portrait orientation.
- Desktop browser with keyboard support.

### 4.2 Secondary

- Tablet browser.
- Installable PWA.
- Capacitor Android/iOS package later.

### 4.3 Browser Support Targets

- Chromium-based browsers.
- Safari/WebKit.
- Firefox.

The game must remain playable at common mobile viewport sizes. The logical gameplay area should be stable across devices so difficulty does not change unfairly.

## 5. Game Rules

### 5.1 Board Layout

The game has two road groups:

- Left car group.
- Right car group.

Each group has two lanes:

- Inner lane.
- Outer lane.

Each car can switch between its two lanes only.

### 5.2 Player Input

Mobile:

- Tap left half of screen to switch the left car.
- Tap right half of screen to switch the right car.

Desktop:

- Left car: `A` or left arrow.
- Right car: `L` or right arrow.
- Pause: `Esc` or `P`.

Input must be accepted during active gameplay only. Menus and overlays should not accidentally trigger car movement.

### 5.3 Objects

Required collectibles:

- Must be collected by the matching car.
- Missing one ends the run.

Obstacles:

- Must be avoided.
- Collision ends the run.

Objects move from spawn position toward the player cars. Difficulty increases through speed, density, timing, and pattern complexity.

### 5.4 Fail Conditions

The run ends when:

- A car collides with an obstacle.
- A required collectible passes the collection zone without being collected.

The failure reason must be captured for post-run feedback.

## 6. Game Modes

### 6.1 Classic Mode

Classic is the endless mode inspired by the original game.

Requirements:

- Endless deterministic or pseudo-random pattern generation.
- Increasing speed over time.
- Increasing pattern complexity over time.
- Score increases when collectibles are collected.
- High score is stored locally.
- One mistake ends the run.

Purpose:

- Main replay loop.
- High-score chasing.
- Raw concentration and endurance test.

### 6.2 Challenge Mode

Challenge mode contains finite, structured tracks.

Requirements:

- Tracks are grouped by skill category.
- Each track has a deterministic seed or authored pattern.
- Each track has a defined duration or object count.
- Completing a track unlocks future tracks.
- One mistake ends the attempt.

Skill categories:

- Focus.
- Coordination.
- Pattern Recognition.
- Reaction.
- Endurance.

Star model:

- 1 star: reach 50%.
- 2 stars: reach 80%.
- 3 stars: complete track.

Purpose:

- Convert the game from only endless survival into structured mastery.

### 6.3 Daily Challenge

Daily challenge is a fixed offline challenge generated from the current local date.

Requirements:

- Same local date creates the same daily seed.
- The daily track is finite.
- One attempt can be marked as official, but the player may practice/retry locally if desired.
- Store best daily progress and completion status locally.

Purpose:

- Give players a reason to return without needing internet.

### 6.4 Practice Mode

Practice mode teaches skills without weakening real game modes.

Requirements:

- Practice specific patterns.
- Allow quick restart.
- Optionally slow down speed.
- Optionally isolate left car, right car, or both cars.
- Mistakes should restart the drill or show feedback instead of affecting progress.

Practice drills:

- Left car only.
- Right car only.
- Both cars slow.
- Mirror switch.
- Sync switch.
- Alternating switch.
- Delayed switch.
- Deceptive rhythm.

Purpose:

- Help the player improve concentration, coordination, and pattern recognition.

### 6.5 Future Offline Duel Mode

This is not required for the first single-player version, but the architecture should support it.

Future duel rules:

- Both players receive the same deterministic track.
- Missing collectible or hitting obstacle ends that player's round.
- If both fail, farther progress wins.
- If both complete the track, move to a harder track.
- No artificial combo or timing bonus is required.

Architectural implication:

- Game simulation must support multiple players reading from the same pattern stream.

## 7. Pattern System

The pattern system is the heart of the improved game.

### 7.1 Pattern Types

Focus pattern:

- Long stable sequence followed by a meaningful decision.
- Tests sustained attention.

Mirror pattern:

- Cars require opposite movements.
- Tests independent hand coordination.

Sync pattern:

- Both cars switch together.
- Tests rhythm and simultaneous action.

Alternating pattern:

- Left and right decisions alternate.
- Tests attention shifting.

Delayed switch pattern:

- One car switches now, the other shortly after.
- Tests working memory and sequencing.

Deceptive pattern:

- A repeated rhythm changes unexpectedly.
- Tests pattern recognition instead of autopilot.

Pressure pattern:

- Speed or decision density increases near the end.
- Tests calm under stress.

Recovery pattern:

- Simpler sequence after a hard segment.
- Tests ability to regain focus.

### 7.2 Pattern Data Model

Pattern generation should output a stream of object spawn events.

Each event should include:

- `id`: stable event id.
- `timeMs`: spawn time or logical beat.
- `side`: left or right road group.
- `lane`: lane index within that group.
- `kind`: collectible or obstacle.
- `skillTags`: related skill categories.
- `required`: true for collectibles in normal modes.

Do not tie pattern data to Phaser display objects. Pattern data should be pure TypeScript and unit-testable.

### 7.3 Seeded Generation

The generator should accept:

- Mode.
- Seed.
- Difficulty level.
- Duration or object count.
- Allowed pattern types.

The generator should produce stable output for the same inputs.

Important rule:

- Randomness must go through a seeded RNG wrapper. Avoid direct `Math.random()` in game logic.

## 8. Difficulty Model

Difficulty should progress across several dimensions:

- Object speed.
- Spawn interval.
- Simultaneous decisions.
- Alternating left/right pressure.
- Pattern deception.
- Track length.
- Reduced recovery windows.

Difficulty should not progress through:

- Unreadable visual clutter.
- Inconsistent hitboxes.
- Device-dependent speed.
- Random unfair object placement.

Difficulty tiers:

- Tier 1: introduction, slow, simple decisions.
- Tier 2: basic simultaneous movement.
- Tier 3: alternating and delayed patterns.
- Tier 4: deceptive rhythm and increased speed.
- Tier 5: expert density and endurance pressure.

## 9. Scoring And Progress

### 9.1 Classic Score

Classic score should be simple:

- +1 per collected required collectible.
- Run ends on missed collectible or obstacle collision.

Optional later:

- Distance reached.
- Speed level reached.

Avoid combo multipliers in Classic because the no-miss rule already rewards consistency.

### 9.2 Challenge Progress

Challenge progress should track:

- Best percent reached.
- Stars earned.
- Completion status.
- Failure reason.
- Failed pattern type.

### 9.3 Daily Progress

Daily progress should track:

- Date key.
- Seed.
- Best percent reached.
- Completed or not.
- Attempts count.

### 9.4 Practice Progress

Practice progress should track:

- Drill id.
- Attempts.
- Best completion.
- Common failure reason.

## 10. UX And Screen Flow

### 10.1 Main Screens

- Boot/loading screen.
- Home screen.
- Mode select.
- Classic setup/start.
- Challenge map/list.
- Daily challenge screen.
- Practice drill list.
- Gameplay screen.
- Pause overlay.
- Run summary.
- Settings.
- Theme/skin selection.

### 10.2 Gameplay UI

Gameplay UI must be minimal:

- Current score or progress.
- Pause button.
- Optional skill/mode label.

Avoid visible instructional text during active play. Instruction belongs in onboarding, menus, or practice.

### 10.3 Run Summary

After failure or completion, show:

- Result.
- Score or progress.
- Failure reason.
- Failed side.
- Failed pattern type if known.
- Best score/progress comparison.
- Recommended practice drill if relevant.
- Restart and mode select actions.

### 10.4 Replay Last Mistake

Replay-last-mistake should show the final 3 to 5 seconds of the run.

Implementation approach:

- Store recent simulation snapshots or inputs plus seed/time window.
- Replay visually without allowing input.
- Keep it optional from the summary screen.

This feature can be added after the core game is stable.

## 11. Persistence

### 11.1 Storage Choice

Use localStorage for:

- Settings.
- Selected theme.
- Selected car skin.
- Simple high scores.

Use IndexedDB for:

- Challenge progress.
- Daily history.
- Practice stats.
- Replay metadata.
- Larger structured data.

### 11.2 Save Data Versioning

All persisted state should include a schema version.

Example:

```ts
type SaveFile = {
  schemaVersion: number;
  settings: SettingsState;
  progress: ProgressState;
};
```

When the schema changes, add a migration instead of breaking old saves.

## 12. Architecture

### 12.1 High-Level Boundaries

Keep the game split into pure logic and platform/rendering code.

Pure core:

- Rules.
- Pattern generation.
- Collision decisions.
- Difficulty model.
- Progress calculations.
- Mode configs.

Phaser layer:

- Scenes.
- Rendering.
- Animation.
- Audio.
- Input wiring.
- Camera.

UI layer:

- Menus.
- Settings.
- Progress screens.
- Summary screens.

Persistence layer:

- Save/load.
- Migrations.
- IndexedDB/localStorage adapters.

### 12.2 Proposed Source Structure

```text
src/
  app/
    main.ts
    gameConfig.ts
  core/
    constants.ts
    types.ts
    rng.ts
    patterns/
      patternTypes.ts
      patternGenerator.ts
      authoredTracks.ts
      dailySeed.ts
    rules/
      simulation.ts
      collisions.ts
      scoring.ts
      failReasons.ts
    difficulty/
      difficultyModel.ts
    modes/
      classicMode.ts
      challengeMode.ts
      dailyMode.ts
      practiceMode.ts
  game/
    scenes/
      BootScene.ts
      PreloadScene.ts
      MenuScene.ts
      GameplayScene.ts
      SummaryScene.ts
    objects/
      CarView.ts
      RoadView.ts
      ObjectView.ts
    input/
      inputController.ts
    audio/
      audioController.ts
    theme/
      themeRegistry.ts
  ui/
    components/
    screens/
    styles/
  persistence/
    storage.ts
    localStorageAdapter.ts
    indexedDbAdapter.ts
    migrations.ts
  tests/
    testHelpers.ts
```

The exact structure can change during implementation, but the boundaries should remain.

### 12.3 Simulation Contract

The simulation should expose a small API:

```ts
type SimulationInput =
  | { type: "TOGGLE_LEFT"; atMs: number }
  | { type: "TOGGLE_RIGHT"; atMs: number }
  | { type: "PAUSE"; atMs: number }
  | { type: "RESUME"; atMs: number };

type SimulationState = {
  timeMs: number;
  cars: CarState[];
  objects: ActiveObjectState[];
  score: number;
  status: "ready" | "running" | "paused" | "failed" | "completed";
  failure?: FailureState;
};
```

The Phaser scene should render `SimulationState`; it should not own the rules.

## 13. Performance Requirements

Targets:

- Gameplay should feel responsive at 60 FPS on normal phones.
- Input should be processed in the same frame or next simulation tick.
- Avoid allocating many objects every frame.
- Reuse object views through pooling.
- Keep DOM updates out of the active game loop.

Implementation requirements:

- Use fixed logical dimensions for gameplay.
- Use responsive scaling for display.
- Use object pools for collectibles and obstacles.
- Avoid large textures in the first prototype.
- Profile on mobile viewport before adding visual effects.

## 14. Accessibility And Comfort

Requirements:

- High contrast between cars, collectibles, obstacles, and road.
- Reduced motion option for menus/effects.
- Audio mute option.
- Haptic feedback only if platform supports it and user enables it.
- No critical information communicated by color alone.

Because this is a concentration game, visual clarity is part of the core design.

## 15. Testing Strategy

### 15.1 Unit Tests

Unit-test pure core logic:

- Seeded RNG stability.
- Pattern generator determinism.
- Collision outcomes.
- Missed collectible detection.
- Score updates.
- Difficulty progression.
- Daily seed generation.
- Save migration behavior.

### 15.2 Integration Tests

Test mode-level behavior:

- Classic starts, runs, scores, and fails correctly.
- Challenge computes percent and stars correctly.
- Daily challenge seed is stable for a date.
- Practice mode restart works.

### 15.3 Browser Tests

Use Playwright for:

- Game boots.
- Main menu loads.
- Gameplay can start.
- Left and right controls work with keyboard.
- Touch/pointer controls work by screen half.
- Pause/resume works.
- Game over summary appears.
- Layout fits mobile and desktop viewports.

### 15.4 Manual QA Checklist

Before each milestone is considered done:

- Game starts from a fresh load.
- No console errors.
- Controls feel immediate.
- Failure reasons are correct.
- UI text does not overlap on mobile.
- Gameplay area is centered and readable.
- Restart works repeatedly.
- Existing modes still work.

## 16. Implementation Milestones

Each milestone should end with a playable or testable build.

### Milestone 0: Project Setup

Goal:

- Create Vite + TypeScript project.
- Add Phaser.
- Add linting/formatting.
- Add Vitest.
- Add Playwright.
- Add basic PWA scaffolding later or placeholder config.

Acceptance:

- `npm run dev` starts the project.
- `npm run build` succeeds.
- `npm run test` succeeds.
- `npm run test:e2e` can open a blank app route.

### Milestone 1: Playable Core Prototype

Goal:

- Render two roads and two cars.
- Support left/right switching.
- Spawn simple collectibles and obstacles.
- Detect collection, missed collectible, and obstacle collision.
- Show game over and restart.

Acceptance:

- The game is playable from start to failure.
- Missing a collectible ends the run.
- Hitting an obstacle ends the run.
- Restart resets state.
- Unit tests cover collisions and scoring.

### Milestone 2: Deterministic Pattern Engine

Goal:

- Replace ad hoc spawning with seeded pattern generation.
- Add pure pattern data model.
- Add seeded RNG.
- Add basic pattern tags.

Acceptance:

- Same seed creates same object events.
- Different seed creates different but valid events.
- No direct `Math.random()` in core logic.
- Pattern generator has unit tests.

### Milestone 3: Classic Mode

Goal:

- Build polished endless Classic mode.
- Add difficulty progression.
- Add local high score.
- Add start, pause, resume, restart.

Acceptance:

- Classic mode is fun for at least several minutes.
- Speed increases predictably.
- High score persists after reload.
- Pause does not corrupt state.

### Milestone 4: Menu And UX Foundation

Goal:

- Add clean home screen.
- Add mode selection.
- Add settings.
- Add run summary.

Acceptance:

- User can navigate without browser refresh.
- Summary reports failure reason.
- Mobile and desktop layouts are readable.
- Playwright verifies primary flows.

### Milestone 5: Challenge Mode

Goal:

- Add finite tracks.
- Add skill categories.
- Add star progress.
- Add local unlock/progress persistence.

Acceptance:

- At least 5 starter challenge tracks exist.
- Each track has deterministic behavior.
- Progress and stars persist.
- Failed pattern type is captured when possible.

### Milestone 6: Practice Mode

Goal:

- Add drills for individual skill development.
- Add quick restart.
- Add optional slower speed.

Acceptance:

- Left-only, right-only, mirror, sync, and alternating drills exist.
- Practice does not affect challenge progress or high score.
- Recommendations can link to practice drill ids.

### Milestone 7: Daily Challenge

Goal:

- Add date-seeded daily track.
- Add daily progress history.
- Add daily result screen.

Acceptance:

- Same date produces same track.
- Different date produces different track.
- Daily progress persists locally.
- Works offline.

### Milestone 8: Engagement Layer

Goal:

- Add achievements.
- Add cosmetic unlocks.
- Add theme and car skin selection.
- Add training calendar.

Acceptance:

- Unlocks are cosmetic only.
- Achievement rules are deterministic and tested.
- Selected theme persists.
- Gameplay readability remains strong.

### Milestone 9: Replay Last Mistake

Goal:

- Add final 3 to 5 second replay from summary screen.

Acceptance:

- Replay shows the correct final mistake.
- Replay does not allow input.
- Replay works for Classic and Challenge.
- Replay storage is bounded.

### Milestone 10: PWA And Offline Hardening

Goal:

- Add manifest.
- Add service worker.
- Cache required assets.
- Verify offline launch after first load.

Acceptance:

- App can be installed as PWA where supported.
- Reload works offline.
- Core assets load offline.
- Save data remains local.

### Milestone 11: Polish And Device QA

Goal:

- Polish visuals, motion, audio, and responsiveness.
- Test mobile, tablet, and desktop viewports.

Acceptance:

- No overlapping UI text.
- Game is readable on small screens.
- Input remains responsive.
- Performance is stable on target devices.

## 17. Implementation Guardrails

Follow these rules while building:

- Keep pure logic independent from Phaser.
- Add tests for core behavior before adding more modes.
- Do not introduce network dependencies for offline features.
- Keep active gameplay UI minimal.
- Do not add gameplay-saving power-ups to Classic or Challenge.
- Use seeded RNG for all pattern logic.
- Keep persistence versioned.
- Do not let visual themes change hitboxes or difficulty.
- Keep each milestone runnable before moving on.
- Prefer small, reversible changes over large rewrites.

## 18. Definition Of Done

A feature is done only when:

- It works in the game.
- It has relevant tests.
- It does not break existing modes.
- It stores or migrates data correctly if persistence is involved.
- It fits mobile and desktop layouts.
- It follows the original ideology of focus, coordination, decision-making, and pattern recognition.

## 19. First Prototype Scope

The first prototype should not try to implement every feature. It should prove the game feel and architecture.

Prototype must include:

- Vite + TypeScript + Phaser setup.
- Two cars.
- Two lanes per side.
- Tap/keyboard controls.
- Collectibles and obstacles.
- One-mistake fail conditions.
- Restart.
- Basic score.
- Deterministic pattern generator.
- Unit tests for core rules.
- Browser test for boot and basic play.

Prototype should exclude:

- Themes.
- Achievements.
- Daily challenge.
- Replay.
- PWA.
- Practice mode.
- Challenge progression.

Once the prototype feels right, build the rest through the milestone sequence.

## 20. Open Product Decisions

These should be decided during or after the playable prototype:

- Exact logical game resolution.
- Final visual style.
- Challenge track duration.
- Whether Daily Challenge allows unlimited retries or one official attempt.
- Whether Practice Mode should show coaching hints during drills.
- How much failure feedback is useful without distracting the player.
- Whether future offline 1v1 duel mode is same-device split screen or turn-based shared challenge.

## 21. Suggested Commands

These commands should exist once the project is scaffolded:

```text
npm run dev
npm run build
npm run test
npm run test:watch
npm run test:e2e
npm run lint
npm run format
```

No milestone should be considered complete unless the relevant commands pass.
