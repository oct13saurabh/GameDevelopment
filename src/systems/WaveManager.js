import { GAME_WIDTH } from '../config.js';
import { getMeteorShowerConfig, getMissionConfig } from '../missions/Missions.js';

// Mission 1 timeline: a sequence of timed spawn steps, followed by a boss
// once all prior waves are cleared. `spawnEnemy(typeKey, x, y, pattern)`,
// `spawnMeteor(x, y)` and `spawnBoss()` are injected from GameScene.
//
// Steps are spaced tightly (~4-5s apart) so the screen rarely sits empty,
// running from t=500ms to t=150000 (2.5 minutes) so there's a full 2.5
// minutes of wave content before the boss even appears (which then adds its
// own fight time on top).
//
// Meteors are NOT part of this timeline any more -- a rare ambient trickle
// (GameScene.maybeSpawnAmbientMeteor, capped at METEOR.ambientMaxOnScreen on
// screen at once) runs throughout, and one dedicated, mission-configurable
// meteor-shower event (see scheduleMeteorShower) fires partway through.

export default class WaveManager {
  constructor(scene, {
    spawnEnemy, spawnMeteor, spawnBoss, getActiveHostileCount, missionNumber = 1,
    spawnEnemyMissile = null, spawnMine = null,
    meteorCountMult = 1, enemyCountMult = 1, waveIntervalMult = 1, bonusSpawnPerWave = 0,
  }) {
    this.scene = scene;
    this.spawnEnemy = spawnEnemy;
    this.spawnMeteor = spawnMeteor;
    this.spawnBoss = spawnBoss;
    this.spawnEnemyMissile = spawnEnemyMissile;
    this.spawnMine = spawnMine;
    this.getActiveHostileCount = getActiveHostileCount;
    this.meteorCountMult = meteorCountMult;
    this.enemyCountMult = enemyCountMult;
    this.waveIntervalMult = waveIntervalMult;
    this.bonusSpawnPerWave = bonusSpawnPerWave;

    this.elapsed = 0;
    this.stepIndex = 0;
    this.allWavesSpawned = false;
    this.bossSpawned = false;
    this.missionComplete = false;

    // Set true for meteorShowerConfig.durationMs once the shower triggers --
    // GameScene.spawnEnemy checks this to thin regular enemy spawns so the
    // shower reads as its own event, not just more clutter on top of a full
    // wave (see meteorShowerConfig.enemyThinning).
    this.meteorShowerActive = false;
    this.meteorShowerTriggered = false;
    this.meteorShowerConfig = getMeteorShowerConfig(missionNumber);
    this.missionNumber = missionNumber;

    // waveIntervalMult scales every step's timestamp -- <1 pulls steps
    // earlier so waves overlap more (busier screen), >1 spreads them out.
    this.steps = this.buildTimeline().map((step) => ({ ...step, t: Math.round(step.t * this.waveIntervalMult) }));
    this.missionDurationMs = this.steps[this.steps.length - 1].t;
  }

  // Scales a wave's raw spawn-loop count by enemyCountMult, rounding to at
  // least 1 -- used by the pure-count waves below (fixed-formation waves
  // like waveVFormation/waveCrossfire are left at their literal array
  // lengths since scaling them would break the formation shape).
  scaleCount(n) {
    return Math.max(1, Math.round(n * this.enemyCountMult));
  }

  // Extra generic enemies dropped in alongside every wave step (formation
  // waves included) so raising bonusSpawnPerWave densifies every wave, not
  // just the pure-count ones scaleCount touches.
  spawnBonusEnemies() {
    for (let i = 0; i < this.bonusSpawnPerWave; i++) {
      const x = Phaser.Math.Between(30, GAME_WIDTH - 30);
      const type = Phaser.Utils.Array.GetRandom(['basic', 'fast']);
      this.scene.time.delayedCall(i * 250, () => this.spawnEnemy(type, x, -40, 'straight'));
    }
  }

  // Each mission gets its own timeline (not just a tempo multiplier on
  // Mission 1's) -- later missions pack steps closer together AND introduce
  // new composite waves (see waveCrossfire/waveEliteWall/waveSwarmStorm/
  // waveDragonflySquadron/waveEmberGauntlet below) instead of just repeating
  // Mission 1's mix faster.
  buildTimeline() {
    if (this.missionNumber === 4) return this.buildMission4Timeline();
    if (this.missionNumber === 3) return this.buildMission3Timeline();
    if (this.missionNumber === 2) return this.buildMission2Timeline();
    return this.buildMission1Timeline();
  }

