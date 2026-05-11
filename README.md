# Multi Cars

A focused offline browser game inspired by Two Cars. The player controls two cars at the same time, switches each car between two lanes, collects required targets, and avoids obstacles. One missed collectible or one obstacle collision ends the run.

The current build is a playable prototype with a React/Tailwind app shell and a Phaser gameplay canvas. The design goal is to improve concentration, accurate decision-making, two-hand coordination, and pattern recognition without weakening the original difficulty.

## Current State

- Classic mode is playable as an endless run.
- Challenge Roads are playable as finite authored tracks with categories, locked levels, progress, and stars.
- Practice Drills are playable as finite focused drills without high-score or Challenge progress writes.
- Daily Road is playable as a date-seeded finite route with isolated local progress.
- Garage is available with local achievements and cosmetic-only car skins.
- Control Room can opt into power ups and obstacle variety for generated runs; all modifiers are off by default.
- The main menu, Challenge selection, Settings, and Run Ended summary are React/Tailwind screens.
- Phaser owns the active gameplay canvas only.
- Gameplay supports keyboard, pointer, and mobile touch controls.
- Local high score and Challenge progress are persisted in browser storage.
- The gameplay visuals have richer road styling, animated lane motion, improved car silhouettes, and polished lane-change animation.
- Unit and browser tests cover the current core loop, modes, persistence, navigation, mobile scroll, and touch split behavior.

## Tech Stack

- TypeScript
- Vite
- React
- Tailwind CSS
- Phaser 3
- Vitest
- Playwright

## Getting Started

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

## Scripts

```bash
npm run dev        # Start Vite dev server
npm run build      # Type-check and build production assets
npm run preview    # Preview the production build
npm run test       # Run Vitest unit tests
npm run test:watch # Run Vitest in watch mode
npm run test:e2e   # Run Playwright browser tests
npm run lint       # Type-check only
npm run format     # Format the repository with Prettier
```

## Controls

Desktop:

- Left car: `A` or left arrow
- Right car: `L` or right arrow
- Pause: `P` or `Esc`
- Summary replay: `R` or Enter
- Summary menu: `M` or `Esc`

Mobile and pointer:

- Tap the left half of the canvas to switch the left car.
- Tap the right half of the canvas to switch the right car.

## Game Modes

### Classic

Classic is the endless high-score mode. It uses deterministic seeded pattern generation, increasing speed, local high-score persistence, and the original one-mistake fail rules.

### Challenge Roads

Challenge Roads are finite authored tracks organized by skill category and level. Current categories include focus, coordination, recognition, and reaction. Challenge progress stores best percent, stars, completion state, and attempts locally.

### Practice Drills

Practice Drills are finite deterministic routes for specific skills: left-hand focus, right-hand focus, mirror switches, sync lanes, and alternating rhythm. They keep the same fail rules as the main game, but do not write Classic high score or Challenge progress.

### Daily Road

Daily Road is a finite generated route based on the local calendar date. The same date produces the same route offline. Daily best percent, best score, stars, completion, and attempts are stored separately from other modes.

### Garage

Garage contains local achievements and cosmetic-only car skins. Achievement unlocks can reveal skins, but rewards never change gameplay speed, scoring, hitboxes, lives, or fail conditions.

### Control Room Modifiers

Power ups and advanced obstacle variety are opt-in settings. Enabled power ups can add shield, slow motion, magnet, score multiplier pickups, and dual-collect pairs. Enabled obstacle variety can add moving obstacles, fake collectibles, timed gates, and color-matching objects where wrong colors act as traps.

## Project Structure

```text
src/app/                 React app shell, UI screens, Phaser mount, event bridge
src/core/                Deterministic game rules, modes, engagement, patterns, scoring, types
src/game/scenes/         Phaser gameplay scene and legacy scene files
src/persistence/         Browser storage helpers
tests/                   Vitest unit tests
e2e/                     Playwright browser tests
docs/                    Planning guide and checkpoint tracker
```

Key files:

- `src/app/App.tsx`: React shell for menu, Challenge selection, settings, gameplay host, and summary overlay.
- `src/game/scenes/GameplayScene.ts`: Phaser gameplay rendering, input, HUD, and mode handoff.
- `src/core/rules/simulation.ts`: deterministic simulation lifecycle and fail conditions.
- `src/core/modes/classicMode.ts`: Classic run configuration and summaries.
- `src/core/modes/challengeMode.ts`: Challenge run configuration, progress, and stars.
- `src/core/modes/practiceMode.ts`: Practice drill definitions, deterministic runs, and summaries.
- `src/core/modes/dailyMode.ts`: Daily route generation, progress, stars, and summaries.
- `src/core/engagement/achievements.ts`: Achievement rules and cosmetic car skin definitions.
- `src/core/modifiers/gameplayModifiers.ts`: opt-in power-up and obstacle-variety settings.
- `src/core/patterns/authoredTracks.ts`: authored Challenge road definitions.
- `docs/CHECKPOINTS.md`: current implementation status and next checkpoint.
- `docs/PLANNING_AND_IMPLEMENTATION.md`: full planning and implementation guide.

## Verification

Latest documented verification:

```text
npm run test      -> passed, 63 tests
npm run build     -> passed
npm run test:e2e  -> passed, 31 browser tests, 7 expected project-specific skips
```

## Next Planned Milestone

The active next checkpoint is Replay Last Mistake:

- Capture the final few seconds before failure.
- Add a non-interactive replay view from the summary screen.
- Keep replay local and optional.
- Preserve normal summary replay and menu actions.

See `docs/CHECKPOINTS.md` for the live checkpoint tracker.
