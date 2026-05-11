import type { LANES, ROAD_SIDES } from "./constants";
import type {
  GameplayModifierSettings,
  PowerUpId,
} from "./modifiers/gameplayModifiers";

export type RoadSide = (typeof ROAD_SIDES)[number];
export type LaneIndex = (typeof LANES)[number];
export type ObjectKind =
  | "collectible"
  | "obstacle"
  | "power-up"
  | "moving-obstacle"
  | "fake-collectible"
  | "timed-gate"
  | "color-match"
  | "dual-collect";
export type SkillTag =
  | "focus"
  | "coordination"
  | "pattern-recognition"
  | "reaction"
  | "endurance";
export type PatternFamily =
  | "focus"
  | "sync"
  | "mirror"
  | "alternating"
  | "delayed"
  | "deceptive"
  | "pressure"
  | "recovery";

export type GameStatus = "ready" | "running" | "paused" | "failed" | "completed";

export type PatternEvent = {
  id: string;
  timeMs: number;
  side: RoadSide;
  lane: LaneIndex;
  kind: ObjectKind;
  required: boolean;
  powerUpId?: PowerUpId;
  dualPairId?: string;
  colorKey?: RoadSide;
  skillTags: SkillTag[];
  patternFamily: PatternFamily;
};

export type ActiveObjectState = PatternEvent & {
  spawnLane?: LaneIndex;
  y: number;
  collected: boolean;
  missed: boolean;
};

export type CarState = {
  side: RoadSide;
  lane: LaneIndex;
};

export type FailureReason = "missed-collectible" | "hit-obstacle";

export type FailureState = {
  reason: FailureReason;
  side: RoadSide;
  lane: LaneIndex;
  objectId: string;
  timeMs: number;
  skillTags: SkillTag[];
  patternFamily: PatternFamily;
};

export type SimulationInput =
  | { type: "TOGGLE_LEFT"; atMs: number }
  | { type: "TOGGLE_RIGHT"; atMs: number }
  | { type: "PAUSE"; atMs: number }
  | { type: "RESUME"; atMs: number }
  | { type: "RESTART"; atMs: number };

export type ModeConfig = {
  id: string;
  label: string;
  seed: string;
  durationMs: number;
  endless?: boolean;
  spawnIntervalMs: number;
  objectSpeed: number;
  difficulty: number;
  speedLevelMin?: number;
  speedLevelMax?: number;
  allowedFamilies?: PatternFamily[];
  modifierSettings?: GameplayModifierSettings;
};

export type PowerUpEffectState = {
  shieldCharges: number;
  slowMotionUntilMs: number;
  magnetUntilMs: number;
  scoreMultiplierUntilMs: number;
};

export type SimulationState = {
  timeMs: number;
  cars: Record<RoadSide, CarState>;
  objects: ActiveObjectState[];
  score: number;
  status: GameStatus;
  failure?: FailureState;
  completedPercent: number;
  powerUps: PowerUpEffectState;
};

export type RunResult = "failed" | "completed" | "running" | "paused" | "ready";

export type RunSummary = {
  modeId: string;
  modeLabel: string;
  seed: string;
  score: number;
  bestScore: number;
  completedPercent: number;
  speedLevel: number;
  result: RunResult;
  failureReason?: string;
  failedPatternFamily?: PatternFamily;
  stars?: number;
};
