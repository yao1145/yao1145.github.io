# PKUfighter

An HTML5 canvas space shooter. Blast waves of enemies, dodge dense bullet patterns, and defeat the three element bosses — fire, ice and poison. The UI is in Chinese (zh-CN).

**▶ Play: https://yao1145.github.io/**

---

## Run locally

The project uses ES modules — it must be served over HTTP. Opening `index.html` from `file://` will not work:

```sh
python -m http.server 8000
# then open http://localhost:8000/
```

## Highlights

- **Fixed-timestep engine** — the simulation runs at a constant 60 ticks/sec, decoupled from your display's refresh rate, so gameplay speed is identical on every device.
- **Object pools** — bullets, enemy bullets, enemies, items and particles are recycled instead of re-allocated, avoiding GC churn.
- **Spatial-grid collisions** — an AABB sweep over a 100px grid is much cheaper than an O(n²) check every frame.
- **Pre-rendered sprites** — enemies, bullets, items and the player are baked once to offscreen canvases and blitted with `drawImage`, so the hot render loop does no path fills.
- **5 enemy types**, each with a distinct silhouette and behaviour (straight / homing / ring shots, a suicide bomber, and a tank).
- **3 elemental bosses** (fire / ice / poison), each with three attack patterns gated by remaining health.
- **Power-up drops** — health, double-damage and shield pickups that spin and gently pulse as they fall.
- **Crown progression** — earn crowns each run and unlock permanent achievement bonuses (see below).
- **Persistence** — high score, highest crowns, last score and total crowns are saved to `localStorage`.

## Controls

- **Keyboard** — Arrows / WASD to move, `Space` to pause.
- **Touch / mouse** — drag to move.

## Achievements

Crowns are never spent down — reaching a threshold unlocks its bonus permanently. Open them from the **成就** button on the main menu.

| Rank | Crowns | Bonus |
|------|-------|-------|
| 初出茅庐 | 10 | Auto-shield every 20s |
| 小有成就 | 30 | Start with 5 lives |
| 渐入佳境 | 50 | Shoot 2 bullets per shot |
| 锋芒毕露 | 80 | +50% fire rate |
| 战无不胜 | 100 | Shoot 3 bullets per shot |

> **Tip:** append `?crowns=100` to the URL to test the bonuses without playing the full progression.

## Structure

```
├── index.html                 # thin shell: DOM + CSS <link> tags + module entry
├── css/
│   ├── base/
│   │   └── reset.css
│   ├── ui/
│   │   ├── layout.css
│   │   ├── panels.css
│   │   ├── hud.css
│   │   ├── boss.css
│   │   └── achievements.css
│   └── responsive/
│       ├── mobile.css
│       └── responsive.css
└── js/
    ├── main.js                # entry point; wires Game.init() on load
    ├── core/
    │   ├── game.js           # the shared Game object (state + core lifecycle)
    │   ├── config.js         # CONFIG tuning constants
    │   ├── pools.js          # object pools (getObject / releaseObject / clearAllPools)
    │   └── grid.js           # spatial grid for collisions
    ├── entities/
    │   ├── player.js         # player movement, shield, attack, bullet spawn
    │   ├── bullets.js        # player bullet update
    │   ├── enemyBullets.js   # bullet pattern spawns + enemy bullet update
    │   ├── enemies.js        # enemy spawn / shoot / update
    │   ├── items.js          # power-up spawn / update
    │   └── boss.js           # boss spawn, movement, attack patterns
    └── systems/
        ├── collisions.js     # checkCollisions / isColliding / createExplosion / particles
        ├── render.js         # render() and all draw* helpers
        ├── sprites.js        # offscreen sprite pre-rendering + blit helpers
        ├── input.js          # keyboard / touch / mouse wiring
        └── achievements.js   # achievement panel logic
```

### Module wiring

Everything hangs off one singleton, `Game` (exported from `js/core/game.js`). It holds all state and the core lifecycle (`init`, `gameLoop`, `update`, `startGame`, …). Every other module is a **side-effect module**: it imports `Game` and attaches methods to it, and `js/main.js` imports them all for their side effects before running `window.load → Game.init()`.

Because each module imports only `js/core/game.js` and `js/core/config.js` — never one another — the import graph is a flat star (acyclic).

## License

MIT — see [LICENSE](LICENSE).
