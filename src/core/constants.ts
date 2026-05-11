export const ROAD_SIDES = ["left", "right"] as const;
export const LANES = [0, 1] as const;
export const SUPPORTED_CLASSIC_CAR_COUNTS = [1, 2] as const;
export const MAX_PLANNED_CLASSIC_CARS = 4;

export type RoadSide = (typeof ROAD_SIDES)[number];
export type SupportedClassicCarCount = (typeof SUPPORTED_CLASSIC_CAR_COUNTS)[number];

export function normalizeClassicCarCount(carCount: number | undefined): SupportedClassicCarCount {
  return carCount === 1 ? 1 : 2;
}

export function getActiveRoadSides(carCount: number | undefined): RoadSide[] {
  return ROAD_SIDES.slice(0, normalizeClassicCarCount(carCount));
}

export const SPAWN_Y = -96;
export const COLLECTION_Y = 1030;
export const MISS_Y = 1120;
export const COLLECTION_WINDOW = 46;
export const OBSTACLE_HIT_WINDOW = 42;

export const DEFAULT_OBJECT_SPEED = 430;
export const DEFAULT_SPAWN_INTERVAL_MS = 880;
export const DEFAULT_TRACK_DURATION_MS = 120_000;
