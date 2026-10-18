'use strict';
/*
 * Independent checks for flip/engine.js. Run from the repository root:
 *   node flip/verify.cjs
 *   node flip/verify.cjs --full     (complete 4x4 sweep instead of a sampled one)
 */
const E=require('./engine.js');

let checks=0,failures=0;
function ok(condition,label){
  checks++;
  if(!condition){failures++;console.error('  FAIL  '+label);}
}
function eq(got,want,label){ok(got===want,`${label}: got ${got}, want ${want}`);}
function section(name){console.log('\n== '+name+' ==');}

// ---- Independent model of the game -------------------------------------------------
// A mask bit b means the offset (dx,dy) = (b%3-1, floor(b/3)-1) relative to the pressed
// cell. This is re-derived here instead of calling the engine, so the two must agree.
function affected(state,index){
  const mask=state.masks[index],x=index%state.w,y=(index-x)/state.w,out=[];
  for(let bit=0;bit<9;bit++){
    if(!((mask>>bit)&1))continue;
    const nx=x+(bit%3)-1,ny=y+Math.floor(bit/3)-1;
    if(nx>=0&&nx<state.w&&ny>=0&&ny<state.h)out.push(ny*state.w+nx);
  }
  return out;
}
const maskBits=(state,index)=>affected(state,index).reduce((acc,cell)=>acc|(1<<cell),0);
const bit=(dx,dy)=>(dy+1)*3+(dx+1);
function crossMask(w,h,x,y){
  let mask=1<<4;
  for(const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1]]){
    const nx=x+dx,ny=y+dy;
    if(nx>=0&&nx<w&&ny>=0&&ny<h)mask|=1<<bit(dx,dy);
  }
  return mask;
}
function crossMasks(w,h){
  const out=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)out.push(crossMask(w,h,x,y));
  return out;
}

// Breadth-first search from the all-lit position. Pressing is its own inverse, so the
// graph is undirected and this distance is the true minimum number of presses.
function bfsDistance(w,h,masks){
  const n=w*h,total=1<<n,state={w,h,cells:new Array(n).fill(1),masks};
  const toggles=[];
  for(let j=0;j<n;j++)toggles.push(maskBits(state,j));
  const dist=new Int32Array(total).fill(-1),queue=new Int32Array(total);
  let head=0,tail=0;
  dist[total-1]=0;queue[tail++]=total-1;
  while(head<tail){
    const current=queue[head++],next=dist[current]+1;
    for(const t of toggles){const other=current^t;if(dist[other]<0){dist[other]=next;queue[tail++]=other;}}
  }
  return dist;
}

// A second exact solver: BigInt rows, plain subset enumeration, no Gray code.
function popcountBig(value){
  let n=0;
  while(value){value&=value-1n;n++;}
  return n;
}
function independentSolve(state){
  const n=state.w*state.h,rows=[];
  for(let i=0;i<n;i++){
    let row=0n;
    for(let j=0;j<n;j++)if(affected(state,j).includes(i))row|=1n<<BigInt(j);
    if(!state.cells[i])row|=1n<<BigInt(n);
    rows.push(row);
  }
  const coefficients=(1n<<BigInt(n))-1n,rhsBit=1n<<BigInt(n),pivotCols=[];
  let rank=0;
  for(let c=0;c<n&&rank<rows.length;c++){
    let p=-1;
    for(let i=rank;i<rows.length;i++)if((rows[i]>>BigInt(c))&1n){p=i;break;}
    if(p<0)continue;
    const swap=rows[rank];rows[rank]=rows[p];rows[p]=swap;
    for(let i=0;i<rows.length;i++)if(i!==rank&&((rows[i]>>BigInt(c))&1n))rows[i]^=rows[rank];
    pivotCols.push(c);rank++;
  }
  for(const row of rows)if((row&coefficients)===0n&&(row&rhsBit))return {solvable:false};
  const free=[];
  for(let c=0;c<n;c++)if(!pivotCols.includes(c))free.push(c);
  let particular=0n; // eslint-disable-line prefer-const
  pivotCols.forEach((c,r)=>{if(rows[r]&rhsBit)particular|=1n<<BigInt(c);});
  const basis=free.map(f=>{
    let vector=1n<<BigInt(f);
    pivotCols.forEach((c,r)=>{if((rows[r]>>BigInt(f))&1n)vector|=1n<<BigInt(c);});
    return vector;
  });
  if(free.length>20)return {solvable:true,exact:false,nullity:free.length};
  let best=null,bestWeight=Infinity;
  for(let subset=0;subset<(1<<free.length);subset++){
    let vector=particular;
    for(let b=0;b<free.length;b++)if((subset>>b)&1)vector^=basis[b];
    const weight=popcountBig(vector&coefficients);
    if(weight<bestWeight){bestWeight=weight;best=vector&coefficients;}
  }
  const solution=[];
  for(let i=0;i<n;i++)if((best>>BigInt(i))&1n)solution.push(i);
  return {solvable:true,exact:true,optimal:bestWeight,solution,nullity:free.length,solutionCount:2**free.length};
}
function boardFromBits(w,h,masks,bits){
  const n=w*h,cells=[];
  for(let i=0;i<n;i++)cells.push((bits>>i)&1);
  return {w,h,cells,masks};
}

