import { describe, expect, it } from "vitest";
import { ReplayBuffer } from "../src/core/replay/replayBuffer";
import type { SimulationState } from "../src/core/types";

describe("replay buffer", () => {
  it("keeps only the configured final window", () => {
    const buffer = new ReplayBuffer(500, 0);

    for (let timeMs = 0; timeMs <= 1_000; timeMs += 100) {
      buffer.record(createState(timeMs));
    }

    const clip = buffer.createClip(createState(1_000, "failed"));

    expect(clip.frames[0].atMs).toBeGreaterThanOrEqual(500);
    expect(clip.frames.at(-1)?.state.status).toBe("failed");
    expect(clip.capturedAtMs).toBe(1_000);
  });

  it("samples running states but always includes the final state", () => {
    const buffer = new ReplayBuffer(1_000, 250);

    buffer.record(createState(100));
    buffer.record(createState(150));
    buffer.record(createState(200));

    const clip = buffer.createClip(createState(210, "failed"));

    expect(clip.frames.map((frame) => frame.atMs)).toEqual([100, 210]);
  });

  it("returns cloned frames so replay cannot mutate captured state", () => {
    const buffer = new ReplayBuffer(1_000, 0);
    buffer.record(createState(100));

    const clip = buffer.createClip(createState(200, "failed"));
    clip.frames[0].state.score = 99;
    const secondClip = buffer.createClip(createState(200, "failed"));

    expect(secondClip.frames[0].state.score).toBe(1);
  });
});

function createState(timeMs: number, status: SimulationState["status"] = "running"): SimulationState {
  return {
    timeMs,
    cars: {
      left: { side: "left", lane: 0 },
      right: { side: "right", lane: 1 },
    },
    objects: [],
    score: 1,
    status,
    completedPercent: 0,
    powerUps: {
      shieldCharges: 0,
      slowMotionUntilMs: 0,
      magnetUntilMs: 0,
      scoreMultiplierUntilMs: 0,
    },
  };
}
