import { Game } from '../core/game.js';
import { CONFIG } from '../core/config.js';

// Offscreen sprite cache. Static, reusable entities (enemies, bullets, items,
// player) are pre-rendered once onto offscreen canvases and then blitted with
// drawImage each frame. This avoids re-running the path fills (arcs, bezier
// curves, triangles) that make up their shapes during the hot render loop.
//
// Sprites can only bake once their badge SVGs have loaded, so
// Game.prebakeSprites() warms the whole cache in bounded batches the moment
// every image is ready; the getters below stay lazy as a defensive fallback,
// and a getter whose badge image is missing returns null (the blit helpers then
// simply skip that entity). The animated bosses are
// intentionally NOT pre-rendered — they rotate / pulse / drift, and there is
// only ever one of them.
//
// Every bake goes through makeSpriteCanvas, which scales the canvas backing
// store by Game.dpr and pre-scales its context, so bake code draws in logical
// pixels yet comes out device-pixel sharp; the blit helpers pass the logical
// destination size to drawImage to match.

Game.spriteCache = {
    enemies: {},
    bullets: {},
    items: {},
    player: null,
};
Game.spriteCacheSignature = null;
Game.spritePrewarmGeneration = 0;
Game.spritePrewarmRunId = 0;
Game.spritePrewarmState = { status: 'idle', completed: 0, total: 0, error: null };
Game.spriteCacheMisses = 0;
Game.spriteCacheMissCount = 0;

function spritePreloadConfig() {
    return CONFIG.spritePreload || {};
}

function isDevelopmentMode(game) {
    if (game.debugSprites === true || game.spriteDebug === true) return true;
    if (typeof CONFIG.developmentMode === 'boolean') return CONFIG.developmentMode;
    return typeof location !== 'undefined'
        && /^(localhost|127\.0\.0\.1|::1)$/.test(location.hostname || '');
}

Game.noteSpriteCacheMiss = function(kind, key) {
    if (!this.isRunning || this.isMenu || !isDevelopmentMode(this)) return;
    this.spriteCacheMisses = (this.spriteCacheMisses || 0) + 1;
    this.spriteCacheMissCount = this.spriteCacheMisses;
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn(`[sprites] 战斗期间缓存未命中: ${kind} ${key}`);
    }
};

// Cache validity depends on the device scale and the logical dimensions used
// by the baked sprites, not on the viewport dimensions. This lets a resize
// keep all existing canvases when the same sprites are still applicable.
Game.getSpriteCacheSignature = function(dpr = this.dpr || 1) {
    const player = this.player || CONFIG.player;
    const enemyDimensions = CONFIG.enemyTypes
        .map(({ width, height }) => `${width}x${height}`)
        .join(',');
    const preload = spritePreloadConfig();
    const bulletSpecs = (preload.bullets || [])
        .map(({ width, height, color, id }) => `${id || ''}:${width}x${height}:${color}`)
        .join(',');
    const itemSpecs = (preload.items || [])
        .map(({ type, width, height, color, id }) => `${id || ''}:${type}:${width}x${height}:${color}`)
        .join(',');
    const enemyVariants = (Game.ENEMY_BADGES || [])
        .map((variants) => variants.join(','))
        .join('|');
    return [
        dpr,
        `${player.width}x${player.height}`,
        enemyDimensions,
        enemyVariants,
        bulletSpecs,
        itemSpecs,
        preload.bossSize || 100,
        preload.menuEmblemSize || 512,
    ].join('|');
};

Game.invalidateSpriteCaches = function() {
    // Invalidate in-flight asynchronous warm-ups as well as their canvases.
    // A resize can otherwise let an old batch populate a cache for a stale
    // DPR after the new batch has already started.
    this.spritePrewarmGeneration = (this.spritePrewarmGeneration || 0) + 1;
    this.spriteCache.enemies = {};
    this.spriteCache.bullets = {};
    this.spriteCache.items = {};
    this.spriteCache.player = null;
    this.bossBadgeSprites = {};
    this.menuEmblemCanvas = null;
};

