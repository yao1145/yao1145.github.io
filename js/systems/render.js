import { Game } from '../core/game.js';

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

    this.drawPlayerSprite();

    const bulletPool = this.objectPools.bullets;
    for (const bullet of bulletPool.active) {
        this.drawBulletSprite(bullet);
    }

    const enemyBulletPool = this.objectPools.enemyBullets;
    for (const bullet of enemyBulletPool.active) {
        this.drawEnemyBulletSprite(bullet);
    }

    const enemyPool = this.objectPools.enemies;
    for (const enemy of enemyPool.active) {
        this.drawEnemySprite(enemy);

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
        this.drawItemSprite(item);
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
    const cx = x + width / 2;
    const engineOffset = 7;

    // Engine exhaust flames (drawn first so the pods sit on top of their roots).
    const flameY = y + height + 5;
    ctx.fillStyle = '#f40';
    ctx.fillRect(cx - engineOffset - 3, flameY, 6, 7);
    ctx.fillRect(cx + engineOffset - 3, flameY, 6, 7);
    ctx.fillStyle = '#ff0';
    ctx.fillRect(cx - engineOffset - 2, flameY, 4, 5);
    ctx.fillRect(cx + engineOffset - 2, flameY, 4, 5);

    // Engine pods (red bodies, yellow cores) at the rear.
    const engineY = y + height;
    ctx.fillStyle = '#f00';
    ctx.fillRect(cx - engineOffset - 3, engineY, 6, 6);
    ctx.fillRect(cx + engineOffset - 3, engineY, 6, 6);
    ctx.fillStyle = '#ff0';
    ctx.fillRect(cx - engineOffset - 2, engineY + 1, 4, 4);
    ctx.fillRect(cx + engineOffset - 2, engineY + 1, 4, 4);

    // Main delta-body silhouette (nose up).
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, y);                     // nose
    ctx.lineTo(x + width, y + height);     // back-right
    ctx.lineTo(x, y + height);             // back-left
    ctx.closePath();
    ctx.fill();

    // Darker inner fuselage panel.
    ctx.fillStyle = '#088';
    ctx.beginPath();
    ctx.moveTo(cx, y + height * 0.18);
    ctx.lineTo(cx + width * 0.34, y + height);
    ctx.lineTo(cx - width * 0.34, y + height);
    ctx.closePath();
    ctx.fill();

    // Side cannon barrels along the leading edges.
    ctx.fillStyle = '#f90';
    ctx.fillRect(x + width * 0.18, y + height * 0.55, 2, height * 0.3);
    ctx.fillRect(x + width * 0.82 - 2, y + height * 0.55, 2, height * 0.3);

    // Nose highlight stripe.
    ctx.fillStyle = '#8f8';
    ctx.beginPath();
    ctx.moveTo(cx, y + 2);
    ctx.lineTo(cx - 3, y + height * 0.42);
    ctx.lineTo(cx + 3, y + height * 0.42);
    ctx.closePath();
    ctx.fill();

    // Cockpit canopy.
    ctx.fillStyle = '#0af';
    ctx.beginPath();
    ctx.ellipse(cx, y + height * 0.3, 3, height * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#cff';
    ctx.beginPath();
    ctx.ellipse(cx, y + height * 0.28, 1.5, height * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
};

Game.drawTriangleEnemy = function(x, y, width, height, color) {
    const ctx = this.ctx;
    const cx = x + width/2;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, y + height);   // pointed end (nose) faces down toward the player
    ctx.lineTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(cx, y + height - 6);
    ctx.lineTo(cx - 3, y + 6);
    ctx.lineTo(cx + 3, y + 6);
    ctx.closePath();
    ctx.fill();
};

Game.drawPlaneEnemy = function(x, y, width, height, color) {
    const ctx = this.ctx;
    const cx = x + width/2;

    // Body: nose points down, one wing tip up-left, one up-right.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, y + height);   // nose (down)
    ctx.lineTo(x, y);             // left wing tip (up)
    ctx.lineTo(x + width, y);     // right wing tip (up)
    ctx.closePath();
    ctx.fill();

    // Center fold ridge from nose to the top.
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, y + height);
    ctx.lineTo(cx, y);
    ctx.stroke();

    // One folded wing shaded lighter for the paper-plane look.
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(cx, y + height);
    ctx.lineTo(x, y);
    ctx.lineTo(cx, y);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1.0;
};

Game.drawCircleEnemy = function(x, y, width, height, color) {
    const ctx = this.ctx;
    const cx = x + width/2;
    const cy = y + height/2;
    const r = Math.min(width, height)/2 - 1;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
};

Game.drawDiamondEnemy = function(x, y, width, height, color) {
    const ctx = this.ctx;
    const cx = x + width/2;
    const cy = y + height/2;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, y);              // top
    ctx.lineTo(x + width, cy);      // right
    ctx.lineTo(cx, y + height);     // bottom
    ctx.lineTo(x, cy);              // left
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx + 4, cy);
    ctx.lineTo(cx, cy + 4);
    ctx.lineTo(cx - 4, cy);
    ctx.closePath();
    ctx.fill();
};

