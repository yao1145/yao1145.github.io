import { Game } from '../core/game.js';
import { CONFIG } from '../core/config.js';

function entityCenter(entity) {
    return {
        x: Number(entity?.x) + Number(entity?.width || 0) / 2,
        y: Number(entity?.y) + Number(entity?.height || 0) / 2,
    };
}

function numericBonus(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
}

function ensureHitEntityIds(bullet) {
    if (!bullet) return [];
    if (!Array.isArray(bullet.hitEntityIds)) bullet.hitEntityIds = [];
    return bullet.hitEntityIds;
}

Game.updateParticles = function() {
    const pool = this.objectPools.particles;
    for (let i = pool.active.length - 1; i >= 0; i--) {
        const particle = pool.active[i];

        // Ring particles (isRing) don't move via vx/vy; they expand their radius each frame until capped.
        if (particle.isRing) {
            particle.radius = Math.min(particle.radius + particle.ringGrowth, particle.ringMax);
        } else {
            particle.x += particle.vx;
            particle.y += particle.vy;
        }
        particle.life--;

        if (particle.life <= 0) {
            this.releaseObject('particles', particle);
        }
    }
};

Game.checkCollisions = function() {
    this.spatialGrid.clear();

    const bulletPool = this.objectPools.bullets;
    for (const bullet of bulletPool.active) {
        this.spatialGrid.insert(bullet, 'bullets');
    }

    const enemyPool = this.objectPools.enemies;
    for (const enemy of enemyPool.active) {
        this.spatialGrid.insert(enemy, 'enemies');
    }

    const enemyBulletPool = this.objectPools.enemyBullets;
    for (const bullet of enemyBulletPool.active) {
        this.spatialGrid.insert(bullet, 'enemyBullets');
    }

    const itemPool = this.objectPools.items;
    for (const item of itemPool.active) {
        this.spatialGrid.insert(item, 'items');
    }

    for (let i = bulletPool.active.length - 1; i >= 0; i--) {
        const bullet = bulletPool.active[i];

        // The boss is handled first and ends the bullet pass on a hit, keeping
        // the historical once-per-frame boss damage unchanged.
        if (this.isBossStage && this.boss && this.isColliding(bullet, this.boss)) {
            const event = this.damageTarget({ bullet, target: this.boss, targetType: 'boss' });
            if (event) {
                this.createExplosion(event.x, event.y, '#fff', 2);
            }
            // Boss overlaps are terminal even when damageTarget rejects a
            // repeated identity hit; piercing is for ordinary enemies only.
            this.releaseObject('bullets', bullet);
            break;
        }

        const nearbyEnemies = this.spatialGrid.getNearby(bullet, 'enemies');
        for (const nearby of nearbyEnemies) {
            // Keep the guard for compatibility with older/custom grid
            // adapters that may ignore the optional type argument.
            if (nearby.poolType !== 'enemies') continue;
            const enemy = nearby.obj;

            if (this.isColliding(bullet, enemy)) {
                // An enemy killed earlier this frame is still in the spatial grid;
                // skip it so a second bullet (e.g. from triple-shot) can't score it again.
                if (enemy.health <= 0) continue;

                // A landed hit flashes the enemy white; the restore timeout never
                // re-colors a corpse or a pooled object reused for another enemy.
                enemy.color = '#fff';
                this.scheduleRunTask(() => {
                    if (enemy && !enemy._dead && enemy.color === '#fff') {
                        enemy.color = CONFIG.enemyTypes[enemy.type].color;
                    }
                }, 50);

                const event = this.damageTarget({ bullet, target: enemy, targetType: 'enemy' });
                if (!event) {
                    // Nothing landed (piercing bullet re-overlapping an already-hit
                    // enemy): undo the false flash and let the bullet fly on.
                    enemy.color = CONFIG.enemyTypes[enemy.type].color;
                    break;
                }
                if (!event.killed) {
                    this.createExplosion(event.x, event.y, '#fff', 2);
                }
                if (!event.pierced) this.releaseObject('bullets', bullet);
                break;
            }
        }
    }
    // Every landed bullet hit of this pass is now queued: deliver one batch
    // per shot to the build hooks.
    this.flushDirectShotBatches();

    const nearbyEnemyBullets = this.spatialGrid.getNearby(this.player, 'enemyBullets');
    for (const nearby of nearbyEnemyBullets) {
        if (nearby.poolType !== 'enemyBullets') continue;
        const bullet = nearby.obj;

        if (this.isColliding(bullet, this.player)) {
            this.resolveEnemyBulletHit(bullet);
            break;
        }
    }

    const nearbyEnemies = this.spatialGrid.getNearby(this.player, 'enemies');
    for (const nearby of nearbyEnemies) {
        if (nearby.poolType !== 'enemies') continue;
        const enemy = nearby.obj;

        if (this.isColliding(this.player, enemy)) {
            this.releaseObject('enemies', enemy);
            this.applyPlayerHit(1, 'enemyCollision');
            break;
        }
    }

    if (this.boss && this.isColliding(this.player, this.boss)) {
        this.applyPlayerHit(1, 'bossCollision');
    }

    const nearbyItems = this.spatialGrid.getNearby(this.player, 'items');
    for (const nearby of nearbyItems) {
        if (nearby.poolType !== 'items') continue;
        const item = nearby.obj;

        if (this.isColliding(this.player, item)) {
            this.collectItem(item);
            break;
        }
    }
};