// Create an offscreen canvas at `width` x `height` LOGICAL pixels, backed at
// device resolution with its context pre-scaled, so callers draw in logical
// coordinates and the result stays sharp on high-DPI displays.
Game.makeSpriteCanvas = function(width, height) {
    const dpr = Game.dpr || 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { canvas, ctx };
};

// Bake a plain solid rectangle (used for every bullet variant).
function bakeRect(width, height, color) {
    const { canvas, ctx } = Game.makeSpriteCanvas(width, height);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    return canvas;
}

// Bake a school badge onto an exactly-sized sprite canvas.
function bakeBadgeSprite(key, width, height) {
    const { canvas, ctx } = Game.makeSpriteCanvas(width, height);
    Game.drawBadge(ctx, key, width / 2, height / 2, Math.min(width, height));
    return canvas;
}

Game.getEnemySprite = function(enemy) {
    const variant = enemy.variant || 0;
    // Enemy color is mutable hit-flash state and is not used by badge baking.
    // Omitting it prevents every white flash from creating a duplicate sprite.
    const key = `${enemy.type}-${variant}-${enemy.width}x${enemy.height}-${Game.dpr}`;
    let sprite = this.spriteCache.enemies[key];
    if (!sprite) {
        this.noteSpriteCacheMiss('enemy', key);
        const badgeKey = this.getEnemyBadgeKey(enemy.type, variant);
        if (!badgeKey) return null; // badge not loaded: don't bake or cache; renderer skips
        sprite = bakeBadgeSprite(badgeKey, enemy.width, enemy.height);
        this.spriteCache.enemies[key] = sprite;
    }
    return sprite;
};

Game.getBulletSprite = function(width, height, color) {
    const key = `${width}x${height}-${color}-${Game.dpr}`;
    let sprite = this.spriteCache.bullets[key];
    if (!sprite) {
        this.noteSpriteCacheMiss('bullet', key);
        sprite = bakeRect(width, height, color);
        this.spriteCache.bullets[key] = sprite;
    }
    return sprite;
};

Game.getItemSprite = function(type, width, height, color) {
    const key = `${type}-${width}x${height}-${color}-${Game.dpr}`;
    let sprite = this.spriteCache.items[key];
    if (!sprite) {
        this.noteSpriteCacheMiss('item', key);
        const { canvas, ctx } = Game.makeSpriteCanvas(width, height);
        const realCtx = Game.ctx;
        Game.ctx = ctx;
        Game.drawItem(0, 0, width, height, color, type);
        Game.ctx = realCtx;
        sprite = canvas;
        this.spriteCache.items[key] = sprite;
    }
    return sprite;
};

Game.getPlayerSprite = function() {
    if (!this.spriteCache.player) {
        this.noteSpriteCacheMiss('player', 'player');
        const badgeKey = this.getPlayerBadgeKey();
        if (!Game.badgeImages[badgeKey]) return null; // badge not loaded: renderer skips
        // The school seal flies as-is; no hull or engine pods to bake around.
        this.spriteCache.player = bakeBadgeSprite(badgeKey, this.player.width, this.player.height);
    }
    return this.spriteCache.player;
};

// Blit helpers used by render(). Each resolves the cached sprite and stamps it
// at the entity's current position; the logical destination size keeps the
// device-resolution backing store scaled correctly on high-DPI displays.
Game.drawEnemySprite = function(enemy) {
    const sprite = this.getEnemySprite(enemy);
    if (!sprite) return; // unreachable after prebake; pure defense
    this.ctx.drawImage(sprite, enemy.x, enemy.y, enemy.width, enemy.height);
};

