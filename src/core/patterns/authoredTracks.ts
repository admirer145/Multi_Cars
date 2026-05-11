import type { LaneIndex, ModeConfig, ObjectKind, PatternEvent, PatternFamily, RoadSide } from "../types";
import { assertValidPattern } from "./patternValidation";
import { PATTERN_FAMILIES } from "./patternTypes";

type AuthoredEventSpec = {
  beat: number;
  side: RoadSide;
  lane: LaneIndex;
  kind: ObjectKind;
  family: PatternFamily;
};

export type AuthoredTrack = {
  id: string;
  label: string;
  category: "focus" | "coordination" | "recognition" | "reaction" | "endurance";
  level: number;
  description: string;
  roadTheme: "city" | "neon" | "storm" | "canyon";
  skillFocus: PatternFamily[];
  beatIntervalMs: number;
  events: AuthoredEventSpec[];
};

const ROUTE_CLEARANCE_MS = 3_200;

export const AUTHORED_TRACKS: AuthoredTrack[] = createAuthoredTracks();

function createAuthoredTracks(): AuthoredTrack[] {
  const levels = [1, 2, 3, 4, 5];

  return [
    ...levels.map((level) => createFocusTrack(level)),
    ...levels.map((level) => createCoordinationTrack(level)),
    ...levels.map((level) => createRecognitionTrack(level)),
    ...levels.map((level) => createReactionTrack(level)),
    ...levels.map((level) => createEnduranceTrack(level)),
  ];
}

function createFocusTrack(level: number): AuthoredTrack {
  return {
    id: level === 1 ? "starter-focus-01" : `focus-thread-${formatLevel(level)}`,
    label: `Focus Road ${toRoman(level)}`,
    category: "focus",
    level,
    description: level === 1
      ? "Clean lane reading with calm spacing."
      : "Longer focus chains with fewer recovery beats.",
    roadTheme: "city",
    skillFocus: level >= 3 ? ["focus", "recovery", "deceptive"] : ["focus", "recovery"],
    beatIntervalMs: Math.max(760, 920 - level * 34),
    events: createFocusEvents(level),
  };
}

function createCoordinationTrack(level: number): AuthoredTrack {
  return {
    id: level === 1 ? "starter-mirror-01" : level === 2 ? "coordination-cross-02" : `coordination-cross-${formatLevel(level)}`,
    label: level === 1 ? "Mirror Road I" : `Cross Hands ${toRoman(level)}`,
    category: "coordination",
    level,
    description: level === 1
      ? "Opposite-hand movement with steady rhythm."
      : "Sync, mirror, and delayed hand patterns combine.",
    roadTheme: "neon",
    skillFocus: level >= 3 ? ["sync", "mirror", "delayed"] : ["sync", "mirror"],
    beatIntervalMs: Math.max(760, 940 - level * 34),
    events: createCoordinationEvents(level),
  };
}

function createRecognitionTrack(level: number): AuthoredTrack {
  return {
    id: level === 1 ? "recognition-shift-01" : `recognition-shift-${formatLevel(level)}`,
    label: `Pattern Shift ${toRoman(level)}`,
    category: "recognition",
    level,
    description: "Repeated rhythms change before they become automatic.",
    roadTheme: "storm",
    skillFocus: level >= 4 ? ["deceptive", "alternating", "delayed"] : ["deceptive", "alternating"],
    beatIntervalMs: Math.max(740, 890 - level * 34),
    events: createRecognitionEvents(level),
  };
}

function createReactionTrack(level: number): AuthoredTrack {
  return {
    id: level === 1 ? "reaction-gate-01" : `reaction-gate-${formatLevel(level)}`,
    label: `Reaction Gate ${toRoman(level)}`,
    category: "reaction",
    level,
    description: "Faster decisions with short recovery windows.",
    roadTheme: "canyon",
    skillFocus: level >= 3 ? ["pressure", "recovery", "alternating"] : ["pressure", "recovery"],
    beatIntervalMs: Math.max(700, 820 - level * 28),
    events: createReactionEvents(level),
  };
}

function createEnduranceTrack(level: number): AuthoredTrack {
  return {
    id: `endurance-run-${formatLevel(level)}`,
    label: `Endurance Run ${toRoman(level)}`,
    category: "endurance",
    level,
    description: "Sustain attention across longer mixed-pattern runs.",
    roadTheme: level % 2 === 0 ? "storm" : "city",
    skillFocus: level >= 4 ? ["focus", "sync", "pressure", "recovery"] : ["focus", "sync", "recovery"],
    beatIntervalMs: Math.max(780, 940 - level * 24),
    events: createEnduranceEvents(level),
  };
}

function createFocusEvents(level: number): AuthoredEventSpec[] {
  const count = 10 + level * 2;
  return Array.from({ length: count }, (_, index) => {
    const beat = index + 1;
    const side = beat % 2 === 1 ? "left" : "right";
    const obstacleBeat = level >= 2 && beat % Math.max(4, 7 - level) === 0;
    return {
      beat,
      side,
      lane: ((beat + Math.floor(beat / 3) + level) % 2) as LaneIndex,
      kind: obstacleBeat ? "obstacle" : "collectible",
      family: obstacleBeat ? (level >= 3 ? "deceptive" : "recovery") : "focus",
    };
  });
}

