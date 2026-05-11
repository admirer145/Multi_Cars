import { COLLECTION_Y, SPAWN_Y } from "../constants";
import { getSpeedAtTime } from "../difficulty/difficultyModel";
import type {
  ActiveObjectState,
  ModeConfig,
  PatternEvent,
  RoadSide,
  SimulationInput,
  SimulationState,
} from "../types";
import { createCollisionFailure, isCollectibleInRange } from "./collisions";
import { getCollectedScore } from "./scoring";

export class GameSimulation {
  private readonly config: ModeConfig;
  private readonly pattern: PatternEvent[];
  private nextEventIndex = 0;
  private patternCycleIndex = 0;
  private patternCycleOffsetMs = 0;
  private state: SimulationState;

  constructor(config: ModeConfig, pattern: PatternEvent[]) {
    this.config = config;
    this.pattern = pattern;
    this.state = this.createInitialState();
  }

  getState(): SimulationState {
    return structuredClone(this.state);
  }

  applyInput(input: SimulationInput): void {
    if (input.type === "RESTART") {
      this.nextEventIndex = 0;
      this.patternCycleIndex = 0;
      this.patternCycleOffsetMs = 0;
      this.state = this.createInitialState();
      this.state.status = "running";
      return;
    }

    if (input.type === "PAUSE" && this.state.status === "running") {
      this.state.status = "paused";
      return;
    }

    if (input.type === "RESUME" && this.state.status === "paused") {
      this.state.status = "running";
      return;
    }

    if (this.state.status === "ready") {
      this.state.status = "running";
    }

    if (this.state.status !== "running") {
      return;
    }

    if (input.type === "TOGGLE_LEFT") {
      this.toggleCar("left");
    }

    if (input.type === "TOGGLE_RIGHT") {
      this.toggleCar("right");
    }
  }

  step(deltaMs: number): SimulationState {
    if (this.state.status === "ready") {
      this.state.status = "running";
    }

    if (this.state.status !== "running") {
      return this.getState();
    }

    this.state.timeMs += deltaMs;
    this.spawnDueEvents();
    this.updateObjects(deltaMs);
    this.resolveObjects();
    this.state.completedPercent = this.config.endless
      ? 0
      : Math.min(100, (this.state.timeMs / this.config.durationMs) * 100);

    if (
      this.state.status === "running" &&
      !this.config.endless &&
      this.state.timeMs >= this.config.durationMs
    ) {
      this.state.status = "completed";
    }

    return this.getState();
  }

  private createInitialState(): SimulationState {
    return {
      timeMs: 0,
      cars: {
        left: { side: "left", lane: 0 },
        right: { side: "right", lane: 1 },
      },
      objects: [],
      score: 0,
      status: "ready",
      completedPercent: 0,
    };
  }

  private toggleCar(side: RoadSide): void {
    const car = this.state.cars[side];
    car.lane = car.lane === 0 ? 1 : 0;
  }

  private spawnDueEvents(): void {
    while (this.nextEventIndex < this.pattern.length) {
      const event = this.pattern[this.nextEventIndex];
      const eventTimeMs = event.timeMs + this.patternCycleOffsetMs;

      if (eventTimeMs > this.state.timeMs) {
        return;
      }

      this.state.objects.push({
        ...event,
        id: this.patternCycleIndex > 0 ? `${event.id}-cycle-${this.patternCycleIndex}` : event.id,
        timeMs: eventTimeMs,
        y: SPAWN_Y,
        collected: false,
        missed: false,
      });
      this.nextEventIndex += 1;

      if (this.nextEventIndex >= this.pattern.length && this.config.endless) {
        this.nextEventIndex = 0;
        this.patternCycleIndex += 1;
        this.patternCycleOffsetMs = this.patternCycleIndex * this.config.durationMs;
      }
    }
  }

  private updateObjects(deltaMs: number): void {
    const speed = getSpeedAtTime(this.config, this.state.timeMs);
    for (const object of this.state.objects) {
      object.y += (speed * deltaMs) / 1000;
    }
  }

  private resolveObjects(): void {
    for (const object of this.state.objects) {
      const relativeObject = { ...object, y: object.y - COLLECTION_Y };
      const car = this.state.cars[object.side];

      if (
        !object.collected &&
        relativeObject.kind === "collectible" &&
        car.lane === object.lane &&
        isCollectibleInRange(relativeObject)
      ) {
        object.collected = true;
        this.state.score += getCollectedScore(object);
      }

      const failure = createCollisionFailure(object, this.state.cars, this.state.timeMs);
      if (failure) {
        object.missed = failure.reason === "missed-collectible";
        this.state.status = "failed";
        this.state.failure = failure;
        return;
      }
    }

    this.state.objects = this.state.objects.filter((object) => object.y < COLLECTION_Y + 180);
  }
}