Game.drawBulletSprite = function(bullet) {
    this.ctx.drawImage(this.getBulletSprite(bullet.width, bullet.height, bullet.color), bullet.x, bullet.y, bullet.width, bullet.height);
    // 疾速压制 feedback: the whole strengthened batch gets an outline, while
    // the actual primary gets a bright core. These are render-only fields and
    // never alter the collision box or bullet contribution values.
    if (bullet.rapidBatchBoosted) {
        const ctx = this.ctx;
        ctx.strokeStyle = 'rgba(80, 238, 255, 0.95)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bullet.x - 2, bullet.y - 2, bullet.width + 4, bullet.height + 4);
        ctx.fillStyle = 'rgba(255, 176, 80, 0.9)';
        ctx.beginPath();
        ctx.moveTo(bullet.x + bullet.width / 2, bullet.y + bullet.height);
        ctx.lineTo(bullet.x + 1, bullet.y + bullet.height + 7);
        ctx.lineTo(bullet.x + bullet.width - 1, bullet.y + bullet.height + 7);
        ctx.closePath();
        ctx.fill();

        if (bullet.isPrimary) {
            ctx.fillStyle = '#fff4bd';
            ctx.fillRect(bullet.x + bullet.width / 2 - 1, bullet.y + 2, 2, Math.max(3, bullet.height - 4));
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(bullet.x - 1, bullet.y - 1, bullet.width + 2, bullet.height + 2);
        }
    }
};

Game.drawEnemyBulletSprite = function(bullet) {
    this.ctx.drawImage(this.getBulletSprite(bullet.width, bullet.height, bullet.color), bullet.x, bullet.y, bullet.width, bullet.height);
};

Game.drawItemSprite = function(item) {
    const ctx = this.ctx;
    const sprite = this.getItemSprite(item.type, item.width, item.height, item.color);
    const spin = item.spin || 0;
    const cx = item.x + item.width / 2;
    const cy = item.y + item.height / 2;
    const angle = spin + this.gameTime * CONFIG.itemSpinSpeed;
    const scale = 1 + 0.08 * Math.sin(angle * 1.5);

    // Supply's 200px magnet gets a visible attraction line. The check is
    // intentionally outside the cached sprite so it follows the live item
    // and player positions without invalidating the cache.
    if (typeof this.drawSupplyAttraction === 'function') this.drawSupplyAttraction(item);

    // Rotate the cached badge around its center and gently breathe its scale.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.drawImage(sprite, -item.width / 2, -item.height / 2, item.width, item.height);
    ctx.restore();
};

Game.drawPlayerSprite = function() {
    const sprite = this.getPlayerSprite();
    if (!sprite) return; // unreachable after prebake; pure defense
    this.ctx.drawImage(sprite, this.player.x, this.player.y, this.player.width, this.player.height);
};

// Return the complete, enumerable warm-up plan.  The data table in CONFIG is
// the source of truth for projectiles/items; player/enemy/boss/menu entries
// are derived from their canonical dimensions and loaded badge variants.
Game.getSpritePreloadTasks = function() {
    const preload = spritePreloadConfig();
    const tasks = [{
        kind: 'player',
        key: 'player',
        run: () => this.getPlayerSprite(),
    }];

    for (let type = 0; type < CONFIG.enemyTypes.length; type++) {
        const spec = CONFIG.enemyTypes[type];
        const variants = (Game.ENEMY_BADGES?.[type] || []).length;
        for (let variant = 0; variant < variants; variant++) {
            tasks.push({
                kind: 'enemy',
                key: `${type}:${variant}`,
                run: () => this.getEnemySprite({
                    type, variant, width: spec.width, height: spec.height, color: spec.color,
                }),
            });
        }
    }

    for (const spec of preload.bullets || []) {
        tasks.push({
            kind: 'bullet',
            key: spec.id || `${spec.width}x${spec.height}:${spec.color}`,
            run: () => this.getBulletSprite(spec.width, spec.height, spec.color),
        });
    }
    for (const spec of preload.items || []) {
        tasks.push({
            kind: 'item',
            key: spec.id || `${spec.type}:${spec.width}x${spec.height}:${spec.color}`,
            run: () => this.getItemSprite(spec.type, spec.width, spec.height, spec.color),
        });
    }
    for (let type = 0; type < CONFIG.bossTypes.length; type++) {
        tasks.push({
            kind: 'boss',
            key: String(type),
            run: () => typeof this.getBossBadgeSprite === 'function'
                ? this.getBossBadgeSprite(type, preload.bossSize || 100)
                : null,
        });
    }
    tasks.push({
        kind: 'menu',
        key: 'emblem',
        run: () => typeof this.getMenuEmblemCanvas === 'function'
            ? this.getMenuEmblemCanvas()
            : null,
    });
    return tasks;
};

