import { Game } from '../core/game.js';
import { CONFIG } from '../core/config.js';

Game.spawnBoss = function() {
    this.isBossStage = true;
    this.bossAppearCount++;

    const bossTypes = CONFIG.bossTypes;

    const bossTypeIndex = Math.floor(Math.random() * bossTypes.length);
    const bossType = bossTypes[bossTypeIndex];

    let bossHealth = bossType.baseHealth;
    let bossSpeed = bossType.baseSpeed;
    let bossShotDelay = bossType.baseShotDelay;
    let bossPatternChangeDelay = 3000;

    if (this.bossAppearCount > 1) {
        const bossLevelMultiplier = Math.min(8, 1 + this.level * 0.25);

        bossHealth = Math.floor(bossType.baseHealth * bossLevelMultiplier);
        bossSpeed = bossType.baseSpeed + (this.level - 1) * 0.1;
        bossShotDelay = Math.max(250, bossType.baseShotDelay - (this.level - 1) * 15);
        bossPatternChangeDelay = Math.max(1500, 3000 - (this.level - 1) * 100);
    }

    this.boss = {
        x: this.width / 2 - 50,
        y: 50,
        width: 100,
        height: 100,
        health: bossHealth,
        maxHealth: bossHealth,
        speed: bossSpeed,
        color: bossType.color,
        type: bossTypeIndex,
        name: bossType.name,
        lastShot: 0,
        shotDelay: bossShotDelay,
        lastPatternChange: 0,
        patternChangeDelay: bossPatternChangeDelay,
        currentPattern: 0,
        moveDirection: 1,
        waveOffset: 0,
        level: this.level,
        movePhase: 0,
        centerX: this.width / 2 - 50,
        centerY: 50,
        orbitAngle: 0,
        lastTrackingShot: 0,
        trackingShotDelay: bossShotDelay * 2
    };

    this.objectPools.enemies.active = [];
    this.objectPools.enemyBullets.active = [];

    this.bossWarning.textContent = `${bossType.name}来袭!`;
    this.bossWarning.style.display = 'block';
    setTimeout(() => {
        this.bossWarning.style.display = 'none';
    }, 2000);

    this.bossHealthBar.style.display = 'block';
    this.updateBossHealthBar();
};

Game.updateBoss = function() {
    if (!this.boss) return;

    switch (this.boss.type) {
        case 0:
            this.updateFireBoss();
            break;
        case 1:
            this.updateIceBoss();
            break;
        case 2:
            this.updatePoisonBoss();
            break;
    }

    this.updateBossHealthBar();
};

Game.updateFireBoss = function() {
    this.boss.x += this.boss.speed * this.boss.moveDirection;

    if (this.boss.x <= 0 || this.boss.x >= this.width - this.boss.width) {
        this.boss.moveDirection *= -1;
    }

    this.boss.waveOffset += 0.05;
};

Game.updateIceBoss = function() {
    this.boss.x += this.boss.speed * this.boss.moveDirection;
    this.boss.y += Math.sin(this.boss.waveOffset) * 2;

    if (this.boss.x <= 0 || this.boss.x >= this.width - this.boss.width) {
        this.boss.moveDirection *= -1;
    }

    this.boss.waveOffset += 0.03;
};

Game.updatePoisonBoss = function() {
    this.boss.movePhase += 0.02;
    const radius = 100;
    this.boss.x = this.boss.centerX + Math.cos(this.boss.movePhase) * radius;
    this.boss.y = this.boss.centerY + Math.sin(this.boss.movePhase * 0.5) * 50;

    this.boss.x = Math.max(0, Math.min(this.width - this.boss.width, this.boss.x));
};

Game.updateBossHealthBar = function(force = false) {
    if (!this.boss) return;

    const healthPercent = this.boss.health / this.boss.maxHealth;
    // Recede the colors from right to left: anchor the gradient, clip the depleted side.
    this.bossHealthFill.style.clipPath = `inset(0 ${(1 - healthPercent) * 100}% 0 0)`;
    this.bossHealthText.textContent = `${this.boss.health}/${this.boss.maxHealth}`;
};

Game.bossShoot = function() {
    if (!this.boss) return;

    const currentTime = this.gameTime;
    let levelMultiplier = 1;

    if (this.bossAppearCount > 1) {
        levelMultiplier = Math.min(8, 1 + (this.boss.level - 1) * 0.08);
    }

    if (currentTime - this.boss.lastShot > this.boss.shotDelay) {
        const healthPercent = this.boss.health / this.boss.maxHealth;

        switch (this.boss.type) {
            case 0:
                if (healthPercent > 0.7) {
                    this.fireBossPattern1(levelMultiplier);
                } else if (healthPercent > 0.3) {
                    this.fireBossPattern2(levelMultiplier);
                } else {
                    this.fireBossPattern3(levelMultiplier);
                }
                break;
            case 1:
                if (healthPercent > 0.7) {
                    this.iceBossPattern1(levelMultiplier);
                } else if (healthPercent > 0.3) {
                    this.iceBossPattern2(levelMultiplier);
                } else {
                    this.iceBossPattern3(levelMultiplier);
                }
                break;
            case 2:
                if (healthPercent > 0.7) {
                    this.poisonBossPattern1(levelMultiplier);
                } else if (healthPercent > 0.3) {
                    this.poisonBossPattern2(levelMultiplier);
                } else {
                    this.poisonBossPattern3(levelMultiplier);
                }
                break;
        }

        this.boss.lastShot = currentTime;
    }

    if (currentTime - this.boss.lastPatternChange > this.boss.patternChangeDelay) {
        this.boss.currentPattern = (this.boss.currentPattern + 1) % 3;
        this.boss.lastPatternChange = currentTime;
    }
};

