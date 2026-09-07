import assert from 'node:assert/strict';
import test from 'node:test';
import { Game } from '../js/core/game.js';
import { CONFIG } from '../js/core/config.js';
import '../js/systems/builds.js';

function resetBuilds() {
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
    assert.equal(Game.getLegalBuildCandidates(() => 0).includes('rapid_wide'), true);
    assert.equal(Game.applyBuildChoice('rapid_wide', 'rapid_reignite'), true);
    assert.equal(Game.hasBuild('rapid_reignite'), false);
    assert.equal(Game.hasBuild('rapid_wide'), true);
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
