import { Game } from './game.js';
import { CONFIG } from './config.js';

Game.objectPools = {
    bullets: { pool: [], active: [], maxSize: CONFIG.poolMaxSize.bullets },
    enemyBullets: { pool: [], active: [], maxSize: CONFIG.poolMaxSize.enemyBullets },
    enemies: { pool: [], active: [], maxSize: CONFIG.poolMaxSize.enemies },
    particles: { pool: [], active: [], maxSize: CONFIG.poolMaxSize.particles },
    items: { pool: [], active: [], maxSize: CONFIG.poolMaxSize.items }
};

Game.getObject = function(poolType) {
    const pool = this.objectPools[poolType];
    if (pool.pool.length > 0) {
        const obj = pool.pool.pop();
        for (const key in obj) {
            delete obj[key];
        }
        pool.active.push(obj);
        return obj;
    }
    if (pool.active.length < pool.maxSize) {
        const newObj = {};
        pool.active.push(newObj);
        return newObj;
    }
    return null;
};

Game.releaseObject = function(poolType, obj) {
    const pool = this.objectPools[poolType];
    const index = pool.active.indexOf(obj);
    if (index > -1) {
        pool.active.splice(index, 1);
        pool.pool.push(obj);
    }
};

Game.clearAllPools = function() {
    for (const poolType in this.objectPools) {
        const pool = this.objectPools[poolType];
        pool.active = [];
    }
};
