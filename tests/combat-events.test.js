import assert from 'node:assert/strict';
import test from 'node:test';
import { Game } from '../js/core/game.js';
import { CONFIG } from '../js/core/config.js';
import { resetGameFixture } from './helpers/game-fixture.js';
import '../js/core/grid.js';
import '../js/systems/cards.js';
import '../js/systems/collisions.js';
import '../js/systems/builds.js';
import '../js/entities/player.js';

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

// --- Task 5: unified direct-shot damage pipeline ----------------------------

function resetCombat() {
    resetGameFixture();
    Game.player = { x: 0, y: 0, width: 30, height: 30, speed: 7, lastShot: 0, shotDelay: 300, shieldTime: 0 };
    Game.updateUI = () => {};
    Game.enableControlArea = () => {};
    Game.updateShieldUI = () => {};
    Game.updateAttackUI = () => {};
    Game.bulletDamage = 1;
    Game.baseBulletCount = 1;
    Game.score = 0;
}

function makeEnemy(health = 1, x = 0, y = 0) {
    const enemy = Game.getObject('enemies');
    enemy.entityId = Game.allocateEntityId();
    enemy.x = x;
    enemy.y = y;
    enemy.width = 30;
    enemy.height = 30;
    enemy.type = 0;
    enemy.health = health;
    enemy.maxHealth = health;
    enemy.color = '#f00';
    enemy._dead = false;
    return enemy;
}

function makeBullet(shotId = 1, x = 0, y = 0) {
    const bullet = Game.getObject('bullets');
    bullet.shotId = shotId;
    bullet.isPrimary = true;
    bullet.pierceRemaining = 0;
    bullet.hitEntityIds = [];
    bullet.buildDamageBonus = 0;
    bullet.x = x;
    bullet.y = y;
    bullet.width = 4;
    bullet.height = 12;
    bullet.color = '#ff0';
    bullet.speed = 8;
    return bullet;
}

test('roundCombatDamage keeps zero at zero and steps positives by 0.5', () => {
    resetCombat();
    assert.equal(Game.roundCombatDamage(0), 0);
    assert.equal(Game.roundCombatDamage(-0.4), 0);
    assert.equal(Game.roundCombatDamage(0.26), 0.5);
    assert.equal(Game.roundCombatDamage(0.75), 1);
    assert.equal(Game.roundCombatDamage(1.25), 1.5);
    assert.equal(Game.roundCombatDamage(2), 2);
});

test('spawnBullet tags one shot with a shared shotId and a single primary', () => {
    resetCombat();
    Game.baseBulletCount = 3;
    Game.player.x = 50;
    Game.player.y = 100;
    Game.spawnBullet();

    const bullets = Game.objectPools.bullets.active;
    assert.equal(bullets.length, 3);
    assert.ok(bullets.every((b) => b.shotId === bullets[0].shotId && b.shotId > 0));
    assert.equal(bullets.filter((b) => b.isPrimary).length, 1);
    assert.equal(bullets[1].isPrimary, true);
    assert.deepEqual(bullets[0].hitEntityIds, []);
    assert.equal(bullets[0].pierceRemaining, 0);
    assert.equal(bullets[0].buildDamageBonus, 0);
});

test('same-shot multi-bullet hits flush as one batch counted once', () => {
    resetCombat();
    const batches = [];
    Game.onDirectShotBatch = (batch) => batches.push(batch);
    Game.queueDirectHit({ shotId: 7, targetType: 'enemy', entityId: 101, isPrimary: true, amount: 1, baseDamage: 1, x: 10, y: 10 });
    Game.queueDirectHit({ shotId: 7, targetType: 'enemy', entityId: 102, isPrimary: false, amount: 1, baseDamage: 1, x: 20, y: 20 });
    Game.queueDirectHit({ shotId: 8, targetType: 'boss', entityId: 501, isPrimary: true, amount: 3, baseDamage: 3, x: 30, y: 30 });
    Game.flushDirectShotBatches();

    assert.equal(batches.length, 2);
    assert.equal(batches[0].shotId, 7);
    assert.equal(batches[0].events.length, 2);
    assert.equal(batches[1].shotId, 8);
    assert.equal(batches[1].events.length, 1);

    // The queue is drained: a second flush delivers nothing new.
    Game.flushDirectShotBatches();
    assert.equal(batches.length, 2);
});

