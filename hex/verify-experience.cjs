const assert=require('node:assert/strict');
const path=require('node:path');
let pw;try{pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');}catch(e){if(process.platform!=='win32')throw e;pw=require('C:/Users/yaozi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const base=process.env.HEX_TEST_URL||'http://127.0.0.1:8782/hex/';
const snap=p=>p.evaluate(()=>HexGame.snapshot());
const ready=p=>p.waitForFunction(()=>window.HexGame);
const settled=p=>p.waitForFunction(()=>!HexGame.snapshot().thinking,null,{timeout:15000});
const move=(p,i)=>p.locator(`[data-index="${i}"]`).click();
let checks=0,browser;
function ok(a,b){assert.ok(a,b);checks++;}function eq(a,b,c){assert.deepEqual(a,b,c);checks++;}
function mockWorker(){
 window.Worker=class{
  postMessage({id,request}){window.hexLastBudget=request.budgetMs;let move=request.action==='choose-opening'?request.candidates[0]:Array.from(request.board).findIndex((v,i)=>v===0&&i%request.size!==0);setTimeout(()=>this.onmessage?.({data:{id,type:'result',result:{move,iterations:1,winRate:.5,elapsedMs:1}}}),1);}
  terminate(){}
 };
}
async function fresh(options={},init){const c=await browser.newContext({locale:'zh-CN',viewport:{width:1280,height:960},...options});if(init)await c.addInitScript(init);const p=await c.newPage();await p.goto(base);await ready(p);return {c,p};}
(async()=>{
 if(!process.argv.includes('--webkit-only')){
 browser=await pw.chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});
 let {c,p}=await fresh({},mockWorker);
 await p.locator('#start-campaign').click();
 for(let id=1;id<=12;id++){
  const size=(await snap(p)).state.size;
  for(let r=0;r<size;r++){await move(p,r*size);if(r===1)await move(p,r*size+1);await settled(p);}
  let s=await snap(p);eq(s.state.winner,1,`level ${id} win settles`);eq(s.progress.levels[id-1].wins,1,`level ${id} record`);
  eq(s.progress.unlocked,Math.min(12,id+1),`level ${id} unlock`);
  eq(s.progress.levels[id-1].last.moves,size,`level ${id} moves recorded`);
  ok(await p.locator('.win-line').count()===1,`level ${id} path rendered`);
  if(id<12)await p.locator('#next').click();
 }
 ok(await p.locator('#final-dialog').evaluate(d=>d.open),'all twelve shows commemorative dialog');
 await p.locator('#close-final').click();
 ok(await p.locator('#memorial').isVisible(),'all twelve memorial');
 await p.reload();await ready(p);eq((await snap(p)).progress.levels.filter(l=>l.wins>0).length,12,'all wins survive reload');
 eq(await p.locator('.level.completed').count(),12,'completed level cards');
 const campaign=JSON.stringify((await snap(p)).progress);
 await p.evaluate(()=>HexGame.startFree(7,'easy'));
 await p.locator('#hint').click();eq(await p.locator('.hint-ring').count(),1,'hint available at opening');
 await move(p,0);await settled(p);await p.locator('#hint').click();
 const hint=await p.evaluate(()=>{
  const ring=document.querySelector('.hint-ring');
  return [...document.querySelectorAll('[data-index]')].find(g=>{const s=g.querySelector('.stone');return s.getAttribute('cx')===ring.getAttribute('cx')&&s.getAttribute('cy')===ring.getAttribute('cy');}).dataset.index;
 });
 await p.locator('#undo').click();await move(p,Number(hint));await settled(p);await p.locator('#hint').click();
 eq(await p.locator('.hint-ring').count(),1,'hint recomputed at same depth after undo');
 await p.locator('#free-analysis').check();
 ok((await snap(p)).analysis.candidates.every(i=>(undefined!==i)&&( (i!==Number(hint)))), 'analysis candidates exclude occupied new move');
 eq(JSON.stringify((await snap(p)).progress),campaign,'free aids leave campaign records unchanged');
 await p.locator('#language-toggle').click();eq(await p.locator('html').getAttribute('lang'),'en','English language');
 ok((await p.title()).includes('Connect'),'translated document title');
 ok((await p.locator('#hint').textContent()).includes('Hint'),'translated action');
 await p.locator('#theme').click();eq(await p.locator('html').getAttribute('data-theme'),'dark','dark theme');
 await p.screenshot({path:path.resolve('.codex/hex/dark-analysis.png'),fullPage:true});
 await p.reload();await ready(p);eq(await p.locator('html').getAttribute('lang'),'en','language preference retained');eq(await p.locator('html').getAttribute('data-theme'),'dark','theme preference retained');
 await p.locator('#start-free').click();
 await p.locator('[data-index="24"]').focus();await p.keyboard.press('ArrowRight');eq(await p.evaluate(()=>document.activeElement.dataset.index),'25','keyboard moves focus');
 await p.keyboard.press('Enter');await settled(p);eq((await snap(p)).state.moves[0],25,'Enter places selected stone');
 await p.keyboard.press('z');eq((await snap(p)).state.moves.length,0,'Z undoes pair');
 await p.keyboard.press(' ');await settled(p);eq((await snap(p)).state.moves.length,2,'Space places stone');
 await p.keyboard.press('r');eq((await snap(p)).state.moves.length,0,'R restarts');
 await p.locator('#menu-button').click();ok(await p.locator('#menu').isVisible(),'return menu');
 await p.locator('#performance-select').selectOption('fast');await p.evaluate(()=>HexGame.startCampaign(1));await move(p,0);await settled(p);
 eq(await p.evaluate(()=>hexLastBudget),55,'fast campaign budget is actually shorter');
 await c.close();
 // A live Worker should leave the main thread available for actual controls.
 ({c,p}=await fresh());await p.evaluate(()=>HexGame.startFree(13,'high'));await move(p,84);
 const before=Date.now();await p.locator('#theme').click();ok(Date.now()-before<1000,'theme responds during high search');
 await p.locator('#restart').click();await p.waitForTimeout(150);eq((await snap(p)).state.moves.length,0,'restart cancels real Worker');await c.close();
 // Main-thread fallback cancellation must also yield and discard its old result.
 ({c,p}=await fresh({viewport:{width:390,height:844},reducedMotion:'reduce'},()=>{window.Worker=function(){throw Error('Unavailable');};}));
 for(let size=7;size<=13;size++){await p.evaluate(n=>HexGame.startFree(n,'easy'),size);eq(await p.locator('[data-index]').count(),size*size,`free size ${size}`);}
 const geometry=await p.locator('[data-index="84"]').boundingBox();ok(geometry.width>=43,'large mobile targets after enlargement');
 await p.evaluate(()=>{window.hexTicks=0;window.hexTickTimer=setInterval(()=>hexTicks++,10);HexGame.startFree(13,'high');});
 await move(p,0);await p.waitForTimeout(70);ok(await p.evaluate(()=>hexTicks)>1,'fallback yields to main event loop');
 await p.locator('#restart').click();await p.waitForTimeout(200);eq((await snap(p)).state.moves.length,0,'restart cancels fallback');
 await p.evaluate(()=>clearInterval(hexTickTimer));
 await p.screenshot({path:path.resolve('.codex/hex/mobile-large.png'),fullPage:true});await c.close();
 // A silent Worker times out and recovers using real local AI.
 ({c,p}=await fresh({},()=>{window.Worker=class{postMessage(){}terminate(){}};}));
 await p.evaluate(()=>HexGame.startFree(7,'easy'));await move(p,0);await settled(p);
 eq((await snap(p)).state.moves.length,2,'silent Worker timeout recovers');eq((await snap(p)).analysis.source,'fallback','timeout uses async fallback');await c.close();
 // Errors in both computing routes still choose a legal tactical recovery move.
 ({c,p}=await fresh({},()=>{window.Worker=function(){throw Error('Unavailable');};}));
 await p.evaluate(()=>{HexAI.search=async()=>{throw Error('Search failed');};HexGame.startFree(7,'easy');});
 await move(p,0);await settled(p);eq((await snap(p)).state.moves.length,2,'both routes failing preserves game');await c.close();
 await browser.close();browser=null;
 console.log(`Hex Edge experience verified: ${checks} checks passed.`);
 }
 // Browser engine emulation is distinct from tests on a physical iPhone/iPad.
 const wk=await pw.webkit.launch({headless:true});browser=wk;
 ({c,p}=await fresh({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}));
 await p.evaluate(()=>HexGame.startFree(7,'easy'));await p.locator('[data-index="0"]').tap();await settled(p);
 eq((await snap(p)).state.moves.length,2,'WebKit touch complete round');
 for(const width of [320,375,390,430,768,1280]){await p.setViewportSize({width,height:920});ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`WebKit no overflow ${width}`);}
 await p.evaluate(()=>HexGame.startFree(13,'easy'));await p.setViewportSize({width:390,height:844});
 const g=await p.locator('[data-index="0"]').boundingBox();ok(g.width>=43,'WebKit large board geometry');
 await c.close();await wk.close();browser=null;
 console.log(`Hex experience verified: ${checks} checks passed.`);
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1;});
