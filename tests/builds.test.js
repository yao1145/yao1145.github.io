import assert from 'node:assert/strict';
import test from 'node:test';
import { Game } from '../js/core/game.js';
import { CONFIG } from '../js/core/config.js';
import { resetGameFixture } from './helpers/game-fixture.js';
import '../js/systems/cards.js';
import '../js/systems/builds.js';
import '../js/systems/collisions.js';
import '../js/core/grid.js';

function resetBuilds() {
    Game.resetBuildState();
}

// Reward-flow fixture: stub the DOM-touching hooks like the card tests do.
function resetRewardFlow() {
    resetGameFixture();
    Game.player = { shotDelay: CONFIG.player.shotDelay };
    Game.updateUI = () => {};
    Game.enableControlArea = () => {};
    Game.resetBuildState();
}

test('build choices enforce dependencies, branch exclusion, and capstone progression', () => {
    resetBuilds();

    assert.equal(Game.applyBuildChoice('rapid_reignite'), false);
    assert.equal(Game.applyBuildChoice('rapid_entry'), true);
    assert.equal(Game.applyBuildChoice('rapid_reignite'), true);
    assert.equal(Game.applyBuildChoice('rapid_wide'), false);
    assert.equal(Game.applyBuildChoice('rapid_capstone'), true);
    assert.deepEqual(Game.buildState.owned, [
        'rapid_entry',
        'rapid_reignite',
        'rapid_capstone',
    ]);
});

test('build catalog contains four stages for each route with exact tuning', () => {
    assert.equal(Object.keys(Game.BUILDS).length, 24);
    assert.deepEqual(Object.keys(Game.BUILDS).sort(), [
        'chain_capstone', 'chain_entry', 'chain_radius', 'chain_spread',
        'desperate_capstone', 'desperate_clear', 'desperate_entry', 'desperate_execute',
        'fortress_capstone', 'fortress_echo', 'fortress_entry', 'fortress_regroup',
        'hunter_capstone', 'hunter_entry', 'hunter_execute', 'hunter_lock',
        'rapid_capstone', 'rapid_entry', 'rapid_reignite', 'rapid_wide',
        'supply_capstone', 'supply_duration', 'supply_entry', 'supply_magnet',
    ]);
    for (const oldId of ['desperate_strike', 'chain_wide', 'chain_ignite', 'hunter_stable', 'supply_extended']) {
        assert.equal(Object.hasOwn(Game.BUILDS, oldId), false, `legacy build id remains: ${oldId}`);
    }
    for (const line of ['rapid', 'fortress', 'desperate', 'chain', 'hunter', 'supply']) {
        const route = Object.values(Game.BUILDS).filter((build) => build.line === line);
        assert.equal(route.length, 4);
        assert.deepEqual(route.map((build) => build.stage), ['entry', 'branch', 'branch', 'capstone']);
        for (const build of route) {
            assert.deepEqual(Object.keys(build).sort(), [
                'cards', 'excludes', 'id', 'line', 'name', 'requires', 'stage', 'summary',
            ]);
            assert.equal(build.id.startsWith(`${line}_`), true);
            assert.equal(typeof build.name, 'string');
            assert.equal(typeof build.summary, 'string');
            assert.ok(Array.isArray(build.requires));
            assert.ok(Array.isArray(build.excludes));
            assert.ok(Array.isArray(build.cards));
        }
    }
    assert.deepEqual(CONFIG.builds, {
        maxOwned: 6,
        offerCount: 3,
        rapid: { hits: 8, decayMs: 2000, activeMs: 4000, strengthenEveryShots: 2, retainedHits: 4, basePierce: 1, widePierce: 2, primaryDamageBonus: 1, bossHitsForExtension: 6, extensionMs: 400, maxExtensionMs: 2000, maxActiveMs: 6000 },
        fortress: { chargeMs: 15000, regroupChargeMs: 12000, echoRadius: 200, echoDamage: 2, clearRadius: 250, clearCooldownMs: 10000 },
        desperate: { hits: 10, strikeMult: 2, executeMult: 3, executeHealthRatio: 0.35, clearRadius: 220, killsForHeal: 8, healsPerBossCycle: 1 },
        chain: { baseRadius: 200, baseDamage: 1, wideRadius: 260, spreadRadius: 220, spreadDamage: 0.5, maxGeneration: 1, capstoneKills: 3, capstoneRadius: 300 },
        hunter: { hits: 10, resetMs: 1200, strikeMult: 2, executeMult: 3, executeHealthRatio: 0.35, windowMs: 2000, windowMult: 2, lockMemoryMs: 3000, clearRadius: 200, clearCooldownMs: 6000, hitStopMs: 150 },
        supply: { pickups: 3, pulseMs: 4000, longPulseMs: 6000, maxPulseMs: 8000, pulseDamageBonus: 1, magnetRadius: 200, magnetSpeed: 0.75, fullHeartProgress: 2 },
    });
});

