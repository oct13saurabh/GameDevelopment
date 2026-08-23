import { BOSS, GAME_WIDTH } from '../../config.js';
import AttackCycle from './AttackCycle.js';
import EnemyMissile from './EnemyMissile.js';

// Mission 4 "pre-boss" boss: combines the mechanics the wave timeline
// already introduced (spread bullets, missiles, mines, laser sweep, meteor
// walls) instead of a new theme -- see BOSS.mission4Cycle in config.js.
// Phases 1-2: Bullets -> Missiles -> Mines -> repeat (phase 2 layers a small
// meteor burst onto the bullets/mines states). Phases 3-4 (Final Phase):
// Missiles -> Mines -> Laser Sweep -> Meteor Wall -> repeat, tempo tightening
// sharply in phase 4 per the spec's "shorter cooldowns, more aggressive".
export default class Mission4Pattern {
  constructor(boss) {
    this.boss = boss;
    this._bulletTimer = null;
    this._laserTimer = null;
    this.missiles = [];
    this.mines = [];

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

    for (const m of this.missiles) m.update(time);
    this.missiles = this.missiles.filter((m) => m.alive);

    for (const m of this.mines) m.update(time);
    this.mines = this.mines.filter((m) => m.alive);
  }

  buildStates(phase) {
    const d = BOSS.mission4Cycle[`phase${phase}`] || BOSS.mission4Cycle.phase1;
    const missileCount = BOSS.mission4MissileCount[`phase${phase}`] || BOSS.mission4MissileCount.phase1;
    const mineCount = BOSS.mission4MineCount[`phase${phase}`] || BOSS.mission4MineCount.phase1;

    if (phase <= 2) {
      return [
        {
          name: 'bullets', durationMs: d.bullets,
          onEnter: () => {
            this.fireSpread();
            this._bulletTimer = this.boss.scene.time.addEvent({ delay: BOSS.mission4Spread.fireRateMs, loop: true, callback: () => this.fireSpread() });
            if (phase === 2) this.fireMeteorBurst(2);
          },
          onExit: () => { if (this._bulletTimer) { this._bulletTimer.remove(false); this._bulletTimer = null; } },
        },
        { name: 'pause1', durationMs: d.pause1 },
        {
          name: 'missiles', durationMs: d.missiles,
          onEnter: () => this.boss.telegraphThenFire(() => this.fireMissiles(missileCount)),
        },
        { name: 'pause2', durationMs: d.pause2 },
        {
          name: 'mines', durationMs: d.mines,
          onEnter: () => {
            this.boss.telegraphThenFire(() => this.fireMineDrop(mineCount));
            if (phase === 2) this.fireMeteorBurst(2);
          },
        },
        { name: 'pause3', durationMs: d.pause3 },
      ];
    }

    const meteorWallCount = phase === 4 ? BOSS.mission4MeteorWall.countPhase4 : BOSS.mission4MeteorWall.countPhase3;
    return [
      {
        name: 'missiles', durationMs: d.missiles,
        onEnter: () => this.boss.telegraphThenFire(() => this.fireMissiles(missileCount)),
      },
      { name: 'pause1', durationMs: d.pause1 },
      {
        name: 'mines', durationMs: d.mines,
        onEnter: () => this.boss.telegraphThenFire(() => this.fireMineDrop(mineCount)),
      },
      { name: 'pause2', durationMs: d.pause2 },
      {
        name: 'laserCharge', durationMs: d.laserCharge,
        onEnter: () => { this.boss.audio.bossTelegraph(); },
      },
      {
        name: 'laserSweep', durationMs: d.laserSweep,
        onEnter: () => this.fireLaserSweep(),
        onExit: () => { if (this._laserTimer) { this._laserTimer.remove(false); this._laserTimer = null; } },
      },
      { name: 'pause3', durationMs: d.pause3 },
      {
        name: 'meteorWall', durationMs: d.meteorWall,
        onEnter: () => this.fireMeteorWall(meteorWallCount),
      },
      { name: 'pause4', durationMs: d.pause4 },
    ];
  }

