import { BOSS, GAME_WIDTH } from '../config.js';
import Enemy from './Enemy.js';

const ENTRY_Y = 120;

export default class Boss {
  constructor(scene, enemyBulletPool, juice, audio, spawnMinion, spriteGroup = null, missionHp = null) {
    this.scene = scene;
    this.bulletPool = enemyBulletPool;
    this.juice = juice;
    this.audio = audio;
    this.spawnMinion = spawnMinion;

    this.hp = missionHp !== null ? missionHp : BOSS.hp;
    this.maxHp = this.hp;
    this.alive = true;
    this.phase = 1;
    this.entering = true;
    this.lastRadialFire = 0;
    this.lastAimedFire = 0;
    this.lastSpreadFire = 0;
    this.lastMinionSpawn = 0;
    this.lastLaserFire = 0;
    this.telegraphing = false;
    this.laserActive = false;

    this.sprite = scene.physics.add.image(GAME_WIDTH / 2, -150, 'ship_boss');
    // Physics groups reset velocity to their (zero) defaults when a sprite is
    // added, so join the group BEFORE configuring body/velocity, not after.
    if (spriteGroup) spriteGroup.add(this.sprite);
    this.sprite.setScale(BOSS.scale);
    // Arcade circle bodies auto-scale with the sprite, so the radius/offset
    // passed to setCircle must be in local (unscaled) units.
    const localRadius = BOSS.hitboxRadius / BOSS.scale;
    this.sprite.body.setCircle(
      localRadius,
      this.sprite.width / 2 - localRadius,
      this.sprite.height / 2 - localRadius
    );
    this.sprite.owner = this;
    this.sprite.body.setVelocityY(60);

    this.audio.bossWarning();
    scene.appEvents.emit('boss-spawned', this.hp, this.maxHp);
  }

  update(time, dt) {
    if (!this.alive) return;

    if (this.entering) {
      if (this.sprite.y >= ENTRY_Y) {
        this.sprite.y = ENTRY_Y;
        this.sprite.body.setVelocityY(0);
        this.entering = false;
        this.moveDir = 1;
      }
      return;
    }

    if (this.stunnedUntil && time < this.stunnedUntil) {
      this.sprite.body.setVelocity(0, 0);
      return;
    }

    // Horizontal sweep -- faster each phase.
    const sweepSpeed = this.phase === 1 ? 70 : this.phase === 2 ? 130 : 170;
    const margin = this.sprite.displayWidth / 2 + 10;
    if (this.sprite.x > GAME_WIDTH - margin) this.moveDir = -1;
    if (this.sprite.x < margin) this.moveDir = 1;
    this.sprite.body.setVelocityX(this.moveDir * sweepSpeed);

    // Phase transitions.
    if (this.phase === 1 && this.hp <= this.maxHp * BOSS.phase2HpFraction) {
      this.phase = 2;
      this.scene.appEvents.emit('boss-phase-changed', this.phase);
    } else if (this.phase === 2 && this.hp <= this.maxHp * BOSS.phase3HpFraction) {
      this.phase = 3;
      this.scene.appEvents.emit('boss-phase-changed', this.phase);
    }

    this.handleAttacks(time);
  }

  // Flashes the boss and plays a warning cue, then fires after
  // BOSS.telegraphMs so radial/spread/laser bursts read as dodgeable
  // reactions instead of instant damage. Aimed shots stay un-telegraphed --
  // they're a steady trickle, not a burst.
  telegraphThenFire(fireFn) {
    if (!this.alive) return;
    this.audio.bossTelegraph();
    this.scene.time.delayedCall(BOSS.telegraphMs, () => {
      if (this.alive) fireFn();
    });
  }

