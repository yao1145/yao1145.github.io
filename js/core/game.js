import { CONFIG } from './config.js';

export const Game = {
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,
    isRunning: false,
    isGameOver: false,
    isMenu: true,
    lastTime: 0,
    accumulator: 0,
    fixedStepMs: 1000 / CONFIG.fixedFrameRate,
    gameTime: 0,
    score: 0,
    highScore: 0,
    highCrowns: 0,
    lastScore: 0,
    totalCrowns: 0,
    lives: 3,
    // Max-life cap (glass card caps lives at 1; Infinity = no cap).
    maxLives: Infinity,
    baseBulletCount: 1,
    autoShieldTimer: 0,
    bulletDamage: 1,
    level: 1,
    crowns: 0,

    enemySpawnRate: CONFIG.enemySpawnRate,
    enemySpeed: CONFIG.enemySpeed,
    enemyShotRate: CONFIG.enemyShotRate,
    enemyBulletSpeed: CONFIG.enemyBulletSpeed,
    itemSpawnRate: CONFIG.itemSpawnRate,

    player: null,
    keys: {},
    touch: {
        isTouching: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0
    },

    isBossStage: false,
    boss: null,
    bossSpawnThreshold: CONFIG.bossSpawnThreshold,
    // Score gap to the next boss after each kill. Starts equal to the first
    // threshold and grows by CONFIG.bossSpawnThresholdIncrement per kill, so
    // bosses appear at 1000 → 2200 → 3600 … (gaps 1000, 1200, 1400 …).
    bossSpawnGap: CONFIG.bossSpawnThreshold,

    bossHealthBar: null,
    bossHealthFill: null,
    bossHealthText: null,
    bossWarning: null,
    shieldIndicator: null,
    attackIndicator: null,

    bossAppearCount: 0,
    isDamageBoost: false,
    damageBoostTime: 0,
    // Effect card (see js/systems/cards.js): null until picked.
    activeCard: null,
    cardRegenTimer: 0,
    isCardSelectionOpen: false,
    lastUIUpdateTime: 0,
    uiUpdateInterval: CONFIG.uiUpdateInterval,

    init: function() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();

        this.player = {
            x: this.width / 2 - 15,
            y: this.height - 100,
            width: CONFIG.player.width,
            height: CONFIG.player.height,
            speed: CONFIG.player.speed,
            color: CONFIG.player.color,
            lastShot: 0,
            shotDelay: CONFIG.player.shotDelay,
            shieldTime: 0
        };

        this.highScore = localStorage.getItem('planeGameHighScore') || 0;
        this.highCrowns = localStorage.getItem('planeGameHighCrowns') || 0;
        this.lastScore = Number(localStorage.getItem('planeGameLastScore') || 0);
        this.totalCrowns = Number(localStorage.getItem('planeGameTotalCrowns') || 0);

        // Test mode: ?crowns=N overrides the crown count for this load without
        // writing to stored progress, so achievements/bonuses can be verified fast.
        const testCrowns = new URLSearchParams(location.search).get('crowns');
        if (testCrowns !== null) {
            this.totalCrowns = Number(testCrowns) || 0;
        }

        this.updateMainPanel();
        document.getElementById('hudStats').style.display = 'none';

        this.bossHealthBar = document.getElementById('bossHealthBar');
        this.bossHealthFill = document.getElementById('bossHealthFill');
        this.bossHealthText = document.getElementById('bossHealthText');
        this.bossWarning = document.getElementById('bossWarning');
        this.shieldIndicator = document.getElementById('shieldIndicator');
        this.attackIndicator = document.getElementById('attackIndicator');

        this.setupEventListeners();
        this.setupCards();
        this.loadBadges();
        this.lastTime = performance.now();
        this.gameLoop();
    },

    resizeCanvas: function() {
        // Render at device resolution (capped at 2x for perf) while keeping the
        // game logic in CSS pixels: the backing store is scaled by dpr, the
        // context transform converts logical -> device coords, and the CSS size
        // pins the canvas layout to the logical viewport.
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.dpr = dpr;
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = Math.round(this.width * dpr);
        this.canvas.height = Math.round(this.height * dpr);
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.ctx.imageSmoothingQuality = 'high';

        // Cached sprites were baked for the previous resolution — re-bake lazily.
        this.spriteCache.enemies = {};
        this.spriteCache.bullets = {};
        this.spriteCache.items = {};
        this.spriteCache.player = null;
        this.bossBadgeSprites = {};
        this.menuEmblemCanvas = null;

        if (this.player) {
            this.player.x = Math.min(this.player.x, this.width - this.player.width);
            this.player.y = Math.min(this.player.y, this.height - this.player.height);
        }
    },

    gameLoop: function(currentTime) {
        const frameTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        if (this.isRunning && !this.isGameOver) {
            this.accumulator += frameTime;

            // Clamp to avoid a huge catch-up burst after a long tab switch or stall.
            if (this.accumulator > 250) {
                this.accumulator = 250;
            }

            // Advance the simulation in fixed timesteps, decoupled from the display's
            // refresh rate. Movement, timers and spawning all run at a constant 60
            // ticks/sec on every device, keeping gameplay speed deterministic.
            while (this.accumulator >= this.fixedStepMs) {
                this.gameTime += this.fixedStepMs;
                this.update(this.fixedStepMs);
                this.accumulator -= this.fixedStepMs;
            }
        } else {
            this.accumulator = 0;
        }

        this.render();
        requestAnimationFrame((time) => this.gameLoop(time));
    },

    update: function(deltaTime) {
        this.updatePlayer(deltaTime);
        this.updateBullets();
        this.updateEnemyBullets();
        this.updateEnemies(deltaTime);
        this.updateParticles();
        this.updateItems(deltaTime);
        this.updateCardEffects(deltaTime);

        this.spawnEnemies();
        this.enemiesShoot();
        this.spawnItems();

        if (this.isBossStage) {
            this.updateBoss();
            this.bossShoot();
        }

        this.checkCollisions();
        this.updateGameState();
    },

    startGame: function() {
        this.isRunning = true;
        this.isGameOver = false;
        this.isMenu = false;
        this.score = 0;

        // Apply crown-threshold achievement bonuses to this run's starting stats.
        const ach = CONFIG.achievements;
        this.lives = this.totalCrowns >= ach.startingLivesCrowns ? ach.startingLives : 3;
        this.player.shotDelay = this.totalCrowns >= ach.fireRateCrowns ? ach.fireRateShotDelayMs : CONFIG.player.shotDelay;
        this.baseBulletCount = this.totalCrowns >= ach.tripleBulletCrowns ? 3
            : this.totalCrowns >= ach.doubleBulletCrowns ? 2 : 1;
        this.bulletDamage = 1;
        this.autoShieldTimer = this.totalCrowns >= ach.autoShieldCrowns ? ach.autoShieldIntervalMs : 0;
        // 新一局不继承上一局玻璃卡的生命上限 / fresh run never inherits a stale glass cap.
        this.maxLives = Infinity;

        this.level = 1;
        this.crowns = 0;
        this.enemySpawnRate = 0.02;
        this.enemySpeed = 2;
        this.enemyShotRate = 0.01;
        this.enemyBulletSpeed = 4;
        this.gameTime = 0;
        this.isBossStage = false;
        this.boss = null;
        this.bossAppearCount = 0;
        this.bossSpawnThreshold = CONFIG.bossSpawnThreshold;
        this.bossSpawnGap = CONFIG.bossSpawnThreshold;
        this.itemSpawnRate = 0.001;
        this.isDamageBoost = false;
        this.damageBoostTime = 0;
        this.activeCard = null;
        this.cardRegenTimer = 0;
        this.cardIndicator.style.display = 'none';

        this.player.x = this.width / 2 - 15;
        this.player.y = this.height - 100;
        this.player.lastShot = 0;
        this.player.color = '#0f0';
        this.player.shieldTime = 0;

        this.clearAllPools();

        this.accumulator = 0;
        this.lastTime = performance.now();

        this.bossHealthBar.style.display = 'none';
        this.bossWarning.style.display = 'none';
        this.shieldIndicator.style.display = 'none';
        this.attackIndicator.style.display = 'none';
        document.getElementById('hudStats').style.display = 'block';

        document.getElementById('gameStartPanel').style.display = 'none';
        document.getElementById('gameOverPanel').style.display = 'none';

        this.enableControlArea(true);
        this.updateUI();

        // Pause and let the player pick an effect card before the run begins.
        this.openCardSelection(true);
    },

    togglePause: function() {
        if (this.isCardSelectionOpen) return; // card picking owns the pause state
        this.isRunning = !this.isRunning;

        if (this.isRunning) {
            document.getElementById('gameStartPanel').style.display = 'none';
            this.lastTime = performance.now();
            this.accumulator = 0;
            this.enableControlArea(true);
        } else {
            document.getElementById('gameStartPanel').style.display = 'block';
            document.querySelector('.uiTitle').textContent = '游戏暂停';
            document.getElementById('startButton').textContent = '继续游戏';
            this.enableControlArea(false);
        }
    },

    updateGameState: function() {
        if (!this.isBossStage && this.score >= this.bossSpawnThreshold) {
            this.spawnBoss();
        }

        const newLevel = Math.floor(this.score / 500) + 1;
        if (newLevel > this.level) {
            this.level = newLevel;
            this.enemySpawnRate = 0.02 + (this.level - 1) * 0.005;
            this.enemySpeed = 2 + (this.level - 1) * 0.15;
            this.enemyShotRate = 0.01 + (this.level - 1) * 0.0005;
            this.enemyBulletSpeed = 4 + (this.level - 1) * 0.25;
            this.itemSpawnRate = 0.001 + (this.level - 1) * 0.00025;
        }
        this.updateUI();
    },

    updateUI: function(force = false) {
        const currentTime = performance.now();
        if (!force && currentTime - this.lastUIUpdateTime < this.uiUpdateInterval) {
            return;
        }
        this.lastUIUpdateTime = currentTime;

        document.getElementById('score').textContent = this.score;
        document.getElementById('lives').textContent = this.lives;
        document.getElementById('level').textContent = this.level;
        document.getElementById('crowns').textContent = this.crowns;
    },

    updateMainPanel: function() {
        document.getElementById('lastScoreValue').textContent = this.lastScore;
        document.getElementById('highScoreValue').textContent = this.highScore;
        document.getElementById('totalCrownsValue').textContent = this.totalCrowns;
    },

    gameOver: function() {
        this.isCardSelectionOpen = false;
        document.getElementById('cardPanel').style.display = 'none';
        this.cardIndicator.style.display = 'none';
        this.isRunning = false;
        this.isGameOver = true;

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('planeGameHighScore', this.highScore);
        }

        if (this.crowns > this.highCrowns) {
            this.highCrowns = this.crowns;
            localStorage.setItem('planeGameHighCrowns', this.highCrowns);
        }

        this.lastScore = this.score;
        localStorage.setItem('planeGameLastScore', this.lastScore);

        this.totalCrowns += this.crowns;
        localStorage.setItem('planeGameTotalCrowns', this.totalCrowns);

        this.updateMainPanel();

        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalCrowns').textContent = this.crowns;
        document.getElementById('gameOverPanel').style.display = 'block';
        this.enableControlArea(false);
    },

    returnToMainMenu: function() {
        this.isRunning = false;
        this.isGameOver = false;
        this.isMenu = true;

        document.getElementById('gameOverPanel').style.display = 'none';
        document.getElementById('gameStartPanel').style.display = 'block';
        document.getElementById('hudStats').style.display = 'none';
        document.getElementById('cardPanel').style.display = 'none';
        this.cardIndicator.style.display = 'none';
        this.activeCard = null;
        // 回到主菜单同样清除玻璃卡的生命上限 / drop the glass cap on the way back to the menu.
        this.maxLives = Infinity;
        this.isCardSelectionOpen = false;

        // Reset the start panel to its default idle look (in case it was in pause state).
        document.querySelector('.uiTitle').textContent = 'PKUfighter';
        document.getElementById('startButton').textContent = '开始游戏';

        // Hide in-game HUD elements and clear leftover entities so the menu is clean.
        this.bossHealthBar.style.display = 'none';
        this.bossWarning.style.display = 'none';
        this.shieldIndicator.style.display = 'none';
        this.attackIndicator.style.display = 'none';
        this.isBossStage = false;
        this.boss = null;
        this.clearAllPools();

        this.updateMainPanel();
        this.enableControlArea(false);
    },
};