  fireSpread() {
    const boss = this.boss;
    if (!boss.alive) return;
    const cfg = BOSS.mission4Spread;
    const start = 90 - cfg.spreadDeg / 2;
    for (let i = 0; i < cfg.count; i++) {
      const angleDeg = start + (cfg.spreadDeg / (cfg.count - 1)) * i;
      boss.bulletPool.fire(boss.sprite.x, boss.sprite.y + 20, angleDeg, cfg.bulletSpeed, {
        texture: 'enemy_bullet_2', damage: cfg.damage, scale: cfg.scale,
      });
    }
    boss.audio.enemyShoot();
  }

  // Staggered volley of destroyable homing missiles -- same entity as
  // Mission 3's Missile Barrage, just a per-phase count (see
  // BOSS.mission4MissileCount).
  fireMissiles(count) {
    const boss = this.boss;
    if (!boss.alive) return;
    const cfg = BOSS.missileBarrage;
    for (let i = 0; i < count; i++) {
      const delay = i * cfg.staggerMs;
      boss.scene.time.delayedCall(delay, () => {
        if (!boss.alive) return;
        this.missiles.push(new EnemyMissile(boss, boss.sprite.x, boss.sprite.y + 20, boss.scene.bossProjectileGroup));
      });
    }
    boss.audio.enemyShoot();
  }

  // Same radial placement as Mission 3's fireMineDrop, per-phase count (see
  // BOSS.mission4MineCount).
  fireMineDrop(count) {
    const boss = this.boss;
    if (!boss.alive || !boss.spawnMine) return;
    const radius = 140;
    const staggerMs = 220;
    const spanDeg = 300;
    const startDeg = 90 - spanDeg / 2;
    const stepDeg = count > 1 ? spanDeg / (count - 1) : 0;
    for (let i = 0; i < count; i++) {
      const angleDeg = startDeg + stepDeg * i;
      const angleRad = Phaser.Math.DegToRad(angleDeg);
      const delay = i * staggerMs;
      boss.scene.time.delayedCall(delay, () => {
        if (!boss.alive) return;
        const x = boss.sprite.x + Math.cos(angleRad) * radius;
        const y = boss.sprite.y + Math.sin(angleRad) * radius;
        this.mines.push(boss.spawnMine(x, y));
      });
    }
    boss.audio.enemyShoot();
  }

  // Same swept-beam mechanic as Mission 1's laser sweep, reusing BOSS.laser.
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

  // Small ambient meteor accent (phase 2's "Bullets/Mines + Meteors") -- not
  // a wall, just 1-2 meteors dropped alongside the bullet/mine state so the
  // field feels busier without becoming its own attack.
  fireMeteorBurst(count) {
    const boss = this.boss;
    if (!boss.alive || !boss.spawnMeteor) return;
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Between(30, GAME_WIDTH - 30);
      boss.scene.time.delayedCall(i * 300, () => { if (boss.alive) boss.spawnMeteor(x, -40); });
    }
  }

  // Phase 3+ "meteor wall"/"meteor storm" -- an evenly-spaced row across the
  // full width, staggered so it reads as a wave to weave through rather than
  // an instant unfair line.
  fireMeteorWall(count) {
    const boss = this.boss;
    if (!boss.alive || !boss.spawnMeteor) return;
    const staggerMs = BOSS.mission4MeteorWall.staggerMs;
    for (let i = 0; i < count; i++) {
      const x = 30 + i * ((GAME_WIDTH - 60) / (count - 1 || 1));
      boss.scene.time.delayedCall(i * staggerMs, () => { if (boss.alive) boss.spawnMeteor(x, -40); });
    }
  }

  destroy() {
    this.cycle.destroy();
    if (this._bulletTimer) this._bulletTimer.remove(false);
    if (this._laserTimer) this._laserTimer.remove(false);
    for (const m of this.missiles) m.destroy();
    this.missiles = [];
    for (const m of this.mines) m.destroy();
    this.mines = [];
  }
}
