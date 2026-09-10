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

// Short per-card face text, ~10 glyphs each so a four-card selection stays
// compact. Only used to label the pickable faces.
Game.CARD_DESCS = {
    passion: '敌我攻速翻倍',
    survival: '射速×0.75·每20s回1命·满血暂停',
    comeback: '低生命时攻速伤害×2',
    peace: '敌人射速×0.65·自身射速×0.80',
    blitz: '多发提速·禁回命',
    bloodlust: '8点回1命·Boss首次+16·射速×0.75',
    chain: '击毁即连锁爆炸',
    glass: '伤害×2·生命上限1',
    boss: 'Boss伤×3·小兵减半',
    thorns: '受击反杀·敌弹翻倍',
    supply: '道具更多·敌射+50%',
    fog: '追踪失效·敌弹速度×0.80·上方视野受阻',
    boost: '道具强化·敌弹伤2',
};

function survivalRate() {
    return CONFIG.cards.survivalPlayerRate;
}

function peacePlayerRate() {
    return CONFIG.cards.peacePlayerRate;
}

function peaceEnemyRate() {
    return CONFIG.cards.peaceEnemyRate;
}

function bloodlustRate() {
    return CONFIG.cards.bloodlustPlayerRate;
}

function bloodlustKillsPerLife() {
    return CONFIG.cards.bloodlustKillsPerLife;
}

function survivalHealInterval() {
    return CONFIG.cards.survivalHealMs;
}

// Per-run core-card choices for the end-of-run summary. This is intentionally
// kept in memory only; the persistent score/crown records are unrelated.
Game.cardHistory = Game.cardHistory || [];

Game.resetCardHistory = function() {
    this.cardHistory = [];
};

Game.recordCardHistory = function(cardId, rewardIndex) {
    if (cardId == null || !this.CARDS[cardId]) return false;

    if (!Array.isArray(this.cardHistory)) this.cardHistory = [];
    const record = {
        rewardIndex,
        cardId,
        name: this.CARDS[cardId].name,
        kept: cardId === this.activeCard,
    };
    this.cardHistory.push(record);
    return record;
};

function shuffle(values, rng) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

Game.getMaxLivesForCard = function(cardId) {
    return cardId === 'glass' ? 1 : CONFIG.player.maxLives;
};

Game.getCardSwitchPreview = function(cardId) {
    const maxLivesAfter = this.getMaxLivesForCard(cardId);
    if (!this.CARDS[cardId]) {
        return { legal: false, cost: 0, livesAfter: this.lives, maxLivesAfter, reason: '无效效果卡' };
    }

    const used = (this.cardPickCount || {})[cardId] || 0;
    if (used >= CONFIG.cards.cardMaxPicks) {
        return { legal: false, cost: 0, livesAfter: this.lives, maxLivesAfter, reason: '本局已选择3次' };
    }

    const isSwitch = this.activeCard !== null && cardId !== this.activeCard;
    const free = cardId === 'glass' || this.activeCard === 'glass';
    const cost = isSwitch && !free ? CONFIG.cards.switchCost : 0;
    const chargedLives = this.lives - cost;
    // Entering glass clamps the current life count to its cap. Leaving glass
    // restores the cap only; it never grants the lost life back.
    const livesAfter = cardId === 'glass'
        ? Math.min(chargedLives, maxLivesAfter)
        : chargedLives;
    const legal = livesAfter >= 1;

    return {
        legal,
        cost,
        livesAfter,
        maxLivesAfter,
        reason: legal ? '' : '生命不足，无法更换',
    };
};

