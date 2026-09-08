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

// Module-import-time hook implementations: tests that spy on the event hooks
// restore these in resetCombat so later tests exercise the real mechanics.
const realOnDirectShotBatch = Game.onDirectShotBatch;
const realOnEnemyKilled = Game.onEnemyKilled;

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
    Game.onDirectShotBatch = realOnDirectShotBatch;
    Game.onEnemyKilled = realOnEnemyKilled;
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

// --- Task 6: rapid heat-up + hunter mark combat loops -----------------------

function applyBuild(...ids) {
    for (const id of ids) {
        assert.equal(Game.applyBuildChoice(id), true, `apply ${id}`);
    }
}

function makeHit(targetType, entityId, baseDamage = 1) {
    return { source: 'direct', targetType, entityId, amount: baseDamage, baseDamage, isPrimary: true, x: 0, y: 0 };
}

function batch(shotId, targetType, entityId, baseDamage = 1, extraEvents = []) {
    const events = [makeHit(targetType, entityId, baseDamage), ...extraEvents];
    return { shotId, events };
}

function directKill(shotId, type = 0) {
    return { source: 'direct', shotId, entityId: 9000 + shotId, type, x: 0, y: 0 };
}

test('rapid: 12 landed shots start the 3s heat-up, one count per shot', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('rapid_entry');
    const enemy = makeEnemy(100, 0, 0);

    for (let i = 1; i <= 11; i++) Game.onDirectShotBatch(batch(i, 'enemy', enemy.entityId));
    assert.equal(Game.buildState.counters.rapidHits, 11);
    assert.equal(Game.buildState.timers.rapidWarmup, 0);

    Game.onDirectShotBatch(batch(12, 'enemy', enemy.entityId));
    assert.equal(Game.buildState.timers.rapidWarmup, 3000);
    assert.equal(Game.buildState.counters.rapidHits, 0);

    // Heated shots never accumulate the next round.
    Game.onDirectShotBatch(batch(13, 'enemy', enemy.entityId));
    assert.equal(Game.buildState.counters.rapidHits, 0);
    assert.equal(Game.buildState.timers.rapidWarmup, 3000);
});

test('rapid: idle progress decays after 1.5s without a landed shot', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('rapid_entry');
    const enemy = makeEnemy(100, 0, 0);

    for (let i = 1; i <= 5; i++) {
        Game.gameTime = i;
        Game.onDirectShotBatch(batch(i, 'enemy', enemy.entityId));
    }
    assert.equal(Game.buildState.counters.rapidHits, 5);

    // 2s idle (decay check runs in updateBuildEffects against gameTime).
    Game.gameTime = 5 + 2000;
    Game.updateBuildEffects(16);
    assert.equal(Game.buildState.counters.rapidHits, 0);
});

test('rapid: a finished heat-up keeps 4 progress with reignite, none without', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('rapid_entry');
    const enemy = makeEnemy(100, 0, 0);
    for (let i = 1; i <= 12; i++) Game.onDirectShotBatch(batch(i, 'enemy', enemy.entityId));
    Game.updateBuildEffects(3000);
    assert.equal(Game.buildState.timers.rapidWarmup, 0);
    assert.equal(Game.buildState.counters.rapidHits, 0);

    Game.resetBuildState();
    applyBuild('rapid_entry', 'rapid_reignite');
    for (let i = 1; i <= 12; i++) Game.onDirectShotBatch(batch(i, 'enemy', enemy.entityId));
    Game.updateBuildEffects(3000);
    assert.equal(Game.buildState.timers.rapidWarmup, 0);
    assert.equal(Game.buildState.counters.rapidHits, 4);
});

