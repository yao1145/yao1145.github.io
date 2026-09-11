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

- **Fixed-timestep engine** — the simulation runs at a constant 60 ticks/sec, decoupled from your display's refresh rate; a stalled frame is capped at four catch-up steps and pauses immediately stop catch-up work.
- **Object pools** — bullets, enemy bullets, enemies, items and particles are recycled instead of re-allocated, avoiding GC churn. The shared enemy-bullet pool holds up to **1000** entries, and a single volley is capped at **64** bullets.
- **Typed spatial-grid collisions** — a 100px grid keeps separate indexes by object type, so player shots and chain explosions query enemies directly instead of copying and filtering unrelated bullets or items.
- **Pre-rendered sprites** — enemies, bullets, items and the player are baked in bounded startup batches and blitted with `drawImage`, so the hot render loop does no path fills. The menu distinguishes resource downloads from graphics preparation, retries failures, and retains valid caches across viewport-only resizes.
- **5 enemy types**, each with a distinct silhouette and behaviour (straight / homing / ring shots, a suicide bomber, and a tank).
- **3 elemental bosses** (fire / ice / poison), each with three attack patterns gated by remaining health.
- **Effect cards and in-run builds** — choose a legal core card at run start and after each boss, then take an optional route upgrade; six in-run build routes persist across core-card swaps and feed the compact HUD, pause details and run summary.
- **Compact dynamic HUD** — active card effects and route progress stack tightly in a stable top-right order, moving existing rows down when a higher-priority effect appears so there are no empty gaps.
- **School-badge skins** — the player flies under the Peking University emblem while enemies and bosses wear other universities' badges; missing SVGs keep the start gate closed and expose a retry action.
- **Power-up drops** — health, double-damage and shield pickups that spin and gently pulse as they fall.
- **Crown progression** — earn crowns each run and unlock permanent achievement bonuses (see below).
- **Persistence** — high score, highest crowns, last score and total crowns are saved to `localStorage`; build routes and card history are run-only and are not saved across runs.
- **App icons** — the source `icons/icon.png` is served as the favicon (pre-scaled 32×32) and iOS apple-touch-icon (pre-scaled 180×180).

## Controls

- **Keyboard** — Arrows / WASD to move, `Space` to pause.
- **Touch / mouse** — drag to move.

## Gameplay

- **Goal and damage** — survive and score by destroying enemies and bosses. An enemy bullet, a ramming enemy, or touching a boss normally costs **1 life**; actual damage also grants a **5 s shield**. `增益加强` changes only enemy-bullet damage to **2 lives**. The normal life cap is **20** and all ordinary life gains are capped. `玻璃大炮` temporarily changes the cap to **1**; reaching 0 lives ends the run.
- **Base tuning** — the player starts with **3 lives**, **1 damage**, one bullet per firing batch and a **300 ms** base shot delay (permanent crown achievements can change the starting lives, bullet count and delay). Player movement speed is **7 px/tick**.
- **Leveling** — `level = floor(score / 500) + 1`. At level `L`, the normal enemy spawn rate is `0.02 + 0.005 × (L−1)`, enemy movement speed is `2 + 0.075 × (L−1)`, enemy fire rate is `0.01 + 0.0005 × (L−1)`, and enemy-bullet base speed is `4 + 0.125 × (L−1)`. Natural item rate starts at `0.001`, peaks at `0.005` (5×) at level 10, and returns to `0.001` by level 20.
- **Enemies** — five types use fixed base HP/speed factors: red kamikaze **1 HP / ×1.0**, blue fast shooter **1 HP / ×1.5**, purple tank **2 HP / ×0.7**, yellow tracker **1 HP / ×0.9**, and cyan ring shooter **2 HP / ×0.8**. Every four completed level steps add **+1 HP** to all normal enemies (levels 5, 9, 13, …).
- **Bosses** — the first boss arrives at **1000 points**. Each kill gives **+1 crown** and attempts **+3 lives** (capped by the current life cap), then increases the next score gap by **200**, producing thresholds **1000 → 2200 → 3600 → 5200 …**. Fire, ice and poison bosses each have three patterns that change below **70%** and **30%** HP. From the **4th boss**, there is a 10 s grace period, then repeating 30 s summon windows and 30 s rests; the boss summons normal enemies at **30%** of the current effective spawn rate.
- **Difficulty** — 简单模式 Easy applies enemy/boss movement and all enemy-bullet speed ×**0.7**, normal-enemy spawn rate ×**0.5**, enemy fire rate ×**0.5**, and boss shot delay ×**1.5**. 困难模式 Hard uses the authored values above.

### Effect cards