Game.isColliding = function(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj1.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj1.height > obj2.y;
};

// The direct-shot damage contract lives here with the collision fact source.
// cards.js still owns getDamageFor(), but this method is the only place where
// one-shot rapid/supply contributions are combined and consumed.  A legacy
// buildDamageBonus is accepted only for already-spawned v2 bullets; newly
// spawned bullets use the explicit v2.1 fields below.
function calculateDirectShotDamage(game, targetType, bullet) {
    const baseDamage = game.getDamageFor(targetType);
    const rapidBonusDamage = numericBonus(bullet?.rapidDamageBonus);
    const supplyBonusDamage = numericBonus(bullet?.supplyDamageBonus)
        || numericBonus(bullet?.buildDamageBonus);

    if (bullet) {
        bullet.rapidDamageBonus = 0;
        bullet.supplyDamageBonus = 0;
        // Do not let a pooled legacy field leak into a later target either.
        bullet.buildDamageBonus = 0;
    }

    return game.roundCombatDamage(baseDamage + rapidBonusDamage + supplyBonusDamage);
}

Game.getDirectShotDamage = function(targetType, bullet) {
    return calculateDirectShotDamage(this, targetType, bullet);
};
Game.getDirectShotDamage.v21 = true;

function updateDirectDamageMetrics(game, event) {
    if (!game.buildState) return;
    const metrics = game.buildState.metrics || (game.buildState.metrics = {});
    const add = (key, value) => {
        metrics[key] = (Number(metrics[key]) || 0) + value;
    };

    // These are successful direct-hit contributions only.  Recording them
    // after applyCombatDamage prevents rejected/repeated collisions from
    // inflating the end-of-run attribution.
    add('directDamage', event.amount);
    add('rapidBonusDamage', event.rapidBonusDamage);
    add('supplyBonusDamage', event.supplyBonusDamage);
    // Keep the end-of-run names used by the v2 settlement model alongside
    // the event-shaped names above; both represent the same successful hit.
    add('rapidPrimaryBonusDamage', event.rapidBonusDamage);
    // The supply pulse bonus now lands on every bullet of a batch, so its
    // settlement metric is no longer primary-scoped.
    add('supplyPulseBonusDamage', event.supplyBonusDamage);
    if (event.rapidPierceHit) {
        add('rapidPierceHits', 1);
    }
}

