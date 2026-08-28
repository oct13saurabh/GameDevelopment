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
// Default mission a fresh session starts on. The actually-active mission is
// selectable at runtime from MenuScene (persisted via PlayerPrefs'
// missionNumber, see systems/PlayerPrefs.js) -- this constant is just the
// fallback used the very first time prefs are created.
export const CURRENT_MISSION = 1;

export const PLAYER = {
  speed: 250,
  fireRate: 150, // ms between shots at weapon level 1
  fireRateMin: 110, // fastest fire rate at max weapon level
  startLives: 3,
  startHealth: 100,
  invulnMs: 1500,
  hitInvulnMs: 500,
  bulletSpeed: 560,
  bulletDamage: 10,
  // Ship art loads as a large 1024x1536 source image, shared by all
  // selectable ships, but BootScene.bakePlayerShipTextures() resamples it
  // down to a crisp 320x480 texture at load time (fixes NPOT-mipmap blur --
  // see that method's comment). 0.144 = 0.045 * (1024/320), i.e. the same
  // on-screen size as the original 0.045-against-1024px scale, just applied
  // to the smaller baked texture.
  scale: 0.144,
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
  { level: 1, bulletCount: 1, spreadDeg: 0, fireRate: 150 },
  { level: 2, bulletCount: 2, spreadDeg: 0, fireRate: 140 },
  { level: 3, bulletCount: 3, spreadDeg: 0, fireRate: 130 },
  { level: 4, bulletCount: 4, spreadDeg: 0, fireRate: 125 },
  { level: 5, bulletCount: 5, spreadDeg: 0, fireRate: 110 },
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
  speedMax: 80,
  scoreValue: 50,
  powerUpChance: 0.16, // reduced from 0.35 -- power-ups should feel earned

  // Background ambient trickle (GameScene.maybeSpawnAmbientMeteor) -- outside
  // the dedicated meteor-shower event (see METEOR_SHOWER below / per-mission
  // meteorShower config in missions/Missions.js), meteors should be a rare
  // sight, not a constant hazard: low per-tick chance, hard capped at how
  // many can be alive on screen at once.
  ambientSpawnIntervalMs: 4000,
  ambientSpawnChance: 0.22,
  ambientMaxOnScreen: 2,
};

// Default shape for a mission's meteor-shower event -- WaveManager reads
// missions/Missions.js's per-mission `meteorShower` block (falling back to
// these values for any field a mission omits). Fires once, at
// `triggerAtFraction` through the mission's wave timeline, dropping a dense
// meteor burst while thinning regular enemy spawns (see
// GameScene.spawnEnemy's meteorShowerActive check) so meteors are the star
// of that stretch instead of just more clutter alongside full enemy waves.
export const METEOR_SHOWER_DEFAULTS = {
  enabled: true,
  triggerAtFraction: 0.6,
  durationMs: 10000,
  count: 25,
  intervalMs: 450,
  enemyThinning: 0.5, // fraction of enemy spawns randomly skipped during the shower
};

// BootScene.bakeOtherLargeTextures() resamples meteor art down to a crisp
// 200px-wide texture at load time (fixes NPOT-mipmap blur on the large
// source PNGs -- see that method's comment), so scale here is tuned against
// that fixed 200px baseline instead of the raw source resolution. Each
// meteor randomly picks one of these 3 sizes -- bigger meteors are tougher
// (more hp) and rarer (lower weight). hp bumped up across the board so
// meteors take a few more hits; large's scale was also bumped up.
// Largest tier always drops a random power-up on death (see
// GameScene's 'meteor-destroyed' handler).
export const METEOR_SIZES = [
  { key: 'small', scaleMin: 0.1792, scaleMax: 0.2304, hp: 45, hitboxRadius: 10, weight: 3 },
  { key: 'medium', scaleMin: 0.256, scaleMax: 0.3328, hp: 80, hitboxRadius: 16, weight: 2 },
  { key: 'large', scaleMin: 0.4608, scaleMax: 0.5888, hp: 130, hitboxRadius: 28, weight: 1 },
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
  // 0.2816 = 0.055 * (1024/200) -- tuned against BootScene's baked 200px-wide
  // meteor texture (see METEOR_SIZES comment), same on-screen size as before.
  scale: 0.2816,
  hp: 25,
  hitboxRadius: 16,
  spawnY: { min: 20, max: 90 }, // top-corner band, not full screen height
};

