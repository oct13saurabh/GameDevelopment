// Shared electric-cyan sci-fi HUD look for MenuScene + OptionsScene -- one
// palette and one set of drawing helpers so both screens read as the same
// system instead of each hand-rolling its own rectangles. Constant names are
// generic (not color-specific) so a future palette swap only touches the
// values here, not every import site.

export const ACCENT = 0x4de3ff;
export const ACCENT_DIM = 0x1a6a80;
export const ACCENT_HEX = '#4de3ff';
export const TEXT_HEX = '#bdf4ff';
export const PANEL_FILL = 0x081018;
export const PANEL_FILL_ACTIVE = 0x0f2230;
export const BRACKET_LEN = 26;
export const BRACKET_INSET = 18;

// Chamfered (corner-cut) rect path -- the beveled-metal-panel look shared by
// every button/card in the reference art, instead of plain rounded rects.
export function chamferedRectPath(g, x, y, w, h, c) {
  g.beginPath();
  g.moveTo(x + c, y);
  g.lineTo(x + w - c, y);
  g.lineTo(x + w, y + c);
  g.lineTo(x + w, y + h - c);
  g.lineTo(x + w - c, y + h);
  g.lineTo(x + c, y + h);
  g.lineTo(x, y + h - c);
  g.lineTo(x, y + c);
  g.closePath();
}

// Dark fill + double accent stroke (bright outer, dim inset) -- fakes a
// beveled metal edge without needing an actual bevel/lighting shader.
export function drawBeveledPanel(scene, x, y, w, h, { chamfer = 12, active = false, fillAlpha = 0.92 } = {}) {
  const g = scene.add.graphics();
  g.fillStyle(active ? PANEL_FILL_ACTIVE : PANEL_FILL, fillAlpha);
  chamferedRectPath(g, x, y, w, h, chamfer);
  g.fillPath();

  g.lineStyle(active ? 3 : 2, ACCENT, active ? 1 : 0.75);
  chamferedRectPath(g, x, y, w, h, chamfer);
  g.strokePath();

  g.lineStyle(1, ACCENT_DIM, 0.8);
  chamferedRectPath(g, x + 3, y + 3, w - 6, h - 6, Math.max(chamfer - 3, 0));
  g.strokePath();

  return g;
}

// Four L-shaped corner brackets framing the whole screen -- classic
// targeting-HUD device, reused by both scenes so the frame matches.
export function drawCornerBrackets(scene, width, height) {
  const g = scene.add.graphics();
  g.lineStyle(2, ACCENT, 0.7);
  const corners = [
    [BRACKET_INSET, BRACKET_INSET, 1, 1],
    [width - BRACKET_INSET, BRACKET_INSET, -1, 1],
    [BRACKET_INSET, height - BRACKET_INSET, 1, -1],
    [width - BRACKET_INSET, height - BRACKET_INSET, -1, -1],
  ];
  for (const [x, y, dx, dy] of corners) {
    g.beginPath();
    g.moveTo(x, y + BRACKET_LEN * dy);
    g.lineTo(x, y);
    g.lineTo(x + BRACKET_LEN * dx, y);
    g.strokePath();
  }
  return g;
}

const NUM_KEYS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'];

// Stack of chamfered beveled-panel buttons -- shared layout for MenuScene's
// root menu and OptionsScene's root/back menus, so neither hand-rolls its
// own button loop.
// `container`, when given, receives every drawn object (so the caller's
// `container.removeAll(true)` cleans it up on view switch); when omitted,
// objects are added straight to the scene (fine for a menu built once per
// scene instance).
// `bindKeys: true` binds NUM_KEYS[i] to items[i].onSelect directly -- only
// safe for call sites that build the menu once per scene lifetime. Screens
// that rebuild this menu repeatedly within one scene instance (view
// switches) should route keyboard centrally themselves instead, to avoid
// stacking duplicate keydown handlers.
export function buildVerticalMenu(scene, { x, y, width = 260, height = 56, gap = 16, items, container = null, bindKeys = false }) {
  items.forEach((item, i) => {
    const by = y + i * (height + gap);
    const panel = drawBeveledPanel(scene, x - width / 2, by - height / 2, width, height, { chamfer: 10 });
    const label = scene.add.text(x, by, item.label, {
      fontFamily: 'Arial Black, Arial', fontSize: '18px', color: TEXT_HEX,
    }).setOrigin(0.5);
    const hit = scene.add.rectangle(x, by, width, height, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => item.onSelect());
    if (container) container.add([panel, label, hit]);
    if (bindKeys && NUM_KEYS[i]) {
      scene.input.keyboard.on(`keydown-${NUM_KEYS[i]}`, () => item.onSelect());
    }
  });
}
