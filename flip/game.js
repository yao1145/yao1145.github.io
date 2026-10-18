(() => {
  'use strict';
  const E=window.FlipEngine,$=id=>document.getElementById(id),tr=window.GameLocale?.t||(value=>value);
  if(!E){$('level-title').textContent='游戏未能加载，请重新打开页面。';return;}
  const LEVELS=E.LEVELS,KEY='yaozi.flip.progress.v1',MOTION_KEY='yaozi.flip.motion';
  const DAILY_ORDER=['steady','deep','tangled','steady','tangled','deep','deep','steady'],RANDOM_ORDER=['steady','deep','tangled'];
  const star='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.5 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.4l6.2-.9Z"/></svg>';
  let storageAvailable=true,records=Array.from({length:12},()=>({won:false,best:null}));
  try{
    const raw=JSON.parse(localStorage.getItem(KEY));
    if(raw&&raw.version===1&&Array.isArray(raw.levels))records=records.map((_,i)=>{const item=raw.levels[i],best=item?.best;return {won:item?.won===true,best:Number.isInteger(best)&&best>=0?best:null};});
  }catch{}
  try{localStorage.setItem(KEY+'.probe','1');localStorage.removeItem(KEY+'.probe');}catch{storageAvailable=false;$('storage-note').hidden=false;}
  const systemMotion=matchMedia('(prefers-reduced-motion:reduce)');
  let motionPreference=null;
  try{const stored=localStorage.getItem(MOTION_KEY);if(['0','80','180'].includes(stored))motionPreference=stored;}catch{}
  $('motion').value=motionPreference??(systemMotion.matches?'0':'180');

  let puzzle=null,state=null,initial=null,mode='level',levelIndex=0,budget=0,moves=0,history=[],status='playing',hintIndex=null;
  let animating=false,animationTimer=0,generating=false,generationEpoch=0,randomCount=0,dailyDate=null,generationPath=null,focusIndex=0;
  const cells=[],levelButtons=[],starSlots=[];

  const bits=mask=>{let n=0;for(let bit=0;bit<9;bit++)if(mask&(1<<bit))n++;return n;};
  const coordinate=i=>String.fromCharCode(65+i%state.w)+(Math.floor(i/state.w)+1);
  function save(){try{localStorage.setItem(KEY,JSON.stringify({version:1,levels:records}));}catch{storageAvailable=false;$('storage-note').hidden=false;}}
  let currentMessage=['每一格都有自己的作用范围','按下之前，先看清格子里的小图。',null];
  function message(title,text,tone){
    currentMessage=[title,text,tone||null];
    $('message-title').textContent=tr(title);
    $('message-text').textContent=tr(text);
    $('message').classList.toggle('won',tone==='won');
    $('message').classList.toggle('error',tone==='won'?false:!!tone);
  }
  function stopAnimation(){
    if(animationTimer)clearTimeout(animationTimer);
    animationTimer=0;animating=false;
    $('board').querySelectorAll('.pulse,.pressed').forEach(node=>node.classList.remove('pulse','pressed'));
  }
  function stopGeneration(){
    generationEpoch++;generating=false;$('busy').hidden=true;
    return generationEpoch;
  }
  function syncMotion(){
    const duration=Number($('motion').value)||0;
    $('board').style.setProperty('--flash',duration+'ms');
    return duration;
  }
  function clearHint(){if(hintIndex!==null&&cells[hintIndex])cells[hintIndex].classList.remove('hinted');hintIndex=null;}
  function showHint(index){clearHint();hintIndex=index;if(cells[index])cells[index].classList.add('hinted');}
  function collection(){
    const count=records.filter(record=>record.won).length;
    $('star-count').textContent=count+' / 12';
    $('progress-label').textContent=tr('已通关 ')+count+' / 12';
    $('collection').classList.toggle('complete',count===12);
    $('collection-note').textContent=tr(count===12?'十二关全部全亮，十二颗星属于你。':'每关首次全亮，点亮一颗星。');
    records.forEach((record,index)=>{
      const slot=starSlots[index],button=levelButtons[index];
      if(slot){
        slot.classList.toggle('earned',record.won);
        slot.setAttribute('aria-label',tr(`第 ${index+1} 关${record.won?'已通关':'未通关'}`));
      }
      if(button){
        button.classList.toggle('done',record.won);
        button.setAttribute('aria-pressed',String(mode==='level'&&levelIndex===index));
        const label=button.querySelector('.level-main b'),note=button.querySelector('.level-main small');
        if(label)label.textContent=tr(LEVELS[index].name);
        if(note)note.textContent=tr(`${LEVELS[index].w} × ${LEVELS[index].h} · 最优 ${LEVELS[index].optimal} 步`);
      }
    });
  }
  function award(){
    if(status!=='won'||mode!=='level')return;
    const record=records[levelIndex];
    record.won=true;
    if(record.best===null||moves<record.best)record.best=moves;
    save();collection();
  }
  function buildBoard(){
    const board=$('board');
    board.replaceChildren();cells.length=0;
    board.style.setProperty('--cols',state.w);
    board.style.setProperty('--rows',state.h);
    board.dataset.size=state.w+'x'+state.h;
    for(let index=0;index<state.cells.length;index++){
      const x=index%state.w,y=(index-x)/state.w,mask=state.masks[index];
      const button=document.createElement('button');
      button.type='button';button.className='cell';button.id='cell-'+index;
      button.dataset.index=String(index);button.dataset.cell=coordinate(index);
      const diagram=document.createElement('span');
      diagram.className='mask';diagram.setAttribute('aria-hidden','true');
      for(let bit=0;bit<9;bit++){
        if(!(mask&(1<<bit)))continue;
        const dot=document.createElement('i');
        dot.className='on';dot.dataset.bit=String(bit);
        dot.style.gridColumn=String(bit%3+1);
        dot.style.gridRow=String(Math.floor(bit/3)+1);
        diagram.append(dot);
      }
      button.append(diagram);
      button.addEventListener('click',()=>flip(index));
      button.addEventListener('focus',()=>{focusIndex=index;roving();});
      button.addEventListener('keydown',event=>{
        if(event.ctrlKey||event.metaKey||event.altKey)return;
        const step={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
        if(!step)return;
        event.preventDefault();
        const nextX=x+step[0],nextY=y+step[1];
        if(nextX>=0&&nextX<state.w&&nextY>=0&&nextY<state.h)cells[nextY*state.w+nextX].focus();
      });
      cells.push(button);board.append(button);
    }
    roving();
  }
  function roving(){cells.forEach((cell,index)=>{cell.tabIndex=index===focusIndex?0:-1;});}
  function draw(){
    for(let index=0;index<cells.length;index++){
      const lit=state.cells[index]===1,cell=cells[index];
      cell.classList.toggle('lit',lit);
      cell.classList.toggle('dark',!lit);
      cell.setAttribute('aria-label',tr(`${coordinate(index)}，${lit?'已亮':'未亮'}，按下翻转 ${bits(state.masks[index])} 格`));
    }
  }
  function render(){
    if(!state)return;
    syncMotion();
    const info=E.analyze(state);
    draw();
    $('lit-count').textContent=info.lit;
    $('total').textContent=' / '+info.total;
    $('remaining').textContent=Math.max(0,budget-moves);
    $('budget-row').textContent=tr(`最优步数 ${budget}`);
    $('press-row').textContent=tr(`已按 ${moves} 次`);
    $('solutions-row').textContent=tr(puzzle.solutionCount?`解的数量 ${puzzle.solutionCount}`:'解的数量 —');
    const best=mode==='level'?records[levelIndex].best:null;
    $('best-row').textContent=tr(best===null?'本关最佳 —':`本关最佳 ${best} 次`);
    $('board').classList.toggle('won',status==='won');
    $('board').classList.toggle('lost',status==='lost');
    $('board').setAttribute('aria-busy',String(animating||generating));
    $('undo').disabled=history.length===0;
    $('hint').disabled=status!=='playing'||generating;
    $('next').hidden=!(status==='won'&&mode==='level'&&levelIndex<11);
    $('selection-note').textContent=tr(hintIndex===null?hintText():`提示：${coordinate(hintIndex)} 是最少步数解里的一步。`);
    collection();
    if(generating)return;
    if(status==='won')message('全部亮起！',mode==='level'?`第 ${levelIndex+1} 关完成，按了 ${moves} 次，最优 ${budget} 步。`:`本局按了 ${moves} 次，最优 ${budget} 步，每日与随机不计入十二星。`,'won');
    else if(status==='lost')message('预算用完了',`按满 ${budget} 次仍未全亮，本题无法再完成。撤销几步，或重开本题。`,'lost');
    else if(moves>0)message('继续点亮',`还剩 ${info.dark} 格未亮，预算还剩 ${budget-moves} 步。`);
    else message('每一格都有自己的作用范围','按下之前，先看清格子里的小图。');
  }
  function hintText(){
    return moves===0?'格子里的小图，就是这一格的作用范围。':`还剩 ${budget-moves} 步预算。按错了就撤销。`;
  }
  function loadPuzzle(next,nextMode,index=null,date=null){
    stopGeneration();stopAnimation();
    puzzle=JSON.parse(JSON.stringify(next));
    state=E.clone(next);initial=E.clone(state);
    mode=nextMode;levelIndex=index;dailyDate=date;moves=0;history=[];status='playing';focusIndex=0;
    budget=puzzle.optimal;
    clearHint();
    $('level-title').textContent=tr(mode==='level'?`第 ${index+1} 关 · ${puzzle.name}`:mode==='daily'?`每日一局 · ${date}`:'随机挑战');
    $('board-meta').textContent=tr(`${state.w} × ${state.h} · 最优 ${budget} 步`);
    buildBoard();render();
  }
  function loadLevel(index){
    if(!Number.isInteger(index)||!LEVELS[index])return false;
    generationPath=null;
    loadPuzzle(LEVELS[index],'level',index);
    return true;
  }
  function flash(toggled,index){
    const duration=syncMotion();
    stopAnimation();
    if(!duration)return;
    animating=true;
    for(const i of toggled)if(cells[i])cells[i].classList.add('pulse');
    if(cells[index])cells[index].classList.add('pressed');
    animationTimer=setTimeout(()=>{animationTimer=0;animating=false;$('board').querySelectorAll('.pulse,.pressed').forEach(node=>node.classList.remove('pulse','pressed'));},duration);
  }
  function flip(index,options){
    const settings=options||{};
    if(!state||status!=='playing')return false;
    // The pulse is cosmetic, so input never has to wait for it to finish.
    if(generating&&!settings.force)return false;
    const result=E.apply(state,{type:'flip',index});
    if(!result.ok)return false;
    history.push({state:E.clone(state),moves});
    state=result.state;moves++;
    clearHint();
    if(E.analyze(state).status==='won')status='won';
    else if(moves>=budget)status='lost';
    if(status==='won')award();
    render();
    if(settings.animate!==false)flash(result.toggled,index);
    return true;
  }
  function undo(){
    stopAnimation();
    const entry=history.pop();
    if(entry){state=entry.state;moves=entry.moves;}
    status=E.analyze(state).status;
    if(status!=='won'&&moves>=budget)status='lost';
    clearHint();render();
  }
  function restart(){
    stopAnimation();state=E.clone(initial);moves=0;history=[];status='playing';
    clearHint();render();
  }
  function hint(){
    if(!state||generating||status!=='playing')return null;
    const result=E.solve(state);
    if(!result.solvable||!result.exact||!result.solution.length){
      clearHint();
      message('这盘棋已经无法全亮','当前局面无论怎么按都不会全亮。撤销几步，或重开本题。','lost');
      return null;
    }
    const left=budget-moves;
    if(result.optimal>left){
      clearHint();
      message('剩下的预算不够了',`从当前局面最少还需 ${result.optimal} 步，已经超过剩余的 ${left} 步。撤销几步再试。`,'lost');
      return null;
    }
    showHint(result.solution[0]);
    $('selection-note').textContent=tr(`提示：${coordinate(result.solution[0])} 是最少步数解里的一步。`);
    message(`还需要 ${result.optimal} 步。`,`从当前局面最少还需要 ${result.optimal} 步，高亮的格子是其中一步。`);
    return result.optimal;
  }
  async function generate(nextMode){
    const id=stopGeneration();
    stopAnimation();clearHint();
    generating=true;$('busy').hidden=false;
    $('busy-text').textContent=tr('正在构造并验证可解的棋盘…');
    render();
    await new Promise(resolve=>setTimeout(resolve,16));
    if(id!==generationEpoch)return;
    try{
      const date=E.shanghaiDateString();
      const seed=nextMode==='daily'?'daily:'+date:'random:'+Date.now()+':'+(++randomCount)+':'+Math.random();
      const difficulty=nextMode==='daily'?DAILY_ORDER[Number(date.slice(-2))%DAILY_ORDER.length]:RANDOM_ORDER[randomCount%RANDOM_ORDER.length];
      const world=E.generate(seed,difficulty);
      if(id!==generationEpoch)return;
      if(!E.replay(world,world.solution).valid)throw new Error('Invalid certificate');
      generationPath='sync';
      loadPuzzle(world,nextMode,null,nextMode==='daily'?date:null);
      message('新棋盘已就绪',nextMode==='daily'?`每日一局 · ${date}，最优 ${world.optimal} 步。`:`最优 ${world.optimal} 步。`);
    }catch(error){
      if(id!==generationEpoch)return;
      generating=false;$('busy').hidden=true;render();
      message('这道题生成未完成','请重试，或选择固定关卡继续。','lost');
    }
  }
  function playSolution(){
    if(!state||status!=='playing')return 0;
    let pressed=0,guard=0;
    while(status==='playing'&&guard++<=budget+8){
      const result=E.solve(state);
      if(!result.solvable||!result.exact||!result.solution.length)break;
      if(!flip(result.solution[0],{animate:false,force:true}))break;
      pressed++;
    }
    return pressed;
  }
  LEVELS.forEach((level,index)=>{
    const slot=document.createElement('div');
    slot.className='star-slot';slot.setAttribute('role','listitem');slot.innerHTML=star+`<span>${index+1}</span>`;
    $('star-shelf').append(slot);starSlots.push(slot);
    const button=document.createElement('button');
    button.className='level';button.type='button';button.dataset.level=String(index);
    button.innerHTML=`<span class="level-number">${index+1}</span><span class="level-main"><b>${level.name}</b><small>${level.w} × ${level.h} · 最优 ${level.optimal} 步</small></span><span class="level-star">${star}</span>`;
    button.addEventListener('click',()=>loadLevel(index));
    $('levels').append(button);levelButtons.push(button);
  });
  $('undo').addEventListener('click',undo);
  $('restart').addEventListener('click',restart);
  $('hint').addEventListener('click',hint);
  $('next').addEventListener('click',()=>loadLevel(levelIndex+1));
  $('daily').addEventListener('click',()=>generate('daily'));
  $('random').addEventListener('click',()=>generate('random'));
  $('cancel').addEventListener('click',()=>{stopGeneration();render();message('已取消生成','可以继续当前棋盘，或选择其他关卡。');});
  $('motion').addEventListener('change',()=>{
    motionPreference=$('motion').value;
    try{localStorage.setItem(MOTION_KEY,motionPreference);}catch{}
    stopAnimation();syncMotion();
  });
  systemMotion.addEventListener('change',event=>{if(motionPreference===null){$('motion').value=event.matches?'0':'180';stopAnimation();syncMotion();}});
  window.addEventListener('resize',()=>{if(animating){stopAnimation();render();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&animating){stopAnimation();render();}});
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))return;
    const key=event.key.toLowerCase();
    if(key==='z'){event.preventDefault();undo();}
    else if(key==='r'){event.preventDefault();restart();}
    else if(key==='h'){event.preventDefault();hint();}
  });
  let themePreference=null;
  try{themePreference=localStorage.getItem('yaozi.home.theme');}catch{}
  function theme(value){
    document.documentElement.dataset.theme=value;
    document.querySelector('meta[name="theme-color"]').content=value==='dark'?'#0d1826':'#edf3f9';
    $('theme').setAttribute('aria-label',tr(value==='dark'?'切换至浅色模式':'切换至深色模式'));
  }
  theme(document.documentElement.dataset.theme);
  $('theme').addEventListener('click',()=>{
    themePreference=document.documentElement.dataset.theme==='dark'?'light':'dark';
    theme(themePreference);
    try{localStorage.setItem('yaozi.home.theme',themePreference);}catch{}
  });
  matchMedia('(prefers-color-scheme:dark)').addEventListener('change',event=>{if(!['light','dark'].includes(themePreference))theme(event.matches?'dark':'light');});
  window.GameLocale?.setRerender(()=>{
    const saved=currentMessage;
    theme(document.documentElement.dataset.theme);
    $('level-title').textContent=tr(mode==='level'?`第 ${levelIndex+1} 关 · ${puzzle.name}`:mode==='daily'?`每日一局 · ${dailyDate}`:'随机挑战');
    $('board-meta').textContent=tr(`${state.w} × ${state.h} · 最优 ${budget} 步`);
    render();
    if(saved)message(saved[0],saved[1],saved[2]);
  });
  window.FlipGame=Object.freeze({
    loadLevel,
    ready:()=>!!state&&!animating&&!generating,
    snapshot:()=>JSON.parse(JSON.stringify({
      puzzle,state,moves,won:status==='won',levelIndex:mode==='level'?levelIndex:null,mode,
      stars:records.map(record=>record.won),status,budget,remaining:Math.max(0,budget-moves),
      historyLength:history.length,solution:puzzle.solution.slice(),dailyDate,seed:puzzle.seed,
      difficulty:puzzle.difficulty||null,solutionCount:puzzle.solutionCount,nullity:puzzle.nullity,
      hintIndex,generationPath,storageAvailable,records
    })),
    playSolution,
    hint,
    setMotion:value=>{$('motion').value=String(value);stopAnimation();syncMotion();}
  });
  loadLevel(0);
  window.GameLocale?.apply();
})();