Game.drawHexagonEnemy = function(x, y, width, height, color) {
    const ctx = this.ctx;
    const cx = x + width/2;
    const cy = y + height/2;
    const r = Math.min(width, height)/2;

    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
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
    const r = Math.min(width, height) / 2;
    const flicker = Math.sin(this.boss.waveOffset * 2);

    // Rotating flame spikes that flicker outward.
    ctx.fillStyle = '#f60';
    for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI * 2) / 10 + this.boss.waveOffset * 0.6;
        const spikeLen = r + 6 + flicker * 2;
        const px = centerX + Math.cos(angle) * spikeLen;
        const py = centerY + Math.sin(angle) * spikeLen;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(4, 3);
        ctx.lineTo(-4, 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    // Body — the school badge, with the flame corona still orbiting outside it.
    const fireBadge = this.getBossBadgeSprite(this.boss.type, r * 2);
    if (fireBadge) {
        ctx.drawImage(fireBadge, centerX - r, centerY - r, r * 2, r * 2);
        return;
    }

    // Body — layered flame.
    ctx.fillStyle = '#d30';
    ctx.beginPath();
    ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f80';
    ctx.beginPath();
    ctx.arc(centerX, centerY, r * 0.72, 0, Math.PI * 2);
    ctx.fill();

    // Molten core (bobs with the flicker).
    ctx.fillStyle = '#ff0';
    ctx.beginPath();
    ctx.arc(centerX, centerY - flicker * 2, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(centerX, centerY - flicker * 2, r * 0.18, 0, Math.PI * 2);
    ctx.fill();

};

Game.drawIceBoss = function(x, y, width, height, color, centerX, centerY) {
    const ctx = this.ctx;
    const r = Math.min(width, height) / 2;

    // Drifting crystal shards around the body.
    ctx.fillStyle = '#0cf';
    for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI * 2) / 6 + this.boss.waveOffset * 0.5;
        const px = centerX + Math.cos(angle) * (r + 6);
        const py = centerY + Math.sin(angle) * (r + 6);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle + Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(4, 3);
        ctx.lineTo(-4, 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    // Body — the school badge, with the crystal shards still orbiting outside it.
    const iceBadge = this.getBossBadgeSprite(this.boss.type, r * 2);
    if (iceBadge) {
        ctx.drawImage(iceBadge, centerX - r, centerY - r, r * 2, r * 2);
        return;
    }

    // Icy body — layered bluish facets.
    ctx.fillStyle = '#08f';
    ctx.beginPath();
    ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0cf';
    ctx.beginPath();
    ctx.arc(centerX, centerY, r * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Frozen core.
    ctx.fillStyle = '#eef';
    ctx.beginPath();
    ctx.arc(centerX, centerY, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(centerX, centerY, r * 0.2, 0, Math.PI * 2);
    ctx.fill();

};

Game.drawPoisonBoss = function(x, y, width, height, color, centerX, centerY) {
    const ctx = this.ctx;
    const r = Math.min(width, height) / 2;
    const drift = this.boss.movePhase;

    // Toxic bubbles drifting up around the body.
    ctx.fillStyle = '#c0f';
    for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI * 2) / 8 + drift;
        const px = centerX + Math.cos(angle) * (r + 6);
        const py = centerY + Math.sin(angle) * (r + 6);
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e0f';
        ctx.beginPath();
        ctx.arc(px - 1, py - 1, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c0f';
    }

    // Body — the school badge, with the toxic bubbles still drifting outside it.
    const poisonBadge = this.getBossBadgeSprite(this.boss.type, r * 2);
    if (poisonBadge) {
        ctx.drawImage(poisonBadge, centerX - r, centerY - r, r * 2, r * 2);
        return;
    }

    // Oozing toxic body.
    ctx.fillStyle = '#70a';
    ctx.beginPath();
    ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a0f';
    ctx.beginPath();
    ctx.arc(centerX, centerY, r * 0.72, 0, Math.PI * 2);
    ctx.fill();

    // Slime core (pulsing).
    ctx.fillStyle = '#6f0';
    ctx.beginPath();
    ctx.arc(centerX, centerY, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f0';
    ctx.beginPath();
    ctx.arc(centerX, centerY, r * 0.2, 0, Math.PI * 2);
    ctx.fill();

};

Game.drawItem = function(x, y, width, height, color, type) {
    const ctx = this.ctx;
    const cx = x + width / 2;
    const cy = y + height / 2;

    // Solid badge body (no checkered gaps).
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);

    ctx.fillStyle = '#fff';
    if (type === 0) {
        // Medic cross (plus) — health pickup.
        const arm = 6;
        ctx.fillRect(cx - arm, cy - 2, arm * 2, 4);
        ctx.fillRect(cx - 2, cy - arm, 4, arm * 2);
    } else if (type === 1) {
        // Dot — damage boost pickup.
        ctx.fillRect(cx - 2, cy - 2, 4, 4);
    } else if (type === 2) {
        // Ring — shield pickup.
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, width / 3, 0, Math.PI * 2);
        ctx.stroke();
    }
};
