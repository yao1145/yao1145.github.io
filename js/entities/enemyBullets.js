import { Game } from '../core/game.js';
import { CONFIG } from '../core/config.js';

// Scale a pattern's bullet count with its bullet speed so the gap between
// adjacent bullets stays roughly constant when the level raises enemyBulletSpeed.
// Anchored so the level-1 speed (patternSpacingRef) reproduces the authored
// count; the count never drops below baseCount (keeps low levels / first boss
// the same) and caps at patternSpacingMax (pool & perf safety).
Game.scaledBulletCount = function(baseCount, speed) {
    let count = Math.round(baseCount * (speed / CONFIG.patternSpacingRef));
    return Math.max(baseCount, Math.min(count, CONFIG.patternSpacingMax));
};

Game.spawnTrackingBullet = function(enemy) {
    if (this.boss && this.gameTime - this.boss.lastTrackingShot < this.boss.trackingShotDelay) {
        return;
    }

    const dx = this.player.x + this.player.width/2 - (enemy.x + enemy.width/2);
    const dy = this.player.y + this.player.height/2 - (enemy.y + enemy.height/2);
    const distance = Math.sqrt(dx*dx + dy*dy);

    if (distance > 0) {
        const speed = this.enemyBulletSpeed * 0.8;
        const vx = (dx / distance) * speed;
        const vy = (dy / distance) * speed;

        const bullet = this.getObject('enemyBullets');
        if (bullet) {
            bullet.x = enemy.x + enemy.width / 2 - 2;
            bullet.y = enemy.y + enemy.height;
            bullet.width = 6;
            bullet.height = 6;
            bullet.vx = vx;
            bullet.vy = vy;
            bullet.speed = speed;
            bullet.color = '#ff0';
            bullet.isTracking = true;
            bullet.trackingPower = 0.05;
        }

        if (this.boss) {
            this.boss.lastTrackingShot = this.gameTime;
        }
    }
};

Game.spawnRingBullet = function(enemy, count = 8, speedMulti = 0.7) {
    const speed = this.enemyBulletSpeed * speedMulti;
    const bulletCount = this.scaledBulletCount(count, speed);

    for (let i = 0; i < bulletCount; i++) {
        const bullet = this.getObject('enemyBullets');
        if (!bullet) break;

        const angle = (i * Math.PI * 2) / bulletCount;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        bullet.x = enemy.x + enemy.width / 2 - 2;
        bullet.y = enemy.y + enemy.height;
        bullet.width = 5;
        bullet.height = 5;
        bullet.vx = vx;
        bullet.vy = vy;
        bullet.color = '#0af';
        bullet.isRing = true;
    }
};

Game.spawnWaveBullet = function(enemy, offset = 0) {
    const bulletCount = 4;
    const baseSpeed = this.enemyBulletSpeed * 0.6;
    const waveAmplitude = 2.0;
    const waveFrequency = 0.1;

    for (let i = 0; i < bulletCount; i++) {
        const bullet = this.getObject('enemyBullets');
        if (!bullet) break;

        const angleOffset = (i * Math.PI * 2) / bulletCount;
        const vx = Math.cos(angleOffset) * waveAmplitude;
        const vy = baseSpeed;

        bullet.x = enemy.x + enemy.width / 2 - 2;
        bullet.y = enemy.y + enemy.height;
        bullet.width = 6;
        bullet.height = 6;
        bullet.vx = vx;
        bullet.vy = vy;
        bullet.baseVx = vx;
        bullet.baseVy = vy;
        bullet.waveAmplitude = waveAmplitude;
        bullet.waveFrequency = waveFrequency;
        bullet.waveOffset = offset + i * 0.5;
        bullet.color = '#f0f';
        bullet.isWave = true;
    }
};

