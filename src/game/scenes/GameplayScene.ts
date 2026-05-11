import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../../app/gameConfig";
import { emitMenuRequested, emitRunEnded } from "../../app/gameBridge";
import { COLLECTION_Y } from "../../core/constants";
import {
  createClassicRun,
  createClassicRunSummary,
  getClassicSpeedLevel,
  type ClassicRun,
} from "../../core/modes/classicMode";
import {
  calculateChallengeStars,
  createChallengeRun,
  createChallengeRunSummary,
  createInitialChallengeProgress,
  type ChallengeProgress,
  type ChallengeRun,
  updateChallengeProgress,
} from "../../core/modes/challengeMode";
import { GameSimulation } from "../../core/rules/simulation";
import type { ActiveObjectState, ModeConfig, PatternEvent, RoadSide, SimulationState } from "../../core/types";
import {
  loadChallengeProgress,
  loadClassicHighScore,
  saveChallengeProgress,
  saveClassicHighScore,
} from "../../persistence/storage";

const ROAD_COLOR = 0x242a34;
const LANE_COLOR = 0x384151;
const LEFT_CAR_COLOR = 0x3dd6c6;
const RIGHT_CAR_COLOR = 0xffd166;
const COLLECTIBLE_COLOR = 0x6ee7b7;
const OBSTACLE_COLOR = 0xfb7185;
const TEXT_COLOR = "#f8fafc";
const ROAD_TOP = 122;
const ROAD_THEME_COLORS = {
  city: { road: 0x202938, lane: 0x475569, edge: 0x8bd3ff },
  neon: { road: 0x161b2c, lane: 0x3dd6c6, edge: 0xffd166 },
  storm: { road: 0x1f2633, lane: 0x94a3b8, edge: 0xfb7185 },
  canyon: { road: 0x2a211b, lane: 0xffd166, edge: 0xf97316 },
};

const LANE_X: Record<RoadSide, [number, number]> = {
  left: [154, 270],
  right: [450, 566],
};

type GameplaySceneData = {
  mode?: "classic" | "challenge";
  runIndex?: number;
  trackId?: string;
};

