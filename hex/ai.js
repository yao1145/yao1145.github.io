(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.HexAI = factory(root.HexEngine);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (E) {
  'use strict';
  const clock = () => typeof performance !== 'undefined' ? performance.now() : Date.now();
  const pause = () => new Promise(resolve => setTimeout(resolve, 0));
  const cache = new Map();
  const topology = new Map();
  function neighbors(n) {
    if (!topology.has(n)) topology.set(n, Array.from({ length: n * n }, (_, i) => E.neighbors(n, i)));
    return topology.get(n);
  }
  function randomSource(seed) {
    let x = (seed === undefined ? Math.random() * 0xffffffff : seed) >>> 0 || 1;
    return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
  }
  // One reusable board and two disjoint-set forests per search, including rollouts.
  class Position {
    constructor(n, board) {
      this.n = n; this.count = n * n; this.adj = neighbors(n);
      this.board = new Uint8Array(this.count); this.initial = Uint8Array.from(board);
      this.parents = [null, new Int16Array(this.count + 2), new Int16Array(this.count + 2)];
      this.reset();
    }
    find(p, a) { while (p[a] !== a) { p[a] = p[p[a]]; a = p[a]; } return a; }
    union(p, a, b) { a = this.find(p, a); b = this.find(p, b); if (a !== b) p[a] = b; }
    reset() {
      this.board.set(this.initial);
      for (let color = 1; color <= 2; color++) for (let i = 0; i < this.count + 2; i++) this.parents[color][i] = i;
      for (let i = 0; i < this.count; i++) if (this.board[i]) this.connect(i, this.board[i]);
    }
    connect(i, color) {
      const p = this.parents[color], r = Math.floor(i / this.n), c = i % this.n;
      if ((color === 1 ? r : c) === 0) this.union(p, i, this.count);
      if ((color === 1 ? r : c) === this.n - 1) this.union(p, i, this.count + 1);
      for (const j of this.adj[i]) if (this.board[j] === color) this.union(p, i, j);
      return this.find(p, this.count) === this.find(p, this.count + 1);
    }
    play(i, color) { this.board[i] = color; return this.connect(i, color); }
  }
  // Local shapes are search preferences, never used as proofs or to remove legal moves.
  function shapeScore(board, n, adj, i, color, enhanced) {
    const r = Math.floor(i / n), c = i % n, mid = (n - 1) / 2;
    let score = 1 + (n - Math.abs(r - mid) - Math.abs(c - mid)) / n;
    let own = 0, enemy = 0;
    for (const j of adj[i]) { own += Number(board[j] === color); enemy += Number(board[j] === 3 - color); }
    score += own * 1.3 + enemy * .7;
    if (own > 2) score -= (own - 2) * .8;
    if (enhanced) {
      const axis = color === 1 ? r : c;
      if (axis === 0 || axis === n - 1) score += own ? 1.1 : .1;
      // Two-step nonadjacent friendly endpoints sharing two carriers form a bridge.
      const candidates = new Set();
      for (const j of adj[i]) for (const k of adj[j]) if (board[k] === color && !adj[i].includes(k)) candidates.add(k);
      for (const k of candidates) {
        const common = adj[i].filter(j => adj[k].includes(j));
        if (common.length === 2 && common.every(j => board[j] === 0)) score += 1.5;
      }
    }
    return Math.max(.1, score);
  }
  function bridgeReply(board, n, adj, color, random) {
    const replies = [];
    for (let a = 0; a < board.length; a++) if (board[a] === color) {
      for (const carrier of adj[a]) if (board[carrier] === 3 - color) {
        for (const b of adj[carrier]) if (b > a && board[b] === color && !adj[a].includes(b)) {
          const shared = adj[a].filter(j => adj[b].includes(j));
          if (shared.length === 2) {
            const other = shared.find(j => j !== carrier);
            if (board[other] === 0) replies.push(other);
          }
        }
      }
    }
    return replies.length ? replies[Math.floor(random() * replies.length)] : -1;
  }
  function pickWeighted(items, score, random) {
    const weights = items.map(score), sum = weights.reduce((a, b) => a + b, 0);
    let value = random() * sum;
    for (let k = 0; k < items.length; k++) { value -= weights[k]; if (value <= 0) return items[k]; }
    return items[items.length - 1];
  }
  async function decideSwap(request, onProgress, isCancelled) {
    const n = request.size;
    if (!Number.isInteger(n) || n < 2 || n > 13 || !request.board || request.board.length !== n * n ||
      Array.from(request.board).filter(v => v === 1).length !== 1 || Array.from(request.board).some(v => v !== 0 && v !== 1)) throw Error('Invalid swap position');
    const result = await search({ ...request, action: undefined, player: 2 }, onProgress, isCancelled);
    if (isCancelled && isCancelled()) return { ...result, swap: null };
    const first = Array.from(request.board).indexOf(1), middle = (n - 1) / 2;
    const r = Math.floor(first / n), c = first % n;
    // The opening prior helps short searches compare keeping blue with taking red.
    // This is a heuristic evaluation, not a proof of a winning opening.
    const centrality = 1 - (Math.abs(r - middle) + Math.abs(c - middle)) / (n - 1);
    const searchBlue = Number.isFinite(result.winRate) ? result.winRate : .5;
    const blueEstimate = .35 * searchBlue + .65 * (.58 - .4 * centrality);
    const swap = blueEstimate < .5;
    return { ...result, swap, move: swap ? -1 : result.move,
      winRate: swap ? 1 - blueEstimate : blueEstimate, algorithm: 'Pie swap · UCT and opening prior' };
  }

  async function search(request, onProgress, isCancelled) {
    if (request.action === 'swap') return decideSwap(request, onProgress, isCancelled);
    const started = clock(), n = request.size, color = request.player || 2;
    if (!Number.isInteger(n) || n < 2 || n > 13 || !request.board || request.board.length !== n * n || ![1, 2].includes(color)) throw Error('Invalid Hex search');
    const board = Uint8Array.from(request.board), adj = neighbors(n), difficulty = request.difficulty || 'easy';
    if (board.some(v => v > 2)) throw Error('Invalid Hex stones');
    const high = difficulty === 'high', easy = difficulty === 'easy';
    const algorithm = easy ? '0-1 BFS · weighted candidates' : high ? 'UCT + RAVE/AMAF · bridge and border priors' : 'UCT MCTS · bridge rollouts';
    const random = randomSource(request.seed), budget = Math.max(5, Math.min(15000, Number(request.budgetMs) || 100));
    const maxIterations = request.maxIterations === undefined ? Infinity : Math.max(0, request.maxIterations);
    const stopped = () => isCancelled && isCancelled();
    const answer = (move, iterations = 0, winRate = null, depth = 0) => ({ move, iterations, winRate, elapsedMs: clock() - started, algorithm, depth });
    const empty = []; for (let i = 0; i < board.length; i++) if (!board[i]) empty.push(i);
    if (!empty.length || E.winner(board, n)) return answer(-1);
    if (stopped()) return answer(-1);
    // Exhaustive one-ply checks take precedence over every heuristic and search statistic.
    const threats = [];
    for (let k = 0; k < empty.length; k++) {
      const i = empty[k]; board[i] = color;
      const win = E.winner(board, n) === color; board[i] = 0;
      if (win) return answer(i);
      board[i] = 3 - color; const threat = E.winner(board, n) === 3 - color; board[i] = 0;
      if (threat) threats.push(i);
      if (k % 16 === 15) { await pause(); if (stopped()) return answer(-1); }
    }
    if (threats.length) return answer(threats[0]);
    const ownPath = new Set(E.connection(board, n, color).path), enemyPath = new Set(E.connection(board, n, 3 - color).path);
    const priors = new Float64Array(board.length);
    for (const i of empty) priors[i] = shapeScore(board, n, adj, i, color, high) + (ownPath.has(i) ? 2 : 0) + (enemyPath.has(i) ? 1.2 : 0);
    if (easy) {
      const scored = [];
      for (let k = 0; k < empty.length; k++) {
        const i = empty[k]; board[i] = color;
        const own = E.connection(board, n, color).distance, opponent = E.connection(board, n, 3 - color).distance;
        board[i] = 0;
        scored.push({ i, score: (Number.isFinite(opponent) ? opponent : n * 2) - (Number.isFinite(own) ? own : n * 2) + priors[i] * .13 });
        if (k % 12 === 11) { await pause(); if (stopped()) return answer(-1); }
      }
      scored.sort((a, b) => b.score - a.score);
      const top = scored.slice(0, Math.min(8, scored.length));
      const choice = pickWeighted(top, x => Math.exp((x.score - top[0].score) * 1.2), random);
      return answer(choice.i);
    }
    const position = new Position(n, board);
    const ordered = empty.slice().sort((a, b) => priors[b] - priors[a]);
    const makeNode = (move, player, untried) => ({ move, player, visits: 0, wins: 0, children: [], untried, amaf: new Map() });
    const root = makeNode(-1, 3 - color, ordered);
    let iterations = 0, maxDepth = 0, lastYield = clock(), lastProgress = clock();
    const rootKey = n + ':' + color + ':' + board.join('');
    const previous = high ? cache.get(rootKey) : null;
    // Cache is a prior with bounded weight, keyed by the entire position and side to move.
    if (previous) for (const item of previous) if (!board[item.move]) priors[item.move] += item.rate * 2;
    function selection(node) {
      let best = null, bestScore = -Infinity;
      for (const child of node.children) {
        let rate = child.wins / child.visits;
        if (high) {
          const amaf = node.amaf.get(child.move);
          if (amaf) { const beta = amaf.n / (amaf.n + child.visits + 4 * amaf.n * child.visits / 300); rate = (1 - beta) * rate + beta * amaf.w / amaf.n; }
        }
        const bias = (high ? .45 : .15) * priors[child.move] / (child.visits + 1);
        const score = rate + Math.sqrt(1.6 * Math.log(node.visits + 1) / child.visits) + bias;
        if (score > bestScore) { bestScore = score; best = child; }
      }
      return best;
    }
    while (iterations < maxIterations && (iterations === 0 || clock() - started < budget)) {
      if (stopped()) return answer(-1, iterations);
      position.reset();
      let node = root, turn = color, winner = 0, depth = 0;
      const path = [root], trace = [];
      while (!winner) {
        // Progressive widening orders exploration but leaves every empty move reachable.
        const widen = Math.max(4, Math.floor(Math.sqrt(node.visits + 1) * (high ? 1.5 : 2)));
        if (node.untried.length && node.children.length < widen) {
          const move = node.untried.shift();
          winner = position.play(move, turn) ? turn : 0; trace.push([move, turn]); depth++;
          const remaining = empty.filter(i => position.board[i] === 0);
          remaining.sort((a, b) => shapeScore(position.board, n, adj, b, 3 - turn, false) - shapeScore(position.board, n, adj, a, 3 - turn, false));
          const child = makeNode(move, turn, remaining); node.children.push(child); node = child; path.push(node); turn = 3 - turn;
          break;
        }
        if (!node.children.length) break;
        node = selection(node); winner = position.play(node.move, turn) ? turn : 0;
        trace.push([node.move, turn]); path.push(node); depth++; turn = 3 - turn;
      }
      maxDepth = Math.max(maxDepth, depth);
      let remaining = empty.filter(i => !position.board[i]);
      while (!winner && remaining.length) {
        let move = -1;
        // Bridge replies cost more, so check around every other rollout step for Medium.
        if (high || remaining.length % 2 === 0) move = bridgeReply(position.board, n, adj, turn, random);
        if (move < 0) {
          if (random() < (high ? .8 : .55)) {
            const sample = [];
            for (let k = 0; k < Math.min(high ? 6 : 3, remaining.length); k++) sample.push(remaining[Math.floor(random() * remaining.length)]);
            move = pickWeighted(sample, i => shapeScore(position.board, n, adj, i, turn, false), random);
          } else move = remaining[Math.floor(random() * remaining.length)];
        }
        winner = position.play(move, turn) ? turn : 0;
        trace.push([move, turn]); remaining.splice(remaining.indexOf(move), 1); turn = 3 - turn;
      }
      for (let p = 0; p < path.length; p++) {
        const ancestor = path[p]; ancestor.visits++; ancestor.wins += Number(winner === ancestor.player);
        if (high) for (let k = p; k < trace.length; k++) if (trace[k][1] === 3 - ancestor.player) {
          const move = trace[k][0], stat = ancestor.amaf.get(move) || { n: 0, w: 0 };
          stat.n++; stat.w += Number(winner === trace[k][1]); ancestor.amaf.set(move, stat);
        }
      }
      iterations++;
      if (clock() - lastProgress >= 100) {
        const best = root.children.reduce((a, b) => !a || b.visits > a.visits ? b : a, null);
        if (onProgress) onProgress({ iterations, elapsedMs: clock() - started, winRate: best ? best.wins / best.visits : null });
        lastProgress = clock();
      }
      if (clock() - lastYield >= 10) { await pause(); lastYield = clock(); }
    }
    root.children.sort((a, b) => b.visits - a.visits || b.wins / b.visits - a.wins / a.visits);
    const best = root.children[0];
    if (high) {
      cache.set(rootKey, root.children.map(c => ({ move: c.move, rate: c.wins / c.visits })));
      if (cache.size > 32) cache.delete(cache.keys().next().value);
    }
    return answer(best ? best.move : ordered[0], iterations, best ? best.wins / best.visits : null, maxDepth);
  }
  return { search };
});
