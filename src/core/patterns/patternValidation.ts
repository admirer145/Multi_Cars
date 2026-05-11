import { LANES, ROAD_SIDES } from "../constants";
import type { ModeConfig, PatternEvent, RoadSide } from "../types";

export type PatternValidationIssue = {
  code:
    | "empty-pattern"
    | "invalid-time"
    | "invalid-side"
    | "invalid-lane"
    | "invalid-required-kind"
    | "missing-skill-tags"
    | "missing-pattern-family"
    | "duplicate-event-id"
    | "side-time-conflict"
    | "unsafe-side-gap";
  message: string;
  eventId?: string;
};

export type PatternValidationOptions = {
  minSameSideGapMs?: number;
};

const DEFAULT_MIN_SAME_SIDE_GAP_MS = 360;

export function validatePattern(
  events: PatternEvent[],
  config: ModeConfig,
  options: PatternValidationOptions = {},
): PatternValidationIssue[] {
  const issues: PatternValidationIssue[] = [];
  const ids = new Set<string>();
  const sideTimeKeys = new Set<string>();
  const sortedBySide: Record<RoadSide, PatternEvent[]> = {
    left: [],
    right: [],
  };
  const minSameSideGapMs = options.minSameSideGapMs ?? DEFAULT_MIN_SAME_SIDE_GAP_MS;

  if (events.length === 0) {
    issues.push({
      code: "empty-pattern",
      message: `Pattern for ${config.id} contains no events.`,
    });
  }

  for (const event of events) {
    if (!Number.isFinite(event.timeMs) || event.timeMs < 0 || event.timeMs > config.durationMs) {
      issues.push({
        code: "invalid-time",
        eventId: event.id,
        message: `Event ${event.id} has invalid time ${event.timeMs}.`,
      });
    }

    if (!ROAD_SIDES.includes(event.side)) {
      issues.push({
        code: "invalid-side",
        eventId: event.id,
        message: `Event ${event.id} has invalid side ${event.side}.`,
      });
    }

    if (!LANES.includes(event.lane)) {
      issues.push({
        code: "invalid-lane",
        eventId: event.id,
        message: `Event ${event.id} has invalid lane ${event.lane}.`,
      });
    }

    if (event.required && event.kind !== "collectible") {
      issues.push({
        code: "invalid-required-kind",
        eventId: event.id,
        message: `Event ${event.id} marks a non-collectible as required.`,
      });
    }

    if (event.skillTags.length === 0) {
      issues.push({
        code: "missing-skill-tags",
        eventId: event.id,
        message: `Event ${event.id} has no skill tags.`,
      });
    }

    if (!event.patternFamily) {
      issues.push({
        code: "missing-pattern-family",
        eventId: event.id,
        message: `Event ${event.id} has no pattern family.`,
      });
    }

    if (ids.has(event.id)) {
      issues.push({
        code: "duplicate-event-id",
        eventId: event.id,
        message: `Event id ${event.id} is duplicated.`,
      });
    }
    ids.add(event.id);

    const sideTimeKey = `${event.side}:${event.timeMs}`;
    if (sideTimeKeys.has(sideTimeKey)) {
      issues.push({
        code: "side-time-conflict",
        eventId: event.id,
        message: `Multiple events appear on ${event.side} at ${event.timeMs}ms.`,
      });
    }
    sideTimeKeys.add(sideTimeKey);
    sortedBySide[event.side].push(event);
  }

  for (const side of ROAD_SIDES) {
    const sideEvents = sortedBySide[side].sort((a, b) => a.timeMs - b.timeMs);
    for (let index = 1; index < sideEvents.length; index += 1) {
      const previous = sideEvents[index - 1];
      const current = sideEvents[index];
      const gap = current.timeMs - previous.timeMs;

      if (gap < minSameSideGapMs) {
        issues.push({
          code: "unsafe-side-gap",
          eventId: current.id,
          message: `Events on ${side} are only ${gap}ms apart.`,
        });
      }
    }
  }

  return issues;
}

export function assertValidPattern(events: PatternEvent[], config: ModeConfig): void {
  const issues = validatePattern(events, config);

  if (issues.length > 0) {
    const summary = issues.map((issue) => `${issue.code}: ${issue.message}`).join("\n");
    throw new Error(`Invalid pattern generated for ${config.id}.\n${summary}`);
  }
}
