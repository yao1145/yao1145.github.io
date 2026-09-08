import assert from 'node:assert/strict';
import test from 'node:test';
import { Game } from '../js/core/game.js';
import { CONFIG } from '../js/core/config.js';
import { resetGameFixture } from './helpers/game-fixture.js';
import '../js/systems/cards.js';

function resetCards() {
    resetGameFixture();
    Game.resetCardHistory();
    Game.player = { shotDelay: CONFIG.player.shotDelay };
    Game.enemyShotRate = 0.2;
    Game.enemySpawnRate = 0.02;
    Game.enemyBulletSpeed = 4;
    Game.itemSpawnRate = 0.01;
    Game.boss = { shotDelay: 500 };
    Game.updateUI = () => {};
    Game.enableControlArea = () => {};
}

test('core card pool contains exactly the thirteen selectable cards', () => {
    resetCards();

    assert.equal(Object.keys(Game.CARDS).length, 13);
    assert.deepEqual(Object.keys(Game.CARDS), [
        'passion', 'survival', 'comeback', 'peace', 'blitz', 'bloodlust', 'chain',
        'glass', 'boss', 'thorns', 'supply', 'fog', 'boost',
    ]);
});

test('recordCardHistory stores the card name and whether the active card was kept', () => {
    resetCards();
    Game.activeCard = 'peace';

    Game.recordCardHistory('peace', 2);
    Game.recordCardHistory('glass', 3);

    assert.deepEqual(Game.cardHistory, [
        { rewardIndex: 2, cardId: 'peace', name: '平安无事', kept: true },
        { rewardIndex: 3, cardId: 'glass', name: '玻璃大炮', kept: false },
    ]);
});

test('opening selection resets card history and records the first real choice at reward zero', () => {
    resetCards();
    Game.cardHistory.push({ rewardIndex: 99, cardId: 'peace', name: '平安无事', kept: true });
    Game.buildState = { cycle: 8 };

    Game.openCardSelection(true);
    Game.cardSelectionModel = { options: ['peace'] };

    assert.equal(Game.completeCoreCardSelection('peace'), true);
    assert.deepEqual(Game.cardHistory, [
        { rewardIndex: 0, cardId: 'peace', name: '平安无事', kept: false },
    ]);
});

test('later real selections use the current reward cycle and skips add no history', () => {
    resetCards();
    Game.activeCard = 'peace';
    Game.buildState = { cycle: 2 };
    Game.openCardSelection(false);
    Game.cardSelectionModel = { options: ['peace'] };

    assert.equal(Game.completeCoreCardSelection('peace'), true);
    assert.deepEqual(Game.cardHistory, [
        { rewardIndex: 2, cardId: 'peace', name: '平安无事', kept: true },
    ]);

    Game.openCardSelection(false);
    Game.cardSelectionModel = { options: [], canSkip: true };
    assert.equal(Game.skipCardSelection(), true);
    assert.deepEqual(Game.cardHistory, [
        { rewardIndex: 2, cardId: 'peace', name: '平安无事', kept: true },
    ]);
    assert.equal(Game.completeCoreCardSelection(null), false);
});

test('switch preview rejects a one-life ordinary switch without killing the player', () => {
    resetCards();
    Game.activeCard = 'peace';
    Game.lives = 1;

    assert.deepEqual(Game.getCardSwitchPreview('boss'), {
        legal: false,
        cost: 1,
        livesAfter: 0,
        maxLivesAfter: 20,
        reason: '生命不足，无法更换',
    });
});

test('glass entry and exit are free and exit does not heal the player', () => {
    resetCards();
    Game.activeCard = 'peace';
    Game.lives = 7;

    assert.deepEqual(Game.getCardSwitchPreview('glass'), {
        legal: true,
        cost: 0,
        livesAfter: 1,
        maxLivesAfter: 1,
        reason: '',
    });

    Game.activeCard = 'glass';
    Game.lives = 1;
    assert.deepEqual(Game.getCardSwitchPreview('peace'), {
        legal: true,
        cost: 0,
        livesAfter: 1,
        maxLivesAfter: 20,
        reason: '',
    });
    assert.equal(Game.getMaxLivesForCard('glass'), 1);
    assert.equal(Game.getMaxLivesForCard('peace'), 20);
});

