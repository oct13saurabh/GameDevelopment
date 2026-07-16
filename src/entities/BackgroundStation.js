import { SPACE_STATIONS, GAME_HEIGHT } from '../config.js';

// Purely decorative mission backdrop image (GameAssets/Background/Mission N),
// drifting slowly downward behind gameplay and the foreground SpaceStations.
// No physics body, no collisions.

export default class BackgroundStation {
  constructor(scene, textureKey, x, y) {
    this.scene = scene;
    this.alive = true;

    this.image = scene.add.image(x, y, textureKey);
    this.image.setDepth(-6);
    this.image.setAlpha(0.85);

    this.speed = SPACE_STATIONS.backgroundDriftSpeed;
  }

  update(time, dt) {
    if (!this.alive) return;
    this.image.y += this.speed * (dt / 1000);
    if (this.image.y > GAME_HEIGHT + 400) {
      this.destroy();
    }
  }

  destroy() {
    this.alive = false;
    if (this.image) {
      this.image.destroy();
      this.image = null;
    }
  }
}
