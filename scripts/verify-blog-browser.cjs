// Run with an available Playwright installation in NODE_PATH.
// BLOG_TEST_URL targets a deployed site; otherwise this script serves the repository locally.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'tests', 'artifacts', 'blog-math');
fs.mkdirSync(output, { recursive: true });
const useWebkit = process.argv.includes('--webkit');
const engine = useWebkit ? webkit : chromium;
const widths = [320, 375, 390, 430, 768, 1280];
const progress = label => { if (process.env.BLOG_TEST_PROGRESS) console.log(label); };
let checks = 0;
const check = (value, message) => { checks++; assert.ok(value, message); };
let server;
async function baseUrl() {
  if (process.env.BLOG_TEST_URL) return process.env.BLOG_TEST_URL;
  server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname) + (url.pathname.endsWith('/') ? 'index.html' : ''));
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    fs.readFile(file, (error, bytes) => {
      if (error) { response.writeHead(404).end(); return; }
      const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
      response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      response.end(bytes);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return 'http://127.0.0.1:' + server.address().port + '/';
}
async function ready(page) {
  await page.locator('#post-body .katex').first().waitFor();
  await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 10000 });
}
async function fits(page, label) {
  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  check(size.scroll <= size.width + 1, label + ': ' + JSON.stringify(size));
}
async function skipIntro(page) {
  await page.evaluate(() => {
    document.documentElement.dataset.introState = 'skipped';
    document.querySelector('[data-yaozi-intro] button')?.click();
  });
}
(async () => {
  const url = await baseUrl();
  const browser = await engine.launch(useWebkit
    ? { headless: true, ...(process.env.WEBKIT_EXECUTABLE ? { executablePath: process.env.WEBKIT_EXECUTABLE } : {}) }
    : { channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ locale: 'zh-CN', reducedMotion: 'reduce', viewport: { width: 1280, height: 960 } });
    const page = await context.newPage();
    const errors = [], missing = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) missing.push(response.url()); });
    await page.goto(url);
    await skipIntro(page);
    check(await page.locator('.game').count() === 12, 'twelve game cards');
    check(await page.locator('.game-paper').count() === 11, 'eleven paper links');
    check(await page.locator('.game a a').count() === 0, 'no nested links');
    const targets = await page.locator('a.game, .game-actions .play:not(.game-paper)').evaluateAll(nodes => nodes.map(n => n.getAttribute('href')));
    check(JSON.stringify(targets) === JSON.stringify(['/pkufighter/', '/clocks/', '/cube/', '/sixteen/', '/knight/', '/tronix/', '/coloring/', '/swap/', '/flip/', '/pegs/', '/robots/', '/hex/']), 'all game entry URLs preserved');
    check(await page.evaluate(() => performance.getEntriesByType('resource').every(r => !r.name.includes('/blog/articles/'))), 'homepage does not fetch article bodies');
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await fits(page, 'games ' + width);
    }
    await page.setViewportSize({ width: 1280, height: 960 });
    await page.screenshot({ path: path.join(output, engine.name() + '-games-desktop.png') });
    const buttons = await page.locator('.game-actions .play').evaluateAll(nodes => nodes.map(n => ({ height: n.getBoundingClientRect().height, radius: getComputedStyle(n).borderRadius })));
    check(buttons.length === 22 && buttons.every(b => b.height >= 43.9 && b.radius === '999px'), 'both actions use matching touch-sized pill buttons: ' + JSON.stringify(buttons));
    const links = await page.locator('.game-paper').evaluateAll(nodes => nodes.map(n => n.getAttribute('href')));
    const report = [];
    for (const [index, href] of links.entries()) {
      await page.goto(url + href);
      await skipIntro(page);
      await ready(page);
      const state = await page.evaluate(() => {
        const body = document.getElementById('post-body');
        const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
        const raw = [];
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (!node.parentElement.closest('.katex,code,pre') && node.textContent.includes('$')) raw.push(node.textContent);
        }
        return {
          formulas: body.querySelectorAll('.katex').length,
          blocks: body.querySelectorAll('.katex-display').length,
          mathml: body.querySelectorAll('math').length,
          failures: body.querySelectorAll('.katex-error').length,
          raw: raw.slice(0, 5),
          brokenLinks: [...body.querySelectorAll('a')].filter(a => /\d\d-[a-z]+\.md/.test(a.getAttribute('href'))).map(a => a.getAttribute('href')),
          font: [...document.fonts].filter(f => f.family.includes('KaTeX') && f.status === 'loaded').length
        };
      });
      check(state.formulas > 100 && state.blocks > 0, href + ' has rendered math');
      check(state.mathml === state.formulas && state.failures === 0, href + ' accessible math without errors');
      check(state.raw.length === 0, href + ' raw formula delimiters: ' + JSON.stringify(state.raw));
      check(state.brokenLinks.length === 0, href + ' cross-article links');
      check(state.font > 0, href + ' local math fonts loaded');
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        await fits(page, href + ' ' + width);
      }
      await page.setViewportSize({ width: 844, height: 390 });
      await fits(page, href + ' landscape');
      await page.locator('#theme-toggle').click();
      await fits(page, href + ' theme change');
      report.push({ href, ...state });
      progress('Checked ' + href);
      if ([0, 7].includes(index)) {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('.math-block').first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, engine.name() + '-paper-' + index + '-mobile.png') });
      }
    }
    progress('Checking navigation');
    // A Chinese-only paper remains readable when the interface switches to English.
    const before = await page.locator('#post-title').textContent();
    await page.locator('#language-en').click();
    await ready(page);
    check(await page.locator('#post-title').textContent() === before, 'English interface falls back to Chinese article');
    await page.locator('[data-section-link="games"]').click();
    check((await page.locator('.game-paper').first().innerText()).replace(/\s+/g, ' ').trim() === 'Read paper', 'English paper action');
    await page.locator('.game-paper').first().focus();
    await page.keyboard.press('Enter');
    await ready(page);
    check((await page.locator('#post-title').textContent()).includes('十步万度'), 'keyboard paper entry');
    await page.locator('#post-back').click();
    check(await page.locator('#post-list .post-item').count() >= 11, 'blog list includes all papers');
    await page.goBack();
    await ready(page);
    check((await page.locator('#post-title').textContent()).includes('十步万度'), 'browser back restores article');
    await page.reload();
    await skipIntro(page);
    await ready(page);
    check((await page.locator('#post-title').textContent()).includes('十步万度'), 'deep-link refresh');
    // Test failure/retry and late replies only on the local server.
    if (!process.env.BLOG_TEST_URL) {
      progress('Checking failed request');
      const fail = await context.newPage();
      let aborted = false;
      await fail.route('**/blog/articles/math-games-08-flip.js*', route => { if (!aborted) { aborted = true; return route.abort(); } return route.continue(); });
      await fail.goto(url + '#blog/math-games-08-flip');
      await skipIntro(fail);
      await fail.locator('.post-retry').waitFor();
      await fail.locator('.post-retry').click();
      await ready(fail);
      check((await fail.locator('#post-title').textContent()).includes('翻转'), 'failed article can retry');
      progress('Checking delayed request');
      const delayed = await context.newPage();
      let release;
      await delayed.route('**/blog/articles/math-games-01-clocks.js*', async route => { await new Promise(resolve => { release = resolve; }); await route.continue(); });
      await delayed.goto(url + '#blog/math-games-01-clocks', { waitUntil: 'domcontentloaded' });
      await skipIntro(delayed);
      await delayed.locator('#post-body[aria-busy="true"]').waitFor();
      await delayed.evaluate(() => { location.hash = '#blog/math-games-02-cube'; });
      await ready(delayed);
      release();
      await delayed.waitForFunction(() => window.YAOZI_BLOG_ARTICLES?.['math-games-01-clocks']);
      check((await delayed.locator('#post-title').textContent()).includes('立方体') && (await delayed.locator('#post-body').innerText()).includes('Cube'), 'late response cannot replace active article');
      await fail.close(); await delayed.close();
      // Static script assets also preserve file:// reading.
      progress('Checking file URL');
      const offline = await context.newPage();
      await offline.goto(pathToFileURL(path.join(root, 'index.html')).href + '#blog/math-games-08-flip');
      await skipIntro(offline);
      await ready(offline);
      check(await offline.locator('#post-body .katex').count() > 100, 'file URL formula rendering');
      await offline.close();
    }
    progress('Checking blocked storage');
    const blocked = await browser.newContext({ locale: 'zh-CN', reducedMotion: 'reduce', viewport: { width: 375, height: 812 } });
    await blocked.addInitScript(() => { Storage.prototype.getItem = Storage.prototype.setItem = () => { throw Error('blocked'); }; });
    const blockedPage = await blocked.newPage();
    await blockedPage.goto(url + '#blog/math-games-09-pegs');
    await skipIntro(blockedPage); await ready(blockedPage); await fits(blockedPage, 'storage blocked');
    const touchContext = await browser.newContext({ locale: 'zh-CN', reducedMotion: 'reduce', hasTouch: true, viewport: { width: 390, height: 844 } });
    const touch = await touchContext.newPage();
    await touch.goto(url); await skipIntro(touch);
    await touch.locator('article.game').first().evaluate(element => window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 80));
    await touch.locator('article.game').first().screenshot({ path: path.join(output, engine.name() + '-card-mobile.png') });
    await touch.locator('.game-paper').first().tap(); await ready(touch);
    check((await touch.locator('#post-title').textContent()).includes('十步万度'), 'touch paper button');
    await touch.locator('[data-section-link="games"]').tap();
    await touch.locator('.game-actions .play:not(.game-paper)').first().tap();
    await touch.waitForURL('**/clocks/');
    check(new URL(touch.url()).pathname === '/clocks/', 'touch play button opens game');
    await touchContext.close();
    check(errors.length === 0 && missing.length === 0, JSON.stringify({ errors, missing }));
    console.log(JSON.stringify({ passed: true, engine: engine.name(), url, checks, formulas: report.reduce((n,p)=>n+p.formulas,0), report, screenshots: output }, null, 2));
  } finally { await browser.close(); server?.close(); }
})().catch(error => { console.error(error); server?.close(); process.exitCode = 1; });
