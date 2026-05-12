import {
  DEFAULT_OBJECT_SPEED,
  DEFAULT_SPAWN_INTERVAL_MS,
  DEFAULT_TRACK_DURATION_MS,
  normalizeClassicCarCount,
  type SupportedClassicCarCount,
} from "../constants";
import {
  DEFAULT_CLASSIC_SPEED_SETTINGS,
  getClassicSpeedLevel,
  normalizeClassicSpeedSettings,
} from "../modes/classicMode";
import {
  normalizeGameplayModifierSettings,
  type GameplayModifierSettings,
  type GameplayModifierSettingsInput,
} from "../modifiers/gameplayModifiers";
import { generatePattern } from "../patterns/patternGenerator";
import type { ModeConfig, PatternEvent, RunResult, RunSummary, SimulationState } from "../types";

export const VERSUS_MODE_ID = "versus";
export const VERSUS_DEFAULT_DURATION_MS = DEFAULT_TRACK_DURATION_MS;
let playerIdCounter = 0;

export type VersusPlayer = {
  id: string;
  name: string;
};

export type VersusMatchSettings = {
  carCount: SupportedClassicCarCount;
  speedLevelMin: number;
  speedLevelMax: number;
  modifierSettings: GameplayModifierSettings;
  endless: boolean;
  durationMs: number;
};

export type VersusMatchConfig = {
  matchId: string;
  seed: string;
  leader: VersusPlayer;
  players: VersusPlayer[];
  settings: VersusMatchSettings;
};

export type VersusRun = {
  config: ModeConfig;
  pattern: PatternEvent[];
  matchConfig: VersusMatchConfig;
  player: VersusPlayer;
};

export type VersusRunResult = {
  matchId: string;
  player: VersusPlayer;
  score: number;
  speedLevel: number;
  timeMs: number;
  result: RunResult;
  completedPercent: number;
};

export type VersusOutcome =
  | { status: "pending"; completedCount: number; totalCount: number }
  | { status: "tie"; players: VersusPlayer[]; score: number }
  | { status: "winner"; winner: VersusPlayer; runnerUp?: VersusPlayer; margin: number; score: number };

export type VersusSettingsInput = {
  carCount?: number;
  speedLevelMin?: number;
  speedLevelMax?: number;
  modifierSettings?: GameplayModifierSettingsInput | null;
  endless?: boolean;
  durationMs?: number;
};

export function createVersusMatchConfig(
  leaderName: string,
  settings: VersusSettingsInput = {},
  now = Date.now(),
): VersusMatchConfig {
  const leader = createVersusPlayer(leaderName, "leader");
  const matchId = `lan-${now.toString(36)}`;

  return {
    matchId,
    seed: `${VERSUS_MODE_ID}-${matchId}`,
    leader,
    players: [leader],
    settings: normalizeVersusSettings(settings),
  };
}

export function createVersusPlayer(name: string, fallbackId = "player"): VersusPlayer {
  const normalizedName = normalizePlayerName(name);
  const suffix = normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    id: `${fallbackId}-${suffix || "guest"}-${createShortId()}`,
    name: normalizedName,
  };
}

export function createVersusPlayerWithId(name: string, playerId: string): VersusPlayer {
  return {
    id: playerId,
    name: normalizePlayerName(name),
  };
}

export function addVersusPlayer(config: VersusMatchConfig, player: VersusPlayer): VersusMatchConfig {
  const existingIndex = config.players.findIndex((candidate) => candidate.id === player.id);
  const players = existingIndex >= 0
    ? config.players.map((candidate, index) => (index === existingIndex ? player : candidate))
    : [...config.players, player];

  return {
    ...config,
    players,
  };
}

export function removeVersusPlayer(config: VersusMatchConfig, playerId: string): VersusMatchConfig {
  if (config.leader.id === playerId) {
    return config;
  }

  return {
    ...config,
    players: config.players.filter((player) => player.id !== playerId),
  };
}

export function createVersusRun(
  matchConfig: VersusMatchConfig,
  player: VersusPlayer,
): VersusRun {
  const config = createVersusMode(matchConfig);
  return {
    config,
    pattern: generatePattern(config),
    matchConfig,
    player,
  };
}

export function createVersusMode(matchConfig: VersusMatchConfig): ModeConfig {
  const settings = matchConfig.settings;

  return {
    id: VERSUS_MODE_ID,
    label: settings.endless ? "Friends Battle" : `Friends Battle ${Math.round(settings.durationMs / 1000)}s`,
    seed: matchConfig.seed,
    carCount: settings.carCount,
    durationMs: settings.durationMs,
    endless: settings.endless,
    spawnIntervalMs: DEFAULT_SPAWN_INTERVAL_MS,
    objectSpeed: DEFAULT_OBJECT_SPEED,
    difficulty: 1,
    speedLevelMin: settings.speedLevelMin,
    speedLevelMax: settings.speedLevelMax,
    modifierSettings: settings.modifierSettings,
  };
}