test('selection model uses legal cards, keeps the active card, and caps picks at three', () => {
    resetCards();
    Game.activeCard = 'peace';
    Game.lives = 1;
    Game.cardPickCount = { peace: 2, boss: 3 };

    const model = Game.getCardSelectionModel(() => 0);

    assert.deepEqual(model.options, ['peace', 'glass']);
    assert.equal(model.canSkip, false);
    assert.equal(model.previews.boss.reason, '本局已选择3次');
    assert.equal(model.previews.peace.legal, true);
});

test('selection model exposes four legal options and deterministic rng ordering', () => {
    resetCards();
    const model = Game.getCardSelectionModel(() => 0);

    assert.equal(model.options.length, 4);
    assert.equal(new Set(model.options).size, 4);
    assert.ok(model.options.every((id) => Game.CARDS[id]));
    assert.ok(model.options.every((id) => model.previews[id].legal));
});

test('skip is allowed only for an exhausted or otherwise optionless pool', () => {
    resetCards();
    Game.activeCard = 'peace';
    Game.cardPickCount = Object.fromEntries(Object.keys(Game.CARDS).map((id) => [id, 3]));
    Game.isCardSelectionOpen = true;
    Game.cardSelectionModel = Game.getCardSelectionModel(() => 0);
    const before = { ...Game.cardPickCount };

    assert.equal(Game.cardSelectionModel.canSkip, true);
    assert.equal(Game.skipCardSelection(), true);
    assert.deepEqual(Game.cardPickCount, before);
    assert.equal(Game.activeCard, 'peace');

    Game.cardPickCount = {};
    Game.isCardSelectionOpen = true;
    Game.cardSelectionModel = Game.getCardSelectionModel(() => 0);
    assert.equal(Game.cardSelectionModel.canSkip, false);
    assert.equal(Game.skipCardSelection(), false);
});

test('selection rejects legal cards omitted from the current options without mutation', () => {
    const assertRejectedWithoutMutation = (choose) => {
        resetCards();
        Game.activeCard = 'peace';
        Game.lives = 3;
        Game.cardPickCount = { peace: 1 };
        Game.isCardSelectionOpen = true;
        Game.cardSelectionModel = {
            options: ['survival', 'comeback', 'peace', 'blitz'],
        };
        const before = {
            activeCard: Game.activeCard,
            lives: Game.lives,
            cardPickCount: { ...Game.cardPickCount },
            isRunning: Game.isRunning,
        };

        assert.equal(choose(), false);
        assert.equal(Game.activeCard, before.activeCard);
        assert.equal(Game.lives, before.lives);
        assert.deepEqual(Game.cardPickCount, before.cardPickCount);
        assert.equal(Game.isRunning, before.isRunning);
    };

    assertRejectedWithoutMutation(() => Game.selectCard('passion'));
    assertRejectedWithoutMutation(() => Game.completeCoreCardSelection('passion'));
});

test('skip and null completion require an open selection with a current model', () => {
    resetCards();
    Game.cardPickCount = Object.fromEntries(Object.keys(Game.CARDS).map((id) => [id, 3]));
    Game.isRunning = false;
    Game.cardSelectionModel = { options: [], canSkip: true };

    assert.equal(Game.skipCardSelection(), false);
    assert.equal(Game.completeCoreCardSelection(null), false);
    assert.equal(Game.isRunning, false);

    resetCards();
    Game.cardPickCount = Object.fromEntries(Object.keys(Game.CARDS).map((id) => [id, 3]));
    Game.isRunning = false;
    Game.isCardSelectionOpen = true;

    assert.equal(Game.skipCardSelection(), false);
    assert.equal(Game.completeCoreCardSelection(null), false);
    assert.equal(Game.isRunning, false);
});

test('completing a core selection applies one pick and keeps combat helpers compatible', () => {
    resetCards();
    Game.isCardSelectionOpen = true;
    Game.cardSelectionModel = { options: ['glass'] };

    assert.equal(Game.completeCoreCardSelection('glass'), true);
    assert.equal(Game.activeCard, 'glass');
    assert.equal(Game.cardPickCount.glass, 1);
    assert.equal(Game.lives, 1);
    assert.equal(Game.getMaxLives(), 1);
    assert.equal(Game.getBulletCount(), Game.baseBulletCount);
    assert.equal(Game.getPlayerShotDelay(), CONFIG.player.shotDelay / CONFIG.cards.glassShotSpeedMult);
});

