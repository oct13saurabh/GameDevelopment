// Screen shake, hit-flash, and particle explosion helpers shared across entities.
import { ANIMATION } from '../config.js';

export default class Juice {
  constructor(scene) {
    this.scene = scene;
  }

  shake(duration = 150, intensity = 0.01) {
    this.scene.cameras.main.shake(duration, intensity);
  }

  flashSprite(sprite, color = 0xffffff, duration = 80) {
    if (!sprite || !sprite.active) return;
    sprite.setTintFill ? sprite.setTintFill(color) : sprite.setTint(color);
    this.scene.time.delayedCall(duration, () => {
      if (sprite.active) sprite.clearTint();
    });
  }

  // Dissolves the sprite from its current texture into `textureKey`: a
  // temporary overlay sprite holding the NEW frame fades in on top (alpha
  // 0->1) while tracking the base sprite's position every tick, then the
  // base sprite swaps to the new texture underneath and the overlay is
  // dropped. A straight setTexture (even masked by a flicker) still reads as
  // two unrelated static images cutting between each other -- an actual
  // cross-blend is what sells discrete Destroy/N.png stills as one
  // deteriorating hull instead of a slideshow.
  crossfadeTexture(sprite, textureKey, { duration = 220 } = {}) {
    if (!sprite || !sprite.active) return;
    const overlay = this.scene.add.image(sprite.x, sprite.y, textureKey)
      .setScale(sprite.scaleX, sprite.scaleY)
      .setRotation(sprite.rotation)
      .setDepth((sprite.depth || 0) + 1)
      .setAlpha(0);
    // Track scale too, not just position -- the base sprite is usually mid a
    // fall tween that keeps shrinking it every tick. If the overlay held a
    // fixed size for the whole fade window, the final swap would snap the
    // sprite back to that stale (too-large) size instead of the tween's
    // current true size, reading as a size "pop" on every frame swap.
    const track = () => {
      if (!overlay.active) return;
      if (!sprite.active) { overlay.destroy(); return; }
      overlay.x = sprite.x;
      overlay.y = sprite.y;
      overlay.rotation = sprite.rotation;
      overlay.setScale(sprite.scaleX, sprite.scaleY);
    };
    this.scene.events.on('update', track);
    this.scene.tweens.add({
      targets: overlay,
      alpha: 1,
      duration,
      onComplete: () => {
        this.scene.events.off('update', track);
        if (sprite.active) {
          const scaleX = sprite.scaleX;
          const scaleY = sprite.scaleY;
          sprite.setTexture(textureKey);
          sprite.setScale(scaleX, scaleY);
        }
        overlay.destroy();
      },
    });
  }

  explosion(x, y, { scale = 1, tint = [0xffcc66, 0xff5522, 0x552222], count = 18, variant = 'small' } = {}) {
    const emitter = this.scene.add.particles(x, y, 'particle_soft', {
      speed: { min: 60 * scale, max: 220 * scale },
      angle: { min: 0, max: 360 },
      scale: { start: 0.9 * scale, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 250, max: 500 },
      quantity: count,
      tint,
      blendMode: 'ADD',
      emitting: false,
    });
    emitter.explode(count);
    this.scene.time.delayedCall(600, () => emitter.destroy());

    this.explosionSprite(x, y, { scale, variant });
  }

