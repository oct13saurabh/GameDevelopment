import { BOSS, GAME_HEIGHT } from '../../config.js';

// Mission 3's Mine Barrage hazard: a slow-drifting mine dropped below the
// boss. Destroyable in a single player bullet hit (takeDamage, hp: 1) --
// shooting it just blasts it harmlessly. Left alone, it drifts down and
// detonates for real on touching the player (hitPlayer). Spawn/collision
// plumbing goes through Boss's bossProjectileGroup (see
// GameScene.setupCollisions), just a straight drift + wobble.
export default class Mine {
  constructor(boss, x, y, spriteGroup) {
    this.boss = boss;
    this.scene = boss.scene;
    this.alive = true;
    this.hp = BOSS.mine.hp;
    this.spawnX = x;
    this.spawnTime = this.scene.time.now;

    this.sprite = this.scene.physics.add.image(x, y, BOSS.mine.texture);
    if (spriteGroup) spriteGroup.add(this.sprite);
    this.sprite.setScale(BOSS.mine.scale);
    const localRadius = BOSS.mine.hitboxRadius / BOSS.mine.scale;
    this.sprite.body.setCircle(
      localRadius,
      this.sprite.width / 2 - localRadius,
      this.sprite.height / 2 - localRadius
    );
    this.sprite.owner = this;
    this.sprite.body.setVelocityY(BOSS.mine.driftSpeed);

    // Gentle pulse so it reads as live/armed rather than a static prop.
    this._pulseTween = this.scene.tweens.add({
      targets: this.sprite,
      scale: { from: BOSS.mine.scale * 0.9, to: BOSS.mine.scale * 1.1 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
  }

  update(time) {
    if (!this.alive) return;
    const t = (time - this.spawnTime) / 1000;
    this.sprite.x = this.spawnX + Math.sin(t * BOSS.mine.wobbleFreq) * BOSS.mine.wobbleAmp;
    if (this.sprite.y > GAME_HEIGHT + 60) this.destroy();
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.boss.juice.explosion(this.sprite.x, this.sprite.y, { scale: 0.7 });
      this.boss.audio.explosionSmall();
      this.destroy();
    }
  }

  // Called when it reaches the player directly (GameScene overlap).
  hitPlayer() {
    if (!this.alive) return;
    this.boss.juice.explosion(this.sprite.x, this.sprite.y, { scale: 1.0 });
    this.boss.audio.explosionSmall();
    if (this.scene.player.alive && !this.scene.player.invulnerable) {
      this.scene.player.takeDamage(BOSS.mine.damage);
    }
    this.destroy();
  }

  destroy() {
    this.alive = false;
    if (this._pulseTween) {
      this._pulseTween.remove();
      this._pulseTween = null;
    }
    if (this.sprite) {
      this.sprite.owner = null;
      this.sprite.destroy();
      this.sprite = null;
    }
  }
}
