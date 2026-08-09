import { BOSS } from '../../config.js';

const REFERENCE_SOURCE_SIZE = 64;

// Destroyable minion that flanks the boss at a fixed offset (re-applied every
// frame so it tracks the boss's horizontal sweep) and fires a single aimed
// shot at the player on its own cooldown. Lives in GameScene's shared
// enemySpriteGroup so it's killable by the player's existing bullet-vs-enemy
// overlap and deals contact damage via the existing player-vs-enemy overlap
// -- no new collision wiring needed. Gives the player a target-priority
// choice: snipe drones to cut incoming fire, or ignore them and focus the boss.
export default class Drone {
  constructor(boss, offsetX, offsetY, spriteGroup) {
    this.boss = boss;
    this.scene = boss.scene;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.alive = true;
    this.hp = BOSS.drone.hp;
    this.lastFired = this.scene.time.now + Phaser.Math.Between(0, BOSS.drone.fireRateMs);

    // BOSS.drone.texture ('enemy_b_m') isn't an actually-loaded Phaser key --
    // it's just the placeholder name ENEMY_TYPES uses; real ship art comes
    // from the manifest-driven per-mission design pool (see Enemy.js), so
    // pull a design from there the same way GameScene.spawnEnemy does,
    // falling back to the plain texture key only if no design art exists yet.
    const designs = this.scene.registry.get('enemyDesigns') || {};
    const pool = designs.random || [];
    const design = pool.length ? Phaser.Utils.Array.GetRandom(pool) : null;
    const textureKey = design ? (design.banking ? design.banking.m : design.static) : BOSS.drone.texture;

    this.sprite = this.scene.physics.add.image(boss.sprite.x + offsetX, boss.sprite.y + offsetY, textureKey);
    if (spriteGroup) spriteGroup.add(this.sprite);
    // Normalize against actual source width, same as Enemy.js, so on-screen
    // size stays consistent regardless of the design's source resolution.
    const targetWidth = REFERENCE_SOURCE_SIZE * BOSS.drone.scale;
    const appliedScale = targetWidth / this.sprite.width;
    this.sprite.setScale(appliedScale);
    if (!design) this.sprite.setTint(BOSS.drone.tint);
    const localRadius = BOSS.drone.hitboxRadius / appliedScale;
    this.sprite.body.setCircle(
      localRadius,
      this.sprite.width / 2 - localRadius,
      this.sprite.height / 2 - localRadius
    );
    this.sprite.owner = this;
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.moves = false; // position is driven manually below, not physics velocity
    this.boss.juice.spawnPop(this.sprite);
  }

  update(time) {
    if (!this.alive) return;
    if (!this.boss.alive || !this.boss.sprite) {
      this.destroy();
      return;
    }
    this.sprite.x = this.boss.sprite.x + this.offsetX;
    this.sprite.y = this.boss.sprite.y + this.offsetY;

    if (time - this.lastFired > BOSS.drone.fireRateMs) {
      this.lastFired = time;
      this.fireAimed();
    }
  }

  fireAimed() {
    const player = this.scene.player;
    if (!player || !player.alive) return;
    const angleDeg = Phaser.Math.RadToDeg(
      Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, player.sprite.x, player.sprite.y)
    );
    this.boss.bulletPool.fire(this.sprite.x, this.sprite.y, angleDeg, BOSS.drone.bulletSpeed, {
      texture: 'enemy_bullet_2', damage: BOSS.drone.bulletDamage, scale: 0.4,
    });
    this.boss.audio.enemyShoot();
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp -= amount;
    this.boss.juice.flashSprite(this.sprite, 0xffffff, 60);
    if (this.hp <= 0) this.die();
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.boss.juice.explosion(this.sprite.x, this.sprite.y, { scale: 0.6 });
    this.boss.audio.explosionSmall();
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
