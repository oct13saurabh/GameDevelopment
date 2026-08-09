import { METEOR_SHOWER_DEFAULTS } from '../config.js';

// All mission-specific config in one place, keyed by mission number. Add a
// new mission by adding a new key here -- no other code changes needed.
export const MISSIONS = {
  1: {
    powerUps: {
      // Power-up types allowed to drop this mission (see POWERUP.weights in
      // config.js for the full type list and drop odds). Leave a type out
      // to disable it for this mission.
      allowedTypes: ['weapon', 'health', 'rocket', 'shield', 'bomb', 'emp', 'life'],
    },

    // Per-ship-type HP override for this mission. Omit a ship type to use
    // ENEMY_TYPES' default (see config.js).
    shipHp: {
      basic: 20,
      fast: 15,
      heavy: 60,
      sniper: 25,
      swarm: 8,
      elite: 80,
      scout: 10,
      hornet: 12,
      dragonfly: 18,
      carrier: 30,
      boss: 2000,
    },

    // Chance (0-1) that the random-decoration timer actually spawns a planet
    // on each tick (see ENVIRONMENT_OBJECTS.spawnIntervalMs in config.js).
    environmentSpawnChance: 0.35,

    // Which src/entities/bossPatterns/ module drives this mission's boss
    // attacks (see bossPatterns/index.js).
    bossPattern: 1,

    // On/off switch + timing for this mission's meteor-shower event (see
    // WaveManager.scheduleMeteorShower and METEOR_SHOWER_DEFAULTS in
    // config.js for what each field does / defaults to if omitted here).
    // Bumped denser/longer/faster than the shared defaults.
    meteorShower: {
      enabled: true,
      triggerAtFraction: 0.6,
      count: 26,
      durationMs: 12000,
      intervalMs: 350,
      enemyThinning: 0.65,
    },
  },

  2: {
    powerUps: {
      allowedTypes: ['weapon', 'health', 'rocket', 'shield', 'bomb', 'emp', 'life'],
    },

    shipHp: {
      basic: 20,
      fast: 15,
      heavy: 60,
      sniper: 25,
      swarm: 8,
      elite: 80,
      scout: 10,
      hornet: 12,
      dragonfly: 18,
      carrier: 30,
      boss: 4000,
    },

    environmentSpawnChance: 0.35,

    bossPattern: 2,

    // Slightly earlier/longer/denser than Mission 1 -- purely to demonstrate
    // the per-mission override; tune freely per mission.
    meteorShower: {
      enabled: true,
      triggerAtFraction: 0.55,
      durationMs: 11000,
      count: 20,
    },
  },

  3: {
    powerUps: {
      allowedTypes: ['weapon', 'health', 'rocket', 'shield', 'bomb', 'emp', 'life'],
    },

    shipHp: {
      basic: 22,
      fast: 16,
      heavy: 65,
      sniper: 27,
      swarm: 9,
      elite: 85,
      scout: 11,
      hornet: 13,
      dragonfly: 20,
      carrier: 32,
      boss: 5000,
    },

    environmentSpawnChance: 0.35,

    // Fire-themed boss -- flame-breath cone sweep, raining fire pools, ember
    // ring burst. See src/entities/bossPatterns/Mission3Pattern.js.
    bossPattern: 3,

    meteorShower: {
      enabled: true,
      triggerAtFraction: 0.55,
      durationMs: 11000,
      count: 22,
    },
  },
};

export function getMissionConfig(missionNumber) {
  return MISSIONS[missionNumber] || MISSIONS[1];
}

// Merges a mission's `meteorShower` block over METEOR_SHOWER_DEFAULTS so
// missions only need to specify the fields they want to override (e.g. just
// `{ enabled: false }` to turn it off entirely for that mission).
export function getMeteorShowerConfig(missionNumber) {
  const mission = getMissionConfig(missionNumber);
  return { ...METEOR_SHOWER_DEFAULTS, ...(mission.meteorShower || {}) };
}