One core card is selected at run start and re-selected after every boss. A selection panel shows up to **4 legal cards**; each card can be equipped at most **3 times per run**, and an exhausted card is removed from the pool. A still-legal current card is always kept in the candidates. Keeping the current card costs nothing; changing to another card costs **1 life**, except entering or leaving `玻璃大炮`, which is free. Entering `玻璃大炮` clamps the current lives to 1 and leaving it never refunds lives lost by that clamp. If no legal card remains, the selection can be skipped. Card selection freezes combat until the choice/skip is complete.

Here, “fire rate ×X” means firing frequency ×X (the shot delay is divided by X). `D` in the build section means the direct-hit damage snapshot used by that trigger; with the base damage of 1, 10D/20D/40D are 10/20/40 damage. Damage is quantized in 0.5-point steps with a 0.5 minimum for positive damage.

| Card | Exact effect |
| --- | --- |
| **激情岁月** | Player firing frequency ×**2**; normal enemies and bosses also fire ×**2. |
| **生存之道** | Player firing frequency ×**0.75**; while below the current life cap, recover **1 life every 20 s**. Full life pauses the timer. |
| **绝地反击** | At **1–2 current lives**, player damage and firing frequency ×**2**; at 3 or more lives it is dormant. |
| **平安无事** | Normal-enemy and boss firing frequency ×**0.65**; player firing frequency ×**0.80**. |
| **电光石火** | **+1 bullet** to every firing batch and player-bullet speed ×**1.5**. Healing effects are disabled, although the separate Boss life reward still goes through the normal cap. |
| **血之渴望** | Every unique normal-enemy death adds **1** blood-meter point; every **8** points attempts to recover **1 life**. Every Boss death adds **16** points. Player firing frequency ×**0.75**. Healing still respects the cap. |
| **连环爆炸** | A direct kill of a normal enemy creates a **200 px radius** explosion dealing **1.0 damage** to normal enemies. It does not damage bosses. Normal-enemy spawn rate ×**1.3**. Explosion kills do not seed another card explosion. |
| **玻璃大炮** | Player damage ×**2** and firing frequency ×**1.5**; maximum lives lock to **1**; healing effects are disabled. Switching in or out is free. |
| **Boss猎手** | Damage against bosses ×**3**; damage against normal enemies ×**0.5**. No firing-rate change. |
| **荆棘护甲** | Each actual player hit (not an absorbed shield/barrier hit) instantly kills every normal enemy whose center is within **200 px**, and removes **10% of the Boss max HP**. Normal-enemy and boss firing frequency ×**1.5**. |
| **粮草先行** | Natural item spawn rate ×**1.5**; normal-enemy and boss firing frequency ×**1.5**. |
| **战争迷雾** | Enemy-bullet speed ×**0.80**. A tracking bullet that exists while fog rules apply becomes a straight downward bullet and never regains homing after leaving the card. The top **35%** of the canvas is opaque fog, followed by a **40 px** fade. |
| **增益加强** | Red heart gives **+2 lives**, damage pickup lasts **15 s**, shield pickup lasts **10 s**; each enemy-bullet hit costs **2 lives** instead of 1. |

Power-ups are falling 20×20 px items: a red heart normally gives **+1 life**, an orange pickup gives **2× damage for 10 s**, and a cyan ring gives a **5 s shield**. Life gains are capped and `电光石火`/`玻璃大炮` disable healing effects. `增益加强` changes the three values as listed above.

### In-run build routes

Each Boss reward runs **core card → optional build → reward summary** and only resumes combat after the summary is confirmed. Builds persist through core-card swaps but reset at the next run. There are six routes; each has an entry, two mutually exclusive branches, and a capstone. The active card biases offers toward its associated route: 激情岁月/电光石火 → 疾速压制, 生存之道/平安无事/荆棘护甲/战争迷雾 → 坚壁续航, 绝地反击/血之渴望 → 绝境反攻, 连环爆炸 → 连锁清场, 玻璃大炮/Boss猎手 → 破甲猎王, 粮草先行/增益加强 → 补给运营.

**疾速压制**

- **入门：热机运转** — land hits in **8 different firing batches** to activate a **4 s** warm-up. While active, player firing frequency ×**2**.
- **分支：快速复燃** keeps **4/8** hit progress when warm-up ends; **横向压制** changes the primary bullet's every-second-batch effect from **+1.0 damage + 1 extra normal-enemy pierce** to **+1.0 damage + 2 extra pierces**. Only the primary bullet receives the damage/pierce effect. Unfinished hit progress clears after **2 s** without a new hit.
- **进阶：持续火力** — during warm-up, each direct normal-enemy kill adds **400 ms**; every **6 Boss-hit batches** adds another **400 ms**. Per activation, extensions are capped at **2 s** and the warm-up timer at **6 s**.

**坚壁续航**

