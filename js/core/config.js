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
        peak: 0.005,      // 峰值：第 10 级道具密度 = 5× 基准
        peakLevel: 10,
        flatLevel: 20,
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
            slowMult: 0.7,          // 敌机/Boss移动速度与全部敌弹速度 ×0.7（-30%）
            spawnRateMult: 0.5,     // 出敌机频率 ×0.5（-50%）
            enemyFireRateMult: 0.5, // 敌机发射子弹频率 ×0.5（-50%）
            bossShotDelayMult: 1.5, // Boss射击间隔 ×1.5（+50%）
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

    // Boss archetypes (base stats; scaled up on repeat appearances)
    bossTypes: [
        { name: '火焰BOSS', color: '#f00', baseHealth: 100, baseSpeed: 1, baseShotDelay: 500 },
        { name: '冰霜BOSS', color: '#00f', baseHealth: 100, baseSpeed: 1.2, baseShotDelay: 450 },
        { name: '毒液BOSS', color: '#a0f', baseHealth: 100, baseSpeed: 0.8, baseShotDelay: 400 },
    ],

    // Effect-card system (one card picked at game start and re-picked after
    // each boss; switching cards mid-run costs switchCost lives).
    cards: {
        regenIntervalMs: 20000,   // 生存之道: +1 life per interval of game time
        damageMult: 0.5,          // 生存之道: player damage multiplier
        comebackMult: 2,          // 绝地反击: damage/attack-speed multiplier
        comebackMaxLives: 2,      // 绝地反击: active while lives <= this
        speedMult: 2,             // 激情岁月: attack-speed multiplier (shot delays divide by it)
        switchCost: 1,            // lives lost when changing to a different card
        bulletCountBonus: 1,      // 电光石火: extra bullets per shot
        bulletSpeedMult: 1.5,     // 电光石火: player bullet speed multiplier
        lifeStealEnemy: 0.12,     // 血之渴望: chance per enemy kill to gain 1 life
        lifeStealBoss: 0.6,       // 血之渴望: chance per boss kill to gain 1 life
        bloodlustDamageMult: 0.5, // 血之渴望: player damage multiplier (tradeoff)
        chainRadius: 200,         // 连环爆炸: explosion radius
        chainDamage: 0.5,         // 连环爆炸: splash damage to nearby enemies
        chainSpawnMult: 1.3,      // 连环爆炸: enemy spawn-rate multiplier
        glassDamageMult: 2,       // 玻璃大炮: player damage multiplier
        glassShotSpeedMult: 1.5,  // 玻璃大炮: shot-speed multiplier (divides shot delay)
        bossDamageMult: 3,        // Boss猎手: damage vs the Boss entity
        mobDamageMult: 0.5,       // Boss猎手: damage vs normal enemies
        thornsRadius: 200,        // 荆棘护甲: all enemies within this radius of the player die per hit
        thornsBossFrac: 0.1,      // 荆棘护甲: Boss loses maxHealth*this on each player hit
        thornsBulletSpeedMult: 2, // 荆棘护甲: enemy-bullet speed multiplier
        // 粮草先行
        supplyItemMult: 1.5,          // item spawn-rate multiplier
        supplyEnemyShotMult: 1.5,     // enemy shot-rate multiplier
        // 战争迷雾 (fog): tuning is inline in render/enemyBullets; no numeric mult needed here.
        // 增益加强
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
