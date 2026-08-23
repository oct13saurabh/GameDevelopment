import { ENEMY_TYPES, GAME_HEIGHT, ENEMY_ROTATION, CARRIER_PATTERNS } from '../config.js';
import AttackCycle from './bossPatterns/AttackCycle.js';

let idCounter = 0;

// Which Enemy method fires a given carrier attack-pattern family (tagged on
// the EnemyPowerUpDrop filename, see CARRIER_PATTERN_RE in BootScene.js).
const CARRIER_FIRE_METHODS = {
  blast: 'fireCarrierBlast',
  spread: 'fireCarrierSpread',
  burst: 'fireCarrierBurst',
  missle: 'fireCarrierMissle',
  homing: 'fireCarrierHoming',
  mine: 'fireCarrierMine',
};

// Mission 1's shared enemy model is rotated 180 degrees to face down (see
// below), which mirrors left/right as well as flipping up/down -- so the
// source "l" (left-bank) frames read as banking RIGHT once rotated, and vice
// versa. These thresholds swap in the frame that reads correctly on screen.
const BANK_SOFT_THRESHOLD = 30;
const BANK_HARD_THRESHOLD = 100;

// cfg.scale/hitboxRadius were tuned against the original 64x64 enemy_b_m
// source art. Newly-dropped-in designs (GE*.png etc) come from arbitrary
// source resolutions, so scale is normalized by actual texture pixel width
// instead of applied raw -- keeps on-screen size consistent regardless of
// how big the source PNG is.
const REFERENCE_SOURCE_SIZE = 64;
const SCALE_BOOST = 1.3; // slightly bigger than the raw cfg.scale target

export default class Enemy {
  // design: optional { banking: {m,l1,l2,r1,r2} } or { static: textureKey },
  // from GameScene's registry-driven EnemyShip pool (see BootScene). Falls
  // back to the type's configured base texture if no design is supplied
  // (e.g. pool not yet populated with art).
  constructor(scene, enemyBulletPool, juice, audio, typeKey, x, y, movementPattern = 'straight', spriteGroup = null, design = null, missionHp = null) {
    this.id = idCounter++;
    this.scene = scene;
    this.bulletPool = enemyBulletPool;
    this.juice = juice;
    this.audio = audio;
    this.typeKey = typeKey;
    this.cfg = ENEMY_TYPES[typeKey];
    this.design = design;
    this.movementPattern = movementPattern;
    this.isCarrier = this.cfg.alwaysDropsPowerUp || false;
    this.attackCycle = null;
    this.patternDone = false;
    this.retreating = false;
    this.rotationConfig = this.getRotationConfig();
    this.targetRotation = 0;
    this.spawnX = x;
    this.spawnTime = scene.time.now;
    this.hp = missionHp !== null ? missionHp : this.cfg.hp;
    this.alive = true;
    this.lastFired = scene.time.now + Phaser.Math.Between(0, this.cfg.fireRate);

    const baseTexture = design ? (design.banking ? design.banking.m : design.static) : this.cfg.texture;
    this.sprite = scene.physics.add.image(x, y, baseTexture);
    // Physics groups reset velocity to their (zero) defaults when a sprite is
    // added, so join the group BEFORE configuring body/velocity, not after.
    if (spriteGroup) spriteGroup.add(this.sprite);
    // Normalize applied scale against this texture's actual source width, so
    // a design's intended on-screen size (REFERENCE_SOURCE_SIZE * cfg.scale)
    // stays consistent no matter how large/small the source PNG is.
    const targetWidth = REFERENCE_SOURCE_SIZE * this.cfg.scale * SCALE_BOOST;
    this.appliedScale = targetWidth / this.sprite.width;
    this.sprite.setScale(this.appliedScale);
    // Tint is only a fallback for the shared placeholder texture (no custom
    // design available yet) -- real per-design art keeps its own colors.
    if (this.cfg.tint && !design) this.sprite.setTint(this.cfg.tint);
    // Arcade circle bodies auto-scale with the sprite, so the radius/offset
    // passed to setCircle must be in local (unscaled) units. hitboxRadius is
    // scaled by SCALE_BOOST too, so the collision circle grows along with
    // the enlarged sprite instead of reading tiny/pass-through against it.
    const localRadius = (this.cfg.hitboxRadius * SCALE_BOOST) / this.appliedScale;
    this.sprite.body.setCircle(
      localRadius,
      this.sprite.width / 2 - localRadius,
      this.sprite.height / 2 - localRadius
    );
    this.sprite.owner = this;
    this.sprite.body.setVelocityY(this.cfg.speed);

    if (this.isCarrier) {
      this.attackCycle = new AttackCycle(this.buildCarrierStates(design && design.pattern));
    }

    this.juice.spawnPop(this.sprite);
  }

