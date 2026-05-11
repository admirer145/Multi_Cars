import { describe, expect, it } from "vitest";
import type { ModeConfig, PatternEvent } from "../src/core/types";
import { GameSimulation } from "../src/core/rules/simulation";

const baseConfig: ModeConfig = {
  id: "test",
  label: "Test",
  seed: "simulation",
  durationMs: 10_000,
  spawnIntervalMs: 1_000,
  objectSpeed: 500,
  difficulty: 1,
};

function createEvent(event: Partial<PatternEvent>): PatternEvent {
  return {
    id: "event-1",
    timeMs: 0,
    side: "left",
    lane: 0,
    kind: "collectible",
    required: true,
    skillTags: ["focus"],
    patternFamily: "focus",
    ...event,
  };
}

describe("game simulation", () => {
  it("collects a required collectible when the car is in the matching lane", () => {
    const simulation = new GameSimulation(baseConfig, [createEvent({})]);

    simulation.step(2300);
    const state = simulation.getState();

    expect(state.status).toBe("running");
    expect(state.score).toBe(1);
  });

  it("fails when a required collectible is missed", () => {
    const simulation = new GameSimulation(baseConfig, [createEvent({ lane: 1 })]);

    simulation.step(2600);
    const state = simulation.getState();

    expect(state.status).toBe("failed");
    expect(state.failure?.reason).toBe("missed-collectible");
  });

  it("fails when a car hits an obstacle", () => {
    const simulation = new GameSimulation(baseConfig, [
      createEvent({ kind: "obstacle", required: false }),
    ]);

    simulation.step(2300);
    const state = simulation.getState();

    expect(state.status).toBe("failed");
    expect(state.failure?.reason).toBe("hit-obstacle");
  });

  it("allows each car to toggle only within its road group", () => {
    const simulation = new GameSimulation(baseConfig, []);

    simulation.applyInput({ type: "TOGGLE_LEFT", atMs: 0 });
    simulation.applyInput({ type: "TOGGLE_RIGHT", atMs: 0 });
    const state = simulation.getState();

    expect(state.cars.left).toEqual({ side: "left", lane: 1 });
    expect(state.cars.right).toEqual({ side: "right", lane: 0 });
  });

  it("does not advance simulation time while paused", () => {
    const simulation = new GameSimulation(baseConfig, []);

    simulation.step(500);
    simulation.applyInput({ type: "PAUSE", atMs: 500 });
    simulation.step(1000);

    expect(simulation.getState()).toMatchObject({
      status: "paused",
      timeMs: 500,
    });

    simulation.applyInput({ type: "RESUME", atMs: 500 });
    simulation.step(250);

    expect(simulation.getState()).toMatchObject({
      status: "running",
      timeMs: 750,
    });
  });
});