// Shared combat-damage application for every non-direct source too (bonus
// strikes, retaliation, explosions): identity-validates the target, applies
// the quantized amount, and settles a first-lethal death exactly once.
// Never queues direct-hit events and never feeds per-shot progress.
// extra context (e.g. the killing shotId) is forwarded to the kill broadcast.
// Returns true when the damage was dealt.
Game.applyCombatDamage = function(target, targetType, amount, source, extra = {}) {
    if (!target || target._dead || target.health <= 0) return false;
    if (targetType === 'enemy' && !this.isActiveEntity('enemies', target.entityId)) return false;
    if (targetType === 'boss' && (!this.boss || this.boss.entityId !== target.entityId)) return false;

    amount = this.roundCombatDamage(amount);
    if (amount <= 0) return false;

    target.health -= amount;
    if (target.health <= 0) {
        if (targetType === 'boss') {
            this.createExplosion(target.x + target.width / 2, target.y + target.height / 2, '#f00', 8);
            this.handleBossDeath();
        } else {
            this.killEnemy(target, { source, damage: amount, ...extra });
        }
    }
    return true;
};

// Resolves a still-live target by identity (pooled entities are only the
// enemy they are while active; the boss only while it is this.boss).
Game.resolveLiveTarget = function(targetType, entityId) {
    if (targetType === 'boss') {
        return this.boss && this.boss.entityId === entityId ? this.boss : null;
    }
    return this.objectPools.enemies.active.find((e) => e.entityId === entityId) || null;
};

// Unified direct-shot hit. Validates the target identity before touching its
// health, applies exactly one damage via applyCombatDamage (which settles a
// first-lethal death exactly once), and queues the hit for the per-shot
// batch hooks. A piercing bullet never re-damages an entity it already hit.
// Returns the direct-hit event, or null when nothing landed.
Game.damageTarget = function({ bullet, target, targetType }) {
    if (!target || target._dead || target.health <= 0) return null;
    if (targetType === 'enemy' && !this.isActiveEntity('enemies', target.entityId)) return null;
    if (targetType === 'boss' && (!this.boss || this.boss.entityId !== target.entityId)) return null;
    const hitEntityIds = ensureHitEntityIds(bullet);
    if (hitEntityIds.includes(target.entityId)) return null;

    // Capture the one-shot fields before getDirectShotDamage consumes them.
    // A rapid primary is the only bullet eligible for a rapid pierce metric;
    // rapidBatchBoosted is deliberately insufficient because it marks every
    // bullet in the batch for presentation only.
    const rapidBonusDamage = numericBonus(bullet?.rapidDamageBonus);
    const supplyBonusDamage = numericBonus(bullet?.supplyDamageBonus)
        || numericBonus(bullet?.buildDamageBonus);
    const rapidPrimary = Boolean(bullet && bullet.isPrimary && (
        rapidBonusDamage > 0
        || bullet._rapidPrimary === true
        || (bullet.rapidBatchBoosted && Number(bullet.pierceRemaining) > 0)
    ));
    const rapidPierceHit = rapidPrimary && hitEntityIds.length > 0;

    let damage;
    if (this.getDirectShotDamage?.v21) {
        damage = this.getDirectShotDamage(targetType, bullet);
    } else {
        // main.js evaluates cards.js after this side-effect module.  Until a
        // later module layer replaces that legacy helper, bridge the explicit
        // fields through its old buildDamageBonus input, then consume the new
        // fields ourselves.  This keeps browser startup and isolated tests on
        // the same single-quantization contract without touching cards.js.
        const legacyBonus = numericBonus(bullet?.buildDamageBonus);
        if (bullet && (rapidBonusDamage > 0 || supplyBonusDamage > 0)) {
            bullet.buildDamageBonus = legacyBonus + rapidBonusDamage + supplyBonusDamage;
        }
        damage = this.getDirectShotDamage(targetType, bullet);
        if (bullet) {
            bullet.rapidDamageBonus = 0;
            bullet.supplyDamageBonus = 0;
            bullet.buildDamageBonus = 0;
        }
    }
    if (damage <= 0) return null;

    // A pierce charge survives this hit and lets the bullet fly on to one more
    // target; the primary hit itself does not consume the charge.
    const canPierce = Boolean(bullet && bullet.pierceRemaining > 0);

    const dealt = this.applyCombatDamage(target, targetType, damage, 'direct', { shotId: bullet && bullet.shotId });
    if (!dealt) return null;

    if (bullet) {
        hitEntityIds.push(target.entityId);
        if (rapidPrimary) bullet._rapidPrimary = true;
        if (canPierce) bullet.pierceRemaining -= 1;
    }

    const event = {
        source: 'direct',
        shotId: bullet ? bullet.shotId : 0,
        isPrimary: Boolean(bullet && bullet.isPrimary),
        targetType,
        entityId: target.entityId,
        // amount is the damage actually applied; baseDamage is the same single
        // computation, so bonus strikes never re-enter the multiplier hooks.
        amount: damage,
        baseDamage: damage,
        x: target.x + target.width / 2,
        y: target.y + target.height / 2,
        pierced: canPierce,
        killed: target.health <= 0,
        rapidBonusDamage,
        supplyBonusDamage,
        rapidPierceHit,
    };
    updateDirectDamageMetrics(this, event);
    this.queueDirectHit(event);
    return event;
};