  // Builds a non-looping AttackCycle: `count` reps of the tagged family, each
  // separated by CARRIER_PATTERNS.repeatIntervalMs, then a terminal 'done'
  // state (huge duration so it never actually loops back) that flags
  // patternDone -- updateCarrier() reads that flag to start the retreat.
  buildCarrierStates(patternMeta) {
    const family = (patternMeta && CARRIER_FIRE_METHODS[patternMeta.family]) ? patternMeta.family : CARRIER_PATTERNS.fallbackFamily;
    const count = (patternMeta && patternMeta.family === family && patternMeta.count) || CARRIER_PATTERNS.fallbackCount;
    const methodName = CARRIER_FIRE_METHODS[family];
    const states = [];
    for (let i = 0; i < count; i++) {
      states.push({
        name: `${family}_${i}`,
        durationMs: CARRIER_PATTERNS.repeatIntervalMs,
        onEnter: () => this[methodName](),
      });
    }
    states.push({ name: 'done', durationMs: 1e9, onEnter: () => { this.patternDone = true; } });
    return states;
  }

  update(time, dt) {
    if (!this.alive) return;

    if (this.stunnedUntil && time < this.stunnedUntil) {
      this.sprite.body.setVelocity(0, 0);
      return;
    }

    if (this.isCarrier) {
      this.updateCarrier(time);
      return;
    }

    const t = (time - this.spawnTime) / 1000;
    const body = this.sprite.body;
    // Re-assert fall speed every frame (cheap, no-op when unstunned) since a
    // prior EMP stun zeroes vy and nothing else in this method ever resets it.
    body.setVelocityY(this.cfg.speed);

    if (this.movementPattern === 'sine') {
      body.setVelocityX(Math.sin(t * 2.5) * 120);
    } else if (this.movementPattern === 'weave') {
      body.setVelocityX(Math.cos(t * 1.8) * 90);
    }

    this.updateBankFrame(body.velocity.x);

    if (this.sprite.y > GAME_HEIGHT + 60) {
      this.destroy();
      return;
    }

    const stunned = this.stunnedUntil && time < this.stunnedUntil;
    if (!stunned && time - this.lastFired > this.cfg.fireRate && this.sprite.y > 0 && this.sprite.y < GAME_HEIGHT - 40) {
      this.fire(time);
    }
  }

  // Carriers skip the generic fall/fireRate loop above: they run their
  // filename-tagged AttackCycle while on screen, then retreat back off the
  // top once the pattern finishes (or CARRIER_PATTERNS.lifespanMs is hit)
  // instead of just falling off the bottom.
  updateCarrier(time) {
    const body = this.sprite.body;
    const onScreen = this.sprite.y > 0 && this.sprite.y < GAME_HEIGHT - 40;

    if (!this.retreating) {
      if (this.patternDone || time - this.spawnTime > CARRIER_PATTERNS.lifespanMs) {
        this.retreating = true;
      } else if (onScreen) {
        this.attackCycle.update(time);
      }
    }

    const t = (time - this.spawnTime) / 1000;
    body.setVelocityY(this.retreating ? -Math.abs(this.cfg.speed) * 1.5 : this.cfg.speed);

    if (this.movementPattern === 'sine') {
      body.setVelocityX(Math.sin(t * 2.5) * 120);
    } else if (this.movementPattern === 'weave') {
      body.setVelocityX(Math.cos(t * 1.8) * 90);
    }

    this.updateBankFrame(body.velocity.x);

    if (this.retreating && this.sprite.y < -60) {
      this.destroy();
    } else if (!this.retreating && this.sprite.y > GAME_HEIGHT + 60) {
      this.destroy();
    }
  }

  getRotationConfig() {
    if (this.isCarrier) return ENEMY_ROTATION.carrier;
    if (!this.design || !this.design.sourceFolder) return ENEMY_ROTATION.defaultShip;
    const isMission = this.design.sourceFolder.startsWith('Mission');
    return isMission ? ENEMY_ROTATION.missionShip : ENEMY_ROTATION.defaultShip;
  }

