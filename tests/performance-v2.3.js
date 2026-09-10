/*
 * Browser performance sampler for v2.3.
 *
 * Run from the repository root (no package/dependency required):
 *   python -m http.server 8000
 * Then open http://localhost:8000/tests/performance-v2.3.html.
 * The JSON is printed to the page and exposed as window.__PERF_V23_RESULTS__.
 * This intentionally uses the production Game.update/render methods and a
 * real browser canvas; it is not a Node mock benchmark.
 */
import { Game } from '../js/core/game.js';
import '../js/core/pools.js';
import '../js/core/grid.js';
import '../js/entities/player.js';
import '../js/entities/bullets.js';
import '../js/entities/enemyBullets.js';
import '../js/entities/enemies.js';
import '../js/entities/items.js';
import '../js/entities/boss.js';
import '../js/systems/collisions.js';
import '../js/systems/render.js';
import '../js/systems/sprites.js';
import '../js/systems/badges.js';
import '../js/systems/cards.js';
import '../js/systems/builds.js';

const SAMPLE_COUNT = 240;
const WARMUP_COUNT = 45;
const FRAME_BUDGET_MS = 1000 / 60;
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const resultNode = document.getElementById('result');
const statusNode = document.getElementById('status');

function percentile(values, p) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
    return sorted[index];
}

function summarize(values) {
    const finite = values.filter(Number.isFinite);
    if (!finite.length) return { samples: 0, medianMs: null, p95Ms: null, maxMs: null, over16_7Pct: null };
    const over = finite.filter((value) => value > FRAME_BUDGET_MS).length;
    return {
        samples: finite.length,
        medianMs: percentile(finite, 0.5),
        p95Ms: percentile(finite, 0.95),
        maxMs: Math.max(...finite),
        over16_7Pct: over / finite.length * 100,
    };
}

function round(value) {
    return Number.isFinite(value) ? Number(value.toFixed(3)) : value;
}

function roundSummary(summary) {
    return Object.fromEntries(Object.entries(summary).map(([key, value]) => [
        key,
        typeof value === 'number' ? round(value) : value,
    ]));
}

function uniqueBadgeKeys() {
    const keys = new Set(['北京大学-logo.svg', '清华大学-logo.svg', '浙江大学-logo.svg', '上海交通大学-logo.svg']);
    for (const variants of Game.ENEMY_BADGES || []) for (const key of variants) keys.add(key);
    return [...keys];
}

function installSyntheticBadges() {
    Game.badgeImages = {};
    for (const [index, key] of uniqueBadgeKeys().entries()) {
        const badge = document.createElement('canvas');
        badge.width = badge.height = 32;
        const badgeCtx = badge.getContext('2d');
        badgeCtx.fillStyle = `hsl(${(index * 53) % 360} 75% 58%)`;
        badgeCtx.fillRect(0, 0, 32, 32);
        Game.badgeImages[key] = badge;
    }
    Game.badgeLoad = { status: 'ready', loaded: uniqueBadgeKeys().length, total: uniqueBadgeKeys().length, failed: [] };
}

function newBuildState() {
    return {
        owned: [],
        routeProgress: {},
        locks: {},
        timers: {},
        counters: {},
        metrics: {},
        visualFeedbackEvents: [],
        _runtime: {},
    };
}

function resetGame() {
    for (const pool of Object.values(Game.objectPools)) {
        pool.active = [];
        pool.pool = [];
    }
    Game.width = canvas.width;
    Game.height = canvas.height;
    Game.canvas = canvas;
    Game.ctx = ctx;
    Game.dpr = 1;
    Game.spriteCache = { enemies: {}, bullets: {}, items: {}, player: null };
    Game.bossBadgeSprites = {};
    Game.menuEmblemCanvas = null;
    Game.player = {
        x: Game.width / 2 - 15,
        y: Game.height - 100,
        width: 30,
        height: 30,
        speed: 5,
        color: '#0f0',
        lastShot: 0,
        shotDelay: 100000,
        shieldTime: 0,
    };
    Game.keys = {};
    Game.touch = { isTouching: false, startX: 0, startY: 0, currentX: 0, currentY: 0 };
    Game.isRunning = true;
    Game.isGameOver = false;
    Game.isMenu = false;
    Game.isBossStage = false;
    Game.boss = null;
    Game.gameTime = 0;
    Game.score = 0;
    Game.level = 1;
    Game.lives = 3;
    Game.maxLives = 3;
    Game.crowns = 0;
    Game.bulletDamage = 1;
    Game.baseBulletCount = 1;
    Game.autoShieldTimer = 0;
    Game.cardRegenTimer = 0;
    Game.bloodlustMeter = 0;
    Game.activeCard = null;
    Game.buildState = newBuildState();
    Game.directHitQueue = [];
    Game.visualFeedbackEvents = [];
    Game.visualFeedbackQueue = [];
    Game.enemySpawnRate = 0;
    Game.enemyShotRate = 0;
    Game.itemSpawnRate = 0;
    Game.enemySpeed = 0.35;
    Game.enemyBulletSpeed = 4;
    Game.bossAppearCount = 1;
    Game.bossSpawnThreshold = Number.MAX_SAFE_INTEGER;
    Game.lastUIUpdateTime = 0;
    // UI writes are outside the render/update timings and would add DOM noise.
    Game.updateUI = () => {};
    Game.updateShieldUI = () => {};
    Game.updateAttackUI = () => {};
    Game.updateBossHealthBar = () => {};
    Game.updatePauseBuildDetails = () => {};
    Game.updateBuildHUD = () => {};
    Game.updateCardEffectHUD = () => {};
    Game.onActualPlayerDamage = () => {};
    Game.onItemCollected = () => {};
    Game.onDirectShotBatch = () => {};
    Game.onEnemyKilled = () => {};
    Game.badgeLoad.status = 'ready';
    Game.prebakeSprites();
}

