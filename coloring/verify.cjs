'use strict';
const assert = require('node:assert/strict');
const E = require('./engine.js');
let checks = 0;
function ok(value, label) { assert.ok(value, label); checks++; }
function legal(g, colors, q) {
  return Array.isArray(colors) && colors.length === g.n && colors.every(c => Number.isInteger(c) && c >= 0 && c < q) && g.edges.every(([a,b]) => colors[a] !== colors[b]);
}
// Independent set-cover DP is intentionally different from the production solver.
function chromaticDP(n, edges) {
  const independent = new Uint8Array(1 << n); independent[0] = 1;
  const adjacent = new Uint32Array(n), dp = new Uint8Array(1 << n); dp.fill(n + 1); dp[0] = 0;
  for (const [a,b] of edges) { adjacent[a] |= 1 << b; adjacent[b] |= 1 << a; }
  for (let mask = 1; mask < dp.length; mask++) {
    const bit = mask & -mask, rest = mask ^ bit, v = 31 - Math.clz32(bit);
    independent[mask] = independent[rest] && !(adjacent[v] & rest) ? 1 : 0;
    for (let sub = mask; sub; sub = (sub - 1) & mask) if ((sub & bit) && independent[sub]) dp[mask] = Math.min(dp[mask], 1 + dp[mask ^ sub]);
  }
  return dp.at(-1);
}
let graphs = 0;
for (let n = 0; n <= 5; n++) {
  const pairs = []; for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) pairs.push([a,b]);
  for (let mask = 0; mask < (1 << pairs.length); mask++) {
    const edges = pairs.filter((_,i) => mask & (1 << i)), chi = chromaticDP(n, edges);
    for (let q = 0; q <= n + 1; q++) {
      const result = E.findColoring({ n, edges }, q);
      assert.equal(result.status, q >= chi ? 'feasible' : 'infeasible', `n=${n}, q=${q}, mask=${mask}, chi=${chi}`);
      if (result.status === 'feasible') ok(legal({n,edges}, result.colors, q), 'returned coloring is legal');
      checks++;
    }
    graphs++;
  }
}
assert.equal(E.LEVELS.length, 12);
const levels = [];
for (const [i,g] of E.LEVELS.entries()) {
  ok(legal(g, g.solution, g.k), `level ${i+1} saved witness`);
  const result = E.findColoring(g, g.k-1, {maxNodes:10000000});
  assert.equal(result.status, 'infeasible', `level ${i+1} excludes ${g.k-1} colors`); checks++;
  ok(g.positions.length === g.n && g.positions.every(p => p.length === 2 && p.every(Number.isFinite)), 'valid layout');
  levels.push({level:i+1,name:g.name,n:g.n,m:g.edges.length,k:g.k,lowerProofNodes:result.nodes});
}
const hardest = E.LEVELS.find(g => g.n === 23 && g.k === 5);
ok(hardest, '23-vertex five-color challenge exists');
for (const g of E.LEVELS.filter(g => /无三角/.test(g.name))) {
  const adj = E.normalize(g).adjacent;
  for (let a=0;a<g.n;a++) for (let b=a+1;b<g.n;b++) for (let c=b+1;c<g.n;c++) ok(!(adj[a].includes(b) && adj[b].includes(c) && adj[c].includes(a)), `${g.name} has no triangles`);
}
const limited = E.findColoring(hardest, 4, {maxNodes:1});
assert.equal(limited.status, 'unknown', 'budget exhaustion is not infeasibility'); checks++;
const sliced = E.createSearch(hardest, 4, {maxNodes:10000000}); let progress, slices=0;
do { progress = sliced.step(7); slices++; } while (progress.status === 'searching' && slices < 2000000);
assert.equal(progress.status, 'infeasible', 'sliced search reaches same exact result'); checks++;
for (let i=0;i<16;i++) {
  const g = E.generate('verification-'+i, 'hard', {maxNodes:2000000});
  assert.equal(g.status,'verified','generated graph is certified'); checks++;
  ok(legal(g,g.solution,g.k),'generated witness');
  assert.deepEqual(g,E.generate('verification-'+i,'hard',{maxNodes:2000000}),'seed reproducibility'); checks++;
  assert.equal(E.findColoring(g,g.k-1,{maxNodes:10000000}).status,'infeasible','generated lower bound'); checks++;
}
assert.equal(E.shanghaiDateString('2026-10-17T15:59:59Z'),'2026-10-17');
assert.equal(E.shanghaiDateString('2026-10-17T16:00:00Z'),'2026-10-18'); checks+=2;
console.log(JSON.stringify({passed:true,checks,exhaustiveGraphs:graphs,levels,slices},null,2));
