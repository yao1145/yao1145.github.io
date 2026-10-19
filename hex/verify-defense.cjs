const assert = require('node:assert/strict');
const E = require('./engine.js'), AI = require('./ai.js');
let checks = 0;
const ok = (v, label) => { assert.ok(v, label); checks++; };
const eq = (a, b, label) => { assert.deepEqual(a, b, label); checks++; };
// Complete minimax on 3x3, independent of the MoHex VC and rollout code.
const memo = new Map();
function wins(board, turn) {
  const winner = E.winner(board, 3); if (winner) return winner === turn;
  const key = turn + ':' + board.join(''); if (memo.has(key)) return memo.get(key);
  for (let i = 0; i < 9; i++) if (!board[i]) {
    board[i] = turn; const winning = !wins(board, 3 - turn); board[i] = 0;
    if (winning) { memo.set(key, true); return true; }
  }
  memo.set(key, false); return false;
}
function rotate(board) { return board.slice().reverse(); }
function noImmediate(board, n) {
  for (let i = 0; i < board.length; i++) if (!board[i]) for (const player of [1, 2]) {
    board[i] = player; const winner = E.winner(board, n); board[i] = 0;
    eq(winner, 0, 'fixture has no immediate winning move for either color');
  }
}
async function search(board, n, player, difficulty, seed = 42) {
  const before = board.slice();
  const result = await AI.search({ size: n, board, player, difficulty, seed, budgetMs: 120, maxIterations: 96 });
  eq(board, before, 'native engine leaves supplied board untouched');
  eq(result.engine, 'mohex-2.0', 'real MoHex engine selected');
  ok(result.move >= 0 && !board[result.move], 'MoHex returns an empty cell');
  return result;
}
(async () => {
  let exact = 0, virtual = 0;
  for (const fixture of require('./defense-fixtures.json')) for (const rotated of [false, true]) {
    const board = rotated ? rotate(fixture.board) : fixture.board.slice();
    noImmediate(board, 3);
    const winning = [];
    for (let i = 0; i < 9; i++) if (!board[i]) {
      board[i] = fixture.player; const good = !wins(board, 3 - fixture.player); board[i] = 0;
      if (good) winning.push(i);
    }
    eq(winning, fixture.good.map(i => rotated ? 8 - i : i), 'independent oracle confirms unique winning move');
    for (const difficulty of ['medium', 'high']) {
      const result = await search(board, 3, fixture.player, difficulty);
      ok(winning.includes(result.move), 'MoHex handles non-immediate connection tactic'); exact++;
    }
  }
  // A red connection threatens to turn two bridges into an edge-to-edge VC.
  // These legal positions have no one-ply win. Defense must happen earlier.
  for (const n of [7, 9, 11, 13]) {
    console.log('Virtual defense size', n);
    const board = Array(n * n).fill(0), c = (n - 1) / 2 + 1;
    for (let r = 0; r <= 2; r++) board[r * n + c] = 1;
    for (let r = 6; r < n; r++) board[r * n + c - 2] = 1;
    for (let r = 0; r < n - 4; r++) board[r * n + (r < Math.ceil((n - 4) / 2) ? 0 : n - 1)] = 2;
    eq(board.filter(v => v === 1).length, board.filter(v => v === 2).length + 1, 'legal blue-to-move stone counts');
    noImmediate(board, n);
    for (const rotated of [false, true]) {
      const b = rotated ? rotate(board) : board.slice();
      const carrier = [3 * n + c - 1, 3 * n + c, 4 * n + c - 1, 5 * n + c - 2, 5 * n + c - 1].map(i => rotated ? n * n - 1 - i : i);
      for (const difficulty of ['medium', 'high']) for (const seed of [17, 42]) {
        const result = await search(b, n, 2, difficulty, seed);
        ok(carrier.includes(result.move), `${n}x${n} ${difficulty} rotated=${rotated} seed=${seed} carrier=${carrier} result=${JSON.stringify(result)}`);
        ok(result.mustplay.length > 0 && result.mustplay.length <= carrier.length, 'MoHex finds a restricted must-play region');
        ok(result.mustplay.includes(result.move), 'actual move respects MoHex must-play'); virtual++;
      }
    }
  }
  for (const n of [7, 13]) {
    console.log('Critical bridge size', n);
    const mid = (n - 1) / 2, board = Array(n * n).fill(0);
    for (let c = 0; c < mid; c++) board[mid * n + c] = 2;
    for (let c = mid; c < n; c++) board[(mid + 1) * n + c] = 2;
    for (let c = 0; c < n; c++) board[c] = 1;
    board[mid * n + mid] = 1;
    const reply = (mid + 1) * n + mid - 1;
    for (const difficulty of ['easy', 'medium', 'high']) {
      const result = await search(board, n, 2, difficulty); eq(result.move, reply, 'complete the attacked bridge to win');
      const after = board.slice(); after[reply] = 2; eq(E.winner(after, n), 2, 'bridge reply actually wins');
    }
    const edge = Array(n * n).fill(0);
    for (let r = 1; r < n; r++) edge[r * n + mid] = 1;
    edge[mid] = 2; for (let r = 0; r < n - 2; r++) edge[r * n] = 2;
    const result = await search(edge, n, 1, 'high'); eq(result.move, mid + 1, 'red saves its attacked edge bridge');
  }
  let cancelled = false, ticks = 0;
  const timer = setInterval(() => { ticks++; if (ticks >= 3) cancelled = true; }, 10);
  const pending = await AI.search({ size: 13, board: Array(169).fill(0), player: 1, difficulty: 'high', budgetMs: 3000 }, null, () => cancelled);
  clearInterval(timer); eq(pending.move, -1, 'running native search observes cancellation'); ok(ticks >= 3, 'native search yields to event loop');
  console.log(`Hex MoHex defense verified: ${checks} checks passed; ${exact} exact tactics, ${virtual} large-board virtual defenses.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
