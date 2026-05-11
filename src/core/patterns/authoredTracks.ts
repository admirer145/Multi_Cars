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

export const AUTHORED_TRACKS: AuthoredTrack[] = [
  {
    id: "starter-focus-01",
    label: "Focus Road I",
    category: "focus",
    level: 1,
    description: "Clean lane reading with calm spacing.",
    roadTheme: "city",
    skillFocus: ["focus", "recovery"],
    beatIntervalMs: 900,
    events: [
      { beat: 1, side: "left", lane: 0, kind: "collectible", family: "focus" },
      { beat: 2, side: "right", lane: 1, kind: "collectible", family: "focus" },
      { beat: 3, side: "left", lane: 1, kind: "collectible", family: "focus" },
      { beat: 4, side: "right", lane: 0, kind: "collectible", family: "focus" },
      { beat: 5, side: "left", lane: 0, kind: "obstacle", family: "recovery" },
      { beat: 6, side: "right", lane: 1, kind: "collectible", family: "focus" },
      { beat: 7, side: "left", lane: 1, kind: "collectible", family: "focus" },
      { beat: 8, side: "right", lane: 0, kind: "obstacle", family: "recovery" },
      { beat: 9, side: "left", lane: 0, kind: "collectible", family: "focus" },
      { beat: 10, side: "right", lane: 1, kind: "collectible", family: "focus" },
      { beat: 11, side: "left", lane: 1, kind: "obstacle", family: "recovery" },
      { beat: 12, side: "right", lane: 0, kind: "collectible", family: "focus" },
    ],
  },
  {
    id: "starter-mirror-01",
    label: "Mirror Road I",
    category: "coordination",
    level: 1,
    description: "Opposite-hand movement with steady rhythm.",
    roadTheme: "neon",
    skillFocus: ["mirror"],
    beatIntervalMs: 920,
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
    id: "coordination-cross-02",
    label: "Cross Hands II",
    category: "coordination",
    level: 2,
    description: "Sync and mirror switches combine into longer hand patterns.",
    roadTheme: "neon",
    skillFocus: ["sync", "mirror", "delayed"],
    beatIntervalMs: 840,
    events: [
      { beat: 1, side: "left", lane: 0, kind: "collectible", family: "sync" },
      { beat: 1, side: "right", lane: 0, kind: "collectible", family: "sync" },
      { beat: 2, side: "left", lane: 1, kind: "collectible", family: "mirror" },
      { beat: 2, side: "right", lane: 0, kind: "collectible", family: "mirror" },
      { beat: 3, side: "left", lane: 0, kind: "obstacle", family: "mirror" },
      { beat: 3, side: "right", lane: 1, kind: "obstacle", family: "mirror" },
      { beat: 4, side: "left", lane: 1, kind: "collectible", family: "delayed" },
      { beat: 5, side: "right", lane: 1, kind: "collectible", family: "delayed" },
      { beat: 6, side: "left", lane: 0, kind: "collectible", family: "sync" },
      { beat: 6, side: "right", lane: 0, kind: "collectible", family: "sync" },
    ],
  },
  {
    id: "recognition-shift-01",
    label: "Pattern Shift I",
    category: "recognition",
    level: 1,
    description: "A repeated rhythm changes before it becomes automatic.",
    roadTheme: "storm",
    skillFocus: ["deceptive", "alternating"],
    beatIntervalMs: 860,
    events: [
      { beat: 1, side: "left", lane: 0, kind: "collectible", family: "deceptive" },
      { beat: 2, side: "right", lane: 0, kind: "collectible", family: "deceptive" },
      { beat: 3, side: "left", lane: 0, kind: "collectible", family: "deceptive" },
      { beat: 4, side: "right", lane: 1, kind: "collectible", family: "deceptive" },
      { beat: 5, side: "left", lane: 1, kind: "obstacle", family: "deceptive" },
      { beat: 6, side: "right", lane: 0, kind: "collectible", family: "alternating" },
      { beat: 7, side: "left", lane: 1, kind: "collectible", family: "alternating" },
      { beat: 8, side: "right", lane: 1, kind: "obstacle", family: "deceptive" },
      { beat: 9, side: "left", lane: 0, kind: "collectible", family: "deceptive" },
    ],
  },
  {
    id: "reaction-gate-01",
    label: "Reaction Gate I",
    category: "reaction",
    level: 1,
    description: "Faster decisions with short recovery windows.",
    roadTheme: "canyon",
    skillFocus: ["pressure", "recovery"],
    beatIntervalMs: 790,
    events: [
      { beat: 1, side: "left", lane: 0, kind: "collectible", family: "pressure" },
      { beat: 1, side: "right", lane: 1, kind: "collectible", family: "pressure" },
      { beat: 2, side: "left", lane: 1, kind: "collectible", family: "pressure" },
      { beat: 2, side: "right", lane: 0, kind: "obstacle", family: "pressure" },
      { beat: 3, side: "left", lane: 0, kind: "obstacle", family: "pressure" },
      { beat: 3, side: "right", lane: 1, kind: "collectible", family: "pressure" },
      { beat: 4, side: "left", lane: 1, kind: "collectible", family: "pressure" },
      { beat: 4, side: "right", lane: 0, kind: "collectible", family: "pressure" },
      { beat: 5, side: "left", lane: 0, kind: "collectible", family: "recovery" },
      { beat: 6, side: "right", lane: 1, kind: "collectible", family: "recovery" },
    ],
  },
  {
    id: "focus-thread-02",
    label: "Focus Thread II",
    category: "focus",
    level: 2,
    description: "Longer focus chain with fewer recovery beats.",
    roadTheme: "city",
    skillFocus: ["focus", "deceptive"],
    beatIntervalMs: 820,
    events: [
      { beat: 1, side: "left", lane: 0, kind: "collectible", family: "focus" },
      { beat: 2, side: "right", lane: 1, kind: "collectible", family: "focus" },
      { beat: 3, side: "left", lane: 1, kind: "collectible", family: "focus" },
      { beat: 4, side: "right", lane: 0, kind: "collectible", family: "deceptive" },
      { beat: 5, side: "left", lane: 0, kind: "obstacle", family: "deceptive" },
      { beat: 6, side: "right", lane: 1, kind: "collectible", family: "focus" },
      { beat: 7, side: "left", lane: 1, kind: "collectible", family: "focus" },
      { beat: 8, side: "right", lane: 0, kind: "collectible", family: "deceptive" },
      { beat: 9, side: "left", lane: 0, kind: "collectible", family: "focus" },
      { beat: 10, side: "right", lane: 1, kind: "obstacle", family: "deceptive" },
      { beat: 11, side: "left", lane: 1, kind: "collectible", family: "focus" },
      { beat: 12, side: "right", lane: 0, kind: "collectible", family: "focus" },
    ],
  },
];

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