// ---- 1. Mask encoding and pure-function behaviour ----------------------------------
section('Mask encoding and pure functions');
{
  const cross=crossMasks(3,3);
  const state={w:3,h:3,cells:new Array(9).fill(0),masks:cross};
  eq(E.makeMasks(3,3,'cross',()=>0.5).join(','),cross.join(','),'engine cross masks equal hand-built crosses on 3x3');
  eq(E.makeMasks(5,5,'cross',()=>0.5).join(','),crossMasks(5,5).join(','),'engine cross masks equal hand-built crosses on 5x5');
  const centre=affected(state,4).slice().sort((a,b)=>a-b);
  eq(centre.join(','),'1,3,4,5,7','cross at the centre hits up, left, self, right, down');
  const corner=affected(state,0).slice().sort((a,b)=>a-b);
  eq(corner.join(','),'0,1,3','cross at a corner hits self and two neighbours');
  eq(E.toggled(state,4).slice().sort((a,b)=>a-b).join(','),'1,3,4,5,7','engine agrees on the cross shape');
  const one=E.apply(state,{type:'flip',index:4});
  const twice=E.apply(one.state,{type:'flip',index:4});
  eq(twice.state.cells.join(''),state.cells.join(''),'pressing the same cell twice restores the board');
  const orderA=E.apply(E.apply(state,{type:'flip',index:0}).state,{type:'flip',index:8}).state;
  const orderB=E.apply(E.apply(state,{type:'flip',index:8}).state,{type:'flip',index:0}).state;
  eq(orderA.cells.join(''),orderB.cells.join(''),'press order does not matter');
  eq(E.analyze(one.state).dark,4,'the centre press lights five cells of nine');
  ok(!E.apply(state,{type:'flip',index:9}).ok,'out-of-range press is rejected');
  ok(!E.apply(state,{type:'flip'}).ok,'missing action is rejected');
  for(const bad of [
    {w:3,h:3,cells:new Array(9).fill(0),masks:cross.map((m,i)=>i?m:m&~(1<<4))},
    {w:3,h:3,cells:new Array(9).fill(0),masks:cross.map((m,i)=>i?m:m|1)},
    {w:3,h:3,cells:new Array(9).fill(0),masks:cross.map((m,i)=>i?m:600)},
    {w:3,h:3,cells:new Array(8).fill(0),masks:cross},
    {w:3,h:3,cells:new Array(9).fill(2),masks:cross},
    {w:0,h:3,cells:[],masks:[]}
  ]){
    let threw=false;
    try{E.validate(bad);}catch{threw=true;}
    ok(threw,'invalid board is rejected');
  }
}

// ---- 2. Breadth-first truth for 3x3 (complete) and 4x4 (sampled) --------------------
section('Breadth-first search cross-check');
{
  const full=process.argv.includes('--full');
  const stride=full?1:13;
  const seen=new Map();
  for(const level of E.LEVELS){
    if(level.w*level.h>16)continue;
    const key=`${level.w}x${level.h}:${level.masks.join(',')}`;
    if(!seen.has(key))seen.set(key,{w:level.w,h:level.h,masks:level.masks.slice(),label:level.name});
  }
  let compared=0;
  for(const {w,h,masks,label} of seen.values()){
    const dist=bfsDistance(w,h,masks),total=1<<(w*h);
    let worst=0,unreachable=0,mismatch=0;
    for(let bits=0;bits<total;bits+=stride){
      const board=boardFromBits(w,h,masks,bits);
      const result=E.solve(board),truth=dist[bits];
      compared++;
      if(truth<0){
        unreachable++;
        if(result.solvable)mismatch++;
      }else{
        if(!result.solvable||result.optimal!==truth)mismatch++;
        else worst=Math.max(worst,truth);
      }
    }
    ok(mismatch===0,`${w}x${h} "${label}": engine agrees with breadth-first search on every compared state`);
    console.log(`  ${w}x${h} "${label}": ${Math.ceil(total/stride)} of ${total} states compared, ${unreachable} unreachable, longest shortest path ${worst}`);
  }
  ok(compared>0,'breadth-first comparison ran');
}

