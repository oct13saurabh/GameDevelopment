import { SPACE_STATIONS, GAME_HEIGHT } from '../config.js';

// One destructible tile of a SpaceStation. Each part gets its own physics
// body and HP so player fire chips the station apart piece by piece instead
// of destroying (or missing) it as a single blob.
class StationPart {
  constructor(scene, x, y, texture, scale, spriteGroup) {
    this.scene = scene;
    this.alive = true;
    this.hp = SPACE_STATIONS.partHp;

    this.sprite = scene.physics.add.image(x, y, texture);
    // Physics groups reset velocity to their (zero) defaults when a sprite is
    // added, so join the group before configuring the body (see Enemy.js/
    // Train.js for the same ordering).
    if (spriteGroup) spriteGroup.add(this.sprite);
    this.sprite.setScale(scale);
    this.sprite.setAlpha(0.85);
    this.sprite.setDepth(-5);

    const localRadius = Math.min(this.sprite.width, this.sprite.height) / 2;
    this.sprite.body.setCircle(
      localRadius,
      this.sprite.width / 2 - localRadius,
      this.sprite.height / 2 - localRadius
    );
    this.sprite.owner = this;
  }

  update(dt, speed) {
    if (!this.alive) return;
    this.sprite.y += speed * (dt / 1000);
    if (this.sprite.y > GAME_HEIGHT + 400) this.destroy();
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp -= amount;
    this.scene.juice.flashSprite(this.sprite, 0xffffff, 60);
    if (this.hp <= 0) this.die();
  }

  die() {
    if (!this.alive) return;
    this.scene.juice.explosion(this.sprite.x, this.sprite.y, { scale: 0.6 });
    this.scene.audio.explosionSmall();
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

// Purely decorative background structure composed from several station/
// building tile images, drifting slowly downward behind gameplay for
// atmosphere. Each tile part is independently destructible by player fire --
// shooting one part down doesn't remove the rest of the station.
export default class SpaceStation {
  constructor(scene, template, x, y, spriteGroup) {
    this.scene = scene;
    this.alive = true;
    this.speed = SPACE_STATIONS.driftSpeed;

    this.parts = template.parts.map((part) =>
      new StationPart(
        scene,
        x + part.x,
        y + part.y,
        part.texture,
        template.scale * (part.scale || 1),
        spriteGroup
      )
    );
  }

  update(time, dt) {
    if (!this.alive) return;
    for (const part of this.parts) part.update(dt, this.speed);
    this.parts = this.parts.filter((p) => p.alive);
    if (this.parts.length === 0) this.alive = false;
  }

  destroy() {
    this.alive = false;
    for (const part of this.parts) part.destroy();
    this.parts = [];
  }
}