test('build stage state reports owned and available route stages', () => {
    resetBuilds();
    assert.deepEqual(Game.getBuildStageState('rapid'), {
        line: 'rapid',
        owned: [],
        available: ['rapid_entry'],
        complete: false,
    });

    Game.applyBuildChoice('rapid_entry');
    assert.deepEqual(Game.getBuildStageState('rapid'), {
        line: 'rapid',
        owned: ['rapid_entry'],
        available: ['rapid_reignite', 'rapid_wide'],
        complete: false,
    });
});

test('candidate generation prioritizes associated and invested routes, then fills legally', () => {
    resetBuilds();
    Game.activeCard = 'peace';
    Game.applyBuildChoice('rapid_entry');

    const candidates = Game.getLegalBuildCandidates(() => 0);
    assert.equal(candidates.length, CONFIG.builds.offerCount);
    assert.equal(candidates[0], 'fortress_entry');
    assert.equal(candidates[1], 'rapid_reignite');
    assert.equal(new Set(candidates).size, candidates.length);
    assert.ok(candidates.every((candidate) => Game.hasBuild(candidate) === false));
});

test('candidate allocation preserves every invested unfinished route before the associated route', () => {
    resetBuilds();
    Game.activeCard = 'supply';
    Game.buildState.owned = ['rapid_entry', 'fortress_entry', 'desperate_entry'];

    const candidates = Game.getLegalBuildCandidates(() => 0);

    assert.equal(candidates.length, CONFIG.builds.offerCount);
    assert.deepEqual(candidates, ['rapid_reignite', 'fortress_regroup', 'desperate_clear']);
    assert.equal(new Set(candidates).size, candidates.length);
    assert.equal(candidates.includes('supply_entry'), false);
});

test('completed routes do not consume candidate priority slots', () => {
    resetBuilds();
    Game.activeCard = 'fog';
    Game.buildState.owned = [
        'rapid_entry', 'rapid_reignite', 'rapid_capstone',
        'fortress_entry',
        'desperate_entry',
        'supply_entry',
    ];

    const candidates = Game.getLegalBuildCandidates(() => 0);

    assert.deepEqual(candidates, ['fortress_regroup', 'desperate_clear', 'supply_magnet']);
    assert.equal(candidates.some((id) => Game.BUILDS[id].line === 'rapid'), false);
});

test('candidate generation returns only the legal number when the pool is short or empty', () => {
    resetBuilds();
    Game.buildState.owned = Object.keys(Game.BUILDS);
    assert.deepEqual(Game.getLegalBuildCandidates(() => 0), []);
});

test('fog prioritizes fortress without changing the legal candidate pool', () => {
    resetBuilds();
    const previousOfferCount = CONFIG.builds.offerCount;
    try {
        // Expand the projection temporarily so this test compares the complete
        // legal pool rather than only the three visible offer slots.
        CONFIG.builds.offerCount = Object.keys(Game.BUILDS).length;
        Game.activeCard = 'fog';
        const fogCandidates = Game.getLegalBuildCandidates(() => 0.25);
        Game.activeCard = 'passion';
        const otherCandidates = Game.getLegalBuildCandidates(() => 0.25);

        assert.equal(fogCandidates[0], 'fortress_entry');
        assert.deepEqual([...fogCandidates].sort(), [...otherCandidates].sort());
        assert.ok(fogCandidates.every((id) => Game.BUILDS[id].stage === 'entry'));
    } finally {
        CONFIG.builds.offerCount = previousOfferCount;
    }
});

test('full build replacement is legal only for removable leaves and is atomic', () => {
    resetBuilds();
    for (const id of [
        'rapid_entry', 'rapid_reignite', 'rapid_capstone',
        'fortress_entry', 'fortress_regroup', 'fortress_capstone',
    ]) {
        assert.equal(Game.applyBuildChoice(id), true);
    }

    assert.deepEqual(Game.getLegalBuildRemovals('desperate_entry'), [
        'rapid_capstone',
        'fortress_capstone',
    ]);
    assert.equal(Game.applyBuildChoice('desperate_entry'), false);
    assert.equal(Game.applyBuildChoice('desperate_entry', 'rapid_capstone'), true);
    assert.equal(Game.buildState.owned.includes('rapid_capstone'), false);
    assert.equal(Game.buildState.owned.includes('desperate_entry'), true);

    const before = [...Game.buildState.owned];
    assert.equal(Game.applyBuildChoice('rapid_wide', 'fortress_entry'), false);
    assert.deepEqual(Game.buildState.owned, before);
});

