import assert from 'node:assert/strict';
import test from 'node:test';

import { Game } from '../js/core/game.js';
import { CONFIG } from '../js/core/config.js';
import '../js/core/pools.js';
import '../js/systems/cards.js';
import '../js/systems/builds.js';
import '../js/systems/render.js';

function resetRuntime(owned = []) {
    Game.resetBuildState();
    Game.buildState.owned = [...owned];
    Game.activeCard = null;
    Game.gameTime = 0;
    Game.lives = 3;
    Game.maxLives = 20;
    Game.player = { x: 100, y: 100, width: 20, height: 20 };
    Game.updateUI = () => {};
    Game.boss = null;
    Game.createShockwave = () => {};
    Game.createExplosion = () => {};
    Game.requestVisualHitStop = () => {};
    Game.clearEnemyBulletsInRadius = () => 0;
    Game.applyCombatDamage = (target, _type, amount) => {
        target.health -= amount;
        return true;
    };
    Game.objectPools.enemies.active = [];
    Game.objectPools.enemyBullets.active = [];
    return Game;
}

function batch(shotId, entityId = 1, targetType = 'enemy', damage = 2) {
    return {
        shotId,
        events: [{
            source: 'direct',
            shotId,
            entityId,
            targetType,
            baseDamage: damage,
            amount: damage,
            killed: false,
        }],
    };
}

test('rapid exposes actual-batch consumption with v2.1 cadence and caps', () => {
    resetRuntime(['rapid_entry', 'rapid_wide', 'rapid_capstone']);
    assert.equal(typeof Game.consumeRapidBatchEffect, 'function');
    assert.equal(typeof Game.extendRapidWarmup, 'function');

    for (let shotId = 1; shotId <= CONFIG.builds.rapid.hits; shotId++) {
        Game.onDirectShotBatch(batch(shotId));
    }
    assert.equal(Game.buildState.timers.rapidWarmup, 4000);

    assert.equal(Game.consumeRapidBatchEffect().rapidBatchBoosted, false);
    const boosted = Game.consumeRapidBatchEffect();
    assert.equal(boosted.rapidBatchBoosted, true);
    assert.equal(boosted.rapidDamageBonus, 1);
    assert.equal(boosted.pierceRemaining, 2);

    Game.extendRapidWarmup(400);
    assert.equal(Game.buildState.timers.rapidWarmup, 4400);
    Game.extendRapidWarmup(99999);
    assert.equal(Game.buildState.timers.rapidWarmup, 6000);
    assert.equal(Game.buildState.counters.rapidExtendedMs, 2000);
});

test('rapid decays after 2000ms and reignite keeps exactly four of eight hits', () => {
    resetRuntime(['rapid_entry', 'rapid_reignite']);
    for (let shotId = 1; shotId <= 5; shotId++) Game.onDirectShotBatch(batch(shotId));
    Game.updateBuildEffects(1999);
    assert.equal(Game.buildState.counters.rapidHits, 5);
    Game.updateBuildEffects(1);
    assert.equal(Game.buildState.counters.rapidHits, 0);

    for (let shotId = 10; shotId <= 17; shotId++) Game.onDirectShotBatch(batch(shotId));
    assert.equal(Game.buildState.timers.rapidWarmup, 4000);
    Game.updateBuildEffects(4000);
    assert.equal(Game.buildState.counters.rapidHits, 4);
});

test('fortress barrier echo is 200px/2.0 and clear cooldown does not block echo', () => {
    resetRuntime(['fortress_entry', 'fortress_echo', 'fortress_capstone']);
    const enemy = { entityId: 1, x: 110, y: 100, width: 20, height: 20, health: 10, maxHealth: 10, _dead: false };
    Game.objectPools.enemies.active = [enemy];
    let clearCalls = 0;
    Game.clearEnemyBulletsInRadius = (_x, _y, radius) => {
        clearCalls++;
        assert.equal(radius, 250);
        return 3;
    };
    Game.buildState.locks.fortressBarrier = true;
    Game.buildState.timers.fortressClearCooldown = 100;
    Game.onFortressBarrierConsumed();
    assert.equal(enemy.health, 8);
    assert.equal(clearCalls, 0);
    assert.equal(Game.buildState.metrics.fortressBlocks, 1);
    assert.equal(Game.buildState.metrics.fortressEchoDamage, 2);
    assert.deepEqual(Game.buildState.visualFeedbackEvents.find((event) => event.echo)?.radius, CONFIG.builds.fortress.echoRadius);

    Game.buildState.timers.fortressClearCooldown = 0;
    Game.onFortressBarrierConsumed();
    assert.equal(clearCalls, 1);
    assert.equal(Game.buildState.metrics.fortressBulletClears, 3);
    assert.deepEqual(Game.buildState.visualFeedbackEvents.find((event) => event.clear)?.radius, CONFIG.builds.fortress.clearRadius);
});

