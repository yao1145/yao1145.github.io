# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`starfighter` is an **HTML5 canvas space shooter** split into ES modules. There is no build step, no package manager, and no test suite. The UI strings are in Chinese (zh-CN).

Layout: `index.html` is a thin shell (DOM markup + CSS `<link>` tags + one module script). Game logic lives in `js/`, styling in `css/`. Both folders are split by concern.

This repository is also a GitHub Pages repo (`yao1145/yao1145.github.io`); the game is served at the site root, so `index.html` must remain at the root. Live site: https://yao1145.github.io/

## Running

No package.json, no dependencies, no build, no tests. **Because the code uses ES modules (`<script type="module">` + `import`/`export`), it must be served over HTTP — opening `index.html` via `file://` will not work.** Serve from the repo root, e.g. `python -m http.server 8000`, then open http://localhost:8000/.

## Architecture — the shared-Game pattern

Everything hangs off one singleton object, `Game`, **exported from `js/game.js`**. All state and logic are properties/methods of `Game`. There are no classes.

The module wiring avoids circular imports: `js/game.js` exports `const Game` holding only state properties + core lifecycle methods (`init`, `gameLoop`, `update`, `startGame`, `togglePause`, `gameOver`, `updateGameState`, `updateUI`, `resizeCanvas`). Every other module is a **side-effect module** that imports `Game` and attaches methods to it:

```js
import { Game } from './game.js';
Game.updatePlayer = function(deltaTime) { /* ... this ... */ };
```

These modules import only `./game.js` and `./config.js` — never one another — so the import graph is a star (acyclic). Because attached methods are called as `this.updatePlayer(...)`, the `this` binding still resolves to `Game`. `js/main.js` is the entry: it imports all feature modules for their side effects and wires `window.load → Game.init()`.

**Module map (method → file):** `game.js` (core lifecycle) · `config.js` (`CONFIG` tuning constants) · `pools.js` (`objectPools` + `getObject`/`releaseObject`/`clearAllPools`) · `grid.js` (`spatialGrid`) · `player.js` (player update/shield/attack/bullet spawn) · `bullets.js` (`updateBullets`) · `enemyBullets.js` (bullet patterns + `updateEnemyBullets`) · `enemies.js` / `items.js` (spawn/update) · `boss.js` (boss fight + patterns) · `collisions.js` (`checkCollisions`/`isColliding`/`createExplosion`/`updateParticles`) · `render.js` (`render` + all `draw*`) · `input.js` (`setupEventListeners`/`enableControlArea`).

## Key mechanics

**Game loop** — `gameLoop()` calls `requestAnimationFrame` recursively. It runs a **fixed-timestep accumulator** (`CONFIG.fixedFrameRate`, default 60): real frame time is added to `accumulator`, then `update(fixedStepMs)` runs zero or more times at a constant step until `accumulator < fixedStepMs`, followed by one `render()`. This decouples simulation speed from the display's refresh rate, so gameplay is deterministic across devices. `update()` is the ordered gathering of per-entity update methods, then spawning, then `checkCollisions()` and `updateGameState()`. `startGame`/`togglePause` reset `accumulator` and `lastTime` to avoid a catch-up burst; `gameTime` advances by `fixedStepMs` per tick.

**Object pools** — `objectPools` (in `js/pools.js`) holds five pools (`bullets`, `enemyBullets`, `enemies`, `particles`, `items`), each `{ pool, active, maxSize }`. Use `getObject(type)` to spawn and `releaseObject(type, obj)` to despawn; never push directly to `active`. `maxSize` values come from `CONFIG.poolMaxSize`. `clearAllPools()` resets for a new game.

**Collision** — AABB test `isColliding(obj1, obj2)`. `checkCollisions()` rebuilds a `spatialGrid` (100px cells, `3x3` `getNearby` lookup) each frame instead of an O(n²) sweep. New interactable entity types should be inserted into the spatial grid.

**Spawning / difficulty** — `spawnEnemies()` defines 5 enemy types (0–4) via a `switch` on `Math.random()`; `enemiesShoot()` dispatches to bullet-pattern helpers (`spawnTrackingBullet` homing, `spawnRingBullet`, `spawnWaveBullet`, `spawnScatterBullet`, `spawnExplosionBullet`). Items drop from `spawnItems()`. Difficulty scales with level in `updateGameState()`.

**Boss system** — triggered in `updateGameState()` when `score >= bossSpawnThreshold` (constant in `CONFIG.bossSpawnThreshold`). Three boss archetypes (fire/ice/poison, `type` 0–2; base stats in `CONFIG.bossTypes`) each with three attack patterns gated by health percent (>70% / >30% / below). Attack patterns are `*BossPattern1/2/3`; movement is `update*Boss`.

**Persistence** — high score and high crowns persist via `localStorage` keys `planeGameHighScore` / `planeGameHighCrowns`.

## Adding content

- **New enemy or item type**: add a `case` in `spawnEnemies()` / `spawnItems()`, use `getObject()`/`releaseObject()`, insert into the spatial grid in `checkCollisions()`, and add a `draw*` branch in `render()`.
- **New bullet behavior**: add a property flag (e.g. `isIce`), a branch in `updateEnemyBullets()`, and a `spawn*Pattern()` helper.
- **New boss**: add a `CONFIG.bossTypes` entry, an `update*Boss()` movement method, `*BossPattern1/2/3` methods, a dispatch entry in `updateBoss()`/`bossShoot()`/`drawBoss()`, and a `draw*Boss()` method.
- **New shared tuning constant**: put it in `js/config.js` and import `CONFIG` where used — `game.js`, `pools.js`, and `boss.js` already do.
- Raising per-pool limits and difficulty lives in `CONFIG.poolMaxSize`, `updateGameState()` (level-scaled rates), and the enemy/boss spawn constants.
