import { Game } from './game.js';

Game.spatialGrid = {
    cellSize: 100,
    grid: {},
    clear: function() {
        // Keep a separate cell map for every pool type.  Most collision
        // queries only need one type, so they can now avoid collecting and
        // filtering entries belonging to unrelated pools.
        this.grid = Object.create(null);
    },
    getKey: function(x, y) {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        return `${cellX},${cellY}`;
    },
    insert: function(obj, poolType) {
        const key = this.getKey(obj.x, obj.y);
        const type = poolType || '__untyped__';
        if (!this.grid[type]) {
            this.grid[type] = Object.create(null);
        }
        if (!this.grid[type][key]) {
            this.grid[type][key] = [];
        }
        this.grid[type][key].push({ obj: obj, poolType: poolType });
    },
    getNearby: function(obj, poolType) {
        return this.getCellsAround(
            Math.floor(obj.x / this.cellSize),
            Math.floor(obj.y / this.cellSize),
            1,
            poolType,
        );
    },
    getCellsAround: function(cellX, cellY, range, poolType) {
        const nearby = [];
        const typeGrids = poolType
            ? [this.grid[poolType]]
            : Object.values(this.grid);

        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                const key = `${cellX + dx},${cellY + dy}`;
                for (const typeGrid of typeGrids) {
                    if (typeGrid?.[key]) {
                        nearby.push(...typeGrid[key]);
                    }
                }
            }
        }
        return nearby;
    },
    // Enumerates the cells a circle of `radius` around (x, y) can touch, so
    // effects that exceed the fixed 3x3 neighborhood (chain blasts up to 200px)
    // can find every candidate; callers apply their own exact circle test.
    getWithinRadius: function(x, y, radius, poolType) {
        const range = Math.ceil(radius / this.cellSize);
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        return this.getCellsAround(cellX, cellY, range, poolType);
    }
};
