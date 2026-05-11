import { LANES, ROAD_SIDES } from "../constants";
import { createSeededRng, type Rng } from "../rng";
import type {
  LaneIndex,
  ModeConfig,
  ObjectKind,
  PatternEvent,
  PatternFamily,
  RoadSide,
} from "../types";
import { assertValidPattern } from "./patternValidation";
import { DEFAULT_PATTERN_FAMILY_ORDER, PATTERN_FAMILIES } from "./patternTypes";

type SidePlan = {
  side: RoadSide;
  lane: LaneIndex;
  kind: ObjectKind;
  offsetMs?: number;
};

export function generatePattern(config: ModeConfig): PatternEvent[] {
  const rng = createSeededRng(`${config.id}:${config.seed}:${config.difficulty}`);
  const events: PatternEvent[] = [];
  const families = config.allowedFamilies?.length
    ? config.allowedFamilies
    : DEFAULT_PATTERN_FAMILY_ORDER;
  let timeMs = 900;
  let beat = 0;

  while (timeMs <= config.durationMs) {
    const beatDifficulty = getBeatDifficulty(config.difficulty, beat);
    const family = chooseFamily(families, beat, beatDifficulty, rng);
    const plans = createFamilyPlans(family, beat, beatDifficulty, rng);
    let beatEndTimeMs = timeMs;

    for (let index = 0; index < plans.length; index += 1) {
      const plan = plans[index];
      const eventTimeMs = timeMs + (plan.offsetMs ?? 0);

      if (eventTimeMs <= config.durationMs) {
        events.push(createPatternEvent(config, family, beat, index, eventTimeMs, plan));
        beatEndTimeMs = Math.max(beatEndTimeMs, eventTimeMs);
      }
    }

    beat += 1;
    timeMs = beatEndTimeMs + getBeatIntervalMs(config, beat, beatDifficulty, rng);
  }

  const sortedEvents = events.sort((a, b) => a.timeMs - b.timeMs || a.id.localeCompare(b.id));
  assertValidPattern(sortedEvents, config);
  return sortedEvents;
}

function chooseFamily(
  families: PatternFamily[],
  beat: number,
  difficulty: number,
  rng: Rng,
): PatternFamily {
  if (beat < 4 && families.includes("focus")) {
    return "focus";
  }

  if (beat % 9 === 8 && families.includes("recovery")) {
    return "recovery";
  }

  if (difficulty >= 3 && beat % 7 === 6 && families.includes("pressure")) {
    return "pressure";
  }

  return families[rng.int(0, families.length - 1)];
}

function createFamilyPlans(
  family: PatternFamily,
  beat: number,
  difficulty: number,
  rng: Rng,
): SidePlan[] {
  switch (family) {
    case "focus":
      return createFocusPlans(beat, rng);
    case "sync":
      return createSyncPlans(beat, rng);
    case "mirror":
      return createMirrorPlans(beat, rng);
    case "alternating":
      return createAlternatingPlans(beat, rng);
    case "delayed":
      return createDelayedPlans(beat, difficulty, rng);
    case "deceptive":
      return createDeceptivePlans(beat, rng);
    case "pressure":
      return createPressurePlans(beat, difficulty, rng);
    case "recovery":
      return createRecoveryPlans(beat, rng);
  }
}

function createFocusPlans(beat: number, rng: Rng): SidePlan[] {
  const side = rng.pick(ROAD_SIDES);
  return [{ side, lane: rng.pick(LANES), kind: chooseKind(beat, rng, 0.86) }];
}

function createSyncPlans(beat: number, rng: Rng): SidePlan[] {
  const lane = rng.pick(LANES);
  return [
    { side: "left", lane, kind: chooseKind(beat, rng, 0.78) },
    { side: "right", lane, kind: chooseKind(beat + 1, rng, 0.78) },
  ];
}

function createMirrorPlans(beat: number, rng: Rng): SidePlan[] {
  const leftLane = rng.pick(LANES);
  return [
    { side: "left", lane: leftLane, kind: chooseKind(beat, rng, 0.76) },
    { side: "right", lane: invertLane(leftLane), kind: chooseKind(beat + 1, rng, 0.76) },
  ];
}

function createAlternatingPlans(beat: number, rng: Rng): SidePlan[] {
  const side = beat % 2 === 0 ? "left" : "right";
  return [{ side, lane: rng.pick(LANES), kind: chooseKind(beat, rng, 0.8) }];
}

function createDelayedPlans(beat: number, difficulty: number, rng: Rng): SidePlan[] {
  const firstSide = rng.pick(ROAD_SIDES);
  const secondSide = firstSide === "left" ? "right" : "left";
  const delayMs = Math.max(380, 620 - difficulty * 40);

  return [
    { side: firstSide, lane: rng.pick(LANES), kind: chooseKind(beat, rng, 0.78) },
    {
      side: secondSide,
      lane: rng.pick(LANES),
      kind: chooseKind(beat + 1, rng, 0.78),
      offsetMs: delayMs,
    },
  ];
}

function createDeceptivePlans(beat: number, rng: Rng): SidePlan[] {
  const repeatedLane = beat % 4 === 3 ? 1 : 0;
  const side = rng.pick(ROAD_SIDES);
  return [{ side, lane: repeatedLane, kind: chooseKind(beat, rng, 0.74) }];
}

function createPressurePlans(beat: number, difficulty: number, rng: Rng): SidePlan[] {
  const leftLane = rng.pick(LANES);
  const rightLane = difficulty >= 4 ? invertLane(leftLane) : rng.pick(LANES);

  return [
    { side: "left", lane: leftLane, kind: chooseKind(beat, rng, 0.72) },
    { side: "right", lane: rightLane, kind: chooseKind(beat + 1, rng, 0.72) },
  ];
}

function createRecoveryPlans(beat: number, rng: Rng): SidePlan[] {
  const side = beat % 2 === 0 ? "left" : "right";
  return [{ side, lane: rng.pick(LANES), kind: chooseKind(beat, rng, 0.92) }];
}

function createPatternEvent(
  config: ModeConfig,
  family: PatternFamily,
  beat: number,
  index: number,
  timeMs: number,
  plan: SidePlan,
): PatternEvent {
  return {
    id: `${config.id}-${config.seed}-${beat}-${index}-${plan.side}`,
    timeMs,
    side: plan.side,
    lane: plan.lane,
    kind: plan.kind,
    required: plan.kind === "collectible",
    skillTags: PATTERN_FAMILIES[family].skillTags,
    patternFamily: family,
  };
}

function getBeatDifficulty(baseDifficulty: number, beat: number): number {
  return Math.min(5, baseDifficulty + Math.floor(beat / 22));
}

function getBeatIntervalMs(config: ModeConfig, beat: number, difficulty: number, rng: Rng): number {
  const difficultyCompression = Math.min(220, difficulty * 22 + Math.floor(beat / 16) * 16);
  const intervalNoise = rng.int(-40, 60);
  return Math.max(620, config.spawnIntervalMs - difficultyCompression + intervalNoise);
}

function chooseKind(beat: number, rng: Rng, collectibleChance: number): ObjectKind {
  if (beat < 4) {
    return "collectible";
  }

  return rng.next() < collectibleChance ? "collectible" : "obstacle";
}

function invertLane(lane: LaneIndex): LaneIndex {
  return lane === 0 ? 1 : 0;
}
