import { Game } from '../core/game.js';
import { CONFIG } from '../core/config.js';

// Chain route feedback expands from the event center to the true damage radius
// over this window, mirroring the 连环爆炸 shockwave. The route emits events
// with `until = gameTime + 400`, so render.js recovers the start from `until`.
const CHAIN_RING_MS = 400;

// Presentation state intentionally lives outside the simulation clocks. A
// hit-stop deadline only makes render() retain the previous canvas frame; the
// fixed-step update loop keeps advancing while the deadline is active.
Game.visualHitStopUntil = 0;

Game.requestVisualHitStop = function(ms = CONFIG.builds.hunter.hitStopMs) {
    const duration = Math.max(0, Number(ms) || 0);
    if (duration <= 0) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const current = Number(this.visualHitStopUntil) || 0;
    this.visualHitStopUntil = Math.max(current, now + duration);
};

Game.clearVisualHitStop = function() {
    this.visualHitStopUntil = 0;
};

Game.isVisualHitStopped = function(now) {
    const clock = now == null
        ? (typeof performance !== 'undefined' ? performance.now() : Date.now())
        : now;
    return Number(this.visualHitStopUntil) > clock;
};

// The build HUD is intentionally DOM-only. Combat timers continue to advance
// from the fixed-step simulation; this method only paints the latest snapshot
// when updateUI's existing throttle permits a DOM refresh.
Game.updateBuildHUD = function(force = false) {
    if (typeof document === 'undefined') return;

    const hud = this.buildHud || document.getElementById('buildHud');
    if (!hud) {
        this.updateCardEffectHUD(force);
        return;
    }
    this.buildHud = hud;

    if (this.isMenu || this.isGameOver) {
        hud.replaceChildren();
        hud.hidden = true;
        this.updateCardEffectHUD(force);
        return;
    }

    const states = typeof this.getBuildHudStates === 'function'
        ? this.getBuildHudStates()
        : [];
    const rows = Array.isArray(states) ? states.slice(0, 2) : [];

    hud.replaceChildren();
    hud.hidden = rows.length === 0;
    if (hud.hidden) {
        this.updateCardEffectHUD(force);
        return;
    }

    for (const state of rows) {
        if (!state) continue;
        const row = document.createElement('div');
        row.className = 'buildHudRow';
        if (state.line) row.dataset.line = state.line;
        if (state.key) row.dataset.key = state.key;
        if (state.active) row.classList.add('isActive');

        const cooldown = Boolean(state.cooldown || state.cooldownActive
            || (Number(state.cooldownMs) > 0 && state.active === false));
        if (cooldown) {
            row.classList.add('isCooldown');
            row.dataset.cooldown = 'true';
            row.setAttribute('aria-disabled', 'true');
        }

        const label = document.createElement('span');
        label.className = 'buildHudLabel';
        label.textContent = state.label || state.key || '强化';

        const value = document.createElement('span');
        value.className = 'buildHudValue';
        let valueText = state.value == null ? '' : String(state.value);
        // Rapid's active value always uses the authored six-second scale, so
        // the player can compare a warm-up that was extended by a kill.
        if (state.line === 'rapid' && state.active) {
            const remainingMs = Number(this.buildState?.timers?.rapidWarmup);
            const remaining = Number.isFinite(remainingMs)
                ? remainingMs / 1000
                : Number.parseFloat(valueText);
            if (Number.isFinite(remaining)) valueText = `${remaining.toFixed(1)}/6.0s`;
        }
        value.textContent = valueText;

        const rawTags = state.tags ?? state.tag;
        const tags = Array.isArray(rawTags) ? rawTags : rawTags ? [rawTags] : [];
        if (tags.length) {
            const tag = document.createElement('span');
            tag.className = 'buildHudTags';
            tag.textContent = tags.join('·');
            row.append(label, value, tag);
        } else {
            row.append(label, value);
        }

        hud.append(row);
    }

    this.updateCardEffectHUD(force);
};

