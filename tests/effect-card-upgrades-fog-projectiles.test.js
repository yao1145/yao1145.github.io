import assert from 'node:assert/strict';
import test from 'node:test';
import { Game } from '../js/core/game.js';
import { CONFIG } from '../js/core/config.js';
import { resetGameFixture } from './helpers/game-fixture.js';
import '../js/core/pools.js';
import '../js/systems/cards.js';
import '../js/entities/enemyBullets.js';

function resetFogFixture() {
    resetGameFixture();
    Game.activeCard = 'fog';
    Game.width = 1000;
    Game.height = 1000;
    Game.player = { x: 100, y: 100, width: 30, height: 30 };
    Game.enemyBulletSpeed = CONFIG.enemyBulletSpeed;
}

function speedOf(bullet) {
    return Math.hypot(bullet.vx, bullet.vy);
}

test('fog makes new tracking bullets straight while preserving their aimed direction and slowing them once', () => {
    resetFogFixture();
    const enemy = { x: 0, y: 0, width: 30, height: 30 };

    Game.spawnTrackingBullet(enemy);

    const bullet = Game.objectPools.enemyBullets.active[0];
    const initialDirection = Math.atan2(bullet.vy, bullet.vx);
    assert.equal(bullet.isTracking, false);
    assert.equal(bullet.isStraight, true);
    assert.equal(bullet.fogSpeedApplied, true);
    assert.ok(Math.abs(speedOf(bullet) - CONFIG.enemyBulletSpeed * CONFIG.cards.fogBulletSpeed) < 1e-9);

    Game.player.x = 900;
    Game.player.y = 900;
    Game.updateEnemyBullets();

    assert.equal(bullet.isTracking, false);
    assert.ok(Math.abs(Math.atan2(bullet.vy, bullet.vx) - initialDirection) < 1e-9);
    assert.ok(Math.abs(speedOf(bullet) - CONFIG.enemyBulletSpeed * CONFIG.cards.fogBulletSpeed) < 1e-9);
});

test('fog slows every projectile pattern and never applies its multiplier twice', () => {
    resetFogFixture();
    const enemy = { x: 300, y: 300, width: 30, height: 30 };

    Game.spawnRingBullet(enemy, 1, 1);
    Game.spawnWaveBullet(enemy);
    Game.spawnScatterBullet(enemy);
    Game.spawnExplosionBullet(enemy.x, enemy.y, 1);
    Game.spawnEnemyBullet(enemy);

    const bullets = [...Game.objectPools.enemyBullets.active];
    assert.equal(bullets.some((bullet) => bullet.isRing), true);
    assert.equal(bullets.some((bullet) => bullet.isWave), true);
    assert.equal(bullets.some((bullet) => bullet.isScatter), true);
    assert.equal(bullets.some((bullet) => bullet.isExplosion), true);
    assert.equal(bullets.some((bullet) => bullet.isStraight && !bullet.isTracking), true);
    for (const bullet of bullets) {
        assert.equal(bullet.fogSpeedApplied, true);
        if (bullet.isWave) {
            const waveValue = Math.sin(bullet.waveOffset) * bullet.waveAmplitude;
            assert.ok(Math.abs((bullet.baseVx + waveValue) * CONFIG.cards.fogBulletSpeed - bullet.vx) < 1e-9);
        } else {
            assert.equal(bullet.baseVx * CONFIG.cards.fogBulletSpeed, bullet.vx);
        }
        assert.equal(bullet.baseVy * CONFIG.cards.fogBulletSpeed, bullet.vy);
    }

    Game.updateEnemyBullets();
    const afterFirstUpdate = bullets.map((bullet) => ({
        vx: bullet.vx,
        vy: bullet.vy,
        waveOffset: bullet.waveOffset,
    }));
    Game.updateEnemyBullets();

    assert.equal(bullets[0].vx, afterFirstUpdate[0].vx);
    assert.equal(bullets[0].vy, afterFirstUpdate[0].vy);
    const wave = bullets.find((bullet) => bullet.isWave);
    const expectedWaveVx = (wave.baseVx + Math.sin(wave.waveOffset) * wave.waveAmplitude) * CONFIG.cards.fogBulletSpeed;
    assert.ok(Math.abs(wave.vx - expectedWaveVx) < 1e-9);
    assert.equal(wave.vy, wave.baseVy * CONFIG.cards.fogBulletSpeed);
});

