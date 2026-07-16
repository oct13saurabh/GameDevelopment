# Space Shooter

DemonStar-style vertical shoot-'em-up built with [Phaser 3](https://phaser.io/) (vanilla JS, no bundler/framework). Mission 1 is complete and playable; this repo is set up so Mission 2 can be added by dropping in new art and bumping one config constant, without touching game logic.

## Running it

```
npm install
npm start          # serves the project at http://localhost:8000
```

`index.html` loads `src/main.js` directly as ES modules — no build step. `npm run generate-manifest` regenerates `GameAssets/manifest.json` after adding/removing enemy, train, player-ship, or background art (see [MISSION.md](MISSION.md)).

## Documentation map

| File | Covers |
|---|---|
| [MISSION.md](MISSION.md) | Generic mission structure/scene flow, the art-manifest pipeline — applies to every mission |
| [Mission1.md](Mission1.md) | Mission 1 specifics: art, enemy roster, wave timeline, boss stats, hazards (template for `Mission2.md` etc.) |
| [PLAYER.md](PLAYER.md) | Player movement, health/lives, weapon levels, power-ups, bombs, difficulty tiers, scoring |
| [ENEMY.md](ENEMY.md) | Enemy types, wave timeline, the power-up carrier, boss fight, mega blast |
| [ENVIRONMENT.md](ENVIRONMENT.md) | Starfield, meteors, trains, decorative space stations (destructible), mission backdrop images |

Each doc reflects the current (Mission 1) implementation and is meant to stay accurate as the source of truth going into Mission 2 — update the relevant doc alongside any gameplay change, don't let them drift.

## Project structure

```
src/
  main.js              Phaser game config, scene list
  config.js             All tuning constants (CURRENT_MISSION lives here)
  scenes/
    BootScene.js         Loads all art (manifest-driven where art varies by mission), builds registry pools
    MenuScene.js          Title screen, ship/difficulty/input select
    OptionsScene.js       Input scheme / auto-fire options
    GameScene.js           Core gameplay loop, spawning, collisions
    HUDScene.js            Overlaid HUD (health/lives/score/weapon)
    GameOverScene.js       Win/lose screen, restart
  entities/            One class per gameplay object (Player, Enemy, Boss, Meteor, Train,
                       SpaceStation, BackgroundStation, PowerUp, Missile, Bullet pool)
  systems/             Cross-cutting systems (Starfield, WaveManager, Juice/fx, Audio)
scripts/
  generate-asset-manifest.js   Node script -> GameAssets/manifest.json
GameAssets/            All in-game art, organized by category (see MISSION.md for the
                       mission-folder convention used by EnemyShip/ and Background/)
Assets/                Raw source art packs (never loaded directly by the game)
```

## Key conventions to keep in mind

- **Never load from `Assets/`** — only `GameAssets/` is wired into `BootScene`.
- **File-name-agnostic art pools**: anywhere the art varies per mission or has an unpredictable file count (enemy designs, trains, player ships, background images), the game reads `GameAssets/manifest.json` instead of hardcoding filenames. Regenerate it after touching art — see [MISSION.md](MISSION.md).
- **One mission is live at a time**, selected by `CURRENT_MISSION` in `src/config.js`. Bumping it is the switch that moves the whole game to the next mission's art/boss.
