import { Game } from './game.js';
import { CONFIG } from './config.js';

Game.updateAchievementsPanel = function() {
    document.getElementById('achievementsCrowns').textContent = this.totalCrowns;

    const thresholds = {
        autoShield: CONFIG.achievements.autoShieldCrowns,
        lives: CONFIG.achievements.startingLivesCrowns,
        bullets2: CONFIG.achievements.doubleBulletCrowns,
        firerate: CONFIG.achievements.fireRateCrowns,
        bullets3: CONFIG.achievements.tripleBulletCrowns,
    };

    for (const id in thresholds) {
        const row = document.querySelector(`[data-ach="${id}"]`);
        const status = document.getElementById(`achStatus-${id}`);
        if (!row || !status) continue;
        const unlocked = this.totalCrowns >= thresholds[id];
        if (unlocked) {
            row.classList.add('isUnlocked');
            status.textContent = '已解锁';
        } else {
            row.classList.remove('isUnlocked');
            status.textContent = `需要 ${thresholds[id]} 皇冠`;
        }
    }
};

Game.openAchievements = function() {
    this.updateAchievementsPanel();
    document.getElementById('achievementsPanel').style.display = 'block';
    document.getElementById('gameStartPanel').style.display = 'none';
};

Game.closeAchievements = function() {
    document.getElementById('achievementsPanel').style.display = 'none';
    document.getElementById('gameStartPanel').style.display = 'block';
    document.querySelector('.uiTitle').textContent = 'starfighter';
    document.getElementById('startButton').textContent = '开始游戏';
};
