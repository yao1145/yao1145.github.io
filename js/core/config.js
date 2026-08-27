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

    // Simulation tick rate. The logic loop runs at this constant rate regardless
    // of the display's refresh rate, keeping gameplay speed deterministic.
    fixedFrameRate: 60,

    // Dropped-item spin rate (radians per ms). Items rotate and gently pulse in
    // scale as they fall so they read as collectibles.
    itemSpinSpeed: 0.003,

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

    // Crown-threshold achievement bonuses, unlocked permanently once totalCrowns reaches these.
    achievements: {
        autoShieldCrowns: 10,
        autoShieldIntervalMs: 20000,
        autoShieldDuration: 5,
        startingLivesCrowns: 30,
        startingLives: 5,
        doubleBulletCrowns: 50,
        fireRateCrowns: 80,
        fireRateShotDelayMs: 200,
        tripleBulletCrowns: 100,
    },
};
