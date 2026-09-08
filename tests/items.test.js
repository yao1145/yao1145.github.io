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

test('supply bonus is assigned only to the designated primary bullet and feeds final damage', () => {
    resetItems();
    Game.buildState.owned = ['supply_entry'];
    Game.buildState.timers.supplyPulse = CONFIG.builds.supply.pulseMs;
    Game.baseBulletCount = 3;

    Game.spawnBullet();

    const bullets = Game.objectPools.bullets.active;
    assert.equal(bullets.filter((bullet) => bullet.isPrimary).length, 1);
    assert.equal(bullets.find((bullet) => bullet.isPrimary).buildDamageBonus, CONFIG.builds.supply.primaryDamageBonus);
    assert.ok(bullets.filter((bullet) => !bullet.isPrimary).every((bullet) => bullet.buildDamageBonus === 0));
    assert.equal(Game.getDirectShotDamage('enemy', bullets.find((bullet) => bullet.isPrimary)), 1.5);
});

test('item collection broadcasts exactly one event after applying the item effect', () => {
    resetItems();
    Game.buildState.owned = ['supply_entry'];
    const events = [];
    const original = Game.onItemCollected;
    Game.onItemCollected = (event) => {
        events.push(event);
        return original.call(Game, event);
    };

    const item = makeItem(2);
    assert.equal(Game.collectItem(item), true);

    assert.equal(events.length, 1);
    assert.deepEqual(events[0], {
        type: 2,
        spawnSource: 'natural',
        wasFull: false,
        healingAllowed: true,
    });
});
