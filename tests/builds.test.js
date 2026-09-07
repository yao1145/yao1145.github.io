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
