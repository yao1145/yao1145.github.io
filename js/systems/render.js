import { Game } from '../core/game.js';

// The build HUD is intentionally DOM-only. Combat timers continue to advance
// from the fixed-step simulation; this method only paints the latest snapshot
// when updateUI's existing throttle permits a DOM refresh.
Game.updateBuildHUD = function(force = false) {
    if (typeof document === 'undefined') return;

    const hud = this.buildHud || document.getElementById('buildHud');
    if (!hud) return;
    this.buildHud = hud;

    if (this.isMenu || this.isGameOver) {
        hud.replaceChildren();
        hud.hidden = true;
        return;
    }

    const states = typeof this.getBuildHudStates === 'function'
        ? this.getBuildHudStates()
        : [];
    const rows = Array.isArray(states) ? states.slice(0, 2) : [];

    hud.replaceChildren();
    hud.hidden = rows.length === 0;
    if (hud.hidden) return;

    for (const state of rows) {
        if (!state) continue;
        const row = document.createElement('div');
        row.className = 'buildHudRow';
        if (state.line) row.dataset.line = state.line;
        if (state.key) row.dataset.key = state.key;
        if (state.active) row.classList.add('isActive');

        const label = document.createElement('span');
        label.className = 'buildHudLabel';
        label.textContent = state.label || state.key || '强化';

        const value = document.createElement('span');
        value.className = 'buildHudValue';
        value.textContent = state.value == null ? '' : String(state.value);

        row.append(label, value);
        hud.append(row);
    }

};

const LINE_LABELS = {
    rapid: '疾速压制',
    fortress: '坚壁续航',
    desperate: '绝境反攻',
    chain: '连锁清场',
    hunter: '破甲猎王',
    supply: '补给运营',
};

// Pause details are read-only and deliberately guarded: card selection, boss
// rewards, the menu, and game-over must keep the details hidden even though
// they also leave the simulation stopped.
Game.updatePauseBuildDetails = function() {
    if (typeof document === 'undefined') return;

    const panel = document.getElementById('pauseBuildDetails');
    const list = document.getElementById('pauseBuildList');
    const warning = document.getElementById('pauseBuildWarning');
    if (!panel || !list || !warning) return;

    const isPlainPause = !this.isRunning
        && !this.isGameOver
        && !this.isMenu
        && !this.isCardSelectionOpen
        && !this.rewardFlow;
    if (!isPlainPause) {
        panel.hidden = true;
        list.replaceChildren();
        warning.hidden = true;
        warning.textContent = '';
        return;
    }

    const owned = this.buildState && Array.isArray(this.buildState.owned)
        ? this.buildState.owned
        : [];
    const builds = this.BUILDS || {};
    list.replaceChildren();

    if (owned.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'pauseBuildEmpty';
        empty.textContent = '暂无已获得强化';
        list.append(empty);
    } else {
        for (const id of owned) {
            const build = builds[id];
            if (!build) continue;

            const item = document.createElement('div');
            item.className = 'pauseBuildItem';
            item.setAttribute('role', 'listitem');

            const name = document.createElement('span');
            name.className = 'pauseBuildName';
            name.textContent = build.name;

            const meta = document.createElement('span');
            meta.className = 'pauseBuildMeta';
            meta.textContent = LINE_LABELS[build.line] || build.line || '';

            const summary = document.createElement('span');
            summary.className = 'pauseBuildSummary';
            summary.textContent = build.summary || '';

            item.append(name, meta, summary);
            list.append(item);
        }
    }

    const hasDesperate = owned.some((id) => builds[id] && builds[id].line === 'desperate');
    const glassDisablesDesperate = this.activeCard === 'glass' && hasDesperate;
    warning.hidden = !glassDisablesDesperate;
    warning.textContent = glassDisablesDesperate
        ? '绝境反攻暂不生效：当前生命上限为 1'
        : '';
    panel.hidden = false;
};

// game.js calls this hook while entering a normal pause. Keep the descriptive
// alias here so that the core lifecycle does not need to know presentation
// details, while the renderer remains safe to load in headless tests.
Game.updatePauseDetails = Game.updatePauseBuildDetails;

