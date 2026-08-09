import { BOSS } from '../../config.js';
import AttackCycle from './AttackCycle.js';
import Drone from './Drone.js';

// Mission 2 boss attack pattern -- a "hive" boss with 4 distinct HP-phase
// cycles (each alternating a pair of named attacks with pauses), plus
// destroyable minions (Drones) that create a target-priority choice on top
// of straight bullet-dodging. Phase 4 drops the toggle structure for one
// fixed sequence through every pattern, ~25% faster than phases 1-3.
export default class Mission2Pattern {
  constructor(boss) {
    this.boss = boss;
    this.drones = [];
    this._plasmaTimer = null;
    this._backgroundDroneTimer = null;
    this._sporeRotation = 0;

    this.cycles = {
      1: new AttackCycle(this.buildPhase1States()),
      2: new AttackCycle(this.buildPhase2States()),
      3: new AttackCycle(this.buildPhase3States()),
      4: new AttackCycle(this.buildPhase4States()),
    };
    this._lastPhase = boss.phase;
    if (boss.phase === 3) this.startBackgroundDroneLaunches();
  }

  update(time) {
    const boss = this.boss;
    if (boss.phase !== this._lastPhase) {
      this.cycles[this._lastPhase].destroy();
      this._lastPhase = boss.phase;
      this.cycles[boss.phase].reset();
      if (boss.phase === 3) this.startBackgroundDroneLaunches();
      else this.stopBackgroundDroneLaunches();
    }
    this.cycles[boss.phase].update(time);

    for (const d of this.drones) d.update(time);
    this.drones = this.drones.filter((d) => d.alive);
  }

  // Phase 1 (100-75%): Triple Plasma Burst <-> Drone Launch (2 drones).
  buildPhase1States() {
    const d = BOSS.mission2Cycle.phase1;
    return [
      { name: 'plasmaBurst', durationMs: d.plasmaBurst, onEnter: () => this.firePlasmaBurstSequence() },
      { name: 'pauseA', durationMs: d.pauseA },
      { name: 'droneLaunch', durationMs: d.droneLaunch, onEnter: () => this.launchDrones(BOSS.drone.flankOffsets2) },
      { name: 'pauseB', durationMs: d.pauseB },
    ];
  }

  // Phase 2 (75-50%): Drone Launch (4 drones) <-> Triple Plasma Burst
  // (reused from phase 1) -- was toggled with Acid Spread, removed for the
  // same reason as phase 3's Hive Missiles (see buildPhase3States comment).
  buildPhase2States() {
    const d = BOSS.mission2Cycle.phase2;
    return [
      { name: 'droneLaunch', durationMs: d.droneLaunch, onEnter: () => this.launchDrones(BOSS.drone.flankOffsets4) },
      { name: 'pauseA', durationMs: d.pauseA },
      { name: 'plasmaBurst', durationMs: d.plasmaBurst, onEnter: () => this.firePlasmaBurstSequence() },
      { name: 'pauseB', durationMs: d.pauseB },
    ];
  }

  // Phase 3 (50-25%): two Rotating Spore Burst volleys (rotation keeps
  // advancing between them) instead of alternating with Hive Missiles --
  // removed, the homing-missile shape didn't read as a threat. Drones keep
  // spawning in the background on a separate timer (see start/stop below),
  // not as a cycle state.
  buildPhase3States() {
    const d = BOSS.mission2Cycle.phase3;
    return [
      { name: 'sporeBurstA', durationMs: d.hiveMissiles, onEnter: () => this.fireRotatingSporeBurst() },
      { name: 'pauseA', durationMs: d.pauseA },
      { name: 'sporeBurstB', durationMs: d.sporeBurst, onEnter: () => this.fireRotatingSporeBurst() },
      { name: 'pauseB', durationMs: d.pauseB },
    ];
  }

