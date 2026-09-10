import assert from 'node:assert/strict';
import test from 'node:test';

import { Game } from '../js/core/game.js';
import { CONFIG } from '../js/core/config.js';
import '../js/systems/sprites.js';
import '../js/systems/badges.js';

test('sprite preload plan covers every required static category', () => {
    const tasks = Game.getSpritePreloadTasks();
    const kinds = new Set(tasks.map((task) => task.kind));
    assert.deepEqual(kinds, new Set(['player', 'enemy', 'bullet', 'item', 'boss', 'menu']));
    assert.equal(tasks.filter((task) => task.kind === 'bullet').length, CONFIG.spritePreload.bullets.length);
    assert.equal(tasks.filter((task) => task.kind === 'item').length, CONFIG.spritePreload.items.length);
    assert.equal(tasks.filter((task) => task.kind === 'boss').length, CONFIG.bossTypes.length);
    assert.ok(tasks.every((task) => typeof task.run === 'function'));
});

test('sprite prewarm yields between bounded batches', async () => {
    const originalConfig = CONFIG.spritePreload;
    const originalTasks = Game.getSpritePreloadTasks;
    const originalGeneration = Game.spritePrewarmGeneration;
    const originalRunId = Game.spritePrewarmRunId;
    const originalSignature = Game.getSpriteCacheSignature;
    const originalCache = Game.spriteCache;
    const calls = [];
    try {
        CONFIG.spritePreload = { batchSize: 2, batchYieldMs: 0 };
        Game.spritePrewarmGeneration = 0;
        Game.spritePrewarmRunId = 0;
        Game.spriteCache = { enemies: {}, bullets: {}, items: {}, player: null };
        Game.getSpriteCacheSignature = () => 'test';
        Game.getSpritePreloadTasks = () => Array.from({ length: 5 }, (_, index) => ({
            kind: 'test', key: String(index), run: () => calls.push(index),
        }));

        const promise = Game.prebakeSprites();
        assert.deepEqual(calls, [], 'first batch is deferred off the caller stack');
        const result = await promise;
        assert.deepEqual(calls, [0, 1, 2, 3, 4]);
        assert.deepEqual(result, { completed: 5, total: 5 });
        assert.equal(Game.spritePrewarmState.status, 'ready');
    } finally {
        CONFIG.spritePreload = originalConfig;
        Game.getSpritePreloadTasks = originalTasks;
        Game.spritePrewarmGeneration = originalGeneration;
        Game.spritePrewarmRunId = originalRunId;
        Game.getSpriteCacheSignature = originalSignature;
        Game.spriteCache = originalCache;
    }
});

test('a newer prewarm run wins after cache invalidation', async () => {
    const originalConfig = CONFIG.spritePreload;
    const originalTasks = Game.getSpritePreloadTasks;
    const originalGeneration = Game.spritePrewarmGeneration;
    const originalRunId = Game.spritePrewarmRunId;
    const originalSignature = Game.getSpriteCacheSignature;
    const originalCache = Game.spriteCache;
    const calls = [];
    try {
        CONFIG.spritePreload = { batchSize: 1, batchYieldMs: 0 };
        Game.spritePrewarmGeneration = 0;
        Game.spritePrewarmRunId = 0;
        Game.spriteCache = { enemies: {}, bullets: {}, items: {}, player: null };
        Game.getSpriteCacheSignature = () => 'race';
        Game.getSpritePreloadTasks = () => [{
            kind: 'test', key: 'run', run: () => calls.push(Game.spritePrewarmRunId),
        }];
        const stale = Game.prebakeSprites();
        Game.invalidateSpriteCaches();
        const current = Game.prebakeSprites();
        assert.deepEqual(await stale, { cancelled: true });
        assert.deepEqual(await current, { completed: 1, total: 1 });
        assert.deepEqual(calls, [2]);
    } finally {
        CONFIG.spritePreload = originalConfig;
        Game.getSpritePreloadTasks = originalTasks;
        Game.spritePrewarmGeneration = originalGeneration;
        Game.spritePrewarmRunId = originalRunId;
        Game.getSpriteCacheSignature = originalSignature;
        Game.spriteCache = originalCache;
    }
});

