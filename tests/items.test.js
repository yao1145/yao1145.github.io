import assert from 'node:assert/strict';
import test from 'node:test';

import { Game } from '../js/core/game.js';
import { CONFIG } from '../js/core/config.js';
import { resetGameFixture } from './helpers/game-fixture.js';
import '../js/core/pools.js';
import '../js/systems/cards.js';
import '../js/systems/builds.js';
import '../js/entities/player.js';
import '../js/entities/items.js';
import '../js/systems/collisions.js';

function resetItems() {
    resetGameFixture();
    Game.resetBuildState();
    Game.width = 400;
    Game.height = 400;
    Game.player = {
        x: 180,
        y: 300,
        width: CONFIG.player.width,
        height: CONFIG.player.height,
        speed: CONFIG.player.speed,
        shotDelay: CONFIG.player.shotDelay,
        lastShot: 0,
        shieldTime: 0,
    };
    Game.activeCard = 'supply';
    Game.updateUI = () => {};
    Game.updateAttackUI = () => {};
    Game.updateShieldUI = () => {};
    Game.createExplosion = () => {};
    Game.keys = {};
    return Game;
}

function makeItem(type, overrides = {}) {
    const item = Game.getObject('items');
    Object.assign(item, {
        x: Game.player.x,
        y: Game.player.y,
        width: 20,
        height: 20,
        speed: 2,
        color: '#f00',
        type,
        spin: 0,
        spawnSource: 'natural',
        ...overrides,
    });
    return item;
}

function collectNatural(type, overrides = {}) {
    const item = makeItem(type, overrides);
    assert.equal(Game.collectItem(item), true);
    return item;
}

test('natural item spawns carry the natural spawn source', () => {
    resetItems();
    Game.itemSpawnRate = 1;
    const random = Math.random;
    Math.random = () => 0;
    try {
        Game.spawnItems();
    } finally {
        Math.random = random;
    }

    assert.equal(Game.objectPools.items.active.length, 1);
    assert.equal(Game.objectPools.items.active[0].spawnSource, 'natural');
});

test('core supply multiplies natural item rate without pulse gating', () => {
    resetItems();
    Game.itemSpawnRate = 0.001;
    Game.activeCard = null;
    Game.spawnItems(() => 0.0014);
    assert.equal(Game.objectPools.items.active.length, 0);

    Game.activeCard = 'supply';
    assert.equal(Game.getItemSpawnRate(), 0.0015);
    Game.spawnItems(() => 0.0014);
    assert.equal(Game.objectPools.items.active.length, 1);
});

test('supply magnet also moves a non-natural collectible item', () => {
    resetItems();
    Game.buildState.owned = ['supply_entry', 'supply_magnet'];
    const item = makeItem(1, {
        x: Game.player.x + 50,
        y: Game.player.y,
        spawnSource: 'enemyDrop',
    });
    const beforeX = item.x;

    Game.updateItems(Game.fixedStepMs);

    assert.ok(item.x < beforeX);
    assert.equal(Game.objectPools.items.active.includes(item), true);
});

test('a healing-disabled heart is consumed but adds no supply progress', () => {
    resetItems();
    Game.activeCard = 'blitz';
    Game.buildState.owned = ['supply_entry'];
    const heart = makeItem(0);

    assert.equal(Game.collectItem(heart), true);
    assert.equal(Game.lives, 3);
    assert.equal(Game.buildState.counters.supplyPickups || 0, 0);
    assert.equal(Game.objectPools.items.active.includes(heart), false);
});

test('a full-health natural heart with the supply capstone adds two progress', () => {
    resetItems();
    Game.lives = Game.getMaxLives();
    Game.buildState.owned = ['supply_entry', 'supply_magnet', 'supply_capstone'];

    collectNatural(0);

    assert.equal(Game.buildState.counters.supplyPickups, 2);
});

test('a full-health natural heart without the supply capstone adds one progress', () => {
    resetItems();
    Game.lives = Game.getMaxLives();
    Game.buildState.owned = ['supply_entry'];

    collectNatural(0);

    assert.equal(Game.buildState.counters.supplyPickups, 1);
});

test('non-natural items never contribute to the supply route', () => {
    resetItems();
    Game.buildState.owned = ['supply_entry'];

    collectNatural(1, { spawnSource: 'enemyDrop' });

    assert.equal(Game.buildState.counters.supplyPickups || 0, 0);
});

