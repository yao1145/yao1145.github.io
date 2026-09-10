import assert from 'node:assert/strict';
import test from 'node:test';

import { Game } from '../js/core/game.js';
import { CONFIG } from '../js/core/config.js';
import { resetGameFixture } from './helpers/game-fixture.js';
import '../js/core/pools.js';
import '../js/systems/builds.js';
import '../js/entities/player.js';

function resetPlayerFixture() {
    resetGameFixture();
    Game.width = 500;
    Game.height = 500;
    Game.player = {
        x: 200,
        y: 400,
        width: CONFIG.player.width,
        height: CONFIG.player.height,
        speed: CONFIG.player.speed,
        lastShot: 0,
        shotDelay: CONFIG.player.shotDelay,
        shieldTime: 0,
    };
    Game.baseBulletCount = 1;
    Game.getBulletCount = () => Game.baseBulletCount;
    Game.getBulletSpeedMult = () => 1;
    Game.getSupplyPulseDamageBonus = () => 0;
    Game.consumeRapidBatchEffect = () => ({
        rapidBatchBoosted: false,
        rapidDamageBonus: 0,
        pierceRemaining: 0,
    });
}

test('a one-bullet batch makes its only bullet the primary and combines both bonuses', () => {
    resetPlayerFixture();
    Game.getSupplyPulseDamageBonus = () => CONFIG.builds.supply.pulseDamageBonus;
    Game.consumeRapidBatchEffect = () => ({
        rapidBatchBoosted: true,
        rapidDamageBonus: 1,
        pierceRemaining: 1,
    });

    Game.spawnBullet();

    const [bullet] = Game.objectPools.bullets.active;
    assert.equal(Game.objectPools.bullets.active.length, 1);
    assert.equal(bullet.isPrimary, true);
    assert.equal(bullet.rapidBatchBoosted, true);
    assert.equal(bullet.rapidDamageBonus + bullet.supplyDamageBonus, 2);
    assert.equal(bullet.pierceRemaining, 1);
});

test('a three-bullet batch shares one shot id, keeps rapid on its actual primary, and spreads the supply pulse bonus over the whole batch', () => {
    resetPlayerFixture();
    Game.baseBulletCount = 3;
    Game.getSupplyPulseDamageBonus = () => CONFIG.builds.supply.pulseDamageBonus;
    let consumeCalls = 0;
    Game.consumeRapidBatchEffect = () => {
        consumeCalls += 1;
        return {
            rapidBatchBoosted: true,
            rapidDamageBonus: 1,
            pierceRemaining: 2,
        };
    };

    Game.spawnBullet();

    const bullets = Game.objectPools.bullets.active;
    assert.equal(bullets.length, 3);
    assert.equal(consumeCalls, 1);
    assert.equal(new Set(bullets.map((bullet) => bullet.shotId)).size, 1);
    assert.equal(bullets.filter((bullet) => bullet.isPrimary).length, 1);
    assert.ok(bullets.every((bullet) => bullet.rapidBatchBoosted === true));

    const primary = bullets.find((bullet) => bullet.isPrimary);
    assert.equal(primary.rapidDamageBonus, 1);
    assert.equal(primary.pierceRemaining, 2);
    // The supply pulse bonus is a flat per-bullet bonus: the whole batch gets
    // it, primary included.
    assert.ok(bullets.every((bullet) => bullet.supplyDamageBonus === CONFIG.builds.supply.pulseDamageBonus));
    assert.ok(bullets.filter((bullet) => !bullet.isPrimary).every((bullet) => {
        return bullet.rapidDamageBonus === 0
            && bullet.pierceRemaining === 0;
    }));
});

test('a missing planned primary promotes the first generated bullet before consuming batch effects', () => {
    resetPlayerFixture();
    Game.baseBulletCount = 3;
    Game.getSupplyPulseDamageBonus = () => CONFIG.builds.supply.pulseDamageBonus;

    const originalGetObject = Game.getObject;
    let bulletCalls = 0;
    Game.getObject = (poolType) => {
        if (poolType !== 'bullets') return originalGetObject.call(Game, poolType);
        bulletCalls += 1;
        if (bulletCalls === 2) return null;
        const bullet = {};
        Game.objectPools.bullets.active.push(bullet);
        return bullet;
    };
    const seenAtConsume = [];
    Game.consumeRapidBatchEffect = () => {
        seenAtConsume.push(Game.objectPools.bullets.active.length);
        return {
            rapidBatchBoosted: true,
            rapidDamageBonus: 1,
            pierceRemaining: 1,
        };
    };

    try {
        Game.spawnBullet();
    } finally {
        Game.getObject = originalGetObject;
    }

    const bullets = Game.objectPools.bullets.active;
    assert.equal(bullets.length, 2);
    assert.equal(seenAtConsume.length, 1);
    assert.equal(seenAtConsume[0], 2);
    assert.equal(bullets.filter((bullet) => bullet.isPrimary).length, 1);
    assert.equal(bullets[0].isPrimary, true);
    assert.equal(bullets[0].rapidDamageBonus, 1);
    assert.equal(bullets[0].pierceRemaining, 1);
    assert.equal(bullets[0].supplyDamageBonus, CONFIG.builds.supply.pulseDamageBonus);
    assert.equal(bullets[1].isPrimary, false);
    assert.equal(bullets[1].supplyDamageBonus, CONFIG.builds.supply.pulseDamageBonus);
});

test('an empty batch does not consume rapid effects or advance rapid sequence', () => {
    resetPlayerFixture();
    Game.baseBulletCount = 3;
    let consumeCalls = 0;
    Game.consumeRapidBatchEffect = () => {
        consumeCalls += 1;
        return { rapidBatchBoosted: true, rapidDamageBonus: 1, pierceRemaining: 1 };
    };
    const originalGetObject = Game.getObject;
    Game.getObject = (poolType) => poolType === 'bullets' ? null : originalGetObject.call(Game, poolType);

    try {
        Game.spawnBullet();
    } finally {
        Game.getObject = originalGetObject;
    }

    assert.equal(Game.objectPools.bullets.active.length, 0);
    assert.equal(consumeCalls, 0);
});

test('every bullet of consecutive batches carries the supply pulse bonus while the pulse runs', () => {
    resetPlayerFixture();
    Game.baseBulletCount = 3;
    Game.getSupplyPulseDamageBonus = () => CONFIG.builds.supply.pulseDamageBonus;

    Game.spawnBullet();
    Game.spawnBullet();

    const bullets = Game.objectPools.bullets.active;
    assert.equal(bullets.length, 6);
    assert.equal(new Set(bullets.map((bullet) => bullet.shotId)).size, 2);
    assert.ok(bullets.every((bullet) => bullet.supplyDamageBonus === CONFIG.builds.supply.pulseDamageBonus));
});

test('each batch reads the pulse state on its own, so an expired pulse adds nothing', () => {
    resetPlayerFixture();
    Game.baseBulletCount = 3;
    let reads = 0;
    // The pulse expires between the two batches: one getter read per batch.
    Game.getSupplyPulseDamageBonus = () => (reads++ === 0 ? CONFIG.builds.supply.pulseDamageBonus : 0);

    Game.spawnBullet();
    Game.spawnBullet();

    const bullets = Game.objectPools.bullets.active;
    assert.equal(bullets.length, 6);
    assert.ok(bullets.slice(0, 3).every((bullet) => bullet.supplyDamageBonus === CONFIG.builds.supply.pulseDamageBonus));
    assert.ok(bullets.slice(3).every((bullet) => bullet.supplyDamageBonus === 0));
});
