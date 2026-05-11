import type { RunSummary } from "../types";

export type AchievementId =
  | "first-run"
  | "classic-starter"
  | "challenge-scout"
  | "practice-focus"
  | "daily-checkin";

export type CarSkinId = "default" | "mint" | "solar" | "storm";

export type Achievement = {
  id: AchievementId;
  title: string;
  description: string;
  rewardSkinId?: CarSkinId;
};

export type AchievementState = {
  unlockedIds: AchievementId[];
};

export type AchievementUpdate = {
  state: AchievementState;
  newlyUnlockedIds: AchievementId[];
};

export type CarSkin = {
  id: CarSkinId;
  label: string;
  description: string;
  leftColor: number;
  rightColor: number;
  requiredAchievementId?: AchievementId;
};

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first-run",
    title: "Ignition",
    description: "Finish your first run in any mode.",
  },
  {
    id: "classic-starter",
    title: "Steady Hands",
    description: "Collect 5 targets in Classic.",
    rewardSkinId: "mint",
  },
  {
    id: "challenge-scout",
    title: "Road Reader",
    description: "Reach 50% progress on a Challenge road.",
    rewardSkinId: "storm",
  },
  {
    id: "practice-focus",
    title: "Training Mindset",
    description: "Start a Practice drill.",
  },
  {
    id: "daily-checkin",
    title: "Daily Driver",
    description: "Play today's Daily Road.",
    rewardSkinId: "solar",
  },
];

export const CAR_SKINS: CarSkin[] = [
  {
    id: "default",
    label: "Circuit",
    description: "Original teal and gold cars.",
    leftColor: 0x3dd6c6,
    rightColor: 0xffd166,
  },
  {
    id: "mint",
    label: "Mint Focus",
    description: "Unlocked by Steady Hands.",
    leftColor: 0x6ee7b7,
    rightColor: 0x67e8f9,
    requiredAchievementId: "classic-starter",
  },
  {
    id: "storm",
    label: "Storm Reader",
    description: "Unlocked by Road Reader.",
    leftColor: 0x93c5fd,
    rightColor: 0xfb7185,
    requiredAchievementId: "challenge-scout",
  },
  {
    id: "solar",
    label: "Solar Daily",
    description: "Unlocked by Daily Driver.",
    leftColor: 0xfacc15,
    rightColor: 0xf97316,
    requiredAchievementId: "daily-checkin",
  },
];

export function createInitialAchievementState(): AchievementState {
  return {
    unlockedIds: [],
  };
}

export function updateAchievementsForSummary(
  current: AchievementState,
  summary: RunSummary,
): AchievementUpdate {
  const unlocked = new Set(current.unlockedIds);
  const newlyUnlockedIds: AchievementId[] = [];

  for (const achievement of ACHIEVEMENTS) {
    if (unlocked.has(achievement.id)) {
      continue;
    }

    if (isAchievementUnlockedBySummary(achievement.id, summary)) {
      unlocked.add(achievement.id);
      newlyUnlockedIds.push(achievement.id);
    }
  }

  return {
    state: { unlockedIds: Array.from(unlocked) },
    newlyUnlockedIds,
  };
}

export function getAchievement(achievementId: AchievementId): Achievement {
  const achievement = ACHIEVEMENTS.find((candidate) => candidate.id === achievementId);
  if (!achievement) {
    throw new Error(`Unknown achievement: ${achievementId}`);
  }

  return achievement;
}

export function getCarSkin(skinId: CarSkinId): CarSkin {
  const skin = CAR_SKINS.find((candidate) => candidate.id === skinId);
  if (!skin) {
    throw new Error(`Unknown car skin: ${skinId}`);
  }

  return skin;
}

export function isCarSkinUnlocked(skin: CarSkin, achievementState: AchievementState): boolean {
  return !skin.requiredAchievementId || achievementState.unlockedIds.includes(skin.requiredAchievementId);
}

export function normalizeCarSkinId(
  skinId: string | null | undefined,
  achievementState: AchievementState,
): CarSkinId {
  const fallback = "default";
  const skin = CAR_SKINS.find((candidate) => candidate.id === skinId);

  if (!skin || !isCarSkinUnlocked(skin, achievementState)) {
    return fallback;
  }

  return skin.id;
}

function isAchievementUnlockedBySummary(achievementId: AchievementId, summary: RunSummary): boolean {
  switch (achievementId) {
    case "first-run":
      return summary.result === "failed" || summary.result === "completed";
    case "classic-starter":
      return summary.modeId === "classic" && summary.score >= 5;
    case "challenge-scout":
      return summary.modeId === "challenge" && summary.completedPercent >= 50;
    case "practice-focus":
      return summary.modeId === "practice";
    case "daily-checkin":
      return summary.modeId === "daily";
  }
}
