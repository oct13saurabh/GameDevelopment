import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import Starfield from '../systems/Starfield.js';
import { MISSIONS } from '../missions/Missions.js';
import { getPrefs, setPref } from '../systems/PlayerPrefs.js';

const MISSION_NUMBERS = Object.keys(MISSIONS).map(Number).sort((a, b) => a - b);

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  init(data) {
    this.win = data.win;
    this.score = data.score || 0;
    this.carry = data.carry || null;
    this.audio = data.audio;
    this.shipKey = data.shipKey || 'ship_01';
    this.difficulty = data.difficulty || 'easy';
    this.inputType = data.inputType;
    this.autoFire = data.autoFire;

    // On a win, advance to the next mission in MISSION_NUMBERS order,
    // wrapping back to the first once the last one's cleared -- restart()
    // below reboots to load that mission's art before jumping into it.
    if (this.win) {
      const missionNumber = getPrefs(this).missionNumber;
      const idx = MISSION_NUMBERS.indexOf(missionNumber);
      const isLastMission = idx === -1 || idx >= MISSION_NUMBERS.length - 1;
      this.nextMissionNumber = isLastMission ? MISSION_NUMBERS[0] : MISSION_NUMBERS[idx + 1];
      this.campaignComplete = isLastMission;
    }
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

    if (this.win) {
      const nextLabel = this.campaignComplete
        ? 'ALL MISSIONS CLEARED -- LOOPING TO MISSION 1'
        : `NEXT: MISSION ${this.nextMissionNumber}`;
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 18, nextLabel, {
        fontFamily: 'Arial', fontSize: '14px', color: '#7aa8b8',
      }).setOrigin(0.5);
    }

    const promptLabel = this.win ? 'PRESS SPACE FOR NEXT MISSION' : 'PRESS SPACE TO RESTART';
    const prompt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60, promptLabel, {
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
    const gameplayData = { audio: this.audio, shipKey: this.shipKey, difficulty: this.difficulty, inputType: this.inputType, autoFire: this.autoFire };
    if (this.win) {
      // Weapon level/bombs/EMP/lives/health/score carry into the next
      // mission's Player instead of resetting -- see GameScene.init/create's
      // applyCarry.
      gameplayData.carry = this.carry;
      gameplayData.score = this.score;
      // Next mission's art (enemy/background/boss) has to load before
      // GameScene starts -- reboot through BootScene rather than jumping
      // straight there (see BootScene's nextScene/nextSceneData handling).
      setPref(this, 'missionNumber', this.nextMissionNumber);
      this.scene.start('BootScene', { audio: this.audio, nextScene: 'LaunchScene', nextSceneData: gameplayData });
    } else {
      this.scene.start('LaunchScene', gameplayData);
    }
  }

  update(time, dt) {
    this.starfield.update(dt);
  }
}