  updateBankFrame(vx) {
    if (!this.design || !this.design.banking) return; // static designs don't swap frames

    let direction;
    if (vx <= -BANK_HARD_THRESHOLD) direction = 'hardLeft';
    else if (vx <= -BANK_SOFT_THRESHOLD) direction = 'softLeft';
    else if (vx >= BANK_HARD_THRESHOLD) direction = 'hardRight';
    else if (vx >= BANK_SOFT_THRESHOLD) direction = 'softRight';
    else direction = 'straight';

    const FRAME_BY_DIRECTION = {
      hardLeft: this.design.banking.r2,
      softLeft: this.design.banking.r1,
      straight: this.design.banking.m,
      softRight: this.design.banking.l1,
      hardRight: this.design.banking.l2,
    };
    const frame = FRAME_BY_DIRECTION[direction];
    if (frame !== this.currentBankFrame) {
      this.currentBankFrame = frame;
      this.sprite.setTexture(frame);
    }
  }

  aimAngleDeg() {
    const player = this.scene.player;
    if (player && player.alive) {
      return Phaser.Math.RadToDeg(
        Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, player.sprite.x, player.sprite.y)
      );
    }
    return 90;
  }

  // Rotates/tweens the sprite toward targetAngleDeg (clamped to this enemy's
  // rotationConfig limit) and returns the clamped angle, so callers fire
  // along the same direction the sprite is actually facing.
  applyRotation(targetAngleDeg) {
    const cfg = this.rotationConfig;
    const clampedAngle = this.clampAngleToRotationLimit(targetAngleDeg, cfg.maxRotationDegFromDown);
    this.targetRotation = Phaser.Math.DegToRad(clampedAngle - 90);

    if (cfg.tweenDurationMs > 0) {
      this.scene.tweens.add({
        targets: this.sprite,
        rotation: this.targetRotation,
        duration: cfg.tweenDurationMs,
        ease: 'Quad.easeOut',
      });
    } else {
      this.sprite.setRotation(this.targetRotation);
    }
    return clampedAngle;
  }

  fire(time) {
    this.lastFired = time;
    const targetAngleDeg = this.aimAngleDeg();
    const cfg = this.rotationConfig;
    const clampedAngle = this.applyRotation(targetAngleDeg);

    // Only fire if target is within the fire cone and passes fireChance check.
    if (this.isAngleWithinCone(targetAngleDeg, cfg.fireConeDegHalf)) {
      const fireChance = cfg.fireChance !== undefined ? cfg.fireChance : 1.0;
      if (Math.random() < fireChance) {
        this.bulletPool.fire(this.sprite.x, this.sprite.y + 10, clampedAngle, this.cfg.bulletSpeed, {
          texture: 'bullet_enemy',
          damage: 10,
          scale: 0.4,
        });
        this.audio.enemyShoot();
      }
    }
  }

  // -- Carrier attack-pattern families (see CARRIER_FIRE_METHODS / buildCarrierStates) --

  fireCarrierBlast() {
    if (!this.alive) return;
    this.applyRotation(this.aimAngleDeg());
    const cfg = CARRIER_PATTERNS.blast;
    for (let i = 0; i < cfg.bulletCount; i++) {
      const angleDeg = (360 / cfg.bulletCount) * i;
      this.bulletPool.fire(this.sprite.x, this.sprite.y, angleDeg, cfg.bulletSpeed, {
        texture: cfg.texture, damage: cfg.damage, scale: cfg.scale,
      });
    }
    this.audio.enemyShoot();
  }

  fireCarrierSpread() {
    if (!this.alive) return;
    const center = this.applyRotation(this.aimAngleDeg());
    const cfg = CARRIER_PATTERNS.spread;
    const start = center - cfg.spreadDeg / 2;
    for (let i = 0; i < cfg.bulletCount; i++) {
      const angleDeg = cfg.bulletCount > 1 ? start + (cfg.spreadDeg / (cfg.bulletCount - 1)) * i : center;
      this.bulletPool.fire(this.sprite.x, this.sprite.y, angleDeg, cfg.bulletSpeed, {
        texture: cfg.texture, damage: cfg.damage, scale: cfg.scale,
      });
    }
    this.audio.enemyShoot();
  }

  fireCarrierBurst() {
    const cfg = CARRIER_PATTERNS.burst;
    for (let i = 0; i < cfg.shotCount; i++) {
      this.scene.time.delayedCall(i * cfg.shotIntervalMs, () => {
        if (!this.alive) return;
        const angleDeg = this.applyRotation(this.aimAngleDeg());
        this.bulletPool.fire(this.sprite.x, this.sprite.y, angleDeg, cfg.bulletSpeed, {
          texture: cfg.texture, damage: cfg.damage, scale: cfg.scale,
        });
        this.audio.enemyShoot();
      });
    }
  }

  // Straight, high-speed, non-homing -- one shot from each wing.
  fireCarrierMissle() {
    if (!this.alive) return;
    const angleDeg = this.applyRotation(this.aimAngleDeg());
    const cfg = CARRIER_PATTERNS.missle;
    this.bulletPool.fire(this.sprite.x - cfg.wingOffset, this.sprite.y, angleDeg, cfg.bulletSpeed, {
      texture: cfg.texture, damage: cfg.damage, scale: cfg.scale,
    });
    this.bulletPool.fire(this.sprite.x + cfg.wingOffset, this.sprite.y, angleDeg, cfg.bulletSpeed, {
      texture: cfg.texture, damage: cfg.damage, scale: cfg.scale,
    });
    this.audio.enemyShoot();
  }

  // Reuses the boss hazard entity (bossPatterns/EnemyMissile.js) via
  // GameScene.spawnEnemyMissile -- it self-tracks/updates/collides through
  // scene.hazards, no extra bookkeeping needed here.
  fireCarrierHoming() {
    if (!this.alive || !this.scene.spawnEnemyMissile) return;
    this.applyRotation(this.aimAngleDeg());
    const cfg = CARRIER_PATTERNS.homing;
    for (let i = 0; i < cfg.missileCount; i++) {
      this.scene.time.delayedCall(i * 200, () => {
        if (!this.alive) return;
        this.scene.spawnEnemyMissile(this.sprite.x, this.sprite.y + 10);
      });
    }
    this.audio.enemyShoot();
  }

  // Radial mine spread below the carrier, same placement math as
  // Mission4Pattern.fireMineDrop. Reuses GameScene.spawnMine (self-tracked
  // via scene.hazards), no extra bookkeeping needed here.
  fireCarrierMine() {
    if (!this.alive || !this.scene.spawnMine) return;
    const cfg = CARRIER_PATTERNS.mine;
    const startDeg = 90 - cfg.spanDeg / 2;
    const stepDeg = cfg.mineCount > 1 ? cfg.spanDeg / (cfg.mineCount - 1) : 0;
    for (let i = 0; i < cfg.mineCount; i++) {
      const angleDeg = startDeg + stepDeg * i;
      const angleRad = Phaser.Math.DegToRad(angleDeg);
      this.scene.time.delayedCall(i * 150, () => {
        if (!this.alive) return;
        const x = this.sprite.x + Math.cos(angleRad) * cfg.radius;
        const y = this.sprite.y + Math.sin(angleRad) * cfg.radius;
        this.scene.spawnMine(x, y);
      });
    }
  }

  clampAngleToRotationLimit(angleDeg, maxRotationDeg) {
    if (maxRotationDeg >= 180) return angleDeg; // unrestricted
    const downDeg = 90;
    const diff = angleDeg - downDeg;
    const clamped = Phaser.Math.Clamp(diff, -maxRotationDeg, maxRotationDeg);
    return downDeg + clamped;
  }

  isAngleWithinCone(angleDeg, coneHalfDeg) {
    if (coneHalfDeg >= 180) return true; // unrestricted
    const downDeg = 90;
    const diff = Math.abs(angleDeg - downDeg);
    return diff <= coneHalfDeg;
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp -= amount;
    this.juice.flashSprite(this.sprite, 0xffffff, 60);
    if (this.hp <= 0) {
      this.die();
    }
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.juice.explosion(this.sprite.x, this.sprite.y, { scale: 0.8 });
    this.audio.explosionSmall();
    this.scene.appEvents.emit('enemy-killed', this);
    this.destroy();
  }

  destroy() {
    this.alive = false;
    if (this.attackCycle) {
      this.attackCycle.destroy();
      this.attackCycle = null;
    }
    if (this.sprite) {
      this.sprite.owner = null;
      this.sprite.destroy();
      this.sprite = null;
    }
  }
}
