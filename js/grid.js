import { Game } from './game.js';

Game.spatialGrid = {
    cellSize: 100,
    grid: {},
    clear: function() {
        this.grid = {};
    },
    getKey: function(x, y) {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        return `${cellX},${cellY}`;
    },
    insert: function(obj, poolType) {
        const key = this.getKey(obj.x, obj.y);
        if (!this.grid[key]) {
            this.grid[key] = [];
        }
        this.grid[key].push({ obj: obj, poolType: poolType });
    },
    getNearby: function(obj) {
        const cellX = Math.floor(obj.x / this.cellSize);
        const cellY = Math.floor(obj.y / this.cellSize);
        const nearby = [];

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const key = `${cellX + dx},${cellY + dy}`;
                if (this.grid[key]) {
                    nearby.push(...this.grid[key]);
                }
            }
        }
        return nearby;
    }
};