test('full build replacement permits swapping mutually exclusive branches atomically', () => {
    resetBuilds();
    for (const id of [
        'rapid_entry', 'rapid_reignite',
        'fortress_entry', 'fortress_regroup', 'fortress_capstone',
        'supply_entry',
    ]) {
        assert.equal(Game.applyBuildChoice(id), true);
    }

    assert.deepEqual(Game.getLegalBuildRemovals('rapid_wide'), ['rapid_reignite']);
    assert.equal(Game.getLegalBuildCandidates(() => 0).includes('rapid_capstone'), true);
    assert.equal(Game.applyBuildChoice('rapid_wide', 'rapid_reignite'), true);
    assert.equal(Game.hasBuild('rapid_reignite'), false);
    assert.equal(Game.hasBuild('rapid_wide'), true);
});

test('full-slot candidates prefer a legal capstone over an alternate branch replacement', () => {
    resetBuilds();
    Game.activeCard = 'passion';
    Game.buildState.owned = [
        'rapid_entry', 'rapid_reignite',
        'fortress_entry', 'fortress_regroup', 'fortress_capstone',
        'supply_entry',
    ];

    const candidates = Game.getLegalBuildCandidates(() => 0);

    assert.equal(candidates[0], 'rapid_capstone');
    assert.equal(Game.getLegalBuildRemovals('rapid_capstone').length > 0, true);
    assert.equal(Game.getLegalBuildRemovals('rapid_wide').length > 0, true);
});

test('unassociated new-route entries use the supplied RNG for ordering', () => {
    resetBuilds();
    Game.activeCard = 'fog';

    const lowRandomCandidates = Game.getLegalBuildCandidates(() => 0);
    const highRandomCandidates = Game.getLegalBuildCandidates(() => 0.9999);

    assert.notDeepEqual(lowRandomCandidates, highRandomCandidates);
    for (const candidates of [lowRandomCandidates, highRandomCandidates]) {
        assert.equal(candidates.length, CONFIG.builds.offerCount);
        assert.equal(new Set(candidates).size, candidates.length);
        assert.equal(new Set(candidates.map((id) => Game.BUILDS[id].line)).size, candidates.length);
        assert.ok(candidates.every((id) => Game.BUILDS[id].stage === 'entry'));
    }
});

test('resetBuildState clears run state without resetting entity identity', () => {
    resetBuilds();
    const nextEntityId = Game.allocateEntityId();
    Game.buildState.owned.push('rapid_entry');
    Game.buildState.rewardCount = 2;
    Game.buildState.cycle = 4;

    Game.resetBuildState();

    assert.equal(Game.nextEntityId, nextEntityId);
    assert.deepEqual(Game.buildState.owned, []);
    assert.equal(Game.buildState.rewardCount, 0);
    assert.equal(Game.buildState.cycle, 0);
    assert.deepEqual(Game.buildState.timers, {
        rapidWarmup: 0,
        fortressBarrier: 0,
        fortressClearCooldown: 0,
        desperateClearCooldown: 0,
        chainShockCooldown: 0,
        hunterWindow: 0,
        hunterClearCooldown: 0,
        supplyPulse: 0,
    });
    assert.deepEqual(Game.buildState.counters, {
        rapidHits: 0,
        rapidLastHit: 0,
        rapidHeatupShots: 0,
        rapidBossHits: 0,
        rapidExtendedMs: 0,
        desperateHits: 0,
        desperateKills: 0,
        chainBlasts: 0,
        chainGeneration: 0,
        hunterLastHit: 0,
        supplyPickups: 0,
    });
    assert.deepEqual(Game.buildState.locks, {
        fortressBarrier: false,
        hunterTargetId: null,
        hunterHits: 0,
        desperateCycleHeal: false,
    });
    assert.deepEqual(Game.buildState.metrics, {});
});

test('build HUD exposes one stable row for every owned route and caps the visible rows at two', () => {
    resetBuilds();
    Game.activeCard = 'supply';
    Game.lives = 20;
    Game.buildState.owned = [
        'rapid_entry',
        'fortress_entry',
        'desperate_entry',
        'chain_entry',
        'hunter_entry',
        'supply_entry',
    ];

    const routeLines = ['rapid', 'fortress', 'desperate', 'chain', 'hunter', 'supply'];
    for (const line of routeLines) {
        resetBuilds();
        Game.activeCard = Game.BUILDS[`${line}_entry`].cards[0];
        Game.buildState.owned = [`${line}_entry`];
        const rows = Game.getBuildHudStates();
        assert.equal(rows.length, 1);
        assert.equal(rows[0].line, line);
    }

    resetBuilds();
    Game.activeCard = 'supply';
    Game.lives = 20;
    Game.buildState.owned = [
        'rapid_entry',
        'fortress_entry',
        'desperate_entry',
        'chain_entry',
        'hunter_entry',
        'supply_entry',
    ];
    Game.buildState.counters.supplyPickups = 1;
    const rows = Game.getBuildHudStates();
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((row) => row.line), ['supply', 'rapid']);
});

