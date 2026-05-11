import type { ActiveObjectState } from "../types";
import { isMatchingColorCollectible } from "./collisions";

export function getCollectedScore(object: ActiveObjectState): number {
  return isScoringCollectible(object) ? 1 : 0;
}

function isScoringCollectible(object: ActiveObjectState): boolean {
  return object.kind === "collectible" || isMatchingColorCollectible(object) || object.kind === "dual-collect";
}