test('rapid: every third shot during heat-up pierces, wide pierces twice', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('rapid_entry', 'rapid_wide');
    Game.buildState.timers.rapidWarmup = 3000;

    assert.equal(Game.getPrimaryPierceForShot(1), 0);
    assert.equal(Game.getPrimaryPierceForShot(2), 0);
    assert.equal(Game.getPrimaryPierceForShot(3), 2);
    assert.equal(Game.getPrimaryPierceForShot(4), 0);
    assert.equal(Game.getPrimaryPierceForShot(5), 0);
    assert.equal(Game.getPrimaryPierceForShot(6), 2);
    assert.equal(Game.buildState.counters.rapidHeatupShots, 6);

    // Outside the heat-up nothing pierces and no ordinal is consumed.
    Game.buildState.timers.rapidWarmup = 0;
    assert.equal(Game.getPrimaryPierceForShot(7), 0);
    assert.equal(Game.buildState.counters.rapidHeatupShots, 6);
});

test('rapid: direct kills extend the heat-up 300ms each, capped at 1.5s per round', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('rapid_entry');
    Game.buildState.timers.rapidWarmup = 3000;
    Game.onEnemyKilled(directKill(1));
    assert.equal(Game.buildState.timers.rapidWarmup, 3000); // capstone missing

    applyBuild('rapid_reignite', 'rapid_capstone');
    Game.onEnemyKilled(directKill(2));
    Game.onEnemyKilled(directKill(3));
    Game.onEnemyKilled(directKill(4));
    Game.onEnemyKilled(directKill(5));
    Game.onEnemyKilled(directKill(6));
    assert.equal(Game.buildState.timers.rapidWarmup, 4500); // 5 x 300ms extension
    assert.equal(Game.buildState.counters.rapidExtendedMs, 1500);

    Game.onEnemyKilled(directKill(7)); // cap reached
    assert.equal(Game.buildState.timers.rapidWarmup, 4500);

    // Non-direct kills never extend.
    Game.onEnemyKilled({ source: 'explosion', shotId: 8, entityId: 8, type: 0, x: 0, y: 0 });
    assert.equal(Game.buildState.timers.rapidWarmup, 4500);

    // The extension allowance resets when the heat-up ends.
    Game.updateBuildEffects(4500);
    assert.equal(Game.buildState.timers.rapidWarmup, 0);
    assert.equal(Game.buildState.counters.rapidExtendedMs, 0);
    assert.equal(Game.buildState.counters.rapidHits, 4); // reignite kept progress
});

test('hunter: 10 same-target hits strike 2D and reset; strikes do not re-count', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('hunter_entry');
    const enemy = makeEnemy(100, 0, 0);

    for (let i = 1; i <= 9; i++) Game.onDirectShotBatch(batch(i, 'enemy', enemy.entityId));
    assert.equal(Game.buildState.locks.hunterHits, 9);

    Game.onDirectShotBatch(batch(10, 'enemy', enemy.entityId));
    assert.equal(Game.buildState.locks.hunterHits, 0);
    assert.equal(enemy.health, 98); // 2D bonus strike on a 100-HP target
    assert.equal(Game.buildState.metrics.hunterPrecisionDamage, 2);

    // The strike is bonus damage: the next direct batch starts marks fresh.
    Game.onDirectShotBatch(batch(11, 'enemy', enemy.entityId));
    assert.equal(Game.buildState.locks.hunterHits, 1);
});

test('hunter: execute calibration strikes 3D against low-health targets', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('hunter_entry', 'hunter_execute');
    const enemy = makeEnemy(100, 0, 0);
    enemy.health = 30;

    for (let i = 1; i <= 10; i++) Game.onDirectShotBatch(batch(i, 'enemy', enemy.entityId));
    assert.equal(enemy.health, 27);
    assert.equal(Game.buildState.metrics.hunterPrecisionDamage, 3);
});

test('hunter: switching targets clears the accumulated marks', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('hunter_entry');
    const a = makeEnemy(100, 0, 0);
    const b = makeEnemy(100, 50, 50);

    for (let i = 1; i <= 4; i++) Game.onDirectShotBatch(batch(i, 'enemy', a.entityId));
    Game.onDirectShotBatch(batch(5, 'enemy', b.entityId));
    assert.equal(Game.buildState.locks.hunterTargetId, b.entityId);
    assert.equal(Game.buildState.locks.hunterHits, 1);
});

