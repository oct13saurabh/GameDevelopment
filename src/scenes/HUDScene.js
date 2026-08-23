import { GAME_WIDTH, GAME_HEIGHT, TOUCH_CONTROLS, DIFFICULTY } from '../config.js';

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

    this.missionText = this.add.text(GAME_WIDTH / 2, 10, `MISSION ${this.gameScene.missionNumber}`, {
      fontFamily: 'Arial', fontSize: '14px', color: '#3a7a8a', letterSpacing: 2,
    }).setOrigin(0.5, 0);

    // Adaptive-mode tier readout -- only shown when GameScene started in
    // 'adaptive' difficulty (see AdaptiveDifficulty). Sits just below the
    // mission label.
    this.adaptiveTierText = this.add.text(GAME_WIDTH / 2, 28, '', {
      fontFamily: 'Arial', fontSize: '12px', color: '#3aff9a', letterSpacing: 1,
    }).setOrigin(0.5, 0).setVisible(this.gameScene.isAdaptive);

    this.livesText = this.add.text(GAME_WIDTH - 12, 10, 'LIVES 3', {
      fontFamily: 'Arial', fontSize: '18px', color: '#ffffff',
    }).setOrigin(1, 0);

    // Placeholder text/color -- replaced immediately below by setWeaponText()
    // reading the player's actual starting state, since the initial
    // 'weapon-changed' emit from GameScene.create() races this scene's own
    // launch (scene.launch() is queued, not synchronous) and can arrive
    // before this listener even exists, leaving a stale hardcoded guess.
    this.weaponText = this.add.text(GAME_WIDTH - 12, 34, '', {
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

    // Boss-incoming banner (Mission 4's "enemies stop, screen goes quiet,
    // warning appears" beat before the boss enters -- see WaveManager's
    // 'boss-warning' emit, gated on missions/Missions.js's bossWarning flag).
    this.warningText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, 'WARNING\nMASSIVE HOSTILE SIGNATURE DETECTED', {
      fontFamily: 'Arial Black, Arial', fontSize: '18px', color: '#ff3333', align: 'center', letterSpacing: 1,
    }).setOrigin(0.5).setVisible(false).setDepth(100);
    this._warningBlink = null;

    const g = this.gameScene.appEvents;
    g.on('score-changed', (score) => this.scoreText.setText(`SCORE ${score}`));
    g.on('player-lives-changed', (lives) => this.livesText.setText(`LIVES ${Math.max(lives, 0)}`));
    g.on('weapon-changed', (level, color) => this.setWeaponText(level, color));
    g.on('player-health-changed', (hp, maxHp) => this.setHealthBar(hp, maxHp));
    g.on('boss-warning', () => this.showBossWarning());
    g.on('boss-spawned', (hp, maxHp) => this.showBossBar(hp, maxHp));
    g.on('boss-health-changed', (hp, maxHp) => this.setBossBar(hp, maxHp));
    g.on('boss-phase-changed', () => this.flashBossPhase());
    // Mission 5's mid-boss reuses the same health-bar UI as the real boss
    // (see MidBoss.js) -- they never coexist on screen, so no separate bar
    // is needed, just a relabel while it's up.
    g.on('midboss-spawned', (hp, maxHp) => { this.bossLabel.setText('MID-BOSS'); this.showBossBar(hp, maxHp); });
    g.on('midboss-health-changed', (hp, maxHp) => this.setMidBossBar(hp, maxHp));
    g.on('midboss-selfdestruct-warning', () => this.showMidBossEnrageWarning());
    g.on('pause-changed', (paused) => this.pausedText.setVisible(paused));
    g.on('mute-changed', (muted) => this.muteText.setText(muted ? 'MUTED' : ''));
    g.on('difficulty-tier-changed', (tierKey) => this.setAdaptiveTierText(tierKey));

    if (this.gameScene.isAdaptive) {
      this.adaptiveTierText.setText(`ADAPTIVE: ${this.gameScene.diffCfg.label}`);
    }

    // Read initial state directly instead of relying on GameScene's initial
    // emit -- scene.launch() is async, so that emit can fire before this
    // scene (and its listeners above) even exists.
    this.setWeaponText(this.gameScene.player.weaponLevel, this.gameScene.player.bulletColor);
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

  setAdaptiveTierText(tierKey) {
    this.adaptiveTierText.setText(`ADAPTIVE: ${DIFFICULTY[tierKey].label}`);
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

  showBossWarning() {
    this.warningText.setVisible(true).setAlpha(1);
    this._warningBlink = this.tweens.add({
      targets: this.warningText, alpha: 0.2, duration: 280, yoyo: true, repeat: -1,
    });
    this.cameras.main.flash(200, 255, 30, 30);
  }

  hideBossWarning() {
    if (this._warningBlink) { this._warningBlink.remove(); this._warningBlink = null; }
    this.warningText.setVisible(false);
  }

  showBossBar(hp, maxHp) {
    this.hideBossWarning();
    this.bossBarBg.setVisible(true);
    this.bossBarFg.setVisible(true);
    this.bossLabel.setVisible(true);
    this.missionText.setVisible(false);
    this.setBossBar(hp, maxHp);
  }

  setBossBar(hp, maxHp) {
    const pct = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    this.bossBarFg.width = this.bossBarMaxWidth * pct;
    if (pct <= 0) {
      this.bossBarBg.setVisible(false);
      this.bossBarFg.setVisible(false);
      this.bossLabel.setVisible(false);
      this.missionText.setVisible(true);
    }
  }

  flashBossPhase() {
    this.cameras.main.flash(200, 255, 60, 60);
  }

  // Same bar-hide behavior as setBossBar, but also resets the shared label
  // back to 'BOSS' once the mid-boss's bar hides so a later real boss spawn
  // doesn't inherit the 'MID-BOSS' text (see midboss-spawned above).
  setMidBossBar(hp, maxHp) {
    this.setBossBar(hp, maxHp);
    if (hp <= 0) this.bossLabel.setText('BOSS');
  }

  // Mid-boss enrage-timeout countdown cue (MID_BOSS.enrageWarningMs before
  // MidBoss.enrage fires) -- reuses the same warning banner as the real
  // boss-incoming warning, with different text, then restores that text so
  // a later real boss-warning still reads correctly.
  showMidBossEnrageWarning() {
    const originalText = this.warningText.text;
    this.warningText.setText('MID-BOSS OVERLOADING\nBRACE FOR DETONATION');
    this.showBossWarning();
    this.time.delayedCall(3000, () => {
      this.hideBossWarning();
      this.warningText.setText(originalText);
    });
  }
}
