import { BOSS } from '../../config.js';
import AttackCycle from './AttackCycle.js';
import BossLaser from './BossLaser.js';

// Mission 5 end-of-mission boss: Twin Cannons -> pause -> Spread Shot ->
// pause -> Laser Charge+Fire -> pause -> repeat. Reuses Mission 1's twin
// cannon/spread tuning; the straight laser beam (bossPatterns/BossLaser.js)
// is this boss's own signature attack -- a real rendered beam locked onto
// the player's position at fire time, not a simulated bullet-sweep like
// Mission 1's laserSweep. See BOSS.mission5Cycle / BOSS.laserStraight in
// config.js.
export default class Mission5Pattern {
  constructor(boss) {
    this.boss = boss;
    this._twinTimer = null;
    this._spreadTimer = null;
    this.lasers = [];
    this._laserGlow = null;

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

    for (const l of this.lasers) l.update(time);
    this.lasers = this.lasers.filter((l) => l.alive);

    if (this._laserGlow) {
      this._laserGlow.setPosition(boss.sprite.x, boss.sprite.y + 20);
    }
  }

  buildStates(phase) {
    const d = BOSS.mission5Cycle[`phase${phase}`] || BOSS.mission5Cycle.phase1;
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
          this.fireSpread();
          this._spreadTimer = this.boss.scene.time.addEvent({ delay: BOSS.spreadShot.fireRateMs, loop: true, callback: () => this.fireSpread() });
        },
        onExit: () => { if (this._spreadTimer) { this._spreadTimer.remove(false); this._spreadTimer = null; } },
      },
      { name: 'pause2', durationMs: d.pause2 },
      {
        name: 'laser', durationMs: d.laser,
        onEnter: () => this.beginLaserAttack(),
      },
      { name: 'pause3', durationMs: d.pause3 },
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

  fireSpread() {
    const boss = this.boss;
    if (!boss.alive) return;
    const cfg = BOSS.spreadShot;
    const base = 90;
    const start = base - cfg.spreadDeg / 2;
    for (let i = 0; i < cfg.count; i++) {
      const angleDeg = start + (cfg.spreadDeg / (cfg.count - 1)) * i;
      boss.bulletPool.fire(boss.sprite.x, boss.sprite.y + 20, angleDeg, cfg.bulletSpeed, {
        texture: 'enemy_bullet_2', damage: cfg.damage, scale: cfg.scale,
      });
    }
    boss.audio.enemyShoot();
  }

  // Grows a small glow sprite at the muzzle during BOSS.telegraphMs (via
  // boss.telegraphThenFire's shared warning cue + delay), then fires the
  // locked-angle beam and fades the glow out.
  beginLaserAttack() {
    const boss = this.boss;
    if (!boss.alive) return;

    const cfg = BOSS.laserStraight;
    const glow = boss.scene.add.image(boss.sprite.x, boss.sprite.y + 20, 'laser_beam');
    glow.setOrigin(0.5, 0.5);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    glow.setTint(0x66ccff);
    glow.setDisplaySize(4, 4);
    glow.setAlpha(0.5);
    this._laserGlow = glow;

    boss.scene.tweens.add({
      targets: glow,
      displayWidth: cfg.glowMaxSize, displayHeight: cfg.glowMaxSize,
      alpha: 1,
      duration: BOSS.telegraphMs,
      ease: 'Cubic.easeIn',
    });

    boss.telegraphThenFire(() => this.fireStraightLaser());
  }

  fireStraightLaser() {
    const boss = this.boss;
    if (this._laserGlow) { this._laserGlow.destroy(); this._laserGlow = null; }
    if (!boss.alive) return;

    // Straight down, not aimed at the player -- dodge is sidestepping out of
    // the beam's column, not baiting an angle.
    this.lasers.push(new BossLaser(boss, 90));
  }

  destroy() {
    this.cycle.destroy();
    if (this._twinTimer) this._twinTimer.remove(false);
    if (this._spreadTimer) this._spreadTimer.remove(false);
    if (this._laserGlow) { this._laserGlow.destroy(); this._laserGlow = null; }
    for (const l of this.lasers) l.destroy();
    this.lasers = [];
  }
}
