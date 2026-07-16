import { GAME_WIDTH, GAME_HEIGHT, TOUCH_CONTROLS } from '../config.js';

const WEAPON_BAND_COLOR = { yellow: '#ffdd44', blue: '#44aaff', red: '#ff4444' };

export default class HUDScene extends Phaser.Scene {
  constructor() {
    super('HUDScene');
  }

  init(data) {
    this.gameScene = data.gameScene;
  }

  create() {
    this.scoreText = this.add.text(12, 10, 'SCORE 0', {
      fontFamily: 'Arial', fontSize: '18px', color: '#ffffff',
    });

    this.livesText = this.add.text(GAME_WIDTH - 12, 10, 'LIVES 3', {
      fontFamily: 'Arial', fontSize: '18px', color: '#ffffff',
    }).setOrigin(1, 0);

    this.weaponText = this.add.text(GAME_WIDTH - 12, 34, 'YELLOW LV.1', {
      fontFamily: 'Arial', fontSize: '14px', color: '#ffdd44',
    }).setOrigin(1, 0);

    this.rocketText = this.add.text(GAME_WIDTH - 12, 54, '', {
      fontFamily: 'Arial', fontSize: '13px', color: '#ffaa55',
    }).setOrigin(1, 0);

    this.shieldText = this.add.text(GAME_WIDTH - 12, 74, '', {
      fontFamily: 'Arial', fontSize: '13px', color: '#66ccff',
    }).setOrigin(1, 0);

    this.bombText = this.add.text(GAME_WIDTH - 12, 94, 'BOMBS 0', {
      fontFamily: 'Arial', fontSize: '13px', color: '#88ddff',
    }).setOrigin(1, 0);

    this.empText = this.add.text(GAME_WIDTH - 12, 114, 'EMP 0', {
      fontFamily: 'Arial', fontSize: '13px', color: '#88ffcc',
    }).setOrigin(1, 0);

    // Health bar.
    this.healthBarBg = this.add.rectangle(12, GAME_HEIGHT - 26, 160, 14, 0x330000).setOrigin(0, 0.5);
    this.healthBarFg = this.add.rectangle(14, GAME_HEIGHT - 26, 156, 10, 0x33cc33).setOrigin(0, 0.5);
    this.healthLabel = this.add.text(12, GAME_HEIGHT - 46, 'HULL', {
      fontFamily: 'Arial', fontSize: '12px', color: '#aaaaaa',
    });

    // Boss health bar (hidden until boss spawns).
    this.bossBarBg = this.add.rectangle(GAME_WIDTH / 2, 24, GAME_WIDTH - 40, 16, 0x330000).setOrigin(0.5).setVisible(false);
    this.bossBarFg = this.add.rectangle(GAME_WIDTH / 2 - (GAME_WIDTH - 44) / 2, 24, GAME_WIDTH - 44, 12, 0xcc3333).setOrigin(0, 0.5).setVisible(false);
    this.bossLabel = this.add.text(GAME_WIDTH / 2, 6, 'BOSS', {
      fontFamily: 'Arial', fontSize: '13px', color: '#ffaaaa',
    }).setOrigin(0.5).setVisible(false);
    this.bossBarMaxWidth = GAME_WIDTH - 44;

    this.pausedText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'PAUSED', {
      fontFamily: 'Arial Black, Arial', fontSize: '32px', color: '#ffffff',
    }).setOrigin(0.5).setVisible(false);

    this.muteText = this.add.text(12, GAME_HEIGHT - 66, '', {
      fontFamily: 'Arial', fontSize: '12px', color: '#ffdd55',
    });

    const g = this.gameScene.appEvents;
    g.on('score-changed', (score) => this.scoreText.setText(`SCORE ${score}`));
    g.on('player-lives-changed', (lives) => this.livesText.setText(`LIVES ${Math.max(lives, 0)}`));
    g.on('weapon-changed', (level, color) => this.setWeaponText(level, color));
    g.on('player-health-changed', (hp, maxHp) => this.setHealthBar(hp, maxHp));
    g.on('boss-spawned', (hp, maxHp) => this.showBossBar(hp, maxHp));
    g.on('boss-health-changed', (hp, maxHp) => this.setBossBar(hp, maxHp));
    g.on('boss-phase-changed', () => this.flashBossPhase());
    g.on('pause-changed', (paused) => this.pausedText.setVisible(paused));
    g.on('mute-changed', (muted) => this.muteText.setText(muted ? 'MUTED' : ''));
    g.on('rocket-power-changed', (active) => this.rocketText.setText(active ? 'ROCKET ONLINE' : ''));
    g.on('shield-changed', (active) => this.shieldText.setText(active ? 'SHIELD UP' : ''));
    g.on('bomb-count-changed', (count) => this.bombText.setText(`BOMBS ${count}`));
    g.on('emp-count-changed', (count) => this.empText.setText(`EMP ${count}`));

    if (this.gameScene.isTouchDevice) {
      this.createTouchButtons();
    }
  }

  // Round semi-transparent buttons over the bomb/EMP text readouts -- their
  // hit areas match TOUCH_CONTROLS (see config.js), which Player.js also
  // reads to keep these taps from also dragging the ship.
  createTouchButtons() {
    const makeButton = (cfg, label, color, onTap) => {
      const circle = this.add.circle(cfg.x, cfg.y, cfg.radius, color, 0.35).setStrokeStyle(2, color, 0.9);
      const text = this.add.text(cfg.x, cfg.y, label, {
        fontFamily: 'Arial Black, Arial', fontSize: '13px', color: '#ffffff',
      }).setOrigin(0.5);
      circle.setInteractive({ useHandCursor: true });
      circle.on('pointerdown', () => {
        onTap();
        circle.setFillStyle(color, 0.6);
        this.time.delayedCall(120, () => circle.setFillStyle(color, 0.35));
      });
      return { circle, text };
    };

    makeButton(TOUCH_CONTROLS.bombButton, 'BOMB', 0x88ddff, () => this.gameScene.player.useBomb());
    makeButton(TOUCH_CONTROLS.empButton, 'EMP', 0x88ffcc, () => this.gameScene.player.useEmp());
  }

  setWeaponText(level, color = 'blue') {
    this.weaponText.setText(`${color.toUpperCase()} LV.${level}`);
    this.weaponText.setColor(WEAPON_BAND_COLOR[color] || WEAPON_BAND_COLOR.blue);
  }

  setHealthBar(hp, maxHp) {
    const pct = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    this.healthBarFg.width = 156 * pct;
    this.healthBarFg.fillColor = pct > 0.5 ? 0x33cc33 : pct > 0.25 ? 0xdddd33 : 0xdd3333;
  }

  showBossBar(hp, maxHp) {
    this.bossBarBg.setVisible(true);
    this.bossBarFg.setVisible(true);
    this.bossLabel.setVisible(true);
    this.setBossBar(hp, maxHp);
  }

  setBossBar(hp, maxHp) {
    const pct = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    this.bossBarFg.width = this.bossBarMaxWidth * pct;
    if (pct <= 0) {
      this.bossBarBg.setVisible(false);
      this.bossBarFg.setVisible(false);
      this.bossLabel.setVisible(false);
    }
  }

  flashBossPhase() {
    this.cameras.main.flash(200, 255, 60, 60);
  }
}