export function createVersusRunSummary(
  state: SimulationState,
  config: ModeConfig,
  result: VersusRunResult,
): RunSummary {
  return {
    modeId: VERSUS_MODE_ID,
    modeLabel: `${config.label}: ${result.player.name}`,
    seed: config.seed,
    score: state.score,
    bestScore: result.score,
    completedPercent: Math.round(state.completedPercent),
    speedLevel: result.speedLevel,
    result: state.status,
    failureReason: state.failure?.reason,
    failedPatternFamily: state.failure?.patternFamily,
  };
}

export function createVersusRunResult(
  matchId: string,
  player: VersusPlayer,
  state: SimulationState,
  config: Pick<ModeConfig, "speedLevelMin" | "speedLevelMax">,
): VersusRunResult {
  return {
    matchId,
    player,
    score: state.score,
    speedLevel: getClassicSpeedLevel(state.timeMs, config),
    timeMs: Math.round(state.timeMs),
    result: state.status,
    completedPercent: Math.round(state.completedPercent),
  };
}

export function calculateVersusOutcome(
  players: VersusPlayer[],
  results: VersusRunResult[],
): VersusOutcome {
  const matchResults = players
    .map((player) => results.find((result) => result.player.id === player.id))
    .filter((result): result is VersusRunResult => Boolean(result));

  if (matchResults.length < players.length) {
    return {
      status: "pending",
      completedCount: matchResults.length,
      totalCount: players.length,
    };
  }

  const sorted = [...matchResults].sort(compareVersusResults);
  const best = sorted[0];
  const tied = sorted.filter((result) => compareVersusResults(result, best) === 0);

  if (tied.length > 1) {
    return {
      status: "tie",
      players: tied.map((result) => result.player),
      score: best.score,
    };
  }

  return {
    status: "winner",
    winner: best.player,
    runnerUp: sorted[1]?.player,
    margin: best.score - (sorted[1]?.score ?? 0),
    score: best.score,
  };
}

export function formatVersusShareText(config: VersusMatchConfig, results: VersusRunResult[]): string {
  const outcome = calculateVersusOutcome(config.players, results);
  const rows = results
    .slice()
    .sort(compareVersusResults)
    .map((result) => `${result.player.name}: ${result.score}`)
    .join("\n");
  const headline = outcome.status === "winner"
    ? `Winner: ${outcome.winner.name} by ${outcome.margin}`
    : outcome.status === "tie"
      ? `Tie: ${outcome.players.map((player) => player.name).join(", ")}`
      : `Waiting for ${outcome.totalCount - outcome.completedCount} player(s)`;

  return [
    "Multi Cars Friends Battle",
    rows,
    headline,
    `Mode: ${config.settings.endless ? "Endless" : `${Math.round(config.settings.durationMs / 1000)}s timed`}, ${config.settings.carCount} car(s), Speed ${config.settings.speedLevelMin}-${config.settings.speedLevelMax}`,
  ].filter(Boolean).join("\n");
}

export function normalizeVersusSettings(settings: VersusSettingsInput = {}): VersusMatchSettings {
  const speedSettings = normalizeClassicSpeedSettings({
    minLevel: settings.speedLevelMin ?? DEFAULT_CLASSIC_SPEED_SETTINGS.minLevel,
    maxLevel: settings.speedLevelMax ?? DEFAULT_CLASSIC_SPEED_SETTINGS.maxLevel,
  });
  const durationMs = Number(settings.durationMs);

  return {
    carCount: normalizeClassicCarCount(settings.carCount),
    speedLevelMin: speedSettings.minLevel,
    speedLevelMax: speedSettings.maxLevel,
    modifierSettings: normalizeGameplayModifierSettings(settings.modifierSettings),
    endless: settings.endless ?? true,
    durationMs: Number.isFinite(durationMs) ? Math.max(15_000, Math.trunc(durationMs)) : VERSUS_DEFAULT_DURATION_MS,
  };
}

function compareVersusResults(left: VersusRunResult, right: VersusRunResult): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  if (left.timeMs !== right.timeMs) {
    return right.timeMs - left.timeMs;
  }

  return right.speedLevel - left.speedLevel;
}

function normalizePlayerName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed.slice(0, 24) : "Player";
}

function createShortId(): string {
  playerIdCounter += 1;
  return `${Date.now().toString(36)}-${playerIdCounter.toString(36)}`;
}
