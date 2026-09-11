import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

import { Game } from '../js/core/game.js';
import '../js/systems/badges.js';
import '../js/systems/sprites.js';

const EXPECTED_ENEMY_BADGES = [
    '南开大学-logo.svg',
    '复旦大学-logo.svg',
    '西安交通大学-logo.svg',
    '中国科学技术大学-logo.svg',
    '哈尔滨工业大学-logo.svg',
];

const REMOVED_BADGES = [
    '华中科技大学-logo.svg',
    '中国人民大学-logo.svg',
    '武汉大学-logo.svg',
    '中国科学院大学-logo.svg',
];

test('v2.4 fixes one distinct enemy badge to each enemy type', () => {
    assert.deepEqual(
        Game.ENEMY_BADGES.map((variants) => variants.length),
        [1, 1, 1, 1, 1],
    );
    assert.deepEqual(
        Game.ENEMY_BADGES.map(([badge]) => badge),
        EXPECTED_ENEMY_BADGES,
    );
    assert.equal(new Set(EXPECTED_ENEMY_BADGES).size, EXPECTED_ENEMY_BADGES.length);

    for (let type = 0; type < EXPECTED_ENEMY_BADGES.length; type++) {
        assert.equal(Game.getEnemyBadgeKey(type, 0), EXPECTED_ENEMY_BADGES[type]);
        assert.equal(Game.rollEnemyVariant(type), 0);
    }
});

test('v2.4 removes deleted badge assets and references', async () => {
    const badgeFiles = await readdir(new URL('../校徽/', import.meta.url));
    const badgeSource = await readFile(new URL('../js/systems/badges.js', import.meta.url), 'utf8');

    for (const removed of REMOVED_BADGES) {
        assert.equal(badgeFiles.includes(removed), false, `${removed} should be deleted`);
        assert.equal(badgeSource.includes(removed), false, `${removed} should not be referenced`);
    }
});

test('badge loading deduplicates the v2.4 nine-resource set', () => {
    const originalLoadBadgeFile = Game.loadBadgeFile;
    const originalUpdateLoadUI = Game.updateLoadUI;
    const originalBadgeLoad = Game.badgeLoad;
    const requested = [];
    try {
        Game.loadBadgeFile = (file) => requested.push(file);
        Game.updateLoadUI = () => {};
        Game.badgeLoad = { ...originalBadgeLoad };
        Game.loadBadges();

        assert.equal(requested.length, 9, 'player + three bosses + five enemies');
        assert.equal(new Set(requested).size, requested.length, 'each badge should load once');
        assert.deepEqual(requested.slice(0, 4), [
            '北京大学-logo.svg',
            '清华大学-logo.svg',
            '浙江大学-logo.svg',
            '上海交通大学-logo.svg',
        ]);
        assert.deepEqual(requested.slice(4), EXPECTED_ENEMY_BADGES);
    } finally {
        Game.loadBadgeFile = originalLoadBadgeFile;
        Game.updateLoadUI = originalUpdateLoadUI;
        Game.badgeLoad = originalBadgeLoad;
    }
});

test('sprite prewarm plans one enemy task for each fixed badge', () => {
    const enemyTasks = Game.getSpritePreloadTasks().filter(({ kind }) => kind === 'enemy');
    assert.equal(enemyTasks.length, EXPECTED_ENEMY_BADGES.length);
    assert.deepEqual(
        enemyTasks.map(({ key }) => key),
        EXPECTED_ENEMY_BADGES.map((_, type) => `${type}:0`),
    );
});
