import { Game } from '../core/game.js';
import { CONFIG } from '../core/config.js';

// Effect-card (效果卡) system: one card is picked at game start and re-picked
// after each boss, and card effects are applied via the get* helpers below.

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

// Short per-card descriptions (卡面辅助文案), intentionally kept to ~10 glyphs
// so a 4-card selection stays compact. Only used to label the pickable faces.
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

// 选卡面板固定展示至多 4 张：若当前已装备的卡仍被允许（未达到本局 pick 上限）则必含其一，
// 其余位置从剩余允许的卡里随机补足。开局无已装备卡时展示至多 4 张随机卡。
Game.rollCardOptions = function() {
    // 每种卡每局最多被装备 cardMaxPicks 次；超出后不再出现在候选池。
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
    // 当前已装备的卡仅在其仍被允许时保留在备选中。
    const equippedIndex = this.activeCard ? allowed.indexOf(this.activeCard) : -1;
    if (equippedIndex !== -1) {
        chosen.push(allowed[equippedIndex]);
        allowed.splice(equippedIndex, 1);
    }
    // 从剩余允许的卡里随机补齐到 4 张；不足 4 张时展示现有张数。
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

    // 每次打开选卡都重抽当前批次的 4 张卡面。
    this.rollCardOptions();
    this.updateCardHighlight();

    if (firstPick || !this.activeCard) {
        this.cardHint.textContent = '首次选择免费';
        this.cardHint.classList.remove('warn');
    } else if (this.activeCard === 'glass') {
        // 玻璃大炮进出换卡都免费——提示必须与实际免扣规则一致。
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
    // 玻璃大炮 将生命上限锁定为 1：切入或切出玻璃都必须免费，
    // 否则离开玻璃卡时需要支付 1 点生命 = 直接死亡。
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
    // 玻璃大炮: 进入玻璃锁定 maxLives=1，离开玻璃恢复无限生命上限。
    if (cardId === 'glass') {
        this.maxLives = 1;
        this.lives = 1;
    } else if (previousCard === 'glass') {
        this.maxLives = Infinity;
    }

    // 每种卡每局最多装备 cardMaxPicks 次；保持当前卡也被计为一次使用。
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

// 伤害取整：玩家子弹伤害始终是 0.5 的整数倍且不小于 0.5（敌人血量为 0.5 步进）。
Game.roundBulletDamage = function(d) {
    return Math.max(0.5, Math.round(d * 2) / 2);
};

// 子弹伤害（未按 Boss猎手 区分目标），已做 0.5 取整。
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
        // 血之渴望: 伤害减半是换取的代价（吸血只是补偿）。
        d *= CONFIG.cards.bloodlustDamageMult;
    }
    return this.roundBulletDamage(d);
};

// Boss猎手：按目标区分伤害——对 Boss 高伤、对小怪低伤。
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
    // 简单模式：敌机发射子弹频率 ×0.5。
    if (this.difficulty === 'easy') rate *= CONFIG.difficulty.easy.enemyFireRateMult;
    return rate;
};

Game.getItemSpawnRate = function() {
    return this.itemSpawnRate * (this.activeCard === 'supply' ? CONFIG.cards.supplyItemMult : 1);
};

Game.getBossShotDelay = function() {
    const delay = this.boss.shotDelay / (this.activeCard === 'passion' ? CONFIG.cards.speedMult : 1);
    // 简单模式：Boss 射击间隔 ×1.5。
    return this.difficulty === 'easy' ? delay * CONFIG.difficulty.easy.bossShotDelayMult : delay;
};

// 电光石火: 每次射击额外发射的子弹数（在 baseBulletCount 之上）。
Game.getBulletCount = function() {
    return this.baseBulletCount + (this.activeCard === 'blitz' ? CONFIG.cards.bulletCountBonus : 0);
};

// 电光石火: 玩家子弹速度倍率。
Game.getBulletSpeedMult = function() {
    return this.activeCard === 'blitz' ? CONFIG.cards.bulletSpeedMult : 1;
};

// 连环爆炸: 敌人刷新速率倍率。
Game.getEnemySpawnRate = function() {
    let rate = this.enemySpawnRate * (this.activeCard === 'chain' ? CONFIG.cards.chainSpawnMult : 1);
    // 简单模式：出敌机频率 ×0.7。
    if (this.difficulty === 'easy') rate *= CONFIG.difficulty.easy.spawnRateMult;
    return rate;
};

// 荆棘护甲: 敌方子弹速度倍率。
Game.getEnemyBulletSpeed = function() {
    let speed = this.enemyBulletSpeed * (this.activeCard === 'thorns' ? CONFIG.cards.thornsBulletSpeedMult : 1);
    // 简单模式：全部敌弹速度 ×0.7。
    if (this.difficulty === 'easy') speed *= CONFIG.difficulty.easy.slowMult;
    return speed;
};

// 简单模式：敌机/Boss 移动速度倍率（除玩家外所有移动统一减慢）。
Game.getEnemySpeedMult = function() {
    return this.difficulty === 'easy' ? CONFIG.difficulty.easy.slowMult : 1;
};

// 血之渴望: 击杀普通敌人回 1 命的概率（Boss 概率见 lifeStealBoss，由碰撞层使用）。
Game.getLifeStealChance = function() {
    return this.activeCard === 'bloodlust' ? CONFIG.cards.lifeStealEnemy : 0;
};

// 电光石火/玻璃大炮: 玻璃(1血上限)与电光石火(技能向)无法通过效果回命。
Game.canHeal = function() {
    return !(this.activeCard === 'blitz' || this.activeCard === 'glass');
};

// 通用加命入口，受 maxLives 上限约束。
Game.applyLifeGain = function(n) {
    this.lives = Math.min(this.lives + n, this.maxLives);
    this.updateUI(true);
};

Game.updateCardEffects = function(deltaTime) {
    if (this.activeCard !== 'survival') return;

    this.cardRegenTimer += deltaTime;
    if (this.cardRegenTimer >= CONFIG.cards.regenIntervalMs) {
        this.cardRegenTimer -= CONFIG.cards.regenIntervalMs;
        // 生存之道: 每间隔 +1 命，经 applyLifeGain 受 maxLives 上限约束。
        this.applyLifeGain(1);
    }
};

Game.updateCardHighlight = function() {
    for (const button of this.cardButtons) {
        button.classList.toggle('cardActive', button.dataset.card === this.activeCard);
    }
};
