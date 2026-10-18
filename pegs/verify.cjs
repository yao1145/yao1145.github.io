'use strict';
/* Independent checks for pegs/engine.js.
   Run from the repository root:  node pegs/verify.cjs
   Nothing here trusts the engine's own tables: the hole sets, the jump tables
   and the replay walk are rebuilt from the board definitions in this file. */

const path = require('path');
const Engine = require(path.join(__dirname, 'engine.js'));

let checks = 0, failures = 0;
function check(label, condition, detail) {
  checks++;
  if (condition) return true;
  failures++;
  console.error('FAIL  ' + label + (detail === undefined ? '' : '  → ' + detail));
  return false;
}
function sameSet(label, actual, expected) {
  const a = actual.slice().sort().join('|');
  const b = expected.slice().sort().join('|');
  return check(label, a === b, a === b ? '' : 'actual ' + actual.length + ' vs expected ' + expected.length);
}
function section(title) { console.log('\n== ' + title); }

/* ------------------------------------------------- independent geometry */

const SQUARE_ROWS = {
  rectangle25: { rows: [5, 5, 5, 5, 5], width: 5 },
  english33: { rows: [3, 3, 7, 7, 7, 3, 3], width: 7 },
  french37: { rows: [3, 5, 7, 7, 7, 5, 3], width: 7 },
  wiegleb45: { rows: [3, 3, 3, 9, 9, 9, 3, 3, 3], width: 9 }
};
const EXPECTED_SIZE = { triangle15: 15, rectangle25: 25, english33: 33, french37: 37, diamond41: 41, wiegleb45: 45 };
const SQUARE_DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const TRIANGLE_DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]];
const TRIANGLE_ROWS = 5, DIAMOND_RADIUS = 4;

function expectedHoles(boardId) {
  const holes = [];
  if (boardId === 'triangle15') {
    for (let y = 0; y < TRIANGLE_ROWS; y++) for (let x = 0; x <= y; x++) holes.push(x + ',' + y);
    return holes;
  }
  if (boardId === 'diamond41') {
    for (let y = 0; y <= 2 * DIAMOND_RADIUS; y++) for (let x = 0; x <= 2 * DIAMOND_RADIUS; x++) {
      if (Math.abs(x - DIAMOND_RADIUS) + Math.abs(y - DIAMOND_RADIUS) <= DIAMOND_RADIUS) holes.push(x + ',' + y);
    }
    return holes;
  }
  const spec = SQUARE_ROWS[boardId];
  for (let y = 0; y < spec.rows.length; y++) {
    const count = spec.rows[y], start = (spec.width - count) / 2;
    if (!Number.isInteger(start)) throw new Error('Row ' + y + ' of ' + boardId + ' is not centered');
    for (let i = 0; i < count; i++) holes.push((start + i) + ',' + y);
  }
  return holes;
}
function expectedJumps(boardId) {
  const keys = expectedHoles(boardId);
  const lookup = new Map(keys.map((key, index) => [key, index]));
  const directions = boardId === 'triangle15' ? TRIANGLE_DIRECTIONS : SQUARE_DIRECTIONS;
  const jumps = [];
  keys.forEach((key, from) => {
    const [x, y] = key.split(',').map(Number);
    for (const [dx, dy] of directions) {
      const over = lookup.get((x + dx) + ',' + (y + dy));
      const to = lookup.get((x + 2 * dx) + ',' + (y + 2 * dy));
      if (over !== undefined && to !== undefined) jumps.push([from, over, to]);
    }
  });
  return jumps;
}
const JUMP_KEYS = new Map();
for (const boardId of Engine.BOARD_ORDER) {
  const jumps = expectedJumps(boardId);
  JUMP_KEYS.set(boardId, new Set(jumps.map(jump => jump.join('-'))));
}