test('an existing tracking bullet loses tracking on the next fog update and keeps its reduced speed', () => {
    resetGameFixture();
    Game.activeCard = null;
    Game.height = 1000;
    Game.width = 1000;
    Game.player = { x: 100, y: 100, width: 30, height: 30 };
    const enemy = { x: 0, y: 0, width: 30, height: 30 };
    Game.spawnTrackingBullet(enemy);

    const bullet = Game.objectPools.enemyBullets.active[0];
    assert.equal(bullet.isTracking, true);
    const direction = Math.atan2(bullet.vy, bullet.vx);
    Game.activeCard = 'fog';
    Game.updateEnemyBullets();

    assert.equal(bullet.isTracking, false);
    assert.equal(bullet.fogSpeedApplied, true);
    assert.ok(Math.abs(Math.atan2(bullet.vy, bullet.vx) - direction) < 1e-9);
    assert.ok(Math.abs(speedOf(bullet) - CONFIG.enemyBulletSpeed * CONFIG.cards.fogBulletSpeed) < 1e-9);
});

test('fog boundary warning is set once when a bullet enters the 40px pre-line band', () => {
    resetFogFixture();
    Game.gameTime = 1000;
    const bullet = {
        x: 100,
        y: 305,
        width: 10,
        height: 10,
        fogWarningShown: false,
        fogWarningUntil: 0,
    };

    Game.updateFogWarningState(bullet, 300);

    assert.equal(bullet.fogWarningShown, true);
    assert.equal(bullet.fogWarningUntil, 1000 + CONFIG.cards.fogWarningDurationMs);

    Game.gameTime = 2000;
    bullet.y = 315;
    Game.updateFogWarningState(bullet, 310);
    assert.equal(bullet.fogWarningUntil, 1000 + CONFIG.cards.fogWarningDurationMs);

    Game.activeCard = null;
    const nonFogBullet = { x: 0, y: 305, width: 10, height: 10 };
    Game.updateFogWarningState(nonFogBullet, 300);
    assert.equal(nonFogBullet.fogWarningShown, undefined);
    assert.equal(nonFogBullet.fogWarningUntil, undefined);
});

test('fog projectile speed and warning thresholds come only from CONFIG', () => {
    resetFogFixture();
    const previous = {
        fogBulletSpeed: CONFIG.cards.fogBulletSpeed,
        fogLineRatio: CONFIG.cards.fogLineRatio,
        fogWarningBandPx: CONFIG.cards.fogWarningBandPx,
        fogWarningDurationMs: CONFIG.cards.fogWarningDurationMs,
    };

    try {
        CONFIG.cards.fogBulletSpeed = 0.73;
        CONFIG.cards.fogLineRatio = 0.42;
        CONFIG.cards.fogWarningBandPx = 17;
        CONFIG.cards.fogWarningDurationMs = 333;

        Game.spawnRingBullet({ x: 0, y: 0, width: 30, height: 30 }, 1, 1);
        const bullet = Game.objectPools.enemyBullets.active[0];
        assert.ok(Math.abs(speedOf(bullet) - CONFIG.enemyBulletSpeed * CONFIG.cards.fogBulletSpeed) < 1e-9);

        Game.gameTime = 400;
        const warningStart = Game.height * CONFIG.cards.fogLineRatio - CONFIG.cards.fogWarningBandPx;
        bullet.y = warningStart - bullet.height / 2 + 1;
        Game.updateFogWarningState(bullet, warningStart - 2);
        assert.equal(bullet.fogWarningShown, true);
        assert.equal(bullet.fogWarningUntil, 733);
    } finally {
        CONFIG.cards.fogBulletSpeed = previous.fogBulletSpeed;
        CONFIG.cards.fogLineRatio = previous.fogLineRatio;
        CONFIG.cards.fogWarningBandPx = previous.fogWarningBandPx;
        CONFIG.cards.fogWarningDurationMs = previous.fogWarningDurationMs;
    }
});
