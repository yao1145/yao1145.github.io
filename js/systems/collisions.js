import { Game } from '../core/game.js';
import { CONFIG } from '../core/config.js';

Game.updateParticles = function() {
    const pool = this.objectPools.particles;
    for (let i = pool.active.length - 1; i >= 0; i--) {
        const particle = pool.active[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
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
                this.boss.health -= this.getBulletDamage();

                this.createExplosion(bullet.x, bullet.y, '#fff', 2);

                if (this.boss.health <= 0) {
                    this.createExplosion(this.boss.x + this.boss.width/2, this.boss.y + this.boss.height/2, '#f00', 8);
                    this.crowns++;
                    this.lives += 3;
                    this.boss = null;
                    this.isBossStage = false;
                    this.bossHealthBar.style.display = 'none';
                    // Next boss needs a bigger gap than the last one (+200 per kill):
                    // thresholds 1000 → 2200 → 3600 …
                    this.bossSpawnGap += CONFIG.bossSpawnThresholdIncrement;
                    this.bossSpawnThreshold += this.bossSpawnGap;
                    enemyBulletPool.active = [];
                    this.updateUI(true);
                    // Boss defeated: pause and let the player re-pick an effect
                    // card (keeping the current one is free, switching costs 1 life).
                    this.openCardSelection(false);
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
                    enemy.health -= this.getBulletDamage();

                    enemy.color = '#fff';
                    setTimeout(() => {
                        if (enemy && enemy.color === '#fff') {
                            if (enemy.type === 0) enemy.color = '#f00';
                            else if (enemy.type === 1) enemy.color = '#00f';
                            else if (enemy.type === 2) enemy.color = '#a0f';
                            else if (enemy.type === 3) enemy.color = '#ff0';
                            else if (enemy.type === 4) enemy.color = '#0af';
                        }
                    }, 50);

                    if (enemy.health <= 0) {
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
                        this.createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.color, 4);
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
                    this.lives--;
                    this.createExplosion(this.player.x + this.player.width/2, this.player.y + this.player.height/2, '#fff', 4);

                    this.player.color = '#f00';
                    setTimeout(() => {
                        if (this.player) this.player.color = '#0f0';
                    }, 100);

                    this.player.shieldTime = 5;
                    this.updateShieldUI();

                    if (this.lives <= 0) {
                        this.gameOver();
                    }
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
                this.lives--;
                this.createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, '#fff', 4);

                this.player.color = '#f00';
                setTimeout(() => {
                    if (this.player) this.player.color = '#0f0';
                }, 100);

                this.player.shieldTime = 5;
                this.updateShieldUI();

                if (this.lives <= 0) {
                    this.gameOver();
                }
                break;
            }
        }
    }

    if (this.boss && this.isColliding(this.player, this.boss)) {
        this.lives--;
        this.createExplosion(this.player.x + this.player.width/2, this.player.y + this.player.height/2, '#fff', 4);

        this.player.color = '#f00';
        setTimeout(() => {
            if (this.player) this.player.color = '#0f0';
        }, 100);

        this.player.shieldTime = 5;
        this.updateShieldUI();

        if (this.lives <= 0) {
            this.gameOver();
        }
    }

    const nearbyItems = this.spatialGrid.getNearby(this.player);
    for (const nearby of nearbyItems) {
        if (nearby.poolType === 'items') {
            const item = nearby.obj;

            if (this.isColliding(this.player, item)) {
                this.createExplosion(item.x + item.width/2, item.y + item.height/2, item.color, 4);

                switch (item.type) {
                    case 0:
                        this.lives++;
                        this.updateUI(true);
                        break;
                    case 1:
                        this.isDamageBoost = true;
                        this.damageBoostTime = 10;
                        this.bulletDamage = 2;
                        this.updateAttackUI(true);
                        break;
                    case 2:
                        this.player.shieldTime = 5;
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