test('desperate uses floored low-health contract, target-centred clear, and preserves progress', () => {
    resetRuntime(['desperate_entry', 'desperate_clear', 'desperate_execute', 'desperate_capstone']);
    Game.maxLives = 6;
    Game.lives = 2;
    const enemy = { entityId: 9, x: 300, y: 300, width: 20, height: 20, health: 35, maxHealth: 100, _dead: false };
    Game.objectPools.enemies.active = [enemy];
    const clears = [];
    Game.clearEnemyBulletsInRadius = (x, y, radius) => {
        clears.push({ x, y, radius });
        return 2;
    };
    for (let shotId = 1; shotId <= 10; shotId++) Game.onDirectShotBatch(batch(shotId, enemy.entityId, 'enemy', 2));
    assert.equal(Game.buildState.metrics.desperateStrikeDamage, 6);
    assert.deepEqual(clears[0], { x: 310, y: 310, radius: 220 });
    assert.equal(Game.buildState.visualFeedbackEvents.some((event) => event.kind === 'desperate' && event.radius === CONFIG.builds.desperate.clearRadius), true);

    Game.lives = 3;
    for (let shotId = 11; shotId <= 17; shotId++) Game.onEnemyKilled({ source: 'direct', targetType: 'enemy', entityId: shotId });
    assert.equal(Game.buildState.counters.desperateKills, 7);
    Game.lives = 2;
    Game.canHeal = () => false;
    Game.onEnemyKilled({ source: 'direct', targetType: 'enemy', entityId: 18 });
    assert.equal(Game.buildState.counters.desperateKills, 8);
    Game.canHeal = () => true;
    Game.onEnemyKilled({ source: 'direct', targetType: 'enemy', entityId: 19 });
    assert.equal(Game.buildState.locks.desperateCycleHeal, true);
    assert.equal(Game.buildState.counters.desperateKills, 0);
});

test('chain has one fixed-damage seed, one propagation generation, and one 300px clear', () => {
    resetRuntime(['chain_entry', 'chain_radius', 'chain_spread', 'chain_capstone']);
    const first = { entityId: 1, x: 0, y: 0, width: 20, height: 20, health: 1, maxHealth: 1, _dead: false };
    const second = { entityId: 2, x: 210, y: 0, width: 20, height: 20, health: 0.5, maxHealth: 0.5, _dead: false };
    const third = { entityId: 3, x: 430, y: 0, width: 20, height: 20, health: 0.5, maxHealth: 0.5, _dead: false };
    Game.objectPools.enemies.active = [first, second, third];
    Game.spatialGrid = { getWithinRadius: () => Game.objectPools.enemies.active.map((obj) => ({ poolType: 'enemies', obj })) };
    let clearRadius = 0;
    let damageSources = [];
    Game.clearEnemyBulletsInRadius = (_x, _y, radius) => { clearRadius = radius; return 4; };
    Game.applyCombatDamage = (target, _type, amount, source) => {
        damageSources.push({ amount, source });
        target.health -= amount;
        if (target.health <= 0) target._dead = true;
        return true;
    };
    Game.chainSeedFromKill({ source: 'direct', x: 10, y: 10, damage: 99, entityId: 1 });
    assert.equal(damageSources[0].amount, 1);
    assert.ok(damageSources.some(({ amount }) => amount === 0.5));
    assert.equal(damageSources.filter(({ source }) => source === 'explosion').length >= 3, true);
    assert.equal(clearRadius, 300);
    assert.equal(Game.buildState.metrics.chainBulletClears, 4);
    assert.deepEqual(
        [...new Set(Game.buildState.visualFeedbackEvents.filter((event) => event.kind === 'chain').map((event) => event.radius))].sort((a, b) => a - b),
        [CONFIG.builds.chain.spreadRadius, CONFIG.builds.chain.wideRadius, CONFIG.builds.chain.capstoneRadius].sort((a, b) => a - b),
    );
});

