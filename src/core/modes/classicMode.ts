import {
  DEFAULT_OBJECT_SPEED,
  DEFAULT_SPAWN_INTERVAL_MS,
  DEFAULT_TRACK_DURATION_MS,
} from "../constants";
import type { ModeConfig, PatternEvent, PatternFamily, RunSummary, SimulationState } from "../types";
import { generatePattern } from "../patterns/patternGenerator";

export const CLASSIC_MODE_ID = "classic";
export const CLASSIC_SEED_PREFIX = "classic-v1";

export type ClassicRun = {
  runIndex: number;
  config: ModeConfig;
  pattern: PatternEvent[];
};

export type ClassicRunSummary = RunSummary & {
  modeId: typeof CLASSIC_MODE_ID;
};

type ClassicModeOptions = {
  seed?: string;
  runIndex?: number;
  difficulty?: number;
  durationMs?: number;
};

export function createClassicMode(options: string | ClassicModeOptions = {}): ModeConfig {
  const resolvedOptions = typeof options === "string" ? { seed: options } : options;
  const runIndex = resolvedOptions.runIndex ?? 0;
  const difficulty = resolvedOptions.difficulty ?? getClassicStartingDifficulty(runIndex);

  return {
    id: CLASSIC_MODE_ID,
    label: "Classic",
    seed: resolvedOptions.seed ?? createClassicSeed(runIndex),
    durationMs: resolvedOptions.durationMs ?? DEFAULT_TRACK_DURATION_MS,
    endless: true,
    spawnIntervalMs: DEFAULT_SPAWN_INTERVAL_MS,
    objectSpeed: DEFAULT_OBJECT_SPEED,
    difficulty,
    allowedFamilies: getClassicFamiliesForDifficulty(difficulty),
  };
}

export function createClassicRun(runIndex: number): ClassicRun {
  const config = createClassicMode({ runIndex });
  return {
    runIndex,
    config,
    pattern: generatePattern(config),
  };
}

export function createClassicSeed(runIndex: number): string {
  return `${CLASSIC_SEED_PREFIX}-run-${runIndex}`;
}

export function getClassicSpeedLevel(timeMs: number): number {
  return Math.min(9, 1 + Math.floor(timeMs / 15_000));
}

export function createClassicRunSummary(
  state: SimulationState,
  config: ModeConfig,
  bestScore: number,
): ClassicRunSummary {
  return {
    modeId: CLASSIC_MODE_ID,
    modeLabel: "Classic",
    seed: config.seed,
    score: state.score,
    bestScore,
    completedPercent: Math.round(state.completedPercent),
    speedLevel: getClassicSpeedLevel(state.timeMs),
    result: state.status,
    failureReason: state.failure?.reason,
    failedPatternFamily: state.failure?.patternFamily,
  };
}

function getClassicStartingDifficulty(runIndex: number): number {
  return Math.min(3, 1 + Math.floor(runIndex / 3));
}

function getClassicFamiliesForDifficulty(difficulty: number): PatternFamily[] {
  if (difficulty <= 1) {
    return ["focus", "sync", "mirror", "alternating", "recovery"];
  }

  if (difficulty === 2) {
    return ["focus", "sync", "mirror", "alternating", "delayed", "deceptive", "recovery"];
  }

  return ["focus", "sync", "mirror", "alternating", "delayed", "deceptive", "pressure", "recovery"];
}