test('build HUD prioritizes active and near-trigger states before card association and route order', () => {
    resetBuilds();
    Game.activeCard = 'supply';
    Game.buildState.owned = ['rapid_entry', 'fortress_entry', 'supply_entry'];
    Game.buildState.counters.rapidHits = 1;
    Game.buildState.timers.supplyPulse = 500;

    assert.deepEqual(Game.getBuildHudStates().map((row) => row.line), ['supply', 'rapid']);

    Game.buildState.timers.supplyPulse = 0;
    Game.buildState.counters.rapidHits = 0;
    assert.deepEqual(Game.getBuildHudStates().map((row) => row.line), ['supply', 'rapid']);
});

test('build HUD countdowns use tenths, exposes cooldown disabled state, and keeps two rows', () => {
    resetBuilds();

    Game.buildState.owned = ['rapid_entry'];
    Game.buildState.timers.rapidWarmup = 1234;
    assert.deepEqual(Game.getBuildHudStates(), [{
        key: 'rapid', line: 'rapid', label: '热机', value: '1.2s/6.0s', active: true, cooldown: false, disabled: false,
    }]);

    resetBuilds();
    Game.buildState.owned = ['fortress_entry', 'fortress_capstone'];
    Game.buildState.timers.fortressBarrier = 1234;
    Game.buildState.timers.fortressClearCooldown = 1234;
    assert.deepEqual(Game.getBuildHudStates(), [{
        key: 'fortress', line: 'fortress', label: '屏障', value: '1.2s/15.0s', active: false, cooldown: true, disabled: true,
    }]);

    resetBuilds();
    Game.activeCard = 'fog';
    Game.buildState.owned = ['rapid_entry', 'fortress_entry', 'supply_entry'];
    const rows = Game.getBuildHudStates();
    assert.equal(rows.length, 2);
    assert.equal(rows[0].line, 'fortress');
    assert.equal(rows[1].line, 'rapid');
});

test('resetBuildState clears card history and all run-local contribution state', () => {
    resetBuilds();
    Game.cardHistory = [{ rewardIndex: 1, cardId: 'passion', kept: true }];
    Game.buildState.timers.rapidWarmup = 1000;
    Game.buildState.locks.hunterTargetId = 12;
    Game.buildState.metrics.chainKills = 3;

    Game.resetBuildState();

    assert.deepEqual(Game.cardHistory, []);
    assert.deepEqual(Game.buildState.timers, {
        rapidWarmup: 0,
        fortressBarrier: 0,
        fortressClearCooldown: 0,
        desperateClearCooldown: 0,
        chainShockCooldown: 0,
        hunterWindow: 0,
        hunterClearCooldown: 0,
        supplyPulse: 0,
    });
    assert.deepEqual(Game.buildState.locks, {
        fortressBarrier: false,
        hunterTargetId: null,
        hunterHits: 0,
        desperateCycleHeal: false,
    });
    assert.deepEqual(Game.buildState.metrics, {});
});

test('build events record fortress blocks, chain kills, and supply pulse coverage metrics', () => {
    resetBuilds();
    Game.player = { x: 0, y: 0, width: 10, height: 10 };
    const previousEnemies = Game.objectPools.enemies.active;
    const previousClearEnemyBullets = Game.clearEnemyBulletsInRadius;
    const previousShockwave = Game.createShockwave;
    Game.objectPools.enemies.active = [];
    Game.clearEnemyBulletsInRadius = () => {};
    Game.createShockwave = () => {};
    Game.buildState.owned = ['fortress_entry', 'supply_entry'];
    Game.buildState.locks.fortressBarrier = true;
    Game.onFortressBarrierConsumed();

    Game.buildState.timers.supplyPulse = 1000;
    Game.updateBuildEffects(400);

    assert.equal(Game.buildState.metrics.fortressBlocks, 1);
    assert.equal(Game.buildState.metrics.supplyPulseMs, 400);

    Game.buildState.timers.supplyPulse = 0;
    Game.onItemCollected({ spawnSource: 'natural', type: 1, healingAllowed: true, wasFull: false });
    Game.onItemCollected({ spawnSource: 'natural', type: 1, healingAllowed: true, wasFull: false });
    Game.onItemCollected({ spawnSource: 'natural', type: 1, healingAllowed: true, wasFull: false });
    assert.equal(Game.buildState.metrics.supplyPulseCount, 1);
    Game.objectPools.enemies.active = previousEnemies;
    Game.clearEnemyBulletsInRadius = previousClearEnemyBullets;
    Game.createShockwave = previousShockwave;
});

