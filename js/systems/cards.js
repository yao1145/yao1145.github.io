import { Game } from '../core/game.js';
import { CONFIG } from '../core/config.js';

// Effect-card (效果卡) system: one card is picked at game start and re-picked
// after each boss, and card effects are applied via the get* helpers below.

Game.CARDS = {
    passion: { name: '激情岁月' },
    survival: { name: '生存之道' },
    comeback: { name: '绝地反击' },
    peace: { name: '平安无事' },
};

Game.setupCards = function() {
    this.cardPanel = document.getElementById('cardPanel');
    this.cardHint = document.getElementById('cardHint');
    this.cardIndicator = document.getElementById('cardIndicator');
    this.cardButtons = Array.from(document.querySelectorAll('.effectCard'));

    // Single delegated listener: clicks on any .effectCard bubble up to the panel.
    this.cardPanel.addEventListener('click', (event) => {
        const button = event.target.closest('.effectCard');
        if (button) {
            this.selectCard(button.dataset.card);
        }
    });
};

Game.openCardSelection = function(firstPick = false) {
    if (this.isGameOver) return;

    // Freeze the simulation exactly like togglePause: drain the accumulator and
    // reset the clock so the game resumes without a catch-up burst.
    this.isRunning = false;
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.enableControlArea(false);
    this.isCardSelectionOpen = true;

    this.updateCardHighlight();

    if (firstPick || !this.activeCard) {
        this.cardHint.textContent = '首次选择免费';
        this.cardHint.classList.remove('warn');
    } else {
        this.cardHint.textContent = '保持当前卡免费，更换需扣除1点生命';
        this.cardHint.classList.add('warn');
    }

    this.cardPanel.style.display = 'flex';
};

Game.selectCard = function(cardId) {
    if (!this.isCardSelectionOpen || !this.CARDS[cardId]) return;

    const isSwitch = this.activeCard !== null && cardId !== this.activeCard;
    if (isSwitch) {
        this.lives -= CONFIG.cards.switchCost;
        this.updateUI(true);
        if (this.lives <= 0) {
            this.cardPanel.style.display = 'none';
            this.isCardSelectionOpen = false;
            this.gameOver();
            return;
        }
    }

    this.activeCard = cardId;
    this.updateCardHighlight();
    this.cardIndicator.textContent = `效果卡: ${this.CARDS[cardId].name}`;
    this.cardIndicator.style.display = 'block';
    this.cardPanel.style.display = 'none';
    this.isCardSelectionOpen = false;

    this.isRunning = true;
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.enableControlArea(true);
};

Game.getBulletDamage = function() {
    let damage = this.bulletDamage;
    if (this.activeCard === 'survival') {
        damage *= CONFIG.cards.damageMult;
    }
    if (this.activeCard === 'comeback' && this.lives >= 1 && this.lives <= CONFIG.cards.comebackMaxLives) {
        damage *= CONFIG.cards.comebackMult;
    }
    return damage;
};

Game.getPlayerShotDelay = function() {
    let delay = this.player.shotDelay;
    if (this.activeCard === 'passion') {
        delay /= CONFIG.cards.speedMult;
    }
    if (this.activeCard === 'comeback' && this.lives >= 1 && this.lives <= CONFIG.cards.comebackMaxLives) {
        delay /= CONFIG.cards.comebackMult;
    }
    return delay;
};

Game.getEnemyShotRate = function() {
    return this.enemyShotRate * (this.activeCard === 'passion' ? CONFIG.cards.speedMult : 1);
};

Game.getBossShotDelay = function() {
    return this.boss.shotDelay / (this.activeCard === 'passion' ? CONFIG.cards.speedMult : 1);
};

Game.updateCardEffects = function(deltaTime) {
    if (this.activeCard !== 'survival') return;

    this.cardRegenTimer += deltaTime;
    if (this.cardRegenTimer >= CONFIG.cards.regenIntervalMs) {
        this.cardRegenTimer -= CONFIG.cards.regenIntervalMs;
        this.lives++;
        this.updateUI(true);
    }
};

Game.updateCardHighlight = function() {
    for (const button of this.cardButtons) {
        button.classList.toggle('cardActive', button.dataset.card === this.activeCard);
    }
};
