import assert from 'node:assert/strict';
import test from 'node:test';

import { Game } from '../js/core/game.js';
import { resetGameFixture } from './helpers/game-fixture.js';
import '../js/core/pools.js';
import '../js/systems/cards.js';
import '../js/systems/builds.js';
import '../js/entities/items.js';

test('natural supply item is continuously magnet-moved before collection attribution', () => {
    resetGameFixture();
    Game.buildState.owned = ['supply_entry', 'supply_magnet'];
    Game.height = 600;
    Game.player = { x: 100, y: 100, width: 20, height: 20 };
    Game.createExplosion = () => {};
    Game.updateAttackUI = () => {};
    Game.updateUI = () => {};

    const item = Game.getObject('items');
    Object.assign(item, {
        x: 250,
        y: 100,
        width: 20,
        height: 20,
        speed: 0,
        type: 1,
        color: '#f90',
        spawnSource: 'natural',
        collectedByMagnet: false,
    });
    const beforeX = item.x;

    Game.updateItems(16);

    assert.ok(item.x < beforeX, 'magnet should move the item toward the player');
    assert.ok(item.x > Game.player.x + Game.player.width, 'attraction should remain continuous, not instantly collect');
    assert.equal(item.collectedByMagnet, true);
    assert.equal(Game.objectPools.items.active.includes(item), true);

    Game.collectItem(item);

    assert.equal(Game.buildState.metrics.supplyNaturalPickups, 1);
    assert.equal(Game.buildState.metrics.supplyMagnetPickups, 1);
});