test('hunter: an active locked target in the batch wins over the first hit', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('hunter_entry');
    const a = makeEnemy(100, 0, 0);
    const b = makeEnemy(100, 50, 50);

    for (let i = 1; i <= 3; i++) Game.onDirectShotBatch(batch(i, 'enemy', a.entityId));
    // A scatter burst that hits b first and the locked a second stays on a.
    Game.onDirectShotBatch(batch(4, 'enemy', b.entityId, 1, [makeHit('enemy', a.entityId, 1)]));
    assert.equal(Game.buildState.locks.hunterTargetId, a.entityId);
    assert.equal(Game.buildState.locks.hunterHits, 4);
});

test('hunter: losing the target for the reset window clears the lock', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('hunter_entry', 'hunter_stable');
    const enemy = makeEnemy(100, 0, 0);

    for (let i = 1; i <= 3; i++) {
        Game.gameTime = i;
        Game.onDirectShotBatch(batch(i, 'enemy', enemy.entityId));
    }
    Game.gameTime = 3 + 2000; // idle longer than stableResetMs
    Game.updateBuildEffects(16);
    assert.equal(Game.buildState.locks.hunterTargetId, null);
    assert.equal(Game.buildState.locks.hunterHits, 0);

    Game.onDirectShotBatch(batch(4, 'enemy', enemy.entityId));
    assert.equal(Game.buildState.locks.hunterHits, 1);
});

test('hunter: a dead or recycled target clears the lock instead of striking', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('hunter_entry');
    const enemy = makeEnemy(10, 0, 0);

    for (let i = 1; i <= 9; i++) Game.onDirectShotBatch(batch(i, 'enemy', enemy.entityId));
    Game.releaseObject('enemies', enemy); // dies before the 10th hit lands

    Game.onDirectShotBatch(batch(10, 'enemy', enemy.entityId));
    assert.equal(Game.buildState.locks.hunterTargetId, null);
    assert.equal(Game.buildState.locks.hunterHits, 0);
    assert.equal(Game.buildState.metrics.hunterPrecisionDamage, undefined);
});

test('hunter: boss precision strikes open a 2s window consumed by the next direct hit', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('hunter_entry', 'hunter_stable', 'hunter_capstone');
    Game.boss = { entityId: 9001, health: 100, maxHealth: 100, x: 0, y: 0, width: 100, height: 100, type: 0 };

    for (let i = 1; i <= 10; i++) Game.onDirectShotBatch(batch(i, 'boss', Game.boss.entityId));
    assert.equal(Game.boss.health, 98);
    assert.equal(Game.buildState.locks.hunterHits, 0);
    assert.equal(Game.buildState.timers.hunterWindow, 2000);

    // A second full cycle: batch 11 immediately consumes the open window with
    // +2D on the boss (96 -> 94), and the 10th mark of the cycle (batch 20)
    // strikes again and re-opens the window at its full duration (no stacking).
    for (let i = 11; i <= 20; i++) Game.onDirectShotBatch(batch(i, 'boss', Game.boss.entityId));
    assert.equal(Game.boss.health, 94);
    assert.equal(Game.buildState.timers.hunterWindow, 2000);
    assert.equal(Game.buildState.metrics.hunterWindowDamage, 2);

    // The first direct hit inside the window adds +2D to its target and closes it.
    const enemy = makeEnemy(100, 50, 50);
    Game.onDirectShotBatch(batch(21, 'enemy', enemy.entityId));
    assert.equal(enemy.health, 98);
    assert.equal(Game.buildState.timers.hunterWindow, 0);
    assert.equal(Game.buildState.metrics.hunterWindowDamage, 4); // boss 2D + enemy 2D

    // Further hits inside the old window period get nothing.
    Game.onDirectShotBatch(batch(22, 'enemy', enemy.entityId));
    assert.equal(enemy.health, 98);
});

// --- Task 7: merged kill explosions (core chain + 爆破种子 seed) ------------

