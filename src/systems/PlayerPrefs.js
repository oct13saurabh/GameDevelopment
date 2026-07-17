import { DIFFICULTY_ORDER, DEFAULT_DIFFICULTY, DEFAULT_INPUT_TYPE, DEFAULT_AUTO_FIRE } from '../config.js';

// Registry-backed prefs (Phaser's registry persists across scene stop/start,
// same pattern already used for availableShips/enemyDesigns elsewhere) --
// MenuScene's PLAY reads whatever OptionsScene last wrote here, instead of
// each scene keeping its own local copy that could go stale.
const REGISTRY_KEY = 'playerPrefs';

function defaults() {
  return {
    shipIndex: 0,
    difficultyIndex: Math.max(DIFFICULTY_ORDER.indexOf(DEFAULT_DIFFICULTY), 0),
    inputType: DEFAULT_INPUT_TYPE,
    autoFire: DEFAULT_AUTO_FIRE,
  };
}

export function getPrefs(scene) {
  let prefs = scene.registry.get(REGISTRY_KEY);
  if (!prefs) {
    prefs = defaults();
    scene.registry.set(REGISTRY_KEY, prefs);
  }
  return prefs;
}

export function setPref(scene, key, value) {
  const prefs = getPrefs(scene);
  prefs[key] = value;
  return prefs;
}

// Guards against a stale index if availableShips length ever differs from
// what was true when the index was chosen.
export function clampShipIndex(prefs, ships) {
  return Phaser.Math.Clamp(prefs.shipIndex, 0, Math.max(ships.length - 1, 0));
}
