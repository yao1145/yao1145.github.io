import { CONFIG } from './config.js';

export const Game = {
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,
    isRunning: false,
    isGameOver: false,
    lastTime: 0,
    accumulator: 0,
    fixedStepMs: 1000 / CONFIG.fixedFrameRate,
    gameTime: 0,
    score: 0,
    highScore: 0,
    highCrowns: 0,
    lives: 3,
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

    bossHealthBar: null,
    bossHealthFill: null,
    bossHealthText: null,
    bossWarning: null,
    shieldIndicator: null,
    attackIndicator: null,

    bossAppearCount: 0,
    isTripleShot: false,
    tripleShotTime: 0,
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

        this.bossHealthBar = document.getElementById('bossHealthBar');
        this.bossHealthFill = document.getElementById('bossHealthFill');
        this.bossHealthText = document.getElementById('bossHealthText');
        this.bossWarning = document.getElementById('bossWarning');
        this.shieldIndicator = document.getElementById('shieldIndicator');
        this.attackIndicator = document.getElementById('attackIndicator');

        this.setupEventListeners();
        this.lastTime = performance.now();
        this.gameLoop();
    },

    resizeCanvas: function() {
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;

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
        this.score = 0;
        this.lives = 3;
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
        this.bossSpawnThreshold = 1000;
        this.itemSpawnRate = 0.001;
        this.isTripleShot = false;
        this.tripleShotTime = 0;

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

        document.getElementById('gameStartPanel').style.display = 'none';
        document.getElementById('gameOverPanel').style.display = 'none';

        this.enableControlArea(true);
        this.updateUI();
    },

    togglePause: function() {
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

    gameOver: function() {
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

        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalCrowns').textContent = this.crowns;
        document.getElementById('gameOverPanel').style.display = 'block';
        this.enableControlArea(false);
    },
};
