import { describe, expect, it } from "vitest";
import {
  createPracticeRun,
  createPracticeRunSummary,
  PRACTICE_DRILLS,
} from "../src/core/modes/practiceMode";
import { validatePattern } from "../src/core/patterns/patternValidation";
import { GameSimulation } from "../src/core/rules/simulation";

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

  it("summarizes practice runs without persistent best score", () => {
    const run = createPracticeRun("left-hand-focus");
    const simulation = new GameSimulation(run.config, run.pattern);

    simulation.step(1200);
    const summary = createPracticeRunSummary(simulation.getState(), run.config);

    expect(summary).toMatchObject({
      modeId: "practice",
      modeLabel: "Left Hand Focus",
      seed: "practice-left-hand-focus",
      bestScore: 0,
    });
  });
});
