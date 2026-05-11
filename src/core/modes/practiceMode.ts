import {
  DEFAULT_OBJECT_SPEED,
  DEFAULT_SPAWN_INTERVAL_MS,
} from "../constants";
import { assertValidPattern } from "../patterns/patternValidation";
import { PATTERN_FAMILIES } from "../patterns/patternTypes";
import type {
  LaneIndex,
  ModeConfig,
  ObjectKind,
  PatternEvent,
  PatternFamily,
  RoadSide,
  RunSummary,
  SimulationState,
  SkillTag,
} from "../types";

export const PRACTICE_MODE_ID = "practice";

type PracticeTheme = "city" | "neon" | "storm" | "canyon";

type PracticeEventSpec = {
  beat: number;
  side: RoadSide;
  lane: LaneIndex;
  kind: ObjectKind;
  family: PatternFamily;
};

export type PracticeDrill = {
  id: string;
  label: string;
  focus: SkillTag;
  description: string;
  roadTheme: PracticeTheme;
  beatIntervalMs: number;
  durationMs: number;
  events: PracticeEventSpec[];
};

export type PracticeRun = {
  drill: PracticeDrill;
  config: ModeConfig;
  pattern: PatternEvent[];
};

export type PracticeRunSummary = RunSummary & {
  modeId: typeof PRACTICE_MODE_ID;
};

export type PracticeProgress = {
  drillId: string;
  bestPercent: number;
  bestScore: number;
  completed: boolean;
  attempts: number;
};

const PRACTICE_CLEARANCE_MS = 3_200;

export const PRACTICE_DRILLS: PracticeDrill[] = [
  {
    id: "left-hand-focus",
    label: "Left Hand Focus",
    focus: "focus",
    description: "Train left-side lane reading while the right hand stays calm.",
    roadTheme: "city",
    beatIntervalMs: 920,
    durationMs: 45_000,
    events: [
      { beat: 1, side: "left", lane: 0, kind: "collectible", family: "focus" },
      { beat: 2, side: "left", lane: 1, kind: "collectible", family: "focus" },
      { beat: 3, side: "left", lane: 0, kind: "obstacle", family: "recovery" },
      { beat: 4, side: "left", lane: 1, kind: "collectible", family: "focus" },
      { beat: 5, side: "left", lane: 0, kind: "collectible", family: "focus" },
    ],
  },
  {
    id: "right-hand-focus",
    label: "Right Hand Focus",
    focus: "focus",
    description: "Isolate right-side decisions without changing the core fail rules.",
    roadTheme: "city",
    beatIntervalMs: 920,
    durationMs: 45_000,
    events: [
      { beat: 1, side: "right", lane: 1, kind: "collectible", family: "focus" },
      { beat: 2, side: "right", lane: 0, kind: "collectible", family: "focus" },
      { beat: 3, side: "right", lane: 1, kind: "obstacle", family: "recovery" },
      { beat: 4, side: "right", lane: 0, kind: "collectible", family: "focus" },
      { beat: 5, side: "right", lane: 1, kind: "collectible", family: "focus" },
    ],
  },
  {
    id: "mirror-switches",
    label: "Mirror Switches",
    focus: "coordination",
    description: "Both hands move in mirrored lanes with readable spacing.",
    roadTheme: "neon",
    beatIntervalMs: 940,
    durationMs: 50_000,
    events: [
      { beat: 1, side: "left", lane: 0, kind: "collectible", family: "mirror" },
      { beat: 1, side: "right", lane: 1, kind: "collectible", family: "mirror" },
      { beat: 2, side: "left", lane: 1, kind: "collectible", family: "mirror" },
      { beat: 2, side: "right", lane: 0, kind: "collectible", family: "mirror" },
      { beat: 3, side: "left", lane: 0, kind: "obstacle", family: "mirror" },
      { beat: 3, side: "right", lane: 1, kind: "obstacle", family: "mirror" },
      { beat: 4, side: "left", lane: 1, kind: "collectible", family: "mirror" },
      { beat: 4, side: "right", lane: 0, kind: "collectible", family: "mirror" },
    ],
  },
  {
    id: "sync-lanes",
    label: "Sync Lanes",
    focus: "coordination",
    description: "Read same-lane decisions across both road groups.",
    roadTheme: "storm",
    beatIntervalMs: 960,
    durationMs: 50_000,
    events: [
      { beat: 1, side: "left", lane: 0, kind: "collectible", family: "sync" },
      { beat: 1, side: "right", lane: 0, kind: "collectible", family: "sync" },
      { beat: 2, side: "left", lane: 1, kind: "collectible", family: "sync" },
      { beat: 2, side: "right", lane: 1, kind: "collectible", family: "sync" },
      { beat: 3, side: "left", lane: 0, kind: "obstacle", family: "sync" },
      { beat: 3, side: "right", lane: 0, kind: "obstacle", family: "sync" },
      { beat: 4, side: "left", lane: 1, kind: "collectible", family: "sync" },
      { beat: 4, side: "right", lane: 1, kind: "collectible", family: "sync" },
    ],
  },
  {
    id: "alternating-rhythm",
    label: "Alternating Rhythm",
    focus: "pattern-recognition",
    description: "Build pattern recognition by shifting attention side to side.",
    roadTheme: "canyon",
    beatIntervalMs: 840,
    durationMs: 55_000,
    events: [
      { beat: 1, side: "left", lane: 0, kind: "collectible", family: "alternating" },
      { beat: 2, side: "right", lane: 1, kind: "collectible", family: "alternating" },
      { beat: 3, side: "left", lane: 1, kind: "collectible", family: "alternating" },
      { beat: 4, side: "right", lane: 0, kind: "collectible", family: "alternating" },
      { beat: 5, side: "left", lane: 0, kind: "obstacle", family: "deceptive" },
      { beat: 6, side: "right", lane: 1, kind: "collectible", family: "alternating" },
    ],
  },
];