test('script and debug item sources never contribute to the supply route', () => {
    for (const spawnSource of ['script', 'debug']) {
        resetItems();
        Game.buildState.owned = ['supply_entry'];

        collectNatural(1, { spawnSource });

        assert.equal(Game.buildState.counters.supplyPickups || 0, 0, spawnSource);
        assert.equal(Game.buildState.metrics.supplyNaturalPickups || 0, 0, spawnSource);
    }
});

test('boost heart pickup grants two lives once and respects the max-life cap', () => {
    resetItems();
    Game.activeCard = 'boost';

    Game.lives = 1;
    collectNatural(0);
    assert.equal(Game.lives, 3);

    Game.lives = Game.getMaxLives() - 1;
    collectNatural(0);
    assert.equal(Game.lives, Game.getMaxLives());
});

test('boost damage and shield items expire at their exact logical boundaries', () => {
    const cases = [
        { type: 1, durationMs: CONFIG.cards.boostDamageTime * 1000, field: 'damage' },
        { type: 2, durationMs: CONFIG.cards.boostShieldTime * 1000, field: 'shield' },
    ];

    for (const { type, durationMs, field } of cases) {
        for (const offset of [-1, 0, 1]) {
            resetItems();
            Game.activeCard = 'boost';
            collectNatural(type);

            Game.updatePlayer(durationMs + offset);

            if (field === 'damage') {
                assert.ok(Math.abs(Game.damageBoostTime - Math.max(0, -offset / 1000)) < 1e-9);
                assert.equal(Game.isDamageBoost, offset <= 0);
                assert.equal(Game.bulletDamage, offset <= 0 ? 2 : 1);
            } else {
                assert.ok(Math.abs(Game.player.shieldTime - Math.max(0, -offset / 1000)) < 1e-9);
            }
        }
    }
});

test('boost heart handling advances supply exactly once without duplicating its effect', () => {
    resetItems();
    Game.activeCard = 'boost';
    Game.buildState.owned = ['supply_entry'];
    Game.lives = 1;

    collectNatural(0);

    assert.equal(Game.lives, 3);
    assert.equal(Game.buildState.counters.supplyPickups, 1);
    assert.equal(Game.buildState.metrics.supplyNaturalPickups, 1);
});

test('the third natural pickup starts a pulse and the next pickup starts a new cycle', () => {
    resetItems();
    Game.buildState.owned = ['supply_entry'];

    collectNatural(1);
    collectNatural(2);
    collectNatural(1);

    assert.equal(Game.buildState.counters.supplyPickups, 0);
    assert.equal(Game.buildState.timers.supplyPulse, CONFIG.builds.supply.pulseMs);

    collectNatural(1);

    assert.equal(Game.buildState.counters.supplyPickups, 1);
    assert.equal(Game.buildState.timers.supplyPulse, CONFIG.builds.supply.pulseMs);
});

test('a healing-disabled heart leaves an active pulse and progress unchanged', () => {
    resetItems();
    Game.activeCard = 'blitz';
    Game.buildState.owned = ['supply_entry'];
    Game.buildState.counters.supplyPickups = 2;
    Game.buildState.timers.supplyPulse = 500;

    collectNatural(0);

    assert.equal(Game.buildState.timers.supplyPulse, 500);
    assert.equal(Game.buildState.counters.supplyPickups, 2);
});

test('supply duration branch lasts 6s and the capstone hard-caps a pulse at 8s', () => {
    resetItems();
    Game.buildState.owned = ['supply_entry', 'supply_duration'];
    Game.buildState.counters.supplyPickups = 2;

    Game.onItemCollected({ type: 1, spawnSource: 'natural', wasFull: false, healingAllowed: true });
    assert.equal(Game.buildState.timers.supplyPulse, CONFIG.builds.supply.longPulseMs);

    Game.buildState.owned = ['supply_entry', 'supply_duration', 'supply_capstone'];
    Game.buildState.counters.supplyPickups = 2;
    Game.buildState.timers.supplyPulse = 3000;
    Game.onItemCollected({ type: 1, spawnSource: 'natural', wasFull: false, healingAllowed: true });
    assert.equal(Game.buildState.timers.supplyPulse, CONFIG.builds.supply.maxPulseMs);

    Game.updateBuildEffects(CONFIG.builds.supply.maxPulseMs + 1);
    assert.equal(Game.buildState.timers.supplyPulse, 0);
});

