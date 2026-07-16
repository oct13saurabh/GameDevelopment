// Central tuning values for Mission 1.

export const GAME_WIDTH = 640;
export const GAME_HEIGHT = 720;

// Enemy ship art root (GameAssets/EnemyShip) is organized as:
//   {EnemyPowerUpDrop|RandomShips}/{Mission N|Default}/...
// RandomShips = everyday wave enemies (chance-based power-up drop, unchanged
// gameplay). EnemyPowerUpDrop = a dedicated "carrier" enemy that always
// drops a power-up on death. "Default" designs can spawn in any mission;
// "Mission N" designs are exclusive to that mission. CURRENT_MISSION picks
// which Mission-N folder is probed -- bump it (and drop in a new folder)
// when Mission 2 art arrives, no other code changes needed.
export const CURRENT_MISSION = 1;

export const PLAYER = {
  speed: 320,
  fireRate: 220, // ms between shots at weapon level 1
  fireRateMin: 110, // fastest fire rate at max weapon level
  startLives: 3,
  startHealth: 100,
  invulnMs: 1500,
  hitInvulnMs: 500,
  bulletSpeed: 560,
  bulletDamage: 10,
  scale: 0.045, // ship art is a large 1024x1536 source image, shared by all selectable ships
  hitboxRadius: 15, // on-screen pixel radius (converted per-entity to local units)
  tiltMaxDeg: 40, // simulated roll angle when strafing left/right (drives width foreshortening, not rotation)
  tiltLerp: 0.3, // per-frame smoothing toward the target roll
  tiltLeanPx: 8, // sideways lean into the turn, at max roll
  // Floaty/inertia movement (Descent/Asteroids-style drift) instead of
  // instant velocity snapping: velocity eases toward the input target each
  // frame. Accelerating is snappier than coasting to a stop -- the slower
  // decel lerp is what reads as "floating" once input is released.
  floatAccelLerp: 0.13,
  floatDecelLerp: 0.032,
};

// Fallback ship list used only if BootScene's runtime discovery (registry
// key 'availableShips' -- see BootScene.buildAvailableShips) comes back
// empty. Selectable ships are otherwise auto-discovered from however many
// Ship_0N-1/-2.png files exist in GameAssets/PlayerShip (up to 10).
export const SHIPS_FALLBACK = [{ key: 'ship_01', name: 'Ship 1' }];

// Shooting power-up ladder: a single flat 1-5 track. Each weapon power-up
// collected steps the level up by exactly 1 (regardless of its color),
// capping at level 5 -- bullet count matches the level 1:1. Collecting one
// more while already at level 5 triggers a mega blast instead (see
// Player.applyColorPowerUp / GameScene.triggerMegaBlast). The color of the
// powerup collected only changes bullet tint (Player.bulletColor), not how
// many levels are gained.
// spreadDeg stays 0 at every level -- bullets fire in straight parallel
// columns (separated by the fixed xOff spacing in Player.tryFire), not an
// angled V/fan.
export const WEAPON_LEVELS = [
  { level: 1, bulletCount: 1, spreadDeg: 0, fireRate: 220 },
  { level: 2, bulletCount: 2, spreadDeg: 0, fireRate: 195 },
  { level: 3, bulletCount: 3, spreadDeg: 0, fireRate: 170 },
  { level: 4, bulletCount: 4, spreadDeg: 0, fireRate: 145 },
  { level: 5, bulletCount: 5, spreadDeg: 0, fireRate: 130 },
];
export const WEAPON_MAX_LEVEL = WEAPON_LEVELS.length;

// Per-color fire pattern layered on top of WEAPON_LEVELS' bulletCount/
// fireRate (see Player.tryFire). Collecting a color power-up still just
// steps weaponLevel up by 1 (Player.applyColorPowerUp) -- color only picks
// which of these patterns is used to fire the level's bullet count.
export const WEAPON_COLOR_PATTERNS = {
  // Straight parallel columns (unchanged from the original single pattern).
  blue: { spreadDeg: 4, pierce: 0 },
  // Wide angled fan instead of parallel columns.
  yellow: { spreadDeg: 46, pierce: 0 },
  // Narrow/straight but pierces through enemies -- fewer targets needed to
  // clear a line, at the cost of no spread. At max weapon level it fires
  // almost back-to-back (see Player.tryFire's maxLevelFireRate override).
  red: { spreadDeg: 0, pierce: 2, maxLevelFireRate: 60 },
};

