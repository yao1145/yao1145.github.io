import { Game } from '../core/game.js';

Game.updateBullets = function() {
    const pool = this.objectPools.bullets;
    for (let i = pool.active.length - 1; i >= 0; i--) {
        const bullet = pool.active[i];
        bullet.y -= bullet.speed;

        if (bullet.y + bullet.height < 0) {
            this.releaseObject('bullets', bullet);
        }
    }
};
