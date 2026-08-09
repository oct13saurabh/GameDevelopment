import { ANIMATION, GAME_WIDTH, GAME_HEIGHT, PLAYER } from '../config.js';
import Starfield from '../systems/Starfield.js';
import Juice from '../systems/Juice.js';

// Plays once per mission start (see BootScene/MenuScene/GameOverScene, which
// all now route to this scene instead of jumping straight to GameScene): the
// player ship sits on Platform_01 and takes off upward off-screen before
// GameScene begins, using the same baked idle ship texture Player.js uses.
export default class LaunchScene extends Phaser.Scene {
  constructor() {
    super('LaunchScene');
  }

  init(data) {
    this.gameplayData = data;
  }

  create() {
    this.starfield = new Starfield(this);
    this.juice = new Juice(this);

    const platformY = GAME_HEIGHT - 140;
    this.add.image(GAME_WIDTH / 2, platformY, 'platform_01').setScale(0.5);

    const shipKey = this.gameplayData.shipKey || 'ship_01';
    const ship = this.add.image(GAME_WIDTH / 2, platformY - 40, `${shipKey}_idle`).setScale(PLAYER.scale);

    this.juice.engineTrail(this, ship);

    // Brief pause on the platform before the tween starts, so the takeoff
    // reads as a deliberate launch rather than the ship just sliding in.
    this.time.delayedCall(400, () => {
      this.tweens.add({
        targets: ship,
        y: -80,
        duration: ANIMATION.launchDurationMs,
        ease: 'Cubic.easeIn',
        onComplete: () => this.scene.start('GameScene', this.gameplayData),
      });
    });
  }

  update(time, dt) {
    this.starfield.update(dt);
  }
}
