/* Exact arbitrary-board solver. Weighted pattern bounds + exhaustive IDA*. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.createSixteenOptimal = factory;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createSixteenOptimal(E) {
  'use strict';
  const transitions = Array.from({ length: 34 }, (_, id) => {
    const p = Uint8Array.from({ length: 16 }, (_, i) => i), m = E.MOVES[id];
    m.cells.forEach((v, i) => { p[v] = m.cells[(i + m.direction + 4) % 4]; }); return p;
  });
  const cells = E.MOVES.map(m => m.direction === 1 ? m.cells.slice() : m.cells.slice().reverse());
  const disjoint = E.MOVES.map(a => E.MOVES.map(b => !a.cells.some(p => b.cells.includes(p))));
  const distances = Array.from({ length: 16 }, (_, p) => Uint8Array.from({ length: 16 }, (_, v) => {
    const r = Math.abs((p >> 2) - (v >> 2)), c = Math.abs((p & 3) - (v & 3)); return Math.min(r, 4 - r) + Math.min(c, 4 - c);
  }));
  const groups = Array.from({ length: 8 }, (_, i) => Array.from({ length: 4 }, (_, j) => i < 4 ? i * 4 + j : j * 4 + i - 4));
  const pause = () => new Promise(resolve => setTimeout(resolve, 0));
  const abortError = () => { const e = new Error('Search cancelled'); e.name = 'AbortError'; return e; };
  let patterns = null;
  async function buildPatterns(options) {
    if (patterns) return patterns;
    const result = [];
    for (let g = 0; g < 8; g++) {
      const dist = new Uint8Array(65536); dist.fill(255);
      const start = groups[g].reduce((k, p, i) => k | p << (i * 4), 0), buckets = Array.from({ length: 129 }, () => []);
      dist[start] = 0; buckets[0].push(start); let visited = 0;
      for (let cost = 0; cost < buckets.length; cost++) while (buckets[cost].length) {
        const key = buckets[cost].pop(); if (dist[key] !== cost) continue;
        const a = key & 15, b = key >> 4 & 15, c = key >> 8 & 15, d = key >> 12;
        for (let m = 0; m < 34; m++) {
          const p = transitions[m], aa = p[a], bb = p[b], cc = p[c], dd = p[d];
          const child = aa | bb << 4 | cc << 8 | dd << 12;
          const next = cost + (aa !== a) + (bb !== b) + (cc !== c) + (dd !== d);
          if (next < dist[child]) { dist[child] = next; (buckets[next] ||= []).push(child); }
        }
        if (++visited % 4096 === 0) {
          if (options.signal?.aborted) throw abortError();
          options.onProgress?.({ phase: 'patterns', completed: g, total: 8, nodes: 0 }); await pause();
        }
      }
      if (visited !== 16 * 15 * 14 * 13) throw new Error('Incomplete pattern database');
      result.push(dist); options.onProgress?.({ phase: 'patterns', completed: g + 1, total: 8, nodes: 0 });
    }
    patterns = result; return result;
  }
  async function search(start, options = {}, ceiling = null) {
    const bounded = ceiling !== null;
    if (bounded && (!Number.isInteger(ceiling) || ceiling < 0)) throw new RangeError('Move limit must be a nonnegative integer');
    if (!E.valid(start)) throw new Error('Invalid board');
    if (options.signal?.aborted) throw abortError();
    if (start === E.GOAL) return bounded ? { within: true, solution: [], length: 0, nodes: 0, proof: 'bounded-witness' } : { solution: [], optimal: 0, nodes: 0, proof: 'exhaustive-ida-star' };
    const started = Date.now(), odd = E.parity(start); let bound = E.lowerBound(start), nodes = 0;
    options.onProgress?.({ phase: 'patterns', lower: bound, completed: 0, total: 8, nodes });
    const tables = await buildPatterns({ ...options, onProgress: p => options.onProgress?.({ ...p, lower: bound }) });
    if (options.signal?.aborted) throw abortError();
    const b = Uint8Array.from(start, c => c.charCodeAt(0) - 65), codes = new Uint16Array(8);
    for (let p = 0; p < 16; p++) { const v = b[p]; codes[v >> 2] |= p << ((v & 3) * 4); codes[4 + (v & 3)] |= p << ((v >> 2) * 4); }
    function weighted() { return Math.max(tables[0][codes[0]] + tables[1][codes[1]] + tables[2][codes[2]] + tables[3][codes[3]], tables[4][codes[4]] + tables[5][codes[5]] + tables[6][codes[6]] + tables[7][codes[7]]); }
    let lo = 0, hi = 0;
    for (let p = 0; p < 16; p++) if (p < 8) lo |= b[p] << (p * 4); else hi |= b[p] << ((p - 8) * 4);
    function relocate(v, p) {
      let g = v >> 2, shift = (v & 3) * 4; codes[g] = codes[g] & ~(15 << shift) | p << shift;
      g = 4 + (v & 3); shift = (v >> 2) * 4; codes[g] = codes[g] & ~(15 << shift) | p << shift;
      if (p < 8) lo = lo & ~(15 << (p * 4)) | v << (p * 4); else { shift = (p - 8) * 4; hi = hi & ~(15 << shift) | v << shift; }
    }
    function apply(id) {
      const [a, c, d, e] = cells[id], x = b[a], y = b[c], z = b[d], w = b[e];
      b[a] = w; b[c] = x; b[d] = y; b[e] = z;
      relocate(w, a); relocate(x, c); relocate(y, d); relocate(z, e);
    }
    const initialDist = E.distanceSum(start);
    bound = Math.max(bound, Math.ceil(weighted() / 4)); if ((bound & 1) !== odd) bound++;
    const provenLower = bound;
    if (bounded) {
      bound = ceiling - ((ceiling & 1) !== odd ? 1 : 0);
      if (bound < provenLower) return { within: false, solution: null, excludedThrough: ceiling, lower: provenLower, nodes, proof: 'admissible-lower-bound' };
    }
    // A fixed-size exact-key cache bounds memory. Collisions only replace entries;
    // pruning requires matching both 32-bit state halves AND move context.
    const size = 1 << 19, mask = size - 1;
    const keyLo = new Int32Array(size), keyHi = new Int32Array(size), context = new Uint8Array(size), budget = new Uint16Array(size), stamp = new Uint32Array(size);
    let iteration = 0, lastReport = 0;
    for (;; bound += 2) {
      iteration++; let depth = 0, entering = true, work = 0;
      const path = new Int16Array(bound + 1), sums = new Int16Array(bound + 1), counts = new Uint8Array(bound + 1), cursor = new Uint8Array(bound + 1), repeats = new Uint8Array(bound + 1);
      const actions = new Int8Array((bound + 1) * 34), scores = new Int16Array((bound + 1) * 34); sums[0] = initialDist;
      options.onProgress?.({ phase: bounded ? 'bounded-search' : 'search', lower: bounded ? provenLower : bound, bound, nodes, elapsed: Date.now() - started });
      while (depth >= 0) {
        if (entering) {
          nodes++; const remaining = bound - depth, sum = sums[depth];
          if (sum === 0) return bounded ? { within: true, solution: Array.from(path.slice(0, depth)), length: depth, nodes, elapsed: Date.now() - started, proof: 'bounded-witness' } : { solution: Array.from(path.slice(0, depth)), optimal: depth, nodes, elapsed: Date.now() - started, proof: 'exhaustive-ida-star' };
          counts[depth] = cursor[depth] = 0;
          if (remaining > 0 && sum <= 4 * remaining && weighted() <= 4 * remaining) {
            const last = depth ? path[depth - 1] : -1, ctx = last + 1 + repeats[depth] * 35;
            const hash = (lo ^ Math.imul(hi, 0x9e3779b1) ^ ctx * 7919) & mask;
            const seen = stamp[hash] === iteration && keyLo[hash] === lo && keyHi[hash] === hi && context[hash] === ctx && budget[hash] >= remaining;
            if (!seen) {
              stamp[hash] = iteration; keyLo[hash] = lo; keyHi[hash] = hi; context[hash] = ctx; budget[hash] = remaining;
              const offset = depth * 34;
              for (let id = 0; id < 34; id++) {
                if (last >= 0 && (id === (last ^ 1) || id === last && repeats[depth] === 2 || id < last && disjoint[id][last])) continue;
                const [a, c, d, e] = cells[id];
                const delta = distances[a][b[e]] + distances[c][b[a]] + distances[d][b[c]] + distances[e][b[d]] - distances[a][b[a]] - distances[c][b[c]] - distances[d][b[d]] - distances[e][b[e]];
                if (sum + delta > 4 * (remaining - 1)) continue;
                apply(id); const weight = weighted(); apply(id ^ 1);
                if (weight > 4 * (remaining - 1)) continue;
                const score = weight * 4 + sum + delta; let i = counts[depth]++;
                while (i > 0 && scores[offset + i - 1] > score) { actions[offset + i] = actions[offset + i - 1]; scores[offset + i] = scores[offset + i - 1]; i--; }
                actions[offset + i] = id; scores[offset + i] = score;
              }
            }
          }
          entering = false;
        }
        if (cursor[depth] < counts[depth]) {
          const id = actions[depth * 34 + cursor[depth]++], [a, c, d, e] = cells[id];
          const delta = distances[a][b[e]] + distances[c][b[a]] + distances[d][b[c]] + distances[e][b[d]] - distances[a][b[a]] - distances[c][b[c]] - distances[d][b[d]] - distances[e][b[e]];
          path[depth] = id; sums[depth + 1] = sums[depth] + delta; repeats[depth + 1] = depth && path[depth - 1] === id ? repeats[depth] + 1 : 1;
          apply(id); depth++; entering = true;
        } else { depth--; if (depth >= 0) apply(path[depth] ^ 1); }
        if (++work % 8192 === 0) {
          if (options.signal?.aborted) throw abortError();
          const now = Date.now();
          if (now - lastReport > 250) { lastReport = now; options.onProgress?.({ phase: bounded ? 'bounded-search' : 'search', lower: bounded ? provenLower : bound, bound, nodes, elapsed: now - started }); }
          await pause();
        }
      }
      if (bounded) return { within: false, solution: null, excludedThrough: ceiling, lower: bound + 2, nodes, elapsed: Date.now() - started, proof: 'exhaustive-bounded-search' };
    }
  }
  return { solve: (start, options) => search(start, options), findWithin: async (start, limit, options) => {
    if (!Number.isInteger(limit) || limit < 0) throw new RangeError('Move limit must be a nonnegative integer');
    return search(start, options, limit);
  } };
});
