import assert from 'node:assert/strict';
import test from 'node:test';
import { Game } from '../js/core/game.js';
import { CONFIG } from '../js/core/config.js';
import { resetGameFixture } from './helpers/game-fixture.js';
import '../js/systems/cards.js';

function resetCards() {
    resetGameFixture();
    Game.player = { shotDelay: 300 };
    Game.enemyShotRate = 0.2;
    Game.enemyBulletSpeed = 4;
    Game.boss = { shotDelay: 500 };
    Game.updateUI = () => {};
    Game.cardRegenTimer = 0;
    Game.bloodlustMeter = 0;
}

test('v2.1 core cards apply exact tradeoffs without changing unrelated damage or rates', () => {
    resetCards();
    Game.bulletDamage = 4;

    Game.activeCard = 'survival';
    assert.equal(Game.getBulletDamage(), 4);
    assert.equal(Game.getPlayerShotDelay(), 300 / 0.75);
    assert.equal(Game.getEnemyShotRate(), 0.2);
    assert.equal(Game.getBossShotDelay(), 500);

    Game.activeCard = 'bloodlust';
    assert.equal(Game.getBulletDamage(), 4);
    assert.equal(Game.getPlayerShotDelay(), 300 / 0.75);

    Game.activeCard = 'peace';
    assert.equal(Game.getPlayerShotDelay(), 300 / 0.80);
    assert.equal(Game.getEnemyShotRate(), 0.2 * 0.65);
    assert.equal(Game.getBossShotDelay(), 500 / 0.65);

    Game.activeCard = 'supply';
    assert.equal(Game.getEnemyShotRate(), 0.2 * 1.5);
    assert.equal(Game.getBossShotDelay(), 500 / 1.5);

    Game.activeCard = 'fog';
    assert.equal(Game.getPlayerShotDelay(), 300);
    assert.equal(Game.getEnemyShotRate(), 0.2);
    assert.equal(Game.getBossShotDelay(), 500);
});

test('v2.1 card face text describes survival, peace, bloodlust, and fog', () => {
    resetCards();

    assert.equal(Game.CARD_DESCS.survival, '射速×0.75·每20s回1命·满血暂停');
    assert.equal(Game.CARD_DESCS.peace, '敌人射速×0.65·自身射速×0.80');
    assert.equal(Game.CARD_DESCS.bloodlust, '8点回1命·Boss首次+16·射速×0.75');
    assert.equal(Game.CARD_DESCS.fog, '追踪失效·敌弹速度×0.80·上方视野受阻');
});

test('survival pauses at full health and resumes from frozen progress after damage', () => {
    resetCards();
    Game.activeCard = 'survival';
    Game.lives = 3;

    Game.updateCardEffects(19999);
    assert.equal(Game.lives, 3);
    assert.equal(Game.cardRegenTimer, 19999);

    Game.updateCardEffects(1);
    assert.equal(Game.lives, 4);
    assert.equal(Game.cardRegenTimer, 0);

    Game.cardRegenTimer = 1234;
    Game.lives = Game.getMaxLives();
    Game.updateCardEffects(5000);
    assert.equal(Game.lives, Game.getMaxLives());
    assert.equal(Game.cardRegenTimer, 1234);

    Game.lives -= 1;
    Game.updateCardEffects(1);
    assert.equal(Game.cardRegenTimer, 1235);

    Game.cardRegenTimer = 0;
    Game.lives = 3;
    Game.updateCardEffects(20001);
    assert.equal(Game.lives, 4);
    assert.equal(Game.cardRegenTimer, 0);
});

test('card changes clear effect state while reselecting the same card preserves it', () => {
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

    Game.activeCard = 'survival';
    Game.cardRegenTimer = 7400;
    Game.onCoreCardChanged('survival', 'glass');
    assert.equal(Game.cardRegenTimer, 0);
});

test('bloodlust exchanges every eight points, keeps the remainder, and returns gained lives', () => {
    resetCards();
    Game.activeCard = 'bloodlust';
    Game.lives = 3;
    Game.bloodlustMeter = 3;

    assert.deepEqual(Game.addBloodlustProgress(16), { gained: 2, meter: 3 });
    assert.equal(Game.lives, 5);

    Game.lives = 19;
    Game.bloodlustMeter = 3;
    assert.deepEqual(Game.addBloodlustProgress(16), { gained: 1, meter: 11 });
    assert.equal(Game.lives, Game.getMaxLives());

    Game.lives = 20;
    Game.bloodlustMeter = 7;
    assert.deepEqual(Game.addBloodlustProgress(1), { gained: 0, meter: 8 });
    assert.equal(Game.applyLifeGain(1), 0);

    Game.lives = 19;
    assert.deepEqual(Game.addBloodlustProgress(1), { gained: 1, meter: 1 });
    assert.equal(Game.lives, 20);
});

test('bloodlust keeps failed exchanges for a later legal kill and clears on card change', () => {
    resetCards();
    Game.activeCard = 'bloodlust';
    Game.lives = 3;
    Game.bloodlustMeter = 7;
    const originalCanHeal = Game.canHeal;
    Game.canHeal = () => false;

    assert.deepEqual(Game.addBloodlustProgress(1), { gained: 0, meter: 8 });
    Game.canHeal = originalCanHeal;
    assert.deepEqual(Game.addBloodlustProgress(1), { gained: 1, meter: 1 });

    Game.bloodlustMeter = 7;
    Game.onCoreCardChanged('bloodlust', 'peace');
    assert.equal(Game.bloodlustMeter, 0);
});

test('card effect HUD is read-only and exposes survival countdown or bloodlust meter', () => {
    resetCards();
    Game.activeCard = 'survival';
    Game.lives = 3;
    Game.cardRegenTimer = 7600;
    const survivalBefore = Game.cardRegenTimer;
    assert.deepEqual(Game.getCardEffectHudState(), {
        cardId: 'survival',
        label: '回血 12.4s',
        paused: false,
        timerMs: 7600,
        intervalMs: CONFIG.cards.survivalHealMs,
    });
    assert.equal(Game.cardRegenTimer, survivalBefore);

    Game.lives = Game.getMaxLives();
    assert.deepEqual(Game.getCardEffectHudState(), {
        cardId: 'survival',
        label: '满血暂停',
        paused: true,
        timerMs: 7600,
        intervalMs: CONFIG.cards.survivalHealMs,
    });

    Game.activeCard = 'bloodlust';
    Game.bloodlustMeter = 3;
    const meterBefore = Game.bloodlustMeter;
    assert.deepEqual(Game.getCardEffectHudState(), {
        cardId: 'bloodlust',
        label: '血槽 3/8',
        meter: 3,
        threshold: 8,
    });
    assert.equal(Game.bloodlustMeter, meterBefore);
});