// hitboxRadius below is the DESIRED ON-SCREEN pixel radius of the collision
// circle. Entities convert it to local/unscaled units as radius / scale,
// since Phaser's Arcade circle body scales with the sprite automatically.
//
// Mission 1 uses a single shared ship model (enemy_b_*, a 64x64 source image
// with 5 banking frames -- see Enemy.js) for every enemy type; types are
// told apart by tint/scale/behavior rather than by silhouette. `texture`
// here is just the spawn/base frame -- Enemy.js swaps banking frames itself.
export const ENEMY_TYPES = {
  basic: {
    texture: 'enemy_b_m',
    hp: 20,
    speed: 85,
    scoreValue: 100,
    fireRate: 1800,
    bulletSpeed: 220,
    hitboxRadius: 12,
    scale: 0.56,
    tint: null,
    size: 'small',
  },
  fast: {
    texture: 'enemy_b_m',
    hp: 15,
    speed: 145,
    scoreValue: 150,
    fireRate: 1500,
    bulletSpeed: 260,
    hitboxRadius: 10,
    scale: 0.47,
    tint: 0xffcc66,
    size: 'small',
  },
  heavy: {
    texture: 'enemy_b_m',
    hp: 60,
    speed: 55,
    scoreValue: 300,
    fireRate: 1300,
    bulletSpeed: 240,
    hitboxRadius: 15,
    scale: 0.7,
    tint: 0x888899,
    size: 'large',
  },
  sniper: {
    texture: 'enemy_b_m',
    hp: 25,
    speed: 65,
    scoreValue: 200,
    fireRate: 2200,
    bulletSpeed: 300,
    hitboxRadius: 12,
    scale: 0.56,
    tint: 0x66ffaa,
    size: 'small',
  },
  swarm: {
    texture: 'enemy_b_m',
    hp: 8,
    speed: 185,
    scoreValue: 80,
    fireRate: 2600,
    bulletSpeed: 240,
    hitboxRadius: 9,
    scale: 0.42,
    tint: 0xff77dd,
    size: 'small',
  },
  elite: {
    texture: 'enemy_b_m',
    hp: 80,
    speed: 50,
    scoreValue: 350,
    fireRate: 1400,
    bulletSpeed: 250,
    hitboxRadius: 16,
    scale: 0.75,
    tint: 0xaa66ff,
    size: 'large',
  },
  scout: {
    texture: 'enemy_b_m',
    hp: 10,
    speed: 170,
    scoreValue: 90,
    fireRate: 2000,
    bulletSpeed: 260,
    hitboxRadius: 10,
    scale: 0.47,
    tint: 0xffffff,
    size: 'small',
  },
  hornet: {
    texture: 'enemy_b_m',
    hp: 12,
    speed: 160,
    scoreValue: 90,
    fireRate: 1900,
    bulletSpeed: 250,
    hitboxRadius: 11,
    scale: 0.52,
    tint: 0xffaa33,
    size: 'small',
  },
  dragonfly: {
    texture: 'enemy_b_m',
    hp: 18,
    speed: 110,
    scoreValue: 130,
    fireRate: 1700,
    bulletSpeed: 230,
    hitboxRadius: 14,
    scale: 0.66,
    tint: 0x66ddff,
    size: 'large',
  },
  // Dedicated power-up carrier: art comes from the EnemyPowerUpDrop pool
  // (see CURRENT_MISSION docs above) instead of RandomShips. Always drops a
  // power-up on death regardless of POWERUP.enemyDropChance (see
  // GameScene's 'enemy-killed' handler).
  carrier: {
    texture: 'enemy_b_m',
    hp: 30,
    speed: 70,
    scoreValue: 120,
    fireRate: 2400,
    bulletSpeed: 220,
    hitboxRadius: 13,
    scale: 0.9, // 1.5x RandomShips baseline -- reads as visually distinct
    tint: null,
    size: 'small',
    alwaysDropsPowerUp: true,
  },
};

export const METEOR = {
  // Slowed down (was 40-110) so meteors linger on screen longer instead of
  // dropping straight through.
  speedMin: 25,
  speedMax: 70,
  scoreValue: 50,
  powerUpChance: 0.16, // reduced from 0.35 -- power-ups should feel earned
};

