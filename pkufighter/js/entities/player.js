import { Game } from '../core/game.js';
import { CONFIG } from '../core/config.js';

Game.updatePlayer = function(deltaTime) {
    if (this.keys['arrowleft'] || this.keys['a']) this.player.x -= this.player.speed;
    if (this.keys['arrowright'] || this.keys['d']) this.player.x += this.player.speed;
    if (this.keys['arrowup'] || this.keys['w']) this.player.y -= this.player.speed;
    if (this.keys['arrowdown'] || this.keys['s']) this.player.y += this.player.speed;

    this.player.x = Math.max(0, Math.min(this.width - this.player.width, this.player.x));
    this.player.y = Math.max(0, Math.min(this.height - this.player.height, this.player.y));

    if (this.gameTime - this.player.lastShot > this.getPlayerShotDelay()) {
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
    const count = this.getBulletCount();
    const color = this.isDamageBoost ? '#f90' : '#ff0';
    const gap = 6;
    // One shot id per trigger of fire: every bullet of the burst shares it, so
    // per-shot progress (heat-up, marks) counts the batch once no matter how
    // many bullets land. The middle bullet is the planned primary; actual
    // primary assignment waits until the pool allocation pass is complete.
    const shotId = ++this.nextShotId;
    const primaryIndex = Math.floor((count - 1) / 2);
    const spawned = [];

    for (let i = 0; i < count; i++) {
        const bullet = this.getObject('bullets');
        // A transient pool miss must not prevent later planned slots from
        // being attempted; the first actual bullet can become the primary.
        if (!bullet) continue;

        bullet.x = this.player.x + this.player.width / 2 - 2 + (i - (count - 1) / 2) * gap;
        bullet.y = this.player.y;
        bullet.width = 4;
        bullet.height = 12;
        bullet.speed = 8 * this.getBulletSpeedMult();
        bullet.color = color;
        // Per-shot identity + neutral effect fields: every pooled bullet is
        // fully re-initialized because getObject() deletes all keys on reuse.
        bullet.shotId = shotId;
        bullet.isPrimary = false;
        bullet.rapidBatchBoosted = false;
        bullet.rapidDamageBonus = 0;
        bullet.pierceRemaining = 0;
        bullet.supplyDamageBonus = 0;
        bullet.hitEntityIds = [];
        spawned.push({ bullet, index: i });
    }

    // No actual projectile means no rapid sequence consumption. This also
    // avoids manufacturing a primary/effect event for a fully exhausted pool.
    if (spawned.length === 0) return;

    const actualPrimary = spawned.find(({ index }) => index === primaryIndex)?.bullet
        || spawned[0].bullet;
    actualPrimary.isPrimary = true;

    // Rapid is consumed exactly once per actual batch, after allocation and
    // primary selection, and empowers only that actual primary. The supply
    // pulse bonus is a flat per-bullet bonus: every bullet of the batch gets
    // it, primary included.
    const rapidEffect = this.consumeRapidBatchEffect();
    const rapidBatchBoosted = Boolean(rapidEffect?.rapidBatchBoosted);
    const rapidDamageBonus = Number(rapidEffect?.rapidDamageBonus) || 0;
    const pierceRemaining = Number(rapidEffect?.pierceRemaining) || 0;
    const supplyDamageBonus = Number(this.getSupplyPulseDamageBonus?.()) || 0;

    for (const { bullet } of spawned) {
        bullet.rapidBatchBoosted = rapidBatchBoosted;
        bullet.supplyDamageBonus = supplyDamageBonus;
    }
    actualPrimary.rapidDamageBonus = rapidDamageBonus;
    actualPrimary.pierceRemaining = pierceRemaining;
};
