'use strict';

const assert = require('node:assert/strict');
const E = require('./engine.js');

let passed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('ok ' + name);
  } catch (error) {
    console.error('not ok ' + name);
    console.error(error && error.stack || error);
    process.exitCode = 1;
  }
}

function emptyReport(points, edges, options) {
  return E.detectConflicts(points, edges, options);
}

test('proper crossing is detected', () => {
  assert.equal(E.segmentRelation([0, 0], [10, 10], [0, 10], [10, 0]), 'cross');
  assert.equal(E.segmentsConflict([0, 0], [10, 10], [0, 10], [10, 0]), true);
});

test('a shared endpoint alone is legal', () => {
  assert.equal(E.segmentRelation([0, 0], [10, 0], [10, 0], [10, 10]), 'shared-endpoint');
  assert.equal(E.segmentsConflict([0, 0], [10, 0], [10, 0], [10, 10]), false);
});

test('collinear extension through a shared endpoint is legal', () => {
  const report = emptyReport([[0, 0], [10, 0], [20, 0]], [[0, 1], [1, 2]]);
  assert.equal(report.valid, true);
  assert.equal(report.count, 0);
});

test('collinear overlap is illegal even when the endpoint is shared', () => {
  assert.equal(E.segmentRelation([0, 0], [10, 0], [5, 0], [15, 0]), 'overlap');
  assert.equal(E.segmentRelation([0, 0], [10, 0], [0, 0], [5, 0]), 'overlap');
  const report = emptyReport([[0, 0], [10, 0], [5, 0]], [[0, 1], [0, 2]]);
  assert.equal(report.valid, false);
  assert.ok(report.conflicts.some(conflict => conflict.type === 'overlap'));
});

test('an endpoint touching the interior of another edge is illegal', () => {
  assert.equal(E.segmentRelation([0, 0], [10, 0], [5, 0], [5, 10]), 'touch');
  assert.equal(E.segmentsConflict([0, 0], [10, 0], [5, 0], [5, 10]), true);
});

test('point-on-segment includes the closed segment', () => {
  assert.equal(E.pointOnSegment([5, 0], [0, 0], [10, 0]), true);
  assert.equal(E.pointOnSegment([0, 0], [0, 0], [10, 0]), true);
  assert.equal(E.pointOnSegment([10, 0], [0, 0], [10, 0]), true);
  assert.equal(E.pointOnSegment([11, 0], [0, 0], [10, 0]), false);
  assert.equal(E.pointOnSegment([5, 1], [0, 0], [10, 0]), false);
});

test('coincident nodes are reported', () => {
  const report = emptyReport([[0, 0], [0.2, 0], [10, 10]], []);
  assert.equal(report.valid, false);
  assert.ok(report.conflicts.some(conflict => conflict.type === 'coincident'));
  assert.deepEqual(report.nodeFlags, [true, true, false]);
});

test('a node lying on an unrelated edge is reported', () => {
  const report = emptyReport([[0, 0], [10, 0], [5, 0]], [[0, 1]]);
  assert.equal(report.valid, false);
  assert.ok(report.conflicts.some(conflict => conflict.type === 'node-edge' && conflict.node === 2));
});

test('bounds are checked when supplied', () => {
  const bounds = { minX: 1, maxX: 10, minY: 1, maxY: 10 };
  const report = emptyReport([[0, 5], [5, 5]], [], { bounds });
  assert.equal(report.valid, false);
  assert.deepEqual(report.outOfBounds, [0]);
  const inside = emptyReport([[1, 1], [10, 10]], [], { bounds });
  assert.equal(inside.valid, true);
});

test('a simple triangle without conflicts validates', () => {
  const report = emptyReport([[0, 0], [10, 0], [0, 10]], [[0, 1], [1, 2], [2, 0]]);
  assert.equal(report.valid, true);
  assert.equal(report.count, 0);
});