section('boards');
check('BOARD_ORDER has six boards', Engine.BOARD_ORDER.length === 6, Engine.BOARD_ORDER.join(','));
check('BOARD_TYPES keys match BOARD_ORDER', Object.keys(Engine.BOARD_TYPES).sort().join(',') === Engine.BOARD_ORDER.slice().sort().join(','));
for (const boardId of Engine.BOARD_ORDER) {
  const board = Engine.BOARD_TYPES[boardId];
  const holes = board.holes.map(hole => hole[0] + ',' + hole[1]);
  const expected = expectedHoles(boardId);
  check(boardId + ': hole count is ' + EXPECTED_SIZE[boardId], board.size === EXPECTED_SIZE[boardId], 'got ' + board.size);
  check(boardId + ': hole coordinates match the row definition', holes.join('|') === expected.join('|'));
  check(boardId + ': hole coordinates are unique', new Set(holes).size === holes.length);
  check(boardId + ': triangular flag', board.triangular === (boardId === 'triangle15'), String(board.triangular));
  check(boardId + ': holes are frozen', Object.isFrozen(board.holes) && Object.isFrozen(board.holes[0]));
  const jumps = board.jumps.map(jump => jump.join('-'));
  sameSet(boardId + ': jump table matches the rebuilt geometry', jumps, expectedJumps(boardId).map(jump => jump.join('-')));
  check(boardId + ': jump table has no duplicates', new Set(jumps).size === jumps.length);
  check(boardId + ': jump table is frozen', Object.isFrozen(board.jumps) && Object.isFrozen(board.jumps[0]));
  let diagonal = 0, offAxis = 0;
  for (const jump of board.jumps) {
    const from = board.holes[jump[0]], to = board.holes[jump[2]], over = board.holes[jump[1]];
    check(boardId + ': jump ' + jump.join('-') + ' uses three distinct holes', new Set(jump).size === 3);
    check(boardId + ': jump ' + jump.join('-') + ' is centered on the jumped peg',
      from[0] - over[0] === over[0] - to[0] && from[1] - over[1] === over[1] - to[1]);
    const dx = Math.abs(to[0] - from[0]), dy = Math.abs(to[1] - from[1]);
    if (dx && dy) diagonal++;
    const validAxis = board.triangular
      ? ((dx === 2 && dy === 0) || (dx === 0 && dy === 2) ||
         (dx === 2 && dy === 2 && (to[0]-from[0]) === (to[1]-from[1])))
      : dx + dy === 2;
    if (!validAxis) offAxis++;
  }
  check(boardId + ': two-hole jumps only', offAxis === 0, offAxis + ' bad');
  if (board.triangular) check(boardId + ': has six-direction (diagonal) jumps', diagonal > 0);
  else check(boardId + ': square board has no diagonal jumps', diagonal === 0, diagonal + ' found');
  for (let index = 0; index < board.size; index++) {
    check(boardId + ': holeIndex round-trips hole ' + index,
      Engine.holeIndex(boardId, board.holes[index][0], board.holes[index][1]) === index);
  }
  check(boardId + ': holeIndex rejects missing coordinates', Engine.holeIndex(boardId, -1, -1) === -1);
}
check('triangle15 keeps the 0 <= x <= y < 5 shape',
  Engine.BOARD_TYPES.triangle15.holes.every(hole => hole[0] <= hole[1] && hole[1] < 5 && hole[0] >= 0));

section('state API');
const triangle = Engine.BOARD_TYPES.triangle15;
const startState = Engine.stateFromPegs('triangle15', new Array(15).fill(1));
check('stateFromPegs normalizes values', startState.pegs.every(value => value === 1));
const copied = Engine.clone(startState);
copied.pegs[0] = 0; copied.pegs[1] = 4;
check('clone is a deep copy', startState.pegs[0] === 1 && startState.pegs[1] === 1);
check('clone keeps the board', copied.boardId === 'triangle15');
check('pegCount counts occupied holes', Engine.pegCount(startState) === 15);
check('a full board has no legal move', Engine.legalMoves(startState).length === 0);
check('apply rejects a move on a full board', Engine.apply(startState, triangle.jumps[0]).ok === false);
// One empty hole: exactly the jumps landing there become legal.
const landing = triangle.jumps[0][2];
const openState = Engine.clone(startState);
openState.pegs[landing] = 0;
const openMoves = Engine.legalMoves(openState);
check('an empty landing hole creates legal moves', openMoves.length >= 1 && openMoves.length <= 6, String(openMoves.length));
check('every legal move lands on the empty hole', openMoves.every(jump => jump[2] === landing));
check('legalMoves only returns jumps from the table',
  openMoves.every(jump => triangle.jumps.some(known => known.join('-') === jump.join('-'))));
