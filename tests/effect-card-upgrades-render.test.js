import assert from 'node:assert/strict';
import test from 'node:test';

import { Game } from '../js/core/game.js';
import { CONFIG } from '../js/core/config.js';
import '../js/core/pools.js';
import '../js/systems/render.js';
import '../js/systems/sprites.js';

function makeElement() {
    return {
        children: [],
        dataset: {},
        className: '',
        classList: {
            values: new Set(),
            add(...names) { names.forEach((name) => this.values.add(name)); },
            toggle(name, force) {
                if (force === undefined ? !this.values.has(name) : force) this.values.add(name);
                else this.values.delete(name);
            },
            contains(name) { return this.values.has(name); },
        },
        style: {},
        hidden: false,
        textContent: '',
        replaceChildren(...children) { this.children = children.filter(Boolean); },
        append(...children) { this.children.push(...children.filter(Boolean)); },
        setAttribute(name, value) { this[name] = value; },
    };
}

function installDocument(elements) {
    const previous = globalThis.document;
    globalThis.document = {
        createElement: () => makeElement(),
        getElementById: (id) => elements[id] || null,
    };
    return () => { globalThis.document = previous; };
}

function makeContext() {
    const calls = [];
    const ctx = {
        calls,
        fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, font: '', textAlign: '',
        fillRect(...args) { calls.push(['fillRect', ...args]); },
        strokeRect(...args) { calls.push(['strokeRect', ...args]); },
        beginPath() { calls.push(['beginPath']); },
        closePath() { calls.push(['closePath']); },
        arc(...args) { calls.push(['arc', ...args]); },
        moveTo(...args) { calls.push(['moveTo', ...args]); },
        lineTo(...args) { calls.push(['lineTo', ...args]); },
        stroke() { calls.push(['stroke']); },
        fill() { calls.push(['fill']); },
        fillText(...args) { calls.push(['fillText', ...args]); },
        drawImage(...args) { calls.push(['drawImage', ...args]); },
        save() { calls.push(['save']); },
        restore() { calls.push(['restore']); },
        translate(...args) { calls.push(['translate', ...args]); },
        rotate(...args) { calls.push(['rotate', ...args]); },
        scale(...args) { calls.push(['scale', ...args]); },
        createLinearGradient(...args) {
            calls.push(['createLinearGradient', ...args]);
            return { addColorStop: (...stop) => calls.push(['addColorStop', ...stop]) };
        },
    };
    return ctx;
}

test('card HUD keeps survival/bloodlust state independent and route HUD at two rows', () => {
    const buildHud = makeElement();
    const cardHud = makeElement();
    const restore = installDocument({ buildHud, cardEffectHud: cardHud });
    try {
        Game.isMenu = false;
        Game.isGameOver = false;
        Game.buildState = { timers: { rapidWarmup: 3200 }, counters: {}, locks: {} };
        Game.getBuildHudStates = () => [
            { key: 'rapid', line: 'rapid', label: '热机', value: '3.2s', active: true, tags: ['强化整批', '主弹+1'] },
            { key: 'fortress', line: 'fortress', label: '屏障', value: '冷却', active: false, cooldown: true },
            { key: 'supply', line: 'supply', label: '补给', value: '1/3', active: false },
        ];
        Game.updateBuildHUD(true);
        assert.equal(buildHud.children.length, 2);
        assert.equal(buildHud.children[0].children[1].textContent, '3.2/6.0s');
        assert.equal(buildHud.children[0].children[2].textContent, '强化整批·主弹+1');
        assert.equal(buildHud.children[1].classList.contains('isCooldown'), true);

        Game.getCardEffectHudState = () => ({ cardId: 'survival', label: '回血 12.0s', paused: false, timerMs: 8000, intervalMs: 20000, tags: ['满血暂停'] });
        Game.updateCardEffectHUD(true);
        assert.equal(cardHud.children.length, 1);
        assert.equal(cardHud.children[0].children[0].textContent, '回血 12.0s');
        Game.getCardEffectHudState = () => ({ cardId: 'bloodlust', label: '血槽 3/8', meter: 3, threshold: 8 });
        Game.updateCardEffectHUD(true);
        assert.equal(cardHud.children[0].dataset.card, 'bloodlust');
        assert.equal(cardHud.children[0].children[0].textContent, '血槽 3/8');
    } finally {
        restore();
    }
});