Game.fireBossPattern1 = function(multiplier) {
    let count = 8;
    if (this.bossAppearCount > 1) {
        count = Math.min(12, 8 + Math.floor(this.boss.level * 0.3));
    }
    this.spawnRingBullet(this.boss, count, 0.6 * multiplier);
};

Game.fireBossPattern2 = function(multiplier) {
    this.spawnTrackingBullet(this.boss);
    this.spawnWaveBullet(this.boss, this.boss.waveOffset);
    setTimeout(() => {
        if (this.boss) {
            let count = 4;
            if (this.bossAppearCount > 1) {
                count = Math.min(8, 4 + Math.floor(this.boss.level * 0.2));
            }
            this.spawnRingBullet(this.boss, count, 0.8 * multiplier);
        }
    }, 500);
};

Game.fireBossPattern3 = function(multiplier) {
    this.spawnWaveBullet(this.boss, this.boss.waveOffset);
    this.spawnWaveBullet(this.boss, this.boss.waveOffset + Math.PI);
    setTimeout(() => {
        if (this.boss) this.spawnScatterBullet(this.boss);
    }, 200);
    setTimeout(() => {
        if (this.boss) this.spawnTrackingBullet(this.boss);
    }, 400);
};

Game.iceBossPattern1 = function(multiplier) {
    for (let i = 0; i < 2; i++) {
        setTimeout(() => {
            if (this.boss) {
                const bulletCount = 3;
                const speed = this.enemyBulletSpeed * 0.5 * multiplier;

                for (let j = 0; j < bulletCount; j++) {
                    const bullet = this.getObject('enemyBullets');
                    if (!bullet) continue;

                    const angle = Math.PI/2 + (j - bulletCount/2) * Math.PI/12;
                    const vx = Math.cos(angle) * speed;
                    const vy = Math.sin(angle) * speed;

                    bullet.x = this.boss.x + this.boss.width / 2 - 2;
                    bullet.y = this.boss.y + this.boss.height;
                    bullet.width = 6;
                    bullet.height = 6;
                    bullet.vx = vx;
                    bullet.vy = vy;
                    bullet.color = '#0af';
                    bullet.isIce = true;
                }
            }
        }, i * 200);
    }
};

Game.iceBossPattern2 = function(multiplier) {
    this.spawnRingBullet(this.boss, 10, 0.4 * multiplier);
    setTimeout(() => {
        if (this.boss) {
            this.spawnTrackingBullet(this.boss);
        }
    }, 300);
};

Game.iceBossPattern3 = function(multiplier) {
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            if (this.boss) {
                const bullet = this.getObject('enemyBullets');
                if (bullet) {
                    const offsetX = (i - 1) * 20;
                    bullet.x = this.boss.x + this.boss.width / 2 - 3 + offsetX;
                    bullet.y = this.boss.y + this.boss.height;
                    bullet.width = 6;
                    bullet.height = 15;
                    bullet.speed = this.enemyBulletSpeed * 0.7 * multiplier;
                    bullet.color = '#00f';
                    bullet.isIceBeam = true;
                }
            }
        }, i * 100);
    }
    this.spawnRingBullet(this.boss, 10, 0.4 * multiplier);
    setTimeout(() => {
        if (this.boss) {
            this.spawnTrackingBullet(this.boss);
        }
    }, 300);
};

Game.poisonBossPattern1 = function(multiplier) {
    const bulletCount = 12;
    const speed = this.enemyBulletSpeed * 0.5 * multiplier;

    for (let i = 0; i < bulletCount; i++) {
        const bullet = this.getObject('enemyBullets');
        if (!bullet) continue;

        const angle = (i * Math.PI * 2) / bulletCount;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        bullet.x = this.boss.x + this.boss.width / 2 - 2;
        bullet.y = this.boss.y + this.boss.height / 2;
        bullet.width = 5;
        bullet.height = 5;
        bullet.vx = vx;
        bullet.vy = vy;
        bullet.color = '#a0f';
        bullet.isPoison = true;
    }
};

Game.poisonBossPattern2 = function(multiplier) {
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            if (this.boss) {
                this.spawnExplosionBullet(
                    this.boss.x + this.boss.width / 2 + (Math.random() - 0.5) * 100,
                    this.boss.y + this.boss.height / 2 + (Math.random() - 0.5) * 50,
                    8
                );
            }
        }, i * 300);
    }
    setTimeout(() => {
        if (this.boss) {
            this.spawnScatterBullet(this.boss);
        }
    }, 400);
};

Game.poisonBossPattern3 = function(multiplier) {
    this.spawnWaveBullet(this.boss, this.boss.waveOffset);
    this.spawnWaveBullet(this.boss, this.boss.waveOffset + Math.PI/2);
    this.spawnWaveBullet(this.boss, this.boss.waveOffset + Math.PI);
    this.spawnWaveBullet(this.boss, this.boss.waveOffset + Math.PI * 1.5);

    setTimeout(() => {
        if (this.boss) {
            this.spawnScatterBullet(this.boss);
        }
    }, 400);
};