function addEnemy(index, options = {}) {
    const enemy = Game.getObject('enemies');
    if (!enemy) return null;
    const type = options.type ?? index % 5;
    enemy.entityId = Game.allocateEntityId();
    enemy.x = options.x ?? ((index * 97) % (Game.width - 40));
    enemy.y = options.y ?? (40 + ((index * 61) % 500));
    enemy.width = options.width ?? 30;
    enemy.height = options.height ?? 30;
    enemy.speed = options.speed ?? 0.35;
    enemy.color = options.color ?? '#f55';
    enemy.type = type;
    enemy.variant = 0;
    enemy.canShoot = false;
    enemy.health = options.health ?? 8;
    enemy.maxHealth = enemy.health;
    enemy.lastShot = Number.MAX_SAFE_INTEGER;
    enemy.shotDelay = Number.MAX_SAFE_INTEGER;
    enemy._dead = false;
    return enemy;
}

function addBullet(index, enemy = false) {
    const bullet = Game.getObject(enemy ? 'enemyBullets' : 'bullets');
    if (!bullet) return null;
    bullet.x = (index * 37) % (Game.width - 12);
    bullet.y = 40 + ((index * 47) % (Game.height - 70));
    bullet.width = enemy ? 6 : 4;
    bullet.height = enemy ? 6 : 12;
    bullet.speed = enemy ? 0.8 : 1.1;
    bullet.vx = enemy ? ((index % 5) - 2) * 0.1 : 0;
    bullet.vy = enemy ? 0.8 : -0.2;
    bullet.baseVx = bullet.vx;
    bullet.baseVy = bullet.vy;
    bullet.baseSpeed = Math.hypot(bullet.vx, bullet.vy);
    bullet.color = enemy ? '#f0f' : '#ff0';
    bullet.isTracking = false;
    bullet.isStraight = true;
    bullet.isRing = index % 3 === 0;
    bullet.isWave = index % 5 === 0;
    bullet.isExplosion = false;
    bullet.trackingPower = 0;
    bullet.waveOffset = index * 0.1;
    bullet.waveAmplitude = 0;
    bullet.waveFrequency = 0;
    bullet.fogSpeedApplied = false;
    bullet.fogTrackingDisabled = false;
    bullet.hitEntityIds = [];
    bullet.shotId = index + 1;
    bullet.isPrimary = index % 3 === 0;
    bullet.rapidBatchBoosted = false;
    bullet.rapidDamageBonus = 0;
    bullet.supplyDamageBonus = 0;
    bullet.pierceRemaining = 0;
    return bullet;
}

function addItem(index) {
    const item = Game.getObject('items');
    if (!item) return null;
    item.x = (index * 83) % (Game.width - 20);
    item.y = 90 + ((index * 41) % (Game.height - 120));
    item.width = item.height = 20;
    item.speed = 0.4;
    item.color = ['#f00', '#f90', '#0af'][index % 3];
    item.type = index % 3;
    item.spin = index * 0.2;
    item.spawnSource = 'natural';
    item.attractionActive = false;
    item.collectedByMagnet = false;
    return item;
}

function addParticle(index, ring = false) {
    const particle = Game.getObject('particles');
    if (!particle) return null;
    particle.x = 80 + ((index * 53) % (Game.width - 160));
    particle.y = 50 + ((index * 31) % (Game.height - 100));
    particle.vx = ((index % 7) - 3) * 0.1;
    particle.vy = ((index % 5) - 2) * 0.1;
    particle.life = 1000;
    particle.color = index % 2 ? '#ff9f68' : '#fff';
    if (ring) {
        particle.isRing = true;
        particle.radius = 4;
        particle.ringGrowth = 1;
        particle.ringMax = 130;
    }
    return particle;
}