const move = openMoves[0];
const applied = Engine.apply(openState, move);
check('apply accepts a legal jump', applied.ok === true);
check('apply returns a new state', applied.ok === true && applied.state !== openState);
check('apply does not mutate its input', Engine.pegCount(openState) === 14 && openState.pegs[move[0]] === 1);
check('a jump removes one peg', applied.ok === true && Engine.pegCount(applied.state) === 13);
check('a jump moves the peg to the landing hole',
  applied.ok === true && applied.state.pegs[move[2]] === 1 && applied.state.pegs[move[0]] === 0 && applied.state.pegs[move[1]] === 0);
check('each move is one jump', Engine.pegCount(openState) - Engine.pegCount(applied.state) === 1);
const returned = Engine.legalMoves(openState);
returned[0][0] = -99;
check('legalMoves returns copies', triangle.jumps.every(jump => jump[0] !== -99));
check('isLegalMove agrees with apply', Engine.isLegalMove(openState, move) === true);
check('apply rejects a jump onto an occupied hole',
  Engine.apply(openState, triangle.jumps.find(jump => jump[2] !== landing)).ok === false);
check('apply rejects a non-jump triple', Engine.apply(openState, [0, 1, 2]).ok === false);
check('apply rejects a malformed move', Engine.apply(openState, [0, 0]).ok === false);
check('apply rejects a move with an empty source',
  Engine.apply(startState, [triangle.jumps.length, 0, 1]).ok === false);
const lonely = { boardId: 'triangle15', pegs: new Array(15).fill(0) };
lonely.pegs[7] = 1;
check('isWon accepts a single peg without a target', Engine.isWon(lonely) === true);
check('isWon accepts the named target', Engine.isWon(lonely, 7) === true);
check('isWon rejects another target', Engine.isWon(lonely, 8) === false);
check('isWon rejects an out-of-range target', Engine.isWon(lonely, 99) === false);
lonely.pegs[8] = 1;
check('isWon rejects two pegs', Engine.isWon(lonely) === false);
check('isWon rejects an empty board', Engine.isWon({ boardId: 'triangle15', pegs: new Array(15).fill(0) }) === false);
check('holeOfSinglePeg finds the last peg', Engine.holeOfSinglePeg({ boardId: 'triangle15', pegs: Object.assign(new Array(15).fill(0), { 4: 1 }) }) === 4);
check('holeOfSinglePeg reports two pegs as -1', Engine.holeOfSinglePeg({ boardId: 'triangle15', pegs: Object.assign(new Array(15).fill(0), { 4: 1, 5: 1 }) }) === -1);
try { Engine.clone({ boardId: 'triangle15', pegs: [1] }); check('clone rejects a wrong peg count', false); }
catch { check('clone rejects a wrong peg count', true); }
try { Engine.boardFor('nope'); check('boardFor rejects an unknown board', false); }
catch { check('boardFor rejects an unknown board', true); }

/* ------------------------------------------------------ certificate walk */

function walk(boardId, pegs, solution) {
  const keys = JUMP_KEYS.get(boardId);
  const current = pegs.map(value => value ? 1 : 0);
  const counts = [current.reduce((sum, value) => sum + value, 0)];
  for (let i = 0; i < solution.length; i++) {
    const jump = solution[i];
    if (!Array.isArray(jump) || jump.length !== 3 || !keys.has(jump.join('-'))) {
      return { ok: false, step: i, reason: 'not a jump on this board', pegs: current, counts };
    }
    if (!current[jump[0]] || !current[jump[1]] || current[jump[2]]) {
      return { ok: false, step: i, reason: 'illegal at position ' + i, pegs: current, counts };
    }
    current[jump[0]] = 0; current[jump[1]] = 0; current[jump[2]] = 1;
    counts.push(counts[counts.length - 1] - 1);
  }
  return { ok: true, step: solution.length, reason: '', pegs: current, counts };
}
function singleIndex(pegs) {
  let at = -1;
  for (let i = 0; i < pegs.length; i++) {
    if (!pegs[i]) continue;
    if (at >= 0) return -1;
    at = i;
  }
  return at;
}

section('twelve fixed levels');
check('twelve levels', Engine.LEVELS.length === 12, String(Engine.LEVELS.length));
const EXPECTED_TARGETS = {
  3: { boardId: 'triangle15', x: 2, y: 3 },
  10: { boardId: 'english33', x: 3, y: 3 },
  11: { boardId: 'wiegleb45', x: 4, y: 4 }
};
const expectedLevelBoards = ['triangle15', 'rectangle25', 'english33', 'triangle15', 'french37', 'diamond41',
  'english33', 'wiegleb45', 'french37', 'diamond41', 'english33', 'wiegleb45'];