test('real enemy-bullet collision carries a fortress block into the run summary', () => {
    resetGameFixture();
    resetBuilds();
    Game.player = { x: 100, y: 100, width: 20, height: 20, shieldTime: 0 };
    Game.buildState.owned = ['fortress_entry'];
    Game.buildState.locks.fortressBarrier = true;
    Game.gameTime = 1000;

    const bullet = Game.getObject('enemyBullets');
    Object.assign(bullet, { x: 105, y: 105, width: 4, height: 4, canBeCleared: true });

    Game.checkCollisions();

    assert.equal(Game.objectPools.enemyBullets.active.includes(bullet), false);
    assert.equal(Game.buildState.locks.fortressBarrier, false);
    const summary = Game.renderRunSummary();
    assert.equal(summary.metrics.fortressBlocks, 1);
    assert.equal(summary.contributions.fortressBlocks, 1);
});

test('chain explosions record each settled chain kill in run metrics', () => {
    resetGameFixture();
    resetBuilds();
    Game.buildState.owned = ['chain_entry'];
    const enemy = {
        entityId: 1,
        x: -5,
        y: -5,
        width: 10,
        height: 10,
        health: 0.5,
        maxHealth: 0.5,
        _dead: false,
    };
    Game.objectPools.enemies.active.push(enemy);
    const previousGrid = Game.spatialGrid;
    const previousKillEnemy = Game.killEnemy;
    const previousExplosion = Game.createExplosion;
    const previousShockwave = Game.createShockwave;
    Game.spatialGrid = { getWithinRadius: () => [{ poolType: 'enemies', obj: enemy }] };
    Game.killEnemy = (target) => { target._dead = true; };
    Game.createExplosion = () => {};
    Game.createShockwave = () => {};

    try {
        Game.createDamageExplosion({ x: 0, y: 0, damage: 1 });
        assert.equal(Game.buildState.metrics.chainKills, 1);
    } finally {
        Game.spatialGrid = previousGrid;
        Game.killEnemy = previousKillEnemy;
        Game.createExplosion = previousExplosion;
        Game.createShockwave = previousShockwave;
    }
});

