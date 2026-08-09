import { SPACE_STATIONS, GAME_WIDTH, GAME_HEIGHT } from '../config.js';

// Shared by two decorative layers, distinguished by options.fullscreen:
//  - Mission backdrop image (GameAssets/Background/Mission N, fullscreen:
//    true) -- stretched to fill the full play area.
//  - Environment decorations (planets etc., fullscreen: false/omitted) --
//    kept at their own Small/Medium/Big options.scale.
// Both drift slowly downward behind gameplay. No physics body, no collisions.

export default class BackgroundStation {
  constructor(scene, textureKey, x, y, options = {}) {
    this.scene = scene;
    this.alive = true;

    this.image = scene.add.image(x, y, textureKey);
    this.image.setDepth(options.depth ?? -6);
    if (options.fullscreen) {
      this.image.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    } else {
      this.image.setScale(options.scale ?? SPACE_STATIONS.backgroundScale);
    }
    this.image.setAlpha(options.alpha ?? SPACE_STATIONS.backgroundAlpha);

    this.speed = options.driftSpeed ?? SPACE_STATIONS.backgroundDriftSpeed;
    this.size = options.size ?? 'Medium';
  }

  update(time, dt) {
    if (!this.alive) return;
    this.image.y += this.speed * (dt / 1000);
    if (this.image.y > GAME_HEIGHT / 2 + GAME_HEIGHT + 200) {
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
