/* HEX XII engine: rules, win detection, distance and bridge analysis. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.HexEngine = factory(); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createHexEngine() {
  'use strict';

  const RED = 1, BLUE = 2;
  const DELTAS = Object.freeze([
    Object.freeze([-1, 0]), Object.freeze([-1, 1]),
    Object.freeze([0, -1]), Object.freeze([0, 1]),
    Object.freeze([1, -1]), Object.freeze([1, 0])
  ]);
  const INF = 0x3fffffff;
  const dsuCache = new WeakMap();

  function isSize(size) {
    return Number.isInteger(size) && size >= 2 && size <= 13;
  }
  function isPlayer(player) {
    return player === RED || player === BLUE;
  }
  function cellRow(index, size) {
    return (index / size) | 0;
  }
  function cellCol(index, size) {
    return index - ((index / size) | 0) * size;
  }

  function neighbors(size, index) {
    if (!isSize(size) || !Number.isInteger(index) || index < 0 || index >= size * size) return [];
    const row = cellRow(index, size), col = cellCol(index, size), out = [];
    for (let i = 0; i < DELTAS.length; i++) {
      const nr = row + DELTAS[i][0], nc = col + DELTAS[i][1];
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) out.push(nr * size + nc);
    }
    return out;
  }

  /* Disjoint set over cells plus four virtual boundary nodes. */
  function makeDsu(size) {
    const cells = size * size;
    const parent = new Int32Array(cells + 4);
    for (let i = 0; i < parent.length; i++) parent[i] = i;
    return { size, parent, cells };
  }
  function find(parent, node) {
    let x = node;
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  function union(parent, a, b) {
    const ra = find(parent, a), rb = find(parent, b);
    if (ra !== rb) parent[ra] = rb;
  }
  function boundaryNodes(size) {
    const cells = size * size;
    return {
      red: [cells, cells + 1],
      blue: [cells + 2, cells + 3]
    };
  }
  function linkCell(dsu, board, size, index) {
    const color = board[index];
    if (!isPlayer(color)) return;
    const parent = dsu.parent, row = cellRow(index, size), col = cellCol(index, size);
    const boundary = boundaryNodes(size);
    if (color === RED) {
      if (row === 0) union(parent, index, boundary.red[0]);
      if (row === size - 1) union(parent, index, boundary.red[1]);
    } else {
      if (col === 0) union(parent, index, boundary.blue[0]);
      if (col === size - 1) union(parent, index, boundary.blue[1]);
    }
    for (let i = 0; i < DELTAS.length; i++) {
      const nr = row + DELTAS[i][0], nc = col + DELTAS[i][1];
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      const next = nr * size + nc;
      if (board[next] === color) union(parent, index, next);
    }
  }
  function hasWon(dsu, player) {
    const boundary = boundaryNodes(dsu.size);
    const pair = player === RED ? boundary.red : boundary.blue;
    return find(dsu.parent, pair[0]) === find(dsu.parent, pair[1]);
  }
  function rebuildDsu(board, size) {
    const dsu = makeDsu(size);
    for (let i = 0; i < size * size; i++) linkCell(dsu, board, size, i);
    return dsu;
  }

  function create(size, options = {}) {
    if (!isSize(size)) throw new RangeError('Hex board size must be an integer from 2 to 13');
    const state = {
      size,
      board: new Uint8Array(size * size),
      turn: RED,
      winner: 0,
      moves: [],
      path: []
    };
    if (options.choiceOpening) state.opening = { phase: 'first', candidates: [], selected: null };
    dsuCache.set(state, makeDsu(size));
    return state;
  }

  function play(state, index) {
    if (!state || !isSize(state.size)) return false;
    if (state.winner !== 0) return false;
    if (state.opening && ['offer', 'choose'].includes(state.opening.phase)) return false;
    if (!isPlayer(state.turn)) return false;
    if (!Number.isInteger(index) || index < 0 || index >= state.size * state.size) return false;
    if (state.board[index] !== 0) return false;

    const size = state.size, color = state.turn;
    state.board[index] = color;
    state.moves.push(index);
    if (state.opening && state.moves.length <= 2) state.opening.phase = state.moves.length === 1 ? 'reply' : 'offer';

    let dsu = dsuCache.get(state);
    if (!dsu || dsu.size !== size) {
      dsu = rebuildDsu(state.board, size);
      dsuCache.set(state, dsu);
    } else {
      linkCell(dsu, state.board, size, index);
    }

    if (hasWon(dsu, color)) {
      state.winner = color;
      state.path = winningPath(state.board, size, color);
      return true;
    }
    state.turn = color === RED ? BLUE : RED;
    return true;
  }

  function propose(state, index) {
    if (!state || state.winner || state.turn !== RED || !state.opening || state.opening.phase !== 'offer') return false;
    if (!Number.isInteger(index) || index < 0 || index >= state.size * state.size || state.board[index] !== 0) return false;
    const candidates = state.opening.candidates;
    const existing = candidates.indexOf(index);
    if (existing >= 0) candidates.splice(existing, 1);
    else candidates.push(index);
    if (candidates.length === 2) state.opening.phase = 'choose';
    return true;
  }

  function resolveOpening(state, index) {
    const opening = state && state.opening;
    if (!opening || opening.phase !== 'choose' || opening.candidates.length !== 2 || !opening.candidates.includes(index) || state.board[index] !== 0) return false;
    opening.phase = 'done';
    if (!play(state, index)) { opening.phase = 'choose'; return false; }
    opening.selected = index;
    return true;
  }

  function undoRound(state) {
    if (!state || !Array.isArray(state.moves) || state.moves.length === 0) return false;
    const size = state.size;
    if (!isSize(size) || !state.board) return false;
    if (state.opening && ['offer', 'choose'].includes(state.opening.phase) && state.opening.candidates.length) {
      state.opening.candidates = [];
      state.opening.phase = 'offer';
      return true;
    }
    // Moves always alternate red then blue, red first.
    const count = state.moves.length % 2 === 1 ? 1 : 2;
    for (let i = 0; i < count; i++) {
      const index = state.moves.pop();
      if (Number.isInteger(index) && index >= 0 && index < size * size) state.board[index] = 0;
    }
    state.winner = 0;
    state.path = [];
    state.turn = RED;
    if (state.opening && state.moves.length <= 2) {
      state.opening.phase = state.moves.length === 0 ? 'first' : state.moves.length === 1 ? 'reply' : 'offer';
      state.opening.candidates = [];
      state.opening.selected = null;
    }
    dsuCache.set(state, rebuildDsu(state.board, size));
    return true;
  }

  function winner(board, size) {
    if (!board || !isSize(size) || board.length < size * size) return 0;
    const dsu = rebuildDsu(board, size);
    if (hasWon(dsu, RED)) return RED;
    if (hasWon(dsu, BLUE)) return BLUE;
    return 0;
  }

  function winningPath(board, size, player) {
    if (!board || !isSize(size) || !isPlayer(player) || board.length < size * size) return [];
    const cells = size * size;
    const parent = new Int32Array(cells).fill(-1);
    const seen = new Uint8Array(cells);
    const queue = new Int32Array(cells);
    let head = 0, tail = 0;

    for (let i = 0; i < size; i++) {
      const index = player === RED ? i : i * size;
      if (board[index] !== player || seen[index]) continue;
      seen[index] = 1;
      parent[index] = -2;
      queue[tail++] = index;
    }
    if (tail === 0) return [];

    let target = -1;
    while (head < tail) {
      const index = queue[head++];
      const row = cellRow(index, size), col = cellCol(index, size);
      if (player === RED ? row === size - 1 : col === size - 1) { target = index; break; }
      for (let i = 0; i < DELTAS.length; i++) {
        const nr = row + DELTAS[i][0], nc = col + DELTAS[i][1];
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        const next = nr * size + nc;
        if (seen[next] || board[next] !== player) continue;
        seen[next] = 1;
        parent[next] = index;
        queue[tail++] = next;
      }
    }
    if (target < 0) return [];

    const path = [];
    for (let node = target; node !== -2; node = parent[node]) path.push(node);
    path.reverse();
    return path;
  }

  /* 0-1 BFS: entering own stone costs 0, an empty cell costs 1, enemy is blocked. */
  function connection(board, size, player) {
    const empty = { distance: Infinity, path: [] };
    if (!board || !isSize(size) || !isPlayer(player) || board.length < size * size) return empty;
    const cells = size * size, enemy = player === RED ? BLUE : RED;
    const dist = new Int32Array(cells).fill(INF);
    const parent = new Int32Array(cells).fill(-1);

    let capacity = 16;
    while (capacity < cells * 2) capacity *= 2;
    let deque = new Int32Array(capacity);
    let head = 0, tail = 0, count = 0;
    function grow() {
      const next = new Int32Array(deque.length * 2);
      for (let i = 0; i < count; i++) next[i] = deque[(head + i) % deque.length];
      deque = next;
      head = 0;
      tail = count;
    }
    function pushFront(value) {
      if (count === deque.length) grow();
      head = (head - 1 + deque.length) % deque.length;
      deque[head] = value;
      count++;
    }
    function pushBack(value) {
      if (count === deque.length) grow();
      deque[tail] = value;
      tail = (tail + 1) % deque.length;
      count++;
    }
    function popFront() {
      const value = deque[head];
      head = (head + 1) % deque.length;
      count--;
      return value;
    }

    for (let i = 0; i < size; i++) {
      const index = player === RED ? i : i * size;
      if (board[index] === enemy) continue;
      const cost = board[index] === player ? 0 : 1;
      if (cost < dist[index]) {
        dist[index] = cost;
        parent[index] = -2;
        if (cost === 0) pushFront(index); else pushBack(index);
      }
    }

    while (count > 0) {
      const index = popFront();
      const d = dist[index];
      const row = cellRow(index, size), col = cellCol(index, size);
      for (let i = 0; i < DELTAS.length; i++) {
        const nr = row + DELTAS[i][0], nc = col + DELTAS[i][1];
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        const next = nr * size + nc;
        if (board[next] === enemy) continue;
        const cost = board[next] === player ? 0 : 1;
        const nd = d + cost;
        if (nd < dist[next]) {
          dist[next] = nd;
          parent[next] = index;
          if (cost === 0) pushFront(next); else pushBack(next);
        }
      }
    }

    let target = -1, best = INF;
    for (let i = 0; i < size; i++) {
      const index = player === RED ? (size - 1) * size + i : i * size + size - 1;
      if (dist[index] < best) { best = dist[index]; target = index; }
    }
    if (target < 0) return empty;

    const path = [];
    for (let node = target; node !== -2; node = parent[node]) path.push(node);
    path.reverse();
    return { distance: best, path };
  }

  function bridges(board, size, player) {
    if (!board || !isSize(size) || !isPlayer(player) || board.length < size * size) return [];
    const out = [];
    for (let a = 0; a < size * size; a++) {
      if (board[a] !== player) continue;
      const nearA = neighbors(size, a);
      for (let b = a + 1; b < size * size; b++) {
        if (board[b] !== player || nearA.indexOf(b) >= 0) continue;
        const nearB = neighbors(size, b);
        const shared = [];
        for (let i = 0; i < nearA.length; i++) {
          const cell = nearA[i];
          if (nearB.indexOf(cell) >= 0) shared.push(cell);
        }
        if (shared.length !== 2) continue;
        if (board[shared[0]] !== 0 || board[shared[1]] !== 0) continue;
        out.push({ ends: [a, b], cells: shared, player });
      }
    }
    return out;
  }

  return Object.freeze({
    RED,
    BLUE,
    neighbors,
    create,
    play,
    propose,
    resolveOpening,
    undoRound,
    winner,
    winningPath,
    connection,
    bridges
  });
});
