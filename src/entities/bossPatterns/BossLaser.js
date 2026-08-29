import { BOSS } from '../../config.js';

// Mission 5 boss's straight laser beam: a rendered beam sprite (laser_beam
// texture) held at a fixed angle (straight down, not aimed at the player --
// see Mission5Pattern.fireStraightLaser) for cfg.durationMs. Unlike
// bulletPool-based attacks, this is a single persistent entity with
// continuous hit-testing (throttled by cfg.tickMs) rather than discrete
// projectiles -- collision is a manual point-to-segment distance check
// against the player, not Arcade physics overlap, since Arcade bodies don't
// rotate with a sprite's visual angle.
export default class BossLaser {
  constructor(boss, angleDeg, cfg = BOSS.laserStraight) {
    this.boss = boss;
    this.scene = boss.scene;
    this.cfg = cfg;
    this.alive = true;
    this.angleDeg = angleDeg;
    this.spawnTime = this.scene.time.now;
    this._lastDamageTime = -Infinity;

    const muzzleX = boss.sprite.x;
    const muzzleY = boss.sprite.y + 20;
    this.originX = muzzleX;
    this.originY = muzzleY;

    // Art's default orientation already points "down" from a top-anchored
    // origin (tip at the anchor, starburst at the far end) -- angleDeg 90
    // (straight down, matching bulletPool's fire-angle convention) needs 0
    // extra rotation, so the sprite offset is angleDeg - 90.
    this.sprite = this.scene.add.image(muzzleX, muzzleY, 'laser_beam');
    this.sprite.setOrigin(0.5, 0);
    this.sprite.setAngle(angleDeg - 90);
    this.sprite.setDisplaySize(cfg.beamWidth, cfg.beamLength);
    this.sprite.setBlendMode(Phaser.BlendModes.ADD);
    this.sprite.setAlpha(0);
    this.scene.tweens.add({ targets: this.sprite, alpha: 1, duration: 80 });

    this.boss.audio.enemyShoot();
  }

  update(time) {
    if (!this.alive) return;
    if (time - this.spawnTime >= this.cfg.durationMs) {
      this.destroy();
      return;
    }

    // Beam tracks the boss's muzzle (boss keeps sweeping while it fires) but
    // holds its locked angle -- only the origin point moves.
    this.originX = this.boss.sprite.x;
    this.originY = this.boss.sprite.y + 20;
    this.sprite.setPosition(this.originX, this.originY);

    if (time - this._lastDamageTime >= this.cfg.tickMs) {
      this._lastDamageTime = time;
      this.checkPlayerHit();
    }
  }

  // Perpendicular distance from the player to the beam's infinite ray,
  // clamped to hits within [0, beamLength] along the ray so a player behind
  // the boss (never happens in practice, but) doesn't get hit.
  checkPlayerHit() {
    const player = this.scene.player;
    if (!player || !player.alive || player.invulnerable) return;

    const rad = Phaser.Math.DegToRad(this.angleDeg);
    const dirX = Math.cos(rad);
    const dirY = Math.sin(rad);

    const px = player.sprite.x - this.originX;
    const py = player.sprite.y - this.originY;
    const along = px * dirX + py * dirY;
    if (along < 0 || along > this.cfg.beamLength) return;

    const perpX = px - dirX * along;
    const perpY = py - dirY * along;
    const dist = Math.sqrt(perpX * perpX + perpY * perpY);
    if (dist <= this.cfg.beamWidth / 2) {
      // Instant-kill on touch (loses a life), not chip damage -- the beam
      // is a hard "don't stand here" hazard, not a DPS check. Uses
      // killInstantly() rather than takeDamage(player.health) -- the latter
      // still runs through diffCfg.damageTakenMult, which is < 1 on Kids/
      // Adaptive difficulty and would scale a "lethal" hit down to survivable.
      player.killInstantly();
    }
  }

  destroy() {
    if (!this.alive) return;
    this.alive = false;
    if (this.sprite) {
      this.scene.tweens.add({
        targets: this.sprite, alpha: 0, duration: 120,
        onComplete: () => { if (this.sprite) { this.sprite.destroy(); this.sprite = null; } },
      });
    }
  }
}
