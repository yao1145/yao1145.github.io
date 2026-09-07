import { Game } from '../../js/core/game.js';
import { CONFIG } from '../../js/core/config.js';
import '../../js/core/pools.js';

export function resetGameFixture() {
    Game.clearAllPools();
    Game.isRunning = false;
    Game.isGameOver = false;
    Game.isMenu = true;
    Game.lastTime = 0;
    Game.accumulator = 0;
    Game.gameTime = 0;
    Game.score = 0;
    Game.highScore = 0;
    Game.highCrowns = 0;
    Game.lastScore = 0;
    Game.totalCrowns = 0;
    Game.level = 1;
    Game.lives = 3;
    Game.baseBulletCount = 1;
    Game.autoShieldTimer = 0;
    Game.bulletDamage = 1;
    Game.crowns = 0;
    Game.enemySpawnRate = CONFIG.enemySpawnRate;
    Game.enemySpeed = CONFIG.enemySpeed;
    Game.enemyShotRate = CONFIG.enemyShotRate;
    Game.enemyBulletSpeed = CONFIG.enemyBulletSpeed;
    Game.itemSpawnRate = CONFIG.itemSpawnRate;
    Game.player = null;
    Game.keys = {};
    Game.touch = {
        isTouching: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
    };
    Game.isBossStage = false;
    Game.boss = null;
    Game.bossSpawnThreshold = CONFIG.bossSpawnThreshold;
    Game.bossSpawnGap = CONFIG.bossSpawnThreshold;
    Game.bossAppearCount = 0;
    Game.isDamageBoost = false;
    Game.damageBoostTime = 0;
    Game.activeCard = null;
    Game.cardPickCount = {};
    Game.difficulty = 'hard';
    Game.cardRegenTimer = 0;
    Game.isCardSelectionOpen = false;
    Game.cardSelectionModel = null;
    Game.lastUIUpdateTime = 0;
    Game.directHitQueue = [];
    return Game;
}