Game.getCardSelectionModel = function(rng = Math.random) {
    const cardIds = Object.keys(this.CARDS);
    const previews = Object.fromEntries(cardIds.map((id) => [id, this.getCardSwitchPreview(id)]));
    const cardStates = Object.fromEntries(cardIds.map((id) => [id, {
        id,
        name: this.CARDS[id].name,
        description: this.CARD_DESCS[id],
        pickCount: (this.cardPickCount || {})[id] || 0,
        ...previews[id],
    }]));
    const legalIds = cardIds.filter((id) => previews[id].legal);
    const randomized = shuffle(legalIds, rng);

    // Keeping the current card must remain possible while it is legal, even
    // when the random four-card sample would otherwise omit it.
    if (this.activeCard && previews[this.activeCard]?.legal) {
        const currentIndex = randomized.indexOf(this.activeCard);
        if (currentIndex !== -1) randomized.splice(currentIndex, 1);
        randomized.unshift(this.activeCard);
    }

    const options = randomized.slice(0, 4);
    return {
        options,
        previews,
        cards: cardStates,
        canSkip: options.length === 0,
        skipReason: options.length === 0 ? '没有合法效果卡，本轮不换卡' : '仍有合法效果卡',
    };
};

Game.updateCardSelectionUI = function(model) {
    if (!this.cardButtons) return;
    const options = new Set(model.options);
    for (const button of this.cardButtons) {
        const id = button.dataset.card;
        const preview = model.previews[id];
        const show = options.has(id);
        button.style.display = show ? '' : 'none';
        button.disabled = !show || !preview?.legal;
        button.setAttribute('aria-disabled', String(button.disabled));
        if (preview) {
            const used = (this.cardPickCount || {})[id] || 0;
            const costText = preview.cost === 0 ? '免费' : `消耗${preview.cost}命`;
            const metaText = `${used}/${CONFIG.cards.cardMaxPicks}次 · ${costText} · 换后${preview.livesAfter}命/上限${preview.maxLivesAfter}`;
            button.title = preview.legal ? metaText : `${metaText} · ${preview.reason}`;
            button.setAttribute('aria-label', `${this.CARDS[id].name}：${this.CARD_DESCS[id]}（${metaText}）`);
            const desc = button.querySelector('.cardDesc');
            if (desc && show) {
                // Keep the face to one short sentence. Pick count, cost and
                // post-switch lives remain available via the tooltip/ARIA
                // label, so the candidate grid does not become a paragraph.
                desc.textContent = this.CARD_DESCS[id];
            }
            const badge = button.querySelector('.cardBadge');
            if (badge && show) {
                const used = (this.cardPickCount || {})[id] || 0;
                badge.textContent = id === this.activeCard
                    ? `当前 · ${used}/${CONFIG.cards.cardMaxPicks}`
                    : `${used}/${CONFIG.cards.cardMaxPicks}`;
            }
        }
    }
    if (this.cardSkipButton) {
        this.cardSkipButton.style.display = model.canSkip ? '' : 'none';
        this.cardSkipButton.disabled = !model.canSkip;
        this.cardSkipButton.title = model.canSkip ? '' : model.skipReason;
    }
};

// Compatibility wrapper retained for the existing card UI and later reward
// flow: it now draws only from the legal thirteen-card core pool.
Game.rollCardOptions = function(rng = Math.random) {
    this.cardSelectionModel = this.getCardSelectionModel(rng);
    this.updateCardSelectionUI(this.cardSelectionModel);
    return this.cardSelectionModel.options;
};

Game.setupCards = function() {
    this.cardPanel = document.getElementById('cardPanel');
    this.cardHint = document.getElementById('cardHint');
    this.cardIndicator = document.getElementById('cardIndicator');
    this.cardSkipButton = document.getElementById('cardSkipButton');
    this.cardButtons = Array.from(document.querySelectorAll('.effectCard'));

    this.cardPanel.addEventListener('click', (event) => {
        const button = event.target.closest('.effectCard');
        if (button && !button.disabled) {
            this.selectCard(button.dataset.card);
            return;
        }
        if (event.target.closest('#cardSkipButton')) this.skipCardSelection();
    });
};

