import { Game } from '../core/game.js';
import { CONFIG } from '../core/config.js';

// Effect-card system: one card is picked at game start and re-picked after
// each boss; card effects are applied via the get* helpers below.

Game.CARDS = {
    passion: { name: '激情岁月' },
    survival: { name: '生存之道' },
    comeback: { name: '绝地反击' },
    peace: { name: '平安无事' },
    blitz: { name: '电光石火' },
    bloodlust: { name: '血之渴望' },
    chain: { name: '连环爆炸' },
    glass: { name: '玻璃大炮' },
    boss: { name: 'Boss猎手' },
    thorns: { name: '荆棘护甲' },
    supply: { name: '粮草先行' },
    fog: { name: '战争迷雾' },
    boost: { name: '增益加强' },
};

// Short per-card face text, ~10 glyphs each so a 4-card selection stays
// compact. Only used to label the pickable faces.
Game.CARD_DESCS = {
    passion: '敌我攻速翻倍',
    survival: '伤减半·20s回1命',
    comeback: '低生命时攻速伤害×2',
    peace: '无效果',
    blitz: '多发提速·禁回命',
    bloodlust: '击杀回命·伤害减半',
    chain: '击毁即连锁爆炸',
    glass: '伤害×2·生命上限1',
    boss: 'Boss伤×3·小兵减半',
    thorns: '受击反杀·敌弹翻倍',
    supply: '道具更多·敌射+50%',
    fog: '迷雾掩护·追踪失准',
    boost: '道具强化·敌弹伤2',
};

// The pick panel always shows up to 4 cards: the currently equipped one is
// always included while still allowed (under this run's pick cap); the rest
// fill in randomly from the remaining allowed cards. With no equipped card at
// game start, up to 4 random cards show.
Game.rollCardOptions = function() {
    // Each card can be equipped cardMaxPicks times per run; past that it
    // leaves the candidate pool.
    const used = this.cardPickCount || {};
    const allowed = Object.keys(this.CARDS).filter(k => (used[k] || 0) < CONFIG.cards.cardMaxPicks);

    // Fisher–Yates shuffle of the remaining allowed cards.
    for (let i = allowed.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = allowed[i];
        allowed[i] = allowed[j];
        allowed[j] = tmp;
    }

    const chosen = [];
    // Keep the equipped card only while it is still allowed.
    const equippedIndex = this.activeCard ? allowed.indexOf(this.activeCard) : -1;
    if (equippedIndex !== -1) {
        chosen.push(allowed[equippedIndex]);
        allowed.splice(equippedIndex, 1);
    }
    // Fill up to 4 from the remaining allowed cards; show fewer if short.
    const need = Math.min(4 - chosen.length, allowed.length);
    for (let i = 0; i < need; i++) chosen.push(allowed[i]);

    for (const button of this.cardButtons) {
        const id = button.dataset.card;
        const show = chosen.indexOf(id) !== -1;
        button.style.display = show ? '' : 'none';
        if (show) {
            const desc = button.querySelector('.cardDesc');
            if (desc) desc.textContent = this.CARD_DESCS[id] || '';
        }
    }
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

    // Re-roll the 4-card batch on every open.
    this.rollCardOptions();
    this.updateCardHighlight();

    if (firstPick || !this.activeCard) {
        this.cardHint.textContent = '首次选择免费';
        this.cardHint.classList.remove('warn');
    } else if (this.activeCard === 'glass') {
        // Glass switches in and out free — the hint must match the free rule.
        this.cardHint.textContent = '玻璃大炮：更换卡片免费';
        this.cardHint.classList.remove('warn');
    } else {
        this.cardHint.textContent = '保持当前卡免费，更换需扣除1点生命';
        this.cardHint.classList.add('warn');
    }

    this.cardPanel.style.display = 'flex';
};

