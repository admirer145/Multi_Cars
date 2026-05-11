import type { ActiveObjectState } from "../types";

export function getCollectedScore(object: ActiveObjectState): number {
  return object.kind === "collectible" ? 1 : 0;
}
