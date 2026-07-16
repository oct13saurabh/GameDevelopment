// Pooled bullet group. Used separately for player bullets and enemy bullets
// so collision filters stay simple (playerBullets vs enemies, enemyBullets vs player).

export default class BulletPool {
  constructor(scene, { texture, maxSize = 80, damage = 10 }) {
    this.scene = scene;
    this.damage = damage;
    this.group = scene.physics.add.group({
      defaultKey: texture,
      maxSize,
      runChildUpdate: true,
    });
  }

  fire(x, y, angleDeg, speed, { texture, damage, scale = 0.5, pierce = 0 } = {}) {
    const key = texture || this.group.defaultKey;
    const bullet = this.group.get(x, y, key);
    if (!bullet) return null;

    // Pooled objects reuse whatever texture they were first created with --
    // group.get() only applies `key` when it creates a brand new object, not
    // when it recycles an inactive one -- so force it here every time.
    bullet.setTexture(key);
    bullet.setActive(true);
    bullet.setVisible(true);
    bullet.setScale(scale);
    bullet.damage = damage !== undefined ? damage : this.damage;
    // Pierce count: how many extra targets this bullet can pass through
    // before actually being killed on hit (see GameScene.onPlayerBulletHit).
    bullet.pierceRemaining = pierce;
    if (bullet.body) {
      bullet.body.reset(x, y);
      bullet.body.enable = true;
    }
    bullet.setRotation(Phaser.Math.DegToRad(angleDeg + 90));
    const rad = Phaser.Math.DegToRad(angleDeg);
    this.scene.physics.velocityFromRotation(rad, speed, bullet.body.velocity);

    bullet.update = function () {
      const b = this.scene.physics.world.bounds;
      if (
        this.y < -40 || this.y > b.height + 40 ||
        this.x < -40 || this.x > b.width + 40
      ) {
        this.setActive(false);
        this.setVisible(false);
        if (this.body) this.body.enable = false;
      }
    };

    return bullet;
  }

  kill(bullet) {
    bullet.setActive(false);
    bullet.setVisible(false);
    if (bullet.body) bullet.body.enable = false;
  }

  killAll() {
    for (const bullet of this.group.getChildren()) {
      if (bullet.active) this.kill(bullet);
    }
  }
}
