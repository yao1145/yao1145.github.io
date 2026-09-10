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