function createCoordinationEvents(level: number): AuthoredEventSpec[] {
  const beats = 5 + level;
  const events: AuthoredEventSpec[] = [];

  for (let beat = 1; beat <= beats; beat += 1) {
    const lane = (beat + level) % 2 as LaneIndex;
    const family: PatternFamily = beat % 3 === 0 && level >= 3 ? "delayed" : beat % 2 === 0 ? "sync" : "mirror";
    const rightLane = family === "sync" ? lane : invertLane(lane);
    const kind: ObjectKind = level >= 2 && beat % 4 === 0 ? "obstacle" : "collectible";

    events.push({ beat, side: "left", lane, kind, family });
    events.push({ beat: family === "delayed" ? beat + 0.52 : beat, side: "right", lane: rightLane, kind, family });
  }

  return events;
}

function createRecognitionEvents(level: number): AuthoredEventSpec[] {
  const count = 9 + level * 2;
  return Array.from({ length: count }, (_, index) => {
    const beat = index + 1;
    const family: PatternFamily = beat % 5 === 0 && level >= 4 ? "delayed" : beat % 3 === 0 ? "alternating" : "deceptive";
    const side = beat % 2 === 1 ? "left" : "right";
    const repeatedLane = beat % 4 < 2 ? 0 : 1;
    return {
      beat,
      side,
      lane: (family === "alternating" ? (beat + level) % 2 : repeatedLane) as LaneIndex,
      kind: level >= 2 && beat % 6 === 0 ? "obstacle" : "collectible",
      family,
    };
  });
}

function createReactionEvents(level: number): AuthoredEventSpec[] {
  const beats = 6 + level;
  const events: AuthoredEventSpec[] = [];

  for (let beat = 1; beat <= beats; beat += 1) {
    const leftLane = (beat + level) % 2 as LaneIndex;
    const rightLane = invertLane(leftLane);
    const paired = beat % 2 === 1 || level >= 4;
    const obstacleSide: RoadSide = beat % 3 === 0 ? "left" : "right";

    events.push({
      beat,
      side: "left",
      lane: leftLane,
      kind: level >= 2 && obstacleSide === "left" && beat % 3 === 0 ? "obstacle" : "collectible",
      family: beat % 5 === 0 ? "recovery" : "pressure",
    });

    if (paired) {
      events.push({
        beat,
        side: "right",
        lane: rightLane,
        kind: level >= 2 && obstacleSide === "right" && beat % 3 === 0 ? "obstacle" : "collectible",
        family: beat % 5 === 0 ? "recovery" : "pressure",
      });
    }
  }

  return events;
}

function createEnduranceEvents(level: number): AuthoredEventSpec[] {
  const count = 12 + level * 3;
  const events: AuthoredEventSpec[] = [];

  for (let beat = 1; beat <= count; beat += 1) {
    const family: PatternFamily =
      beat % 8 === 0 && level >= 4 ? "pressure" : beat % 5 === 0 ? "sync" : beat % 6 === 0 ? "recovery" : "focus";
    const lane = (beat + Math.floor(beat / 2) + level) % 2 as LaneIndex;
    const kind: ObjectKind = level >= 3 && beat % 7 === 0 ? "obstacle" : "collectible";

    if (family === "sync") {
      events.push({ beat, side: "left", lane, kind, family });
      events.push({ beat, side: "right", lane, kind, family });
      continue;
    }

    events.push({
      beat,
      side: beat % 2 === 0 ? "right" : "left",
      lane,
      kind,
      family,
    });
  }

  return events;
}

function invertLane(lane: LaneIndex): LaneIndex {
  return lane === 0 ? 1 : 0;
}

function formatLevel(level: number): string {
  return String(level).padStart(2, "0");
}

function toRoman(level: number): string {
  return ["I", "II", "III", "IV", "V"][level - 1] ?? String(level);
}

export function getAuthoredTrack(trackId: string): AuthoredTrack | undefined {
  return AUTHORED_TRACKS.find((track) => track.id === trackId);
}

export function getAuthoredTracksByCategory(category: AuthoredTrack["category"]): AuthoredTrack[] {
  return AUTHORED_TRACKS.filter((track) => track.category === category).sort((a, b) => a.level - b.level);
}

export function buildAuthoredPattern(track: AuthoredTrack, config: ModeConfig): PatternEvent[] {
  const lastBeat = Math.max(...track.events.map((event) => event.beat));
  const cycleDurationMs = (lastBeat + 3) * track.beatIntervalMs;
  const latestSpawnTimeMs = Math.max(0, config.durationMs - ROUTE_CLEARANCE_MS);
  const events: PatternEvent[] = [];

  for (let cycle = 0; cycle * cycleDurationMs <= latestSpawnTimeMs; cycle += 1) {
    const cycleOffsetMs = cycle * cycleDurationMs;

    track.events.forEach((event, index) => {
      const timeMs = cycleOffsetMs + event.beat * track.beatIntervalMs;

      if (timeMs > latestSpawnTimeMs) {
        return;
      }

      events.push({
        id: `${track.id}-cycle-${cycle}-${index}-${event.side}`,
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

  assertValidPattern(events, config);
  return events.sort((a, b) => a.timeMs - b.timeMs || a.id.localeCompare(b.id));
}
