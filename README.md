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
- **Effect cards** — pick 1 of 4 run modifiers when the run starts and after every boss kill; swapping to a different card costs a life.
- **School-badge skins** — the player flies under the Peking University emblem while enemies and bosses wear other universities' badges (falls back to procedural sprites if the SVGs are missing).
- **Power-up drops** — health, double-damage and shield pickups that spin and gently pulse as they fall.
- **Crown progression** — earn crowns each run and unlock permanent achievement bonuses (see below).
- **Persistence** — high score, highest crowns, last score and total crowns are saved to `localStorage`.
- **App icons** — the source `icons/icon.png` is served as the favicon (pre-scaled 32×32) and iOS apple-touch-icon (pre-scaled 180×180).

## Controls

- **Keyboard** — Arrows / WASD to move, `Space` to pause.
- **Touch / mouse** — drag to move.

## Gameplay

- **Goal** — survive and rack up score. Every hit (an enemy bullet, a ramming enemy, or touching a boss) costs 1 life and grants a brief 5 s shield; lives are capped at **20** (every life gain — pickups, boss rewards, card heals — respects the cap, though the 玻璃大炮 Glass card overrides it with a cap of 1); at 0 lives the run ends.
- **Leveling** — the difficulty level rises every 500 points: enemies spawn faster, move faster, fire more often, and their bullets speed up. Speed and bullet-speed growth per level is intentionally gentle. Item density follows a level curve — sparse at first, densest around level 10 (about 5× the base rate), settling back to base from level 20.
- **Enemies** — five types, each with its own behaviour: straight shooters, a slow 2 HP tank, homing shots, radial bullet rings, and a red kamikaze that detonates when it gets close.
- **Bosses** — the first boss arrives at **1000 points**; each kill grants **+3 lives and +1 crown**, and raises the score gap to the next boss by **+200**, so bosses appear at 1000 → 2200 → 3600 … Each elemental boss (fire / ice / poison) has three attack patterns that escalate below 70% and 30% health. From the **4th boss onward**, bosses periodically summon waves of normal enemies: a 10 s quiet period after the boss appears, then repeating 30 s summon windows (with a top-right countdown chip) until the boss dies.
- **Difficulty** — Two modes — 简单模式 Easy: enemy/boss movement and all enemy bullets ×0.7, spawn and enemy fire rates ×0.5, boss shot delay ×1.5; 困难模式 Hard: the reference balance.
- **Effect cards** — when the run starts you pick 1 of 4 cards; after **every boss kill** you pick again. Keeping the current card is free, **switching to a different one costs 1 life** (the panel warns you). The active card is shown in the top-right HUD chip.
- **Power-ups** — falling pickups: **+1 life** (capped at 20), **double damage for 10 s**, or a **5 s shield**.
- **Crowns** — every boss kill earns a crown; crown totals unlock the permanent achievements below and are never spent.

## Achievements

Crowns are never spent down — reaching a threshold unlocks its bonus permanently. Open them from the **成就** button on the main menu.

| Rank     | Crowns | Bonus                    |
| -------- | ------ | ------------------------ |
| 初出茅庐 | 10     | Auto-shield every 20s    |
| 小有成就 | 30     | Start with 5 lives       |
| 渐入佳境 | 50     | Shoot 2 bullets per shot |
| 锋芒毕露 | 80     | +50% fire rate           |
| 战无不胜 | 100    | Shoot 3 bullets per shot |

## Structure

```
├── index.html                 # thin shell: DOM + CSS <link> tags + module entry
├── icons/
│   ├── icon.png            # source game icon (1113×1113)
│   ├── favicon-32.png      # browser-tab favicon (32×32)
│   └── apple-touch-icon.png # iOS home-screen icon (180×180)
├── css/
│   ├── base/
│   │   └── reset.css
│   ├── ui/
│   │   ├── layout.css
│   │   ├── panels.css
│   │   ├── hud.css
│   │   ├── boss.css
│   │   ├── achievements.css
│   │   ├── intro.css
│   │   └── cards.css
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
        ├── achievements.js   # achievement panel logic
        ├── badges.js         # 校徽 badge sprite skinning + menu emblem
        └── cards.js          # effect-card definitions, pick flow, stat multipliers
```

### Module wiring

Everything hangs off one singleton, `Game` (exported from `js/core/game.js`). It holds all state and the core lifecycle (`init`, `gameLoop`, `update`, `startGame`, …). Every other module is a **side-effect module**: it imports `Game` and attaches methods to it, and `js/main.js` imports them all for their side effects before running `window.load → Game.init()`.

Because each module imports only `js/core/game.js` and `js/core/config.js` — never one another — the import graph is a flat star (acyclic).

## License

MIT — see [LICENSE](LICENSE).
