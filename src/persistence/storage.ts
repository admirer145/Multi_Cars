import type { ChallengeProgress } from "../core/modes/challengeMode";
import type { SupportedClassicCarCount } from "../core/constants";
import {
  normalizeAudioSettings,
  type AudioSettings,
} from "../core/audio/audioSettings";
import {
  createInitialAchievementState,
  normalizeCarSkinId,
  type AchievementState,
  type CarSkinId,
} from "../core/engagement/achievements";
import {
  normalizeClassicSpeedSettings,
  type ClassicSpeedSettings,
} from "../core/modes/classicMode";
import type { DailyProgress } from "../core/modes/dailyMode";
import type { PracticeProgress } from "../core/modes/practiceMode";
import {
  normalizeGameplayModifierSettings,
  type GameplayModifierSettings,
  type GameplayModifierSettingsInput,
} from "../core/modifiers/gameplayModifiers";

const HIGH_SCORE_KEY = "multi-cars:classic-high-score:v1";
const CLASSIC_SPEED_SETTINGS_KEY = "multi-cars:classic-speed-settings:v1";
const GAMEPLAY_MODIFIER_SETTINGS_KEY = "multi-cars:gameplay-modifier-settings:v1";
const ACHIEVEMENTS_KEY = "multi-cars:achievements:v1";
const SELECTED_CAR_SKIN_KEY = "multi-cars:selected-car-skin:v1";
const AUDIO_SETTINGS_KEY = "multi-cars:audio-settings:v1";
const CHALLENGE_PROGRESS_PREFIX = "multi-cars:challenge-progress:v1:";
const DAILY_PROGRESS_PREFIX = "multi-cars:daily-progress:v1:";
const PRACTICE_PROGRESS_PREFIX = "multi-cars:practice-progress:v1:";

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

export function loadClassicHighScoreForCarCount(
  carCount: SupportedClassicCarCount,
  storage: StorageLike = getBrowserStorage(),
): number {
  const value = storage.getItem(getClassicHighScoreKey(carCount));
  const parsed = value ? Number.parseInt(value, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function saveClassicHighScoreForCarCount(
  score: number,
  carCount: SupportedClassicCarCount,
  storage: StorageLike = getBrowserStorage(),
): void {
  const current = loadClassicHighScoreForCarCount(carCount, storage);
  if (score > current) {
    storage.setItem(getClassicHighScoreKey(carCount), String(score));
  }
}

export function loadClassicSpeedSettings(
  storage: StorageLike = getBrowserStorage(),
): ClassicSpeedSettings {
  const value = storage.getItem(CLASSIC_SPEED_SETTINGS_KEY);

  if (!value) {
    return normalizeClassicSpeedSettings();
  }

  try {
    return normalizeClassicSpeedSettings(JSON.parse(value));
  } catch {
    return normalizeClassicSpeedSettings();
  }
}

export function saveClassicSpeedSettings(
  settings: Partial<ClassicSpeedSettings>,
  storage: StorageLike = getBrowserStorage(),
): ClassicSpeedSettings {
  const normalized = normalizeClassicSpeedSettings(settings);
  storage.setItem(CLASSIC_SPEED_SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}

export function loadGameplayModifierSettings(
  storage: StorageLike = getBrowserStorage(),
): GameplayModifierSettings {
  const value = storage.getItem(GAMEPLAY_MODIFIER_SETTINGS_KEY);

  if (!value) {
    return normalizeGameplayModifierSettings();
  }

  try {
    return normalizeGameplayModifierSettings(JSON.parse(value));
  } catch {
    return normalizeGameplayModifierSettings();
  }
}

export function saveGameplayModifierSettings(
  settings: GameplayModifierSettingsInput,
  storage: StorageLike = getBrowserStorage(),
): GameplayModifierSettings {
  const normalized = normalizeGameplayModifierSettings(settings);
  storage.setItem(GAMEPLAY_MODIFIER_SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
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

export function loadDailyProgress(
  dateKey: string,
  fallback: DailyProgress,
  storage: StorageLike = getBrowserStorage(),
): DailyProgress {
  const value = storage.getItem(`${DAILY_PROGRESS_PREFIX}${dateKey}`);

  if (!value) {
    return fallback;
  }

  try {
    return {
      ...fallback,
      ...JSON.parse(value),
      dateKey,
    };
  } catch {
    return fallback;
  }
}

export function saveDailyProgress(
  progress: DailyProgress,
  storage: StorageLike = getBrowserStorage(),
): void {
  storage.setItem(`${DAILY_PROGRESS_PREFIX}${progress.dateKey}`, JSON.stringify(progress));
}

export function loadPracticeProgress(
  drillId: string,
  fallback: PracticeProgress,
  storage: StorageLike = getBrowserStorage(),
): PracticeProgress {
  const value = storage.getItem(`${PRACTICE_PROGRESS_PREFIX}${drillId}`);

  if (!value) {
    return fallback;
  }

  try {
    return {
      ...fallback,
      ...JSON.parse(value),
      drillId,
    };
  } catch {
    return fallback;
  }
}

export function savePracticeProgress(
  progress: PracticeProgress,
  storage: StorageLike = getBrowserStorage(),
): void {
  storage.setItem(`${PRACTICE_PROGRESS_PREFIX}${progress.drillId}`, JSON.stringify(progress));
}

export function loadAchievementState(
  storage: StorageLike = getBrowserStorage(),
): AchievementState {
  const fallback = createInitialAchievementState();
  const value = storage.getItem(ACHIEVEMENTS_KEY);

  if (!value) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value) as Partial<AchievementState>;
    return {
      unlockedIds: Array.isArray(parsed.unlockedIds) ? parsed.unlockedIds : fallback.unlockedIds,
    };
  } catch {
    return fallback;
  }
}

export function saveAchievementState(
  state: AchievementState,
  storage: StorageLike = getBrowserStorage(),
): AchievementState {
  storage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(state));
  return state;
}

export function loadSelectedCarSkin(
  storage: StorageLike = getBrowserStorage(),
): CarSkinId {
  return normalizeCarSkinId(storage.getItem(SELECTED_CAR_SKIN_KEY), loadAchievementState(storage));
}

export function saveSelectedCarSkin(
  skinId: CarSkinId,
  achievementState: AchievementState = loadAchievementState(),
  storage: StorageLike = getBrowserStorage(),
): CarSkinId {
  const normalized = normalizeCarSkinId(skinId, achievementState);
  storage.setItem(SELECTED_CAR_SKIN_KEY, normalized);
  return normalized;
}

export function loadAudioSettings(
  storage: StorageLike = getBrowserStorage(),
): AudioSettings {
  const value = storage.getItem(AUDIO_SETTINGS_KEY);

  if (!value) {
    return normalizeAudioSettings();
  }

  try {
    return normalizeAudioSettings(JSON.parse(value));
  } catch {
    return normalizeAudioSettings();
  }
}

export function saveAudioSettings(
  settings: Partial<AudioSettings>,
  storage: StorageLike = getBrowserStorage(),
): AudioSettings {
  const normalized = normalizeAudioSettings(settings);
  storage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}

function getBrowserStorage(): StorageLike {
  return window.localStorage;
}

function getClassicHighScoreKey(carCount: SupportedClassicCarCount): string {
  return carCount === 2 ? HIGH_SCORE_KEY : `${HIGH_SCORE_KEY}:${carCount}-car`;
}
