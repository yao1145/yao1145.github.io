import assert from 'node:assert/strict';
import test from 'node:test';

import { Game } from '../js/core/game.js';
import { CONFIG } from '../js/core/config.js';
import '../js/systems/sprites.js';

function installFrameEnvironment() {
    const previousWindow = globalThis.window;
    const previousRaf = globalThis.requestAnimationFrame;
    const previousDocument = globalThis.document;
    const ctx = {
        setTransform() {},
        imageSmoothingQuality: 'low',
    };
    const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx };
    globalThis.window = { devicePixelRatio: 1, innerWidth: 800, innerHeight: 600 };
    globalThis.requestAnimationFrame = () => {};
    delete globalThis.document;
    Game.canvas = canvas;
    Game.ctx = ctx;
    Game.clearVisualState = () => {};
    return {
        canvas,
        restore() {
            if (previousWindow === undefined) delete globalThis.window;
            else globalThis.window = previousWindow;
            if (previousRaf === undefined) delete globalThis.requestAnimationFrame;
            else globalThis.requestAnimationFrame = previousRaf;
            if (previousDocument === undefined) delete globalThis.document;
            else globalThis.document = previousDocument;
        },
    };
}

function resetLoopState() {
    Object.assign(Game, {
        isRunning: false,
        isGameOver: false,
        isCardSelectionOpen: false,
        rewardFlow: null,
        isBuildSelectionOpen: false,
        isRewardSummaryOpen: false,
        lastTime: 0,
        accumulator: 0,
        gameTime: 0,
        fixedStepMs: 10,
        render: () => {},
    });
}

test('gameLoop caps catch-up work and drops excess accumulated time', () => {
    const env = installFrameEnvironment();
    const originalUpdate = Game.update;
    resetLoopState();
    let updates = 0;
    Game.update = () => { updates++; };
    Game.isRunning = true;

    try {
        Game.gameLoop(100);
        assert.ok(Game.maxCatchUpSteps >= 3 && Game.maxCatchUpSteps <= 4);
        assert.equal(updates, Game.maxCatchUpSteps);
        assert.equal(Game.gameTime, Game.fixedStepMs * Game.maxCatchUpSteps);
        assert.equal(Game.accumulator, 0, 'surplus catch-up time is discarded');
    } finally {
        Game.update = originalUpdate;
        resetLoopState();
        env.restore();
    }
});

test('gameLoop stops the same frame when update opens a pause-owned flow', () => {
    const env = installFrameEnvironment();
    const originalUpdate = Game.update;
    resetLoopState();
    const transitions = [
        () => { Game.isRunning = false; },
        () => { Game.isCardSelectionOpen = true; },
        () => { Game.rewardFlow = { phase: 'core' }; },
        () => { Game.isBuildSelectionOpen = true; },
        () => { Game.isRewardSummaryOpen = true; },
        () => { Game.isGameOver = true; },
    ];

    try {
        for (const transition of transitions) {
            resetLoopState();
            let updates = 0;
            Game.update = () => {
                updates++;
                transition();
            };
            Game.isRunning = true;
            Game.gameLoop(100);
            assert.equal(updates, 1);
            assert.equal(Game.accumulator, 0);
        }
    } finally {
        Game.update = originalUpdate;
        resetLoopState();
        env.restore();
    }
});

test('resizeCanvas preserves sprites when DPR and sprite dimensions stay stable', () => {
    const env = installFrameEnvironment();
    const oldCaches = {
        enemies: { old: {} },
        bullets: { old: {} },
        items: { old: {} },
        player: {},
    };
    const oldBoss = { old: {} };
    const oldMenu = { old: {} };
    const originalCaches = Game.spriteCache;
    const originalBoss = Game.bossBadgeSprites;
    const originalMenu = Game.menuEmblemCanvas;
    const originalSignature = Game.spriteCacheSignature;
    const originalPlayer = Game.player;
    try {
        Game.spriteCache = oldCaches;
        Game.bossBadgeSprites = oldBoss;
        Game.menuEmblemCanvas = oldMenu;
        Game.player = { width: CONFIG.player.width, height: CONFIG.player.height };
        Game.dpr = 1;
        Game.spriteCacheSignature = Game.getSpriteCacheSignature(1);
        window.innerWidth = 1000;
        window.innerHeight = 700;
        Game.resizeCanvas();
        assert.equal(Game.spriteCache, oldCaches);
        assert.equal(Game.spriteCache.enemies, oldCaches.enemies);
        assert.equal(Game.bossBadgeSprites, oldBoss);
        assert.equal(Game.menuEmblemCanvas, oldMenu);
    } finally {
        Game.spriteCache = originalCaches;
        Game.bossBadgeSprites = originalBoss;
        Game.menuEmblemCanvas = originalMenu;
        Game.spriteCacheSignature = originalSignature;
        Game.player = originalPlayer;
        env.restore();
    }
});

