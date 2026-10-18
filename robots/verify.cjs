'use strict';

// Independent verification for the Robots engine.
//   node robots/verify.cjs
// The slides, walls and reachability below are implemented from scratch; the engine
// is only asked for its own answer so the two can be compared.

const ENGINE = require('./engine.js');

let checks = 0, failures = 0;
function ok(condition, label) {
  checks++;
  if (!condition) { failures++; console.error('FAIL  ' + label); }
}
function eq(actual, expected, label) {
  ok(actual === expected, label + ' — got ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected));
}
function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

const DELTAS = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
const DIR_NAMES = ['up', 'right', 'down', 'left'];

// ---------------------------------------------------------------------------
// Independent model
// ---------------------------------------------------------------------------

function decode(code) {
  const axis = code & 1, cell = code >> 1, x = cell % 32, y = (cell - x) / 32;
  return { x, y, axis };
}
function wallCode(x, y, axis) {
  return (y * 32 + x) * 2 + axis;
}
function blocked(state, set, x, y, dx, dy) {
  if (dx === 1) return x + 1 >= state.w || set.has(wallCode(x, y, 0));
  if (dx === -1) return x - 1 < 0 || set.has(wallCode(x - 1, y, 0));
  if (dy === 1) return y + 1 >= state.h || set.has(wallCode(x, y, 1));
  if (dy === -1) return y - 1 < 0 || set.has(wallCode(x, y - 1, 1));
  throw new Error('bad direction');
}
function occupiedByOther(state, index, x, y) {
  return state.robots.some((cell, i) => i !== index && cell[0] === x && cell[1] === y);
}
function refSlide(state, set, index, dir) {
  const [dx, dy] = DELTAS[dir];
  const start = state.robots[index];
  let x = start[0], y = start[1], steps = 0, blockedBy = 'wall';
  for (;;) {
    if (blocked(state, set, x, y, dx, dy)) { blockedBy = 'wall'; break; }
    const nx = x + dx, ny = y + dy;
    if (occupiedByOther(state, index, nx, ny)) { blockedBy = 'robot'; break; }
    x = nx; y = ny; steps++;
  }
  if (steps === 0) return null;
  return { robot: index, dir, from: [start[0], start[1]], to: [x, y], steps, blockedBy };
}
function refMove(state, move) {
  const next = {
    w: state.w, h: state.h,
    robots: state.robots.map(cell => cell.slice()),
    targets: state.targets.map(cell => cell.slice()),
    walls: state.walls.slice()
  };
  next.robots[move.robot] = [move.to[0], move.to[1]];
  return next;
}
function refWon(state) {
  return state.robots.every((cell, i) => cell[0] === state.targets[i][0] && cell[1] === state.targets[i][1]);
}
function refRelaxed(state, index) {
  const set = new Set(state.walls);
  const size = state.w * state.h;
  const dist = new Array(size).fill(-1);
  const start = state.robots[index];
  dist[start[1] * state.w + start[0]] = 0;
  const queue = [start[1] * state.w + start[0]];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head], x = cell % state.w, y = (cell - x) / state.w;
    for (const dir of DIR_NAMES) {
      const [dx, dy] = DELTAS[dir];
      let cx = x, cy = y;
      for (;;) {
        if (blocked(state, set, cx, cy, dx, dy)) break;
        cx += dx; cy += dy;
        const next = cy * state.w + cx;
        if (dist[next] === -1) { dist[next] = dist[cell] + 1; queue.push(next); }
      }
    }
  }
  const target = state.targets[index];
  return dist[target[1] * state.w + target[0]];
}
function refLowerBound(state) {
  let total = 0;
  for (let i = 0; i < state.robots.length; i++) {
    const value = refRelaxed(state, i);
    if (value < 0) return Infinity;
    total += value;
  }
  return total;
}
function refReplay(state, solution) {
  let current = {
    w: state.w, h: state.h,
    robots: state.robots.map(cell => cell.slice()),
    targets: state.targets.map(cell => cell.slice()),
    walls: state.walls.slice()
  };
  for (let i = 0; i < solution.length; i++) {
    const step = solution[i];
    if (!step || !DIR_NAMES.includes(step.dir) || !Number.isInteger(step.robot)) return { valid: false, reason: 'step', index: i };
    const set = new Set(current.walls);
    const move = refSlide(current, set, step.robot, step.dir);
    if (!move) return { valid: false, reason: 'illegal', index: i };
    current = refMove(current, move);
    for (let a = 0; a < current.robots.length; a++) {
      for (let b = a + 1; b < current.robots.length; b++) {
        if (current.robots[a][0] === current.robots[b][0] && current.robots[a][1] === current.robots[b][1]) {
          return { valid: false, reason: 'overlap', index: i };
        }
      }
    }
  }
  return { valid: refWon(current), final: current };
}
function refConnected(state) {
  const set = new Set(state.walls);
  const size = state.w * state.h;
  const seen = new Array(size).fill(false);
  seen[0] = true;
  const queue = [0];
  let reached = 1;
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head], x = cell % state.w, y = (cell - x) / state.w;
    for (const dir of DIR_NAMES) {
      const [dx, dy] = DELTAS[dir];
      if (blocked(state, set, x, y, dx, dy)) continue;
      const next = (y + dy) * state.w + (x + dx);
      if (!seen[next]) { seen[next] = true; reached++; queue.push(next); }
    }
  }
  const centerFrame=[[6,7,0],[6,8,0],[8,7,0],[8,8,0],[7,6,1],[8,6,1],[7,8,1],[8,8,1]];
  const blockedCount=state.w===16&&state.h===16&&centerFrame.every(([x,y,a])=>set.has(wallCode(x,y,a)))?4:0;
  return { connected: reached === size-blockedCount, reached, total: size-blockedCount };
}
function refMinOpen(state) {
  const set = new Set(state.walls);
  let min = 4;
  for (let y = 0; y < state.h; y++) {
    for (let x = 0; x < state.w; x++) {
      let open = 0;
      for (const dir of DIR_NAMES) {
        const [dx, dy] = DELTAS[dir];
        if (!blocked(state, set, x, y, dx, dy)) open++;
      }
      min = Math.min(min, open);
    }
  }
  return min;
}

