import assert from 'node:assert/strict';
import test from 'node:test';

import { Game } from '../js/core/game.js';
import { CONFIG } from '../js/core/config.js';
import { resetGameFixture } from './helpers/game-fixture.js';
import '../js/core/pools.js';
import '../js/core/grid.js';
import '../js/systems/cards.js';
import '../js/systems/collisions.js';
import '../js/systems/builds.js';

const realEnemyKilledHandler = Game.onEnemyKilled;

function resetCombat() {
    resetGameFixture();
    Game.player = { x: 0, y: 0, width: 30, height: 30, shieldTime: 0 };
    Game.updateUI = () => {};
    Game.createExplosion = () => {};
    Game.createShockwave = () => {};
    Game.onDirectShotBatch = () => {};
    Game.onEnemyKilled = () => {};
    Game.buildState = { owned: [], metrics: {}, timers: {}, counters: {}, locks: {} };
    Game.bossHealthBar = { style: {} };
    Game.summonIndicator = { style: {} };
    Game.bossWarning = { style: {} };
    Game.beginRewardFlow = () => {};
    Game.activeCard = null;
    return Game;
}

function makeEnemy(health = 1, x = 0, y = 0) {
    const enemy = Game.getObject('enemies');
    Object.assign(enemy, {
        entityId: Game.allocateEntityId(),
        x,
        y,
        width: 20,
        height: 20,
        type: 0,
        health,
        maxHealth: health,
        color: '#f00',
        _dead: false,
    });
    return enemy;
}

function makeBullet(overrides = {}) {
    const bullet = Game.getObject('bullets');
    Object.assign(bullet, {
        shotId: 1,
        isPrimary: true,
        rapidBatchBoosted: false,
        rapidDamageBonus: 0,
        supplyDamageBonus: 0,
        buildDamageBonus: 0,
        pierceRemaining: 0,
        hitEntityIds: [],
        x: 0,
        y: 0,
        width: 4,
        height: 12,
        ...overrides,
    });
    return bullet;
}

test('direct damage combines rapid and supply once, then only pierces distinct entities', () => {
    resetCombat();
    const first = makeEnemy(10, 0, 0);
    const second = makeEnemy(10, 40, 0);
    const bullet = makeBullet({ rapidDamageBonus: 1, supplyDamageBonus: 0.5, pierceRemaining: 1 });

    const originalGetDamageFor = Game.getDamageFor;
    let getDamageForCalls = 0;
    Game.getDamageFor = (targetType) => {
        getDamageForCalls++;
        assert.equal(targetType, 'enemy');
        return 1;
    };

    try {
        const firstEvent = Game.damageTarget({ bullet, target: first, targetType: 'enemy' });
        assert.ok(firstEvent);
        assert.equal(firstEvent.amount, 2.5);
        assert.equal(firstEvent.rapidBonusDamage, 1);
        assert.equal(firstEvent.supplyBonusDamage, 0.5);
        assert.equal(firstEvent.rapidPierceHit, false);
        assert.equal(first.health, 7.5);
        assert.equal(bullet.rapidDamageBonus, 0);
        assert.equal(bullet.supplyDamageBonus, 0);

        const secondEvent = Game.damageTarget({ bullet, target: second, targetType: 'enemy' });
        assert.ok(secondEvent);
        assert.equal(secondEvent.amount, 1);
        assert.equal(secondEvent.rapidBonusDamage, 0);
        assert.equal(secondEvent.supplyBonusDamage, 0);
        assert.equal(secondEvent.rapidPierceHit, true);
        assert.equal(second.health, 9);

        // The same entity is not damageable twice by one piercing bullet.
        assert.equal(Game.damageTarget({ bullet, target: first, targetType: 'enemy' }), null);
        assert.equal(first.health, 7.5);
        assert.equal(getDamageForCalls, 2);
        assert.equal(Game.buildState.metrics.rapidBonusDamage, 1);
        assert.equal(Game.buildState.metrics.supplyBonusDamage, 0.5);
        assert.equal(Game.buildState.metrics.rapidPrimaryBonusDamage, 1);
        assert.equal(Game.buildState.metrics.supplyPulseBonusDamage, 0.5);
        assert.equal(Game.buildState.metrics.rapidPierceHits, 1);
    } finally {
        Game.getDamageFor = originalGetDamageFor;
    }
});

test('unique normal deaths feed bloodlust once and failed exchanges retain the meter', () => {
    resetCombat();
    Game.activeCard = 'bloodlust';
    Game.lives = 3;
    Game.bloodlustMeter = 0;
    const progress = [];
    const originalProgress = Game.addBloodlustProgress;
    Game.addBloodlustProgress = (amount) => {
        progress.push(amount);
        return originalProgress.call(Game, amount);
    };

    try {
        for (const source of ['direct', 'explosion', 'retaliation']) {
            const enemy = makeEnemy(1);
            assert.equal(Game.applyCombatDamage(enemy, 'enemy', 1, source), true);
            assert.equal(Game.applyCombatDamage(enemy, 'enemy', 1, source), false);
        }
        assert.deepEqual(progress, [1, 1, 1]);
        assert.equal(Game.bloodlustMeter, 3);

        // At the life cap, 8 points remain pending instead of being consumed.
        Game.lives = CONFIG.player.maxLives;
        Game.bloodlustMeter = 7;
        const blocked = makeEnemy(1);
        Game.applyCombatDamage(blocked, 'enemy', 1, 'direct');
        assert.equal(Game.bloodlustMeter, 8);
        assert.equal(Game.lives, CONFIG.player.maxLives);

        // A later unique kill retries the exchange and preserves the remainder.
        Game.lives -= 1;
        const retry = makeEnemy(1);
        Game.applyCombatDamage(retry, 'enemy', 1, 'retaliation');
        assert.equal(Game.lives, CONFIG.player.maxLives);
        assert.equal(Game.bloodlustMeter, 1);
    } finally {
        Game.addBloodlustProgress = originalProgress;
    }
});

