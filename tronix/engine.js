/* Tronix: straight-line graph untangling. Pure geometry, fixed levels and seeded generators. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TronixEngine = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function createTronixEngine() {
  'use strict';

  const VERSION = 1;
  const WIDTH = 1000, HEIGHT = 750;
  const BOUNDS = Object.freeze({ minX: 50, maxX: 950, minY: 50, maxY: 700 });
  const EPS = 1e-7;
  const POINT_EPS = 1e-6;
  const COINCIDE_EPS = 0.5;
  const NODE_EDGE_EPS = 0.35;

  function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
  }

  function distanceSq(a, b) {
    const dx = a[0] - b[0], dy = a[1] - b[1];
    return dx * dx + dy * dy;
  }

  function cross(ax, ay, bx, by) {
    return ax * by - ay * bx;
  }

  function round2(value) {
    return Math.round(value * 100) / 100;
  }

  function hashSeed(value) {
    let text;
    if (typeof value === 'number' && Number.isFinite(value)) text = 'n:' + (value >>> 0);
    else text = 's:' + String(value === undefined ? '' : value);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function mulberry32(seed) {
    let state = seed >>> 0;
    return function random() {
      state = state + 0x6d2b79f5 | 0;
      let t = Math.imul(state ^ state >>> 15, 1 | state);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function shuffle(list, random) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const temp = list[i];
      list[i] = list[j];
      list[j] = temp;
    }
    return list;
  }

  function labelsFor(count) {
    if (!Number.isInteger(count) || count < 0 || count > 26) throw new TypeError('Node count must be an integer from 0 to 26');
    const labels = [];
    for (let i = 0; i < count; i++) labels.push(String.fromCharCode(65 + i));
    return labels;
  }

  function clonePoints(points) {
    return points.map(point => [Number(point[0]), Number(point[1])]);
  }

  function cloneEdges(edges) {
    return edges.map(edge => [edge[0], edge[1]]);
  }

  function freezePoints(points) {
    return Object.freeze(points.map(point => Object.freeze([point[0], point[1]])));
  }

  function freezeEdges(edges) {
    return Object.freeze(edges.map(edge => Object.freeze([edge[0], edge[1]])));
  }

  // Labels identify vertices without revealing their place in the hidden layout.
  function relabelEmbedding(points, edges, seed) {
    const order = shuffle(points.map((_, i) => i), mulberry32(hashSeed('labels:' + seed)));
    const inverse = [];
    order.forEach((oldIndex, newIndex) => { inverse[oldIndex] = newIndex; });
    return {
      points: order.map(i => points[i].slice()),
      edges: edges.map(([a, b]) => [inverse[a], inverse[b]])
    };
  }

  function clampPoint(point, bounds) {
    const box = bounds || BOUNDS;
    return [clamp(Number(point[0]), box.minX, box.maxX), clamp(Number(point[1]), box.minY, box.maxY)];
  }

  function pointOnSegment(point, a, b, tolerance) {
    const tol = tolerance === undefined ? POINT_EPS : Math.max(0, Number(tolerance));
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    if (length <= EPS) return Math.hypot(point[0] - a[0], point[1] - a[1]) <= tol;
    const px = point[0] - a[0], py = point[1] - a[1];
    const perpendicular = Math.abs(cross(px, py, dx, dy)) / length;
    if (perpendicular > tol) return false;
    const projection = px * dx + py * dy;
    return projection >= -tol * length && projection <= length * length + tol * length;
  }

  // Returns one of: none, shared-endpoint, cross, touch, overlap.
  // shared-endpoint is the only point contact that can be legal in a graph.
  function segmentRelation(a, b, c, d, tolerance) {
    const tol = tolerance === undefined ? EPS : Math.max(0, Number(tolerance));
    const len1 = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const len2 = Math.hypot(d[0] - c[0], d[1] - c[1]);
    if (len1 <= tol || len2 <= tol) return 'overlap';

    if (Math.max(a[0], b[0]) + tol < Math.min(c[0], d[0]) ||
        Math.max(c[0], d[0]) + tol < Math.min(a[0], b[0]) ||
        Math.max(a[1], b[1]) + tol < Math.min(c[1], d[1]) ||
        Math.max(c[1], d[1]) + tol < Math.min(a[1], b[1])) return 'none';

    const d1x = b[0] - a[0], d1y = b[1] - a[1];
    const d2x = d[0] - c[0], d2y = d[1] - c[1];
    const rx = c[0] - a[0], ry = c[1] - a[1];
    const distC = Math.abs(cross(rx, ry, d1x, d1y)) / len1;
    const sx = d[0] - a[0], sy = d[1] - a[1];
    const distD = Math.abs(cross(sx, sy, d1x, d1y)) / len1;

    if (distC <= tol && distD <= tol) {
      const lenSq = len1 * len1;
      const t3 = (rx * d1x + ry * d1y) / lenSq;
      const t4 = (sx * d1x + sy * d1y) / lenSq;
      const low = Math.max(0, Math.min(t3, t4));
      const high = Math.min(1, Math.max(t3, t4));
      if (high < low - tol / len1) return 'none';
      const overlap = (high - low) * len1;
      if (overlap > tol) return 'overlap';
      if (high >= low - tol / len1) {
        const contact = clamp((low + high) / 2, 0, 1);
        const px = a[0] + d1x * contact, py = a[1] + d1y * contact;
        const u = ((px - c[0]) * d2x + (py - c[1]) * d2y) / (len2 * len2);
        const endpoint1 = contact <= tol / len1 || contact >= 1 - tol / len1;
        const endpoint2 = u <= tol / len2 || u >= 1 - tol / len2;
        return endpoint1 && endpoint2 ? 'shared-endpoint' : 'touch';
      }
      return 'none';
    }

    const denominator = cross(d1x, d1y, d2x, d2y);
    if (Math.abs(denominator) <= 1e-12 * len1 * len2) return 'none';
    const t = cross(rx, ry, d2x, d2y) / denominator;
    const u = cross(rx, ry, d1x, d1y) / denominator;
    const tEps = tol / len1, uEps = tol / len2;
    if (t < -tEps || t > 1 + tEps || u < -uEps || u > 1 + uEps) return 'none';
    const endpoint1 = t <= tEps || t >= 1 - tEps;
    const endpoint2 = u <= uEps || u >= 1 - uEps;
    if (endpoint1 && endpoint2) return 'shared-endpoint';
    if (endpoint1 || endpoint2) return 'touch';
    return 'cross';
  }

  function segmentsConflict(a, b, c, d) {
    const relation = segmentRelation(a, b, c, d);
    return relation !== 'none' && relation !== 'shared-endpoint';
  }

  function detectConflicts(points, edges, options) {
    if (!Array.isArray(points) || !Array.isArray(edges)) throw new TypeError('Points and edges must be arrays');
    const opts = options || {};
    const bounds = opts.bounds || null;
    const count = points.length;
    const edgeCount = edges.length;
    const conflicts = [];
    const edgeFlags = Array(edgeCount).fill(false);
    const nodeFlags = Array(count).fill(false);
    const outOfBounds = [];

    for (let i = 0; i < count; i++) {
      const point = points[i];
      if (!Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
        throw new TypeError('Every point must be a finite [x, y] pair');
      }
      if (bounds && (point[0] < bounds.minX || point[0] > bounds.maxX || point[1] < bounds.minY || point[1] > bounds.maxY)) {
        conflicts.push({ type: 'bounds', node: i });
        nodeFlags[i] = true;
        outOfBounds.push(i);
      }
    }

    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        if (Math.sqrt(distanceSq(points[i], points[j])) <= COINCIDE_EPS) {
          conflicts.push({ type: 'coincident', nodes: [i, j] });
          nodeFlags[i] = true;
          nodeFlags[j] = true;
        }
      }
    }

    for (let k = 0; k < edgeCount; k++) {
      const edge = edges[k];
      if (!Array.isArray(edge) || edge.length !== 2 || !Number.isInteger(edge[0]) || !Number.isInteger(edge[1]) ||
          edge[0] < 0 || edge[0] >= count || edge[1] < 0 || edge[1] >= count || edge[0] === edge[1]) {
        throw new TypeError('Every edge must join two distinct existing nodes');
      }
      if (Math.sqrt(distanceSq(points[edge[0]], points[edge[1]])) <= COINCIDE_EPS) {
        conflicts.push({ type: 'zero-edge', edge: k });
        edgeFlags[k] = true;
        nodeFlags[edge[0]] = true;
        nodeFlags[edge[1]] = true;
      }
    }

    for (let i = 0; i < count; i++) {
      for (let k = 0; k < edgeCount; k++) {
        const edge = edges[k];
        if (i === edge[0] || i === edge[1]) continue;
        if (pointOnSegment(points[i], points[edge[0]], points[edge[1]], NODE_EDGE_EPS)) {
          conflicts.push({ type: 'node-edge', node: i, edge: k });
          nodeFlags[i] = true;
          edgeFlags[k] = true;
        }
      }
    }

    for (let k = 0; k < edgeCount; k++) {
      for (let l = k + 1; l < edgeCount; l++) {
        const edgeA = edges[k], edgeB = edges[l];
        const relation = segmentRelation(points[edgeA[0]], points[edgeA[1]], points[edgeB[0]], points[edgeB[1]]);
        if (relation === 'none' || relation === 'shared-endpoint') continue;
        conflicts.push({ type: relation, edges: [k, l] });
        edgeFlags[k] = true;
        edgeFlags[l] = true;
      }
    }

    return {
      valid: conflicts.length === 0,
      count: conflicts.length,
      conflicts,
      edgeFlags,
      nodeFlags,
      outOfBounds
    };
  }

  function validateSolution(points, edges, options) {
    return detectConflicts(points, edges, options);
  }

  function randomStartLayout(nodeCount, seed, options) {
    if (!Number.isInteger(nodeCount) || nodeCount < 1 || nodeCount > 26) throw new TypeError('Node count must be an integer from 1 to 26');
    const opts = options || {};
    const box = opts.bounds || BOUNDS;
    const minDistance = opts.minDistance === undefined ? 125 : Math.max(1, Number(opts.minDistance));
    const margin = opts.margin === undefined ? 28 : Math.max(0, Number(opts.margin));
    const minX = box.minX + margin, maxX = box.maxX - margin;
    const minY = box.minY + margin, maxY = box.maxY - margin;
    const random = mulberry32(hashSeed('start:' + seed));
    const minSq = minDistance * minDistance;

    for (let attempt = 0; attempt < 180; attempt++) {
      const points = [];
      let failed = false;
      for (let i = 0; i < nodeCount; i++) {
        let placed = false;
        for (let tries = 0; tries < 260; tries++) {
          const point = [minX + random() * (maxX - minX), minY + random() * (maxY - minY)];
          let clear = true;
          for (let j = 0; j < points.length; j++) {
            if (distanceSq(point, points[j]) < minSq) { clear = false; break; }
          }
          if (clear) { points.push(point); placed = true; break; }
        }
        if (!placed) { failed = true; break; }
      }
      if (!failed) return points;
    }

    // Fixed fallback: a jittered grid, still deterministic and inside the board.
    const points = [];
    const columns = Math.ceil(Math.sqrt(nodeCount * (maxX - minX) / Math.max(1, maxY - minY)));
    const rows = Math.ceil(nodeCount / columns);
    for (let i = 0; i < nodeCount; i++) {
      const column = i % columns, row = Math.floor(i / columns);
      const x = minX + (column + 0.5) * (maxX - minX) / columns;
      const y = minY + (row + 0.5) * (maxY - minY) / Math.max(1, rows);
      points.push([
        clamp(round2(x + (random() - 0.5) * 8), minX, maxX),
        clamp(round2(y + (random() - 0.5) * 8), minY, maxY)
      ]);
    }
    return points;
  }

  function startWithConflict(nodeCount, edges, seed, options) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const points = randomStartLayout(nodeCount, hashSeed(seed + ':' + attempt), options);
      if (detectConflicts(points, edges, { bounds: BOUNDS }).count > 0) return points;
    }
    return randomStartLayout(nodeCount, hashSeed(seed + ':fallback'), options);
  }

  function scrambleLayout(points, seed, options) {
    return randomStartLayout(points.length, seed, options);
  }

  const LEVEL_SPECS = [
    {
      name: '同心方环', tier: '入门', seed: 0x1a2b3c41,
      solution: [[170, 170], [830, 170], [830, 580], [170, 580], [500, 250], [750, 375], [500, 500], [250, 375]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]
    },
    {
      name: '九宫初网', tier: '入门', seed: 0x2b3c4d52,
      solution: [[190, 150], [500, 150], [810, 150], [190, 380], [500, 380], [810, 380], [190, 610], [500, 610], [810, 610]],
      edges: [[0, 1], [1, 2], [3, 4], [4, 5], [6, 7], [7, 8], [0, 3], [3, 6], [1, 4], [4, 7], [2, 5], [5, 8], [0, 4], [4, 8]]
    },
    {
      name: '双六边形', tier: '进阶', seed: 0x3c4d5e63,
      solution: [[900, 375], [700, 626], [300, 626], [100, 375], [300, 124], [700, 124], [720, 375], [610, 514], [390, 514], [280, 375], [390, 236], [610, 236]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 6], [0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]]
    },
    {
      name: '交错长梯', tier: '进阶', seed: 0x4d5e6f74,
      solution: [[110, 150], [266, 150], [422, 150], [578, 150], [734, 150], [890, 150], [110, 580], [266, 580], [422, 580], [578, 580], [734, 580], [890, 580]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11], [0, 7], [1, 8], [2, 9], [3, 10], [4, 11]]
    },
    {
      name: '三重五环', tier: '困难', seed: 0x5e6f7085,
      solution: [[500, 75], [880, 282], [735, 618], [265, 618], [120, 282], [500, 195], [728, 319], [641, 521], [359, 521], [272, 319], [500, 295], [595, 350], [559, 440], [441, 440], [405, 350]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [5, 6], [6, 7], [7, 8], [8, 9], [9, 5], [10, 11], [11, 12], [12, 13], [13, 14], [14, 10], [0, 5], [1, 6], [2, 7], [3, 8], [4, 9], [5, 10], [6, 11], [7, 12], [8, 13], [9, 14]]
    },
    {
      name: '方格密网', tier: '困难', seed: 0x6f708196,
      solution: [[130, 110], [380, 110], [620, 110], [870, 110], [130, 310], [380, 310], [620, 310], [870, 310], [130, 510], [380, 510], [620, 510], [870, 510], [130, 660], [380, 660], [620, 660], [870, 660]],
      edges: [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7], [8, 9], [9, 10], [10, 11], [12, 13], [13, 14], [14, 15], [0, 4], [4, 8], [8, 12], [1, 5], [5, 9], [9, 13], [2, 6], [6, 10], [10, 14], [3, 7], [7, 11], [11, 15], [0, 5], [1, 6], [2, 7], [4, 9], [5, 10], [6, 11], [8, 13], [9, 14], [10, 15]]
    },
    {
      name: '三角原野', tier: '困难', seed: 0x708192a7,
      solution: [[360, 120], [500, 120], [640, 120], [290, 260], [430, 260], [570, 260], [710, 260], [220, 400], [360, 400], [500, 400], [640, 400], [780, 400], [150, 540], [290, 540], [430, 540], [570, 540], [710, 540], [850, 540]],
      edges: [[0, 1], [1, 2], [3, 4], [4, 5], [5, 6], [7, 8], [8, 9], [9, 10], [10, 11], [12, 13], [13, 14], [14, 15], [15, 16], [16, 17], [0, 3], [0, 4], [1, 4], [1, 5], [2, 5], [2, 6], [3, 7], [3, 8], [4, 8], [4, 9], [5, 9], [5, 10], [6, 10], [6, 11], [7, 12], [7, 13], [8, 13], [8, 14], [9, 14], [9, 15], [10, 15], [10, 16], [11, 16], [11, 17]]
    },
    {
      name: '环中庭院', tier: '困难', seed: 0x8192a3b8,
      solution: [[900, 375], [783, 587], [500, 675], [217, 587], [100, 375], [217, 163], [500, 75], [783, 163], [730, 375], [663, 502], [500, 555], [337, 502], [270, 375], [337, 248], [500, 195], [663, 248], [430, 320], [570, 320], [570, 430], [430, 430]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15], [15, 8], [0, 8], [1, 9], [2, 10], [3, 11], [4, 12], [5, 13], [6, 14], [7, 15], [16, 17], [17, 18], [18, 19], [19, 16], [16, 13], [16, 14], [17, 14], [17, 15], [18, 15], [18, 9], [19, 12], [19, 11]]
    },
    {
      name: '十边之眼', tier: '专家', seed: 0x92a3b4c9,
      solution: [[500, 75], [735, 132], [880, 282], [880, 468], [735, 618], [500, 675], [265, 618], [120, 468], [120, 282], [265, 132], [500, 210], [629, 242], [709, 324], [709, 426], [629, 508], [500, 540], [371, 508], [291, 426], [291, 324], [371, 242], [500, 375]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 0], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15], [15, 16], [16, 17], [17, 18], [18, 19], [19, 10], [0, 10], [1, 11], [2, 12], [3, 13], [4, 14], [5, 15], [6, 16], [7, 17], [8, 18], [9, 19], [20, 10], [20, 11], [20, 12], [20, 13], [20, 14], [20, 15], [20, 16], [20, 17], [20, 18], [20, 19]]
    },
    {
      name: '三角密林', tier: '专家', seed: 0xa3b4c5da,
      solution: [[150, 85], [290, 85], [430, 85], [570, 85], [710, 85], [850, 85], [220, 210], [360, 210], [500, 210], [640, 210], [780, 210], [290, 335], [430, 335], [570, 335], [710, 335], [360, 460], [500, 460], [640, 460], [430, 585], [570, 585], [500, 685]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [6, 7], [7, 8], [8, 9], [9, 10], [11, 12], [12, 13], [13, 14], [15, 16], [16, 17], [18, 19], [0, 6], [1, 6], [1, 7], [2, 7], [2, 8], [3, 8], [3, 9], [4, 9], [4, 10], [5, 10], [6, 11], [7, 11], [7, 12], [8, 12], [8, 13], [9, 13], [9, 14], [10, 14], [11, 15], [12, 15], [12, 16], [13, 16], [13, 17], [14, 17], [15, 18], [16, 18], [16, 19], [17, 19], [18, 20], [19, 20]]
    },
    {
      name: '四六织网', tier: '专家', seed: 0xb4c5d6eb,
      solution: [[100, 100], [266, 100], [432, 100], [598, 100], [764, 100], [930, 100], [100, 290], [266, 290], [432, 290], [598, 290], [764, 290], [930, 290], [100, 490], [266, 490], [432, 490], [598, 490], [764, 490], [930, 490], [100, 650], [266, 650], [432, 650], [598, 650], [764, 650], [930, 650]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [12, 13], [13, 14], [14, 15], [15, 16], [16, 17], [18, 19], [19, 20], [20, 21], [21, 22], [22, 23], [0, 6], [6, 12], [12, 18], [1, 7], [7, 13], [13, 19], [2, 8], [8, 14], [14, 20], [3, 9], [9, 15], [15, 21], [4, 10], [10, 16], [16, 22], [5, 11], [11, 17], [17, 23], [0, 7], [1, 8], [2, 9], [3, 10], [4, 11], [6, 13], [7, 14], [8, 15], [9, 16], [10, 17], [12, 19], [13, 20], [14, 21], [15, 22], [16, 23]]
    },
    {
      name: '层叠迷宫', tier: '专家', seed: 0xc5d6e7fc,
      solution: [[500, 75], [735, 132], [880, 282], [880, 468], [735, 618], [500, 675], [265, 618], [120, 468], [120, 282], [265, 132], [500, 210], [629, 242], [709, 324], [709, 426], [629, 508], [500, 540], [371, 508], [291, 426], [291, 324], [371, 242], [500, 300], [587, 337.5], [587, 412.5], [500, 450], [413, 412.5], [413, 337.5]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 0], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15], [15, 16], [16, 17], [17, 18], [18, 19], [19, 10], [20, 21], [21, 22], [22, 23], [23, 24], [24, 25], [25, 20], [0, 10], [1, 11], [2, 12], [3, 13], [4, 14], [5, 15], [6, 16], [7, 17], [8, 18], [9, 19], [10, 20], [12, 21], [13, 22], [15, 23], [16, 24], [17, 25]]
    }
  ];

  function makeLevel(spec, index) {
    const relabeled = relabelEmbedding(spec.solution, spec.edges, spec.seed);
    const solution = freezePoints(relabeled.points);
    const edges = freezeEdges(relabeled.edges);
    const start = freezePoints(startWithConflict(spec.solution.length, edges, spec.seed));
    const report = detectConflicts(start, edges, { bounds: BOUNDS });
    const solutionReport = detectConflicts(solution, edges, { bounds: BOUNDS });
    return Object.freeze({
      index,
      id: 'L' + String(index + 1).padStart(2, '0'),
      name: spec.name,
      tier: spec.tier,
      nodes: Object.freeze(labelsFor(spec.solution.length)),
      n: spec.solution.length,
      m: spec.edges.length,
      edges,
      start,
      solution,
      meta: Object.freeze({
        n: spec.solution.length,
        m: spec.edges.length,
        initialConflicts: report.count,
        witnessValid: solutionReport.valid
      })
    });
  }

  const LEVELS = Object.freeze(LEVEL_SPECS.map(makeLevel));

  const DIFFICULTY = Object.freeze({
    easy: Object.freeze({ minNodes: 8, maxNodes: 11, chordRatio: 0.4 }),
    medium: Object.freeze({ minNodes: 14, maxNodes: 17, chordRatio: 0.58 }),
    hard: Object.freeze({ minNodes: 18, maxNodes: 22, chordRatio: 0.82 }),
    expert: Object.freeze({ minNodes: 23, maxNodes: 26, chordRatio: 1 })
  });

  function difficultyConfig(difficulty) {
    const name = difficulty === undefined ? 'hard' : String(difficulty);
    const config = DIFFICULTY[name];
    if (!config) throw new TypeError('Difficulty must be easy, medium, hard or expert');
    return [name, config];
  }

  function circularChordsCross(a, b, c, d) {
    const first = a < b ? [a, b] : [b, a];
    const second = c < d ? [c, d] : [d, c];
    const [a1, a2] = first, [b1, b2] = second;
    return (a1 < b1 && b1 < a2 && a2 < b2) || (b1 < a1 && a1 < b2 && b2 < a2);
  }

  function generate(seed, difficulty) {
    const [difficultyName, config] = difficultyConfig(difficulty);
    const baseSeed = hashSeed(seed);
    const random = mulberry32(baseSeed);
    const nodeCount = config.minNodes + Math.floor(random() * (config.maxNodes - config.minNodes + 1));
    const startAngle = random() * Math.PI * 2;
    const rx = Math.min(410, 430), ry = 295;
    const solution = [];
    const angleStep = Math.PI * 2 / nodeCount;
    for (let i = 0; i < nodeCount; i++) {
      const jitter = (random() - 0.5) * angleStep * 0.22;
      const angle = startAngle - Math.PI / 2 + i * angleStep + jitter;
      solution.push([
        round2(500 + rx * Math.cos(angle)),
        round2(375 + ry * Math.sin(angle))
      ]);
    }

    const edges = [];
    for (let i = 0; i < nodeCount; i++) edges.push([i, (i + 1) % nodeCount]);
    const chords = [];
    const candidates = [];
    for (let a = 0; a < nodeCount; a++) {
      for (let b = a + 2; b < nodeCount; b++) {
        if (a === 0 && b === nodeCount - 1) continue;
        candidates.push([a, b]);
      }
    }
    shuffle(candidates, random);
    const targetEdges = Math.min(2 * nodeCount - 3, Math.round(nodeCount + config.chordRatio * (nodeCount - 3)));
    for (const candidate of candidates) {
      if (edges.length >= targetEdges) break;
      let crosses = false;
      for (const chord of chords) {
        if (circularChordsCross(candidate[0], candidate[1], chord[0], chord[1])) { crosses = true; break; }
      }
      if (!crosses) {
        chords.push(candidate);
        edges.push(candidate);
      }
    }

    const labels = labelsFor(nodeCount);
    const relabeled = relabelEmbedding(solution, edges, baseSeed);
    const start = freezePoints(startWithConflict(nodeCount, relabeled.edges, baseSeed ^ 0xa5a5a5a5));
    const solutionPoints = freezePoints(relabeled.points);
    const frozenEdges = freezeEdges(relabeled.edges);
    const solutionReport = detectConflicts(solutionPoints, frozenEdges, { bounds: BOUNDS });
    const startReport = detectConflicts(start, frozenEdges, { bounds: BOUNDS });
    return Object.freeze({
      id: 'random-' + baseSeed.toString(16),
      name: '随机线网',
      tier: difficultyName === 'expert' ? '专家' : difficultyName === 'hard' ? '困难' : '随机',
      nodes: Object.freeze(labels),
      n: nodeCount,
      m: edges.length,
      edges: frozenEdges,
      start,
      solution: solutionPoints,
      seed: baseSeed,
      difficulty: difficultyName,
      meta: Object.freeze({
        n: nodeCount,
        m: edges.length,
        initialConflicts: startReport.count,
        witnessValid: solutionReport.valid
      })
    });
  }

  function shanghaiDateString(date) {
    const value = date === undefined ? new Date() : date instanceof Date ? date : new Date(date);
    if (!Number.isFinite(value.getTime())) throw new TypeError('Invalid date');
    return new Date(value.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  function dateSeed(dateString) {
    return hashSeed('tronix-daily:' + String(dateString === undefined ? shanghaiDateString() : dateString));
  }

  function dailySeedForDate(date) {
    return dateSeed(shanghaiDateString(date));
  }

  function formatDateCN(dateString) {
    const parts = String(dateString).split('-');
    return Number(parts[1]) + ' 月 ' + Number(parts[2]) + ' 日';
  }

  return Object.freeze({
    version: VERSION,
    WIDTH,
    HEIGHT,
    BOUNDS,
    EPS,
    POINT_EPS,
    COINCIDE_EPS,
    NODE_EDGE_EPS,
    LEVELS,
    DIFFICULTY,
    labelsFor,
    clonePoints,
    cloneEdges,
    clampPoint,
    pointOnSegment,
    segmentRelation,
    segmentsConflict,
    detectConflicts,
    validateSolution,
    randomStartLayout,
    scrambleLayout,
    generate,
    shanghaiDateString,
    dateSeed,
    dailySeedForDate,
    formatDateCN,
    hashSeed
  });
});
