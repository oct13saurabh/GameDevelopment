import { GAME_WIDTH, GAME_HEIGHT } from './config.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import OptionsScene from './scenes/OptionsScene.js';
import LaunchScene from './scenes/LaunchScene.js';
import GameScene from './scenes/GameScene.js';
import TestScene from './scenes/TestScene.js';
import HUDScene from './scenes/HUDScene.js';
import GameOverScene from './scenes/GameOverScene.js';

// The CSS in index.html stretches the canvas element up to ~100vh via the
// #game-container canvas width/height rules, independent of the canvas's
// internal drawing-buffer resolution. If the drawing buffer stays at the
// logical 640x720 game size, the browser has to upscale it to fill that
// larger CSS box -- on basically every monitor (worse on HiDPI/Retina where
// devicePixelRatio > 1) this produces visible blur/blockiness no matter how
// sharp the source art is.
//
// Fix: Phaser's Scale Manager `zoom` option multiplies the canvas's internal
// drawing-buffer size relative to the *logical* game width/height, without
// changing the logical/world/camera coordinate space -- GAME_WIDTH/GAME_HEIGHT
// stay the single source of truth for world bounds, spawn math (GameScene),
// and HUD layout. Only the render target gets bigger, so the CSS rules above
// now downscale (crisp) instead of upscale (blurry) a higher-res buffer.
// (Multiplying the top-level/scale `width`/`height` config directly, instead
// of using `zoom`, would have been wrong -- GameScene.js hardcodes
// `physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT)` and spawn
// positions off the raw GAME_WIDTH/GAME_HEIGHT constants, so inflating the
// actual game size would desync the camera/world from that logic.)
const RENDER_DPR = window.devicePixelRatio || 1;

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
  // `zoom` renders the canvas's internal buffer at devicePixelRatio scale
  // (see comment above) while `width`/`height` keep the logical game/world
  // size at GAME_WIDTH/GAME_HEIGHT -- fixes pixelation without touching any
  // coordinate math elsewhere (input, spawn, HUD).
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    zoom: RENDER_DPR,
    autoRound: true,
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
  scene: [BootScene, MenuScene, OptionsScene, LaunchScene, GameScene, TestScene, HUDScene, GameOverScene],
};

window.game = new Phaser.Game(config);
