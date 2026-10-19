const assert = require('node:assert/strict');
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.HEX_TEST_URL || 'http://127.0.0.1:8782/hex/';
const slow = process.argv.includes('--slow-network');
const fallback = process.argv.includes('--no-worker');
const delayMs = fallback ? 12000 : 34000;
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
async function run(kind) {
  const browser = await pw[kind].launch({ headless: true, ...(kind === 'chromium' ? { channel: process.platform === 'win32' ? 'msedge' : undefined } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'zh-CN' });
    if (fallback) await context.addInitScript(() => { window.Worker = function() { throw Error('Workers unavailable'); }; });
    let heap = 0, downloads = 0;
    // Instrument heap growth without changing allocations or native search.
    await context.route('**/vendor/mohex/mohex.js*', async route => {
      downloads++;
      if (slow) await new Promise(resolve => setTimeout(resolve, delayMs));
      const response = await route.fetch();
      const source = (await response.text()).replace('var b = getMemoryBuffer();', "var b = getMemoryBuffer(); console.log('HEX_HEAP ' + b.byteLength);");
      await route.fulfill({ response, body: source });
    });
    const page = await context.newPage();
    page.on('console', event => { if (event.text().startsWith('HEX_HEAP ')) heap = Math.max(heap, Number(event.text().slice(9))); });
    await page.goto(base);
    const started = Date.now();
    await page.evaluate(() => HexGame.startFree(13, 'high'));
    if (slow) {
      await page.waitForTimeout(delayMs - 3000);
      const loading = await page.evaluate(() => HexGame.snapshot());
      check(loading.thinking && loading.aiPhase === 'loading', `${kind}: slow download remains in loading phase`);
      check((await page.locator('#thinking-text').textContent()).includes('下载'), `${kind}: UI explains the download`);
      await page.locator('#theme').click();
    }
    await page.waitForFunction(() => !HexGame.snapshot().thinking, null, { timeout: slow ? 90000 : 30000 });
    let state = await page.evaluate(() => HexGame.snapshot());
    check(!state.engineError, `${kind}: cold High opening must finish${slow ? ` after a ${delayMs}ms engine download` : ''}`);
    check(state.engine === 'mohex-2.0' && state.state.moves.length === 1 && state.state.turn === state.state.human, `${kind}: real MoHex opens as red`);
    check(heap > 0 && heap <= 192 * 1048576, `${kind}: opening heap ${heap / 1048576} MiB must fit 192 MiB`);
    const openingMs = Date.now() - started;
    const empty = state.state.board.findIndex(v => !v);
    await page.locator(`[data-index="${empty}"]`).tap();
    await page.waitForFunction(() => !HexGame.snapshot().thinking, null, { timeout: 30000 });
    state = await page.evaluate(() => HexGame.snapshot());
    check(!state.engineError && state.state.moves.length === 3, `${kind}: next real High reply completes`);
    check(state.analysis.source === (fallback ? 'fallback' : 'worker'), `${kind}: expected engine transport`);
    check(heap <= 192 * 1048576, `${kind}: reply also fits 192 MiB`);
    check(downloads === 1, `${kind}: runtime reused rather than downloaded again`);
    console.log(`${kind}: cold opening ${openingMs}ms, peak heap ${heap / 1048576} MiB, ${checks} checks passed (${fallback ? 'fallback' : 'worker'}${slow ? `, ${delayMs}ms delayed download` : ''}).`);
  } finally { await browser.close(); }
}
(async () => { for (const kind of process.argv.includes('--edge-only') ? ['chromium'] : ['webkit', 'chromium']) await run(kind); })().catch(error => { console.error(error); process.exitCode = 1; });
