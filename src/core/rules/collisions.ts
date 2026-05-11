import { COLLECTION_Y, COLLECTION_WINDOW, OBSTACLE_HIT_WINDOW, MISS_Y } from "../constants";
import type { ActiveObjectState, CarState, FailureState, RoadSide } from "../types";

export function isCollectibleInRange(object: ActiveObjectState): boolean {
  return object.kind === "collectible" && Math.abs(object.y) <= COLLECTION_WINDOW;
}

export function isObstacleInRange(object: ActiveObjectState): boolean {
  return object.kind === "obstacle" && Math.abs(object.y) <= OBSTACLE_HIT_WINDOW;
}

export function shouldMissCollectible(object: ActiveObjectState): boolean {
  return object.kind === "collectible" && !object.collected && object.y > MISS_Y;
}

export function createCollisionFailure(
  object: ActiveObjectState,
  cars: Record<RoadSide, CarState>,
  timeMs: number,
): FailureState | undefined {
  const car = cars[object.side];
  const relativeObject = { ...object, y: object.y - COLLECTION_Y };

  if (isObstacleInRange(relativeObject) && car.lane === object.lane) {
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
