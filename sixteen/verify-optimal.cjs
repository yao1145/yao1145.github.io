const assert = require('node:assert/strict'), E = require('./engine.js'), create = require('./optimal.js');
const O = create(E);
// Independent explicit array move oracle.
function oracle(board, m) {
  const a = [...board], out = a.slice();
  if (m.kind === 'row') for (let c=0;c<4;c++) out[4*m.row+(c+m.direction+4)%4]=a[4*m.row+c];
  if (m.kind === 'column') for (let r=0;r<4;r++) out[4*((r+m.direction+4)%4)+m.col]=a[4*r+m.col];
  if (m.kind === 'rotate') for(let r=0;r<2;r++)for(let c=0;c<2;c++) { const nr=m.direction===1?c:1-c,nc=m.direction===1?1-r:r;out[(m.row+nr)*4+m.col+nc]=a[(m.row+r)*4+m.col+c]; }
  return out.join('');
}
(async()=>{
  let draws=0; assert.equal(E.valid(E.randomBoard(()=>{draws++;return 0})),true); assert.equal(draws,15);
  let words=[0,4294967295,0]; for(let i=13;i>0;i--)words.push(0);
  assert.equal(E.valid(E.randomBoard(()=>words.shift())),true); // unbiased rejection at n=15
  assert.equal(words.length,0);
  const seen = new Map([[E.GOAL,0]]); let layer=[E.GOAL];
  for(let d=1;d<=3;d++){const next=[];for(const b of layer)for(const m of E.MOVES){const t=oracle(b,m);if(!seen.has(t)){seen.set(t,d);next.push(t)}}layer=next;}
  const fixtures=[...seen].filter((_,i)=>i%701===0).slice(0,20);
  for(const [board,dist]of fixtures){const result=await O.solve(board);assert.equal(result.optimal,dist);assert.equal(result.solution.reduce((b,id)=>oracle(b,E.MOVES[id]),board),E.GOAL);}
  for(const level of E.LEVELS){const l=await E.generate(level.depth,level.seed);const r=await O.solve(l.board);assert.equal(r.optimal,l.optimal);assert.equal(r.solution.reduce((b,id)=>oracle(b,E.MOVES[id]),l.board),E.GOAL);}
  const controller=new AbortController();let progress=0;
  await assert.rejects(()=>O.solve('HLIMAJOBDCNFGPEK',{signal:controller.signal,onProgress:p=>{progress++;controller.abort()}}),e=>e.name==='AbortError');
  assert.ok(progress>0);
  assert.equal((await O.solve(E.GOAL)).optimal,0);
  const r=await O.solve('HLIMAJOBDCNFGPEK');assert.equal(r.optimal,14);assert.equal(r.solution.reduce((b,id)=>oracle(b,E.MOVES[id]),'HLIMAJOBDCNFGPEK'),E.GOAL);
  const one=E.move(E.GOAL,0);
  assert.equal((await O.findWithin(one,0)).within,false);
  const yes=await O.findWithin(one,4);assert.equal(yes.within,true);assert.ok(yes.length<=4);assert.equal(yes.solution.reduce(E.move,one),E.GOAL);assert.equal(yes.optimal,undefined);
  const no=await O.findWithin('HLIMAJOBDCNFGPEK',12);assert.equal(no.within,false);assert.equal(no.excludedThrough,12);
  assert.equal((await O.findWithin(E.GOAL,0)).within,true);
  await assert.rejects(()=>O.findWithin(one,-1),RangeError);
  await assert.rejects(()=>O.findWithin(one,null),RangeError);
  console.log(`Exact solver passed: ${fixtures.length} independent BFS fixtures, 12 certified levels, arbitrary shuffled board, rejection sampling, cancellation.`);
})().catch(e=>{console.error(e);process.exitCode=1});
