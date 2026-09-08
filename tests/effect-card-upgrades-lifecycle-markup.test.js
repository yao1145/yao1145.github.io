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

test('lifecycle methods clear visual state and updateUI is headless-safe', () => {
    const source = fs.readFileSync(new URL('../js/core/game.js', import.meta.url), 'utf8');
    assert.match(source, /startGame[\s\S]*clearVisualState/);
    assert.match(source, /returnToMainMenu[\s\S]*clearVisualState/);
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

test('static card and route copy exposes v2.1 tradeoffs and exact feedback HUD markup', () => {
    for (const forbiddenText of [
        '无效果', '伤害减半', '概率回复', '命中12次', '命中 12 次',
        '70px', '90px', '110px', '150px',
    ]) {
        assert.equal(indexHtml.includes(forbiddenText), false, `legacy copy remains: ${forbiddenText}`);
    }
    for (const requiredText of [
        '敌人射速×0.65', '自身射速×0.80', '每20s回1命', 'Boss首次+16',
        '敌弹速度×0.80', '追踪失效', '200px', '220px', '250px', '260px', '300px',
        '3000ms', '6000ms', '10000ms', '8秒',
    ]) {
        assert.equal(indexHtml.includes(requiredText), true, `v2.1 copy missing: ${requiredText}`);
    }
    assert.match(indexHtml, /id="cardEffectHud"/);
    assert.match(hudCss, /\.cardEffectHud/);
    assert.match(cardsCss, /#cardPanel[\s\S]*overflow-y:\s*auto/);
    assert.match(responsiveCss, /cardEffectHud/);
});
