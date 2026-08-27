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

// Render one of Game's draw* methods into an offscreen canvas at (0, 0).
// The draw methods read `this.ctx`, so we swap it for the sprite context for
// the duration of the bake, then restore.
function bakeFromMethod(method, width, height, color) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const spriteCtx = canvas.getContext('2d');
    const realCtx = Game.ctx;
    Game.ctx = spriteCtx;
    Game[method](0, 0, width, height, color);
    Game.ctx = realCtx;
    return canvas;
}

// Bake a plain solid rectangle (used for every bullet variant).
function bakeRect(width, height, color) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    return canvas;
}

Game.getEnemySprite = function(type, width, height, color) {
    const key = `${type}-${width}x${height}-${color}`;
    let sprite = this.spriteCache.enemies[key];
    if (!sprite) {
        sprite = bakeFromMethod(ENEMY_DRAW[type], width, height, color);
        this.spriteCache.enemies[key] = sprite;
    }
    return sprite;
};

Game.getBulletSprite = function(width, height, color) {
    const key = `${width}x${height}-${color}`;
    let sprite = this.spriteCache.bullets[key];
    if (!sprite) {
        sprite = bakeRect(width, height, color);
        this.spriteCache.bullets[key] = sprite;
    }
    return sprite;
};

Game.getItemSprite = function(type, width, height, color) {
    const key = `${type}-${width}x${height}-${color}`;
    let sprite = this.spriteCache.items[key];
    if (!sprite) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const spriteCtx = canvas.getContext('2d');
        const realCtx = Game.ctx;
        Game.ctx = spriteCtx;
        Game.drawItem(0, 0, width, height, color, type);
        Game.ctx = realCtx;
        sprite = canvas;
        this.spriteCache.items[key] = sprite;
    }
    return sprite;
};

Game.getPlayerSprite = function() {
    if (!this.spriteCache.player) {
        // The hull is player.height tall, but the engine pods and exhaust flames
        // render BELOW the hull. The sprite canvas must be tall enough to hold
        // them, or they get clipped off the bottom edge. Bake with the ship's
        // true hull height so proportions stay correct, on a taller canvas.
        const ENGINE_EXTRA = 12; // engine pods (6) + exhaust flames (7) below the hull
        const w = this.player.width;
        const shipH = this.player.height;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = shipH + ENGINE_EXTRA;
        const spriteCtx = canvas.getContext('2d');
        const realCtx = Game.ctx;
        Game.ctx = spriteCtx;
        Game.drawTrianglePlayer(0, 0, w, shipH, this.player.color);
        Game.ctx = realCtx;
        this.spriteCache.player = canvas;
    }
    return this.spriteCache.player;
};

// Blit helpers used by render(). Each resolves the cached sprite and stamps it
// at the entity's current position.
Game.drawEnemySprite = function(enemy) {
    this.ctx.drawImage(this.getEnemySprite(enemy.type, enemy.width, enemy.height, enemy.color), enemy.x, enemy.y);
};

Game.drawBulletSprite = function(bullet) {
    this.ctx.drawImage(this.getBulletSprite(bullet.width, bullet.height, bullet.color), bullet.x, bullet.y);
};

Game.drawEnemyBulletSprite = function(bullet) {
    this.ctx.drawImage(this.getBulletSprite(bullet.width, bullet.height, bullet.color), bullet.x, bullet.y);
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
    ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
    ctx.restore();
};

Game.drawPlayerSprite = function() {
    this.ctx.drawImage(this.getPlayerSprite(), this.player.x, this.player.y);
};
