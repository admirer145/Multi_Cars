export type PowerUpId = "shield" | "slow-motion" | "magnet" | "score-multiplier" | "dual-collect";

export type ObstacleVarietyId =
  | "moving-obstacles"
  | "fake-collectibles"
  | "timed-gates"
  | "color-match";

export type GameplayModifierSettings = {
  powerUps: Record<PowerUpId, boolean>;
  obstacleVariety: Record<ObstacleVarietyId, boolean>;
};

export type GameplayModifierSettingsInput = {
  powerUps?: Partial<Record<PowerUpId, boolean>>;
  obstacleVariety?: Partial<Record<ObstacleVarietyId, boolean>>;
};

export type GameplayModifierMeta = {
  id: PowerUpId | ObstacleVarietyId;
  label: string;
  description: string;
};

export const POWER_UP_OPTIONS: GameplayModifierMeta[] = [
  {
    id: "shield",
    label: "Shield",
    description: "Survive one obstacle hit while keeping the run alive.",
  },
  {
    id: "slow-motion",
    label: "Slow Motion",
    description: "Temporarily reduces object speed for calmer decisions.",
  },
  {
    id: "magnet",
    label: "Magnet",
    description: "Pulls collectibles into reach when timing is tight.",
  },
  {
    id: "score-multiplier",
    label: "Score Multiplier",
    description: "Doubles collectible score for a short focus burst.",
  },
  {
    id: "dual-collect",
    label: "Dual Collect",
    description: "Adds paired collectibles that reward both-hand coordination.",
  },
];

export const OBSTACLE_VARIETY_OPTIONS: GameplayModifierMeta[] = [
  {
    id: "moving-obstacles",
    label: "Moving Obstacles",
    description: "Hazards slide between lanes and demand tracking.",
  },
  {
    id: "fake-collectibles",
    label: "Fake Collectibles",
    description: "Green-looking traps punish automatic collection.",
  },
  {
    id: "timed-gates",
    label: "Timed Gates",
    description: "Blinking gates are dangerous only while closed.",
  },
  {
    id: "color-match",
    label: "Color Matching",
    description: "Matching colors must be collected; wrong colors act as traps.",
  },
];

export const POWER_UP_DURATION_MS: Record<Exclude<PowerUpId, "shield" | "dual-collect">, number> = {
  "slow-motion": 5_000,
  magnet: 6_000,
  "score-multiplier": 7_000,
};

export const DEFAULT_GAMEPLAY_MODIFIER_SETTINGS: GameplayModifierSettings = {
  powerUps: createDisabledRecord(POWER_UP_OPTIONS.map((option) => option.id as PowerUpId)),
  obstacleVariety: createDisabledRecord(
    OBSTACLE_VARIETY_OPTIONS.map((option) => option.id as ObstacleVarietyId),
  ),
};

export function normalizeGameplayModifierSettings(
  settings?: GameplayModifierSettingsInput | null,
): GameplayModifierSettings {
  return {
    powerUps: normalizeBooleanRecord(DEFAULT_GAMEPLAY_MODIFIER_SETTINGS.powerUps, settings?.powerUps),
    obstacleVariety: normalizeBooleanRecord(
      DEFAULT_GAMEPLAY_MODIFIER_SETTINGS.obstacleVariety,
      settings?.obstacleVariety,
    ),
  };
}

export function getEnabledPowerUps(settings?: GameplayModifierSettingsInput | null): PowerUpId[] {
  const normalized = normalizeGameplayModifierSettings(settings);
  return POWER_UP_OPTIONS
    .map((option) => option.id as PowerUpId)
    .filter((id) => normalized.powerUps[id]);
}

export function getEnabledObstacleVarieties(
  settings?: GameplayModifierSettingsInput | null,
): ObstacleVarietyId[] {
  const normalized = normalizeGameplayModifierSettings(settings);
  return OBSTACLE_VARIETY_OPTIONS
    .map((option) => option.id as ObstacleVarietyId)
    .filter((id) => normalized.obstacleVariety[id]);
}

export function hasEnabledGameplayModifiers(settings?: GameplayModifierSettingsInput | null): boolean {
  return getEnabledPowerUps(settings).length > 0 || getEnabledObstacleVarieties(settings).length > 0;
}

function createDisabledRecord<Key extends string>(keys: Key[]): Record<Key, boolean> {
  return keys.reduce(
    (record, key) => ({
      ...record,
      [key]: false,
    }),
    {} as Record<Key, boolean>,
  );
}

function normalizeBooleanRecord<Key extends string>(
  defaults: Record<Key, boolean>,
  value?: Partial<Record<Key, boolean>>,
): Record<Key, boolean> {
  return (Object.keys(defaults) as Key[]).reduce(
    (record, key) => ({
      ...record,
      [key]: value?.[key] === true,
    }),
    {} as Record<Key, boolean>,
  );
}
