import { POWERUP, SHOOTING_POWERUP, ROCKET_POWERUP, SHIELD_POWERUP, GAME_WIDTH, GAME_HEIGHT } from '../config.js';

// spin/breathe disabled across the board -- power-up icons hold still
// (no rotation, no pulse), only drift/fall like the other pickups.
// yellow/blue/red/health/missile/shield/bomb/emp all use large (~1024px)
// source art -- BootScene.bakeOtherLargeTextures() resamples them down to a
// crisp 150px-wide texture at load time (fixes NPOT-mipmap blur), so their
// scale here is tuned against that fixed 150px baseline (0.07/0.05 * 1024/150)
// instead of the raw source resolution. powerup_life_icon is already small
// (87px) and isn't baked, so its scale is untouched.
const TYPE_CONFIG = {
  weapon: { texture: 'powerup_yellow', scale: 0.478, spin: false, breathe: false }, // texture overridden per-frame for 'weapon'
  health: { texture: 'powerup_health', scale: 0.341, spin: false, breathe: false },
  rocket: { texture: 'powerup_missile', scale: 0.341, spin: false, breathe: false },
  shield: { texture: 'powerup_shield_icon', scale: 0.341, spin: false, breathe: false },
  bomb: { texture: 'powerup_bomb', scale: 0.341, spin: false, breathe: false },
  emp: { texture: 'powerup_emp', scale: 0.341, spin: false, breathe: false },
  life: { texture: 'powerup_life_icon', scale: 0.32, spin: false, breathe: false },
};

export default class PowerUp {
  constructor(scene, audio, x, y, type = 'weapon', spriteGroup = null) {
    this.scene = scene;
    this.audio = audio;
    this.type = type;
    this.alive = true;
    this.spawnTime = scene.time.now;

    const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.weapon;
    this.cfg = cfg;
    this.sprite = scene.physics.add.image(x, y, cfg.texture);
    // Physics groups reset velocity to their (zero) defaults when a sprite is
    // added, so join the group BEFORE configuring body/velocity, not after.
    if (spriteGroup) spriteGroup.add(this.sprite);
    this.sprite.setScale(cfg.scale);
    // Arcade circle bodies auto-scale with the sprite, so the radius/offset
    // passed to setCircle must be in local (unscaled) units.
    const localRadius = POWERUP.hitboxRadius / cfg.scale;
    this.sprite.body.setCircle(localRadius, this.sprite.width / 2 - localRadius, this.sprite.height / 2 - localRadius);
    this.sprite.owner = this;

    if (type === 'weapon') {
      // Weapon tiers hover, drifting side to side across the full screen
      // width, before starting to fall (see update()).
      this.descending = false;
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.sprite.body.setVelocityX(dir * SHOOTING_POWERUP.hoverSpeedX);
    } else {
      this.sprite.body.setVelocityY(POWERUP.fallSpeed);
    }

    this.rotationSpeedRad = Phaser.Math.DegToRad(POWERUP.rotationSpeedDeg);

    if (cfg.breathe) {
      this.scene.tweens.add({
        targets: this.sprite,
        scale: { from: cfg.scale * 0.85, to: cfg.scale * 1.15 },
        duration: 450,
        yoyo: true,
        repeat: -1,
      });
    }

    if (type === 'weapon') {
      this.colorTier = SHOOTING_POWERUP.colors[0];
      this.visualLevel = 1;
    }
  }

  update(time, dt) {
    if (!this.alive) return;

    if (this.cfg.spin) this.sprite.rotation += this.rotationSpeedRad * (dt / 1000);

    if (this.type === 'weapon') {
      this.updateShootingPowerUp(time, dt);

      if (!this.descending) {
        // Bounce off the screen edges while hovering.
        const margin = this.sprite.displayWidth / 2;
        const vx = this.sprite.body.velocity.x;
        if (this.sprite.x <= margin && vx < 0) this.sprite.body.setVelocityX(-vx);
        else if (this.sprite.x >= GAME_WIDTH - margin && vx > 0) this.sprite.body.setVelocityX(-vx);

        if (time - this.spawnTime >= SHOOTING_POWERUP.hoverDurationMs) {
          this.descending = true;
          this.sprite.body.setVelocityX(0);
          this.sprite.body.setVelocityY(POWERUP.fallSpeed);
        }
      }
    }

    if (this.sprite.y > GAME_HEIGHT + 40) {
      this.destroy();
    }
  }

  // Cycles yellow -> blue -> red -> yellow -> ... repeating every
  // phaseDurationMs for as long as the pickup is alive, and drives a
  // "charging" glow through 5 visual levels within each color phase so the
  // player can see the next color transition coming.
  updateShootingPowerUp(time) {
    const elapsed = time - this.spawnTime;
    const phaseIndex = Math.floor(elapsed / SHOOTING_POWERUP.phaseDurationMs) % SHOOTING_POWERUP.colors.length;
    const tier = SHOOTING_POWERUP.colors[phaseIndex];
    if (tier !== this.colorTier) {
      this.colorTier = tier;
      this.sprite.setTexture(`powerup_${tier}`);
    }

    const elapsedInPhase = elapsed % SHOOTING_POWERUP.phaseDurationMs;
    const levelDurationMs = SHOOTING_POWERUP.phaseDurationMs / SHOOTING_POWERUP.visualLevelsPerColor;
    this.visualLevel = Phaser.Math.Clamp(
      Math.floor(elapsedInPhase / levelDurationMs) + 1,
      1,
      SHOOTING_POWERUP.visualLevelsPerColor
    );
  }

  collect(player) {
    if (!this.alive) return;
    this.alive = false;
    this.audio.pickup();
    if (this.type === 'weapon') {
      player.applyColorPowerUp(this.colorTier);
    } else if (this.type === 'health') {
      player.health = Math.min(player.health + 30, player.maxHealth);
      this.scene.appEvents.emit('player-health-changed', player.health, player.maxHealth);
    } else if (this.type === 'rocket') {
      player.activateRocketPower(ROCKET_POWERUP.durationMs);
    } else if (this.type === 'shield') {
      player.activateShield(SHIELD_POWERUP.durationMs);
    } else if (this.type === 'bomb') {
      player.addBomb();
    } else if (this.type === 'emp') {
      player.addEmp();
    } else if (this.type === 'life') {
      player.addLife();
    }
    this.destroy();
  }

  destroy() {
    this.alive = false;
    if (this.glow) {
      this.glow.destroy();
      this.glow = null;
    }
    if (this.sprite) {
      this.sprite.owner = null;
      this.sprite.destroy();
      this.sprite = null;
    }
  }
}
