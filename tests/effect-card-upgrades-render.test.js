import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

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

    for (const [elapsed, expectedHighlights] of [[249, 1], [250, 0], [251, 0]]) {
        Game.gameTime = 1000 + elapsed;
        Game.objectPools.enemyBullets.active = [
            { x: 120, y: 220, width: 6, height: 6, fogWarningShown: true, fogWarningUntil: 1250 },
        ];
        ctx.calls.length = 0;
        Game.drawFogWarningHighlights();
        assert.equal(ctx.calls.filter((call) => call[0] === 'arc').length, expectedHighlights, `250ms fog highlight expiry at ${elapsed}ms`);
        assert.equal(ctx.calls.some((call) => call[0] === 'lineTo'), false);
    }
});

test('render keeps world below fog and player/critical warnings above it, with DOM HUD above canvas', () => {
    const events = [];
    Game.ctx = makeContext();
    Game.width = 800;
    Game.height = 600;
    Game.isMenu = false;
    Game.isGameOver = false;
    Game.activeCard = 'fog';
    Game.player = { x: 20, y: 20, width: 20, height: 20, shieldTime: 0 };
    Game.boss = { entityId: 9100, x: 300, y: 30, width: 40, height: 40, color: '#f00' };
    Game.objectPools.bullets.active = [{}];
    Game.objectPools.enemyBullets.active = [{}];
    Game.objectPools.enemies.active = [{ entityId: 9101, x: 100, y: 100, width: 30, height: 30, health: 1, maxHealth: 1 }];
    Game.objectPools.items.active = [{}];
    Game.objectPools.particles.active = [];
    const methods = [
        ['drawStarfield', 'world:starfield'],
        ['drawBulletSprite', 'world:player-bullet'],
        ['drawEnemyBulletSprite', 'world:enemy-bullet'],
        ['drawEnemySprite', 'world:enemy'],
        ['drawItemSprite', 'world:item'],
        ['drawBoss', 'world:boss'],
        ['drawFogBand', 'fog'],
        ['drawPlayerShieldAndBarrier', 'player:barrier'],
        ['drawPlayerSprite', 'player:sprite'],
        ['drawFogWarningHighlights', 'critical:fog-warning'],
        ['drawVisualFeedbackEvents', 'critical:feedback'],
        ['drawHunterMark', 'critical:hunter-mark'],
    ];
    const originals = new Map();
    for (const [method, label] of methods) {
        originals.set(method, Game[method]);
        Game[method] = () => events.push(label);
    }
    try {
        Game.render();
    } finally {
        for (const [method, original] of originals) Game[method] = original;
    }

    const indexOf = (label) => events.indexOf(label);
    assert.ok(indexOf('world:boss') < indexOf('fog'));
    assert.ok(indexOf('fog') < indexOf('player:barrier'));
    assert.ok(indexOf('player:sprite') < indexOf('critical:fog-warning'));
    assert.ok(indexOf('critical:fog-warning') < indexOf('critical:feedback'));
    assert.ok(indexOf('critical:feedback') < indexOf('critical:hunter-mark'));
    assert.ok(events.filter((label) => label === 'critical:hunter-mark').length >= 2, 'enemy and Boss critical markers remain above fog');

    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const hudCss = readFileSync(new URL('../css/ui/hud.css', import.meta.url), 'utf8');
    const bossCss = readFileSync(new URL('../css/ui/boss.css', import.meta.url), 'utf8');
    const layoutCss = readFileSync(new URL('../css/ui/layout.css', import.meta.url), 'utf8');
    assert.ok(html.indexOf('<canvas id="gameCanvas">') < html.indexOf('<div id="uiOverlay">'));
    assert.match(layoutCss, /#uiOverlay\s*\{[\s\S]*?z-index:\s*20/);
    assert.match(hudCss, /\.cardEffectHud\s*\{[\s\S]*?z-index:\s*15/);
    assert.match(hudCss, /\.buildHud\s*\{[\s\S]*?z-index:\s*15/);
    assert.match(bossCss, /\.bossWarning\s*\{[\s\S]*?z-index:\s*20/);
});

// Records every globalAlpha write so a fade can be asserted per frame.
function trackGlobalAlpha(ctx) {
    const trail = [];
    let value = ctx.globalAlpha;
    Object.defineProperty(ctx, 'globalAlpha', {
        configurable: true,
        get: () => value,
        set: (next) => { value = next; trail.push(next); },
    });
    return trail;
}

// Records the radius of every stroked arc.
function trackArcRadii(ctx) {
    const radii = [];
    const arc = ctx.arc.bind(ctx);
    ctx.arc = (...args) => { radii.push(args[2]); return arc(...args); };
    return radii;
}

test('effect feedback uses the v2.1 radii and non-color shapes', () => {
    const ctx = makeContext();
    Game.ctx = ctx;
    Game.width = 800;
    Game.height = 600;
    Game.gameTime = 0;
    Game.buildState = { locks: { hunterTargetId: 9, hunterHits: 10 }, timers: {} };
    const radii = [];
    Game.drawRadiusRing = (_x, _y, radius) => radii.push(radius);
    // Chain rings are painted as canvas arcs (they animate), so their target
    // radius is observed from ctx.arc instead of drawRadiusRing.
    const chainRadii = trackArcRadii(ctx);
    Game.drawEffectFeedback({ kind: 'fortress', x: 0, y: 0, echo: true, clear: true });
    Game.drawEffectFeedback({ kind: 'desperate', x: 0, y: 0 });
    Game.drawEffectFeedback({ kind: 'chain', x: 0, y: 0, generation: 0 });
    Game.drawEffectFeedback({ kind: 'chain', x: 0, y: 0, generation: 1 });
    Game.drawEffectFeedback({ kind: 'chain', x: 0, y: 0, wide: true });
    Game.drawEffectFeedback({ kind: 'chain', x: 0, y: 0, capstone: true });
    Game.drawEffectFeedback({ kind: 'hunter', x: 0, y: 0 });
    assert.deepEqual(chainRadii, [
        CONFIG.builds.chain.baseRadius,
        CONFIG.builds.chain.spreadRadius,
        CONFIG.builds.chain.wideRadius,
        CONFIG.builds.chain.capstoneRadius,
    ]);
    const callsBeforeImpact = ctx.calls.length;
    Game.drawEffectFeedback({ kind: 'desperate', x: 0, y: 0, impact: true, damageLabel: '3D', clear: false });
    assert.ok(ctx.calls.slice(callsBeforeImpact).some((call) => call[0] === 'lineTo'));
    assert.ok(ctx.calls.slice(callsBeforeImpact).some((call) => call[0] === 'fillText'));
    assert.deepEqual(radii, [
        CONFIG.builds.fortress.echoRadius,
        CONFIG.builds.fortress.clearRadius,
        CONFIG.builds.desperate.clearRadius,
        CONFIG.builds.hunter.clearRadius,
    ]);
    ctx.calls.length = 0;
    Game.drawHunterFracture(0, 0, 20, '3D');
    assert.ok(ctx.calls.some((call) => call[0] === 'lineTo'));
    assert.ok(ctx.calls.some((call) => call[0] === 'fillText'));
});

test('chain feedback paints a ring that expands to the target radius while fading', () => {
    // Mirrors the module constant in render.js; the source assertion below
    // keeps the two from drifting apart.
    const CHAIN_RING_MS = 400;
    assert.match(
        readFileSync(new URL('../js/systems/render.js', import.meta.url), 'utf8'),
        /const CHAIN_RING_MS = 400;/,
    );

    const ctx = makeContext();
    Game.ctx = ctx;
    const radii = trackArcRadii(ctx);
    const alphas = trackGlobalAlpha(ctx);
    const startedAt = 600;
    const event = { kind: 'chain', x: 30, y: 40, startedAt, until: 10000, generation: 1, radius: 240 };

    const frames = [];
    for (const elapsed of [0, 100, 200, 300, CHAIN_RING_MS]) {
        Game.gameTime = startedAt + elapsed;
        radii.length = 0;
        alphas.length = 0;
        Game.drawEffectFeedback(event);
        frames.push({
            radius: radii[0],
            alpha: alphas[0],
            restored: ctx.globalAlpha,
            lineWidth: ctx.lineWidth,
            strokeStyle: ctx.strokeStyle,
        });
    }

    // Dynamic expansion: nothing at the start, the true damage radius at the end.
    assert.deepEqual(frames.map((frame) => frame.radius), [0, 60, 120, 180, 240]);
    assert.ok(frames[0].radius < 240 * 0.5, 'first frame must not paint the full radius');
    assert.deepEqual(frames.map((frame) => frame.alpha), [1, 0.75, 0.5, 0.25, 0]);
    for (let i = 1; i < frames.length; i++) {
        assert.ok(frames[i].alpha < frames[i - 1].alpha, 'alpha must decrease monotonically');
        assert.ok(frames[i].radius > frames[i - 1].radius, 'radius must grow monotonically');
    }
    assert.ok(frames.every((frame) => frame.restored === 1), 'globalAlpha must be restored to 1');
    assert.ok(frames.every((frame) => frame.lineWidth <= 2), 'line width stays at or below 2');
    assert.ok(frames.every((frame) => frame.strokeStyle === '#ffb3a1'), 'second-generation chain color');

    // Without startedAt the window is derived from until - CHAIN_RING_MS.
    Game.gameTime = 700;
    radii.length = 0;
    alphas.length = 0;
    Game.drawEffectFeedback({ kind: 'chain', x: 0, y: 0, radius: 240, until: 1000 });
    assert.deepEqual(radii, [60]);
    assert.deepEqual(alphas, [0.75, 1]);
});

test('chain feedback renders each route radius exactly at the end of its lifetime', () => {
    const ctx = makeContext();
    Game.ctx = ctx;
    const radii = trackArcRadii(ctx);
    const alphas = trackGlobalAlpha(ctx);

    for (const radius of [200, 220, 260, 300]) {
        // startedAt/until put the event at progress 1 while still active.
        Game.gameTime = 500;
        radii.length = 0;
        alphas.length = 0;
        Game.drawEffectFeedback({ kind: 'chain', x: 0, y: 0, radius, startedAt: 100, until: 10000 });
        assert.deepEqual(radii, [radius]);
        assert.deepEqual(alphas, [0, 1], 'fades out and restores globalAlpha');
    }

    // The first-generation color is unchanged.
    Game.gameTime = 500;
    ctx.calls.length = 0;
    Game.drawEffectFeedback({ kind: 'chain', x: 0, y: 0, radius: 200, startedAt: 100, until: 10000 });
    assert.equal(ctx.strokeStyle, '#ff7a45');
});

test('chain feedback never throws without usable timing metadata', () => {
    const ctx = makeContext();
    Game.ctx = ctx;

    Game.gameTime = 0;
    assert.doesNotThrow(() => Game.drawEffectFeedback({ kind: 'chain', x: 1, y: 2, radius: 200, until: 400 }));
    Game.gameTime = undefined;
    assert.doesNotThrow(() => Game.drawEffectFeedback({ kind: 'chain', x: 1, y: 2, radius: 200, until: 400 }));
    assert.doesNotThrow(() => Game.drawEffectFeedback({ kind: 'chain', x: 1, y: 2 }));
    assert.doesNotThrow(() => Game.drawEffectFeedback({ kind: 'chain', x: 1, y: 2, until: Number.NaN }));
    assert.doesNotThrow(() => Game.drawEffectFeedback({ kind: 'chain', x: 1, y: 2, until: Number.POSITIVE_INFINITY }));
    assert.doesNotThrow(() => Game.drawEffectFeedback({ kind: 'chain', x: Number.NaN, y: 0, radius: 200, until: 400 }));
    assert.doesNotThrow(() => Game.drawEffectFeedback({ kind: 'chain', x: 0, y: 0, startedAt: 'x', until: 'y' }));
    assert.equal(ctx.globalAlpha, 1, 'globalAlpha stays clean after malformed events');
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
    Game.drawMenuEmblem = () => {};
    Game.drawHunterMark = () => {};
    Game.objectPools.enemies.active = [];
    Game.objectPools.bullets.active = [];
    Game.objectPools.enemyBullets.active = [];
    Game.objectPools.items.active = [];
    Game.objectPools.particles.active = [];
    const previousPerformance = globalThis.performance;
    let logicalNow = 1000;
    try {
        globalThis.performance = { now: () => logicalNow };
        Game.requestVisualHitStop(150);
        assert.equal(Game.isVisualHitStopped(1149), true);
        assert.equal(Game.isVisualHitStopped(1150), false);
        assert.equal(Game.isVisualHitStopped(1151), false);
        const before = ctx.calls.length;
        Game.render();
        assert.equal(ctx.calls.length, before);
        Game.clearVisualHitStop();
        Game.render();
        assert.ok(ctx.calls.some((call) => call[0] === 'fillRect'));
        logicalNow = 2000;
        Game.requestVisualHitStop(150);
        Game.isMenu = true;
        Game.render();
        assert.equal(Game.visualHitStopUntil, 0);
    } finally {
        globalThis.performance = previousPerformance;
    }
});
