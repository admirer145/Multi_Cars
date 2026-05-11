import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../../app/gameConfig";
import {
  AUTHORED_TRACKS,
  getAuthoredTracksByCategory,
  type AuthoredTrack,
} from "../../core/patterns/authoredTracks";
import { loadChallengeProgress, loadClassicHighScore } from "../../persistence/storage";
import { createInitialChallengeProgress } from "../../core/modes/challengeMode";

const TEXT = "#f8fafc";
const MUTED = "#aeb8c8";
const GOLD = "#ffd166";
const DARK = 0x0c1118;
const PANEL = 0x151c27;
const PANEL_2 = 0x202938;
const CYAN = 0x3dd6c6;
const YELLOW = 0xffd166;
const ROSE = 0xfb7185;

type ChallengeCategory = AuthoredTrack["category"];

const CATEGORY_LABELS: Record<ChallengeCategory, string> = {
  focus: "Focus",
  coordination: "Coordination",
  recognition: "Recognition",
  reaction: "Reaction",
  endurance: "Endurance",
};

export class MenuScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private soundEnabled = true;
  private reducedMotion = false;
  private selectedCategory: ChallengeCategory = "focus";

  constructor() {
    super("MenuScene");
  }

  create(): void {
    this.drawMainMenu();
    this.input.keyboard?.on("keydown-ENTER", () => this.startClassic());
    this.input.keyboard?.on("keydown-SPACE", () => this.startClassic());
  }

  private resetCanvas(screen: string): void {
    this.children.removeAll(true);
    this.graphics = this.add.graphics();
    this.drawBackplate();
    document.body.dataset.screen = screen;
    document.body.dataset.gameStatus = screen;
    document.body.dataset.gameScore = "";
    document.body.dataset.gameSeed = "";
    document.body.dataset.speedLevel = "";
    document.body.dataset.failureReason = "";
    document.body.dataset.patternFamily = "";
  }

  private drawMainMenu(): void {
    this.resetCanvas("menu");
    this.drawHeroRoads();

    this.add
      .text(62, 92, "Multi Cars", {
        color: TEXT,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "66px",
        fontStyle: "900",
      })
      .setOrigin(0, 0.5);

    this.add
      .text(66, 154, "Two hands. One focus line.", {
        color: MUTED,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "25px",
      })
      .setOrigin(0, 0.5);

    this.drawStatStrip();
    this.createModeCard(72, 316, "Classic Run", "Endless concentration with rising pressure.", CYAN, () =>
      this.startClassic(),
    );
    this.createModeCard(72, 492, "Challenge Roads", "Skill tracks by category, level, and road pattern.", YELLOW, () =>
      this.drawChallengeMenu(),
    );
    this.createModeCard(72, 668, "Settings", "Controls, sound, comfort, visuals, and future data options.", PANEL_2, () =>
      this.drawSettingsMenu(),
    );

    this.add
      .text(76, 898, "Practice and Daily unlock after the road system is stable.", {
        color: MUTED,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "22px",
      })
      .setOrigin(0, 0.5);
  }

  private drawChallengeMenu(): void {
    this.resetCanvas("challenge-select");
    this.drawHeader("Challenge Roads", "Choose a skill category, then clear each road to open harder levels.");

    const categories = Object.keys(CATEGORY_LABELS) as ChallengeCategory[];
    categories.forEach((category, index) => {
      const x = 70 + index * 126;
      const active = category === this.selectedCategory;
      this.createSmallButton(x, 246, 112, CATEGORY_LABELS[category], active ? CYAN : PANEL_2, () => {
        this.selectedCategory = category;
        this.drawChallengeMenu();
      });
    });

    const tracks = getAuthoredTracksByCategory(this.selectedCategory);
    if (tracks.length === 0) {
      this.add
        .text(76, 410, "Roads for this category are being tuned.", {
          color: MUTED,
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: "28px",
        })
        .setOrigin(0, 0.5);
    }

    tracks.forEach((track, index) => this.createTrackCard(track, 76, 354 + index * 168));
    this.createSmallButton(76, 1076, 180, "Back", PANEL_2, () => this.drawMainMenu());
  }

  private drawSettingsMenu(): void {
    this.resetCanvas("settings");
    this.drawHeader("Settings", "A scalable control room for gameplay, comfort, audio, visuals, and save data.");

    this.drawSettingsSection(76, 312, "Gameplay", [
      ["Input", "Tap sides / keyboard"],
      ["Start speed", "Normal"],
      ["Road density", "Adaptive"],
    ]);
    this.drawSettingsSection(76, 560, "Comfort", [
      ["Reduced motion", this.reducedMotion ? "On" : "Off"],
      ["Contrast", "High"],
      ["Screen shake", "Low"],
    ]);
    this.drawSettingsSection(76, 808, "Audio & Data", [
      ["Sound", this.soundEnabled ? "On" : "Off"],
      ["Music", "Off"],
      ["Save data", "Local"],
    ]);

    this.createSmallButton(76, 1110, 180, "Back", PANEL_2, () => this.drawMainMenu());
  }

  private drawBackplate(): void {
    this.graphics.clear();
    this.graphics.fillStyle(DARK, 1);
    this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.graphics.fillStyle(0x111827, 1);
    this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    for (let y = -60; y < GAME_HEIGHT + 80; y += 82) {
      this.graphics.fillStyle(0xffffff, 0.025);
      this.graphics.fillRect(0, y, GAME_WIDTH, 2);
    }
  }

  private drawHeroRoads(): void {
    this.graphics.fillStyle(0x202938, 1);
    this.graphics.fillRoundedRect(456, 36, 178, 1030, 18);
    this.graphics.fillStyle(0x2a3547, 1);
    this.graphics.fillRoundedRect(480, 36, 54, 1030, 10);
    this.graphics.fillRoundedRect(556, 36, 54, 1030, 10);
    this.graphics.lineStyle(4, 0xffd166, 0.8);
    for (let y = 76; y < 1040; y += 118) {
      this.graphics.lineBetween(545, y, 545, y + 58);
    }
    this.drawTinyCar(508, 790, CYAN);
    this.drawTinyCar(582, 642, YELLOW);
  }

  private drawStatStrip(): void {
    this.graphics.fillStyle(PANEL, 0.96);
    this.graphics.fillRoundedRect(62, 206, 348, 74, 8);
    this.graphics.lineStyle(2, 0xffffff, 0.08);
    this.graphics.strokeRoundedRect(62, 206, 348, 74, 8);
    this.add
      .text(86, 243, `Classic Best ${loadClassicHighScore()}`, {
        color: GOLD,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "26px",
        fontStyle: "800",
      })
      .setOrigin(0, 0.5);
  }

  private drawHeader(title: string, subtitle: string): void {
    this.add
      .text(64, 92, title, {
        color: TEXT,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "52px",
        fontStyle: "900",
      })
      .setOrigin(0, 0.5);

    this.add
      .text(66, 154, subtitle, {
        color: MUTED,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "22px",
        wordWrap: { width: 570 },
      })
      .setOrigin(0, 0.5);
  }

  private createModeCard(
    x: number,
    y: number,
    title: string,
    detail: string,
    accent: number,
    onClick: () => void,
  ): void {
    const card = this.add.rectangle(x + 250, y, 500, 132, PANEL, 1).setInteractive({ useHandCursor: true });
    card.on("pointerdown", onClick);
    this.graphics.lineStyle(3, accent, 0.85);
    this.graphics.strokeRoundedRect(x, y - 66, 500, 132, 8);
    this.graphics.fillStyle(accent, 1);
    this.graphics.fillRoundedRect(x + 24, y - 36, 16, 72, 6);

    this.add
      .text(x + 62, y - 26, title, {
        color: TEXT,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "32px",
        fontStyle: "900",
      })
      .setOrigin(0, 0.5);
    this.add
      .text(x + 62, y + 28, detail, {
        color: MUTED,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "20px",
        wordWrap: { width: 390 },
      })
      .setOrigin(0, 0.5);
  }

  private createTrackCard(track: AuthoredTrack, x: number, y: number): void {
    const progress = loadChallengeProgress(track.id, createInitialChallengeProgress(track.id));
    const locked = this.isTrackLocked(track);
    const card = this.add
      .rectangle(x + 284, y, 568, 132, locked ? 0x111827 : PANEL, 1)
      .setInteractive({ useHandCursor: !locked });
    if (!locked) {
      card.on("pointerdown", () => this.startChallenge(track.id));
    }
    this.graphics.lineStyle(3, getThemeColor(track.roadTheme), 0.9);
    this.graphics.strokeRoundedRect(x, y - 66, 568, 132, 8);
    this.graphics.fillStyle(getThemeColor(track.roadTheme), 0.92);
    this.graphics.fillRoundedRect(x + 22, y - 44, 92, 88, 8);
    this.graphics.fillStyle(0x111827, 0.48);
    this.graphics.fillRect(x + 64, y - 36, 8, 72);

    this.add
      .text(x + 138, y - 34, `${track.label}  L${track.level}`, {
        color: TEXT,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "27px",
        fontStyle: "900",
      })
      .setOrigin(0, 0.5);
    this.add
      .text(x + 138, y + 4, track.description, {
        color: MUTED,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "19px",
        wordWrap: { width: 370 },
      })
      .setOrigin(0, 0.5);
    this.add
      .text(x + 138, y + 42, locked ? "Locked until previous road is cleared" : `Best ${progress.bestPercent}%   Stars ${progress.stars}/3`, {
        color: GOLD,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "19px",
        fontStyle: "800",
      })
      .setOrigin(0, 0.5);
  }

  private isTrackLocked(track: AuthoredTrack): boolean {
    if (track.level <= 1) {
      return false;
    }

    const previousTrack = getAuthoredTracksByCategory(track.category).find(
      (candidate) => candidate.level === track.level - 1,
    );

    if (!previousTrack) {
      return false;
    }

    const previousProgress = loadChallengeProgress(
      previousTrack.id,
      createInitialChallengeProgress(previousTrack.id),
    );
    return !previousProgress.completed;
  }

  private drawSettingsSection(x: number, y: number, title: string, rows: [string, string][]): void {
    this.graphics.fillStyle(PANEL, 1);
    this.graphics.fillRoundedRect(x, y, 568, 198, 8);
    this.graphics.lineStyle(2, 0xffffff, 0.08);
    this.graphics.strokeRoundedRect(x, y, 568, 198, 8);
    this.add
      .text(x + 28, y + 36, title, {
        color: TEXT,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "28px",
        fontStyle: "900",
      })
      .setOrigin(0, 0.5);

    rows.forEach(([label, value], index) => {
      const rowY = y + 82 + index * 38;
      this.add.text(x + 28, rowY, label, { color: MUTED, fontFamily: "Inter, system-ui, sans-serif", fontSize: "20px" }).setOrigin(0, 0.5);
      this.add.text(x + 420, rowY, value, { color: GOLD, fontFamily: "Inter, system-ui, sans-serif", fontSize: "20px", fontStyle: "800" }).setOrigin(0, 0.5);
    });
  }

  private createSmallButton(
    x: number,
    y: number,
    width: number,
    label: string,
    color: number,
    onClick: () => void,
  ): void {
    const button = this.add.rectangle(x + width / 2, y, width, 66, color, 1).setInteractive({ useHandCursor: true });
    button.on("pointerdown", onClick);
    this.add
      .text(x + width / 2, y, label, {
        align: "center",
        color: color === CYAN ? "#101318" : TEXT,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "18px",
        fontStyle: "900",
      })
      .setOrigin(0.5);
  }

  private drawTinyCar(x: number, y: number, color: number): void {
    this.graphics.fillStyle(color, 1);
    this.graphics.fillRoundedRect(x - 22, y - 40, 44, 80, 10);
    this.graphics.fillStyle(0xffffff, 0.28);
    this.graphics.fillRoundedRect(x - 14, y - 24, 28, 20, 6);
  }

  private startClassic(): void {
    this.scene.start("GameplayScene", { mode: "classic", runIndex: 0 });
  }

  private startChallenge(trackId: string): void {
    this.scene.start("GameplayScene", { mode: "challenge", trackId });
  }
}

function getThemeColor(theme: AuthoredTrack["roadTheme"]): number {
  if (theme === "neon") return CYAN;
  if (theme === "storm") return ROSE;
  if (theme === "canyon") return YELLOW;
  return 0x8bd3ff;
}
