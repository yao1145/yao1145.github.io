/* Pegs — one-player peg solitaire on six classical boards.
   UMD module: window.PegsEngine in a browser, require('./engine.js') in Node.

   Board geometry is fixed lattice geometry:
     square boards  4 jump directions, holes given row by row
     triangle15     the 15 holes with 0 <= x <= y < 5, 6 jump directions
   Daily and random puzzles are built backwards from a single peg.
   Fixed levels store verified dense positions, including Bell central games.
   Every puzzle has a forward solution certificate. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.createPegsEngine = factory; root.PegsEngine = factory(); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPegsEngine() {
  'use strict';

  const TRIANGULAR_DIRECTIONS = Object.freeze([
    Object.freeze([1, 0]), Object.freeze([-1, 0]), Object.freeze([0, 1]),
    Object.freeze([0, -1]), Object.freeze([1, 1]), Object.freeze([-1, -1])
  ]);
  const ORTHOGONAL_DIRECTIONS = Object.freeze([
    Object.freeze([1, 0]), Object.freeze([-1, 0]), Object.freeze([0, 1]), Object.freeze([0, -1])
  ]);
  const TRIANGULAR_BOARDS = Object.freeze(['triangle15']);
  const BOARD_ORDER = Object.freeze(['triangle15', 'rectangle25', 'english33', 'french37', 'diamond41', 'wiegleb45']);
  const REVERSE_RUNS = 24, REVERSE_STEPS = 44, CANDIDATE_SAMPLE = 6;
  const DFS_NODE_LIMIT = 20000, FALLBACK_STARTS = 6, FALLBACK_NODES = 4000, MIN_PEGS = 4;

  /* ---------------------------------------------------------------- boards */

  function rowHoles(counts, width) {
    const holes = [];
    for (let y = 0; y < counts.length; y++) {
      const count = counts[y], start = Math.floor((width - count) / 2);
      for (let i = 0; i < count; i++) holes.push([start + i, y]);
    }
    return holes;
  }
  function triangleHoles() {
    const holes = [];
    for (let y = 0; y < 5; y++) for (let x = 0; x <= y; x++) holes.push([x, y]);
    return holes;
  }
  function diamondHoles() {
    const holes = [];
    for (let y = 0; y <= 8; y++) for (let x = 0; x <= 8; x++) {
      if (Math.abs(x - 4) + Math.abs(y - 4) <= 4) holes.push([x, y]);
    }
    return holes;
  }
  function key(x, y) { return x + ',' + y; }

  // Jump triples [from, over, to] as hole indices; all three holes are collinear.
  function buildJumps(holes, triangular) {
    const index = new Map();
    holes.forEach(([x, y], i) => index.set(key(x, y), i));
    const directions = triangular ? TRIANGULAR_DIRECTIONS : ORTHOGONAL_DIRECTIONS;
    const jumps = [];
    holes.forEach(([x, y], from) => {
      for (const [dx, dy] of directions) {
        const over = index.get(key(x + dx, y + dy));
        const to = index.get(key(x + 2 * dx, y + 2 * dy));
        if (over !== undefined && to !== undefined) jumps.push([from, over, to]);
      }
    });
    return jumps;
  }
  function makeBoard(id, label, triangular, holes) {
    const frozenHoles = Object.freeze(holes.map(pair => Object.freeze(pair.slice())));
    const jumps = buildJumps(frozenHoles, triangular);
    const lookup = new Map();
    holes.forEach(([x, y], i) => lookup.set(key(x, y), i));
    const jumpIndex = new Map();
    jumps.forEach(jump => jumpIndex.set(jump[0] + '-' + jump[1] + '-' + jump[2], true));
    return Object.freeze({
      id,
      label,
      triangular,
      holes: frozenHoles,
      jumps: Object.freeze(jumps.map(jump => Object.freeze(jump))),
      size: frozenHoles.length,
      jumpIndex,
      indexOf(x, y) { const i = lookup.get(key(x, y)); return i === undefined ? -1 : i; }
    });
  }

  const BOARD_TYPES = Object.freeze({
    triangle15: makeBoard('triangle15', { zh: '三角形 15 孔', en: 'Triangle 15' }, true, triangleHoles()),
    rectangle25: makeBoard('rectangle25', { zh: '矩形 5×5', en: 'Rectangle 5×5' }, false, rowHoles([5, 5, 5, 5, 5], 5)),
    english33: makeBoard('english33', { zh: 'English 33 十字', en: 'English 33 cross' }, false, rowHoles([3, 3, 7, 7, 7, 3, 3], 7)),
    french37: makeBoard('french37', { zh: 'French 37', en: 'French 37' }, false, rowHoles([3, 5, 7, 7, 7, 5, 3], 7)),
    diamond41: makeBoard('diamond41', { zh: '菱形 41 孔', en: 'Diamond 41' }, false, diamondHoles()),
    wiegleb45: makeBoard('wiegleb45', { zh: 'Wiegleb 45', en: 'Wiegleb 45' }, false, rowHoles([3, 3, 3, 9, 9, 9, 3, 3, 3], 9))
  });

  function boardFor(boardId) {
    const board = BOARD_TYPES[boardId];
    if (!board) throw new TypeError('Unknown board: ' + boardId);
    return board;
  }
  function holeIndex(boardId, x, y) { return boardFor(boardId).indexOf(x, y); }
  function coord(boardId, index) {
    const board = boardFor(boardId);
    if (!Number.isInteger(index) || index < 0 || index >= board.size) throw new RangeError('Invalid hole');
    const hole = board.holes[index];
    return 'x' + hole[0] + ' y' + hole[1];
  }

  /* ------------------------------------------------------------ state API */

  function isValidState(state) {
    if (!state || typeof state !== 'object') return false;
    const board = BOARD_TYPES[state.boardId];
    if (!board) return false;
    const pegs = state.pegs;
    if (!Array.isArray(pegs) && !ArrayBuffer.isView(pegs)) return false;
    return pegs.length === board.size;
  }
  function checkState(state) {
    if (!isValidState(state)) throw new TypeError('Invalid pegs state');
    return boardFor(state.boardId);
  }
  function emptyState(boardId) {
    return { boardId, pegs: new Array(boardFor(boardId).size).fill(0) };
  }
  function stateFromPegs(boardId, pegs) {
    const board = boardFor(boardId);
    if (!Array.isArray(pegs) || pegs.length !== board.size) throw new TypeError('Peg list must match the board');
    return { boardId, pegs: pegs.map(value => value ? 1 : 0) };
  }
  function clone(state) {
    const board = checkState(state);
    const pegs = new Array(board.size);
    for (let i = 0; i < board.size; i++) pegs[i] = state.pegs[i] ? 1 : 0;
    return { boardId: state.boardId, pegs };
  }
  function pegCount(state) {
    const board = checkState(state);
    let count = 0;
    for (let i = 0; i < board.size; i++) if (state.pegs[i]) count++;
    return count;
  }
  function holeOfSinglePeg(state) {
    const board = checkState(state);
    let found = -1;
    for (let i = 0; i < board.size; i++) {
      if (!state.pegs[i]) continue;
      if (found >= 0) return -1;
      found = i;
    }
    return found;
  }
  function isJump(board, move) {
    if (!Array.isArray(move) || move.length !== 3) return false;
    for (const index of move) {
      if (!Number.isInteger(index) || index < 0 || index >= board.size) return false;
    }
    return board.jumpIndex.has(move[0] + '-' + move[1] + '-' + move[2]);
  }
  function legalMoves(state) {
    const board = checkState(state), pegs = state.pegs, moves = [];
    for (const jump of board.jumps) {
      if (pegs[jump[0]] && pegs[jump[1]] && !pegs[jump[2]]) moves.push([jump[0], jump[1], jump[2]]);
    }
    return moves;
  }
  function isLegalMove(state, move) {
    let board;
    try { board = checkState(state); } catch { return false; }
    if (!isJump(board, move)) return false;
    const pegs = state.pegs;
    return !!pegs[move[0]] && !!pegs[move[1]] && !pegs[move[2]];
  }
  // A jump removes the peg that is jumped over and moves the jumping peg.
  function apply(state, move) {
    const board = checkState(state);
    if (!isJump(board, move)) return { ok: false, state: null, reason: 'not-a-jump' };
    const pegs = state.pegs;
    if (!pegs[move[0]] || !pegs[move[1]] || pegs[move[2]]) return { ok: false, state: null, reason: 'illegal' };
    const next = new Array(board.size);
    for (let i = 0; i < board.size; i++) next[i] = pegs[i] ? 1 : 0;
    next[move[0]] = 0; next[move[1]] = 0; next[move[2]] = 1;
    return { ok: true, state: { boardId: state.boardId, pegs: next }, reason: '' };
  }
  function isWon(state, target = null) {
    const board = checkState(state);
    let count = 0, at = -1;
    for (let i = 0; i < board.size; i++) {
      if (!state.pegs[i]) continue;
      count++; at = i;
    }
    if (count !== 1) return false;
    if (target === null || target === undefined) return true;
    if (!Number.isInteger(target) || target < 0 || target >= board.size) return false;
    return at === target;
  }
  // Replays a certificate from the puzzle's own starting position.
  function replay(puzzle, solution) {
    if (!puzzle || typeof puzzle !== 'object') return { valid: false, state: null, reason: 'invalid-puzzle' };
    const board = BOARD_TYPES[puzzle.boardId];
    if (!board) return { valid: false, state: null, reason: 'unknown-board' };
    if (!Array.isArray(puzzle.pegs) || puzzle.pegs.length !== board.size) {
      return { valid: false, state: null, reason: 'invalid-pegs' };
    }
    if (!Array.isArray(solution)) return { valid: false, state: null, reason: 'invalid-solution' };
    let state = { boardId: puzzle.boardId, pegs: puzzle.pegs.map(value => value ? 1 : 0) };
    for (let i = 0; i < solution.length; i++) {
      const result = apply(state, solution[i]);
      if (!result.ok) return { valid: false, state, reason: 'move ' + (i + 1) + ' is ' + result.reason, moveIndex: i };
      state = result.state;
    }
    const target = puzzle.target === undefined ? null : puzzle.target;
    if (!isWon(state, target)) return { valid: false, state, reason: 'final position is not a win' };
    return { valid: true, state, reason: '' };
  }

  /* ------------------------------------------------------- reverse builder */

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function random() {
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const reverseCache = new Map();
  function reverseJumps(board) {
    let list = reverseCache.get(board.id);
    if (list) return list;
    list = board.jumps.map(jump => Object.freeze([jump[0], jump[1], jump[2]]));
    reverseCache.set(board.id, list);
    return list;
  }
  // Reverse of a jump: `to` holds a peg, `from` and `over` are empty.
  function reverseCandidates(board, pegs) {
    const out = [];
    for (const jump of reverseJumps(board)) {
      if (pegs[jump[2]] && !pegs[jump[0]] && !pegs[jump[1]]) out.push(jump);
    }
    return out;
  }
  function countReverseAfter(board, pegs, move) {
    pegs[move[0]] = 1; pegs[move[1]] = 1; pegs[move[2]] = 0;
    let count = 0;
    for (const jump of reverseJumps(board)) {
      if (pegs[jump[2]] && !pegs[jump[0]] && !pegs[jump[1]]) count++;
    }
    pegs[move[0]] = 0; pegs[move[1]] = 0; pegs[move[2]] = 1;
    return count;
  }
  // Greedy reverse run: keep the position as expandable as possible.
  function greedyReverse(board, start, rng, stepLimit) {
    const pegs = new Uint8Array(board.size);
    pegs[start] = 1;
    const steps = [];
    for (let step = 0; step < stepLimit; step++) {
      const candidates = reverseCandidates(board, pegs);
      if (!candidates.length) break;
      const sample = Math.min(candidates.length, CANDIDATE_SAMPLE);
      const offset = Math.floor(rng() * candidates.length);
      let choice = candidates[offset], bestScore = -1;
      for (let i = 0; i < sample; i++) {
        const candidate = candidates[(offset + i) % candidates.length];
        const score = countReverseAfter(board, pegs, candidate) + rng() * 0.5;
        if (score > bestScore) { bestScore = score; choice = candidate; }
      }
      pegs[choice[0]] = 1; pegs[choice[1]] = 1; pegs[choice[2]] = 0;
      steps.push([choice[0], choice[1], choice[2]]);
    }
    return { start, steps };
  }
  // Bounded depth-first fallback, only used when the greedy runs stay short.
  function deepReverse(board, start, nodeLimit) {
    const pegs = new Uint8Array(board.size);
    pegs[start] = 1;
    const steps = [];
    let best = [];
    let nodes = 0;
    function dfs() {
      if (steps.length > best.length) best = steps.map(step => step.slice());
      if (steps.length + 1 >= board.size || nodes >= nodeLimit) return;
      for (const jump of reverseJumps(board)) {
        if (!(pegs[jump[2]] && !pegs[jump[0]] && !pegs[jump[1]])) continue;
        nodes++;
        pegs[jump[0]] = 1; pegs[jump[1]] = 1; pegs[jump[2]] = 0;
        steps.push([jump[0], jump[1], jump[2]]);
        dfs();
        steps.pop();
        pegs[jump[0]] = 0; pegs[jump[1]] = 0; pegs[jump[2]] = 1;
        if (nodes >= nodeLimit) return;
      }
    }
    dfs();
    return best;
  }
  // Number of legal forward jumps in the puzzle the reverse run produced.
  function openingMoves(board, build) {
    const pegs = new Uint8Array(board.size);
    pegs[build.start] = 1;
    for (const step of build.steps) {
      pegs[step[0]] = 1; pegs[step[1]] = 1; pegs[step[2]] = 0;
    }
    let moves = 0;
    for (const jump of reverseJumps(board)) {
      if (pegs[jump[0]] && pegs[jump[1]] && !pegs[jump[2]]) moves++;
    }
    return moves;
  }
  // Tries several reverse runs from the given start (null = random start each
  // run) and keeps the longest one, preferring openings with more choices.
  // Bounded work, no full search.
  function buildReverse(board, options = {}) {
    const seed = (options.seed === undefined ? 0x51A70000 : options.seed) >>> 0;
    const runs = options.runs === undefined ? REVERSE_RUNS : options.runs;
    const goalPegs = options.goalPegs === undefined ? null : options.goalPegs;
    const start = options.start === undefined ? null : options.start;
    const rng = mulberry32(seed || 1);
    const cap = goalPegs === null ? REVERSE_STEPS : goalPegs - 1;
    const stepLimit = Math.max(1, Math.min(cap, board.size - 1, REVERSE_STEPS));
    let best = null, bestMoves = -1;
    for (let run = 0; run < runs; run++) {
      const from = start === null ? Math.floor(rng() * board.size) : start;
      const result = greedyReverse(board, from, rng, stepLimit);
      const moves = openingMoves(board, result);
      const better = !best || result.steps.length > best.steps.length ||
        (result.steps.length === best.steps.length && moves > bestMoves);
      if (better) { best = result; bestMoves = moves; }
      if (goalPegs !== null && best.steps.length + 1 >= goalPegs && bestMoves >= 3) break;
    }
    if (!best) best = { start: start === null ? 0 : start, steps: [] };
    if (best.steps.length + 1 < MIN_PEGS) {
      // A fixed start is the only option for a targeted puzzle; otherwise try a
      // few starts in order until the shortest acceptable puzzle is reached.
      const tries = start === null ? FALLBACK_STARTS : 1;
      for (let attempt = 0; attempt < tries; attempt++) {
        if (best.steps.length + 1 >= MIN_PEGS) break;
        const from = start === null ? (best.start + attempt) % board.size : start;
        const nodes = start === null ? FALLBACK_NODES : DFS_NODE_LIMIT;
        const deep = deepReverse(board, from, nodes);
        if (deep.length > best.steps.length) best = { start: from, steps: deep };
      }
    }
    return best;
  }
  function makePuzzle(board, build, meta) {
    const pegs = new Array(board.size).fill(0);
    pegs[build.start] = 1;
    for (const step of build.steps) {
      pegs[step[0]] = 1; pegs[step[1]] = 1; pegs[step[2]] = 0;
    }
    return {
      boardId: board.id,
      pegs,
      target: meta.target,
      solution: build.steps.slice().reverse().map(step => [step[0], step[1], step[2]]),
      name: meta.name,
      nameEn: meta.nameEn,
      seed: meta.seed >>> 0,
      goal: meta.goal === undefined ? null : meta.goal,
      index: meta.index === undefined ? -1 : meta.index
    };
  }

  /* --------------------------------------------------------------- levels */

  const LEVEL_EDITION = "dense-v2";
  // Central game witnesses: George I. Bell (English and Wiegleb pages).
  // Other witnesses: bounded reverse construction, verified before inclusion.
  const LEVELS = Object.freeze([{"boardId":"triangle15","pegs":[1,1,1,1,1,1,1,1,0,0,1,1,1,1,0],"target":null,"solution":[[2,5,9],[3,4,5],[0,1,3],[11,7,4],[13,12,11],[10,11,12],[6,3,1],[9,5,2],[2,4,7],[12,7,3],[1,3,6]],"name":"三角密阵","nameEn":"Dense triangle","seed":1747451904,"goal":12,"index":0},{"boardId":"rectangle25","pegs":[0,1,1,1,1,0,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,1,0,1,1],"target":null,"solution":[[7,6,5],[10,11,12],[4,9,14],[2,3,4],[19,14,9],[17,18,19],[20,15,10],[24,23,22],[4,9,14],[13,12,11],[16,11,6],[1,6,11],[5,10,15],[19,14,9],[22,21,20],[9,8,7],[20,15,10],[10,11,12],[12,7,2]],"name":"方形密阵","nameEn":"Dense square","seed":1747451905,"goal":20,"index":1},{"boardId":"english33","pegs":[1,0,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,0],"target":null,"solution":[[17,10,5],[8,9,10],[11,10,9],[0,3,8],[5,4,3],[29,24,17],[30,27,22],[26,25,24],[23,24,25],[16,9,4],[15,22,27],[7,8,9],[20,21,22],[31,28,23],[23,22,21],[12,19,26],[3,4,5],[2,5,10],[10,9,8],[26,25,24],[18,17,16],[13,14,15],[8,15,22],[21,22,23],[24,23,22],[27,22,15],[16,15,14]],"name":"十字群子","nameEn":"English cluster","seed":1747451906,"goal":28,"index":2},{"boardId":"triangle15","pegs":[1,1,1,1,1,0,1,1,1,1,1,1,0,1,1],"target":8,"solution":[[10,11,12],[13,12,11],[3,7,12],[2,4,7],[0,1,3],[14,9,5],[11,12,13],[6,3,1],[13,8,4],[5,4,3],[1,3,6],[6,7,8]],"name":"三角归心","nameEn":"Triangle home","seed":1747451907,"goal":13,"index":3},{"boardId":"french37","pegs":[0,1,1,1,1,0,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1],"target":null,"solution":[[28,27,26],[25,26,27],[23,24,25],[9,16,23],[11,10,9],[3,9,16],[25,18,11],[2,1,0],[22,23,24],[0,4,10],[7,6,5],[11,10,9],[35,31,25],[12,19,26],[33,32,31],[25,24,23],[27,26,25],[21,20,19],[8,9,10],[10,17,24],[25,31,35],[23,24,25],[34,30,24],[15,16,17],[36,35,34],[17,24,30],[34,30,24],[24,25,26],[26,19,12],[13,12,11],[5,11,18]],"name":"法式密阵","nameEn":"Dense French","seed":1747451908,"goal":32,"index":4},{"boardId":"diamond41","pegs":[1,0,1,0,0,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1],"target":null,"solution":[[35,34,33],[31,23,15],[21,22,23],[19,20,21],[5,11,19],[9,10,11],[8,14,22],[21,29,35],[39,35,29],[32,33,34],[12,13,14],[19,27,33],[23,22,21],[26,18,10],[16,17,18],[36,30,22],[7,6,5],[15,14,13],[0,2,6],[5,11,19],[37,33,27],[28,29,30],[21,22,23],[10,18,26],[19,27,33],[25,26,27],[33,34,35],[40,38,34],[24,23,22],[30,22,14],[14,13,12],[35,34,33],[33,27,19],[6,12,20],[19,20,21]],"name":"菱形群子","nameEn":"Diamond cluster","seed":1747451909,"goal":36,"index":5},{"boardId":"english33","pegs":[1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],"target":null,"solution":[[10,9,8],[23,16,9],[14,15,16],[27,22,15],[29,28,27],[17,24,29],[12,11,10],[30,27,22],[9,10,11],[26,19,12],[7,8,9],[12,11,10],[0,3,8],[9,8,7],[25,18,11],[1,4,9],[6,7,8],[15,8,3],[20,13,6],[10,9,8],[2,5,10],[11,10,9],[9,8,7],[21,22,23],[32,29,24],[6,7,8],[3,8,15],[16,23,28],[31,28,23],[24,23,22],[22,15,8]],"name":"十字单缺","nameEn":"English vacancy","seed":1747451910,"goal":32,"index":6},{"boardId":"wiegleb45","pegs":[1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,0,1,1],"target":null,"solution":[[21,22,23],[6,12,21],[30,21,12],[8,7,6],[17,16,15],[37,31,22],[14,15,16],[44,41,38],[28,29,30],[11,20,29],[36,30,21],[1,4,7],[35,26,17],[6,7,8],[0,3,6],[33,34,35],[5,8,14],[9,10,11],[43,40,37],[22,21,20],[17,16,15],[38,37,36],[12,11,10],[14,15,16],[27,18,9],[24,25,26],[39,36,30],[30,29,28],[35,26,17],[9,10,11],[28,19,10],[10,11,12],[17,16,15],[12,13,14],[15,14,13],[32,23,14],[14,13,12],[6,12,21],[21,20,19]],"name":"维氏密阵","nameEn":"Dense Wiegleb","seed":1747451911,"goal":40,"index":7},{"boardId":"french37","pegs":[1,1,1,1,1,0,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1],"target":null,"solution":[[28,27,26],[25,26,27],[11,18,25],[36,32,26],[7,6,5],[19,12,6],[30,31,32],[2,6,12],[17,24,30],[21,20,19],[33,27,20],[19,12,6],[0,4,10],[29,30,31],[1,5,11],[15,16,17],[10,11,12],[25,26,27],[8,9,10],[6,12,19],[34,35,36],[14,13,12],[36,32,26],[17,10,4],[19,26,32],[22,23,24],[3,4,5],[32,31,30],[30,24,17],[27,20,13],[13,12,11],[5,11,18],[17,18,19]],"name":"法式残阵","nameEn":"French formation","seed":1747451912,"goal":34,"index":8},{"boardId":"diamond41","pegs":[1,0,1,0,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1],"target":null,"solution":[[40,38,34],[28,34,38],[30,29,28],[14,22,30],[12,13,14],[31,30,29],[28,29,30],[24,23,22],[39,35,29],[21,22,23],[26,27,28],[4,5,6],[36,30,22],[32,33,34],[7,6,5],[23,22,21],[8,14,22],[11,19,27],[0,2,6],[21,20,19],[10,18,26],[27,19,11],[16,17,18],[5,11,19],[25,26,27],[28,29,30],[38,34,28],[30,22,14],[15,14,13],[28,27,26],[26,18,10],[9,10,11],[19,11,5],[5,6,7],[13,7,3]],"name":"菱形深阵","nameEn":"Deep diamond","seed":1747451913,"goal":36,"index":9},{"boardId":"english33","pegs":[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],"target":16,"solution":[[4,9,16],[7,8,9],[0,3,8],[15,8,3],[10,9,8],[12,11,10],[27,22,15],[20,21,22],[23,22,21],[21,14,7],[7,8,9],[9,10,11],[2,1,0],[0,3,8],[8,15,22],[25,24,23],[23,22,21],[32,29,24],[17,24,29],[26,19,12],[12,11,10],[30,31,32],[32,29,24],[6,13,20],[20,21,22],[5,10,17],[17,16,15],[15,22,27],[27,28,29],[29,24,17],[18,17,16]],"name":"十字归心","nameEn":"English central game","seed":1747451914,"goal":32,"index":10,"source":"https://www.gibell.net/pegsolitaire/English/index.html"},{"boardId":"wiegleb45","pegs":[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],"target":22,"solution":[[7,13,22],[11,12,13],[30,21,12],[6,12,21],[0,3,6],[28,29,30],[30,21,12],[12,6,3],[9,10,11],[11,20,29],[32,31,30],[30,29,28],[39,36,30],[38,37,36],[44,41,38],[34,33,32],[32,38,41],[42,43,44],[44,41,38],[15,24,33],[17,16,15],[14,15,16],[35,26,17],[17,16,15],[27,28,29],[29,30,31],[2,1,0],[0,3,6],[5,4,3],[3,6,12],[12,13,14],[14,15,16],[16,25,34],[34,33,32],[32,31,30],[30,36,39],[39,40,41],[41,38,32],[32,23,14],[8,14,23],[23,22,21],[18,19,20],[20,21,22]],"name":"维氏归心","nameEn":"Wiegleb central game","seed":1747451915,"index":11,"goal":44,"source":"https://www.gibell.net/pegsolitaire/Wiegleb/index.html"}].map(p => Object.freeze(p)));

  /* ----------------------------------------------------------- generation */

  // Deterministic puzzle for a seed. Board, starting peg and reverse run all
  // come from the seed, so the same seed always yields the same puzzle.
  function normalizedSeed(seed) {
    if (typeof seed === 'number') return seed >>> 0;
    let hash = 2166136261;
    for (const c of String(seed)) { hash ^= c.charCodeAt(0); hash = Math.imul(hash,16777619); }
    return hash >>> 0;
  }
  function generateOn(boardId, seed, options = {}) {
    const board = boardFor(boardId);
    const target = options.target === undefined || options.target === null
      ? null : (Number.isInteger(options.target) ? options.target : board.indexOf(options.target[0], options.target[1]));
    const rounded = normalizedSeed(seed);
    const build = buildReverse(board, {
      seed: rounded, start: target, goalPegs: options.goalPegs === undefined ? null : options.goalPegs,
      runs: options.runs === undefined ? REVERSE_RUNS : options.runs
    });
    return makePuzzle(board, build, {
      target,
      name: options.name === undefined ? board.label.zh : options.name,
      nameEn: options.nameEn === undefined ? board.label.en : options.nameEn,
      seed: rounded, goal: options.goalPegs === undefined ? null : options.goalPegs
    });
  }
  function generate(seed) {
    const rounded = normalizedSeed(seed);
    const rng = mulberry32(rounded);
    const boardId = BOARD_ORDER[Math.floor(rng() * BOARD_ORDER.length)];
    const boardSeed = (rng() * 4294967296) >>> 0;
    const puzzle = generateOn(boardId, boardSeed);
    puzzle.seed = rounded;
    return puzzle;
  }
  function shanghaiDateString(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(date);
    return parts;
  }
  function dailySeed(date = new Date()) {
    return (Number(shanghaiDateString(date).replace(/\D/g, '')) ^ 0x9E3779B9) >>> 0;
  }
  function randomSeed(nextUint32) {
    if (typeof nextUint32 === 'function') return nextUint32() >>> 0;
    try { return globalThis.crypto.getRandomValues(new Uint32Array(1))[0]; }
    catch { return (Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0; }
  }

  return Object.freeze({
    LEVEL_EDITION, BOARD_TYPES, BOARD_ORDER, LEVELS, MIN_PEGS,
    TRIANGULAR_DIRECTIONS, ORTHOGONAL_DIRECTIONS, TRIANGULAR_BOARDS,
    boardFor, holeIndex, coord,
    emptyState, stateFromPegs, clone, pegCount, holeOfSinglePeg,
    legalMoves, isLegalMove, isJump, apply, isWon, replay,
    buildReverse, generateOn, generate,
    shanghaiDateString, dailySeed, randomSeed
  });
});
