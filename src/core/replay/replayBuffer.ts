import type { SimulationState } from "../types";

export const REPLAY_WINDOW_MS = 5_000;
export const REPLAY_SAMPLE_INTERVAL_MS = 34;

export type ReplayFrame = {
  atMs: number;
  state: SimulationState;
};

export type ReplayClip = {
  durationMs: number;
  capturedAtMs: number;
  frames: ReplayFrame[];
};

export class ReplayBuffer {
  private readonly windowMs: number;
  private readonly sampleIntervalMs: number;
  private frames: ReplayFrame[] = [];
  private lastSampleAtMs = Number.NEGATIVE_INFINITY;

  constructor(windowMs = REPLAY_WINDOW_MS, sampleIntervalMs = REPLAY_SAMPLE_INTERVAL_MS) {
    this.windowMs = windowMs;
    this.sampleIntervalMs = sampleIntervalMs;
  }

  reset(): void {
    this.frames = [];
    this.lastSampleAtMs = Number.NEGATIVE_INFINITY;
  }

  record(state: SimulationState): void {
    if (state.timeMs - this.lastSampleAtMs < this.sampleIntervalMs && state.status === "running") {
      return;
    }

    this.pushFrame(state);
  }

  createClip(finalState: SimulationState): ReplayClip {
    if (this.frames.at(-1)?.atMs === finalState.timeMs) {
      this.frames[this.frames.length - 1] = {
        atMs: finalState.timeMs,
        state: structuredClone(finalState),
      };
    } else {
      this.pushFrame(finalState);
    }

    const startAtMs = Math.max(0, finalState.timeMs - this.windowMs);
    const frames = this.frames.filter((frame) => frame.atMs >= startAtMs);

    return {
      durationMs: finalState.timeMs - (frames[0]?.atMs ?? finalState.timeMs),
      capturedAtMs: finalState.timeMs,
      frames: structuredClone(frames),
    };
  }

  private pushFrame(state: SimulationState): void {
    this.frames.push({
      atMs: state.timeMs,
      state: structuredClone(state),
    });
    this.lastSampleAtMs = state.timeMs;
    this.trim(state.timeMs);
  }

  private trim(currentTimeMs: number): void {
    const earliestTimeMs = currentTimeMs - this.windowMs;
    this.frames = this.frames.filter((frame) => frame.atMs >= earliestTimeMs);
  }
}
