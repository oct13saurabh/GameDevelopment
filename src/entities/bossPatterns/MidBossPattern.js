import { MID_BOSS } from '../../config.js';
import AttackCycle from './AttackCycle.js';
import EnemyMissile from './EnemyMissile.js';

// Mission 5 mid-boss's only attack theme: front machine gun for burstMs, then
// during the pauseMs gap, 2 straight wing missiles immediately followed by 2
// homing wing missiles 1s later. Not registered in bossPatterns/index.js's
// PATTERNS map -- that registry is keyed by mission number for the real end-
// of-mission Boss; MidBoss.js owns this pattern directly since there's only
// one mid-boss archetype.
export default class MidBossPattern {
  constructor(boss) {
    this.boss = boss;
    this._gunTimer = null;
    this.missiles = [];
    this.cycle = new AttackCycle(this.buildStates());
  }

  update(time) {
    this.cycle.update(time);
    for (const m of this.missiles) m.update(time);
    this.missiles = this.missiles.filter((m) => m.alive);
  }

  buildStates() {
    const cfg = MID_BOSS.machineGun;
    return [
      {
        name: 'machineGun', durationMs: cfg.burstMs,
        onEnter: () => {
          this.fireMachineGunBullet();
          this._gunTimer = this.boss.scene.time.addEvent({ delay: cfg.fireIntervalMs, loop: true, callback: () => this.fireMachineGunBullet() });
        },
        onExit: () => { if (this._gunTimer) { this._gunTimer.remove(false); this._gunTimer = null; } },
      },
      {
        name: 'pause', durationMs: cfg.pauseMs,
        onEnter: () => {
          this._homingFiredThisPause = false;
          this.fireWingMissiles(MID_BOSS.wingMissileStraight);
        },
        onTick: (time, dt, cycle) => {
          if (!this._homingFiredThisPause && time - cycle.stateStartTime >= 1000) {
            this._homingFiredThisPause = true;
            this.fireWingMissiles(MID_BOSS.wingMissileHoming);
          }
        },
      },
    ];
  }

  fireMachineGunBullet() {
    const boss = this.boss;
    if (!boss.alive) return;
    const cfg = MID_BOSS.machineGun;
    boss.bulletPool.fire(boss.sprite.x, boss.sprite.y + 20, 90, cfg.bulletSpeed, {
      texture: cfg.texture, damage: cfg.damage, scale: cfg.scale,
    });
    boss.audio.enemyShoot();
  }

  // One missile from each wing muzzle, offset from the sprite center by a
  // fraction of its display width so it reads as launching from the wings
  // rather than the same front-center point the machine gun uses.
  fireWingMissiles(cfg) {
    const boss = this.boss;
    if (!boss.alive) return;
    const wingOffsetX = boss.sprite.displayWidth * 0.35;
    const y = boss.sprite.y + 10;
    this.missiles.push(new EnemyMissile(boss, boss.sprite.x - wingOffsetX, y, boss.scene.bossProjectileGroup, cfg));
    this.missiles.push(new EnemyMissile(boss, boss.sprite.x + wingOffsetX, y, boss.scene.bossProjectileGroup, cfg));
    boss.audio.enemyShoot();
  }

  destroy() {
    this.cycle.destroy();
    if (this._gunTimer) this._gunTimer.remove(false);
    for (const m of this.missiles) m.destroy();
    this.missiles = [];
  }
}
