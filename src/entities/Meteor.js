import { METEOR, METEOR_SIZES, SPECIAL_METEOR, GAME_WIDTH, GAME_HEIGHT } from '../config.js';

const TEXTURES = ['meteor_1', 'meteor_2', 'meteor_3', 'meteor_4'];

function pickWeightedSize() {
  const total = METEOR_SIZES.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * total;
  for (const size of METEOR_SIZES) {
    if (r < size.weight) return size;
    r -= size.weight;
  }
  return METEOR_SIZES[0];
}

export default class Meteor {
  // options.special: true for Shooting_Meteor/Freezing_Meteor -- these enter
  // from a top corner and streak straight across, unrotated, instead of
  // drifting down from the top like a normal meteor.
  // (options.kind: 'shooting'|'freezing', options.fromLeft: true|false)
  constructor(scene, juice, audio, x, y, spriteGroup = null, options = {}) {
    this.scene = scene;
    this.juice = juice;
    this.audio = audio;
    this.alive = true;
    this.special = !!options.special;

    const texture = this.special
      ? SPECIAL_METEOR.textures[options.kind] || SPECIAL_METEOR.textures.shooting
      : Phaser.Utils.Array.GetRandom(TEXTURES);
    this.sprite = scene.physics.add.image(x, y, texture);
    // Physics groups reset velocity to their (zero) defaults when a sprite is
    // added, so join the group BEFORE configuring body/velocity, not after.
    if (spriteGroup) spriteGroup.add(this.sprite);

    let scale;
    let hitboxRadius;
    if (this.special) {
      this.hp = SPECIAL_METEOR.hp;
      scale = SPECIAL_METEOR.scale;
      hitboxRadius = SPECIAL_METEOR.hitboxRadius;
    } else {
      const size = pickWeightedSize();
      this.sizeKey = size.key;
      this.hp = size.hp;
      scale = Phaser.Math.FloatBetween(size.scaleMin, size.scaleMax);
      hitboxRadius = size.hitboxRadius;
    }
    this.sprite.setScale(scale);
    // Arcade circle bodies auto-scale with the sprite, so the radius/offset
    // passed to setCircle must be in local (unscaled) units.
    const localRadius = hitboxRadius / scale;
    this.sprite.body.setCircle(
      localRadius,
      this.sprite.width / 2 - localRadius,
      this.sprite.height / 2 - localRadius
    );
    this.sprite.owner = this;

    if (this.special) {
      // Aim from the spawn corner toward a random point elsewhere on
      // screen, so it cuts across at a varied angle instead of a flat
      // horizontal line.
      const speed = Phaser.Math.Between(SPECIAL_METEOR.speedMin, SPECIAL_METEOR.speedMax);
      const targetX = options.fromLeft
        ? Phaser.Math.Between(GAME_WIDTH * 0.35, GAME_WIDTH + 60)
        : Phaser.Math.Between(-60, GAME_WIDTH * 0.65);
      const targetY = Phaser.Math.Between(GAME_HEIGHT * 0.25, GAME_HEIGHT - 40);
      const angle = Phaser.Math.Angle.Between(x, y, targetX, targetY);
      scene.physics.velocityFromRotation(angle, speed, this.sprite.body.velocity);
    } else {
      const speed = Phaser.Math.Between(METEOR.speedMin, METEOR.speedMax);
      this.sprite.body.setVelocity(Phaser.Math.Between(-30, 30), speed);
      this.sprite.body.setAngularVelocity(Phaser.Math.Between(-60, 60));
    }

    this.juice.spawnPop(this.sprite);
  }

  update() {
    if (!this.alive) return;
    if (this.special) {
      const { x, y } = this.sprite;
      if (x < -80 || x > GAME_WIDTH + 80 || y < -80 || y > GAME_HEIGHT + 80) this.destroy();
    } else if (this.sprite.y > GAME_HEIGHT + 80) {
      this.destroy();
    }
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
    this.juice.explosion(this.sprite.x, this.sprite.y, { scale: 0.7, tint: [0xaa8866, 0x775533, 0x442211] });
    this.audio.explosionSmall();
    this.scene.appEvents.emit('meteor-destroyed', this);
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
