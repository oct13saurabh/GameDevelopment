import { BOSS } from '../../config.js';
import AttackCycle from './AttackCycle.js';
import EnemyMissile from './EnemyMissile.js';

// Mission 3 fire boss: a repeating cycle (same shape as Mission 1's) --
// Flame Breath (widening cone aimed at the player) -> pause -> Missile
// Barrage (a staggered volley of destroyable homing missiles, see
// EnemyMissile.js) -> pause -> Ember Ring (instant radial burst) -> pause ->
// Mine Barrage (a row of drifting mines, see Mine.js) -> repeat. Same attack
// shape across all phases; only window/pause tempo tightens per phase (see
// BOSS.mission3Cycle).
export default class Mission3Pattern {
  constructor(boss) {
    this.boss = boss;
    this._breathTimer = null;
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
    const d = BOSS.mission3Cycle[`phase${phase}`] || BOSS.mission3Cycle.phase1;
    const ringCount = phase === 3 ? BOSS.emberRing.count + 4 : BOSS.emberRing.count;
    return [
      {
        name: 'flameBreath', durationMs: d.flameBreath,
        onEnter: () => { this.boss.audio.bossTelegraph(); this.startFlameBreath(); },
        onExit: () => { if (this._breathTimer) { this._breathTimer.remove(false); this._breathTimer = null; } },
      },
      { name: 'pause1', durationMs: d.pause1 },
      {
        name: 'missileBarrage', durationMs: d.missileBarrage,
        onEnter: () => { this.boss.telegraphThenFire(() => this.fireMissiles()); },
      },
      { name: 'pause2', durationMs: d.pause2 },
      {
        name: 'emberRing', durationMs: d.emberRing,
        onEnter: () => this.fireEmberRing(ringCount),
      },
      { name: 'pause3', durationMs: d.pause3 },
      {
        name: 'mineDrop', durationMs: d.mineDrop,
        onEnter: () => { this.boss.telegraphThenFire(() => this.fireMineDrop()); },
      },
      { name: 'pause4', durationMs: d.pause4 },
    ];
  }

  // Sweeps a narrow cone of fire bullets back and forth across the aim
  // direction to the player, re-aiming each tick -- reads as a flame jet
  // tracking the player rather than a fixed static fan.
  startFlameBreath() {
    const boss = this.boss;
    if (!boss.alive) return;
    const cfg = BOSS.flameBreath;
    let step = 0;
    this._breathTimer = boss.scene.time.addEvent({
      delay: cfg.tickMs,
      loop: true,
      callback: () => {
        if (!boss.alive) return;
        const player = boss.scene.player;
        const baseAngle = player && player.alive
          ? Phaser.Math.RadToDeg(Phaser.Math.Angle.Between(boss.sprite.x, boss.sprite.y, player.sprite.x, player.sprite.y))
          : 90;
        const wobble = Math.sin(step * 0.5) * (cfg.coneDeg / 2);
        boss.bulletPool.fire(boss.sprite.x, boss.sprite.y + 20, baseAngle + wobble, cfg.bulletSpeed, {
          texture: 'enemy_bullet_2', damage: cfg.damage, scale: cfg.scale, blendMode: 'ADD',
        });
        step++;
      },
    });
    boss.audio.enemyShoot();
  }

  // Staggered volley of destroyable homing missiles launched from the boss --
  // each one dives at the player, curving left/right/down only (see
  // EnemyMissile.clampAngleDeg).
  fireMissiles() {
    const boss = this.boss;
    if (!boss.alive) return;
    const cfg = BOSS.missileBarrage;
    for (let i = 0; i < cfg.count; i++) {
      const delay = i * cfg.staggerMs;
      boss.scene.time.delayedCall(delay, () => {
        if (!boss.alive) return;
        this.missiles.push(new EnemyMissile(boss, boss.sprite.x, boss.sprite.y + 20, boss.scene.bossProjectileGroup));
      });
    }
    boss.audio.enemyShoot();
  }

  fireEmberRing(count) {
    const boss = this.boss;
    if (!boss.alive) return;
    const cfg = BOSS.emberRing;
    for (let i = 0; i < count; i++) {
      const angleDeg = (360 / count) * i;
      boss.bulletPool.fire(boss.sprite.x, boss.sprite.y, angleDeg, cfg.bulletSpeed, {
        texture: 'enemy_bullet_2', damage: cfg.damage, scale: cfg.scale, blendMode: 'ADD',
      });
    }
    boss.audio.enemyShoot();
  }

  // Same radial placement style as fireEmberRing (loop over evenly-spaced
  // angles around the boss) but skipping the wedge directly behind it (up,
  // away from the player) so mines never spawn somewhere the player will
  // never fly through, and stepped out with a short per-mine delay instead
  // of Ember Ring's all-at-once burst -- reads as a slow mine bloom rather
  // than an instant ring. A shot clears one outright (Mine.takeDamage,
  // hp: 1); left alone they drift down and blast the player on contact
  // (Mine.hitPlayer).
  fireMineDrop() {
    const boss = this.boss;
    if (!boss.alive || !boss.spawnMine) return;
    const cfg = BOSS.mine;
    const count = cfg.dropCount;
    const radius = 140;
    const staggerMs = 220;
    // 90deg = straight down (toward the player); span the arc around that,
    // leaving a 60deg gap centered on 270deg (straight up/behind the boss)
    // unused.
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

  destroy() {
    this.cycle.destroy();
    if (this._breathTimer) this._breathTimer.remove(false);
    for (const m of this.missiles) m.destroy();
    this.missiles = [];
    for (const m of this.mines) m.destroy();
    this.mines = [];
  }
}
