// Multi-layer parallax scrolling starfield built from a tiny generated pixel texture.

const LAYERS = [
  { count: 40, speed: 30, alpha: 0.35, tint: 0x8899ff },
  { count: 30, speed: 65, alpha: 0.6, tint: 0xaaccff },
  { count: 20, speed: 120, alpha: 1, tint: 0xffffff },
];

export default class Starfield {
  constructor(scene) {
    this.scene = scene;
    this.width = scene.scale.width;
    this.height = scene.scale.height;
    this.layers = LAYERS.map((cfg) => this.buildLayer(cfg));
  }

  buildLayer(cfg) {
    const stars = [];
    for (let i = 0; i < cfg.count; i++) {
      const s = this.scene.add.image(
        Phaser.Math.Between(0, this.width),
        Phaser.Math.Between(0, this.height),
        'star_pixel'
      );
      s.setAlpha(cfg.alpha);
      s.setTint(cfg.tint);
      s.setScale(Phaser.Math.Between(1, 2));
      s.setDepth(-10);
      stars.push(s);
    }
    return { stars, speed: cfg.speed };
  }

  update(dt) {
    const seconds = dt / 1000;
    for (const layer of this.layers) {
      for (const s of layer.stars) {
        s.y += layer.speed * seconds;
        if (s.y > this.height + 2) {
          s.y = -2;
          s.x = Phaser.Math.Between(0, this.width);
        }
      }
    }
  }
}
