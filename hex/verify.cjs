const assert = require('node:assert/strict');
const E = require('./engine.js');
const AI = require('./ai.js');
const S = require('./store.js');
let checks = 0;
function ok(condition, label) { assert.ok(condition, label); checks++; }
function eq(actual, expected, label) { assert.deepEqual(actual, expected, label); checks++; }
// Independent connectivity oracle, using coordinates rather than engine neighbors.
function oracle(board, n, color) {
  const seen = new Set(), queue = [];
  for (let k = 0; k < n; k++) {
    const i = color === 1 ? k : k * n;
    if (board[i] === color) { seen.add(i); queue.push(i); }
  }
  for (let p = 0; p < queue.length; p++) {
    const i = queue[p], r = Math.floor(i / n), c = i % n;
    if (color === 1 ? r === n - 1 : c === n - 1) return true;
    for (let rr = Math.max(0,r-1); rr <= Math.min(n-1,r+1); rr++) {
      for (let cc = Math.max(0,c-1); cc <= Math.min(n-1,c+1); cc++) {
        if (Math.abs(rr-r) + Math.abs(cc-c) !== 1 && !((rr-r)*(cc-c) === -1)) continue;
        const j = rr*n+cc;
        if (!seen.has(j) && board[j] === color) { seen.add(j); queue.push(j); }
      }
    }
  }
  return false;
}
function checkPath(board,n,color,path) {
  ok(path.length > 0, 'winner has path');
  ok(color === 1 ? path[0] < n : path[0] % n === 0, 'path starts at own boundary');
  ok(color === 1 ? path.at(-1) >= n*(n-1) : path.at(-1) % n === n-1, 'path ends at opposite boundary');
  for (let k=0;k<path.length;k++) {
    eq(board[path[k]],color,'path uses own stones');
    if(k) ok(E.neighbors(n,path[k-1]).includes(path[k]),'path uses hex adjacency');
  }
}
function rng(seed) { return () => { seed ^= seed<<13; seed ^= seed>>>17; seed ^= seed<<5; return (seed>>>0)/4294967296; }; }
async function main() {
  eq(E.neighbors(7,24).slice().sort((a,b)=>a-b),[17,18,23,25,30,31],'six center neighbors');
  eq(E.neighbors(7,0).slice().sort((a,b)=>a-b),[1,7],'corner two neighbors');
  eq(E.neighbors(7,6).slice().sort((a,b)=>a-b),[5,12,13],'other corner three neighbors');
  for (const n of [2,3]) {
    for(let bits=0;bits<2**(n*n);bits++) {
      const b = Uint8Array.from({length:n*n},(_,i)=>1+((bits>>>i)&1));
      const red=oracle(b,n,1), blue=oracle(b,n,2);
      ok(red !== blue,`full ${n}x${n} has exactly one winner`);
      eq(E.winner(b,n),red?1:2,'winner matches independent flood fill');
    }
  }
  for(let n=7;n<=13;n++) {
    const random=rng(n*11235);
    for(let run=0;run<8;run++) {
      const s=E.create(n); eq(s.board.length,n*n,'all requested sizes initialize');
      const order=Array.from({length:n*n},(_,i)=>i).sort(()=>random()-.5);
      for(const move of order) {
        if(s.winner) break;
        ok(E.play(s,move),'legal move accepted');
        const red=oracle(s.board,n,1),blue=oracle(s.board,n,2);
        eq(s.winner,red?1:blue?2:0,'incremental winner agrees with independent oracle');
        ok(!E.play(s,move),'occupied/terminal move rejected');
      }
      ok(s.winner>0,'complete random game ends with winner');
      checkPath(s.board,n,s.winner,s.path);
      ok(!E.play(s,0),'terminal rejects move');
    }
    const b = new Uint8Array(n*n);
    eq(E.connection(b,n,1).distance,n,'empty red distance');
    eq(E.connection(b,n,2).distance,n,'empty blue distance');
    for(let r=0;r<n;r++) b[r*n+2]=1;
    eq(E.connection(b,n,1).distance,0,'connected red distance zero');
    eq(E.connection(b,n,2).distance,Infinity,'enemy wall impassable');
  }
  const s=E.create(7);
  for(const bad of [-1,49,1.5,NaN,'1',null]) ok(!E.play(s,bad),'invalid index rejected');
  eq(s.moves.length,0,'invalid moves do not mutate');
  E.play(s,0); E.play(s,1); E.play(s,7);
  ok(E.undoRound(s),'pending red undo'); eq(s.moves,[0,1],'pending red only removed'); eq(s.turn,1,'undo restores human turn');
  ok(E.undoRound(s),'completed round undo'); eq(s.moves,[],'round removed'); eq(s.winner,0,'undo winner reset');
  const bridgeBoard=new Uint8Array(49);bridgeBoard[0]=1;bridgeBoard[8]=1;
  const bridge=E.bridges(bridgeBoard,7,1);
  eq(bridge.length,1,'two shared empty carriers form bridge');
  eq(bridge[0].ends,[0,8],'bridge endpoints');eq(bridge[0].cells.slice().sort((a,b)=>a-b),[1,7],'bridge carriers');
  bridgeBoard[1]=2;eq(E.bridges(bridgeBoard,7,1).length,0,'occupied carrier not labeled intact bridge');
  let cancellationChecks=0;
  const cancelled=await AI.search({size:13,board:new Uint8Array(169),player:2,difficulty:'high',budgetMs:6000},null,()=>++cancellationChecks>1);
  eq(cancelled.move,-1,'async search observes cancellation');ok(cancelled.elapsedMs<1000,'cancellation returns promptly');
  for(const difficulty of ['easy','medium','high']) {
    const b = new Uint8Array(49); for(let c=0;c<6;c++) b[c]=2;
    const original=Array.from(b);
    const win=await AI.search({size:7,board:b,player:2,difficulty,budgetMs:40,maxIterations:48,seed:12});
    eq(win.move,6,`${difficulty} takes immediate win`); eq(Array.from(b),original,'AI input preserved');
    const threat=new Uint8Array(49); for(let r=0;r<6;r++) threat[r*7]=1;
    const block=await AI.search({size:7,board:threat,player:2,difficulty,budgetMs:40,maxIterations:48,seed:12});
    eq(block.move,42,`${difficulty} blocks immediate loss`);
    const b2=E.create(7).board; b2[24]=1;
    const answer=await AI.search({size:7,board:b2,player:2,difficulty,budgetMs:70,maxIterations:96,seed:42});
    ok(Number.isInteger(answer.move) && b2[answer.move]===0,`${difficulty} legal search result`);
    ok(typeof answer.algorithm==='string',`${difficulty} reports actual algorithm`);
    if(difficulty!=='easy') ok(answer.iterations>0,`${difficulty} actually simulates`);
    console.log(`${difficulty}: ${answer.algorithm}, ${answer.iterations} iterations, ${Math.round(answer.elapsedMs)} ms`);
    const terminal=new Uint8Array(49).fill(1);
    eq((await AI.search({size:7,board:terminal,player:2,difficulty,budgetMs:10})).move,-1,'terminal search no move');
  }
  const storeData=new Map(); global.localStorage={getItem:k=>storeData.get(k)||null,setItem:(k,v)=>storeData.set(k,v)};
  let p=S.load(); eq(p.unlocked,1,'only first level unlocked'); eq(S.LEVELS.length,12,'twelve levels');
  S.begin(p,2); eq(p.levels[1].attempts,0,'locked attempt rejected');
  for(let id=1;id<=12;id++) {
    S.begin(p,id); S.finish(p,id,{won:false,moves:20,durationMs:1000,aiMs:500}); eq(p.unlocked,id,'loss does not unlock');
    S.begin(p,id); S.finish(p,id,{won:true,moves:18,durationMs:900,aiMs:400});
    eq(p.unlocked,Math.min(12,id+1),'win unlocks next');
  }
  eq(S.completed(S.load()),12,'all completion records persist');
  eq(S.load().levels[11].attempts,2,'attempts persist');
  storeData.set('yaozi.hex.progress.v1','{"version":1,"unlocked":12,"levels":[]}');
  eq(S.load().unlocked,1,'tampered counter cannot unlock campaign');
  storeData.set('yaozi.hex.progress.v1','bad json'); eq(S.load().version,1,'corrupt save recovered');
  global.localStorage={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
  p=S.load(); S.begin(p,1); S.finish(p,1,{won:true,moves:7,durationMs:100,aiMs:20});
  eq(S.load().unlocked,2,'in-memory progress when storage unavailable');
  S.saveSettings({motion:'off',performance:'fast',analysis:true}); eq(S.loadSettings().performance,'fast','memory settings');
  console.log(`Hex verified: ${checks} checks passed.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