const denseCounts=[12,20,28,13,32,36,32,40,34,36,32,44];
const seenBoards = new Set();
Engine.LEVELS.forEach((puzzle, index) => {
  const tag = 'level ' + (index + 1);
  const board = Engine.BOARD_TYPES[puzzle.boardId];
  seenBoards.add(puzzle.boardId);
  check(tag + ': expected board ' + expectedLevelBoards[index], puzzle.boardId === expectedLevelBoards[index], puzzle.boardId);
  check(tag + ': pegs match the board', Array.isArray(puzzle.pegs) && puzzle.pegs.length === board.size);
  check(tag + ': pegs are 0 or 1', puzzle.pegs.every(value => value === 0 || value === 1));
  const pegs = puzzle.pegs.reduce((sum, value) => sum + value, 0);
  check(tag + ': dense starting peg count',pegs===denseCounts[index],String(pegs));
  check(tag + ': at least ' + Engine.MIN_PEGS + ' pegs', pegs >= Engine.MIN_PEGS, String(pegs));
  check(tag + ': a certified puzzle needs at least two moves', pegs >= 2, String(pegs));
  check(tag + ': certificate length is pegs - 1', puzzle.solution.length === pegs - 1,
    puzzle.solution.length + ' vs ' + (pegs - 1));
  const walkResult = walk(puzzle.boardId, puzzle.pegs, puzzle.solution);
  check(tag + ': every certificate move is a legal jump', walkResult.ok === true, walkResult.reason);
  check(tag + ': each jump removes exactly one peg',
    walkResult.counts.every((count, i) => i === 0 || count === walkResult.counts[i - 1] - 1));
  check(tag + ': the certificate ends with one peg', singleIndex(walkResult.pegs) >= 0);
  const expectedTarget = EXPECTED_TARGETS[index];
  if (!expectedTarget) {
    check(tag + ': no target hole', puzzle.target === null, String(puzzle.target));
  } else {
    const wanted = Engine.holeIndex(expectedTarget.boardId, expectedTarget.x, expectedTarget.y);
    check(tag + ': target hole is the expected one', puzzle.target === wanted, 'target ' + puzzle.target + ' vs ' + wanted);
    check(tag + ': the last peg stands on the target hole', singleIndex(walkResult.pegs) === puzzle.target,
      'peg ' + singleIndex(walkResult.pegs) + ' vs target ' + puzzle.target);
  }
  const replayResult = Engine.replay(puzzle, puzzle.solution);
  check(tag + ': engine replay is valid', replayResult.valid === true, replayResult.reason);
  check(tag + ': engine replay ends in a win', Engine.isWon(replayResult.state, puzzle.target) === true);
  check(tag + ': engine replay matches the independent walk',
    replayResult.state.pegs.map(value => value ? 1 : 0).join('') === walkResult.pegs.join(''));
  const initial = Engine.legalMoves({ boardId: puzzle.boardId, pegs: puzzle.pegs });
  check(tag + ': the first certificate move is legal in the initial position',
    initial.some(move => move.join('-') === puzzle.solution[0].join('-')));
  check(tag + ': the initial position has a legal jump', initial.length >= 1, String(initial.length));

  const duplicated = puzzle.solution.concat([puzzle.solution[puzzle.solution.length - 1]]);
  check(tag + ': replay rejects a move after the win', Engine.replay(puzzle, duplicated).valid === false);
  check(tag + ': replay rejects a malformed move', Engine.replay(puzzle, [[0, 0, 0]].concat(puzzle.solution)).valid === false);
  check(tag + ': replay rejects a truncated certificate',
    Engine.replay(puzzle, puzzle.solution.slice(0, -1)).valid === false);
  const emptySource = expectedJumps(puzzle.boardId).find(jump => !puzzle.pegs[jump[0]]);
  if (emptySource) {
    check(tag + ': replay rejects a jump from an empty hole',
      Engine.replay(puzzle, [emptySource].concat(puzzle.solution)).valid === false);
  } else {
    check(tag + ': every jump source is occupied in the initial position', false, 'no empty source found');
  }
});
check('twelve levels cover every board type', seenBoards.size === 6, Array.from(seenBoards).join(','));
check('levels carry names', Engine.LEVELS.every(puzzle => typeof puzzle.name === 'string' && puzzle.name.length > 0));

