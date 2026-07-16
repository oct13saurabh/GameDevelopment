# Environment & Decorative Systems — Mechanics Reference (Mission 1)

Source: `src/systems/Starfield.js`, `src/entities/Meteor.js`, `src/entities/Train.js`, `src/entities/SpaceStation.js`, `src/entities/BackgroundStation.js`, `src/config.js` (`METEOR`, `SPECIAL_METEOR`, `TRAIN`, `SPACE_STATIONS`).

## Starfield
Three fixed parallax layers (back/mid/front), each with its own dot count, speed, alpha, and tint — back is slowest/dimmest/bluest, front is fastest/full-brightness/white. Dots are single-pixel sprites that scroll down and wrap back to the top with a new random x once off-screen — an infinite loop, no per-frame allocation. Rendered behind everything else (depth −10).

## Meteors
- **Normal meteors**: random texture from 4 variants, drift down with slight horizontal wobble and rotation. Size is picked by a weighted roll across 3 tiers — small/medium/large — where larger meteors are tougher (more HP) and rarer (lower weight). Hitbox scales with the chosen size.
- **Special meteors** (`shooting`/`freezing` kinds): spawn on a repeating 12s check that rolls a spawn chance (scaled by difficulty). Instead of falling from the top, they streak in from a random top corner toward a randomized far-side target — fast, aimed, no rotation — and are destroyed on exiting any screen edge, not just the bottom.

## Train
A rare, tough hazard: highest HP of any Mission 1 hazard, drifts straight down with no horizontal wobble or rotation (unlike meteors), and always drops a power-up on death. Capped per mission (max 2); scheduling is self-perpetuating — each spawn schedules the next one after a randomized delay, until the per-mission cap is hit.

## SpaceStation — decorative, destructible in parts
Multi-part structures (a handful of station/building tile templates) that drift down slowly and spawn on a steady interval, purely for atmosphere. **Each tile is independently destructible**: every part has its own physics body and HP, and can be shot down individually by player bullets/missiles (with its own small explosion + sfx) without destroying the rest of the structure. The station as a whole is "alive" until all its parts are gone or have drifted off-screen; it has no collision with the player itself — only takes hits, doesn't block or damage the ship.

## BackgroundStation — mission backdrop image
A single large backdrop image (not tiled parts) pulled from `GameAssets/Background/Mission N`, chosen at random if the folder has more than one file (any count/mix of `.png`/`.jpg`/`.jpeg` works, no hardcoded filenames — see [MISSION.md](MISSION.md) for the manifest pipeline). Purely decorative, no physics body.

Depth-ordered behind SpaceStation and in front of the starfield, so the visual stack (back to front) is: starfield → mission backdrop → space stations → gameplay.

**Timing & lifecycle**:
- Spawns **once per mission** (not repeating) — after the first one, it never spawns again that run.
- Drifts fully from top to bottom at a speed tuned so the whole traverse takes roughly 25 seconds, and despawns **only** once it's naturally off-screen. (Earlier version force-deleted it on a fixed timer, which cut it off mid-screen and looked like it vanished — that cap has been removed in favor of just moving it faster.)

**Mutual exclusion with SpaceStation** — the two never appear on screen at the same time:
1. When the backdrop wants to spawn, it first checks whether any SpaceStation is currently on screen. If so, it waits and re-checks every 2 seconds instead of spawning.
2. Once clear, it spawns and immediately **pauses** the SpaceStation spawn timer for as long as it's active, so no new station can appear mid-backdrop.
3. When the backdrop has fully drifted off (its internal list goes empty), the SpaceStation timer un-pauses and normal station spawning resumes for the rest of the mission.

This means players see either "a station or two drifting by" or "the big mission backdrop passing through," never both layered together.
