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

test('supply pulse doubles item probability while pulse is active and keeps a deterministic RNG hook', () => {
    resetItems();
    Game.itemSpawnRate = 0.001;
    Game.buildState.owned = ['supply_entry'];
    const random = Math.random;
    Math.random = () => 0.0015;
    try {
        Game.buildState.timers.supplyPulse = 0;
        Game.spawnItems(() => 0.0015);
        assert.equal(Game.objectPools.items.active.length, 0);

        Game.buildState.timers.supplyPulse = 1;
        Game.spawnItems(() => 0.0015);
        assert.equal(Game.objectPools.items.active.length, 1);
    } finally {
        Math.random = random;
    }
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

test('the third natural pickup starts a pulse and does not bank excess progress', () => {
    resetItems();
    Game.buildState.owned = ['supply_entry'];

    collectNatural(1);
    collectNatural(2);
    collectNatural(1);

    assert.equal(Game.buildState.counters.supplyPickups, 0);
    assert.equal(Game.buildState.timers.supplyPulse, CONFIG.builds.supply.pulseMs);

    collectNatural(1);

    assert.equal(Game.buildState.counters.supplyPickups, 0);
    assert.equal(Game.buildState.timers.supplyPulse, CONFIG.builds.supply.pulseMs);
});

test('a healing-disabled heart refreshes an active pulse without adding next-cycle progress', () => {
    resetItems();
    Game.activeCard = 'blitz';
    Game.buildState.owned = ['supply_entry'];
    Game.buildState.counters.supplyPickups = 2;
    Game.buildState.timers.supplyPulse = 500;

    collectNatural(0);

    assert.equal(Game.buildState.timers.supplyPulse, CONFIG.builds.supply.pulseMs);
    assert.equal(Game.buildState.counters.supplyPickups, 0);
});

test('extended and boost supply pulses refresh to their exact capped duration', () => {
    resetItems();
    Game.buildState.owned = ['supply_entry', 'supply_extended'];
    Game.buildState.timers.supplyPulse = 500;

    Game.onItemCollected({ type: 1, spawnSource: 'natural', wasFull: false, healingAllowed: true });
    assert.equal(Game.buildState.timers.supplyPulse, CONFIG.builds.supply.extendedPulseMs);

    Game.activeCard = 'boost';
    Game.buildState.timers.supplyPulse = 500;
    Game.onItemCollected({ type: 1, spawnSource: 'natural', wasFull: false, healingAllowed: true });
    assert.equal(Game.buildState.timers.supplyPulse, CONFIG.builds.supply.durationCapMs);

    Game.updateBuildEffects(CONFIG.builds.supply.durationCapMs + 1);
    assert.equal(Game.buildState.timers.supplyPulse, 0);
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

test('supply magnet reaches 150px but does not pull from beyond that radius', () => {
    resetItems();
    Game.buildState.owned = ['supply_entry', 'supply_magnet'];
    const near = makeItem(1, { x: Game.player.x + 150, y: Game.player.y });
    const far = makeItem(1, { x: Game.player.x + 160, y: Game.player.y });
    const nearBefore = near.x;
    const farBefore = far.x;

    Game.updateItems(Game.fixedStepMs);

    assert.ok(near.x < nearBefore);
    assert.equal(far.x, farBefore);
});

test('supply pulse countdown advances by the fixed simulation step', () => {
    resetItems();
    Game.buildState.owned = ['supply_entry'];
    Game.buildState.timers.supplyPulse = CONFIG.builds.supply.pulseMs;

    Game.updateBuildEffects(Game.fixedStepMs);

    assert.ok(Math.abs(Game.buildState.timers.supplyPulse - (CONFIG.builds.supply.pulseMs - Game.fixedStepMs)) < 1e-9);
});

test('supply pulse assigns +1 damage once to every bullet in the shot', () => {
    resetItems();
    Game.buildState.owned = ['supply_entry'];
    Game.buildState.timers.supplyPulse = CONFIG.builds.supply.pulseMs;
    Game.baseBulletCount = 3;

    Game.spawnBullet();

    const bullets = Game.objectPools.bullets.active;
    assert.equal(bullets.filter((bullet) => bullet.isPrimary).length, 1);
    assert.ok(bullets.every((bullet) => bullet.buildDamageBonus === CONFIG.builds.supply.damageBonus));
    assert.ok(bullets.every((bullet) => Game.getDirectShotDamage('enemy', bullet) === 2));
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
        });
        assert.equal(events[0].shieldTime, 5);
        assert.equal(events[0].itemStillActive, false);

        assert.equal(Game.collectItem(item), false);
        assert.equal(events.length, 1);
    } finally {
        Game.onItemCollected = original;
    }
});

test('the primary supply damage bonus feeds a later bonus strike', () => {
    resetItems();
    Game.buildState.owned = ['supply_entry', 'hunter_entry'];
    Game.buildState.timers.supplyPulse = CONFIG.builds.supply.pulseMs;
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
    const directDamage = Game.getDirectShotDamage('enemy', primary);

    for (let shotId = 1; shotId <= CONFIG.builds.hunter.hits; shotId++) {
        Game.onDirectShotBatch({
            shotId,
            events: [{
                source: 'direct',
                targetType: 'enemy',
                entityId: enemy.entityId,
                baseDamage: directDamage,
                amount: directDamage,
            }],
        });
    }

    assert.equal(directDamage, 2);
    assert.equal(enemy.health, 96);
});