test('passion, peace, and supply apply their exact player, enemy, and Boss firing rates', () => {
    resetCards();

    Game.activeCard = 'passion';
    assert.equal(Game.getPlayerShotDelay(), 300 / CONFIG.cards.speedMult);
    assert.equal(Game.getEnemyShotRate(), 0.2 * CONFIG.cards.speedMult);
    assert.equal(Game.getBossShotDelay(), 500 / CONFIG.cards.speedMult);

    Game.activeCard = 'peace';
    assert.equal(Game.getPlayerShotDelay(), 300 / CONFIG.cards.peacePlayerRate);
    assert.equal(Game.getEnemyShotRate(), 0.2 * CONFIG.cards.peaceEnemyRate);
    assert.equal(Game.getBossShotDelay(), 500 / CONFIG.cards.peaceEnemyRate);

    Game.activeCard = 'supply';
    assert.equal(Game.getPlayerShotDelay(), 300);
    assert.equal(Game.getEnemyShotRate(), 0.2 * CONFIG.cards.supplyEnemyShotMult);
    assert.equal(Game.getBossShotDelay(), 500 / CONFIG.cards.supplyEnemyShotMult);
    assert.equal(Game.getItemSpawnRate(), 0.01 * CONFIG.cards.supplyItemMult);
});

test('survival and bloodlust preserve base bullet damage while slowing player fire', () => {
    resetCards();
    Game.bulletDamage = 4;

    Game.activeCard = 'survival';
    assert.equal(Game.getBulletDamage(), 4);
    assert.equal(Game.getPlayerShotDelay(), 300 / CONFIG.cards.survivalPlayerRate);

    Game.activeCard = 'bloodlust';
    assert.equal(Game.getBulletDamage(), 4);
    assert.equal(Game.getPlayerShotDelay(), 300 / CONFIG.cards.bloodlustPlayerRate);
});

test('comeback doubles damage and firing rate at two lives but sleeps at three', () => {
    resetCards();
    Game.activeCard = 'comeback';
    Game.bulletDamage = 4;

    Game.lives = 2;
    assert.equal(Game.getBulletDamage(), 4 * CONFIG.cards.comebackMult);
    assert.equal(Game.getPlayerShotDelay(), 300 / CONFIG.cards.comebackMult);

    Game.lives = 3;
    assert.equal(Game.getBulletDamage(), 4);
    assert.equal(Game.getPlayerShotDelay(), 300);
});

test('blitz, glass, boss, and thorns expose their positive effect and explicit constraint', () => {
    resetCards();
    Game.baseBulletCount = 2;
    Game.bulletDamage = 4;
    Game.enemyBulletSpeed = 4;
    Game.activeCard = 'blitz';
    assert.equal(Game.getBulletCount(), 2 + CONFIG.cards.bulletCountBonus);
    assert.equal(Game.getBulletSpeedMult(), CONFIG.cards.bulletSpeedMult);
    assert.equal(Game.canHeal(), false);

    Game.activeCard = 'glass';
    assert.equal(Game.getBulletDamage(), 4 * CONFIG.cards.glassDamageMult);
    assert.equal(Game.getPlayerShotDelay(), 300 / CONFIG.cards.glassShotSpeedMult);
    assert.equal(Game.getMaxLives(), 1);
    assert.equal(Game.canHeal(), false);

    Game.activeCard = 'boss';
    assert.equal(Game.getDamageFor('boss'), 4 * CONFIG.cards.bossDamageMult);
    assert.equal(Game.getDamageFor('enemy'), 4 * CONFIG.cards.mobDamageMult);

    Game.activeCard = 'thorns';
    assert.equal(Game.getEnemyBulletSpeed(), 4 * CONFIG.cards.thornsBulletSpeedMult);
    assert.equal(CONFIG.cards.thornsRadius, 200);
    assert.equal(CONFIG.cards.thornsBossFrac, 0.1);
});

