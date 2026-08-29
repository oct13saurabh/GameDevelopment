import { GAME_WIDTH, GAME_HEIGHT, ENEMY_TYPES, DIFFICULTY, SHIPS_FALLBACK, ENVIRONMENT_OBJECTS } from '../config.js';
import { MISSIONS, getMissionConfig } from '../missions/Missions.js';
import { getPrefs, setPref, clampShipIndex } from '../systems/PlayerPrefs.js';
import Starfield from '../systems/Starfield.js';
import Juice from '../systems/Juice.js';
import BulletPool from '../entities/Bullet.js';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import Train from '../entities/Train.js';
import Boss from '../entities/Boss.js';
import MidBoss from '../entities/MidBoss.js';
import BackgroundStation from '../entities/BackgroundStation.js';
import Mine from '../entities/bossPatterns/Mine.js';
import { ACCENT_HEX, TEXT_HEX, drawBeveledPanel, drawCornerBrackets } from '../systems/UITheme.js';

const ENEMY_TYPE_KEYS = Object.keys(ENEMY_TYPES);
const MISSION_NUMBERS = Object.keys(MISSIONS).map(Number).sort((a, b) => a - b);

// Sandbox mission for iterating on combat/animation tuning without replaying
// a whole mission each time -- spawns boss/train/enemy on demand, and gives
// quick damage/kill buttons to reach the destroy-stage and BigBlast finisher
// instantly instead of grinding hp down for real. Reuses the same Player/
// Enemy/Train/Boss classes GameScene uses, wired to a stripped-down set of
// collisions (player bullets vs hostiles only) -- no waves, no powerups, no
// mission-complete/game-over flow.
export default class TestScene extends Phaser.Scene {
  constructor() {
    super('TestScene');
  }

  init(data) {
    this.audio = data.audio;
    this.shipKey = data.shipKey;
    this.missionNumber = getPrefs(this).missionNumber;
  }

  create() {
    this.navigating = false;
    this.appEvents = new Phaser.Events.EventEmitter();
    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor('#05050f');

    this.starfield = new Starfield(this);
    this.juice = new Juice(this);

    this.enemies = [];
    this.trains = [];
    this.boss = null;
    this.midBoss = null;
    this.backgroundStations = [];
    this.environmentObjects = [];

    this.playerBullets = new BulletPool(this, { texture: 'bullet_player', maxSize: 60, damage: 20 });
    this.enemyBullets = new BulletPool(this, { texture: 'bullet_enemy', maxSize: 120, damage: 10 });

    this.enemySpriteGroup = this.physics.add.group();
    this.trainSpriteGroup = this.physics.add.group();
    this.bossSpriteGroup = this.physics.add.group();
    this.bossProjectileGroup = this.physics.add.group();

    const shipKey = this.shipKey || this.fallbackShipKey();
    this.player = new Player(this, this.playerBullets, this.juice, this.audio, shipKey, {
      inputType: 'keyboard', autoFire: true, isTouchDevice: false,
    });
    // Sandbox player never dies -- testing destroy/BigBlast animations
    // shouldn't get cut short by a stray collision.
    this.player.invulnerable = true;

    this.setupCollisions();

    this.selectedTypeIndex = 0;
    this.buildUI();

    this.input.keyboard.on('keydown-ESC', () => this.scene.start('MenuScene', { audio: this.audio }));
    this.input.keyboard.on('keydown-B', () => this.spawnBoss());
    this.input.keyboard.on('keydown-T', () => this.spawnTrain());
    this.input.keyboard.on('keydown-E', () => this.spawnEnemy());
    this.input.keyboard.on('keydown-M', () => this.spawnMidBoss());
    this.input.keyboard.on('keydown-G', () => this.spawnBackground());
    this.input.keyboard.on('keydown-V', () => this.spawnEnvironmentObject());
    this.input.keyboard.on('keydown-K', () => this.killAll());
    this.input.keyboard.on('keydown-C', () => this.clearAll());
    this.input.keyboard.on('keydown-OPEN_BRACKET', () => this.cycleType(-1));
    this.input.keyboard.on('keydown-CLOSED_BRACKET', () => this.cycleType(1));
  }

  fallbackShipKey() {
    const ships = this.registry.get('availableShips') || SHIPS_FALLBACK;
    const prefs = getPrefs(this);
    const shipIndex = clampShipIndex(prefs, ships);
    return ships[shipIndex].key;
  }

