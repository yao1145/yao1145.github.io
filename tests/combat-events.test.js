import assert from 'node:assert/strict';
import test from 'node:test';
import { Game } from '../js/core/game.js';
import { resetGameFixture } from './helpers/game-fixture.js';

test('reused pooled enemy receives a new identity', () => {
    resetGameFixture();
    const first = Game.getObject('enemies');
    first.entityId = Game.allocateEntityId();
    const oldId = first.entityId;
    Game.releaseObject('enemies', first);
    const reused = Game.getObject('enemies');
    reused.entityId = Game.allocateEntityId();
    assert.equal(reused, first);
    assert.notEqual(reused.entityId, oldId);
    assert.equal(Game.isActiveEntity('enemies', oldId), false);
});
