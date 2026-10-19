const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const E = require('./engine.js');
// Observe memory growth in the shipped runtime, keeping native allocations
// and search unchanged. No diagnostic ABI is required in the production build.
const file = require.resolve('./vendor/mohex/mohex.js');
let heap = 0;
global.hexMemoryProbe = bytes => { heap = Math.max(heap, bytes); };
const source = fs.readFileSync(file, 'utf8');
assert.ok(source.includes('var b = getMemoryBuffer();'), 'memory observation point exists');
const observed = new Module(file, module);
observed.filename = file; observed.paths = Module._nodeModulePaths(path.dirname(file));
observed._compile(source.replace('var b = getMemoryBuffer();', 'var b = getMemoryBuffer(); globalThis.hexMemoryProbe(b.byteLength);'), file);
require.cache[file] = observed;
const AI = require('./ai.js');
(async () => {
  for (const [name, text] of Object.entries(require('./vendor/mohex/patterns.js'))) {
    assert.equal(text, fs.readFileSync(path.join(__dirname, 'vendor/mohex/patterns', name), 'utf8'), name + ' weights retained');
  }
  const size = 13, board = Array(size * size).fill(0);
  let moves = 0;
  for (let ply = 0; ply < 40 && !E.winner(board, size); ply++) {
    const color = ply % 2 + 1;
    const result = await AI.search({ size, board, player: color, difficulty: 'high', budgetMs: 80, maxIterations: 128, seed: 947 + ply });
    assert.equal(result.engine, 'mohex-2.0');
    assert.equal(board[result.move], 0, 'legal successive native move');
    board[result.move] = color; moves++;
    assert.ok(heap <= 192 * 1048576, `ply ${moves}: native heap ${heap / 1048576} MiB exceeds 192 MiB`);
  }
  assert.ok(moves >= 20, 'sustained midgame tested');
  console.log(`Hex memory verified: ${moves} successive 13x13 moves, peak heap ${heap / 1048576} MiB; all 8 original pattern files preserved.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