// ---- 3. The twelve fixed levels -----------------------------------------------------
section('The twelve fixed levels');
{
  eq(E.LEVELS.length,12,'twelve levels');
  const expectedSizes=['3x3','3x3','3x3','3x3','4x4','4x4','4x4','5x5','5x5','5x5','5x5','5x5'];
  const rows=[];
  let multi=0;
  E.LEVELS.forEach((level,index)=>{
    const label=`level ${index+1}`;
    eq(`${level.w}x${level.h}`,expectedSizes[index],`${label} size`);
    const board={w:level.w,h:level.h,cells:level.cells.slice(),masks:level.masks.slice()};
    let valid=true;
    try{E.validate(board);}catch{valid=false;}
    ok(valid,`${label} is a valid board`);
    const report=E.replay(board,level.solution);
    ok(report.valid,`${label} certificate lights every square`);
    eq(report.presses,level.optimal,`${label} certificate length equals the budget`);
    const sorted=level.solution.slice().sort((a,b)=>a-b);
    ok(new Set(sorted).size===sorted.length&&(sorted.length===0||(sorted[0]>=0&&sorted[sorted.length-1]<level.w*level.h)),`${label} certificate has no repeated or out-of-range press`);
    const mine=independentSolve(board);
    ok(mine.solvable,`${label} is solvable`);
    eq(mine.optimal,level.optimal,`${label} optimum agrees with the independent solver`);
    eq(mine.nullity,level.nullity,`${label} kernel dimension agrees`);
    eq(level.solutionCount,2**level.nullity,`${label} solution count is 2^d`);
    eq(level.rank+level.nullity,level.w*level.h,`${label} rank plus kernel dimension equals the number of cells`);
    ok(level.optimal>=1,`${label} needs at least one press`);
    ok(E.analyze(board).status==='playing',`${label} does not start solved`);
    if(level.nullity>0)multi++;
    rows.push([index+1,`${level.w}x${level.h}`,level.meta.style,level.optimal,level.nullity,level.solutionCount,level.meta.dark]);
  });
  console.log('  level  size   ranges        budget  kernel  solutions  dark at start');
  for(const [n,size,style,optimal,nullity,count,dark] of rows){
    console.log(`  ${String(n).padStart(5)}  ${size}  ${style.padEnd(12)}  ${String(optimal).padStart(6)}  ${String(nullity).padStart(6)}  ${String(count).padStart(9)}  ${String(dark).padStart(13)}`);
  }
  ok(multi>=3,`at least three levels have several solutions (found ${multi})`);
  ok(E.LEVELS[0].nullity===0&&E.LEVELS[0].solutionCount===1,'3x3 cross has one solution');
  eq(E.LEVELS[4].nullity,4,'4x4 cross has a 4-dimensional kernel');
  eq(E.LEVELS[4].solutionCount,16,'4x4 cross has 16 solutions');
  eq(E.LEVELS[7].nullity,2,'5x5 cross has a 2-dimensional kernel');
  eq(E.LEVELS[7].solutionCount,4,'5x5 cross has 4 solutions');
  ok(E.LEVELS[11].optimal>=E.LEVELS[0].optimal,`the last level asks for at least as many presses as the first (${E.LEVELS[11].optimal} vs ${E.LEVELS[0].optimal})`);
  ok(Math.max(...E.LEVELS.slice(7).map(level=>level.optimal))>=8,'the 5x5 levels need at least eight presses');
  const shapes=E.LEVELS.map(level=>level.w+'x'+level.h);
  ok(shapes.slice(0,4).every(size=>size==='3x3')&&shapes.slice(7).every(size=>size==='5x5'),'levels grow from 3x3 to 5x5');
}