test('all six routes emit serializable trigger, damage, clear, heal, pickup, and coverage metrics', () => {
    resetGameFixture();
    resetBuilds();
    Game.activeCard = 'comeback';
    Game.lives = 1;
    Game.player = { x: 0, y: 0, width: 10, height: 10 };
    Game.buildState.owned = [
        'rapid_entry', 'rapid_reignite', 'rapid_capstone',
        'fortress_entry', 'fortress_echo', 'fortress_capstone',
        'desperate_entry', 'desperate_clear', 'desperate_capstone',
        'chain_entry', 'chain_radius', 'chain_capstone',
        'hunter_entry', 'hunter_lock', 'hunter_capstone',
        'supply_entry', 'supply_magnet', 'supply_capstone',
    ];

    const previous = {
        clearEnemyBulletsInRadius: Game.clearEnemyBulletsInRadius,
        applyCombatDamage: Game.applyCombatDamage,
        createExplosion: Game.createExplosion,
        createShockwave: Game.createShockwave,
        requestVisualHitStop: Game.requestVisualHitStop,
        resolveLiveTarget: Game.resolveLiveTarget,
        spatialGrid: Game.spatialGrid,
    };
    const target = {
        entityId: 9001,
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        health: 100,
        maxHealth: 100,
        _dead: false,
    };
    const chainEnemies = [1, 2, 3].map((entityId) => ({
        entityId,
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        health: 1,
        maxHealth: 1,
        _dead: false,
    }));

    try {
        Game.objectPools.enemies.active = [target];
        Game.clearEnemyBulletsInRadius = () => 3;
        Game.applyCombatDamage = (entity, targetType, amount, source) => {
            if (source === 'explosion') entity.health = 0;
            return true;
        };
        Game.createExplosion = () => {};
        Game.createShockwave = () => {};
        Game.requestVisualHitStop = () => {};
        Game.resolveLiveTarget = () => target;

        // Rapid: eight unique direct batches enter the 4-second warmup.
        for (let shotId = 1; shotId <= CONFIG.builds.rapid.hits; shotId++) {
            Game.onDirectShotBatch({
                shotId,
                events: [{ shotId, targetType: 'enemy', entityId: 1000 + shotId, baseDamage: 1 }],
            });
        }
        assert.equal(Game.buildState.metrics.rapidActivations, 1);

        // Fortress: barrier consumption records both retaliation and clears.
        Game.buildState.locks.fortressBarrier = true;
        Game.onFortressBarrierConsumed();
        assert.equal(Game.buildState.metrics.fortressBlocks, 1);
        assert.equal(Game.buildState.metrics.fortressBulletClears, 3);

        // Chain: three unique explosion kills settle one capstone clear.
        Game.objectPools.enemies.active = chainEnemies;
        Game.spatialGrid = { getWithinRadius: () => chainEnemies.map((obj) => ({ poolType: 'enemies', obj })) };
        Game.createDamageExplosion({ x: 5, y: 5 });
        assert.equal(Game.buildState.metrics.chainKills, 3);
        assert.equal(Game.buildState.metrics.chainBulletClears, 3);

        // Hunter and desperate consume the same direct D, each once per ten shots.
        Game.objectPools.enemies.active = [target];
        for (let shotId = 101; shotId <= 110; shotId++) {
            Game.onDirectShotBatch({
                shotId,
                events: [{ shotId, targetType: 'enemy', entityId: target.entityId, baseDamage: 1 }],
            });
        }
        assert.equal(Game.buildState.metrics.hunterPrecisionDamage, 2);
        assert.equal(Game.buildState.metrics.desperateStrikeDamage, 2);
        assert.equal(Game.buildState.metrics.hunterBulletClears, 3);
        assert.equal(Game.buildState.metrics.desperateBulletClears, 3);

        // Supply: natural and magnet-attributed pickups start a pulse; elapsed
        // pulse time is recorded as coverage rather than altering item rate.
        Game.onItemCollected({ spawnSource: 'natural', type: 1 });
        Game.onItemCollected({ spawnSource: 'natural', type: 1, collectedByMagnet: true });
        Game.onItemCollected({ spawnSource: 'natural', type: 1 });
        Game.onItemCollected({ spawnSource: 'natural', type: 1 });
        Game.updateBuildEffects(400);
        assert.equal(Game.buildState.metrics.supplyNaturalPickups, 4);
        assert.equal(Game.buildState.metrics.supplyMagnetPickups, 1);
        assert.equal(Game.buildState.metrics.supplyPulseCount, 1);
        assert.equal(Game.buildState.metrics.supplyPulseMs, 400);

        // Desperate capstone healing uses the regular life-gain entry point.
        Game.buildState.counters.desperateKills = 0;
        Game.buildState.locks.desperateCycleHeal = false;
        for (let kill = 0; kill < CONFIG.builds.desperate.killsForHeal; kill++) {
            Game.desperateOnKill({ source: 'direct', targetType: 'enemy', entityId: 2000 + kill });
        }
        assert.equal(Game.buildState.metrics.effectiveHealing, 1);

        Game.gameTime = 2000;
        Game.cardHistory = [{ rewardIndex: 0, cardId: 'comeback', name: '绝地反击', kept: true }];
        const summary = Game.renderRunSummary();
        assert.equal(summary.contributions.rapidActivations, 1);
        assert.equal(summary.contributions.fortressBlocks, 1);
        assert.equal(summary.contributions.chainKills, 3);
        assert.equal(summary.contributions.hunterPrecisionDamage, 2);
        assert.equal(summary.contributions.desperateStrikeDamage, 2);
        assert.equal(summary.contributions.effectiveHealing, 1);
        assert.equal(summary.contributions.supplyNaturalPickups, 4);
        assert.equal(summary.contributions.supplyMagnetPickups, 1);
        assert.equal(summary.contributions.supplyPulseCoverage, 0.2);
        assert.doesNotThrow(() => JSON.stringify(Game.buildState));
        assert.doesNotThrow(() => JSON.stringify(summary));
    } finally {
        Object.assign(Game, previous);
    }
});

test('renderRunSummary returns a headless model with card history, builds, and contributions', () => {
    resetBuilds();
    Game.activeCard = 'passion';
    Game.gameTime = 2000;
    Game.score = 240;
    Game.crowns = 1;
    Game.cardHistory = [
        { rewardIndex: 0, cardId: 'passion', name: '激情岁月', kept: true },
        { rewardIndex: 1, cardId: 'blitz', name: '电光火石', kept: false },
    ];
    Game.buildState.owned = ['rapid_entry', 'fortress_entry'];
    Game.buildState.metrics = {
        fortressBlocks: 2,
        chainKills: 4,
        hunterPrecisionDamage: 6,
        supplyPulseMs: 500,
        supplyPulseCount: 1,
    };

    const summary = Game.renderRunSummary();

    assert.deepEqual(summary.cardHistory, Game.cardHistory);
    assert.deepEqual(summary.builds.map((build) => build.id), ['rapid_entry', 'fortress_entry']);
    assert.equal(summary.contributions.fortressBlocks, 2);
    assert.equal(summary.contributions.chainKills, 4);
    assert.equal(summary.contributions.hunterPrecisionDamage, 6);
    assert.equal(summary.contributions.supplyPulseCoverage, 0.25);
});

