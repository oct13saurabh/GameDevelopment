import { GAME_WIDTH, GAME_HEIGHT } from './config.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import OptionsScene from './scenes/OptionsScene.js';
import GameScene from './scenes/GameScene.js';
import HUDScene from './scenes/HUDScene.js';
import GameOverScene from './scenes/GameOverScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#05050f',
  // Power-up/enemy art is large source PNGs drawn at a tiny setScale (often
  // 0.05) -- without mipmapping, WebGL's default linear minification filter
  // aliases/blurs badly at that downscale ratio. LINEAR_MIPMAP_LINEAR fixes
  // sharpness for any texture whose dimensions are a power of two.
  render: {
    antialias: true,
    mipmapFilter: 'LINEAR_MIPMAP_LINEAR',
  },
  // FIT scales the fixed GAME_WIDTH/HEIGHT canvas up to fill its parent
  // (#game-container, sized to 80% of the browser viewport height in
  // index.html) while preserving aspect ratio, instead of rendering at a
  // tiny native 640x720 in the middle of a large window.
  // autoCenter is NO_CENTER because index.html's #game-container already
  // centers the canvas via flexbox -- Phaser's own CENTER_BOTH computes an
  // inline offset against ITS size calc, which fights the CSS width/height
  // !important overrides in index.html and pushes the canvas off-center.
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  // Gamepad input defaults off in some Phaser builds unless explicitly
  // requested -- required for PS4/Xbox pad support in Player.js.
  input: {
    gamepad: true,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, MenuScene, OptionsScene, GameScene, HUDScene, GameOverScene],
};

window.game = new Phaser.Game(config);