Game.openCardSelection = function(firstPick = false) {
    if (this.isGameOver) return;

    if (firstPick) this.resetCardHistory();
    this.cardSelectionRewardIndex = firstPick
        ? 0
        : (Number.isInteger(this.rewardFlow?.rewardIndex)
            ? this.rewardFlow.rewardIndex
            : this.buildState?.cycle || 0);

    this.isRunning = false;
    this.accumulator = 0;
    this.lastTime = performance.now();
    if (typeof this.enableControlArea === 'function') this.enableControlArea(false);
    this.isCardSelectionOpen = true;

    this.rollCardOptions();
    this.updateCardHighlight();

    if (this.cardHint) {
        if (this.cardSelectionModel.canSkip) {
            this.cardHint.textContent = '本轮无合法选项，可保底跳过';
            this.cardHint.classList.remove('warn');
        } else if (firstPick || !this.activeCard) {
            this.cardHint.textContent = '首次选择免费';
            this.cardHint.classList.remove('warn');
        } else if (this.activeCard === 'glass') {
            this.cardHint.textContent = '玻璃大炮：更换卡片免费，离开不回血';
            this.cardHint.classList.remove('warn');
        } else {
            this.cardHint.textContent = '保持当前卡免费，更换需扣除1点生命';
            this.cardHint.classList.add('warn');
        }
    }

    if (this.cardPanel) this.cardPanel.style.display = 'flex';
};

// Hide the card panel without touching the simulation (used when another
// panel, e.g. the build selection, takes over the pause).
Game.closeCardSelection = function() {
    this.isCardSelectionOpen = false;
    if (this.cardPanel) this.cardPanel.style.display = 'none';
};

Game.resumeAfterCardSelection = function() {
    this.closeCardSelection();
    this.isRunning = true;
    this.accumulator = 0;
    this.lastTime = performance.now();
    if (typeof this.enableControlArea === 'function') this.enableControlArea(true);
};

Game.skipCardSelection = function() {
    const model = this.cardSelectionModel;
    if (!this.isCardSelectionOpen
        || !model
        || !Array.isArray(model.options)
        || model.options.length !== 0
        || !model.canSkip) return false;
    // Inside the boss reward flow a skip never resumes the simulation; it only
    // advances to the next reward stage (see js/systems/builds.js).
    if (this.rewardFlow && this.rewardFlow.phase === 'core') return this.advanceRewardFlow();
    this.resumeAfterCardSelection();
    return true;
};

Game.completeCoreCardSelection = function(cardId) {
    const model = this.cardSelectionModel;
    if (!this.isCardSelectionOpen
        || !model
        || !Array.isArray(model.options)) return false;
    if (cardId === null) return this.skipCardSelection();
    if (!model.options.includes(cardId)) return false;
    const preview = this.getCardSwitchPreview(cardId);
    if (!preview.legal) return false;

    const previousCard = this.activeCard;
    this.recordCardHistory(cardId, this.cardSelectionRewardIndex ?? 0);
    this.lives = preview.livesAfter;
    this.activeCard = cardId;
    if (previousCard !== cardId && typeof this.onCoreCardChanged === 'function') {
        this.onCoreCardChanged(previousCard, cardId);
    }
    this.cardPickCount = this.cardPickCount || {};
    this.cardPickCount[cardId] = (this.cardPickCount[cardId] || 0) + 1;

    this.updateCardHighlight();
    this.updateCardChipUI();
    if (typeof this.updateUI === 'function') this.updateUI(true);
    // Inside the boss reward flow the core-card pick only advances the flow;
    // the simulation stays paused until the summary confirms.
    if (this.rewardFlow && this.rewardFlow.phase === 'core') {
        this.advanceRewardFlow();
        return true;
    }
    this.resumeAfterCardSelection();
    return true;
};

Game.selectCard = function(cardId) {
    if (!this.isCardSelectionOpen) return false;
    return this.completeCoreCardSelection(cardId);
};

// Damage rounding: player bullet damage is always a multiple of 0.5, min 0.5
// (enemy HP steps by 0.5).
Game.roundBulletDamage = function(d) {
    return Math.max(0.5, Math.round(d * 2) / 2);
};

// Combat-damage quantization for the unified event pipeline (direct hits,
// strikes, explosions, retaliation): a multiple of 0.5 with a 0.5 floor, but
// exact zero stays zero — an unowned effect must never become a 0.5 hit.
Game.roundCombatDamage = function(d) {
    return d <= 0 ? 0 : Math.max(0.5, Math.round(d * 2) / 2);
};

