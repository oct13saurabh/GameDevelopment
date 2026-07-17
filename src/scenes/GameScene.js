import { GAME_WIDTH, GAME_HEIGHT, PLAYER, METEOR, SPECIAL_METEOR, TRAIN, POWERUP, POWERUP_MISSION_RESTRICTIONS, SHOOTING_POWERUP, MEGA_BLAST, BOMB_POWERUP, EMP_POWERUP, SPACE_STATIONS, DIFFICULTY, ENEMY_TYPES, CURRENT_MISSION, DEFAULT_INPUT_TYPE, DEFAULT_AUTO_FIRE, MISSION_SHIPS } from '../config.js';
import Starfield from '../systems/Starfield.js';
import Juice from '../systems/Juice.js';
import WaveManager from '../systems/WaveManager.js';
import BulletPool from '../entities/Bullet.js';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import Meteor from '../entities/Meteor.js';
import Train from '../entities/Train.js';
import PowerUp from '../entities/PowerUp.js';
import Boss from '../entities/Boss.js';
import Missile from '../entities/Missile.js';
import SpaceStation from '../entities/SpaceStation.js';
import BackgroundStation from '../entities/BackgroundStation.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data) {
    this.audio = data.audio;
    this.shipKey = data.shipKey || 'ship_01';
    this.difficulty = data.difficulty || 'easy';
    this.diffCfg = DIFFICULTY[this.difficulty] || DIFFICULTY.easy;
    this.inputType = data.inputType || DEFAULT_INPUT_TYPE;
    this.autoFire = data.autoFire !== undefined ? data.autoFire : DEFAULT_AUTO_FIRE;
    // Touch devices have no keyboard/mouse-buttons: drag-to-move reuses the
    // 'mouse' steering logic, and firing is always automatic. Bomb/EMP move
    // to on-screen buttons (see TOUCH_CONTROLS, HUDScene.createTouchButtons).
    this.isTouchDevice = this.sys.game.device.input.touch;
    if (this.isTouchDevice) {
      this.inputType = 'mouse';
      this.autoFire = true;
    }
  }

  create() {
    // Dedicated emitter for our own app-level events (score, health, boss, etc).
    // Phaser reuses this Scene instance across restarts, and this.events is
    // Phaser's internal Scene event bus (Clock, physics, etc all listen on it) —
    // a fresh EventEmitter here avoids ever touching that bus.
    this.appEvents = new Phaser.Events.EventEmitter();

    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor('#05050f');

    this.starfield = new Starfield(this);
    this.juice = new Juice(this);

    this.enemies = [];
    this.meteors = [];
    this.trains = [];
    this.trainsSpawned = 0;
    this.powerups = [];
    this.missiles = [];
    this.spaceStations = [];
    this.backgroundStations = [];
    this.boss = null;
    this.missionEnded = false;
    // Both start false so the mission-start HUD sync below (weaponLevel is
    // already 1 on a fresh Player) doesn't trigger a guaranteed weapon drop --
    // only actual mid-play downgrades should. See setupEventHandlers().
    this.allowGuaranteedDrops = false;
    this.suppressWeaponGuarantee = false;

    this.playerBullets = new BulletPool(this, { texture: 'bullet_player', maxSize: 60, damage: PLAYER.bulletDamage });
    this.enemyBullets = new BulletPool(this, { texture: 'bullet_enemy', maxSize: 120, damage: 10 });

    this.enemySpriteGroup = this.physics.add.group();
    this.meteorSpriteGroup = this.physics.add.group();
    this.trainSpriteGroup = this.physics.add.group();
    this.powerupSpriteGroup = this.physics.add.group();
    this.bossSpriteGroup = this.physics.add.group();
    this.playerMissileGroup = this.physics.add.group();
    this.stationSpriteGroup = this.physics.add.group();

    this.player = new Player(this, this.playerBullets, this.juice, this.audio, this.shipKey, {
      inputType: this.inputType,
      autoFire: this.autoFire,
      isTouchDevice: this.isTouchDevice,
    });

    // Mouse mode hides the OS cursor over the canvas so it doesn't clutter
    // the play field; only Escape brings it back (stays visible after).
    if (this.inputType === 'mouse' && !this.isTouchDevice) {
      this.input.setDefaultCursor('none');
    }
    // Second pointer slot so a thumb dragging to move and a thumb tapping
    // the bomb/EMP buttons register as independent touches simultaneously.
    if (this.isTouchDevice) {
      this.input.addPointer(1);
    }
    this.input.keyboard.on('keydown-ESC', () => this.input.setDefaultCursor('default'));

    this.waveManager = new WaveManager(this, {
      spawnEnemy: (type, x, y, pattern) => this.spawnEnemy(type, x, y, pattern),
      spawnMeteor: (x, y) => this.spawnMeteor(x, y),
      spawnBoss: () => this.spawnBoss(),
      getActiveHostileCount: () => this.getActiveHostileCount(),
      meteorCountMult: this.diffCfg.meteorCountMult,
    });

    this.setupCollisions();
    this.setupEventHandlers();

    this.pauseKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.muteKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.paused = false;

    this.scene.launch('HUDScene', { gameScene: this });

    this.audio.startMusic();

    // Decorative background space stations, drifting through periodically.
    this.time.delayedCall(3000, () => this.spawnSpaceStation());
    this.stationTimer = this.time.addEvent({
      delay: SPACE_STATIONS.spawnIntervalMs,
      loop: true,
      callback: () => this.spawnSpaceStation(),
    });

    // Mission backdrop image: shows once per mission (not repeating), capped
    // at backgroundMaxDurationMs, and never overlaps with the foreground
    // SpaceStations (see trySpawnBackgroundStation/spawnSpaceStation guards).
    this.backgroundSpawned = false;
    this.backgroundActive = false;
    this.time.delayedCall(6000, () => this.trySpawnBackgroundStation());

    // Shooting_Meteor / Freezing_Meteor: fast left-right/right-left streaks.
    this.specialMeteorTimer = this.time.addEvent({
      delay: SPECIAL_METEOR.intervalMs,
      loop: true,
      callback: () => this.maybeSpawnSpecialMeteor(),
    });

    this.scheduleNextTrain();

    // Dedicated power-up carrier enemy -- the ONLY source of power-up drops
    // (RandomShips enemies never drop, see the 'enemy-killed' handler
    // below), so it spawns frequently -- only once EnemyPowerUpDrop art
    // actually exists (see BootScene.buildAvailableEnemyDesigns).
    if (((this.registry.get('enemyDesigns') || {}).powerUpDrop || []).length) {
      this.carrierTimer = this.time.addEvent({
        delay: 6000,
        loop: true,
        callback: () => this.spawnCarrier(),
      });
    }

    // Kick initial HUD state.
    this.appEvents.emit('player-health-changed', this.player.health, this.player.maxHealth);
    this.appEvents.emit('player-lives-changed', this.player.lives);
    this.appEvents.emit('score-changed', this.player.score);
    this.appEvents.emit('weapon-changed', this.player.weaponLevel, this.player.bulletColor);
    this.allowGuaranteedDrops = true;
  }

  setupCollisions() {
    // Player bullets vs enemies / meteors / boss.
    this.physics.add.overlap(this.playerBullets.group, this.enemySpriteGroup, (bulletSprite, enemySprite) => {
      this.onPlayerBulletHit(bulletSprite, enemySprite);
    });
    this.physics.add.overlap(this.playerBullets.group, this.meteorSpriteGroup, (bulletSprite, meteorSprite) => {
      this.onPlayerBulletHit(bulletSprite, meteorSprite);
    });
    this.physics.add.overlap(this.playerBullets.group, this.bossSpriteGroup, (bulletSprite, bossSprite) => {
      this.onPlayerBulletHit(bulletSprite, bossSprite);
    });
    this.physics.add.overlap(this.playerBullets.group, this.trainSpriteGroup, (bulletSprite, trainSprite) => {
      this.onPlayerBulletHit(bulletSprite, trainSprite);
    });
    this.physics.add.overlap(this.playerBullets.group, this.stationSpriteGroup, (bulletSprite, partSprite) => {
      this.onPlayerBulletHit(bulletSprite, partSprite);
    });

    // Enemy bullets vs the shield boundary -- checked before the ship's own
    // (much smaller) hitbox so a shielded bullet visually stops at the aura
    // edge instead of clipping through to the ship first.
    this.physics.add.overlap(this.enemyBullets.group, this.player.shieldSpriteGroup, (bulletSprite) => {
      this.onEnemyBulletHitShield(bulletSprite);
    });

    // Enemy bullets vs player.
    // Note: Arcade Physics always calls Group-vs-single-sprite overlap
    // callbacks as (singleSprite, groupMember) regardless of registration
    // order, so the bullet is the SECOND argument here.
    this.physics.add.overlap(this.enemyBullets.group, this.player.sprite, (playerSprite, bulletSprite) => {
      this.onEnemyBulletHitPlayer(bulletSprite);
    });

    // Player contact vs enemies / meteors / boss.
    this.physics.add.overlap(this.player.sprite, this.enemySpriteGroup, (playerSprite, enemySprite) => {
      this.onPlayerContactHostile(enemySprite, 20, true);
    });
    this.physics.add.overlap(this.player.sprite, this.meteorSpriteGroup, (playerSprite, meteorSprite) => {
      this.onPlayerContactHostile(meteorSprite, 15, true);
    });
    this.physics.add.overlap(this.player.sprite, this.bossSpriteGroup, (playerSprite, bossSprite) => {
      this.onPlayerContactHostile(bossSprite, 25, false);
    });
    this.physics.add.overlap(this.player.sprite, this.trainSpriteGroup, (playerSprite, trainSprite) => {
      this.onPlayerContactHostile(trainSprite, 30, false);
    });

    // Player vs powerups.
    this.physics.add.overlap(this.player.sprite, this.powerupSpriteGroup, (playerSprite, powerupSprite) => {
      const p = powerupSprite.owner;
      if (p && p.alive && this.player.alive) p.collect(this.player);
    });

    // Player homing missiles vs enemies / meteors / boss.
    this.physics.add.overlap(this.playerMissileGroup, this.enemySpriteGroup, (missileSprite, enemySprite) => {
      this.onPlayerMissileHit(missileSprite, enemySprite);
    });
    this.physics.add.overlap(this.playerMissileGroup, this.meteorSpriteGroup, (missileSprite, meteorSprite) => {
      this.onPlayerMissileHit(missileSprite, meteorSprite);
    });
    this.physics.add.overlap(this.playerMissileGroup, this.bossSpriteGroup, (missileSprite, bossSprite) => {
      this.onPlayerMissileHit(missileSprite, bossSprite);
    });
    this.physics.add.overlap(this.playerMissileGroup, this.trainSpriteGroup, (missileSprite, trainSprite) => {
      this.onPlayerMissileHit(missileSprite, trainSprite);
    });
    this.physics.add.overlap(this.playerMissileGroup, this.stationSpriteGroup, (missileSprite, partSprite) => {
      this.onPlayerMissileHit(missileSprite, partSprite);
    });
  }

  onPlayerMissileHit(missileSprite, targetSprite) {
    const missile = missileSprite.owner;
    const entity = targetSprite.owner;
    if (!missile || !missile.alive) return;
    missile.hit(entity);
  }

  onPlayerBulletHit(bulletSprite, targetSprite) {
    const entity = targetSprite.owner;
    if (!entity || !entity.alive) {
      this.playerBullets.kill(bulletSprite);
      return;
    }
    const dmg = bulletSprite.damage;
    // Piercing bullets (red weapon pattern) keep flying through a limited
    // number of targets instead of dying on the first hit.
    if (bulletSprite.pierceRemaining > 0) {
      bulletSprite.pierceRemaining -= 1;
    } else {
      this.playerBullets.kill(bulletSprite);
    }
    entity.takeDamage(dmg);
  }

  onEnemyBulletHitShield(bulletSprite) {
    if (!bulletSprite.active) return;
    this.juice.shieldBlock(bulletSprite.x, bulletSprite.y);
    this.enemyBullets.kill(bulletSprite);
  }

  onEnemyBulletHitPlayer(bulletSprite) {
    if (!this.player.alive || this.player.invulnerable) {
      this.enemyBullets.kill(bulletSprite);
      return;
    }
    const dmg = bulletSprite.damage;
    this.enemyBullets.kill(bulletSprite);
    this.player.takeDamage(dmg);
  }

  onPlayerContactHostile(targetSprite, damage, destroyTarget) {
    const entity = targetSprite.owner;
    if (!this.player.alive || this.player.invulnerable) return;
    this.player.takeDamage(damage);
    if (destroyTarget && entity && entity.alive) {
      entity.takeDamage(99999);
    }
  }

  setupEventHandlers() {
    this.appEvents.on('enemy-killed', (enemy) => {
      this.player.addScore(enemy.cfg.scoreValue);
      // Only the dedicated EnemyPowerUpDrop carrier drops power-ups --
      // regular RandomShips enemies never do.
      if (enemy.cfg.alwaysDropsPowerUp) {
        this.maybeDropPowerUp(enemy.sprite ? enemy.sprite.x : 0, enemy.sprite ? enemy.sprite.y : 0, 1);
      }
    });

    this.appEvents.on('meteor-destroyed', (meteor) => {
      this.player.addScore(METEOR.scoreValue);
      // Largest meteor tier always drops a random power-up; others use the
      // normal chance.
      const chance = meteor.sizeKey === 'large' ? 1 : METEOR.powerUpChance;
      this.maybeDropPowerUp(meteor.sprite ? meteor.sprite.x : 0, meteor.sprite ? meteor.sprite.y : 0, chance);
    });

    this.appEvents.on('train-destroyed', (train) => {
      this.player.addScore(TRAIN.scoreValue);
      this.maybeDropPowerUp(train.sprite ? train.sprite.x : 0, train.sprite ? train.sprite.y : 0, TRAIN.powerUpChance);
    });

    this.appEvents.on('boss-killed', (boss) => {
      this.player.addScore(boss ? 5000 : 0);
      this.onMissionComplete();
    });

    this.appEvents.on('player-died', () => {
      this.onPlayerDied();
    });

    // Guarantee the player isn't stuck weaponless for long: whenever weapon
    // level drops to 1 mid-play (hit while already at level 1) force 2
    // weapon power-ups to arrive soon, instead of leaving it to the normal
    // drop RNG. Suppressed for the initial HUD-sync emit at mission start
    // (see create()) and for the respawn downgrade, which has its own
    // dedicated flow (see 'player-respawned' below).
    this.appEvents.on('weapon-changed', (level) => {
      if (level === 1 && this.allowGuaranteedDrops && !this.suppressWeaponGuarantee) {
        this.triggerGuaranteedWeaponDrops();
      }
    });

    // After a mid-mission respawn, hand the player a weapon power-up right
    // away (no kill required) if none is currently on screen, plus one more
    // 5s later -- losing a life shouldn't also mean scrounging for a while.
    this.appEvents.on('player-respawned', () => {
      if (this.countActiveWeaponPowerUps() === 0) this.triggerRespawnWeaponDrops();
    });
  }

  triggerRespawnWeaponDrops() {
    const spawnOne = () => {
      if (!this.player.alive) return;
      if (this.countActiveWeaponPowerUps() >= SHOOTING_POWERUP.maxOnScreen) return;
      const powerup = new PowerUp(this, this.audio, this.player.sprite.x + Phaser.Math.Between(-80, 80), this.player.sprite.y - SHOOTING_POWERUP.spawnOffsetY, 'weapon', this.powerupSpriteGroup);
      this.powerups.push(powerup);
    };
    spawnOne();
    this.time.delayedCall(5000, spawnOne);
  }

  triggerGuaranteedWeaponDrops() {
    if (this.guaranteedDropsPending) return;
    this.guaranteedDropsPending = true;
    const spawnOne = (delay) => {
      this.time.delayedCall(delay, () => {
        if (!this.player.alive) return;
        if (this.countActiveWeaponPowerUps() >= SHOOTING_POWERUP.maxOnScreen) return;
        const powerup = new PowerUp(this, this.audio, this.player.sprite.x + Phaser.Math.Between(-80, 80), this.player.sprite.y - SHOOTING_POWERUP.spawnOffsetY, 'weapon', this.powerupSpriteGroup);
        this.powerups.push(powerup);
      });
    };
    spawnOne(1200);
    spawnOne(3500);
    this.time.delayedCall(3700, () => {
      this.guaranteedDropsPending = false;
    });
  }

  // Nudges any two weapon (colored shooting) power-ups apart if they've
  // drifted within SHOOTING_POWERUP.minSeparationPx of each other, so the
  // capped-at-3 set never visually touches/overlaps regardless of their
  // independent hover/fall drift.
  separateWeaponPowerUps() {
    const active = this.powerups.filter((p) => p.alive && p.type === 'weapon');
    const minSep = SHOOTING_POWERUP.minSeparationPx;
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i].sprite;
        const b = active[j].sprite;
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        if (dist >= minSep) continue;
        const overlap = (minSep - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        // Nudge the physics body directly, not the game object -- Arcade
        // Physics re-syncs the sprite's transform FROM the body every step,
        // so writing to sprite.x/y here would just get overwritten next frame.
        a.body.x -= nx * overlap;
        a.body.y -= ny * overlap;
        b.body.x += nx * overlap;
        b.body.y += ny * overlap;
      }
    }
  }

  countActiveWeaponPowerUps() {
    let count = 0;
    for (const p of this.powerups) {
      if (p.alive && p.type === 'weapon') count++;
    }
    return count;
  }

  maybeDropPowerUp(x, y, chance) {
    if (Math.random() > chance * this.diffCfg.powerUpChanceMult) return;
    const type = this.pickPowerUpType();
    // Colored shooting power-ups are capped on screen -- blocked here rather
    // than in pickPowerUpType so a blocked weapon roll doesn't silently
    // swallow the drop chance for other types.
    if (type === 'weapon' && this.countActiveWeaponPowerUps() >= SHOOTING_POWERUP.maxOnScreen) return;
    const powerup = new PowerUp(this, this.audio, x, y, type, this.powerupSpriteGroup);
    this.powerups.push(powerup);
  }

  pickPowerUpType() {
    // 'weapon' keeps dropping even once maxed out -- collecting one at max
    // level triggers a mega blast instead of a further level-up.
    const entries = Object.entries(POWERUP.weights).filter(([type]) => {
      const missions = POWERUP_MISSION_RESTRICTIONS[type];
      return !missions || missions.includes(CURRENT_MISSION);
    });
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let r = Math.random() * total;
    for (const [type, w] of entries) {
      if (r < w) return type;
      r -= w;
    }
    return entries[0][0];
  }

  // Triggered when the player collects a weapon power-up while already at
  // WEAPON_MAX_LEVEL (see Player.applyColorPowerUp). Small enemies are wiped
  // out, large enemies and the boss take heavy damage.
  triggerMegaBlast(x, y) {
    this.juice.shake(300, 0.02);
    this.juice.explosion(x, y, { scale: 2.5, count: 40, variant: 'large' });
    this.audio.explosionBig();

    const ring = this.add.image(x, y, 'particle_soft')
      .setBlendMode('ADD')
      .setTint(0xffee88)
      .setAlpha(0.8)
      .setDepth(50);
    this.tweens.add({
      targets: ring,
      scale: { from: 0.5, to: 40 },
      alpha: { from: 0.8, to: 0 },
      duration: 500,
      onComplete: () => ring.destroy(),
    });

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (enemy.cfg && enemy.cfg.size === 'large') {
        enemy.takeDamage(MEGA_BLAST.damage * MEGA_BLAST.largeDamageMultiplier);
      } else {
        enemy.takeDamage(99999);
      }
    }
    if (this.boss && this.boss.alive) {
      this.boss.takeDamage(MEGA_BLAST.damage);
    }
  }

  // Smart bomb detonation (see Player.useBomb): same wipe shape as
  // triggerMegaBlast, plus it also clears every enemy bullet on screen.
  triggerBombBlast(x, y) {
    this.juice.shake(300, 0.02);
    this.juice.explosion(x, y, { scale: 2.5, count: 40, variant: 'large' });
    this.audio.explosionBig();

    const ring = this.add.image(x, y, 'particle_soft')
      .setBlendMode('ADD')
      .setTint(0x88ddff)
      .setAlpha(0.8)
      .setDepth(50);
    this.tweens.add({
      targets: ring,
      scale: { from: 0.5, to: 40 },
      alpha: { from: 0.8, to: 0 },
      duration: 500,
      onComplete: () => ring.destroy(),
    });

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (enemy.cfg && enemy.cfg.size === 'large') {
        enemy.takeDamage(BOMB_POWERUP.damage * BOMB_POWERUP.largeDamageMultiplier);
      } else {
        enemy.takeDamage(99999);
      }
    }
    if (this.boss && this.boss.alive) {
      this.boss.takeDamage(BOMB_POWERUP.damage);
    }
    this.enemyBullets.killAll();
  }

  triggerEmpStun(x, y) {
    this.juice.shake(200, 0.015);
    this.audio.explosionBig();

    const ring = this.add.image(x, y, 'particle_soft')
      .setBlendMode('ADD')
      .setTint(0x88ffcc)
      .setAlpha(0.8)
      .setDepth(50);
    this.tweens.add({
      targets: ring,
      scale: { from: 0.5, to: 40 },
      alpha: { from: 0.8, to: 0 },
      duration: 500,
      onComplete: () => ring.destroy(),
    });

    const stunnedUntil = this.time.now + EMP_POWERUP.stunDurationMs;
    for (const enemy of this.enemies) {
      if (enemy.alive) enemy.stunnedUntil = stunnedUntil;
    }
    if (this.boss && this.boss.alive) {
      this.boss.stunnedUntil = stunnedUntil;
    }
    this.enemyBullets.killAll();
  }

  findNearestHostile(x, y) {
    let nearest = null;
    let nearestDist = Infinity;
    const candidates = this.boss
      ? [...this.enemies, ...this.meteors, ...this.trains, this.boss]
      : [...this.enemies, ...this.meteors, ...this.trains];
    for (const c of candidates) {
      if (!c.alive || !c.sprite) continue;
      const d = Phaser.Math.Distance.Between(x, y, c.sprite.x, c.sprite.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = c;
      }
    }
    return nearest;
  }

  trySpawnMissile(x, y) {
    const target = this.findNearestHostile(x, y);
    if (!target) return false;
    const missile = new Missile(this, x, y, target, this.juice, this.audio, this.playerMissileGroup, () => {
      this.player.rocketInFlight = false;
    });
    this.missiles.push(missile);
    return true;
  }

  spawnSpaceStation() {
    if (this.missionEnded || this.backgroundActive) return;
    const template = Phaser.Utils.Array.GetRandom(SPACE_STATIONS.templates);
    const x = Phaser.Math.Between(90, GAME_WIDTH - 90);
    const station = new SpaceStation(this, template, x, -220, this.stationSpriteGroup);
    this.spaceStations.push(station);
  }

  // Retries every couple seconds until the foreground stations are clear, so
  // the backdrop image never appears while a SpaceStation is on screen.
  trySpawnBackgroundStation() {
    if (this.missionEnded || this.backgroundSpawned) return;
    if (this.spaceStations.length > 0) {
      this.time.delayedCall(2000, () => this.trySpawnBackgroundStation());
      return;
    }
    this.spawnBackgroundStation();
  }

  spawnBackgroundStation() {
    if (this.missionEnded) return;
    const keys = this.registry.get('availableBackgrounds') || [];
    if (!keys.length) return;
    this.backgroundSpawned = true;
    this.backgroundActive = true;
    if (this.stationTimer) this.stationTimer.paused = true;

    const key = Phaser.Utils.Array.GetRandom(keys);
    const x = Phaser.Math.Between(90, GAME_WIDTH - 90);
    const station = new BackgroundStation(this, key, x, -300);
    this.backgroundStations.push(station);
  }

  spawnEnemy(typeKey, x, y, pattern) {
    const cfg = ENEMY_TYPES[typeKey];
    const poolKey = cfg && cfg.alwaysDropsPowerUp ? 'powerUpDrop' : 'random';
    const designs = this.registry.get('enemyDesigns') || {};
    // Fall back to the RandomShips pool if the requested pool has no art yet
    // (e.g. EnemyPowerUpDrop is still empty) so a stray spawn never lands on
    // a missing texture.
    const pool = (designs[poolKey] && designs[poolKey].length) ? designs[poolKey] : (designs.random || []);
    const design = pool.length ? Phaser.Utils.Array.GetRandom(pool) : null;
    const missionShips = MISSION_SHIPS[`mission${CURRENT_MISSION}`];
    const missionHp = missionShips && missionShips[typeKey] !== undefined ? missionShips[typeKey] : null;
    const enemy = new Enemy(this, this.enemyBullets, this.juice, this.audio, typeKey, x, y, pattern, this.enemySpriteGroup, design, missionHp);
    enemy.hp = Math.round(enemy.hp * this.diffCfg.hpMult);
    this.enemies.push(enemy);
    return enemy;
  }

  spawnMeteor(x, y) {
    const meteor = new Meteor(this, this.juice, this.audio, x, y, this.meteorSpriteGroup);
    meteor.hp = Math.round(meteor.hp * this.diffCfg.hpMult);
    this.meteors.push(meteor);
    return meteor;
  }

  spawnCarrier() {
    if (this.missionEnded) return;
    const x = Phaser.Math.Between(60, GAME_WIDTH - 60);
    this.spawnEnemy('carrier', x, -40, 'sine');
  }

  maybeSpawnSpecialMeteor() {
    if (this.missionEnded) return;
    if (Math.random() > Math.min(1, SPECIAL_METEOR.spawnChance * this.diffCfg.meteorCountMult)) return;
    const kind = Phaser.Utils.Array.GetRandom(SPECIAL_METEOR.kinds);
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? -60 : GAME_WIDTH + 60;
    const y = Phaser.Math.Between(SPECIAL_METEOR.spawnY.min, SPECIAL_METEOR.spawnY.max);
    const meteor = new Meteor(this, this.juice, this.audio, x, y, this.meteorSpriteGroup, {
      special: true, kind, fromLeft,
    });
    meteor.hp = Math.round(meteor.hp * this.diffCfg.hpMult);
    this.meteors.push(meteor);
    return meteor;
  }

  // Rare tough hazard, capped at TRAIN.maxPerMission -- enters from a random
  // x at the top only and drifts straight down.
  scheduleNextTrain() {
    if (this.trainsSpawned >= TRAIN.maxPerMission) return;
    const delay = Phaser.Math.Between(TRAIN.minIntervalMs, TRAIN.maxIntervalMs);
    this.trainTimer = this.time.delayedCall(delay, () => this.spawnTrain());
  }

  spawnTrain() {
    if (this.missionEnded || this.trainsSpawned >= TRAIN.maxPerMission) return;
    const available = this.registry.get('availableTrains');
    if (!available || !available.length) return; // no train art on disk yet
    this.trainsSpawned++;
    const x = Phaser.Math.Between(80, GAME_WIDTH - 80);
    const textureKey = Phaser.Utils.Array.GetRandom(available);
    const train = new Train(this, this.juice, this.audio, x, -140, this.trainSpriteGroup, textureKey);
    train.hp = Math.round(train.hp * this.diffCfg.hpMult);
    this.trains.push(train);
    this.scheduleNextTrain();
    return train;
  }

  spawnBoss() {
    const missionShips = MISSION_SHIPS[`mission${CURRENT_MISSION}`];
    const missionHp = missionShips && missionShips.boss !== undefined ? missionShips.boss : null;
    this.boss = new Boss(this, this.enemyBullets, this.juice, this.audio, (x, y) =>
      this.spawnEnemy('fast', x, y, 'straight'), this.bossSpriteGroup, missionHp
    );
    this.boss.hp = Math.round(this.boss.hp * this.diffCfg.hpMult);
    this.boss.maxHp = Math.round(this.boss.maxHp * this.diffCfg.hpMult);
  }

  getActiveHostileCount() {
    const e = this.enemies.filter((x) => x.alive).length;
    const m = this.meteors.filter((x) => x.alive).length;
    return e + m;
  }

  onMissionComplete() {
    if (this.missionEnded) return;
    this.missionEnded = true;
    this.audio.stopMusic();
    this.audio.missionComplete();
    this.time.delayedCall(1800, () => {
      this.scene.stop('HUDScene');
      this.scene.start('GameOverScene', { win: true, score: this.player.score, audio: this.audio, shipKey: this.shipKey, difficulty: this.difficulty, inputType: this.inputType, autoFire: this.autoFire });
    });
  }

  onPlayerDied() {
    if (this.missionEnded) return;
    this.missionEnded = true;
    this.audio.stopMusic();
    this.audio.gameOverJingle();
    this.time.delayedCall(1500, () => {
      this.scene.stop('HUDScene');
      this.scene.start('GameOverScene', { win: false, score: this.player.score, audio: this.audio, shipKey: this.shipKey, difficulty: this.difficulty, inputType: this.inputType, autoFire: this.autoFire });
    });
  }

  togglePause() {
    this.paused = !this.paused;
    if (this.paused) {
      this.physics.world.pause();
      this.time.paused = true;
    } else {
      this.physics.world.resume();
      this.time.paused = false;
    }
    this.appEvents.emit('pause-changed', this.paused);
  }

  update(time, dt) {
    if (Phaser.Input.Keyboard.JustDown(this.pauseKey)) {
      this.togglePause();
    }
    if (Phaser.Input.Keyboard.JustDown(this.muteKey)) {
      const muted = this.audio.toggleMute();
      this.appEvents.emit('mute-changed', muted);
    }

    if (this.paused || this.missionEnded) return;

    this.starfield.update(dt);
    this.player.update(time, dt);

    for (const enemy of this.enemies) enemy.update(time, dt);
    for (const meteor of this.meteors) meteor.update(time, dt);
    for (const train of this.trains) train.update(time, dt);
    for (const powerup of this.powerups) powerup.update(time, dt);
    this.separateWeaponPowerUps();
    for (const missile of this.missiles) missile.update(time, dt);
    for (const station of this.spaceStations) station.update(time, dt);
    for (const bg of this.backgroundStations) bg.update(time, dt);
    if (this.boss) this.boss.update(time, dt);

    this.enemies = this.enemies.filter((e) => e.alive);
    this.meteors = this.meteors.filter((m) => m.alive);
    this.trains = this.trains.filter((t) => t.alive);
    this.powerups = this.powerups.filter((p) => p.alive);
    this.missiles = this.missiles.filter((m) => m.alive);
    this.spaceStations = this.spaceStations.filter((s) => s.alive);
    this.backgroundStations = this.backgroundStations.filter((s) => s.alive);
    if (this.backgroundActive && this.backgroundStations.length === 0) {
      this.backgroundActive = false;
      if (this.stationTimer) this.stationTimer.paused = false;
    }
    if (this.boss && !this.boss.alive) this.boss = null;

    this.waveManager.update(time, dt);
  }
}