// Places an enemy whose CENTER is (cx, cy) with a set health, then re-seeds
// the spatial grid from the active pools so chain blasts can find them.
function placeAt(cx, cy, health = 1) {
    const enemy = Game.getObject('enemies');
    enemy.entityId = Game.allocateEntityId();
    enemy.x = cx - 15;
    enemy.y = cy - 15;
    enemy.width = 30;
    enemy.height = 30;
    enemy.type = 0;
    enemy.health = health;
    enemy.maxHealth = health;
    enemy.color = '#f00';
    enemy._dead = false;
    return enemy;
}

function makeEnemyBullet(cx, cy) {
    const bullet = Game.getObject('enemyBullets');
    bullet.x = cx - 3;
    bullet.y = cy - 3;
    bullet.width = 6;
    bullet.height = 6;
    bullet.color = '#f00';
    return bullet;
}

function seedGrid() {
    Game.spatialGrid.clear();
    for (const enemy of Game.objectPools.enemies.active) Game.spatialGrid.insert(enemy, 'enemies');
}

test('chain seed: a direct kill blasts 0.5D inside 45px, widened to 60 by 广域爆破', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('chain_entry');
    const a = placeAt(0, 0, 0);
    const b = placeAt(40, 0, 1);
    const c = placeAt(80, 0, 1);
    seedGrid();

    assert.equal(Game.killEnemy(a, { source: 'direct', damage: 1 }), true);
    assert.equal(b.health, 0.5); // 0.5D with D = 1
    assert.equal(c.health, 1);   // 65px away: outside the 45px seed

    // 广域爆破 widens the seed to 45 + 15 = 60px.
    resetCombat();
    Game.resetBuildState();
    applyBuild('chain_entry', 'chain_wide');
    const a2 = placeAt(0, 0, 0);
    const d = placeAt(55, 0, 1);
    seedGrid();
    Game.killEnemy(a2, { source: 'direct', damage: 1 });
    assert.equal(d.health, 0.5);
});

test('chain: a target takes the blast only once per chain across blast points', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('chain_entry', 'chain_ignite');
    // A kills B (0.5 HP); X sits inside A's blast and B's cascade blast.
    const a = placeAt(0, 0, 0);
    const x = placeAt(30, 0, 1.5);
    const b = placeAt(40, 0, 0.5);
    seedGrid();

    Game.killEnemy(a, { source: 'direct', damage: 1 });
    assert.equal(x.health, 1.0); // hit once (by A), never again by B's blast
});

test('chain: ignite propagates at most 2 layers from the seed', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('chain_entry', 'chain_ignite');
    // A 40px line: each 45px blast reaches exactly the next enemy.
    const a = placeAt(0, 0, 0);
    const b = placeAt(40, 0, 0.5);
    const c = placeAt(80, 0, 0.5);
    const d = placeAt(120, 0, 0.5);
    const e = placeAt(160, 0, 1);
    seedGrid();

    Game.killEnemy(a, { source: 'direct', damage: 1 });
    // B and C die to cascade blasts; D dies to C's blast but its own blast
    // would be a third layer, so E survives untouched.
    assert.equal(e.health, 1);
    assert.equal(Game.score, 40); // A + B + C + D killed (10 each)
});

test('chain: a seed-only chain is capped at 12 blasts even with a full kill cluster', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('chain_entry', 'chain_ignite');
    const killer = placeAt(0, 0, 0);
    // 13 enemies packed inside the seed blast: one blast kills them all and
    // queues 13 propagation blasts, which the 12-blast cap trims to 12.
    for (let i = 0; i < 13; i++) placeAt(20 + (i % 4) * 6, -10 + Math.floor(i / 4) * 6, 0.5);
    seedGrid();

    Game.killEnemy(killer, { source: 'direct', damage: 1 });
    assert.equal(Game.score, 140); // killer + all 13 cluster enemies
    assert.equal(Game.objectPools.enemies.active.length, 0);
    assert.equal(Game.buildState.counters.chainBlasts, 12);
});

