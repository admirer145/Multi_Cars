import { describe, expect, it } from "vitest";
import {
  CAR_SKINS,
  createInitialAchievementState,
  normalizeCarSkinId,
  updateAchievementsForSummary,
} from "../src/core/engagement/achievements";
import type { RunSummary } from "../src/core/types";
import {
  loadAchievementState,
  loadSelectedCarSkin,
  saveAchievementState,
  saveSelectedCarSkin,
  type StorageLike,
} from "../src/persistence/storage";

const baseSummary: RunSummary = {
  modeId: "classic",
  modeLabel: "Classic",
  seed: "classic-v1-run-0",
  score: 0,
  bestScore: 0,
  completedPercent: 0,
  speedLevel: 1,
  result: "failed",
};

describe("achievements", () => {
  it("unlocks deterministic achievements from run summaries", () => {
    const update = updateAchievementsForSummary(createInitialAchievementState(), {
      ...baseSummary,
      modeId: "classic",
      score: 5,
    });

    expect(update.newlyUnlockedIds).toEqual(["first-run", "classic-starter"]);
    expect(update.state.unlockedIds).toEqual(["first-run", "classic-starter"]);
  });

  it("does not unlock the same achievement twice", () => {
    const first = updateAchievementsForSummary(createInitialAchievementState(), {
      ...baseSummary,
      modeId: "daily",
    });
    const second = updateAchievementsForSummary(first.state, {
      ...baseSummary,
      modeId: "daily",
    });

    expect(first.newlyUnlockedIds).toEqual(["first-run", "daily-checkin"]);
    expect(second.newlyUnlockedIds).toEqual([]);
  });

  it("keeps locked cosmetic skins unavailable", () => {
    const state = createInitialAchievementState();
    const storm = CAR_SKINS.find((skin) => skin.id === "storm");

    expect(storm).toBeDefined();
    expect(normalizeCarSkinId("storm", state)).toBe("default");
  });

  it("allows skins unlocked by achievements", () => {
    const state = {
      unlockedIds: ["challenge-scout" as const],
    };

    expect(normalizeCarSkinId("storm", state)).toBe("storm");
  });
});

describe("achievement storage", () => {
  it("saves and loads achievement state", () => {
    const storage = createMemoryStorage();
    saveAchievementState({ unlockedIds: ["first-run"] }, storage);

    expect(loadAchievementState(storage)).toEqual({ unlockedIds: ["first-run"] });
  });

  it("falls back to default skin when a selected skin is locked", () => {
    const storage = createMemoryStorage();
    storage.setItem("multi-cars:selected-car-skin:v1", "solar");

    expect(loadSelectedCarSkin(storage)).toBe("default");
  });

  it("saves selected unlocked skin", () => {
    const storage = createMemoryStorage();
    const state = { unlockedIds: ["daily-checkin" as const] };
    saveAchievementState(state, storage);

    expect(saveSelectedCarSkin("solar", state, storage)).toBe("solar");
    expect(loadSelectedCarSkin(storage)).toBe("solar");
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
