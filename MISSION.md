# Mission Structure (Generic — Applies to Every Mission)

This file covers what's true for *any* mission. For what a specific mission actually contains (its enemy roster, wave timeline, boss stats, art), see that mission's own file — e.g. [Mission1.md](Mission1.md).

## Scene flow
`BootScene` (loads all art, builds registry pools) → `MenuScene` (ship/difficulty/input pick) → `GameScene` (+`HUDScene` running alongside) → `GameOverScene` (win/lose, restart back to `MenuScene`).

`GameScene` ends a mission in exactly one way: the boss dies → `boss-killed` event → `onMissionComplete()` → `GameOverScene` with `win: true`. Player death (`lives` hits 0) → `player-died` → `onPlayerDied()` → `GameOverScene` with `win: false`. There is no mission-select or mission-chaining flow — `GameOverScene`'s restart always goes back to `MenuScene`, which always builds whichever mission `CURRENT_MISSION` points to.

## The single switch: `CURRENT_MISSION`
`src/config.js:14` — `export const CURRENT_MISSION = N;`. This is the one constant that determines which mission's manifest-driven art loads (see below). It does not by itself vary gameplay tuning (wave timeline, enemy stats, boss config) — those are plain constants today, not yet keyed per-mission.

## The manifest pipeline (how mission-specific art is found without hardcoding filenames)
Client-side JS can't list a folder's contents, so `scripts/generate-asset-manifest.js` scans `GameAssets/` at build time and writes `GameAssets/manifest.json`, which `BootScene.js` reads at runtime to know exactly which files to `this.load.image(...)`.

Run after adding/removing any manifest-driven art:
```
npm run generate-manifest
```

Folders that follow the `{Category}/{Mission N | Default}` convention (mission-exclusive art in a numbered folder, mission-agnostic art in `Default`, both loaded together — Mission-N art is added on top of Default, not instead of it):

- `GameAssets/EnemyShip/RandomShips/{Mission N|Default}` — everyday wave enemies
- `GameAssets/EnemyShip/EnemyPowerUpDrop/{Mission N|Default}` — the power-up carrier enemy's art
- `GameAssets/Background/Mission N` — mission backdrop images (no `Default` fallback folder is loaded unless the current mission's folder is empty; supports `.png`/`.jpg`/`.jpeg`, any number of files, one is picked at random per spawn)

Folders that are flat (no mission subfolders — same art pool regardless of mission):
- `GameAssets/Train/`
- `GameAssets/PlayerShip/` (files matched by `{Name}_{NN}-{1|2}.png`, "1"=idle "2"=banking frame)

## What's mission-agnostic infrastructure vs. what isn't (yet)
The art side (enemy ships, carrier ships, backgrounds, trains, player ships) is mission-agnostic infrastructure — a new mission is mostly a matter of adding folders and regenerating the manifest, no code changes needed. The *gameplay* side is not yet parametrized per mission:

- Boss art (`GameAssets/BossShip/...`) is loaded by a hardcoded path in `BootScene.js`, not manifest-driven.
- The title screen's mission label in `MenuScene.js` is a literal string, not read from `CURRENT_MISSION`.
- The wave timeline (`WaveManager.js`) and the `ENEMY_TYPES`/`BOSS` stat tables in `config.js` are flat constants with no per-mission variant mechanism.

Turning these into per-mission data (keyed off `CURRENT_MISSION`) is the structural work needed before a new mission can meaningfully differ in pacing/difficulty/boss fight, not just reskin the art. Each mission's own `MissionN.md` notes which of these it currently relies on.
