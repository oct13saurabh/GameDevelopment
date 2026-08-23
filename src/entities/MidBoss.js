import { MID_BOSS, GAME_WIDTH } from '../config.js';
import MidBossPattern from './bossPatterns/MidBossPattern.js';

const ENTRY_Y = 120;

// Mission 5's mid-boss -- a short, timed encounter distinct from the real
// end-of-mission Boss (see Boss.js): no phases, single attack theme, half
// scale, and a hard lifetime timer instead of fighting until killed. Modeled
// directly on Boss.js's shape (entry fall, horizontal sweep, telegraph/
// takeDamage/die) but trimmed to what a one-attack, one-phase boss needs.
export default class MidBoss {
  constructor(scene, enemyBulletPool, juice, audio, spriteGroup = null, hp = MID_BOSS.hp) {
    this.scene = scene;
    this.bulletPool = enemyBulletPool;
    this.juice = juice;
    this.audio = audio;

    this.hp = hp;
    this.maxHp = hp;
    this.alive = true;
    this.entering = true;
    this.spawnTime = scene.time.now;
    this.warnedEnrage = false;
    this.enraging = false;

    this.pattern = new MidBossPattern(this);

    this.sprite = scene.physics.add.image(GAME_WIDTH / 2, -120, 'ship_boss_mid');
    if (spriteGroup) spriteGroup.add(this.sprite);
    this.sprite.setScale(MID_BOSS.scale);
    const localRadius = MID_BOSS.hitboxRadius / MID_BOSS.scale;
    this.sprite.body.setCircle(
      localRadius,
      this.sprite.width / 2 - localRadius,
      this.sprite.height / 2 - localRadius
    );
    this.sprite.owner = this;
    this.sprite.body.setVelocityY(90);

    this.audio.bossWarning();
    scene.appEvents.emit('midboss-spawned', this.hp, this.maxHp);
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

    const margin = this.sprite.displayWidth / 2 + 10;
    if (this.sprite.x > GAME_WIDTH - margin) this.moveDir = -1;
    if (this.sprite.x < margin) this.moveDir = 1;
    this.sprite.body.setVelocityX(this.moveDir * MID_BOSS.sweepSpeed);

    if (!this.enraging) {
      const remaining = MID_BOSS.lifetimeMs - (time - this.spawnTime);
      if (!this.warnedEnrage && remaining <= MID_BOSS.enrageWarningMs) {
        this.warnedEnrage = true;
        this.scene.appEvents.emit('midboss-selfdestruct-warning');
      }
      if (remaining <= 0) {
        this.enrage();
        return;
      }
    }

    this.pattern.update(time);
  }

  takeDamage(amount) {
    if (!this.alive || this.entering || this.enraging) return;
    this.hp -= amount;
    this.juice.flashSprite(this.sprite, 0xffffff, 60);
    this.scene.appEvents.emit('midboss-health-changed', Math.max(this.hp, 0), this.maxHp);
    if (this.hp <= 0) this.die(true);
  }

  // Timeout path: not killed within MID_BOSS.lifetimeMs -- fires a full
  // radial burst (already telegraphed by the on-screen warning at
  // enrageWarningMs, so no extra flash/delay here) then self-destructs with
  // no reward, distinct from a real kill.
  enrage() {
    if (!this.alive || this.enraging) return;
    this.enraging = true;
    const cfg = MID_BOSS.enrageNova;
    for (let i = 0; i < cfg.bulletCount; i++) {
      const angleDeg = (360 / cfg.bulletCount) * i;
      this.bulletPool.fire(this.sprite.x, this.sprite.y, angleDeg, cfg.bulletSpeed, {
        texture: cfg.texture, damage: cfg.damage, scale: cfg.scale,
      });
    }
    this.audio.explosionBig();
    this.die(false);
  }

  die(reward) {
    if (!this.alive) return;
    this.alive = false;
    this.audio.explosionBig();
    this.scene.appEvents.emit('midboss-health-changed', 0, this.maxHp);
    this.juice.explosion(this.sprite.x, this.sprite.y, { scale: 1.6, count: 26, variant: 'large' });
    this.scene.appEvents.emit('midboss-killed', this, reward);
    this.juice.shake(300, 0.018);
    this.destroy();
  }

  destroy() {
    this.alive = false;
    if (this.pattern && this.pattern.destroy) this.pattern.destroy();
    if (this.sprite) {
      this.sprite.owner = null;
      this.sprite.destroy();
      this.sprite = null;
    }
  }
}