function setupScene(name) {
    resetGame();
    if (name === 'ordinary') {
        for (let i = 0; i < 30; i++) addEnemy(i);
        for (let i = 0; i < 70; i++) addBullet(i);
        for (let i = 0; i < 40; i++) addBullet(i, true);
        for (let i = 0; i < 20; i++) addParticle(i);
        for (let i = 0; i < 8; i++) addItem(i);
    } else if (name === 'dense-bullets') {
        for (let i = 0; i < 80; i++) addEnemy(i, { health: 20 });
        for (let i = 0; i < 400; i++) addBullet(i);
        for (let i = 0; i < 600; i++) addBullet(i, true);
        for (let i = 0; i < 300; i++) addParticle(i);
    } else if (name === 'chain-explosion') {
        Game.activeCard = 'chain';
        for (let i = 0; i < 90; i++) addEnemy(i, { x: 560 + (i % 10) * 32, y: 220 + Math.floor(i / 10) * 32, health: 1 });
        Game.spatialGrid.clear();
        for (const enemy of Game.objectPools.enemies.active) Game.spatialGrid.insert(enemy, 'enemies');
        // Exercise the production chain resolver to create shockwaves,
        // feedback, spatial queries, and chain deaths before sampling.
        Game.createDamageExplosion({ x: 700, y: 360, source: 'card' });
        for (let i = 0; i < 500; i++) addParticle(i, i % 4 === 0);
        // The chain's own short-lived burst fills the bounded particle pool;
        // keep those real chain/shockwave particles alive for the measured
        // render window so this scene remains a dense visual workload.
        for (const particle of Game.objectPools.particles.active) particle.life = 1000;
        for (let i = 0; i < 240; i++) addBullet(i, true);
    } else if (name === 'boss') {
        Game.isBossStage = true;
        Game.boss = {
            entityId: Game.allocateEntityId(), x: 590, y: 70, width: 100, height: 100,
            health: 10000, maxHealth: 10000, speed: 0.8, color: '#f66', type: 0,
            name: '性能采样 Boss', lastShot: Number.MAX_SAFE_INTEGER,
            shotDelay: Number.MAX_SAFE_INTEGER, lastPatternChange: 0,
            patternChangeDelay: Number.MAX_SAFE_INTEGER, currentPattern: 0,
            moveDirection: 1, waveOffset: 0, level: 10, movePhase: 0,
            centerX: 590, centerY: 70, orbitAngle: 0, lastTrackingShot: 0,
            trackingShotDelay: Number.MAX_SAFE_INTEGER, spawnTime: 0, summonOpen: false,
        };
        for (let i = 0; i < 50; i++) addEnemy(i, { health: 30 });
        for (let i = 0; i < 250; i++) addBullet(i);
        for (let i = 0; i < 500; i++) addBullet(i, true);
        for (let i = 0; i < 350; i++) addParticle(i, i % 8 === 0);
        for (let i = 0; i < 10; i++) addItem(i);
    }
    // Avoid collisions changing the scene density while timing; collision
    // itself remains part of Game.update and is measured as script/update.
    Game.player.x = 20;
    Game.player.y = Game.height - 50;
    Game.player.lastShot = Number.MAX_SAFE_INTEGER;
}

function snapshotCounts() {
    return Object.fromEntries(Object.entries(Game.objectPools).map(([type, pool]) => [type, pool.active.length]));
}

function heapSnapshot() {
    const memory = performance.memory;
    if (!memory || !Number.isFinite(memory.usedJSHeapSize)) return null;
    return memory.usedJSHeapSize;
}

