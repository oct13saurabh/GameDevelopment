import { ENEMY_TYPES, GAME_HEIGHT } from '../config.js';

let idCounter = 0;

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
  constructor(scene, enemyBulletPool, juice, audio, typeKey, x, y, movementPattern = 'straight', spriteGroup = null, design = null) {
    this.id = idCounter++;
    this.scene = scene;
    this.bulletPool = enemyBulletPool;
    this.juice = juice;
    this.audio = audio;
    this.typeKey = typeKey;
    this.cfg = ENEMY_TYPES[typeKey];
    this.design = design;
    this.movementPattern = movementPattern;
    this.spawnX = x;
    this.spawnTime = scene.time.now;
    this.hp = this.cfg.hp;
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
    this.sprite.setRotation(Math.PI); // ships face "up" by default art; enemies face down
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

    this.juice.spawnPop(this.sprite);
  }

  update(time, dt) {
    if (!this.alive) return;

    if (this.stunnedUntil && time < this.stunnedUntil) {
      this.sprite.body.setVelocity(0, 0);
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

  fire(time) {
    this.lastFired = time;
    const player = this.scene.player;
    let angleDeg = 90; // straight down by default
    if (player && player.alive) {
      angleDeg = Phaser.Math.RadToDeg(
        Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, player.sprite.x, player.sprite.y)
      );
    }
    this.bulletPool.fire(this.sprite.x, this.sprite.y + 10, angleDeg, this.cfg.bulletSpeed, {
      texture: 'bullet_enemy',
      damage: 10,
      scale: 0.4,
    });
    this.audio.enemyShoot();
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
    if (this.sprite) {
      this.sprite.owner = null;
      this.sprite.destroy();
      this.sprite = null;
    }
  }
}
