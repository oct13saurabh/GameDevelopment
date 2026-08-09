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
const ENVIRONMENT_ROOT = path.join(BACKGROUND_ROOT, 'Environment');
const BOSS_ROOT = path.join(ROOT, 'BossShip');
const ANIMATION_ROOT = path.join(ROOT, 'Animation');
const PLATFORM_ROOT = path.join(ROOT, 'Platform');
const ENEMY_CATEGORIES = ['RandomShips', 'EnemyPowerUpDrop'];
// PlayerShip files: {Name}_{NN}-{1|2}.png -- "1" is idle, "2" is banking/move.
// Name is taken as the display name (e.g. F-35_03-1.png -> "F-35").
const PLAYER_SHIP_RE = /^(.+)_(\d+)-([12])\.png$/i;
// Environment object files: {anything}_{Small|Medium|Big}.{png|jpg} -- prefix is
// a free-form ID with no meaning, suffix is the display size.
const ENVIRONMENT_OBJECT_RE = /^(.+)_(VerySmall|Small|Medium|Big)\.(png|jpg)$/i;
// Canonical casing lookup -- match[2] is matched case-insensitively, but the
// canonical form (matching ENVIRONMENT_OBJECTS.bySize's keys in config.js)
// needs "VerySmall"'s internal capital S preserved, which a naive
// charAt(0).toUpperCase()+rest.toLowerCase() would mangle into "Verysmall".
const SIZE_CANONICAL = { verysmall: 'VerySmall', small: 'Small', medium: 'Medium', big: 'Big' };
const canonicalSize = (raw) => SIZE_CANONICAL[raw.toLowerCase()];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg'];

function listPngs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png')).sort();
}

function listImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) =>
    IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase())
  ).sort();
}

// Background/Mission N folders: mission-specific backdrop images, picked
// randomly at runtime. File count/names vary per mission, so list per folder.
// Size suffix (_Small/_Medium/_Big) is optional here for backward compat with
// pre-existing unsuffixed files -- those default to Medium.
function scanBackgroundFolders() {
  if (!fs.existsSync(BACKGROUND_ROOT)) return {};
  const folders = fs.readdirSync(BACKGROUND_ROOT).filter((f) =>
    f !== 'Environment' && fs.statSync(path.join(BACKGROUND_ROOT, f)).isDirectory()
  );
  const result = {};
  for (const folder of folders) {
    const entries = [];
    for (const file of listImages(path.join(BACKGROUND_ROOT, folder))) {
      const match = file.match(ENVIRONMENT_OBJECT_RE);
      const size = match ? canonicalSize(match[2]) : 'Medium';
      entries.push({ file, size });
    }
    result[folder] = entries;
  }
  return result;
}

// Background/Environment/{Default|Mission N} folders: random decorative objects
// (planets, etc). Each filename encodes its size via a mandatory suffix.
function scanEnvironmentFolders() {
  if (!fs.existsSync(ENVIRONMENT_ROOT)) return {};
  const folders = fs.readdirSync(ENVIRONMENT_ROOT).filter((f) =>
    fs.statSync(path.join(ENVIRONMENT_ROOT, f)).isDirectory()
  );
  const result = {};
  for (const folder of folders) {
    const entries = [];
    for (const file of listImages(path.join(ENVIRONMENT_ROOT, folder))) {
      const match = file.match(ENVIRONMENT_OBJECT_RE);
      if (!match) {
        console.warn(`Skipping ${folder}/${file}: missing _Small/_Medium/_Big size suffix`);
        continue;
      }
      entries.push({ file, size: canonicalSize(match[2]) });
    }
    result[folder] = entries;
  }
  return result;
}

// BossShip/{Default|Mission N} folders: each holds exactly one boss art file,
// any filename -- listed here so BootScene can load it by name instead of
// assuming a fixed 'boss_ship.png' (mission folders don't all share one name).
// A 'Destroy' subfolder (optional, 5 numbered frames) is a damage-stage
// flipbook played as the boss nears/reaches death -- empty when not yet added.
function scanBossFolders() {
  if (!fs.existsSync(BOSS_ROOT)) return {};
  const folders = fs.readdirSync(BOSS_ROOT).filter((f) =>
    fs.statSync(path.join(BOSS_ROOT, f)).isDirectory()
  );
  const result = {};
  for (const folder of folders) {
    result[folder] = {
      art: listImages(path.join(BOSS_ROOT, folder)),
      destroy: listImages(path.join(BOSS_ROOT, folder, 'Destroy')),
    };
  }
  return result;
}

// Train/Train_NN folders: each holds one train art file plus an optional
// 'Destroy' subfolder (5 numbered frames), same convention as BossShip.
function scanTrainFolders() {
  if (!fs.existsSync(TRAIN_ROOT)) return {};
  const folders = fs.readdirSync(TRAIN_ROOT).filter((f) =>
    fs.statSync(path.join(TRAIN_ROOT, f)).isDirectory()
  );
  const result = {};
  for (const folder of folders) {
    const art = listImages(path.join(TRAIN_ROOT, folder));
    result[folder] = {
      art: art[0] || null,
      destroy: listImages(path.join(TRAIN_ROOT, folder, 'Destroy')),
    };
  }
  return result;
}

// Animation/{Name} folders: shared flipbook effects (e.g. BigBlast) not tied
// to any specific ship/mission.
function scanAnimationFolders() {
  if (!fs.existsSync(ANIMATION_ROOT)) return {};
  const folders = fs.readdirSync(ANIMATION_ROOT).filter((f) =>
    fs.statSync(path.join(ANIMATION_ROOT, f)).isDirectory()
  );
  const result = {};
  for (const folder of folders) {
    result[folder] = listImages(path.join(ANIMATION_ROOT, folder));
  }
  return result;
}

// Platform/ folder: single takeoff-platform art file for the launch scene.
function scanPlatform() {
  const files = listImages(PLATFORM_ROOT);
  return files[0] || null;
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
  train: scanTrainFolders(),
  playerShip: scanPlayerShips(),
  background: { ...scanBackgroundFolders(), environment: scanEnvironmentFolders() },
  bossShip: scanBossFolders(),
  animation: scanAnimationFolders(),
  platform: scanPlatform(),
};

fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Wrote GameAssets/manifest.json');
console.log(JSON.stringify(manifest, null, 2));
