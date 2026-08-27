import { Game } from './game.js';

Game.render = function() {
    const ctx = this.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.width, this.height);

    // On the main menu, the canvas is just a clean backdrop — the DOM overlay
    // (title, stats box, buttons) provides the UI, so don't draw the game world.
    if (this.isMenu) {
        return;
    }

    if (this.player.shieldTime > 0) {
        ctx.strokeStyle = '#0af';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(
            this.player.x + this.player.width/2,
            this.player.y + this.player.height/2,
            Math.max(this.player.width, this.player.height)/2 + 3,
            0, Math.PI * 2
        );
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    }

    this.drawTrianglePlayer(this.player.x, this.player.y, this.player.width, this.player.height, this.player.color);

    const bulletPool = this.objectPools.bullets;
    for (const bullet of bulletPool.active) {
        this.drawPixelArt(bullet.x, bullet.y, bullet.width, bullet.height, bullet.color, 1);
    }

    const enemyBulletPool = this.objectPools.enemyBullets;
    for (const bullet of enemyBulletPool.active) {
        this.drawPixelArt(bullet.x, bullet.y, bullet.width, bullet.height, bullet.color, 1);
    }

    const enemyPool = this.objectPools.enemies;
    for (const enemy of enemyPool.active) {
        this.drawPixelArt(enemy.x, enemy.y, enemy.width, enemy.height, enemy.color, 2);

        if (enemy.maxHealth > 1) {
            const healthBarWidth = 20;
            const healthBarHeight = 3;
            const healthBarX = enemy.x + (enemy.width - healthBarWidth) / 2;
            const healthBarY = enemy.y - 5;

            ctx.fillStyle = '#333';
            ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);

            const healthPercent = enemy.health / enemy.maxHealth;
            ctx.fillStyle = enemy.health > 1 ? '#0f0' : '#f00';
            ctx.fillRect(healthBarX, healthBarY, healthBarWidth * healthPercent, healthBarHeight);
        }
    }

    const itemPool = this.objectPools.items;
    for (const item of itemPool.active) {
        this.drawItem(item.x, item.y, item.width, item.height, item.color, item.type);
    }

    if (this.boss) {
        this.drawBoss(this.boss.x, this.boss.y, this.boss.width, this.boss.height, this.boss.color);
    }

    const particlePool = this.objectPools.particles;
    for (const particle of particlePool.active) {
        const alpha = particle.life / 10;
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(particle.x, particle.y, 2, 2);
    }
    ctx.globalAlpha = 1.0;
};

Game.drawTrianglePlayer = function(x, y, width, height, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;

    const pixelSize = 2;
    const triangleHeight = height;
    const triangleWidth = width;

    for (let row = 0; row < triangleHeight; row += pixelSize) {
        const rowWidth = Math.floor((row / triangleHeight) * triangleWidth);
        const startX = x + (triangleWidth - rowWidth) / 2;

        for (let col = 0; col < rowWidth; col += pixelSize) {
            if ((row + col) % (pixelSize * 2) === 0) {
                ctx.fillRect(startX + col, y + row, pixelSize, pixelSize);
            }
        }
    }

    ctx.fillStyle = '#0c0';
    const wingSize = 4;
    ctx.fillRect(x, y + height - wingSize, wingSize, wingSize);
    ctx.fillRect(x + width - wingSize, y + height - wingSize, wingSize, wingSize);

    ctx.fillRect(x + width/2 - pixelSize, y, pixelSize * 2, pixelSize * 2);
};

Game.drawBoss = function(x, y, width, height, color) {
    const ctx = this.ctx;
    const centerX = x + width/2;
    const centerY = y + height/2;

    switch (this.boss.type) {
        case 0:
            this.drawFireBoss(x, y, width, height, color, centerX, centerY);
            break;
        case 1:
            this.drawIceBoss(x, y, width, height, color, centerX, centerY);
            break;
        case 2:
            this.drawPoisonBoss(x, y, width, height, color, centerX, centerY);
            break;
    }
};

