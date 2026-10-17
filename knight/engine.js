/* Crown Tour: open knight's tours on rectangular boards from 5x5 to 8x8. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.createCrownTourEngine = factory; root.CrownTourEngine = factory(); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createCrownTourEngine() {
  'use strict';
  const MOVES = Object.freeze([
    Object.freeze([1, 2]), Object.freeze([2, 1]), Object.freeze([2, -1]), Object.freeze([1, -2]),
    Object.freeze([-1, -2]), Object.freeze([-2, -1]), Object.freeze([-2, 1]), Object.freeze([-1, 2])
  ]);
  const MIN_SIZE = 5, MAX_SIZE = 8, DEFAULT_NODE_LIMIT = 1500000, GENERATE_NODE_LIMIT = 500000;
  const LEVELS = Object.freeze([
    { name: '初巡', w: 5, h: 5, start: 0, end: null,
      solution: [0, 7, 4, 13, 24, 17, 20, 11, 2, 5, 16, 23, 14, 3, 6, 15, 22, 19, 8, 1, 10, 21, 12, 9, 18] },
    { name: '边城', w: 5, h: 6, start: 0, end: null,
      solution: [0, 7, 4, 13, 24, 27, 20, 11, 2, 5, 16, 25, 22, 29, 18, 9, 12, 1, 8, 19, 28, 21, 10, 17, 6, 3, 14, 23, 26, 15] },
    { name: '五七纵横', w: 5, h: 7, start: 0, end: null,
      solution: [0, 7, 4, 13, 2, 5, 16, 25, 32, 29, 18, 9, 12, 1, 10, 21, 30, 27, 34, 23, 14, 3, 6, 15, 26, 33, 24, 17, 8, 11, 20, 31, 22, 19, 28] },
    { name: '方阵', w: 6, h: 6, start: 0, end: null,
      solution: [0, 8, 4, 17, 28, 32, 24, 13, 2, 6, 19, 30, 26, 34, 21, 10, 23, 15, 11, 3, 7, 18, 31, 27, 35, 22, 14, 1, 9, 5, 16, 29, 33, 20, 12, 25] },
    { name: '长河', w: 5, h: 8, start: 0, end: null,
      solution: [0, 7, 4, 13, 2, 5, 16, 25, 36, 33, 24, 27, 30, 37, 34, 23, 14, 3, 6, 15, 26, 35, 32, 39, 28, 17, 10, 1, 8, 19, 22, 11, 20, 31, 38, 29, 18, 9, 12, 21] },
    { name: '交错', w: 6, h: 7, start: 0, end: null,
      solution: [0, 8, 4, 17, 9, 5, 16, 3, 11, 22, 35, 39, 31, 18, 7, 20, 12, 1, 14, 6, 2, 10, 23, 15, 28, 41, 33, 29, 40, 27, 19, 30, 38, 25, 36, 32, 21, 34, 26, 13, 24, 37] },
    { name: '六八之间', w: 6, h: 8, start: 0, end: null,
      solution: [0, 8, 4, 17, 9, 5, 16, 3, 11, 22, 35, 46, 38, 42, 31, 18, 7, 20, 12, 1, 14, 6, 2, 10, 23, 27, 19, 15, 28, 41, 45, 34, 47, 39, 43, 30, 26, 13, 24, 37, 33, 25, 21, 29, 40, 32, 36, 44] },
    { name: '七曜', w: 7, h: 7, start: 0, end: null,
      solution: [0, 9, 4, 13, 26, 41, 46, 33, 48, 39, 34, 47, 38, 43, 28, 15, 2, 7, 22, 35, 44, 29, 42, 37, 24, 11, 6, 19, 10, 1, 14, 23, 8, 3, 12, 17, 32, 27, 18, 5, 20, 25, 16, 21, 30, 45, 36, 31, 40] },
    { name: '原野', w: 7, h: 8, start: 0, end: null,
      solution: [0, 9, 4, 13, 26, 41, 54, 45, 50, 35, 22, 7, 2, 11, 6, 19, 34, 47, 52, 43, 28, 15, 10, 1, 14, 23, 8, 3, 12, 17, 32, 27, 18, 5, 20, 25, 30, 21, 16, 29, 42, 37, 24, 39, 48, 33, 38, 51, 36, 49, 44, 53, 40, 31, 46, 55] },
    { name: '八方', w: 8, h: 8, start: 0, end: null,
      solution: [0, 10, 4, 14, 31, 46, 63, 53, 47, 62, 52, 58, 48, 33, 16, 1, 11, 5, 15, 21, 6, 23, 38, 55, 61, 51, 57, 40, 25, 8, 2, 17, 32, 42, 59, 49, 34, 24, 9, 3, 18, 12, 27, 44, 29, 19, 36, 26, 41, 56, 50, 35, 20, 30, 13, 7, 22, 28, 43, 37, 54, 39, 45, 60] },
    { name: '王座之心', w: 8, h: 8, start: 27, end: null,
      solution: [27, 10, 0, 17, 2, 8, 25, 40, 57, 42, 32, 49, 59, 53, 63, 46, 31, 14, 4, 19, 9, 3, 13, 7, 22, 5, 15, 21, 6, 12, 29, 23, 38, 55, 61, 44, 34, 24, 18, 1, 11, 28, 43, 58, 48, 33, 16, 26, 36, 51, 41, 56, 50, 60, 54, 39, 45, 30, 20, 35, 52, 37, 47, 62] },
    { name: '极远之角', w: 8, h: 8, start: 0, end: 56,
      solution: [0, 10, 4, 14, 31, 46, 63, 53, 47, 62, 52, 58, 48, 33, 16, 1, 11, 5, 15, 21, 6, 23, 38, 55, 61, 51, 57, 40, 25, 8, 2, 17, 32, 42, 59, 49, 34, 24, 9, 3, 18, 12, 27, 44, 29, 19, 36, 26, 41, 35, 20, 30, 13, 7, 22, 28, 43, 37, 54, 39, 45, 60, 50, 56] }
  ].map(level => Object.freeze({ ...level, solution: Object.freeze(level.solution.slice()) })));
  const neighborCache = new Map();

  function assertBoard(w, h) {
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < MIN_SIZE || w > MAX_SIZE || h < MIN_SIZE || h > MAX_SIZE) {
      throw new TypeError('Board dimensions must be integers from 5 to 8');
    }
  }
  function neighborTable(w, h) {
    const key = w + 'x' + h;
    let table = neighborCache.get(key);
    if (table) return table;
    table = Array.from({ length: w * h }, () => []);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const from = y * w + x;
      for (const [dx, dy] of MOVES) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) table[from].push(ny * w + nx);
      }
    }
    neighborCache.set(key, table);
    return table;
  }
  function neighbors(index, w, h) {
    assertBoard(w, h);
    if (!Number.isInteger(index) || index < 0 || index >= w * h) throw new RangeError('Invalid cell');
    return neighborTable(w, h)[index].slice();
  }
  function isKnightMove(from, to, w, h) {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= w * h || to < 0 || to >= w * h) return false;
    const dx = Math.abs(from % w - to % w), dy = Math.abs(Math.floor(from / w) - Math.floor(to / w));
    return (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
  }
  function coord(index, w) {
    return String.fromCharCode(65 + index % w) + (Math.floor(index / w) + 1);
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function random() {
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  // Continue any valid prefix. The returned path begins with `initial`.
  function extend(w, h, initial, options = {}) {
    assertBoard(w, h);
    const end = options.end === undefined ? null : options.end;
    const seed = options.seed === undefined ? 0x9E3779B9 : options.seed;
    const nodeLimit = options.nodeLimit === undefined ? DEFAULT_NODE_LIMIT : options.nodeLimit;
    if (!Number.isInteger(nodeLimit) || nodeLimit < 1) throw new TypeError('Invalid node limit');
    const total = w * h;
    if (!Array.isArray(initial) || initial.length < 1 || initial.length > total) throw new TypeError('Invalid initial path');
    if (end !== null && (!Number.isInteger(end) || end < 0 || end >= total)) throw new TypeError('Invalid end cell');
    const path = initial.slice(), seen = new Uint8Array(total);
    for (let i = 0; i < path.length; i++) {
      const cell = path[i];
      if (!Number.isInteger(cell) || cell < 0 || cell >= total || seen[cell]) throw new TypeError('Invalid initial path');
      if (i && !isKnightMove(path[i - 1], cell, w, h)) throw new TypeError('Initial path is not a knight path');
      seen[cell] = 1;
    }
    const last = path[path.length - 1];
    if (path.length === total) return { solution: end === null || last === end ? path.slice() : null, nodes: 0, limit: false };
    // The endpoint cannot be visited before the final step.
    if (end !== null && seen[end]) return { solution: null, nodes: 0, limit: false };
    const table = neighborTable(w, h), answer = new Int32Array(total), rng = mulberry32(seed);
    for (let i = 0; i < path.length; i++) answer[i] = path[i];
    let nodes = 0, aborted = false;
    function degree(cell) {
      let count = 0;
      const list = table[cell];
      for (let i = 0; i < list.length; i++) if (!seen[list[i]]) count++;
      return count;
    }
    function dfs(cell, count) {
      if (++nodes > nodeLimit) { aborted = true; return false; }
      if (count === total) return end === null || cell === end;
      const candidates = [], list = table[cell];
      for (let i = 0; i < list.length; i++) {
        const next = list[i];
        if (seen[next]) continue;
        if (end !== null) {
          // Reserve the throne for the final step.
          if (next === end ? count !== total - 1 : count === total - 1) continue;
        }
        candidates.push({ cell: next, degree: degree(next), order: rng() });
      }
      candidates.sort((a, b) => a.degree - b.degree || a.order - b.order);
      for (const candidate of candidates) {
        seen[candidate.cell] = 1; answer[count] = candidate.cell;
        if (dfs(candidate.cell, count + 1)) return true;
        seen[candidate.cell] = 0;
        if (aborted) return false;
      }
      return false;
    }
    const found = dfs(last, path.length);
    return { solution: found ? Array.from(answer) : null, nodes, limit: aborted };
  }
  function solve(w, h, start, options = {}) {
    return extend(w, h, [start], options);
  }
  function verifyTour(w, h, path, options = {}) {
    try { assertBoard(w, h); } catch { return false; }
    if (!Array.isArray(path) || path.length !== w * h) return false;
    const start = options.start === undefined ? path[0] : options.start;
    const end = options.end === undefined ? null : options.end;
    if (path[0] !== start || (end !== null && path[path.length - 1] !== end)) return false;
    const seen = new Uint8Array(w * h);
    for (let i = 0; i < path.length; i++) {
      const cell = path[i];
      if (!Number.isInteger(cell) || cell < 0 || cell >= w * h || seen[cell]) return false;
      if (i && !isKnightMove(path[i - 1], cell, w, h)) return false;
      seen[cell] = 1;
    }
    return true;
  }
  // A deterministic, solvable board for any seed. Odd-area boards start on the
  // majority colour; all other starts are tried with randomized Warnsdorff order.
  function generate(seed, options = {}) {
    const attempts = options.attempts === undefined ? 40 : options.attempts;
    const nodeLimit = options.nodeLimit === undefined ? GENERATE_NODE_LIMIT : options.nodeLimit;
    const rng = mulberry32(seed >>> 0 || 1);
    const boards = [];
    for (let w = MIN_SIZE; w <= MAX_SIZE; w++) for (let h = w; h <= MAX_SIZE; h++) boards.push([w, h]);
    for (let attempt = 0; attempt < attempts; attempt++) {
      const [w, h] = boards[Math.floor(rng() * boards.length)];
      const total = w * h, odd = total % 2 === 1, starts = [];
      for (let cell = 0; cell < total; cell++) {
        if (!odd || ((cell % w + Math.floor(cell / w)) & 1) === 0) starts.push(cell);
      }
      const start = starts[Math.floor(rng() * starts.length)];
      const result = extend(w, h, [start], { seed: (rng() * 4294967296) >>> 0, nodeLimit });
      if (result.solution) return { w, h, start, end: null, solution: result.solution, nodes: result.nodes, seed: seed >>> 0 };
    }
    return null;
  }
  function dailyKey(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }
  function dailySeed(date = new Date()) {
    return (Number(dailyKey(date).replace(/\D/g, '')) ^ 0x9E3779B9) >>> 0;
  }
  function randomSeed(nextUint32) {
    if (typeof nextUint32 === 'function') return nextUint32() >>> 0;
    try { return globalThis.crypto.getRandomValues(new Uint32Array(1))[0]; }
    catch { return (Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0; }
  }
  return Object.freeze({
    MOVES, MIN_SIZE, MAX_SIZE, LEVELS, DEFAULT_NODE_LIMIT,
    neighbors, isKnightMove, coord, extend, solve, verifyTour, generate,
    dailyKey, dailySeed, randomSeed
  });
});
