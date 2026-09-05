import { Game } from '../core/game.js';
import { CONFIG } from '../core/config.js';

// Offscreen sprite cache. Static, reusable entities (enemies, bullets, items,
// player) are pre-rendered once onto offscreen canvases and then blitted with
// drawImage each frame. This avoids re-running the path fills (arcs, bezier
// curves, triangles) that make up their shapes during the hot render loop.
//
// Sprites can only bake once their badge SVGs have loaded, so
// Game.prebakeSprites() warms the whole cache in one pass the moment every
// image is ready; the getters below stay lazy so anything missed still bakes
// on first use, and a getter whose badge image is missing returns null (the
// blit helpers then simply skip that entity). The animated bosses are
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
    const key = `${enemy.type}-${variant}-${enemy.width}x${enemy.height}-${enemy.color}-${Game.dpr}`;
    let sprite = this.spriteCache.enemies[key];
    if (!sprite) {
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
    const sprite = this.getPlayerSprite();
    if (!sprite) return; // unreachable after prebake; pure defense
    this.ctx.drawImage(sprite, this.player.x, this.player.y, this.player.width, this.player.height);
};

// One-shot prebake: badges.js calls this once every badge image is ready,
// filling the cache up front (player, all enemy variants, all bullet specs,
// items, boss badges) so gameplay never pays a first-use bake cost. Everything
// routes through the bake getters above; nothing is drawn here directly.
Game.prebakeSprites = function() {
    this.getPlayerSprite();
    for (let type = 0; type < CONFIG.enemyTypes.length; type++) {
        const t = CONFIG.enemyTypes[type];
        const variants = (Game.ENEMY_BADGES[type] || []).length;
        for (let v = 0; v < variants; v++) {
            this.getEnemySprite({ type: type, variant: v, width: t.width, height: t.height, color: t.color });
        }
    }
    // (w, h, color) specs match every bullet combination used in enemyBullets.js/boss.js/player.js
    const bulletSpecs = [
        [4, 12, '#ff0'], [4, 12, '#f90'],  // player normal / boosted
        [4, 12, '#f0f'],                   // enemy straight bullet
        [6, 6, '#ff0'],                    // tracking bullet
        [5, 5, '#0af'], [6, 6, '#0af'],    // ring bullet / ice fan
        [6, 6, '#f0f'],                    // wave bullet
        [5, 5, '#f90'],                    // scatter bullet
        [6, 6, '#f00'],                    // explosion bullet
        [6, 15, '#00f'],                   // ice pillar bullet
        [5, 5, '#a0f'],                    // poison ring bullet
    ];
    for (const [w, h, c] of bulletSpecs) this.getBulletSprite(w, h, c);
    this.getItemSprite(0, 20, 20, '#f00');
    this.getItemSprite(1, 20, 20, '#f90');
    this.getItemSprite(2, 20, 20, '#0af');
    for (let type = 0; type < CONFIG.bossTypes.length; type++) this.getBossBadgeSprite(type, 100);
    this.getMenuEmblemCanvas();
};
