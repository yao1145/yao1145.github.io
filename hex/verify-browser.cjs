const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
let pw;
try {pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');}
catch(e){if(process.platform!=='win32') throw e;pw=require('C:/Users/yaozi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const base=process.env.HEX_TEST_URL||'http://127.0.0.1:8782/hex/';
let checks=0;
const ok=(a,label)=>{assert.ok(a,label);checks++;};
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const snap=p=>p.evaluate(()=>HexGame.snapshot());
const ready=p=>p.waitForFunction(()=>window.HexGame&&typeof HexGame.snapshot==='function');
const settled=p=>p.waitForFunction(()=>!HexGame.snapshot().thinking,null,{timeout:15000});
const cells=p=>p.locator('[data-index]');
let browser;
async function move(p,i){await p.locator(`[data-index="${i}"]`).click();}
async function layout(p,width,height=920){
 await p.setViewportSize({width,height});
 ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`no page overflow at ${width}`);
 const dimensions=await p.evaluate(()=>{const el=document.querySelector('[data-index]');const r=el?.getBoundingClientRect();return r?{w:r.width,h:r.height}:null;});
 ok(dimensions&&dimensions.w>0&&dimensions.h>0,`board visible at ${width}`);
}
(async()=>{
 browser=await pw.chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});
 const context=await browser.newContext({locale:'zh-CN',viewport:{width:1280,height:1000}});
 const page=await context.newPage(), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await ready(page);
 await page.evaluate(()=>HexGame.startCampaign(1));
 eq((await snap(page)).state.size,7,'campaign board');eq(await cells(page).count(),49,'49 hex cells');
 ok(!(await page.locator('#undo').isVisible()),'campaign has no undo');
 ok(!(await page.locator('#free-analysis').isVisible()),'campaign has no analysis');
 await page.locator('[data-index="0"]').focus();await page.keyboard.press('ArrowLeft');
 eq(await page.evaluate(()=>document.activeElement.dataset.index),'0','outward arrow stays at edge');
 await move(page,24);await settled(page);
 eq((await snap(page)).state.moves.length,2,'human and real Worker AI play');
 eq((await snap(page)).state.turn,1,'human turn restored');
 await page.evaluate(()=>HexGame.startCampaign(12));eq((await snap(page)).levelId,1,'locked level rejected');
 await page.evaluate(()=>HexGame.startFree(13,'high'));
 eq(await cells(page).count(),169,'largest free board');
 for(const width of [320,375,390,430,768,1280]) await layout(page,width);
 await layout(page,844,390);
 await page.setViewportSize({width:1280,height:1000});
 await page.evaluate(()=>HexGame.startFree(7,'high'));
 await move(page,0);
 ok((await snap(page)).thinking,'high starts thinking');
 await page.evaluate(()=>HexGame.startFree(9,'easy'));await page.waitForTimeout(500);
 const clean=await snap(page);eq(clean.state.moves.length,0,'stale result ignored');eq(clean.state.size,9,'restart/switch board retained');
 await page.evaluate(()=>HexGame.startFree(7,'easy'));
 // Resolve a whole game using red's direct one-move threat, then connection-cost moves.
 for(let t=0;t<49;t++){
  let state=(await snap(page)).state;if(state.winner)break;
  const index=await page.evaluate(()=>{
   const s=HexGame.snapshot().state,b=Uint8Array.from(s.board);
   for(let i=0;i<b.length;i++)if(!b[i]){b[i]=1;const won=HexEngine.winner(b,s.size)===1;b[i]=0;if(won)return i;}
   for(let i=0;i<b.length;i++)if(!b[i]){b[i]=2;const won=HexEngine.winner(b,s.size)===2;b[i]=0;if(won)return i;}
   return HexEngine.connection(b,s.size,1).path.find(i=>!b[i])??b.findIndex(v=>!v);
  });
  await move(page,index);await settled(page);
  const proposal=(await snap(page)).state.opening;
  if(proposal&&proposal.phase==='offer'&&proposal.candidates.length===1){
   const second=await page.evaluate(()=>{const s=HexGame.snapshot().state;return s.board.findIndex((v,i)=>!v&&!s.opening.candidates.includes(i));});
   await move(page,second);await settled(page);
  }
 }
 ok((await snap(page)).state.winner>0,'complete legal browser game');
 ok((await snap(page)).state.path.length>=7,'winner path displayed');
 ok(await page.locator('#undo').isEnabled(),'free game can undo after result');
 await page.locator('#undo').click();
 eq((await snap(page)).state.winner,0,'undo reopens completed free game');
 await page.screenshot({path:path.resolve('.codex/hex/desktop.png'),fullPage:true});
 eq(errors,[],'no browser runtime errors');
 await context.close();
 // Worker unavailability and blocked storage must preserve playability.
 const fallbackContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await fallbackContext.addInitScript(()=>{window.Worker=function(){throw Error('Workers unavailable');};Object.defineProperty(window,'localStorage',{get(){throw Error('Storage disabled');}});});
 const fallback=await fallbackContext.newPage();await fallback.goto(base);await ready(fallback);
 await fallback.evaluate(()=>HexGame.startFree(7,'easy'));await move(fallback,0);await settled(fallback);
 eq((await snap(fallback)).state.moves.length,2,'async fallback and disabled storage playable');
 await layout(fallback,390,844);
 await fallback.screenshot({path:path.resolve('.codex/hex/mobile.png'),fullPage:true});
 await fallbackContext.close();
 const offline=await browser.newPage();await offline.goto(pathToFileURL(path.resolve('hex/index.html')).href);await ready(offline);
 await offline.evaluate(()=>HexGame.startFree(7,'easy'));await move(offline,0);await settled(offline);
 eq((await snap(offline)).state.moves.length,2,'offline file game plays');await offline.close();
 await browser.close();console.log(`Hex browser verified: ${checks} checks passed.`);
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1;});