test('chain card + seed merge into one chain: 200px radius, larger damage, single chainId', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('chain_entry');
    Game.activeCard = 'chain';
    const killEvents = [];
    const realKillHook = Game.onEnemyKilled;
    Game.onEnemyKilled = (kill) => { killEvents.push(kill); realKillHook.call(Game, kill); };

    const a = placeAt(0, 0, 0);
    const x = placeAt(100, 0, 5);  // inside 200px, outside the 45px seed
    const y = placeAt(30, 0, 0.5); // dies to the blast and cascades onward
    const z = placeAt(90, 0, 3);   // inside y's cascade blast
    seedGrid();

    Game.killEnemy(a, { source: 'direct', damage: 4 });
    // D = 4 -> seed 0.5D = 2; merged damage = max(core 0.5, seed 2).
    assert.equal(x.health, 3);
    assert.equal(z.health, 1);
    const blasts = killEvents.filter((k) => k.source === 'explosion');
    assert.equal(blasts.length, 1);
    const chainIds = new Set(blasts.map((k) => k.chainId));
    assert.equal(chainIds.size, 1);
    assert.ok([...chainIds][0] > 0);
});

test('chain card alone keeps cascading through kill blasts at 200px', () => {
    resetCombat();
    Game.resetBuildState();
    Game.activeCard = 'chain';
    const a = placeAt(0, 0, 0);
    const b = placeAt(90, 0, 0.5); // dies to A's blast and cascades onward
    const c = placeAt(250, 0, 0.5); // 160px from B: dies to B's 200px blast
    const d = placeAt(340, 0, 5);   // reachable only from C's death blast (90px)
    seedGrid();

    Game.killEnemy(a, { source: 'direct', damage: 1 });
    assert.equal(d.health, 4.5); // C's death blast hit D once (0.5)
    assert.equal(Game.score, 30); // only A, B and C died
    assert.equal(Game.objectPools.enemies.active.length, 1); // only D remains
});

test('chain: the boss takes only the seed part at half and never propagates', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('chain_entry');
    Game.activeCard = 'chain';
    Game.boss = { entityId: 7001, health: 100, maxHealth: 100, x: 50, y: -50, width: 100, height: 100, type: 0 };

    const a = placeAt(0, 0, 0);
    const far = placeAt(250, 0, 1);
    seedGrid();

    Game.killEnemy(a, { source: 'direct', damage: 4 });
    // Boss center is 100px from the blast: inside the merged 200px radius.
    // It takes the seed part (2) at half -> 1; the core's 0.5 never applies.
    assert.equal(Game.boss.health, 99);
    assert.equal(far.health, 1);
});

test('chain: damage lands even when the particle pool is exhausted', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('chain_entry');
    const particles = Game.objectPools.particles;
    for (let i = 0; i < CONFIG.poolMaxSize.particles; i++) {
        particles.active.push({ life: 1 });
    }

    const a = placeAt(0, 0, 0);
    const b = placeAt(40, 0, 1);
    seedGrid();
    Game.killEnemy(a, { source: 'direct', damage: 1 });
    assert.equal(b.health, 0.5);
});

test('chain capstone: the 3rd chain kill clears 60px of bullets once per chain with a global cooldown', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('chain_entry', 'chain_ignite', 'chain_capstone');

    // 40px cascade: A -> B -> C -> D; the 3rd chain kill (D) triggers the shock.
    const a = placeAt(0, 0, 0);
    placeAt(40, 0, 0.5);
    const c = placeAt(80, 0, 0.5);
    const d = placeAt(120, 0, 0.5);
    // One bullet near C (spared: the shock fires at D), one near D (cleared),
    // one far away (spared).
    const nearC = makeEnemyBullet(59, 0);
    const nearD = makeEnemyBullet(175, 0);
    const far = makeEnemyBullet(260, 0);
    seedGrid();

    Game.killEnemy(a, { source: 'direct', damage: 1 });
    let survivors = Game.objectPools.enemyBullets.active;
    assert.equal(survivors.includes(nearD), false); // cleared at the 3rd kill (D)
    assert.equal(survivors.includes(nearC), true);   // shock fired once, at D
    assert.equal(survivors.includes(far), true);
    assert.equal(Game.buildState.timers.chainShockCooldown, 5000);

    // A second chain inside the global 5s cooldown cannot clear again.
    const a2 = placeAt(300, 0, 0);
    placeAt(340, 0, 0.5);
    placeAt(380, 0, 0.5);
    placeAt(420, 0, 0.5);
    const nearD2 = makeEnemyBullet(475, 0);
    seedGrid();
    Game.killEnemy(a2, { source: 'direct', damage: 1 });
    survivors = Game.objectPools.enemyBullets.active;
    assert.equal(survivors.includes(nearD2), true); // cooldown blocked the shock

    Game.updateBuildEffects(5000);
    assert.equal(Game.buildState.timers.chainShockCooldown, 0);
});

