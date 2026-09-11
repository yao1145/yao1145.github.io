import assert from 'node:assert/strict';
import test from 'node:test';

import { Game } from '../js/core/game.js';
import { CONFIG } from '../js/core/config.js';
import { resetGameFixture } from './helpers/game-fixture.js';
import '../js/core/pools.js';
import '../js/systems/cards.js';
import '../js/systems/builds.js';
import '../js/systems/collisions.js';

function resetV24() {
    resetGameFixture();
    Game.player = { x: 0, y: 0, width: 20, height: 20, shotDelay: 300, shieldTime: 0 };
    Game.boss = { entityId: 99, shotDelay: 600, health: 100, maxHealth: 100 };
    Game.enemyShotRate = 0.2;
    Game.enemyBulletSpeed = 4;
    Game.updateUI = () => {};
    Game.createShockwave = () => {};
    Game.createExplosion = () => {};
    Game.gameOver = () => {};
}

function batch(shotId, entityId, targetType = 'enemy', baseDamage = 1) {
    return {
        shotId,
        events: [{ shotId, entityId, targetType, isPrimary: true, baseDamage, amount: baseDamage }],
    };
}

test('v2.4 thorns changes attack rate, not projectile speed, and rapid/supply stack player speed', () => {
    resetV24();
    Game.activeCard = 'thorns';
    assert.equal(Game.getEnemyBulletSpeed(), Game.enemyBulletSpeed);
    assert.equal(Game.getEnemyShotRate(), Game.enemyShotRate * CONFIG.cards.thornsEnemyShotMult);
    assert.equal(Game.getBossShotDelay(), Game.boss.shotDelay / CONFIG.cards.thornsEnemyShotMult);

    Game.buildState.owned = ['rapid_entry', 'supply_entry'];
    Game.buildState.timers.rapidWarmup = 1000;
    Game.buildState.timers.supplyPulse = 1000;
    Game.activeCard = null;
    assert.equal(Game.getPlayerShotDelay(), 300 / CONFIG.builds.rapid.warmupShotSpeedMult / CONFIG.builds.supply.pulseShotSpeedMult);
});

test('v2.4 card chip exposes a full rectangular label with accessible card name', () => {
    resetV24();
    const attrs = {};
    Game.cardIndicator = {
        style: { display: 'none' },
        textContent: '',
        title: '',
        setAttribute: (name, value) => { attrs[name] = value; },
        removeAttribute: (name) => { delete attrs[name]; },
    };
    Game.activeCard = 'thorns';
    Game.updateCardChipUI();
    assert.equal(Game.cardIndicator.textContent, '卡: 荆棘护甲');
    assert.equal(Game.cardIndicator.title, '当前效果卡：荆棘护甲');
    assert.equal(attrs['aria-label'], '当前效果卡：荆棘护甲');
});

test('v2.4 desperate uses 10D by default and 15D execute regardless of target health', () => {
    resetV24();
    Game.buildState.owned = ['desperate_entry', 'desperate_execute'];
    Game.lives = 1;
    Game.maxLives = 3;
    const target = { entityId: 1, health: 100, maxHealth: 100, x: 0, y: 0, width: 20, height: 20, _dead: false };
    Game.objectPools.enemies.active = [target];
    const multipliers = [];
    Game.triggerBonusStrike = (_hit, multiplier) => {
        multipliers.push(multiplier);
        return true;
    };
    for (let shotId = 1; shotId <= CONFIG.builds.desperate.hits; shotId++) {
        Game.onDirectShotBatch(batch(shotId, target.entityId, 'enemy', 2));
    }
    assert.deepEqual(multipliers, [CONFIG.builds.desperate.executeMult]);
});

