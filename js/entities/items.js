import { Game } from '../core/game.js';

Game.spawnItems = function() {
    if (Math.random() < this.getItemSpawnRate()) {
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
        }
    }
};

Game.updateItems = function(deltaTime) {
    const pool = this.objectPools.items;
    for (let i = pool.active.length - 1; i >= 0; i--) {
        const item = pool.active[i];
        item.y += item.speed;

        if (item.y > this.height) {
            this.releaseObject('items', item);
        }
    }
};