export function getPracticeDrill(drillId: string): PracticeDrill | undefined {
  return PRACTICE_DRILLS.find((drill) => drill.id === drillId);
}

export function getStarterPracticeDrill(): PracticeDrill {
  return PRACTICE_DRILLS[0];
}

export function createPracticeMode(drill: PracticeDrill): ModeConfig {
  return {
    id: PRACTICE_MODE_ID,
    label: drill.label,
    seed: `${PRACTICE_MODE_ID}-${drill.id}`,
    durationMs: drill.durationMs,
    spawnIntervalMs: DEFAULT_SPAWN_INTERVAL_MS,
    objectSpeed: DEFAULT_OBJECT_SPEED,
    difficulty: 1,
    allowedFamilies: Array.from(new Set(drill.events.map((event) => event.family))),
  };
}

export function createPracticeRun(drillId = getStarterPracticeDrill().id): PracticeRun {
  const drill = getPracticeDrill(drillId);

  if (!drill) {
    throw new Error(`Unknown practice drill: ${drillId}`);
  }

  const config = createPracticeMode(drill);
  return {
    drill,
    config,
    pattern: buildPracticePattern(drill, config),
  };
}

export function createPracticeRunSummary(
  state: SimulationState,
  config: ModeConfig,
  progress: PracticeProgress = createInitialPracticeProgress(config.seed.replace(`${PRACTICE_MODE_ID}-`, "")),
): PracticeRunSummary {
  const completedPercent = Math.round(state.completedPercent);
  return {
    modeId: PRACTICE_MODE_ID,
    modeLabel: config.label,
    seed: config.seed,
    score: state.score,
    bestScore: progress.bestPercent,
    completedPercent,
    speedLevel: 1,
    result: state.status,
    failureReason: state.failure?.reason,
    failedPatternFamily: state.failure?.patternFamily,
  };
}

export function createInitialPracticeProgress(drillId: string): PracticeProgress {
  return {
    drillId,
    bestPercent: 0,
    bestScore: 0,
    completed: false,
    attempts: 0,
  };
}

export function updatePracticeProgress(
  current: PracticeProgress,
  completedPercent: number,
  score: number,
): PracticeProgress {
  const bestPercent = Math.max(current.bestPercent, Math.round(completedPercent));
  return {
    ...current,
    bestPercent,
    bestScore: Math.max(current.bestScore, score),
    completed: current.completed || bestPercent >= 100,
    attempts: current.attempts + 1,
  };
}

function buildPracticePattern(drill: PracticeDrill, config: ModeConfig): PatternEvent[] {
  const lastBeat = Math.max(...drill.events.map((event) => event.beat));
  const cycleDurationMs = (lastBeat + 3) * drill.beatIntervalMs;
  const latestSpawnTimeMs = Math.max(0, config.durationMs - PRACTICE_CLEARANCE_MS);
  const events: PatternEvent[] = [];

  for (let cycle = 0; cycle * cycleDurationMs <= latestSpawnTimeMs; cycle += 1) {
    const cycleOffsetMs = cycle * cycleDurationMs;

    drill.events.forEach((event, index) => {
      const timeMs = cycleOffsetMs + event.beat * drill.beatIntervalMs;

      if (timeMs > latestSpawnTimeMs) {
        return;
      }

      events.push({
        id: `${drill.id}-cycle-${cycle}-${index}-${event.side}`,
        timeMs,
        side: event.side,
        lane: event.lane,
        kind: event.kind,
        required: event.kind === "collectible",
        skillTags: PATTERN_FAMILIES[event.family].skillTags,
        patternFamily: event.family,
      });
    });
  }

  const sortedEvents = events.sort((a, b) => a.timeMs - b.timeMs || a.id.localeCompare(b.id));
  assertValidPattern(sortedEvents, config);
  return sortedEvents;
}
