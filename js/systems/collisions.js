import { Game } from '../core/game.js';
import { CONFIG } from '../core/config.js';

Game.updateParticles = function() {
    const pool = this.objectPools.particles;
    for (let i = pool.active.length - 1; i >= 0; i--) {
        const particle = pool.active[i];

        // 扩散冲击环（isRing）不随 vx/vy 平移，而是每帧扩大半径，到上限后停止。
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
                            if (enemy.type === 0) enemy.color = '#f00';
                            else if (enemy.type === 1) enemy.color = '#00f';
                            else if (enemy.type === 2) enemy.color = '#a0f';
                            else if (enemy.type === 3) enemy.color = '#ff0';
                            else if (enemy.type === 4) enemy.color = '#0af';
                        }
                    }, 50);

                    if (enemy.health <= 0) {
                        const killX = enemy.x + enemy.width/2;
                        const killY = enemy.y + enemy.height/2;
                        this.killEnemy(enemy);
                        // 连环爆炸: 子弹击杀这一事件触发首爆；连锁内后续击杀由
                        // createExplosionChain 自己的 worklist 逐点引爆（不在此重复触发）。
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
                        // 电光石火/玻璃大炮禁止回命时红心直接浪费，但依然会被消耗。
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

// 廉价扩散冲击环：单个 ring 粒子，从中心向外扩一圈圆环后淡出。
// 复用粒子池、复用 updateParticles/render 的逐帧路径，开销几乎为零。
Game.createShockwave = function(x, y, color = '#ffd166') {
    const particle = this.getObject('particles');
    if (!particle) return;
    particle.x = x;
    particle.y = y;
    particle.vx = 0;
    particle.vy = 0;
    particle.life = 14;               // 帧数寿命
    particle.color = color;
    particle.isRing = true;
    particle.radius = 4;
    particle.ringGrowth = 9;          // 每帧扩大 px
    particle.ringMax = 130;           // 到上限即不再扩大（避免巨圆开销）
};

// 统一“玩家被击中”的收尾逻辑：扣 1 命、玩家中心爆炸、红闪、护盾重置，
// 荆棘护甲反击与死亡判定。不负责释放撞击来源（由调用方自行处理）。
Game.applyPlayerHit = function(damage = 1) {
    this.lives -= damage;
    this.createExplosion(this.player.x + this.player.width/2, this.player.y + this.player.height/2, '#fff', 4);

    this.player.color = '#f00';
    setTimeout(() => {
        if (this.player) this.player.color = '#0f0';
    }, 100);

    this.player.shieldTime = 5;
    this.updateShieldUI();

    // 记录本次命中是否致命（在荆棘反击可能加命之前判定）。
    const lethal = this.lives <= 0;

    // 荆棘护甲: 受击即反击（击杀最近敌人 + 波及 Boss）。
    if (this.activeCard === 'thorns') this.onThornsHit();

    // 致命命中即死：锁存这次命中是否已把生命扣到 0——即便荆棘反击恰好击倒
    // Boss 触发了 +3 命奖励，也不允许“绝境反杀复活”（规则：死了就是死了）。
    if (lethal || this.lives <= 0) {
        this.gameOver();
    }
};

// 统一的敌人死亡处理（释放 + 计分 + 爆炸），同一帧内对同一敌人只生效一次。
Game.killEnemy = function(enemy) {
    // 只在敌人已被打到 <=0 生命时才结算死亡；_dead 保证同帧内不重复计分/重复释放。
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

    // 血之渴望: 击杀普通敌人按概率回 1 命（Boss 概率见 handleBossDeath）。
    if (this.activeCard === 'bloodlust' && this.canHeal() && Math.random() < this.getLifeStealChance()) {
        this.applyLifeGain(1);
    }

    this.createExplosion(killX, killY, killColor, 4);
};

// 荆棘护甲: 玩家每次受击时，以玩家为中心 thornsRadius 半径内的所有敌机一并
// 秒杀并计分，每个击杀点附带一个扩散冲击环（类似连环爆炸），再对 Boss 削血。
Game.onThornsHit = function() {
    const playerCX = this.player.x + this.player.width/2;
    const playerCY = this.player.y + this.player.height/2;
    const radius = CONFIG.cards.thornsRadius;
    const r2 = radius * radius;

    // 遍历 active 池的快照，避免 killEnemy 在遍历中改动数组；只处理仍在场的活敌。
    const enemies = this.objectPools.enemies.active.slice();
    for (const enemy of enemies) {
        if (!enemy || enemy._dead || enemy.health <= 0) continue;
        const cx = enemy.x + enemy.width/2;
        const cy = enemy.y + enemy.height/2;
        const dx = cx - playerCX;
        const dy = cy - playerCY;
        if (dx * dx + dy * dy > r2) continue;

        // 荆棘是“秒杀”：先把敌人打到致命状态，再走统一的 killEnemy 计分/爆炸。
        enemy.health = 0;
        this.killEnemy(enemy);
        // 反杀冲击环：每个被秒杀的敌机补一个扩散环（类似连环爆炸）。
        this.createShockwave(cx, cy);
    }
    // 玩家中心再补一个大冲击环，标示整圈反杀范围。
    this.createShockwave(playerCX, playerCY);

    // 荆棘护甲对 Boss 的伤害比例削血。
    if (this.boss && this.boss.health > 0) {
        this.boss.health -= this.boss.maxHealth * CONFIG.cards.thornsBossFrac;
        if (this.boss.health <= 0) {
            this.handleBossDeath();
        }
    }
};

// 统一的 Boss 死亡结算。先清空 this.boss 以杜绝重入，再依次发放奖励与后续状态。
Game.handleBossDeath = function() {
    if (!this.boss) return;
    this.boss = null;

    this.crowns++;
    // Boss 奖励：+3 命（受 maxLives 上限约束，玻璃卡下被封顶到 1）。
    this.applyLifeGain(3);

    // 血之渴望: Boss 击杀有概率额外 +1 命（受电光石火/玻璃大炮限制）。
    if (this.activeCard === 'bloodlust' && Math.random() < CONFIG.cards.lifeStealBoss && this.canHeal()) {
        this.applyLifeGain(1);
    }

    this.isBossStage = false;
    this.bossHealthBar.style.display = 'none';
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

// 连环爆炸: 从 (x, y) 向外在 chainRadius 内级联引爆。网格每帧只重建一次，
// 用 _dead / health 双重守卫避免伤及本帧已死的敌人；worklist + processed
// + 迭代上限保证不会重复处理同一敌人或陷入死循环。
Game.createExplosionChain = function(x, y) {
    const chainRadius = CONFIG.cards.chainRadius;
    const chainDamage = CONFIG.cards.chainDamage;
    const worklist = [{ x: x, y: y }];
    const processed = new Set();
    let iterations = 0;
    const maxIterations = 80; // 安全上限：极端敌群密度下也不会挂起

    while (worklist.length > 0 && iterations < maxIterations) {
        const point = worklist.pop();
        iterations++;
        // 连环爆炸特效：少量小火星 + 一个扩散冲击环，简单且开销低。
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
