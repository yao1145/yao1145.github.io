export const CONFIG = {
    // Difficulty tuning (initial values; mutated at runtime as the level rises)
    enemySpawnRate: 0.02,
    enemySpeed: 2,
    enemyShotRate: 0.01,
    enemyBulletSpeed: 4,
    itemSpawnRate: 0.001,

    // Item spawn-rate curve (symmetric quadratic, applied in updateGameState):
    // rises quadratically from itemSpawnRate to `peak` at `peakLevel`, mirrors
    // back down to itemSpawnRate by `flatLevel`, then stays flat forever after.
    itemSpawnCurve: {
        peak: 0.005,      // peak: level-10 item density = 5x base
        peakLevel: 10,
        flatLevel: 20,
    },

    // Boss summoning (from the 4th boss on): during a boss fight the boss periodically
    // opens a summon window and spawns normal enemies at a fraction of the current
    // effective spawn rate. Timeline per fight: a grace period with no window,
    // then repeating window/rest cycles until the boss dies.
    bossSummon: {
        minBossAppearCount: 4,  // first boss that can summon
        graceMs: 10000,         // no-summon grace period after the boss spawns
        windowMs: 30000,        // summon window duration
        restMs: 30000,          // rest between windows
        rateFrac: 0.3,          // summon rate as a fraction of the current effective spawn rate
    },

    bossSpawnThreshold: 1000,
    // After each boss kill, the score GAP to the next boss grows by this much.
    // Gaps run 1000 → 1200 → 1400 ..., so bosses appear at 1000 → 2200 → 3600.
    bossSpawnThresholdIncrement: 200,

    // Every this many levels, ALL normal enemies gain +1 HP (levels 5/9/13 → +1/+2/+3).
    enemyHpLevelInterval: 4,

    // Difficulty presets. 'hard' keeps the authored tuning above untouched; 'easy'
    // uniformly slows the enemy side — plane/boss movement, ALL enemy-bullet speeds
    // and the spawn frequency — and lengthens firing intervals. Player-side stats
    // are never multiplied.
    difficulty: {
        easy: {
            slowMult: 0.7,          // enemy/boss movement and all enemy-bullet speeds x0.7
            spawnRateMult: 0.5,     // enemy spawn rate x0.5
            enemyFireRateMult: 0.5, // enemy fire rate x0.5
            bossShotDelayMult: 1.5, // boss shot delay x1.5
        },
    },

    // Consistent bullet spacing: a pattern's bullet count scales up with its bullet
    // speed so the gap between adjacent bullets stays roughly constant across levels.
    patternSpacingRef: 4,    // reference speed = level-1 enemyBulletSpeed, where count is "as authored"
    patternSpacingMax: 32,   // hard cap on bullets per volley (pool/perf safety)

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
        // Player max lives; the glass card temporarily overrides this with 1.
        maxLives: 20,
    },

    // Object pool capacities
    poolMaxSize: {
        bullets: 200,
        enemyBullets: 300,
        enemies: 50,
        particles: 100,
        items: 20,
    },

    // Fixed params for the 5 normal enemy types (index = enemy type 0-4).
    // Shared by spawning, hit-flash tinting (collisions.js) and sprite pre-baking (sprites.js).
    enemyTypes: [
        { color: '#f00', speedFactor: 1,   canShoot: false, health: 1, width: 30, height: 30 }, // 0 kamikaze
        { color: '#00f', speedFactor: 1.5, canShoot: true,  health: 1, width: 30, height: 30 }, // 1 fast shooter
        { color: '#a0f', speedFactor: 0.7, canShoot: true,  health: 2, width: 35, height: 35 }, // 2 heavy tank
        { color: '#ff0', speedFactor: 0.9, canShoot: true,  health: 1, width: 28, height: 28 }, // 3 tracker
        { color: '#0af', speedFactor: 0.8, canShoot: true,  health: 2, width: 32, height: 32 }, // 4 ring shooter
    ],

    // Boss archetypes (base stats; scaled up on repeat appearances)
    bossTypes: [
        { name: '火焰BOSS', color: '#f00', baseHealth: 100, baseSpeed: 1, baseShotDelay: 500 },
        { name: '冰霜BOSS', color: '#00f', baseHealth: 100, baseSpeed: 1.2, baseShotDelay: 450 },
        { name: '毒液BOSS', color: '#a0f', baseHealth: 100, baseSpeed: 0.8, baseShotDelay: 400 },
    ],

    // Effect-card system (one card picked at game start and re-picked after
    // each boss; switching cards mid-run costs switchCost lives).
    cards: {
        regenIntervalMs: 20000,   // survival: +1 life per interval of game time
        damageMult: 0.5,          // survival: player damage multiplier
        comebackMult: 2,          // comeback: damage/attack-speed multiplier
        comebackMaxLives: 2,      // comeback: active while lives <= this
        speedMult: 2,             // passion: attack-speed multiplier (shot delays divide by it)
        switchCost: 1,            // lives lost when changing to a different card
        bulletCountBonus: 1,      // blitz: extra bullets per shot
        bulletSpeedMult: 1.5,     // blitz: player bullet speed multiplier
        lifeStealEnemy: 0.12,     // bloodlust: chance per enemy kill to gain 1 life
        lifeStealBoss: 0.6,       // bloodlust: chance per boss kill to gain 1 life
        bloodlustDamageMult: 0.5, // bloodlust: player damage multiplier (tradeoff)
        chainRadius: 200,         // chain: explosion radius
        chainDamage: 0.5,         // chain: splash damage to nearby enemies
        chainSpawnMult: 1.3,      // chain: enemy spawn-rate multiplier
        glassDamageMult: 2,       // glass: player damage multiplier
        glassShotSpeedMult: 1.5,  // glass: shot-speed multiplier (divides shot delay)
        bossDamageMult: 3,        // boss card: damage vs the Boss entity
        mobDamageMult: 0.5,       // boss card: damage vs normal enemies
        thornsRadius: 200,        // thorns: all enemies within this radius of the player die per hit
        thornsBossFrac: 0.1,      // thorns: Boss loses maxHealth*this on each player hit
        thornsBulletSpeedMult: 2, // thorns: enemy-bullet speed multiplier
        // supply card
        supplyItemMult: 1.5,          // item spawn-rate multiplier
        supplyEnemyShotMult: 1.5,     // enemy shot-rate multiplier
        // fog card: tuning is inline in render/enemyBullets; no numeric mult needed here.
        // boost card
        boostHeartHeal: 2,            // red heart grants this many lives instead of 1
        boostDamageTime: 15,          // damage-boost item duration (was 10)
        boostShieldTime: 10,          // shield-ring item shield seconds (was 5)
        boostHitLoss: 2,              // lives lost per enemy-bullet hit (was 1)
        // Each card can be equipped at most this many times per run; afterwards it stops being offered.
        cardMaxPicks: 3,
    },

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