test('twelve fixed levels are present with valid saved witnesses', () => {
  assert.equal(E.LEVELS.length, 12);
  const signatures = new Set();
  for (const level of E.LEVELS) {
    assert.ok(level.n >= 8 && level.n <= 26, level.name + ' node count');
    assert.equal(level.nodes.length, level.n);
    assert.equal(level.edges.length, level.m);
    const solution = E.validateSolution(level.solution, level.edges, { bounds: E.BOUNDS });
    assert.equal(solution.valid, true, level.name + ' witness');
    assert.equal(solution.count, 0, level.name + ' witness conflicts');
    assert.equal(level.meta.witnessValid, true, level.name + ' witness metadata');
    const start = E.validateSolution(level.start, level.edges, { bounds: E.BOUNDS });
    assert.ok(start.count > 0, level.name + ' must start with a conflict');
    assert.equal(level.meta.initialConflicts, start.count, level.name + ' initial conflict metadata');
    const signature = level.edges
      .map(edge => edge[0] < edge[1] ? edge[0] + '-' + edge[1] : edge[1] + '-' + edge[0])
      .sort()
      .join(',');
    assert.equal(signatures.has(signature), false, level.name + ' repeats another edge set');
    signatures.add(signature);
  }
});

test('fixed starts and solutions keep every node inside the board bounds', () => {
  for (const level of E.LEVELS) {
    for (const point of level.start.concat(level.solution)) {
      assert.ok(point[0] >= E.BOUNDS.minX && point[0] <= E.BOUNDS.maxX, level.name + ' x bounds');
      assert.ok(point[1] >= E.BOUNDS.minY && point[1] <= E.BOUNDS.maxY, level.name + ' y bounds');
    }
  }
});

test('the first two fixed levels are short openings', () => {
  assert.ok(E.LEVELS[0].n <= 10);
  assert.ok(E.LEVELS[1].n <= 10);
  assert.ok(E.LEVELS[0].m >= E.LEVELS[0].n);
  assert.ok(E.LEVELS[1].m >= E.LEVELS[1].n);
});

test('generated graphs are reproducible from a seed', () => {
  const first = E.generate(20261018, 'hard');
  const second = E.generate(20261018, 'hard');
  assert.equal(first.n, second.n);
  assert.equal(first.m, second.m);
  assert.deepEqual(first.edges, second.edges);
  assert.deepEqual(first.start, second.start);
  assert.deepEqual(first.solution, second.solution);
});

test('generated graphs carry a valid witness and a conflicting start', () => {
  const cases = [
    [7, 'medium'],
    [2026, 'hard'],
    [0x5eed, 'expert'],
    [0xffffffff, 'expert']
  ];
  for (const [seed, difficulty] of cases) {
    const graph = E.generate(seed, difficulty);
    assert.ok(graph.n >= 8 && graph.n <= 26, difficulty + ' node count');
    assert.ok(graph.m >= graph.n, difficulty + ' edge count');
    const witness = E.validateSolution(graph.solution, graph.edges, { bounds: E.BOUNDS });
    assert.equal(witness.valid, true, difficulty + ' generated witness');
    assert.equal(graph.meta.witnessValid, true, difficulty + ' generated witness metadata');
    const start = E.validateSolution(graph.start, graph.edges, { bounds: E.BOUNDS });
    assert.ok(start.count > 0, difficulty + ' generated start conflict');
    assert.equal(graph.meta.initialConflicts, start.count);
  }
});

test('different seeds produce different generated edge sets', () => {
  const first = E.generate(11, 'hard');
  const second = E.generate(12, 'hard');
  assert.notDeepEqual(first.edges, second.edges);
});

test('daily dates use Asia/Shanghai midnight boundaries', () => {
  assert.equal(E.shanghaiDateString(new Date('2026-10-18T15:59:59Z')), '2026-10-18');
  assert.equal(E.shanghaiDateString(new Date('2026-10-18T16:00:00Z')), '2026-10-19');
  assert.equal(E.shanghaiDateString(new Date('2026-01-01T00:00:00+08:00')), '2026-01-01');
  assert.equal(E.dateSeed('2026-10-18'), E.dateSeed('2026-10-18'));
  assert.notEqual(E.dateSeed('2026-10-18'), E.dateSeed('2026-10-19'));
});

test('invalid difficulty names are rejected', () => {
  assert.throws(() => E.generate(1, 'impossible'), /Difficulty/);
});

console.log(`\n${passed} checks passed${process.exitCode ? ', with failures' : ''}.`);
