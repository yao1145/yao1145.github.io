import assert from 'node:assert/strict';
import test from 'node:test';
import { Game } from '../js/core/game.js';
import { CONFIG } from '../js/core/config.js';
import '../js/core/pools.js';
import '../js/systems/cards.js';
import '../js/entities/enemyBullets.js';

const expectedCards = {
    survivalPlayerRate: 0.75,
    survivalHealMs: 20000,
    comebackMult: 2,
    comebackMaxLives: 2,
    speedMult: 2,
    switchCost: 1,
    bulletCountBonus: 1,
    bulletSpeedMult: 1.5,
    peacePlayerRate: 0.8,
    peaceEnemyRate: 0.65,
    bloodlustPlayerRate: 0.75,
    bloodlustKillsPerLife: 8,
    bloodlustBossProgress: 16,
    chainSpawnMult: 1.3,
    glassDamageMult: 2,
    glassShotSpeedMult: 1.5,
    bossDamageMult: 3,
    mobDamageMult: 0.5,
    thornsRadius: 200,
    thornsBossFrac: 0.1,
    thornsBulletSpeedMult: 2,
    supplyItemMult: 1.5,
    supplyEnemyShotMult: 1.5,
    fogBulletSpeed: 0.8,
    fogLineRatio: 0.35,
    fogFadePx: 40,
    fogWarningBandPx: 40,
    fogWarningDurationMs: 250,
    boostHeartHeal: 2,
    boostDamageTime: 15,
    boostShieldTime: 10,
    boostHitLoss: 2,
    cardMaxPicks: 3,
};

const expectedBuilds = {
    maxOwned: 6,
    offerCount: 3,
    rapid: {
        hits: 8,
        decayMs: 2000,
        activeMs: 4000,
        strengthenEveryShots: 2,
        retainedHits: 4,
        basePierce: 1,
        widePierce: 2,
        primaryDamageBonus: 1,
        bossHitsForExtension: 6,
        extensionMs: 400,
        maxExtensionMs: 2000,
        maxActiveMs: 6000,
    },
    fortress: {
        chargeMs: 15000,
        regroupChargeMs: 12000,
        echoRadius: 200,
        echoDamage: 2,
        clearRadius: 250,
        clearCooldownMs: 10000,
    },
    desperate: {
        hits: 10,
        strikeMult: 2,
        executeMult: 3,
        executeHealthRatio: 0.35,
        clearRadius: 220,
        killsForHeal: 8,
        healsPerBossCycle: 1,
    },
    chain: {
        baseRadius: 200,
        baseDamage: 1,
        wideRadius: 260,
        spreadRadius: 220,
        spreadDamage: 0.5,
        maxGeneration: 1,
        capstoneKills: 3,
        capstoneRadius: 300,
    },
    hunter: {
        hits: 10,
        resetMs: 1200,
        strikeMult: 2,
        executeMult: 3,
        executeHealthRatio: 0.35,
        windowMs: 2000,
        windowMult: 2,
        lockMemoryMs: 3000,
        clearRadius: 200,
        clearCooldownMs: 6000,
        hitStopMs: 150,
    },
    supply: {
        pickups: 3,
        pulseMs: 4000,
        longPulseMs: 6000,
        maxPulseMs: 8000,
        pulseDamageBonus: 1,
        magnetRadius: 200,
        magnetSpeed: 0.75,
        fullHeartProgress: 2,
    },
};

test('v2.1 core-card tuning is exact and contains no legacy fields', () => {
    assert.deepEqual(CONFIG.cards, expectedCards);
});

test('v2.1 route tuning is exact and contains no legacy fields', () => {
    assert.deepEqual(CONFIG.builds, expectedBuilds);
});

test('v2.3 enemy projectile capacity and volley cap are expanded', () => {
    assert.equal(CONFIG.poolMaxSize.enemyBullets, 1000);
    assert.equal(CONFIG.patternSpacingMax, 64);
    assert.equal(Game.objectPools.enemyBullets.maxSize, 1000);

    Game.difficulty = 'hard';
    assert.equal(Game.scaledBulletCount(8, CONFIG.patternSpacingRef * 100), 64);
});