Game.render = function() {
    const ctx = this.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.width, this.height);

    // Drifting starfield — the menu backdrop and the game's deep-space
    // backdrop alike.
    this.drawStarfield(performance.now());

    // On the main menu the canvas also carries the school-seal watermark,
    // while the DOM overlay provides the menu UI itself.
    if (this.isMenu) {
        this.drawMenuEmblem(performance.now());
        return;
    }

    if (this.player.shieldTime > 0) {
        ctx.strokeStyle = '#0af';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(
            this.player.x + this.player.width/2,
            this.player.y + this.player.height/2,
            Math.max(this.player.width, this.player.height)/2 + 3,
            0, Math.PI * 2
        );
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    }

    // 稳态屏障: a single green outline sits inside the original temporal
    // shield ring. It is purely visual; consumption creates one short ring
    // through the shared particle path.
    if (this.buildState && this.buildState.locks.fortressBarrier) {
        ctx.strokeStyle = '#7cff8a';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(
            this.player.x + this.player.width / 2,
            this.player.y + this.player.height / 2,
            Math.max(this.player.width, this.player.height) / 2 + 1,
            0, Math.PI * 2
        );
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    }

    this.drawPlayerSprite();

    const bulletPool = this.objectPools.bullets;
    for (const bullet of bulletPool.active) {
        this.drawBulletSprite(bullet);
    }

    const enemyBulletPool = this.objectPools.enemyBullets;
    for (const bullet of enemyBulletPool.active) {
        this.drawEnemyBulletSprite(bullet);
    }

    const enemyPool = this.objectPools.enemies;
    for (const enemy of enemyPool.active) {
        this.drawEnemySprite(enemy);

        // Force-show the health bar for every enemy regardless of type or
        // level. Uniform color rule: green above half health, red at half
        // or below — so full-health (including 1-HP) enemies show green.
        const healthBarWidth = 20;
        const healthBarHeight = 3;
        const healthBarX = enemy.x + (enemy.width - healthBarWidth) / 2;
        const healthBarY = enemy.y - 5;

        ctx.fillStyle = '#333';
        ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);

        const healthPercent = enemy.health / enemy.maxHealth;
        ctx.fillStyle = healthPercent > 0.5 ? '#0f0' : '#f00';
        ctx.fillRect(healthBarX, healthBarY, healthBarWidth * healthPercent, healthBarHeight);

        // 破甲猎王 feedback: thin edge arc + mark count on the locked target.
        this.drawHunterMark(enemy.entityId, enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, Math.max(enemy.width, enemy.height) / 2 + 4);
    }

    const itemPool = this.objectPools.items;
    for (const item of itemPool.active) {
        this.drawItemSprite(item);
    }

    if (this.boss) {
        this.drawBoss(this.boss.x, this.boss.y, this.boss.width, this.boss.height, this.boss.color);
        this.drawHunterMark(this.boss.entityId, this.boss.x + this.boss.width / 2, this.boss.y + this.boss.height / 2, Math.max(this.boss.width, this.boss.height) / 2 + 6);
    }

    const particlePool = this.objectPools.particles;
    for (const particle of particlePool.active) {
        if (particle.isRing) {
            // Shockwave ring: a fading circle expanding around the particle center.
            const alpha = particle.life / 14;
            ctx.strokeStyle = particle.color;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            const alpha = particle.life / 10;
            ctx.fillStyle = particle.color;
            ctx.globalAlpha = alpha;
            ctx.fillRect(particle.x, particle.y, 2, 2);
        }
    }
    ctx.globalAlpha = 1.0;

    // Opaque fog of war: the mist bank is drawn AFTER the whole world,
    // so enemies/boss and their bullets above the fog line are concealed by an
    // opaque layer; anything crossing below the line emerges into view. A single
    // gradient fill per frame is the whole cost (no per-sprite work).
    if (this.activeCard === 'fog') {
        this.drawFogBand(this.height * 0.5);
    }
};

