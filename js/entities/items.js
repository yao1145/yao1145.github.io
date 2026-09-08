import { Game } from '../core/game.js';
import { CONFIG } from '../core/config.js';

Game.spawnItems = function(rng = Math.random) {
    if (rng() < this.getItemSpawnRate()) {
        const type = Math.floor(Math.random() * 3);
        let color, width, height, speed;

        switch (type) {
            case 0:
                color = '#f00';
                break;
            case 1:
                color = '#f90';
                break;
            case 2:
                color = '#0af';
                break;
        }

        width = 20;
        height = 20;
        speed = 2;

        const item = this.getObject('items');
        if (item) {
            item.x = Math.random() * (this.width - width);
            item.y = -height;
            item.width = width;
            item.height = height;
            item.speed = speed;
            item.color = color;
            item.type = type;
            item.spin = Math.random() * Math.PI * 2;
            item.spawnSource = 'natural';
            item.attractionActive = false;
            item.collectedByMagnet = false;
        }
    }
};

Game.updateItems = function(deltaTime) {
    const pool = this.objectPools.items;
    for (let i = pool.active.length - 1; i >= 0; i--) {
        const item = pool.active[i];
        item.y += item.speed;
        item.attractionActive = false;

        if (this.hasBuild('supply_magnet')) {
            const cfg = CONFIG.builds.supply;
            const playerCenterX = this.player.x + this.player.width / 2;
            const playerCenterY = this.player.y + this.player.height / 2;
            const itemCenterX = item.x + item.width / 2;
            const itemCenterY = item.y + item.height / 2;
            const dx = playerCenterX - itemCenterX;
            const dy = playerCenterY - itemCenterY;
            const distance = Math.hypot(dx, dy);

            if (distance > 0 && distance <= cfg.magnetRadius) {
                const step = Math.min(cfg.magnetSpeed, distance);
                item.x += dx / distance * step;
                item.y += dy / distance * step;
                // Attraction remains continuous; collection still happens in
                // the normal collision pass.  Only a natural item that was
                // actually moved is attributed to the magnet pickup metric.
                if (step > 0) {
                    item.attractionActive = true;
                    if (item.spawnSource === 'natural') item.collectedByMagnet = true;
                }
            }
        }

        if (item.y > this.height) {
            this.releaseObject('items', item);
        }
    }
};

Game.collectItem = function(item) {
    if (!item || !this.objectPools.items.active.includes(item)) return false;

    const wasFull = this.lives >= this.getMaxLives();
    const healingAllowed = this.canHeal();
    this.createExplosion(item.x + item.width / 2, item.y + item.height / 2, item.color, 4);

    switch (item.type) {
        case 0:
            if (healingAllowed) {
                this.applyLifeGain(this.activeCard === 'boost' ? CONFIG.cards.boostHeartHeal : 1);
            } else {
                this.updateUI(true);
            }
            break;
        case 1:
            this.isDamageBoost = true;
            this.damageBoostTime = this.activeCard === 'boost' ? CONFIG.cards.boostDamageTime : 10;
            this.bulletDamage = 2;
            this.updateAttackUI(true);
            break;
        case 2:
            this.player.shieldTime = this.activeCard === 'boost' ? CONFIG.cards.boostShieldTime : 5;
            this.updateShieldUI(true);
            break;
    }

    const event = {
        type: item.type,
        spawnSource: item.spawnSource,
        wasFull,
        healingAllowed,
        collectedByMagnet: item.spawnSource === 'natural' && item.collectedByMagnet === true,
    };
    this.releaseObject('items', item);
    this.onItemCollected(event);
    return true;
};
