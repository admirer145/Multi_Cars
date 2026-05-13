import type { RunSummary, SimulationState } from "../core/types";
import type { AchievementId } from "../core/engagement/achievements";
import type { ReplayClip } from "../core/replay/replayBuffer";
import type { SupportedClassicCarCount } from "../core/constants";
import type { ClassicSpeedSettings } from "../core/modes/classicMode";
import type { GameplayModifierSettings } from "../core/modifiers/gameplayModifiers";

export type AppScreen = "home" | "classic-select" | "challenge-select" | "practice-select" | "garage" | "settings" | "gameplay" | "summary";
export type PlayMode = "classic" | "challenge" | "practice" | "daily";

export type GameBootConfig = {
  mode: PlayMode;
  runIndex?: number;
  trackId?: string;
  drillId?: string;
  carCount?: SupportedClassicCarCount;
};

export type RunEndedDetail = {
  summary: RunSummary;
  nextRunIndex: number;
  mode: PlayMode;
  trackId?: string;
  drillId?: string;
  carCount?: SupportedClassicCarCount;
  unlockedAchievementIds?: AchievementId[];
  finalState?: SimulationState;
  replay?: ReplayClip;
};

export type ControlRoomUpdatedDetail = {
  classicSpeedSettings: ClassicSpeedSettings;
  gameplayModifierSettings: GameplayModifierSettings;
};

export const RUN_ENDED_EVENT = "multi-cars:run-ended";
export const MENU_REQUEST_EVENT = "multi-cars:menu-requested";
export const CONTROL_ROOM_UPDATED_EVENT = "multi-cars:control-room-updated";

declare global {
  interface Window {
    __MULTI_CARS_BOOT__?: GameBootConfig;
    __MULTI_CARS_TEST_FAIL__?: () => void;
  }

  interface WindowEventMap {
    [RUN_ENDED_EVENT]: CustomEvent<RunEndedDetail>;
    [MENU_REQUEST_EVENT]: CustomEvent<void>;
    [CONTROL_ROOM_UPDATED_EVENT]: CustomEvent<ControlRoomUpdatedDetail>;
  }
}

export function emitRunEnded(detail: RunEndedDetail): void {
  window.dispatchEvent(new CustomEvent(RUN_ENDED_EVENT, { detail }));
}

export function emitMenuRequested(): void {
  window.dispatchEvent(new CustomEvent(MENU_REQUEST_EVENT));
}

export function emitControlRoomUpdated(detail: ControlRoomUpdatedDetail): void {
  window.dispatchEvent(new CustomEvent(CONTROL_ROOM_UPDATED_EVENT, { detail }));
}