  buildMission1Timeline() {
    return [
      { t: 500, run: () => this.waveStraightLine() },
      { t: 5000, run: () => this.waveScoutFlurry() },
      { t: 9000, run: () => this.waveSineColumns() },
      { t: 13000, run: () => this.waveHornetSwarm() },
      { t: 17000, run: () => this.waveSniperLine() },
      { t: 21000, run: () => this.waveVFormation() },
      { t: 26000, run: () => this.waveDragonflyPair() },
      { t: 35000, run: () => this.waveSwarmRush() },
      { t: 40000, run: () => this.waveEliteEscort() },
      { t: 45000, run: () => this.waveMixed1() },
      { t: 50000, run: () => this.waveScoutFlurry() },
      { t: 54000, run: () => this.waveSniperDuo() },
      { t: 64000, run: () => this.waveHornetSwarm() },
      { t: 69000, run: () => this.waveSwarmPincer() },
      { t: 74000, run: () => this.waveDragonflyPair() },
      { t: 79000, run: () => this.waveEliteEscort() },
      { t: 85000, run: () => this.waveFinalGauntlet() },
      { t: 98000, run: () => this.waveMixed1() },
      { t: 103000, run: () => this.waveHornetSwarm() },
      { t: 108000, run: () => this.waveSniperDuo() },
      { t: 113000, run: () => this.waveSwarmPincer() },
      { t: 118000, run: () => this.waveDragonflyPair() },
      { t: 128000, run: () => this.waveEliteEscort() },
      { t: 133000, run: () => this.waveScoutFlurry() },
      { t: 138000, run: () => this.waveVFormation() },
      { t: 143000, run: () => this.waveSwarmRush() },
      { t: 150000, run: () => this.waveFinalGauntlet() },
    ];
  }

  // ~25% tighter gaps than Mission 1, plus two new composite waves
  // (waveCrossfire, waveEliteWall) that mix more ship types per step instead
  // of just repeating Mission 1's single-type waves faster.
  buildMission2Timeline() {
    return [
      { t: 400, run: () => this.waveStraightLine() },
      { t: 3800, run: () => this.waveScoutFlurry() },
      { t: 7000, run: () => this.waveSineColumns() },
      { t: 10000, run: () => this.waveHornetSwarm() },
      { t: 13000, run: () => this.waveCrossfire() },
      { t: 16000, run: () => this.waveVFormation() },
      { t: 19500, run: () => this.waveDragonflyPair() },
      { t: 26000, run: () => this.waveSwarmRush() },
      { t: 29500, run: () => this.waveEliteWall() },
      { t: 34000, run: () => this.waveMixed1() },
      { t: 38000, run: () => this.waveScoutFlurry() },
      { t: 41000, run: () => this.waveSniperDuo() },
      { t: 48000, run: () => this.waveHornetSwarm() },
      { t: 51500, run: () => this.waveSwarmPincer() },
      { t: 55000, run: () => this.waveCrossfire() },
      { t: 59000, run: () => this.waveEliteEscort() },
      { t: 64000, run: () => this.waveFinalGauntlet() },
      { t: 74000, run: () => this.waveEliteWall() },
      { t: 78000, run: () => this.waveHornetSwarm() },
      { t: 81500, run: () => this.waveSniperDuo() },
      { t: 85000, run: () => this.waveSwarmPincer() },
      { t: 88500, run: () => this.waveDragonflyPair() },
      { t: 96000, run: () => this.waveCrossfire() },
      { t: 100000, run: () => this.waveScoutFlurry() },
      { t: 103500, run: () => this.waveVFormation() },
      { t: 107500, run: () => this.waveSwarmRush() },
      { t: 113000, run: () => this.waveFinalGauntlet() },
    ];
  }

