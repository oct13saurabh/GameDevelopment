import { GAME_WIDTH, GAME_HEIGHT, CURRENT_MISSION } from '../config.js';
import AudioSystem from '../systems/Audio.js';
import Starfield from '../systems/Starfield.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#05050f');
    this.starfield = new Starfield(this);
    this.audio = new AudioSystem();

    const ships = this.registry.get('availableShips');
    if (ships && ships.length) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 160, `${ships[0].key}_idle`).setScale(0.13);
    }

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'SPACE SHOOTER', {
      fontFamily: 'Arial Black, Arial',
      fontSize: '40px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, `MISSION ${CURRENT_MISSION}`, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#88ccff',
    }).setOrigin(0.5);

    const isTouchDevice = this.sys.game.device.input.touch;

    if (isTouchDevice) {
      // Explicit tap target instead of relying on the tap-anywhere fallback
      // below -- a bordered button reads as "press this" on a touchscreen,
      // where there's no keyboard prompt to fall back on.
      const btnBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 110, 220, 56, 0x1a2a44, 0.9)
        .setStrokeStyle(2, 0x66ccff)
        .setInteractive({ useHandCursor: true });
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 110, 'START MISSION', {
        fontFamily: 'Arial Black, Arial',
        fontSize: '20px',
        color: '#ffdd55',
      }).setOrigin(0.5);
      btnBg.on('pointerdown', () => this.startGame());
    } else {
      const prompt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100, 'PRESS SPACE TO CONTINUE', {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ffdd55',
      }).setOrigin(0.5);

      this.tweens.add({
        targets: prompt,
        alpha: { from: 1, to: 0.2 },
        duration: 700,
        yoyo: true,
        repeat: -1,
      });
    }

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 40, 'Arrows/WASD move  •  Space fire  •  P pause  •  M mute', {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#8899aa',
    }).setOrigin(0.5);

    this.input.keyboard.once('keydown-SPACE', () => this.startGame());
    // Touch devices use the explicit START MISSION button above instead --
    // a second tap-anywhere listener here would double-fire startGame()
    // (once from the button's own handler, once from this one) since the
    // button tap is itself a pointerdown.
    if (!isTouchDevice) {
      this.input.once('pointerdown', () => this.startGame());
    }
  }

  startGame() {
    if (this.started) return;
    this.started = true;
    this.audio.resume();
    this.scene.start('OptionsScene', { audio: this.audio });
  }

  update(time, dt) {
    this.starfield.update(dt);
  }
}
