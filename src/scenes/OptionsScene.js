import {
  GAME_WIDTH, GAME_HEIGHT, SHIPS_FALLBACK,
  DIFFICULTY, DIFFICULTY_ORDER,
  INPUT_TYPES,
} from '../config.js';
import Starfield from '../systems/Starfield.js';
import { ACCENT_HEX, TEXT_HEX, drawCornerBrackets, buildVerticalMenu } from '../systems/UITheme.js';
import { getPrefs, setPref } from '../systems/PlayerPrefs.js';

const MAX_SHIP_COLUMNS = 5;

const DIFFICULTY_DESCRIPTIONS = {
  kids: 'Very gentle. Weak enemies, lots of power-ups, tiny damage taken.',
  easy: 'Baseline challenge. More power-ups, fewer meteors.',
  normal: 'Tougher enemies, fewer power-ups, more meteors.',
  hard: 'Toughest enemies, scarce power-ups, meteor swarms.',
};

const INPUT_DESCRIPTIONS = {
  keyboard: 'Arrows/WASD move, Space fire, B bomb. Mouse disabled.',
  mouse: 'Ship follows cursor, left-click fire, right-click bomb. Keyboard still works too.',
};

const TEXT_DIM = '#5a8a9a';

// Pure configuration screen -- GAMEPLAY (difficulty + auto fire) / PLAYER
// (ship) / INPUT, each its own sub-view with a Back button, entered from and
// returning to a root vertical menu. No launch action here: PLAY always
// happens from MenuScene, using whatever this screen last wrote to
// PlayerPrefs. Shares the UITheme.js beveled-panel look with MenuScene.
export default class OptionsScene extends Phaser.Scene {
  constructor() {
    super('OptionsScene');
  }

  init(data) {
    this.audio = data.audio;
  }

