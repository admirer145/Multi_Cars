import { COLLECTION_Y, getActiveRoadSides, normalizeClassicCarCount, ROAD_SIDES, SPAWN_Y } from "../constants";
import { getSpeedAtTime } from "../difficulty/difficultyModel";
import { POWER_UP_DURATION_MS } from "../modifiers/gameplayModifiers";
import type {
  ActiveObjectState,
  CarState,
  ModeConfig,
  PatternEvent,
  RoadSide,
  SimulationInput,
  SimulationState,
} from "../types";
import {
  createCollisionFailure,
  isCollectibleInRange,
  isCollectibleLike,
  isMatchingColorCollectible,
} from "./collisions";
import { getCollectedScore } from "./scoring";

const MOVING_OBSTACLE_SWITCH_INTERVAL_MS = 950;
const MOVING_OBSTACLE_LOCK_DISTANCE = 260;

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

    if (input.type === "TOGGLE_CAR") {
      this.toggleCar(input.side);
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
      carCount: normalizeClassicCarCount(this.config.carCount),
      cars: createInitialCars(),
      objects: [],
      score: 0,
      status: "ready",
      completedPercent: 0,
      powerUps: {
        shieldCharges: 0,
        slowMotionUntilMs: 0,
        magnetUntilMs: 0,
        scoreMultiplierUntilMs: 0,
      },
    };
  }

  private toggleCar(side: RoadSide): void {
    if (!getActiveRoadSides(this.state.carCount).includes(side)) {
      return;
    }

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
        spawnLane: event.lane,
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
    const speed = getSpeedAtTime(this.config, this.state.timeMs) * (this.isSlowMotionActive() ? 0.55 : 1);
    for (const object of this.state.objects) {
      object.y += (speed * deltaMs) / 1000;

      if (object.kind === "moving-obstacle") {
        if (object.y >= COLLECTION_Y - MOVING_OBSTACLE_LOCK_DISTANCE) {
          continue;
        }

        const elapsedMs = Math.max(0, this.state.timeMs - object.timeMs);
        const shouldSwitchLane = Math.floor(elapsedMs / MOVING_OBSTACLE_SWITCH_INTERVAL_MS) % 2 === 1;
        const spawnLane = object.spawnLane ?? object.lane;
        object.lane = shouldSwitchLane ? (spawnLane === 0 ? 1 : 0) : spawnLane;
      }
    }
  }

  private resolveObjects(): void {
    for (const object of this.state.objects) {
      const relativeObject = { ...object, y: object.y - COLLECTION_Y };
      const car = this.state.cars[object.side];

      if (
        !object.collected &&
        isCollectibleLike(relativeObject) &&
        (car.lane === object.lane || this.canMagnetCollect(object)) &&
        isCollectibleInRange(relativeObject)
      ) {
        object.collected = true;
        this.activatePowerUp(object);
        this.state.score += getCollectedScore(object) * this.getScoreMultiplier();
      }

      const failure = createCollisionFailure(object, this.state.cars, this.state.timeMs);
      if (failure) {
        if (failure.reason === "hit-obstacle" && this.state.powerUps.shieldCharges > 0) {
          this.state.powerUps.shieldCharges -= 1;
          object.collected = true;
          continue;
        }

        object.missed = failure.reason === "missed-collectible";
        this.state.status = "failed";
        this.state.failure = failure;
        return;
      }
    }

    this.state.objects = this.state.objects.filter((object) => object.y < COLLECTION_Y + 180);
  }

  private activatePowerUp(object: ActiveObjectState): void {
    if (object.kind !== "power-up" || !object.powerUpId) {
      return;
    }

    switch (object.powerUpId) {
      case "shield":
        this.state.powerUps.shieldCharges = Math.min(3, this.state.powerUps.shieldCharges + 1);
        break;
      case "slow-motion":
        this.extendEffect("slowMotionUntilMs", POWER_UP_DURATION_MS["slow-motion"]);
        break;
      case "magnet":
        this.extendEffect("magnetUntilMs", POWER_UP_DURATION_MS.magnet);
        break;
      case "score-multiplier":
        this.extendEffect("scoreMultiplierUntilMs", POWER_UP_DURATION_MS["score-multiplier"]);
        break;
      case "dual-collect":
        break;
    }
  }

  private extendEffect(
    effectKey: "slowMotionUntilMs" | "magnetUntilMs" | "scoreMultiplierUntilMs",
    durationMs: number,
  ): void {
    this.state.powerUps[effectKey] = Math.max(
      this.state.powerUps[effectKey],
      this.state.timeMs + durationMs,
    );
  }

  private canMagnetCollect(object: ActiveObjectState): boolean {
    return (
      this.state.powerUps.magnetUntilMs > this.state.timeMs &&
      this.isMagnetEligibleObject(object)
    );
  }

  private isMagnetEligibleObject(object: ActiveObjectState): boolean {
    return object.kind === "collectible" || isMatchingColorCollectible(object) || object.kind === "dual-collect";
  }

  private getScoreMultiplier(): number {
    return this.state.powerUps.scoreMultiplierUntilMs > this.state.timeMs ? 2 : 1;
  }

  private isSlowMotionActive(): boolean {
    return this.state.powerUps.slowMotionUntilMs > this.state.timeMs;
  }

}

function createInitialCars(): Record<RoadSide, CarState> {
  return ROAD_SIDES.reduce(
    (cars, side, index) => ({
      ...cars,
      [side]: { side, lane: index % 2 },
    }),
    {} as Record<RoadSide, CarState>,
  );
}
