import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { Game } from '../js/core/game.js';
import { CONFIG } from '../js/core/config.js';
import { resetGameFixture } from './helpers/game-fixture.js';
import '../js/core/pools.js';
import '../js/systems/cards.js';
import '../js/systems/builds.js';

const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const hudCss = fs.readFileSync(new URL('../css/ui/hud.css', import.meta.url), 'utf8');
const cardsCss = fs.readFileSync(new URL('../css/ui/cards.css', import.meta.url), 'utf8');
const responsiveCss = fs.readFileSync(new URL('../css/responsive/responsive.css', import.meta.url), 'utf8');

test('run fixture clears card, route, reward, and visual state without resetting monotonic ids', () => {
    const nextEntityId = Game.allocateEntityId();
    const nextShotId = (Game.nextShotId || 0) + 11;
    const nextChainId = (Game.nextChainId || 0) + 7;
    Game.nextShotId = nextShotId;
    Game.nextChainId = nextChainId;
    Object.assign(Game, {
        cardRegenTimer: 1234,
        bloodlustMeter: 7,
        visualHitStopUntil: 999999,
        rewardFlow: { phase: 'summary' },
        isBuildSelectionOpen: true,
        isRewardSummaryOpen: true,
    });
    Game.buildState.timers.rapidWarmup = 4000;
    Game.buildState.counters.rapidHits = 8;
    Game.buildState.locks.hunterTargetId = 42;
    Game.buildState.metrics = { chainKills: 3 };

    resetGameFixture();

    assert.equal(Game.cardRegenTimer, 0);
    assert.equal(Game.bloodlustMeter, 0);
    assert.equal(Game.visualHitStopUntil, 0);
    assert.equal(Game.rewardFlow, null);
    assert.equal(Game.isBuildSelectionOpen, false);
    assert.equal(Game.isRewardSummaryOpen, false);
    assert.equal(Game.buildState.timers.rapidWarmup, 0);
    assert.equal(Game.buildState.counters.rapidHits, 0);
    assert.equal(Game.buildState.locks.hunterTargetId, null);
    assert.deepEqual(Game.buildState.metrics, {});
    assert.equal(Game.nextEntityId, nextEntityId);
    assert.equal(Game.nextShotId, nextShotId);
    assert.equal(Game.nextChainId, nextChainId);
    assert.equal(CONFIG.cards.survivalHealMs, 20000);
});

test('production new-run reset removes every previous run card, build, queue, and input state', () => {
    Game.activeCard = 'chain';
    Game.cardPickCount = { chain: 3 };
    Game.cardHistory = [{ cardId: 'chain' }];
    Game.cardSelectionModel = { options: ['chain'] };
    Game.cardSelectionRewardIndex = 4;
    Game.cardRegenTimer = 9000;
    Game.bloodlustMeter = 7;
    Game.buildState.owned = ['chain_entry', 'chain_radius'];
    Game.buildState.timers.chainShockCooldown = 5000;
    Game.buildState.metrics.chainKills = 12;
    Game.rewardFlow = { phase: 'build' };
    Game.isCardSelectionOpen = true;
    Game.isBuildSelectionOpen = true;
    Game.isRewardSummaryOpen = true;
    Game.runSummary = { ownedBuilds: [{ id: 'chain_entry' }] };
    Game.directHitQueue = [{ shotId: 99 }];
    Game.keys = { w: true, ' ': true };
    Game.touch = { isTouching: true, startX: 5, startY: 6, currentX: 7, currentY: 8 };
    Game.lastUIUpdateTime = 12345;

    Game.resetRunState();

    assert.equal(Game.activeCard, null);
    assert.deepEqual(Game.cardPickCount, {});
    assert.deepEqual(Game.cardHistory, []);
    assert.equal(Game.cardSelectionModel, null);
    assert.equal(Game.cardSelectionRewardIndex, 0);
    assert.equal(Game.cardRegenTimer, 0);
    assert.equal(Game.bloodlustMeter, 0);
    assert.deepEqual(Game.buildState.owned, []);
    assert.equal(Game.buildState.timers.chainShockCooldown, 0);
    assert.deepEqual(Game.buildState.metrics, {});
    assert.equal(Game.rewardFlow, null);
    assert.equal(Game.isCardSelectionOpen, false);
    assert.equal(Game.isBuildSelectionOpen, false);
    assert.equal(Game.isRewardSummaryOpen, false);
    assert.equal(Game.runSummary, null);
    assert.deepEqual(Game.directHitQueue, []);
    assert.deepEqual(Game.keys, {});
    assert.deepEqual(Game.touch, {
        isTouching: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
    });
    assert.equal(Game.lastUIUpdateTime, 0);
});

