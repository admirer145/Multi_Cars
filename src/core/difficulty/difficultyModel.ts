import {
  DEFAULT_OBJECT_SPEED,
  DEFAULT_SPAWN_INTERVAL_MS,
  DEFAULT_TRACK_DURATION_MS,
} from "../constants";
import type { ModeConfig } from "../types";
export { createClassicMode } from "../modes/classicMode";

export function getSpeedAtTime(config: ModeConfig, timeMs: number): number {
  const level = Math.floor(timeMs / 15_000);
  return config.objectSpeed + level * 26;
}

export function getSpawnIntervalAtTime(config: ModeConfig, timeMs: number): number {
  const level = Math.floor(timeMs / 20_000);
  return Math.max(620, config.spawnIntervalMs - level * 35);
}
