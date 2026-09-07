import assert from 'node:assert/strict';
import test from 'node:test';
import { Game } from '../js/core/game.js';
import { CONFIG } from '../js/core/config.js';
import { resetGameFixture } from './helpers/game-fixture.js';

test('resetGameFixture restores shared run state without resetting entity ids', () => {
    Object.assign(Game, {
        isRunning: true,
        isGameOver: true,
        isMenu: false,
        lastTime: 123,
        accumulator: 456,
        gameTime: 789,
        score: 1000,
        highScore: 2000,
        highCrowns: 30,
        lastScore: 900,
        totalCrowns: 40,
        lives: 1,
        baseBulletCount: 3,
        autoShieldTimer: 500,
        bulletDamage: 4,
        level: 8,
        crowns: 7,
        enemySpawnRate: 0.8,
        enemySpeed: 9,
        enemyShotRate: 0.7,
        enemyBulletSpeed: 12,
        itemSpawnRate: 0.9,
        player: { x: 1 },
        keys: { ArrowLeft: true },
        touch: { isTouching: true, startX: 1, startY: 2, currentX: 3, currentY: 4 },
        isBossStage: true,
        boss: { entityId: 1 },
        bossSpawnThreshold: 9999,
        bossSpawnGap: 8888,
        bossAppearCount: 7,
        isDamageBoost: true,
        damageBoostTime: 600,
        activeCard: 'glass',
        difficulty: 'easy',
        cardRegenTimer: 1000,
        isCardSelectionOpen: true,
        lastUIUpdateTime: 1234,
        cardPickCount: { glass: 3 },
    });
    const nextEntityId = Game.allocateEntityId();

    resetGameFixture();

    assert.equal(Game.isRunning, false);
    assert.equal(Game.isGameOver, false);
    assert.equal(Game.isMenu, true);
    assert.equal(Game.lastTime, 0);
    assert.equal(Game.accumulator, 0);
    assert.equal(Game.gameTime, 0);
    assert.equal(Game.score, 0);
    assert.equal(Game.highScore, 0);
    assert.equal(Game.highCrowns, 0);
    assert.equal(Game.lastScore, 0);
    assert.equal(Game.totalCrowns, 0);
    assert.equal(Game.lives, 3);
    assert.equal(Game.baseBulletCount, 1);
    assert.equal(Game.autoShieldTimer, 0);
    assert.equal(Game.bulletDamage, 1);
    assert.equal(Game.level, 1);
    assert.equal(Game.crowns, 0);
    assert.equal(Game.enemySpawnRate, CONFIG.enemySpawnRate);
    assert.equal(Game.enemySpeed, CONFIG.enemySpeed);
    assert.equal(Game.enemyShotRate, CONFIG.enemyShotRate);
    assert.equal(Game.enemyBulletSpeed, CONFIG.enemyBulletSpeed);
    assert.equal(Game.itemSpawnRate, CONFIG.itemSpawnRate);
    assert.equal(Game.player, null);
    assert.deepEqual(Game.keys, {});
    assert.deepEqual(Game.touch, {
        isTouching: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
    });
    assert.equal(Game.isBossStage, false);
    assert.equal(Game.boss, null);
    assert.equal(Game.bossSpawnThreshold, CONFIG.bossSpawnThreshold);
    assert.equal(Game.bossSpawnGap, CONFIG.bossSpawnThreshold);
    assert.equal(Game.bossAppearCount, 0);
    assert.equal(Game.isDamageBoost, false);
    assert.equal(Game.damageBoostTime, 0);
    assert.equal(Game.activeCard, null);
    assert.equal(Game.difficulty, 'hard');
    assert.equal(Game.cardRegenTimer, 0);
    assert.equal(Game.isCardSelectionOpen, false);
    assert.equal(Game.lastUIUpdateTime, 0);
    assert.deepEqual(Game.cardPickCount, {});
    assert.equal(Game.nextEntityId, nextEntityId);
});

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