// Source art (Meteor_1..4) is a large 1024x1536 image, so scale is small.
// Each meteor randomly picks one of these 3 sizes -- bigger meteors are
// tougher (more hp) and rarer (lower weight). hp bumped up across the board
// so meteors take a few more hits; large's scale was also bumped up.
// Largest tier always drops a random power-up on death (see
// GameScene's 'meteor-destroyed' handler).
export const METEOR_SIZES = [
  { key: 'small', scaleMin: 0.035, scaleMax: 0.045, hp: 45, hitboxRadius: 10, weight: 3 },
  { key: 'medium', scaleMin: 0.05, scaleMax: 0.065, hp: 80, hitboxRadius: 16, weight: 2 },
  { key: 'large', scaleMin: 0.09, scaleMax: 0.115, hp: 130, hitboxRadius: 28, weight: 1 },
];

// Shooting_Meteor / Freezing_Meteor: instead of drifting down from the top,
// these enter from the top-left or top-right corner and streak straight
// across (no rotation), faster than a normal meteor.
export const SPECIAL_METEOR = {
  kinds: ['shooting', 'freezing'],
  textures: { shooting: 'meteor_shooting', freezing: 'meteor_freezing' },
  speedMin: 260,
  speedMax: 340,
  intervalMs: 12000,
  spawnChance: 0.6,
  scale: 0.055,
  hp: 25,
  hitboxRadius: 16,
  spawnY: { min: 20, max: 90 }, // top-corner band, not full screen height
};

// Space Train: a rare, tough hazard that drifts straight down from the top
// only (no horizontal drift/rotation), slower than a meteor and with more
// hp than even the largest meteor. Capped per mission.
export const TRAIN = {
  hp: 460,
  speed: 30,
  scoreValue: 200,
  scale: 0.2, // Train_01 source is a large 1024x1536 image -- bumped up from 0.12, more imposing
  hitboxRadius: 56,
  maxPerMission: 2,
  minIntervalMs: 30000,
  maxIntervalMs: 55000,
  powerUpChance: 1, // always drops something -- it's rare and tough
};

export const POWERUP = {
  fallSpeed: 75,
  hitboxRadius: 32, // generous pickup radius -- Arcade Physics has no continuous
  // collision detection, so a small radius lets a fast-moving ship tunnel
  // past a pickup within a single frame instead of triggering the overlap
  enemyDropChance: 0.07, // reduced from 0.15 -- power-ups should feel earned
  rotationSpeedDeg: 130, // all power-up icons spin continuously
  // Relative drop-type weights once a drop has been decided (see
  // GameScene.maybeDropPowerUp). Higher = more common.
  weights: {
    weapon: 40,
    health: 30,
    rocket: 15,
    shield: 12,
    bomb: 8,
    emp: 8,
    life: 3,
  },
};

// Missions a power-up type is allowed to drop in. Omit a type from this map
// (or leave it out entirely) to allow it in every mission -- only types that
// need restricting get an entry. Checked in GameScene.pickPowerUpType against
// CURRENT_MISSION.
export const POWERUP_MISSION_RESTRICTIONS = {
  emp: [1],
};

// Smart bomb: collecting the pickup adds a stored charge (HUD-tracked via
// player.bombCount) instead of detonating immediately. Player detonates on
// demand with the bomb key (see Player.keys.bomb / GameScene.useBomb) --
// clears the screen of enemies/bullets, same damage shape as MEGA_BLAST.
export const BOMB_POWERUP = {
  maxStock: 3,
  damage: 150,
  largeDamageMultiplier: 2,
};

// The falling "shooting power" pickup cycles Yellow -> Blue -> Red over its
// lifetime, then despawns. Whichever color it shows WHEN COLLECTED sets how
// big a weapon upgrade the player gets (see Player.applyColorPowerUp) --
// waiting longer is a risk/reward call since it can still be missed or
// destroyed. Icon rotates continuously and its glow "charges" through 5
// visual levels within each 5s color phase.
export const SHOOTING_POWERUP = {
  phaseDurationMs: 5000,
  // How long the pickup hovers/drifts sideways before it starts falling.
  hoverDurationMs: 15000,
  hoverSpeedX: 90, // px/s, bounces between screen edges while hovering
  visualLevelsPerColor: 5,
  colors: ['yellow', 'blue', 'red'],
  colorTint: { yellow: 0xffdd44, blue: 0x44aaff, red: 0xff4444 },
  // At most this many weapon (colored shooting) power-ups can be alive on
  // screen at once -- further drops/guaranteed spawns are skipped until one
  // is collected or falls off-screen (see GameScene.maybeDropPowerUp /
  // triggerGuaranteedWeaponDrops).
  maxOnScreen: 3,
  // Minimum center-to-center px kept between two weapon power-ups (see
  // GameScene.separateWeaponPowerUps) so they never visually touch/overlap.
  minSeparationPx: 56,
};