// Final direct-shot damage for one hit. getDamageFor() is called exactly once
// per hit; a per-bullet bonus travelling on the bullet (buildDamageBonus, which
// the collisions.js bridge folds the rapid/supply bonuses into) is added before
// quantization, independent of isPrimary, and the same result feeds both the
// event's amount and baseDamage so later bonus strikes never re-enter the card
// multiplier hooks.
Game.getDirectShotDamage = function(targetType, bullet) {
    let d = this.getDamageFor(targetType);
    if (bullet && bullet.buildDamageBonus) {
        d += bullet.buildDamageBonus;
        bullet.buildDamageBonus = 0;
    }
    return this.roundCombatDamage(d);
};

// Bullet damage (no per-target split; see getDamageFor), rounded to 0.5.
Game.getBulletDamage = function() {
    let d = this.bulletDamage;
    if (this.activeCard === 'comeback' && this.lives >= 1 && this.lives <= CONFIG.cards.comebackMaxLives) {
        d *= CONFIG.cards.comebackMult;
    }
    if (this.activeCard === 'glass') d *= CONFIG.cards.glassDamageMult;
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
    if (this.activeCard === 'passion') delay /= CONFIG.cards.speedMult;
    if (this.activeCard === 'survival') delay /= survivalRate();
    if (this.activeCard === 'bloodlust') delay /= bloodlustRate();
    if (this.activeCard === 'peace') delay /= peacePlayerRate();
    if (this.activeCard === 'comeback' && this.lives >= 1 && this.lives <= CONFIG.cards.comebackMaxLives) {
        delay /= CONFIG.cards.comebackMult;
    }
    if (this.activeCard === 'glass') delay /= CONFIG.cards.glassShotSpeedMult;
    return delay;
};

Game.getEnemyShotRate = function() {
    let rate = this.enemyShotRate;
    if (this.activeCard === 'passion') rate *= CONFIG.cards.speedMult;
    if (this.activeCard === 'peace') rate *= peaceEnemyRate();
    if (this.activeCard === 'supply') rate *= CONFIG.cards.supplyEnemyShotMult;
    if (this.difficulty === 'easy') rate *= CONFIG.difficulty.easy.enemyFireRateMult;
    return rate;
};

Game.getItemSpawnRate = function() {
    return this.itemSpawnRate * (this.activeCard === 'supply' ? CONFIG.cards.supplyItemMult : 1);
};

Game.getBossShotDelay = function() {
    let rate = 1;
    if (this.activeCard === 'passion') rate = CONFIG.cards.speedMult;
    if (this.activeCard === 'peace') rate = peaceEnemyRate();
    if (this.activeCard === 'supply') rate = CONFIG.cards.supplyEnemyShotMult;
    const delay = this.boss.shotDelay / rate;
    return this.difficulty === 'easy' ? delay * CONFIG.difficulty.easy.bossShotDelayMult : delay;
};

Game.getBulletCount = function() {
    return this.baseBulletCount + (this.activeCard === 'blitz' ? CONFIG.cards.bulletCountBonus : 0);
};

Game.getBulletSpeedMult = function() {
    return this.activeCard === 'blitz' ? CONFIG.cards.bulletSpeedMult : 1;
};

Game.getEnemySpawnRate = function() {
    let rate = this.enemySpawnRate * (this.activeCard === 'chain' ? CONFIG.cards.chainSpawnMult : 1);
    if (this.difficulty === 'easy') rate *= CONFIG.difficulty.easy.spawnRateMult;
    return rate;
};

Game.getEnemyBulletSpeed = function() {
    let speed = this.enemyBulletSpeed * (this.activeCard === 'thorns' ? CONFIG.cards.thornsBulletSpeedMult : 1);
    if (this.difficulty === 'easy') speed *= CONFIG.difficulty.easy.slowMult;
    return speed;
};

Game.getEnemySpeedMult = function() {
    return this.difficulty === 'easy' ? CONFIG.difficulty.easy.slowMult : 1;
};

Game.getLifeStealChance = function() {
    // Bloodlust is now driven by unique kill events and addBloodlustProgress;
    // retain this legacy accessor as a disabled compatibility seam until the
    // combat event migration removes its callers.
    return 0;
};