  // Densest of the three -- ~40% tighter than Mission 1, and introduces
  // waveSwarmStorm/waveDragonflySquadron/waveEmberGauntlet on top of
  // Mission 2's crossfire/elite-wall additions.
  buildMission3Timeline() {
    return [
      { t: 300, run: () => this.waveStraightLine() },
      { t: 3000, run: () => this.waveScoutFlurry() },
      { t: 5500, run: () => this.waveSineColumns() },
      { t: 8000, run: () => this.waveHornetSwarm() },
      { t: 10200, run: () => this.waveCrossfire() },
      { t: 12500, run: () => this.waveDragonflySquadron() },
      { t: 15500, run: () => this.waveSwarmStorm() },
      { t: 19000, run: () => this.waveEliteWall() },
      { t: 22500, run: () => this.waveMixed1() },
      { t: 25500, run: () => this.waveScoutFlurry() },
      { t: 27500, run: () => this.waveSniperDuo() },
      { t: 32000, run: () => this.waveCrossfire() },
      { t: 35000, run: () => this.waveHornetSwarm() },
      { t: 37500, run: () => this.waveSwarmPincer() },
      { t: 40000, run: () => this.waveDragonflySquadron() },
      { t: 44000, run: () => this.waveEmberGauntlet() },
      { t: 51000, run: () => this.waveEliteWall() },
      { t: 54500, run: () => this.waveSwarmStorm() },
      { t: 58000, run: () => this.waveHornetSwarm() },
      { t: 60500, run: () => this.waveSniperDuo() },
      { t: 63000, run: () => this.waveCrossfire() },
      { t: 66000, run: () => this.waveDragonflyPair() },
      { t: 71000, run: () => this.waveEmberGauntlet() },
      { t: 78000, run: () => this.waveScoutFlurry() },
      { t: 80500, run: () => this.waveVFormation() },
      { t: 83500, run: () => this.waveSwarmStorm() },
      { t: 89000, run: () => this.waveEmberGauntlet() },
    ];
  }

  // Mission 4's pre-boss timeline (0:00-2:20) gradually introduces the
  // mechanics the boss later combines: basic enemies -> a dedicated meteor
  // field -> missiles -> mines -> a final assault mixing everything (but
  // stopping short of full bullet hell). See the mission design doc for the
  // exact beat breakdown; timestamps below target that same ~2:20 length.
  buildMission4Timeline() {
    return [
      // 0:00-0:30 -- Enemy Wave: basic ships only, no major threats yet.
      { t: 500, run: () => this.waveStraightLine() },
      { t: 5500, run: () => this.waveScoutFlurry() },
      { t: 11000, run: () => this.waveSineColumns() },
      { t: 17000, run: () => this.waveStraightLine() },
      { t: 23000, run: () => this.waveVFormation() },

      // 0:30-1:00 -- Meteor Field: meteors get frequent while enemies keep
      // attacking around the player navigating the field.
      { t: 30000, run: () => this.waveMeteorField(6) },
      { t: 36000, run: () => this.waveScoutFlurry() },
      { t: 42000, run: () => this.waveMeteorField(7) },
      { t: 48000, run: () => this.waveSniperLine() },
      { t: 54000, run: () => this.waveMeteorField(6) },

      // 1:00-1:30 -- Missile Introduction: enemy-launched slow homing
      // missiles (2-3 per wave), meteor density stays moderate.
      { t: 60000, run: () => this.waveMissileIntro(2) },
      { t: 67000, run: () => this.waveHornetSwarm() },
      { t: 74000, run: () => this.waveMissileIntro(3) },
      { t: 81000, run: () => this.waveMeteorField(4) },
      { t: 85000, run: () => this.waveMissileIntro(2) },

      // 1:30-2:00 -- Mine Zone: drifting mines combine with regular bullet
      // fire; meteor formations get bigger.
      { t: 90000, run: () => this.waveMineZone(4) },
      { t: 96000, run: () => this.waveSwarmPincer() },
      { t: 103000, run: () => this.waveMineZone(5) },
      { t: 109000, run: () => this.waveMeteorField(9) },
      { t: 115000, run: () => this.waveMineZone(4) },

      // 2:00-2:20 -- Final Assault: everything escalates together (more
      // ships, bullet spreads, missiles, mines, meteor groups) but stays
      // short of full bullet hell -- one big combined wave, not a barrage.
      { t: 120000, run: () => this.waveFinalGauntlet() },
      { t: 124000, run: () => this.waveMissileIntro(3) },
      { t: 128000, run: () => this.waveMineZone(5) },
      { t: 132000, run: () => this.waveMeteorField(8) },
      { t: 136000, run: () => this.waveEliteEscort() },

      // 2:20-2:30 -- Boss Arrival: no more spawns after this; WaveManager's
      // boss-spawn check (see update()) waits for the field to clear, then
      // fires 'boss-warning' (missions/Missions.js's bossWarning flag) and
      // holds a quiet beat before the boss actually enters.
      { t: 140000, run: () => {} },
    ];
  }

