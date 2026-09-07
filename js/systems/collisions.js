import { Game } from '../core/game.js';
import { CONFIG } from '../core/config.js';

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
                if (!event.pierced) this.releaseObject('bullets', bullet);
            }
            break;
        }

        const nearbyEnemies = this.spatialGrid.getNearby(bullet);
        for (const nearby of nearbyEnemies) {
            if (nearby.poolType !== 'enemies') continue;
            const enemy = nearby.obj;

            if (this.isColliding(bullet, enemy)) {
                // An enemy killed earlier this frame is still in the spatial grid;
                // skip it so a second bullet (e.g. from triple-shot) can't score it again.
                if (enemy.health <= 0) continue;

                // A landed hit flashes the enemy white; the restore timeout never
                // re-colors a corpse or a pooled object reused for another enemy.
                enemy.color = '#fff';
                setTimeout(() => {
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

    if (this.player.shieldTime <= 0) {
        const nearbyEnemyBullets = this.spatialGrid.getNearby(this.player);
        for (const nearby of nearbyEnemyBullets) {
            if (nearby.poolType === 'enemyBullets') {
                const bullet = nearby.obj;

                if (this.isColliding(bullet, this.player)) {
                    this.releaseObject('enemyBullets', bullet);
                    this.applyPlayerHit(this.activeCard === 'boost' ? CONFIG.cards.boostHitLoss : 1);
                    break;
                }
            }
        }
    }

    const nearbyEnemies = this.spatialGrid.getNearby(this.player);
    for (const nearby of nearbyEnemies) {
        if (nearby.poolType === 'enemies') {
            const enemy = nearby.obj;

            if (this.isColliding(this.player, enemy)) {
                this.releaseObject('enemies', enemy);
                this.applyPlayerHit();
                break;
            }
        }
    }

    if (this.boss && this.isColliding(this.player, this.boss)) {
        this.applyPlayerHit();
    }

    const nearbyItems = this.spatialGrid.getNearby(this.player);
    for (const nearby of nearbyItems) {
        if (nearby.poolType === 'items') {
            const item = nearby.obj;

            if (this.isColliding(this.player, item)) {
                this.createExplosion(item.x + item.width/2, item.y + item.height/2, item.color, 4);

                switch (item.type) {
                    case 0:
                        // Heart is still consumed even when the active card forbids healing (wasted).
                        if (this.canHeal()) this.applyLifeGain(this.activeCard === 'boost' ? CONFIG.cards.boostHeartHeal : 1);
                        else this.updateUI(true);
                        break;
                    case 1:
                        this.isDamageBoost = true;
                        this.damageBoostTime = this.activeCard === 'boost' ? CONFIG.cards.boostDamageTime : 10;
                        this.bulletDamage = 2;
                        this.updateAttackUI(true);
                        break;
                    case 2:
                        this.player.shieldTime = this.activeCard === 'boost' ? CONFIG.cards.boostShieldTime : 5;
                        this.updateShieldUI(true);
                        break;
                }

                this.releaseObject('items', item);
                break;
            }
        }
    }
};

Game.isColliding = function(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj1.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj1.height > obj2.y;
};

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
    if (bullet && bullet.hitEntityIds && bullet.hitEntityIds.includes(target.entityId)) return null;

    const damage = this.getDirectShotDamage(targetType, bullet);
    if (damage <= 0) return null;

    // A pierce charge survives this hit and lets the bullet fly on to one more
    // target; the primary hit itself does not consume the charge.
    const canPierce = Boolean(bullet && bullet.pierceRemaining > 0);
    if (bullet) {
        bullet.hitEntityIds.push(target.entityId);
        if (canPierce) bullet.pierceRemaining -= 1;
    }

    const dealt = this.applyCombatDamage(target, targetType, damage, 'direct', { shotId: bullet && bullet.shotId });
    if (!dealt) return null;

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
    };
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

// Shared player-hit handling: lose life, center explosion, red flash, shield
// reset, thorns counter, death check. Does not release the hit source.
Game.applyPlayerHit = function(damage = 1) {
    this.lives -= damage;
    this.createExplosion(this.player.x + this.player.width/2, this.player.y + this.player.height/2, '#fff', 4);

    this.player.color = '#f00';
    setTimeout(() => {
        if (this.player) this.player.color = '#0f0';
    }, 100);

    this.player.shieldTime = 5;
    this.updateShieldUI();

    // Latch lethality before thorns can grant lives.
    const lethal = this.lives <= 0;

    // Thorns: counter-attack on every hit taken.
    if (this.activeCard === 'thorns') this.onThornsHit();

    // Death latches before thorns resolve: a thorns boss-kill cannot revive the player.
    if (lethal || this.lives <= 0) {
        this.gameOver();
    }
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

    // Bloodlust: chance to regain 1 life per enemy kill (boss chance in handleBossDeath).
    if (this.activeCard === 'bloodlust' && this.canHeal() && Math.random() < this.getLifeStealChance()) {
        this.applyLifeGain(1);
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

    // Iterate a snapshot so killEnemy's releases can't mutate the array mid-loop.
    const enemies = this.objectPools.enemies.active.slice();
    for (const enemy of enemies) {
        if (!enemy || enemy._dead || enemy.health <= 0) continue;
        const cx = enemy.x + enemy.width/2;
        const cy = enemy.y + enemy.height/2;
        const dx = cx - playerCX;
        const dy = cy - playerCY;
        if (dx * dx + dy * dy > r2) continue;

        // Thorns is an instant kill: zero the health, then route through
        // killEnemy as a retaliation (it never counts as a direct-shot kill).
        enemy.health = 0;
        this.killEnemy(enemy, { source: 'retaliation' });
        // One shockwave per killed enemy (like the chain card).
        this.createShockwave(cx, cy);
    }
    // Plus a large shockwave at the player marking the counter radius.
    this.createShockwave(playerCX, playerCY);

    // Thorns also chips the boss by a fraction of its max health.
    if (this.boss && this.boss.health > 0) {
        this.boss.health -= this.boss.maxHealth * CONFIG.cards.thornsBossFrac;
        if (this.boss.health <= 0) {
            this.handleBossDeath();
        }
    }
};

// Unified boss death. Null out this.boss first to prevent re-entry, then hand out rewards.
Game.handleBossDeath = function() {
    if (!this.boss) return;
    this.boss = null;

    this.crowns++;
    // Boss reward: +3 lives (capped by maxLives, which glass locks to 1).
    this.applyLifeGain(3);

    // Bloodlust: chance of +1 extra life from a boss kill (blocked by blitz/glass).
    if (this.activeCard === 'bloodlust' && Math.random() < CONFIG.cards.lifeStealBoss && this.canHeal()) {
        this.applyLifeGain(1);
    }

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
    for (let i = pool.active.length - 1; i >= 0; i--) {
        const bullet = pool.active[i];
        const dx = bullet.x + bullet.width / 2 - x;
        const dy = bullet.y + bullet.height / 2 - y;
        if (dx * dx + dy * dy <= r2) {
            this.releaseObject('enemyBullets', bullet);
        }
    }
};