// --- Task 8: fortress barrier + desperate counterattack --------------------

test('fortress: time shield has priority and does not consume the barrier', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('fortress_entry');
    Game.buildState.locks.fortressBarrier = true;
    Game.player.shieldTime = 2;
    const bullet = makeEnemyBullet(10, 10);

    Game.resolveEnemyBulletHit(bullet);

    assert.equal(Game.lives, 3);
    assert.equal(Game.player.shieldTime, 2);
    assert.equal(Game.buildState.locks.fortressBarrier, true);
});

test('fortress: barrier blocks only enemy bullets and collision damage still triggers thorns', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('fortress_entry');
    Game.activeCard = 'thorns';
    Game.buildState.locks.fortressBarrier = true;
    const enemy = makeEnemy(1, 0, 0);

    Game.applyPlayerHit(1, 'enemyCollision');

    assert.equal(Game.lives, 2);
    assert.equal(Game.buildState.locks.fortressBarrier, true);
    assert.equal(Game.objectPools.enemies.active.includes(enemy), false);
});

test('fortress: boost enemy bullets deal two damage, grant the original five-second shield, and gate later hits', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('fortress_entry');
    Game.activeCard = 'boost';
    const first = makeEnemyBullet(10, 10);
    const second = makeEnemyBullet(10, 10);

    Game.resolveEnemyBulletHit(first);
    Game.resolveEnemyBulletHit(second);

    assert.equal(Game.lives, 1);
    assert.equal(Game.player.shieldTime, 5);
    assert.equal(Game.buildState.locks.fortressBarrier, false);
});

test('fortress: barrier consumption echoes on ordinary enemies and clears bullets without touching the boss', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('fortress_entry', 'fortress_echo', 'fortress_capstone');
    Game.buildState.locks.fortressBarrier = true;
    const enemy = makeEnemy(1, 0, 0);
    const near = makeEnemyBullet(50, 15);
    const far = makeEnemyBullet(200, 200);
    Game.boss = { entityId: 7001, health: 10, maxHealth: 10, x: 0, y: 0, width: 30, height: 30 };

    Game.resolveEnemyBulletHit(makeEnemyBullet(10, 10));

    assert.equal(Game.lives, 3);
    assert.equal(Game.objectPools.enemies.active.includes(enemy), false);
    assert.equal(Game.boss.health, 10);
    assert.equal(Game.objectPools.enemyBullets.active.includes(near), false);
    assert.equal(Game.objectPools.enemyBullets.active.includes(far), true);
    assert.equal(Game.buildState.timers.fortressClearCooldown, 10000);
});

test('fortress: no-damage time charges one barrier, regroup shortens it, and damage resets the charge', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('fortress_entry', 'fortress_regroup');

    Game.updateBuildEffects(11999);
    assert.equal(Game.buildState.locks.fortressBarrier, false);
    Game.updateBuildEffects(1);
    assert.equal(Game.buildState.locks.fortressBarrier, true);
    assert.equal(Game.buildState.timers.fortressBarrier, 0);

    Game.buildState.locks.fortressBarrier = false;
    Game.updateBuildEffects(12000);
    assert.equal(Game.buildState.locks.fortressBarrier, true);
    Game.applyPlayerHit(1, 'enemyBullet');
    assert.equal(Game.buildState.timers.fortressBarrier, 0);
});

