'use strict';
const assert = require('node:assert/strict');
const E = require('./engine.js');
let checks = 0;
const eq = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const ok = (value, label) => { assert.ok(value, label); checks++; };
const board = (w, cells) => ({ w, h: cells.length / w, cells });
const blank = -1;

eq(E.matches(board(2, [0,1,1,0])), [], 'diagonals do not match');
eq(E.matches(board(3, [0,0,0,1,2,1])), [0,1,2], 'all three tiles in a component disappear together');
eq(E.matches(board(3, [0,0,1,2,1,1])), [0,1,2,4,5], 'all matching components resolve simultaneously');
const four = board(2, [0,1,1,0]);
const won = E.apply(four, {type:'swap',a:0,b:1});
ok(won.ok, 'adjacent swap allowed');
eq(won.state.cells, [blank,blank,blank,blank], 'all tiles removed is a win');
eq(four.cells, [0,1,1,0], 'actions do not mutate their input');
ok(!E.apply(four,{type:'swap',a:0,b:3}).ok, 'diagonal swap rejected');
ok(!E.apply(board(2,[0,blank,1,0]),{type:'swap',a:0,b:1}).ok,'empty space cannot be swapped');
const prep = E.apply(board(3,[0,1,2,2,3,0]),{type:'swap',a:0,b:1});
ok(prep.ok, 'preparatory exchange allowed');
eq(prep.removed,0,'a legal exchange need not remove a tile');
// Ordinary exchanges preserve holes. Gravity is a separate action.
const holes = board(3,[0,1,2,blank,2,1,blank,blank,blank]);
const exchanged = E.apply(holes,{type:'swap',a:1,b:2});
eq(exchanged.state.cells.slice(6),[blank,blank,blank],'swap never applies automatic gravity');
const gravity = E.apply(board(2,[0,blank,blank,0,1,2]),{type:'drop'});
ok(gravity.ok,'drop changes floating tiles');
eq(gravity.state.cells,[blank,blank,blank,blank,1,2],'fall creates a match and removes it');
eq(E.apply(gravity.state,{type:'drop'}).ok,false,'unchanged drop is not an action');
const chain = E.apply(board(2,[1,blank,0,1,2,0,blank,2]),{type:'drop'});
ok(chain.ok,'cascade fixture falls');
ok(chain.frames.filter(f=>f.kind==='fall').length>=1,'drop records fall frames');
eq(E.analyze(board(2,[0,1,1,blank])).singletons,[0],'a lone color proves a dead end');
eq(E.analyze(board(2,[blank,blank,blank,blank])).status,'won','only empty board is a win');
eq(E.shanghaiDateString('2026-10-18T15:59:59Z'),'2026-10-18','Beijing before midnight');
eq(E.shanghaiDateString('2026-10-18T16:00:00Z'),'2026-10-19','Beijing midnight');

// Independent reference uses connected-component flood fill and column lists.
function reference(s,action){
 let rows=Array.from({length:s.h},(_,y)=>s.cells.slice(y*s.w,(y+1)*s.w));
 function clear(){
  const visited=new Set(),remove=[];
  for(let y=0;y<s.h;y++)for(let x=0;x<s.w;x++)if(rows[y][x]>=0&&!visited.has(y*s.w+x)){
   const component=[],todo=[[x,y]],color=rows[y][x];visited.add(y*s.w+x);
   while(todo.length){const [a,b]=todo.pop();component.push([a,b]);for(const [u,v] of [[a-1,b],[a+1,b],[a,b-1],[a,b+1]])if(u>=0&&u<s.w&&v>=0&&v<s.h&&rows[v][u]===color&&!visited.has(v*s.w+u)){visited.add(v*s.w+u);todo.push([u,v]);}}
   if(component.length>=2)remove.push(...component);
  }
  remove.forEach(([x,y])=>{rows[y][x]=-1;});return remove.length;
 }
 if(action.type==='swap'){
  const ax=action.a%s.w,ay=Math.floor(action.a/s.w),bx=action.b%s.w,by=Math.floor(action.b/s.w);
  if(action.a<0||action.b<0||action.a>=s.cells.length||action.b>=s.cells.length||Math.abs(ax-bx)+Math.abs(ay-by)!==1||rows[ay][ax]<0||rows[by][bx]<0||rows[ay][ax]===rows[by][bx])return {ok:false,cells:s.cells};
  [rows[ay][ax],rows[by][bx]]=[rows[by][bx],rows[ay][ax]];clear();
 }else{
  while(true){
   for(let x=0;x<s.w;x++){const column=rows.map(row=>row[x]).filter(c=>c>=0);for(let y=0;y<s.h;y++)rows[y][x]=y<s.h-column.length?-1:column[y-(s.h-column.length)];}
   if(!clear())break;
  }
  if(rows.flat().every((c,i)=>c===s.cells[i]))return {ok:false,cells:s.cells};
 }
 return {ok:true,cells:rows.flat()};
}
for(let mask=0;mask<256;mask++){
 const s=board(2,Array.from({length:4},(_,i)=>Math.floor(mask/4**i)%4-1));
 for(const action of [{type:'drop'},...[0,1,2,3].flatMap(a=>[0,1,2,3].map(b=>({type:'swap',a,b})))]){
  const actual=E.apply(s,action),expected=reference(s,action);eq(actual.ok,expected.ok,'exhaustive small-board legality');eq(actual.state.cells,expected.cells,'exhaustive small-board transition');
 }
}
const levels=require('./levels.js');eq(levels.length,12,'twelve fixed levels');
let proofs=0;
function certificate(g){
 let state={w:g.w,h:g.h,cells:g.cells.slice()};ok(!E.matches(state).length,'starts without automatic matches');
 for(const action of g.solution){
  const result=E.apply(state,action),ref=reference(state,action);ok(result.ok&&ref.ok,'certificate action legal');eq(result.state.cells,ref.cells,'independent certificate replay');
  ok(result.state.cells.filter(c=>c>=0).length<=state.cells.filter(c=>c>=0).length,'no action adds tiles');state=result.state;
 }
 ok(state.cells.every(c=>c<0),'certificate clears every tile');proofs++;
}
for(const [i,g] of levels.entries()){certificate(g);if(i>=4)ok(!E.greedy(g),'later levels defeat the immediate-clear greedy strategy');}
const generated=[];const started=Date.now();
for(let seed=0;seed<160;seed++){
 const difficulty=seed%2?'hard':'expert',g=E.generate('verify-'+seed,difficulty);certificate(g);
 eq(g,E.generate('verify-'+seed,difficulty),'deterministic generation');generated.push(g.cells.join(','));
}
ok(new Set(generated).size===generated.length,'sample generated boards are distinct');
console.log(JSON.stringify({passed:true,checks,certificates:proofs,generationVerificationMs:Date.now()-started,levels:levels.map(g=>({name:g.name,tiles:g.meta.tiles,swaps:g.meta.swaps,drops:g.meta.drops}))},null,2));