// Direct hits land during the collision pass; they are queued here and
// grouped by shot id when the pass ends.
Game.queueDirectHit = function(event) {
    if (!Array.isArray(this.directHitQueue)) this.directHitQueue = [];
    this.directHitQueue.push(event);
};

// End of the direct-shot pass: deliver one batch per shot id. A scatter burst
// counts as a single batch for per-shot progress even when several bullets
// land, and the drained queue means each tick's hits dispatch exactly once.
Game.flushDirectShotBatches = function() {
    const queue = this.directHitQueue || [];
    this.directHitQueue = [];
    if (queue.length === 0) return;

    const batches = new Map();
    for (const event of queue) {
        let batch = batches.get(event.shotId);
        if (!batch) {
            batch = { shotId: event.shotId, events: [] };
            batches.set(event.shotId, batch);
        }
        batch.events.push(event);
    }
    for (const batch of batches.values()) this.onDirectShotBatch(batch);
};

Game.createExplosion = function(x, y, color, count = 4) {
    for (let i = 0; i < count; i++) {
        const particle = this.getObject('particles');
        if (particle) {
            particle.x = x;
            particle.y = y;
            particle.vx = (Math.random() - 0.5) * 4;
            particle.vy = (Math.random() - 0.5) * 4;
            particle.life = 10;
            particle.color = color;
        }
    }
};

// Cheap shockwave: one ring particle that expands outward and fades, reusing
// the particle pool and the existing per-frame update/render paths.
Game.createShockwave = function(x, y, color = '#ffd166') {
    const particle = this.getObject('particles');
    if (!particle) return;
    particle.x = x;
    particle.y = y;
    particle.vx = 0;
    particle.vy = 0;
    particle.life = 14;               // life in frames
    particle.color = color;
    particle.isRing = true;
    particle.radius = 4;
    particle.ringGrowth = 9;          // px growth per frame
    particle.ringMax = 130;           // growth cap (avoids huge-circle cost)
};

// Enemy-bullet priority is temporal shield -> fortress barrier -> actual
// damage. The bullet is consumed by every resolved collision, including a
// shielded one; only actual damage opens the shared damage-event path.
Game.resolveEnemyBulletHit = function(bullet) {
    if (bullet) this.releaseObject('enemyBullets', bullet);

    if (this.player.shieldTime > 0) return 'shield';

    if (this.buildState
        && this.hasBuild('fortress_entry')
        && this.buildState.locks.fortressBarrier) {
        this.buildState.locks.fortressBarrier = false;
        this.buildState.timers.fortressBarrier = 0;
        this.onFortressBarrierConsumed();
        return 'barrier';
    }

    const damage = this.activeCard === 'boost' ? CONFIG.cards.boostHitLoss : 1;
    this.applyPlayerHit(damage, 'enemyBullet');
    return 'damage';
};