  // Meteor-dedicated wave (distinct from the ambient trickle and the one-off
  // meteorShower event) -- staggered burst across the width, count scaled
  // like the other pure-count waves.
  waveMeteorField(count) {
    const n = this.scaleCount(count);
    for (let i = 0; i < n; i++) {
      const x = Phaser.Math.Between(30, GAME_WIDTH - 30);
      this.scene.time.delayedCall(i * 260, () => this.spawnMeteor(x, -40));
    }
  }

  // Enemy-launched slow homing missiles (bossPatterns/EnemyMissile.js,
  // spawned via GameScene.spawnEnemyMissile/hazardOwner) dropping in from
  // the top alongside a couple of basic escorts, so it reads as enemy ships
  // firing missiles rather than missiles falling out of nowhere.
  waveMissileIntro(count) {
    if (!this.spawnEnemyMissile) return;
    for (let i = 0; i < count; i++) {
      const x = 60 + i * ((GAME_WIDTH - 120) / (count - 1 || 1));
      this.scene.time.delayedCall(i * 400, () => this.spawnEnemyMissile(x, -30));
    }
    this.spawnEnemy('basic', GAME_WIDTH * 0.3, -40, 'straight');
    this.spawnEnemy('basic', GAME_WIDTH * 0.7, -40, 'straight');
  }

  // Space mines (bossPatterns/Mine.js) dropped across the field alongside
  // bullet-firing sniper escorts -- "mines + normal bullets" per the spec.
  waveMineZone(count) {
    if (!this.spawnMine) return;
    for (let i = 0; i < count; i++) {
      const x = 40 + i * ((GAME_WIDTH - 80) / (count - 1 || 1));
      this.scene.time.delayedCall(i * 300, () => this.spawnMine(x, -30));
    }
    this.spawnEnemy('sniper', GAME_WIDTH * 0.25, -40, 'straight');
    this.spawnEnemy('sniper', GAME_WIDTH * 0.75, -40, 'straight');
  }

  update(time, dt) {
    if (this.missionComplete) return;
    this.elapsed += dt;

    while (this.stepIndex < this.steps.length && this.elapsed >= this.steps[this.stepIndex].t) {
      this.steps[this.stepIndex].run();
      this.spawnBonusEnemies();
      this.stepIndex++;
    }

    if (this.stepIndex >= this.steps.length) {
      this.allWavesSpawned = true;
    }

    const cfg = this.meteorShowerConfig;
    if (cfg.enabled && !this.meteorShowerTriggered && this.elapsed >= this.missionDurationMs * cfg.triggerAtFraction) {
      this.meteorShowerTriggered = true;
      this.triggerMeteorShower();
    }

    if (this.allWavesSpawned && !this.bossSpawned && this.getActiveHostileCount() === 0) {
      this.bossSpawned = true;
      // Mission 4 spec: enemies stop cold, the screen goes quiet, a warning
      // banner shows, THEN the boss enters -- a longer beat than the plain
      // 1s beat other missions use (see HUDScene's boss-warning banner).
      if (getMissionConfig(this.missionNumber).bossWarning) {
        this.scene.appEvents.emit('boss-warning');
        this.scene.time.delayedCall(3200, () => this.spawnBoss());
      } else {
        this.scene.time.delayedCall(1000, () => this.spawnBoss());
      }
    }
  }

  // --- wave definitions ----------------------------------------------------

  waveStraightLine() {
    const count = this.scaleCount(5);
    for (let i = 0; i < count; i++) {
      const x = 50 + i * ((GAME_WIDTH - 100) / (count - 1 || 1));
      this.scene.time.delayedCall(i * 300, () => this.spawnEnemy('basic', x, -40, 'straight'));
    }
  }

  waveSineColumns() {
    const count = this.scaleCount(4);
    for (let i = 0; i < count; i++) {
      const x = i % 2 === 0 ? GAME_WIDTH * 0.25 : GAME_WIDTH * 0.75;
      this.scene.time.delayedCall(i * 500, () => this.spawnEnemy('fast', x, -40, 'sine'));
    }
  }

  waveSniperLine() {
    const positions = [GAME_WIDTH * 0.2, GAME_WIDTH * 0.5, GAME_WIDTH * 0.8];
    positions.forEach((x, i) => {
      this.scene.time.delayedCall(i * 700, () => this.spawnEnemy('sniper', x, -40, 'straight'));
    });
  }