// --- chain card + chain route stack as two independent chains ---------------

// Damage journal plus clear journal for one seeded chain run. `_dead` and the
// zero-health gate mirror applyCombatDamage so a settled death can never be
// re-damaged by the chain that runs second.
function chainRuntime(owned = [], card = null) {
    resetRuntime(owned);
    Game.activeCard = card;
    const calls = [];
    const clears = [];
    Game.applyCombatDamage = (target, _type, amount, source, extra = {}) => {
        if (!target || target._dead || target.health <= 0) return false;
        calls.push({ amount, source, chainId: extra.chainId, entityId: target.entityId });
        target.health -= amount;
        if (target.health <= 0) target._dead = true;
        return true;
    };
    Game.clearEnemyBulletsInRadius = (_x, _y, radius) => { clears.push(radius); return 2; };
    return { calls, clears };
}

function chainEnemies(...specs) {
    const enemies = specs.map(([entityId, cx, cy, health]) => ({
        entityId,
        x: cx - 10,
        y: cy - 10,
        width: 20,
        height: 20,
        health,
        maxHealth: health,
        _dead: false,
    }));
    Game.objectPools.enemies.active = enemies;
    Game.spatialGrid = { getWithinRadius: () => enemies.map((obj) => ({ poolType: 'enemies', obj })) };
    return enemies;
}

function seedChainKill(x = 0, y = 0) {
    return Game.chainSeedFromKill({ source: 'direct', x, y, damage: 99, entityId: 999 });
}

function chainFeedback() {
    return Game.buildState.visualFeedbackEvents.filter((event) => event.kind === 'chain');
}

function hudChainRow() {
    return Game.getBuildHudStates().find((row) => row.line === 'chain');
}

test('chain card alone seeds one 200px/1.0 blast with no spread and no clear', () => {
    const { calls, clears } = chainRuntime([], 'chain');
    chainEnemies([1, 150, 0, 2], [2, 250, 0, 2]);
    assert.equal(seedChainKill(), true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].amount, CONFIG.builds.chain.baseDamage);
    assert.equal(calls[0].source, 'explosion');
    assert.equal(Game.buildState.counters.chainBlasts, 1);
    assert.equal(Game.buildState.counters.chainGeneration, 0);
    assert.equal(clears.length, 0);
    const feedback = chainFeedback();
    assert.equal(feedback.length, 1);
    assert.equal(feedback[0].radius, CONFIG.builds.chain.baseRadius);
    assert.equal(feedback[0].generation, 0);
    assert.equal(Boolean(feedback[0].wide), false);
});

test('chain route alone keeps its pre-stacking single-chain behaviour', () => {
    const { calls } = chainRuntime(['chain_entry']);
    chainEnemies([1, 150, 0, 2], [2, 250, 0, 2]);
    assert.equal(seedChainKill(), true);
    assert.equal(calls.length, 1);
    assert.equal(Game.buildState.counters.chainBlasts, 1);
    assert.equal(chainFeedback()[0].radius, CONFIG.builds.chain.baseRadius);
});

test('one direct kill stacks the card blast and the route blast into two chains', () => {
    const { calls } = chainRuntime(['chain_entry'], 'chain');
    const [twin, outside] = chainEnemies([1, 150, 0, 2], [2, 250, 0, 2]);
    assert.equal(seedChainKill(), true);

    const chainIds = [...new Set(calls.map((call) => call.chainId))];
    assert.equal(chainIds.length, 2);
    assert.equal(calls.filter((call) => call.entityId === twin.entityId).length, 2);
    assert.equal(calls.filter((call) => call.entityId === outside.entityId).length, 0);
    assert.equal(twin.health, 0);
    // Two independent 1.0 chains overlap the twin: 2.0 total damage.
    assert.equal(Game.buildState.counters.chainBlasts, 2);
    assert.equal(Game.buildState.metrics.chainKills, 1);
    assert.equal(Game.buildState.metrics.chainExplosionKills, 1);
    assert.equal(Game.buildState.metrics.chainBonusDamage, 1);
    // The route chain is built second, so it owns the recorded last chain.
    assert.equal(Game.buildState._runtime.lastChainId, chainIds[1]);
    assert.equal(Game.buildState._runtime.lastChainKills, 1);

    // Card only: the recorded chain is the card chain.
    chainRuntime([], 'chain');
    chainEnemies([3, 150, 0, 1]);
    Game.chainSeedFromKill({ source: 'direct', x: 0, y: 0, entityId: 998 });
    assert.equal(Game.buildState._runtime.lastChainKills, 1);
    assert.equal(Game.buildState._runtime.lastChainId, Game.nextChainId);
});