  // Stricken-aircraft death for large objects (Train, Boss): disables the
  // physics body (and collision entirely, belt-and-suspenders), then over
  // `duration` the sprite drops straight down and shrinks -- no rotation,
  // just a slow controlled sink into the distance -- trailing smoke/fire and
  // popping off small secondary explosions, before the final big blast at
  // impact. The sprite falls with its ORIGINAL (undamaged) texture at first;
  // once it's partway through shrinking, `destroyKeyPrefix`'s Destroy/N.png
  // crumble frames crossfade in on the same falling sprite (still shrinking/
  // darkening), so the hull visibly breaks apart mid-fall rather than before
  // the fall starts. Omit destroyKeyPrefix/destroyFrameCount to skip straight
  // to BigBlast with no crumble stage.
  fallAndBlast(sprite, { duration = 3000, variant = 'large', scale = 2.2, count = 40, destroyKeyPrefix = null, destroyFrameCount = 0, onComplete } = {}) {
    if (sprite.body) {
      sprite.body.enable = false;
      sprite.body.checkCollision.none = true;
    }
    const fallDistance = 90 + scale * 45;
    const startScaleX = sprite.scaleX;
    const startScaleY = sprite.scaleY;

    if (destroyKeyPrefix && destroyFrameCount > 0) {
      // Starts once the shrink is clearly underway, not at the first frame of
      // the fall -- that would look identical to falling with no crumble at all.
      this.scene.time.delayedCall(duration * ANIMATION.destroyStageStartFraction, () => {
        if (!sprite.active) return;
        this.playFrameSequence(sprite, destroyKeyPrefix, {
          from: 1, to: destroyFrameCount, frameMs: ANIMATION.destroyFrameMs, crossfade: true,
        });
      });
    }

    this.scene.tweens.add({
      targets: sprite,
      y: sprite.y + fallDistance,
      scaleX: startScaleX * 0.35,
      scaleY: startScaleY * 0.35,
      duration,
      // Cubic.easeIn = slow start, accelerating fall -- reads as gravity
      // pulling it down/away rather than a constant-speed slide.
      ease: 'Cubic.easeIn',
      onUpdate: (tween) => {
        // Darken toward the smoke/distance haze as it falls -- a plain scale
        // shrink alone reads as "getting smaller in place", not "falling away".
        const shade = Math.round(255 - tween.progress * 140);
        sprite.setTint(Phaser.Display.Color.GetColor(shade, shade, shade));
      },
      onComplete: () => {
        smokeEmitter.stop();
        this.scene.time.delayedCall(500, () => smokeEmitter.destroy());
        puffTimer.remove(false);
        this.explosion(sprite.x, sprite.y, { scale, variant, count });
        // Size BigBlast off the sprite's actual on-screen size at the moment
        // it vanishes (already shrunk by the fall tween above), not the
        // original pre-fall `scale` -- otherwise the finisher blooms back up
        // to full size right as the tiny, falling-into-the-distance ship
        // disappears, breaking the depth illusion.
        this.playFrameSequence(null, 'bigblast', {
          to: 5, frameMs: ANIMATION.bigBlastFrameMs, x: sprite.x, y: sprite.y,
          size: sprite.displayWidth * 1.4,
        });
        if (onComplete) onComplete();
      },
    });

    // Dark smoke + orange fire trail while it falls.
    const smokeEmitter = this.scene.add.particles(0, 0, 'particle_soft', {
      speed: { min: 10, max: 45 },
      angle: { min: 60, max: 120 },
      scale: { start: 0.55 * scale, end: 0 },
      alpha: { start: 0.55, end: 0 },
      lifespan: { min: 400, max: 750 },
      frequency: 55,
      tint: [0x333333, 0x555555, 0xff7733],
      follow: sprite,
    });

    // Secondary hull-breach puffs at irregular intervals during the fall.
    const puffTimer = this.scene.time.addEvent({
      delay: 260,
      loop: true,
      callback: () => {
        if (!sprite.active) return;
        this.explosion(sprite.x + Phaser.Math.Between(-18, 18), sprite.y + Phaser.Math.Between(-12, 12), {
          scale: scale * 0.35, count: Math.round(count * 0.25), variant: 'small',
        });
      },
    });
  }

