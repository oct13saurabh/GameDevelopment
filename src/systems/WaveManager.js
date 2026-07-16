import { GAME_WIDTH } from '../config.js';

// Mission 1 timeline: a sequence of timed spawn steps, followed by a boss
// once all prior waves are cleared. `spawnEnemy(typeKey, x, y, pattern)`,
// `spawnMeteor(x, y)` and `spawnBoss()` are injected from GameScene.
//
// Steps are spaced tightly (~4-5s apart) so the screen rarely sits empty,
// running from t=500ms to t=150000 (2.5 minutes) so there's a full 2.5
// minutes of wave content before the boss even appears (which then adds its
// own fight time on top).

export default class WaveManager {
  constructor(scene, { spawnEnemy, spawnMeteor, spawnBoss, getActiveHostileCount, meteorCountMult = 1 }) {
    this.scene = scene;
    this.spawnEnemy = spawnEnemy;
    this.spawnMeteor = spawnMeteor;
    this.spawnBoss = spawnBoss;
    this.getActiveHostileCount = getActiveHostileCount;
    this.meteorCountMult = meteorCountMult;

    this.elapsed = 0;
    this.stepIndex = 0;
    this.allWavesSpawned = false;
    this.bossSpawned = false;
    this.missionComplete = false;

    this.steps = this.buildTimeline();
  }

  buildTimeline() {
    return [
      { t: 500, run: () => this.waveStraightLine() },
      { t: 5000, run: () => this.waveScoutFlurry() },
      { t: 9000, run: () => this.waveSineColumns() },
      { t: 13000, run: () => this.waveHornetSwarm() },
      { t: 17000, run: () => this.waveSniperLine() },
      { t: 21000, run: () => this.waveVFormation() },
      { t: 26000, run: () => this.waveDragonflyPair() },
      { t: 30000, run: () => this.meteorShower() },
      { t: 35000, run: () => this.waveSwarmRush() },
      { t: 40000, run: () => this.waveEliteEscort() },
      { t: 45000, run: () => this.waveMixed1() },
      { t: 50000, run: () => this.waveScoutFlurry() },
      { t: 54000, run: () => this.waveSniperDuo() },
      { t: 59000, run: () => this.meteorShower() },
      { t: 64000, run: () => this.waveHornetSwarm() },
      { t: 69000, run: () => this.waveSwarmPincer() },
      { t: 74000, run: () => this.waveDragonflyPair() },
      { t: 79000, run: () => this.waveEliteEscort() },
      { t: 85000, run: () => this.waveFinalGauntlet() },
      { t: 93000, run: () => this.meteorShower() },
      { t: 98000, run: () => this.waveMixed1() },
      { t: 103000, run: () => this.waveHornetSwarm() },
      { t: 108000, run: () => this.waveSniperDuo() },
      { t: 113000, run: () => this.waveSwarmPincer() },
      { t: 118000, run: () => this.waveDragonflyPair() },
      { t: 123000, run: () => this.meteorShower() },
      { t: 128000, run: () => this.waveEliteEscort() },
      { t: 133000, run: () => this.waveScoutFlurry() },
      { t: 138000, run: () => this.waveVFormation() },
      { t: 143000, run: () => this.waveSwarmRush() },
      { t: 150000, run: () => this.waveFinalGauntlet() },
    ];
  }

  update(time, dt) {
    if (this.missionComplete) return;
    this.elapsed += dt;

    while (this.stepIndex < this.steps.length && this.elapsed >= this.steps[this.stepIndex].t) {
      this.steps[this.stepIndex].run();
      this.stepIndex++;
    }

    if (this.stepIndex >= this.steps.length) {
      this.allWavesSpawned = true;
    }

    if (this.allWavesSpawned && !this.bossSpawned && this.getActiveHostileCount() === 0) {
      this.bossSpawned = true;
      this.scene.time.delayedCall(1000, () => this.spawnBoss());
    }
  }

  // --- wave definitions ----------------------------------------------------

  waveStraightLine() {
    for (let i = 0; i < 5; i++) {
      const x = 50 + i * ((GAME_WIDTH - 100) / 4);
      this.scene.time.delayedCall(i * 300, () => this.spawnEnemy('basic', x, -40, 'straight'));
    }
  }

  waveSineColumns() {
    for (let i = 0; i < 4; i++) {
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

  meteorShower() {
    const count = Math.round(7 * this.meteorCountMult);
    for (let i = 0; i < count; i++) {
      this.scene.time.delayedCall(i * 550, () => {
        const x = Phaser.Math.Between(30, GAME_WIDTH - 30);
        this.spawnMeteor(x, -40);
      });
    }
  }

  waveSwarmRush() {
    for (let i = 0; i < 8; i++) {
      const x = 30 + i * ((GAME_WIDTH - 60) / 7);
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
    for (let i = 0; i < 3; i++) {
      const x = GAME_WIDTH * 0.35 + i * (GAME_WIDTH * 0.15);
      this.scene.time.delayedCall(300 + i * 300, () => this.spawnEnemy('basic', x, -40, 'weave'));
    }
  }

  waveSwarmPincer() {
    for (let i = 0; i < 5; i++) {
      this.scene.time.delayedCall(i * 250, () => this.spawnEnemy('swarm', 30, -40 - i * 20, 'sine'));
      this.scene.time.delayedCall(i * 250, () => this.spawnEnemy('swarm', GAME_WIDTH - 30, -40 - i * 20, 'sine'));
    }
  }

  waveScoutFlurry() {
    for (let i = 0; i < 6; i++) {
      const x = 30 + i * ((GAME_WIDTH - 60) / 5);
      this.scene.time.delayedCall(i * 260, () => this.spawnEnemy('scout', x, -40, 'weave'));
    }
  }

  waveHornetSwarm() {
    for (let i = 0; i < 6; i++) {
      const x = i % 2 === 0 ? GAME_WIDTH * 0.3 : GAME_WIDTH * 0.7;
      this.scene.time.delayedCall(i * 300, () => this.spawnEnemy('hornet', x, -40 - i * 15, 'sine'));
    }
  }

  waveDragonflyPair() {
    for (let i = 0; i < 4; i++) {
      const x = i % 2 === 0 ? GAME_WIDTH * 0.22 : GAME_WIDTH * 0.78;
      this.scene.time.delayedCall(i * 400, () => this.spawnEnemy('dragonfly', x, -40, 'sine'));
    }
  }

  waveEliteEscort() {
    this.spawnEnemy('elite', GAME_WIDTH * 0.28, -50, 'straight');
    this.spawnEnemy('elite', GAME_WIDTH * 0.72, -50, 'straight');
    for (let i = 0; i < 3; i++) {
      const x = GAME_WIDTH * 0.4 + i * (GAME_WIDTH * 0.1);
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
}