Game.spawnScatterBullet = function(enemy) {
    const baseSpeed = this.enemyBulletSpeed * 0.5;
    const bulletCount = this.scaledBulletCount(7, baseSpeed);
    // Keep the fan's total angular spread constant while the bullet count grows,
    // so the gap between adjacent bullet tracks stays the same at any speed.
    const SCATTER_SPREAD = Math.PI / 2;

    for (let i = 0; i < bulletCount; i++) {
        const bullet = this.getObject('enemyBullets');
        if (!bullet) break;

        const t = bulletCount === 1 ? 0.5 : i / (bulletCount - 1);
        const angle = Math.PI / 2 + (t - 0.5) * SCATTER_SPREAD;
        const vx = Math.cos(angle) * baseSpeed;
        const vy = Math.sin(angle) * baseSpeed;

        bullet.x = enemy.x + enemy.width / 2 - 2;
        bullet.y = enemy.y + enemy.height;
        bullet.width = 5;
        bullet.height = 5;
        bullet.vx = vx;
        bullet.vy = vy;
        bullet.color = '#f90';
        bullet.isScatter = true;
    }
};

Game.spawnExplosionBullet = function(x, y, count = 16) {
    const speed = this.enemyBulletSpeed * 0.8;
    const bulletCount = this.scaledBulletCount(count, speed);

    for (let i = 0; i < bulletCount; i++) {
        const bullet = this.getObject('enemyBullets');
        if (!bullet) break;

        const angle = (i * Math.PI * 2) / bulletCount;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        bullet.x = x;
        bullet.y = y;
        bullet.width = 6;
        bullet.height = 6;
        bullet.vx = vx;
        bullet.vy = vy;
        bullet.color = '#f00';
        bullet.isExplosion = true;
    }
};

Game.updateEnemyBullets = function() {
    const pool = this.objectPools.enemyBullets;
    for (let i = pool.active.length - 1; i >= 0; i--) {
        const bullet = pool.active[i];

        if (bullet.isTracking) {
            const dx = this.player.x + this.player.width/2 - bullet.x;
            const dy = this.player.y + this.player.height/2 - bullet.y;
            const distance = Math.sqrt(dx*dx + dy*dy);

            if (distance > 0) {
                bullet.vx += (dx / distance) * bullet.trackingPower;
                bullet.vy += (dy / distance) * bullet.trackingPower;

                const currentSpeed = Math.sqrt(bullet.vx*bullet.vx + bullet.vy*bullet.vy);
                if (currentSpeed > 0) {
                    bullet.vx = (bullet.vx / currentSpeed) * bullet.speed;
                    bullet.vy = (bullet.vy / currentSpeed) * bullet.speed;
                }
            }

            bullet.x += bullet.vx;
            bullet.y += bullet.vy;
        } else if (bullet.isRing || bullet.isScatter || bullet.isExplosion || bullet.isIce || bullet.isPoison) {
            bullet.x += bullet.vx;
            bullet.y += bullet.vy;
        } else if (bullet.isWave) {
            bullet.waveOffset += bullet.waveFrequency;
            const waveValue = Math.sin(bullet.waveOffset) * bullet.waveAmplitude;
            bullet.vx = bullet.baseVx + waveValue;
            bullet.y += bullet.vy;
            bullet.x += bullet.vx;
        } else if (bullet.isIceBeam) {
            bullet.y += bullet.speed;
        } else {
            bullet.y += this.enemyBulletSpeed;
        }

        if (bullet.y > this.height || bullet.y < -20 ||
            bullet.x > this.width + 20 || bullet.x < -20) {
            this.releaseObject('enemyBullets', bullet);
        }
    }
};

Game.spawnEnemyBullet = function(enemy) {
    const bullet = this.getObject('enemyBullets');
    if (bullet) {
        bullet.x = enemy.x + enemy.width / 2 - 2;
        bullet.y = enemy.y + enemy.height;
        bullet.width = 4;
        bullet.height = 12;
        bullet.speed = this.enemyBulletSpeed;
        bullet.color = '#f0f';
        bullet.vx = 0;
        bullet.vy = this.enemyBulletSpeed;
    }
};
