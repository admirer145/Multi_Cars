import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../../app/gameConfig";
import { emitMenuRequested, emitRunEnded } from "../../app/gameBridge";
import {
  COLLECTION_Y,
  getActiveRoadSides,
  normalizeClassicCarCount,
  type SupportedClassicCarCount,
} from "../../core/constants";
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
import {
  createPracticeRun,
  createPracticeRunSummary,
  type PracticeRun,
} from "../../core/modes/practiceMode";
import {
  calculateDailyStars,
  createDailyRun,
  createDailyRunSummary,
  createInitialDailyProgress,
  type DailyProgress,
  type DailyRun,
  updateDailyProgress,
} from "../../core/modes/dailyMode";
import { ReplayBuffer } from "../../core/replay/replayBuffer";
import { GameSimulation } from "../../core/rules/simulation";
import type { ActiveObjectState, ModeConfig, PatternEvent, RoadSide, SimulationState } from "../../core/types";
import {
  loadChallengeProgress,
  loadClassicHighScore,
  loadClassicHighScoreForCarCount,
  loadClassicSpeedSettings,
  loadDailyProgress,
  loadGameplayModifierSettings,
  loadSelectedCarSkin,
  saveChallengeProgress,
  saveClassicHighScore,
  saveClassicHighScoreForCarCount,
  saveDailyProgress,
} from "../../persistence/storage";
import { getCarSkin } from "../../core/engagement/achievements";

const ROAD_COLOR = 0x242a34;
const LANE_COLOR = 0x384151;
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

const TWO_CAR_LANE_X: Record<RoadSide, [number, number]> = {
  left: [154, 270],
  right: [450, 566],
};
const ONE_CAR_LANE_X: Record<RoadSide, [number, number]> = {
  left: [302, 418],
  right: [450, 566],
};
const EXTRA_TOUCH_POINTERS = 3;

type GameplaySceneData = {
  mode?: "classic" | "challenge" | "practice" | "daily";
  runIndex?: number;
  trackId?: string;
  drillId?: string;
  carCount?: SupportedClassicCarCount;
};

