import {
  DEFAULT_OBJECT_SPEED,
  DEFAULT_SPAWN_INTERVAL_MS,
  DEFAULT_TRACK_DURATION_MS,
  normalizeClassicCarCount,
  SUPPORTED_CLASSIC_CAR_COUNTS,
  type SupportedClassicCarCount,
} from "../constants";
import type { GameplayModifierSettings } from "../modifiers/gameplayModifiers";
import type { ModeConfig, PatternEvent, PatternFamily, RunSummary, SimulationState } from "../types";
import { generatePattern } from "../patterns/patternGenerator";

export const CLASSIC_MODE_ID = "classic";
export const CLASSIC_SEED_PREFIX = "classic-v1";
export const CLASSIC_CAR_OPTIONS = [2, 1] as const;
export const MIN_CLASSIC_SPEED_LEVEL = 1;
export const MAX_CLASSIC_SPEED_LEVEL = 50;
export const DEFAULT_CLASSIC_SPEED_SETTINGS = {
  minLevel: 5,
  maxLevel: 20,
} as const;

export type ClassicSpeedSettings = {
  minLevel: number;
  maxLevel: number;
};

export type ClassicRun = {
  runIndex: number;
  carCount: SupportedClassicCarCount;
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
  speedSettings?: Partial<ClassicSpeedSettings>;
  modifierSettings?: GameplayModifierSettings;
  carCount?: SupportedClassicCarCount;
};

export function createClassicMode(options: string | ClassicModeOptions = {}): ModeConfig {
  const resolvedOptions = typeof options === "string" ? { seed: options } : options;
  const runIndex = resolvedOptions.runIndex ?? 0;
  const difficulty = resolvedOptions.difficulty ?? getClassicStartingDifficulty(runIndex);
  const speedSettings = normalizeClassicSpeedSettings(resolvedOptions.speedSettings);
  const carCount = normalizeClassicCarCount(resolvedOptions.carCount);

  return {
    id: CLASSIC_MODE_ID,
    label: formatClassicModeLabel(carCount),
    seed: resolvedOptions.seed ?? createClassicSeed(runIndex, carCount),
    carCount,
    durationMs: resolvedOptions.durationMs ?? DEFAULT_TRACK_DURATION_MS,
    endless: true,
    spawnIntervalMs: DEFAULT_SPAWN_INTERVAL_MS,
    objectSpeed: DEFAULT_OBJECT_SPEED,
    difficulty,
    speedLevelMin: speedSettings.minLevel,
    speedLevelMax: speedSettings.maxLevel,
    allowedFamilies: getClassicFamiliesForDifficulty(difficulty),
    modifierSettings: resolvedOptions.modifierSettings,
  };
}

export function createClassicRun(
  runIndex: number,
  speedSettings?: Partial<ClassicSpeedSettings>,
  modifierSettings?: GameplayModifierSettings,
  carCount?: SupportedClassicCarCount,
): ClassicRun {
  const resolvedCarCount = normalizeClassicCarCount(carCount);
  const config = createClassicMode({ runIndex, speedSettings, modifierSettings, carCount: resolvedCarCount });
  return {
    runIndex,
    carCount: resolvedCarCount,
    config,
    pattern: generatePattern(config),
  };
}

export function createClassicSeed(runIndex: number, carCount: SupportedClassicCarCount = 2): string {
  const normalizedCarCount = normalizeClassicCarCount(carCount);
  return normalizedCarCount === 2
    ? `${CLASSIC_SEED_PREFIX}-run-${runIndex}`
    : `${CLASSIC_SEED_PREFIX}-${normalizedCarCount}-car-run-${runIndex}`;
}

export function getClassicSpeedLevel(
  timeMs: number,
  speedSettings?: Partial<ClassicSpeedSettings> | Pick<ModeConfig, "speedLevelMin" | "speedLevelMax">,
): number {
  const { minLevel, maxLevel } = normalizeClassicSpeedSettings(speedSettings);
  return Math.min(maxLevel, minLevel + Math.floor(timeMs / 15_000));
}

export function createClassicRunSummary(
  state: SimulationState,
  config: ModeConfig,
  bestScore: number,
): ClassicRunSummary {
  return {
    modeId: CLASSIC_MODE_ID,
    modeLabel: config.label,
    seed: config.seed,
    score: state.score,
    bestScore,
    completedPercent: Math.round(state.completedPercent),
    speedLevel: getClassicSpeedLevel(state.timeMs, config),
    result: state.status,
    failureReason: state.failure?.reason,
    failedPatternFamily: state.failure?.patternFamily,
  };
}

export function formatClassicModeLabel(carCount: SupportedClassicCarCount): string {
  return carCount === 1 ? "Classic 1 Car" : "Classic 2 Cars";
}

export function normalizeClassicSpeedSettings(
  speedSettings?: Partial<ClassicSpeedSettings> | Pick<ModeConfig, "speedLevelMin" | "speedLevelMax"> | null,
): ClassicSpeedSettings {
  const minLevel = normalizeClassicSpeedLevel(
    getClassicSpeedSettingValue(speedSettings, "minLevel"),
    DEFAULT_CLASSIC_SPEED_SETTINGS.minLevel,
  );
  const maxLevel = normalizeClassicSpeedLevel(
    getClassicSpeedSettingValue(speedSettings, "maxLevel"),
    DEFAULT_CLASSIC_SPEED_SETTINGS.maxLevel,
  );

  return {
    minLevel: Math.min(minLevel, maxLevel),
    maxLevel: Math.max(minLevel, maxLevel),
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

function getClassicSpeedSettingValue(
  speedSettings: Partial<ClassicSpeedSettings> | Pick<ModeConfig, "speedLevelMin" | "speedLevelMax"> | null | undefined,
  key: keyof ClassicSpeedSettings,
): number | undefined {
  if (!speedSettings) {
    return undefined;
  }

  if ("speedLevelMin" in speedSettings || "speedLevelMax" in speedSettings) {
    return key === "minLevel" ? speedSettings.speedLevelMin : speedSettings.speedLevelMax;
  }

  const classicSpeedSettings = speedSettings as Partial<ClassicSpeedSettings>;
  return classicSpeedSettings[key];
}

function normalizeClassicSpeedLevel(value: number | undefined, fallback: number): number {
  const normalizedValue = Number(value);
  if (!Number.isFinite(normalizedValue)) {
    return fallback;
  }

  return Math.max(
    MIN_CLASSIC_SPEED_LEVEL,
    Math.min(MAX_CLASSIC_SPEED_LEVEL, Math.trunc(normalizedValue)),
  );
}
