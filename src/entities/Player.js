import { PLAYER, WEAPON_LEVELS, WEAPON_MAX_LEVEL, WEAPON_COLOR_PATTERNS, BOMB_POWERUP, EMP_POWERUP, GAME_WIDTH, GAME_HEIGHT, TOUCH_CONTROLS } from '../config.js';

function isOverTouchButton(x, y) {
  return Object.values(TOUCH_CONTROLS).some((btn) => Phaser.Math.Distance.Between(x, y, btn.x, btn.y) <= btn.radius);
}

// Bullet art matches the color of the last weapon power-up collected; blue
// is the default look until the player collects a yellow or red one.
const BULLET_VISUAL = {
  yellow: { texture: 'bullet_player_yellow', scale: 0.02 },
  blue: { texture: 'bullet_player_blue', scale: 0.085 },
  red: { texture: 'bullet_player_red', scale: 0.02 },
};

export default class Player {
  constructor(scene, bulletPool, juice, audio, shipKey = 'ship_01', { inputType = 'keyboard', autoFire = false, isTouchDevice = false } = {}) {
    this.scene = scene;
    this.bulletPool = bulletPool;
    this.juice = juice;
    this.audio = audio;
    this.shipKey = shipKey;
    // 'keyboard' disables mouse move/fire/bomb entirely; keyboard controls
    // always stay live regardless of mode (see update() and the pointer
    // handlers below, all gated on this.inputType === 'mouse').
    this.inputType = inputType;
    this.autoFire = autoFire;
    this.isTouchDevice = isTouchDevice;
    this.idleTexture = `${shipKey}_idle`;
    this.moveTexture = `${shipKey}_move`;

    // this.sprite is the physics/collision driver only -- kept invisible and
    // never rotated, so the hitbox stays centered and predictable. What the
    // player actually sees is this.visual (see below), a plain image synced
    // to this.sprite's position every frame.
    this.sprite = scene.physics.add.image(GAME_WIDTH / 2, GAME_HEIGHT - 100, this.idleTexture);
    this.sprite.setScale(PLAYER.scale);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setVisible(false);
    // Arcade circle bodies auto-scale with the sprite, so the radius/offset
    // passed to setCircle must be in local (unscaled) units.
    const localRadius = PLAYER.hitboxRadius / PLAYER.scale;
    this.sprite.body.setCircle(localRadius, this.sprite.width / 2 - localRadius, this.sprite.height / 2 - localRadius);
    this.sprite.owner = this;

    // Pseudo-3D roll: banking is simulated by narrowing the ship's width
    // (scaleX) and leaning it sideways, as if rolling around its nose-tail
    // axis away from an overhead camera -- not a flat 2D rotation (which
    // would actually simulate yaw, swinging the nose sideways).
    this.visual = scene.add.image(this.sprite.x, this.sprite.y, this.idleTexture);
    this.visual.setScale(PLAYER.scale);
    this.rollAmount = 0; // -1 (full left) .. 1 (full right), eased each frame
    this.velX = 0; // current eased velocity -- drives the floaty inertia feel
    this.velY = 0;

    // Invisible physics body sized to the shield aura's on-screen radius --
    // lets enemy bullets get intercepted (and flicker out) at the visual
    // shield boundary instead of only at the ship's much smaller hitbox.
    // Created empty upfront so GameScene can wire up the overlap in
    // setupCollisions() regardless of whether shield is active yet.
    this.shieldSpriteGroup = scene.physics.add.group();

    this.weaponLevel = 1;
    this.bulletColor = 'red';
    this.health = PLAYER.startHealth;
    this.maxHealth = PLAYER.startHealth;
    this.lives = PLAYER.startLives;
    this.score = 0;
    this.invulnerable = false;
    this.alive = true;

    this.shieldActive = false;
    this.rocketPowerActive = false;
    this.rocketPowerEndAt = 0;
    this.rocketInFlight = false;
    this.bombCount = 0;
    this.empCount = 0;

    this.lastFired = 0;
    this.keys = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      bomb: Phaser.Input.Keyboard.KeyCodes.B,
      emp: Phaser.Input.Keyboard.KeyCodes.E,
    });

    // Mouse support: left-click fires (mirrors space), right-click
    // detonates a bomb (mirrors B), middle-click detonates an EMP (mirrors
    // E). Browsers open a context menu on right-click by default, so that's
    // suppressed for the canvas.
    scene.input.mouse.disableContextMenu();
    this.pointerFireDown = false;
    this.onPointerDown = (pointer) => {
      if (this.inputType !== 'mouse') return;
      if (isOverTouchButton(pointer.x, pointer.y)) return;
      if (pointer.leftButtonDown()) this.pointerFireDown = true;
      if (pointer.rightButtonDown()) this.useBomb();
      if (pointer.middleButtonDown()) this.useEmp();
    };
    this.onPointerUp = (pointer) => {
      if (!pointer.leftButtonDown()) this.pointerFireDown = false;
    };
    this.pointerTargetX = null;
    this.pointerTargetY = null;
    this.onPointerMove = (pointer) => {
      if (this.inputType !== 'mouse') return;
      if (isOverTouchButton(pointer.x, pointer.y)) return;
      this.pointerTargetX = pointer.x;
      this.pointerTargetY = this.isTouchDevice ? pointer.y - TOUCH_CONTROLS.yOffset : pointer.y;
    };
    scene.input.on('pointerdown', this.onPointerDown);
    scene.input.on('pointerup', this.onPointerUp);
    scene.input.on('pointermove', this.onPointerMove);

    this.engineTrail = juice.engineTrail(scene, this.sprite);
  }

  get weaponConfig() {
    return WEAPON_LEVELS[Math.min(this.weaponLevel, WEAPON_LEVELS.length) - 1];
  }

  update(time, dt) {
    if (!this.alive) return;

    if (this.shieldAura) this.shieldAura.setPosition(this.sprite.x, this.sprite.y);
    if (this.shieldSprite) this.shieldSprite.setPosition(this.sprite.x, this.sprite.y);

    const body = this.sprite.body;
    const k = this.keys;
    // Gamepad (e.g. a PS4 pad via DS4Windows, exposed as a standard XInput
    // gamepad) is read unconditionally, same as keyboard -- not gated by
    // inputType, which only toggles mouse steering/firing on or off.
    const pad = this.scene.input.gamepad && this.scene.input.gamepad.total > 0
      ? this.scene.input.gamepad.getPad(0)
      : null;
    let vx = 0;
    let vy = 0;
    if (k.left.isDown || k.a.isDown) vx -= 1;
    if (k.right.isDown || k.d.isDown) vx += 1;
    if (k.up.isDown || k.w.isDown) vy -= 1;
    if (k.down.isDown || k.s.isDown) vy += 1;
    const padDeadzone = 0.15;
    if (pad && (Math.abs(pad.leftStick.x) > padDeadzone || Math.abs(pad.leftStick.y) > padDeadzone)) {
      vx += pad.leftStick.x;
      vy += pad.leftStick.y;
    }
    const keyboardActive = vx !== 0 || vy !== 0;

    // Floaty inertia: ease velocity toward the input target each frame
    // instead of snapping to it. Accelerating is snappier than coasting to
    // a stop, so releasing input drifts for a beat before settling -- the
    // Descent/Asteroids "floating in space" feel instead of robotic instant
    // starts/stops.
    let targetVX;
    let targetVY;
    if (keyboardActive) {
      const len = Math.hypot(vx, vy) || 1;
      targetVX = (vx / len) * PLAYER.speed;
      targetVY = (vy / len) * PLAYER.speed;
    } else if (this.pointerTargetX !== null) {
      // Mouse steering: chase the cursor, easing off as the ship nears it
      // (clamped to full speed) so it settles instead of orbiting/overshooting.
      const dx = this.pointerTargetX - this.sprite.x;
      const dy = this.pointerTargetY - this.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 4) {
        targetVX = 0;
        targetVY = 0;
      } else {
        const speed = Math.min(dist * 6, PLAYER.speed);
        targetVX = (dx / dist) * speed;
        targetVY = (dy / dist) * speed;
      }
    } else {
      targetVX = 0;
      targetVY = 0;
    }
    const lerpX = Math.abs(targetVX) > Math.abs(this.velX) ? PLAYER.floatAccelLerp : PLAYER.floatDecelLerp;
    const lerpY = Math.abs(targetVY) > Math.abs(this.velY) ? PLAYER.floatAccelLerp : PLAYER.floatDecelLerp;
    this.velX = Phaser.Math.Linear(this.velX, targetVX, lerpX);
    this.velY = Phaser.Math.Linear(this.velY, targetVY, lerpY);
    body.setVelocity(this.velX, this.velY);

    // Bank the ship toward the direction it's actually drifting, easing back
    // to level flight when there's no horizontal input.
    this.rollAmount = Phaser.Math.Linear(this.rollAmount, this.velX / PLAYER.speed, PLAYER.tiltLerp);
    const rollRad = Phaser.Math.DegToRad(this.rollAmount * PLAYER.tiltMaxDeg);

    // Width foreshortens as the ship "rolls" away from the overhead camera
    // (nose-tail length is unaffected -- only the wingspan narrows), plus a
    // small sideways lean into the turn so it doesn't read as just shrinking.
    this.visual.scaleX = PLAYER.scale * Math.cos(rollRad);
    this.visual.scaleY = PLAYER.scale;
    this.visual.setPosition(this.sprite.x + Math.sin(rollRad) * PLAYER.tiltLeanPx, this.sprite.y);

    // Ship_01-2 = moving left/right/forward; Ship_01-1 = idle or moving
    // backward (down), per the art's intended states.
    const moving = targetVX !== 0 || targetVY < 0;
    if (moving !== this.isMovingTexture) {
      this.isMovingTexture = moving;
      this.visual.setTexture(moving ? this.moveTexture : this.idleTexture);
    }

    const padFireDown = !!(pad && pad.buttons[0] && pad.buttons[0].pressed); // Cross
    if (this.autoFire || k.space.isDown || padFireDown || (this.inputType === 'mouse' && this.pointerFireDown)) {
      this.tryFire(time);
    }

    // Phaser gamepad buttons have no built-in JustDown, so the press edge
    // (Circle, button 1 / Square, button 2) is tracked manually across frames.
    const padBombDown = !!(pad && pad.buttons[1] && pad.buttons[1].pressed);
    if (Phaser.Input.Keyboard.JustDown(k.bomb) || (padBombDown && !this._padBombPrev)) {
      this.useBomb();
    }
    const padEmpDown = !!(pad && pad.buttons[2] && pad.buttons[2].pressed);
    if (Phaser.Input.Keyboard.JustDown(k.emp) || (padEmpDown && !this._padEmpPrev)) {
      this.useEmp();
    }
    this._padEmpPrev = padEmpDown;
    this._padBombPrev = padBombDown;

    if (this.rocketPowerActive) {
      if (time >= this.rocketPowerEndAt) {
        this.rocketPowerActive = false;
        this.scene.appEvents.emit('rocket-power-changed', false, 0);
      } else if (!this.rocketInFlight) {
        const spawned = this.scene.trySpawnMissile(this.sprite.x, this.sprite.y - this.sprite.displayHeight / 3);
        if (spawned) this.rocketInFlight = true;
      }
    }
  }

  tryFire(time) {
    const cfg = this.weaponConfig;
    const pattern = WEAPON_COLOR_PATTERNS[this.bulletColor] || WEAPON_COLOR_PATTERNS.blue;
    // At max weapon level, a color pattern can override the fire-rate gap
    // (e.g. red goes near-continuous instead of the shared level-5 rate).
    const fireRate = this.weaponLevel >= WEAPON_MAX_LEVEL && pattern.maxLevelFireRate !== undefined
      ? pattern.maxLevelFireRate
      : cfg.fireRate;
    if (time - this.lastFired < fireRate) return;
    this.lastFired = time;

    const x = this.sprite.x;
    const y = this.sprite.y - this.sprite.displayHeight / 3;
    const n = cfg.bulletCount;
    const visual = BULLET_VISUAL[this.bulletColor] || BULLET_VISUAL.blue;

    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5; // -0.5..0.5, spread symmetrically
      const angle = -90 + t * pattern.spreadDeg;
      // Parallel-column offset only makes sense for the straight pattern --
      // an angled fan (yellow) fires from a single point instead.
      const xOff = pattern.spreadDeg === 0 ? t * 24 : 0;
      this.bulletPool.fire(x + xOff, y, angle, PLAYER.bulletSpeed, {
        texture: visual.texture, damage: PLAYER.bulletDamage, scale: visual.scale, pierce: pattern.pierce,
      });
    }
    this.audio.playerShoot();
  }

  // Applies a collected shooting power-up. Collecting the SAME color again
  // steps the weapon level up by 1 (stacking), capping at WEAPON_MAX_LEVEL.
  // Collecting a DIFFERENT color switches the fire pattern but costs 1
  // level as a switching penalty -- except at level 1, where there's
  // nowhere lower to drop to, so it switches for free.
  applyColorPowerUp(color) {
    if (this.weaponLevel >= WEAPON_MAX_LEVEL) {
      // Already fully maxed out -- nowhere left to level up to, so this
      // pickup detonates a mega blast instead.
      this.bulletColor = color;
      this.scene.triggerMegaBlast(this.sprite.x, this.sprite.y);
      this.scene.appEvents.emit('weapon-changed', this.weaponLevel, this.bulletColor);
      return;
    }
    if (color === this.bulletColor) {
      this.weaponLevel = Math.min(this.weaponLevel + 1, WEAPON_MAX_LEVEL);
    } else if (this.weaponLevel > 1) {
      this.weaponLevel -= 1;
    }
    this.bulletColor = color;
    this.scene.appEvents.emit('weapon-changed', this.weaponLevel, this.bulletColor);
  }

  downgradeWeapon() {
    this.weaponLevel = Math.max(this.weaponLevel - 1, 1);
    this.scene.appEvents.emit('weapon-changed', this.weaponLevel, this.bulletColor);
  }

  addScore(amount) {
    this.score += amount;
    this.scene.appEvents.emit('score-changed', this.score);
  }

  addLife() {
    this.lives += 1;
    this.scene.appEvents.emit('player-lives-changed', this.lives);
  }

  addBomb() {
    this.bombCount = Math.min(this.bombCount + 1, BOMB_POWERUP.maxStock);
    this.scene.appEvents.emit('bomb-count-changed', this.bombCount);
  }

  useBomb() {
    if (this.bombCount <= 0 || !this.alive) return;
    this.bombCount -= 1;
    this.scene.appEvents.emit('bomb-count-changed', this.bombCount);
    this.scene.triggerBombBlast(this.sprite.x, this.sprite.y);
  }

  addEmp() {
    this.empCount = Math.min(this.empCount + 1, EMP_POWERUP.maxStock);
    this.scene.appEvents.emit('emp-count-changed', this.empCount);
  }

  useEmp() {
    if (this.empCount <= 0 || !this.alive) return;
    this.empCount -= 1;
    this.scene.appEvents.emit('emp-count-changed', this.empCount);
    this.scene.triggerEmpStun(this.sprite.x, this.sprite.y);
  }

  activateRocketPower(ms) {
    this.rocketPowerActive = true;
    this.rocketPowerEndAt = this.scene.time.now + ms;
    this.rocketInFlight = false;
    this.scene.appEvents.emit('rocket-power-changed', true, ms);
  }

  activateShield(ms) {
    this.invulnerable = true;
    this.shieldActive = true;
    this.scene.appEvents.emit('shield-changed', true, ms);

    // Visible protective sphere around the ship -- the ship itself is left
    // untinted/fully visible, the aura sits behind it and pulses gently.
    if (!this.shieldAura) {
      this.shieldAura = this.scene.add.image(this.sprite.x, this.sprite.y, 'shield_effect');
      this.shieldAura.setAlpha(0.8);
      this.shieldAura.setDepth((this.sprite.depth || 0) - 1);
      const targetScale = (this.sprite.displayWidth * 2.4) / this.shieldAura.width;
      this.shieldAura.setScale(targetScale);
      this._shieldPulse = this.scene.tweens.add({
        targets: this.shieldAura,
        alpha: { from: 0.6, to: 0.9 },
        scale: { from: targetScale * 0.94, to: targetScale * 1.06 },
        duration: 400,
        yoyo: true,
        repeat: -1,
      });

      // Invisible collision circle matching the aura's on-screen radius, so
      // enemy bullets get intercepted at the shield boundary (see
      // GameScene.onEnemyBulletHitShield) instead of visually clipping
      // through to the ship before being silently killed.
      const shieldRadius = this.shieldAura.displayWidth / 2;
      this.shieldSprite = this.scene.physics.add.image(this.sprite.x, this.sprite.y, 'particle_soft');
      this.shieldSprite.setVisible(false);
      this.shieldSpriteGroup.add(this.shieldSprite);
      const localRadius = shieldRadius / this.shieldSprite.scaleX;
      this.shieldSprite.body.setCircle(
        localRadius,
        this.shieldSprite.width / 2 - localRadius,
        this.shieldSprite.height / 2 - localRadius
      );
    }

    if (this._shieldTimer) this._shieldTimer.remove(false);
    this._shieldTimer = this.scene.time.delayedCall(ms, () => {
      this.invulnerable = false;
      this.shieldActive = false;
      this.destroyShieldAura();
      this.scene.appEvents.emit('shield-changed', false, 0);
    });
  }

  destroyShieldAura() {
    if (this._shieldPulse) {
      this._shieldPulse.remove();
      this._shieldPulse = null;
    }
    if (this.shieldAura) {
      this.shieldAura.destroy();
      this.shieldAura = null;
    }
    if (this.shieldSprite) {
      this.shieldSprite.destroy();
      this.shieldSprite = null;
    }
  }

  takeDamage(amount) {
    if (this.invulnerable || !this.alive) return;
    const mult = (this.scene.diffCfg && this.scene.diffCfg.damageTakenMult) || 1;
    this.health -= amount * mult;
    this.audio.playerHurt();
    this.juice.flashSprite(this.visual, 0xff4444);
    this.scene.appEvents.emit('player-health-changed', this.health, this.maxHealth);

    if (this.health <= 0) {
      this.loseLife();
    } else {
      // Brief i-frames after any non-lethal hit so simultaneous damage
      // sources (e.g. a bullet and a ramming enemy in the same frame)
      // can't stack into an unfair multi-hit.
      this.setInvulnerable(PLAYER.hitInvulnMs);
    }
  }

  loseLife() {
    this.lives -= 1;
    this.scene.appEvents.emit('player-lives-changed', this.lives);
    this.juice.explosion(this.sprite.x, this.sprite.y, { scale: 1.2, variant: 'medium' });
    this.juice.shake(200, 0.015);
    this.audio.explosionSmall();

    if (this.lives <= 0) {
      this.alive = false;
      this.visual.setVisible(false);
      this.sprite.body.enable = false;
      this.destroyShieldAura();
      this.scene.appEvents.emit('player-died');
      return;
    }

    this.respawn();
  }

  respawn() {
    this.health = this.maxHealth;
    // downgradeWeapon can itself emit 'weapon-changed' at level 1 -- suppress
    // that generic guaranteed-drop path here since 'player-respawned' below
    // (see GameScene.setupEventHandlers) owns the respawn drop behavior.
    this.scene.suppressWeaponGuarantee = true;
    this.downgradeWeapon();
    this.scene.suppressWeaponGuarantee = false;
    this.sprite.setPosition(GAME_WIDTH / 2, GAME_HEIGHT - 100);
    this.velX = 0;
    this.velY = 0;
    this.rollAmount = 0;
    this.visual.scaleX = PLAYER.scale;
    this.visual.setPosition(this.sprite.x, this.sprite.y);
    this.visual.setVisible(true);
    this.scene.appEvents.emit('player-health-changed', this.health, this.maxHealth);
    this.scene.appEvents.emit('player-respawned');
    this.setInvulnerable(PLAYER.invulnMs);
  }

  setInvulnerable(ms) {
    this.invulnerable = true;
    this.visual.setAlpha(0.5);
    let blinkEvent = this.scene.time.addEvent({
      delay: 100,
      repeat: Math.floor(ms / 100),
      callback: () => {
        this.visual.setAlpha(this.visual.alpha === 0.5 ? 1 : 0.5);
      },
    });
    this.scene.time.delayedCall(ms, () => {
      this.invulnerable = false;
      this.visual.setAlpha(1);
      if (blinkEvent) blinkEvent.remove(false);
    });
  }

  destroy() {
    if (this.engineTrail) this.engineTrail.destroy();
    this.destroyShieldAura();
    this.scene.input.off('pointerdown', this.onPointerDown);
    this.scene.input.off('pointerup', this.onPointerUp);
    this.scene.input.off('pointermove', this.onPointerMove);
    this.visual.destroy();
    this.sprite.destroy();
  }
}
