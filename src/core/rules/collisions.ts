import { COLLECTION_Y, COLLECTION_WINDOW, OBSTACLE_HIT_WINDOW, MISS_Y } from "../constants";
import type { ActiveObjectState, CarState, FailureState, RoadSide } from "../types";

export function isCollectibleInRange(object: ActiveObjectState): boolean {
  return isCollectibleLike(object) && Math.abs(object.y) <= COLLECTION_WINDOW;
}

export function isObstacleInRange(object: ActiveObjectState): boolean {
  return isHazardLike(object) && Math.abs(object.y) <= OBSTACLE_HIT_WINDOW;
}

export function shouldMissCollectible(object: ActiveObjectState): boolean {
  return object.required && !object.collected && object.y > MISS_Y;
}

export function isCollectibleLike(object: ActiveObjectState): boolean {
  return (
    object.kind === "collectible" ||
    isMatchingColorCollectible(object) ||
    object.kind === "dual-collect" ||
    object.kind === "power-up"
  );
}

export function isHazardLike(object: ActiveObjectState): boolean {
  return (
    object.kind === "obstacle" ||
    object.kind === "moving-obstacle" ||
    object.kind === "fake-collectible" ||
    isWrongColorCollectible(object) ||
    object.kind === "timed-gate"
  );
}

export function isMatchingColorCollectible(object: ActiveObjectState): boolean {
  return object.kind === "color-match" && object.colorKey === object.side;
}

export function isWrongColorCollectible(object: ActiveObjectState): boolean {
  return object.kind === "color-match" && object.colorKey !== object.side;
}

export function isTimedGateClosed(object: ActiveObjectState, timeMs: number): boolean {
  if (object.kind !== "timed-gate") {
    return true;
  }

  const elapsedMs = Math.max(0, timeMs - object.timeMs);
  return Math.floor(elapsedMs / 480) % 2 === 0;
}

export function createCollisionFailure(
  object: ActiveObjectState,
  cars: Record<RoadSide, CarState>,
  timeMs: number,
): FailureState | undefined {
  if (object.collected) {
    return undefined;
  }

  const car = cars[object.side];
  const relativeObject = { ...object, y: object.y - COLLECTION_Y };

  if (
    isObstacleInRange(relativeObject) &&
    isTimedGateClosed(object, timeMs) &&
    car.lane === object.lane
  ) {
    return {
      reason: "hit-obstacle",
      side: object.side,
      lane: object.lane,
      objectId: object.id,
      timeMs,
      skillTags: object.skillTags,
      patternFamily: object.patternFamily,
    };
  }

  if (shouldMissCollectible(object)) {
    return {
      reason: "missed-collectible",
      side: object.side,
      lane: object.lane,
      objectId: object.id,
      timeMs,
      skillTags: object.skillTags,
      patternFamily: object.patternFamily,
    };
  }

  return undefined;
}
