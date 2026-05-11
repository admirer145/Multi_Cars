import { describe, expect, it } from "vitest";
import {
  createClassicMode,
  createClassicRun,
  createClassicRunSummary,
  createClassicSeed,
  getClassicSpeedLevel,
} from "../src/core/modes/classicMode";
import { GameSimulation } from "../src/core/rules/simulation";
import { loadClassicHighScore, saveClassicHighScore, type StorageLike } from "../src/persistence/storage";

describe("classic mode", () => {
  it("creates stable run seeds from run indexes", () => {
    expect(createClassicSeed(0)).toBe("classic-v1-run-0");
    expect(createClassicSeed(2)).toBe("classic-v1-run-2");
  });

  it("creates deterministic run patterns for the same run index", () => {
    const first = createClassicRun(1);
    const second = createClassicRun(1);

    expect(first.config).toEqual(second.config);
    expect(first.pattern).toEqual(second.pattern);
  });

  it("creates different run patterns for different run indexes", () => {
    const first = createClassicRun(1);
    const second = createClassicRun(2);

    expect(first.config.seed).not.toBe(second.config.seed);
    expect(first.pattern).not.toEqual(second.pattern);
  });

  it("uses a predictable speed level curve", () => {
    expect(getClassicSpeedLevel(0)).toBe(1);
    expect(getClassicSpeedLevel(15_000)).toBe(2);
    expect(getClassicSpeedLevel(120_000)).toBe(9);
  });

  it("keeps classic running past the generated pattern window", () => {
    const config = createClassicMode({ seed: "endless", durationMs: 1_000 });
    const simulation = new GameSimulation(config, []);

    simulation.step(2_000);

    expect(simulation.getState()).toMatchObject({
      status: "running",
      completedPercent: 0,
    });
  });

  it("summarizes failed runs with failure metadata", () => {
    const config = createClassicMode({ seed: "summary", durationMs: 10_000 });
    const simulation = new GameSimulation(config, [
      {
        id: "miss",
        timeMs: 0,
        side: "left",
        lane: 1,
        kind: "collectible",
        required: true,
        skillTags: ["focus"],
        patternFamily: "focus",
      },
    ]);

    simulation.step(3000);
    const summary = createClassicRunSummary(simulation.getState(), config, 4);

    expect(summary).toMatchObject({
      modeId: "classic",
      seed: "summary",
      score: 0,
      bestScore: 4,
      result: "failed",
      failureReason: "missed-collectible",
      failedPatternFamily: "focus",
    });
  });
});

describe("classic high score storage", () => {
  it("loads zero when no score exists", () => {
    expect(loadClassicHighScore(createMemoryStorage())).toBe(0);
  });

  it("only saves higher scores", () => {
    const storage = createMemoryStorage();

    saveClassicHighScore(8, storage);
    saveClassicHighScore(4, storage);

    expect(loadClassicHighScore(storage)).toBe(8);
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