test('the second chain never re-settles an enemy the first chain killed', () => {
    const { calls } = chainRuntime(['chain_entry'], 'chain');
    const [once] = chainEnemies([1, 150, 0, 1]);
    seedChainKill();
    assert.equal(calls.filter((call) => call.entityId === once.entityId).length, 1);
    assert.equal(Game.buildState.metrics.chainKills, 1);
    assert.equal(Game.buildState.metrics.chainExplosionKills, 1);
    assert.equal(Game.buildState.metrics.chainBonusDamage, 1);
});

test('the card blast never propagates while the route keeps chain_spread', () => {
    const { calls } = chainRuntime(['chain_entry', 'chain_spread'], 'chain');
    const [, middle, far] = chainEnemies([1, 0, 0, 2], [2, 210, 0, 0.5], [3, 420, 0, 0.5]);
    seedChainKill(0, 0);

    // Card blast, route seed, route propagation — one generation, route-only.
    assert.deepEqual(chainFeedback().map((event) => event.generation), [0, 0, 1]);
    assert.equal(Game.buildState.counters.chainGeneration, CONFIG.builds.chain.maxGeneration);
    assert.equal(Game.buildState.counters.chainBlasts, 3);
    assert.equal(middle.health, 0);
    assert.equal(far.health, 0.5);
    assert.equal(calls.filter((call) => call.entityId === far.entityId).length, 0);
    assert.equal(calls.filter((call) => call.entityId === middle.entityId && call.amount === CONFIG.builds.chain.spreadDamage).length, 1);
});

test('the chain capstone clear belongs to the route chain and fires once per chain', () => {
    // Four card-blast kills still clear nothing: the card chain has no capstone.
    const cardOnly = chainRuntime(['chain_entry', 'chain_capstone'], 'chain');
    chainEnemies([1, 40, 0, 1], [2, 80, 0, 1], [3, 120, 0, 1], [4, 160, 0, 1]);
    seedChainKill(0, 0);
    assert.equal(Game.buildState.metrics.chainKills, 4);
    assert.deepEqual(cardOnly.clears, []);
    assert.equal(Game.buildState.metrics.chainBulletClears, undefined);

    // Survivors of the card blast die to the route blast, so the route chain
    // reaches the third kill and clears exactly once.
    const stacked = chainRuntime(['chain_entry', 'chain_capstone'], 'chain');
    chainEnemies([5, 40, 0, 2], [6, 80, 0, 2], [7, 120, 0, 2], [8, 160, 0, 2]);
    seedChainKill(0, 0);
    assert.equal(Game.buildState.metrics.chainKills, 4);
    assert.deepEqual(stacked.clears, [CONFIG.builds.chain.capstoneRadius]);
    assert.equal(Game.buildState.metrics.chainBulletClears, 2);
});

test('the route wide radius never widens the card blast', () => {
    const { calls } = chainRuntime(['chain_entry', 'chain_radius'], 'chain');
    const [onlyRouteReaches] = chainEnemies([1, 240, 0, 1]);
    seedChainKill(0, 0);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].chainId, Game.buildState._runtime.lastChainId);
    assert.equal(Game.buildState.metrics.chainKills, 1);
    assert.equal(onlyRouteReaches._dead, true);
    assert.deepEqual(
        chainFeedback().map((event) => [event.generation, event.radius, Boolean(event.wide)]),
        [
            [0, CONFIG.builds.chain.baseRadius, false],
            [0, CONFIG.builds.chain.wideRadius, true],
        ],
    );
});

