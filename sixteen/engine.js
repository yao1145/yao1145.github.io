/* Sixteen: all legal moves cost one step, including a 90-degree rotation. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.createSixteenEngine = factory; root.SixteenEngine = factory(); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createSixteenEngine() {
  'use strict';
  const GOAL = 'ABCDEFGHIJKLMNOP';
  const MOVES = [];
  function add(kind, row, col, direction, cells) {
    MOVES.push({ id: MOVES.length, kind, row, col, direction, cells });
  }
  for (let r = 0; r < 4; r++) {
    const cells = [0, 1, 2, 3].map(c => r * 4 + c);
    add('row', r, null, -1, cells); add('row', r, null, 1, cells);
  }
  for (let c = 0; c < 4; c++) {
    const cells = [0, 1, 2, 3].map(r => r * 4 + c);
    add('column', null, c, -1, cells); add('column', null, c, 1, cells);
  }
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const cells = [r * 4 + c, r * 4 + c + 1, (r + 1) * 4 + c + 1, (r + 1) * 4 + c];
    add('rotate', r, c, 1, cells); add('rotate', r, c, -1, cells);
  }
  function move(board, id) {
    const m = MOVES[id];
    if (!m) throw new RangeError('Unknown move');
    const result = board.split('');
    m.cells.forEach((from, i) => { result[m.cells[(i + m.direction + 4) % 4]] = board[from]; });
    return result.join('');
  }
  function play(state, id, budget) {
    if (state.status !== 'playing') return state;
    const board = move(state.board, id), used = state.used + 1;
    return { board, used, status: board === GOAL ? 'won' : used >= budget ? 'lost' : 'playing' };
  }
  const correct = board => [...board].filter((v, i) => v === GOAL[i]).length;
  const valid = board => typeof board === 'string' && board.length === 16 && [...board].sort().join('') === GOAL;
  function distanceSum(board) {
    let sum = 0;
    for (let p = 0; p < 16; p++) {
      const value = board.charCodeAt(p) - 65, dr = Math.abs((p >> 2) - (value >> 2)), dc = Math.abs((p & 3) - (value & 3));
      sum += Math.min(dr, 4 - dr) + Math.min(dc, 4 - dc);
    }
    return sum;
  }
  function parity(board) {
    let odd = 0;
    for (let p = 0; p < 16; p++) for (let q = p + 1; q < 16; q++) odd ^= Number(board[p] > board[q]);
    return odd;
  }
  // Every action moves four tiles by one toroidal edge, reducing sum by at most 4.
  // Every action is an odd 4-cycle, so solution length must match board parity.
  function lowerBound(board) {
    let bound = Math.ceil(distanceSum(board) / 4);
    if ((bound & 1) !== parity(board)) bound++;
    return bound;
  }
  const EXTREME = { board: 'LKIJOPMNCDABGHEF', solution: [2,2,4,4,6,6,8,8,14,14,18,13,24,4,10,24,13] };
  const MAX_CERTIFIED = lowerBound(EXTREME.board);
  const certified = new Map([[EXTREME.board, EXTREME.solution]]);
  const symmetries = Array.from({ length: 8 }, (_, symmetry) => Array.from({ length: 16 }, (_, p) => {
    let r = p >> 2, c = p & 3;
    if (symmetry >= 4) c = 3 - c;
    for (let i = 0; i < symmetry % 4; i++) [r, c] = [c, 3 - r];
    return r * 4 + c;
  }));
  function transform(board, positions) {
    const output = [];
    for (let p = 0; p < 16; p++) output[positions[p]] = String.fromCharCode(65 + positions[board.charCodeAt(p) - 65]);
    return output.join('');
  }
  const moveStates = MOVES.map(m => move(GOAL, m.id));
  const symmetryActions = symmetries.map(positions => moveStates.map(b => moveStates.indexOf(transform(b, positions))));
  function registerCertificate(level) {
    if (!valid(level.board) || !Array.isArray(level.solution) || level.solution.length !== level.optimal || lowerBound(level.board) !== level.optimal || level.solution.reduce(move, level.board) !== GOAL) throw new Error('Invalid shortest-path certificate');
    certified.set(level.board, level.solution.slice());
  }
  const wait = () => new Promise(resolve => setTimeout(resolve, 0));
  let goalTable;
  // Exact radius-three BFS on all 34 moves. Entries point back toward the goal.
  async function table() {
    if (goalTable) return goalTable;
    goalTable = (async () => {
      const seen = new Map([[GOAL, { depth: 0, parent: null, action: null }]]);
      let layer = [GOAL];
      for (let depth = 1; depth <= 3; depth++) {
        const next = [];
        for (let i = 0; i < layer.length; i++) {
          const board = layer[i];
          for (let action = 0; action < MOVES.length; action++) {
            const child = move(board, action);
            if (seen.has(child)) continue;
            seen.set(child, { depth, parent: board, action: action ^ 1 }); next.push(child);
          }
          if (i % 200 === 199) await wait();
        }
        layer = next; await wait();
      }
      return seen;
    })();
    return goalTable;
  }
  async function solve(start) {
    if (!valid(start)) throw new Error('Invalid board');
    if (certified.has(start)) return certified.get(start).slice();
    const back = await table();
    function tail(board) {
      const route = [];
      while (board !== GOAL) { const item = back.get(board); route.push(item.action); board = item.parent; }
      return route;
    }
    if (back.has(start)) return tail(start);
    const seen = new Map([[start, { parent: null, action: null }]]);
    let layer = [start];
    for (let depth = 1; depth <= 3; depth++) {
      const next = []; let match = null, distance = Infinity;
      for (let i = 0; i < layer.length; i++) {
        const board = layer[i];
        for (let action = 0; action < MOVES.length; action++) {
          const child = move(board, action);
          if (seen.has(child)) continue;
          seen.set(child, { parent: board, action }); next.push(child);
          const hit = back.get(child);
          if (hit && depth + hit.depth < distance) { match = child; distance = depth + hit.depth; }
        }
        if (i % 200 === 199) await wait();
      }
      if (match !== null) {
        const prefix = []; let board = match;
        while (board !== start) { const item = seen.get(board); prefix.push(item.action); board = item.parent; }
        return prefix.reverse().concat(tail(match));
      }
      layer = next; await wait();
    }
    return null; // Generic BFS covers <= 6; deeper generated boards carry exact certificates.
  }
  function rng(seed) {
    let x = seed >>> 0;
    return () => { x += 0x6D2B79F5; let t = x; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  async function generate(depth, seed) {
    if (!Number.isInteger(depth) || depth < 6 || depth > MAX_CERTIFIED) throw new RangeError(`Depth must be 6–${MAX_CERTIFIED}`);
    const random = rng(seed);
    if (depth > 6) {
      let board, solution;
      // Diverse geodesics: every step adds exactly four units of displacement.
      // The displacement lower bound then proves that the reverse path is optimal.
      if (depth < 16) for (let attempt = 0; attempt < 16 && !solution; attempt++) {
        let b = GOAL; const scramble = [];
        for (let i = 0; i < depth; i++) {
          const options = MOVES.filter(m => distanceSum(move(b, m.id)) === (i + 1) * 4);
          if (!options.length) break;
          const id = options[Math.floor(random() * options.length)].id; b = move(b, id); scramble.push(id);
        }
        if (scramble.length === depth) { board = b; solution = scramble.reverse().map(id => id ^ 1); }
      }
      if (!solution) {
        // Every suffix of an optimal 17-step path is itself optimal. Its tight
        // geometric/parity bound is also checked below, independently of search.
        board = EXTREME.board; solution = EXTREME.solution.slice();
        for (let i = 0; i < MAX_CERTIFIED - depth; i++) board = move(board, solution[i]);
        solution = solution.slice(MAX_CERTIFIED - depth);
      }
      if (random() < .5) {
        const inverse = [];
        for (let p = 0; p < 16; p++) inverse[board.charCodeAt(p) - 65] = GOAL[p];
        board = inverse.join(''); solution = solution.slice().reverse().map(id => id ^ 1);
      }
      const symmetry = Math.floor(random() * 8);
      board = transform(board, symmetries[symmetry]); solution = solution.map(id => symmetryActions[symmetry][id]);
      const result = { board, optimal: depth, solution, scramble: solution.slice().reverse().map(id => id ^ 1), seed: seed >>> 0, proof: { method: 'displacement-parity', lower: depth, upper: solution.length } };
      registerCertificate(result); return result;
    }
    for (let attempt = 0; attempt < 100; attempt++) {
      let board = GOAL, previous = -2; const scramble = [];
      for (let i = 0; i < depth; i++) {
        let action;
        do { action = Math.floor(random() * MOVES.length); } while (action === (previous ^ 1));
        scramble.push(action); board = move(board, action); previous = action;
      }
      const solution = await solve(board);
      if (solution && solution.length === depth) return { board, optimal: depth, solution, scramble, seed: seed >>> 0 };
    }
    throw new Error('Could not generate a challenge; please retry');
  }
  // Preserve the retained boards and their original completion keys (14–25).
  const LEVELS = Array.from({ length: MAX_CERTIFIED - 5 }, (_, i) => ({ depth: i + 6, seed: i === 0 ? 272466 : 176161 + (i - 1) * 7919, recordId: i + 14 }));
  function dailySeed(date = new Date()) {
    return Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date).replace(/\D/g, ''));
  }
  function randomBoard(nextUint32 = () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0]) {
    const values = GOAL.split('');
    for (let i = values.length - 1; i > 0; i--) {
      const n = i + 1, limit = Math.floor(4294967296 / n) * n; let word;
      do { word = nextUint32(); if (!Number.isInteger(word) || word < 0 || word > 4294967295) throw new RangeError('Expected uint32 random word'); } while (word >= limit);
      const j = word % n; [values[i], values[j]] = [values[j], values[i]];
    }
    return values.join('');
  }
  return { GOAL, MOVES, move, play, correct, valid, solve, generate, LEVELS, dailySeed, distanceSum, parity, lowerBound, MAX_CERTIFIED, registerCertificate, randomBoard };
});
