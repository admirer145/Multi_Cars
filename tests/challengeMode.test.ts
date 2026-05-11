import { describe, expect, it } from "vitest";
import {
  calculateChallengeStars,
  createChallengeRun,
  createChallengeRunSummary,
  createInitialChallengeProgress,
  updateChallengeProgress,
} from "../src/core/modes/challengeMode";
import { GameSimulation } from "../src/core/rules/simulation";
import {
  loadChallengeProgress,
  saveChallengeProgress,
  type StorageLike,
} from "../src/persistence/storage";

describe("challenge mode", () => {
  it("creates deterministic authored challenge runs", () => {
    const first = createChallengeRun("starter-focus-01");
    const second = createChallengeRun("starter-focus-01");

    expect(first.config).toEqual(second.config);
    expect(first.pattern).toEqual(second.pattern);
    expect(first.pattern.every((event) => event.id.startsWith("starter-focus-01"))).toBe(true);
  });

  it("calculates mastery stars from progress percent", () => {
    expect(calculateChallengeStars(49)).toBe(0);
    expect(calculateChallengeStars(50)).toBe(1);
    expect(calculateChallengeStars(80)).toBe(2);
    expect(calculateChallengeStars(100)).toBe(3);
  });

  it("updates progress without lowering prior bests", () => {
    const initial = createInitialChallengeProgress("starter-focus-01");
    const first = updateChallengeProgress(initial, 82);
    const second = updateChallengeProgress(first, 30);

    expect(second).toMatchObject({
      trackId: "starter-focus-01",
      bestPercent: 82,
      stars: 2,
      completed: false,
      attempts: 2,
    });
  });

  it("summarizes challenge runs with progress and stars", () => {
    const run = createChallengeRun("starter-focus-01");
    const simulation = new GameSimulation(run.config, run.pattern);

    simulation.step(1200);
    const state = simulation.getState();
    state.completedPercent = 55;
    const progress = updateChallengeProgress(createInitialChallengeProgress(run.track.id), 82);
    const summary = createChallengeRunSummary(state, run.config, progress);

    expect(summary).toMatchObject({
      modeId: "challenge",
      modeLabel: "Focus Road I",
      seed: "challenge-starter-focus-01",
      completedPercent: 55,
      bestScore: 82,
      stars: 1,
    });
  });
});

describe("challenge progress storage", () => {
  it("loads fallback progress when no save exists", () => {
    const fallback = createInitialChallengeProgress("starter-focus-01");

    expect(loadChallengeProgress("starter-focus-01", fallback, createMemoryStorage())).toEqual(fallback);
  });

  it("saves and loads challenge progress", () => {
    const storage = createMemoryStorage();
    const progress = updateChallengeProgress(createInitialChallengeProgress("starter-focus-01"), 100);

    saveChallengeProgress(progress, storage);

    expect(loadChallengeProgress("starter-focus-01", createInitialChallengeProgress("starter-focus-01"), storage))
      .toMatchObject({
        bestPercent: 100,
        stars: 3,
        completed: true,
        attempts: 1,
      });
  });
});

function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}
