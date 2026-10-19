const assert=require('node:assert/strict');
const E=require('./engine.js'), AI=require('./ai.js');
let checks=0;const eq=(a,b,s)=>{assert.deepEqual(a,b,s);checks++;};const ok=(v,s)=>{assert.ok(v,s);checks++;};
function opening(n=7){const s=E.create(n,{choiceOpening:true});E.play(s,0);E.play(s,n-1);return s;}
(async()=>{
 const fresh=E.create(7,{choiceOpening:true});eq(fresh.opening.phase,'first','opening enabled');
 const s=opening();eq(s.opening.phase,'offer','second red turn requests two candidates');
 ok(!E.play(s,7),'ordinary red move blocked during offer');
 for(const bad of [0,6,-1,49,2.5,'7',null])ok(!E.propose(s,bad),'invalid candidate rejected');
 ok(E.propose(s,7),'first candidate accepted');eq(s.board[7],0,'candidate is not committed');eq(s.moves,[0,6],'proposal does not count as move');
 eq(s.turn,1,'red keeps proposal turn');ok(E.propose(s,7),'tap selected candidate removes it');eq(s.opening.candidates,[],'duplicate not counted twice');
 E.propose(s,7);E.propose(s,8);eq(s.opening.phase,'choose','two distinct candidates trigger AI choice');
 ok(!E.propose(s,9),'third candidate rejected');ok(!E.play(s,9),'normal play blocked pending choice');
 ok(!E.resolveOpening(s,9),'AI cannot choose outside offer');ok(E.resolveOpening(s,7),'AI offered choice accepted');
 eq(s.board[7],1,'chosen point becomes red');eq(s.board[8],0,'unchosen point stays empty');eq(s.moves,[0,6,7],'one actual red stone recorded');eq(s.turn,2,'blue moves after red choice');
 ok(!E.resolveOpening(s,8),'choice cannot be applied twice');ok(E.play(s,5),'normal blue reply accepted');eq(s.turn,1,'ordinary alternation resumes');
 E.undoRound(s);eq(s.moves,[0,6],'undo removes chosen red plus blue reply');eq(s.opening.phase,'offer','undo reopens proposal');eq(s.opening.candidates,[],'undo clears candidates');
 E.propose(s,8);E.undoRound(s);eq(s.moves,[0,6],'undo pending proposal keeps committed pair');eq(s.opening.candidates,[],'pending candidate cancelled');
 E.propose(s,8);E.propose(s,9);E.resolveOpening(s,9);E.undoRound(s);eq(s.opening.phase,'offer','undo before blue reply reopens offer');
 E.undoRound(s);eq(s.moves,[],'undo first completed round');eq(s.opening.phase,'first','empty board reset opening');
 for(let n=7;n<=13;n++){
  const t=opening(n);E.propose(t,n);E.propose(t,n+1);E.resolveOpening(t,n+1);
  while(!t.winner){const i=t.board.findIndex(v=>!v);ok(i>=0,'board ends before full draw');ok(E.play(t,i),'post-opening legal game');}
  eq(t.winner,E.winner(t.board,n),'opening game connectivity');ok(t.path.length>=n,'opening game has winning path');
 }
 for(const difficulty of ['easy','medium','high']){
  const t=opening(), original=Array.from(t.board);
  const result=await AI.search({action:'choose-opening',size:7,board:t.board,candidates:[7,48],difficulty,budgetMs:70,maxIterations:24,seed:4});
  ok([7,48].includes(result.move),`${difficulty} chooses only offered red point`);eq(Array.from(t.board),original,'choice search is pure');
  ok(result.algorithm.includes('choice'),`${difficulty} reports choice search`);
  if(difficulty==='easy')eq(result.move,48,'AI chooses less favorable red connection');
 }
 await assert.rejects(AI.search({action:'choose-opening',size:7,board:opening().board,candidates:[7,7],difficulty:'easy'}));checks++;
 const result=await AI.search({action:'choose-opening',size:13,board:opening(13).board,candidates:[13,14],difficulty:'high',budgetMs:5000},null,()=>true);
 eq(result.move,-1,'cancelled choice returns no move');
 console.log(`Hex choice opening verified: ${checks} checks passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