test('only the first lethal context settles a death: one kill, one score, one broadcast', () => {
    resetCombat();
    const kills = [];
    Game.onEnemyKilled = (event) => kills.push(event);
    const enemy = makeEnemy(0.5, 0, 0);
    const bullet = makeBullet(3, 5, 5);

    const event = Game.damageTarget({ bullet, target: enemy, targetType: 'enemy' });
    assert.ok(event);
    assert.equal(event.source, 'direct');
    assert.equal(event.amount, 1);
    assert.ok(enemy.health <= 0);
    assert.equal(Game.score, 10); // type-0 score settled once
    assert.equal(kills.length, 1);
    assert.equal(kills[0].entityId, event.entityId);
    assert.equal(kills[0].source, 'direct');

    // A second lethal context (another bullet hitting the same corpse) is inert.
    const bullet2 = makeBullet(4, 5, 5);
    assert.equal(Game.damageTarget({ bullet: bullet2, target: enemy, targetType: 'enemy' }), null);
    assert.equal(Game.killEnemy(enemy, { source: 'direct' }), false);
    assert.equal(Game.score, 10);
    assert.equal(kills.length, 1);
});

test('damageTarget refuses pooled targets that left the active pool', () => {
    resetCombat();
    const enemy = makeEnemy(5, 0, 0);
    const bullet = makeBullet(5, 5, 5);
    const oldId = enemy.entityId;

    Game.releaseObject('enemies', enemy);
    assert.equal(Game.isActiveEntity('enemies', oldId), false);
    assert.equal(Game.damageTarget({ bullet, target: enemy, targetType: 'enemy' }), null);
    assert.equal(enemy.health, 5);
    // The bullet is not consumed by a refused hit.
    assert.equal(Game.objectPools.bullets.active.includes(bullet), true);
});

test('damageTarget refuses a boss reference once the boss is gone', () => {
    resetCombat();
    Game.boss = makeEnemy(10, 0, 0);
    Game.boss.type = 0;
    const boss = Game.boss;
    assert.ok(Game.damageTarget({ bullet: makeBullet(6, 5, 5), target: boss, targetType: 'boss' }));
    assert.equal(boss.health, 9);

    Game.boss = null;
    assert.equal(Game.damageTarget({ bullet: makeBullet(7, 5, 5), target: boss, targetType: 'boss' }), null);
    assert.equal(boss.health, 9);
});

test('a zero-damage direct hit lands no damage and no event', () => {
    resetCombat();
    const realGetDirectShotDamage = Game.getDirectShotDamage;
    Game.getDirectShotDamage = () => 0;
    try {
        const enemy = makeEnemy(5, 0, 0);
        const bullet = makeBullet(8, 5, 5);
        assert.equal(Game.damageTarget({ bullet, target: enemy, targetType: 'enemy' }), null);
        assert.equal(enemy.health, 5);
    } finally {
        Game.getDirectShotDamage = realGetDirectShotDamage;
    }
});

test('checkCollisions routes a bullet kill through the unified pipeline once', () => {
    resetCombat();
    const kills = [];
    const batches = [];
    Game.onEnemyKilled = (kill) => kills.push(kill);
    Game.onDirectShotBatch = (batch) => batches.push(batch);
    const enemy = makeEnemy(1, 80, 80);
    const bullet = makeBullet(11, 90, 90);

    Game.checkCollisions();

    assert.equal(Game.score, 10);
    assert.equal(kills.length, 1);
    assert.equal(kills[0].entityId, enemy.entityId);
    assert.equal(batches.length, 1);
    assert.equal(batches[0].events.length, 1);
    assert.equal(batches[0].events[0].amount, 1);
    assert.equal(Game.objectPools.bullets.active.length, 0);
    assert.equal(Game.objectPools.enemies.active.length, 0);
});