Game.drawFireBoss = function(x, y, width, height, color, centerX, centerY) {
    const ctx = this.ctx;

    ctx.fillStyle = '#f00';
    for (let i = 0; i < height; i += 4) {
        for (let j = 0; j < width; j += 4) {
            if ((i + j) % 8 === 0) {
                ctx.fillRect(x + j, y + i, 4, 4);
            }
        }
    }

    ctx.fillStyle = '#f90';
    for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI * 2) / 4 + Math.sin(this.boss.waveOffset) * 0.2;
        const px = centerX + Math.cos(angle) * 25;
        const py = centerY + Math.sin(angle) * 25;
        ctx.fillRect(px - 4, py - 4, 8, 8);
    }

    ctx.fillStyle = '#ff0';
    ctx.fillRect(centerX - 8, centerY - 8, 16, 16);

    ctx.fillStyle = '#f00';
    for (let i = 0; i < 3; i++) {
        const flameY = y + height - 10 - i * 8;
        const flameWidth = 20 - i * 4;
        ctx.fillRect(centerX - flameWidth/2, flameY, flameWidth, 6);
    }
};

Game.drawIceBoss = function(x, y, width, height, color, centerX, centerY) {
    const ctx = this.ctx;

    ctx.fillStyle = '#00f';
    for (let i = 0; i < height; i += 4) {
        for (let j = 0; j < width; j += 4) {
            if ((i + j) % 8 === 0) {
                ctx.fillRect(x + j, y + i, 4, 4);
            }
        }
    }

    ctx.fillStyle = '#0af';
    for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI * 2) / 6 + this.boss.waveOffset * 0.5;
        const px = centerX + Math.cos(angle) * 30;
        const py = centerY + Math.sin(angle) * 30;
        ctx.fillRect(px - 3, py - 3, 6, 6);
    }

    ctx.fillStyle = '#aaf';
    ctx.fillRect(centerX - 10, centerY - 10, 20, 20);

    ctx.fillStyle = '#fff';
    ctx.fillRect(centerX - 5, centerY - 5, 10, 10);
};

Game.drawPoisonBoss = function(x, y, width, height, color, centerX, centerY) {
    const ctx = this.ctx;

    ctx.fillStyle = '#a0f';
    for (let i = 0; i < height; i += 4) {
        for (let j = 0; j < width; j += 4) {
            if ((i + j) % 8 === 0) {
                ctx.fillRect(x + j, y + i, 4, 4);
            }
        }
    }

    ctx.fillStyle = '#f0f';
    for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI * 2) / 8 + this.boss.movePhase;
        const px = centerX + Math.cos(angle) * 35;
        const py = centerY + Math.sin(angle) * 35;
        ctx.fillRect(px - 2, py - 2, 4, 4);
    }

    ctx.fillStyle = '#0f0';
    ctx.fillRect(centerX - 12, centerY - 12, 24, 24);

    ctx.fillStyle = '#f00';
    ctx.fillRect(centerX - 4, centerY - 4, 8, 8);
};

Game.drawPixelArt = function(x, y, width, height, color, pixelSize) {
    const ctx = this.ctx;
    ctx.fillStyle = color;

    for (let i = 0; i < height; i += pixelSize) {
        for (let j = 0; j < width; j += pixelSize) {
            if ((i + j) % (pixelSize * 2) === 0) {
                ctx.fillRect(x + j, y + i, pixelSize, pixelSize);
            }
        }
    }
};

Game.drawItem = function(x, y, width, height, color, type) {
    const ctx = this.ctx;
    ctx.fillStyle = color;

    const pixelSize = 2;

    for (let i = 0; i < height; i += pixelSize) {
        for (let j = 0; j < width; j += pixelSize) {
            if ((i + j) % (pixelSize * 2) === 0) {
                ctx.fillRect(x + j, y + i, pixelSize, pixelSize);
            }
        }
    }

    ctx.fillStyle = '#fff';
    if (type === 0) {
        ctx.fillRect(x + width/2 - pixelSize, y + height/2 - pixelSize, pixelSize * 2, pixelSize * 2);
    } else if (type === 1) {
        ctx.fillRect(x + 2, y + height/2 - 1, width - 4, 2);
        ctx.fillRect(x + width/2 - 1, y + 2, 2, height - 4);
    } else if (type === 2) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x + width/2, y + height/2, width/3, 0, Math.PI * 2);
        ctx.stroke();
    }
};