  setupCollisions() {
    const hit = (bulletSprite, targetSprite) => {
      const entity = targetSprite.owner;
      if (!entity || !entity.alive) {
        this.playerBullets.kill(bulletSprite);
        return;
      }
      const dmg = bulletSprite.damage;
      if (bulletSprite.pierceRemaining > 0) bulletSprite.pierceRemaining -= 1;
      else this.playerBullets.kill(bulletSprite);
      entity.takeDamage(dmg);
    };
    this.physics.add.overlap(this.playerBullets.group, this.enemySpriteGroup, hit);
    this.physics.add.overlap(this.playerBullets.group, this.trainSpriteGroup, hit);
    this.physics.add.overlap(this.playerBullets.group, this.bossSpriteGroup, hit);
    this.physics.add.overlap(this.playerBullets.group, this.bossProjectileGroup, (bulletSprite, projSprite) => {
      const proj = projSprite.owner;
      this.playerBullets.kill(bulletSprite);
      if (proj && proj.alive) proj.takeDamage(bulletSprite.damage);
    });
    // Enemy/boss fire still flies at the player for visual completeness, but
    // Player.takeDamage no-ops while invulnerable -- see create().
    this.physics.add.overlap(this.enemyBullets.group, this.player.sprite, (playerSprite, bulletSprite) => {
      this.enemyBullets.kill(bulletSprite);
    });
    this.physics.add.overlap(this.player.sprite, this.bossProjectileGroup, (playerSprite, projSprite) => {
      const proj = projSprite.owner;
      if (proj && proj.alive) proj.hitPlayer();
    });
  }

  buildUI() {
    drawCornerBrackets(this, GAME_WIDTH, GAME_HEIGHT);
    this.add.text(GAME_WIDTH / 2, 24, 'TEST MISSION -- SANDBOX', {
      fontFamily: 'Arial Black, Arial', fontSize: '16px', color: ACCENT_HEX,
    }).setOrigin(0.5);

    this.drawMissionSelector();

    const panelX = 12;
    const panelW = 168;
    drawBeveledPanel(this, panelX, 50, panelW, 450, { chamfer: 10 }).setDepth(5);

    let y = 74;
    const spacing = 40;
    const makeButton = (label, onClick) => {
      const w = panelW - 20;
      const h = 30;
      const cx = panelX + panelW / 2;
      const panel = drawBeveledPanel(this, cx - w / 2, y - h / 2, w, h, { chamfer: 6 }).setDepth(6);
      const text = this.add.text(cx, y, label, {
        fontFamily: 'Arial', fontSize: '12px', color: TEXT_HEX,
      }).setOrigin(0.5).setDepth(7);
      const hitZone = this.add.rectangle(cx, y, w, h, 0xffffff, 0.001)
        .setDepth(8).setInteractive({ useHandCursor: true });
      hitZone.on('pointerdown', onClick);
      y += spacing;
      return text;
    };

    // Enemy type selector: prev/next cycle the type, SPAWN fires the current one.
    this.typeLabel = makeButton(`< ${ENEMY_TYPE_KEYS[0]} >`, () => this.cycleType(1));
    this.typeLabel.setInteractive({ useHandCursor: true });
    this.typeLabel.on('pointerdown', (pointer) => {
      // Left half of the label cycles back, right half cycles forward.
      this.cycleType(pointer.downX < this.typeLabel.x ? -1 : 1);
    });
    makeButton('SPAWN ENEMY [E]', () => this.spawnEnemy());
    makeButton('SPAWN TRAIN [T]', () => this.spawnTrain());
    makeButton('SPAWN BOSS [B]', () => this.spawnBoss());
    makeButton('SPAWN MID-BOSS [M]', () => this.spawnMidBoss());
    y += 8;
    makeButton('SPAWN BACKGROUND [G]', () => this.spawnBackground());
    makeButton('SPAWN ENVIRONMENT [V]', () => this.spawnEnvironmentObject());
    y += 8;
    makeButton('DAMAGE HOSTILES 20%', () => this.damageAllFraction(0.2));
    makeButton('KILL ALL [K]', () => this.killAll());
    makeButton('CLEAR ALL [C]', () => this.clearAll());
    y += 8;
    makeButton('BACK TO MENU [ESC]', () => this.scene.start('MenuScene', { audio: this.audio }));

    this.hpText = this.add.text(GAME_WIDTH - 12, 50, '', {
      fontFamily: 'Arial', fontSize: '13px', color: TEXT_HEX, align: 'right',
    }).setOrigin(1, 0);
  }