test('resizeCanvas invalidates and prewarms sprites when DPR or dimensions change', () => {
    const env = installFrameEnvironment();
    const originalCaches = Game.spriteCache;
    const originalBoss = Game.bossBadgeSprites;
    const originalMenu = Game.menuEmblemCanvas;
    const originalSignature = Game.spriteCacheSignature;
    const originalPlayer = Game.player;
    const originalPrebake = Game.prebakeSprites;
    const originalLoad = Game.badgeLoad;
    try {
        Game.spriteCache = { enemies: { old: {} }, bullets: { old: {} }, items: { old: {} }, player: {} };
        Game.bossBadgeSprites = { old: {} };
        Game.menuEmblemCanvas = { old: {} };
        Game.player = { width: CONFIG.player.width, height: CONFIG.player.height };
        Game.dpr = 1;
        Game.spriteCacheSignature = Game.getSpriteCacheSignature(1);
        Game.badgeLoad = { status: 'ready' };
        let prebakes = 0;
        Game.prebakeSprites = () => { prebakes++; };

        window.devicePixelRatio = 2;
        Game.resizeCanvas();
        assert.equal(Game.spriteCache.enemies.old, undefined);
        assert.equal(Game.bossBadgeSprites.old, undefined);
        assert.equal(Game.menuEmblemCanvas, null);
        assert.equal(prebakes, 1);

        Game.spriteCacheSignature = Game.getSpriteCacheSignature(2);
        Game.player.width += 1;
        Game.resizeCanvas();
        assert.equal(prebakes, 2);
    } finally {
        Game.spriteCache = originalCaches;
        Game.bossBadgeSprites = originalBoss;
        Game.menuEmblemCanvas = originalMenu;
        Game.spriteCacheSignature = originalSignature;
        Game.player = originalPlayer;
        Game.prebakeSprites = originalPrebake;
        Game.badgeLoad = originalLoad;
        env.restore();
    }
});

test('enemy sprite cache ignores transient hit-flash color', () => {
    const originalCache = Game.spriteCache;
    const originalMakeCanvas = Game.makeSpriteCanvas;
    const originalDrawBadge = Game.drawBadge;
    const originalEnemyBadgeKey = Game.getEnemyBadgeKey;
    try {
        Game.spriteCache = { enemies: {}, bullets: {}, items: {}, player: null };
        Game.dpr = 1;
        Game.getEnemyBadgeKey = () => 'badge.svg';
        Game.makeSpriteCanvas = () => ({ canvas: {}, ctx: {} });
        Game.drawBadge = () => true;
        const enemy = { type: 0, variant: 0, width: 30, height: 30, color: '#f00' };
        const normal = Game.getEnemySprite(enemy);
        enemy.color = '#fff';
        const hitFlash = Game.getEnemySprite(enemy);
        assert.equal(hitFlash, normal);
        assert.equal(Object.keys(Game.spriteCache.enemies).length, 1);
        assert.equal(Object.keys(Game.spriteCache.enemies)[0].includes('#f00'), false);
        assert.equal(Object.keys(Game.spriteCache.enemies)[0].includes('#fff'), false);
    } finally {
        Game.spriteCache = originalCache;
        Game.makeSpriteCanvas = originalMakeCanvas;
        Game.drawBadge = originalDrawBadge;
        Game.getEnemyBadgeKey = originalEnemyBadgeKey;
    }
});
