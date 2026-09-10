import { Game } from '../core/game.js';
import { CONFIG } from '../core/config.js';

// School-badge skin. The SVGs in the badge folder (BADGE_DIR) are loaded as
// images and kept as raw vectors; every consumer rasterizes them at its FINAL
// on-screen size via Game.drawBadge, so a seal drawn at 30px is rendered from
// vectors at 30px instead of being downscaled from a shared bitmap (which
// turned the fine linework muddy). Seals are inked in dark school colours on
// transparent ground, which would vanish against the black starfield, hence
// the white backing disc drawn under each logo.
//
// Loading is a hard readiness gate on the main menu: the start button stays
// disabled until every badge settles (Game.badgeLoad), a failed badge offers
// a retry instead of a procedural fallback, and only after the whole set is
// in does Game.prebakeSprites() bake the sprites once, up front.

const BADGE_DIR = '校徽';
const DISC_INSET = 0.035;  // backing-disc padding, as a fraction of badge size
const RING_WIDTH = 0.02;   // edge-ring stroke width, as a fraction of badge size
const LOGO_SCALE = 0.86;   // logo size relative to the disc diameter

// Player + the three boss archetypes (index matches CONFIG.bossTypes order).
const PLAYER_BADGE = '北京大学-logo.svg';
const BOSS_BADGES = [
    '清华大学-logo.svg',      // fire boss
    '浙江大学-logo.svg',      // ice boss
    '上海交通大学-logo.svg',  // poison boss
];

// The remaining nine badges, split across the five enemy types. Each enemy
// rolls a random variant from its type's list on spawn, so all nine appear.
// Public (Game.ENEMY_BADGES) so other modules can enumerate the enemy seals.
Game.ENEMY_BADGES = [
    ['南开大学-logo.svg', '武汉大学-logo.svg'],                // kamikaze
    ['复旦大学-logo.svg', '西安交通大学-logo.svg'],            // fast shooter
    ['中国人民大学-logo.svg', '华中科技大学-logo.svg'],        // tank
    ['中国科学技术大学-logo.svg', '哈尔滨工业大学-logo.svg'],  // tracker
    ['中国科学院大学-logo.svg'],                               // ring shooter
];

// Rasterize the badge `key` centered at (cx, cy) at `size` logical px into any
// 2D context: white backing disc, thin edge ring, logo contain-fitted inside.
// Vector source means the result is crisp at every size. Returns false when
// the image hasn't loaded; callers then skip drawing that entity (loading is
// gated upstream by Game.badgeLoad, so this is a defensive path only).
Game.drawBadge = function(ctx, key, cx, cy, size) {
    const img = Game.badgeImages[key];
    if (!img) {
        // Unreachable past the readiness gate; diagnostics only.
        console.warn('校徽未加载:', key);
        return false;
    }

    const discR = size / 2 * (1 - DISC_INSET);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx, cy, discR, 0, Math.PI * 2);
    ctx.fill();

    // Thin ring so the sticker edge still reads where the logo itself is white.
    const ring = Math.max(1, size * RING_WIDTH);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = ring;
    ctx.beginPath();
    ctx.arc(cx, cy, discR - ring / 2, 0, Math.PI * 2);
    ctx.stroke();

    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (!w || !h) { w = h = 1; } // viewBox-only SVG: fit the full square
    const scale = (discR * 2 * LOGO_SCALE) / Math.max(w, h);
    ctx.drawImage(img, cx - w * scale / 2, cy - h * scale / 2, w * scale, h * scale);
    return true;
};

Game.badgeImages = {};
Game.bossBadgeSprites = {};

// Load state machine doubling as the main-menu readiness gate.  `status` is
// deliberately not `ready` until both stages settle: `phase: resources` is
// download progress, and `phase: sprites` is canvas preparation progress.
Game.badgeLoad = {
    status: 'loading',
    phase: 'resources',
    stage: 'resources',
    loaded: 0,
    settled: 0,
    total: 0,
    failed: [],
    token: 0,
    spriteError: null,
    prewarmRunId: 0,
};

function badgeFiles() {
    return [PLAYER_BADGE, ...BOSS_BADGES, ...Game.ENEMY_BADGES.flat()];
}