  waveVFormation() {
    const centerX = GAME_WIDTH / 2;
    const positions = [-150, -80, 0, 80, 150];
    positions.forEach((offset, i) => {
      const type = offset === 0 ? 'heavy' : 'basic';
      this.scene.time.delayedCall(i * 200, () =>
        this.spawnEnemy(type, centerX + offset, -40 - Math.abs(offset) * 0.5, 'straight')
      );
    });
  }

  // Fires once per mission (if meteorShowerConfig.enabled), at
  // triggerAtFraction through the timeline -- see missions/Missions.js's
  // per-mission `meteorShower` block / config.js's METEOR_SHOWER_DEFAULTS.
  // Sets meteorShowerActive for the shower's duration so GameScene.spawnEnemy
  // can thin regular enemy spawns, letting meteors take center stage.
  triggerMeteorShower() {
    const cfg = this.meteorShowerConfig;
    const count = Math.round(cfg.count * this.meteorCountMult);
    this.meteorShowerActive = true;
    for (let i = 0; i < count; i++) {
      this.scene.time.delayedCall(i * cfg.intervalMs, () => {
        const x = Phaser.Math.Between(30, GAME_WIDTH - 30);
        this.spawnMeteor(x, -40);
      });
    }
    this.scene.time.delayedCall(cfg.durationMs, () => { this.meteorShowerActive = false; });
  }

  waveSwarmRush() {
    const count = this.scaleCount(8);
    for (let i = 0; i < count; i++) {
      const x = 30 + i * ((GAME_WIDTH - 60) / (count - 1 || 1));
      this.scene.time.delayedCall(i * 220, () => this.spawnEnemy('swarm', x, -40, 'weave'));
    }
  }

  waveMixed1() {
    const layout = ['basic', 'fast', 'sniper', 'heavy', 'fast', 'basic'];
    layout.forEach((type, i) => {
      const x = 40 + i * ((GAME_WIDTH - 80) / (layout.length - 1));
      const pattern = type === 'fast' ? 'sine' : 'straight';
      this.scene.time.delayedCall(i * 400, () => this.spawnEnemy(type, x, -40, pattern));
    });
  }

  waveSniperDuo() {
    this.spawnEnemy('sniper', GAME_WIDTH * 0.2, -40, 'straight');
    this.spawnEnemy('sniper', GAME_WIDTH * 0.8, -40, 'straight');
    const count = this.scaleCount(3);
    for (let i = 0; i < count; i++) {
      const x = GAME_WIDTH * 0.35 + i * (GAME_WIDTH * 0.3 / (count - 1 || 1));
      this.scene.time.delayedCall(300 + i * 300, () => this.spawnEnemy('basic', x, -40, 'weave'));
    }
  }

  waveSwarmPincer() {
    const count = this.scaleCount(5);
    for (let i = 0; i < count; i++) {
      this.scene.time.delayedCall(i * 250, () => this.spawnEnemy('swarm', 30, -40 - i * 20, 'sine'));
      this.scene.time.delayedCall(i * 250, () => this.spawnEnemy('swarm', GAME_WIDTH - 30, -40 - i * 20, 'sine'));
    }
  }

  waveScoutFlurry() {
    const count = this.scaleCount(6);
    for (let i = 0; i < count; i++) {
      const x = 30 + i * ((GAME_WIDTH - 60) / (count - 1 || 1));
      this.scene.time.delayedCall(i * 260, () => this.spawnEnemy('scout', x, -40, 'weave'));
    }
  }

  waveHornetSwarm() {
    const count = this.scaleCount(6);
    for (let i = 0; i < count; i++) {
      const x = i % 2 === 0 ? GAME_WIDTH * 0.3 : GAME_WIDTH * 0.7;
      this.scene.time.delayedCall(i * 300, () => this.spawnEnemy('hornet', x, -40 - i * 15, 'sine'));
    }
  }

  waveDragonflyPair() {
    const count = this.scaleCount(4);
    for (let i = 0; i < count; i++) {
      const x = i % 2 === 0 ? GAME_WIDTH * 0.22 : GAME_WIDTH * 0.78;
      this.scene.time.delayedCall(i * 400, () => this.spawnEnemy('dragonfly', x, -40, 'sine'));
    }
  }