async function measureScene(name, longTasks, gcEntries) {
    const windowStart = performance.now();
    setupScene(name);
    // Warm production caches and JIT paths without including those costs.
    for (let i = 0; i < WARMUP_COUNT; i++) {
        Game.gameTime += FRAME_BUDGET_MS;
        Game.update(FRAME_BUDGET_MS);
        Game.render();
    }
    const updateSamples = [];
    const renderSamples = [];
    const heapBefore = heapSnapshot();
    for (let i = 0; i < SAMPLE_COUNT; i++) {
        Game.gameTime += FRAME_BUDGET_MS;
        let start = performance.now();
        Game.update(FRAME_BUDGET_MS);
        updateSamples.push(performance.now() - start);
        start = performance.now();
        Game.render();
        renderSamples.push(performance.now() - start);
    }
    const windowEnd = performance.now();
    // PerformanceObserver delivery is asynchronous. Give the browser one
    // task turn before selecting entries by their performance timeline window.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const heapAfter = heapSnapshot();
    const sceneLongTasks = longTasks.filter((entry) => entry.startTime >= windowStart && entry.startTime <= windowEnd);
    const sceneGc = gcEntries.filter((entry) => entry.startTime >= windowStart && entry.startTime <= windowEnd);
    return {
        scene: name,
        samples: SAMPLE_COUNT,
        entityCounts: snapshotCounts(),
        updateScript: roundSummary(summarize(updateSamples)),
        renderDraw: roundSummary(summarize(renderSamples)),
        longTask: {
            supported: longTasks.supported,
            count: sceneLongTasks.length,
            totalMs: round(sceneLongTasks.reduce((sum, entry) => sum + entry.duration, 0)),
            maxMs: round(sceneLongTasks.length ? Math.max(...sceneLongTasks.map((entry) => entry.duration)) : 0),
        },
        gc: {
            supported: gcEntries.supported,
            count: sceneGc.length,
            totalMs: round(sceneGc.reduce((sum, entry) => sum + (entry.duration || 0), 0)),
            note: gcEntries.supported ? '浏览器 PerformanceObserver 的 gc 条目；不代表所有回收都可见。' : '当前浏览器未提供 gc PerformanceObserver 条目，不能据此断言没有 GC。',
        },
        heap: {
            supported: heapBefore != null && heapAfter != null,
            beforeBytes: heapBefore,
            afterBytes: heapAfter,
            deltaBytes: heapBefore != null && heapAfter != null ? heapAfter - heapBefore : null,
            note: 'performance.memory 是非标准近似值，不能替代 GC pause 或完整堆剖析。',
        },
    };
}

async function run() {
    installSyntheticBadges();
    const longTasks = [];
    longTasks.supported = false;
    const gcEntries = [];
    gcEntries.supported = false;
    if (typeof PerformanceObserver !== 'undefined') {
        try {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'longtask') {
                        longTasks.push({ duration: entry.duration, startTime: entry.startTime });
                    } else if (entry.entryType === 'gc') {
                        gcEntries.push({ duration: entry.duration, startTime: entry.startTime });
                    }
                }
            });
            try { observer.observe({ type: 'longtask', buffered: true }); longTasks.supported = true; } catch { /* unsupported */ }
            try { observer.observe({ type: 'gc', buffered: true }); gcEntries.supported = true; } catch { /* unsupported */ }
        } catch { /* unsupported */ }
    }
    const scenes = ['ordinary', 'dense-bullets', 'chain-explosion', 'boss'];
    const results = [];
    for (const scene of scenes) {
        window.__PERF_V23_CURRENT_SCENE__ = scene;
        statusNode.textContent = `正在采样 ${scene}（${results.length + 1}/${scenes.length}）……`;
        // Yield so the status text paints and the browser can flush observer data.
        await new Promise((resolve) => requestAnimationFrame(resolve));
        results.push(await measureScene(scene, longTasks, gcEntries));
    }
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const output = {
        schema: 'starfighter-performance-v2.3',
        generatedAt: new Date().toISOString(),
        browser: navigator.userAgent,
        viewport: { width: canvas.width, height: canvas.height, dpr: window.devicePixelRatio || 1 },
        sampleCount: SAMPLE_COUNT,
        warmupCount: WARMUP_COUNT,
        frameBudgetMs: FRAME_BUDGET_MS,
        metrics: { updateScript: 'Game.update wall time', renderDraw: 'Game.render wall time', longTask: 'PerformanceObserver longtask', gc: 'PerformanceObserver gc when exposed' },
        scenes: results,
        limitations: [
            'Wall-time samples include browser scheduling and any synchronous work called by Game.update/render; they are not a profiler call tree.',
            'The harness uses synthetic deterministic entities and synthetic badge canvases to make repeated local runs comparable; it does not claim to model every production device.',
            'Long-task entries are observer-delivered and may be attributed to the scene whose sample was active, not to an exact call stack.',
            'GC is reported only when the browser exposes gc entries. Unsupported GC APIs are recorded as unsupported instead of inferred.',
        ],
    };
    window.__PERF_V23_RESULTS__ = output;
    resultNode.textContent = JSON.stringify(output, null, 2);
    statusNode.textContent = '完成。可复制下方 JSON，或在控制台读取 window.__PERF_V23_RESULTS__。';
    console.log('PERF_V23_RESULTS', output);
}

run().catch((error) => {
    const failure = { schema: 'starfighter-performance-v2.3', error: String(error?.stack || error) };
    window.__PERF_V23_RESULTS__ = failure;
    statusNode.textContent = '采样失败；详情见下方 JSON。';
    resultNode.textContent = JSON.stringify(failure, null, 2);
    console.error(error);
});
