import { Game } from './game.js';

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

    if (this.isTripleShot) {
        this.tripleShotTime -= deltaTime / 1000;
        if (this.tripleShotTime < 0) {
            this.isTripleShot = false;
            this.tripleShotTime = 0;
        }

        this.updateAttackUI();
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
    if (this.isTripleShot) {
        this.attackIndicator.style.display = 'block';
        this.attackIndicator.textContent = `攻: ${this.tripleShotTime.toFixed(1)}`;
    } else {
        this.attackIndicator.style.display = 'none';
    }
};

Game.spawnBullet = function() {
    if (this.isTripleShot) {
        const bullet1 = this.getObject('bullets');
        if (bullet1) {
            bullet1.x = this.player.x + this.player.width / 2 - 8;
            bullet1.y = this.player.y;
            bullet1.width = 4;
            bullet1.height = 12;
            bullet1.speed = 8;
            bullet1.color = '#f90';
        }
        const bullet2 = this.getObject('bullets');
        if (bullet2) {
            bullet2.x = this.player.x + this.player.width / 2 - 2;
            bullet2.y = this.player.y;
            bullet2.width = 4;
            bullet2.height = 12;
            bullet2.speed = 8;
            bullet2.color = '#f90';
        }
        const bullet3 = this.getObject('bullets');
        if (bullet3) {
            bullet3.x = this.player.x + this.player.width / 2 + 4;
            bullet3.y = this.player.y;
            bullet3.width = 4;
            bullet3.height = 12;
            bullet3.speed = 8;
            bullet3.color = '#f90';
        }
    } else {
        const bullet = this.getObject('bullets');
        if (bullet) {
            bullet.x = this.player.x + this.player.width / 2 - 2;
            bullet.y = this.player.y;
            bullet.width = 4;
            bullet.height = 12;
            bullet.speed = 8;
            bullet.color = '#ff0';
        }
    }
};