export class GameplayScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private centerText!: Phaser.GameObjects.Text;
  private helpText!: Phaser.GameObjects.Text;
  private simulation!: GameSimulation;
  private modeConfig!: ModeConfig;
  private activeMode: "classic" | "challenge" | "practice" | "daily" = "classic";
  private pattern: PatternEvent[] = [];
  private replayBuffer = new ReplayBuffer();
  private classicRun?: ClassicRun;
  private challengeRun?: ChallengeRun;
  private practiceRun?: PracticeRun;
  private dailyRun?: DailyRun;
  private challengeProgress?: ChallengeProgress;
  private dailyProgress?: DailyProgress;
  private runIndex = 0;
  private carCount: SupportedClassicCarCount = 2;
  private highScore = 0;
  private lastStatus: SimulationState["status"] = "ready";
  private lastFrameDeltaMs = 16;
  private hasDispatchedEnd = false;
  private carColors = {
    left: 0x3dd6c6,
    right: 0xffd166,
  };
  private visualCarPose: Record<RoadSide, { frontX: number; rearX: number }> = {
    left: { frontX: TWO_CAR_LANE_X.left[0], rearX: TWO_CAR_LANE_X.left[0] },
    right: { frontX: TWO_CAR_LANE_X.right[1], rearX: TWO_CAR_LANE_X.right[1] },
  };

  constructor() {
    super("GameplayScene");
  }

  create(data: GameplaySceneData = {}): void {
    this.startRun({ ...window.__MULTI_CARS_BOOT__, ...data });
    this.highScore = loadClassicHighScoreForCarCount(this.carCount);
    this.input.addPointer(EXTRA_TOUCH_POINTERS);

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
    this.bindTestControls();
    this.setDomStatus(this.simulation.getState());
  }

  update(_time: number, delta: number): void {
    const cappedDelta = Math.min(delta, 34);
    this.lastFrameDeltaMs = cappedDelta;
    const state = this.simulation.step(cappedDelta);
    this.replayBuffer.record(state);

    if (
      this.activeMode === "classic" &&
      (state.status === "failed" || state.status === "completed") &&
      this.lastStatus !== state.status
    ) {
      saveClassicHighScoreForCarCount(state.score, this.carCount);
      this.highScore = loadClassicHighScoreForCarCount(this.carCount);
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
      this.handlePointerToggle(pointer);
    });

    this.input.keyboard?.on("keydown-A", () => this.toggleLeft());
    this.input.keyboard?.on("keydown-LEFT", () => this.toggleLeft());
    this.input.keyboard?.on("keydown-L", () => this.toggleRight());
    this.input.keyboard?.on("keydown-RIGHT", () => this.toggleRight());
    this.input.keyboard?.on("keydown-SPACE", () => this.togglePrimaryCar());
    this.input.keyboard?.on("keydown-R", () => {
      if (!this.hasDispatchedEnd) {
        this.restart();
      }
    });
    this.input.keyboard?.on("keydown-P", () => this.togglePause());
    this.input.keyboard?.on("keydown-ESC", () => this.togglePause());
    this.input.keyboard?.on("keydown-M", () => this.goToMenu());
  }

  private bindTestControls(): void {
    window.__MULTI_CARS_TEST_FAIL__ = () => {
      if (this.hasDispatchedEnd) {
        return;
      }

      const state = this.simulation.getState();
      this.goToSummary({
        ...state,
        status: "failed",
        failure: {
          reason: "missed-collectible",
          side: "left",
          lane: state.cars.left.lane,
          objectId: "e2e-forced-failure",
          timeMs: state.timeMs,
          skillTags: ["focus"],
          patternFamily: "focus",
        },
      });
    };
  }

  private toggleLeft(): void {
    if (this.carCount === 1) {
      this.togglePrimaryCar();
      return;
    }

    const state = this.simulation.getState();
    this.simulation.applyInput({ type: "TOGGLE_LEFT", atMs: state.timeMs });
  }

  private toggleRight(): void {
    if (this.carCount === 1) {
      this.togglePrimaryCar();
      return;
    }

    const state = this.simulation.getState();
    this.simulation.applyInput({ type: "TOGGLE_RIGHT", atMs: state.timeMs });
  }

  private togglePrimaryCar(): void {
    const state = this.simulation.getState();
    this.simulation.applyInput({ type: "TOGGLE_LEFT", atMs: state.timeMs });
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
        : this.activeMode === "practice"
          ? { mode: "practice", drillId: this.practiceRun?.drill.id }
          : this.activeMode === "daily"
            ? { mode: "daily" }
            : { mode: "classic", runIndex: this.runIndex + 1, carCount: this.carCount },
    );
    this.simulation.applyInput({ type: "RESTART", atMs: 0 });
  }

  private goToMenu(): void {
    emitMenuRequested();
  }

  private startRun(data: GameplaySceneData): void {
    this.activeMode = data.mode ?? "classic";
    this.runIndex = data.runIndex ?? 0;
    this.carCount = this.activeMode === "classic" ? normalizeClassicCarCount(data.carCount) : 2;
    this.highScore = loadClassicHighScoreForCarCount(this.carCount);
    const selectedSkin = getCarSkin(loadSelectedCarSkin());
    this.carColors = {
      left: selectedSkin.leftColor,
      right: selectedSkin.rightColor,
    };

    this.classicRun = undefined;
    this.challengeRun = undefined;
    this.practiceRun = undefined;
    this.dailyRun = undefined;
    this.challengeProgress = undefined;
    this.dailyProgress = undefined;
    this.replayBuffer.reset();
    const modifierSettings = loadGameplayModifierSettings();

    if (this.activeMode === "challenge") {
      this.challengeRun = createChallengeRun(data.trackId);
      this.challengeProgress = loadChallengeProgress(
        this.challengeRun.track.id,
        createInitialChallengeProgress(this.challengeRun.track.id),
      );
      this.modeConfig = this.challengeRun.config;
      this.pattern = this.challengeRun.pattern;
    } else if (this.activeMode === "practice") {
      this.practiceRun = createPracticeRun(data.drillId);
      this.modeConfig = this.practiceRun.config;
      this.pattern = this.practiceRun.pattern;
    } else if (this.activeMode === "daily") {
      this.dailyRun = createDailyRun(new Date(), modifierSettings);
      this.dailyProgress = loadDailyProgress(
        this.dailyRun.dateKey,
        createInitialDailyProgress(this.dailyRun.dateKey),
      );
      this.modeConfig = this.dailyRun.config;
      this.pattern = this.dailyRun.pattern;
    } else {
      this.classicRun = createClassicRun(this.runIndex, loadClassicSpeedSettings(), modifierSettings, this.carCount);
      this.modeConfig = this.classicRun.config;
      this.pattern = this.classicRun.pattern;
    }

    this.simulation = new GameSimulation(this.modeConfig, this.pattern);
    const initialState = this.simulation.getState();
    const laneX = this.getLaneX(initialState.carCount);
    this.visualCarPose = {
      left: {
        frontX: laneX.left[initialState.cars.left.lane],
        rearX: laneX.left[initialState.cars.left.lane],
      },
      right: {
        frontX: laneX.right[initialState.cars.right.lane],
        rearX: laneX.right[initialState.cars.right.lane],
      },
    };
    this.lastStatus = "ready";
    this.hasDispatchedEnd = false;
  }

  private renderState(state: SimulationState): void {
    this.graphics.clear();
    this.drawRoads(state);
    this.drawObjects(state.objects, state.timeMs, state.carCount);
    this.drawCars(state);
    this.drawHudPanel(state);
    this.updateHud(state);
    this.updateOverlay(state);
  }

  private drawRoads(state: SimulationState): void {
    const theme = this.challengeRun?.track.roadTheme ?? this.practiceRun?.drill.roadTheme ?? (this.dailyRun ? "storm" : "city");
    const colors = ROAD_THEME_COLORS[theme];
    const activeSides = this.getActiveSides(state.carCount);
    this.graphics.fillStyle(0x0b1017, 1);
    this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.graphics.fillStyle(0x070b12, 1);
    this.graphics.fillRect(0, 0, GAME_WIDTH, ROAD_TOP);

    if (activeSides.length === 1) {
      this.graphics.fillStyle(0x101827, 1);
      this.graphics.fillRoundedRect(166, ROAD_TOP - 28, 388, GAME_HEIGHT - ROAD_TOP + 56, 22);
      this.graphics.lineStyle(5, colors.edge, 0.55);
      this.graphics.strokeRoundedRect(166, ROAD_TOP - 28, 388, GAME_HEIGHT - ROAD_TOP + 56, 22);

      this.graphics.fillStyle(colors.road, 1);
      this.graphics.fillRoundedRect(238, ROAD_TOP - 22, 244, GAME_HEIGHT - ROAD_TOP + 44, 18);

      this.graphics.fillStyle(0xffffff, 0.045);
      this.graphics.fillRoundedRect(264, ROAD_TOP - 8, 88, GAME_HEIGHT - ROAD_TOP + 16, 12);
      this.graphics.fillRoundedRect(384, ROAD_TOP - 8, 72, GAME_HEIGHT - ROAD_TOP + 16, 12);
    } else {
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
    }

    this.graphics.lineStyle(4, colors.lane, 0.76);
    const dashOffset = (state.timeMs / 9) % 112;
    for (let y = ROAD_TOP - 112 + dashOffset; y < GAME_HEIGHT + 120; y += 112) {
      if (activeSides.length === 1) {
        this.graphics.lineBetween(360, y, 360, y + 54);
      } else {
        this.graphics.lineBetween(214, y, 214, y + 54);
        this.graphics.lineBetween(506, y, 506, y + 54);
      }
    }

    this.graphics.lineStyle(2, colors.edge, 0.24);
    const streakOffset = (state.timeMs / 5) % 150;
    for (let y = ROAD_TOP - 150 + streakOffset; y < GAME_HEIGHT + 160; y += 150) {
      this.graphics.lineBetween(70, y, 70, y + 70);
      this.graphics.lineBetween(650, y + 38, 650, y + 108);
    }

    this.graphics.lineStyle(3, 0xffffff, 0.16);
    if (activeSides.length > 1) {
      this.graphics.lineBetween(360, ROAD_TOP, 360, GAME_HEIGHT);
    }
  }

  private drawCars(state: SimulationState): void {
    for (const side of this.getActiveSides(state.carCount)) {
      this.drawMovingCar(side, state, this.carColors[side]);
    }
  }

  private drawMovingCar(side: RoadSide, state: SimulationState, color: number): void {
    const targetX = this.getLaneX(state.carCount)[side][state.cars[side].lane];
    const pose = this.visualCarPose[side];
    const frontBlend = 1 - Math.exp(-this.lastFrameDeltaMs / 18);
    const rearBlend = 1 - Math.exp(-this.lastFrameDeltaMs / 32);
    const nextFrontX = pose.frontX + (targetX - pose.frontX) * frontBlend;
    const nextRearX = pose.rearX + (targetX - pose.rearX) * rearBlend;
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

  private drawObjects(objects: ActiveObjectState[], timeMs: number, carCount: SupportedClassicCarCount): void {
    const laneX = this.getLaneX(carCount);

    for (const object of objects) {
      if (object.collected) {
        continue;
      }

      if (object.y < ROAD_TOP - 44) {
        continue;
      }

      const x = laneX[object.side][object.lane];

      switch (object.kind) {
        case "collectible":
          this.drawCollectibleToken(x, object.y, COLLECTIBLE_COLOR);
          break;
        case "color-match":
          this.drawColorMatchToken(x, object.y, object.colorKey === "right" ? this.carColors.right : this.carColors.left);
          break;
        case "dual-collect":
          this.drawDualCollectToken(x, object.y);
          break;
        case "power-up":
          this.drawPowerUpToken(x, object.y, object);
          break;
        case "fake-collectible":
          this.drawFakeCollectibleToken(x, object.y);
          break;
        case "moving-obstacle":
          this.drawObstacleToken(x, object.y, 0xf97316, true);
          break;
        case "timed-gate":
          this.drawTimedGateToken(x, object.y, this.isTimedGateClosed(object, timeMs));
          break;
        case "obstacle":
        default:
          this.drawObstacleToken(x, object.y, OBSTACLE_COLOR, false);
          break;
      }
    }
  }

  private drawCollectibleToken(x: number, y: number, color: number): void {
    this.graphics.fillStyle(0x000000, 0.22);
    this.graphics.fillEllipse(x, y + 30, 64, 16);
    this.graphics.fillStyle(color, 1);
    this.graphics.fillCircle(x, y, 28);
    this.graphics.fillStyle(0xffffff, 0.8);
    this.graphics.fillCircle(x - 8, y - 8, 8);
    this.graphics.lineStyle(6, 0xffffff, 0.28);
    this.graphics.strokeCircle(x, y, 28);
  }

  private drawPowerUpToken(x: number, y: number, object: ActiveObjectState): void {
    const color = this.getPowerUpColor(object);
    this.graphics.fillStyle(0x000000, 0.24);
    this.graphics.fillEllipse(x, y + 32, 68, 16);
    this.graphics.fillStyle(color, 1);
    this.graphics.fillCircle(x, y, 29);
    this.graphics.lineStyle(5, 0xffffff, 0.36);
    this.graphics.strokeCircle(x, y, 29);
    this.graphics.fillStyle(0xffffff, 0.9);
    this.drawPowerUpGlyph(x, y, object);
  }

  private drawPowerUpGlyph(x: number, y: number, object: ActiveObjectState): void {
    switch (object.powerUpId) {
      case "shield":
        this.drawShieldGlyph(x, y);
        break;
      case "magnet":
        this.drawMagnetGlyph(x, y);
        break;
      case "slow-motion":
        this.drawSlowMotionGlyph(x, y);
        break;
      case "score-multiplier":
        this.drawMultiplierGlyph(x, y);
        break;
      case "dual-collect":
        this.drawDualGlyph(x, y);
        break;
      default:
        this.graphics.fillTriangle(x, y - 16, x + 13, y + 6, x - 13, y + 6);
        break;
    }
  }

  private drawShieldGlyph(x: number, y: number): void {
    this.drawClosedShape([
      { x, y: y - 17 },
      { x: x + 14, y: y - 9 },
      { x: x + 10, y: y + 10 },
      { x, y: y + 18 },
      { x: x - 10, y: y + 10 },
      { x: x - 14, y: y - 9 },
    ]);
    this.graphics.lineStyle(3, 0x0b1017, 0.36);
    this.graphics.lineBetween(x, y - 10, x, y + 9);
  }

  private drawMagnetGlyph(x: number, y: number): void {
    this.graphics.lineStyle(7, 0xffffff, 0.95);
    this.graphics.lineBetween(x - 12, y - 13, x - 12, y + 8);
    this.graphics.lineBetween(x + 12, y - 13, x + 12, y + 8);
    this.graphics.lineBetween(x - 12, y + 8, x + 12, y + 8);
    this.graphics.fillStyle(0xfb7185, 1);
    this.graphics.fillRoundedRect(x - 17, y - 17, 10, 9, 3);
    this.graphics.fillStyle(0x38bdf8, 1);
    this.graphics.fillRoundedRect(x + 7, y - 17, 10, 9, 3);
  }

  private drawSlowMotionGlyph(x: number, y: number): void {
    this.graphics.lineStyle(4, 0xffffff, 0.95);
    this.graphics.strokeCircle(x, y, 14);
    this.graphics.lineBetween(x, y, x, y - 9);
    this.graphics.lineBetween(x, y, x + 8, y + 5);
    this.graphics.lineStyle(3, 0xffffff, 0.55);
    this.graphics.lineBetween(x - 24, y - 9, x - 15, y - 9);
    this.graphics.lineBetween(x - 26, y, x - 16, y);
    this.graphics.lineBetween(x - 24, y + 9, x - 15, y + 9);
  }

  private drawMultiplierGlyph(x: number, y: number): void {
    this.graphics.lineStyle(5, 0xffffff, 0.95);
    this.graphics.lineBetween(x - 19, y - 12, x - 7, y);
    this.graphics.lineBetween(x - 7, y - 12, x - 19, y);
    this.graphics.lineStyle(4, 0xffffff, 0.95);
    this.graphics.lineBetween(x + 2, y - 12, x + 17, y - 12);
    this.graphics.lineBetween(x + 17, y - 12, x + 17, y - 2);
    this.graphics.lineBetween(x + 17, y - 2, x + 2, y + 12);
    this.graphics.lineBetween(x + 2, y + 12, x + 18, y + 12);
  }

  private drawDualGlyph(x: number, y: number): void {
    this.graphics.lineStyle(4, 0xffffff, 0.95);
    this.graphics.strokeCircle(x - 8, y, 9);
    this.graphics.strokeCircle(x + 8, y, 9);
    this.graphics.lineStyle(3, 0xffffff, 0.72);
    this.graphics.lineBetween(x - 1, y, x + 1, y);
  }

  private drawObstacleToken(x: number, y: number, color: number, moving: boolean): void {
    this.graphics.fillStyle(0x000000, 0.25);
    this.graphics.fillEllipse(x, y + 34, 70, 18);
    this.graphics.fillStyle(color, 1);
    this.graphics.fillRoundedRect(x - 32, y - 32, 64, 64, moving ? 22 : 8);
    this.graphics.lineStyle(5, 0xffffff, 0.22);
    this.graphics.lineBetween(x - 18, y - 18, x + 18, y + 18);
    this.graphics.lineBetween(x + 18, y - 18, x - 18, y + 18);
    if (moving) {
      this.graphics.lineStyle(4, 0xffffff, 0.38);
      this.graphics.lineBetween(x - 24, y, x + 24, y);
      this.graphics.fillStyle(0xffffff, 0.58);
      this.graphics.fillTriangle(x - 28, y, x - 18, y - 7, x - 18, y + 7);
      this.graphics.fillTriangle(x + 28, y, x + 18, y - 7, x + 18, y + 7);
    }
  }

  private drawFakeCollectibleToken(x: number, y: number): void {
    this.drawCollectibleToken(x, y, 0x34d399);
    this.graphics.lineStyle(5, 0xfb7185, 0.9);
    this.graphics.strokeCircle(x, y, 34);
    this.graphics.fillStyle(0xfb7185, 0.92);
    this.graphics.fillTriangle(x, y - 20, x + 18, y + 13, x - 18, y + 13);
    this.graphics.lineStyle(4, 0xffffff, 0.95);
    this.graphics.lineBetween(x, y - 8, x, y + 4);
    this.graphics.fillStyle(0xffffff, 0.95);
    this.graphics.fillCircle(x, y + 9, 3);
  }

  private drawTimedGateToken(x: number, y: number, closed: boolean): void {
    const color = closed ? 0xf97316 : 0x38bdf8;
    this.graphics.fillStyle(0x000000, 0.24);
    this.graphics.fillEllipse(x, y + 32, 78, 16);
    this.graphics.lineStyle(7, color, closed ? 0.95 : 0.45);
    this.graphics.lineBetween(x - 28, y - 30, x - 28, y + 30);
    this.graphics.lineBetween(x + 28, y - 30, x + 28, y + 30);
    this.graphics.lineBetween(x - 28, y - 24, x + 28, y - 24);
    if (closed) {
      this.graphics.lineBetween(x - 28, y + 24, x + 28, y + 24);
    }
  }

  private drawColorMatchToken(x: number, y: number, color: number): void {
    this.graphics.fillStyle(0x000000, 0.22);
    this.graphics.fillEllipse(x, y + 30, 64, 16);
    this.graphics.fillStyle(color, 1);
    this.graphics.fillTriangle(x, y - 32, x + 32, y, x, y + 32);
    this.graphics.fillTriangle(x, y - 32, x - 32, y, x, y + 32);
    this.graphics.lineStyle(5, 0xffffff, 0.3);
    this.graphics.strokeCircle(x, y, 28);
  }

  private drawDualCollectToken(x: number, y: number): void {
    this.drawCollectibleToken(x, y, 0xa7f3d0);
    this.graphics.lineStyle(4, 0xffd166, 0.85);
    this.graphics.strokeCircle(x, y, 17);
  }

  private getPowerUpColor(object: ActiveObjectState): number {
    switch (object.powerUpId) {
      case "shield":
        return 0x38bdf8;
      case "slow-motion":
        return 0x818cf8;
      case "magnet":
        return 0xf472b6;
      case "score-multiplier":
        return 0x22c55e;
      case "dual-collect":
        return 0xa7f3d0;
      default:
        return 0x8bd3ff;
    }
  }

  private isTimedGateClosed(object: ActiveObjectState, timeMs: number): boolean {
    const elapsedMs = Math.max(0, timeMs - object.timeMs);
    return Math.floor(elapsedMs / 480) % 2 === 0;
  }

  private updateHud(state: SimulationState): void {
    const effectText = this.formatPowerUpStatus(state);
    const baseText =
      this.activeMode === "challenge"
        ? `Progress ${Math.round(state.completedPercent)}%   Stars ${calculateChallengeStars(state.completedPercent)}/3`
        : this.activeMode === "practice"
          ? `Practice ${Math.round(state.completedPercent)}%   Score ${state.score}`
          : this.activeMode === "daily"
            ? `Daily ${Math.round(state.completedPercent)}%   Stars ${calculateDailyStars(state.completedPercent)}/3`
            : `Score ${state.score}   Best ${this.highScore}   Speed ${this.getDisplayedSpeedLevel(state)}`;

    this.hudText.setText(effectText ? `${baseText}   ${effectText}` : baseText);
  }

  private formatPowerUpStatus(state: SimulationState): string {
    const activeLabels: string[] = [];

    if (state.powerUps.shieldCharges > 0) {
      activeLabels.push(`Shield ${state.powerUps.shieldCharges}`);
    }

    if (state.powerUps.slowMotionUntilMs > state.timeMs) {
      activeLabels.push("Slow");
    }

    if (state.powerUps.magnetUntilMs > state.timeMs) {
      activeLabels.push("Magnet");
    }

    if (state.powerUps.scoreMultiplierUntilMs > state.timeMs) {
      activeLabels.push("x2");
    }

    return activeLabels.join("   ");
  }

  private drawHudPanel(state: SimulationState): void {
    const colors = ROAD_THEME_COLORS[this.challengeRun?.track.roadTheme ?? this.practiceRun?.drill.roadTheme ?? (this.dailyRun ? "storm" : "city")];
    this.graphics.fillStyle(0x0b1017, 0.92);
    this.graphics.fillRoundedRect(88, 18, 544, 58, 18);
    this.graphics.lineStyle(2, colors.edge, 0.5);
    this.graphics.strokeRoundedRect(88, 18, 544, 58, 18);
    this.graphics.fillStyle(colors.edge, 0.12);
    const progress =
      this.activeMode === "challenge"
        ? state.completedPercent / 100
        : this.activeMode === "practice"
          ? state.completedPercent / 100
          : this.activeMode === "daily"
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
    document.body.dataset.carCount = String(state.carCount);
    document.body.dataset.speedLevel = String(this.getDisplayedSpeedLevel(state));
    document.body.dataset.failureReason = state.failure?.reason ?? "";
    document.body.dataset.patternFamily = state.failure?.patternFamily ?? "";
    document.body.dataset.leftLane = String(state.cars.left.lane);
    document.body.dataset.rightLane = this.getActiveSides(state.carCount).includes("right") ? String(state.cars.right.lane) : "";
    document.body.dataset.shieldCharges = String(state.powerUps.shieldCharges);
    document.body.dataset.powerUpStatus = this.formatPowerUpStatus(state);
  }

  private handlePointerToggle(pointer: Phaser.Input.Pointer): void {
    if (this.hasDispatchedEnd) {
      return;
    }

    const state = this.simulation.getState();
    if (state.status === "failed" || state.status === "completed") {
      return;
    }

    if (state.carCount === 1 || pointer.x < GAME_WIDTH / 2) {
      this.simulation.applyInput({ type: "TOGGLE_LEFT", atMs: state.timeMs });
      return;
    }

    this.simulation.applyInput({ type: "TOGGLE_RIGHT", atMs: state.timeMs });
  }

  private getDisplayedSpeedLevel(state: SimulationState): number {
    if (this.activeMode !== "classic") {
      return 1;
    }

    return getClassicSpeedLevel(state.timeMs, this.modeConfig);
  }

  private goToSummary(state: SimulationState): void {
    if (this.hasDispatchedEnd) {
      return;
    }

    this.hasDispatchedEnd = true;
    const replay = this.replayBuffer.createClip(state);

    if (this.activeMode === "challenge" && this.challengeRun && this.challengeProgress) {
      const updatedProgress = updateChallengeProgress(this.challengeProgress, state.completedPercent);
      saveChallengeProgress(updatedProgress);
      emitRunEnded({
        summary: createChallengeRunSummary(state, this.modeConfig, updatedProgress),
        nextRunIndex: this.runIndex,
        mode: "challenge",
        trackId: this.challengeRun.track.id,
        finalState: state,
        replay,
      });
      return;
    }

    if (this.activeMode === "practice" && this.practiceRun) {
      emitRunEnded({
        summary: createPracticeRunSummary(state, this.modeConfig),
        nextRunIndex: this.runIndex,
        mode: "practice",
        drillId: this.practiceRun.drill.id,
        finalState: state,
        replay,
      });
      return;
    }

    if (this.activeMode === "daily" && this.dailyRun && this.dailyProgress) {
      const updatedProgress = updateDailyProgress(this.dailyProgress, state.completedPercent, state.score);
      saveDailyProgress(updatedProgress);
      emitRunEnded({
        summary: createDailyRunSummary(state, this.modeConfig, updatedProgress),
        nextRunIndex: this.runIndex,
        mode: "daily",
        finalState: state,
        replay,
      });
      return;
    }

    emitRunEnded({
      summary: createClassicRunSummary(state, this.modeConfig, this.highScore),
      nextRunIndex: this.runIndex + 1,
      mode: "classic",
      carCount: this.carCount,
      finalState: state,
      replay,
    });
  }

  private getActiveSides(carCount: SupportedClassicCarCount): RoadSide[] {
    return getActiveRoadSides(carCount);
  }

  private getLaneX(carCount: SupportedClassicCarCount): Record<RoadSide, [number, number]> {
    return carCount === 1 ? ONE_CAR_LANE_X : TWO_CAR_LANE_X;
  }
}
