import { Game } from '../core/game.js';
import { CONFIG } from '../core/config.js';

Game.updatePlayer = function(deltaTime) {
    if (this.keys['arrowleft'] || this.keys['a']) this.player.x -= this.player.speed;
    if (this.keys['arrowright'] || this.keys['d']) this.player.x += this.player.speed;
    if (this.keys['arrowup'] || this.keys['w']) this.player.y -= this.player.speed;
    if (this.keys['arrowdown'] || this.keys['s']) this.player.y += this.player.speed;

    this.player.x = Math.max(0, Math.min(this.width - this.player.width, this.player.x));
    this.player.y = Math.max(0, Math.min(this.height - this.player.height, this.player.y));

    if (this.gameTime - this.player.lastShot > this.player.shotDelay) {
        this.spawnBullet();
        this.player.lastShot = this.gameTime;
    }

    if (this.player.shieldTime > 0) {
        this.player.shieldTime -= deltaTime / 1000;
        if (this.player.shieldTime < 0) {
            this.player.shieldTime = 0;
        }

        this.updateShieldUI();
    }

    if (this.isDamageBoost) {
        this.damageBoostTime -= deltaTime / 1000;
        if (this.damageBoostTime < 0) {
            this.isDamageBoost = false;
            this.damageBoostTime = 0;
            this.bulletDamage = 1;
        }

        this.updateAttackUI();
    }

    // Crown achievement: grant an auto-shield every N ms of gameplay.
    if (this.autoShieldTimer > 0) {
        this.autoShieldTimer -= deltaTime;
        if (this.autoShieldTimer <= 0) {
            this.autoShieldTimer = CONFIG.achievements.autoShieldIntervalMs;
            this.player.shieldTime = CONFIG.achievements.autoShieldDuration;
            this.updateShieldUI(true);
        }
    }
};

Game.updateShieldUI = function(force = false) {
    if (this.player.shieldTime > 0) {
        this.shieldIndicator.style.display = 'block';
        this.shieldIndicator.textContent = `盾: ${this.player.shieldTime.toFixed(1)}`;
    } else {
        this.shieldIndicator.style.display = 'none';
    }
};

Game.updateAttackUI = function(force = false) {
    if (this.isDamageBoost) {
        this.attackIndicator.style.display = 'block';
        this.attackIndicator.textContent = `攻: ${this.damageBoostTime.toFixed(1)}`;
    } else {
        this.attackIndicator.style.display = 'none';
    }
};

Game.spawnBullet = function() {
    const count = this.baseBulletCount;
    const color = this.isDamageBoost ? '#f90' : '#ff0';
    const gap = 6;

    for (let i = 0; i < count; i++) {
        const bullet = this.getObject('bullets');
        if (!bullet) break;
        bullet.x = this.player.x + this.player.width / 2 - 2 + (i - (count - 1) / 2) * gap;
        bullet.y = this.player.y;
        bullet.width = 4;
        bullet.height = 12;
        bullet.speed = 8;
        bullet.color = color;
    }
};