// Card effects have their own painter and state model. In particular, the
// survival timer and bloodlust meter must never share a counter or overwrite
// one another when a run changes cards.
Game.updateCardEffectHUD = function(force = false) {
    if (typeof document === 'undefined') return;
    const hud = this.cardEffectHud || document.getElementById('cardEffectHud');
    if (!hud) return;
    this.cardEffectHud = hud;

    if (this.isMenu || this.isGameOver) {
        hud.replaceChildren();
        hud.hidden = true;
        return;
    }

    const source = typeof this.getCardEffectHudStates === 'function'
        ? this.getCardEffectHudStates()
        : (typeof this.getCardEffectHudState === 'function' ? this.getCardEffectHudState() : null);
    const states = Array.isArray(source) ? source : source ? [source] : [];
    hud.replaceChildren();
    hud.hidden = states.length === 0;
    if (hud.hidden) return;

    for (const state of states) {
        if (!state) continue;
        const row = document.createElement('div');
        row.className = 'cardEffectHudRow';
        if (state.cardId) row.dataset.card = state.cardId;
        if (state.paused || state.cooldown) row.classList.add('isPaused');

        const label = document.createElement('span');
        label.className = 'cardEffectHudLabel';
        label.textContent = state.label || state.cardId || '';
        row.append(label);

        const rawTags = state.tags ?? state.tag;
        const tags = Array.isArray(rawTags) ? rawTags : rawTags ? [rawTags] : [];
        if (tags.length) {
            const tag = document.createElement('span');
            tag.className = 'cardEffectHudTags';
            tag.textContent = tags.join('·');
            row.append(tag);
        }
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
    if (this.isMenu || this.isGameOver) this.clearVisualHitStop();
    // Do this before clearing the canvas. The previous frame therefore remains
    // visible while simulation timers, collisions and event queues continue.
    if (this.isVisualHitStopped()) return;

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

    // World layer: every entity that fog is allowed to conceal is drawn before
    // the fog overlay. Player and critical feedback are deliberately deferred
    // until after drawFogBand().
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

    }

    const itemPool = this.objectPools.items;
    for (const item of itemPool.active) {
        this.drawItemSprite(item);
    }

    if (this.boss) {
        this.drawBoss(this.boss.x, this.boss.y, this.boss.width, this.boss.height, this.boss.color);
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

    // Opaque fog of war: draw it after the world, before the player and
    // critical UI. No trajectory is inferred or painted here.
    if (this.activeCard === 'fog') {
        this.drawFogBand(this.height * CONFIG.cards.fogLineRatio);
    }

    this.drawPlayerShieldAndBarrier();
    this.drawPlayerSprite();
    this.drawFogWarningHighlights();

    // Critical feedback is intentionally above fog: hunter fracture marks,
    // effect radii, and the player's supply/route indicators remain legible.
    this.drawVisualFeedbackEvents();
    for (const enemy of enemyPool.active) {
        this.drawHunterMark(enemy.entityId, enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, Math.max(enemy.width, enemy.height) / 2 + 4);
    }
    if (this.boss) {
        this.drawHunterMark(this.boss.entityId, this.boss.x + this.boss.width / 2, this.boss.y + this.boss.height / 2, Math.max(this.boss.width, this.boss.height) / 2 + 6);
    }
};

Game.drawPlayerShieldAndBarrier = function() {
    if (!this.player) return;
    const ctx = this.ctx;
    const cx = this.player.x + this.player.width / 2;
    const cy = this.player.y + this.player.height / 2;
    if (this.player.shieldTime > 0) {
        ctx.strokeStyle = '#0af';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(this.player.width, this.player.height) / 2 + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
    if (this.buildState?.locks?.fortressBarrier) {
        ctx.strokeStyle = '#7cff8a';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(this.player.width, this.player.height) / 2 + 1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
};

// Fog is fully opaque through 35% of the canvas, then fades out over exactly
// the configured 40px. The overlay is a single fill and never draws a path.
Game.drawFogBand = function(fogLine = this.height * CONFIG.cards.fogLineRatio) {
    const ctx = this.ctx;
    const fade = Math.max(0, Number(CONFIG.cards.fogFadePx) || 0);
    const line = Math.max(0, Math.min(this.height, Number(fogLine) || 0));
    const bottom = Math.min(this.height, line + fade);

    const gradient = ctx.createLinearGradient(0, 0, 0, bottom);
    gradient.addColorStop(0, 'rgba(10, 17, 30, 1)');
    gradient.addColorStop(bottom > 0 ? line / bottom : 1, 'rgba(10, 17, 30, 1)');
    if (bottom > line) gradient.addColorStop(1, 'rgba(10, 17, 30, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, bottom);
};

Game.drawFogWarningHighlights = function() {
    if (this.activeCard !== 'fog') return;
    const pool = this.objectPools?.enemyBullets;
    if (!pool || !Array.isArray(pool.active)) return;
    const now = Number(this.gameTime) || 0;
    const line = this.height * CONFIG.cards.fogLineRatio;
    const ctx = this.ctx;
    for (const bullet of pool.active) {
        if (!bullet || !bullet.fogWarningShown || Number(bullet.fogWarningUntil) <= now) continue;
        const x = bullet.x + (bullet.width || 0) / 2;
        ctx.strokeStyle = 'rgba(255, 240, 128, 0.95)';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        // A small boundary marker is all the player sees; no line connects it
        // to the projectile, so the warning cannot reveal a trajectory.
        ctx.arc(x, line, Math.max(4, (bullet.width || 0) * 0.9), 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
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

    const feedback = this.getVisualFeedbackEvents()
        .find((event) => String(event.kind || event.type || '').replace(/-(?:clear|ring|fracture|magnet)$/, '') === 'hunter'
            && event.targetId === targetId
            && this.isFeedbackEventActive(event));
    if (feedback) this.drawHunterFracture(cx, cy, radius, feedback.damageLabel || feedback.label || '2D');
};

Game.drawHunterFracture = function(cx, cy, radius, label = '2D') {
    const ctx = this.ctx;
    const r = Math.max(8, Number(radius) || 8);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.55, cy - r * 0.2);
    ctx.lineTo(cx - r * 0.1, cy + r * 0.05);
    ctx.lineTo(cx - r * 0.35, cy + r * 0.55);
    ctx.moveTo(cx + r * 0.55, cy + r * 0.2);
    ctx.lineTo(cx + r * 0.1, cy - r * 0.05);
    ctx.lineTo(cx + r * 0.35, cy - r * 0.55);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(label), cx, cy - r - 8);
};

Game.drawDesperateImpact = function(cx, cy, label = '2D') {
    const ctx = this.ctx;
    const r = 15;
    ctx.strokeStyle = 'rgba(255, 80, 110, 0.95)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r);
    ctx.lineTo(cx - r * 0.25, cy - r * 0.25);
    ctx.moveTo(cx + r, cy - r);
    ctx.lineTo(cx + r * 0.25, cy - r * 0.25);
    ctx.moveTo(cx - r, cy + r);
    ctx.lineTo(cx - r * 0.25, cy + r * 0.25);
    ctx.moveTo(cx + r, cy + r);
    ctx.lineTo(cx + r * 0.25, cy + r * 0.25);
    ctx.stroke();
    ctx.fillStyle = '#ff506e';
    ctx.font = 'bold 11px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(label), cx, cy - r - 8);
};

Game.drawRadiusRing = function(x, y, radius, color = 'rgba(255, 209, 102, 0.8)', lineWidth = 2) {
    const r = Number(radius);
    if (!Number.isFinite(r) || r <= 0) return;
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
};

Game.drawSupplyAttraction = function(item) {
    if (!item || !this.player) return;
    const cfg = CONFIG.builds.supply;
    const playerX = this.player.x + this.player.width / 2;
    const playerY = this.player.y + this.player.height / 2;
    const itemX = item.x + item.width / 2;
    const itemY = item.y + item.height / 2;
    const distance = Math.hypot(playerX - itemX, playerY - itemY);
    const active = item.attractionActive || item.supplyMagnetActive
        || (typeof this.hasBuild === 'function' && this.hasBuild('supply_magnet') && distance <= cfg.magnetRadius);
    if (!active) return;
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(255, 210, 88, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash?.([4, 4]);
    ctx.beginPath();
    ctx.moveTo(itemX, itemY);
    ctx.lineTo(playerX, playerY);
    ctx.stroke();
    ctx.setLineDash?.([]);
};

Game.getVisualFeedbackEvents = function() {
    const stateEvents = this.buildState?.visualFeedbackEvents || this.buildState?.feedbackEvents;
    const candidates = [this.visualFeedbackEvents, this.visualFeedbackQueue, this.feedbackEvents, stateEvents];
    const source = candidates.find((candidate) => Array.isArray(candidate) && candidate.length > 0)
        || candidates.find((candidate) => Array.isArray(candidate));
    if (!Array.isArray(source)) return [];
    // Route code owns event creation; the painter drops expired presentation
    // records so the queue cannot grow across a long run.
    const active = source.filter((event) => this.isFeedbackEventActive(event));
    if (active.length !== source.length && source === stateEvents) {
        source.splice(0, source.length, ...active);
    }
    return active;
};

Game.isFeedbackEventActive = function(event) {
    if (!event) return false;
    const now = Number(this.gameTime) || 0;
    if (event.until != null && Number(event.until) <= now) return false;
    if (event.expiresAt != null && Number(event.expiresAt) <= now) return false;
    return true;
};

// Shared read-only feedback painter. Combat code owns the events and their
// effects; this method only draws them, so an exhausted particle pool cannot
// suppress damage, kills, or route progress.
Game.drawEffectFeedback = function(event) {
    if (!event || !this.isFeedbackEventActive(event)) return;
    const rawKind = event.kind || event.type || event.route;
    const kind = String(rawKind || '').replace(/-(?:clear|ring|fracture|magnet)$/, '');
    const x = Number(event.x) || 0;
    const y = Number(event.y) || 0;
    const cfg = CONFIG.builds;

    if (kind === 'fortress') {
        const isEcho = Boolean(event.echo || event.variant === 'echo');
        const isClear = Boolean(event.clear || event.variant === 'clear');
        if (isEcho) this.drawRadiusRing(x, y, event.radius ?? cfg.fortress.echoRadius, '#ffad66');
        if (isClear) this.drawRadiusRing(x, y, event.secondaryRadius ?? event.radius ?? cfg.fortress.clearRadius, '#72c8ff');
        if (!isEcho && !isClear && event.radius != null) this.drawRadiusRing(x, y, event.radius, '#ffad66');
        if (!isEcho && !isClear && event.secondaryRadius != null) this.drawRadiusRing(x, y, event.secondaryRadius, '#72c8ff');
        return;
    }
    if (kind === 'desperate') {
        if (event.impact) this.drawDesperateImpact(x, y, event.damageLabel || event.label || '2D');
        if (event.clear) this.drawRadiusRing(x, y, event.radius ?? cfg.desperate.clearRadius, '#ff506e');
        // Compatibility for older callers that only supplied a desperate
        // route event: those events represented the clear-ring feedback.
        if (!event.impact && !event.clear) this.drawRadiusRing(x, y, cfg.desperate.clearRadius, '#ff506e');
        return;
    }
    if (kind === 'chain') {
        let radius = Number(event.radius);
        if (!Number.isFinite(radius)) {
            if (event.capstone || event.stage === 'capstone') radius = cfg.chain.capstoneRadius;
            else if (event.wide || event.stage === 'wide') radius = cfg.chain.wideRadius;
            else if (Number(event.generation) > 0) radius = cfg.chain.spreadRadius;
            else radius = cfg.chain.baseRadius;
        }
        // Dynamic ring: expands from nothing to the true damage radius while
        // its alpha collapses to zero. Missing timing metadata (no `gameTime`,
        // no finite `until`) degrades to a finished ring instead of throwing.
        const startedAt = Number(event.startedAt) || (Number(event.until) - CHAIN_RING_MS);
        const elapsed = Number(this.gameTime) - startedAt;
        const progress = Number.isFinite(elapsed)
            ? Math.min(1, Math.max(0, elapsed / CHAIN_RING_MS))
            : 1;
        const ctx = this.ctx;
        ctx.strokeStyle = Number(event.generation) > 0 ? '#ffb3a1' : '#ff7a45';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 1 - progress;
        ctx.beginPath();
        ctx.arc(x, y, radius * progress, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        return;
    }
    if (kind === 'hunter') {
        if (event.clear || (!event.impact && !event.damageLabel && !event.label)) {
            this.drawRadiusRing(x, y, event.radius ?? cfg.hunter.clearRadius, '#8ef');
        }
        if (event.impact || event.damageLabel || event.label) {
            this.drawHunterFracture(x, y, 20, event.damageLabel || event.label || '2D');
        }
        return;
    }
    if (kind === 'supply') {
        const item = event.item || {
            x: x - 1,
            y: y - 1,
            width: 2,
            height: 2,
            attractionActive: true,
        };
        this.drawSupplyAttraction(item);
    }
};

Game.drawVisualFeedbackEvents = function() {
    for (const event of this.getVisualFeedbackEvents()) this.drawEffectFeedback(event);
};

// Alias used by route implementations that emit a semantic build feedback
// event rather than a card/effect event.
Game.drawBuildFeedback = Game.drawEffectFeedback;

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
        this.clearVisualHitStop();
        coreGameOver.call(this);
        this.updatePauseBuildDetails();
        this.updateBuildHUD(true);
    };
}

const coreReturnToMainMenu = Game.returnToMainMenu;
if (typeof coreReturnToMainMenu === 'function') {
    Game.returnToMainMenu = function() {
        this.clearVisualHitStop();
        coreReturnToMainMenu.call(this);
        this.updatePauseBuildDetails();
        this.updateBuildHUD(true);
    };
}

const coreResizeCanvas = Game.resizeCanvas;
if (typeof coreResizeCanvas === 'function') {
    Game.resizeCanvas = function() {
        this.clearVisualHitStop();
        return coreResizeCanvas.call(this);
    };
}

const coreStartGame = Game.startGame;
if (typeof coreStartGame === 'function') {
    Game.startGame = function() {
        this.clearVisualHitStop();
        return coreStartGame.call(this);
    };
}
