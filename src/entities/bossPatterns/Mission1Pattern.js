import { BOSS } from '../../config.js';
import AttackCycle from './AttackCycle.js';

// Mission 1 boss attack pattern -- a strict repeating cycle (not independent
// per-attack cooldowns): Twin Cannons -> pause -> Spread Shot -> pause ->
// Twin Cannons (2nd burst) -> pause -> Laser Charge -> Laser Sweep -> repeat.
// Same 7-state shape across all 3 phases; only window/pause durations
// tighten by phase (see BOSS.mission1Cycle), so the pattern stays readable
// while pressure ramps up. (Previously had a Homing Missiles state here --
// removed, it read as pointless clutter rather than a real threat.)
export default class Mission1Pattern {
  constructor(boss) {
    this.boss = boss;
    this._twinTimer = null;
    this._spreadTimer = null;
    this._twin2Timer = null;
    this._laserTimer = null;

    this.cycle = new AttackCycle(this.buildStates(boss.phase));
    this._lastPhase = boss.phase;
  }

  update(time) {
    const boss = this.boss;
    if (boss.phase !== this._lastPhase) {
      this._lastPhase = boss.phase;
      this.cycle.reset(this.buildStates(boss.phase));
    }
    this.cycle.update(time);
  }

  buildStates(phase) {
    const d = BOSS.mission1Cycle[`phase${phase}`] || BOSS.mission1Cycle.phase1;
    const spreadCount = phase === 3 ? BOSS.spreadShot.count + 1 : BOSS.spreadShot.count;
    return [
      {
        name: 'twinCannons', durationMs: d.twinCannons,
        onEnter: () => {
          this.fireTwinCannons();
          this._twinTimer = this.boss.scene.time.addEvent({ delay: BOSS.twinCannon.fireRateMs, loop: true, callback: () => this.fireTwinCannons() });
        },
        onExit: () => { if (this._twinTimer) { this._twinTimer.remove(false); this._twinTimer = null; } },
      },
      { name: 'pause1', durationMs: d.pause1 },
      {
        name: 'spread', durationMs: d.spread,
        onEnter: () => {
          this.fireSpread(spreadCount);
          this._spreadTimer = this.boss.scene.time.addEvent({ delay: BOSS.spreadShot.fireRateMs, loop: true, callback: () => this.fireSpread(spreadCount) });
        },
        onExit: () => { if (this._spreadTimer) { this._spreadTimer.remove(false); this._spreadTimer = null; } },
      },
      { name: 'pause2', durationMs: d.pause2 },
      {
        name: 'twinCannons2', durationMs: d.missiles,
        onEnter: () => {
          this.fireTwinCannons();
          this._twin2Timer = this.boss.scene.time.addEvent({ delay: BOSS.twinCannon.fireRateMs, loop: true, callback: () => this.fireTwinCannons() });
        },
        onExit: () => { if (this._twin2Timer) { this._twin2Timer.remove(false); this._twin2Timer = null; } },
      },
      { name: 'pause3', durationMs: d.pause3 },
      {
        name: 'laserCharge', durationMs: d.laserCharge,
        onEnter: () => { this.boss.audio.bossTelegraph(); },
      },
      {
        name: 'laserSweep', durationMs: d.laserSweep,
        onEnter: () => this.fireLaserSweep(),
        onExit: () => { if (this._laserTimer) { this._laserTimer.remove(false); this._laserTimer = null; } },
      },
    ];
  }

  fireTwinCannons() {
    const boss = this.boss;
    if (!boss.alive) return;
    const cfg = BOSS.twinCannon;
    boss.bulletPool.fire(boss.sprite.x - cfg.spacing, boss.sprite.y + 20, 90, cfg.bulletSpeed, {
      texture: 'enemy_bullet_2', damage: cfg.damage, scale: cfg.scale,
    });
    boss.bulletPool.fire(boss.sprite.x + cfg.spacing, boss.sprite.y + 20, 90, cfg.bulletSpeed, {
      texture: 'enemy_bullet_2', damage: cfg.damage, scale: cfg.scale,
    });
    boss.audio.enemyShoot();
  }

  fireSpread(count = BOSS.spreadShot.count) {
    const boss = this.boss;
    if (!boss.alive) return;
    const cfg = BOSS.spreadShot;
    const base = 90;
    const start = base - cfg.spreadDeg / 2;
    for (let i = 0; i < count; i++) {
      const angleDeg = start + (cfg.spreadDeg / (count - 1)) * i;
      boss.bulletPool.fire(boss.sprite.x, boss.sprite.y + 20, angleDeg, cfg.bulletSpeed, {
        texture: 'enemy_bullet_2', damage: cfg.damage, scale: cfg.scale,
      });
    }
    boss.audio.enemyShoot();
  }

  // Same telegraphed-beam mechanic as before -- charge state already covered
  // the telegraph, so this fires immediately on entering the sweep state.
  fireLaserSweep() {
    const boss = this.boss;
    if (!boss.alive) return;
    const cfg = BOSS.laser;
    const steps = Math.floor(cfg.durationMs / cfg.tickMs);
    let step = 0;
    boss.audio.enemyShoot();
    this._laserTimer = boss.scene.time.addEvent({
      delay: cfg.tickMs,
      repeat: steps,
      callback: () => {
        if (!boss.alive) return;
        const t = steps === 0 ? 0 : step / steps;
        const angleDeg = Phaser.Math.Linear(cfg.angleStart, cfg.angleEnd, t);
        boss.bulletPool.fire(boss.sprite.x, boss.sprite.y + 20, angleDeg, BOSS.bulletSpeed + 40, {
          texture: 'enemy_bullet_2', damage: cfg.damage, scale: cfg.scale,
        });
        step++;
      },
    });
  }

  destroy() {
    this.cycle.destroy();
    [this._twinTimer, this._spreadTimer, this._twin2Timer, this._laserTimer].forEach((t) => t && t.remove(false));
  }
}