test('delayed combat work from an abandoned run cannot affect the next run', () => {
    const originalSetTimeout = globalThis.setTimeout;
    const callbacks = [];
    globalThis.setTimeout = (callback) => {
        callbacks.push(callback);
        return callbacks.length;
    };
    try {
        let mutations = 0;
        Game.scheduleRunTask(() => { mutations += 1; }, 100);
        Game.resetRunState();
        callbacks.shift()();
        assert.equal(mutations, 0);

        Game.scheduleRunTask(() => { mutations += 1; }, 100);
        callbacks.shift()();
        assert.equal(mutations, 1);
    } finally {
        globalThis.setTimeout = originalSetTimeout;
    }
});

test('startGame uses the production reset before opening a fresh card selection', () => {
    const original = {
        badgeLoad: Game.badgeLoad,
        player: Game.player,
        enableControlArea: Game.enableControlArea,
    };
    try {
        Game.badgeLoad = { status: 'ready' };
        Game.player = { width: CONFIG.player.width, height: CONFIG.player.height };
        Game.enableControlArea = () => {};
        Game.activeCard = 'glass';
        Game.cardPickCount = { glass: 3 };
        Game.cardHistory = [{ cardId: 'glass' }];
        Game.buildState.owned = ['hunter_entry'];
        Game.buildState.metrics = { hunterPrecisionDamage: 40 };
        Game.directHitQueue = [{ shotId: 17 }];
        Game.runSummary = { activeCard: { id: 'glass' } };

        Game.startGame();

        assert.equal(Game.activeCard, null);
        assert.deepEqual(Game.cardPickCount, {});
        assert.deepEqual(Game.cardHistory, []);
        assert.deepEqual(Game.buildState.owned, []);
        assert.deepEqual(Game.buildState.metrics, {});
        assert.deepEqual(Game.directHitQueue, []);
        assert.equal(Game.runSummary, null);
        assert.equal(Game.isCardSelectionOpen, true);
        assert.equal(Game.cardSelectionRewardIndex, 0);
        assert.ok(Array.isArray(Game.cardSelectionModel.options));
    } finally {
        Game.badgeLoad = original.badgeLoad;
        Game.player = original.player;
        Game.enableControlArea = original.enableControlArea;
        resetGameFixture();
    }
});

test('lifecycle methods clear visual state and updateUI is headless-safe', () => {
    const source = fs.readFileSync(new URL('../js/core/game.js', import.meta.url), 'utf8');
    assert.match(source, /startGame[\s\S]*resetRunState/);
    assert.match(source, /returnToMainMenu[\s\S]*resetRunState/);
    assert.match(source, /resizeCanvas[\s\S]*clearVisualState/);

    const originalDocument = globalThis.document;
    try {
        delete globalThis.document;
        assert.doesNotThrow(() => Game.updateUI(true));
        assert.doesNotThrow(() => Game.updateMainPanel());
    } finally {
        if (originalDocument === undefined) delete globalThis.document;
        else globalThis.document = originalDocument;
    }
});

test('static card and route copy exposes v2.3 tradeoffs and compact HUD markup', () => {
    for (const forbiddenText of [
        '无效果', '伤害减半', '概率回复', '命中12次', '命中 12 次',
        '70px', '90px', '110px', '150px',
    ]) {
        assert.equal(indexHtml.includes(forbiddenText), false, `legacy copy remains: ${forbiddenText}`);
    }
    for (const requiredText of [
        '敌人射速×0.65', '自身射速×0.80', '每20s回1命', 'Boss首次+16',
        '敌弹速度×0.80', '追踪弹永久失效', '200px', '220px', '250px', '260px', '300px',
        '5000ms', '6000ms', '10000ms', '8秒',
    ]) {
        assert.equal(indexHtml.includes(requiredText), true, `v2.1 copy missing: ${requiredText}`);
    }
    assert.match(indexHtml, /id="cardEffectHud"/);
    assert.match(indexHtml, /id="statusStack"[^>]*aria-label="战斗状态"/);
    assert.match(hudCss, /\.cardEffectHud/);
    assert.match(hudCss, /\.statusStack[\s\S]*flex-direction:\s*column/);
    assert.match(cardsCss, /#cardPanel[\s\S]*overflow-y:\s*auto/);
    assert.doesNotMatch(cardsCss, /\.buildDetail(?:Toggle)?\s*\{/);
    assert.match(responsiveCss, /cardEffectHud/);
});