// Space Train: a rare, tough hazard that drifts straight down from the top
// only (no horizontal drift/rotation), slower than a meteor and with more
// hp than even the largest meteor. Capped per mission.
export const TRAIN = {
  hp: 660,
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
  // Vertical offset (px, above the player) used when spawning a respawn/
  // guaranteed weapon drop directly relative to the player's position (see
  // GameScene.triggerRespawnWeaponDrops / triggerGuaranteedWeaponDrops).
  // Needs to be large enough that the power-up doesn't spawn overlapping the
  // ship and get auto-collected instantly.
  spawnOffsetY: 220,
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

// Enemy rotation limits per source folder + carrier status. Controls whether
// sprite rotates toward player and if firing is restricted to a cone.
// tweenDurationMs controls rotation smoothness (0 = instant snap).
export const ENEMY_ROTATION = {
  // RandomShips from Mission N folder: can rotate ±maxRotationDegFromDown,
  // only fire if within fireConeDegHalf of target. tweenDurationMs controls
  // rotation smoothness — increase for slower/smoother, decrease for snappier.
  missionShip: {
    maxRotationDegFromDown: 45,
    fireConeDegHalf: 45,
    tweenDurationMs: 400,
  },
  // RandomShips from Default folder: no rotation, limited cone, chance to not fire.
  defaultShip: {
    maxRotationDegFromDown: 0,
    fireConeDegHalf: 30,
    tweenDurationMs: 0,
    fireChance: 0.5, // 50% chance to actually fire when conditions met
  },
  // EnemyPowerUpDrop (carrier): can rotate freely, fire in any direction.
  carrier: {
    maxRotationDegFromDown: 180,
    fireConeDegHalf: 180,
    tweenDurationMs: 400,
  },
};

// Carrier (EnemyPowerUpDrop) attack patterns -- which family a given carrier
// runs is tagged on its art filename (Enemy1_Blast2.png -> family 'blast',
// count 2; see CARRIER_PATTERN_RE in BootScene.js). Each family fires `count`
// reps separated by repeatIntervalMs, then the carrier retreats off the top
// of the screen -- see Enemy.js's isCarrier branch in update(). lifespanMs is
// a hard cap: forces retreat even if a pattern is still mid-cycle.
export const CARRIER_PATTERNS = {
  repeatIntervalMs: 3000,
  lifespanMs: 10000, // tune this one constant to change how long a carrier fights before retreating
  fallbackFamily: 'spread',
  fallbackCount: 1,
  // 360-degree ring of bullets.
  blast: { bulletCount: 12, bulletSpeed: 220, damage: 10, scale: 0.4, texture: 'enemy_bullet_1' },
  // Narrow fan aimed at the player, same shape as Mission4Pattern.fireSpread.
  spread: { bulletCount: 3, spreadDeg: 46, bulletSpeed: 240, damage: 10, scale: 0.4, texture: 'enemy_bullet_1' },
  // Rapid aimed single shots per rep.
  burst: { shotCount: 3, shotIntervalMs: 150, bulletSpeed: 260, damage: 10, scale: 0.4, texture: 'enemy_bullet_1' },
  // Straight, high-speed, non-homing -- one from each wing.
  missle: { wingOffset: 18, bulletSpeed: 520, damage: 14, scale: 0.5, texture: 'enemy_missile_rocket' },
  // Homing missiles -- reuses the boss's EnemyMissile entity. missileCount is
  // per rep (independent of the filename's N, which is the rep count).
  homing: { missileCount: 1 },
  // Radial mine spread dropped below the carrier -- reuses Mission4Pattern's
  // placement math. mineCount is per rep.
  mine: { mineCount: 3, radius: 90, spanDeg: 260 },
};

// Tunable speeds for the Destroy-frame / BigBlast death flipbooks and the
// mission-start launch takeoff -- adjust freely while play-testing feel.
export const ANIMATION = {
  // Playback speed (ms/frame) for the Destroy/N.png crumble flipbook, played
  // in full at 0% hp (death) before BigBlast plays.
  destroyFrameMs: 250,
  // Playback speed (ms/frame) for the shared Animation/BigBlast flipbook.
  bigBlastFrameMs: 100,
  // Duration of the alpha dissolve blending each Destroy/N.png frame into the
  // next (Juice.crossfadeTexture) -- an instant setTexture swap reads as two
  // unrelated static images cutting between each other, so each frame of the
  // death flipbook blends across this window instead.
  destroyStageFlickerMs: 120,
  // Duration of the player ship's takeoff tween in LaunchScene.
  launchDurationMs: 2800,
  // Duration of the fall/shrink tween in Juice.fallAndBlast for the boss and
  // train death sequences (sinks + shrinks before BigBlast plays).
  bossFallDurationMs: 3400,
  trainFallDurationMs: 3000,
  // Fraction of the fall duration to wait before Destroy/N.png frames start
  // crossfading in -- 0 = right at fall start, 1 = never (would skip crumble).
  destroyStageStartFraction: 0.8,
};

export const BOSS = {
  hp: 1400,
  scoreValue: 5000,
  hitboxRadius: 42,
  // 0.384 = 0.1 * (1536/400) -- tuned against BootScene's baked 400px-wide
  // boss texture (bakeOtherLargeTextures), same on-screen size as before
  // against the raw ~1536px Mission 1 boss art.
  scale: 0.384,
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

  // --- Mission 1 attack cycle (bossPatterns/Mission1Pattern.js) ---
  // Window durations (ms) for the repeating Twin Cannons -> pause -> Spread
  // -> pause -> Missiles -> pause -> Laser Charge -> Laser Sweep cycle. Same
  // 7-state shape across all 3 phases (only tempo changes) -- pauses shrink
  // and the laser telegraph tightens each phase so pressure ramps up without
  // changing the pattern's readable shape.
  mission1Cycle: {
    phase1: { twinCannons: 5000, pause1: 1000, spread: 4000, pause2: 2000, missiles: 3000, pause3: 1000, laserCharge: 2000, laserSweep: 3000 },
    phase2: { twinCannons: 5000, pause1: 700, spread: 4000, pause2: 1400, missiles: 3000, pause3: 700, laserCharge: 1600, laserSweep: 3000 },
    phase3: { twinCannons: 4500, pause1: 500, spread: 3800, pause2: 1000, missiles: 2800, pause3: 500, laserCharge: 1300, laserSweep: 3200 },
  },
  // Fast, narrow-spaced pair -- dodge is a single sidestep. Damage kept low
  // since it fires continuously through its 5s window.
  twinCannon: { fireRateMs: 550, bulletSpeed: 260, damage: 9, scale: 0.5, spacing: 26 },
  // 5-bullet fan with visible gaps -- meant to be woven through, not walled
  // against.
  spreadShot: { fireRateMs: 650, count: 5, spreadDeg: 55, bulletSpeed: 190, damage: 7, scale: 0.42 },

  // --- Mission 2 destroyable minions (bossPatterns/Drone.js) ---
  // Flank the boss and trickle-fire aimed shots; killable for score/relief,
  // creating the target-priority choice (snipe drones vs. focus boss).
  drone: {
    hp: 25, fireRateMs: 2000, bulletSpeed: 210, bulletDamage: 8,
    texture: 'enemy_b_m', scale: 0.42, tint: 0x66ff99, hitboxRadius: 10,
    flankOffsets2: [[-90, 30], [90, 30]],
    flankOffsets4: [[-110, 20], [110, 20], [-60, 55], [60, 55]],
  },

  // --- Mission 2 Rotating Spore Burst, phase 3+ ---
  sporeBurst: { count: 14, bulletSpeed: 175, damage: 8, scale: 0.42, rotateStepDeg: 15 },

  // --- Mission 2 Triple Plasma Burst, phase 1 ---
  plasmaBurst: { bulletsPerVolley: 3, volleys: 6, volleyIntervalMs: 220, spreadDeg: 18, bulletSpeed: 230, damage: 9, scale: 0.46 },

  // --- Mission 2 per-phase cycle window durations (ms) ---
  // Phases 1-3 alternate a pair of named patterns with pauses between; phase
  // 4 is a fixed non-toggling sequence through all patterns, timed ~25%
  // faster than phases 1-3's average tempo. Phase 2's droneLaunch used to
  // toggle with Acid Spread -- removed (bossPatterns/AcidPool.js deleted),
  // now reuses phase 1's Triple Plasma Burst instead.
  mission2Cycle: {
    phase1: { plasmaBurst: 2600, pauseA: 800, droneLaunch: 3200, pauseB: 1000 },
    phase2: { droneLaunch: 3200, pauseA: 900, plasmaBurst: 2600, pauseB: 900 },
    phase3: { hiveMissiles: 3600, pauseA: 800, sporeBurst: 3200, pauseB: 800 },
    phase4: { droneLaunch4: 2400, plasmaBurst: 2000, hiveMissiles: 2800, sporeBurst: 2400, pauseBetween: 500 },
    // Phase 3's drones spawn on a separate background timer per the spec
    // ("drone launches continue"), not as a cycle state.
    phase3BackgroundDroneIntervalMs: 6000,
  },

  // --- Mission 3 fire attack cycle (bossPatterns/Mission3Pattern.js) ---
  // Same 5-state shape across all 3 phases (Flame Breath -> pause -> Fire
  // Rain -> pause -> Ember Ring -> repeat), tempo tightens by phase, same
  // approach as Mission 1's cycle.
  // mineDrop/pause4 added for the Mine Barrage attack (bossPatterns/Mine.js) --
  // extends the same repeating shape with a 4th attack + pause pair.
  mission3Cycle: {
    phase1: { flameBreath: 3500, pause1: 1000, missileBarrage: 3000, pause2: 1200, emberRing: 900, pause3: 1400, mineDrop: 600, pause4: 1600 },
    phase2: { flameBreath: 3500, pause1: 700, missileBarrage: 3200, pause2: 900, emberRing: 900, pause3: 1000, mineDrop: 600, pause4: 1200 },
    phase3: { flameBreath: 3200, pause1: 500, missileBarrage: 3400, pause2: 600, emberRing: 900, pause3: 700, mineDrop: 600, pause4: 800 },
  },
  // Widening cone of fire bullets aimed at the player, swept across a narrow
  // angle band around the aim direction over the window -- reads as a flame
  // jet, not a single beam. Telegraphed like the laser. Bigger/glowing scale
  // vs. a plain bullet so the stream reads as fire, not ammo.
  flameBreath: {
    tickMs: 90, coneDeg: 40, bulletSpeed: 210, damage: 8, scale: 0.7,
  },
  // Missile Barrage (bossPatterns/EnemyMissile.js) -- a staggered volley of
  // destroyable homing missiles. Steering is clamped to the lower half-circle
  // only (see EnemyMissile.clampAngleDeg): they can curve toward the player
  // across left/right/down, but never rotate up past horizontal, so they
  // always read as launched downward at the player, never doubling back.
  // If left alone (not shot down, doesn't reach the player) for lifetimeMs,
  // it self-detonates in place (EnemyMissile.explode) for blastRadius'd
  // splash damage instead of drifting forever.
  missileBarrage: {
    count: 10, staggerMs: 250,
    hp: 18, speed: 200, turnRateDeg: 70, damage: 18,
    texture: 'enemy_missile_rocket', scale: 0.35, hitboxRadius: 10,
    lifetimeMs: 5000, blastRadius: 70,
  },
  // Instant radial ring, orange/red -- Mission 1's fireRadial shape reused
  // with fire tuning, punctuating the cycle between the two sustained attacks.
  emberRing: { count: 16, bulletSpeed: 195, damage: 9, scale: 0.68 },

  // --- Mission 3 Mine Barrage (bossPatterns/Mine.js), phase 1+ ---
  // Drifting mines dropped in a row below the boss. One player bullet blasts
  // a mine outright (hp: 1); touching one with the ship instead blasts the
  // player for mine.damage. Slow drift + gentle wobble gives time to react
  // by shooting a gap open or weaving through.
  mine: {
    hp: 1, texture: 'mine', scale: 0.25, hitboxRadius: 13,
    driftSpeed: 80, wobbleAmp: 35, wobbleFreq: 1.6,
    damage: 60, dropCount: 10, spacingX: 50,
  },

  // --- Mission 4 combined-hazard boss cycle (bossPatterns/Mission4Pattern.js) ---
  // Deliberately reuses Mission 1's bullet spread, Mission 3's missile/mine/
  // laser building blocks instead of new attack types -- the spec's whole
  // point is "combine the mechanics the pre-boss timeline already taught."
  // 4 phases (not the usual 3): Bullets->Missiles->Mines through phase 1-2,
  // Missiles->Mines->Laser->Meteor Wall from phase 3 on, tempo tightening
  // each phase and sharply in the Final Phase (phase4).
  mission4Cycle: {
    phase1: { bullets: 3000, pause1: 800, missiles: 2600, pause2: 900, mines: 1800, pause3: 1200 },
    phase2: { bullets: 3000, pause1: 600, missiles: 2800, pause2: 700, mines: 2000, pause3: 900 },
    phase3: {
      missiles: 3200, pause1: 500, mines: 2200, pause2: 500,
      laserCharge: 1300, laserSweep: 2800, pause3: 600,
      meteorWall: 1200, pause4: 800,
    },
    phase4: {
      missiles: 2600, pause1: 300, mines: 1800, pause2: 300,
      laserCharge: 800, laserSweep: 2600, pause3: 300,
      meteorWall: 900, pause4: 300,
    },
  },
  // Bullet-spread state (phases 1-2 only) -- same shape as spreadShot, own
  // tuning so Mission 4 doesn't inherit Mission 1 balance changes for free.
  mission4Spread: { fireRateMs: 600, count: 5, spreadDeg: 50, bulletSpeed: 200, damage: 8, scale: 0.42 },
  // Missile volley count ramps by phase (spec: "2-3" pre-boss -> "2-missile"
  // phase 1 -> "4-6" phase 2 -> "salvo" phase 3 -> "more aggressive" final).
  // Uses the shared missileBarrage entity tuning (hp/speed/turn/etc) --  only
  // the per-state count varies.
  mission4MissileCount: { phase1: 2, phase2: 5, phase3: 7, phase4: 9 },
  // Mine-drop count ramps similarly (spec: "small deployments" -> "mine
  // fields" -> faster/denser in the Final Phase). Uses shared `mine` entity
  // tuning above -- only per-state count varies.
  mission4MineCount: { phase1: 4, phase2: 6, phase3: 8, phase4: 10 },
  // "Meteor walls"/"meteor storm" (phase 3+) -- a row of meteors spawned via
  // the normal spawnMeteor hook, evenly spaced across the width so it reads
  // as a wall to weave through rather than the ambient trickle.
  mission4MeteorWall: { countPhase3: 5, countPhase4: 8, staggerMs: 200 },
};

// Mission 5's mid-boss (src/entities/MidBoss.js + bossPatterns/MidBossPattern.js) --
// a short, self-contained encounter partway through the pre-boss timeline,
// distinct from the real end-of-mission Boss: half its scale, single attack
// theme (front machine gun + wing missiles), and a hard lifetime timer. Not
// destroyed in time -> it enrages (telegraphed radial nova) and self-destructs
// instead of dying normally, so the encounter always resolves within
// lifetimeMs even on a bad run.
export const MID_BOSS = {
  hp: 1600,
  scoreValue: 1200,
  hitboxRadius: Math.round(BOSS.hitboxRadius * 0.5),
  scale: BOSS.scale * 1.5,
  sweepSpeed: 110,
  // Hard cap on how long the mid-boss stays -- at lifetimeMs it enrages
  // regardless of remaining hp. enrageWarningMs is how long before that the
  // on-screen warning appears (see MidBoss.update).
  lifetimeMs: 24000,
  enrageWarningMs: 3000,
  // Front-mounted machine gun: fires straight down every fireIntervalMs for
  // burstMs, then pauseMs of silence (during which the wing missiles fire --
  // see MidBossPattern) before repeating.
  machineGun: { fireIntervalMs: 90, burstMs: 3000, pauseMs: 2000, bulletSpeed: 260, damage: 6, scale: 0.4, texture: 'enemy_bullet_2' },
  // Fired at the start of every pause: one from each wing, dead straight
  // (turnRateDeg: 0 -- see EnemyMissile's cfg param).
  wingMissileStraight: { hp: 18, speed: 220, turnRateDeg: 0, damage: 16, texture: 'enemy_missile_rocket', scale: 0.32, hitboxRadius: 9, lifetimeMs: 4500, blastRadius: 60 },
  // Fired 1s into every pause: one from each wing, homing (same steer as the
  // shared Missile Barrage tuning).
  wingMissileHoming: { hp: 18, speed: 190, turnRateDeg: 70, damage: 16, texture: 'enemy_missile_rocket', scale: 0.32, hitboxRadius: 9, lifetimeMs: 4500, blastRadius: 60 },
  // Timeout-only "enrage" burst -- a full radial ring, telegraphed by
  // enrageWarningMs rather than the usual short BOSS.telegraphMs flash, then
  // self-destructs with no score/drop (see MidBoss.enrage).
  enrageNova: { bulletCount: 28, bulletSpeed: 230, damage: 14, scale: 0.5, texture: 'enemy_bullet_2' },
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
// enemyCountMult scales the per-wave spawn loop counts in WaveManager's
// pure-count waves (waveStraightLine/waveSwarmRush/etc -- fixed-formation
// waves like waveVFormation/waveCrossfire are left alone since scaling their
// array length would break the formation shape). waveIntervalMult scales
// every wave step's timeline timestamp (<1 = steps trigger earlier, so waves
// overlap more and the screen stays busier). bonusSpawnPerWave adds N extra
// generic enemies alongside every wave step (formation waves included) --
// see WaveManager.spawnBonusEnemies.
export const DIFFICULTY = {
  kids: { label: 'KIDS', hpMult: 0.5, powerUpChanceMult: 2.2, meteorCountMult: 0.5, damageTakenMult: 0.3, enemyCountMult: 0.6, waveIntervalMult: 1.3, bonusSpawnPerWave: 0 },
  easy: { label: 'EASY', hpMult: 1, powerUpChanceMult: 1, meteorCountMult: 1, damageTakenMult: 1, enemyCountMult: 1, waveIntervalMult: 1, bonusSpawnPerWave: 0 },
  normal: { label: 'NORMAL', hpMult: 3, powerUpChanceMult: 0.3, meteorCountMult: 3, damageTakenMult: 1, enemyCountMult: 1.4, waveIntervalMult: 0.85, bonusSpawnPerWave: 2 },
  hard: { label: 'HARD', hpMult: 7, powerUpChanceMult: 0.1, meteorCountMult: 5, damageTakenMult: 2, enemyCountMult: 1.8, waveIntervalMult: 0.70, bonusSpawnPerWave: 4 },
  // UI marker only -- no hpMult/etc of its own. GameScene special-cases this
  // key: it starts the run on ADAPTIVE.startTier's real config and swaps
  // diffCfg live via AdaptiveDifficulty (see src/systems/AdaptiveDifficulty.js).
  adaptive: { label: 'ADAPTIVE' },
};
export const DIFFICULTY_ORDER = ['kids', 'easy', 'normal', 'hard', 'adaptive'];
export const DEFAULT_DIFFICULTY = 'adaptive';

// Real tiers AdaptiveDifficulty is allowed to land on (excludes the
// 'adaptive' marker entry above -- that's a picker option, not a tier).
export const ADAPTIVE_REAL_TIERS = ['kids', 'easy', 'normal', 'hard'];

// Tuning for adaptive-mode auto-adjustment. Reaching WEAPON_MAX_LEVEL in a
// given color jumps straight to that color's target tier here (see
// AdaptiveDifficulty.onWeaponChanged) -- the only thing that ramps difficulty
// UP. scoreDownPerSec is downshift-only, ballparked against a 15s window:
// under ~1.5 basic-enemy kills' worth (ENEMY_TYPES.basic.scoreValue 100, so
// ~150 total) in the window reads as struggling/passive.
export const ADAPTIVE = {
  startTier: 'normal',
  minAdjustIntervalMs: 8000,
  weaponMaxLevelTierByColor: { yellow: 'normal', blue: 'hard', red: 'hard' },
  scoreWindowMs: 15000,
  scoreDownPerSec: 10,
};

// Options-screen input scheme. 'keyboard' disables mouse move/fire/bomb
// entirely; 'mouse' layers mouse control on top of keyboard, which always
// stays live in both modes (see Player.js).
export const INPUT_TYPES = ['keyboard', 'mouse'];
export const DEFAULT_INPUT_TYPE = 'keyboard';
export const DEFAULT_AUTO_FIRE = true;

// Purely decorative random background objects (planets, etc -- see
// GameAssets/Background/Environment). Spawn periodically, drift slowly
// downward, far behind gameplay. Size (parsed from filename) drives scale/
// speed/alpha: bigger objects read as closer, so drift slower and sit dimmer;
// smaller objects drift faster and pop more, like distant twinkling scenery.
export const ENVIRONMENT_OBJECTS = {
  spawnIntervalMs: 16000,
  depth: -7,
  // Per-tick spawn chance is mission-specific -- see environmentSpawnChance
  // in src/missions/Mission<N>.js. defaultSpawnChance below is only the
  // fallback for a mission with no config entry at all.
  defaultSpawnChance: 0.35,
  // Minimum gap (px, edge-to-edge) kept between two environment objects'
  // circles -- see GameScene.spawnEnvironmentObject's overlap check.
  minSeparationPx: 20,
  bySize: {
    // VerySmall is the one size allowed while the mission backdrop image is
    // showing (see GameScene.spawnEnvironmentObject/spawnBackgroundStation) --
    // it needs its own depth, above the backdrop's -6 (BackgroundStation
    // default) instead of the usual -7, so it reads as drifting in front of
    // the backdrop rather than behind it.
    VerySmall: { scale: 0.084, driftSpeed: 32, alpha: 0.7, depth: -5 }, // 0.12 - 30%
    Small: { scale: 0.125, driftSpeed: 26, alpha: 0.65 }, // 0.25 - 50%
    Medium: { scale: 0.25, driftSpeed: 18, alpha: 0.55 }, // 0.5 - 50%
    Big: { scale: 0.51, driftSpeed: 10, alpha: 0.45 }, // 0.85 - 40%
  },
};

// EXPERIMENTAL -- single endlessly-scrolling backdrop per mission (replaces
// the one-shot SPACE_STATIONS.backgroundBySize drift-through above while
// enabled: true). To revert, just flip enabled back to false -- no other
// code needs to change, see GameScene.create/spawnEnvironmentObject.
export const MISSION_BACKDROP = {
  enabled: true,
  scrollSpeed: 20, // px/sec, tilePositionY delta (texture space, unaffected by zoomX)
  depth: -9, // above Starfield (-10, so hidden behind the opaque art) but below environment objects (-7/-5)
  alpha: 1,
  // Source art is a tall strip with content only in a centered horizontal
  // band (transparent/empty margins left+right) -- zoomX crops those off by
  // scaling the tile so only the middle 1/zoomX of the image's width fills
  // the screen (GameScene.startEndlessBackdrop centers it automatically).
  // Raise to crop tighter, lower toward 1 to show more of the margins.
  zoomX: 0.90,
};

// Purely decorative background structures, composed from several station/
// building tile pieces into one coherent silhouette. Non-collidable; drift
// slowly downward behind gameplay for atmosphere.
export const SPACE_STATIONS = {
  // Foreground station/building silhouettes (spawnSpaceStation) disabled for
  // now -- kept in code, just not spawning. The mission backdrop image
  // (backgroundBySize below) is a separate feature and unaffected.
  enabled: false,
  driftSpeed: 18,
  spawnIntervalMs: 22000,
  partHp: 30,
  // Single far-back backdrop layer (GameAssets/Background/Mission N) -- slow
  // drift, small scale, dim, reads as distant scenery instead of competing
  // with foreground gameplay. Size (parsed from filename, default Medium if
  // no suffix) picks which row below applies.
  backgroundBySize: {
    Small: { scale: 0.35, driftSpeed: 26, alpha: 0.6 },
    Medium: { scale: 0.6, driftSpeed: 20, alpha: 0.5 },
    Big: { scale: 0.9, driftSpeed: 14, alpha: 0.4 },
  },
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
