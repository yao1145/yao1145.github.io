export const CONFIG = {
    // Difficulty tuning (initial values; mutated at runtime as the level rises)
    enemySpawnRate: 0.02,
    enemySpeed: 2,
    enemyShotRate: 0.01,
    enemyBulletSpeed: 4,
    itemSpawnRate: 0.001,
    bossSpawnThreshold: 1000,

    // UI
    uiUpdateInterval: 100,

    // Player base stats
    player: {
        width: 30,
        height: 30,
        speed: 7,
        shotDelay: 300,
        color: '#0f0',
    },

    // Object pool capacities
    poolMaxSize: {
        bullets: 200,
        enemyBullets: 300,
        enemies: 50,
        particles: 100,
        items: 20,
    },

    // Boss archetypes (base stats; scaled up on repeat appearances)
    bossTypes: [
        { name: '火焰BOSS', color: '#f00', baseHealth: 200, baseSpeed: 1, baseShotDelay: 500 },
        { name: '冰霜BOSS', color: '#00f', baseHealth: 200, baseSpeed: 1.2, baseShotDelay: 450 },
        { name: '毒液BOSS', color: '#a0f', baseHealth: 200, baseSpeed: 0.8, baseShotDelay: 400 },
    ],
};
