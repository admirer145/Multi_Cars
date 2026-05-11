import { DEFAULT_OBJECT_SPEED, DEFAULT_SPAWN_INTERVAL_MS } from "../constants";
import {
  AUTHORED_TRACKS,
  buildAuthoredPattern,
  getAuthoredTrack,
  type AuthoredTrack,
} from "../patterns/authoredTracks";
import type { ModeConfig, PatternEvent, RunSummary, SimulationState } from "../types";

export const CHALLENGE_MODE_ID = "challenge";

export type ChallengeRun = {
  track: AuthoredTrack;
  config: ModeConfig;
  pattern: PatternEvent[];
};

export type ChallengeProgress = {
  trackId: string;
  bestPercent: number;
  stars: number;
  completed: boolean;
  attempts: number;
};

export function getStarterChallengeTrack(): AuthoredTrack {
  return AUTHORED_TRACKS[0];
}

export function createChallengeMode(track: AuthoredTrack): ModeConfig {
  return {
    id: CHALLENGE_MODE_ID,
    label: track.label,
    seed: `${CHALLENGE_MODE_ID}-${track.id}`,
    durationMs: getChallengeDurationMs(track),
    spawnIntervalMs: DEFAULT_SPAWN_INTERVAL_MS,
    objectSpeed: DEFAULT_OBJECT_SPEED,
    difficulty: 1,
    allowedFamilies: track.skillFocus,
  };
}

export function createChallengeRun(trackId = getStarterChallengeTrack().id): ChallengeRun {
  const track = getAuthoredTrack(trackId);

  if (!track) {
    throw new Error(`Unknown challenge track: ${trackId}`);
  }

  const config = createChallengeMode(track);
  return {
    track,
    config,
    pattern: buildAuthoredPattern(track, config),
  };
}

export function calculateChallengeStars(percent: number): number {
  if (percent >= 100) {
    return 3;
  }

  if (percent >= 80) {
    return 2;
  }

  if (percent >= 50) {
    return 1;
  }

  return 0;
}

export function createInitialChallengeProgress(trackId: string): ChallengeProgress {
  return {
    trackId,
    bestPercent: 0,
    stars: 0,
    completed: false,
    attempts: 0,
  };
}

export function updateChallengeProgress(
  current: ChallengeProgress,
  completedPercent: number,
): ChallengeProgress {
  const bestPercent = Math.max(current.bestPercent, Math.round(completedPercent));
  return {
    ...current,
    bestPercent,
    stars: Math.max(current.stars, calculateChallengeStars(bestPercent)),
    completed: current.completed || bestPercent >= 100,
    attempts: current.attempts + 1,
  };
}

export function createChallengeRunSummary(
  state: SimulationState,
  config: ModeConfig,
  progress: ChallengeProgress,
): RunSummary {
  const completedPercent = Math.round(state.completedPercent);

  return {
    modeId: CHALLENGE_MODE_ID,
    modeLabel: config.label,
    seed: config.seed,
    score: completedPercent,
    bestScore: progress.bestPercent,
    completedPercent,
    speedLevel: 1,
    result: state.status,
    failureReason: state.failure?.reason,
    failedPatternFamily: state.failure?.patternFamily,
    stars: calculateChallengeStars(completedPercent),
  };
}

function getChallengeDurationMs(track: AuthoredTrack): number {
  const lastBeat = Math.max(...track.events.map((event) => event.beat));
  const authoredMotifMs = lastBeat * track.beatIntervalMs + 3_200;
  const targetDurationMs = 60_000 + Math.max(0, track.level - 1) * 15_000;

  return Math.max(authoredMotifMs, targetDurationMs);
}
