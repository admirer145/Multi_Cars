import type { ChallengeProgress } from "../core/modes/challengeMode";

const HIGH_SCORE_KEY = "multi-cars:classic-high-score:v1";
const CHALLENGE_PROGRESS_PREFIX = "multi-cars:challenge-progress:v1:";

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function loadClassicHighScore(storage: StorageLike = getBrowserStorage()): number {
  const value = storage.getItem(HIGH_SCORE_KEY);
  const parsed = value ? Number.parseInt(value, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function saveClassicHighScore(score: number, storage: StorageLike = getBrowserStorage()): void {
  const current = loadClassicHighScore(storage);
  if (score > current) {
    storage.setItem(HIGH_SCORE_KEY, String(score));
  }
}

export function loadChallengeProgress(
  trackId: string,
  fallback: ChallengeProgress,
  storage: StorageLike = getBrowserStorage(),
): ChallengeProgress {
  const value = storage.getItem(`${CHALLENGE_PROGRESS_PREFIX}${trackId}`);

  if (!value) {
    return fallback;
  }

  try {
    return {
      ...fallback,
      ...JSON.parse(value),
      trackId,
    };
  } catch {
    return fallback;
  }
}

export function saveChallengeProgress(
  progress: ChallengeProgress,
  storage: StorageLike = getBrowserStorage(),
): void {
  storage.setItem(`${CHALLENGE_PROGRESS_PREFIX}${progress.trackId}`, JSON.stringify(progress));
}

function getBrowserStorage(): StorageLike {
  return window.localStorage;
}