// Collecting a shooting power-up while already at WEAPON_MAX_LEVEL detonates
// a mega blast instead of leveling further (there's nowhere left to level).
export const MEGA_BLAST = {
  damage: 150, // base damage; large enemies/boss take this, small enemies are destroyed outright
  largeDamageMultiplier: 2,
};

export const ROCKET_POWERUP = {
  durationMs: 12000,
  damage: 55,
  speed: 300,
  turnRateDeg: 240, // max steering turn rate, degrees/second
  scale: 0.14,
  hitboxRadius: 8,
};

export const SHIELD_POWERUP = {
  durationMs: 6000,
};

// EMP Bomb: collecting the pickup adds a stored charge (HUD-tracked via
// player.empCount), same stock model as BOMB_POWERUP. Player detonates on
// demand with the emp key (see Player.keys.emp / GameScene.useEmp) -- stuns
// (freezes movement/firing on) every enemy and the boss for stunDurationMs
// instead of dealing damage.
export const EMP_POWERUP = {
  maxStock: 3,
  stunDurationMs: 3000,
};

export const BOSS = {
  hp: 1400,
  scoreValue: 5000,
  hitboxRadius: 42,
  scale: 0.1, // Mission 1 boss art (Boss_Level1) is a large ~1360px source image
  phase2HpFraction: 0.5,
  // Phase 3 (enrage): faster sweep/attacks plus the laser sweep pattern.
  phase3HpFraction: 0.2,
  bulletSpeed: 200,
  // Telegraph: a brief tint-flash + warning cue fires this many ms before
  // radial/spread/laser attacks actually shoot, so bursts read as dodgeable
  // reactions instead of instant unfair damage.
  telegraphMs: 350,
  laser: {
    // Fired only in phase 3. A rapid burst of bullets swept across a fixed
    // angle band over laserDurationMs, simulating a laser sweep without a
    // dedicated continuous-hitbox beam entity.
    intervalMs: 6000,
    durationMs: 900,
    tickMs: 60,
    angleStart: 60,
    angleEnd: 120,
    damage: 12,
    scale: 0.5,
  },
};

export const AUDIO = {
  masterVolume: 0.35,
};

// Touch devices: drag anywhere to move (reuses mouse-steering logic in
// Player.js), fire is forced to auto, and bomb/EMP are two on-screen
// buttons instead of keyboard/mouse-button shortcuts. Button hit areas are
// in game-unit (GAME_WIDTH/HEIGHT) space, checked in Player.js so a
// button-tap pointer never also drags the ship toward the corner.
export const TOUCH_CONTROLS = {
  bombButton: { x: GAME_WIDTH - 54, y: GAME_HEIGHT - 130, radius: 36 },
  empButton: { x: GAME_WIDTH - 54, y: GAME_HEIGHT - 50, radius: 36 },
  // Ship steers toward the touch point offset this many px above the actual
  // finger position, so the thumb doesn't sit directly over (and hide) the
  // ship.
  yOffset: 90,
};

// Difficulty tiers. All current baseline values above (ENEMY_TYPES hp,
// METEOR_SIZES hp, BOSS.hp, TRAIN.hp, POWERUP drop chances, meteor wave
// counts) are tuned as EASY -- Normal/Hard scale hp up, power-ups down, and
// meteor counts up from that baseline via the multipliers below. Kids is
// gentler than Easy on every axis, plus damageTakenMult scales down actual
// damage dealt to the player (see Player.takeDamage) -- the other tiers
// leave player damage untouched.
export const DIFFICULTY = {
  kids: { label: 'KIDS', hpMult: 0.5, powerUpChanceMult: 2.2, meteorCountMult: 0.5, damageTakenMult: 0.3 },
  easy: { label: 'EASY', hpMult: 1, powerUpChanceMult: 1, meteorCountMult: 1, damageTakenMult: 1 },
  normal: { label: 'NORMAL', hpMult: 1.5, powerUpChanceMult: 0.7, meteorCountMult: 1.5, damageTakenMult: 1 },
  hard: { label: 'HARD', hpMult: 2.2, powerUpChanceMult: 0.45, meteorCountMult: 2, damageTakenMult: 1 },
};
export const DIFFICULTY_ORDER = ['kids', 'easy', 'normal', 'hard'];
export const DEFAULT_DIFFICULTY = 'normal';

