import { Game } from '../core/game.js';
import { CONFIG } from '../core/config.js';

// Offscreen sprite cache. Static, reusable entities (enemies, bullets, items,
// player) are pre-rendered once onto offscreen canvases and then blitted with
// drawImage each frame. This avoids re-running the path fills (arcs, bezier
// curves, triangles) that make up their shapes during the hot render loop.
//
// Sprites are baked lazily on first use (in buildSprites-methods below) so only
// the variants actually seen on screen pay the one-time cost. The animated
// bosses are intentionally NOT pre-rendered — they rotate / pulse / drift, and
// there is only ever one of them.
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

// Map enemy type -> render.js draw method used to bake its sprite.
const ENEMY_DRAW = {
    0: 'drawDiamondEnemy',
    1: 'drawTriangleEnemy',
    2: 'drawHexagonEnemy',
    3: 'drawPlaneEnemy',
    4: 'drawCircleEnemy',
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

// Render one of Game's draw* methods into an offscreen canvas at (0, 0).
// The draw methods read `this.ctx`, so we swap it for the sprite context for
// the duration of the bake, then restore.
function bakeFromMethod(method, width, height, color) {
    const { canvas, ctx } = Game.makeSpriteCanvas(width, height);
    const realCtx = Game.ctx;
    Game.ctx = ctx;
    Game[method](0, 0, width, height, color);
    Game.ctx = realCtx;
    return canvas;
}

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
    const key = `${enemy.type}-${variant}-${enemy.width}x${enemy.height}-${enemy.color}-${Game.dpr}`;
    let sprite = this.spriteCache.enemies[key];
    if (!sprite) {
        const badgeKey = this.getEnemyBadgeKey(enemy.type, variant);
        sprite = badgeKey
            ? bakeBadgeSprite(badgeKey, enemy.width, enemy.height)
            : bakeFromMethod(ENEMY_DRAW[enemy.type], enemy.width, enemy.height, enemy.color);
        this.spriteCache.enemies[key] = sprite;
    }
    return sprite;
};

Game.getBulletSprite = function(width, height, color) {
    const key = `${width}x${height}-${color}-${Game.dpr}`;
    let sprite = this.spriteCache.bullets[key];
    if (!sprite) {
        sprite = bakeRect(width, height, color);
        this.spriteCache.bullets[key] = sprite;
    }
    return sprite;
};

Game.getItemSprite = function(type, width, height, color) {
    const key = `${type}-${width}x${height}-${color}-${Game.dpr}`;
    let sprite = this.spriteCache.items[key];
    if (!sprite) {
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
        const w = this.player.width;
        const shipH = this.player.height;
        const badgeKey = this.getPlayerBadgeKey();
        if (Game.badgeImages[badgeKey]) {
            // The school seal flies as-is; no hull or engine pods to bake around.
            this.spriteCache.player = bakeBadgeSprite(badgeKey, w, shipH);
        } else {
            // The hull is player.height tall, but the engine pods and exhaust flames
            // render BELOW the hull. The sprite canvas must be tall enough to hold
            // them, or they get clipped off the bottom edge. Bake with the ship's
            // true hull height so proportions stay correct, on a taller canvas.
            const ENGINE_EXTRA = 12; // engine pods (6) + exhaust flames (7) below the hull
            const { canvas: baked, ctx } = Game.makeSpriteCanvas(w, shipH + ENGINE_EXTRA);
            const realCtx = Game.ctx;
            Game.ctx = ctx;
            Game.drawTrianglePlayer(0, 0, w, shipH, this.player.color);
            Game.ctx = realCtx;
            this.spriteCache.player = baked;
        }
    }
    return this.spriteCache.player;
};

// Blit helpers used by render(). Each resolves the cached sprite and stamps it
// at the entity's current position; the logical destination size keeps the
// device-resolution backing store scaled correctly on high-DPI displays.
Game.drawEnemySprite = function(enemy) {
    this.ctx.drawImage(this.getEnemySprite(enemy), enemy.x, enemy.y, enemy.width, enemy.height);
};

Game.drawBulletSprite = function(bullet) {
    this.ctx.drawImage(this.getBulletSprite(bullet.width, bullet.height, bullet.color), bullet.x, bullet.y, bullet.width, bullet.height);
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

    // Rotate the cached badge around its center and gently breathe its scale.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.drawImage(sprite, -item.width / 2, -item.height / 2, item.width, item.height);
    ctx.restore();
};

Game.drawPlayerSprite = function() {
    this.ctx.drawImage(this.getPlayerSprite(), this.player.x, this.player.y, this.player.width, this.player.height);
};
