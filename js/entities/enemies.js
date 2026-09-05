import { Game } from '../core/game.js';
import { CONFIG } from '../core/config.js';

Game.spawnEnemies = function() {
    const hpBonus = Math.floor((this.level - 1) / CONFIG.enemyHpLevelInterval);
    if (!this.isBossStage && Math.random() < this.getEnemySpawnRate()) {
        this.spawnEnemyUnit(hpBonus);
    }
};

// Shared enemy field init (type rolled from CONFIG.enemyTypes) used by both
// normal spawning and boss summoning, with the same hpBonus.
Game.spawnEnemyUnit = function(hpBonus) {
    const type = Math.floor(Math.random() * CONFIG.enemyTypes.length);
    const t = CONFIG.enemyTypes[type];

    const enemy = this.getObject('enemies');
    if (enemy) {
        enemy.x = Math.random() * (this.width - t.width);
        enemy.y = -t.height;
        enemy.width = t.width;
        enemy.height = t.height;
        enemy.speed = this.enemySpeed * t.speedFactor;
        enemy.color = t.color;
        enemy.type = type;
        enemy.canShoot = t.canShoot;
        enemy.health = t.health + hpBonus;
        enemy.maxHealth = t.health + hpBonus;
        enemy.lastShot = 0;
        enemy.shotDelay = 1000 + Math.random() * 1000;
        enemy.variant = this.rollEnemyVariant(type);
    }
};

Game.enemiesShoot = function() {
    const currentTime = this.gameTime;
    const pool = this.objectPools.enemies;

    for (let i = 0; i < pool.active.length; i++) {
        const enemy = pool.active[i];

        if (enemy.canShoot && currentTime - enemy.lastShot > enemy.shotDelay) {
            if (Math.random() < this.getEnemyShotRate()) {
                switch (enemy.type) {
                    case 1:
                    case 2:
                        this.spawnEnemyBullet(enemy);
                        break;
                    case 3:
                        this.spawnTrackingBullet(enemy);
                        break;
                    case 4:
                        this.spawnRingBullet(enemy);
                        break;
                }
                enemy.lastShot = currentTime;
            }
        }
    }
};

Game.updateEnemies = function(deltaTime) {
    const speedMult = this.getEnemySpeedMult();
    const pool = this.objectPools.enemies;
    for (let i = pool.active.length - 1; i >= 0; i--) {
        const enemy = pool.active[i];

        enemy.y += enemy.speed * speedMult;

        if (enemy.type === 0) {
            const dx = this.player.x + this.player.width/2 - (enemy.x + enemy.width/2);
            const dy = this.player.y + this.player.height/2 - (enemy.y + enemy.height/2);
            const distance = Math.sqrt(dx*dx + dy*dy);

            if (distance < 150 && Math.random() < 0.005) {
                this.createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, '#f00', 8);
                this.spawnExplosionBullet(enemy.x + enemy.width/2, enemy.y + enemy.height/2, 16);
                // Kamikaze self-destruct also settles through killEnemy so
                // type-0 scoring has a single path.
                enemy.health = 0;
                this.killEnemy(enemy);
                continue;
            }
        }

        if (enemy.y > this.height) {
            this.releaseObject('enemies', enemy);
        }
    }
};
