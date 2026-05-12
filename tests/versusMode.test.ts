import { describe, expect, it } from "vitest";
import {
  addVersusPlayer,
  calculateVersusOutcome,
  createVersusMatchConfig,
  createVersusPlayer,
  formatVersusShareText,
  normalizeVersusSettings,
  type VersusRunResult,
} from "../src/core/multiplayer/versusMode";

describe("versus mode", () => {
  it("normalizes leader settings for an offline match", () => {
    const settings = normalizeVersusSettings({
      carCount: 9,
      speedLevelMin: 12,
      speedLevelMax: 4,
      endless: false,
      durationMs: 8_000,
    });

    expect(settings.carCount).toBe(2);
    expect(settings.speedLevelMin).toBe(4);
    expect(settings.speedLevelMax).toBe(12);
    expect(settings.endless).toBe(false);
    expect(settings.durationMs).toBe(15_000);
  });

  it("keeps players as an expandable list for future group challenges", () => {
    const match = createVersusMatchConfig("Asha", {}, 1_700_000_000_000);
    const joined = addVersusPlayer(match, createVersusPlayer("Nikhil", "friend"));

    expect(joined.players.map((player) => player.name)).toEqual(["Asha", "Nikhil"]);
    expect(joined.seed).toBe(match.seed);
  });

  it("waits until every player has a result", () => {
    const leader = createVersusPlayer("Asha", "leader");
    const friend = createVersusPlayer("Nikhil", "friend");
    const outcome = calculateVersusOutcome([leader, friend], [createResult(leader, 12, 30_000)]);

    expect(outcome).toEqual({
      status: "pending",
      completedCount: 1,
      totalCount: 2,
    });
  });

  it("picks the highest score as winner", () => {
    const leader = createVersusPlayer("Asha", "leader");
    const friend = createVersusPlayer("Nikhil", "friend");
    const outcome = calculateVersusOutcome(
      [leader, friend],
      [createResult(leader, 12, 30_000), createResult(friend, 16, 28_000)],
    );

    expect(outcome).toMatchObject({
      status: "winner",
      winner: friend,
      runnerUp: leader,
      margin: 4,
      score: 16,
    });
  });

  it("uses survival time as a tie breaker", () => {
    const leader = createVersusPlayer("Asha", "leader");
    const friend = createVersusPlayer("Nikhil", "friend");
    const outcome = calculateVersusOutcome(
      [leader, friend],
      [createResult(leader, 12, 30_000), createResult(friend, 12, 41_000)],
    );

    expect(outcome).toMatchObject({
      status: "winner",
      winner: friend,
      margin: 0,
      score: 12,
    });
  });

  it("formats a local share result", () => {
    const match = addVersusPlayer(
      createVersusMatchConfig("Asha", { speedLevelMin: 5, speedLevelMax: 20 }, 1_700_000_000_000),
      createVersusPlayer("Nikhil", "friend"),
    );
    const text = formatVersusShareText(match, [
      createResult(match.players[0], 18, 30_000),
      createResult(match.players[1], 14, 28_000),
    ]);

    expect(text).toContain("Multi Cars Friends Battle");
    expect(text).toContain("Winner: Asha by 4");
    expect(text).toContain("Speed 5-20");
  });
});

function createResult(player: ReturnType<typeof createVersusPlayer>, score: number, timeMs: number): VersusRunResult {
  return {
    matchId: "match",
    player,
    score,
    speedLevel: 7,
    timeMs,
    result: "failed",
    completedPercent: 0,
  };
}
