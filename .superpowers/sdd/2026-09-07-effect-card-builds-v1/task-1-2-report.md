# Task 1 + Task 2 Implementation Report

## Scope

Implemented the approved Task 1 (连锁清场) and Task 2 (补给运营) behavior on `codex/v2`.

The pre-existing `.gitignore` modification was preserved. `docs/design/effect-card-upgrades-v2.md` was not present in this checkout and was not modified; no documentation design file or `.gitignore` was changed by this task.

## Task 1: 连锁清场

- 爆破种子 now creates a 200px explosion for a direct ordinary-enemy kill and deals `0.5D`.
- The 连环爆炸 card contributes an additional `0.5D`; seed + card therefore deals `1D` to ordinary enemies through one merged explosion chain and one `chainId`.
- 广域爆破 adds 50px to the merged explosion radius, producing 250px when the 200px core/seed explosion is widened.
- 二次引燃 allows up to three cascade layers for the seed route. The card route allows two layers, and a merged route uses the stricter two-layer limit.
- 连锁震荡 clears enemy bullets within 100px at the third ordinary enemy killed by a chain, once per chain, with the existing global five-second cooldown. The regression coverage includes same-chain suppression, cooldown suppression across chains, and re-triggering after cooldown expiry.

## Task 2: 补给运营

- During a supply pulse, every spawned player bullet receives a `+1` damage bonus, including non-primary bullets.
- The bonus is consumed by `getDirectShotDamage()` once per bullet, so later bonus-strike/event processing does not apply it again.
- Natural item-spawn probability is doubled only while the supply pulse is active. `spawnItems(rng)` accepts a deterministic probability hook for tests; the existing supply-card multiplier remains in the same rate pipeline.
- 远程牵引 range is now 150px. Collection and pulse progression behavior remain unchanged.

## TDD evidence

Regression assertions were added/updated before production changes and were run in RED against the old implementation. The expected failures covered the old 45/60px chain geometry, old propagation depth, non-additive merged damage, old 60px shock radius, primary-only `+0.5` supply damage, missing pulse spawn multiplier, and old 70px magnet range. Production changes were then made incrementally and the same tests were brought to GREEN.

## Files changed

- `js/core/config.js`
- `js/entities/items.js`
- `js/entities/player.js`
- `js/systems/builds.js`
- `js/systems/cards.js`
- `tests/builds.test.js`
- `tests/combat-events.test.js`
- `tests/items.test.js`
- `.superpowers/sdd/2026-09-07-effect-card-builds-v1/task-1-2-report.md`

## Verification

- `node --experimental-default-type=module --test tests/combat-events.test.js` — 49 passed.
- `node --experimental-default-type=module --test tests/items.test.js` — 17 passed.
- `node --experimental-default-type=module --test tests/builds.test.js` — 28 passed.
- `node --experimental-default-type=module --test tests/*.test.js` — 106 passed.
- Per-file isolated test processes — `cards.test.js` 12 passed, `combat-events.test.js` 49 passed, `items.test.js` 17 passed, `builds.test.js` 28 passed.
- `node --check` across all 25 JavaScript files under `js/` and `tests/` — 25 checked, 0 failed.
- `git diff --check` — passed.

The Node test runner required process permissions outside the default sandbox because the sandbox returned `spawn EPERM`; the test results above are from the required commands with that permission granted.

## Remaining concerns

- The browser game still requires HTTP serving because it uses ES modules; no browser/manual playtest was part of this task.
- The intentional one-shot supply bonus consumption means a piercing bullet applies the pulse bonus only on its first direct damage event, matching the “same bullet once” requirement.
