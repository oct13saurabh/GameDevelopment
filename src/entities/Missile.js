import { ROCKET_POWERUP, GAME_WIDTH, GAME_HEIGHT } from '../config.js';

// A single homing missile fired by the player while the rocket power-up is
// active. Steers toward its target each frame with a limited turn rate, and
// re-acquires a new target if the current one dies before impact.

export default class Missile {
  constructor(scene, x, y, target, juice, audio, spriteGroup, onResolved) {
    this.scene = scene;
    this.juice = juice;
    this.audio = audio;
    this.onResolved = onResolved;
    this.alive = true;
    this.target = target;
    this.angleDeg = -90; // start heading straight up

    this.sprite = scene.physics.add.image(x, y, 'missile_rocket');
    if (spriteGroup) spriteGroup.add(this.sprite);
    this.sprite.setScale(ROCKET_POWERUP.scale);
    const localRadius = ROCKET_POWERUP.hitboxRadius / ROCKET_POWERUP.scale;
    this.sprite.body.setCircle(
      localRadius,
      this.sprite.width / 2 - localRadius,
      this.sprite.height / 2 - localRadius
    );
    this.sprite.owner = this;
    this.sprite.setRotation(Phaser.Math.DegToRad(this.angleDeg + 90));
    scene.physics.velocityFromRotation(Phaser.Math.DegToRad(this.angleDeg), ROCKET_POWERUP.speed, this.sprite.body.velocity);

    this.trail = juice.engineTrail(scene, this.sprite);
  }

  update(time, dt) {
    if (!this.alive) return;

    if (!this.target || !this.target.alive) {
      this.target = this.scene.findNearestHostile(this.sprite.x, this.sprite.y);
    }

    if (this.target && this.target.sprite) {
      const desiredRad = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, this.target.sprite.x, this.target.sprite.y);
      const maxStepRad = Phaser.Math.DegToRad(ROCKET_POWERUP.turnRateDeg) * (dt / 1000);
      const newRad = Phaser.Math.Angle.RotateTo(Phaser.Math.DegToRad(this.angleDeg), desiredRad, maxStepRad);
      this.angleDeg = Phaser.Math.RadToDeg(newRad);
      this.scene.physics.velocityFromRotation(newRad, ROCKET_POWERUP.speed, this.sprite.body.velocity);
      this.sprite.setRotation(newRad + Math.PI / 2);
    }

    if (this.sprite.y < -60 || this.sprite.y > GAME_HEIGHT + 60 || this.sprite.x < -60 || this.sprite.x > GAME_WIDTH + 60) {
      this.resolve();
    }
  }

  hit(targetEntity) {
    if (!this.alive) return;
    this.juice.explosion(this.sprite.x, this.sprite.y, { scale: 0.9 });
    this.audio.explosionSmall();
    if (targetEntity && targetEntity.alive) targetEntity.takeDamage(ROCKET_POWERUP.damage);
    this.resolve();
  }

  resolve() {
    if (!this.alive) return;
    this.alive = false;
    if (this.onResolved) this.onResolved();
    this.destroy();
  }

  destroy() {
    this.alive = false;
    if (this.trail) {
      this.trail.destroy();
      this.trail = null;
    }
    if (this.sprite) {
      this.sprite.owner = null;
      this.sprite.destroy();
      this.sprite = null;
    }
  }
}