  handleAttacks(time) {
    // Aimed shot at player, all phases.
    if (time - this.lastAimedFire > 1400) {
      this.lastAimedFire = time;
      this.fireAimed();
    }

    // Radial burst, all phases (faster each phase).
    const radialInterval = this.phase === 1 ? 2600 : this.phase === 2 ? 1900 : 1500;
    if (time - this.lastRadialFire > radialInterval) {
      this.lastRadialFire = time;
      this.telegraphThenFire(() => this.fireRadial());
    }

    if (this.phase >= 2) {
      if (time - this.lastSpreadFire > 2200) {
        this.lastSpreadFire = time;
        this.telegraphThenFire(() => this.fireSpread());
      }
      if (time - this.lastMinionSpawn > 8000 && this.spawnMinion) {
        this.lastMinionSpawn = time;
        this.spawnMinion(this.sprite.x - 60, this.sprite.y + 40);
        this.spawnMinion(this.sprite.x + 60, this.sprite.y + 40);
      }
    }

    if (this.phase >= 3 && !this.laserActive) {
      if (time - this.lastLaserFire > BOSS.laser.intervalMs) {
        this.lastLaserFire = time;
        this.telegraphThenFire(() => this.fireLaserSweep());
      }
    }
  }

  fireAimed() {
    const player = this.scene.player;
    if (!player || !player.alive) return;
    const angleDeg = Phaser.Math.RadToDeg(
      Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, player.sprite.x, player.sprite.y)
    );
    this.bulletPool.fire(this.sprite.x, this.sprite.y + 20, angleDeg, BOSS.bulletSpeed + 60, {
      texture: 'bullet_enemy', damage: 15, scale: 0.55, tint: 0xff0000,
    });
    this.audio.enemyShoot();
  }

  fireRadial(count = 12) {
    for (let i = 0; i < count; i++) {
      const angleDeg = (360 / count) * i;
      this.bulletPool.fire(this.sprite.x, this.sprite.y, angleDeg, BOSS.bulletSpeed, {
        texture: 'bullet_enemy', damage: 10, scale: 0.45, tint: 0xff0000,
      });
    }
    this.audio.enemyShoot();
  }

  fireSpread(count = 5, spreadDeg = 50) {
    const base = 90;
    const start = base - spreadDeg / 2;
    for (let i = 0; i < count; i++) {
      const angleDeg = start + (spreadDeg / (count - 1)) * i;
      this.bulletPool.fire(this.sprite.x, this.sprite.y + 20, angleDeg, BOSS.bulletSpeed, {
        texture: 'bullet_enemy', damage: 10, scale: 0.45, tint: 0xff0000,
      });
    }
    this.audio.enemyShoot();
  }

  // Phase 3 only. Sweeps a rapid stream of bullets across a fixed angle band
  // over BOSS.laser.durationMs -- reads as a laser beam without needing a
  // dedicated continuous-hitbox entity, reusing the existing bullet pool.
  fireLaserSweep() {
    if (!this.alive) return;
    const cfg = BOSS.laser;
    this.laserActive = true;
    const steps = Math.floor(cfg.durationMs / cfg.tickMs);
    let step = 0;
    this.audio.enemyShoot();
    this._laserTimer = this.scene.time.addEvent({
      delay: cfg.tickMs,
      repeat: steps,
      callback: () => {
        if (!this.alive) return;
        const t = steps === 0 ? 0 : step / steps;
        const angleDeg = Phaser.Math.Linear(cfg.angleStart, cfg.angleEnd, t);
        this.bulletPool.fire(this.sprite.x, this.sprite.y + 20, angleDeg, BOSS.bulletSpeed + 40, {
          texture: 'bullet_enemy', damage: cfg.damage, scale: cfg.scale, tint: 0xff0000,
        });
        step++;
        if (step >= steps) this.laserActive = false;
      },
    });
  }

  takeDamage(amount) {
    if (!this.alive || this.entering) return;
    this.hp -= amount;
    this.juice.flashSprite(this.sprite, 0xffffff, 60);
    this.scene.appEvents.emit('boss-health-changed', Math.max(this.hp, 0), this.maxHp);
    if (this.hp <= 0) this.die();
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.juice.explosion(this.sprite.x, this.sprite.y, { scale: 2.2, count: 40, variant: 'large' });
    this.juice.shake(500, 0.025);
    this.audio.explosionBig();
    this.scene.appEvents.emit('boss-killed', this);
    this.destroy();
  }

  destroy() {
    this.alive = false;
    if (this._laserTimer) {
      this._laserTimer.remove(false);
      this._laserTimer = null;
    }
    if (this.sprite) {
      this.sprite.owner = null;
      this.sprite.destroy();
      this.sprite = null;
    }
  }
}