test('fog is 35 percent plus 40px fade, with warnings as boundary highlights only', () => {
    const ctx = makeContext();
    Game.ctx = ctx;
    Game.width = 800;
    Game.height = 600;
    Game.activeCard = 'fog';
    Game.drawFogBand(Game.height * CONFIG.cards.fogLineRatio);
    const gradient = ctx.calls.find((call) => call[0] === 'createLinearGradient');
    assert.deepEqual(gradient.slice(1), [0, 0, 0, 600 * CONFIG.cards.fogLineRatio + CONFIG.cards.fogFadePx]);
    assert.ok(ctx.calls.some((call) => call[0] === 'fillRect' && call[4] === CONFIG.cards.fogLineRatio * 600 + CONFIG.cards.fogFadePx));

    Game.gameTime = 1000;
    Game.objectPools.enemyBullets.active = [
        { x: 120, y: 220, width: 6, height: 6, fogWarningShown: true, fogWarningUntil: 1100 },
        { x: 260, y: 220, width: 6, height: 6, fogWarningShown: true, fogWarningUntil: 999 },
    ];
    ctx.calls.length = 0;
    Game.drawFogWarningHighlights();
    assert.equal(ctx.calls.filter((call) => call[0] === 'arc').length, 1);
    assert.equal(ctx.calls.some((call) => call[0] === 'lineTo'), false);
});

test('effect feedback uses the v2.1 radii and non-color shapes', () => {
    const ctx = makeContext();
    Game.ctx = ctx;
    Game.width = 800;
    Game.height = 600;
    Game.gameTime = 0;
    Game.buildState = { locks: { hunterTargetId: 9, hunterHits: 10 }, timers: {} };
    const radii = [];
    Game.drawRadiusRing = (_x, _y, radius) => radii.push(radius);
    Game.drawEffectFeedback({ kind: 'fortress', x: 0, y: 0, echo: true, clear: true });
    Game.drawEffectFeedback({ kind: 'desperate', x: 0, y: 0 });
    Game.drawEffectFeedback({ kind: 'chain', x: 0, y: 0, generation: 0 });
    Game.drawEffectFeedback({ kind: 'chain', x: 0, y: 0, generation: 1 });
    Game.drawEffectFeedback({ kind: 'chain', x: 0, y: 0, wide: true });
    Game.drawEffectFeedback({ kind: 'chain', x: 0, y: 0, capstone: true });
    Game.drawEffectFeedback({ kind: 'hunter', x: 0, y: 0 });
    assert.deepEqual(radii, [
        CONFIG.builds.fortress.echoRadius,
        CONFIG.builds.fortress.clearRadius,
        CONFIG.builds.desperate.clearRadius,
        CONFIG.builds.chain.baseRadius,
        CONFIG.builds.chain.spreadRadius,
        CONFIG.builds.chain.wideRadius,
        CONFIG.builds.chain.capstoneRadius,
        CONFIG.builds.hunter.clearRadius,
    ]);
    ctx.calls.length = 0;
    Game.drawHunterFracture(0, 0, 20, '3D');
    assert.ok(ctx.calls.some((call) => call[0] === 'lineTo'));
    assert.ok(ctx.calls.some((call) => call[0] === 'fillText'));
});

test('rapid bullets and supply items expose shape feedback without changing gameplay fields', () => {
    const ctx = makeContext();
    Game.ctx = ctx;
    Game.getBulletSprite = () => ({});
    const bullet = { x: 10, y: 20, width: 4, height: 12, color: '#ff0', rapidBatchBoosted: true, isPrimary: true, rapidDamageBonus: 1, pierceRemaining: 1 };
    Game.drawBulletSprite(bullet);
    assert.ok(ctx.calls.some((call) => call[0] === 'strokeRect'));
    assert.ok(ctx.calls.some((call) => call[0] === 'fillRect'));
    assert.equal(bullet.rapidDamageBonus, 1);
    assert.equal(bullet.pierceRemaining, 1);

    Game.getItemSprite = () => ({});
    Game.gameTime = 0;
    Game.player = { x: 100, y: 100, width: 20, height: 20 };
    Game.hasBuild = (id) => id === 'supply_magnet';
    Game.drawItemSprite({ x: 80, y: 80, width: 20, height: 20, type: 1, color: '#f90', spin: 0 });
    assert.ok(ctx.calls.some((call) => call[0] === 'lineTo'));
});

test('visual hit-stop preserves the previous canvas and clears on lifecycle boundaries', () => {
    const ctx = makeContext();
    Game.ctx = ctx;
    Game.width = 800;
    Game.height = 600;
    Game.player = { x: 20, y: 20, width: 20, height: 20, shieldTime: 0 };
    Game.isMenu = false;
    Game.isGameOver = false;
    Game.drawStarfield = () => {};
    Game.drawPlayerSprite = () => {};
    Game.drawBulletSprite = () => {};
    Game.drawEnemyBulletSprite = () => {};
    Game.drawEnemySprite = () => {};
    Game.drawItemSprite = () => {};
    Game.drawBoss = () => {};
    Game.drawHunterMark = () => {};
    Game.objectPools.enemies.active = [];
    Game.objectPools.bullets.active = [];
    Game.objectPools.enemyBullets.active = [];
    Game.objectPools.items.active = [];
    Game.objectPools.particles.active = [];
    Game.requestVisualHitStop(150);
    const before = ctx.calls.length;
    Game.render();
    assert.equal(ctx.calls.length, before);
    Game.clearVisualHitStop();
    Game.render();
    assert.ok(ctx.calls.some((call) => call[0] === 'fillRect'));
});