test('the chain HUD row shows the summed kills of both stacked chains', () => {
    // Card blast settles the 1 HP enemy; the route blast settles the two
    // survivors. The row must show 3/3 progress, not the route chain's 0/3.
    const { clears } = chainRuntime(['chain_entry', 'chain_capstone'], 'chain');
    chainEnemies([1, 60, 0, 2], [2, 120, 0, 2], [3, 180, 0, 1]);
    seedChainKill(0, 0);
    assert.equal(Game.buildState.metrics.chainKills, 3);
    assert.equal(Game.buildState._runtime.lastChainKills, 3);
    assert.equal(hudChainRow().value, `3/${CONFIG.builds.chain.capstoneKills}`);
    // Only two of those kills belong to the route chain, so the capstone is
    // still short of its threshold: card kills never feed route progress.
    assert.deepEqual(clears, []);
});

test('the chain capstone threshold never counts card-chain kills', () => {
    // The card blast settles all three soft targets and the route chain finds
    // them already dead: 3/3 on the row, no route clear.
    const card = chainRuntime(['chain_entry', 'chain_capstone'], 'chain');
    chainEnemies([1, 60, 0, 1], [2, 120, 0, 1], [3, 180, 0, 1]);
    seedChainKill(0, 0);
    assert.equal(Game.buildState._runtime.lastChainKills, 3);
    assert.equal(hudChainRow().value, `3/${CONFIG.builds.chain.capstoneKills}`);
    assert.deepEqual(card.clears, []);

    // Route-only kills still clear once at the third kill.
    const route = chainRuntime(['chain_entry', 'chain_capstone']);
    chainEnemies([4, 60, 0, 1], [5, 120, 0, 1], [6, 180, 0, 1]);
    seedChainKill(0, 0);
    assert.equal(Game.buildState._runtime.lastChainKills, 3);
    assert.deepEqual(route.clears, [CONFIG.builds.chain.capstoneRadius]);
});

test('single-source seeds and direct blasts keep their own kill count', () => {
    chainRuntime(['chain_entry']);
    chainEnemies([1, 60, 0, 1], [2, 120, 0, 1]);
    seedChainKill(0, 0);
    assert.equal(Game.buildState._runtime.lastChainKills, 2);
    assert.equal(hudChainRow().value, `2/${CONFIG.builds.chain.capstoneKills}`);

    chainRuntime(['chain_entry'], 'chain');
    chainEnemies([3, 60, 0, 1]);
    assert.equal(Game.createDamageExplosion({ x: 0, y: 0 }), true);
    assert.equal(Game.buildState._runtime.lastChainKills, 1);
});

test('explosion deaths never re-seed a chain and source defaults to the owned route', () => {
    const { calls } = chainRuntime(['chain_entry']);
    chainEnemies([1, 150, 0, 1]);
    assert.equal(Game.chainSeedFromKill({ source: 'explosion', x: 0, y: 0, entityId: 99 }), false);
    assert.equal(Game.buildState.counters.chainBlasts, 0);

    // No explicit source: the owned route selects the build chain.
    assert.equal(Game.createDamageExplosion({ x: 0, y: 0 }), true);
    assert.equal(chainFeedback().length, 1);
    assert.equal(chainFeedback()[0].wide, false);
    assert.equal(calls.length, 1);

    // Card-only resolution needs the card equipped.
    chainRuntime([]);
    assert.equal(Game.createDamageExplosion({ x: 0, y: 0 }), false);
    Game.activeCard = 'chain';
    assert.equal(Game.createDamageExplosion({ x: 0, y: 0, source: 'build' }), false);
    assert.equal(Game.createDamageExplosion({ x: 0, y: 0, source: 'card' }), true);
    assert.equal(Game.buildState.counters.chainBlasts, 1);
});