test('fortress: clear cooldown blocks a second clear and re-arms after fixed-step updates', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('fortress_entry', 'fortress_echo', 'fortress_capstone');

    const updateMethods = [
        'updatePlayer', 'updateBullets', 'updateEnemyBullets', 'updateEnemies',
        'updateParticles', 'updateItems', 'updateCardEffects', 'spawnEnemies',
        'enemiesShoot', 'spawnItems', 'updateGameState', 'checkCollisions',
    ];
    const originals = Object.fromEntries(updateMethods.map((name) => [name, Game[name]]));
    for (const name of updateMethods) Game[name] = () => {};

    try {
        Game.buildState.locks.fortressBarrier = true;
        Game.resolveEnemyBulletHit(makeEnemyBullet(10, 10));
        assert.equal(Game.buildState.timers.fortressClearCooldown, 10000);

        // This is the bullet that the second barrier consumption would clear
        // if the cooldown were not blocking it.
        const blockedCandidate = makeEnemyBullet(10, 10);
        Game.buildState.locks.fortressBarrier = true;
        const secondImpact = makeEnemyBullet(200, 200);
        Game.resolveEnemyBulletHit(secondImpact);
        assert.equal(Game.objectPools.enemyBullets.active.includes(blockedCandidate), true);
        assert.equal(Game.buildState.timers.fortressClearCooldown, 10000);

        const originalCooldown = Game.buildState.timers.fortressClearCooldown;
        const stepsBeforeExpiry = Math.ceil(originalCooldown / Game.fixedStepMs) - 1;
        for (let i = 0; i < stepsBeforeExpiry; i++) Game.update(Game.fixedStepMs);
        assert.ok(Game.buildState.timers.fortressClearCooldown > 0);
        Game.update(Game.fixedStepMs);
        assert.equal(Game.buildState.timers.fortressClearCooldown, 0);

        const rearmedTarget = makeEnemyBullet(10, 10);
        Game.buildState.locks.fortressBarrier = true;
        Game.resolveEnemyBulletHit(makeEnemyBullet(10, 10));
        assert.equal(Game.objectPools.enemyBullets.active.includes(rearmedTarget), false);
        assert.equal(Game.buildState.timers.fortressClearCooldown, 10000);
    } finally {
        for (const name of updateMethods) Game[name] = originals[name];
    }
});

test('desperate: glass never activates low-health progress', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('desperate_entry');
    const enemy = makeEnemy(100, 0, 0);

    Game.activeCard = 'comeback';
    Game.lives = 1;
    for (let shotId = 1; shotId <= 12; shotId++) {
        Game.onDirectShotBatch(batch(shotId, 'enemy', enemy.entityId));
    }
    assert.equal(enemy.health, 98);

    resetCombat();
    Game.resetBuildState();
    applyBuild('desperate_entry');
    Game.activeCard = 'glass';
    Game.lives = 1;
    const glassEnemy = makeEnemy(100, 0, 0);

    for (let shotId = 1; shotId <= 12; shotId++) {
        Game.onDirectShotBatch(batch(shotId, 'enemy', glassEnemy.entityId));
    }

    assert.equal(Game.buildState.counters.desperateHits, 0);
    assert.equal(glassEnemy.health, 100);
});

test('desperate: twelve low-health batches trigger a bonus strike and the strike branch clears nearby bullets', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('desperate_entry', 'desperate_strike');
    Game.activeCard = 'comeback';
    Game.lives = 1;
    const enemy = makeEnemy(100, 0, 0);
    const near = makeEnemyBullet(40, 15);
    const far = makeEnemyBullet(200, 200);

    for (let shotId = 1; shotId <= 12; shotId++) {
        Game.onDirectShotBatch(batch(shotId, 'enemy', enemy.entityId));
    }

    assert.equal(enemy.health, 98);
    assert.equal(Game.objectPools.enemyBullets.active.includes(near), false);
    assert.equal(Game.objectPools.enemyBullets.active.includes(far), true);
    assert.equal(Game.buildState.timers.desperateClearCooldown, 8000);
});

