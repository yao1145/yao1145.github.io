(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'), true);
  else root.HexAI = factory(root.HexEngine, false);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (E, node) {
  'use strict';
  // This module is a transport/ABI adapter. All move selection is MoHex 2.0.
  const clock = () => typeof performance !== 'undefined' ? performance.now() : Date.now();
  const pause = () => new Promise(resolve => setTimeout(resolve, 0));
  const base = !node && typeof document !== 'undefined' ? new URL('.', document.currentScript.src) : null;
  let loading = null, queue = Promise.resolve();
  function script(name) {
    if (typeof importScripts === 'function') { importScripts(name); return Promise.resolve(); }
    return new Promise((resolve, reject) => {
      const tag = document.createElement('script'); tag.src = new URL(name, base).href;
      tag.onload = resolve; tag.onerror = () => { tag.remove(); reject(Error('MoHex engine could not load')); };
      document.head.append(tag);
    });
  }
  function load() {
    if (!loading) loading = (async () => {
      let factory, patterns;
      if (node) { factory = require('./vendor/mohex/mohex.js'); patterns = require('./vendor/mohex/patterns.js'); }
      else {
        if (!globalThis.createMoHex) await script('vendor/mohex/mohex.js');
        if (!globalThis.MoHexPatterns) await script('vendor/mohex/patterns.js');
        factory = globalThis.createMoHex; patterns = globalThis.MoHexPatterns;
      }
      const engine = await factory({ print: () => {}, printErr: () => {} });
      engine.FS.mkdir('/share');
      for (const [name, text] of Object.entries(patterns)) engine.FS.writeFile('/share/' + name, text);
      return engine;
    })().catch(error => { loading = null; throw error; });
    return loading;
  }
  async function run(request, onProgress, isCancelled) {
    const started = clock(), n = request.size, color = request.player || 2;
    if (!Number.isInteger(n) || n < 2 || n > 13 || !request.board || request.board.length !== n * n ||
      ![1, 2].includes(color) || Array.from(request.board).some(v => ![0, 1, 2].includes(v))) throw Error('Invalid Hex search');
    const board = Array.from(request.board), difficulty = request.difficulty || 'easy';
    const stopped = () => Boolean(isCancelled && isCancelled());
    const cancelled = () => ({ move: -1, swap: request.action === 'swap' ? null : undefined, iterations: 0, winRate: null, depth: 0, elapsedMs: clock() - started, algorithm: 'MoHex 2.0 · Benzene', engine: 'mohex-2.0' });
    if (stopped() || E.winner(board, n) || !board.includes(0)) return cancelled();
    if (request.action === 'swap' && (color !== 2 || board.filter(v => v === 1).length !== 1 || board.includes(2))) throw Error('Invalid swap position');
    await pause(); if (stopped()) return cancelled();
    const engine = await load(); if (stopped()) return cancelled();
    const budget = Math.max(5, Math.min(15000, Number(request.budgetMs) || 100));
    const maxGames = request.maxIterations === undefined ? (difficulty === 'easy' ? 192 : 10000000) : Math.max(1, Math.min(10000000, Math.floor(request.maxIterations)));
    engine.hexProgress = (iterations, winRate) => {
      if (stopped()) { engine._hex_cancel(); return; }
      if (onProgress) onProgress({ iterations, winRate, elapsedMs: clock() - started });
    };
    const timer = setInterval(() => { if (stopped()) engine._hex_cancel(); }, 16);
    try {
      const raw = await engine.ccall('hex_search', 'string',
        ['string', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
        [board.join(''), n, color, difficulty === 'easy' ? 0 : difficulty === 'high' ? 2 : 1,
          budget, maxGames, request.seed === undefined ? Math.floor(Math.random() * 2147483646) + 1 : (request.seed >>> 0) % 2147483646 + 1, request.action === 'swap' ? 1 : 0],
        { async: true });
      if (stopped()) return cancelled();
      const result = JSON.parse(raw);
      if (result.error) throw Error(result.error);
      if (!(request.action === 'swap' && result.swap) && (!Number.isInteger(result.move) || result.move < 0 || result.move >= n * n || board[result.move])) throw Error('MoHex returned an illegal move');
      return { ...result, algorithm: 'MoHex 2.0 · patterns, virtual connections and RAVE', engine: 'mohex-2.0', elapsedMs: clock() - started };
    } finally { clearInterval(timer); engine.hexProgress = null; }
  }
  function search(request, onProgress, isCancelled) {
    // Asyncify supports one active C++ stack per module. Cancelled searches finish
    // before an undo/restart can enter the same runtime again.
    const result = queue.then(() => run(request, onProgress, isCancelled));
    queue = result.catch(() => {});
    return result;
  }
  return { search };
});