  // Row of mission-number boxes (same look as MenuScene's selector) so any
  // mission's boss art/pattern can be sandboxed here, not just whichever
  // mission was last picked from the main menu. Boss art is baked at boot
  // per-mission (see BootScene.loadManifestDrivenAssets), so switching here
  // reboots BootScene the same way MenuScene.selectMission does -- just
  // pointed back at TestScene instead of MenuScene once loading finishes.
  drawMissionSelector() {
    if (MISSION_NUMBERS.length <= 1) return;
    const y = 44;
    const boxW = 46;
    const boxH = 26;
    const gap = 8;
    const totalW = MISSION_NUMBERS.length * boxW + (MISSION_NUMBERS.length - 1) * gap;
    const startX = GAME_WIDTH - 16 - totalW + boxW / 2;

    this.missionBoxes = MISSION_NUMBERS.map((n, i) => {
      const x = startX + i * (boxW + gap);
      const selected = n === this.missionNumber;
      const box = this.add.rectangle(x, y, boxW, boxH, 0x081018, selected ? 0.9 : 0.5)
        .setStrokeStyle(selected ? 3 : 2, 0x4de3ff, selected ? 1 : 0.5)
        .setInteractive({ useHandCursor: true });
      const label = this.add.text(x, y, `M${n}`, {
        fontFamily: 'Arial Black, Arial', fontSize: '13px', color: selected ? TEXT_HEX : '#5a8a9a',
      }).setOrigin(0.5);
      box.on('pointerdown', () => this.selectMission(n));
      return { box, label };
    });
  }

  selectMission(n) {
    if (this.navigating || n === this.missionNumber) return;
    this.navigating = true;
    setPref(this, 'missionNumber', n);
    this.scene.start('BootScene', {
      audio: this.audio,
      nextScene: 'TestScene',
      nextSceneData: { audio: this.audio, shipKey: this.shipKey },
    });
  }

  cycleType(dir) {
    this.selectedTypeIndex = (this.selectedTypeIndex + dir + ENEMY_TYPE_KEYS.length) % ENEMY_TYPE_KEYS.length;
    this.typeLabel.setText(`< ${ENEMY_TYPE_KEYS[this.selectedTypeIndex]} >`);
  }

  spawnEnemy() {
    const typeKey = ENEMY_TYPE_KEYS[this.selectedTypeIndex];
    const cfg = ENEMY_TYPES[typeKey];
    const poolKey = cfg && cfg.alwaysDropsPowerUp ? 'powerUpDrop' : 'random';
    const designs = this.registry.get('enemyDesigns') || {};
    const pool = (designs[poolKey] && designs[poolKey].length) ? designs[poolKey] : (designs.random || []);
    const design = pool.length ? Phaser.Utils.Array.GetRandom(pool) : null;
    const x = Phaser.Math.Between(80, GAME_WIDTH - 80);
    const enemy = new Enemy(this, this.enemyBullets, this.juice, this.audio, typeKey, x, -40, 'sine', this.enemySpriteGroup, design, null);
    this.enemies.push(enemy);
    return enemy;
  }

  spawnTrain() {
    const available = this.registry.get('availableTrains');
    if (!available || !available.length) return;
    const x = Phaser.Math.Between(80, GAME_WIDTH - 80);
    const textureKey = Phaser.Utils.Array.GetRandom(available);
    const train = new Train(this, this.juice, this.audio, x, -140, this.trainSpriteGroup, textureKey);
    this.trains.push(train);
    return train;
  }

  spawnBoss() {
    if (this.boss && this.boss.alive) return;
    const shipHp = getMissionConfig(this.missionNumber).shipHp;
    const missionHp = shipHp && shipHp.boss !== undefined ? shipHp.boss : null;
    this.boss = new Boss(this, this.enemyBullets, this.juice, this.audio,
      (x, y) => this.spawnEnemy(),
      this.bossSpriteGroup, missionHp, this.missionNumber,
      (x, y) => new Mine(this.boss, x, y, this.bossProjectileGroup),
      (x, y) => this.spawnMeteor && this.spawnMeteor(x, y)
    );
  }

  spawnMidBoss() {
    if (this.midBoss && this.midBoss.alive) return;
    this.midBoss = new MidBoss(this, this.enemyBullets, this.juice, this.audio, this.bossSpriteGroup);
  }

  // Fullscreen mission-backdrop layer -- same BackgroundStation entity as
  // GameScene.spawnBackgroundStation, just without the "one per mission" /
  // "wait for foreground stations to clear" gating (sandbox: spawn on demand).
  spawnBackground() {
    const plan = this.registry.get('availableBackgrounds') || [];
    if (!plan.length) return;
    if (this.backgroundStations.some((s) => s.alive)) return;
    const entry = Phaser.Utils.Array.GetRandom(plan);
    const station = new BackgroundStation(this, entry.key, GAME_WIDTH / 2, -GAME_HEIGHT / 2, { fullscreen: true, size: entry.size });
    this.backgroundStations.push(station);
  }

