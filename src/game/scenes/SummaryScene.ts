import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../../app/gameConfig";
import { COLLECTION_Y } from "../../core/constants";
import type { ActiveObjectState, RoadSide, RunSummary, SimulationState } from "../../core/types";

const TEXT_COLOR = "#f8fafc";
const MUTED_TEXT_COLOR = "#cbd5e1";
const PANEL_COLOR = 0x171d27;
const PRIMARY_COLOR = 0x3dd6c6;
const SECONDARY_TEXT_COLOR = "#ffd166";
const LANE_X: Record<RoadSide, [number, number]> = {
  left: [146, 282],
  right: [438, 574],
};

export type SummarySceneData = {
  summary: RunSummary;
  nextRunIndex: number;
  mode: "classic" | "challenge";
  trackId?: string;
  finalState?: SimulationState;
};

export class SummaryScene extends Phaser.Scene {
  private dataForScene!: SummarySceneData;

  constructor() {
    super("SummaryScene");
  }

  create(data: SummarySceneData): void {
    this.dataForScene = data;
    this.draw();
    this.bindInput();
    this.setDomStatus();
  }

  private draw(): void {
    const summary = this.dataForScene.summary;
    const title = summary.result === "completed" ? "Track Complete" : "Game Over";
    const reason = formatFailureReason(summary.failureReason);
    const family = summary.failedPatternFamily ? `Pattern ${summary.failedPatternFamily}` : "Pattern focus";

    const graphics = this.add.graphics();
    this.drawFinalBackdrop(graphics);
    graphics.fillStyle(0x05080d, 0.66);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(PANEL_COLOR, 0.96);
    graphics.fillRoundedRect(70, 184, GAME_WIDTH - 140, 724, 8);
    graphics.lineStyle(3, 0xffffff, 0.13);
    graphics.strokeRoundedRect(70, 184, GAME_WIDTH - 140, 724, 8);
    graphics.lineStyle(4, summary.result === "completed" ? PRIMARY_COLOR : 0xfb7185, 0.9);
    graphics.lineBetween(112, 184, GAME_WIDTH - 112, 184);

    this.add
      .text(GAME_WIDTH / 2, 274, title, {
        align: "center",
        color: TEXT_COLOR,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "58px",
        fontStyle: "900",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 364, `${reason}\n${family}`, {
        align: "center",
        color: MUTED_TEXT_COLOR,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "27px",
        lineSpacing: 10,
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        518,
        formatStats(summary),
        {
          align: "center",
          color: SECONDARY_TEXT_COLOR,
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: "34px",
          fontStyle: "800",
          lineSpacing: 16,
        },
      )
      .setOrigin(0.5);

    this.createButton(GAME_WIDTH / 2, 734, "Play Again", PRIMARY_COLOR, () => this.playAgain());
    this.createButton(GAME_WIDTH / 2, 834, "Menu", 0x334155, () => this.goToMenu());

  }

  private drawFinalBackdrop(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x0b1017, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(0x202938, 1);
    graphics.fillRoundedRect(74, -24, 280, GAME_HEIGHT + 48, 18);
    graphics.fillRoundedRect(366, -24, 280, GAME_HEIGHT + 48, 18);
    graphics.lineStyle(4, 0x94a3b8, 0.55);
    graphics.lineBetween(214, 0, 214, GAME_HEIGHT);
    graphics.lineBetween(506, 0, 506, GAME_HEIGHT);
    graphics.lineStyle(5, 0xf8fafc, 0.26);
    graphics.lineBetween(82, COLLECTION_Y, 638, COLLECTION_Y);

    const state = this.dataForScene.finalState;
    if (!state) {
      return;
    }

    this.drawSummaryCar(graphics, LANE_X.left[state.cars.left.lane], COLLECTION_Y, 0x3dd6c6);
    this.drawSummaryCar(graphics, LANE_X.right[state.cars.right.lane], COLLECTION_Y, 0xffd166);
    state.objects.slice(-8).forEach((object) => this.drawSummaryObject(graphics, object));
  }

  private drawSummaryCar(graphics: Phaser.GameObjects.Graphics, x: number, y: number, color: number): void {
    graphics.fillStyle(0x000000, 0.25);
    graphics.fillEllipse(x, y + 54, 74, 20);
    graphics.fillStyle(color, 0.92);
    graphics.fillRoundedRect(x - 34, y - 52, 68, 104, 12);
    graphics.fillStyle(0xffffff, 0.16);
    graphics.fillRoundedRect(x - 22, y - 44, 44, 74, 10);
  }

  private drawSummaryObject(graphics: Phaser.GameObjects.Graphics, object: ActiveObjectState): void {
    if (object.collected) {
      return;
    }

    const x = LANE_X[object.side][object.lane];
    if (object.kind === "collectible") {
      graphics.fillStyle(0x6ee7b7, 0.82);
      graphics.fillCircle(x, object.y, 28);
      graphics.lineStyle(5, 0xffffff, 0.26);
      graphics.strokeCircle(x, object.y, 28);
    } else {
      graphics.fillStyle(0xfb7185, 0.9);
      graphics.fillRoundedRect(x - 32, object.y - 32, 64, 64, 8);
    }
  }

  private createButton(
    x: number,
    y: number,
    label: string,
    color: number,
    onClick: () => void,
  ): void {
    const button = this.add.rectangle(x, y, 420, 92, color, 1).setInteractive({ useHandCursor: true });
    button.on("pointerdown", onClick);

    this.add
      .text(x, y, label, {
        align: "center",
        color: color === PRIMARY_COLOR ? "#101318" : TEXT_COLOR,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "32px",
        fontStyle: "900",
      })
      .setOrigin(0.5);
  }

  private bindInput(): void {
    this.input.keyboard?.once("keydown-ENTER", () => this.playAgain());
    this.input.keyboard?.once("keydown-SPACE", () => this.playAgain());
    this.input.keyboard?.once("keydown-M", () => this.goToMenu());
  }

  private playAgain(): void {
    this.scene.start("GameplayScene", {
      mode: this.dataForScene.mode,
      runIndex: this.dataForScene.nextRunIndex,
      trackId: this.dataForScene.trackId,
    });
  }

  private goToMenu(): void {
    this.scene.start("MenuScene");
  }

  private setDomStatus(): void {
    const summary = this.dataForScene.summary;
    document.body.dataset.screen = "summary";
    document.body.dataset.mode = summary.modeId;
    document.body.dataset.gameStatus = "summary";
    document.body.dataset.gameScore = String(summary.score);
    document.body.dataset.speedLevel = String(summary.speedLevel);
    document.body.dataset.failureReason = summary.failureReason ?? "";
    document.body.dataset.patternFamily = summary.failedPatternFamily ?? "";
  }
}

function formatStats(summary: RunSummary): string {
  if (summary.modeId === "challenge") {
    return `Progress ${summary.completedPercent}%\nBest ${summary.bestScore}%\nStars ${summary.stars ?? 0}`;
  }

  return `Score ${summary.score}\nBest ${summary.bestScore}\nSpeed ${summary.speedLevel}`;
}

function formatFailureReason(reason: string | undefined): string {
  if (reason === "hit-obstacle") {
    return "Obstacle hit";
  }

  if (reason === "missed-collectible") {
    return "Collectible missed";
  }

  return "Clean finish";
}
