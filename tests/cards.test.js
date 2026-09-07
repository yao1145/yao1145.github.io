import assert from 'node:assert/strict';
import test from 'node:test';
import { Game } from '../js/core/game.js';
import { CONFIG } from '../js/core/config.js';
import { resetGameFixture } from './helpers/game-fixture.js';
import '../js/systems/cards.js';

function resetCards() {
    resetGameFixture();
    Game.player = { shotDelay: CONFIG.player.shotDelay };
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
