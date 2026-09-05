import { Game } from '../core/game.js';

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

// Load state machine doubling as the main-menu readiness gate.
// status: 'loading' | 'ready' | 'error'; total = file count, failed collects
// the names of files that failed to load, for retry.
Game.badgeLoad = { status: 'loading', loaded: 0, total: 0, failed: [] };

// Load one badge file; success or not, it settles into the state machine and
// refreshes the load UI.
Game.loadBadgeFile = function(file) {
    const img = new Image();
    img.onload = () => {
        Game.badgeImages[file] = img;
        // Re-bake lazily: anything already stamped procedurally picks the
        // badge up on the next frame.
        Game.spriteCache.player = null;
        Game.spriteCache.enemies = {};
        Game.badgeLoad.loaded++;
        Game.onBadgeSettled();
    };
    img.onerror = () => {
        Game.badgeLoad.failed.push(file);
        Game.onBadgeSettled();
    };
    img.src = encodeURI(`${BADGE_DIR}/${file}`);
};

// Per-settle step: refresh UI until every file has settled, then finalize by
// outcome — on success call the sprites.js prebake contract (no args/return)
// before opening the readiness gate.
Game.onBadgeSettled = function() {
    const load = Game.badgeLoad;
    Game.updateLoadUI();
    if (load.loaded + load.failed.length < load.total) return;

    if (load.failed.length > 0) {
        load.status = 'error';
    } else {
        Game.prebakeSprites();
        load.status = 'ready';
    }
    Game.updateLoadUI();
};

Game.loadBadges = function() {
    const files = [PLAYER_BADGE, ...BOSS_BADGES, ...Game.ENEMY_BADGES.flat()];
    const load = Game.badgeLoad;
    load.total = files.length;
    load.loaded = 0;
    load.failed = [];
    load.status = 'loading';

    // Wire the retry click here (precedent: cards.js wires its own cardPanel
    // delegated click); bound only once.
    const retryButton = document.getElementById('retryLoadButton');
    if (retryButton && !retryButton.dataset.badgeRetryBound) {
        retryButton.dataset.badgeRetryBound = '1';
        retryButton.addEventListener('click', () => this.retryBadges());
    }

    for (const file of files) Game.loadBadgeFile(file);
};

// Retry failed loads: return early while loading (guards double clicks);
// otherwise reset the counters and re-issue loads for only the failed files
// (same URLs, no cache-buster), through the identical settle chain.
Game.retryBadges = function() {
    const load = Game.badgeLoad;
    if (load.status === 'loading') return;

    const retryFiles = load.failed.slice();
    load.total = retryFiles.length;
    load.loaded = 0;
    load.failed = [];
    load.status = 'loading';

    Game.updateLoadUI();
    for (const file of retryFiles) Game.loadBadgeFile(file);
};

// Start-panel loading UI: visibility and labels of the status line
// (#loadStatus), retry button (#retryLoadButton) and start button
// (#startButton), refreshed on every badgeLoad advance.
Game.updateLoadUI = function() {
    const load = Game.badgeLoad;
    const statusEl = document.getElementById('loadStatus');
    const retryButton = document.getElementById('retryLoadButton');
    const startButton = document.getElementById('startButton');

    if (statusEl) {
        if (load.status === 'ready') {
            statusEl.style.display = 'none';
        } else if (load.status === 'error') {
            statusEl.style.display = '';
            statusEl.textContent = `资源加载失败（${load.failed.length} 张校徽未就绪）`;
        } else {
            statusEl.style.display = '';
            statusEl.textContent = `资源加载中 ${load.loaded}/${load.total}…`;
        }
    }

    // Retry entry offered only in the error state.
    if (retryButton) {
        retryButton.style.display = load.status === 'error' ? '' : 'none';
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
const MENU_EMBLEM_BAKE = 512;

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