test('supply pulse base, duration, and hard-cap timings cover -1/0/+1ms logically', () => {
    const cases = [
        { owned: ['supply_entry'], durationMs: CONFIG.builds.supply.pulseMs },
        { owned: ['supply_entry', 'supply_duration'], durationMs: CONFIG.builds.supply.longPulseMs },
        { owned: ['supply_entry', 'supply_duration', 'supply_capstone'], durationMs: CONFIG.builds.supply.maxPulseMs },
    ];

    for (const { owned, durationMs } of cases) {
        for (const offset of [-1, 0, 1]) {
            resetItems();
            Game.buildState.owned = owned;
            Game.buildState.timers.supplyPulse = durationMs;

            Game.updateBuildEffects(durationMs + offset);

            assert.equal(Game.buildState.timers.supplyPulse, Math.max(0, -offset), `${durationMs}ms pulse at ${offset}ms`);
        }
    }

    for (const current of [CONFIG.builds.supply.pulseMs - 1, CONFIG.builds.supply.pulseMs, CONFIG.builds.supply.pulseMs + 1]) {
        resetItems();
        Game.buildState.owned = ['supply_entry', 'supply_capstone'];
        Game.buildState.counters.supplyPickups = CONFIG.builds.supply.pickups - 1;
        Game.buildState.timers.supplyPulse = current;

        Game.onItemCollected({ type: 1, spawnSource: 'natural', wasFull: false, healingAllowed: true });

        assert.equal(
            Game.buildState.timers.supplyPulse,
            Math.min(CONFIG.builds.supply.maxPulseMs, current + CONFIG.builds.supply.pulseMs),
            `8s cap refresh at ${current}ms`,
        );
    }
});

test('supply magnet moves nearby items by one fixed step without collecting them', () => {
    resetItems();
    Game.buildState.owned = ['supply_entry', 'supply_magnet'];
    const item = makeItem(1, { x: Game.player.x + 50, y: Game.player.y });
    const before = { x: item.x, y: item.y };
    const enemyBullet = Game.getObject('enemyBullets');
    Object.assign(enemyBullet, { x: 0, y: 0, width: 4, height: 10 });

    Game.updateItems(Game.fixedStepMs);

    assert.ok(item.x < before.x || item.y < before.y);
    assert.equal(Game.objectPools.items.active.includes(item), true);
    assert.equal(Game.objectPools.enemyBullets.active.includes(enemyBullet), true);
});

test('supply magnet continuously attracts at 199/200px but not 201px', () => {
    resetItems();
    Game.buildState.owned = ['supply_entry', 'supply_magnet'];
    const playerCenterX = Game.player.x + Game.player.width / 2;
    const playerCenterY = Game.player.y + Game.player.height / 2;
    const makeBoundaryItem = (distance) => makeItem(1, {
        x: playerCenterX + distance - 10,
        y: playerCenterY - 10,
        speed: 0,
    });
    const near = makeBoundaryItem(199);
    const edge = makeBoundaryItem(200);
    const far = makeBoundaryItem(201);
    const nearBefore = near.x;
    const edgeBefore = edge.x;
    const farBefore = far.x;

    Game.updateItems(Game.fixedStepMs);

    assert.ok(near.x < nearBefore);
    assert.ok(edge.x < edgeBefore);
    assert.equal(far.x, farBefore);
    assert.equal(near.attractionActive, true);
    assert.equal(edge.attractionActive, true);
    assert.equal(far.attractionActive, false);
    assert.equal(Game.objectPools.items.active.includes(near), true);
    assert.equal(Game.objectPools.items.active.includes(edge), true);
    assert.equal(Game.objectPools.items.active.includes(far), true);
});

test('supply pulse countdown advances by the fixed simulation step', () => {
    resetItems();
    Game.buildState.owned = ['supply_entry'];
    Game.buildState.timers.supplyPulse = CONFIG.builds.supply.pulseMs;

    Game.updateBuildEffects(Game.fixedStepMs);

    assert.ok(Math.abs(Game.buildState.timers.supplyPulse - (CONFIG.builds.supply.pulseMs - Game.fixedStepMs)) < 1e-9);
});

test('supply pulse assigns its +1 damage bonus to every bullet in the batch', () => {
    resetItems();
    Game.buildState.owned = ['supply_entry'];
    Game.buildState.timers.supplyPulse = CONFIG.builds.supply.pulseMs;
    Game.baseBulletCount = 3;

    Game.spawnBullet();

    const bullets = Game.objectPools.bullets.active;
    assert.equal(bullets.length, 3);
    assert.equal(bullets.filter((bullet) => bullet.isPrimary).length, 1);
    assert.ok(bullets.every((bullet) => bullet.supplyDamageBonus === CONFIG.builds.supply.pulseDamageBonus));
    // Base damage 1 + pulse 1, on every bullet of the batch.
    assert.ok(bullets.every((bullet) => Game.getDirectShotDamage('enemy', bullet) === 2));
});