test('hunter has 3s lock memory, independent clear cooldown, hit-stop, and Boss window', () => {
    resetRuntime(['hunter_entry', 'hunter_lock', 'hunter_capstone']);
    const enemy = { entityId: 1, x: 0, y: 0, width: 20, height: 20, health: 100, maxHealth: 100, _dead: false };
    const boss = { entityId: 2, x: 0, y: 0, width: 30, height: 30, health: 100, maxHealth: 100, _dead: false };
    Game.objectPools.enemies.active = [enemy];
    Game.boss = boss;
    let hitStops = 0;
    let clears = 0;
    Game.requestVisualHitStop = (ms) => { if (ms === 150) hitStops++; };
    Game.clearEnemyBulletsInRadius = (_x, _y, radius) => { assert.equal(radius, 200); clears++; return 1; };
    for (let shotId = 1; shotId <= 10; shotId++) Game.onDirectShotBatch(batch(shotId, boss.entityId, 'boss', 2));
    assert.equal(Game.buildState.metrics.hunterPrecisionDamage, 4);
    assert.equal(Game.buildState.timers.hunterWindow, 2000);
    assert.equal(hitStops, 1);
    assert.equal(clears, 1);
    assert.equal(Game.buildState.visualFeedbackEvents.some((event) => event.kind === 'hunter' && event.radius === CONFIG.builds.hunter.clearRadius), true);

    Game.buildState.timers.hunterClearCooldown = 6000;
    Game.onDirectShotBatch(batch(11, boss.entityId, 'boss', 2));
    assert.equal(Game.buildState.metrics.hunterWindowDamage, 4);
    assert.equal(Game.buildState.timers.hunterWindow, 0);
    assert.equal(clears, 1);
});

test('supply counts natural pickups, uses 200px magnet data, and caps pulse at 8000ms', () => {
    resetRuntime(['supply_entry', 'supply_duration', 'supply_capstone']);
    assert.equal(Game.getSupplyPulseDuration(), 6000);
    Game.onItemCollected({ type: 1, spawnSource: 'natural', wasFull: false, healingAllowed: true, collectedByMagnet: true });
    Game.onItemCollected({ type: 2, spawnSource: 'natural', wasFull: false, healingAllowed: true });
    Game.onItemCollected({ type: 0, spawnSource: 'natural', wasFull: true, healingAllowed: true });
    assert.equal(Game.buildState.timers.supplyPulse, 6000);
    assert.equal(Game.buildState.metrics.supplyNaturalPickups, 3);
    assert.equal(Game.buildState.metrics.supplyMagnetPickups, 1);
    Game.onItemCollected({ type: 1, spawnSource: 'natural', wasFull: false, healingAllowed: true });
    Game.onItemCollected({ type: 1, spawnSource: 'natural', wasFull: false, healingAllowed: true });
    Game.onItemCollected({ type: 1, spawnSource: 'natural', wasFull: false, healingAllowed: true });
    assert.equal(Game.buildState.timers.supplyPulse, 8000);
    assert.equal(Game.getSupplyPulseDamageBonus(), CONFIG.builds.supply.pulseDamageBonus);
});

test('direct batch handler fixes D once and orders window, rapid, hunter, desperate', () => {
    resetRuntime();
    const calls = [];
    Game.hunterWindowOnBatch = () => calls.push('window');
    Game.rapidOnBatch = () => calls.push('rapid');
    Game.hunterOnBatch = () => calls.push('hunter');
    Game.desperateOnBatch = () => calls.push('desperate');
    Game.onDirectShotBatch(batch(1, 1, 'enemy', 2.5));
    assert.equal(Game.buildState.counters.directBaseDamage, 2.5);
    assert.deepEqual(calls, ['window', 'rapid', 'hunter', 'desperate']);
});

test('direct batch D follows the actual primary event, not the first secondary hit', () => {
    resetRuntime();
    Game.onDirectShotBatch({
        shotId: 2,
        events: [
            { shotId: 2, isPrimary: false, baseDamage: 1, amount: 1 },
            { shotId: 2, isPrimary: true, baseDamage: 2.5, amount: 2.5, rapidBonusDamage: 1, supplyBonusDamage: 0.5 },
        ],
    });
    assert.equal(Game.buildState.counters.directBaseDamage, 2.5);
});

test('route feedback events reach the semantic painter with distinct fortress rings', () => {
    resetRuntime(['fortress_entry', 'fortress_echo', 'fortress_capstone']);
    Game.buildState.locks.fortressBarrier = true;
    Game.buildState.timers.fortressClearCooldown = 0;
    const radii = [];
    const originalDrawRadiusRing = Game.drawRadiusRing;
    Game.drawRadiusRing = (_x, _y, radius) => radii.push(radius);
    try {
        Game.onFortressBarrierConsumed();
        Game.drawVisualFeedbackEvents();
    } finally {
        Game.drawRadiusRing = originalDrawRadiusRing;
    }
    assert.deepEqual(radii, [CONFIG.builds.fortress.echoRadius, CONFIG.builds.fortress.clearRadius]);
});
