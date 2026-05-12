import type { RunSummary, SimulationState } from "../core/types";
import type { AchievementId } from "../core/engagement/achievements";
import type { ReplayClip } from "../core/replay/replayBuffer";
import type { SupportedClassicCarCount } from "../core/constants";
import type {
  VersusMatchConfig,
  VersusPlayer,
  VersusRunResult,
} from "../core/multiplayer/versusMode";

export type AppScreen = "home" | "classic-select" | "challenge-select" | "practice-select" | "friend-battle" | "garage" | "settings" | "gameplay" | "summary";
export type PlayMode = "classic" | "challenge" | "practice" | "daily" | "versus";

export type GameBootConfig = {
  mode: PlayMode;
  runIndex?: number;
  trackId?: string;
  drillId?: string;
  carCount?: SupportedClassicCarCount;
  versusMatchConfig?: VersusMatchConfig;
  versusPlayer?: VersusPlayer;
};

export type RunEndedDetail = {
  summary: RunSummary;
  nextRunIndex: number;
  mode: PlayMode;
  trackId?: string;
  drillId?: string;
  carCount?: SupportedClassicCarCount;
  versusResult?: VersusRunResult;
  unlockedAchievementIds?: AchievementId[];
  finalState?: SimulationState;
  replay?: ReplayClip;
};

export const RUN_ENDED_EVENT = "multi-cars:run-ended";
export const MENU_REQUEST_EVENT = "multi-cars:menu-requested";

declare global {
  interface Window {
    __MULTI_CARS_BOOT__?: GameBootConfig;
    __MULTI_CARS_TEST_FAIL__?: () => void;
  }

  interface WindowEventMap {
    [RUN_ENDED_EVENT]: CustomEvent<RunEndedDetail>;
    [MENU_REQUEST_EVENT]: CustomEvent<void>;
  }
}

export function emitRunEnded(detail: RunEndedDetail): void {
  window.dispatchEvent(new CustomEvent(RUN_ENDED_EVENT, { detail }));
}

export function emitMenuRequested(): void {
  window.dispatchEvent(new CustomEvent(MENU_REQUEST_EVENT));
}