  // Generic setTexture-per-tick flipbook, driven by plain numbered image
  // frames (keyPrefix_1..keyPrefix_N) rather than a Phaser spritesheet anim --
  // used for both leftover Destroy-stage frames (played on the dying sprite
  // itself, `sprite` passed in) and the shared BigBlast finisher (spawns its
  // own standalone sprite at x,y when `sprite` is omitted, self-destroying
  // once done).
  playFrameSequence(sprite, keyPrefix, { from = 1, to, frameMs = 100, x = 0, y = 0, scale = 1, size = null, crossfade = false, onComplete } = {}) {
    const ownSprite = !sprite;
    const target = sprite || this.scene.add.sprite(x, y, `${keyPrefix}_${from}`).setBlendMode('ADD');
    if (ownSprite) {
      // `size` (a target display width) sizes relative to the death moment
      // (e.g. the fallen ship's final shrunk size) instead of a fixed scale
      // multiplier on the raw source frame.
      if (size) target.setDisplaySize(size, size * (target.height / target.width));
      else target.setScale(scale);
    }
    // Reused sprite's Destroy/BigBlast source frames are raw art, not baked to
    // the entity's on-screen size -- setTexture alone swaps in whatever native
    // resolution that frame has, so lock the sprite back to its pre-swap
    // display size every frame or it balloons huge for the frame's duration.
    const lockedWidth = sprite ? sprite.displayWidth : null;
    const lockedHeight = sprite ? sprite.displayHeight : null;
    // Crossfade duration must fit inside frameMs or the next frame's swap
    // would interrupt an in-flight blend.
    const fadeMs = Math.min(frameMs * 0.8, 220);
    if (sprite) {
      if (crossfade) this.crossfadeTexture(sprite, `${keyPrefix}_${from}`, { duration: fadeMs });
      else {
        sprite.setTexture(`${keyPrefix}_${from}`);
        sprite.setDisplaySize(lockedWidth, lockedHeight);
      }
    }
    let frame = from;
    const step = () => {
      if (!target.active) return;
      frame += 1;
      if (frame > to) {
        if (ownSprite) target.destroy();
        if (onComplete) onComplete();
        return;
      }
      if (!ownSprite && crossfade) {
        this.crossfadeTexture(target, `${keyPrefix}_${frame}`, { duration: fadeMs });
        this.scene.time.delayedCall(frameMs, step);
        return;
      }
      target.setTexture(`${keyPrefix}_${frame}`);
      if (!ownSprite) target.setDisplaySize(lockedWidth, lockedHeight);
      this.scene.time.delayedCall(frameMs, step);
    };
    this.scene.time.delayedCall(frameMs, step);
  }

  // Plays one of the SpaceRage explosion frame-animations at (x, y), then
  // self-destroys. 'small' for enemies/meteors, 'medium' for the player,
  // 'large' for the boss.
  explosionSprite(x, y, { scale = 1, variant = 'small' } = {}) {
    const byVariant = {
      small: { anim: 'explode_small', firstFrame: 'explosion_1_01' },
      medium: { anim: 'explode_medium', firstFrame: 'explosion_2_01' },
      large: { anim: 'explode_large', firstFrame: 'explosion_3_01' },
    };
    const { anim, firstFrame } = byVariant[variant] || byVariant.small;
    // Source frames are 52x52px; scale up so the effect reads at gameplay size.
    const sprite = this.scene.add.sprite(x, y, firstFrame);
    sprite.setScale(scale * 1.8);
    sprite.setBlendMode('ADD');
    sprite.once('animationcomplete', () => sprite.destroy());
    sprite.play(anim);
  }

  // Small light flicker where a bullet is intercepted by the shield --
  // quick bright ring + a couple sparks, no damage implied.
  shieldBlock(x, y) {
    const ring = this.scene.add.image(x, y, 'particle_soft')
      .setBlendMode('ADD')
      .setTint(0x88ddff)
      .setAlpha(0.9)
      .setScale(0.3)
      .setDepth(60);
    this.scene.tweens.add({
      targets: ring,
      scale: { from: 0.3, to: 1.4 },
      alpha: { from: 0.9, to: 0 },
      duration: 180,
      onComplete: () => ring.destroy(),
    });

    const emitter = this.scene.add.particles(x, y, 'particle_soft', {
      speed: { min: 40, max: 120 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 120, max: 220 },
      quantity: 6,
      tint: [0xaaeeff, 0xffffff],
      blendMode: 'ADD',
      emitting: false,
    });
    emitter.explode(6);
    this.scene.time.delayedCall(300, () => emitter.destroy());
  }

  spawnPop(sprite) {
    if (!sprite || !sprite.active) return;
    const targetScale = sprite.scale;
    sprite.setScale(0);
    this.scene.tweens.add({
      targets: sprite,
      scale: targetScale,
      duration: 220,
      ease: 'Back.Out',
    });
  }

  engineTrail(scene, target) {
    const emitter = scene.add.particles(0, 0, 'flame', {
      speed: { min: 20, max: 60 },
      angle: { min: 80, max: 100 },
      scale: { start: 0.35, end: 0 },
      alpha: { start: 0.7, end: 0 },
      lifespan: 220,
      frequency: 40,
      follow: target,
      followOffset: { x: 0, y: 18 },
    });
    return emitter;
  }
}