  // Phase 4 (25-0%): fixed non-toggling sequence through every remaining
  // pattern (Acid Spread dropped, same as phases 2/3), durations pre-scaled
  // ~25% faster than phases 1-3's average tempo.
  buildPhase4States() {
    const d = BOSS.mission2Cycle.phase4;
    return [
      { name: 'droneLaunch4', durationMs: d.droneLaunch4, onEnter: () => this.launchDrones(BOSS.drone.flankOffsets4) },
      { name: 'pause1', durationMs: d.pauseBetween },
      { name: 'plasmaBurst', durationMs: d.plasmaBurst, onEnter: () => this.firePlasmaBurstSequence() },
      { name: 'pause2', durationMs: d.pauseBetween },
      { name: 'sporeBurstA', durationMs: d.hiveMissiles, onEnter: () => this.fireRotatingSporeBurst() },
      { name: 'pause3', durationMs: d.pauseBetween },
      { name: 'sporeBurst', durationMs: d.sporeBurst, onEnter: () => this.fireRotatingSporeBurst() },
      { name: 'pause4', durationMs: d.pauseBetween },
    ];
  }

  // --- attack implementations ---

  firePlasmaBurstSequence() {
    const boss = this.boss;
    if (!boss.alive) return;
    const cfg = BOSS.plasmaBurst;
    if (this._plasmaTimer) this._plasmaTimer.remove(false);
    this.firePlasmaVolley();
    this._plasmaTimer = boss.scene.time.addEvent({
      delay: cfg.volleyIntervalMs,
      repeat: cfg.volleys - 2, // first volley already fired above
      callback: () => this.firePlasmaVolley(),
    });
  }

  firePlasmaVolley() {
    const boss = this.boss;
    if (!boss.alive) return;
    const cfg = BOSS.plasmaBurst;
    const base = 90;
    const start = base - cfg.spreadDeg / 2;
    for (let i = 0; i < cfg.bulletsPerVolley; i++) {
      const angleDeg = cfg.bulletsPerVolley === 1 ? base : start + (cfg.spreadDeg / (cfg.bulletsPerVolley - 1)) * i;
      boss.bulletPool.fire(boss.sprite.x, boss.sprite.y + 20, angleDeg, cfg.bulletSpeed, {
        texture: 'enemy_bullet_2', damage: cfg.damage, scale: cfg.scale,
      });
    }
    boss.audio.enemyShoot();
  }

  launchDrones(offsets) {
    const boss = this.boss;
    if (!boss.alive) return;
    for (const d of this.drones) d.destroy();
    this.drones = offsets.map(([ox, oy]) => new Drone(boss, ox, oy, boss.scene.enemySpriteGroup));
  }

  fireRotatingSporeBurst() {
    const boss = this.boss;
    if (!boss.alive) return;
    const cfg = BOSS.sporeBurst;
    this._sporeRotation = (this._sporeRotation + cfg.rotateStepDeg) % 360;
    for (let i = 0; i < cfg.count; i++) {
      const angleDeg = (360 / cfg.count) * i + this._sporeRotation;
      boss.bulletPool.fire(boss.sprite.x, boss.sprite.y, angleDeg, cfg.bulletSpeed, {
        texture: 'enemy_bullet_2', damage: cfg.damage, scale: cfg.scale,
      });
    }
    boss.audio.enemyShoot();
  }

  startBackgroundDroneLaunches() {
    if (this._backgroundDroneTimer) return;
    this._backgroundDroneTimer = this.boss.scene.time.addEvent({
      delay: BOSS.mission2Cycle.phase3BackgroundDroneIntervalMs,
      loop: true,
      callback: () => this.launchDrones(BOSS.drone.flankOffsets2),
    });
  }

  stopBackgroundDroneLaunches() {
    if (this._backgroundDroneTimer) {
      this._backgroundDroneTimer.remove(false);
      this._backgroundDroneTimer = null;
    }
  }

  destroy() {
    Object.values(this.cycles).forEach((c) => c.destroy());
    this.stopBackgroundDroneLaunches();
    if (this._plasmaTimer) this._plasmaTimer.remove(false);
    for (const d of this.drones) d.destroy();
    this.drones = [];
  }
}
