import { BOSS, GAME_WIDTH, GAME_HEIGHT } from '../../config.js';

// Mission 3's Missile Barrage hazard: a destroyable homing missile fired at
// the player, launched straight down and steering toward them like the
// player's own Missile.js -- except its turn is clamped to the lower
// half-circle (see clampAngleDeg): it can curve across left/right/down to
// chase the player, but can never rotate up past horizontal. Reads as always
// diving at the player rather than doubling back over the boss.
export default class EnemyMissile {
  // cfg defaults to the Mission 3+ Missile Barrage tuning; pass a different
  // shape (e.g. MID_BOSS.wingMissileStraight, turnRateDeg: 0) to get a
  // non-homing variant out of the same entity -- clampAngleDeg still guards
  // the steer, it just never gets a nonzero step to apply.
  constructor(boss, x, y, spriteGroup, cfg = BOSS.missileBarrage) {
    this.boss = boss;
    this.scene = boss.scene;
    this.cfg = cfg;
    this.alive = true;
    this.hp = this.cfg.hp;
    this.angleDeg = 90; // start heading straight down
    this.spawnTime = this.scene.time.now;

    this.sprite = this.scene.physics.add.image(x, y, this.cfg.texture);
    if (spriteGroup) spriteGroup.add(this.sprite);
    this.sprite.setScale(this.cfg.scale);
    const localRadius = this.cfg.hitboxRadius / this.cfg.scale;
    this.sprite.body.setCircle(
      localRadius,
      this.sprite.width / 2 - localRadius,
      this.sprite.height / 2 - localRadius
    );
    this.sprite.owner = this;
    this.sprite.setRotation(Phaser.Math.DegToRad(this.angleDeg + 90));
    this.scene.physics.velocityFromRotation(Phaser.Math.DegToRad(this.angleDeg), this.cfg.speed, this.sprite.body.velocity);
    this._lastUpdateTime = null;
  }

  // Snaps a desired heading back into [0, 180] (right -> down -> left,
  // vy >= 0) -- the nearest allowed side, not a naive clamp, so a target
  // that's up-and-to-the-left still pulls it toward "left", not "right".
  clampAngleDeg(deg) {
    if (deg >= 0) return deg;
    return deg >= -90 ? 0 : 180;
  }

  // Pattern-owned entities are ticked with just `time` (see
  // Mission3Pattern.update / Boss.update), so the per-frame delta needed for
  // a turn-rate-limited steer is tracked here instead of received as a param.
  update(time) {
    if (!this.alive) return;
    if (time - this.spawnTime >= this.cfg.lifetimeMs) {
      this.explode();
      return;
    }
    const dt = this._lastUpdateTime === null ? 16 : time - this._lastUpdateTime;
    this._lastUpdateTime = time;
    const player = this.scene.player;
    if (player && player.alive) {
      const desiredRad = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, player.sprite.x, player.sprite.y);
      const maxStepRad = Phaser.Math.DegToRad(this.cfg.turnRateDeg) * (dt / 1000);
      const newRad = Phaser.Math.Angle.RotateTo(Phaser.Math.DegToRad(this.angleDeg), desiredRad, maxStepRad);
      this.angleDeg = this.clampAngleDeg(Phaser.Math.RadToDeg(newRad));
      const rad = Phaser.Math.DegToRad(this.angleDeg);
      this.scene.physics.velocityFromRotation(rad, this.cfg.speed, this.sprite.body.velocity);
      this.sprite.setRotation(rad + Math.PI / 2);
    }
    if (this.sprite.y < -60 || this.sprite.y > GAME_HEIGHT + 60 || this.sprite.x < -60 || this.sprite.x > GAME_WIDTH + 60) {
      this.destroy();
    }
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.boss.juice.explosion(this.sprite.x, this.sprite.y, { scale: 0.6 });
      this.boss.audio.explosionSmall();
      this.destroy();
    }
  }

  // Called when it reaches the player directly (GameScene overlap).
  hitPlayer() {
    if (!this.alive) return;
    this.boss.juice.explosion(this.sprite.x, this.sprite.y, { scale: 0.9 });
    this.boss.audio.explosionSmall();
    if (this.scene.player.alive && !this.scene.player.invulnerable) {
      this.scene.player.takeDamage(this.cfg.damage);
    }
    this.destroy();
  }

  // Timed self-detonation (see cfg.lifetimeMs) -- same blast-damage shape as
  // Mine.hitPlayer, except it's distance-based instead of a direct overlap,
  // since it goes off wherever it happens to be at the 5s mark, not on contact.
  explode() {
    if (!this.alive) return;
    this.boss.juice.explosion(this.sprite.x, this.sprite.y, { scale: 1.0 });
    this.boss.audio.explosionSmall();
    const player = this.scene.player;
    if (player && player.alive && !player.invulnerable) {
      const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, player.sprite.x, player.sprite.y);
      if (dist <= this.cfg.blastRadius) player.takeDamage(this.cfg.damage);
    }
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
