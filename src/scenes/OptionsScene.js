import {
  GAME_WIDTH, GAME_HEIGHT, SHIPS_FALLBACK,
  DIFFICULTY, DIFFICULTY_ORDER,
  INPUT_TYPES,
} from '../config.js';
import Starfield from '../systems/Starfield.js';
import { ACCENT_HEX, TEXT_HEX, drawBeveledPanel, drawCornerBrackets, buildVerticalMenu } from '../systems/UITheme.js';
import { getPrefs, setPref } from '../systems/PlayerPrefs.js';

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

const AUTO_FIRE_DESCRIPTIONS = {
  true: 'Weapon fires continuously without holding the fire key/button.',
  false: 'Fire key/button must be held (or tapped) to shoot.',
};

const TEXT_DIM = '#5a8a9a';
const ROW_WIDTH = 560;
const ROW_HEIGHT = 64;
const ROW_GAP = 14;

// Flat settings page -- four arrow-cycle rows (DIFFICULTY / GAMEPLAY /
// PLAYER SHIP / INPUT): each shows "< VALUE >", tap/click an arrow (or Left/
// Right when a row has focus) to step through that category's values in
// place, wrapping at the ends. A short description sits under each row's
// value; Player Ship instead gets a persistent big preview of the selected
// ship below the whole stack.
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

    const title = this.add.text(GAME_WIDTH / 2, 34, 'OPTIONS', {
      fontFamily: 'Arial Black, Arial', fontSize: '26px', color: '#eafdff',
    }).setOrigin(0.5);
    title.setShadow(0, 0, ACCENT_HEX, 8, false, true);

    this.viewContent = this.add.container(0, 0);
    this.renderView();

    this.input.keyboard.on('keydown-ESC', () => this.scene.start('MenuScene', { audio: this.audio }));
    this.input.keyboard.on('keydown-BACKSPACE', () => this.scene.start('MenuScene', { audio: this.audio }));

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 20, 'TAP ◀ ▶ TO CYCLE A VALUE  •  BACKSPACE/ESC BACK', {
      fontFamily: 'Arial', fontSize: '13px', color: '#3a7a8a',
    }).setOrigin(0.5);
  }

  categories() {
    const prefs = getPrefs(this);
    return [
      {
        key: 'difficulty',
        label: 'DIFFICULTY',
        valueLabel: DIFFICULTY[DIFFICULTY_ORDER[prefs.difficultyIndex]].label,
        description: DIFFICULTY_DESCRIPTIONS[DIFFICULTY_ORDER[prefs.difficultyIndex]],
        length: DIFFICULTY_ORDER.length,
        selectedIndex: prefs.difficultyIndex,
        onPick: (i) => setPref(this, 'difficultyIndex', i),
      },
      {
        key: 'gameplay',
        label: 'GAMEPLAY',
        valueLabel: `AUTO FIRE: ${prefs.autoFire ? 'ON' : 'OFF'}`,
        description: AUTO_FIRE_DESCRIPTIONS[String(prefs.autoFire)],
        length: 2,
        selectedIndex: prefs.autoFire ? 1 : 0,
        onPick: (i) => setPref(this, 'autoFire', i === 1),
      },
      {
        key: 'ship',
        label: 'PLAYER SHIP',
        valueLabel: this.ships[prefs.shipIndex].name,
        description: null,
        length: this.ships.length,
        selectedIndex: prefs.shipIndex,
        onPick: (i) => setPref(this, 'shipIndex', i),
      },
      {
        key: 'input',
        label: 'INPUT',
        valueLabel: prefs.inputType.toUpperCase(),
        description: INPUT_DESCRIPTIONS[prefs.inputType],
        length: INPUT_TYPES.length,
        selectedIndex: INPUT_TYPES.indexOf(prefs.inputType),
        onPick: (i) => setPref(this, 'inputType', INPUT_TYPES[i]),
      },
    ];
  }

  cycle(cat, delta) {
    const next = (cat.selectedIndex + delta + cat.length) % cat.length;
    cat.onPick(next);
    this.renderView();
  }

  renderView() {
    this.viewContent.removeAll(true);
    let y = 100 + ROW_HEIGHT / 2;
    for (const cat of this.categories()) {
      this.renderCategoryRow(y, cat);
      y += ROW_HEIGHT + ROW_GAP;
    }
    // y is now one step past the last row's center -- back it off to that
    // row's actual bottom edge before adding the preview's own margin.
    const rowsBottomEdge = y - ROW_GAP - ROW_HEIGHT / 2;
    this.renderShipPreview(rowsBottomEdge + 16);
    this.renderBackButton();
  }

  renderCategoryRow(y, cat) {
    const x = GAME_WIDTH / 2;
    // Value sits in a fixed-width centered slot flanked by the two arrows --
    // its position never depends on the value string's own width, so a long
    // value (KEYBOARD, AUTO FIRE: ON) can't grow into and overlap an arrow.
    const rowRight = x + ROW_WIDTH / 2;
    const rightArrowX = rowRight - 24;
    const leftArrowX = rowRight - 24 - 190;
    const valueX = (leftArrowX + rightArrowX) / 2;

    const panel = drawBeveledPanel(this, x - ROW_WIDTH / 2, y - ROW_HEIGHT / 2, ROW_WIDTH, ROW_HEIGHT, { chamfer: 8 });
    const label = this.add.text(x - ROW_WIDTH / 2 + 20, y - 16, cat.label, {
      fontFamily: 'Arial Black, Arial', fontSize: '15px', color: TEXT_HEX,
    }).setOrigin(0, 0.5);

    const value = this.add.text(valueX, y - 16, cat.valueLabel, {
      fontFamily: 'Arial', fontSize: '15px', color: TEXT_DIM,
    }).setOrigin(0.5);

    const leftArrow = this.add.text(leftArrowX, y - 16, '◀', {
      fontFamily: 'Arial Black, Arial', fontSize: '16px', color: ACCENT_HEX,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const rightArrow = this.add.text(rightArrowX, y - 16, '▶', {
      fontFamily: 'Arial Black, Arial', fontSize: '16px', color: ACCENT_HEX,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    leftArrow.on('pointerdown', () => this.cycle(cat, -1));
    rightArrow.on('pointerdown', () => this.cycle(cat, 1));

    const objs = [panel, label, value, leftArrow, rightArrow];
    if (cat.description) {
      const desc = this.add.text(x, y + 14, cat.description, {
        fontFamily: 'Arial', fontSize: '11px', color: '#7aa8b8', align: 'center', wordWrap: { width: ROW_WIDTH - 40 },
      }).setOrigin(0.5);
      objs.push(desc);
    }
    this.viewContent.add(objs);
  }

  // Player Ship's picklist shows its selection here -- a persistent big
  // preview below the whole row stack, always current with whatever the
  // ship row's arrows just picked.
  renderShipPreview(topY) {
    const prefs = getPrefs(this);
    const x = GAME_WIDTH / 2;
    const ship = this.ships[prefs.shipIndex];
    // Baked ship texture is 320x480 (see BootScene.bakePlayerShipTextures) --
    // at this scale that's ~169px tall, so center it that far below topY.
    const cy = topY + 85;
    const sprite = this.add.image(x, cy, `${ship.key}_idle`).setScale(0.352);
    const label = this.add.text(x, cy + 95, ship.name, {
      fontFamily: 'Arial Black, Arial', fontSize: '16px', color: TEXT_HEX,
    }).setOrigin(0.5);
    this.viewContent.add([sprite, label]);
  }

  renderBackButton() {
    buildVerticalMenu(this, {
      x: GAME_WIDTH / 2, y: GAME_HEIGHT - 66, width: 180, height: 40, gap: 0,
      container: this.viewContent,
      items: [{ label: 'BACK', onSelect: () => this.scene.start('MenuScene', { audio: this.audio }) }],
    });
  }

  update(time, dt) {
    this.starfield.update(dt);
  }
}
