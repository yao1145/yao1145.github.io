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

        if (this.isBossStage && this.boss) {
            if (this.isColliding(bullet, this.boss)) {
                this.releaseObject('bullets', bullet);
                this.boss.health -= this.getDamageFor('boss');

                this.createExplosion(bullet.x, bullet.y, '#fff', 2);

                if (this.boss.health <= 0) {
                    this.createExplosion(this.boss.x + this.boss.width/2, this.boss.y + this.boss.height/2, '#f00', 8);
                    this.handleBossDeath();
                }
                break;
            }
        }

        const nearbyEnemies = this.spatialGrid.getNearby(bullet);
        for (const nearby of nearbyEnemies) {
            if (nearby.poolType === 'enemies') {
                const enemy = nearby.obj;

                if (this.isColliding(bullet, enemy)) {
                    // An enemy killed earlier this frame is still in the spatial grid;
                    // skip it so a second bullet (e.g. from triple-shot) can't score it again.
                    if (enemy.health <= 0) continue;
                    this.releaseObject('bullets', bullet);
                    enemy.health -= this.getDamageFor('enemy');

                    enemy.color = '#fff';
                    setTimeout(() => {
                        // Never re-color an enemy that has been killed and returned to the pool.
                        if (enemy && !enemy._dead && enemy.color === '#fff') {
                            enemy.color = CONFIG.enemyTypes[enemy.type].color;
                        }
                    }, 50);

                    if (enemy.health <= 0) {
                        const killX = enemy.x + enemy.width/2;
                        const killY = enemy.y + enemy.height/2;
                        this.killEnemy(enemy);
                        // Chain card: this bullet kill triggers the first blast; further
                        // chain kills are detonated by createExplosionChain's own worklist.
                        if (this.activeCard === 'chain') this.createExplosionChain(killX, killY);
                    } else {
                        this.createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, '#fff', 2);
                    }
                    break;
                }
            }
        }
    }

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

// Unified enemy death (release + score + explosion); runs once per enemy per frame.
Game.killEnemy = function(enemy) {
    // Only settles when health <= 0; _dead guards against double scoring/release within a frame.
    if (!enemy || enemy._dead || enemy.health > 0) return;

    enemy._dead = true;
    const killX = enemy.x + enemy.width/2;
    const killY = enemy.y + enemy.height/2;
    const killColor = enemy.color;

    this.releaseObject('enemies', enemy);

    let score = 0;
    switch (enemy.type) {
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

    this.createExplosion(killX, killY, killColor, 4);
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

        // Thorns is an instant kill: zero the health, then route through killEnemy.
        enemy.health = 0;
        this.killEnemy(enemy);
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
    // Boss defeated: pause and let the player re-pick an effect
    // card (keeping the current one is free, switching costs 1 life).
    this.openCardSelection(false);
};

// Chain explosion: cascades outward from (x, y) within chainRadius, using the
// spatial grid built once per frame. _dead/health guards skip enemies already
// dead this frame; worklist + processed set + iteration cap prevent double
// processing and infinite loops.
Game.createExplosionChain = function(x, y) {
    const chainRadius = CONFIG.cards.chainRadius;
    const chainDamage = CONFIG.cards.chainDamage;
    const worklist = [{ x: x, y: y }];
    const processed = new Set();
    let iterations = 0;
    const maxIterations = 80; // safety cap against pathological enemy density

    while (worklist.length > 0 && iterations < maxIterations) {
        const point = worklist.pop();
        iterations++;
        // Chain VFX: a few sparks + one shockwave.
        this.createExplosion(point.x, point.y, '#ff0', 3);
        this.createShockwave(point.x, point.y);

        const nearby = this.spatialGrid.getNearby({ x: point.x, y: point.y, width: 1, height: 1 });
        for (const entry of nearby) {
            if (entry.poolType !== 'enemies') continue;
            const enemy = entry.obj;
            if (!enemy || enemy._dead || enemy.health <= 0) continue;
            if (processed.has(enemy)) continue;

            const dx = enemy.x + enemy.width/2 - point.x;
            const dy = enemy.y + enemy.height/2 - point.y;
            if (dx * dx + dy * dy > chainRadius * chainRadius) continue;

            enemy.health -= chainDamage;
            if (enemy.health <= 0) {
                processed.add(enemy);
                this.killEnemy(enemy);
                worklist.push({ x: enemy.x + enemy.width/2, y: enemy.y + enemy.height/2 });
            }
        }
    }
};
