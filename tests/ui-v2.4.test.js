import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const hudCss = fs.readFileSync(new URL('../css/ui/hud.css', import.meta.url), 'utf8');
const cardsCss = fs.readFileSync(new URL('../css/ui/cards.css', import.meta.url), 'utf8');
const responsiveCss = fs.readFileSync(new URL('../css/responsive/responsive.css', import.meta.url), 'utf8');

test('v2.4 static card and build copy matches the new gameplay rules', () => {
    for (const requiredText of [
        '资源加载中 0/9…',
        '敌机攻速+50%（Boss同样）',
        '热机状态下玩家攻速翻倍',
        '每 10 个不同批次命中追加 10D',
        '无论血量改为 15D',
        '10 个不同批次命中触发 20D 精准打击',
        '记忆窗口 5000ms',
        '无论血量改为 40D',
        'Boss 触发后 2000ms 内追加 2D',
        '最多叠加 3 层',
        '1+2+3 发敌弹',
        '脉冲期间攻速+50%（玩家射速）',
    ]) {
        assert.equal(indexHtml.includes(requiredText), true, `v2.4 copy missing: ${requiredText}`);
    }

    assert.equal(indexHtml.includes('敌弹更快'), false);
    assert.equal(indexHtml.includes('敌弹速度 ×2'), false);
    assert.equal(indexHtml.includes('触发 2D 精准打击'), false);
    assert.equal(indexHtml.includes('低血改 3D'), false);
    assert.equal(indexHtml.includes('3000ms 或低血'), false);

    for (const removedBadge of ['武汉大学', '中国人民大学', '华中科技大学', '中国科学院大学']) {
        assert.equal(indexHtml.includes(removedBadge), false, `removed badge remains in intro: ${removedBadge}`);
    }
    for (const enemyBadge of ['南开大学', '复旦大学', '西安交通大学', '中国科学技术大学', '哈尔滨工业大学']) {
        assert.equal(indexHtml.split(enemyBadge).length - 1, 1, `enemy badge should appear once: ${enemyBadge}`);
    }
});

test('v2.4 status indicators use centered rectangular labels', () => {
    const cardRule = cardsCss.match(/\.cardIndicator\s*\{([\s\S]*?)\}/)?.[1] || '';
    assert.match(cardRule, /display:\s*flex/);
    assert.match(cardRule, /align-items:\s*center/);
    assert.match(cardRule, /justify-content:\s*center/);
    assert.match(cardRule, /min-height:\s*24px/);
    assert.match(cardRule, /padding:\s*4px\s+8px/);
    assert.match(cardRule, /border-radius:\s*4px/);
    assert.doesNotMatch(cardRule, /border-radius:\s*50%/);
    assert.doesNotMatch(cardRule, /width:\s*24px/);

    const sharedRule = hudCss.match(/\.shieldIndicator, \.attackIndicator, \.summonIndicator\s*\{([\s\S]*?)\}/)?.[1] || '';
    assert.match(sharedRule, /align-items:\s*center/);
    assert.match(sharedRule, /justify-content:\s*center/);
    assert.match(sharedRule, /box-sizing:\s*border-box/);
    assert.match(sharedRule, /line-height:\s*1\.2/);
    assert.match(hudCss, /\.shieldIndicator\[style\*="display: block"\][\s\S]*display:\s*flex\s*!important/);
    assert.match(hudCss, /\.summonIndicator\[style\*="display: block"\][\s\S]*display:\s*flex\s*!important/);
    assert.doesNotMatch(responsiveCss, /\.cardIndicator\s*\{[\s\S]*?width:\s*24px/);
    assert.doesNotMatch(responsiveCss, /\.cardIndicator\s*\{[\s\S]*?height:\s*24px/);
});
