import { GAME_HEIGHT } from '../config.js';
import { getPrefs } from '../systems/PlayerPrefs.js';

// All game art is loaded exclusively from GameAssets/ (never straight from
// Assets/, which only holds the raw source packs). Paths are resolved
// relative to index.html (the page), not this module file.
const ROOT = 'GameAssets';

// EnemyShip, Train, and PlayerShip art all use GameAssets/manifest.json
// instead of numeric probing, since file names there aren't a fixed pattern
// (e.g. GE1.png vs E11.png vs EM1.png, or F-35_03-1.png vs Falcon_01-1.png).
// Run `npm run generate-manifest` after adding or removing any such art --
// BootScene then loads exactly what the manifest lists, no other code
// changes needed.
const ENEMY_CATEGORIES = [
  { key: 'random', folder: 'RandomShips' },
  { key: 'powerUpDrop', folder: 'EnemyPowerUpDrop' },
];
// Which mission's art loads is picked at runtime (MenuScene's mission
// selector, persisted via PlayerPrefs), not a fixed constant -- computed
// fresh each time BootScene runs (it restarts whenever the player switches
// mission, see MenuScene.selectMission).
const missionFolders = (missionNumber) => [`Mission ${missionNumber}`, 'Default'];
const BANKING_SET_RE = /^enemy_(\d+)_b_(m|l1|l2|r1|r2)\.png$/i;

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Manifest-driven PlayerShip/EnemyShip/Train art is loaded in create()
    // once this file's contents are known (see loadManifestDrivenAssets).
    this.load.json('assetManifest', `${ROOT}/manifest.json`);

    // Boss art lives under GameAssets/BossShip/{Mission N|Default}/<any filename>
    // (see BOSS_MISSION_FOLDERS) -- filename isn't fixed (e.g. boss_ship.png vs
    // boss_shipM2.png), so it's manifest-driven like enemy/background art; the
    // actual load happens in loadManifestDrivenAssets() once the manifest JSON
    // below has arrived.

    // Bullets / missiles. bullet_player stays as the enemy-bullet fallback
    // texture; player bullets pick a tier texture (blue/yellow/red) in Player.js.
    this.load.image('bullet_player', `${ROOT}/Bullets/bullet_player.png`);
    this.load.image('bullet_player_blue', `${ROOT}/Bullets/bullet_player_blue.png`);
    this.load.image('bullet_player_yellow', `${ROOT}/Bullets/bullet_player_yellow.png`);
    this.load.image('bullet_player_red', `${ROOT}/Bullets/bullet_player_red.png`);
    this.load.image('bullet_enemy', `${ROOT}/Bullets/bullet_enemy.png`);
    // enemy_bullet_1 = Enemy.js's power-up-dropping "carrier" ship; enemy_bullet_2
    // = boss attacks across all bossPatterns -- untinted, native art colors.
    // Both a raw 1024x1024 source, so they need the same bakeCrisp treatment
    // as mine below (see bakeOtherLargeTextures).
    this.load.image('enemy_bullet_1', `${ROOT}/Bullets/enemy_bullet_1.png`);
    this.load.image('enemy_bullet_2', `${ROOT}/Bullets/enemy_bullet_2.png`);
    this.load.image('missile_rocket', `${ROOT}/Bullets/missile_rocket.png`);
    // Mission 3's Missile Barrage (bossPatterns/EnemyMissile.js) -- also a
    // raw 1024x1024 source, same bakeCrisp treatment as enemy_bullet_1/2 above.
    this.load.image('enemy_missile_rocket', `${ROOT}/Bullets/enemy_missile_rocket.png`);
    this.load.image('mine', `${ROOT}/Bullets/mines.png`);

    // Static main-menu backdrop (MenuScene) -- square source, cropped to
    // cover the portrait canvas (see MenuScene.create()'s setDisplaySize).
    this.load.image('menu_background', `${ROOT}/Menu_Background.png`);

    // Meteors.
    this.load.image('meteor_1', `${ROOT}/Meteors/Meteor_1.png`);
    this.load.image('meteor_2', `${ROOT}/Meteors/Meteor_2.png`);
    this.load.image('meteor_3', `${ROOT}/Meteors/Meteor_3.png`);
    this.load.image('meteor_4', `${ROOT}/Meteors/Meteor_4.png`);
    this.load.image('meteor_shooting', `${ROOT}/Meteors/Shooting_Meteor.png`);
    this.load.image('meteor_freezing', `${ROOT}/Meteors/Freezing_Meteor.png`);

    // Effects.
    this.load.image('flame', `${ROOT}/Effects/flame.png`);
    this.load.image('shield_effect', `${ROOT}/Effects/Shield.png`);

    // Space station background decorations (composed from a few tile pieces).
    this.load.image('station_cross', `${ROOT}/Stations/station_cross.png`);
    this.load.image('station_tower', `${ROOT}/Stations/station_tower.png`);
    this.load.image('station_solar', `${ROOT}/Stations/station_solar.png`);
    this.load.image('station_antenna', `${ROOT}/Stations/station_antenna.png`);
    this.load.image('building_plate', `${ROOT}/Stations/building_plate.png`);

    // Power-up icons.
    this.load.image('powerup_yellow', `${ROOT}/PowerUp/powerup_yellow.png`);
    this.load.image('powerup_blue', `${ROOT}/PowerUp/powerup_blue.png`);
    this.load.image('powerup_red', `${ROOT}/PowerUp/powerup_red.png`);
    this.load.image('powerup_health', `${ROOT}/PowerUp/powerup_health.png`);
    this.load.image('powerup_missile', `${ROOT}/PowerUp/powerup_missile.png`);
    this.load.image('powerup_shield_icon', `${ROOT}/PowerUp/powerup_shield.png`);
    this.load.image('powerup_life_icon', `${ROOT}/PowerUp/powerup_life.png`);
    this.load.image('powerup_bomb', `${ROOT}/PowerUp/powerup_bomb.png`);
    this.load.image('powerup_emp', `${ROOT}/PowerUp/EMP_Bomb.png`);

    // Explosion animation frames.
    for (let i = 1; i <= 11; i++) {
      const n = String(i).padStart(2, '0');
      this.load.image(`explosion_1_${n}`, `${ROOT}/Explosions/explosion_1_${n}.png`);
    }
    for (let i = 1; i <= 9; i++) {
      const n = String(i).padStart(2, '0');
      this.load.image(`explosion_2_${n}`, `${ROOT}/Explosions/explosion_2_${n}.png`);
    }
    for (let i = 1; i <= 9; i++) {
      const n = String(i).padStart(2, '0');
      this.load.image(`explosion_3_${n}`, `${ROOT}/Explosions/explosion_3_${n}.png`);
    }

    this.load.on('loaderror', (file) => {
      console.error('Failed to load asset:', file.key, file.src);
    });
  }

  // Sanitized texture-key prefixes for manifest-driven enemy design files --
  // folder names contain spaces ("Mission 1"), so they're slugified for use
  // as Phaser texture keys.
  enemySetKey(categoryKey, folder, i) {
    return `enemyset_${categoryKey}_${folder.replace(/\s+/g, '')}_${i}`;
  }

  enemyStaticKey(categoryKey, folder, safeName) {
    return `enemystatic_${categoryKey}_${folder.replace(/\s+/g, '')}_${safeName}`;
  }

  // Optional -- set when MenuScene restarts this scene to load a newly
  // selected mission's art (see MenuScene.selectMission), so the existing
  // AudioSystem/AudioContext carries through instead of a new one leaking
  // the old one. Absent on first boot, same fallback MenuScene itself uses.
  // nextScene/nextSceneData let a caller (e.g. GameOverScene advancing to the
  // next mission) skip straight into GameScene once loading finishes,
  // instead of always landing back on MenuScene.
  init(data) {
    this.audio = data && data.audio;
    this.nextScene = (data && data.nextScene) || 'MenuScene';
    this.nextSceneData = (data && data.nextSceneData) || { audio: this.audio };
  }

  create() {
    this.generateProceduralTextures();
    this.generateExplosionAnimations();
    this.loadManifestDrivenAssets();
  }

  // Sanitized texture-key base for a manifest-listed player ship set, e.g.
  // { name: 'F-35', idle: 'F-35_03-1.png' } -> 'ship_F35_03'.
  playerShipKey(name, idleFile) {
    const indexMatch = idleFile.match(/_(\d+)-1\.\w+$/i);
    const index = indexMatch ? indexMatch[1] : '00';
    return `ship_${name.replace(/[^a-zA-Z0-9]/g, '')}_${index}`;
  }

  // The manifest (GameAssets/manifest.json, see scripts/generate-asset-
  // manifest.js) lists exactly which PlayerShip/EnemyShip/Train files exist
  // on disk. Queues a load pass for those files, then builds the registry
  // lists once they're in and starts MenuScene.
  loadManifestDrivenAssets() {
    const manifest = this.cache.json.get('assetManifest') || {};
    this.enemyPlan = { random: [], powerUpDrop: [] };
    this.trainKeys = [];
    this.shipList = [];

    const missionNumber = getPrefs(this).missionNumber;
    const folders = missionFolders(missionNumber);

    // Boss art -- one file per {Mission N|Default} folder, any filename.
    // Fallback-only (break on first non-empty folder), same as backgroundKeys
    // below, since only one boss art set is ever active at a time.
    const bossByFolder = manifest.bossShip || {};
    // Phaser's loader silently no-ops a load queued under a texture key that
    // already exists -- 'ship_boss' is intentionally reused across missions
    // (see bakeCrisp), so without this, switching mission leaves the
    // previous mission's boss texture in place instead of loading the new one.
    if (this.textures.exists('ship_boss')) this.textures.remove('ship_boss');
    for (let i = 1; i <= 5; i++) {
      if (this.textures.exists(`ship_boss_destroy_${i}`)) this.textures.remove(`ship_boss_destroy_${i}`);
    }
    this.bossDestroyFrameCount = 0;
    for (const folder of folders) {
      const entry = bossByFolder[folder] || {};
      const files = entry.art || [];
      if (!files.length) continue;
      this.load.image('ship_boss', `${ROOT}/BossShip/${folder}/${files[0]}`);
      const destroyFiles = entry.destroy || [];
      destroyFiles.forEach((file, idx) => {
        this.load.image(`ship_boss_destroy_${idx + 1}`, `${ROOT}/BossShip/${folder}/Destroy/${file}`);
      });
      this.bossDestroyFrameCount = destroyFiles.length;
      break;
    }

    for (const ship of manifest.playerShip || []) {
      const key = this.playerShipKey(ship.name, ship.idle);
      this.load.image(`${key}_idle`, `${ROOT}/PlayerShip/${ship.idle}`);
      this.load.image(`${key}_move`, `${ROOT}/PlayerShip/${ship.move}`);
      this.shipList.push({ key, name: ship.name });
    }

    for (const cat of ENEMY_CATEGORIES) {
      const byFolder = (manifest.enemyShip && manifest.enemyShip[cat.folder]) || {};
      for (const folder of folders) {
        const files = byFolder[folder] || [];
        const bankingSets = {}; // setIndex -> { m, l1, l2, r1, r2 }
        for (const file of files) {
          const match = file.match(BANKING_SET_RE);
          const base = `${ROOT}/EnemyShip/${cat.folder}/${folder}`;
          if (match) {
            const [, setIndex, frame] = match;
            const prefix = this.enemySetKey(cat.key, folder, setIndex);
            const frameKey = `${prefix}_${frame}`;
            this.load.image(frameKey, `${base}/${file}`);
            bankingSets[setIndex] = bankingSets[setIndex] || {};
            bankingSets[setIndex][frame] = frameKey;
          } else {
            const safeName = file.replace(/\.\w+$/, '').replace(/[^a-zA-Z0-9]/g, '_');
            const key = this.enemyStaticKey(cat.key, folder, safeName);
            this.load.image(key, `${base}/${file}`);
            this.enemyPlan[cat.key].push({ static: key, sourceFolder: folder });
          }
        }
        for (const frames of Object.values(bankingSets)) {
          this.enemyPlan[cat.key].push({ banking: frames, sourceFolder: folder });
        }
      }
    }

    this.trainDestroyFrameCounts = {};
    for (const [trainFolder, entry] of Object.entries(manifest.train || {})) {
      if (!entry || !entry.art) continue;
      const safeName = entry.art.replace(/\.\w+$/, '').replace(/[^a-zA-Z0-9]/g, '_');
      const key = `train_${safeName}`;
      this.load.image(key, `${ROOT}/Train/${trainFolder}/${entry.art}`);
      this.trainKeys.push(key);
      const destroyFiles = entry.destroy || [];
      destroyFiles.forEach((file, idx) => {
        this.load.image(`${key}_destroy_${idx + 1}`, `${ROOT}/Train/${trainFolder}/Destroy/${file}`);
      });
      this.trainDestroyFrameCounts[key] = destroyFiles.length;
    }

    // Mission-wise scrolling backdrop images (see GameAssets/Background/Mission N).
    // File names/counts vary per mission, so they're manifest-driven like the
    // enemy/train art above rather than hardcoded.
    this.backgroundPlan = [];
    const backgroundByFolder = manifest.background || {};
    for (const folder of folders) {
      const entries = backgroundByFolder[folder] || [];
      for (const entry of entries) {
        const safeName = entry.file.replace(/\.\w+$/, '').replace(/[^a-zA-Z0-9]/g, '_');
        const key = `bg_${folder.replace(/\s+/g, '')}_${safeName}`;
        this.load.image(key, `${ROOT}/Background/${folder}/${entry.file}`);
        this.backgroundPlan.push({ key, size: entry.size, sourceFolder: folder });
      }
      if (this.backgroundPlan.length) break;
    }

    // Random decorative objects (planets, etc) -- Background/Environment/{Mission N|Default}.
    // Unlike backdrop images above, Default and the mission folder are pooled
    // together (additive), not fallback-only, so shared art is always available
    // alongside mission-specific art. Each entry carries its parsed size.
    this.environmentPlan = [];
    const environmentByFolder = (manifest.background && manifest.background.environment) || {};
    for (const folder of folders) {
      const entries = environmentByFolder[folder] || [];
      for (const entry of entries) {
        const safeName = entry.file.replace(/\.\w+$/, '').replace(/[^a-zA-Z0-9]/g, '_');
        const key = `env_${folder.replace(/\s+/g, '')}_${safeName}`;
        this.load.image(key, `${ROOT}/Background/Environment/${folder}/${entry.file}`);
        this.environmentPlan.push({ key, size: entry.size, sourceFolder: folder });
      }
    }

    // Shared BigBlast finisher flipbook and the launch-scene platform art --
    // both mission-independent, so only load once (guarded against re-running
    // on a BootScene restart when the player switches mission).
    const bigBlastFiles = (manifest.animation && manifest.animation.BigBlast) || [];
    if (!this.textures.exists('bigblast_1')) {
      bigBlastFiles.forEach((file, idx) => {
        this.load.image(`bigblast_${idx + 1}`, `${ROOT}/Animation/BigBlast/${file}`);
      });
    }
    if (manifest.platform && !this.textures.exists('platform_01')) {
      this.load.image('platform_01', `${ROOT}/Platform/${manifest.platform}`);
    }

    this.load.once('complete', () => {
      this.bakePlayerShipTextures();
      this.bakeOtherLargeTextures();
      this.registry.set('enemyDesigns', this.enemyPlan);
      this.registry.set('availableTrains', this.trainKeys);
      this.registry.set('availableShips', this.shipList);
      this.registry.set('availableBackgrounds', this.backgroundPlan);
      this.registry.set('availableEnvironmentObjects', this.environmentPlan);
      this.registry.set('bossDestroyFrameCount', this.bossDestroyFrameCount);
      this.registry.set('trainDestroyFrameCounts', this.trainDestroyFrameCounts);
      this.scene.start(this.nextScene, this.nextSceneData);
    });
    this.load.start();
  }

  // Ship art loads as a large 1024x1536 source PNG (see PLAYER.scale comment
  // in config.js), but every on-screen use (gameplay ship, menu decoration,
  // ship-select grid) draws it at well under 200px. 1536 isn't a power of
  // two, so WebGL can't generate mipmaps for it -- without them, the GPU's
  // live bilinear minification over that large a downscale ratio reads as
  // soft/blurry (reported: ship-select grid looks pixelated/blurry).
  // Fix: bake each loaded ship texture down to a fixed crisp size ONCE here,
  // via a 2D canvas high-quality resample, and replace the texture in-place
  // under the same key -- every later `add.image(key)` (Player.js,
  // MenuScene.js, OptionsScene.js) picks up the small, already-sharp texture
  // instead of live-downscaling the giant original. PLAYER.scale and the
  // menu/select-screen scale constants are tuned against SHIP_BAKE_W/H (see
  // their comments) to land on the exact same on-screen sizes as before.
  bakePlayerShipTextures() {
    for (const ship of this.shipList) {
      this.bakeCrisp(`${ship.key}_idle`, 320);
      this.bakeCrisp(`${ship.key}_move`, 320);
    }
  }

  // Same NPOT-mipmap-blur problem as the player ship (see bakePlayerShipTextures
  // comment) also hits meteors, the train, the boss, and the shooting-power/
  // health/rocket/shield/bomb/EMP pickups -- all loaded as large ~1024x1536
  // source art but drawn at a tiny setScale. Bakes each down to a fixed,
  // crisp target width; bakeCrisp() no-ops if the source is already <= that
  // width (nothing to gain, and re-upscaling would look worse), so this is
  // safe to call for every current AND future asset in these categories
  // regardless of their actual source resolution.
  // config.js's METEOR_SIZES/SPECIAL_METEOR.scale and BOSS.scale, and
  // PowerUp.js's POWERUP_VISUAL scale values, are tuned against these same
  // fixed bake widths (see their comments) -- Train.js needs no matching
  // config change since TRAIN.scale is already normalized dynamically off
  // the live sprite.width (see REFERENCE_SOURCE_WIDTH in Train.js).
  bakeOtherLargeTextures() {
    ['meteor_1', 'meteor_2', 'meteor_3', 'meteor_4', 'meteor_shooting', 'meteor_freezing']
      .forEach((key) => this.bakeCrisp(key, 200));
    this.trainKeys.forEach((key) => this.bakeCrisp(key, 250));
    this.bakeCrisp('ship_boss', 400);
    for (let i = 1; i <= 5; i++) this.bakeCrisp(`ship_boss_destroy_${i}`, 400);
    for (const key of this.trainKeys) {
      for (let i = 1; i <= 5; i++) this.bakeCrisp(`${key}_destroy_${i}`, 250);
    }
    for (let i = 1; i <= 5; i++) this.bakeCrisp(`bigblast_${i}`, 300);
    ['powerup_yellow', 'powerup_blue', 'powerup_red', 'powerup_health', 'powerup_missile', 'powerup_shield_icon', 'powerup_bomb', 'powerup_emp']
      .forEach((key) => this.bakeCrisp(key, 150));
    // Mission 3's Mine Barrage hazard (bossPatterns/Mine.js) -- same
    // large-source-art issue as the categories above, just added after this
    // pass and missed: mines.png is a raw 1024x1024 source, so at BOSS.mine's
    // scale (tuned for a baked ~200px texture, matching the meteor baseline)
    // it rendered ~2.5x too big on screen.
    this.bakeCrisp('mine', 200);
    this.bakeCrisp('menu_background', GAME_HEIGHT);
    this.bakeCrisp('enemy_bullet_1', 45);
    this.bakeCrisp('enemy_bullet_2', 45);
    this.bakeCrisp('enemy_missile_rocket', 100);
    // Enemy ship art (RandomShips/EnemyPowerUpDrop, banking + static sets)
    // never got baked -- same NPOT-mipmap-blur issue as player ship/boss/
    // meteors above (Enemy.js draws these at a tiny setScale). 128 matches
    // REFERENCE_SOURCE_SIZE*2 in Enemy.js (64px reference doubled for
    // headroom against the largest on-screen enemy scale).
    for (const cat of ENEMY_CATEGORIES) {
      for (const design of this.enemyPlan[cat.key] || []) {
        if (design.static) this.bakeCrisp(design.static, 128);
        if (design.banking) Object.values(design.banking).forEach((key) => this.bakeCrisp(key, 128));
      }
    }
  }

  // Resamples a loaded image texture down to bakeWidth (aspect-preserved)
  // via a one-time 2D-canvas high-quality draw, then replaces the texture
  // in-place under the same key -- every `add.image(key)`/`physics.add.image(key)`
  // called after this (i.e. every scene, since baking runs before MenuScene
  // starts) picks up the small, sharp texture instead of the giant original.
  // No-ops if the source is already at or under bakeWidth.
  bakeCrisp(key, bakeWidth) {
    const texture = this.textures.get(key);
    if (!texture || texture.key === '__MISSING') return;
    const source = texture.getSourceImage();
    if (source.width <= bakeWidth) return;
    const bakeHeight = Math.round(bakeWidth * (source.height / source.width));
    this.textures.remove(key);
    const canvasTexture = this.textures.createCanvas(key, bakeWidth, bakeHeight);
    const ctx = canvasTexture.getContext();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, bakeWidth, bakeHeight);
    canvasTexture.refresh();
  }

  generateProceduralTextures() {
    // Guards against re-running on a BootScene restart (mission switch) --
    // these are one-time global textures, not mission-specific.
    if (this.textures.exists('particle_soft')) return;

    // Soft round particle for explosions / trails / stars / power-up glow.
    const particleSize = 16;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(particleSize / 2, particleSize / 2, particleSize / 2);
    g.generateTexture('particle_soft', particleSize, particleSize);
    g.destroy();

    // Tiny round dot for starfield stars -- baked at 8px and scaled down by
    // Starfield's setScale so the circle stays smooth instead of a jagged
    // 2px square blown up 1-2x on screen.
    const star = this.make.graphics({ x: 0, y: 0, add: false });
    star.fillStyle(0xffffff, 1);
    star.fillCircle(4, 4, 4);
    star.generateTexture('star_pixel', 8, 8);
    star.destroy();
  }

  // Builds a frame-key animation from a set of individually-loaded images
  // (Phaser animations can reference frames across different texture keys,
  // so no spritesheet/atlas packing is required for these).
  generateExplosionAnimations() {
    const build = (animKey, framePrefix, count, frameRate) => {
      if (this.anims.exists(animKey)) return;
      const frames = [];
      for (let i = 1; i <= count; i++) {
        frames.push({ key: `${framePrefix}${String(i).padStart(2, '0')}` });
      }
      this.anims.create({ key: animKey, frames, frameRate, repeat: 0 });
    };
    build('explode_small', 'explosion_1_', 11, 28);
    build('explode_medium', 'explosion_2_', 9, 24);
    build('explode_large', 'explosion_3_', 9, 20);
  }
}