test('Boss bloodlust progress is emitted only after the Boss identity is cleared', () => {
    resetCombat();
    Game.activeCard = 'bloodlust';
    Game.bloodlustMeter = 0;
    Game.lives = CONFIG.player.maxLives;
    const progress = [];
    const originalProgress = Game.addBloodlustProgress;
    Game.addBloodlustProgress = (amount) => {
        progress.push({ amount, boss: Game.boss });
        return originalProgress.call(Game, amount);
    };

    try {
        Game.boss = {
            entityId: Game.allocateEntityId(),
            x: 0,
            y: 0,
            width: 40,
            height: 40,
            health: 1,
            maxHealth: 1,
            _dead: false,
        };
        assert.equal(Game.applyCombatDamage(Game.boss, 'boss', 1, 'direct'), true);
        assert.equal(Game.boss, null);
        assert.deepEqual(progress, [{ amount: CONFIG.cards.bloodlustBossProgress, boss: null }]);
        Game.handleBossDeath();
        assert.equal(progress.length, 1);
    } finally {
        Game.addBloodlustProgress = originalProgress;
    }
});

test('clearing enemy bullets uses center-distance boundaries and emits no combat events', () => {
    resetCombat();
    const radius = 10;
    const edge = Game.getObject('enemyBullets');
    Object.assign(edge, { x: 105, y: 95, width: 10, height: 10 }); // center (110,100)
    const inside = Game.getObject('enemyBullets');
    Object.assign(inside, { x: 96, y: 96, width: 8, height: 8 }); // center (100,100)
    const outside = Game.getObject('enemyBullets');
    Object.assign(outside, { x: 110.1, y: 95, width: 10, height: 10 }); // 10.1px away
    const mechanic = Game.getObject('enemyBullets');
    Object.assign(mechanic, { x: 100, y: 100, width: 4, height: 4, canBeCleared: false });

    let eventCount = 0;
    Game.onEnemyKilled = () => { eventCount++; };
    const cleared = Game.clearEnemyBulletsInRadius(100, 100, radius);

    assert.equal(cleared, 2);
    assert.equal(Game.objectPools.enemyBullets.active.includes(edge), false);
    assert.equal(Game.objectPools.enemyBullets.active.includes(inside), false);
    assert.equal(Game.objectPools.enemyBullets.active.includes(outside), true);
    assert.equal(Game.objectPools.enemyBullets.active.includes(mechanic), true);
    assert.equal(eventCount, 0);
});

test('chain uses fixed damage for one-generation propagation, never damages Boss, and clears once', () => {
    resetCombat();
    Game.resetBuildState();
    Game.buildState.owned = ['chain_entry', 'chain_spread', 'chain_capstone'];
    Game.activeCard = 'chain';
    Game.onEnemyKilled = realEnemyKilledHandler;

    const seed = makeEnemy(1, 0, 0);
    // Two health so the target survives the 1.0 card blast and is settled by
    // the route blast, which is the chain that owns propagation and the clear.
    const firstGeneration = makeEnemy(2, 100, 0);
    const secondGenerationA = makeEnemy(0.5, 300, 0);
    const secondGenerationB = makeEnemy(0.5, 300, 20);
    Game.spatialGrid = {
        getWithinRadius: () => Game.objectPools.enemies.active
            .map((obj) => ({ poolType: 'enemies', obj })),
    };
    Game.boss = {
        entityId: Game.allocateEntityId(),
        x: 0,
        y: 0,
        width: 20,
        height: 20,
        health: 100,
        maxHealth: 100,
    };

    const nearLastKill = Game.getObject('enemyBullets');
    Object.assign(nearLastKill, { x: 300, y: 0, width: 10, height: 10 });
    const damageCalls = [];
    const originalApplyCombatDamage = Game.applyCombatDamage;
    Game.applyCombatDamage = function(...args) {
        damageCalls.push(args);
        return originalApplyCombatDamage.apply(this, args);
    };

    try {
        // The direct killing blow is deliberately huge; chain damage must not
        // derive from it. The core card and the entry stack into two separate
        // chains, so one direct kill spends one card blast plus one route
        // seed, and only the route chain then propagates and clears.
        seed.health = 0;
        Game.killEnemy(seed, { source: 'direct', damage: 99 });

        const explosionAmounts = damageCalls
            .filter((args) => args[3] === 'explosion')
            .map((args) => args[2]);
        assert.ok(explosionAmounts.includes(CONFIG.builds.chain.baseDamage));
        assert.ok(explosionAmounts.includes(CONFIG.builds.chain.spreadDamage));
        assert.ok(explosionAmounts.every((amount) => amount === 1 || amount === 0.5));
        assert.equal(Game.boss.health, 100);
        assert.equal(Game.buildState.metrics.chainBulletClears, 1);
        assert.equal(Game.objectPools.enemyBullets.active.includes(nearLastKill), false);
        assert.equal(Game.buildState.counters.chainBlasts, 3);
        assert.equal(Game.objectPools.enemies.active.includes(firstGeneration), false);
        assert.equal(Game.objectPools.enemies.active.includes(secondGenerationA), false);
        assert.equal(Game.objectPools.enemies.active.includes(secondGenerationB), false);
    } finally {
        Game.applyCombatDamage = originalApplyCombatDamage;
        Game.onEnemyKilled = () => {};
    }
});
