# Multi Cars

A focused offline browser game inspired by Two Cars. The player controls two cars at the same time, switches each car between two lanes, collects required targets, and avoids obstacles. One missed collectible or one obstacle collision ends the run.

The current build is a playable prototype with a React/Tailwind app shell and a Phaser gameplay canvas. The design goal is to improve concentration, accurate decision-making, two-hand coordination, and pattern recognition without weakening the original difficulty.

## Current State

- Classic mode is playable as an endless run.
- Challenge Roads are playable as finite authored tracks with categories, locked levels, progress, and stars.
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

## Project Structure

```text
src/app/                 React app shell, UI screens, Phaser mount, event bridge
src/core/                Deterministic game rules, modes, patterns, scoring, types
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
- `src/core/patterns/authoredTracks.ts`: authored Challenge road definitions.
- `docs/CHECKPOINTS.md`: current implementation status and next checkpoint.
- `docs/PLANNING_AND_IMPLEMENTATION.md`: full planning and implementation guide.

## Verification

Latest documented verification:

```text
npm run test      -> passed, 27 tests
npm run build     -> passed
npm run test:e2e  -> passed, 15 browser tests, 5 expected project-specific skips
```

## Next Planned Milestone

The active next checkpoint is Practice Mode:

- Add deterministic skill drills.
- Add a Practice entry to the menu.
- Keep Practice separate from Classic high score and Challenge progress.
- Preserve the same core fail conditions for Classic and Challenge.

See `docs/CHECKPOINTS.md` for the live checkpoint tracker.
