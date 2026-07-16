// Screen shake, hit-flash, and particle explosion helpers shared across entities.

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