  create() {
    this.cameras.main.setBackgroundColor('#05050f');
    this.starfield = new Starfield(this);
    drawCornerBrackets(this, GAME_WIDTH, GAME_HEIGHT);

    const ships = this.registry.get('availableShips');
    this.ships = ships && ships.length ? ships : SHIPS_FALLBACK;

    this.view = 'root';

    const title = this.add.text(GAME_WIDTH / 2, 34, 'OPTIONS', {
      fontFamily: 'Arial Black, Arial', fontSize: '26px', color: '#eafdff',
    }).setOrigin(0.5);
    title.setShadow(0, 0, ACCENT_HEX, 8, false, true);

    this.viewContent = this.add.container(0, 0);
    this.renderView();

    // All keyboard bound once here, gated by this.view inside each handler
    // -- avoids stacking duplicate listeners across repeated setView() calls
    // within this one scene instance (unlike a fresh scene restart).
    this.input.keyboard.on('keydown-ONE', () => { if (this.view === 'root') this.setView('gameplay'); });
    this.input.keyboard.on('keydown-TWO', () => { if (this.view === 'root') this.setView('player'); });
    this.input.keyboard.on('keydown-THREE', () => { if (this.view === 'root') this.setView('input'); });
    this.input.keyboard.on('keydown-LEFT', () => this.moveSelection(-1));
    this.input.keyboard.on('keydown-A', () => this.moveSelection(-1));
    this.input.keyboard.on('keydown-RIGHT', () => this.moveSelection(1));
    this.input.keyboard.on('keydown-D', () => this.moveSelection(1));
    this.input.keyboard.on('keydown-UP', () => this.moveSelection(-this.upDownStride()));
    this.input.keyboard.on('keydown-W', () => this.moveSelection(-this.upDownStride()));
    this.input.keyboard.on('keydown-DOWN', () => this.moveSelection(this.upDownStride()));
    this.input.keyboard.on('keydown-S', () => this.moveSelection(this.upDownStride()));
    this.input.keyboard.on('keydown-F', () => { if (this.view === 'gameplay') this.toggleAutoFire(); });
    this.input.keyboard.on('keydown-BACKSPACE', () => {
      if (this.view === 'root') this.scene.start('MenuScene', { audio: this.audio });
      else this.setView('root');
    });

    const isTouchDevice = this.sys.game.device.input.touch;
    this.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT - 30,
      isTouchDevice ? 'TAP A CATEGORY  •  TAP AN OPTION TO CHOOSE  •  BACK RETURNS' : '1-3 CATEGORY  •  ARROWS CHOOSE  •  BACKSPACE BACK',
      { fontFamily: 'Arial', fontSize: '14px', color: '#3a7a8a' }
    ).setOrigin(0.5);
  }

  setView(view) {
    this.view = view;
    this.renderView();
  }

  renderView() {
    this.viewContent.removeAll(true);
    if (this.view === 'root') this.renderRootView();
    else if (this.view === 'gameplay') this.renderGameplayView();
    else if (this.view === 'player') this.renderPlayerView();
    else this.renderInputView();
  }

  renderRootView() {
    buildVerticalMenu(this, {
      x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 - 90, width: 320, height: 54, gap: 16,
      container: this.viewContent,
      items: [
        { label: 'GAMEPLAY', onSelect: () => this.setView('gameplay') },
        { label: 'PLAYER', onSelect: () => this.setView('player') },
        { label: 'INPUT', onSelect: () => this.setView('input') },
        { label: 'BACK', onSelect: () => this.scene.start('MenuScene', { audio: this.audio }) },
      ],
    });
  }

  renderBackButton() {
    buildVerticalMenu(this, {
      x: GAME_WIDTH / 2, y: GAME_HEIGHT - 70, width: 180, height: 46, gap: 0,
      container: this.viewContent,
      items: [{ label: 'BACK', onSelect: () => this.setView('root') }],
    });
  }

  upDownStride() {
    return this.view === 'player' ? Math.min(this.ships.length, MAX_SHIP_COLUMNS) : 1;
  }

  moveSelection(delta) {
    const prefs = getPrefs(this);
    if (this.view === 'player') {
      const next = prefs.shipIndex + delta;
      if (next < 0 || next >= this.ships.length) return;
      setPref(this, 'shipIndex', next);
    } else if (this.view === 'gameplay') {
      const next = prefs.difficultyIndex + delta;
      if (next < 0 || next >= DIFFICULTY_ORDER.length) return;
      setPref(this, 'difficultyIndex', next);
    } else if (this.view === 'input') {
      const idx = INPUT_TYPES.indexOf(prefs.inputType);
      const next = idx + (delta > 0 ? 1 : delta < 0 ? -1 : 0);
      if (next < 0 || next >= INPUT_TYPES.length) return;
      setPref(this, 'inputType', INPUT_TYPES[next]);
    } else {
      return;
    }
    this.renderView();
  }

  toggleAutoFire() {
    setPref(this, 'autoFire', !getPrefs(this).autoFire);
    this.renderView();
  }

  renderPlayerView() {
    const prefs = getPrefs(this);
    const columns = Math.min(this.ships.length, MAX_SHIP_COLUMNS);
    const rows = Math.ceil(this.ships.length / columns);
    const gridTop = 100;
    const gridBottom = GAME_HEIGHT - 110;
    const cellW = (GAME_WIDTH - 30) / columns;
    const cellH = (gridBottom - gridTop) / rows;
    const boxW = Math.min(140, cellW - 12);
    const boxH = Math.min(170, cellH - 12);
    // 0.352/0.16 = 0.11/0.05 * (1024/320) -- same on-screen sizes as before
    // against BootScene's baked 320px-wide ship texture (see PLAYER.scale
    // comment in config.js).
    const spriteScale = Phaser.Math.Clamp(0.352 * (boxW / 140), 0.16, 0.352);

    this.ships.forEach((ship, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = 15 + cellW * (col + 0.5);
      const y = gridTop + cellH * (row + 0.5);
      const selected = i === prefs.shipIndex;

      const box = this.add.rectangle(x, y, boxW, boxH, 0x081018, selected ? 0.9 : 0.55)
        .setStrokeStyle(selected ? 3 : 2, 0x4de3ff, selected ? 1 : 0.5);
      const sprite = this.add.image(x, y - boxH * 0.12, `${ship.key}_idle`)
        .setScale(selected ? spriteScale * 1.15 : spriteScale);
      const label = this.add.text(x, y + boxH * 0.38, ship.name, {
        fontFamily: 'Arial', fontSize: '13px', color: selected ? TEXT_HEX : TEXT_DIM,
      }).setOrigin(0.5);

      box.setInteractive({ useHandCursor: true });
      box.on('pointerdown', () => {
        setPref(this, 'shipIndex', i);
        this.renderView();
      });

      this.viewContent.add([box, sprite, label]);
    });

    this.renderBackButton();
  }

  renderGameplayView() {
    const prefs = getPrefs(this);
    const cellW = GAME_WIDTH / DIFFICULTY_ORDER.length;
    const y = GAME_HEIGHT / 2 - 60;
    const w = cellW - 24;
    const h = 170;

    DIFFICULTY_ORDER.forEach((key, i) => {
      const x = cellW * (i + 0.5);
      const cfg = DIFFICULTY[key];
      const selected = i === prefs.difficultyIndex;

      const box = this.add.rectangle(x, y, w, h, 0x081018, selected ? 0.9 : 0.55)
        .setStrokeStyle(selected ? 3 : 2, 0x4de3ff, selected ? 1 : 0.5);
      const label = this.add.text(x, y - 50, cfg.label, {
        fontFamily: 'Arial Black, Arial', fontSize: '20px', color: selected ? TEXT_HEX : TEXT_DIM,
      }).setOrigin(0.5);
      const desc = this.add.text(x, y + 10, DIFFICULTY_DESCRIPTIONS[key], {
        fontFamily: 'Arial', fontSize: '13px', color: '#7aa8b8', align: 'center', wordWrap: { width: cellW - 44 },
      }).setOrigin(0.5);

      box.setInteractive({ useHandCursor: true });
      box.on('pointerdown', () => {
        setPref(this, 'difficultyIndex', i);
        this.renderView();
      });

      this.viewContent.add([box, label, desc]);
    });

    const toggleY = GAME_HEIGHT / 2 + 130;
    const toggleBox = this.add.rectangle(GAME_WIDTH / 2, toggleY, 260, 56, 0x081018, 0.85)
      .setStrokeStyle(2, prefs.autoFire ? 0x4de3ff : 0x2a4a55, prefs.autoFire ? 1 : 0.6);
    const toggleLabel = this.add.text(GAME_WIDTH / 2, toggleY, `AUTO FIRE: ${prefs.autoFire ? 'ON' : 'OFF'}`, {
      fontFamily: 'Arial Black, Arial', fontSize: '16px', color: prefs.autoFire ? TEXT_HEX : TEXT_DIM,
    }).setOrigin(0.5);
    toggleBox.setInteractive({ useHandCursor: true });
    toggleBox.on('pointerdown', () => this.toggleAutoFire());
    this.viewContent.add([toggleBox, toggleLabel]);

    this.renderBackButton();
  }

  renderInputView() {
    const prefs = getPrefs(this);
    const cellW = GAME_WIDTH / INPUT_TYPES.length;
    const y = GAME_HEIGHT / 2 - 60;
    const w = cellW - 24;
    const h = 150;

    INPUT_TYPES.forEach((key, i) => {
      const x = cellW * (i + 0.5);
      const selected = key === prefs.inputType;

      const box = this.add.rectangle(x, y, w, h, 0x081018, selected ? 0.9 : 0.55)
        .setStrokeStyle(selected ? 3 : 2, 0x4de3ff, selected ? 1 : 0.5);
      const label = this.add.text(x, y - 40, key.toUpperCase(), {
        fontFamily: 'Arial Black, Arial', fontSize: '20px', color: selected ? TEXT_HEX : TEXT_DIM,
      }).setOrigin(0.5);
      const desc = this.add.text(x, y + 10, INPUT_DESCRIPTIONS[key], {
        fontFamily: 'Arial', fontSize: '12px', color: '#7aa8b8', align: 'center', wordWrap: { width: cellW - 44 },
      }).setOrigin(0.5);

      box.setInteractive({ useHandCursor: true });
      box.on('pointerdown', () => {
        setPref(this, 'inputType', key);
        this.renderView();
      });

      this.viewContent.add([box, label, desc]);
    });

    this.renderBackButton();
  }

  update(time, dt) {
    this.starfield.update(dt);
  }
}
