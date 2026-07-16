import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import Starfield from '../systems/Starfield.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  init(data) {
    this.win = data.win;
    this.score = data.score || 0;
    this.audio = data.audio;
    this.shipKey = data.shipKey || 'ship_01';
    this.difficulty = data.difficulty || 'easy';
    this.inputType = data.inputType;
    this.autoFire = data.autoFire;
  }

  create() {
    this.cameras.main.setBackgroundColor('#05050f');
    this.starfield = new Starfield(this);

    const title = this.win ? 'MISSION COMPLETE' : 'GAME OVER';
    const color = this.win ? '#66ff88' : '#ff5555';

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, title, {
      fontFamily: 'Arial Black, Arial', fontSize: '34px', color,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, `SCORE: ${this.score}`, {
      fontFamily: 'Arial', fontSize: '22px', color: '#ffffff',
    }).setOrigin(0.5);

    const prompt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60, 'PRESS SPACE TO RESTART', {
      fontFamily: 'Arial', fontSize: '16px', color: '#ffdd55',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: { from: 1, to: 0.2 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    this.input.keyboard.once('keydown-SPACE', () => this.restart());
    this.input.once('pointerdown', () => this.restart());
  }

  restart() {
    this.scene.start('GameScene', { audio: this.audio, shipKey: this.shipKey, difficulty: this.difficulty, inputType: this.inputType, autoFire: this.autoFire });
  }

  update(time, dt) {
    this.starfield.update(dt);
  }
}
