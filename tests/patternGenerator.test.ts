import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createClassicMode } from "../src/core/difficulty/difficultyModel";
import { AUTHORED_TRACKS, buildAuthoredPattern } from "../src/core/patterns/authoredTracks";
import { createDailySeed } from "../src/core/patterns/dailySeed";
import { generatePattern } from "../src/core/patterns/patternGenerator";
import { validatePattern } from "../src/core/patterns/patternValidation";
import { DEFAULT_PATTERN_FAMILY_ORDER } from "../src/core/patterns/patternTypes";
import type { PatternEvent } from "../src/core/types";

describe("pattern generation", () => {
  it("is deterministic for the same mode config", () => {
    const config = createClassicMode("same-seed");

    expect(generatePattern(config)).toEqual(generatePattern(config));
  });

  it("changes when the seed changes", () => {
    const first = generatePattern(createClassicMode("seed-a"));
    const second = generatePattern(createClassicMode("seed-b"));

    expect(first).not.toEqual(second);
  });

  it("attaches pattern metadata to every generated event", () => {
    const events = generatePattern(createClassicMode("metadata"));

    expect(events.length).toBeGreaterThan(0);
    expect(events.every((event) => DEFAULT_PATTERN_FAMILY_ORDER.includes(event.patternFamily))).toBe(true);
    expect(events.every((event) => event.skillTags.length > 0)).toBe(true);
  });

  it("generates valid events for every individual pattern family", () => {
    for (const family of DEFAULT_PATTERN_FAMILY_ORDER) {
      const config = {
        ...createClassicMode(`family-${family}`),
        allowedFamilies: [family],
        durationMs: 10_000,
      };
      const events = generatePattern(config);

      expect(events.length).toBeGreaterThan(0);
      expect(events.every((event) => event.patternFamily === family || event.patternFamily === "focus")).toBe(
        true,
      );
      expect(validatePattern(events, config)).toEqual([]);
    }
  });

  it("rejects same-side events at the same time", () => {
    const config = createClassicMode("invalid-conflict");
    const events: PatternEvent[] = [
      {
        id: "a",
        timeMs: 1000,
        side: "left",
        lane: 0,
        kind: "collectible",
        required: true,
        skillTags: ["focus"],
        patternFamily: "focus",
      },
      {
        id: "b",
        timeMs: 1000,
        side: "left",
        lane: 1,
        kind: "obstacle",
        required: false,
        skillTags: ["focus"],
        patternFamily: "focus",
      },
    ];

    expect(validatePattern(events, config).map((issue) => issue.code)).toContain("side-time-conflict");
  });

  it("builds valid authored starter tracks", () => {
    const config = {
      ...createClassicMode("authored"),
      durationMs: 140_000,
      endless: false,
    };

    for (const track of AUTHORED_TRACKS) {
      const events = buildAuthoredPattern(track, config);

      expect(events.length).toBeGreaterThanOrEqual(track.events.length);
      expect(events.at(-1)?.timeMs).toBeLessThanOrEqual(config.durationMs);
      expect(validatePattern(events, config)).toEqual([]);
    }
  });

  it("creates stable daily seeds from local calendar dates", () => {
    const seed = createDailySeed(new Date(2026, 4, 10));

    expect(seed).toBe("daily-2026-05-10");
  });

  it("keeps core gameplay free of direct Math.random calls", () => {
    const coreFiles = listTypeScriptFiles("src/core");

    for (const file of coreFiles) {
      expect(readFileSync(file, "utf8"), file).not.toContain("Math.random");
    }
  });
});

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      return listTypeScriptFiles(path);
    }

    return path.endsWith(".ts") ? [path] : [];
  });
}
