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

  4: {
    powerUps: {
      allowedTypes: ['weapon', 'health', 'rocket', 'shield', 'bomb', 'emp', 'life'],
    },

    shipHp: {
      basic: 24,
      fast: 17,
      heavy: 70,
      sniper: 29,
      swarm: 10,
      elite: 90,
      scout: 12,
      hornet: 14,
      dragonfly: 22,
      carrier: 34,
      boss: 6500,
    },

    environmentSpawnChance: 0.35,

    // Combines every hazard type introduced across Missions 1-3 (spread
    // bullets, missiles, mines, laser sweep, meteor walls) instead of a new
    // single theme -- see src/entities/bossPatterns/Mission4Pattern.js.
    bossPattern: 4,

    // 4 phases instead of the usual 3 (see spec's Phase1/2/3/Final Phase) --
    // Boss.js reads this array generically: phase N+1 starts once hp drops
    // to thresholds[N-1] * maxHp. Tuned so each phase gets a meaningful
    // window rather than being skipped in a single burst of damage.
    bossPhaseThresholds: [0.75, 0.45, 0.20],
    // One extra entry vs the default 3-phase [70,130,170] -- Final Phase
    // sweeps fastest to match its "shorter cooldowns, more aggressive" spec.
    bossSweepSpeeds: [70, 120, 165, 210],

    // Pre-boss timeline (WaveManager.buildMission4Timeline) ends with
    // enemies stopping cold and a warning banner before the boss enters --
    // see HUDScene's boss-warning banner / WaveManager's bossWarningMs.
    bossWarning: true,

    meteorShower: {
      enabled: true,
      triggerAtFraction: 0.35, // Meteor Field starts early (0:30-1:00 of a 2:30 pre-boss run)
      durationMs: 9000,
      count: 16,
      intervalMs: 400,
      enemyThinning: 0.35,
    },
  },

  5: {
    powerUps: {
      allowedTypes: ['weapon', 'health', 'rocket', 'shield', 'bomb', 'emp', 'life'],
    },

    shipHp: {
      basic: 26,
      fast: 18,
      heavy: 75,
      sniper: 31,
      swarm: 11,
      elite: 95,
      scout: 13,
      hornet: 15,
      dragonfly: 24,
      carrier: 36,
      boss: 8000,
    },

    environmentSpawnChance: 0.35,

    // Own end boss theme (bossPatterns/Mission5Pattern.js): twin cannons /
    // spread shot plus a straight laser beam signature attack -- separate
    // from the mid-boss encounter (WaveManager.buildMission5Timeline's
    // spawnMidBoss step) this mission also introduces.
    bossPattern: 5,

    bossWarning: true,

    meteorShower: {
      enabled: true,
      triggerAtFraction: 0.4,
      durationMs: 10000,
      count: 18,
      intervalMs: 380,
      enemyThinning: 0.4,
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