// ---- 4. Generated boards ------------------------------------------------------------
section('Generated boards');
{
  const seeds=['alpha','beta','gamma','2026-10-18','zzz-91'];
  for(const difficulty of ['gentle','steady','deep','tangled']){
    for(const seed of seeds){
      const first=E.generate(seed,difficulty),second=E.generate(seed,difficulty);
      const same=JSON.stringify([first.cells,first.masks,first.optimal])===JSON.stringify([second.cells,second.masks,second.optimal]);
      ok(same,`${difficulty}/${seed} is deterministic`);
      const board={w:first.w,h:first.h,cells:first.cells.slice(),masks:first.masks.slice()};
      const report=E.replay(board,first.solution);
      ok(report.valid,`${difficulty}/${seed} certificate lights every square`);
      eq(report.presses,first.optimal,`${difficulty}/${seed} certificate length equals the budget`);
      const mine=independentSolve(board);
      eq(mine.optimal,first.optimal,`${difficulty}/${seed} optimum agrees with the independent solver`);
      ok(first.optimal>=1,`${difficulty}/${seed} is not already lit`);
      ok(E.analyze(board).status==='playing',`${difficulty}/${seed} starts unsolved`);
    }
  }
  const a=E.generate('daily:2026-10-18','deep'),b=E.generate('daily:2026-10-18','deep'),c=E.generate('daily:2026-10-19','deep');
  ok(JSON.stringify(a.cells)===JSON.stringify(b.cells)&&JSON.stringify(a.masks)===JSON.stringify(b.masks),'the same daily seed gives the same board');
  ok(JSON.stringify(a.cells)!==JSON.stringify(c.cells)||JSON.stringify(a.masks)!==JSON.stringify(c.masks),'the next day gives a different board');
  const before=E.generate('daily:2026-10-18','deep');
  E.generate('unrelated',1+'');
  const after=E.generate('daily:2026-10-18','deep');
  ok(JSON.stringify(before.cells)===JSON.stringify(after.cells),'the daily board does not depend on other generations');
  const worlds=new Set();
  for(let i=0;i<8;i++)worlds.add(JSON.stringify(E.generate('random:'+i+':seed','steady').cells));
  eq(worlds.size,8,'eight random seeds give eight different boards');
}

// ---- 5. Beijing date ----------------------------------------------------------------
section('Beijing date seeds');
{
  eq(E.shanghaiDateString(new Date('2026-10-18T15:59:59Z')),'2026-10-18','just before midnight in Beijing');
  eq(E.shanghaiDateString(new Date('2026-10-18T16:00:00Z')),'2026-10-19','just after midnight in Beijing');
  eq(E.shanghaiDateString(new Date('2026-01-01T00:00:00Z')),'2026-01-01','UTC morning is the same Beijing date');
  eq(E.shanghaiDateString(new Date('2025-12-31T16:00:00Z')),'2026-01-01','year boundary rolls over in Beijing');
  const now=E.shanghaiDateString();
  ok(/^\d{4}-\d{2}-\d{2}$/.test(now),'today formats as YYYY-MM-DD');
  let threw=false;
  try{E.shanghaiDateString('not a date');}catch{threw=true;}
  ok(threw,'an invalid date is rejected');
}

// ---- 6. Hints from arbitrary positions ----------------------------------------------
section('Solving from a played position');
{
  const level=E.LEVELS[9];
  let board={w:level.w,h:level.h,cells:level.cells.slice(),masks:level.masks.slice()};
  eq(E.solve(board).optimal,level.optimal,'a fresh board solves in the budget');
  const press=E.apply(board,{type:'flip',index:level.solution[0]});
  const remaining=E.solve(press.state);
  ok(remaining.solvable&&remaining.optimal===level.optimal-1,`after the first optimal press the remainder is ${level.optimal-1}`);
  let walked=board,used=0;
  while(true){
    const result=E.solve(walked);
    if(!result.solvable||result.solution.length===0)break;
    walked=E.apply(walked,{type:'flip',index:result.solution[0]}).state;
    used++;
    ok(E.solve(walked).optimal===level.optimal-used,`the optimum drops by exactly one after ${used} presses`);
    if(used>30)break;
  }
  eq(used,level.optimal,'following the first press of each exact solution uses the budget');
  ok(E.analyze(walked).status==='won','that walk lights the whole board');
  // Pressing cell 0 and cell 2 toggles the same pair, and so do cells 1 and 3, so only
  // the pattern (a,b,a,b) can ever be reached. This state needs (0,0,1,0).
  const paired={w:2,h:2,cells:[1,1,0,1],masks:[144,144,18,18]};
  ok(!E.solve(paired).solvable,'a 2x2 board with paired columns can be unsolvable');
  const pairedLit={w:2,h:2,cells:[1,1,1,1],masks:[144,144,18,18]};
  ok(E.solve(pairedLit).solvable&&E.solve(pairedLit).optimal===0,'the lit version of that board needs no press');
  eq(E.toggled(paired,0).slice().sort((a,b)=>a-b).join(','),'0,2','the paired mask hits two cells');
}

console.log(`\n${failures?'FAILED':'OK'}: ${checks-failures}/${checks} checks passed.`);
process.exit(failures?1:0);