  waveEliteEscort() {
    this.spawnEnemy('elite', GAME_WIDTH * 0.28, -50, 'straight');
    this.spawnEnemy('elite', GAME_WIDTH * 0.72, -50, 'straight');
    const count = this.scaleCount(3);
    for (let i = 0; i < count; i++) {
      const x = GAME_WIDTH * 0.4 + i * (GAME_WIDTH * 0.1 / (count - 1 || 1));
      this.scene.time.delayedCall(300 + i * 300, () => this.spawnEnemy('basic', x, -40, 'weave'));
    }
  }

  waveFinalGauntlet() {
    const layout = ['heavy', 'basic', 'sniper', 'swarm', 'hornet', 'scout', 'swarm', 'sniper', 'basic', 'heavy'];
    layout.forEach((type, i) => {
      const x = 30 + i * ((GAME_WIDTH - 60) / (layout.length - 1));
      const pattern = type === 'swarm' || type === 'scout' ? 'weave' : (type === 'hornet' ? 'sine' : 'straight');
      this.scene.time.delayedCall(i * 260, () => this.spawnEnemy(type, x, -40, pattern));
    });
    this.scene.time.delayedCall(1500, () => this.spawnEnemy('elite', GAME_WIDTH / 2, -50, 'straight'));
  }

  // --- Mission 2/3 composite waves -- mix more ship types per step instead
  // of repeating Mission 1's single-type waves at a faster tempo. -----------

  // Sniper/heavy/elite line, tighter spacing than waveMixed1 -- multiple
  // threat types converging at once instead of a single-type wave.
  waveCrossfire() {
    const layout = ['sniper', 'heavy', 'elite', 'heavy', 'sniper'];
    layout.forEach((type, i) => {
      const x = 40 + i * ((GAME_WIDTH - 80) / (layout.length - 1));
      this.scene.time.delayedCall(i * 220, () => this.spawnEnemy(type, x, -40, 'straight'));
    });
  }

  // 4 elites across the screen with a swarm escort weaving in from both
  // flanks -- a denser, wider version of waveEliteEscort.
  waveEliteWall() {
    const positions = [0.18, 0.4, 0.6, 0.82];
    positions.forEach((f, i) => {
      this.scene.time.delayedCall(i * 200, () => this.spawnEnemy('elite', GAME_WIDTH * f, -50, 'straight'));
    });
    const escortCount = this.scaleCount(4);
    for (let i = 0; i < escortCount; i++) {
      this.scene.time.delayedCall(300 + i * 200, () => this.spawnEnemy('swarm', 20, -40 - i * 15, 'weave'));
      this.scene.time.delayedCall(300 + i * 200, () => this.spawnEnemy('swarm', GAME_WIDTH - 20, -40 - i * 15, 'weave'));
    }
  }

  // Swarm rush from both sides simultaneously -- worse than waveSwarmPincer,
  // meant to feel like a genuine crossfire storm, Mission 3 only.
  waveSwarmStorm() {
    const count = this.scaleCount(7);
    for (let i = 0; i < count; i++) {
      this.scene.time.delayedCall(i * 160, () => this.spawnEnemy('swarm', 20, -40 - i * 15, 'sine'));
      this.scene.time.delayedCall(i * 160, () => this.spawnEnemy('swarm', GAME_WIDTH - 20, -40 - i * 15, 'sine'));
    }
  }

  // 6 dragonflies weaving in alternating columns -- a bigger version of
  // waveDragonflyPair, Mission 3 only.
  waveDragonflySquadron() {
    const count = this.scaleCount(6);
    for (let i = 0; i < count; i++) {
      const x = i % 2 === 0 ? GAME_WIDTH * 0.2 : GAME_WIDTH * 0.8;
      this.scene.time.delayedCall(i * 300, () => this.spawnEnemy('dragonfly', x, -40, 'sine'));
    }
  }

  // Mission 3's dense finisher wave -- heavy/hornet/dragonfly/elite mix,
  // themed to escalate alongside the fire boss.
  waveEmberGauntlet() {
    const layout = ['heavy', 'hornet', 'dragonfly', 'elite', 'dragonfly', 'hornet', 'heavy'];
    layout.forEach((type, i) => {
      const x = 30 + i * ((GAME_WIDTH - 60) / (layout.length - 1));
      const pattern = type === 'hornet' || type === 'dragonfly' ? 'sine' : 'straight';
      this.scene.time.delayedCall(i * 220, () => this.spawnEnemy(type, x, -40, pattern));
    });
    this.scene.time.delayedCall(1300, () => this.spawnEnemy('elite', GAME_WIDTH / 2, -50, 'straight'));
  }
}