test('desperate: execute branch uses three times the triggering damage on a low-health target', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('desperate_entry', 'desperate_execute');
    Game.activeCard = 'comeback';
    Game.lives = 1;
    const enemy = makeEnemy(100, 0, 0);
    enemy.health = 30;

    for (let shotId = 1; shotId <= 12; shotId++) {
        Game.onDirectShotBatch(batch(shotId, 'enemy', enemy.entityId));
    }

    assert.equal(enemy.health, 27);
});

test('desperate: capstone restores one life once per boss cycle and does not bank blocked healing', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('desperate_entry', 'desperate_strike', 'desperate_capstone');
    Game.activeCard = 'comeback';
    Game.lives = 1;

    for (let i = 0; i < 8; i++) {
        const enemy = makeEnemy(1, 100 + i * 40, 0);
        enemy.health = 0;
        Game.killEnemy(enemy, { source: 'direct', damage: 1 });
    }
    assert.equal(Game.lives, 2);
    assert.equal(Game.buildState.locks.desperateCycleHeal, true);

    Game.lives = 1;
    for (let i = 0; i < 8; i++) {
        const enemy = makeEnemy(1, 100 + i * 40, 0);
        enemy.health = 0;
        Game.killEnemy(enemy, { source: 'direct', damage: 1 });
    }
    assert.equal(Game.lives, 1);
    assert.equal(Game.buildState.counters.desperateKills, 0);

    Game.activeCard = 'blitz';
    Game.buildState.locks.desperateCycleHeal = false;
    for (let i = 0; i < 8; i++) {
        const enemy = makeEnemy(1, 100 + i * 40, 0);
        enemy.health = 0;
        Game.killEnemy(enemy, { source: 'direct', damage: 1 });
    }
    assert.equal(Game.lives, 1);
    assert.equal(Game.buildState.counters.desperateKills, 0);
});

test('desperate: switching to a no-heal card clears seven-kill progress before it can heal', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild('desperate_entry', 'desperate_strike', 'desperate_capstone');
    Game.activeCard = 'comeback';
    Game.lives = 1;

    for (let i = 0; i < 7; i++) {
        const enemy = makeEnemy(1, 100 + i * 40, 0);
        enemy.health = 0;
        Game.killEnemy(enemy, { source: 'direct', damage: 1 });
    }
    assert.equal(Game.buildState.counters.desperateKills, 7);

    Game.activeCard = 'blitz';
    Game.updateBuildEffects(Game.fixedStepMs);
    assert.equal(Game.buildState.counters.desperateKills, 0);

    Game.activeCard = 'comeback';
    const eighth = makeEnemy(1, 500, 0);
    eighth.health = 0;
    Game.killEnemy(eighth, { source: 'direct', damage: 1 });
    assert.equal(Game.lives, 1);
    assert.equal(Game.buildState.counters.desperateKills, 1);
});

test('desperate: removing and re-adding the capstone cannot preserve healing progress', () => {
    resetCombat();
    Game.resetBuildState();
    applyBuild(
        'desperate_entry', 'desperate_strike', 'desperate_capstone',
        'rapid_entry', 'fortress_entry', 'chain_entry',
    );
    Game.activeCard = 'comeback';
    Game.lives = 1;

    for (let i = 0; i < 7; i++) {
        const enemy = makeEnemy(1, 100 + i * 40, 0);
        enemy.health = 0;
        Game.killEnemy(enemy, { source: 'direct', damage: 1 });
    }
    assert.equal(Game.buildState.counters.desperateKills, 7);
    assert.ok(Game.getLegalBuildRemovals('supply_entry').includes('desperate_capstone'));

    assert.equal(Game.applyBuildChoice('supply_entry', 'desperate_capstone'), true);
    Game.updateBuildEffects(Game.fixedStepMs);
    assert.equal(Game.buildState.counters.desperateKills, 0);

    assert.equal(Game.applyBuildChoice('desperate_capstone', 'supply_entry'), true);
    const eighth = makeEnemy(1, 500, 0);
    eighth.health = 0;
    Game.killEnemy(eighth, { source: 'direct', damage: 1 });
    assert.equal(Game.lives, 1);
    assert.equal(Game.buildState.counters.desperateKills, 1);
});