test('a cancelled prewarm cannot reopen the badge readiness gate', async () => {
    const originalConfig = CONFIG.spritePreload;
    const originalTasks = Game.getSpritePreloadTasks;
    const originalGeneration = Game.spritePrewarmGeneration;
    const originalRunId = Game.spritePrewarmRunId;
    const originalSignature = Game.getSpriteCacheSignature;
    const originalCache = Game.spriteCache;
    const originalLoad = Game.badgeLoad;
    try {
        CONFIG.spritePreload = { batchSize: 1, batchYieldMs: 0 };
        Game.spritePrewarmGeneration = 0;
        Game.spritePrewarmRunId = 0;
        Game.spriteCache = { enemies: {}, bullets: {}, items: {}, player: null };
        Game.getSpriteCacheSignature = () => 'cancelled';
        Game.badgeLoad = {
            status: 'preparing', phase: 'sprites', stage: 'sprites',
            failed: [], prewarmRunId: 0,
        };
        Game.getSpritePreloadTasks = () => [{ kind: 'test', key: 'cancel', run: () => {} }];

        const stale = Game.prebakeSprites();
        Game.invalidateSpriteCaches();

        assert.deepEqual(await stale, { cancelled: true });
        assert.equal(Game.badgeLoad.status, 'preparing');
        assert.equal(Game.badgeLoad.phase, 'sprites');
    } finally {
        CONFIG.spritePreload = originalConfig;
        Game.getSpritePreloadTasks = originalTasks;
        Game.spritePrewarmGeneration = originalGeneration;
        Game.spritePrewarmRunId = originalRunId;
        Game.getSpriteCacheSignature = originalSignature;
        Game.spriteCache = originalCache;
        Game.badgeLoad = originalLoad;
    }
});

test('development combat cache misses are counted and production stays quiet', () => {
    const original = {
        misses: Game.spriteCacheMisses,
        count: Game.spriteCacheMissCount,
        running: Game.isRunning,
        menu: Game.isMenu,
        debug: Game.debugSprites,
    };
    try {
        Game.spriteCacheMisses = 0;
        Game.spriteCacheMissCount = 0;
        Game.isRunning = true;
        Game.isMenu = false;
        Game.debugSprites = true;
        Game.noteSpriteCacheMiss('test', 'one');
        assert.equal(Game.spriteCacheMisses, 1);
        assert.equal(Game.spriteCacheMissCount, 1);

        Game.debugSprites = false;
        Game.noteSpriteCacheMiss('test', 'two');
        assert.equal(Game.spriteCacheMisses, 1);
    } finally {
        Game.spriteCacheMisses = original.misses;
        Game.spriteCacheMissCount = original.count;
        Game.isRunning = original.running;
        Game.isMenu = original.menu;
        Game.debugSprites = original.debug;
    }
});

test('badge image timeout settles once and ignores late image callbacks', async () => {
    const originalImage = globalThis.Image;
    const originalLoad = Game.badgeLoad;
    const originalUpdate = Game.updateLoadUI;
    const originalPrebake = Game.prebakeSprites;
    const originalConfig = CONFIG.spritePreload;
    const images = [];
    class FakeImage {
        set src(value) { this.url = value; }
    }
    try {
        globalThis.Image = class extends FakeImage {
            constructor() {
                super();
                images.push(this);
            }
        };
        CONFIG.spritePreload = { imageTimeoutMs: 5 };
        Game.badgeLoad = {
            status: 'loading', phase: 'resources', stage: 'resources',
            loaded: 0, settled: 0, total: 1, failed: [], token: 1,
        };
        Game.badgeImages = {};
        Game.spriteCache = { enemies: {}, bullets: {}, items: {}, player: null };
        Game.updateLoadUI = () => {};
        Game.prebakeSprites = () => Promise.resolve({ completed: 0, total: 0 });
        const image = Game.loadBadgeFile('late.svg', 1);
        await new Promise((resolve) => setTimeout(resolve, 15));
        assert.equal(Game.badgeLoad.status, 'error');
        assert.deepEqual(Game.badgeLoad.failed, ['late.svg']);
        assert.equal(Game.badgeLoad.settled, 1);

        image.onload?.();
        image.onerror?.();
        assert.deepEqual(Game.badgeLoad.failed, ['late.svg']);
        assert.equal(Game.badgeLoad.loaded, 0);
        assert.equal(Game.badgeLoad.settled, 1);
    } finally {
        globalThis.Image = originalImage;
        Game.badgeLoad = originalLoad;
        Game.updateLoadUI = originalUpdate;
        Game.prebakeSprites = originalPrebake;
        CONFIG.spritePreload = originalConfig;
    }
});
