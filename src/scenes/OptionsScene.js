import {
  GAME_WIDTH, GAME_HEIGHT, SHIPS_FALLBACK,
  DIFFICULTY, DIFFICULTY_ORDER, DEFAULT_DIFFICULTY,
  INPUT_TYPES, DEFAULT_INPUT_TYPE, DEFAULT_AUTO_FIRE,
} from '../config.js';
import Starfield from '../systems/Starfield.js';

const MAX_SHIP_COLUMNS = 5;
const TABS = [
  { key: 'ship', label: 'AIRCRAFT' },
  { key: 'difficulty', label: 'DIFFICULTY' },
  { key: 'input', label: 'INPUT' },
];

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

// Combined options screen: Aircraft / Difficulty / Input tabs, plus an
// Auto Fire toggle on the Input tab. SPACE (or the LAUNCH button) confirms
// whatever is currently selected across all three tabs and starts the game.
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

    const ships = this.registry.get('availableShips');
    this.ships = ships && ships.length ? ships : SHIPS_FALLBACK;

    this.state = {
      shipIndex: 0,
      difficultyIndex: Math.max(DIFFICULTY_ORDER.indexOf(DEFAULT_DIFFICULTY), 0),
      inputType: DEFAULT_INPUT_TYPE,
      autoFire: DEFAULT_AUTO_FIRE,
    };
    this.activeTab = 0;

    this.add.text(GAME_WIDTH / 2, 34, 'OPTIONS', {
      fontFamily: 'Arial Black, Arial', fontSize: '26px', color: '#ffffff',
    }).setOrigin(0.5);

    this.buildTabBar();
    this.tabContent = this.add.container(0, 0);
    this.renderTab();

    const isTouchDevice = this.sys.game.device.input.touch;

    // LAUNCH button: the only way to confirm on a touchscreen (no SPACE
    // key), and a convenience click target on desktop alongside SPACE.
    const launchY = GAME_HEIGHT - (isTouchDevice ? 56 : 30);
    const launchBg = this.add.rectangle(GAME_WIDTH / 2, launchY, 180, 46, 0x1a4422, 0.9)
      .setStrokeStyle(2, 0x66ff88)
      .setInteractive({ useHandCursor: true });
    this.add.text(GAME_WIDTH / 2, launchY, 'LAUNCH', {
      fontFamily: 'Arial Black, Arial', fontSize: '18px', color: '#aaffaa',
    }).setOrigin(0.5);
    launchBg.on('pointerdown', () => this.confirm());

    this.prompt = this.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT - 30,
      isTouchDevice ? 'TAP A CATEGORY TO SWITCH  •  TAP AN OPTION TO CHOOSE' : '1-3 CATEGORY  •  ARROWS CHOOSE  •  SPACE LAUNCH',
      { fontFamily: 'Arial', fontSize: '14px', color: '#ffdd55' }
    ).setOrigin(0.5);
    this.tweens.add({
      targets: this.prompt,
      alpha: { from: 1, to: 0.2 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    this.input.keyboard.on('keydown-ONE', () => this.setTab(0));
    this.input.keyboard.on('keydown-TWO', () => this.setTab(1));
    this.input.keyboard.on('keydown-THREE', () => this.setTab(2));
    this.input.keyboard.on('keydown-LEFT', () => this.moveSelection(-1));
    this.input.keyboard.on('keydown-A', () => this.moveSelection(-1));
    this.input.keyboard.on('keydown-RIGHT', () => this.moveSelection(1));
    this.input.keyboard.on('keydown-D', () => this.moveSelection(1));
    this.input.keyboard.on('keydown-UP', () => this.moveSelection(-this.upDownStride()));
    this.input.keyboard.on('keydown-W', () => this.moveSelection(-this.upDownStride()));
    this.input.keyboard.on('keydown-DOWN', () => this.moveSelection(this.upDownStride()));
    this.input.keyboard.on('keydown-S', () => this.moveSelection(this.upDownStride()));
    this.input.keyboard.once('keydown-SPACE', () => this.confirm());
  }

  buildTabBar() {
    const cellW = GAME_WIDTH / TABS.length;
    const y = 78;
    this.tabButtons = TABS.map((tab, i) => {
      const x = cellW * (i + 0.5);
      const box = this.add.rectangle(x, y, cellW - 16, 40, 0x111133, 0.6).setStrokeStyle(2, 0x334466);
      const label = this.add.text(x, y, tab.label, {
        fontFamily: 'Arial Black, Arial', fontSize: '15px', color: '#cddcff',
      }).setOrigin(0.5);
      box.setInteractive({ useHandCursor: true });
      box.on('pointerdown', () => this.setTab(i));
      return { box, label };
    });
    this.refreshTabBar();
  }

  refreshTabBar() {
    this.tabButtons.forEach((btn, i) => {
      const active = i === this.activeTab;
      btn.box.setStrokeStyle(active ? 3 : 2, active ? 0x66ccff : 0x334466);
      btn.box.setFillStyle(0x111133, active ? 0.9 : 0.6);
      btn.label.setColor(active ? '#ffffff' : '#8899aa');
    });
  }

  setTab(index) {
    if (index === this.activeTab) return;
    this.activeTab = index;
    this.refreshTabBar();
    this.renderTab();
  }

  upDownStride() {
    // Ship grid wraps at MAX_SHIP_COLUMNS; the other tabs are single-row.
    return this.activeTab === 0 ? Math.min(this.ships.length, MAX_SHIP_COLUMNS) : 1;
  }

  moveSelection(delta) {
    const tabKey = TABS[this.activeTab].key;
    if (tabKey === 'ship') {
      const next = this.state.shipIndex + delta;
      if (next < 0 || next >= this.ships.length) return;
      this.state.shipIndex = next;
    } else if (tabKey === 'difficulty') {
      const next = this.state.difficultyIndex + delta;
      if (next < 0 || next >= DIFFICULTY_ORDER.length) return;
      this.state.difficultyIndex = next;
    } else if (tabKey === 'input') {
      const idx = INPUT_TYPES.indexOf(this.state.inputType);
      const next = idx + (delta > 0 ? 1 : delta < 0 ? -1 : 0);
      if (next < 0 || next >= INPUT_TYPES.length) return;
      this.state.inputType = INPUT_TYPES[next];
    }
    this.renderTab();
  }

  toggleAutoFire() {
    this.state.autoFire = !this.state.autoFire;
    this.renderTab();
  }

  renderTab() {
    this.tabContent.removeAll(true);
    const tabKey = TABS[this.activeTab].key;
    if (tabKey === 'ship') this.renderShipTab();
    else if (tabKey === 'difficulty') this.renderDifficultyTab();
    else this.renderInputTab();
  }

  renderShipTab() {
    const columns = Math.min(this.ships.length, MAX_SHIP_COLUMNS);
    const rows = Math.ceil(this.ships.length / columns);
    const gridTop = 130;
    const gridBottom = GAME_HEIGHT - 90;
    const cellW = (GAME_WIDTH - 30) / columns;
    const cellH = (gridBottom - gridTop) / rows;
    const boxW = Math.min(140, cellW - 12);
    const boxH = Math.min(170, cellH - 12);
    const spriteScale = Phaser.Math.Clamp(0.11 * (boxW / 140), 0.05, 0.11);

    this.ships.forEach((ship, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = 15 + cellW * (col + 0.5);
      const y = gridTop + cellH * (row + 0.5);
      const selected = i === this.state.shipIndex;

      const box = this.add.rectangle(x, y, boxW, boxH, 0x111133, selected ? 0.9 : 0.6)
        .setStrokeStyle(selected ? 3 : 2, selected ? 0x66ccff : 0x334466);
      const sprite = this.add.image(x, y - boxH * 0.12, `${ship.key}_idle`)
        .setScale(selected ? spriteScale * 1.15 : spriteScale);
      const label = this.add.text(x, y + boxH * 0.38, ship.name, {
        fontFamily: 'Arial', fontSize: '13px', color: '#cddcff',
      }).setOrigin(0.5);

      box.setInteractive({ useHandCursor: true });
      box.on('pointerdown', () => {
        this.state.shipIndex = i;
        this.renderTab();
      });

      this.tabContent.add([box, sprite, label]);
    });
  }

  renderDifficultyTab() {
    const cellW = GAME_WIDTH / DIFFICULTY_ORDER.length;
    const y = GAME_HEIGHT / 2 - 10;

    DIFFICULTY_ORDER.forEach((key, i) => {
      const x = cellW * (i + 0.5);
      const cfg = DIFFICULTY[key];
      const selected = i === this.state.difficultyIndex;

      const box = this.add.rectangle(x, y, cellW - 24, 190, 0x111133, selected ? 0.9 : 0.6)
        .setStrokeStyle(selected ? 3 : 2, selected ? 0x66ccff : 0x334466);
      const label = this.add.text(x, y - 55, cfg.label, {
        fontFamily: 'Arial Black, Arial', fontSize: '20px', color: '#ffffff',
      }).setOrigin(0.5);
      const desc = this.add.text(x, y + 10, DIFFICULTY_DESCRIPTIONS[key], {
        fontFamily: 'Arial', fontSize: '13px', color: '#aabbdd', align: 'center', wordWrap: { width: cellW - 44 },
      }).setOrigin(0.5);

      box.setInteractive({ useHandCursor: true });
      box.on('pointerdown', () => {
        this.state.difficultyIndex = i;
        this.renderTab();
      });

      this.tabContent.add([box, label, desc]);
    });
  }

  renderInputTab() {
    const cellW = GAME_WIDTH / INPUT_TYPES.length;
    const y = GAME_HEIGHT / 2 - 100;

    INPUT_TYPES.forEach((key, i) => {
      const x = cellW * (i + 0.5);
      const selected = key === this.state.inputType;

      const box = this.add.rectangle(x, y, cellW - 24, 150, 0x111133, selected ? 0.9 : 0.6)
        .setStrokeStyle(selected ? 3 : 2, selected ? 0x66ccff : 0x334466);
      const label = this.add.text(x, y - 40, key.toUpperCase(), {
        fontFamily: 'Arial Black, Arial', fontSize: '20px', color: '#ffffff',
      }).setOrigin(0.5);
      const desc = this.add.text(x, y + 10, INPUT_DESCRIPTIONS[key], {
        fontFamily: 'Arial', fontSize: '12px', color: '#aabbdd', align: 'center', wordWrap: { width: cellW - 44 },
      }).setOrigin(0.5);

      box.setInteractive({ useHandCursor: true });
      box.on('pointerdown', () => {
        this.state.inputType = key;
        this.renderTab();
      });

      this.tabContent.add([box, label, desc]);
    });

    const toggleY = GAME_HEIGHT / 2 + 100;
    const toggleBox = this.add.rectangle(GAME_WIDTH / 2, toggleY, 260, 60, 0x111133, 0.6)
      .setStrokeStyle(2, this.state.autoFire ? 0x66ccff : 0x334466);
    const toggleLabel = this.add.text(GAME_WIDTH / 2, toggleY, `AUTO FIRE: ${this.state.autoFire ? 'ON' : 'OFF'}`, {
      fontFamily: 'Arial Black, Arial', fontSize: '16px', color: this.state.autoFire ? '#88ffaa' : '#888899',
    }).setOrigin(0.5);
    toggleBox.setInteractive({ useHandCursor: true });
    toggleBox.on('pointerdown', () => this.toggleAutoFire());
    this.input.keyboard.removeAllListeners('keydown-F');
    this.input.keyboard.on('keydown-F', () => this.toggleAutoFire());

    this.tabContent.add([toggleBox, toggleLabel]);
  }

  confirm() {
    if (this.launched) return;
    this.launched = true;
    this.audio.resume();
    const shipKey = this.ships[this.state.shipIndex].key;
    const difficulty = DIFFICULTY_ORDER[this.state.difficultyIndex];
    this.scene.start('GameScene', {
      audio: this.audio,
      shipKey,
      difficulty,
      inputType: this.state.inputType,
      autoFire: this.state.autoFire,
    });
  }

  update(time, dt) {
    this.starfield.update(dt);
  }
}