export class GameplayScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private centerText!: Phaser.GameObjects.Text;
  private helpText!: Phaser.GameObjects.Text;
  private simulation!: GameSimulation;
  private modeConfig!: ModeConfig;
  private activeMode: "classic" | "challenge" = "classic";
  private pattern: PatternEvent[] = [];
  private classicRun?: ClassicRun;
  private challengeRun?: ChallengeRun;
  private challengeProgress?: ChallengeProgress;
  private runIndex = 0;
  private highScore = 0;
  private lastStatus: SimulationState["status"] = "ready";
  private hasDispatchedEnd = false;
  private visualCarPose: Record<RoadSide, { frontX: number; rearX: number }> = {
    left: { frontX: LANE_X.left[0], rearX: LANE_X.left[0] },
    right: { frontX: LANE_X.right[1], rearX: LANE_X.right[1] },
  };

  constructor() {
    super("GameplayScene");
  }

  create(data: GameplaySceneData = {}): void {
    this.startRun({ ...window.__MULTI_CARS_BOOT__, ...data });
    this.highScore = loadClassicHighScore();

    this.graphics = this.add.graphics();
    this.hudText = this.add
      .text(GAME_WIDTH / 2, 46, "", {
        align: "center",
        color: TEXT_COLOR,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "23px",
        fontStyle: "900",
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.centerText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 36, "", {
        align: "center",
        color: TEXT_COLOR,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "42px",
        fontStyle: "800",
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.helpText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 86, "", {
        align: "center",
        color: "#cbd5e1",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "24px",
        lineSpacing: 8,
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.bindInput();
    this.setDomStatus(this.simulation.getState());
  }

  update(_time: number, delta: number): void {
    const cappedDelta = Math.min(delta, 34);
    const state = this.simulation.step(cappedDelta);

    if (
      this.activeMode === "classic" &&
      (state.status === "failed" || state.status === "completed") &&
      this.lastStatus !== state.status
    ) {
      saveClassicHighScore(state.score);
      this.highScore = loadClassicHighScore();
    }

    this.renderState(state);
    if (this.hasDispatchedEnd) {
      return;
    }

    this.setDomStatus(state);
    this.lastStatus = state.status;
  }

  private bindInput(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.hasDispatchedEnd) {
        return;
      }

      const state = this.simulation.getState();
      if (state.status === "failed" || state.status === "completed") {
        return;
      }

      const worldX = pointer.x;
      this.simulation.applyInput({
        type: worldX < GAME_WIDTH / 2 ? "TOGGLE_LEFT" : "TOGGLE_RIGHT",
        atMs: state.timeMs,
      });
    });

    this.input.keyboard?.on("keydown-A", () => this.toggleLeft());
    this.input.keyboard?.on("keydown-LEFT", () => this.toggleLeft());
    this.input.keyboard?.on("keydown-L", () => this.toggleRight());
    this.input.keyboard?.on("keydown-RIGHT", () => this.toggleRight());
    this.input.keyboard?.on("keydown-R", () => {
      if (!this.hasDispatchedEnd) {
        this.restart();
      }
    });
    this.input.keyboard?.on("keydown-P", () => this.togglePause());
    this.input.keyboard?.on("keydown-ESC", () => this.togglePause());
    this.input.keyboard?.on("keydown-M", () => this.goToMenu());
  }

  private toggleLeft(): void {
    const state = this.simulation.getState();
    this.simulation.applyInput({ type: "TOGGLE_LEFT", atMs: state.timeMs });
  }

  private toggleRight(): void {
    const state = this.simulation.getState();
    this.simulation.applyInput({ type: "TOGGLE_RIGHT", atMs: state.timeMs });
  }

  private togglePause(): void {
    const state = this.simulation.getState();
    if (state.status === "running") {
      this.simulation.applyInput({ type: "PAUSE", atMs: state.timeMs });
    } else if (state.status === "paused") {
      this.simulation.applyInput({ type: "RESUME", atMs: state.timeMs });
    }
  }

  private restart(): void {
    this.startRun(
      this.activeMode === "challenge"
        ? { mode: "challenge", trackId: this.challengeRun?.track.id }
        : { mode: "classic", runIndex: this.runIndex + 1 },
    );
    this.simulation.applyInput({ type: "RESTART", atMs: 0 });
  }

  private goToMenu(): void {
    emitMenuRequested();
  }

  private startRun(data: GameplaySceneData): void {
    this.activeMode = data.mode ?? "classic";
    this.runIndex = data.runIndex ?? 0;

    if (this.activeMode === "challenge") {
      this.challengeRun = createChallengeRun(data.trackId);
      this.challengeProgress = loadChallengeProgress(
        this.challengeRun.track.id,
        createInitialChallengeProgress(this.challengeRun.track.id),
      );
      this.modeConfig = this.challengeRun.config;
      this.pattern = this.challengeRun.pattern;
    } else {
      this.classicRun = createClassicRun(this.runIndex);
      this.modeConfig = this.classicRun.config;
      this.pattern = this.classicRun.pattern;
    }

    this.simulation = new GameSimulation(this.modeConfig, this.pattern);
    const initialState = this.simulation.getState();
    this.visualCarPose = {
      left: {
        frontX: LANE_X.left[initialState.cars.left.lane],
        rearX: LANE_X.left[initialState.cars.left.lane],
      },
      right: {
        frontX: LANE_X.right[initialState.cars.right.lane],
        rearX: LANE_X.right[initialState.cars.right.lane],
      },
    };
    this.lastStatus = "ready";
    this.hasDispatchedEnd = false;
  }

  private renderState(state: SimulationState): void {
    this.graphics.clear();
    this.drawRoads(state);
    this.drawObjects(state.objects);
    this.drawCars(state);
    this.drawHudPanel(state);
    this.updateHud(state);
    this.updateOverlay(state);
  }

  private drawRoads(state: SimulationState): void {
    const theme = this.challengeRun?.track.roadTheme ?? "city";
    const colors = ROAD_THEME_COLORS[theme];
    this.graphics.fillStyle(0x0b1017, 1);
    this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.graphics.fillStyle(0x070b12, 1);
    this.graphics.fillRect(0, 0, GAME_WIDTH, ROAD_TOP);

    this.graphics.fillStyle(0x101827, 1);
    this.graphics.fillRoundedRect(46, ROAD_TOP - 28, 628, GAME_HEIGHT - ROAD_TOP + 56, 22);
    this.graphics.lineStyle(5, colors.edge, 0.55);
    this.graphics.strokeRoundedRect(46, ROAD_TOP - 28, 628, GAME_HEIGHT - ROAD_TOP + 56, 22);

    this.graphics.fillStyle(colors.road, 1);
    this.graphics.fillRoundedRect(92, ROAD_TOP - 22, 244, GAME_HEIGHT - ROAD_TOP + 44, 18);
    this.graphics.fillRoundedRect(384, ROAD_TOP - 22, 244, GAME_HEIGHT - ROAD_TOP + 44, 18);

    this.graphics.fillStyle(0xffffff, 0.045);
    this.graphics.fillRoundedRect(118, ROAD_TOP - 8, 88, GAME_HEIGHT - ROAD_TOP + 16, 12);
    this.graphics.fillRoundedRect(238, ROAD_TOP - 8, 72, GAME_HEIGHT - ROAD_TOP + 16, 12);
    this.graphics.fillRoundedRect(410, ROAD_TOP - 8, 88, GAME_HEIGHT - ROAD_TOP + 16, 12);
    this.graphics.fillRoundedRect(530, ROAD_TOP - 8, 72, GAME_HEIGHT - ROAD_TOP + 16, 12);

    this.graphics.lineStyle(4, colors.lane, 0.76);
    const dashOffset = (state.timeMs / 9) % 112;
    for (let y = ROAD_TOP - 112 + dashOffset; y < GAME_HEIGHT + 120; y += 112) {
      this.graphics.lineBetween(214, y, 214, y + 54);
      this.graphics.lineBetween(506, y, 506, y + 54);
    }

    this.graphics.lineStyle(2, colors.edge, 0.24);
    const streakOffset = (state.timeMs / 5) % 150;
    for (let y = ROAD_TOP - 150 + streakOffset; y < GAME_HEIGHT + 160; y += 150) {
      this.graphics.lineBetween(70, y, 70, y + 70);
      this.graphics.lineBetween(650, y + 38, 650, y + 108);
    }

    this.graphics.lineStyle(3, 0xffffff, 0.16);
    this.graphics.lineBetween(360, ROAD_TOP, 360, GAME_HEIGHT);
  }

  private drawCars(state: SimulationState): void {
    this.drawMovingCar("left", state, LEFT_CAR_COLOR);
    this.drawMovingCar("right", state, RIGHT_CAR_COLOR);
  }

  private drawMovingCar(side: RoadSide, state: SimulationState, color: number): void {
    const targetX = LANE_X[side][state.cars[side].lane];
    const pose = this.visualCarPose[side];
    const nextFrontX = pose.frontX + (targetX - pose.frontX) * 0.38;
    const nextRearX = pose.rearX + (targetX - pose.rearX) * 0.18;
    pose.frontX = Math.abs(nextFrontX - targetX) < 0.45 ? targetX : nextFrontX;
    pose.rearX = Math.abs(nextRearX - targetX) < 0.45 ? targetX : nextRearX;

    const steering = Phaser.Math.Clamp((pose.frontX - pose.rearX) / 62, -0.55, 0.55);
    const bob = Math.sin((state.timeMs + (side === "left" ? 0 : 180)) / 82) * 2.4;

    this.drawCar(pose.frontX, pose.rearX, COLLECTION_Y + bob, color, steering);
  }

  private drawCar(frontX: number, rearX: number, y: number, color: number, steering: number): void {
    const noseY = y - 68;
    const hoodY = y - 42;
    const waistY = y - 8;
    const rearY = y + 58;
    const spoilerY = y + 72;
    const centerX = (frontX + rearX) / 2;
    const wheelAngle = steering * 9;
    const hoodX = this.getCarSectionX(frontX, rearX, hoodY, y);
    const waistX = this.getCarSectionX(frontX, rearX, waistY, y);

    this.graphics.fillStyle(0x000000, 0.25);
    this.graphics.fillEllipse(centerX, y + 28, 96, 146);

    this.graphics.lineStyle(3, color, 0.22);
    this.graphics.lineBetween(rearX - 30, spoilerY - 3, rearX - 42 - steering * 26, spoilerY + 24);
    this.graphics.lineBetween(rearX + 30, spoilerY - 3, rearX + 42 - steering * 26, spoilerY + 24);

    this.graphics.fillStyle(0x08111e, 0.86);
    this.graphics.fillRoundedRect(rearX - 47, spoilerY - 12, 94, 18, 6);
    this.graphics.fillStyle(color, 1);
    this.graphics.fillRoundedRect(rearX - 40, spoilerY - 16, 80, 14, 5);

    this.graphics.fillStyle(0x050b14, 0.72);
    this.drawClosedShape([
      { x: frontX, y: noseY - 3 },
      { x: frontX + 32, y: hoodY - 4 },
      { x: waistX + 43, y: waistY },
      { x: rearX + 46, y: rearY },
      { x: rearX - 46, y: rearY },
      { x: waistX - 43, y: waistY },
      { x: frontX - 32, y: hoodY - 4 },
    ]);

    this.graphics.fillStyle(color, 1);
    this.drawClosedShape([
      { x: frontX, y: noseY },
      { x: frontX + 29, y: hoodY },
      { x: waistX + 36, y: waistY },
      { x: rearX + 40, y: rearY },
      { x: rearX - 40, y: rearY },
      { x: waistX - 36, y: waistY },
      { x: frontX - 29, y: hoodY },
    ]);

    this.graphics.fillStyle(0xffffff, 0.16);
    this.drawClosedShape([
      { x: hoodX - 31, y: hoodY + 3 },
      { x: hoodX - 21, y: hoodY + 10 },
      { x: waistX - 33, y: waistY + 6 },
      { x: waistX - 39, y: waistY + 1 },
    ]);
    this.drawClosedShape([
      { x: hoodX + 31, y: hoodY + 3 },
      { x: hoodX + 21, y: hoodY + 10 },
      { x: waistX + 33, y: waistY + 6 },
      { x: waistX + 39, y: waistY + 1 },
    ]);

    this.graphics.fillStyle(0xffffff, 0.2);
    this.drawClosedShape([
      { x: frontX, y: noseY + 10 },
      { x: hoodX + 11, y: hoodY + 7 },
      { x: waistX + 9, y: waistY - 3 },
      { x: centerX + 6, y: y + 35 },
      { x: centerX - 6, y: y + 35 },
      { x: waistX - 9, y: waistY - 3 },
      { x: hoodX - 11, y: hoodY + 7 },
    ]);

    this.graphics.fillStyle(0x0b1017, 0.72);
    this.drawClosedShape([
      { x: waistX - 25, y: waistY - 6 },
      { x: waistX + 25, y: waistY - 6 },
      { x: rearX + 24, y: y + 34 },
      { x: rearX - 24, y: y + 34 },
    ]);

    this.graphics.fillStyle(0x8bd3ff, 0.26);
    this.drawClosedShape([
      { x: waistX - 17, y: waistY + 1 },
      { x: waistX + 17, y: waistY + 1 },
      { x: rearX + 16, y: y + 24 },
      { x: rearX - 16, y: y + 24 },
    ]);

    this.graphics.fillStyle(0x08111e, 0.38);
    this.drawClosedShape([
      { x: waistX - 38, y: waistY + 8 },
      { x: waistX - 26, y: waistY + 20 },
      { x: rearX - 32, y: rearY - 9 },
      { x: rearX - 43, y: rearY - 2 },
    ]);
    this.drawClosedShape([
      { x: waistX + 38, y: waistY + 8 },
      { x: waistX + 26, y: waistY + 20 },
      { x: rearX + 32, y: rearY - 9 },
      { x: rearX + 43, y: rearY - 2 },
    ]);

    this.graphics.fillStyle(0xffffff, 0.85);
    this.graphics.fillTriangle(frontX - 17, noseY + 15, frontX - 6, noseY + 21, frontX - 24, noseY + 27);
    this.graphics.fillTriangle(frontX + 17, noseY + 15, frontX + 6, noseY + 21, frontX + 24, noseY + 27);

    this.drawWheel(hoodX - 39 + steering * 8, y - 34, wheelAngle);
    this.drawWheel(hoodX + 29 + steering * 8, y - 34, wheelAngle);
    this.drawWheel(rearX - 45, y + 18, wheelAngle * 0.4);
    this.drawWheel(rearX + 35, y + 18, wheelAngle * 0.4);

    this.graphics.fillStyle(0xfb7185, 0.72);
    this.graphics.fillRoundedRect(rearX - 28, rearY - 9, 13, 7, 3);
    this.graphics.fillRoundedRect(rearX + 15, rearY - 9, 13, 7, 3);

    this.graphics.lineStyle(2, 0xffffff, 0.22);
    this.graphics.lineBetween(frontX - 19, noseY + 31, waistX - 27, waistY - 1);
    this.graphics.lineBetween(frontX + 19, noseY + 31, waistX + 27, waistY - 1);
    this.graphics.lineBetween(waistX - 27, waistY + 8, rearX - 30, rearY - 13);
    this.graphics.lineBetween(waistX + 27, waistY + 8, rearX + 30, rearY - 13);
    this.graphics.lineStyle(2, 0x050b14, 0.3);
    this.graphics.lineBetween(rearX - 26, rearY - 8, rearX + 26, rearY - 8);
  }

  private drawClosedShape(points: Array<{ x: number; y: number }>): void {
    this.graphics.beginPath();
    this.graphics.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => this.graphics.lineTo(point.x, point.y));
    this.graphics.closePath();
    this.graphics.fillPath();
  }

  private getCarSectionX(frontX: number, rearX: number, sectionY: number, carCenterY: number): number {
    const progress = Phaser.Math.Clamp((sectionY - (carCenterY - 68)) / 126, 0, 1);
    return Phaser.Math.Linear(frontX, rearX, progress);
  }

  private drawWheel(x: number, y: number, angleDegrees: number): void {
    const angle = Phaser.Math.DegToRad(angleDegrees);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const halfWidth = 6;
    const halfHeight = 15;
    const points = [
      { x: -halfWidth, y: -halfHeight },
      { x: halfWidth, y: -halfHeight },
      { x: halfWidth, y: halfHeight },
      { x: -halfWidth, y: halfHeight },
    ].map((point) => ({
      x: x + point.x * cos - point.y * sin,
      y: y + point.x * sin + point.y * cos,
    }));

    this.graphics.fillStyle(0x05070d, 0.92);
    this.drawClosedShape(points);

    const shinePoints = [
      { x: -halfWidth + 2, y: -halfHeight + 3 },
      { x: -halfWidth + 5, y: -halfHeight + 3 },
      { x: -halfWidth + 5, y: halfHeight - 3 },
      { x: -halfWidth + 2, y: halfHeight - 3 },
    ].map((point) => ({
      x: x + point.x * cos - point.y * sin,
      y: y + point.x * sin + point.y * cos,
    }));

    this.graphics.fillStyle(0xffffff, 0.12);
    this.drawClosedShape(shinePoints);
  }

  private drawObjects(objects: ActiveObjectState[]): void {
    for (const object of objects) {
      if (object.collected) {
        continue;
      }

      if (object.y < ROAD_TOP - 44) {
        continue;
      }

      const x = LANE_X[object.side][object.lane];
      if (object.kind === "collectible") {
        this.graphics.fillStyle(0x000000, 0.22);
        this.graphics.fillEllipse(x, object.y + 30, 64, 16);
        this.graphics.fillStyle(COLLECTIBLE_COLOR, 1);
        this.graphics.fillCircle(x, object.y, 28);
        this.graphics.fillStyle(0xffffff, 0.8);
        this.graphics.fillCircle(x - 8, object.y - 8, 8);
        this.graphics.lineStyle(6, 0xffffff, 0.28);
        this.graphics.strokeCircle(x, object.y, 28);
      } else {
        this.graphics.fillStyle(0x000000, 0.25);
        this.graphics.fillEllipse(x, object.y + 34, 70, 18);
        this.graphics.fillStyle(OBSTACLE_COLOR, 1);
        this.graphics.fillRoundedRect(x - 32, object.y - 32, 64, 64, 8);
        this.graphics.lineStyle(5, 0xffffff, 0.22);
        this.graphics.lineBetween(x - 18, object.y - 18, x + 18, object.y + 18);
        this.graphics.lineBetween(x + 18, object.y - 18, x - 18, object.y + 18);
      }
    }
  }

  private updateHud(state: SimulationState): void {
    this.hudText.setText(
      this.activeMode === "challenge"
        ? `Progress ${Math.round(state.completedPercent)}%   Stars ${calculateChallengeStars(state.completedPercent)}/3`
        : `Score ${state.score}   Best ${this.highScore}   Speed ${getClassicSpeedLevel(state.timeMs)}`,
    );
  }

  private drawHudPanel(state: SimulationState): void {
    const colors = ROAD_THEME_COLORS[this.challengeRun?.track.roadTheme ?? "city"];
    this.graphics.fillStyle(0x0b1017, 0.92);
    this.graphics.fillRoundedRect(88, 18, 544, 58, 18);
    this.graphics.lineStyle(2, colors.edge, 0.5);
    this.graphics.strokeRoundedRect(88, 18, 544, 58, 18);
    this.graphics.fillStyle(colors.edge, 0.12);
    const progress =
      this.activeMode === "challenge"
        ? state.completedPercent / 100
        : Math.min(1, state.timeMs / 120_000);
    this.graphics.fillRoundedRect(104, 64, 512 * progress, 4, 3);
  }

  private updateOverlay(state: SimulationState): void {
    if (state.status === "paused") {
      this.centerText.setText("Paused");
      this.helpText.setText("");
      return;
    }

    if (state.status === "failed") {
      this.goToSummary(state);
      return;
    }

    if (state.status === "completed") {
      this.goToSummary(state);
      return;
    }

    if (this.lastStatus === "failed" || this.lastStatus === "completed") {
      this.centerText.setText("");
      this.helpText.setText("");
    }

    this.centerText.setText("");
    this.helpText.setText("");
  }

  private setDomStatus(state: SimulationState): void {
    document.body.dataset.screen = "gameplay";
    document.body.dataset.mode = this.activeMode;
    document.body.dataset.gameStatus = state.status;
    document.body.dataset.gameScore = String(state.score);
    document.body.dataset.gameSeed = this.modeConfig.seed;
    document.body.dataset.speedLevel = String(getClassicSpeedLevel(state.timeMs));
    document.body.dataset.failureReason = state.failure?.reason ?? "";
    document.body.dataset.patternFamily = state.failure?.patternFamily ?? "";
    document.body.dataset.leftLane = String(state.cars.left.lane);
    document.body.dataset.rightLane = String(state.cars.right.lane);
  }

  private goToSummary(state: SimulationState): void {
    if (this.hasDispatchedEnd) {
      return;
    }

    this.hasDispatchedEnd = true;

    if (this.activeMode === "challenge" && this.challengeRun && this.challengeProgress) {
      const updatedProgress = updateChallengeProgress(this.challengeProgress, state.completedPercent);
      saveChallengeProgress(updatedProgress);
      emitRunEnded({
        summary: createChallengeRunSummary(state, this.modeConfig, updatedProgress),
        nextRunIndex: this.runIndex,
        mode: "challenge",
        trackId: this.challengeRun.track.id,
        finalState: state,
      });
      return;
    }

    emitRunEnded({
      summary: createClassicRunSummary(state, this.modeConfig, this.highScore),
      nextRunIndex: this.runIndex + 1,
      mode: "classic",
      finalState: state,
    });
  }
}