function beginBadgeResourceLoad(files) {
    const load = Game.badgeLoad;
    load.token = (load.token || 0) + 1;
    const token = load.token;
    load.status = 'loading';
    load.phase = load.stage = 'resources';
    load.total = files.length;
    load.loaded = 0;
    load.settled = 0;
    load.failed = [];
    load.spriteError = null;
    Game.updateLoadUI();
    for (const file of files) Game.loadBadgeFile(file, token);
}

// Load one badge file with an application-level timeout.  The local settled
// guard plus load token makes late onload/onerror callbacks harmless, including
// callbacks from an abandoned retry or a timed-out image.
Game.loadBadgeFile = function(file, token = this.badgeLoad.token) {
    const load = this.badgeLoad;
    const timeoutMs = Math.max(1, Number(CONFIG.spritePreload?.imageTimeoutMs) || 10000);
    const img = new Image();
    let settled = false;
    let timer = null;
    const settle = (ok, error = null) => {
        if (settled || load.token !== token) return;
        settled = true;
        if (timer !== null) clearTimeout(timer);
        load.settled++;
        if (ok) {
            this.badgeImages[file] = img;
            this.spriteCache.player = null;
            this.spriteCache.enemies = {};
            load.loaded++;
        } else if (!load.failed.includes(file)) {
            load.failed.push(file);
            if (error) load.lastError = error;
        }
        this.onBadgeSettled();
    };
    img.onload = () => settle(true);
    img.onerror = () => settle(false, new Error(`校徽加载失败: ${file}`));
    timer = setTimeout(() => settle(false, new Error(`校徽加载超时: ${file}`)), timeoutMs);
    try {
        img.src = encodeURI(`${BADGE_DIR}/${file}`);
    } catch (error) {
        settle(false, error);
    }
    return img;
};

// Per-settle step: refresh UI until every resource settles, then start the
// asynchronous sprite warm-up.  Sprite completion is reported by sprites.js,
// so a resize-triggered replacement run keeps the same readiness gate.
Game.onBadgeSettled = function() {
    const load = this.badgeLoad;
    this.updateLoadUI();
    if (load.status !== 'loading' || load.settled < load.total) return;

    if (load.failed.length > 0) {
        load.status = 'error';
        load.phase = load.stage = 'resources';
        this.updateLoadUI();
        return;
    }

    load.status = 'preparing';
    load.phase = load.stage = 'sprites';
    load.spriteError = null;
    this.updateLoadUI();
    // prebakeSprites is promise-based in production; Promise.resolve also
    // keeps the gate compatible with a synchronous test stub.
    try {
        const promise = this.prebakeSprites();
        load.prewarmRunId = this.spritePrewarmRunId || load.prewarmRunId;
        Promise.resolve(promise).then((result) => {
            if (load.status !== 'preparing' || load.phase !== 'sprites') return;
            if (result?.cancelled) return;
            if (result?.error) {
                load.status = 'error';
                load.spriteError = result.error;
                this.updateLoadUI();
            }
        }).catch((error) => {
            if (load.status !== 'preparing' || load.phase !== 'sprites') return;
            load.status = 'error';
            load.spriteError = error;
            this.updateLoadUI();
        });
    } catch (error) {
        load.status = 'error';
        load.spriteError = error;
        this.updateLoadUI();
    }
};

Game.loadBadges = function() {
    // Wire the retry click here (precedent: cards.js wires its own cardPanel
    // delegated click); bound only once.
    const retryButton = typeof document === 'undefined'
        ? null
        : document.getElementById('retryLoadButton');
    if (retryButton && !retryButton.dataset.badgeRetryBound) {
        retryButton.dataset.badgeRetryBound = '1';
        retryButton.addEventListener('click', () => this.retryBadges());
    }
    beginBadgeResourceLoad(badgeFiles());
};

// Retry failed downloads, or retry only the sprite stage when all resources
// are already present.  Double clicks during either active stage are ignored.
Game.retryBadges = function() {
    const load = this.badgeLoad;
    if (load.status === 'loading' || load.status === 'preparing') return;
    if (load.phase === 'sprites' && load.failed.length === 0) {
        load.status = 'preparing';
        load.stage = 'sprites';
        load.spriteError = null;
        this.updateLoadUI();
        try {
            const promise = this.prebakeSprites();
            load.prewarmRunId = this.spritePrewarmRunId || load.prewarmRunId;
            Promise.resolve(promise).catch((error) => {
                if (load.status === 'preparing') {
                    load.status = 'error';
                    load.spriteError = error;
                    this.updateLoadUI();
                }
            });
        } catch (error) {
            load.status = 'error';
            load.spriteError = error;
            this.updateLoadUI();
        }
        return;
    }
    beginBadgeResourceLoad(load.failed.slice());
};

