import assert from 'node:assert/strict';
import test from 'node:test';
import { Game } from '../js/core/game.js';
import { resetGameFixture } from './helpers/game-fixture.js';
import '../js/core/grid.js';
import '../js/systems/collisions.js';
import '../js/systems/builds.js';

test('spatial grid queries can select one pool type without returning other types', () => {
    Game.spatialGrid.clear();
    const enemy = { x: 10, y: 10, width: 20, height: 20 };
    const item = { x: 12, y: 12, width: 20, height: 20 };
    const enemyBullet = { x: 14, y: 14, width: 20, height: 20 };

    Game.spatialGrid.insert(enemy, 'enemies');
    Game.spatialGrid.insert(item, 'items');
    Game.spatialGrid.insert(enemyBullet, 'enemyBullets');

    assert.deepEqual(Game.spatialGrid.getNearby(enemy, 'enemies').map((entry) => entry.obj), [enemy]);
    assert.deepEqual(Game.spatialGrid.getNearby(enemy, 'items').map((entry) => entry.obj), [item]);
    assert.deepEqual(Game.spatialGrid.getNearby(enemy, 'enemyBullets').map((entry) => entry.obj), [enemyBullet]);
    assert.equal(Game.spatialGrid.getNearby(enemy).length, 3);
});

test('radius queries can select enemies directly', () => {
    Game.spatialGrid.clear();
    const enemy = { x: 10, y: 10, width: 20, height: 20 };
    const item = { x: 110, y: 110, width: 20, height: 20 };

    Game.spatialGrid.insert(enemy, 'enemies');
    Game.spatialGrid.insert(item, 'items');

    assert.deepEqual(
        Game.spatialGrid.getWithinRadius(0, 0, 200, 'enemies').map((entry) => entry.obj),
        [enemy],
    );
});

test('collision pass uses type-specific spatial queries', () => {
    resetGameFixture();
    Game.player = { x: 0, y: 0, width: 20, height: 20 };
    Game.isBossStage = false;

    const bullet = Game.getObject('bullets');
    Object.assign(bullet, { x: 500, y: 500, width: 10, height: 10 });
    const enemy = Game.getObject('enemies');
    Object.assign(enemy, { x: 700, y: 500, width: 20, height: 20 });
    const enemyBullet = Game.getObject('enemyBullets');
    Object.assign(enemyBullet, { x: 900, y: 500, width: 10, height: 10 });
    const item = Game.getObject('items');
    Object.assign(item, { x: 1100, y: 500, width: 20, height: 20 });

    const realGrid = Game.spatialGrid;
    const queries = [];
    Game.spatialGrid = {
        clear: () => realGrid.clear(),
        insert: (obj, poolType) => realGrid.insert(obj, poolType),
        getNearby: (obj, poolType) => {
            queries.push(poolType);
            return realGrid.getNearby(obj, poolType);
        },
    };

    try {
        Game.checkCollisions();
    } finally {
        Game.spatialGrid = realGrid;
    }

    assert.deepEqual(queries, ['enemies', 'enemyBullets', 'enemies', 'items']);
});

test('chain explosion asks the grid for enemies directly', () => {
    resetGameFixture();
    Game.activeCard = 'chain';
    Game.emitBuildFeedback = () => {};
    Game.createExplosion = () => {};
    Game.createShockwave = () => {};

    let query;
    const realGrid = Game.spatialGrid;
    Game.spatialGrid = {
        getWithinRadius: (...args) => {
            query = args;
            return [];
        },
    };

    try {
        assert.equal(Game.createDamageExplosion({ x: 0, y: 0, source: 'card' }), true);
    } finally {
        Game.spatialGrid = realGrid;
    }

    assert.deepEqual(query, [0, 0, 200, 'enemies']);
});
