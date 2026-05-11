import { DEFAULT_OBJECT_SPEED, DEFAULT_SPAWN_INTERVAL_MS } from "../constants";
import type { GameplayModifierSettings } from "../modifiers/gameplayModifiers";
import {
  getClassicSpeedLevel,
  normalizeClassicSpeedSettings,
  type ClassicSpeedSettings,
} from "./classicMode";
import { generatePattern } from "../patterns/patternGenerator";
import { createDailySeed } from "../patterns/dailySeed";
import type { ModeConfig, PatternEvent, PatternFamily, RunSummary, SimulationState } from "../types";

export const DAILY_MODE_ID = "daily";
export const DAILY_DURATION_MS = 75_000;

export type DailyRun = {
  dateKey: string;
  config: ModeConfig;
  pattern: PatternEvent[];
};

export type DailyProgress = {
  dateKey: string;
  bestPercent: number;
  bestScore: number;
  stars: number;
  completed: boolean;
  attempts: number;
};

export function createDailyMode(
  date = new Date(),
  modifierSettings?: GameplayModifierSettings,
  speedSettings?: Partial<ClassicSpeedSettings>,
): ModeConfig {
  const seed = createDailySeed(date);
  const normalizedSpeedSettings = normalizeClassicSpeedSettings(speedSettings);

  return {
    id: DAILY_MODE_ID,
    label: "Daily Road",
    seed,
    durationMs: DAILY_DURATION_MS,
    spawnIntervalMs: DEFAULT_SPAWN_INTERVAL_MS,
    objectSpeed: DEFAULT_OBJECT_SPEED,
    difficulty: getDailyDifficulty(date),
    speedLevelMin: normalizedSpeedSettings.minLevel,
    speedLevelMax: normalizedSpeedSettings.maxLevel,
    allowedFamilies: getDailyFamilies(date),
    modifierSettings,
  };
}

export function createDailyRun(
  date = new Date(),
  modifierSettings?: GameplayModifierSettings,
  speedSettings?: Partial<ClassicSpeedSettings>,
): DailyRun {
  const config = createDailyMode(date, modifierSettings, speedSettings);

  return {
    dateKey: config.seed,
    config,
    pattern: generatePattern(config),
  };
}

export function calculateDailyStars(percent: number): number {
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

export function createInitialDailyProgress(dateKey: string): DailyProgress {
  return {
    dateKey,
    bestPercent: 0,
    bestScore: 0,
    stars: 0,
    completed: false,
    attempts: 0,
  };
}

export function updateDailyProgress(
  current: DailyProgress,
  completedPercent: number,
  score: number,
): DailyProgress {
  const roundedPercent = Math.round(completedPercent);
  const bestPercent = Math.max(current.bestPercent, roundedPercent);
  const bestScore = Math.max(current.bestScore, score);

  return {
    ...current,
    bestPercent,
    bestScore,
    stars: Math.max(current.stars, calculateDailyStars(bestPercent)),
    completed: current.completed || bestPercent >= 100,
    attempts: current.attempts + 1,
  };
}

export function createDailyRunSummary(
  state: SimulationState,
  config: ModeConfig,
  progress: DailyProgress,
): RunSummary {
  const completedPercent = Math.round(state.completedPercent);

  return {
    modeId: DAILY_MODE_ID,
    modeLabel: config.label,
    seed: config.seed,
    score: state.score,
    bestScore: progress.bestScore,
    completedPercent,
    speedLevel: getClassicSpeedLevel(state.timeMs, config),
    result: state.status,
    failureReason: state.failure?.reason,
    failedPatternFamily: state.failure?.patternFamily,
    stars: calculateDailyStars(completedPercent),
  };
}

function getDailyDifficulty(date: Date): number {
  return 1 + (date.getDate() % 3);
}

function getDailyFamilies(date: Date): PatternFamily[] {
  const pool: PatternFamily[][] = [
    ["focus", "sync", "mirror", "recovery"],
    ["focus", "alternating", "delayed", "recovery"],
    ["focus", "mirror", "deceptive", "pressure", "recovery"],
  ];

  return pool[date.getDate() % pool.length];
}