test('v2.4 hunter uses 20D, 40D execute, and 5000ms lock memory', () => {
    resetV24();
    Game.buildState.owned = ['hunter_entry', 'hunter_lock'];
    const target = { entityId: 1, health: 100, maxHealth: 100, x: 0, y: 0, width: 20, height: 20, _dead: false };
    Game.objectPools.enemies.active = [target];
    const multipliers = [];
    Game.triggerBonusStrike = (_hit, multiplier) => {
        multipliers.push(multiplier);
        return true;
    };
    for (let shotId = 1; shotId <= CONFIG.builds.hunter.hits; shotId++) {
        Game.onDirectShotBatch(batch(shotId, target.entityId, 'enemy', 2));
    }
    assert.deepEqual(multipliers, [CONFIG.builds.hunter.strikeMult]);
    Game.updateBuildEffects(CONFIG.builds.hunter.lockMemoryMs - 1);
    assert.equal(Game.buildState.locks.hunterTargetId, target.entityId);
    Game.updateBuildEffects(1);
    assert.equal(Game.buildState.locks.hunterTargetId, null);

    Game.buildState.owned.push('hunter_execute');
    target.health = 20;
    for (let shotId = 11; shotId <= 10 + CONFIG.builds.hunter.hits; shotId++) {
        Game.onDirectShotBatch(batch(shotId, target.entityId, 'enemy', 2));
    }
    assert.deepEqual(multipliers, [CONFIG.builds.hunter.strikeMult, CONFIG.builds.hunter.executeMult]);
});

test('v2.4 fortress charges one layer per interval, totals six blocks, and resets cleanly', () => {
    resetV24();
    Game.buildState.owned = ['fortress_entry'];

    Game.updateBuildEffects(CONFIG.builds.fortress.chargeMs);
    assert.deepEqual([Game.buildState.locks.fortressBarrierLayers, Game.buildState.locks.fortressBarrierRemaining], [1, 1]);
    Game.updateBuildEffects(CONFIG.builds.fortress.chargeMs);
    assert.deepEqual([Game.buildState.locks.fortressBarrierLayers, Game.buildState.locks.fortressBarrierRemaining], [2, 3]);
    Game.updateBuildEffects(CONFIG.builds.fortress.chargeMs);
    assert.deepEqual([Game.buildState.locks.fortressBarrierLayers, Game.buildState.locks.fortressBarrierRemaining], [3, 6]);
    assert.equal(Game.getBuildHudStates()[0].value, '3层 6/6');
    Game.updateBuildEffects(CONFIG.builds.fortress.chargeMs * 2);
    assert.deepEqual([Game.buildState.locks.fortressBarrierLayers, Game.buildState.locks.fortressBarrierRemaining], [3, 6]);

    for (let index = 1; index <= 6; index++) {
        const bullet = Game.getObject('enemyBullets');
        Object.assign(bullet, { x: 1, y: 1, width: 2, height: 2 });
        assert.equal(Game.resolveEnemyBulletHit(bullet), 'barrier');
        assert.equal(Game.buildState.metrics.fortressBlocks, index);
        assert.equal(Game.buildState.locks.fortressBarrierRemaining, 6 - index);
    }
    assert.equal(Game.buildState.locks.fortressBarrierLayers, 0);
    assert.equal(Game.buildState.locks.fortressBarrier, false);

    Game.updateBuildEffects(CONFIG.builds.fortress.chargeMs);
    Game.buildState.owned = [];
    Game.updateBuildEffects(1);
    assert.deepEqual([Game.buildState.locks.fortressBarrierLayers, Game.buildState.locks.fortressBarrierRemaining], [0, 0]);
});

test('v2.4 fortress adds a new layer without restoring spent barrier capacity', () => {
    resetV24();
    Game.buildState.owned = ['fortress_entry'];

    Game.updateBuildEffects(CONFIG.builds.fortress.chargeMs * 2);
    assert.deepEqual(
        [Game.buildState.locks.fortressBarrierLayers, Game.buildState.locks.fortressBarrierRemaining],
        [2, 3],
    );

    const bullet = Game.getObject('enemyBullets');
    Object.assign(bullet, { x: 1, y: 1, width: 2, height: 2 });
    assert.equal(Game.resolveEnemyBulletHit(bullet), 'barrier');
    assert.equal(Game.buildState.locks.fortressBarrierRemaining, 2);

    Game.updateBuildEffects(CONFIG.builds.fortress.chargeMs);
    assert.deepEqual(
        [Game.buildState.locks.fortressBarrierLayers, Game.buildState.locks.fortressBarrierRemaining],
        [3, 5],
    );
    assert.equal(Game.getBuildHudStates()[0].value, '3层 5/6');
});