- **入门：稳态屏障** — every **15 s** without actual life loss creates one barrier layer. It can reach **3 layers** whose ordinal capacities are **1 + 2 + 3 = 6 enemy-bullet blocks** in a fully charged stack. A real hit resets charging but does not remove existing layers; a player shield absorbs first and does not consume the barrier.
- **分支：快速重整** changes the per-layer charge time to **12 s**; **防御回响** deals **2.0 damage** to every normal enemy within **200 px** of the player whenever one barrier block is consumed.
- **进阶：安全窗口** clears enemy bullets within **250 px** when a barrier block is consumed, with a **10 s** cooldown.

**绝境反攻**

- **入门：背水蓄势** — active only when maximum lives are at least 3 and current lives are at or below one third of the cap (with the normal cap of 20, this means **≤6 lives**). Every **10 different firing batches** that land a direct hit trigger a **10D** bonus strike.
- **分支：破围一击** clears enemy bullets within **220 px** of the struck target; **绝境追击** raises the bonus strike to **15D** without requiring the target to be low HP.
- **进阶：最后储备** — while active, **8 direct normal-enemy kills** attempt to recover **1 life**, at most once per Boss reward cycle, provided healing is allowed and the player is not full. With `玻璃大炮` (maximum lives 1), this route is dormant.

**连锁清场**

- **入门：爆破种子** — a direct normal-enemy kill seeds a **200 px radius / 1.0 damage** explosion.
- **分支：广域爆破** raises the first-generation radius to **260 px**; **二次引燃** lets first-generation kills seed one propagation generation at **220 px radius / 0.5 damage**. Propagation is limited to one generation and does not re-seed indefinitely.
- **进阶：连锁震荡** — after **3 normal-enemy kills in the same route chain**, clear enemy bullets within **300 px** of the third kill point, once per chain. The card chain and route chain are independent if both are active.

**破甲猎王**

- **入门：弱点标记** — hit the same live target in **10 different firing batches** to trigger a **20D** precision strike. Without the branch, target memory resets after **1200 ms** without a hit.
- **分支：稳定锁定** extends that memory to **5000 ms**; **处决校准** raises the precision strike to **40D** without requiring low target HP.
- **进阶：猎王窗口** — a precision strike on a Boss opens a **2000 ms** window; the next direct hit adds a **2D** bonus strike and closes the window. Every capstone precision trigger can also clear bullets within **200 px** of the target when its **6000 ms** clear cooldown is ready.

**补给运营**

- **入门：物资回路** — collect **3 natural items** to start a **4 s** supply pulse. While the pulse is active, player firing frequency ×**1.5** and **every bullet** in every firing batch gets **+1 damage**. Pulse time can accumulate up to **8 s**.
- **分支：远程牵引** continuously attracts natural items whose centers are within **200 px**, moving them toward the player by up to **0.75 px per simulation tick**; **延时供给** makes each newly triggered pulse **6 s** instead of 4 s.
- **进阶：余量转化** makes a full-health natural heart contribute **2** progress instead of 1 toward the 3-item trigger; the accumulated pulse timer is capped at **8 s**.

The run can hold **six builds**. Once full, a candidate can be taken only by replacing a legal existing build while preserving all prerequisites and branch exclusions; skipping is always available. The build HUD shows the two most relevant route rows, while pause details list the full owned set and warn when `玻璃大炮` puts `绝境反攻` into dormancy. The end-of-run summary records card history, owned builds and run-only contributions such as barrier blocks, chain kills, precision damage and supply-pulse coverage; none of these build records persist between runs.

## Achievements

Crowns are never spent down — reaching a threshold unlocks its bonus permanently. Open them from the **成就** button on the main menu.

| Rank     | Crowns | Bonus                    |
| -------- | ------ | ------------------------ |
| 初出茅庐 | 10     | Auto-shield every 20 s, lasting 5 s |
| 小有成就 | 30     | Start with 5 lives       |
| 渐入佳境 | 50     | Shoot 2 bullets per shot |
| 锋芒毕露 | 80     | 300 → 200 ms shot delay (1.5× firing frequency) |
| 战无不胜 | 100    | Shoot 3 bullets per shot |

## Structure

```
├── index.html                 # thin shell: DOM + #introPanel game instruction + module entry
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
        ├── cards.js          # core-effect-card definitions, legal pick flow, stat multipliers
        └── builds.js         # six in-run routes, reward flow, HUD and contribution summary
```

### Module wiring

Everything hangs off one singleton, `Game` (exported from `js/core/game.js`). It holds all state and the core lifecycle (`init`, `gameLoop`, `update`, `startGame`, …). Every other module is a **side-effect module**: it imports `Game` and attaches methods to it, and `js/main.js` imports them all for their side effects before running `window.load → Game.init()`.

Because each module imports only `js/core/game.js` and `js/core/config.js` — never one another — the import graph is a flat star (acyclic).

## License

MIT — see [LICENSE](LICENSE).