test('renderRunSummary updates #runSummaryBody when a DOM target exists', () => {
    resetBuilds();
    const body = { innerHTML: '' };
    const previousDocument = globalThis.document;
    globalThis.document = {
        getElementById(id) {
            return id === 'runSummaryBody' ? body : null;
        },
    };

    try {
        Game.cardHistory = [{ rewardIndex: 0, cardId: 'peace', name: '平安无事', kept: true }];
        Game.gameTime = 1000;
        Game.buildState.metrics = {
            fortressBlocks: 2,
            bonusDamage: 3,
            fortressBulletClears: 1,
            effectiveHealing: 1,
            supplyNaturalPickups: 4,
            supplyMagnetPickups: 1,
            supplyPulseMs: 400,
        };
        Game.renderRunSummary();
        assert.match(body.innerHTML, /平安无事/);
        assert.match(body.innerHTML, /强化贡献/);
        assert.match(body.innerHTML, /屏障阻挡/);
        assert.match(body.innerHTML, /额外伤害/);
        assert.match(body.innerHTML, /清弹数/);
        assert.match(body.innerHTML, /有效回血/);
        assert.match(body.innerHTML, /自然\/牵引拾取/);
        assert.match(body.innerHTML, /40\.0%/);
    } finally {
        globalThis.document = previousDocument;
    }
});

test('game-over summary survives gameOver and clears when returning to the menu', () => {
    resetGameFixture();
    resetBuilds();
    Game.runSummary = null;

    const previousDocument = globalThis.document;
    const previousLocalStorage = globalThis.localStorage;
    const previousHooks = {
        cardIndicator: Game.cardIndicator,
        bossHealthBar: Game.bossHealthBar,
        bossWarning: Game.bossWarning,
        summonIndicator: Game.summonIndicator,
        shieldIndicator: Game.shieldIndicator,
        attackIndicator: Game.attackIndicator,
        updateMainPanel: Game.updateMainPanel,
        enableControlArea: Game.enableControlArea,
        clearAllPools: Game.clearAllPools,
    };
    const createElement = () => ({ style: {}, textContent: '' });

    globalThis.document = {
        getElementById: () => createElement(),
        querySelector: () => createElement(),
    };
    globalThis.localStorage = {
        getItem: () => null,
        setItem: () => {},
    };
    Game.cardIndicator = createElement();
    Game.bossHealthBar = createElement();
    Game.bossWarning = createElement();
    Game.summonIndicator = createElement();
    Game.shieldIndicator = createElement();
    Game.attackIndicator = createElement();
    Game.updateMainPanel = () => {};
    Game.enableControlArea = () => {};
    Game.clearAllPools = () => {};

    try {
        Game.cardHistory = [{ rewardIndex: 0, cardId: 'peace', name: '平安无事', kept: true }];
        Game.buildState.owned = ['fortress_entry'];
        Game.gameOver();

        assert.ok(Game.runSummary);
        assert.deepEqual(Game.runSummary.cardHistory, Game.cardHistory);

        Game.returnToMainMenu();
        assert.equal(Game.runSummary, null);
    } finally {
        globalThis.document = previousDocument;
        globalThis.localStorage = previousLocalStorage;
        Object.assign(Game, previousHooks);
    }
});

// --- Two-stage boss reward flow (core card -> build -> summary) ---

test('reward flow advances core -> build -> summary and only the summary resumes', () => {
    resetRewardFlow();
    Game.activeCard = 'passion';
    Game.beginRewardFlow(false);
    assert.equal(Game.rewardFlow.phase, 'core');
    assert.equal(Game.isCardSelectionOpen, true);
    assert.equal(Game.isRunning, false);

    assert.equal(Game.completeCoreCardSelection('passion'), true);
    assert.equal(Game.rewardFlow.phase, 'build');
    assert.equal(Game.isRunning, false);
    assert.equal(Game.isCardSelectionOpen, false);

    assert.equal(Game.selectBuild('rapid_entry'), true);
    assert.equal(Game.rewardFlow.phase, 'summary');
    assert.equal(Game.isRunning, false);
    assert.equal(Game.hasBuild('rapid_entry'), true);

    Game.finishRewardFlow();
    assert.equal(Game.rewardFlow, null);
    assert.equal(Game.isRunning, true);
});

test('game-start core selection without a reward flow resumes the simulation', () => {
    resetRewardFlow();
    Game.isCardSelectionOpen = true;
    Game.cardSelectionModel = { options: ['peace'] };

    assert.equal(Game.completeCoreCardSelection('peace'), true);
    assert.equal(Game.rewardFlow, null);
    assert.equal(Game.isRunning, true);
});

test('an empty build pool skips the build step and shows the summary', () => {
    resetRewardFlow();
    Game.activeCard = 'peace';
    Game.buildState.owned = Object.keys(Game.BUILDS);
    Game.beginRewardFlow(false);

    assert.equal(Game.completeCoreCardSelection('peace'), true);
    assert.equal(Game.rewardFlow.phase, 'summary');
    assert.equal(Game.isRunning, false);

    Game.finishRewardFlow();
    assert.equal(Game.isRunning, true);
});

