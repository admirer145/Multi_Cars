import type { PatternFamily, SkillTag } from "../types";

export const PATTERN_SKILL_LABELS: Record<SkillTag, string> = {
  focus: "Focus",
  coordination: "Coordination",
  "pattern-recognition": "Pattern Recognition",
  reaction: "Reaction",
  endurance: "Endurance",
};

export type PatternFamilyDefinition = {
  id: PatternFamily;
  label: string;
  skillTags: SkillTag[];
  description: string;
};

export const PATTERN_FAMILIES: Record<PatternFamily, PatternFamilyDefinition> = {
  focus: {
    id: "focus",
    label: "Focus",
    skillTags: ["focus"],
    description: "Stable, readable decisions that reward sustained attention.",
  },
  sync: {
    id: "sync",
    label: "Sync",
    skillTags: ["coordination"],
    description: "Both hands respond together in the same lane relationship.",
  },
  mirror: {
    id: "mirror",
    label: "Mirror",
    skillTags: ["coordination", "pattern-recognition"],
    description: "Both hands respond with opposite lane relationships.",
  },
  alternating: {
    id: "alternating",
    label: "Alternating",
    skillTags: ["focus", "reaction"],
    description: "Attention shifts between left and right road groups.",
  },
  delayed: {
    id: "delayed",
    label: "Delayed",
    skillTags: ["coordination", "reaction"],
    description: "One side changes shortly before the other side.",
  },
  deceptive: {
    id: "deceptive",
    label: "Deceptive",
    skillTags: ["pattern-recognition", "reaction"],
    description: "A repeated rhythm changes after the player starts trusting it.",
  },
  pressure: {
    id: "pressure",
    label: "Pressure",
    skillTags: ["reaction", "endurance"],
    description: "Denser decisions test calm execution under speed.",
  },
  recovery: {
    id: "recovery",
    label: "Recovery",
    skillTags: ["focus", "endurance"],
    description: "Simpler decisions give the player a chance to regain control.",
  },
};

export const DEFAULT_PATTERN_FAMILY_ORDER: PatternFamily[] = [
  "focus",
  "sync",
  "mirror",
  "alternating",
  "delayed",
  "deceptive",
  "pressure",
  "recovery",
];