// Fog bank: an opaque vertical mist covering the top half of the
// screen. Fully solid from the top edge to FOG_MARGIN pixels ABOVE the fog
// line, then a smooth FOG_MARGIN-up/FOG_MARGIN-down gradient so enemies
// "emerge" progressively across the boundary instead of popping in at a hard
// cut. Inside the solid zone enemies are completely invisible.
Game.drawFogBand = function(fogLine) {
    const ctx = this.ctx;
    const margin = 50; // gradient fade band, 50px above/below the fog line
    const bottom = fogLine + margin;
    const fadeStart = Math.max(0, fogLine - margin);

    const gradient = ctx.createLinearGradient(0, 0, 0, bottom);
    gradient.addColorStop(0, 'rgba(10, 17, 30, 1)');
    gradient.addColorStop(fadeStart / bottom, 'rgba(10, 17, 30, 1)');
    gradient.addColorStop(1, 'rgba(10, 17, 30, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, bottom);
};

// 破甲猎王 target mark: a thin arc at the entity edge plus the mark count,
// drawn only for the currently locked target. Decoration only — it never
// touches the collision box or the simulation.
Game.drawHunterMark = function(targetId, cx, cy, radius) {
    const lock = this.buildState && this.buildState.locks;
    if (!lock || lock.hunterTargetId == null || lock.hunterTargetId !== targetId) return;
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(140, 240, 255, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2.6, Math.PI / 2.6);
    ctx.stroke();
    ctx.fillStyle = 'rgba(140, 240, 255, 0.95)';
    ctx.font = '10px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(lock.hunterHits), cx, cy - radius - 4);
};

Game.drawBoss = function(x, y, width, height, color) {
    const ctx = this.ctx;
    const centerX = x + width/2;
    const centerY = y + height/2;

    switch (this.boss.type) {
        case 0:
            this.drawFireBoss(x, y, width, height, color, centerX, centerY);
            break;
        case 1:
            this.drawIceBoss(x, y, width, height, color, centerX, centerY);
            break;
        case 2:
            this.drawPoisonBoss(x, y, width, height, color, centerX, centerY);
            break;
    }
};

Game.drawFireBoss = function(x, y, width, height, color, centerX, centerY) {
    const ctx = this.ctx;
    const r = Math.min(width, height) / 2;
    const flicker = Math.sin(this.boss.waveOffset * 2);

    // Skip drawing if the badge sprite isn't ready (unreachable after prebake; pure defense).
    const sprite = this.getBossBadgeSprite(this.boss.type, r * 2);
    if (!sprite) return;

    // Rotating flame spikes that flicker outward — orbit decoration, independent of the badge sprite.
    ctx.fillStyle = '#f60';
    for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI * 2) / 10 + this.boss.waveOffset * 0.6;
        const spikeLen = r + 6 + flicker * 2;
        const px = centerX + Math.cos(angle) * spikeLen;
        const py = centerY + Math.sin(angle) * spikeLen;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(4, 3);
        ctx.lineTo(-4, 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    // Body — the school badge, with the flame corona still orbiting outside it.
    ctx.drawImage(sprite, centerX - r, centerY - r, r * 2, r * 2);
};

Game.drawIceBoss = function(x, y, width, height, color, centerX, centerY) {
    const ctx = this.ctx;
    const r = Math.min(width, height) / 2;

    // Skip drawing if the badge sprite isn't ready (unreachable after prebake; pure defense).
    const sprite = this.getBossBadgeSprite(this.boss.type, r * 2);
    if (!sprite) return;

    // Drifting crystal shards around the body — orbit decoration, independent of the badge sprite.
    ctx.fillStyle = '#0cf';
    for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI * 2) / 6 + this.boss.waveOffset * 0.5;
        const px = centerX + Math.cos(angle) * (r + 6);
        const py = centerY + Math.sin(angle) * (r + 6);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle + Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(4, 3);
        ctx.lineTo(-4, 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    // Body — the school badge, with the crystal shards still orbiting outside it.
    ctx.drawImage(sprite, centerX - r, centerY - r, r * 2, r * 2);
};

Game.drawPoisonBoss = function(x, y, width, height, color, centerX, centerY) {
    const ctx = this.ctx;
    const r = Math.min(width, height) / 2;
    const drift = this.boss.movePhase;

    // Skip drawing if the badge sprite isn't ready (unreachable after prebake; pure defense).
    const sprite = this.getBossBadgeSprite(this.boss.type, r * 2);
    if (!sprite) return;

    // Toxic bubbles drifting up around the body — orbit decoration, independent of the badge sprite.
    ctx.fillStyle = '#c0f';
    for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI * 2) / 8 + drift;
        const px = centerX + Math.cos(angle) * (r + 6);
        const py = centerY + Math.sin(angle) * (r + 6);
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e0f';
        ctx.beginPath();
        ctx.arc(px - 1, py - 1, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c0f';
    }

    // Body — the school badge, with the toxic bubbles still drifting outside it.
    ctx.drawImage(sprite, centerX - r, centerY - r, r * 2, r * 2);
};

