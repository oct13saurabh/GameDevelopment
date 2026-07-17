import { GAME_WIDTH, GAME_HEIGHT, CURRENT_MISSION, DIFFICULTY_ORDER, SHIPS_FALLBACK } from '../config.js';
import AudioSystem from '../systems/Audio.js';
import Starfield from '../systems/Starfield.js';
import { ACCENT_HEX, TEXT_HEX, drawBeveledPanel, drawCornerBrackets, buildVerticalMenu } from '../systems/UITheme.js';
import { getPrefs, clampShipIndex } from '../systems/PlayerPrefs.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  // Reuses the AudioSystem/AudioContext handed in from a prior scene (e.g.
  // OptionsScene's BACK button returning here) instead of always
  // constructing a fresh one -- a second AudioContext would leak the first
  // and drop mute state on every Menu<->Options round trip. BootScene still
  // starts this scene with no data on first boot, so the fallback below
  // still covers true first entry.
  init(data) {
    this.audio = (data && data.audio) ? data.audio : new AudioSystem();
  }

  create() {
    // Reset every re-entry (e.g. Options' BACK button returns here on the
    // same scene instance) -- otherwise a prior play()/openOptions() call
    // setting this true would permanently block PLAY/OPTIONS on return.
    this.navigating = false;

    this.cameras.main.setBackgroundColor('#05050f');
    this.starfield = new Starfield(this);

    this.drawVignette();
    drawCornerBrackets(this, GAME_WIDTH, GAME_HEIGHT);

    this.add.text(GAME_WIDTH / 2, 46, `MISSION ${CURRENT_MISSION} // OUTER RIM DEFENSE`, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#3a7a8a',
      letterSpacing: 2,
    }).setOrigin(0.5);

    this.drawTitle();
    this.drawShip();
    this.drawRootMenu();
    this.drawExitButton();
    this.input.keyboard.on('keydown-ESC', () => this.showExitConfirm());

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 34, 'ARROWS/WASD MOVE   •   SPACE FIRE   •   P PAUSE   •   M MUTE', {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#3a7a8a',
    }).setOrigin(0.5);
  }

  // Soft dark overlay top/bottom draws the eye toward center content instead
  // of the flat starfield reading as an unbroken tile.
  drawVignette() {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.55);
    g.fillRect(0, 0, GAME_WIDTH, 90);
    g.fillRect(0, GAME_HEIGHT - 90, GAME_WIDTH, 90);
    g.setDepth(-4);
  }

  // Layered text (dim wide "glow" copy behind + crisp sharp copy in front)
  // fakes a neon-glow title without needing a custom font or shader.
  drawTitle() {
    const y = GAME_HEIGHT / 2 - 230;
    const glow = this.add.text(GAME_WIDTH / 2, y, 'SPACE SHOOTER', {
      fontFamily: 'Arial Black, Arial',
      fontSize: '46px',
      color: ACCENT_HEX,
    }).setOrigin(0.5).setAlpha(0.35).setScale(1.06);

    const title = this.add.text(GAME_WIDTH / 2, y, 'SPACE SHOOTER', {
      fontFamily: 'Arial Black, Arial',
      fontSize: '46px',
      color: '#eafdff',
    }).setOrigin(0.5);
    title.setShadow(0, 0, ACCENT_HEX, 12, false, true);

    this.tweens.add({
      targets: glow,
      alpha: { from: 0.2, to: 0.5 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // Ship centered with a soft radial glow behind it and a slow bob/sway --
  // static art on a static background is what made the old menu feel flat.
  drawShip() {
    const ships = this.registry.get('availableShips') || SHIPS_FALLBACK;
    if (!ships || !ships.length) return;
    const prefs = getPrefs(this);
    const shipIndex = clampShipIndex(prefs, ships);

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 - 90;

    const glow = this.add.image(cx, cy, 'particle_soft');
    glow.setTint(0x4de3ff);
    glow.setAlpha(0.22);
    glow.setScale(12);
    glow.setBlendMode(Phaser.BlendModes.ADD);

    // 0.416 = 0.13 * (1024/320) -- same on-screen size as before against
    // BootScene's baked 320px-wide ship texture (see PLAYER.scale comment
    // in config.js for why the texture is now baked smaller).
    const ship = this.add.image(cx, cy, `${ships[shipIndex].key}_idle`).setScale(0.416);

    this.tweens.add({
      targets: [ship, glow],
      y: '+=14',
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.16, to: 0.28 },
      scale: { from: 11, to: 13 },
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  drawRootMenu() {
    buildVerticalMenu(this, {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2 + 130,
      width: 260,
      height: 56,
      gap: 16,
      bindKeys: true,
      items: [
        { label: 'PLAY', onSelect: () => this.play() },
        { label: 'OPTIONS', onSelect: () => this.openOptions() },
      ],
    });
  }

  // Small corner close button instead of a third vertical menu item -- EXIT
  // is a rare, low-priority action, so it doesn't deserve the same visual
  // weight as PLAY/OPTIONS in the main stack.
  drawExitButton() {
    const size = 34;
    const x = GAME_WIDTH - 34;
    const y = 34;
    const panel = drawBeveledPanel(this, x - size / 2, y - size / 2, size, size, { chamfer: 6 });
    const label = this.add.text(x, y, '✕', {
      fontFamily: 'Arial Black, Arial', fontSize: '16px', color: TEXT_HEX,
    }).setOrigin(0.5);
    const hit = this.add.rectangle(x, y, size, size, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.showExitConfirm());
    panel.setDepth(1);
    label.setDepth(2);
    hit.setDepth(3);
  }

  play() {
    if (this.navigating) return;
    this.navigating = true;
    this.audio.resume();
    const prefs = getPrefs(this);
    const ships = this.registry.get('availableShips') || SHIPS_FALLBACK;
    const shipIndex = clampShipIndex(prefs, ships);
    this.scene.start('GameScene', {
      audio: this.audio,
      shipKey: ships[shipIndex].key,
      difficulty: DIFFICULTY_ORDER[prefs.difficultyIndex],
      inputType: prefs.inputType,
      autoFire: prefs.autoFire,
    });
  }

  openOptions() {
    if (this.navigating) return;
    this.navigating = true;
    this.scene.start('OptionsScene', { audio: this.audio });
  }

  // Small Yes/No overlay so an accidental EXIT tap doesn't instantly close
  // the tab/window -- built from the same drawBeveledPanel primitive as
  // everything else rather than a new UITheme function, since it's a one-off
  // two-button row, not a vertical stack.
  showExitConfirm() {
    if (this.exitPanel) return;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // Blocks clicks to whatever's underneath while the confirm is open --
    // a plain Rectangle doesn't swallow pointer events unless interactive.
    const dim = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setDepth(20).setInteractive();
    const panel = drawBeveledPanel(this, cx - 160, cy - 90, 320, 180, { chamfer: 14 });
    panel.setDepth(21);
    const label = this.add.text(cx, cy - 40, 'QUIT GAME?', {
      fontFamily: 'Arial Black, Arial', fontSize: '22px', color: TEXT_HEX,
    }).setOrigin(0.5).setDepth(22);

    const btnW = 110;
    const btnH = 46;
    const gapX = 20;
    const yesX = cx - gapX / 2 - btnW / 2;
    const noX = cx + gapX / 2 + btnW / 2;
    const yesPanel = drawBeveledPanel(this, yesX - btnW / 2, cy + 20 - btnH / 2, btnW, btnH, { chamfer: 8 });
    const noPanel = drawBeveledPanel(this, noX - btnW / 2, cy + 20 - btnH / 2, btnW, btnH, { chamfer: 8 });
    yesPanel.setDepth(21);
    noPanel.setDepth(21);
    const yesLabel = this.add.text(yesX, cy + 20, 'YES', {
      fontFamily: 'Arial Black, Arial', fontSize: '16px', color: TEXT_HEX,
    }).setOrigin(0.5).setDepth(22);
    const noLabel = this.add.text(noX, cy + 20, 'NO', {
      fontFamily: 'Arial Black, Arial', fontSize: '16px', color: TEXT_HEX,
    }).setOrigin(0.5).setDepth(22);
    const yesHit = this.add.rectangle(yesX, cy + 20, btnW, btnH, 0xffffff, 0.001)
      .setDepth(23).setInteractive({ useHandCursor: true });
    const noHit = this.add.rectangle(noX, cy + 20, btnW, btnH, 0xffffff, 0.001)
      .setDepth(23).setInteractive({ useHandCursor: true });

    this.exitPanel = [dim, panel, label, yesPanel, noPanel, yesLabel, noLabel, yesHit, noHit];
    yesHit.on('pointerdown', () => window.close());
    noHit.on('pointerdown', () => this.hideExitConfirm());
  }

  hideExitConfirm() {
    if (!this.exitPanel) return;
    this.exitPanel.forEach((obj) => obj.destroy());
    this.exitPanel = null;
  }

  update(time, dt) {
    this.starfield.update(dt);
  }
}