  // Decorative drifting planet/object -- same BackgroundStation entity as
  // GameScene.spawnEnvironmentObject, without the spawn-chance roll or
  // overlap/backdrop-size gating (sandbox: spawn on demand).
  spawnEnvironmentObject() {
    const plan = this.registry.get('availableEnvironmentObjects') || [];
    if (!plan.length) return;
    const entry = Phaser.Utils.Array.GetRandom(plan);
    const sizeCfg = ENVIRONMENT_OBJECTS.bySize[entry.size] || ENVIRONMENT_OBJECTS.bySize.Medium;
    const x = Phaser.Math.Between(60, GAME_WIDTH - 60);
    const object = new BackgroundStation(this, entry.key, x, -250, {
      depth: sizeCfg.depth ?? ENVIRONMENT_OBJECTS.depth,
      size: entry.size,
      scale: sizeCfg.scale,
      alpha: sizeCfg.alpha,
      driftSpeed: sizeCfg.driftSpeed,
    });
    this.environmentObjects.push(object);
  }

  // Chops `fraction` of current hp off every active hostile -- a quick way
  // to bring a boss/train/enemy close to 0% hp without grinding a real fight
  // down to it (Destroy/N.png frames only play once hp actually hits 0).
  damageAllFraction(fraction) {
    for (const enemy of this.enemies) {
      if (enemy.alive) enemy.takeDamage(enemy.hp * fraction);
    }
    for (const train of this.trains) {
      if (train.alive) train.takeDamage(train.hp * fraction);
    }
    if (this.boss && this.boss.alive) {
      this.boss.takeDamage(this.boss.hp * fraction);
    }
    if (this.midBoss && this.midBoss.alive) {
      this.midBoss.takeDamage(this.midBoss.hp * fraction);
    }
  }

  killAll() {
    for (const enemy of this.enemies) if (enemy.alive) enemy.takeDamage(99999);
    for (const train of this.trains) if (train.alive) train.takeDamage(99999);
    if (this.boss && this.boss.alive) this.boss.takeDamage(99999);
    if (this.midBoss && this.midBoss.alive) this.midBoss.takeDamage(99999);
  }

  // Instant removal, no death animation -- for clearing clutter between
  // tests rather than watching every kill play out.
  clearAll() {
    for (const enemy of this.enemies) if (enemy.sprite) enemy.destroy();
    for (const train of this.trains) if (train.sprite) train.destroy();
    if (this.boss && this.boss.sprite) this.boss.destroy();
    if (this.midBoss && this.midBoss.sprite) this.midBoss.destroy();
    for (const s of this.backgroundStations) if (s.alive) s.destroy();
    for (const o of this.environmentObjects) if (o.alive) o.destroy();
    this.boss = null;
    this.midBoss = null;
    this.enemies = [];
    this.trains = [];
    this.backgroundStations = [];
    this.environmentObjects = [];
  }

  update(time, dt) {
    this.starfield.update(dt);
    this.player.update(time, dt);
    this.player.invulnerable = true;

    for (const enemy of this.enemies) enemy.update(time, dt);
    for (const train of this.trains) train.update(time, dt);
    for (const s of this.backgroundStations) s.update(time, dt);
    for (const o of this.environmentObjects) o.update(time, dt);
    if (this.midBoss) this.midBoss.update(time, dt);
    if (this.boss) this.boss.update(time, dt);

    this.enemies = this.enemies.filter((e) => e.alive);
    this.trains = this.trains.filter((t) => t.alive);
    this.backgroundStations = this.backgroundStations.filter((s) => s.alive);
    this.environmentObjects = this.environmentObjects.filter((o) => o.alive);
    if (this.boss && !this.boss.alive) this.boss = null;
    if (this.midBoss && !this.midBoss.alive) this.midBoss = null;

    const lines = [];
    if (this.boss) lines.push(`BOSS HP: ${Math.max(this.boss.hp, 0)}/${this.boss.maxHp}`);
    if (this.midBoss) lines.push(`MID-BOSS HP: ${Math.max(this.midBoss.hp, 0)}/${this.midBoss.maxHp}`);
    for (const train of this.trains) lines.push(`TRAIN HP: ${Math.max(train.hp, 0)}/460`);
    this.hpText.setText(lines.join('\n'));
  }
}