// Shared player-hit handling: lose life, center explosion, red flash, shield
// reset, unified actual-damage hook, and death check. Does not release the hit
// source. Returning false means no life was actually lost.
Game.applyPlayerHit = function(damage = 1, source = 'unknown') {
    const livesBefore = this.lives;
    this.lives -= damage;
    const actualDamage = livesBefore - this.lives;
    if (actualDamage <= 0) return false;

    this.createExplosion(this.player.x + this.player.width/2, this.player.y + this.player.height/2, '#fff', 4);

    this.player.color = '#f00';
    this.scheduleRunTask(() => {
        if (this.player) this.player.color = '#0f0';
    }, 100);

    this.player.shieldTime = 5;
    this.updateShieldUI();

    // Latch lethality before any retaliation can grant lives.
    const lethal = this.lives <= 0;

    this.onActualPlayerDamage({ damage: actualDamage, source, lethal });

    // Death latches before thorns resolve: a thorns boss-kill cannot revive the player.
    if (lethal || this.lives <= 0) {
        this.gameOver();
    }
    return true;
};

// Unified enemy death (release + score + explosion); settles at most once per
// enemy per frame and returns true when it settled the death. context.source
// is one of 'direct' | 'explosion' | 'retaliation' | 'bonus' and is forwarded
// with the identity snapshot to onEnemyKilled — the unique kill broadcast.
Game.killEnemy = function(enemy, context = {}) {
    // Only settles when health <= 0; _dead guards against double scoring/release within a frame.
    if (!enemy || enemy._dead || enemy.health > 0) return false;

    enemy._dead = true;
    // Copy identity/position/type before the pool release: a re-acquired
    // pooled object is a different entity and must never be reported as this kill.
    const killEvent = {
        source: context.source || 'direct',
        shotId: context.shotId || 0,
        entityId: enemy.entityId,
        type: enemy.type,
        x: enemy.x + enemy.width / 2,
        y: enemy.y + enemy.height / 2,
        // Killing-blow damage: chain seeds and execute progress read it.
        damage: context.damage || 0,
        // A chain-explosion death carries its chain id so tests and metrics
        // can tell one cascade from another.
        chainId: context.chainId || 0,
    };
    const killColor = enemy.color;

    this.releaseObject('enemies', enemy);

    let score = 0;
    switch (killEvent.type) {
        case 0: score = 10; break;
        case 1: score = 15; break;
        case 2: score = 25; break;
        case 3: score = 20; break;
        case 4: score = 30; break;
    }
    this.score += score;

    // Bloodlust consumes the unique death fact.  The _dead latch above is
    // intentional: recursive chain/retaliation calls can never count this
    // entity a second time, and failed exchanges remain in the card meter.
    if (this.activeCard === 'bloodlust' && typeof this.addBloodlustProgress === 'function') {
        this.addBloodlustProgress(1);
    }

    this.createExplosion(killEvent.x, killEvent.y, killColor, 4);

    // Unique kill broadcast: build hooks (direct-kill extensions, chain seeds,
    // execute progress) read this event; it fires once per death.
    if (typeof this.onEnemyKilled === 'function') this.onEnemyKilled(killEvent);
    return true;
};

