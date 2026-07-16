# Player — Mechanics Reference (Mission 1)

Source: `src/entities/Player.js`, `src/config.js` (`PLAYER`, `WEAPON_LEVELS`, `SHOOTING_POWERUP`, `ROCKET_POWERUP`, `SHIELD_POWERUP`, `BOMB_POWERUP`, `POWERUP`, `DIFFICULTY`, `INPUT_TYPES`).

## Movement & input
- Two input modes (`DEFAULT_INPUT_TYPE = 'keyboard'`): keyboard (arrows/WASD) always stays live; `mouse` mode layers cursor-chase steering + left-click fire + right-click bomb on top of it.
- Movement is eased "floaty" inertia, not instant velocity — target velocity from input is lerped toward each frame with separate accel/decel rates (`floatAccelLerp: 0.13` vs `floatDecelLerp: 0.032`), so accelerating is snappier than coasting to a stop.
- Mouse steering chases the cursor, easing down as it nears, capped at `PLAYER.speed = 320`, snapping to stop within 4px.
- Ship "banks" via scaleX narrowing + sideways lean (simulated roll, not real rotation): `tiltMaxDeg: 40`, `tiltLerp: 0.3`, `tiltLeanPx: 8`.
- World-bounds collision on; hitbox is a 15px-radius circle (`hitboxRadius`).
- Auto-fire defaults on (`DEFAULT_AUTO_FIRE = true`), toggleable in Options; firing also triggers on Space or (mouse mode) held left-click. Bomb is the `B` key or right-click.
- Mouse mode hides the OS cursor over the canvas (Escape restores it).

## Health, lives, death, respawn
- `startHealth: 100`, `startLives: 3`.
- Damage is scaled by `diffCfg.damageTakenMult` (only the `kids` tier softens it, ×0.3). A non-lethal hit grants 500ms i-frames (`hitInvulnMs`) to stop multi-hit stacking within one frame.
- Health ≤ 0 → lose a life (explosion/shake/audio). Lives ≤ 0 → real death: `alive = false`, sprite hidden/disabled, `player-died` emitted, no respawn — this ends the run.
- Otherwise → `respawn()`: health refilled, **weapon level downgraded by exactly 1** (floor 1), position reset to the start pad, roll/drift state reset, 1500ms invulnerability (`invulnMs`) with a visible alpha-blink.

## Weapon level system
- Flat 1–5 ladder (`WEAPON_LEVELS`): bullet count == level, fire rate drops from 220ms (lvl1) to 110ms (lvl5). Columns are parallel (no spread angle).
- Any weapon power-up steps level +1 regardless of its color, capped at `WEAPON_MAX_LEVEL = 5`.
- Bullet *color* (yellow/blue/red, default blue) is set independently by whichever color the pickup showed at collection time — it's a tint choice, not a level-size choice.
- Collecting a weapon pickup while already at level 5 triggers a **mega blast** instead of leveling further (see [ENEMY.md](ENEMY.md)).
- Death → `downgradeWeapon()`: level −1 (floor 1). **Guardrail added**: whenever weapon level starts at or drops back to 1 (fresh spawn or a death that lands on 1), `GameScene` force-spawns 2 weapon power-ups near the player within the next ~1.2–3.5s, bypassing normal drop RNG, so the player is never stuck weaponless for long. Debounced so repeated triggers don't stack extra spawns.
- The falling weapon pickup cycles Yellow → Blue → Red every 5s and hovers 15s before it starts falling — a risk/reward window on which color to grab, independent of the flat +1 level gain.

## Power-ups
Drop odds once a drop is decided (`POWERUP.weights`): weapon 40, health 30, rocket 15, shield 12, bomb 8, life 3. Pickup radius 22px, fall speed 75, spin 130°/s. Enemy base drop chance 7% (the dedicated carrier enemy always drops, see [ENEMY.md](ENEMY.md)).

- **Weapon** — see above.
- **Health** — restores health (capped at max).
- **Rocket** (`ROCKET_POWERUP`) — 12s duration; auto-fires a self-guided homing missile (turn rate 240°/s, speed 300, 55 dmg) repeatedly while active and none currently in flight.
- **Shield** (`SHIELD_POWERUP`) — 6s full invulnerability with a visible pulsing aura that has its own collision circle, intercepting enemy bullets at the aura's edge before they'd otherwise reach the ship hitbox. Re-collecting resets the timer.
- **Bomb** — not timed, see below.
- **Life** — `+1` life, uncapped.

## Bomb (stockpiled, not timed)
Each pickup adds a charge, capped at `maxStock: 3`. Detonate on demand (`B` / right-click): consumes one charge, deals 150 damage (2× vs large enemies), and clears enemy bullets from the screen.

## Difficulty tiers
`kids` / `easy` / `normal` (default) / `hard`, each scaling: `hpMult` (enemy/meteor/boss HP), `powerUpChanceMult`, `meteorCountMult`, and `damageTakenMult` (only `kids` reduces damage taken, ×0.3 — others leave it at 1×).

## Scoring
`addScore(amount)` accumulates `player.score` and emits `score-changed`; per-source point values live in the enemy/meteor/train/boss configs (see [ENEMY.md](ENEMY.md)).
