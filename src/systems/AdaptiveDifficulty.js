import { ADAPTIVE, ADAPTIVE_REAL_TIERS, WEAPON_MAX_LEVEL } from '../config.js';

// Live difficulty controller for the 'adaptive' picker option (see
// GameScene.applyAdaptiveTier). Owns an index into ADAPTIVE_REAL_TIERS.
// Upshift trigger is deliberately singular: reaching WEAPON_MAX_LEVEL in a
// color (see ADAPTIVE.weaponMaxLevelTierByColor) is the only thing that
// ramps difficulty UP. Score rate looked like a good
// second upshift signal on paper, but with auto-fire on, passive kill pace
// is driven by spawn density, not player skill -- any real play blows past
// a "fast scoring" threshold almost immediately, so it's downshift-only
// (low score rate reliably means struggling, no such false-positive risk).
// Lives lost is also downshift-only. Every request funnels through
// requestTier() so a single cooldown (ADAPTIVE.minAdjustIntervalMs) keeps
// the tier from thrashing back and forth.
export default class AdaptiveDifficulty {
  constructor({ onTierChange }) {
    this.onTierChange = onTierChange;
    this.tierIndex = Math.max(ADAPTIVE_REAL_TIERS.indexOf(ADAPTIVE.startTier), 0);
    this.lastAdjustMs = -Infinity;
    this.elapsedMs = 0;
    this.windowStartMs = 0;
    this.windowStartScore = 0;
    this.prevLives = null;
  }

  get tierKey() {
    return ADAPTIVE_REAL_TIERS[this.tierIndex];
  }

  requestTier(newIndex) {
    const clamped = Phaser.Math.Clamp(newIndex, 0, ADAPTIVE_REAL_TIERS.length - 1);
    if (clamped === this.tierIndex) return;
    if (this.elapsedMs - this.lastAdjustMs < ADAPTIVE.minAdjustIntervalMs) return;
    this.tierIndex = clamped;
    this.lastAdjustMs = this.elapsedMs;
    this.onTierChange(this.tierKey);
  }

  onWeaponChanged(level, color) {
    if (level < WEAPON_MAX_LEVEL) return;
    const targetTier = ADAPTIVE.weaponMaxLevelTierByColor[color];
    if (targetTier) this.requestTier(ADAPTIVE_REAL_TIERS.indexOf(targetTier));
  }

  onLivesChanged(lives) {
    if (this.prevLives !== null && lives < this.prevLives) {
      this.requestTier(this.tierIndex - 1);
    }
    this.prevLives = lives;
  }

  update(dt, currentScore) {
    this.elapsedMs += dt;
    if (this.elapsedMs - this.windowStartMs < ADAPTIVE.scoreWindowMs) return;

    const windowSec = (this.elapsedMs - this.windowStartMs) / 1000;
    const scorePerSec = (currentScore - this.windowStartScore) / windowSec;
    if (scorePerSec < ADAPTIVE.scoreDownPerSec) {
      this.requestTier(this.tierIndex - 1);
    }

    this.windowStartMs = this.elapsedMs;
    this.windowStartScore = currentScore;
  }
}
