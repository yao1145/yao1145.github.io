/* Verify Crown Tour's fixed certificates and a sample of generated boards. */
'use strict';
const assert = require('node:assert/strict');
const E = require('./engine.js');
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
function tour(w, h, path, start, end, label) {
  check(E.verifyTour(w, h, path, { start, end }), `${label}: valid open knight tour`);
  check(path.length === w * h, `${label}: visits every square`);
  check(new Set(path).size === w * h, `${label}: visits each square once`);
  if ((w * h) % 2 === 1) {
    check(((start % w + Math.floor(start / w)) & 1) === 0, `${label}: odd board starts on the majority colour`);
  }
}
const rectangles = new Set();
for (const [index, level] of E.LEVELS.entries()) {
  const label = `level ${index + 1} (${level.name})`;
  tour(level.w, level.h, level.solution, level.start, level.end, label);
  rectangles.add(`${level.w}x${level.h}`);
  check(level.solution[0] === level.start, `${label}: certificate starts on the declared square`);
  if (level.end !== null) check(level.solution.at(-1) === level.end, `${label}: certificate ends on the throne`);
  const cut = Math.max(1, Math.floor(level.solution.length / 2));
  const extension = E.extend(level.w, level.h, level.solution.slice(0, cut), {
    end: level.end, seed: 0x1234, nodeLimit: 1000000
  });
  check(extension.solution && extension.solution.length === level.w * level.h,
    `${label}: solver extends the first ${cut} steps to a complete tour`);
}
for (let w = 5; w <= 8; w++) for (let h = w; h <= 8; h++) {
  check(rectangles.has(`${w}x${h}`), `all rectangle sizes are represented: ${w}x${h}`);
}
const neighbourChecks = [[5, 5], [5, 8], [6, 7], [7, 8], [8, 8]];
for (const [w, h] of neighbourChecks) {
  for (let from = 0; from < w * h; from++) {
    const list = E.neighbors(from, w, h);
    check(list.every(to => E.isKnightMove(from, to, w, h)), `${w}x${h}: neighbours are knight moves`);
    check(new Set(list).size === list.length, `${w}x${h}: neighbours are unique`);
    for (let to = 0; to < w * h; to++) {
      if (E.isKnightMove(from, to, w, h)) check(list.includes(to), `${w}x${h}: knight move ${from}->${to} is listed`);
    }
  }
}
for (let seed = 1; seed <= 250; seed++) {
  const generated = E.generate((seed * 2654435761) >>> 0);
  check(!!generated, `generator returns a board for seed ${seed}`);
  tour(generated.w, generated.h, generated.solution, generated.start, null, `generated seed ${seed}`);
  check(generated.end === null, `generated seed ${seed}: open tour`);
}
const first = E.generate(0xC0FFEE), second = E.generate(0xC0FFEE);
check(JSON.stringify(first) === JSON.stringify(second), 'generator is deterministic');
check(E.dailyKey(new Date('2026-10-17T12:00:00Z')) === '2026-10-17', 'daily key uses the Asia/Shanghai date');
check(E.dailySeed() === E.dailySeed(), 'daily seed is stable within a run');
console.log(`Crown Tour verified: ${E.LEVELS.length} levels, ${checks} checks, 250 generated boards.`);
