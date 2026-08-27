import { Game } from '../core/game.js';

Game.spawnEnemies = function() {
    if (!this.isBossStage && Math.random() < this.enemySpawnRate) {
        const type = Math.floor(Math.random() * 5);
        let color, speed, canShoot, health, width, height;

        switch (type) {
            case 0:
                color = '#f00';
                speed = this.enemySpeed;
                canShoot = false;
                health = 1;
                width = 30;
                height = 30;
                break;
            case 1:
                color = '#00f';
                speed = this.enemySpeed * 1.5;
                canShoot = true;
                health = 1;
                width = 30;
                height = 30;
                break;
            case 2:
                color = '#a0f';
                speed = this.enemySpeed * 0.7;
                canShoot = true;
                health = 2;
                width = 35;
                height = 35;
                break;
            case 3:
                color = '#ff0';
                speed = this.enemySpeed * 0.9;
                canShoot = true;
                health = 1;
                width = 28;
                height = 28;
                break;
            case 4:
                color = '#0af';
                speed = this.enemySpeed * 0.8;
                canShoot = true;
                health = 2;
                width = 32;
                height = 32;
                break;
        }

        const enemy = this.getObject('enemies');
        if (enemy) {
            enemy.x = Math.random() * (this.width - width);
            enemy.y = -height;
            enemy.width = width;
            enemy.height = height;
            enemy.speed = speed;
            enemy.color = color;
            enemy.type = type;
            enemy.canShoot = canShoot;
            enemy.health = health;
            enemy.maxHealth = health;
            enemy.lastShot = 0;
            enemy.shotDelay = 1000 + Math.random() * 1000;
        }
    }
};

Game.enemiesShoot = function() {
    const currentTime = this.gameTime;
    const pool = this.objectPools.enemies;

    for (let i = 0; i < pool.active.length; i++) {
        const enemy = pool.active[i];

        if (enemy.canShoot && currentTime - enemy.lastShot > enemy.shotDelay) {
            if (Math.random() < this.enemyShotRate) {
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
    const pool = this.objectPools.enemies;
    for (let i = pool.active.length - 1; i >= 0; i--) {
        const enemy = pool.active[i];

        enemy.y += enemy.speed;

        if (enemy.type === 0) {
            const dx = this.player.x + this.player.width/2 - (enemy.x + enemy.width/2);
            const dy = this.player.y + this.player.height/2 - (enemy.y + enemy.height/2);
            const distance = Math.sqrt(dx*dx + dy*dy);

            if (distance < 150 && Math.random() < 0.005) {
                this.createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, '#f00', 8);
                this.spawnExplosionBullet(enemy.x + enemy.width/2, enemy.y + enemy.height/2, 16);
                this.score += 10;
                this.releaseObject('enemies', enemy);
                continue;
            }
        }

        if (enemy.y > this.height) {
            this.releaseObject('enemies', enemy);
        }
    }
};