Game.canHeal = function() {
    return !(this.activeCard === 'blitz' || this.activeCard === 'glass');
};

Game.getMaxLives = function() {
    return this.getMaxLivesForCard(this.activeCard);
};

Game.applyLifeGain = function(n) {
    const amount = Math.max(0, Number(n) || 0);
    const before = this.lives;
    this.lives = Math.min(this.lives + amount, this.getMaxLives());
    const gained = this.lives - before;
    if (gained > 0 && typeof this.updateUI === 'function') this.updateUI(true);
    return gained;
};

Game.updateCardEffects = function(deltaTime) {
    if (this.activeCard !== 'survival') return;
    if (deltaTime <= 0 || !this.canHeal() || this.lives >= this.getMaxLives()) return;

    this.cardRegenTimer += deltaTime;
    if (this.cardRegenTimer >= survivalHealInterval()) {
        if (this.applyLifeGain(1) > 0) this.cardRegenTimer = 0;
    }
};

Game.resetCardEffectState = function() {
    this.cardRegenTimer = 0;
    this.bloodlustMeter = 0;
};

Game.onCoreCardChanged = function(previous, next) {
    if (previous === next) return;
    this.resetCardEffectState();
};

Game.addBloodlustProgress = function(amount) {
    const meter = Number.isFinite(this.bloodlustMeter) ? this.bloodlustMeter : 0;
    if (this.activeCard !== 'bloodlust' || amount <= 0) {
        this.bloodlustMeter = meter;
        return { gained: 0, meter };
    }

    this.bloodlustMeter = meter + amount;
    const threshold = bloodlustKillsPerLife();
    let gained = 0;
    while (this.bloodlustMeter >= threshold) {
        if (!this.canHeal()) break;
        const lifeGain = this.applyLifeGain(1);
        if (lifeGain <= 0) break;
        this.bloodlustMeter -= threshold;
        gained += lifeGain;
    }
    return { gained, meter: this.bloodlustMeter };
};

Game.getCardEffectHudState = function() {
    if (this.activeCard === 'survival') {
        const intervalMs = survivalHealInterval();
        const timerMs = Math.max(0, this.cardRegenTimer || 0);
        const fullHealth = this.lives >= this.getMaxLives();
        const paused = fullHealth || !this.canHeal();
        return {
            cardId: 'survival',
            label: paused
                ? (fullHealth ? '满血暂停' : '禁疗暂停')
                : `回血 ${(Math.max(0, intervalMs - timerMs) / 1000).toFixed(1)}s`,
            paused,
            timerMs,
            intervalMs,
        };
    }
    if (this.activeCard === 'bloodlust') {
        const threshold = bloodlustKillsPerLife();
        const meter = Number.isFinite(this.bloodlustMeter) ? this.bloodlustMeter : 0;
        return {
            cardId: 'bloodlust',
            label: `血槽 ${meter}/${threshold}`,
            meter,
            threshold,
        };
    }
    return null;
};

Game.updateCardHighlight = function() {
    if (!this.cardButtons) return;
    for (const button of this.cardButtons) {
        const id = button.dataset.card;
        button.classList.toggle('cardActive', id === this.activeCard);
    }
};

Game.updateCardChipUI = function() {
    if (!this.cardIndicator && typeof document !== 'undefined') {
        this.cardIndicator = document.getElementById('cardIndicator');
    }
    if (!this.cardIndicator) return;
    if (this.activeCard) {
        const glyph = this.CARDS[this.activeCard].name[0];
        if (this.cardIndicator.textContent !== glyph) this.cardIndicator.textContent = glyph;
        this.cardIndicator.title = `当前效果卡：${this.CARDS[this.activeCard].name}`;
        this.cardIndicator.setAttribute?.('aria-label', `当前效果卡：${this.CARDS[this.activeCard].name}`);
        if (this.cardIndicator.style.display !== '') this.cardIndicator.style.display = '';
    } else {
        this.cardIndicator.title = '';
        this.cardIndicator.removeAttribute?.('aria-label');
        if (this.cardIndicator.style.display !== 'none') this.cardIndicator.style.display = 'none';
    }
};
