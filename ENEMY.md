# Enemies, Waves & Boss — Mechanics Reference (Mission 1)

Source: `src/entities/Enemy.js`, `src/entities/Boss.js`, `src/systems/WaveManager.js`, `src/config.js` (`ENEMY_TYPES`, `BOSS`, `MEGA_BLAST`), `src/scenes/BootScene.js` (art loading), `src/scenes/GameScene.js` (spawn wiring).

## Enemy types (`ENEMY_TYPES`)
All Mission 1 enemies share one 64×64 5-frame banking ship model unless a custom design is drawn from the mission art pool — types are distinguished by stat tuning/tint/scale, not silhouette.

| type | hp | speed | score | fireRate | size |
|---|---|---|---|---|---|
| basic | 20 | 85 | 100 | 1800ms | small |
| fast | 15 | 145 | 150 | 1500ms | small |
| heavy | 60 | 55 | 300 | 1300ms | large |
| sniper | 25 | 65 | 200 | 2200ms | small |
| swarm | 8 | 185 | 80 | 2600ms | small |
| elite | 80 | 50 | 350 | 1400ms | large |
| scout | 10 | 170 | 90 | 2000ms | small |
| hornet | 12 | 160 | 90 | 1900ms | small |
| dragonfly | 18 | 110 | 130 | 1700ms | large |
| carrier | 30 | 70 | 120 | 2400ms | small, always drops a power-up |

`size` (`small`/`large`) drives mega-blast/bomb behavior (see below). Movement patterns: `straight` (vertical fall), `sine` (`sin(t·2.5)·120` horizontal sweep), `weave` (`cos(t·1.8)·90`). Enemies only fire while roughly on-screen, aim at the player, and are culled once they pass `GAME_HEIGHT + 60`.

Scale is normalized against each design's actual source-image width, so mission art of any resolution renders at a consistent on-screen size regardless of the raw PNG dimensions.

## Enemy art selection (manifest-driven, no hardcoded filenames)
`GameAssets/manifest.json` (built by `npm run generate-manifest`) lists available files per category/mission-folder. Two categories: `RandomShips` (everyday enemies) and `EnemyPowerUpDrop` (carrier-only art). For each, `BootScene` loads `Mission {CURRENT_MISSION}` art *plus* `Default` art (mission-exclusive designs stacked on top of the shared pool, not replacing it). Files named `enemy_(N)_b_(m|l1|l2|r1|r2).png` become 5-frame banking sets; anything else loads as a single static texture.

At spawn time, `GameScene.spawnEnemy` picks the `powerUpDrop` pool for carriers (falling back to `random` if that pool is empty) or the `random` pool otherwise, then picks a random design from it. Banking-frame designs visually swap to left/right-bank frames based on horizontal velocity thresholds; static designs never swap frames.

## Power-up carrier enemy
`carrier` is the **only** enemy that always drops a power-up on death (bypasses the normal per-kill drop chance entirely). It's visually larger (`scale: 0.9`) so it reads as distinct, draws its art from the dedicated `EnemyPowerUpDrop` pool, and isn't part of `WaveManager`'s scripted timeline — `GameScene` spawns it on its own periodic timer (independent of wave pacing), at a random x with `sine` movement.

## Wave system (`WaveManager.js`)
A fixed ~31-step timeline spanning `t = 500ms` to `t = 150000ms` (2.5 minutes) of named wave functions (straight lines, scout flurries, sine columns, hornet swarms, sniper lines, V-formations, dragonfly pairs, meteor showers, swarm rushes, elite escorts, mixed waves, a final gauntlet, etc.), reused/interleaved to build density over the run. Each wave function spawns a fixed layout of enemy types at staggered delays via injected `spawnEnemy`/`spawnMeteor` callbacks.

Difficulty scaling: `meteorCountMult` (from the selected `DIFFICULTY` tier) scales meteor-shower counts; enemy/meteor/boss HP is separately scaled by `diffCfg.hpMult` where each entity is spawned in `GameScene` (not inside `WaveManager`).

**Mission complete trigger**: once every scripted wave step has fired *and* no enemies/meteors remain alive, the boss spawns after a 1s delay. The boss's death (not the wave timeline directly) is what actually ends the mission — see below.

## Boss (`BOSS` config)
`hp: 1400`, `scoreValue: 5000`, `hitboxRadius: 42`, `bulletSpeed: 200`. Enters from off-screen, descends to a fixed entry point, and ignores damage until fully "arrived."

- **Phase 1**: horizontal sweep at 70px/s; aimed shot every 1400ms; 12-bullet radial burst every 2600ms.
- **Phase 2** (triggers at `hp ≤ maxHp × phase2HpFraction`, i.e. 50% HP): sweep speeds up to 130px/s, radial burst tightens to every 1900ms, adds a 5-bullet 50°-spread shot every 2200ms, and spawns two `fast` minions every 8000ms flanking the boss.
- **Death**: big explosion, screen shake, boss-death sfx, emits `boss-killed` → `GameScene.onMissionComplete()` → win screen.

Boss art (`GameAssets/BossShip/boss_ship_mission1.png`) is **not** manifest-driven — see [MISSION.md](MISSION.md) for what a new mission's boss requires by hand.

## Mega blast
Triggered when the player collects a weapon-color power-up while already at max weapon level (nowhere left to level up). Effect: screen shake + expanding explosion visual, and all hostiles take damage — small enemies die instantly, large enemies take heavy damage (2× the base mega-blast damage), the boss takes the flat base amount. The stockpiled Bomb power-up (see [PLAYER.md](PLAYER.md)) does an equivalent wipe and additionally clears enemy bullets from the screen.

## Scoring
Per-kill `scoreValue` ranges from 80 (swarm) to 350 (elite/heavy tier), carrier 120, meteors 50, Train 200, Boss 5000 — added via `GameScene`'s kill-event handlers.