// Thorns: on every hit taken, instantly kill and score every enemy within
// thornsRadius of the player (one shockwave each), then damage the boss.
Game.onThornsHit = function() {
    const playerCX = this.player.x + this.player.width/2;
    const playerCY = this.player.y + this.player.height/2;
    const radius = CONFIG.cards.thornsRadius;
    const r2 = radius * radius;

    // Iterate a snapshot so releases from applyCombatDamage can't mutate the
    // array mid-loop.
    const enemies = this.objectPools.enemies.active.slice();
    for (const enemy of enemies) {
        if (!enemy || enemy._dead || enemy.health <= 0) continue;
        const cx = enemy.x + enemy.width/2;
        const cy = enemy.y + enemy.height/2;
        const dx = cx - playerCX;
        const dy = cy - playerCY;
        if (dx * dx + dy * dy > r2) continue;

        // Thorns is an instant kill: route the current health through the
        // unified retaliation path (it never counts as a direct-shot kill).
        this.applyCombatDamage(enemy, 'enemy', enemy.health, 'retaliation');
        // One shockwave per killed enemy (like the chain card).
        this.createShockwave(cx, cy);
    }
    // Plus a large shockwave at the player marking the counter radius.
    this.createShockwave(playerCX, playerCY);

    // Thorns also chips the boss by a fraction of its max health.
    if (this.boss && this.boss.health > 0) {
        const amount = this.boss.maxHealth * CONFIG.cards.thornsBossFrac;
        this.applyCombatDamage(this.boss, 'boss', amount, 'retaliation');
    }
};

// Unified boss death. Null out this.boss first to prevent re-entry, then hand out rewards.
Game.handleBossDeath = function() {
    if (!this.boss) return;
    this.boss = null;

    // Nulling the Boss identity first makes this reward and bloodlust update
    // a unique death fact even if another collision re-enters this method.
    if (this.activeCard === 'bloodlust' && typeof this.addBloodlustProgress === 'function') {
        this.addBloodlustProgress(CONFIG.cards.bloodlustBossProgress);
    }

    this.crowns++;
    // Boss reward: +3 lives (capped by maxLives, which glass locks to 1).
    this.applyLifeGain(3);

    this.isBossStage = false;
    this.bossHealthBar.style.display = 'none';
    // Boss can die mid-summon-window: hide the summon indicator and warning banner.
    this.summonIndicator.style.display = 'none';
    this.bossWarning.style.display = 'none';
    // Next boss needs a bigger gap than the last one (+200 per kill):
    // thresholds 1000 → 2200 → 3600 …
    this.bossSpawnGap += CONFIG.bossSpawnThresholdIncrement;
    this.bossSpawnThreshold += this.bossSpawnGap;
    this.objectPools.enemyBullets.active = [];
    this.updateUI(true);
    // Boss defeated: start a new build cycle, reset the per-cycle desperate
    // heal lock, then pause and run the two-stage reward flow (core card ->
    // build -> summary; keeping the current card is free, switching costs 1 life).
    if (!this.buildState) this.resetBuildState();
    this.buildState.cycle += 1;
    this.buildState.locks.desperateCycleHeal = false;
    this.beginRewardFlow(false);
};

// Removes ordinary enemy bullets whose center lies within radius of (x, y).
// Shared by 安全窗口 (fortress) and 连锁震荡 (chain): never touches enemies,
// the boss, or un-clearable mechanic objects.
Game.clearEnemyBulletsInRadius = function(x, y, radius) {
    const r2 = radius * radius;
    const pool = this.objectPools.enemyBullets;
    let cleared = 0;
    for (let i = pool.active.length - 1; i >= 0; i--) {
        const bullet = pool.active[i];
        // Mechanic bullets can opt out; ordinary pooled enemy bullets remain
        // clearable.  Releasing is deliberately the only side effect: no hit,
        // kill, drop, route or bloodlust event is emitted by a clear.
        if (!bullet
            || bullet.canBeCleared === false
            || bullet.clearable === false
            || bullet.isClearable === false
            || bullet.isUnclearable === true
            || bullet.isMechanic === true) continue;
        const center = entityCenter(bullet);
        const dx = center.x - x;
        const dy = center.y - y;
        if (dx * dx + dy * dy <= r2) {
            this.releaseObject('enemyBullets', bullet);
            cleared++;
        }
    }
    return cleared;
};
