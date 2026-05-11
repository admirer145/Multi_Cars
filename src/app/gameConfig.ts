import Phaser from "phaser";
import { GameplayScene } from "../game/scenes/GameplayScene";

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#101318",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: true,
    },
    scene: [GameplayScene],
  };
}