function scheduleSpriteBatch(callback, delay) {
    if (typeof setTimeout === 'function') return setTimeout(callback, delay);
    callback();
    return null;
}

// Batch the expensive canvas work and yield between every batch.  The
// generation guard makes cancellation cheap and prevents an old resize batch
// from writing into the cache for a newer DPR/dimension signature.
Game.prebakeSprites = function() {
    const generation = this.spritePrewarmGeneration || 0;
    const runId = (this.spritePrewarmRunId || 0) + 1;
    this.spritePrewarmRunId = runId;
    const tasks = this.getSpritePreloadTasks();
    const preload = spritePreloadConfig();
    const batchSize = Math.max(1, Number(preload.batchSize) || 1);
    const state = this.spritePrewarmState = {
        status: 'preparing',
        completed: 0,
        total: tasks.length,
        batchSize,
        runId,
        error: null,
    };
    const promise = new Promise((resolve) => {
        let cursor = 0;
        const finish = (result) => {
            // Cancellation is terminal for this run. Never fall through to
            // the ready path, even if a future caller reports cancellation
            // while the run id still happens to match.
            if (result?.cancelled) return resolve({ cancelled: true });
            if (this.spritePrewarmRunId !== runId) return resolve({ cancelled: true });
            if (result?.error) {
                state.status = 'error';
                state.error = result.error;
                if (this.badgeLoad?.phase === 'sprites' && this.badgeLoad.prewarmRunId === runId) {
                    this.badgeLoad.status = 'error';
                    this.badgeLoad.stage = 'sprites';
                    this.badgeLoad.spriteError = result.error;
                    if (typeof this.updateLoadUI === 'function') this.updateLoadUI();
                }
                return resolve(result);
            }
            state.status = 'ready';
            this.spriteCacheSignature = this.getSpriteCacheSignature();
            if (this.badgeLoad?.phase === 'sprites' && this.badgeLoad.prewarmRunId === runId) {
                this.badgeLoad.status = 'ready';
                this.badgeLoad.stage = 'ready';
                if (typeof this.updateLoadUI === 'function') this.updateLoadUI();
            }
            resolve({ completed: state.completed, total: state.total });
        };
        const runBatch = () => {
            if (this.spritePrewarmRunId !== runId || this.spritePrewarmGeneration !== generation) {
                return finish({ cancelled: true });
            }
            try {
                const end = Math.min(cursor + batchSize, tasks.length);
                for (; cursor < end; cursor++) {
                    const result = tasks[cursor].run();
                    if (result === null && ['player', 'enemy', 'boss', 'menu'].includes(tasks[cursor].kind)) {
                        throw new Error(`精灵预生成未完成: ${tasks[cursor].kind}/${tasks[cursor].key}`);
                    }
                    state.completed++;
                }
                if (this.badgeLoad?.phase === 'sprites'
                    && this.badgeLoad.prewarmRunId === runId
                    && typeof this.updateLoadUI === 'function') this.updateLoadUI();
            } catch (error) {
                return finish({ error });
            }
            if (cursor >= tasks.length) return finish({});
            // Even the first batch is scheduled asynchronously; this prevents
            // a resize or a long frame from blocking on the whole warm-up.
            scheduleSpriteBatch(runBatch, Math.max(0, Number(preload.batchYieldMs) || 0));
        };
        scheduleSpriteBatch(runBatch, 0);
    });
    this.spritePrewarmPromise = promise;
    // A resize calls prebakeSprites directly from core/game.js. Keep the
    // badge readiness gate attached to whichever run is current.
    if (this.badgeLoad?.phase === 'sprites') this.badgeLoad.prewarmRunId = runId;
    return promise;
};