section('generated puzzles');
const seeds = [];
for (let i = 1; i <= 100; i++) seeds.push(i);
seeds.push(0, 0x7FFFFFFF, 0xFFFFFFFF);
let generatedPegMin = Infinity, generatedPegMax = 0;
const generatedBoards = new Map();
seeds.forEach((seed, seedIndex) => {
  const puzzle = Engine.generate(seed);
  const board = Engine.BOARD_TYPES[puzzle.boardId];
  const tag = 'seed ' + seed;
  if (!board) { check(tag + ': known board', false, String(puzzle.boardId)); return; }
  generatedBoards.set(puzzle.boardId, (generatedBoards.get(puzzle.boardId) || 0) + 1);
  const pegs = puzzle.pegs.reduce((sum, value) => sum + value, 0);
  generatedPegMin = Math.min(generatedPegMin, pegs);
  generatedPegMax = Math.max(generatedPegMax, pegs);
  check(tag + ': pegs match the board', puzzle.pegs.length === board.size);
  check(tag + ': at least ' + Engine.MIN_PEGS + ' pegs', pegs >= Engine.MIN_PEGS, String(pegs));
  check(tag + ': certificate length is pegs - 1', puzzle.solution.length === pegs - 1,
    puzzle.solution.length + ' vs ' + (pegs - 1));
  check(tag + ': no target hole', puzzle.target === null);
  check(tag + ': seed is stored', puzzle.seed === (seed >>> 0), String(puzzle.seed));
  const walkResult = walk(puzzle.boardId, puzzle.pegs, puzzle.solution);
  check(tag + ': every certificate move is a legal jump', walkResult.ok === true, walkResult.reason);
  check(tag + ': the certificate ends with one peg', singleIndex(walkResult.pegs) >= 0);
  const replayResult = Engine.replay(puzzle, puzzle.solution);
  check(tag + ': engine replay is valid', replayResult.valid === true, replayResult.reason);
  if (seedIndex < 12) {
    check(tag + ': generation is deterministic',
      JSON.stringify(Engine.generate(seed)) === JSON.stringify(puzzle));
  }
});
check('generated puzzles span at least three boards', generatedBoards.size >= 3,
  Array.from(generatedBoards.entries()).map(pair => pair[0] + ':' + pair[1]).join(' '));
console.log('      peg range ' + generatedPegMin + '–' + generatedPegMax + ', boards ' +
  Array.from(generatedBoards.entries()).map(pair => pair[0] + ':' + pair[1]).join(' '));

const stringSeedA = Engine.generate('pegs-daily:2026-10-18');
const stringSeedB = Engine.generate('pegs-daily:2026-10-19');
check('string seeds preserve daily determinism', JSON.stringify(stringSeedA) === JSON.stringify(Engine.generate('pegs-daily:2026-10-18')));
check('different string seeds make different puzzles', JSON.stringify(stringSeedA.pegs) !== JSON.stringify(stringSeedB.pegs) || stringSeedA.boardId !== stringSeedB.boardId);
check('string-seeded certificate replays', Engine.replay(stringSeedA,stringSeedA.solution).valid);
section('daily seed (UTC+8)');
check('mid-morning UTC stays on the Shanghai day',
  Engine.shanghaiDateString(new Date('2026-03-01T09:30:00Z')) === '2026-03-01',
  Engine.shanghaiDateString(new Date('2026-03-01T09:30:00Z')));
check('15:59:59 UTC is still the same Shanghai day',
  Engine.shanghaiDateString(new Date('2026-03-01T15:59:59Z')) === '2026-03-01',
  Engine.shanghaiDateString(new Date('2026-03-01T15:59:59Z')));
check('16:00:00 UTC rolls over to the next Shanghai day',
  Engine.shanghaiDateString(new Date('2026-03-01T16:00:00Z')) === '2026-03-02',
  Engine.shanghaiDateString(new Date('2026-03-01T16:00:00Z')));
check('year boundary rolls over',
  Engine.shanghaiDateString(new Date('2025-12-31T16:00:00Z')) === '2026-01-01',
  Engine.shanghaiDateString(new Date('2025-12-31T16:00:00Z')));
check('local time is not used', Engine.shanghaiDateString(new Date('2026-06-30T23:00:00Z')) === '2026-07-01',
  Engine.shanghaiDateString(new Date('2026-06-30T23:00:00Z')));
