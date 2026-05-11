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

  it("locks moving obstacle lane before the collection zone", () => {
    const simulation = new GameSimulation(baseConfig, [
      createEvent({ kind: "moving-obstacle", required: false }),
    ]);

    simulation.step(1200);
    expect(simulation.getState().objects[0]).toMatchObject({
      kind: "moving-obstacle",
      lane: 1,
    });

    simulation.step(700);

    expect(simulation.getState().objects[0]).toMatchObject({
      kind: "moving-obstacle",
      lane: 1,
    });
  });

  it("allows each car to toggle only within its road group", () => {
    const simulation = new GameSimulation(baseConfig, []);

    simulation.applyInput({ type: "TOGGLE_LEFT", atMs: 0 });
    simulation.applyInput({ type: "TOGGLE_RIGHT", atMs: 0 });
    const state = simulation.getState();

    expect(state.cars.left).toEqual({ side: "left", lane: 1 });
    expect(state.cars.right).toEqual({ side: "right", lane: 0 });
  });

  it("keeps one-car runs scoped to the primary car", () => {
    const simulation = new GameSimulation({ ...baseConfig, carCount: 1 }, []);

    simulation.applyInput({ type: "TOGGLE_RIGHT", atMs: 0 });
    simulation.applyInput({ type: "TOGGLE_LEFT", atMs: 0 });
    const state = simulation.getState();

    expect(state.carCount).toBe(1);
    expect(state.cars.left).toEqual({ side: "left", lane: 1 });
    expect(state.cars.right).toEqual({ side: "right", lane: 1 });
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

  it("uses shield charges to survive one obstacle hit", () => {
    const simulation = new GameSimulation(baseConfig, [
      createEvent({ id: "shield", kind: "power-up", powerUpId: "shield", required: false }),
      createEvent({ id: "hazard", timeMs: 2301, kind: "obstacle", required: false }),
    ]);

    simulation.step(2300);
    expect(simulation.getState().powerUps.shieldCharges).toBe(1);

    simulation.step(2300);
    expect(simulation.getState()).toMatchObject({
      status: "running",
      powerUps: {
        shieldCharges: 0,
      },
    });
  });

  it("uses shield charges to survive one fake collectible hit", () => {
    const simulation = new GameSimulation(baseConfig, [
      createEvent({ id: "shield", kind: "power-up", powerUpId: "shield", required: false }),
      createEvent({ id: "fake", timeMs: 2301, kind: "fake-collectible", required: false }),
    ]);

    simulation.step(2300);
    simulation.step(2300);

    expect(simulation.getState()).toMatchObject({
      status: "running",
      powerUps: {
        shieldCharges: 0,
      },
    });
  });

  it("doubles collectible score while score multiplier is active", () => {
    const simulation = new GameSimulation(baseConfig, [
      createEvent({
        id: "multiplier",
        kind: "power-up",
        powerUpId: "score-multiplier",
        required: false,
      }),
      createEvent({ id: "collectible", timeMs: 2301 }),
    ]);

    simulation.step(2300);
    simulation.step(2300);

    expect(simulation.getState().score).toBe(2);
  });

  it("lets magnet collect required objects from the neighboring lane", () => {
    const simulation = new GameSimulation(baseConfig, [
      createEvent({ id: "magnet", kind: "power-up", powerUpId: "magnet", required: false }),
      createEvent({ id: "collectible", timeMs: 2301, lane: 1 }),
    ]);

    simulation.step(2300);
    simulation.step(2300);

    expect(simulation.getState()).toMatchObject({
      status: "running",
      score: 1,
    });
  });

  it("does not let magnet pull fake collectibles", () => {
    const simulation = new GameSimulation(baseConfig, [
      createEvent({ id: "magnet", kind: "power-up", powerUpId: "magnet", required: false }),
      createEvent({ id: "fake", kind: "fake-collectible", required: false, lane: 1 }),
    ]);

    simulation.step(2300);
    const fakeCollectible = simulation.getState().objects.find((object) => object.id === "fake");

    expect(fakeCollectible).toMatchObject({
      kind: "fake-collectible",
      collected: false,
    });
  });

  it("does not let magnet pull wrong-color color match objects", () => {
    const simulation = new GameSimulation(baseConfig, [
      createEvent({ id: "magnet", kind: "power-up", powerUpId: "magnet", required: false }),
      createEvent({
        id: "wrong-color",
        kind: "color-match",
        required: false,
        colorKey: "right",
        lane: 1,
      }),
    ]);

    simulation.step(2300);
    const wrongColor = simulation.getState().objects.find((object) => object.id === "wrong-color");

    expect(wrongColor).toMatchObject({
      kind: "color-match",
      collected: false,
    });
  });

  it("fails when the car collects a wrong-color color match object", () => {
    const simulation = new GameSimulation(baseConfig, [
      createEvent({
        id: "wrong-color",
        kind: "color-match",
        required: false,
        colorKey: "right",
      }),
    ]);

    simulation.step(2300);

    expect(simulation.getState()).toMatchObject({
      status: "failed",
      failure: {
        reason: "hit-obstacle",
      },
    });
  });
});
