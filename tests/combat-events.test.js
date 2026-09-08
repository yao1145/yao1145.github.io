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

const realOnDirectShotBatch = Game.onDirectShotBatch;
const realOnEnemyKilled = Game.onEnemyKilled;

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

function applyBuild(...ids) {
    for (const id of ids) assert.equal(Game.applyBuildChoice(id), true, `apply ${id}`);
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

function placeAt(cx, cy, health = 1) {
    return makeEnemy(health, cx - 15, cy - 15);
}

function makeBullet(shotId = 1, x = 0, y = 0) {
    const bullet = Game.getObject('bullets');
    bullet.shotId = shotId;
    bullet.isPrimary = true;
    bullet.pierceRemaining = 0;
    bullet.hitEntityIds = [];
    bullet.rapidDamageBonus = 0;
    bullet.supplyDamageBonus = 0;
    bullet.buildDamageBonus = 0;
    bullet.x = x;
    bullet.y = y;
    bullet.width = 4;
    bullet.height = 12;
    bullet.color = '#ff0';
    bullet.speed = 8;
    return bullet;
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

function hitEvent(targetType, entityId, baseDamage = 1, isPrimary = true) {
    return { source: 'direct', targetType, entityId, amount: baseDamage, baseDamage, isPrimary, x: 0, y: 0 };
}

function batch(shotId, targetType, entityId, baseDamage = 1, events = []) {
    return { shotId, events: [hitEvent(targetType, entityId, baseDamage), ...events] };
}

function directKill(shotId, type = 0, source = 'direct') {
    return { source, shotId, entityId: 9000 + shotId, type, x: 0, y: 0 };
}

test('resetGameFixture restores run state without resetting entity ids', () => {
    Object.assign(Game, { isRunning: true, isGameOver: true, isMenu: false, gameTime: 789, score: 1000, lives: 1, activeCard: 'glass', cardPickCount: { glass: 3 }, player: { x: 1 } });
    const nextEntityId = Game.allocateEntityId();
    resetGameFixture();
    assert.equal(Game.isRunning, false);
    assert.equal(Game.isGameOver, false);
    assert.equal(Game.isMenu, true);
    assert.equal(Game.gameTime, 0);
    assert.equal(Game.score, 0);
    assert.equal(Game.lives, 3);
    assert.equal(Game.activeCard, null);
    assert.deepEqual(Game.cardPickCount, {});
    assert.equal(Game.nextEntityId, nextEntityId);
});

test('reused pooled enemy receives a new identity', () => {
    resetCombat();
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

test('roundCombatDamage keeps zero at zero and quantizes positives by 0.5', () => {
    resetCombat();
    assert.equal(Game.roundCombatDamage(0), 0);
    assert.equal(Game.roundCombatDamage(-0.4), 0);
    assert.equal(Game.roundCombatDamage(0.26), 0.5);
    assert.equal(Game.roundCombatDamage(0.75), 1);
    assert.equal(Game.roundCombatDamage(1.25), 1.5);
});

test('spawnBullet tags a batch with one shared shotId and one actual primary', () => {
    resetCombat();
    Game.baseBulletCount = 3;
    Game.player.x = 50;
    Game.player.y = 100;
    Game.spawnBullet();
    const bullets = Game.objectPools.bullets.active;
    assert.equal(bullets.length, 3);
    assert.ok(bullets.every((bullet) => bullet.shotId === bullets[0].shotId && bullets[0].shotId > 0));
    assert.equal(bullets.filter((bullet) => bullet.isPrimary).length, 1);
    assert.ok(bullets.every((bullet) => bullet.rapidBatchBoosted === false));
    assert.deepEqual(bullets[0].hitEntityIds, []);
});

test('same-shot hits flush once and a lethal target settles one death', () => {
    resetCombat();
    const batches = [];
    Game.onDirectShotBatch = (value) => batches.push(value);
    Game.queueDirectHit({ shotId: 7, targetType: 'enemy', entityId: 101, isPrimary: true, amount: 1, baseDamage: 1, x: 0, y: 0 });
    Game.queueDirectHit({ shotId: 7, targetType: 'enemy', entityId: 102, isPrimary: false, amount: 1, baseDamage: 1, x: 0, y: 0 });
    Game.flushDirectShotBatches();
    Game.flushDirectShotBatches();
    assert.equal(batches.length, 1);
    assert.equal(batches[0].events.length, 2);

    const kills = [];
    Game.onEnemyKilled = (event) => kills.push(event);
    const enemy = makeEnemy(0.5);
    const event = Game.damageTarget({ bullet: makeBullet(3), target: enemy, targetType: 'enemy' });
    assert.equal(event.amount, 1);
    assert.equal(kills.length, 1);
    assert.equal(Game.killEnemy(enemy, { source: 'direct' }), false);
    assert.equal(Game.score, 10);
});

test('stale pooled targets and zero damage do not create direct events', () => {
    resetCombat();
    const enemy = makeEnemy(5);
    const bullet = makeBullet(5);
    Game.releaseObject('enemies', enemy);
    assert.equal(Game.damageTarget({ bullet, target: enemy, targetType: 'enemy' }), null);
    assert.equal(enemy.health, 5);
    const liveEnemy = makeEnemy(5);
    const realDamage = Game.getDirectShotDamage;
    Game.getDirectShotDamage = () => 0;
    try {
        assert.equal(Game.damageTarget({ bullet: makeBullet(6), target: liveEnemy, targetType: 'enemy' }), null);
        assert.equal(liveEnemy.health, 5);
    } finally {
        Game.getDirectShotDamage = realDamage;
    }
});

test('a Boss reference is rejected after the Boss identity is gone', () => {
    resetCombat();
    Game.boss = { entityId: 41, x: 0, y: 0, width: 30, height: 30, health: 10, maxHealth: 10, type: 0 };
    const boss = Game.boss;
    assert.ok(Game.damageTarget({ bullet: makeBullet(41), target: boss, targetType: 'boss' }));
    assert.equal(boss.health, 9);
    Game.boss = null;
    assert.equal(Game.damageTarget({ bullet: makeBullet(42), target: boss, targetType: 'boss' }), null);
    assert.equal(boss.health, 9);
});

test('checkCollisions routes a direct bullet kill through the unified pipeline once', () => {
    resetCombat();
    const kills = [];
    const batches = [];
    Game.onEnemyKilled = (event) => kills.push(event);
    Game.onDirectShotBatch = (value) => batches.push(value);
    const enemy = makeEnemy(1, 80, 80);
    makeBullet(51, 90, 90);
    Game.checkCollisions();
    assert.equal(Game.score, 10);
    assert.equal(kills.length, 1);
    assert.equal(kills[0].entityId, enemy.entityId);
    assert.equal(batches.length, 1);
    assert.equal(batches[0].events[0].amount, 1);
    assert.equal(Game.objectPools.bullets.active.length, 0);
    assert.equal(Game.objectPools.enemies.active.length, 0);
});

test('rapid uses 8 hits, 2s decay, and a 4s heat-up', () => {
    resetCombat();
    applyBuild('rapid_entry');
    const enemy = makeEnemy(100);
    for (let shot = 1; shot <= 7; shot++) Game.onDirectShotBatch(batch(shot, 'enemy', enemy.entityId));
    assert.equal(Game.buildState.counters.rapidHits, 7);
    Game.updateBuildEffects(1999);
    assert.equal(Game.buildState.counters.rapidHits, 7);
    Game.updateBuildEffects(1);
    assert.equal(Game.buildState.counters.rapidHits, 0);
    for (let shot = 8; shot <= 15; shot++) Game.onDirectShotBatch(batch(shot, 'enemy', enemy.entityId));
    assert.equal(Game.buildState.timers.rapidWarmup, CONFIG.builds.rapid.activeMs);
});

test('rapid heat-up strengthens every second batch with +1 and configured pierce', () => {
    resetCombat();
    applyBuild('rapid_entry', 'rapid_wide');
    Game.buildState.timers.rapidWarmup = CONFIG.builds.rapid.activeMs;
    assert.deepEqual(Game.consumeRapidBatchEffect(), { rapidBatchBoosted: false, rapidDamageBonus: 0, pierceRemaining: 0, rapidPierce: 0 });
    const boosted = Game.consumeRapidBatchEffect();
    assert.equal(boosted.rapidBatchBoosted, true);
    assert.equal(boosted.rapidDamageBonus, 1);
    assert.equal(boosted.pierceRemaining, 2);
    assert.equal(Game.buildState.counters.rapidHeatupShots, 2);
});

test('rapid capstone adds +400ms per direct kill or six Boss hits, max +2s and 6s', () => {
    resetCombat();
    applyBuild('rapid_entry', 'rapid_reignite', 'rapid_capstone');
    Game.buildState.timers.rapidWarmup = 4000;
    for (let i = 0; i < 5; i++) Game.onEnemyKilled(directKill(i + 1));
    assert.equal(Game.buildState.timers.rapidWarmup, 6000);
    Game.onEnemyKilled(directKill(99));
    assert.equal(Game.buildState.timers.rapidWarmup, 6000);

    Game.resetBuildState();
    applyBuild('rapid_entry', 'rapid_reignite', 'rapid_capstone');
    Game.buildState.timers.rapidWarmup = 4000;
    const boss = { entityId: 3001 };
    for (let i = 1; i <= 6; i++) Game.onDirectShotBatch(batch(i, 'boss', boss.entityId));
    assert.equal(Game.buildState.timers.rapidWarmup, 4400);
    assert.equal(Game.buildState.counters.rapidBossHits, 0);
});

test('rapid reignite retains exactly 4 of 8 progress after heat-up', () => {
    resetCombat();
    applyBuild('rapid_entry', 'rapid_reignite');
    Game.buildState.timers.rapidWarmup = 4000;
    Game.updateBuildEffects(4000);
    assert.equal(Game.buildState.counters.rapidHits, 4);
    Game.updateBuildEffects(2000);
    assert.equal(Game.buildState.counters.rapidHits, 0);
});

test('fortress charges at 15s, regroup at 12s, and barrier echo uses a 200px radius', () => {
    resetCombat();
    applyBuild('fortress_entry', 'fortress_echo');
    Game.updateBuildEffects(14999);
    assert.equal(Game.buildState.locks.fortressBarrier, false);
    Game.updateBuildEffects(1);
    assert.equal(Game.buildState.locks.fortressBarrier, true);
    Game.buildState.locks.fortressBarrier = false;
    Game.buildState.timers.fortressBarrier = 0;
    const center = { x: 15, y: 15 };
    const inside = placeAt(center.x + 199, center.y, 3);
    const edge = placeAt(center.x + 200, center.y, 3);
    const outside = placeAt(center.x + 201, center.y, 3);
    Game.onFortressBarrierConsumed();
    assert.equal(inside.health, 1);
    assert.equal(edge.health, 1);
    assert.equal(outside.health, 3);

    Game.resetBuildState();
    applyBuild('fortress_entry', 'fortress_regroup');
    Game.updateBuildEffects(11999);
    assert.equal(Game.buildState.locks.fortressBarrier, false);
    Game.updateBuildEffects(1);
    assert.equal(Game.buildState.locks.fortressBarrier, true);
});

test('fortress capstone clears 250px at r-1/r/r+1, with no event side effects', () => {
    resetCombat();
    applyBuild('fortress_entry', 'fortress_regroup', 'fortress_capstone');
    const center = { x: 15, y: 15 };
    const near = makeEnemyBullet(center.x + 249, center.y);
    const edge = makeEnemyBullet(center.x + 250, center.y);
    const far = makeEnemyBullet(center.x + 251, center.y);
    let directEvents = 0;
    let killEvents = 0;
    Game.onDirectShotBatch = () => { directEvents += 1; };
    Game.onEnemyKilled = () => { killEvents += 1; };
    Game.buildState.locks.fortressBarrier = true;
    Game.onFortressBarrierConsumed();
    assert.equal(Game.objectPools.enemyBullets.active.includes(near), false);
    assert.equal(Game.objectPools.enemyBullets.active.includes(edge), false);
    assert.equal(Game.objectPools.enemyBullets.active.includes(far), true);

    assert.equal(directEvents, 0);
    assert.equal(killEvents, 0);
});

test('desperate triggers after 10 low-health direct batches and is inactive above the threshold or under glass', () => {
    resetCombat();
    applyBuild('desperate_entry');
    Game.lives = 1;
    const enemy = makeEnemy(100);
    for (let shot = 1; shot <= 9; shot++) Game.onDirectShotBatch(batch(shot, 'enemy', enemy.entityId));
    assert.equal(Game.buildState.counters.desperateHits, 9);
    Game.onDirectShotBatch(batch(10, 'enemy', enemy.entityId));
    assert.equal(enemy.health, 98);
    assert.equal(Game.buildState.counters.desperateHits, 0);

    Game.resetBuildState();
    applyBuild('desperate_entry');
    Game.lives = 3;
    const safeEnemy = makeEnemy(100);
    for (let shot = 1; shot <= 10; shot++) Game.onDirectShotBatch(batch(shot, 'enemy', safeEnemy.entityId));
    assert.equal(Game.buildState.counters.desperateHits, 0);

    Game.resetBuildState();
    applyBuild('desperate_entry');
    Game.activeCard = 'glass';
    Game.lives = 1;
    const glassEnemy = makeEnemy(100);
    for (let shot = 1; shot <= 10; shot++) Game.onDirectShotBatch(batch(shot, 'enemy', glassEnemy.entityId));
    assert.equal(Game.buildState.counters.desperateHits, 0);
    assert.equal(glassEnemy.health, 100);
});

test('desperate execute uses the 35% boundary and clear branch uses 220px', () => {
    resetCombat();
    applyBuild('desperate_entry', 'desperate_clear');
    Game.lives = 1;
    const enemy = makeEnemy(100);
    enemy.health = 35;
    const center = { x: 15, y: 15 };
    const near = makeEnemyBullet(center.x + 219, center.y);
    const edge = makeEnemyBullet(center.x + 220, center.y);
    const far = makeEnemyBullet(center.x + 221, center.y);
    for (let shot = 1; shot <= 10; shot++) Game.onDirectShotBatch(batch(shot, 'enemy', enemy.entityId));
    assert.equal(enemy.health, 33);
    assert.equal(Game.objectPools.enemyBullets.active.includes(near), false);
    assert.equal(Game.objectPools.enemyBullets.active.includes(edge), false);
    assert.equal(Game.objectPools.enemyBullets.active.includes(far), true);

    Game.resetBuildState();
    applyBuild('desperate_entry', 'desperate_execute');
    Game.lives = 1;
    const executeEnemy = makeEnemy(100);
    executeEnemy.health = 35;
    for (let shot = 1; shot <= 10; shot++) Game.onDirectShotBatch(batch(shot, 'enemy', executeEnemy.entityId));
    assert.equal(executeEnemy.health, 32);
});

test('desperate capstone heals once per Boss cycle after eight direct kills', () => {
    resetCombat();
    applyBuild('desperate_entry', 'desperate_clear', 'desperate_capstone');
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
});

test('hunter supports 2D/3D, remembers a target for 3000ms, and bonus does not recurse', () => {
    resetCombat();
    applyBuild('hunter_entry', 'hunter_lock');
    const enemy = makeEnemy(100);
    for (let shot = 1; shot <= 9; shot++) Game.onDirectShotBatch(batch(shot, 'enemy', enemy.entityId));
    Game.updateBuildEffects(2999);
    Game.onDirectShotBatch(batch(10, 'enemy', enemy.entityId));
    assert.equal(enemy.health, 98);
    assert.equal(Game.buildState.metrics.hunterPrecisionDamage, 2);

    for (let shot = 11; shot <= 19; shot++) Game.onDirectShotBatch(batch(shot, 'enemy', enemy.entityId));
    enemy.health = 35;
    Game.onDirectShotBatch(batch(20, 'enemy', enemy.entityId));
    assert.equal(enemy.health, 32);
    Game.updateBuildEffects(3000);
    assert.equal(Game.buildState.locks.hunterTargetId, null);
    assert.equal(Game.buildState.locks.hunterHits, 0);

    Game.resetBuildState();
    applyBuild('hunter_entry', 'hunter_execute');
    const executeEnemy = makeEnemy(100);
    executeEnemy.health = 35;
    for (let shot = 1; shot <= 10; shot++) Game.onDirectShotBatch(batch(shot, 'enemy', executeEnemy.entityId));
    assert.equal(executeEnemy.health, 32);
});

test('hunter switching targets starts the lock count on the new target', () => {
    resetCombat();
    applyBuild('hunter_entry');
    const first = makeEnemy(100);
    const second = makeEnemy(100, 50, 50);
    for (let shot = 1; shot <= 4; shot++) Game.onDirectShotBatch(batch(shot, 'enemy', first.entityId));
    Game.onDirectShotBatch(batch(5, 'enemy', second.entityId));
    assert.equal(Game.buildState.locks.hunterTargetId, second.entityId);
    assert.equal(Game.buildState.locks.hunterHits, 1);
});

test('hunter Boss capstone opens a 2s window, clears 200px with 6s cooldown, and leaves nearby enemies unchanged', () => {
    resetCombat();
    applyBuild('hunter_entry', 'hunter_lock', 'hunter_capstone');
    Game.boss = { entityId: 5001, x: 0, y: 0, width: 30, height: 30, health: 100, maxHealth: 100, type: 0 };
    const nearbyEnemy = placeAt(115, 15, 10);
    const near = makeEnemyBullet(214, 15);
    const edge = makeEnemyBullet(215, 15);
    const far = makeEnemyBullet(216, 15);
    for (let shot = 1; shot <= 10; shot++) Game.onDirectShotBatch(batch(shot, 'boss', Game.boss.entityId));
    assert.equal(Game.boss.health, 98);
    assert.equal(Game.buildState.timers.hunterWindow, 2000);
    assert.equal(nearbyEnemy.health, 10);
    assert.equal(Game.objectPools.enemyBullets.active.includes(near), false);
    assert.equal(Game.objectPools.enemyBullets.active.includes(edge), false);
    assert.equal(Game.objectPools.enemyBullets.active.includes(far), true);
    assert.equal(Game.buildState.timers.hunterClearCooldown, 6000);

    const healthBefore = nearbyEnemy.health;
    Game.onDirectShotBatch(batch(11, 'boss', Game.boss.entityId));
    assert.equal(Game.boss.health, 96);
    assert.equal(nearbyEnemy.health, healthBefore);
    assert.equal(Game.buildState.timers.hunterWindow, 0);
});

test('chain uses one fixed 1.0 seed blast, merges core and entry once, and never damages Boss', () => {
    resetCombat();
    applyBuild('chain_entry');
    Game.activeCard = 'chain';
    const seed = placeAt(0, 0, 0);
    const target = placeAt(100, 0, 1);
    Game.boss = { entityId: 7001, x: 35, y: -15, width: 30, height: 30, health: 100, maxHealth: 100, type: 0 };
    seedGrid();
    Game.killEnemy(seed, { source: 'direct', damage: 4 });
    assert.equal(Game.objectPools.enemies.active.includes(target), false);
    assert.equal(Game.boss.health, 100);
    assert.equal(Game.buildState.counters.chainBlasts, 1);
    assert.equal(Game.buildState.metrics.chainBonusDamage, 1);
});

test('chain base and wide radii honor r-1/r/r+1 with 1.0 damage', () => {
    resetCombat();
    applyBuild('chain_entry');
    const seed = placeAt(0, 0, 0);
    const inside = placeAt(199, 0, 2);
    const edge = placeAt(0, 200, 2);
    const outside = placeAt(201, 0, 2);
    seedGrid();
    Game.killEnemy(seed, { source: 'direct', damage: 1 });
    assert.equal(inside.health, 1);
    assert.equal(edge.health, 1);
    assert.equal(outside.health, 2);

    resetCombat();
    applyBuild('chain_entry', 'chain_radius');
    const seed2 = placeAt(0, 0, 0);
    const wideInside = placeAt(259, 0, 2);
    const wideEdge = placeAt(0, 260, 2);
    const wideOutside = placeAt(261, 0, 2);
    seedGrid();
    Game.killEnemy(seed2, { source: 'direct', damage: 1 });
    assert.equal(wideInside.health, 1);
    assert.equal(wideEdge.health, 1);
    assert.equal(wideOutside.health, 2);
});

test('chain spread produces one generation at 220px with 0.5 damage and does not recurse', () => {
    resetCombat();
    applyBuild('chain_entry', 'chain_spread');
    const seed = placeAt(0, 0, 0);
    const first = placeAt(100, 0, 0.5);
    const second = placeAt(320, 0, 0.5);
    const third = placeAt(540, 0, 0.5);
    seedGrid();
    Game.killEnemy(seed, { source: 'direct', damage: 1 });
    assert.equal(Game.objectPools.enemies.active.includes(first), false);
    assert.equal(Game.objectPools.enemies.active.includes(second), false);
    assert.equal(Game.objectPools.enemies.active.includes(third), true);
    assert.equal(third.health, 0.5);
    assert.equal(Game.buildState.counters.chainGeneration, 1);
});

test('chain damage still resolves when the particle pool is exhausted', () => {
    resetCombat();
    applyBuild('chain_entry');
    for (let i = 0; i < CONFIG.poolMaxSize.particles; i++) Game.objectPools.particles.active.push({ life: 1 });
    const seed = placeAt(0, 0, 0);
    const target = placeAt(40, 0, 2);
    seedGrid();
    Game.killEnemy(seed, { source: 'direct', damage: 1 });
    assert.equal(target.health, 1);
});

test('chain capstone clears 300px once at the third kill and clear emits no events', () => {
    resetCombat();
    applyBuild('chain_entry', 'chain_radius', 'chain_capstone');
    const seed = placeAt(0, 0, 0);
    placeAt(50, 0, 0.5);
    placeAt(100, 0, 0.5);
    const last = placeAt(150, 0, 0.5);
    const near = makeEnemyBullet(449, 0);
    const edge = makeEnemyBullet(450, 0);
    const far = makeEnemyBullet(451, 0);
    let directEvents = 0;
    Game.onDirectShotBatch = () => { directEvents += 1; };
    seedGrid();
    Game.killEnemy(seed, { source: 'direct', damage: 1 });
    assert.equal(Game.objectPools.enemies.active.includes(last), false);
    assert.equal(Game.objectPools.enemyBullets.active.includes(near), false);
    assert.equal(Game.objectPools.enemyBullets.active.includes(edge), false);
    assert.equal(Game.objectPools.enemyBullets.active.includes(far), true);
    assert.equal(Game.buildState.metrics.chainBulletClears, 2);
    assert.equal(directEvents, 0);
});

test('thorns uses a 200px boundary and sends each retaliation death to bloodlust once', () => {
    resetCombat();
    Game.activeCard = 'thorns';
    const inside = placeAt(214, 15, 1);
    const edge = placeAt(15, 215, 1);
    const outside = placeAt(216, 15, 1);
    Game.onThornsHit();
    assert.equal(Game.objectPools.enemies.active.includes(inside), false);
    assert.equal(Game.objectPools.enemies.active.includes(edge), false);
    assert.equal(Game.objectPools.enemies.active.includes(outside), true);

    resetCombat();
    applyBuild('rapid_entry', 'desperate_entry', 'hunter_entry');
    Game.activeCard = 'bloodlust';
    const enemy = makeEnemy(1);
    Game.onThornsHit();
    assert.equal(Game.bloodlustMeter, 1);
    assert.equal(Game.buildState.counters.rapidHits, 0);
    assert.equal(Game.buildState.counters.desperateHits, 0);
    assert.equal(Game.buildState.locks.hunterHits, 0);
    assert.equal(Game.objectPools.enemies.active.includes(enemy), false);
});

test('cross-route unique deaths feed bloodlust once and never advance direct-only routes', () => {
    resetCombat();
    applyBuild('rapid_entry', 'desperate_entry', 'hunter_entry', 'chain_entry');
    Game.activeCard = 'bloodlust';
    Game.lives = 1;
    const seed = placeAt(0, 0, 0);
    const explosionDeath = placeAt(100, 0, 0.5);
    seedGrid();
    Game.killEnemy(seed, { source: 'direct', damage: 1 });
    assert.equal(Game.bloodlustMeter, 2);
    assert.equal(Game.buildState.counters.rapidHits, 0);
    assert.equal(Game.buildState.counters.desperateHits, 0);
    assert.equal(Game.buildState.locks.hunterHits, 0);
    assert.equal(Game.objectPools.enemies.active.includes(explosionDeath), false);
    Game.onEnemyKilled({ ...directKill(1), entityId: explosionDeath.entityId, source: 'explosion' });
    assert.equal(Game.bloodlustMeter, 2);
});

test('fortress retaliation death also feeds bloodlust once without direct progress', () => {
    resetCombat();
    applyBuild('rapid_entry', 'desperate_entry', 'hunter_entry', 'fortress_entry', 'fortress_echo');
    Game.activeCard = 'bloodlust';
    const enemy = makeEnemy(1);
    Game.player.x = -15;
    Game.player.y = -15;
    Game.onFortressBarrierConsumed();
    assert.equal(Game.bloodlustMeter, 1);
    assert.equal(Game.buildState.counters.rapidHits, 0);
    assert.equal(Game.buildState.counters.desperateHits, 0);
    assert.equal(Game.buildState.locks.hunterHits, 0);
    assert.equal(Game.objectPools.enemies.active.includes(enemy), false);
});

test('clearing bullets is a pure release with no hit, kill, or direct event', () => {
    resetCombat();
    const bullet = makeEnemyBullet(214, 15);
    const edge = makeEnemyBullet(215, 15);
    const far = makeEnemyBullet(216, 15);
    const enemy = placeAt(115, 15, 5);
    let directEvents = 0;
    let killEvents = 0;
    Game.onDirectShotBatch = () => { directEvents += 1; };
    Game.onEnemyKilled = () => { killEvents += 1; };
    assert.equal(Game.clearEnemyBulletsInRadius(15, 15, 200), 2);
    assert.equal(Game.objectPools.enemyBullets.active.includes(bullet), false);
    assert.equal(Game.objectPools.enemyBullets.active.includes(edge), false);
    assert.equal(Game.objectPools.enemyBullets.active.includes(far), true);
    assert.equal(enemy.health, 5);
    assert.equal(directEvents, 0);
    assert.equal(killEvents, 0);
});

test('Boss death emits bloodlust +16 exactly once even on re-entry', () => {
    resetCombat();
    Game.activeCard = 'bloodlust';
    Game.bossHealthBar = { style: {} };
    Game.summonIndicator = { style: {} };
    Game.bossWarning = { style: {} };
    Game.boss = { entityId: 6001, x: 0, y: 0, width: 30, height: 30, health: 1, maxHealth: 10, type: 0 };
    const realProgress = Game.addBloodlustProgress;
    let calls = 0;
    Game.addBloodlustProgress = function(value) {
        calls += 1;
        return realProgress.call(this, value);
    };
    try {
        Game.handleBossDeath();
        const meter = Game.bloodlustMeter;
        const lives = Game.lives;
        Game.handleBossDeath();
        assert.equal(calls, 1);
        assert.equal(meter, 0);
        assert.equal(Game.bloodlustMeter, meter);
        assert.equal(Game.lives, lives);
    } finally {
        Game.addBloodlustProgress = realProgress;
    }
});

test('fortress barrier has priority over actual damage and thorns does not consume it', () => {
    resetCombat();
    applyBuild('fortress_entry');
    Game.buildState.locks.fortressBarrier = true;
    Game.player.shieldTime = 0;
    Game.resolveEnemyBulletHit(makeEnemyBullet(10, 10));
    assert.equal(Game.lives, 3);
    assert.equal(Game.buildState.locks.fortressBarrier, false);

    Game.buildState.locks.fortressBarrier = true;
    Game.activeCard = 'thorns';
    const enemy = makeEnemy(1);
    Game.applyPlayerHit(1, 'enemyCollision');
    assert.equal(Game.lives, 2);
    assert.equal(Game.buildState.locks.fortressBarrier, true);
    assert.equal(Game.objectPools.enemies.active.includes(enemy), false);
});

test('temporal shield has priority over fortress barrier and does not consume it', () => {
    resetCombat();
    applyBuild('fortress_entry');
    Game.buildState.locks.fortressBarrier = true;
    Game.player.shieldTime = 2;
    Game.resolveEnemyBulletHit(makeEnemyBullet(10, 10));
    assert.equal(Game.lives, 3);
    assert.equal(Game.player.shieldTime, 2);
    assert.equal(Game.buildState.locks.fortressBarrier, true);
});

test('direct target identity and pierced bullet behavior remain terminal for Boss hits', () => {
    resetCombat();
    Game.isBossStage = true;
    Game.boss = { entityId: 5001, x: 0, y: 0, width: 30, height: 30, health: 10, maxHealth: 10, type: 0 };
    const pierced = makeBullet(11);
    pierced.pierceRemaining = 1;
    const later = makeBullet(12);
    Game.checkCollisions();
    assert.equal(Game.boss.health, 9);
    Game.checkCollisions();
    assert.equal(Game.boss.health, 8);
    assert.equal(Game.objectPools.bullets.active.includes(pierced), false);
    assert.equal(Game.objectPools.bullets.active.includes(later), false);
});
