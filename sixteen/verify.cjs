const assert = require('node:assert/strict');
const E = require('./engine.js');
// Independent array oracle: explicit row/column shifts and matrix rotation.
function oracle(board, m) {
  const a = [...board], out = a.slice();
  if (m.kind === 'row') for (let c = 0; c < 4; c++) out[4 * m.row + (c + m.direction + 4) % 4] = a[4 * m.row + c];
  if (m.kind === 'column') for (let r = 0; r < 4; r++) out[4 * ((r + m.direction + 4) % 4) + m.col] = a[4 * r + m.col];
  if (m.kind === 'rotate') for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
    const nr = m.direction === 1 ? c : 1 - c, nc = m.direction === 1 ? 1 - r : r;
    out[(m.row + nr) * 4 + m.col + nc] = a[(m.row + r) * 4 + m.col + c];
  }
  return out.join('');
}
// Independent forward BFS to radius three certifies that deeper fixtures have no short shortcut.
function ball(start, radius) {
  const seen = new Map([[start, 0]]); let layer = [start];
  for (let d = 1; d <= radius; d++) {
    const next = [];
    for (const b of layer) for (const m of E.MOVES) {
      const child = oracle(b, m); if (!seen.has(child)) { seen.set(child, d); next.push(child); }
    }
    layer = next;
  }
  return seen;
}
(async () => {
  assert.equal(E.MOVES.length, 34);
  assert.equal(E.move(E.GOAL, 0), 'BCDAEFGHIJKLMNOP');
  assert.equal(E.move(E.GOAL, 8), 'EBCDIFGHMJKLANOP');
  for (const m of E.MOVES) {
    assert.equal(E.move(E.GOAL, m.id), oracle(E.GOAL, m));
    assert.equal(E.move(E.move(E.GOAL, m.id), m.id ^ 1), E.GOAL);
    let b = E.GOAL; for (let i = 0; i < 4; i++) b = E.move(b, m.id); assert.equal(b, E.GOAL);
  }
  const goalBall = ball(E.GOAL, 3), layers = [0, 0, 0, 0];
  for (const d of goalBall.values()) layers[d]++;
  for (const [b, d] of goalBall) { assert.ok(E.lowerBound(b) <= d); assert.equal(E.parity(b), d & 1); }
  for (let i = 0; i < E.LEVELS.length; i++) {
    const l = E.LEVELS[i], level = await E.generate(l.depth, l.seed);
    assert.equal(level.optimal, l.depth); assert.equal(E.valid(level.board), true);
    const route = await E.solve(level.board); assert.equal(route.length, l.depth);
    let b = level.board;
    for (const id of route) b = oracle(b, E.MOVES[id]); assert.equal(b, E.GOAL);
    // Two complete radius-three balls include every possible route of length <= 6.
    let minimum = l.depth > 6 ? E.lowerBound(level.board) : Infinity;
    if (l.depth <= 6) for (const [b, d] of ball(level.board, Math.max(0, l.depth - 3))) if (goalBall.has(b)) minimum = Math.min(minimum, d + goalBall.get(b));
    assert.equal(minimum, l.depth, `Level ${i + 1} optimality`);
    let s = { board: level.board, used: 0, status: 'playing' };
    for (const id of route) s = E.play(s, id, l.depth);
    assert.equal(s.status, 'won'); assert.equal(s.used, l.depth);
    assert.equal(E.play(s, 0, l.depth), s);
    s = E.play({ board: level.board, used: l.depth - 1, status: 'playing' }, 0, l.depth);
    if (s.board !== E.GOAL) { assert.equal(s.status, 'lost'); assert.equal(E.play(s, 1, l.depth), s); }
    console.log(`Level ${i + 1}: minimum ${minimum}, verified with ${l.depth > 6 ? 'matching bound and witness' : 'independent BFS'}`);
  }
  assert.equal(E.dailySeed(new Date('2026-10-16T16:01:00Z')), 20261017);
  assert.equal(E.dailySeed(new Date('2026-10-16T15:59:00Z')), 20261016);
  assert.deepEqual(await E.solve(E.GOAL), []);
  const extreme = 'LKIJOPMNCDABGHEF';
  assert.equal(E.lowerBound(extreme), 17);
  assert.equal(E.MAX_CERTIFIED, 17);
  assert.deepEqual(E.LEVELS.map(l => l.depth), Array.from({ length: 12 }, (_, i) => i + 6));
  await assert.rejects(() => E.generate(5, 1), RangeError);
  for (let depth = 7; depth <= E.MAX_CERTIFIED; depth++) for (let seed = 0; seed < 24; seed++) {
    const level = await E.generate(depth, seed);
    // This independent geometric bound is valid for ALL 34 operations.
    let sum = 0, inversions = 0;
    for (let p = 0; p < 16; p++) {
      const v = level.board.charCodeAt(p) - 65, dr = Math.abs((p >> 2) - (v >> 2)), dc = Math.abs((p & 3) - (v & 3));
      sum += Math.min(dr, 4 - dr) + Math.min(dc, 4 - dc);
      for (let q = p + 1; q < 16; q++) if (level.board[p] > level.board[q]) inversions++;
    }
    let lower = Math.ceil(sum / 4); if ((lower & 1) !== (inversions & 1)) lower++;
    assert.equal(lower, depth); assert.equal(level.optimal, depth); assert.equal(level.solution.length, depth);
    assert.equal(level.solution.reduce((b, id) => oracle(b, E.MOVES[id]), level.board), E.GOAL);
    assert.deepEqual(await E.generate(depth, seed), level, 'Seed determinism');
  }
  await assert.rejects(() => E.generate(18, 1), RangeError);
  console.log({ layers });
})().catch(e => { console.error(e); process.exitCode = 1; });
