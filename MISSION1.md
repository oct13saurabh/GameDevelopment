# Mission 1

Status: **complete, playable**. `CURRENT_MISSION = 1` (`src/config.js:14`).

This file records the concrete values/content that make up Mission 1 specifically, as a template for `Mission2.md` etc. Generic mechanics that apply to every mission (weapon system, power-ups, wave *mechanism*, art pipeline) live in [PLAYER.md](PLAYER.md), [ENEMY.md](ENEMY.md), [ENVIRONMENT.md](ENVIRONMENT.md), [MISSION.md](MISSION.md) — this file is just "what Mission 1 fills those systems with."

## Art
- Enemy ships: `GameAssets/EnemyShip/RandomShips/Mission 1/` (GE1–GE3) + `Default/` pool.
- Power-up carrier ship: `GameAssets/EnemyShip/EnemyPowerUpDrop/Mission 1/` (E12, EM0, EM1) + `Default/` pool.
- Backdrop: `GameAssets/Background/Mission 1/` (`B-5.png`).
- Boss: `GameAssets/BossShip/boss_ship_mission1.png` (hardcoded in `BootScene.js`, not manifest-driven).
- Title screen text: hardcoded `"MISSION 1"` in `MenuScene.js`.

## Enemy roster (`ENEMY_TYPES`, `src/config.js`)
basic, fast, heavy, sniper, swarm, elite, scout, hornet, dragonfly, carrier — full stat table in [ENEMY.md](ENEMY.md). All ten types are in play this mission.

## Wave timeline (`src/systems/WaveManager.js`)
Fixed ~31-step timeline, `t = 500ms` → `t = 150000ms` (2.5 min), built from named wave functions (straight lines, scout flurries, sine columns, hornet swarms, sniper lines, V-formations, dragonfly pairs, meteor showers, swarm rushes, elite escorts, mixed waves, a final gauntlet), reused/interleaved to ramp density. This timeline is Mission-1-authored — Mission 2 either needs its own timeline or will inherit this pacing as-is (see [MISSION.md](MISSION.md) gap).

## Boss (`BOSS`, `src/config.js`)
hp 1400, scoreValue 5000, hitboxRadius 42, bulletSpeed 200. Phase 2 (below 50% hp) speeds up its sweep/attacks and adds `fast`-type minion spawns. See [ENEMY.md](ENEMY.md) for the full phase breakdown.

## Environmental hazards this mission
- Meteors: normal (4 textures, 3 size tiers) + special `shooting`/`freezing` variants.
- Train: max 2 per mission, always drops a power-up.
- SpaceStation: decorative, destructible per-part.
- BackgroundStation: one backdrop pass per mission, mutually exclusive with SpaceStation.

All at the values documented in [ENVIRONMENT.md](ENVIRONMENT.md) — nothing mission-specific tunes these yet (no per-mission hazard config exists).

## Known gaps if copying this mission's shape forward
- Boss art path and wave timeline are hardcoded to Mission 1, not parametrized by `CURRENT_MISSION`.
- No mission-select/mission-chain flow — win always returns to `MenuScene`, which always builds `CURRENT_MISSION`.
