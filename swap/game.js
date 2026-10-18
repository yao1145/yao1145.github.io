(() => {
  'use strict';
  const E=window.SwapEngine,LEVELS=window.SwapLevels,$=id=>document.getElementById(id);
  if(!E||!LEVELS){$('level-title').textContent='游戏未能加载，请重新打开页面。';return;}
  const KEY='yaozi.swap.progress.v1',MOTION_KEY='yaozi.swap.motion';
  const shapes=['●','▲','◆','✚'],names=['玫红圆形','绿色三角','橙色菱形','蓝色十字'];
  const star='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.5 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.4l6.2-.9Z"/></svg>';
  let storageAvailable=true,records=Array.from({length:12},()=>({won:false,best:null}));
  try{const raw=JSON.parse(localStorage.getItem(KEY));if(raw?.version===1&&Array.isArray(raw.levels))records=records.map((_,i)=>{const item=raw.levels[i],b=item?.best;return {won:item?.won===true,best:b&&Number.isInteger(b.swaps)&&b.swaps>=0&&Number.isInteger(b.drops)&&b.drops>=0?{swaps:b.swaps,drops:b.drops}:null};});}catch{}
  try{localStorage.setItem(KEY+'.probe','1');localStorage.removeItem(KEY+'.probe');}catch{storageAvailable=false;$('storage-note').hidden=false;}
  const systemMotion=matchMedia('(prefers-reduced-motion:reduce)');let motionPreference=null;
  try{const v=localStorage.getItem(MOTION_KEY);if(['0','80','180'].includes(v))motionPreference=v;}catch{}
  $('motion').value=motionPreference??(systemMotion.matches?'0':'180');
  let puzzle,state,initial,mode='level',levelIndex=0,selected=null,focusIndex=0,swaps=0,drops=0,history=[],status='playing';
  let animating=false,animationEpoch=0,generating=false,generationEpoch=0,worker=null,workerCancel=null,randomCount=0,dailyDate=null,generationPath=null;
  const cells=[],levelButtons=[],starSlots=[];
  function save(){try{localStorage.setItem(KEY,JSON.stringify({version:1,levels:records}));}catch{storageAvailable=false;$('storage-note').hidden=false;}}
  const coordinate=i=>String.fromCharCode(65+i%state.w)+(Math.floor(i/state.w)+1);
  function message(title,text,tone){$('message-title').textContent=title;$('message-text').textContent=text;$('message').classList.toggle('won',tone==='won');$('message').classList.toggle('error',tone==='stuck');}
  function cancelAnimation(){animationEpoch++;animating=false;for(const animation of $('animation-layer').getAnimations({subtree:true}))animation.cancel();$('animation-layer').replaceChildren();}
  function stopGeneration(){generationEpoch++;generating=false;if(workerCancel)workerCancel();workerCancel=null;if(worker)worker.terminate();worker=null;$('busy').hidden=true;}
  function collection(){const count=records.filter(r=>r.won).length;$('star-count').textContent=count+' / 12';$('progress-label').textContent='已通关 '+count+' / 12';$('collection').classList.toggle('complete',count===12);$('collection-note').textContent=count===12?'十二张棋盘全部清空。十二颗星，属于你。':'每关首次清空，点亮一颗星。';records.forEach((r,i)=>{starSlots[i].classList.toggle('earned',r.won);starSlots[i].setAttribute('aria-label',`第 ${i+1} 关${r.won?'已通关':'未通关'}`);levelButtons[i].classList.toggle('done',r.won);levelButtons[i].setAttribute('aria-pressed',String(mode==='level'&&levelIndex===i));});}
  function award(){if(status!=='won'||mode!=='level')return;const record=records[levelIndex],best=record.best;record.won=true;if(!best||swaps+drops<best.swaps+best.drops||(swaps+drops===best.swaps+best.drops&&drops<best.drops))record.best={swaps,drops};save();collection();}
  function loadPuzzle(next,nextMode,index=null,date=null){
    stopGeneration();cancelAnimation();puzzle=JSON.parse(JSON.stringify(next));state=E.clone(next);initial=E.clone(state);mode=nextMode;levelIndex=index;dailyDate=date;selected=null;focusIndex=0;swaps=0;drops=0;history=[];status=E.analyze(state).status;
    $('level-title').textContent=mode==='level'?`第 ${index+1} 关 · ${puzzle.name}`:mode==='daily'?`每日一局 · ${date}`:'随机挑战';$('board-meta').textContent=`${state.w} × ${state.h} · ${puzzle.palette} 色`;
    buildBoard();render();collection();
  }
  function loadLevel(index){if(!Number.isInteger(index)||!LEVELS[index])return false;generationPath=null;loadPuzzle(LEVELS[index],'level',index);return true;}
  function buildBoard(){
    cells.length=0;$('board').replaceChildren();$('board').style.setProperty('--cols',state.w);
    for(let i=0;i<state.cells.length;i++){
      const button=document.createElement('button');button.type='button';button.className='cell';button.dataset.index=i;button.id='cell-'+i;
      button.addEventListener('click',()=>choose(i));button.addEventListener('focus',()=>{focusIndex=i;roving();});
      button.addEventListener('keydown',event=>{if(event.ctrlKey||event.metaKey||event.altKey)return;const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(direction){event.preventDefault();const x=i%state.w+direction[0],y=Math.floor(i/state.w)+direction[1];if(x>=0&&x<state.w&&y>=0&&y<state.h)cells[y*state.w+x].focus();}});
      cells.push(button);$('board').append(button);
    }
  }
  function roving(){cells.forEach((cell,i)=>{cell.tabIndex=i===focusIndex?0:-1;});}
  function draw(boardCells){
    const adjacent=selected===null?[]:E.neighbors(state,selected);
    cells.forEach((cell,i)=>{const c=boardCells[i];cell.replaceChildren();cell.classList.toggle('empty',c<0);cell.classList.toggle('adjacent',c>=0&&adjacent.includes(i)&&!animating);cell.setAttribute('aria-pressed',String(selected===i));cell.setAttribute('aria-label',`${coordinate(i)}，${c<0?'空格':names[c]}`);if(c>=0){const tile=document.createElement('span');tile.className='tile tile-'+c;tile.textContent=shapes[c];tile.setAttribute('aria-hidden','true');cell.append(tile);}});roving();
  }
  function render(){
    if(!state)return;const info=E.analyze(state);status=info.status;draw(state.cells);$('remaining').textContent=info.remaining;$('total').textContent='/ '+initial.cells.filter(c=>c>=0).length;$('operations').textContent=swaps+drops;$('swaps').textContent=swaps;$('drops').textContent=drops;
    $('board').classList.toggle('won',status==='won');$('board').setAttribute('aria-busy',String(animating||generating));$('drop').disabled=animating||generating||status!=='playing'||!E.apply(state,{type:'drop'}).ok;$('undo').disabled=history.length===0&&!generating;
    $('next').hidden=!(status==='won'&&mode==='level'&&levelIndex<11);$('selection-note').textContent=selected===null?'点选两块相邻方块，交换位置。':`已选 ${coordinate(selected)} · 再点相邻方块交换；点一次已选方块可取消。`;
    $('color-counts').replaceChildren();for(let c=0;c<puzzle.palette;c++){const counter=document.createElement('span');counter.className='color-counter'+(info.counts[c]===1?' single':info.counts[c]===0?' zero':'');counter.innerHTML=`<i class="tile-${c}" aria-hidden="true">${shapes[c]}</i><span>${info.counts[c]}</span>`;counter.setAttribute('aria-label',`${names[c]}剩余 ${info.counts[c]} 块`);$('color-counts').append(counter);}
    const best=mode==='level'?records[levelIndex].best:null;$('best').textContent=best?`${best.swaps+best.drops} 次（${best.swaps} 换 · ${best.drops} 落）`:'—';
    if(generating)return;
    if(status==='won')message('全部清空！',mode==='level'?`第 ${levelIndex+1} 关完成，共 ${swaps} 次交换、${drops} 次下落。`:`本局完成，共 ${swaps} 次交换、${drops} 次下落。每日与随机不计入十二星。`,'won');
    else if(status==='stuck')message('这个残局无法清空',info.singletons.length?`${info.singletons.map(c=>names[c]).join('、')}只剩一块。撤销最近的操作，给它留一位同伴。`:'剩余方块已经无法交换或下落。可以撤销，换一种安排。','stuck');
    else message(history.length?'继续为残局留路':'为残局留一手',selected===null?'同色相邻就会消除。空洞会保留，按“下落”才会重新压实。':'可以先做预备交换。下落之前，先看清哪些颜色会碰面。');
  }
  function choose(i){
    if(animating||generating||status!=='playing')return;
    if(state.cells[i]<0){message('空格不能交换','请点选两块上下或左右相邻的方块。');return;}
    if(selected===i){selected=null;render();return;}
    if(selected!==null&&E.neighbors(state,selected).includes(i)){const a=selected;selected=null;play({type:'swap',a,b:i});return;}
    selected=i;focusIndex=i;render();
  }
  async function frameAnimation(frame,token){
    draw(frame.before);const duration=Number($('motion').value);if(!duration||!Element.prototype.animate){draw(frame.after);return;}
    const layer=$('animation-layer'),bounds=$('board-wrap').getBoundingClientRect(),animations=[];
    const moves=frame.kind==='remove'?frame.indices.map(i=>({from:i,to:i,color:frame.before[i]})):frame.moves;
    for(const move of moves){const from=cells[move.from].getBoundingClientRect(),to=cells[move.to].getBoundingClientRect(),ghost=document.createElement('span');ghost.className='ghost tile tile-'+move.color;ghost.textContent=shapes[move.color];Object.assign(ghost.style,{left:(from.left-bounds.left)+'px',top:(from.top-bounds.top)+'px',width:from.width+'px',height:from.height+'px'});layer.append(ghost);if(cells[move.from].firstChild)cells[move.from].firstChild.style.visibility='hidden';
      const keyframes=frame.kind==='remove'?[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.4)'}]:[{transform:'translate(0,0)'},{transform:`translate(${to.left-from.left}px,${to.top-from.top}px)`}];
      animations.push(ghost.animate(keyframes,{duration:frame.kind==='remove'?duration*.65:duration,easing:'cubic-bezier(.2,.7,.3,1)',fill:'forwards'}));
    }
    await Promise.allSettled(animations.map(a=>a.finished));if(token!==animationEpoch)return;layer.replaceChildren();draw(frame.after);
  }
  async function play(action){
    if(animating||generating||status!=='playing')return;
    const result=E.apply(state,action);if(!result.ok){selected=null;render();return;}
    history.push({state:E.clone(state),swaps,drops});state=result.state;if(action.type==='swap')swaps++;else drops++;selected=null;status=E.analyze(state).status;award();
    const token=++animationEpoch;animating=true;render();
    for(const frame of result.frames){if(token!==animationEpoch)return;await frameAnimation(frame,token);}
    if(token!==animationEpoch)return;animating=false;render();
  }
  function undo(){stopGeneration();cancelAnimation();const entry=history.pop();if(entry){state=entry.state;swaps=entry.swaps;drops=entry.drops;}selected=null;render();}
  function restart(){stopGeneration();cancelAnimation();state=E.clone(initial);swaps=0;drops=0;history=[];selected=null;render();}
  function fromWorker(seed,difficulty,id){return new Promise(resolve=>{let w;try{w=new Worker('worker.js');}catch{resolve(null);return;}worker=w;const finish=value=>{w.terminate();if(worker===w)worker=null;if(workerCancel===cancel)workerCancel=null;resolve(value);},cancel=()=>finish(null);workerCancel=cancel;w.onerror=event=>{event.preventDefault();finish(null);};w.onmessage=event=>{const data=event.data;if(data.id!==id||id!==generationEpoch)return;if(data.type==='result')finish(data.puzzle);else if(data.type==='error')finish(null);};w.postMessage({id,seed,difficulty});});}
  async function fallback(seed,difficulty,id){const iterator=E.generateSteps(seed,difficulty);while(id===generationEpoch){const step=iterator.next();if(step.done)return step.value;await new Promise(resolve=>setTimeout(resolve,0));}return null;}
  async function generate(nextMode){
    stopGeneration();cancelAnimation();const id=generationEpoch;generating=true;selected=null;$('busy').hidden=false;$('busy-text').textContent='正在构造并验证可清空的棋盘…';render();
    const date=E.shanghaiDateString(),seed=nextMode==='daily'?'swap-daily:'+date:'swap-random:'+Date.now()+':'+(++randomCount)+':'+Math.random();
    const difficulty=nextMode==='daily'?(Number(date.slice(-2))%2?'hard':'expert'):(randomCount%2?'hard':'expert');
    try{let next=await fromWorker(seed,difficulty,id);if(id!==generationEpoch)return;let path='worker';if(!next){path='fallback';next=await fallback(seed,difficulty,id);}if(id!==generationEpoch)return;if(!next||!E.replay(next,next.solution).valid)throw new Error('Invalid generated certificate');loadPuzzle(next,nextMode,null,nextMode==='daily'?date:null);generationPath=path;}
    catch(error){if(id===generationEpoch){generating=false;$('busy').hidden=true;render();message('这张棋盘生成未完成','请重试，或选择固定关卡继续。');}}
  }
  LEVELS.forEach((g,i)=>{const slot=document.createElement('div');slot.className='star-slot';slot.setAttribute('role','listitem');slot.innerHTML=star+`<span>${i+1}</span>`;$('star-shelf').append(slot);starSlots.push(slot);const b=document.createElement('button');b.className='level';b.type='button';b.dataset.level=i;b.innerHTML=`<span class="level-number">${i+1}</span><span class="level-main"><b>${g.name}</b><small>${g.w} × ${g.h} · ${g.meta.tiles} 块</small></span><span class="level-star">${star}</span>`;b.addEventListener('click',()=>loadLevel(i));$('levels').append(b);levelButtons.push(b);});
  $('drop').addEventListener('click',()=>play({type:'drop'}));$('undo').addEventListener('click',undo);$('restart').addEventListener('click',restart);$('next').addEventListener('click',()=>loadLevel(levelIndex+1));$('daily').addEventListener('click',()=>generate('daily'));$('random').addEventListener('click',()=>generate('random'));$('cancel').addEventListener('click',()=>{stopGeneration();render();message('已取消生成','可以继续当前棋盘，或选择其他关卡。');});
  $('motion').addEventListener('change',()=>{motionPreference=$('motion').value;try{localStorage.setItem(MOTION_KEY,motionPreference);}catch{}cancelAnimation();render();});systemMotion.addEventListener('change',event=>{if(motionPreference===null){$('motion').value=event.matches?'0':'180';cancelAnimation();render();}});
  window.addEventListener('resize',()=>{if(animating){cancelAnimation();render();}});document.addEventListener('visibilitychange',()=>{if(document.hidden&&animating){cancelAnimation();render();}});
  document.addEventListener('keydown',event=>{if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))return;const key=event.key.toLowerCase();if(key==='z'){event.preventDefault();undo();}else if(key==='r'){event.preventDefault();restart();}else if(key==='g'){event.preventDefault();play({type:'drop'});}});
  let themePreference=null;try{themePreference=localStorage.getItem('yaozi.home.theme');}catch{}
  function theme(value){document.documentElement.dataset.theme=value;document.querySelector('meta[name="theme-color"]').content=value==='dark'?'#0d1826':'#edf3f9';$('theme').setAttribute('aria-label',value==='dark'?'切换至浅色模式':'切换至深色模式');}
  theme(document.documentElement.dataset.theme);$('theme').addEventListener('click',()=>{themePreference=document.documentElement.dataset.theme==='dark'?'light':'dark';theme(themePreference);try{localStorage.setItem('yaozi.home.theme',themePreference);}catch{}});matchMedia('(prefers-color-scheme:dark)').addEventListener('change',event=>{if(!['light','dark'].includes(themePreference))theme(event.matches?'dark':'light');});
  window.SwapGame=Object.freeze({loadLevel,ready:()=>!!state&&!animating&&!generating,snapshot:()=>JSON.parse(JSON.stringify({state,initial,mode,levelIndex,selected,swaps,drops,historyLength:history.length,status,animating,generating,stars:records.map(r=>r.won),records,seed:puzzle?.seed,difficulty:puzzle?.difficulty,dailyDate,generationPath,storageAvailable}))});
  loadLevel(0);
})();
