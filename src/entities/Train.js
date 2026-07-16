import { TRAIN, GAME_HEIGHT } from '../config.js';

// TRAIN.scale is tuned against a 1024px-wide source image. New train art
// dropped into GameAssets/Train can be any resolution -- scale is
// normalized by actual texture width so on-screen size stays consistent
// regardless of source size (same approach as Enemy.js).
const REFERENCE_SOURCE_WIDTH = 1024;

// Rare, tough hazard: enters from the top only and drifts straight down,
// slowly, with no rotation or horizontal drift.
export default class Train {
  constructor(scene, juice, audio, x, y, spriteGroup = null, textureKey) {
    this.scene = scene;
    this.juice = juice;
    this.audio = audio;
    this.hp = TRAIN.hp;
    this.alive = true;

    this.sprite = scene.physics.add.image(x, y, textureKey);
    // Physics groups reset velocity to their (zero) defaults when a sprite is
    // added, so join the group BEFORE configuring body/velocity, not after.
    if (spriteGroup) spriteGroup.add(this.sprite);
    const targetWidth = REFERENCE_SOURCE_WIDTH * TRAIN.scale;
    const appliedScale = targetWidth / this.sprite.width;
    this.sprite.setScale(appliedScale);
    // Arcade circle bodies auto-scale with the sprite, so the radius/offset
    // passed to setCircle must be in local (unscaled) units.
    const localRadius = TRAIN.hitboxRadius / appliedScale;
    this.sprite.body.setCircle(
      localRadius,
      this.sprite.width / 2 - localRadius,
      this.sprite.height / 2 - localRadius
    );
    this.sprite.owner = this;
    this.sprite.body.setVelocityY(TRAIN.speed);

    this.juice.spawnPop(this.sprite);
  }

  update() {
    if (!this.alive) return;
    if (this.sprite.y > GAME_HEIGHT + 140) this.destroy();
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp -= amount;
    this.juice.flashSprite(this.sprite, 0xffffff, 60);
    if (this.hp <= 0) this.die();
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.juice.explosion(this.sprite.x, this.sprite.y, { scale: 1.5, count: 28, variant: 'medium' });
    this.audio.explosionSmall();
    this.scene.appEvents.emit('train-destroyed', this);
    this.destroy();
  }

  destroy() {
    this.alive = false;
    if (this.sprite) {
      this.sprite.owner = null;
      this.sprite.destroy();
      this.sprite = null;
    }
  }
}
