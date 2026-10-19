const assert=require('node:assert/strict');
const E=require('./engine.js');
const AI=require('./ai.js');
// Fixed seeds, both colors for every pair. Use --games=N (even) and --budget=N.
const games=Number(process.argv.find(x=>x.startsWith('--games='))?.split('=')[1]||8);
const baseBudget=Number(process.argv.find(x=>x.startsWith('--budget='))?.split('=')[1]||40);
const stats={};
async function match(a,b,seed){
 const s=E.create(7); let iterations=0,depth=0,elapsed=0,turns=0;
 while(!s.winner){
  const difficulty=s.turn===1?a:b;
  const result=await AI.search({size:7,board:s.board,player:s.turn,difficulty,budgetMs:difficulty==='easy'?Math.min(25,baseBudget):difficulty==='medium'?baseBudget:baseBudget*2,seed:seed+s.moves.length*101});
  assert.ok(E.play(s,result.move),'AI must return legal move');iterations+=result.iterations;depth+=result.depth||0;elapsed+=result.elapsedMs;turns++;
 }
 return {winner:s.winner,iterations,elapsed,depth,turns};
}
(async()=>{
 for(const [a,b] of [['medium','easy'],['high','easy'],['high','medium']]){
  let wins=0,iterations=0,elapsed=0,depth=0,turns=0;
  for(let g=0;g<games;g++){
   const swapped=g%2===1;
   const r=await match(swapped?b:a,swapped?a:b,10007+Math.floor(g/2)*9721);
   wins+=Number(r.winner===(swapped?2:1));iterations+=r.iterations;elapsed+=r.elapsed;depth+=r.depth;turns+=r.turns;
  }
  stats[`${a} vs ${b}`]={wins,games,winRate:wins/games,iterations,simulationsPerSecond:Math.round(iterations/elapsed*1000),meanDepth:Number((depth/turns).toFixed(2)),averageMoveMs:Math.round(elapsed/turns)};
  console.log(JSON.stringify({pair:`${a} vs ${b}`,...stats[`${a} vs ${b}`]}));
 }
 console.log(JSON.stringify({board:7,baseBudgetMs:baseBudget,stats},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
