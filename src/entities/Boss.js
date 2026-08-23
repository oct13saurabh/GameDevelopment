import { BOSS, GAME_WIDTH, ANIMATION } from '../config.js';
import { getMissionConfig } from '../missions/Missions.js';
import { createBossPattern } from './bossPatterns/index.js';

const ENTRY_Y = 120;

export default class Boss {
  constructor(scene, enemyBulletPool, juice, audio, spawnMinion, spriteGroup = null, missionHp = null, missionNumber = 1, spawnMine = null, spawnMeteor = null) {
    this.scene = scene;
    this.bulletPool = enemyBulletPool;
    this.juice = juice;
    this.audio = audio;
    this.spawnMinion = spawnMinion;
    this.spawnMine = spawnMine;
    this.spawnMeteor = spawnMeteor;

    this.hp = missionHp !== null ? missionHp : BOSS.hp;
    this.maxHp = this.hp;
    this.alive = true;
    // Death crumble frames (GameAssets/BossShip/.../Destroy), played in die()
    // once hp hits 0 -- 0 when this mission's boss has none yet (see
    // BootScene.bossDestroyFrameCount).
    this.destroyFrameCount = scene.registry.get('bossDestroyFrameCount') || 0;
    this.phase = 1;
    this.entering = true;
    this.telegraphing = false;

    // Per-mission phase-transition thresholds (fraction of maxHp at which
    // phase N+1 begins) and per-phase sweep speeds -- default to the
    // original hardcoded 3-phase shape; missions can override with more/
    // fewer phases (see Mission 4's 4-phase bossPhaseThresholds/bossSweepSpeeds
    // in missions/Missions.js) with no other Boss.js changes needed.
    const missionConfig = getMissionConfig(missionNumber);
    this.phaseThresholds = missionConfig.bossPhaseThresholds || [BOSS.phase2HpFraction, BOSS.phase3HpFraction];
    this.sweepSpeeds = missionConfig.bossSweepSpeeds || [70, 130, 170];

    this.pattern = createBossPattern(missionConfig.bossPattern, this);

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
    const sweepSpeed = this.sweepSpeeds[Math.min(this.phase - 1, this.sweepSpeeds.length - 1)];
    const margin = this.sprite.displayWidth / 2 + 10;
    if (this.sprite.x > GAME_WIDTH - margin) this.moveDir = -1;
    if (this.sprite.x < margin) this.moveDir = 1;
    this.sprite.body.setVelocityX(this.moveDir * sweepSpeed);

    // Phase transitions -- advances one phase per threshold crossed
    // (phaseThresholds[phase-1] is the fraction that ends the current phase).
    const nextThreshold = this.phaseThresholds[this.phase - 1];
    if (nextThreshold !== undefined && this.hp <= this.maxHp * nextThreshold) {
      this.phase++;
      this.scene.appEvents.emit('boss-phase-changed', this.phase);
    }

    this.pattern.update(time);
  }

  // Flashes the boss and plays a warning cue, then fires after
  // BOSS.telegraphMs so burst/missile attacks read as dodgeable reactions
  // instead of instant damage. Aimed shots stay un-telegraphed -- they're a
  // steady trickle, not a burst. Shared infra, called by pattern modules.
  telegraphThenFire(fireFn) {
    if (!this.alive) return;
    this.audio.bossTelegraph();
    this.scene.time.delayedCall(BOSS.telegraphMs, () => {
      if (this.alive) fireFn();
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
    this.audio.explosionBig();
    this.scene.appEvents.emit('boss-killed', this);
    // Falls with the original (undamaged) texture first -- Destroy/N.png
    // crumble frames crossfade in partway through the fall/shrink, then
    // BigBlast plays once it's fully faded away (see Juice.fallAndBlast).
    this.juice.fallAndBlast(this.sprite, {
      duration: ANIMATION.bossFallDurationMs, variant: 'large', scale: 2.2, count: 40,
      destroyKeyPrefix: 'ship_boss_destroy', destroyFrameCount: this.destroyFrameCount,
      onComplete: () => { this.juice.shake(500, 0.025); this.destroy(); },
    });
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
