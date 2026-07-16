// Scans GameAssets/EnemyShip, GameAssets/Train and GameAssets/PlayerShip and
// writes GameAssets/manifest.json -- a plain filename listing the browser
// can fetch at runtime, since client-side JS can't list a folder's contents
// itself.
//
// Run this after adding/removing any enemy ship, train, or player ship art:
//   node scripts/generate-asset-manifest.js
//
// No other code changes needed -- BootScene reads the manifest and probes
// exactly the filenames it lists.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'GameAssets');
const ENEMY_ROOT = path.join(ROOT, 'EnemyShip');
const TRAIN_ROOT = path.join(ROOT, 'Train');
const PLAYER_SHIP_ROOT = path.join(ROOT, 'PlayerShip');
const BACKGROUND_ROOT = path.join(ROOT, 'Background');
const ENEMY_CATEGORIES = ['RandomShips', 'EnemyPowerUpDrop'];
// PlayerShip files: {Name}_{NN}-{1|2}.png -- "1" is idle, "2" is banking/move.
// Name is taken as the display name (e.g. F-35_03-1.png -> "F-35").
const PLAYER_SHIP_RE = /^(.+)_(\d+)-([12])\.png$/i;
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg'];

function listPngs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png'));
}

function listImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) =>
    IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase())
  );
}

// Background/Mission N folders: mission-specific backdrop images, picked
// randomly at runtime. File count/names vary per mission, so list per folder.
function scanBackgroundFolders() {
  if (!fs.existsSync(BACKGROUND_ROOT)) return {};
  const folders = fs.readdirSync(BACKGROUND_ROOT).filter((f) =>
    fs.statSync(path.join(BACKGROUND_ROOT, f)).isDirectory()
  );
  const result = {};
  for (const folder of folders) {
    result[folder] = listImages(path.join(BACKGROUND_ROOT, folder));
  }
  return result;
}

function scanEnemyCategory(category) {
  const categoryDir = path.join(ENEMY_ROOT, category);
  if (!fs.existsSync(categoryDir)) return {};
  const folders = fs.readdirSync(categoryDir).filter((f) =>
    fs.statSync(path.join(categoryDir, f)).isDirectory()
  );
  const result = {};
  for (const folder of folders) {
    result[folder] = listPngs(path.join(categoryDir, folder));
  }
  return result;
}

function scanPlayerShips() {
  const sets = {}; // "{name}_{index}" -> { name, idle, move }
  for (const file of listPngs(PLAYER_SHIP_ROOT)) {
    const match = file.match(PLAYER_SHIP_RE);
    if (!match) continue;
    const [, name, index, state] = match;
    const setId = `${name}_${index}`;
    sets[setId] = sets[setId] || { name, idle: null, move: null };
    if (state === '1') sets[setId].idle = file;
    else sets[setId].move = file;
  }
  return Object.values(sets).filter((s) => s.idle && s.move);
}

const manifest = {
  enemyShip: Object.fromEntries(ENEMY_CATEGORIES.map((c) => [c, scanEnemyCategory(c)])),
  train: listPngs(TRAIN_ROOT),
  playerShip: scanPlayerShips(),
  background: scanBackgroundFolders(),
};

fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Wrote GameAssets/manifest.json');
console.log(JSON.stringify(manifest, null, 2));
