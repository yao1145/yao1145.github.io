import { Game } from '../core/game.js';

// School-badge (校徽) skin. The SVGs in /校徽 are loaded as images and kept as
// raw vectors; every consumer rasterizes them at its FINAL on-screen size via
// Game.drawBadge, so a seal drawn at 30px is rendered from vectors at 30px
// instead of being downscaled from a shared bitmap (which turned the fine
// linework muddy). University seals are inked in dark school colours on
// transparent ground, which would vanish against the black starfield, hence
// the white backing disc drawn under each logo.
//
// Every consumer falls back to the original procedural drawing until (or unless)
// its badge finishes loading, so a missing /校徽 folder degrades gracefully.

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
const ENEMY_BADGES = [
    ['南开大学-logo.svg', '武汉大学-logo.svg'],                // kamikaze
    ['复旦大学-logo.svg', '西安交通大学-logo.svg'],            // fast shooter
    ['中国人民大学-logo.svg', '华中科技大学-logo.svg'],        // tank
    ['中国科学技术大学-logo.svg', '哈尔滨工业大学-logo.svg'],  // tracker
    ['中国科学院大学-logo.svg'],                               // ring shooter
];

// Rasterize the badge `key` centered at (cx, cy) at `size` logical px into any
// 2D context: white backing disc, thin edge ring, logo contain-fitted inside.
// Vector source means the result is crisp at every size. Returns false when
// the image hasn't loaded, so the caller can fall back to procedural drawing.
Game.drawBadge = function(ctx, key, cx, cy, size) {
    const img = Game.badgeImages[key];
    if (!img) return false;

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

Game.loadBadges = function() {
    const files = [PLAYER_BADGE, ...BOSS_BADGES, ...ENEMY_BADGES.flat()];
    for (const file of files) {
        const img = new Image();
        img.onload = () => {
            Game.badgeImages[file] = img;
            // Re-bake lazily: anything already stamped procedurally picks the
            // badge up on the next frame.
            Game.spriteCache.player = null;
            Game.spriteCache.enemies = {};
        };
        img.src = encodeURI(`${BADGE_DIR}/${file}`);
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
Game.getBossBadgeKey = type => BOSS_BADGES[type];
Game.getEnemyBadgeKey = (type, variant) => {
    const list = ENEMY_BADGES[type] || [];
    return list[variant % list.length] || null;
};

Game.rollEnemyVariant = function(type) {
    const list = ENEMY_BADGES[type] || [];
    return Math.floor(Math.random() * list.length);
};