const dayA1 = new Date('2026-03-01T01:00:00Z'), dayA2 = new Date('2026-03-01T14:00:00Z');
const dayB = new Date('2026-03-02T01:00:00Z');
check('same Shanghai day gives the same seed', Engine.dailySeed(dayA1) === Engine.dailySeed(dayA2));
check('a new Shanghai day gives a new seed', Engine.dailySeed(dayA1) !== Engine.dailySeed(dayB));
check('daily seed is a 32-bit value', Engine.dailySeed(dayA1) >>> 0 === Engine.dailySeed(dayA1));
const dailyPuzzle = Engine.generate(Engine.dailySeed(dayA1));
check('the daily puzzle replays', Engine.replay(dailyPuzzle, dailyPuzzle.solution).valid === true);
check('the daily puzzle is deterministic for its seed',
  JSON.stringify(Engine.generate(Engine.dailySeed(dayA1))) === JSON.stringify(dailyPuzzle));
check('another day yields another puzzle',
  JSON.stringify(Engine.generate(Engine.dailySeed(dayB))) !== JSON.stringify(dailyPuzzle));
check('randomSeed honours an injected generator', Engine.randomSeed(() => 7) === 7);

/* ----------------------------------------- mod 2 invariant self-consistency */

section('mod 2 invariant check');
// Weights w with w(from) + w(over) + w(to) = 0 (mod 2) for every jump make the
// xor of the weights of the occupied holes invariant. If this null space is
// computed correctly, every basis vector must satisfy every jump.
function nullSpaceBasis(size, rows) {
  const matrix = rows.map(row => row.slice());
  const pivots = [];
  let pivotRow = 0;
  for (let col = 0; col < size && pivotRow < matrix.length; col++) {
    let selected = -1;
    for (let row = pivotRow; row < matrix.length; row++) if (matrix[row][col]) { selected = row; break; }
    if (selected < 0) continue;
    const swap = matrix[pivotRow]; matrix[pivotRow] = matrix[selected]; matrix[selected] = swap;
    for (let row = 0; row < matrix.length; row++) {
      if (row === pivotRow || !matrix[row][col]) continue;
      for (let c = col; c < size; c++) matrix[row][c] ^= matrix[pivotRow][c];
    }
    pivots.push(col); pivotRow++;
  }
  const isPivot = new Array(size).fill(false);
  pivots.forEach(col => { isPivot[col] = true; });
  const basis = [];
  for (let col = 0; col < size; col++) {
    if (isPivot[col]) continue;
    const vector = new Array(size).fill(0);
    vector[col] = 1;
    pivots.forEach((pivotCol, row) => { vector[pivotCol] = matrix[row][col]; });
    basis.push(vector);
  }
  return basis;
}
function xorWeight(pegs, vector) {
  let value = 0;
  for (let i = 0; i < pegs.length; i++) if (pegs[i]) value ^= vector[i];
  return value;
}
for (const boardId of Engine.BOARD_ORDER) {
  const board = Engine.BOARD_TYPES[boardId];
  const jumps = expectedJumps(boardId);
  const rows = jumps.map(jump => {
    const row = new Array(board.size).fill(0);
    row[jump[0]] = 1; row[jump[1]] = 1; row[jump[2]] = 1;
    return row;
  });
  const basis = nullSpaceBasis(board.size, rows);
  let valid = true;
  for (const vector of basis) {
    for (const jump of jumps) {
      if (vector[jump[0]] ^ vector[jump[1]] ^ vector[jump[2]]) { valid = false; break; }
    }
    if (!valid) break;
  }
  check(boardId + ': mod 2 weights satisfy every jump', valid);
  console.log('      ' + boardId + ': ' + basis.length + ' independent mod 2 invariant weight(s)');
  const sample = basis.slice(0, 4);
  const puzzles = Engine.LEVELS.filter(puzzle => puzzle.boardId === boardId);
  for (const puzzle of puzzles) {
    const walkResult = walk(boardId, puzzle.pegs, puzzle.solution);
    const finalPegs = new Array(board.size).fill(0);
    finalPegs[singleIndex(walkResult.pegs)] = 1;
    for (const vector of sample) {
      check(boardId + ': invariant is conserved by the certificate',
        xorWeight(puzzle.pegs, vector) === xorWeight(finalPegs, vector));
    }
  }
}

section('summary');
console.log(checks + ' checks, ' + failures + ' failures');
if (failures) process.exitCode = 1;