Game.drawItem = function(x, y, width, height, color, type) {
    const ctx = this.ctx;
    const cx = x + width / 2;
    const cy = y + height / 2;

    // Solid badge body (no checkered gaps).
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);

    ctx.fillStyle = '#fff';
    if (type === 0) {
        // Medic cross (plus) — health pickup.
        const arm = 6;
        ctx.fillRect(cx - arm, cy - 2, arm * 2, 4);
        ctx.fillRect(cx - 2, cy - arm, 4, arm * 2);
    } else if (type === 1) {
        // Dot — damage boost pickup.
        ctx.fillRect(cx - 2, cy - 2, 4, 4);
    } else if (type === 2) {
        // Ring — shield pickup.
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, width / 3, 0, Math.PI * 2);
        ctx.stroke();
    }
};

// --- Backdrop: drifting starfield + menu seal watermark ---------------------

// Three parallax layers of drifting stars, rendered on the menu and during
// gameplay alike. Positions are seeded once per viewport size; the downward
// drift and brightness twinkle are wall-clock driven, so they keep flowing
// even while the simulation is paused or on the menu.
const STAR_LAYERS = [
    { count: 70, speed: 7,  size: 1,   alpha: 0.3 },
    { count: 40, speed: 14, size: 1.5, alpha: 0.5 },
    { count: 16, speed: 26, size: 2.2, alpha: 0.85 },
];
let stars = null;

function buildStars(width, height) {
    stars = { builtFor: `${width}x${height}`, stars: [] };
    for (const layer of STAR_LAYERS) {
        for (let i = 0; i < layer.count; i++) {
            stars.stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                layer,
            });
        }
    }
}

Game.drawStarfield = function(nowMs) {
    const ctx = this.ctx;
    const t = nowMs / 1000;

    if (!stars || stars.builtFor !== `${this.width}x${this.height}`) {
        buildStars(this.width, this.height);
    }

    ctx.fillStyle = '#cfeeff';
    for (const star of stars.stars) {
        const y = (star.y + t * star.layer.speed) % this.height;
        ctx.globalAlpha = star.layer.alpha * (0.65 + 0.35 * Math.sin(t * 2 + star.x * 0.05));
        ctx.fillRect(star.x, y, star.layer.size, star.layer.size);
    }
    ctx.globalAlpha = 1;
};

// Menu-only: the school seal baked crisp, anchored in the bottom-right corner
// as a breathing watermark.
Game.drawMenuEmblem = function(nowMs) {
    const emblem = this.getMenuEmblemCanvas();
    if (!emblem) return;

    const ctx = this.ctx;
    const t = nowMs / 1000;
    const size = Math.min(this.width, this.height) * 0.24;
    const pad = 28;

    ctx.save();
    ctx.translate(this.width - size / 2 - pad, this.height - size / 2 - pad);
    ctx.globalAlpha = 0.45 + 0.1 * Math.sin(t * 0.8);
    ctx.drawImage(emblem, -size / 2, -size / 2, size, size);
    ctx.restore();
    ctx.globalAlpha = 1;
};

const coreGameOver = Game.gameOver;
if (typeof coreGameOver === 'function') {
    Game.gameOver = function() {
        coreGameOver.call(this);
        this.updatePauseBuildDetails();
        this.updateBuildHUD(true);
    };
}

const coreReturnToMainMenu = Game.returnToMainMenu;
if (typeof coreReturnToMainMenu === 'function') {
    Game.returnToMainMenu = function() {
        coreReturnToMainMenu.call(this);
        this.updatePauseBuildDetails();
        this.updateBuildHUD(true);
    };
}