// Start-panel loading UI: visibility and labels of the status line
// (#loadStatus), retry button (#retryLoadButton) and start button
// (#startButton), refreshed on every badgeLoad advance.
Game.updateLoadUI = function() {
    const load = Game.badgeLoad;
    const getElement = (id) => typeof document === 'undefined' ? null : document.getElementById(id);
    const statusEl = getElement('loadStatus');
    const retryButton = getElement('retryLoadButton');
    const startButton = getElement('startButton');

    if (statusEl) {
        if (load.status === 'ready') {
            statusEl.style.display = 'none';
        } else if (load.status === 'error') {
            statusEl.style.display = '';
            statusEl.textContent = load.phase === 'sprites'
                ? `图形准备失败${load.spriteError ? `：${load.spriteError.message || load.spriteError}` : ''}`
                : `资源下载失败（${load.failed.length} 张校徽未就绪）`;
        } else if (load.status === 'preparing' || load.phase === 'sprites') {
            statusEl.style.display = '';
            const sprite = Game.spritePrewarmState || {};
            statusEl.textContent = `图形准备中 ${sprite.completed || 0}/${sprite.total || 0}…`;
        } else {
            statusEl.style.display = '';
            statusEl.textContent = `资源下载中 ${load.loaded}/${load.total}…`;
        }
    }

    // Retry entry offered only in the error state.
    if (retryButton) {
        retryButton.style.display = load.status === 'error' ? '' : 'none';
        retryButton.textContent = load.phase === 'sprites' ? '重试图形准备' : '重试资源下载';
    }

    // Loading only happens on the pre-game main menu; this is never called
    // after ready, so no pause-flow (resume) states are handled here.
    if (startButton) {
        if (load.status === 'ready') {
            startButton.disabled = false;
            startButton.textContent = '开始游戏';
        } else if (load.status === 'error') {
            startButton.disabled = true;
            startButton.textContent = '资源未就绪';
        } else {
            startButton.disabled = true;
            startButton.textContent = '加载中…';
        }
    }
};

// Boss badges are drawn every frame, so they get their own pre-baked canvases
// (at the boss's on-screen size, device-pixel sharp via makeSpriteCanvas).
Game.getBossBadgeSprite = function(type, size) {
    const key = BOSS_BADGES[type];
    if (!Game.badgeImages[key]) return null;

    const cacheKey = `${key}-${size}x${Game.dpr}`;
    let sprite = Game.bossBadgeSprites[cacheKey];
    if (!sprite) {
        if (typeof Game.noteSpriteCacheMiss === 'function') Game.noteSpriteCacheMiss('boss', cacheKey);
        const { canvas, ctx } = Game.makeSpriteCanvas(size, size);
        Game.drawBadge(ctx, key, size / 2, size / 2, size);
        sprite = canvas;
        Game.bossBadgeSprites[cacheKey] = sprite;
    }
    return sprite;
};

Game.getPlayerBadgeKey = () => PLAYER_BADGE;

// Menu backdrop emblem: the player's seal baked once at high resolution so
// the menu render just drawImages a plain canvas each frame.
const MENU_EMBLEM_BAKE = CONFIG.spritePreload?.menuEmblemSize || 512;

Game.getMenuEmblemCanvas = function() {
    if (Game.menuEmblemCanvas) return Game.menuEmblemCanvas;
    if (!Game.badgeImages[PLAYER_BADGE]) return null;

    const { canvas, ctx } = Game.makeSpriteCanvas(MENU_EMBLEM_BAKE, MENU_EMBLEM_BAKE);
    Game.drawBadge(ctx, PLAYER_BADGE, MENU_EMBLEM_BAKE / 2, MENU_EMBLEM_BAKE / 2, MENU_EMBLEM_BAKE);
    Game.menuEmblemCanvas = canvas;
    return canvas;
};
Game.getBossBadgeKey = type => BOSS_BADGES[type];
Game.getEnemyBadgeKey = (type, variant) => {
    const list = Game.ENEMY_BADGES[type] || [];
    return list[variant % list.length] || null;
};

Game.rollEnemyVariant = function(type) {
    const list = Game.ENEMY_BADGES[type] || [];
    return Math.floor(Math.random() * list.length);
};