// Minimum slides for four labelled robots, computed by breadth-first search over the
// joint configuration graph. Only small boards are tractable.
function minSlides(state, limit) {
  const seen = new Set([state.robots.map(cell => cell.join(',')).join('|')]);
  let frontier = [state];
  for (let depth = 0; depth <= limit; depth++) {
    const next = [];
    for (const current of frontier) {
      if (refWon(current)) return depth;
      const set = new Set(current.walls);
      for (let i = 0; i < current.robots.length; i++) {
        for (const dir of DIR_NAMES) {
          const move = refSlide(current, set, i, dir);
          if (!move) continue;
          const after = refMove(current, move);
          const key = after.robots.map(cell => cell.join(',')).join('|');
          if (seen.has(key)) continue;
          seen.add(key);
          next.push(after);
        }
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return -1;
}

function randomState(w, h, rnd, walls) {
  const cells = [];
  while (cells.length < 4) {
    const cell = [Math.floor(rnd() * w), Math.floor(rnd() * h)];
    if (!cells.some(other => other[0] === cell[0] && other[1] === cell[1])) cells.push(cell);
  }
  const targets = [];
  while (targets.length < 4) {
    const cell = [Math.floor(rnd() * w), Math.floor(rnd() * h)];
    if (!targets.some(other => other[0] === cell[0] && other[1] === cell[1])) targets.push(cell);
  }
  return { w, h, robots: cells, targets, walls: walls.slice() };
}

// ---------------------------------------------------------------------------
// 1. Rules: sliding, walls, collisions, no pushing, blocked moves
// ---------------------------------------------------------------------------

(function slidesAndWalls() {
  const rnd = ENGINE.randomFor('verify-slides');
  let blockedSeen = 0, robotStops = 0, wallStops = 0;
  for (let trial = 0; trial < 300; trial++) {
    const w = 4 + Math.floor(rnd() * 4), h = 4 + Math.floor(rnd() * 4);
    const walls = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w - 1; x++) if (rnd() < 0.3) walls.push(wallCode(x, y, 0));
    for (let y = 0; y < h - 1; y++) for (let x = 0; x < w; x++) if (rnd() < 0.3) walls.push(wallCode(x, y, 1));
    const state = randomState(w, h, rnd, walls);
    const set = new Set(walls);
    const before = JSON.stringify(state.robots);
    for (let i = 0; i < 4; i++) {
      for (const dir of DIR_NAMES) {
        const mine = refSlide(state, set, i, dir);
        const theirs = ENGINE.slide(state, i, dir);
        ok(deepEqual(mine, theirs), 'slide agrees with the independent model (' + JSON.stringify({ w, h, walls, robots: state.robots, i, dir }) + ')');
        const applied = ENGINE.applyMove(state, { robot: i, dir });
        if (!mine) {
          blockedSeen++;
          eq(applied.ok, false, 'a blocked slide is not a move');
          continue;
        }
        if (mine.blockedBy === 'robot') robotStops++; else wallStops++;
        eq(applied.ok, true, 'legal slide applies');
        const after = applied.state;
        for (let j = 0; j < 4; j++) {
          if (j === i) continue;
          ok(after.robots[j][0] === state.robots[j][0] && after.robots[j][1] === state.robots[j][1], 'no robot is pushed');
        }
        ok(after.robots[i][0] === mine.to[0] && after.robots[i][1] === mine.to[1], 'the moving robot lands where the model says');
        ok(!after.robots.some((cell, j) => j !== i && cell[0] === mine.to[0] && cell[1] === mine.to[1]), 'no two robots share a cell');
        ok(mine.to[0] !== mine.from[0] || mine.to[1] !== mine.from[1], 'a slide always moves at least one cell');
        const [dx, dy] = DELTAS[dir];
        ok(blocked(state, set, mine.to[0], mine.to[1], dx, dy) || occupiedByOther(state, i, mine.to[0] + dx, mine.to[1] + dy), 'the slide stops against a wall, the edge, or a robot');
        let cx = mine.from[0] + dx, cy = mine.from[1] + dy;
        while (cx !== mine.to[0] || cy !== mine.to[1]) {
          ok(!blocked(state, set, cx - dx, cy - dy, dx, dy), 'no wall is crossed on the way');
          ok(!occupiedByOther(state, i, cx, cy), 'no robot is passed through');
          cx += dx; cy += dy;
        }
        ok(JSON.stringify(state.robots) === before, 'the original state is left untouched');
      }
    }
    // One code per edge, and both neighbouring cells read the same wall.
    for (const code of walls) {
      const { x, y, axis } = decode(code);
      if (axis === 0) {
        ok(blocked(state, set, x, y, 1, 0) && blocked(state, set, x + 1, y, -1, 0), 'a vertical wall blocks both of its cells');
      } else {
        ok(blocked(state, set, x, y, 0, 1) && blocked(state, set, x, y + 1, 0, -1), 'a horizontal wall blocks both of its cells');
      }
    }
  }
  ok(blockedSeen > 50, 'the sample exercised blocked directions (' + blockedSeen + ')');
  ok(robotStops > 50, 'the sample exercised robot stops (' + robotStops + ')');
  ok(wallStops > 50, 'the sample exercised wall stops (' + wallStops + ')');
})();

(function wallSymmetry() {
  const state = { w: 8, h: 8, robots: [[0, 0], [1, 0], [2, 0], [3, 0]], targets: [[0, 0], [1, 0], [2, 0], [3, 0]], walls: [ENGINE.edgeCode(3, 4, 0), ENGINE.edgeCode(2, 5, 1)] };
  ok(blocked(state, new Set(state.walls), 3, 4, 1, 0), 'the left cell sees the vertical wall');
  ok(blocked(state, new Set(state.walls), 4, 4, -1, 0), 'the right cell sees the same vertical wall');
  ok(blocked(state, new Set(state.walls), 2, 5, 0, 1), 'the upper cell sees the horizontal wall');
  ok(blocked(state, new Set(state.walls), 2, 6, 0, -1), 'the lower cell sees the same horizontal wall');
  ok(!blocked(state, new Set(state.walls), 3, 4, -1, 0), 'a neighbouring edge stays open');
  // No pushing: two robots in a row, the first cannot run into the second.
  const packed = { w: 6, h: 6, robots: [[1, 1], [2, 1], [4, 4], [5, 5]], targets: [[0, 0], [1, 0], [2, 0], [3, 0]], walls: [] };
  eq(ENGINE.slide(packed, 0, 'right'), null, 'a robot cannot slide into the robot next to it');
  eq(ENGINE.slide(packed, 1, 'left'), null, 'the neighbour cannot slide back into it either');
  ok(ENGINE.slide(packed, 0, 'down') !== null, 'the same robot still slides the other way');
})();

(function validation() {
  const good = { w: 4, h: 4, robots: [[0, 0], [1, 0], [2, 0], [3, 0]], targets: [[0, 1], [1, 1], [2, 1], [3, 1]], walls: [] };
  ok(ENGINE.validate(good), 'a well formed state validates');
  ok(ENGINE.sameState(good, ENGINE.clone(good)), 'clone keeps the state');
  let threw = false;
  try { ENGINE.validate({ ...good, robots: [[0, 0], [0, 0], [2, 0], [3, 0]] }); } catch { threw = true; }
  ok(threw, 'overlapping robots are rejected');
  threw = false;
  try { ENGINE.validate({ ...good, targets: [[0, 1], [0, 1], [2, 1], [3, 1]] }); } catch { threw = true; }
  ok(threw, 'overlapping targets are rejected');
  threw = false;
  try { ENGINE.validate({ ...good, walls: [ENGINE.edgeCode(0, 3, 1)] }); } catch { threw = true; }
  ok(threw, 'a wall outside the board is rejected');
  threw = false;
  try { ENGINE.slide(good, 0, 'diagonal'); } catch { threw = true; }
  ok(threw, 'an unknown direction is rejected');
  threw = false;
  try { ENGINE.slide(good, 9, 'up'); } catch { threw = true; }
  ok(threw, 'an unknown robot is rejected');
  // Robot on its own target: still movable, and the win state is a joint condition.
  const lifted = { w: 5, h: 5, robots: [[0, 0], [1, 0], [2, 0], [3, 0]], targets: [[0, 0], [1, 1], [2, 1], [3, 1]], walls: [] };
  eq(ENGINE.onTargetCount(lifted), 1, 'one robot is on its target');
  eq(ENGINE.isWon(lifted), false, 'one robot on its target does not win');
  ok(ENGINE.slide(lifted, 0, 'down') !== null, 'a robot standing on its target can still move');
})();

// ---------------------------------------------------------------------------
// 2. The relaxed distance is a true lower bound
// ---------------------------------------------------------------------------

(function relaxedBoundIsSafe() {
  const rnd = ENGINE.randomFor('verify-bounds');
  let solved = 0;
  for (let trial = 0; trial < 24; trial++) {
    const base = { w: 4, h: 4, robots: [[0, 0], [1, 3], [2, 0], [3, 3]], targets: [[0, 3], [1, 0], [2, 3], [3, 0]], walls: [] };
    // Build a genuinely solvable small puzzle by walking forward with the model.
    const walk = [];
    let current = { ...base, robots: base.robots.map(cell => cell.slice()) };
    for (let step = 0; step < 3 + Math.floor(rnd() * 4); step++) {
      const set = new Set(current.walls);
      const options = [];
      for (let i = 0; i < 4; i++) for (const dir of DIR_NAMES) { const move = refSlide(current, set, i, dir); if (move) options.push(move); }
      if (!options.length) break;
      const move = options[Math.floor(rnd() * options.length)];
      current = refMove(current, move);
      walk.push({ robot: move.robot, dir: move.dir });
    }
    if (!walk.length) continue;
    const puzzle = { w: 4, h: 4, robots: base.robots.map(cell => cell.slice()), targets: current.robots.map(cell => cell.slice()), walls: [] };
    // Partially parked configurations still exercise the joint lower bound.
    if (refWon(puzzle)) continue;
    const optimum = minSlides(puzzle, 12);
    if (optimum < 0) continue;
    solved++;
    const mine = refLowerBound(puzzle);
    const theirs = ENGINE.relaxedLowerBound(puzzle);
    eq(theirs.total, mine, 'the engine and the model agree on the relaxed bound');
    ok(mine <= optimum, 'the relaxed bound never exceeds the true minimum (' + mine + ' <= ' + optimum + ')');
    ok(optimum <= walk.length, 'the constructed route is never shorter than the minimum');
    ok(ENGINE.replay(puzzle, walk).valid, 'the constructed route solves the small puzzle');
  }
  ok(solved > 5, 'the small board search produced solvable puzzles (' + solved + ')');
})();

// ---------------------------------------------------------------------------
// 3. The twelve fixed levels and the generated puzzles
// ---------------------------------------------------------------------------

function checkPuzzle(puzzle, label) {
  ok(ENGINE.validate(puzzle), label + ': the puzzle validates');
  ok(Array.isArray(puzzle.solution) && puzzle.solution.length > 0, label + ': the certificate is a non-empty list');
  const decoded = puzzle.walls.map(decode);
  ok(new Set(puzzle.walls).size === puzzle.walls.length, label + ': every wall edge is stored once');
  for (const { x, y, axis } of decoded) {
    ok(axis === 0 ? (x >= 0 && x <= puzzle.w - 2 && y >= 0 && y <= puzzle.h - 1) : (x >= 0 && x <= puzzle.w - 1 && y >= 0 && y <= puzzle.h - 2), label + ': wall inside the board');
  }
  const connection = refConnected(puzzle);
  ok(connection.connected, label + ': every cell is reachable (' + connection.reached + '/' + connection.total + ')');
  ok(refMinOpen(puzzle) >= 2, label + ': every cell has at least two open sides');
  ok(puzzle.robots.every((cell, i) => cell[0] !== puzzle.targets[i][0] || cell[1] !== puzzle.targets[i][1]), label + ': no robot starts on its own target');
  ok(!refWon(puzzle), label + ': the puzzle is not solved at the start');
  const targets = new Set(puzzle.targets.map(cell => cell.join(',')));
  eq(targets.size, 4, label + ': the four targets are distinct cells');
  const robots = new Set(puzzle.robots.map(cell => cell.join(',')));
  eq(robots.size, 4, label + ': the four robots start on distinct cells');

  const mine = refReplay(puzzle, puzzle.solution);
  ok(mine.valid, label + ': the independent replay also solves the puzzle (' + (mine.reason || 'solved') + ')');
  const theirs = ENGINE.replay(puzzle, puzzle.solution);
  ok(theirs.valid, label + ': the engine replay solves the puzzle');
  eq(theirs.states.length, puzzle.solution.length + 1, label + ': the replay records every step');
  const final = mine.final;
  if (final) {
    for (let i = 0; i < 4; i++) {
      eq(final.robots[i].join(','), puzzle.targets[i].join(','), label + ': robot ' + i + ' finishes on its own target');
    }
  }
  const bound = refLowerBound(puzzle);
  ok(Number.isFinite(bound), label + ': the relaxed bound is finite');
  ok(bound <= puzzle.solution.length, label + ': the relaxed bound does not exceed the certificate length');
  eq(ENGINE.relaxedLowerBound(puzzle).total, bound, label + ': engine and model agree on the bound');
  // Every wall the engine reports must match the model, and the other edges must not.
  const set = new Set(puzzle.walls);
  for (let y = 0; y < puzzle.h; y++) {
    for (let x = 0; x < puzzle.w; x++) {
      for (const dir of DIR_NAMES) {
        const [dx, dy] = DELTAS[dir];
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= puzzle.w || ny < 0 || ny >= puzzle.h) continue;
        const code = dx === 1 ? wallCode(x, y, 0) : dx === -1 ? wallCode(nx, y, 0) : dy === 1 ? wallCode(x, y, 1) : wallCode(x, ny, 1);
        eq(blocked(puzzle, set, x, y, dx, dy), blocked(puzzle, set, nx, ny, -dx, -dy), label + ': wall reads the same from both sides');
        eq(set.has(code), blocked(puzzle, set, x, y, dx, dy), label + ': the wall list matches the edge model');
      }
    }
  }
  return { bound, length: puzzle.solution.length };
}

const levelSummary = [];
for (let index = 0; index < ENGINE.LEVELS.length; index++) {
  const level = ENGINE.LEVELS[index];
  const puzzle = ENGINE.generateLevel(index);
  const again = ENGINE.generateLevel(index);
  ok(deepEqual(puzzle, again), 'level ' + (index + 1) + ' is reproducible');
  eq(ENGINE.generate(puzzle.seed, ENGINE.LEVELS[index]).solution.length, puzzle.solution.length, 'level ' + (index + 1) + ' uses its documented seed');
  ok(puzzle.walls.length>=48,'fixed level has reference-scale short walls');
  eq(puzzle.layout,'scatter','fixed level uses randomized corners');
  eq(ENGINE.centralCells(puzzle).size,4,'central four cells are inaccessible');
  ok(puzzle.meta.interiorTargets===4,'all four targets are internal');
  ok(puzzle.meta.supports>=(index<6?1:2),'target placement requires another robot as stopper');
  const report = checkPuzzle(puzzle, 'level ' + (index + 1) + ' (' + level.name + ')');
  ok(puzzle.solution.length >= level.minMoves || puzzle.meta.fallback, 'level ' + (index + 1) + ': the certificate is at least as long as the requested minimum');
  ok(report.bound >= puzzle.meta.minRelaxed || puzzle.meta.fallback, 'level ' + (index + 1) + ': the bound reaches the floor of the branch that produced it');
  ok(puzzle.meta.minRelaxed <= level.minRelaxed, 'level ' + (index + 1) + ': the branch never asks for more than the level declares');
  ok(puzzle.meta.robotStops >= puzzle.meta.minRobotStops || puzzle.meta.fallback, 'level ' + (index + 1) + ': enough stops against another robot');
  ok(puzzle.meta.interiorTargets >= puzzle.meta.minInterior || puzzle.meta.fallback, 'level ' + (index + 1) + ': enough targets away from the outer wall');
  ok(puzzle.meta.relax < 3 || puzzle.meta.fallback, 'level ' + (index + 1) + ': the loosest fallback branch was not needed');
  eq(puzzle.meta.wallCount, puzzle.walls.length, 'level ' + (index + 1) + ': the reported wall count matches');
  eq(puzzle.meta.lower, report.bound, 'level ' + (index + 1) + ': the reported bound matches the independent bound');
  eq(puzzle.meta.moves, puzzle.solution.length, 'level ' + (index + 1) + ': the reported move count matches the certificate');
  levelSummary.push(index + 1 + ':' + level.name + ' walls=' + puzzle.walls.length + ' cert=' + puzzle.solution.length
    + ' bound=' + report.bound + ' stops=' + puzzle.meta.robotStops + ' interior=' + puzzle.meta.interiorTargets
    + ' branch=' + puzzle.meta.relax + ' tries=' + puzzle.meta.attempts + (puzzle.meta.fallback ? ' FALLBACK' : ''));
}
eq(ENGINE.LEVELS.length, 12, 'there are twelve fixed levels');
ok(levelSummary.every(text => text.indexOf('FALLBACK') < 0), 'no fixed level needed the fallback puzzle');
ok(new Set(ENGINE.LEVELS.map((_,i)=>{const p=ENGINE.generateLevel(i);return JSON.stringify([p.walls,p.robots,p.targets]);})).size===12,'all twelve fixed puzzles are distinct');

(function earlyLevelsAreShorter() {
  const puzzles = ENGINE.LEVELS.map((level, index) => ENGINE.generateLevel(index));
  const lengths = puzzles.map(puzzle => puzzle.solution.length);
  const mean = list => list.reduce((a, b) => a + b, 0) / list.length;
  ok(mean(lengths.slice(0, 3)) < mean(lengths.slice(9)), 'the closing levels carry longer certificates (' + mean(lengths.slice(0, 3)) + ' < ' + mean(lengths.slice(9)) + ')');
  const bounds = puzzles.map(puzzle => ENGINE.relaxedLowerBound(puzzle).total);
  ok(mean(bounds.slice(0, 3)) < mean(bounds.slice(9)), 'the closing levels carry a larger proven lower bound (' + mean(bounds.slice(0, 3)) + ' < ' + mean(bounds.slice(9)) + ')');
})();

(function randomAndDaily() {
  let fallbacks = 0, seen = new Set();
  for (let index = 0; index < 60; index++) {
    const tier = index % ENGINE.LEVELS.length;
    const seed = 'robots-random:verify:' + index + ':' + tier;
    const puzzle = ENGINE.generate(seed, ENGINE.levelOptions(tier));
    if (puzzle.meta.fallback){fallbacks++;ok(puzzle.walls.length>=48&&puzzle.meta.lower>=ENGINE.LEVELS[tier].minRelaxed&&puzzle.meta.supports>=ENGINE.LEVELS[tier].minSupports,'reserve maintains requested difficulty');}
    ok(deepEqual(puzzle, ENGINE.generate(seed, ENGINE.levelOptions(tier))), 'random puzzle ' + index + ' is reproducible');
    checkPuzzle(puzzle, 'random ' + index);
    const key = puzzle.walls.join(',') + '|' + puzzle.robots.join(';') + '|' + puzzle.targets.join(';');
    seen.add(key);
  }
  ok(seen.size >= 55, 'random puzzles are genuinely different (' + seen.size + '/60 distinct)');
  console.log('certified hard reserves used: '+fallbacks);

  const dates = [];
  for (let day = 0; day < 32; day++) {
    const stamp = new Date(Date.UTC(2026, 0, 1 + day, 4, 0, 0));
    dates.push(ENGINE.shanghaiDateString(stamp));
  }
  eq(dates[0], '2026-01-01', 'the daily date for 2026-01-01T04:00Z');
  eq(dates[31], '2026-02-01', 'the daily date for 2026-02-01T04:00Z');
  eq(ENGINE.shanghaiDateString('2026-03-10T15:59:59Z'), '2026-03-10', 'the daily date just before the Beijing rollover');
  eq(ENGINE.shanghaiDateString('2026-03-10T16:00:00Z'), '2026-03-11', 'the daily date just after the Beijing rollover');
  eq(ENGINE.shanghaiDateString('2026-03-10T16:00:00Z'), ENGINE.shanghaiDateString('2026-03-10T23:00:00Z'), 'the same Beijing day gives the same date');
  let threw = false;
  try { ENGINE.shanghaiDateString('not a date'); } catch { threw = true; }
  ok(threw, 'an invalid date is rejected');

  const dailySeeds = new Set();
  const tiers = new Set();
  for (const date of dates) {
    const tier = ENGINE.dailyTier(date);
    tiers.add(tier);
    const seed = 'robots-daily:' + date;
    const puzzle = ENGINE.generate(seed, ENGINE.levelOptions(tier));
    ok(deepEqual(puzzle, ENGINE.generate(seed, ENGINE.levelOptions(tier))), 'daily ' + date + ' is reproducible');
    checkPuzzle(puzzle, 'daily ' + date);
    ok(puzzle.meta.moves > 0, 'daily ' + date + ' has a non-trivial route');
    ok(puzzle.meta.moves >= ENGINE.LEVELS[tier].minMoves || puzzle.meta.fallback, 'daily ' + date + ' reaches the tier minimum');
    const key = puzzle.walls.join(',') + '|' + puzzle.robots.join(';');
    ok(!dailySeeds.has(key), 'daily ' + date + ' differs from the other sampled days');
    dailySeeds.add(key);
  }
  ok(tiers.size > 4, 'the daily date walks through several tiers (' + tiers.size + ')');
  eq(ENGINE.dailyTier('2026-01-01'), ENGINE.dailyTier('2026-01-01'), 'the daily tier is a function of the date');
})();

// ---------------------------------------------------------------------------
// 4. Bounded work, cancellation and the fallback
// ---------------------------------------------------------------------------

(function boundedWork() {
  const iterator = ENGINE.generateSteps('robots-random:probe', ENGINE.levelOptions(3));
  let step = iterator.next(), yields = 0;
  while (!step.done) { yields++; step = iterator.next(); }
  ok(yields > 0, 'generateSteps yields progress before it finishes');
  ok(step.value && step.value.solution.length > 0, 'generateSteps returns a certified puzzle');

  const impossible = ENGINE.generate('robots-random:impossible', {
    layout: 'open', walk: 8, blockBias: 0.5,
    minMoves: 999, minRelaxed: 999, minRobotStops: 99, minInterior: 99, spread: 'wide'
  });
  ok(impossible.meta.fallback || impossible.meta.relax === 3, 'unreachable filters finish via bounded relaxation or the certified fallback');
  ok(deepEqual(impossible, ENGINE.generate('robots-random:impossible', {
    layout: 'open', walk: 8, blockBias: 0.5,
    minMoves: 999, minRelaxed: 999, minRobotStops: 99, minInterior: 99, spread: 'wide'
  })), 'the fallback path is deterministic');
  checkPuzzle(impossible, 'fallback');
  const fallbackReplay = refReplay(ENGINE.FALLBACK_PUZZLE, ENGINE.FALLBACK_PUZZLE.solution);
  ok(fallbackReplay.valid, 'the hand-checked fallback puzzle is solved by its own route');
  eq(ENGINE.FALLBACK_PUZZLE.solution.length, 4, 'the fallback route has four steps');
  ok(ENGINE.relaxedLowerBound(ENGINE.FALLBACK_PUZZLE).total <= 4, 'the fallback bound is at most its route length');
})();

(function movesAndLists() {
  const puzzle = ENGINE.generateLevel(4);
  const moves = ENGINE.legalMoves(puzzle);
  const manual = [];
  for (let i = 0; i < 4; i++) for (const dir of DIR_NAMES) { const move = ENGINE.slide(puzzle, i, dir); if (move) manual.push(move); }
  eq(moves.length, manual.length, 'legalMoves lists every legal slide');
  ok(deepEqual(moves, manual), 'legalMoves matches the per-direction enumeration');
  const byDir = {};
  for (const move of moves) byDir[move.dir] = (byDir[move.dir] || 0) + 1;
  ok(Object.keys(byDir).every(dir => DIR_NAMES.includes(dir)), 'every listed move uses a known direction');
  eq(moves.length, ENGINE.legalMoves(puzzle).length, 'legalMoves is stable');
  const blocked = ENGINE.applyMove(puzzle, { robot: 0, dir: 'nonsense' });
  eq(blocked.ok, false, 'an unknown direction never counts as a move');
})();

// ---------------------------------------------------------------------------

console.log('level  ' + levelSummary.join('\n       '));
console.log('checks ' + checks + ', failures ' + failures);
process.exitCode = failures ? 1 : 0;
