import assert from 'node:assert/strict';
import test from 'node:test';
import { Game } from '../js/core/game.js';
import { CONFIG } from '../js/core/config.js';
import { resetGameFixture } from './helpers/game-fixture.js';
import '../js/systems/cards.js';
import '../js/systems/builds.js';
import '../js/systems/collisions.js';

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
        rapid: { hits: 12, decayMs: 1500, activeMs: 3000, retainedHits: 4, basePierce: 1, widePierce: 2, killExtensionMs: 300, maxExtensionMs: 1500 },
        fortress: { chargeMs: 15000, regroupChargeMs: 12000, echoRadius: 70, echoDamage: 1, clearRadius: 70, clearCooldownMs: 10000 },
        desperate: { maxLifeRatio: 1 / 3, minimumMaxLives: 3, hits: 12, strikeMult: 2, executeMult: 3, executeHealthRatio: 0.3, clearRadius: 45, clearCooldownMs: 8000, killsForHeal: 8 },
        chain: { seedRadius: 45, wideBonusRadius: 15, seedDamageMult: 0.5, bossDamageMult: 0.5, buildMaxDepth: 2, buildMaxExplosions: 12, shockKills: 3, shockRadius: 60, shockCooldownMs: 5000 },
        hunter: { hits: 10, resetMs: 1200, stableResetMs: 2000, strikeMult: 2, executeMult: 3, executeHealthRatio: 0.3, windowMs: 2000, windowMult: 2 },
        supply: { pickups: 3, pulseMs: 4000, extendedPulseMs: 6000, durationCapMs: 8000, primaryDamageBonus: 0.5, magnetRadius: 70, magnetSpeed: 0.75, fullHealthHeartProgress: 2 },
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
    assert.deepEqual(candidates, ['rapid_reignite', 'fortress_regroup', 'desperate_strike']);
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

    assert.deepEqual(candidates, ['fortress_regroup', 'desperate_strike', 'supply_magnet']);
    assert.equal(candidates.some((id) => Game.BUILDS[id].line === 'rapid'), false);
});

test('candidate generation returns only the legal number when the pool is short or empty', () => {
    resetBuilds();
    Game.buildState.owned = Object.keys(Game.BUILDS);
    assert.deepEqual(Game.getLegalBuildCandidates(() => 0), []);
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
        supplyPulse: 0,
    });
    assert.deepEqual(Game.buildState.counters, {});
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
        Game.renderRunSummary();
        assert.match(body.innerHTML, /平安无事/);
        assert.match(body.innerHTML, /强化贡献/);
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