test('chain, fog, and boost retain their scoped tradeoffs and configured benefits', () => {
    resetCards();
    Game.activeCard = 'chain';
    assert.equal(Game.getEnemySpawnRate(), 0.02 * CONFIG.cards.chainSpawnMult);

    Game.activeCard = 'fog';
    assert.equal(Game.getPlayerShotDelay(), 300);
    assert.equal(Game.getEnemyShotRate(), 0.2);
    assert.equal(CONFIG.cards.fogBulletSpeed, 0.8);
    assert.equal(CONFIG.cards.fogLineRatio, 0.35);
    assert.equal(CONFIG.cards.fogFadePx, 40);

    Game.activeCard = 'boost';
    assert.equal(CONFIG.cards.boostHeartHeal, 2);
    assert.equal(CONFIG.cards.boostDamageTime, 15);
    assert.equal(CONFIG.cards.boostShieldTime, 10);
    assert.equal(CONFIG.cards.boostHitLoss, 2);
});

test('survival heals at 19999/20000/20001ms, freezes at full health, and resumes after damage', () => {
    resetCards();
    Game.activeCard = 'survival';
    Game.lives = 3;

    Game.updateCardEffects(19999);
    assert.equal(Game.lives, 3);
    assert.equal(Game.cardRegenTimer, 19999);

    Game.updateCardEffects(1);
    assert.equal(Game.lives, 4);
    assert.equal(Game.cardRegenTimer, 0);

    Game.updateCardEffects(20001);
    assert.equal(Game.lives, 5);
    assert.equal(Game.cardRegenTimer, 0);

    Game.cardRegenTimer = 1234;
    Game.lives = Game.getMaxLives();
    Game.updateCardEffects(5000);
    assert.equal(Game.lives, Game.getMaxLives());
    assert.equal(Game.cardRegenTimer, 1234);

    Game.lives -= 1;
    Game.updateCardEffects(1);
    assert.equal(Game.cardRegenTimer, 1235);
});

test('bloodlust exchanges at 7/8/16 points, preserves remainders, and retries failed exchanges', () => {
    resetCards();
    Game.activeCard = 'bloodlust';
    Game.lives = 3;

    assert.deepEqual(Game.addBloodlustProgress(7), { gained: 0, meter: 7 });
    assert.deepEqual(Game.addBloodlustProgress(1), { gained: 1, meter: 0 });
    assert.equal(Game.lives, 4);

    Game.bloodlustMeter = 3;
    assert.deepEqual(Game.addBloodlustProgress(16), { gained: 2, meter: 3 });
    assert.equal(Game.lives, 6);

    Game.lives = 3;
    Game.bloodlustMeter = 7;
    const originalCanHeal = Game.canHeal;
    Game.canHeal = () => false;
    try {
        assert.deepEqual(Game.addBloodlustProgress(1), { gained: 0, meter: 8 });
    } finally {
        Game.canHeal = originalCanHeal;
    }
    assert.deepEqual(Game.addBloodlustProgress(1), { gained: 1, meter: 1 });

    Game.lives = Game.getMaxLives();
    Game.bloodlustMeter = 7;
    assert.deepEqual(Game.addBloodlustProgress(1), { gained: 0, meter: 8 });

    Game.lives -= 1;
    assert.deepEqual(Game.addBloodlustProgress(1), { gained: 1, meter: 1 });
    assert.equal(Game.lives, Game.getMaxLives());
});

test('survival and bloodlust effect state survives same-card selection but clears when leaving', () => {
    resetCards();
    Game.activeCard = 'survival';
    Game.cardRegenTimer = 7400;
    Game.bloodlustMeter = 6;

    Game.onCoreCardChanged('survival', 'survival');
    assert.equal(Game.cardRegenTimer, 7400);
    assert.equal(Game.bloodlustMeter, 6);

    Game.onCoreCardChanged('survival', 'peace');
    assert.equal(Game.cardRegenTimer, 0);
    assert.equal(Game.bloodlustMeter, 0);

    Game.activeCard = 'bloodlust';
    Game.cardRegenTimer = 1200;
    Game.bloodlustMeter = 7;
    Game.onCoreCardChanged('bloodlust', 'bloodlust');
    assert.equal(Game.cardRegenTimer, 1200);
    assert.equal(Game.bloodlustMeter, 7);

    Game.onCoreCardChanged('bloodlust', 'glass');
    assert.equal(Game.cardRegenTimer, 0);
    assert.equal(Game.bloodlustMeter, 0);
});
