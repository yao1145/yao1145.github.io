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
    Game.getSupplyPrimaryDamageBonus = () => 0;
    Game.consumeRapidBatchEffect = () => ({
        rapidBatchBoosted: false,
        rapidDamageBonus: 0,
        pierceRemaining: 0,
    });
}

test('a one-bullet batch makes its only bullet the primary and combines both bonuses', () => {
    resetPlayerFixture();
    Game.getSupplyPrimaryDamageBonus = () => 0.5;
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
    assert.equal(bullet.rapidDamageBonus + bullet.supplyDamageBonus, 1.5);
    assert.equal(bullet.pierceRemaining, 1);
});

test('a three-bullet batch shares one shot id and assigns rapid/supply effects only to its actual primary', () => {
    resetPlayerFixture();
    Game.baseBulletCount = 3;
    Game.getSupplyPrimaryDamageBonus = () => 0.5;
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
    assert.equal(primary.supplyDamageBonus, 0.5);
    assert.ok(bullets.filter((bullet) => !bullet.isPrimary).every((bullet) => {
        return bullet.rapidDamageBonus === 0
            && bullet.pierceRemaining === 0
            && bullet.supplyDamageBonus === 0;
    }));
});

test('a missing planned primary promotes the first generated bullet before consuming batch effects', () => {
    resetPlayerFixture();
    Game.baseBulletCount = 3;
    Game.getSupplyPrimaryDamageBonus = () => 0.5;

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
    assert.equal(bullets[0].supplyDamageBonus, 0.5);
    assert.equal(bullets[1].isPrimary, false);
    assert.equal(bullets[1].supplyDamageBonus, 0);
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