// Options-screen input scheme. 'keyboard' disables mouse move/fire/bomb
// entirely; 'mouse' layers mouse control on top of keyboard, which always
// stays live in both modes (see Player.js).
export const INPUT_TYPES = ['keyboard', 'mouse'];
export const DEFAULT_INPUT_TYPE = 'keyboard';
export const DEFAULT_AUTO_FIRE = true;

// Purely decorative background structures, composed from several station/
// building tile pieces into one coherent silhouette. Non-collidable; drift
// slowly downward behind gameplay for atmosphere.
export const SPACE_STATIONS = {
  driftSpeed: 18,
  spawnIntervalMs: 22000,
  partHp: 30,
  // Backdrop image spawns once per mission (not repeating) and fully drifts
  // top-to-bottom before despawning naturally (no hard cutoff -- a forced
  // mid-screen destroy previously made it look like it vanished). Speed is
  // tuned so the ~1420px full-screen traverse takes ~25s. Stations and the
  // backdrop never show at the same time (see GameScene).
  backgroundDriftSpeed: 60,
  templates: [
    {
      name: 'crossStation',
      scale: 0.16,
      parts: [
        { texture: 'station_cross', x: 0, y: 0 },
      ],
    },
    {
      name: 'satelliteTower',
      scale: 0.22,
      parts: [
        { texture: 'station_tower', x: 0, y: 0 },
        { texture: 'building_plate', x: 0, y: -60, scale: 0.9 },
      ],
    },
    {
      name: 'solarRelay',
      scale: 0.3,
      parts: [
        { texture: 'station_solar', x: 0, y: 0 },
        { texture: 'station_antenna', x: 0, y: -60, scale: 1.1 },
        { texture: 'station_antenna', x: 0, y: 60, scale: 1.1 },
      ],
    },
    // Larger, more complex stations -- same 5 modules, combined into bigger
    // multi-part silhouettes.
    {
      name: 'megaOutpost',
      scale: 0.34,
      parts: [
        { texture: 'station_solar', x: 0, y: 0 },
        { texture: 'station_cross', x: 0, y: 0, scale: 0.8 },
        { texture: 'station_tower', x: -150, y: -40 },
        { texture: 'station_tower', x: 150, y: -40 },
        { texture: 'building_plate', x: -150, y: -110, scale: 0.9 },
        { texture: 'building_plate', x: 150, y: -110, scale: 0.9 },
        { texture: 'station_antenna', x: -70, y: 110, scale: 1.1 },
        { texture: 'station_antenna', x: 70, y: 110, scale: 1.1 },
      ],
    },
    {
      name: 'commandHub',
      scale: 0.3,
      parts: [
        { texture: 'station_cross', x: 0, y: -40 },
        { texture: 'station_tower', x: 0, y: 90 },
        { texture: 'building_plate', x: -140, y: 0, scale: 1.1 },
        { texture: 'building_plate', x: 140, y: 0, scale: 1.1 },
        { texture: 'station_antenna', x: -140, y: -90, scale: 1 },
        { texture: 'station_antenna', x: 140, y: -90, scale: 1 },
      ],
    },
    {
      name: 'twinArrayStation',
      scale: 0.26,
      parts: [
        { texture: 'station_tower', x: -90, y: 0 },
        { texture: 'station_tower', x: 90, y: 0 },
        { texture: 'station_solar', x: 0, y: -30, scale: 0.85 },
        { texture: 'station_antenna', x: -90, y: -120, scale: 1.2 },
        { texture: 'station_antenna', x: 90, y: -120, scale: 1.2 },
        { texture: 'station_antenna', x: -90, y: 120, scale: 1.2 },
        { texture: 'station_antenna', x: 90, y: 120, scale: 1.2 },
        { texture: 'building_plate', x: 0, y: 40, scale: 0.8 },
      ],
    },
  ],
};
