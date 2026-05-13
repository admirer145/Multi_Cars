import { getActiveRoadSides, LANES, ROAD_SIDES } from "../constants";
import {
  getEnabledObstacleVarieties,
  getEnabledPowerUps,
  type ObstacleVarietyId,
  type PowerUpId,
} from "../modifiers/gameplayModifiers";
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
  const activeSides = getActiveRoadSides(config.carCount);
  const events: PatternEvent[] = [];
  const families = config.allowedFamilies?.length
    ? config.allowedFamilies
    : DEFAULT_PATTERN_FAMILY_ORDER;
  let timeMs = 900;
  let beat = 0;

  while (timeMs <= config.durationMs) {
    const beatDifficulty = getBeatDifficulty(config.difficulty, beat);
    const family = chooseFamily(families, beat, beatDifficulty, rng);
    const plans = createFamilyPlans(family, beat, beatDifficulty, rng, activeSides);
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
  const decoratedEvents = decoratePatternWithModifiers(sortedEvents, config);
  assertValidPattern(decoratedEvents, config);
  return decoratedEvents;
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
  activeSides: RoadSide[],
): SidePlan[] {
  switch (family) {
    case "focus":
      return createFocusPlans(beat, rng, activeSides);
    case "sync":
      return createSyncPlans(beat, rng, activeSides);
    case "mirror":
      return createMirrorPlans(beat, rng, activeSides);
    case "alternating":
      return createAlternatingPlans(beat, rng, activeSides);
    case "delayed":
      return createDelayedPlans(beat, difficulty, rng, activeSides);
    case "deceptive":
      return createDeceptivePlans(beat, rng, activeSides);
    case "pressure":
      return createPressurePlans(beat, difficulty, rng, activeSides);
    case "recovery":
      return createRecoveryPlans(beat, rng, activeSides);
  }
}

function createFocusPlans(beat: number, rng: Rng, activeSides: RoadSide[]): SidePlan[] {
  const side = rng.pick(activeSides);
  return [{ side, lane: rng.pick(LANES), kind: chooseKind(beat, rng, 0.86) }];
}

function createSyncPlans(beat: number, rng: Rng, activeSides: RoadSide[]): SidePlan[] {
  const lane = rng.pick(LANES);
  return activeSides.map((side, index) => ({
    side,
    lane,
    kind: chooseKind(beat + index, rng, 0.78),
  }));
}

function createMirrorPlans(beat: number, rng: Rng, activeSides: RoadSide[]): SidePlan[] {
  const leftLane = rng.pick(LANES);
  return activeSides.map((side, index) => ({
    side,
    lane: index % 2 === 0 ? leftLane : invertLane(leftLane),
    kind: chooseKind(beat + index, rng, 0.76),
  }));
}

function createAlternatingPlans(beat: number, rng: Rng, activeSides: RoadSide[]): SidePlan[] {
  const side = activeSides[beat % activeSides.length];
  return [{ side, lane: rng.pick(LANES), kind: chooseKind(beat, rng, 0.8) }];
}