test('no supply pulse leaves every bullet of the batch without a bonus', () => {
    resetItems();
    Game.buildState.owned = ['supply_entry'];
    Game.buildState.timers.supplyPulse = 0;
    Game.baseBulletCount = 3;

    Game.spawnBullet();

    const bullets = Game.objectPools.bullets.active;
    assert.equal(bullets.length, 3);
    assert.ok(bullets.every((bullet) => bullet.supplyDamageBonus === 0));
    assert.ok(bullets.every((bullet) => Game.getDirectShotDamage('enemy', bullet) === 1));
});

test('a single bullet consumes the supply damage bonus at most once', () => {
    resetItems();
    Game.buildState.owned = ['supply_entry'];
    Game.buildState.timers.supplyPulse = CONFIG.builds.supply.pulseMs;
    Game.baseBulletCount = 1;
    Game.spawnBullet();

    const bullet = Game.objectPools.bullets.active[0];
    assert.equal(Game.getDirectShotDamage('enemy', bullet), 2);
    assert.equal(Game.getDirectShotDamage('enemy', bullet), 1);
});

test('item collection broadcasts exactly one event after applying and releasing the item', () => {
    resetItems();
    Game.buildState.owned = ['supply_entry'];
    const events = [];
    const original = Game.onItemCollected;
    Game.onItemCollected = (event) => {
        events.push({
            event,
            shieldTime: Game.player.shieldTime,
            itemStillActive: Game.objectPools.items.active.includes(item),
        });
        return original.call(Game, event);
    };

    const item = makeItem(2);
    try {
        assert.equal(Game.collectItem(item), true);

        assert.equal(events.length, 1);
        assert.deepEqual(events[0].event, {
            type: 2,
            spawnSource: 'natural',
            wasFull: false,
            healingAllowed: true,
            collectedByMagnet: false,
        });
        assert.equal(events[0].shieldTime, 5);
        assert.equal(events[0].itemStillActive, false);

        assert.equal(Game.collectItem(item), false);
        assert.equal(events.length, 1);
    } finally {
        Game.onItemCollected = original;
    }
});

test('rapid and supply combine on a one-bullet batch once, and hunter/desperate read the final D', () => {
    resetItems();
    Game.buildState.owned = ['supply_entry', 'hunter_entry'];
    Game.buildState.timers.supplyPulse = CONFIG.builds.supply.pulseMs;
    Game.buildState.owned.push('rapid_entry');
    Game.buildState.timers.rapidWarmup = CONFIG.builds.rapid.activeMs;
    Game.buildState.counters.rapidHeatupShots = 1;
    const enemy = Game.getObject('enemies');
    Object.assign(enemy, {
        entityId: Game.allocateEntityId(),
        x: 0,
        y: 0,
        width: 30,
        height: 30,
        type: 0,
        health: 100,
        maxHealth: 100,
        _dead: false,
    });
    Game.baseBulletCount = 1;
    Game.spawnBullet();
    const primary = Game.objectPools.bullets.active[0];
    assert.equal(primary.rapidDamageBonus + primary.supplyDamageBonus, 2);
    const directDamage = Game.getDirectShotDamage('enemy', primary);
    assert.equal(directDamage, 3);
    assert.equal(Game.getDirectShotDamage('enemy', primary), 1);

    for (let shotId = 1; shotId <= CONFIG.builds.hunter.hits; shotId++) {
        Game.onDirectShotBatch({
            shotId,
            events: [{
                source: 'direct',
                isPrimary: true,
                targetType: 'enemy',
                entityId: enemy.entityId,
                baseDamage: directDamage,
                amount: directDamage,
            }],
        });
    }

    // Hunter precision strikes read D (=3): 10 hits earn one 2D strike.
    assert.equal(enemy.health, 94);

    Game.buildState.owned = ['supply_entry', 'rapid_entry', 'desperate_entry'];
    Game.lives = 1;
    for (let shotId = 11; shotId <= 10 + CONFIG.builds.desperate.hits; shotId++) {
        Game.onDirectShotBatch({
            shotId,
            events: [{
                source: 'direct',
                isPrimary: true,
                targetType: 'enemy',
                entityId: enemy.entityId,
                baseDamage: directDamage,
                amount: directDamage,
            }],
        });
    }

    assert.equal(enemy.health, 88);
});