Game.selectCard = function(cardId) {
    if (!this.isCardSelectionOpen || !this.CARDS[cardId]) return;

    const previousCard = this.activeCard;
    const isSwitch = previousCard !== null && cardId !== previousCard;
    // Glass locks the life cap to 1: switching in or out must be free,
    // otherwise leaving glass would cost the last life = instant death.
    const isGlassFreeSwitch = cardId === 'glass' || previousCard === 'glass';
    if (isSwitch && !isGlassFreeSwitch) {
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
    // Glass: lock maxLives=1 on entry, restore the default cap on exit.
    if (cardId === 'glass') {
        this.maxLives = 1;
        this.lives = 1;
    } else if (previousCard === 'glass') {
        this.maxLives = CONFIG.player.maxLives;
    }

    // Each card equips at most cardMaxPicks times per run; keeping the
    // current card also counts as a use.
    this.cardPickCount = this.cardPickCount || {};
    this.cardPickCount[cardId] = (this.cardPickCount[cardId] || 0) + 1;

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

// Damage rounding: player bullet damage is always a multiple of 0.5, min 0.5
// (enemy HP steps by 0.5).
Game.roundBulletDamage = function(d) {
    return Math.max(0.5, Math.round(d * 2) / 2);
};

// Bullet damage (no per-target split; see getDamageFor), rounded to 0.5.
Game.getBulletDamage = function() {
    let d = this.bulletDamage;
    if (this.activeCard === 'survival') {
        d *= CONFIG.cards.damageMult;
    }
    if (this.activeCard === 'comeback' && this.lives >= 1 && this.lives <= CONFIG.cards.comebackMaxLives) {
        d *= CONFIG.cards.comebackMult;
    }
    if (this.activeCard === 'glass') {
        d *= CONFIG.cards.glassDamageMult;
    }
    if (this.activeCard === 'bloodlust') {
        // Bloodlust: the damage halving is the price paid; lifesteal only compensates.
        d *= CONFIG.cards.bloodlustDamageMult;
    }
    return this.roundBulletDamage(d);
};

// Boss Hunter: per-target damage — high vs boss, low vs mobs.
Game.getDamageFor = function(target) {
    let d = this.getBulletDamage();
    if (this.activeCard === 'boss') {
        d *= target === 'boss' ? CONFIG.cards.bossDamageMult : CONFIG.cards.mobDamageMult;
    }
    return this.roundBulletDamage(d);
};

Game.getPlayerShotDelay = function() {
    let delay = this.player.shotDelay;
    if (this.activeCard === 'passion') {
        delay /= CONFIG.cards.speedMult;
    }
    if (this.activeCard === 'comeback' && this.lives >= 1 && this.lives <= CONFIG.cards.comebackMaxLives) {
        delay /= CONFIG.cards.comebackMult;
    }
    if (this.activeCard === 'glass') {
        delay /= CONFIG.cards.glassShotSpeedMult;
    }
    return delay;
};

Game.getEnemyShotRate = function() {
    let rate = this.enemyShotRate;
    if (this.activeCard === 'passion') rate *= CONFIG.cards.speedMult;
    if (this.activeCard === 'supply') rate *= CONFIG.cards.supplyEnemyShotMult;
    // Easy mode: enemy fire rate x0.5.
    if (this.difficulty === 'easy') rate *= CONFIG.difficulty.easy.enemyFireRateMult;
    return rate;
};

Game.getItemSpawnRate = function() {
    return this.itemSpawnRate * (this.activeCard === 'supply' ? CONFIG.cards.supplyItemMult : 1);
};

Game.getBossShotDelay = function() {
    const delay = this.boss.shotDelay / (this.activeCard === 'passion' ? CONFIG.cards.speedMult : 1);
    // Easy mode: boss shot delay x1.5.
    return this.difficulty === 'easy' ? delay * CONFIG.difficulty.easy.bossShotDelayMult : delay;
};

// Blitz: extra bullets per shot, on top of baseBulletCount.
Game.getBulletCount = function() {
    return this.baseBulletCount + (this.activeCard === 'blitz' ? CONFIG.cards.bulletCountBonus : 0);
};

// Blitz: player bullet speed multiplier.
Game.getBulletSpeedMult = function() {
    return this.activeCard === 'blitz' ? CONFIG.cards.bulletSpeedMult : 1;
};

// Chain: enemy spawn-rate multiplier.
Game.getEnemySpawnRate = function() {
    let rate = this.enemySpawnRate * (this.activeCard === 'chain' ? CONFIG.cards.chainSpawnMult : 1);
    // Easy mode: spawn rate x0.7.
    if (this.difficulty === 'easy') rate *= CONFIG.difficulty.easy.spawnRateMult;
    return rate;
};

// Thorns: enemy bullet speed multiplier.
Game.getEnemyBulletSpeed = function() {
    let speed = this.enemyBulletSpeed * (this.activeCard === 'thorns' ? CONFIG.cards.thornsBulletSpeedMult : 1);
    // Easy mode: all enemy bullet speeds x0.7.
    if (this.difficulty === 'easy') speed *= CONFIG.difficulty.easy.slowMult;
    return speed;
};

// Easy mode: enemy/boss movement multiplier (everything but the player slowed).
Game.getEnemySpeedMult = function() {
    return this.difficulty === 'easy' ? CONFIG.difficulty.easy.slowMult : 1;
};

// Bloodlust: chance to regain a life on killing a normal enemy (the boss-side
// chance is lifeStealBoss, consumed by the collision layer).
Game.getLifeStealChance = function() {
    return this.activeCard === 'bloodlust' ? CONFIG.cards.lifeStealEnemy : 0;
};

// Blitz/glass: glass (1-life cap) and blitz (skill-oriented) cannot heal via effects.
Game.canHeal = function() {
    return !(this.activeCard === 'blitz' || this.activeCard === 'glass');
};

// Single life-gain entry point, capped by maxLives.
Game.applyLifeGain = function(n) {
    this.lives = Math.min(this.lives + n, this.maxLives);
    this.updateUI(true);
};

Game.updateCardEffects = function(deltaTime) {
    if (this.activeCard !== 'survival') return;

    this.cardRegenTimer += deltaTime;
    if (this.cardRegenTimer >= CONFIG.cards.regenIntervalMs) {
        this.cardRegenTimer -= CONFIG.cards.regenIntervalMs;
        // Survival: +1 life per interval via applyLifeGain (maxLives-capped).
        this.applyLifeGain(1);
    }
};

Game.updateCardHighlight = function() {
    for (const button of this.cardButtons) {
        button.classList.toggle('cardActive', button.dataset.card === this.activeCard);
    }
};
