import { describe, expect, it } from "vitest";
import {
  createInitialPracticeProgress,
  createPracticeRun,
  createPracticeRunSummary,
  PRACTICE_DRILLS,
  updatePracticeProgress,
} from "../src/core/modes/practiceMode";
import { validatePattern } from "../src/core/patterns/patternValidation";
import { GameSimulation } from "../src/core/rules/simulation";
import { loadPracticeProgress, savePracticeProgress, type StorageLike } from "../src/persistence/storage";

describe("practice mode", () => {
  it("defines the starter drill set", () => {
    expect(PRACTICE_DRILLS.map((drill) => drill.id)).toEqual([
      "left-hand-focus",
      "right-hand-focus",
      "mirror-switches",
      "sync-lanes",
      "alternating-rhythm",
    ]);
  });

  it("creates deterministic drill runs", () => {
    const first = createPracticeRun("mirror-switches");
    const second = createPracticeRun("mirror-switches");

    expect(first.config).toEqual(second.config);
    expect(first.pattern).toEqual(second.pattern);
    expect(first.pattern.every((event) => event.id.startsWith("mirror-switches"))).toBe(true);
  });

  it("builds valid repeated drill patterns", () => {
    for (const drill of PRACTICE_DRILLS) {
      const run = createPracticeRun(drill.id);

      expect(run.pattern.length).toBeGreaterThan(drill.events.length);
      expect(run.pattern.at(-1)?.timeMs).toBeLessThanOrEqual(run.config.durationMs);
      expect(validatePattern(run.pattern, run.config)).toEqual([]);
    }
  });

  it("keeps one-hand drills scoped to the intended side", () => {
    const left = createPracticeRun("left-hand-focus");
    const right = createPracticeRun("right-hand-focus");

    expect(new Set(left.pattern.map((event) => event.side))).toEqual(new Set(["left"]));
    expect(new Set(right.pattern.map((event) => event.side))).toEqual(new Set(["right"]));
  });

  it("updates practice progress with best percent, best score, completion, and attempts", () => {
    const initial = createInitialPracticeProgress("left-hand-focus");
    const first = updatePracticeProgress(initial, 72, 8);
    const second = updatePracticeProgress(first, 40, 12);

    expect(second).toMatchObject({
      drillId: "left-hand-focus",
      bestPercent: 72,
      bestScore: 12,
      completed: false,
      attempts: 2,
    });

    expect(updatePracticeProgress(second, 100, 10)).toMatchObject({
      bestPercent: 100,
      bestScore: 12,
      completed: true,
      attempts: 3,
    });
  });

  it("summarizes practice runs with saved best progress", () => {
    const run = createPracticeRun("left-hand-focus");
    const simulation = new GameSimulation(run.config, run.pattern);
    const progress = updatePracticeProgress(createInitialPracticeProgress(run.drill.id), 82, 11);

    simulation.step(1200);
    const summary = createPracticeRunSummary(simulation.getState(), run.config, progress);

    expect(summary).toMatchObject({
      modeId: "practice",
      modeLabel: "Left Hand Focus",
      seed: "practice-left-hand-focus",
      bestScore: 82,
    });
  });

  it("persists practice progress per drill", () => {
    const storage = createMemoryStorage();
    const progress = updatePracticeProgress(createInitialPracticeProgress("left-hand-focus"), 75, 9);

    savePracticeProgress(progress, storage);

    expect(loadPracticeProgress("left-hand-focus", createInitialPracticeProgress("left-hand-focus"), storage))
      .toMatchObject({
        drillId: "left-hand-focus",
        bestPercent: 75,
        bestScore: 9,
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
