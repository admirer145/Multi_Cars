import { describe, expect, it } from "vitest";
import {
  calculateDailyStars,
  createDailyRun,
  createDailyRunSummary,
  createInitialDailyProgress,
  updateDailyProgress,
} from "../src/core/modes/dailyMode";
import { GameSimulation } from "../src/core/rules/simulation";
import { loadDailyProgress, saveDailyProgress, type StorageLike } from "../src/persistence/storage";

describe("daily mode", () => {
  it("creates deterministic runs for the same local date", () => {
    const date = new Date(2026, 4, 11);
    const first = createDailyRun(date);
    const second = createDailyRun(date);

    expect(first.dateKey).toBe("daily-2026-05-11");
    expect(first.config).toEqual(second.config);
    expect(first.pattern).toEqual(second.pattern);
  });

  it("changes route seed by local date", () => {
    const first = createDailyRun(new Date(2026, 4, 11));
    const second = createDailyRun(new Date(2026, 4, 12));

    expect(first.config.seed).not.toBe(second.config.seed);
    expect(first.pattern).not.toEqual(second.pattern);
  });

  it("calculates stars from progress percent", () => {
    expect(calculateDailyStars(49)).toBe(0);
    expect(calculateDailyStars(50)).toBe(1);
    expect(calculateDailyStars(80)).toBe(2);
    expect(calculateDailyStars(100)).toBe(3);
  });

  it("updates progress without lowering prior bests", () => {
    const initial = createInitialDailyProgress("daily-2026-05-11");
    const first = updateDailyProgress(initial, 82, 12);
    const second = updateDailyProgress(first, 30, 4);

    expect(second).toMatchObject({
      dateKey: "daily-2026-05-11",
      bestPercent: 82,
      bestScore: 12,
      stars: 2,
      completed: false,
      attempts: 2,
    });
  });

  it("summarizes daily runs with current stars and stored best score", () => {
    const run = createDailyRun(new Date(2026, 4, 11));
    const simulation = new GameSimulation(run.config, run.pattern);

    simulation.step(1200);
    const state = simulation.getState();
    state.completedPercent = 55;
    state.score = 7;
    const progress = updateDailyProgress(createInitialDailyProgress(run.dateKey), 82, 14);
    const summary = createDailyRunSummary(state, run.config, progress);

    expect(summary).toMatchObject({
      modeId: "daily",
      modeLabel: "Daily Road",
      seed: "daily-2026-05-11",
      score: 7,
      bestScore: 14,
      completedPercent: 55,
      stars: 1,
    });
  });
});

describe("daily progress storage", () => {
  it("loads fallback progress when no save exists", () => {
    const fallback = createInitialDailyProgress("daily-2026-05-11");

    expect(loadDailyProgress("daily-2026-05-11", fallback, createMemoryStorage())).toEqual(fallback);
  });

  it("saves and loads daily progress", () => {
    const storage = createMemoryStorage();
    const progress = updateDailyProgress(createInitialDailyProgress("daily-2026-05-11"), 100, 20);

    saveDailyProgress(progress, storage);

    expect(loadDailyProgress("daily-2026-05-11", createInitialDailyProgress("daily-2026-05-11"), storage))
      .toMatchObject({
        bestPercent: 100,
        bestScore: 20,
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