test('a full build list enters replacement mode before the summary', () => {
    resetRewardFlow();
    Game.activeCard = 'peace';
    Game.buildState.owned = [
        'rapid_entry', 'rapid_reignite', 'rapid_capstone',
        'fortress_entry', 'fortress_regroup', 'fortress_capstone',
    ];
    Game.beginRewardFlow(false);
    Game.completeCoreCardSelection('peace');
    assert.equal(Game.rewardFlow.phase, 'build');

    // The offer is randomized; arm replacement mode with whichever candidate
    // came up first and swap out one of its legal removals.
    const candidate = Game.rewardFlow.candidates[0];
    assert.equal(Game.selectBuild(candidate), true);
    assert.equal(Game.rewardFlow.phase, 'build');
    assert.equal(Game.rewardFlow.pendingCandidate, candidate);
    const removals = Game.getLegalBuildRemovals(candidate);
    assert.ok(removals.length > 0);

    assert.equal(Game.selectBuildReplacement(removals[0]), true);
    assert.equal(Game.rewardFlow.phase, 'summary');
    assert.equal(Game.hasBuild(candidate), true);
    assert.equal(Game.hasBuild(removals[0]), false);

    Game.finishRewardFlow();
    assert.equal(Game.isRunning, true);
});

test('skipping the build step shows the summary without granting a build', () => {
    resetRewardFlow();
    Game.activeCard = 'peace';
    Game.beginRewardFlow(false);
    Game.completeCoreCardSelection('peace');

    assert.equal(Game.skipBuildSelection(), true);
    assert.equal(Game.rewardFlow.phase, 'summary');
    assert.equal(Game.buildState.rewardCount, 0);
    assert.deepEqual(Game.buildState.owned, []);

    Game.finishRewardFlow();
    assert.equal(Game.isRunning, true);
});

test('reward flow owns the pause state and clears the accumulator on finish', () => {
    resetRewardFlow();
    Game.activeCard = 'peace';
    Game.accumulator = 40;
    Game.beginRewardFlow(false);
    assert.equal(Game.accumulator, 0);

    // Pause key is inert while a reward flow is active.
    Game.togglePause();
    assert.equal(Game.isRunning, false);

    Game.completeCoreCardSelection('peace');
    Game.selectBuild('fortress_entry');
    Game.finishRewardFlow();
    assert.equal(Game.accumulator, 0);
    assert.equal(Game.isRunning, true);
});

test('boss death starts a new cycle, clears the desperate lock, and opens the flow', () => {
    resetRewardFlow();
    Game.activeCard = 'peace';
    Game.isRunning = true;
    Game.buildState.cycle = 2;
    Game.buildState.locks.desperateCycleHeal = true;
    Game.boss = { health: 0, maxHealth: 100 };
    Game.bossHealthBar = { style: {} };
    Game.summonIndicator = { style: {} };
    Game.bossWarning = { style: {} };

    Game.handleBossDeath();

    assert.equal(Game.boss, null);
    assert.equal(Game.crowns, 1);
    assert.equal(Game.buildState.cycle, 3);
    assert.equal(Game.buildState.locks.desperateCycleHeal, false);
    assert.equal(Game.isBossStage, false);
    assert.equal(Game.rewardFlow.phase, 'core');
    assert.equal(Game.isRunning, false);
});

test('boss reward flow suppresses threshold spawning until the summary finishes', () => {
    resetRewardFlow();
    Game.activeCard = 'peace';
    Game.score = 5000;
    Game.bossSpawnThreshold = 1000;
    Game.bossSpawnGap = 1000;
    Game.isRunning = true;
    Game.boss = { entityId: 7002, health: 0, maxHealth: 100 };
    Game.bossHealthBar = { style: {} };
    Game.summonIndicator = { style: {} };
    Game.bossWarning = { style: {} };

    const previousSpawnBoss = Game.spawnBoss;
    let spawnCount = 0;
    Game.spawnBoss = () => {
        spawnCount++;
        Game.isBossStage = true;
    };

    try {
        Game.handleBossDeath();
        Game.updateGameState();
        assert.equal(spawnCount, 0);
        assert.equal(Game.rewardFlow.phase, 'core');

        assert.equal(Game.completeCoreCardSelection('peace'), true);
        Game.updateGameState();
        assert.equal(spawnCount, 0);
        assert.equal(Game.rewardFlow.phase, 'build');

        assert.equal(Game.selectBuild(Game.rewardFlow.candidates[0]), true);
        Game.updateGameState();
        assert.equal(spawnCount, 0);
        assert.equal(Game.rewardFlow.phase, 'summary');

        Game.finishRewardFlow();
        Game.updateGameState();
        assert.equal(spawnCount, 1);
    } finally {
        Game.spawnBoss = previousSpawnBoss;
    }
});
