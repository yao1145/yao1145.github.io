(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RobotsEngine = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const BOARD_W = 16, BOARD_H = 16, ROBOT_COUNT = 4, MAX_SIDE = 32;

  // Direction order is up, right, down, left: the order quoted by the source game.
  const DIRS = Object.freeze([
    Object.freeze({ key: 'up', dx: 0, dy: -1 }),
    Object.freeze({ key: 'right', dx: 1, dy: 0 }),
    Object.freeze({ key: 'down', dx: 0, dy: 1 }),
    Object.freeze({ key: 'left', dx: -1, dy: 0 })
  ]);
  const DIR_KEYS = Object.freeze(DIRS.map(d => d.key));

  function resolveDir(dir) {
    if (typeof dir === 'string') return DIRS.find(d => d.key === dir) || null;
    if (Number.isInteger(dir) && dir >= 0 && dir < DIRS.length) return DIRS[dir];
    return null;
  }

  // Walls live on cell edges. One code covers both sides of the edge, so the two
  // neighbouring cells always agree on whether the edge is blocked.
  //   axis 0: vertical edge between (x, y) and (x + 1, y)
  //   axis 1: horizontal edge between (x, y) and (x, y + 1)
  const edgeCode = (x, y, axis) => (y * MAX_SIDE + x) * 2 + axis;
  function decodeWall(code) {
    const axis = code & 1, cell = code >> 1, x = cell % MAX_SIDE, y = (cell - x) / MAX_SIDE;
    return { x, y, axis };
  }

  const CENTER_FRAME = Object.freeze([
    edgeCode(6,7,0),edgeCode(6,8,0),edgeCode(8,7,0),edgeCode(8,8,0),
    edgeCode(7,6,1),edgeCode(8,6,1),edgeCode(7,8,1),edgeCode(8,8,1)
  ]);
  function centralCells(state) {
    if(state.w!==16 || state.h!==16)return new Set();
    const walls=new Set(state.walls);
    return CENTER_FRAME.every(code=>walls.has(code)) ? new Set([119,120,135,136]) : new Set();
  }
  function validate(state) {
    if (!state || typeof state !== 'object') throw new TypeError('Invalid state');
    const w = state.w, h = state.h;
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 4 || h < 4 || w > MAX_SIDE || h > MAX_SIDE) throw new TypeError('Invalid board size');
    if (!Array.isArray(state.robots) || state.robots.length !== ROBOT_COUNT) throw new TypeError('Invalid robots');
    if (!Array.isArray(state.targets) || state.targets.length !== ROBOT_COUNT) throw new TypeError('Invalid targets');
    for (const list of [state.robots, state.targets]) {
      const seen = new Set();
      for (const cell of list) {
        if (!Array.isArray(cell) || cell.length !== 2 || !Number.isInteger(cell[0]) || !Number.isInteger(cell[1])) throw new TypeError('Invalid cell');
        if (cell[0] < 0 || cell[0] >= w || cell[1] < 0 || cell[1] >= h) throw new TypeError('Cell outside board');
        const key = cell[1] * MAX_SIDE + cell[0];
        if (seen.has(key)) throw new TypeError('Overlapping cells');
        seen.add(key);
      }
    }
    if (!Array.isArray(state.walls)) throw new TypeError('Invalid walls');
    for (const code of state.walls) {
      if (!Number.isInteger(code) || code < 0 || code >= MAX_SIDE * MAX_SIDE * 2) throw new TypeError('Invalid wall code');
      const { x, y, axis } = decodeWall(code);
      if (axis === 0 ? (x > w - 2 || y > h - 1) : (x > w - 1 || y > h - 2)) throw new TypeError('Wall outside board');
    }
    const blocked=centralCells(state);
    for(const list of [state.robots,state.targets])for(const [x,y] of list)
      if(blocked.has(y*state.w+x))throw new TypeError('Cell is in the central obstacle');
    return true;
  }

  const clone = state => ({
    w: state.w,
    h: state.h,
    robots: state.robots.map(cell => cell.slice()),
    targets: state.targets.map(cell => cell.slice()),
    walls: state.walls.slice()
  });
  const sameState = (a, b) => a.w === b.w && a.h === b.h
    && a.robots.every((cell, i) => cell[0] === b.robots[i][0] && cell[1] === b.robots[i][1])
    && a.targets.every((cell, i) => cell[0] === b.targets[i][0] && cell[1] === b.targets[i][1])
    && a.walls.length === b.walls.length && a.walls.every((code, i) => code === b.walls[i]);

  const wallSet = state => new Set(state.walls);

  function robotAt(state, x, y) {
    for (let i = 0; i < ROBOT_COUNT; i++) {
      if (state.robots[i][0] === x && state.robots[i][1] === y) return i;
    }
    return -1;
  }

  function hasWall(state, set, x, y, dx, dy) {
    if (dx === 1) return x + 1 >= state.w || set.has(edgeCode(x, y, 0));
    if (dx === -1) return x - 1 < 0 || set.has(edgeCode(x - 1, y, 0));
    if (dy === 1) return y + 1 >= state.h || set.has(edgeCode(x, y, 1));
    if (dy === -1) return y - 1 < 0 || set.has(edgeCode(x, y - 1, 1));
    return true;
  }

  function openDirections(state, set, x, y) {
    let count = 0;
    for (const d of DIRS) if (!hasWall(state, set, x, y, d.dx, d.dy)) count++;
    return count;
  }

  // Core slide: keep stepping while the next cell exists, no wall covers the edge,
  // and no other robot stands there. Robots never enter an occupied cell, so no
  // robot can be pushed and none can stop on its own.
  function slideInternal(state, set, robotIndex, d) {
    const start = state.robots[robotIndex];
    let x = start[0], y = start[1], steps = 0, blockedBy = 'wall';
    for (;;) {
      if (hasWall(state, set, x, y, d.dx, d.dy)) { blockedBy = 'wall'; break; }
      const nx = x + d.dx, ny = y + d.dy;
      if (robotAt(state, nx, ny) >= 0) { blockedBy = 'robot'; break; }
      x = nx;
      y = ny;
      steps++;
    }
    if (steps === 0) return null;
    return { robot: robotIndex, dir: d.key, from: [start[0], start[1]], to: [x, y], steps, blockedBy };
  }

  function slide(state, robotIndex, dir) {
    validate(state);
    const d = resolveDir(dir);
    if (!d) throw new TypeError('Invalid direction');
    if (!Number.isInteger(robotIndex) || robotIndex < 0 || robotIndex >= ROBOT_COUNT) throw new TypeError('Invalid robot');
    return slideInternal(state, wallSet(state), robotIndex, d);
  }

  function legalMoves(state) {
    validate(state);
    const set = wallSet(state), out = [];
    for (let i = 0; i < ROBOT_COUNT; i++) {
      for (const d of DIRS) {
        const move = slideInternal(state, set, i, d);
        if (move) out.push(move);
      }
    }
    return out;
  }

  function movedState(state, move) {
    const next = {
      w: state.w,
      h: state.h,
      robots: state.robots.map(cell => cell.slice()),
      targets: state.targets.map(cell => cell.slice()),
      walls: state.walls.slice()
    };
    next.robots[move.robot] = [move.to[0], move.to[1]];
    return next;
  }

  // A blocked direction is not a move: ok === false, the state is untouched.
  function applyMove(state, move) {
    if (!move || typeof move !== 'object') return { ok: false, reason: 'action' };
    const d = resolveDir(move.dir);
    if (!d) return { ok: false, reason: 'direction' };
    if (!Number.isInteger(move.robot) || move.robot < 0 || move.robot >= ROBOT_COUNT) return { ok: false, reason: 'robot' };
    const found = slide(state, move.robot, d.key);
    if (!found) return { ok: false, reason: 'blocked' };
    return { ok: true, reason: null, state: movedState(state, found), move: found };
  }

  function isWon(state) {
    for (let i = 0; i < ROBOT_COUNT; i++) {
      if (state.robots[i][0] !== state.targets[i][0] || state.robots[i][1] !== state.targets[i][1]) return false;
    }
    return true;
  }

  function onTargetCount(state) {
    let count = 0;
    for (let i = 0; i < ROBOT_COUNT; i++) {
      if (state.robots[i][0] === state.targets[i][0] && state.robots[i][1] === state.targets[i][1]) count++;
    }
    return count;
  }

  const robotOnTarget = (state, index) => state.robots[index][0] === state.targets[index][0] && state.robots[index][1] === state.targets[index][1];

  // Relaxed model: the other robots are removed and the robot may stop on any cell
  // along its slide. Every real slide is legal here, so the relaxed slide count is a
  // lower bound on the slides that robot needs in the real game.
  function relaxedDistanceFrom(state, set, robotIndex) {
    const size = state.w * state.h;
    const dist = new Int16Array(size).fill(-1);
    const start = state.robots[robotIndex];
    const queue = [start[1] * state.w + start[0]];
    dist[queue[0]] = 0;
    for (let head = 0; head < queue.length; head++) {
      const cell = queue[head], x = cell % state.w, y = (cell - x) / state.w, base = dist[cell];
      for (const d of DIRS) {
        let cx = x, cy = y;
        for (;;) {
          if (hasWall(state, set, cx, cy, d.dx, d.dy)) break;
          cx += d.dx;
          cy += d.dy;
          const next = cy * state.w + cx;
          if (dist[next] === -1) { dist[next] = base + 1; queue.push(next); }
        }
      }
    }
    const target = state.targets[robotIndex];
    const value = dist[target[1] * state.w + target[0]];
    return value === -1 ? Infinity : value;
  }

  function relaxedDistance(state, robotIndex) {
    validate(state);
    if (!Number.isInteger(robotIndex) || robotIndex < 0 || robotIndex >= ROBOT_COUNT) throw new TypeError('Invalid robot');
    return relaxedDistanceFrom(state, wallSet(state), robotIndex);
  }

  function relaxedLowerBound(state) {
    validate(state);
    const set = wallSet(state), per = [];
    for (let i = 0; i < ROBOT_COUNT; i++) per.push(relaxedDistanceFrom(state, set, i));
    return { total: per.reduce((a, b) => a + b, 0), per, finite: per.every(Number.isFinite) };
  }

  function wallsOk(state) {
    validate(state);
    const set = wallSet(state), size = state.w * state.h, blocked=centralCells(state);
    let minOpen = 4;
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) if(!blocked.has(y*state.w+x)) minOpen = Math.min(minOpen, openDirections(state, set, x, y));
    }
    const seen = new Uint8Array(size);
    const queue = [0];
    seen[0] = 1;
    let reached = 1;
    for (let head = 0; head < queue.length; head++) {
      const cell = queue[head], x = cell % state.w, y = (cell - x) / state.w;
      for (const d of DIRS) {
        if (hasWall(state, set, x, y, d.dx, d.dy)) continue;
        const nx = x + d.dx, ny = y + d.dy, next = ny * state.w + nx;
        if (!seen[next]) { seen[next] = 1; reached++; queue.push(next); }
      }
    }
    return { valid: reached === size-blocked.size && minOpen >= 2, minOpen, reached, total: size-blocked.size };
  }

  // Replay a certificate: every step must be a legal slide, and the last state must
  // have all four robots on their own targets at the same time.
  function replay(state, solution) {
    validate(state);
    if (!Array.isArray(solution)) return { valid: false, reason: 'solution', states: [], moves: [] };
    let current = clone(state);
    const applied = [], states = [clone(current)];
    for (let i = 0; i < solution.length; i++) {
      const step = solution[i];
      if (!step || !Number.isInteger(step.robot) || step.robot < 0 || step.robot >= ROBOT_COUNT || !resolveDir(step.dir)) {
        return { valid: false, reason: 'step', index: i, states, moves: applied, final: current };
      }
      const result = applyMove(current, step);
      if (!result.ok) return { valid: false, reason: 'illegal', index: i, states, moves: applied, final: current };
      current = result.state;
      applied.push(result.move);
      states.push(clone(current));
    }
    const won = isWon(current);
    return { valid: won, reason: won ? null : 'not-solved', states, moves: applied, final: current };
  }

  function randomFor(seed) {
    let s = 2166136261;
    const text = String(seed);
    for (let i = 0; i < text.length; i++) { s ^= text.charCodeAt(i); s = Math.imul(s, 16777619); }
    return function () {
      s += 0x6d2b79f5;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const pick = (list, r) => list[Math.floor(r() * list.length)];
  function pickSome(count, upper, r) {
    const set = new Set();
    while (set.size < count && set.size < upper) set.add(Math.floor(r() * upper));
    return set;
  }

  const LAYOUT_LABELS = Object.freeze({
    scatter: '随机转角',
    open: '无内墙',
    bars: '零散短墙',
    cross: '十字长墙',
    rooms: '环墙房间',
    lattice: '分格墙',
    honey: '错列横墙'
  });

  // Deterministic wall layouts. Every layout is checked by wallsOk() before use, so
  // the finished board is connected and no cell is sealed off.
  function buildWallLayout(kind, r, options={}) {
    const set = new Set();
    if(kind==='scatter') {
      CENTER_FRAME.forEach(code=>set.add(code));
      const corners=[], counts=[0,0,0,0], target=options.corners||16;
      for(let attempt=0;attempt<600 && corners.length<target;attempt++) {
        const q=counts.indexOf(Math.min(...counts)),qx=q%2,qy=Math.floor(q/2);
        const x=(qx?9:1)+Math.floor(r()*6),y=(qy?9:1)+Math.floor(r()*6);
        if(corners.some(c=>Math.abs(c.x-x)+Math.abs(c.y-y)<3))continue;
        const orientation=Math.floor(r()*4);
        corners.push({x,y});counts[q]++;
        const sx=orientation===0||orientation===3?-1:1,sy=orientation<2?-1:1;
        set.add(edgeCode(sx<0?x-1:x,y,0));
        set.add(edgeCode(x,sy<0?y-1:y,1));
      }
      if(corners.length<target)return [];
      for(const half of [0,1]) {
        const a=1+half*8+Math.floor(r()*5),b=1+half*8+Math.floor(r()*5);
        set.add(edgeCode(a,0,0));set.add(edgeCode(b,15,0));
        const c=1+half*8+Math.floor(r()*5),d=1+half*8+Math.floor(r()*5);
        set.add(edgeCode(0,c,1));set.add(edgeCode(15,d,1));
      }
    } else if (kind === 'bars') {
      const count = 4 + Math.floor(r() * 3);
      for (let s = 0; s < count; s++) {
        const length = 3 + Math.floor(r() * 5);
        if (r() < 0.5) {
          const y = 1 + Math.floor(r() * (BOARD_H - 2));
          const x = 1 + Math.floor(r() * (BOARD_W - 2 - length));
          for (let k = 0; k < length; k++) set.add(edgeCode(x + k, y, 1));
        } else {
          const x = 1 + Math.floor(r() * (BOARD_W - 2));
          const y = 1 + Math.floor(r() * (BOARD_H - 2 - length));
          for (let k = 0; k < length; k++) set.add(edgeCode(x, y + k, 0));
        }
      }
    } else if (kind === 'cross') {
      const cx = 6 + Math.floor(r() * 4), cy = 6 + Math.floor(r() * 4);
      const skipV = pickSome(2, BOARD_H, r), skipH = pickSome(2, BOARD_W, r);
      for (let y = 1; y <= BOARD_H - 2; y++) if (!skipV.has(y)) set.add(edgeCode(cx, y, 0));
      for (let x = 1; x <= BOARD_W - 2; x++) if (!skipH.has(x)) set.add(edgeCode(x, cy, 1));
    } else if (kind === 'rooms') {
      const a = 3 + Math.floor(r() * 2), b = BOARD_W - 1 - a;
      const span = b - a + 1;
      const gaps = [pickSome(1 + Math.floor(r() * 2), span, r), pickSome(1 + Math.floor(r() * 2), span, r),
        pickSome(1 + Math.floor(r() * 2), span, r), pickSome(1 + Math.floor(r() * 2), span, r)];
      for (let y = a; y <= b; y++) {
        const offset = y - a;
        if (!gaps[0].has(offset)) set.add(edgeCode(a - 1, y, 0));
        if (!gaps[1].has(offset)) set.add(edgeCode(b, y, 0));
      }
      for (let x = a; x <= b; x++) {
        const offset = x - a;
        if (!gaps[2].has(offset)) set.add(edgeCode(x, a - 1, 1));
        if (!gaps[3].has(offset)) set.add(edgeCode(x, b, 1));
      }
    } else if (kind === 'lattice') {
      for (const x of [3, 7, 11]) {
        const skip = new Set([0,1,2,3].map(b => b*4 + Math.floor(r()*4)));
        for (let y = 0; y < BOARD_H; y++) if (!skip.has(y)) set.add(edgeCode(x, y, 0));
      }
      for (const y of [3, 7, 11]) {
        const skip = new Set([0,1,2,3].map(b => b*4 + Math.floor(r()*4)));
        for (let x = 0; x < BOARD_W; x++) if (!skip.has(x)) set.add(edgeCode(x, y, 1));
      }
    } else if (kind === 'honey') {
      const phase = Math.floor(r() * 5);
      for (const y of [3, 7, 11]) {
        for (let x = 0; x < BOARD_W; x++) {
          if ((x + phase + y) % 5 >= 2) set.add(edgeCode(x, y, 1));
        }
      }
      for (const x of [4, 9]) {
        const start = 1 + Math.floor(r() * 2);
        for (let y = start; y < start + 2; y++) set.add(edgeCode(x, y, 0));
      }
    }
    return [...set].sort((a, b) => a - b);
  }

  function layoutState(w, h, walls, robots) {
    const placed = (robots || [[0, 0], [1, 0], [2, 0], [3, 0]]).map(cell => [cell[0], cell[1]]);
    return { w, h, walls: walls.slice(), robots: placed, targets: placed.map(cell => cell.slice()) };
  }

  function placeRobots(state, r, spread) {
    const set = wallSet(state), candidates = [], blocked=centralCells(state);
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) if (!blocked.has(y*state.w+x) && openDirections(state, set, x, y) >= 2) candidates.push([x, y]);
    }
    if (candidates.length < ROBOT_COUNT) return null;
    let pool = candidates;
    if (spread === 'cluster') {
      const centers = candidates.filter(cell => cell[0] >= 4 && cell[0] <= state.w - 5 && cell[1] >= 4 && cell[1] <= state.h - 5);
      if (centers.length) {
        const center = pick(centers, r);
        const near = candidates.filter(cell => Math.abs(cell[0] - center[0]) <= 3 && Math.abs(cell[1] - center[1]) <= 3);
        if (near.length >= ROBOT_COUNT) pool = near;
      }
    }
    for (let attempt = 0; attempt < 40; attempt++) {
      const picked = [], used = new Set();
      let ok = true;
      for (let i = 0; i < ROBOT_COUNT; i++) {
        let chosen = null;
        for (let tries = 0; tries < 80; tries++) {
          const cell = pick(pool, r), key = cell[1] * MAX_SIDE + cell[0];
          if (used.has(key)) continue;
          if (picked.some(other => Math.abs(other[0] - cell[0]) + Math.abs(other[1] - cell[1]) < 2)) continue;
          chosen = cell;
          break;
        }
        if (!chosen) { ok = false; break; }
        used.add(chosen[1] * MAX_SIDE + chosen[0]);
        picked.push(chosen);
      }
      if (ok) return picked.map(cell => [cell[0], cell[1]]);
    }
    return null;
  }

  // Forward random walk. Every step is an engine-verified slide, so the recorded
  // route is legal by construction and its final positions form the four targets.
  function walkFrom(state, cfg, r) {
    const moves = [];
    let current = state;
    const limit = cfg.walk + 40;
    for (let step = 0; step < limit && moves.length < cfg.walk; step++) {
      const set = wallSet(current);
      const options = [];
      for (let i = 0; i < ROBOT_COUNT; i++) {
        for (const d of DIRS) {
          const move = slideInternal(current, set, i, d);
          if (move) options.push(move);
        }
      }
      if (!options.length) break;
      let pool = options;
      if (cfg.blockBias && r() < cfg.blockBias) {
        const blocked = options.filter(move => move.blockedBy === 'robot');
        if (blocked.length) pool = blocked;
      }
      if(cfg.layout==='scatter') {
        const inside=move=>move.to[0]>0&&move.to[0]<BOARD_W-1&&move.to[1]>0&&move.to[1]<BOARD_H-1;
        const returning=options.filter(move=>!inside({to:current.robots[move.robot]})&&inside(move));
        const interior=pool.filter(inside);
        if(returning.length)pool=returning;
        else if(interior.length&&r()<0.94)pool=interior;
      }
      if(cfg.layout==='scatter' && moves.length>cfg.walk-18) {
        const supportScore=move=>{
          const next=movedState(current,move);
          return next.robots.filter(([x,y])=>openDirections(next,set,x,y)===4 && x>0&&x<15&&y>0&&y<15).length;
        };
        const scores=pool.map(supportScore),best=Math.max(...scores);
        if(best>0 && r()<0.95)pool=pool.filter((move,i)=>scores[i]===best);
      }
      const move = pick(pool, r);
      current = movedState(current, move);
      moves.push({ robot: move.robot, dir: move.dir, blockedBy: move.blockedBy, steps: move.steps });
    }
    return { state: current, moves };
  }

  const LEVELS = Object.freeze([
    { name: '转角初阵', layout: 'scatter', corners: 16, minWalls: 48, walk: 40, blockBias: 0.65, minMoves: 10, minRelaxed: 10, minRobotStops: 4, minInterior: 4, minSupports: 1, spread: 'wide' },
    { name: '散布短墙', layout: 'scatter', corners: 16, minWalls: 48, walk: 44, blockBias: 0.65, minMoves: 10, minRelaxed: 10, minRobotStops: 4, minInterior: 4, minSupports: 1, spread: 'wide' },
    { name: '错位通道', layout: 'scatter', corners: 16, minWalls: 48, walk: 48, blockBias: 0.65, minMoves: 11, minRelaxed: 11, minRobotStops: 5, minInterior: 4, minSupports: 1, spread: 'wide' },
    { name: '交叉借位', layout: 'scatter', corners: 16, minWalls: 48, walk: 52, blockBias: 0.65, minMoves: 11, minRelaxed: 11, minRobotStops: 5, minInterior: 4, minSupports: 1, spread: 'wide' },
    { name: '内圈四站', layout: 'scatter', corners: 20, minWalls: 56, walk: 56, blockBias: 0.65, minMoves: 12, minRelaxed: 12, minRobotStops: 6, minInterior: 4, minSupports: 1, spread: 'wide' },
    { name: '隔墙协作', layout: 'scatter', corners: 20, minWalls: 56, walk: 60, blockBias: 0.65, minMoves: 12, minRelaxed: 12, minRobotStops: 6, minInterior: 4, minSupports: 1, spread: 'wide' },
    { name: '连环挡停', layout: 'scatter', corners: 20, minWalls: 56, walk: 66, blockBias: 0.65, minMoves: 12, minRelaxed: 12, minRobotStops: 7, minInterior: 4, minSupports: 2, spread: 'wide' },
    { name: '四区换位', layout: 'scatter', corners: 20, minWalls: 56, walk: 72, blockBias: 0.65, minMoves: 12, minRelaxed: 12, minRobotStops: 7, minInterior: 4, minSupports: 2, spread: 'wide' },
    { name: '折返迷阵', layout: 'scatter', corners: 24, minWalls: 64, walk: 78, blockBias: 0.65, minMoves: 13, minRelaxed: 13, minRobotStops: 8, minInterior: 4, minSupports: 2, spread: 'wide' },
    { name: '长程借道', layout: 'scatter', corners: 24, minWalls: 64, walk: 84, blockBias: 0.65, minMoves: 13, minRelaxed: 13, minRobotStops: 8, minInterior: 4, minSupports: 2, spread: 'wide' },
    { name: '深层合流', layout: 'scatter', corners: 24, minWalls: 64, walk: 92, blockBias: 0.65, minMoves: 14, minRelaxed: 14, minRobotStops: 9, minInterior: 4, minSupports: 2, spread: 'wide' },
    { name: '四机终局', layout: 'scatter', corners: 24, minWalls: 64, walk: 100, blockBias: 0.65, minMoves: 14, minRelaxed: 14, minRobotStops: 9, minInterior: 4, minSupports: 2, spread: 'wide' }
  ].map(Object.freeze));


  const LEVEL_EDITION = "scatter-v2";
  const CERTIFIED_LEVELS = Object.freeze([{"w":16,"h":16,"robots":[[15,4],[13,13],[8,10],[7,2]],"targets":[[2,3],[4,12],[5,12],[5,13]],"walls":[8,13,20,76,133,149,194,212,269,282,283,287,321,329,330,340,343,392,399,401,412,413,460,464,517,524,527,528,529,577,580,643,656,659,706,730,731,774,777,799,839,851,858,861,900,912,962,984],"layout":"scatter","name":"转角初阵","seed":"robots-hard-v2-0","solution":[{"robot":0,"dir":"left"},{"robot":1,"dir":"up"},{"robot":2,"dir":"up"},{"robot":3,"dir":"down"},{"robot":2,"dir":"left"},{"robot":0,"dir":"down"},{"robot":0,"dir":"left"},{"robot":3,"dir":"left"},{"robot":1,"dir":"left"},{"robot":0,"dir":"right"},{"robot":1,"dir":"up"},{"robot":0,"dir":"left"},{"robot":0,"dir":"up"},{"robot":0,"dir":"right"},{"robot":2,"dir":"down"},{"robot":3,"dir":"up"},{"robot":3,"dir":"down"},{"robot":0,"dir":"up"},{"robot":1,"dir":"down"},{"robot":2,"dir":"right"},{"robot":0,"dir":"left"},{"robot":2,"dir":"up"},{"robot":2,"dir":"left"},{"robot":3,"dir":"up"}],"meta":{"moves":24,"lower":10,"lowerPerRobot":[4,2,2,2],"robotStops":4,"interiorTargets":4,"supports":2,"wallCount":48,"attempts":18,"relax":0,"minMoves":10,"minRelaxed":10,"minRobotStops":4,"minInterior":4,"fallback":false}},{"w":16,"h":16,"robots":[[4,11],[13,15],[13,7],[0,3]],"targets":[[10,4],[9,10],[5,11],[3,10]],"walls":[4,18,87,93,135,150,154,159,198,204,205,276,277,321,325,326,329,388,399,401,404,407,460,464,524,527,528,529,584,585,602,603,656,659,708,709,714,715,797,833,837,854,855,858,863,900,962,982],"layout":"scatter","name":"散布短墙","seed":"robots-hard-v2-1","solution":[{"robot":3,"dir":"right"},{"robot":1,"dir":"up"},{"robot":0,"dir":"left"},{"robot":1,"dir":"left"},{"robot":0,"dir":"up"},{"robot":2,"dir":"left"},{"robot":2,"dir":"down"},{"robot":0,"dir":"right"},{"robot":2,"dir":"left"},{"robot":2,"dir":"down"},{"robot":2,"dir":"left"},{"robot":3,"dir":"down"},{"robot":2,"dir":"right"}],"meta":{"moves":13,"lower":10,"lowerPerRobot":[3,2,3,2],"robotStops":3,"interiorTargets":4,"supports":1,"wallCount":48,"attempts":10,"relax":0,"minMoves":10,"minRelaxed":10,"minRobotStops":3,"minInterior":4,"fallback":false}},{"w":16,"h":16,"robots":[[12,9],[4,8],[7,1],[11,8]],"targets":[[14,5],[12,11],[5,6],[6,6]],"walls":[10,20,129,138,141,199,214,215,223,262,274,275,348,349,386,387,392,395,399,401,404,407,460,464,521,524,527,528,529,577,584,597,660,665,706,709,713,723,726,735,776,786,845,856,859,908,966,986],"layout":"scatter","name":"错位通道","seed":"robots-hard-v2-2","solution":[{"robot":0,"dir":"down"},{"robot":0,"dir":"left"},{"robot":2,"dir":"down"},{"robot":3,"dir":"left"},{"robot":3,"dir":"up"},{"robot":0,"dir":"up"},{"robot":1,"dir":"right"},{"robot":3,"dir":"down"},{"robot":3,"dir":"right"},{"robot":0,"dir":"down"},{"robot":1,"dir":"up"},{"robot":1,"dir":"down"},{"robot":1,"dir":"right"},{"robot":0,"dir":"up"},{"robot":3,"dir":"up"},{"robot":2,"dir":"right"},{"robot":1,"dir":"up"},{"robot":2,"dir":"left"},{"robot":0,"dir":"left"},{"robot":0,"dir":"up"},{"robot":3,"dir":"left"},{"robot":3,"dir":"up"},{"robot":2,"dir":"right"},{"robot":0,"dir":"right"},{"robot":2,"dir":"left"},{"robot":3,"dir":"left"}],"meta":{"moves":26,"lower":11,"lowerPerRobot":[2,4,2,3],"robotStops":5,"interiorTargets":4,"supports":1,"wallCount":48,"attempts":50,"relax":0,"minMoves":11,"minRelaxed":11,"minRobotStops":5,"minInterior":4,"fallback":false}},{"w":16,"h":16,"robots":[[3,11],[9,4],[0,8],[15,10]],"targets":[[9,6],[1,10],[11,11],[9,5]],"walls":[2,26,70,73,131,144,147,192,199,257,262,281,328,331,342,349,351,399,401,402,403,410,460,464,524,527,528,529,537,600,607,642,643,648,649,663,714,717,726,769,789,794,797,834,837,852,970,980],"layout":"scatter","name":"交叉借位","seed":"robots-hard-v2-3","solution":[{"robot":3,"dir":"left"},{"robot":2,"dir":"right"},{"robot":2,"dir":"down"},{"robot":3,"dir":"up"},{"robot":2,"dir":"right"},{"robot":0,"dir":"right"},{"robot":3,"dir":"down"},{"robot":1,"dir":"down"},{"robot":3,"dir":"up"},{"robot":2,"dir":"left"},{"robot":3,"dir":"right"},{"robot":0,"dir":"up"},{"robot":0,"dir":"right"},{"robot":1,"dir":"up"},{"robot":2,"dir":"right"},{"robot":1,"dir":"left"},{"robot":2,"dir":"left"},{"robot":1,"dir":"down"},{"robot":3,"dir":"right"},{"robot":0,"dir":"right"},{"robot":2,"dir":"right"},{"robot":3,"dir":"up"},{"robot":0,"dir":"right"},{"robot":3,"dir":"down"}],"meta":{"moves":24,"lower":11,"lowerPerRobot":[2,3,3,3],"robotStops":5,"interiorTargets":4,"supports":1,"wallCount":48,"attempts":15,"relax":0,"minMoves":11,"minRelaxed":11,"minRobotStops":5,"minInterior":4,"fallback":false}},{"w":16,"h":16,"robots":[[9,1],[5,3],[7,13],[1,4]],"targets":[[7,6],[6,9],[8,5],[9,10]],"walls":[6,13,19,22,68,69,74,80,93,134,137,150,151,154,195,223,257,258,269,275,330,338,399,401,404,407,460,464,519,524,527,528,529,580,586,589,651,656,659,664,665,705,714,733,772,775,793,794,835,851,854,863,898,914,966,986],"layout":"scatter","name":"内圈四站","seed":"robots-hard-v2-4","solution":[{"robot":3,"dir":"down"},{"robot":2,"dir":"left"},{"robot":0,"dir":"down"},{"robot":0,"dir":"left"},{"robot":2,"dir":"up"},{"robot":1,"dir":"down"},{"robot":3,"dir":"right"},{"robot":0,"dir":"up"},{"robot":0,"dir":"right"},{"robot":3,"dir":"up"},{"robot":0,"dir":"down"},{"robot":1,"dir":"right"},{"robot":1,"dir":"up"},{"robot":2,"dir":"up"},{"robot":2,"dir":"right"},{"robot":2,"dir":"down"},{"robot":0,"dir":"right"},{"robot":0,"dir":"up"},{"robot":3,"dir":"left"},{"robot":2,"dir":"right"},{"robot":0,"dir":"down"},{"robot":0,"dir":"right"},{"robot":2,"dir":"up"},{"robot":3,"dir":"down"},{"robot":2,"dir":"down"},{"robot":1,"dir":"left"},{"robot":3,"dir":"up"},{"robot":2,"dir":"up"},{"robot":1,"dir":"left"},{"robot":1,"dir":"up"},{"robot":0,"dir":"left"},{"robot":2,"dir":"right"},{"robot":3,"dir":"down"},{"robot":1,"dir":"down"}],"meta":{"moves":34,"lower":13,"lowerPerRobot":[3,3,4,3],"robotStops":8,"interiorTargets":4,"supports":1,"wallCount":56,"attempts":113,"relax":0,"minMoves":12,"minRelaxed":12,"minRobotStops":6,"minInterior":4,"fallback":false}},{"w":16,"h":16,"robots":[[7,12],[9,3],[10,14],[4,9]],"targets":[[12,7],[9,12],[2,8],[12,6]],"walls":[8,22,70,71,75,80,83,95,131,136,148,151,194,211,262,265,269,272,321,330,341,347,399,401,402,408,460,464,517,524,527,528,529,578,596,599,650,651,723,728,729,769,770,773,778,781,786,795,799,840,841,855,856,916,968,978],"layout":"scatter","name":"隔墙协作","seed":"robots-hard-v2-5","solution":[{"robot":0,"dir":"up"},{"robot":0,"dir":"left"},{"robot":0,"dir":"down"},{"robot":1,"dir":"up"},{"robot":3,"dir":"left"},{"robot":1,"dir":"right"},{"robot":3,"dir":"down"},{"robot":1,"dir":"down"},{"robot":1,"dir":"left"},{"robot":1,"dir":"down"},{"robot":3,"dir":"up"},{"robot":1,"dir":"right"},{"robot":0,"dir":"up"},{"robot":3,"dir":"right"},{"robot":0,"dir":"down"},{"robot":2,"dir":"up"},{"robot":0,"dir":"up"},{"robot":0,"dir":"right"},{"robot":3,"dir":"up"},{"robot":2,"dir":"up"},{"robot":1,"dir":"left"},{"robot":0,"dir":"left"},{"robot":1,"dir":"up"},{"robot":0,"dir":"right"},{"robot":0,"dir":"down"},{"robot":0,"dir":"left"},{"robot":0,"dir":"down"},{"robot":1,"dir":"down"},{"robot":3,"dir":"right"},{"robot":2,"dir":"up"},{"robot":2,"dir":"right"},{"robot":1,"dir":"right"},{"robot":0,"dir":"right"},{"robot":0,"dir":"down"},{"robot":2,"dir":"down"},{"robot":0,"dir":"right"},{"robot":0,"dir":"up"},{"robot":2,"dir":"up"},{"robot":2,"dir":"left"},{"robot":2,"dir":"down"}],"meta":{"moves":40,"lower":13,"lowerPerRobot":[3,4,3,3],"robotStops":6,"interiorTargets":4,"supports":1,"wallCount":56,"attempts":377,"relax":0,"minMoves":12,"minRelaxed":12,"minRobotStops":6,"minInterior":4,"fallback":false}},{"w":16,"h":16,"robots":[[3,4],[10,12],[6,12],[8,10]],"targets":[[6,12],[9,4],[7,4],[8,4]],"walls":[3,4,18,64,93,129,146,149,156,200,201,258,259,263,274,275,287,324,331,341,392,399,401,404,410,413,460,464,515,524,527,528,529,578,597,645,648,651,658,664,667,671,708,717,733,775,780,796,833,838,850,853,920,921,966,978],"layout":"scatter","name":"连环挡停","seed":"robots-hard-v2-6","solution":[{"robot":1,"dir":"left"},{"robot":0,"dir":"right"},{"robot":3,"dir":"left"},{"robot":3,"dir":"right"},{"robot":3,"dir":"up"},{"robot":0,"dir":"left"},{"robot":0,"dir":"down"},{"robot":1,"dir":"up"},{"robot":3,"dir":"left"},{"robot":0,"dir":"right"},{"robot":3,"dir":"down"},{"robot":3,"dir":"right"},{"robot":1,"dir":"left"},{"robot":3,"dir":"up"},{"robot":1,"dir":"down"},{"robot":1,"dir":"right"},{"robot":3,"dir":"left"},{"robot":3,"dir":"down"},{"robot":1,"dir":"up"},{"robot":2,"dir":"left"},{"robot":2,"dir":"up"},{"robot":3,"dir":"up"},{"robot":0,"dir":"up"},{"robot":2,"dir":"left"},{"robot":2,"dir":"up"},{"robot":3,"dir":"right"},{"robot":0,"dir":"down"},{"robot":1,"dir":"down"},{"robot":2,"dir":"down"},{"robot":0,"dir":"right"},{"robot":0,"dir":"left"},{"robot":2,"dir":"up"},{"robot":2,"dir":"right"},{"robot":1,"dir":"down"},{"robot":2,"dir":"down"},{"robot":1,"dir":"up"},{"robot":3,"dir":"up"},{"robot":1,"dir":"right"},{"robot":1,"dir":"up"},{"robot":3,"dir":"right"},{"robot":2,"dir":"left"},{"robot":2,"dir":"down"},{"robot":0,"dir":"down"},{"robot":3,"dir":"left"},{"robot":0,"dir":"up"},{"robot":1,"dir":"up"},{"robot":3,"dir":"right"},{"robot":2,"dir":"up"},{"robot":3,"dir":"left"},{"robot":1,"dir":"right"},{"robot":2,"dir":"down"},{"robot":3,"dir":"right"},{"robot":2,"dir":"up"},{"robot":2,"dir":"right"},{"robot":0,"dir":"down"},{"robot":0,"dir":"right"},{"robot":2,"dir":"up"},{"robot":2,"dir":"right"}],"meta":{"moves":58,"lower":13,"lowerPerRobot":[3,4,3,3],"robotStops":17,"interiorTargets":4,"supports":2,"wallCount":56,"attempts":154,"relax":0,"minMoves":12,"minRelaxed":12,"minRobotStops":7,"minInterior":4,"fallback":false}},{"w":16,"h":16,"robots":[[13,7],[9,0],[3,6],[0,6]],"targets":[[12,12],[12,11],[11,11],[11,12]],"walls":[10,20,25,66,67,70,73,77,86,140,146,147,193,213,223,266,267,276,333,339,346,349,394,399,400,401,460,464,517,523,524,527,528,529,578,586,601,661,664,712,713,722,731,778,781,792,799,833,843,851,852,855,904,912,968,982],"layout":"scatter","name":"四区换位","seed":"robots-hard-v2-7","solution":[{"robot":1,"dir":"down"},{"robot":3,"dir":"right"},{"robot":1,"dir":"left"},{"robot":1,"dir":"down"},{"robot":0,"dir":"down"},{"robot":2,"dir":"right"},{"robot":3,"dir":"right"},{"robot":0,"dir":"left"},{"robot":1,"dir":"left"},{"robot":1,"dir":"down"},{"robot":2,"dir":"down"},{"robot":2,"dir":"left"},{"robot":2,"dir":"right"},{"robot":2,"dir":"down"},{"robot":3,"dir":"down"},{"robot":1,"dir":"right"},{"robot":2,"dir":"up"},{"robot":3,"dir":"up"},{"robot":1,"dir":"up"},{"robot":3,"dir":"right"},{"robot":3,"dir":"down"},{"robot":2,"dir":"down"},{"robot":3,"dir":"left"},{"robot":3,"dir":"right"},{"robot":2,"dir":"right"},{"robot":2,"dir":"up"},{"robot":0,"dir":"right"},{"robot":0,"dir":"down"},{"robot":2,"dir":"left"},{"robot":3,"dir":"down"},{"robot":3,"dir":"left"},{"robot":0,"dir":"up"},{"robot":0,"dir":"left"},{"robot":0,"dir":"up"},{"robot":3,"dir":"down"},{"robot":0,"dir":"down"},{"robot":0,"dir":"right"},{"robot":1,"dir":"down"},{"robot":2,"dir":"right"},{"robot":3,"dir":"up"}],"meta":{"moves":40,"lower":13,"lowerPerRobot":[3,4,3,3],"robotStops":10,"interiorTargets":4,"supports":3,"wallCount":56,"attempts":261,"relax":0,"minMoves":12,"minRelaxed":12,"minRobotStops":7,"minInterior":4,"fallback":false}},{"w":16,"h":16,"robots":[[6,14],[10,3],[1,13],[1,15]],"targets":[[4,6],[2,9],[3,5],[4,5]],"walls":[10,20,69,74,75,84,85,89,130,152,193,204,205,213,221,223,262,263,276,282,345,386,387,394,395,399,401,402,403,408,460,464,517,524,527,528,529,578,594,595,602,603,641,652,653,671,706,707,710,713,724,725,733,773,794,836,853,859,904,907,914,920,962,984],"layout":"scatter","name":"折返迷阵","seed":"robots-hard-v2-8","solution":[{"robot":3,"dir":"up"},{"robot":3,"dir":"right"},{"robot":2,"dir":"up"},{"robot":3,"dir":"up"},{"robot":2,"dir":"right"},{"robot":3,"dir":"right"},{"robot":3,"dir":"up"},{"robot":1,"dir":"right"},{"robot":1,"dir":"left"},{"robot":0,"dir":"up"},{"robot":0,"dir":"right"},{"robot":3,"dir":"left"},{"robot":2,"dir":"right"},{"robot":2,"dir":"up"},{"robot":2,"dir":"left"},{"robot":3,"dir":"up"},{"robot":3,"dir":"left"},{"robot":1,"dir":"down"},{"robot":1,"dir":"right"},{"robot":3,"dir":"right"},{"robot":0,"dir":"left"},{"robot":3,"dir":"left"},{"robot":1,"dir":"left"},{"robot":0,"dir":"right"},{"robot":1,"dir":"up"},{"robot":1,"dir":"right"},{"robot":2,"dir":"up"},{"robot":1,"dir":"down"},{"robot":2,"dir":"left"},{"robot":2,"dir":"up"},{"robot":3,"dir":"right"},{"robot":3,"dir":"up"},{"robot":1,"dir":"left"},{"robot":0,"dir":"up"},{"robot":1,"dir":"up"},{"robot":1,"dir":"left"},{"robot":0,"dir":"left"},{"robot":0,"dir":"down"},{"robot":3,"dir":"down"},{"robot":0,"dir":"right"},{"robot":3,"dir":"left"},{"robot":1,"dir":"down"},{"robot":3,"dir":"up"},{"robot":1,"dir":"up"},{"robot":0,"dir":"up"},{"robot":3,"dir":"left"},{"robot":3,"dir":"up"},{"robot":3,"dir":"right"},{"robot":0,"dir":"down"},{"robot":0,"dir":"left"},{"robot":3,"dir":"down"},{"robot":3,"dir":"left"},{"robot":0,"dir":"up"}],"meta":{"moves":53,"lower":14,"lowerPerRobot":[3,4,3,4],"robotStops":9,"interiorTargets":4,"supports":2,"wallCount":64,"attempts":122,"relax":0,"minMoves":13,"minRelaxed":13,"minRobotStops":8,"minInterior":4,"fallback":false}},{"w":16,"h":16,"robots":[[15,4],[2,2],[8,10],[5,0]],"targets":[[6,12],[6,11],[4,3],[6,13]],"walls":[6,11,26,65,66,67,72,82,83,91,95,151,152,198,201,214,269,275,285,322,323,330,336,345,348,392,393,399,401,408,460,464,519,524,527,528,529,577,582,596,599,650,651,665,666,669,706,709,723,726,776,777,784,839,844,845,853,859,863,900,916,922,968,986],"layout":"scatter","name":"长程借道","seed":"robots-hard-v2-9","solution":[{"robot":1,"dir":"right"},{"robot":1,"dir":"down"},{"robot":2,"dir":"right"},{"robot":2,"dir":"left"},{"robot":1,"dir":"left"},{"robot":2,"dir":"down"},{"robot":2,"dir":"up"},{"robot":1,"dir":"down"},{"robot":2,"dir":"down"},{"robot":1,"dir":"left"},{"robot":1,"dir":"right"},{"robot":1,"dir":"up"},{"robot":2,"dir":"up"},{"robot":1,"dir":"left"},{"robot":1,"dir":"up"},{"robot":1,"dir":"right"},{"robot":1,"dir":"down"},{"robot":2,"dir":"down"},{"robot":3,"dir":"left"},{"robot":3,"dir":"down"},{"robot":2,"dir":"up"},{"robot":1,"dir":"up"},{"robot":2,"dir":"right"},{"robot":2,"dir":"up"},{"robot":2,"dir":"down"},{"robot":2,"dir":"right"},{"robot":1,"dir":"down"},{"robot":2,"dir":"up"},{"robot":3,"dir":"right"},{"robot":1,"dir":"right"},{"robot":0,"dir":"down"},{"robot":0,"dir":"left"},{"robot":0,"dir":"up"},{"robot":1,"dir":"down"},{"robot":1,"dir":"up"},{"robot":3,"dir":"up"},{"robot":3,"dir":"down"},{"robot":1,"dir":"down"},{"robot":1,"dir":"left"},{"robot":3,"dir":"left"},{"robot":0,"dir":"down"},{"robot":1,"dir":"left"},{"robot":2,"dir":"down"},{"robot":0,"dir":"up"},{"robot":3,"dir":"up"},{"robot":3,"dir":"right"},{"robot":1,"dir":"up"},{"robot":3,"dir":"left"},{"robot":3,"dir":"down"},{"robot":0,"dir":"left"},{"robot":0,"dir":"up"},{"robot":1,"dir":"right"},{"robot":0,"dir":"right"},{"robot":0,"dir":"down"},{"robot":1,"dir":"left"},{"robot":1,"dir":"up"},{"robot":1,"dir":"right"},{"robot":1,"dir":"down"},{"robot":2,"dir":"up"},{"robot":2,"dir":"left"}],"meta":{"moves":60,"lower":13,"lowerPerRobot":[4,2,3,4],"robotStops":9,"interiorTargets":4,"supports":2,"wallCount":64,"attempts":362,"relax":0,"minMoves":13,"minRelaxed":13,"minRobotStops":8,"minInterior":4,"fallback":false}},{"w":16,"h":16,"robots":[[6,14],[14,2],[10,14],[9,0]],"targets":[[10,12],[11,10],[12,10],[12,9]],"walls":[2,18,25,70,71,88,140,141,147,157,193,208,217,218,258,261,266,267,278,323,339,347,351,384,394,397,399,401,402,408,460,464,519,524,525,527,528,529,537,577,580,588,595,598,643,649,656,704,710,728,731,786,789,837,845,855,858,861,863,900,908,918,970,980],"layout":"scatter","name":"深层合流","seed":"robots-hard-v2-10-candidate-1","solution":[{"robot":3,"dir":"down"},{"robot":1,"dir":"left"},{"robot":2,"dir":"right"},{"robot":2,"dir":"left"},{"robot":1,"dir":"down"},{"robot":0,"dir":"left"},{"robot":2,"dir":"right"},{"robot":0,"dir":"up"},{"robot":2,"dir":"left"},{"robot":2,"dir":"up"},{"robot":2,"dir":"right"},{"robot":2,"dir":"down"},{"robot":3,"dir":"left"},{"robot":3,"dir":"down"},{"robot":3,"dir":"right"},{"robot":3,"dir":"down"},{"robot":2,"dir":"right"},{"robot":2,"dir":"up"},{"robot":2,"dir":"left"},{"robot":0,"dir":"right"},{"robot":3,"dir":"left"},{"robot":3,"dir":"right"},{"robot":3,"dir":"down"},{"robot":3,"dir":"left"},{"robot":2,"dir":"down"},{"robot":3,"dir":"right"},{"robot":0,"dir":"down"},{"robot":2,"dir":"left"},{"robot":3,"dir":"up"},{"robot":0,"dir":"up"},{"robot":2,"dir":"up"},{"robot":2,"dir":"right"},{"robot":2,"dir":"down"},{"robot":2,"dir":"right"},{"robot":0,"dir":"left"},{"robot":2,"dir":"up"},{"robot":1,"dir":"right"},{"robot":1,"dir":"up"},{"robot":1,"dir":"left"},{"robot":2,"dir":"left"},{"robot":0,"dir":"right"},{"robot":0,"dir":"down"},{"robot":0,"dir":"right"},{"robot":0,"dir":"up"},{"robot":2,"dir":"right"},{"robot":2,"dir":"up"},{"robot":1,"dir":"right"},{"robot":0,"dir":"left"}],"meta":{"moves":48,"lower":14,"lowerPerRobot":[4,2,3,5],"robotStops":9,"interiorTargets":4,"supports":2,"wallCount":64,"attempts":233,"relax":0,"minMoves":14,"minRelaxed":14,"minRobotStops":9,"minInterior":4,"fallback":false}},{"w":16,"h":16,"robots":[[15,4],[9,14],[14,1],[4,4]],"targets":[[5,7],[9,9],[5,4],[9,10]],"walls":[4,19,22,77,80,95,134,135,140,194,195,203,220,221,257,266,276,277,342,345,384,387,392,393,399,401,402,403,412,413,460,464,524,527,528,529,577,579,584,587,600,603,642,647,656,659,663,710,715,726,778,799,834,835,841,850,851,854,857,902,922,925,966,982],"layout":"scatter","name":"四机终局","seed":"robots-hard-v2-11-candidate-1","solution":[{"robot":0,"dir":"left"},{"robot":1,"dir":"left"},{"robot":3,"dir":"down"},{"robot":2,"dir":"left"},{"robot":1,"dir":"right"},{"robot":0,"dir":"down"},{"robot":1,"dir":"up"},{"robot":0,"dir":"left"},{"robot":1,"dir":"left"},{"robot":0,"dir":"up"},{"robot":1,"dir":"left"},{"robot":3,"dir":"left"},{"robot":1,"dir":"up"},{"robot":3,"dir":"up"},{"robot":1,"dir":"down"},{"robot":3,"dir":"right"},{"robot":1,"dir":"up"},{"robot":2,"dir":"down"},{"robot":3,"dir":"down"},{"robot":3,"dir":"right"},{"robot":2,"dir":"up"},{"robot":3,"dir":"up"},{"robot":3,"dir":"down"},{"robot":2,"dir":"down"},{"robot":3,"dir":"up"},{"robot":3,"dir":"left"},{"robot":2,"dir":"left"},{"robot":3,"dir":"up"},{"robot":2,"dir":"right"},{"robot":2,"dir":"up"},{"robot":3,"dir":"right"},{"robot":2,"dir":"down"},{"robot":2,"dir":"left"},{"robot":3,"dir":"down"},{"robot":2,"dir":"right"},{"robot":2,"dir":"up"},{"robot":1,"dir":"down"},{"robot":0,"dir":"down"},{"robot":0,"dir":"right"},{"robot":3,"dir":"left"},{"robot":0,"dir":"left"},{"robot":0,"dir":"up"},{"robot":1,"dir":"up"},{"robot":3,"dir":"left"},{"robot":3,"dir":"up"},{"robot":0,"dir":"down"},{"robot":2,"dir":"down"},{"robot":2,"dir":"left"},{"robot":0,"dir":"up"},{"robot":2,"dir":"right"},{"robot":3,"dir":"down"},{"robot":1,"dir":"down"},{"robot":2,"dir":"left"},{"robot":2,"dir":"up"}],"meta":{"moves":54,"lower":15,"lowerPerRobot":[4,3,4,4],"robotStops":8,"interiorTargets":4,"supports":2,"wallCount":64,"attempts":91,"relax":0,"minMoves":14,"minRelaxed":14,"minRobotStops":8,"minInterior":4,"fallback":false}}].map(p=>Object.freeze(p)));

  const DEFAULTS = Object.freeze({
    ...LEVELS[0], name: '随机转角'
  });

  const MAX_ATTEMPTS = 600;
  const relaxLevel = attempt => (attempt < 60 ? 0 : attempt < 120 ? 1 : attempt < 180 ? 2 : 3);
  function relaxedConfig(base, level) {
    if (level === 0) return { ...base };
    const cfg = { ...base };
    if (level === 1) { cfg.minMoves -= 1; cfg.minRelaxed -= 2; cfg.minRobotStops -= 1; cfg.minInterior -= 1; }
    else if (level === 2) { cfg.minMoves -= 2; cfg.minRelaxed -= 4; cfg.minRobotStops = 0; cfg.minInterior = 0; }
    else { cfg.minMoves = 3; cfg.minRelaxed = 4; cfg.minRobotStops = 0; cfg.minInterior = 0; cfg.walk = Math.max(cfg.walk, 10); }
    cfg.minMoves = Math.max(3, cfg.minMoves);
    cfg.minRelaxed = Math.max(4, cfg.minRelaxed);
    cfg.minRobotStops = Math.max(0, cfg.minRobotStops);
    cfg.minInterior = Math.max(0, cfg.minInterior);
    return cfg;
  }

  function normalizeOptions(options) {
    const cfg = { ...DEFAULTS, ...(options || {}) };
    if (!LAYOUT_LABELS[cfg.layout]) cfg.layout = DEFAULTS.layout;
    if (!Number.isInteger(cfg.walk) || cfg.walk < 3) cfg.walk = DEFAULTS.walk;
    return cfg;
  }

  // A hand-checked puzzle used only if every generated attempt is filtered out.
  // Robots sit in row 0 of an empty board: 0→right stops against robot 1, 2→right
  // stops against robot 3, 1→right stops against robot 2, 3→right reaches the wall.
  const FALLBACK_PUZZLE = Object.freeze({
    w: BOARD_W, h: BOARD_H,
    robots: [[0, 0], [3, 0], [6, 0], [9, 0]],
    targets: [[2, 0], [7, 0], [8, 0], [15, 0]],
    walls: [],
    layout: 'open',
    solution: Object.freeze([
      Object.freeze({ robot: 0, dir: 'right' }),
      Object.freeze({ robot: 2, dir: 'right' }),
      Object.freeze({ robot: 1, dir: 'right' }),
      Object.freeze({ robot: 3, dir: 'right' })
    ])
  });

  function transformedPuzzle(puzzle, rotation, reflect) {
    const p=JSON.parse(JSON.stringify(puzzle));
    const cell=([x,y])=>{if(reflect)x=15-x;for(let i=0;i<rotation;i++)[x,y]=[15-y,x];return [x,y];};
    p.robots=p.robots.map(cell);p.targets=p.targets.map(cell);
    p.walls=p.walls.map(code=>{const {x,y,axis}=decodeWall(code);const a=cell([x,y]),b=cell([x+(axis===0?1:0),y+(axis===1?1:0)]);return a[0]===b[0]?edgeCode(a[0],Math.min(a[1],b[1]),1):edgeCode(Math.min(a[0],b[0]),a[1],0);}).sort((a,b)=>a-b);
    p.solution=p.solution.map(move=>{let {dx,dy}=resolveDir(move.dir);if(reflect)dx=-dx;for(let i=0;i<rotation;i++)[dx,dy]=[-dy,dx];return {robot:move.robot,dir:DIRS.find(d=>d.dx===dx&&d.dy===dy).key};});
    return p;
  }
  function fallbackPuzzle(options, seed) {
    const cfg = normalizeOptions(options);
    if(cfg.layout==='scatter') {
      const r=randomFor('reserve:'+seed);
      const pool=CERTIFIED_LEVELS.filter(p=>p.meta.lower>=cfg.minRelaxed&&p.walls.length>=cfg.minWalls&&p.meta.supports>=cfg.minSupports);
      const base=pool.length?pick(pool,r):CERTIFIED_LEVELS[CERTIFIED_LEVELS.length-1];
      const p=transformedPuzzle(base,Math.floor(r()*4),r()<0.5);
      // Relabel robot/target pairs together to vary reserve puzzles without changing their proof.
      const order=[0,1,2,3];
      for(let i=3;i>0;i--){const j=Math.floor(r()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
      const label=order.map((_,old)=>order.indexOf(old));
      p.robots=order.map(old=>p.robots[old]);p.targets=order.map(old=>p.targets[old]);
      p.solution=p.solution.map(move=>({...move,robot:label[move.robot]}));
      if(p.meta.lowerPerRobot)p.meta.lowerPerRobot=order.map(old=>p.meta.lowerPerRobot[old]);
      p.seed=String(seed);p.name=cfg.name;p.meta={...p.meta,fallback:true,source:'certified-reserve'};
      return p;
    }
    return {
      w: FALLBACK_PUZZLE.w,
      h: FALLBACK_PUZZLE.h,
      robots: FALLBACK_PUZZLE.robots.map(cell => cell.slice()),
      targets: FALLBACK_PUZZLE.targets.map(cell => cell.slice()),
      walls: FALLBACK_PUZZLE.walls.slice(),
      layout: FALLBACK_PUZZLE.layout,
      name: cfg.name,
      seed: String(seed ?? ''),
      solution: FALLBACK_PUZZLE.solution.map(step => ({ robot: step.robot, dir: step.dir })),
      meta: {
        moves: FALLBACK_PUZZLE.solution.length,
        lower: 4,
        lowerPerRobot: [1, 1, 1, 1],
        robotStops: 2,
        interiorTargets: 0,
        wallCount: 0,
        attempts: 0,
        relax: 0,
        minMoves: cfg.minMoves,
        minRelaxed: cfg.minRelaxed,
        minRobotStops: cfg.minRobotStops,
        minInterior: cfg.minInterior,
        fallback: true
      }
    };
  }

  // Deterministic construction. Yields after each attempt so a caller can slice the
  // work, cancel, or drop stale results.
  function* generateSteps(seed, options) {
    const base = normalizeOptions(options);
    const key = String(seed);
    const known=CERTIFIED_LEVELS.find(p=>p.seed===key);
    if(known){yield {attempt:0,phase:'certificate',done:false};return JSON.parse(JSON.stringify(known));}
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const cfg = base.layout==='scatter'?{...base}:relaxedConfig(base, relaxLevel(attempt));
      const r = randomFor(key + '#' + attempt);
      let puzzle = null;
      for (let layoutTry = 0; layoutTry < 6 && !puzzle; layoutTry++) {
        const walls = buildWallLayout(cfg.layout, r, cfg);
        const shaped = layoutState(BOARD_W, BOARD_H, walls);
        if (walls.length<(cfg.minWalls||0) || !wallsOk(shaped).valid) continue;
        const robots = placeRobots(shaped, r, cfg.spread);
        if (!robots) continue;
        const start = layoutState(BOARD_W, BOARD_H, walls, robots);
        const walked = walkFrom(start, cfg, r);
        if (walked.moves.length < 3) continue;
        const puzzleCandidate = {
          w: BOARD_W,
          h: BOARD_H,
          robots: start.robots.map(cell => cell.slice()),
          targets: walked.state.robots.map(cell => cell.slice()),
          walls: walls.slice(),
          layout: cfg.layout,
          name: cfg.name,
          seed: key,
          solution: walked.moves.map(move => ({ robot: move.robot, dir: move.dir }))
        };
        const lower = relaxedLowerBound(puzzleCandidate);
        const robotStops = walked.moves.filter(move => move.blockedBy === 'robot').length;
        const interiorTargets = puzzleCandidate.targets.filter(cell => cell[0] > 0 && cell[0] < BOARD_W - 1 && cell[1] > 0 && cell[1] < BOARD_H - 1).length;
        const wallLookup=wallSet(puzzleCandidate);
        const supports=puzzleCandidate.targets.filter(([x,y])=>openDirections(puzzleCandidate,wallLookup,x,y)===4).length;
        const separated = puzzleCandidate.robots.every((cell, i) => cell[0] !== puzzleCandidate.targets[i][0] || cell[1] !== puzzleCandidate.targets[i][1]);
        const pass = separated
          && puzzleCandidate.solution.length >= cfg.minMoves
          && lower.finite && lower.total >= cfg.minRelaxed
          && robotStops >= cfg.minRobotStops
          && interiorTargets >= cfg.minInterior
          && supports >= (cfg.minSupports||0)
          && replay(puzzleCandidate, puzzleCandidate.solution).valid;
        if (pass) {
          puzzleCandidate.meta = {
            moves: puzzleCandidate.solution.length,
            lower: lower.total,
            lowerPerRobot: lower.per,
            robotStops,
            interiorTargets,
            supports,
            wallCount: walls.length,
            attempts: attempt + 1,
            relax: cfg.layout==='scatter'?0:relaxLevel(attempt),
            minMoves: cfg.minMoves,
            minRelaxed: cfg.minRelaxed,
            minRobotStops: cfg.minRobotStops,
            minInterior: cfg.minInterior,
            fallback: false
          };
          puzzle = puzzleCandidate;
        }
      }
      yield { attempt, phase: 'construct', done: false };
      if (puzzle) return puzzle;
    }
    return fallbackPuzzle(base, key);
  }

  function generate(seed, options) {
    const iterator = generateSteps(seed, options);
    let step = iterator.next();
    while (!step.done) step = iterator.next();
    return step.value;
  }

  const levelOptions = index => ({ ...LEVELS[index] });
  const generateLevel = index => {
    if (!Number.isInteger(index) || !LEVELS[index]) throw new RangeError('Unknown level');
    return JSON.parse(JSON.stringify(CERTIFIED_LEVELS[index]));
  };

  function shanghaiDateString(date) {
    const value = date === undefined ? new Date() : new Date(date);
    if (!Number.isFinite(value.getTime())) throw new TypeError('Invalid date');
    return new Date(value.getTime() + 8 * 3600000).toISOString().slice(0, 10);
  }

  // The daily tier follows from the date alone, so every player gets the same puzzle.
  function dailyTier(date) {
    const digits = String(date).replace(/[^0-9]/g, '');
    if (!digits) throw new TypeError('Invalid date string');
    return Number(digits) % LEVELS.length;
  }

  return Object.freeze({
    centralCells, CENTER_FRAME, LEVEL_EDITION, CERTIFIED_LEVELS, transformedPuzzle,
    BOARD_W,
    BOARD_H,
    ROBOT_COUNT,
    DIRS,
    DIR_KEYS,
    LEVELS,
    DEFAULTS,
    LAYOUT_LABELS,
    MAX_ATTEMPTS,
    FALLBACK_PUZZLE,
    edgeCode,
    decodeWall,
    validate,
    clone,
    sameState,
    slide,
    legalMoves,
    applyMove,
    isWon,
    onTargetCount,
    robotOnTarget,
    robotAt,
    openDirections,
    relaxedDistance,
    relaxedLowerBound,
    wallsOk,
    replay,
    randomFor,
    buildWallLayout,
    placeRobots,
    generateSteps,
    generate,
    generateLevel,
    levelOptions,
    shanghaiDateString,
    dailyTier
  });
});
