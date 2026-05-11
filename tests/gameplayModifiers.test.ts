import { describe, expect, it } from "vitest";
import { createClassicRun } from "../src/core/modes/classicMode";
import {
  getEnabledObstacleVarieties,
  getEnabledPowerUps,
  normalizeGameplayModifierSettings,
} from "../src/core/modifiers/gameplayModifiers";
import {
  loadGameplayModifierSettings,
  saveGameplayModifierSettings,
  type StorageLike,
} from "../src/persistence/storage";

describe("gameplay modifiers", () => {
  it("keeps all modifiers disabled by default", () => {
    const settings = normalizeGameplayModifierSettings();

    expect(getEnabledPowerUps(settings)).toEqual([]);
    expect(getEnabledObstacleVarieties(settings)).toEqual([]);
  });

  it("persists normalized Control Room modifier settings", () => {
    const storage = createMemoryStorage();

    const saved = saveGameplayModifierSettings(
      {
        powerUps: {
          shield: true,
          magnet: true,
        },
        obstacleVariety: {
          "fake-collectibles": true,
          "timed-gates": true,
        },
      },
      storage,
    );

    expect(saved.powerUps.shield).toBe(true);
    expect(saved.powerUps.magnet).toBe(true);
    expect(saved.powerUps["slow-motion"]).toBe(false);
    expect(saved.obstacleVariety["fake-collectibles"]).toBe(true);
    expect(saved.obstacleVariety["timed-gates"]).toBe(true);
    expect(loadGameplayModifierSettings(storage)).toEqual(saved);
  });

  it("does not decorate classic patterns unless modifiers are enabled", () => {
    const run = createClassicRun(3);

    expect(run.pattern.every((event) => event.kind === "collectible" || event.kind === "obstacle"))
      .toBe(true);
  });

  it("decorates generated runs with enabled power ups and obstacle variety", () => {
    const run = createClassicRun(
      6,
      undefined,
      normalizeGameplayModifierSettings({
        powerUps: {
          shield: true,
          "score-multiplier": true,
          "dual-collect": true,
        },
        obstacleVariety: {
          "moving-obstacles": true,
          "fake-collectibles": true,
          "color-match": true,
        },
      }),
    );
    expect(run.pattern.some((event) => event.kind === "power-up")).toBe(true);
    expect(
      run.pattern.some((event) =>
        ["moving-obstacle", "fake-collectible", "color-match", "dual-collect"].includes(event.kind),
      ),
    ).toBe(true);
  });

  it("creates both matching and wrong-color color match objects", () => {
    const colorMatchEvents = Array.from({ length: 16 }, (_, index) =>
      createClassicRun(
        index,
        undefined,
        normalizeGameplayModifierSettings({
          obstacleVariety: {
            "color-match": true,
          },
        }),
      ),
    ).flatMap((run) => run.pattern.filter((event) => event.kind === "color-match"));

    expect(colorMatchEvents.some((event) => event.colorKey === event.side && event.required)).toBe(true);
    expect(colorMatchEvents.some((event) => event.colorKey !== event.side && !event.required)).toBe(true);
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
