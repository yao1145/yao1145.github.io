import assert from 'node:assert/strict';
import test from 'node:test';
import { Game } from '../js/core/game.js';
import '../js/systems/builds.js';

const routeIds = {
    rapid: ['rapid_entry', 'rapid_reignite', 'rapid_wide', 'rapid_capstone'],
    fortress: ['fortress_entry', 'fortress_regroup', 'fortress_echo', 'fortress_capstone'],
    desperate: ['desperate_entry', 'desperate_clear', 'desperate_execute', 'desperate_capstone'],
    chain: ['chain_entry', 'chain_radius', 'chain_spread', 'chain_capstone'],
    hunter: ['hunter_entry', 'hunter_lock', 'hunter_execute', 'hunter_capstone'],
    supply: ['supply_entry', 'supply_magnet', 'supply_duration', 'supply_capstone'],
};

test('v2.1 build catalog contains the six four-node routes and migrated IDs', () => {
    const ids = Object.keys(Game.BUILDS);
    const expectedIds = Object.values(routeIds).flat();

    assert.equal(ids.length, 24);
    assert.deepEqual(ids, expectedIds);
    assert.deepEqual(ids.filter((id) => id.endsWith('_entry')).length, 6);
    assert.deepEqual(ids.filter((id) => id.endsWith('_capstone')).length, 6);
    for (const oldId of [
        'desperate_strike',
        'chain_wide',
        'chain_ignite',
        'hunter_stable',
        'supply_extended',
    ]) {
        assert.equal(Object.hasOwn(Game.BUILDS, oldId), false, `legacy ID remains: ${oldId}`);
    }
});

test('v2.1 build catalog preserves entry, exclusive branches, and capstone dependencies', () => {
    for (const [line, ids] of Object.entries(routeIds)) {
        const [entryId, branchAId, branchBId, capstoneId] = ids;
        const entry = Game.BUILDS[entryId];
        const branchA = Game.BUILDS[branchAId];
        const branchB = Game.BUILDS[branchBId];
        const capstone = Game.BUILDS[capstoneId];

        assert.equal(entry.line, line);
        assert.equal(entry.stage, 'entry');
        assert.deepEqual(entry.requires, []);
        assert.deepEqual(entry.excludes, []);

        assert.equal(branchA.stage, 'branch');
        assert.equal(branchB.stage, 'branch');
        assert.deepEqual(branchA.requires, [entryId]);
        assert.deepEqual(branchB.requires, [entryId]);
        assert.deepEqual(branchA.excludes, [branchBId]);
        assert.deepEqual(branchB.excludes, [branchAId]);

        assert.equal(capstone.stage, 'capstone');
        assert.deepEqual(capstone.requires, [entryId, [branchAId, branchBId]]);
        assert.deepEqual(capstone.excludes, []);
    }
});

test('v2.1 summaries describe the new thresholds and ranges', () => {
    const summaries = Object.values(Game.BUILDS).map(({ summary }) => summary).join('·');

    for (const forbiddenText of ['12次', '45px', '70px', '90px', '110px', '150px', '多代传播']) {
        assert.equal(summaries.includes(forbiddenText), false, `legacy tuning remains: ${forbiddenText}`);
    }
    for (const requiredText of ['8', '200px', '220px', '250px', '260px', '300px', '3000ms', '6秒']) {
        assert.equal(summaries.includes(requiredText), true, `v2.1 tuning is missing: ${requiredText}`);
    }
});

test('fog recommends fortress without changing build legality', () => {
    Game.resetBuildState();
    Game.activeCard = 'fog';

    const fogCandidates = Game.getLegalBuildCandidates(() => 0);
    assert.equal(fogCandidates[0], 'fortress_entry');
    assert.equal(Game.applyBuildChoice('rapid_entry'), true);

    Game.resetBuildState();
    Game.activeCard = null;
    const neutralCandidates = Game.getLegalBuildCandidates(() => 0);
    assert.deepEqual(new Set(fogCandidates), new Set(neutralCandidates));
    assert.equal(neutralCandidates.includes('fortress_entry'), true);
    assert.equal(Game.applyBuildChoice('fortress_entry'), true);
});

test('resetBuildState initializes the v2.1 route state schema', () => {
    Game.resetBuildState();

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