function createDelayedPlans(beat: number, difficulty: number, rng: Rng, activeSides: RoadSide[]): SidePlan[] {
  const firstSide = rng.pick(activeSides);
  const secondSide = activeSides.length > 1
    ? activeSides.find((side) => side !== firstSide) ?? firstSide
    : firstSide;
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

function createDeceptivePlans(beat: number, rng: Rng, activeSides: RoadSide[]): SidePlan[] {
  const repeatedLane = beat % 4 === 3 ? 1 : 0;
  const side = rng.pick(activeSides);
  return [{ side, lane: repeatedLane, kind: chooseKind(beat, rng, 0.74) }];
}

function createPressurePlans(beat: number, difficulty: number, rng: Rng, activeSides: RoadSide[]): SidePlan[] {
  const leftLane = rng.pick(LANES);
  const rightLane = difficulty >= 4 ? invertLane(leftLane) : rng.pick(LANES);
  return activeSides.map((side, index) => ({
    side,
    lane: index % 2 === 0 ? leftLane : rightLane,
    kind: chooseKind(beat + index, rng, 0.72),
  }));
}

function createRecoveryPlans(beat: number, rng: Rng, activeSides: RoadSide[]): SidePlan[] {
  const side = activeSides[beat % activeSides.length];
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

function decoratePatternWithModifiers(events: PatternEvent[], config: ModeConfig): PatternEvent[] {
  const enabledPowerUps = getEnabledPowerUps(config.modifierSettings);
  const enabledPickupPowerUps = enabledPowerUps.filter((id) => id !== "dual-collect");
  const enabledVarieties = getEnabledObstacleVarieties(config.modifierSettings);

  if (enabledPowerUps.length === 0 && enabledVarieties.length === 0) {
    return events;
  }

  const rng = createSeededRng(`${config.id}:${config.seed}:modifiers`);
  let powerUpIndex = 0;
  let varietyIndex = 0;
  const decoratedEvents = events.map((event) => ({ ...event }));

  if (enabledPowerUps.includes("dual-collect")) {
    applyDualCollectPairs(decoratedEvents);
  }

  const collectibleVarieties = enabledVarieties.filter((id) =>
    ["fake-collectibles", "color-match"].includes(id),
  );
  const obstacleVarieties = enabledVarieties.filter((id) =>
    ["moving-obstacles", "timed-gates"].includes(id),
  );

  for (let index = 0; index < decoratedEvents.length; index += 1) {
    const event = decoratedEvents[index];

    if (event.kind === "collectible" && enabledPickupPowerUps.length > 0 && index > 5 && rng.next() < 0.075) {
      const powerUpId = enabledPickupPowerUps[powerUpIndex % enabledPickupPowerUps.length];
      powerUpIndex += 1;
      decoratedEvents[index] = createPowerUpEvent(event, powerUpId);
      continue;
    }

    if (event.kind === "collectible" && collectibleVarieties.length > 0 && index > 8 && rng.next() < 0.1) {
      const varietyId = collectibleVarieties[varietyIndex % collectibleVarieties.length];
      varietyIndex += 1;
      decoratedEvents[index] = createCollectibleVarietyEvent(event, varietyId, rng);
      continue;
    }

    if (event.kind === "obstacle" && obstacleVarieties.length > 0 && rng.next() < 0.45) {
      const varietyId = obstacleVarieties[varietyIndex % obstacleVarieties.length];
      varietyIndex += 1;
      decoratedEvents[index] = createObstacleVarietyEvent(event, varietyId);
    }
  }

  return decoratedEvents;
}

function applyDualCollectPairs(events: PatternEvent[]): void {
  const eventsByTime = new Map<number, PatternEvent[]>();

  for (const event of events) {
    if (event.kind !== "collectible") {
      continue;
    }

    eventsByTime.set(event.timeMs, [...(eventsByTime.get(event.timeMs) ?? []), event]);
  }

  let pairIndex = 0;
  for (const [timeMs, sameTimeEvents] of eventsByTime) {
    const left = sameTimeEvents.find((event) => event.side === "left");
    const right = sameTimeEvents.find((event) => event.side === "right");

    if (!left || !right || pairIndex % 3 !== 1) {
      pairIndex += 1;
      continue;
    }

    const pairId = `dual-${timeMs}-${pairIndex}`;
    left.kind = "dual-collect";
    left.dualPairId = pairId;
    right.kind = "dual-collect";
    right.dualPairId = pairId;
    pairIndex += 1;
  }
}

function createPowerUpEvent(event: PatternEvent, powerUpId: PowerUpId): PatternEvent {
  return {
    ...event,
    kind: "power-up",
    required: false,
    powerUpId,
    dualPairId: undefined,
    colorKey: undefined,
  };
}

function createCollectibleVarietyEvent(
  event: PatternEvent,
  varietyId: ObstacleVarietyId,
  rng: Rng,
): PatternEvent {
  if (varietyId === "fake-collectibles") {
    return {
      ...event,
      kind: "fake-collectible",
      required: false,
      dualPairId: undefined,
      colorKey: undefined,
    };
  }

  const isMatchingColor = rng.next() < 0.62;
  return {
    ...event,
    kind: "color-match",
    required: isMatchingColor,
    colorKey: isMatchingColor ? event.side : invertSide(event.side),
    dualPairId: undefined,
  };
}

function createObstacleVarietyEvent(
  event: PatternEvent,
  varietyId: ObstacleVarietyId,
): PatternEvent {
  const kindByVariety: Partial<Record<ObstacleVarietyId, ObjectKind>> = {
    "moving-obstacles": "moving-obstacle",
    "timed-gates": "timed-gate",
  };

  return {
    ...event,
    kind: kindByVariety[varietyId] ?? "obstacle",
    required: false,
    dualPairId: undefined,
    colorKey: undefined,
  };
}

function invertSide(side: RoadSide): RoadSide {
  const sideIndex = ROAD_SIDES.indexOf(side);
  return ROAD_SIDES[(sideIndex + 1) % ROAD_SIDES.length];
}
