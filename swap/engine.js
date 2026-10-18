(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.SwapEngine=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const EMPTY=-1;
  function validate(s){
    if(!s||!Number.isInteger(s.w)||!Number.isInteger(s.h)||s.w<1||s.h<1||s.w*s.h>100||!Array.isArray(s.cells)||s.cells.length!==s.w*s.h||s.cells.some(c=>!Number.isInteger(c)||c<EMPTY||c>7))throw new TypeError('Invalid board');
    return s;
  }
  const clone=s=>({w:s.w,h:s.h,cells:s.cells.slice()});
  const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
  function neighbors(s,i){const a=[];if(i%s.w)a.push(i-1);if(i%s.w<s.w-1)a.push(i+1);if(i>=s.w)a.push(i-s.w);if(i+s.w<s.cells.length)a.push(i+s.w);return a;}
  function matches(s){
    validate(s);const set=new Set();
    for(let i=0;i<s.cells.length;i++)if(s.cells[i]>=0){
      if(i%s.w<s.w-1&&s.cells[i]===s.cells[i+1]){set.add(i);set.add(i+1);}
      if(i+s.w<s.cells.length&&s.cells[i]===s.cells[i+s.w]){set.add(i);set.add(i+s.w);}
    }
    return [...set].sort((a,b)=>a-b);
  }
  function compact(s){
    const cells=Array(s.cells.length).fill(EMPTY),moves=[];
    for(let x=0;x<s.w;x++){let row=s.h-1;for(let y=s.h-1;y>=0;y--){const from=y*s.w+x,c=s.cells[from];if(c<0)continue;const to=row--*s.w+x;cells[to]=c;if(from!==to)moves.push({from,to,color:c});}}
    return {cells,moves};
  }
  function apply(s,action){
    validate(s);let cells=s.cells.slice(),frames=[],removed=0;
    const reject=reason=>({ok:false,reason,state:clone(s),frames:[],removed:0});
    if(!action)return reject('action');
    if(action.type==='swap'){
      const {a,b}=action;
      if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=cells.length||b>=cells.length||!neighbors(s,a).includes(b))return reject('adjacent');
      if(cells[a]<0||cells[b]<0)return reject('empty');
      if(cells[a]===cells[b])return reject('unchanged');
      const before=cells.slice();[cells[a],cells[b]]=[cells[b],cells[a]];
      frames.push({kind:'swap',before,after:cells.slice(),moves:[{from:a,to:b,color:before[a]},{from:b,to:a,color:before[b]}]});
      const indices=matches({...s,cells});
      if(indices.length){const before=cells.slice();indices.forEach(i=>{cells[i]=EMPTY;});removed+=indices.length;frames.push({kind:'remove',before,after:cells.slice(),indices});}
    }else if(action.type==='drop'){
      while(true){
        const fallen=compact({...s,cells});
        if(fallen.moves.length){frames.push({kind:'fall',before:cells.slice(),after:fallen.cells.slice(),moves:fallen.moves});cells=fallen.cells;}
        const indices=matches({...s,cells});
        if(!indices.length)break;
        const before=cells.slice();indices.forEach(i=>{cells[i]=EMPTY;});removed+=indices.length;frames.push({kind:'remove',before,after:cells.slice(),indices});
      }
      if(!frames.length)return reject('unchanged');
    }else return reject('action');
    return {ok:true,state:{w:s.w,h:s.h,cells},frames,removed};
  }
  function analyze(s){
    validate(s);const counts=Array(8).fill(0);s.cells.forEach(c=>{if(c>=0)counts[c]++;});
    const remaining=counts.reduce((a,b)=>a+b,0),singletons=counts.flatMap((n,c)=>n===1?[c]:[]);
    let status=remaining===0?'won':singletons.length?'stuck':'playing';
    if(status==='playing'){
      const anySwap=s.cells.some((c,i)=>c>=0&&neighbors(s,i).some(j=>s.cells[j]>=0&&s.cells[j]!==c));
      if(!anySwap&&!apply(s,{type:'drop'}).ok)status='stuck';
    }
    return {remaining,counts,singletons,status};
  }
  function replay(s,solution){
    let state=clone(validate(s)),swaps=0,drops=0,preparations=0,maxChain=0;
    for(let i=0;i<solution.length;i++){
      const action=solution[i],result=apply(state,action);
      if(!result.ok)return {valid:false,index:i,reason:result.reason,state};
      if(action.type==='swap'){swaps++;if(!result.removed)preparations++;}else drops++;
      maxChain=Math.max(maxChain,result.frames.filter(f=>f.kind==='remove').length);state=result.state;
    }
    return {valid:analyze(state).status==='won',state,swaps,drops,preparations,maxChain};
  }
  function actions(s){const out=[];for(let a=0;a<s.cells.length;a++)if(s.cells[a]>=0)for(const b of [a+1,a+s.w])if(b<s.cells.length&&(b===a+s.w||a%s.w<s.w-1)&&s.cells[b]>=0&&s.cells[a]!==s.cells[b])out.push({type:'swap',a,b});if(apply(s,{type:'drop'}).ok)out.push({type:'drop'});return out;}
  function greedy(s){
    let state=clone(s);const seen=new Set();
    for(let turn=0;turn<s.cells.length+4;turn++){
      if(!analyze(state).remaining)return true;
      const key=state.cells.join(',');if(seen.has(key))return false;seen.add(key);
      let best=null;
      for(const action of actions(state)){const result=apply(state,action);if(result.removed>0&&(!best||result.removed>best.removed))best=result;}
      if(!best){const drop=apply(state,{type:'drop'});if(!drop.ok)return false;best=drop;}
      state=best.state;
    }
    return false;
  }
  function randomFor(seed){let s=2166136261;for(const c of String(seed)){s^=c.charCodeAt(0);s=Math.imul(s,16777619);}return ()=>{s+=0x6d2b79f5;let t=Math.imul(s^s>>>15,1|s);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
  function shuffle(a,r){for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  const packed=s=>same(s.cells,compact(s).cells);
  function reverseAdd(s,palette,r,needPacked){
    // Reverse one clearing exchange: insert two tiles and displace an old one.
    let chosen=null,total=0;
    for(let a=0;a<s.cells.length;a++)if(s.cells[a]>=0)for(const b of neighbors(s,a))if(s.cells[b]<0)for(const c of neighbors(s,b))if(c!==a&&s.cells[c]<0)for(let color=0;color<palette;color++)if(color!==s.cells[a]){
      const cells=s.cells.slice();cells[a]=color;cells[b]=s.cells[a];cells[c]=color;const pre={...s,cells};
      if(matches(pre).length||(needPacked&&!packed(pre)))continue;
      const check=apply(pre,{type:'swap',a,b});if(!check.ok||!same(check.state.cells,s.cells))continue;
      // Reservoir sampling avoids a bias toward a corner or a known solution order.
      total++;if(r()<1/total)chosen={state:pre,action:{type:'swap',a,b}};
    }
    if(chosen)return chosen;
    // A fresh four-tile gadget can extend the board into a new region.
    for(let a=0;a<s.cells.length;a++)if(s.cells[a]<0)for(const b of neighbors(s,a))if(b>a&&s.cells[b]<0)for(const c of neighbors(s,b))if(c!==a&&s.cells[c]<0)for(const d of neighbors(s,a))if(d!==b&&d!==c&&s.cells[d]<0)for(let x=0;x<palette;x++)for(let y=0;y<palette;y++)if(x!==y){
      const cells=s.cells.slice();cells[a]=x;cells[b]=y;cells[c]=x;cells[d]=y;const pre={...s,cells};
      if(matches(pre).length||(needPacked&&!packed(pre)))continue;
      const check=apply(pre,{type:'swap',a,b});if(!check.ok||!same(check.state.cells,s.cells))continue;
      total++;if(r()<1/total)chosen={state:pre,action:{type:'swap',a,b}};
    }
    return chosen;
  }
  function scatterTo(s,target,r){
    for(let attempt=0;attempt<120;attempt++){
      const cells=Array(s.cells.length).fill(EMPTY);
      for(let x=0;x<s.w;x++){
        const colors=[];for(let y=0;y<s.h;y++)if(s.cells[y*s.w+x]>=0)colors.push(s.cells[y*s.w+x]);
        const rows=shuffle(Array.from({length:s.h},(_,i)=>i),r).slice(0,colors.length).sort((a,b)=>a-b);
        rows.forEach((y,i)=>{cells[y*s.w+x]=colors[i];});
      }
      const pre={...s,cells};if(matches(pre).length||same(cells,s.cells))continue;
      const result=apply(pre,{type:'drop'});if(result.ok&&same(result.state.cells,target.cells))return pre;
    }
    return null;
  }
  function unfall(s,r){return packed(s)?scatterTo(s,s,r):null;}
  function reverseDrop(s,palette,r){
    if(!packed(s))return null;
    const heights=Array.from({length:s.w},(_,x)=>s.cells.filter((c,i)=>i%s.w===x&&c>=0).length),candidates=[];
    for(let x=0;x<s.w-1;x++)if(heights[x]===heights[x+1]){
      const row=s.h-heights[x]-1;if(row<1)continue;
      for(let a=0;a<palette;a++)for(let b=0;b<palette;b++)if(a!==b){
        const cells=s.cells.slice();cells[row*s.w+x]=a;cells[row*s.w+x+1]=a;
        candidates.push({...s,cells});
        // Removing a vertical pair first aligns the next pair: a two-wave cascade.
        if(row>=3){const chain=s.cells.slice();chain[row*s.w+x]=b;chain[(row-1)*s.w+x]=b;chain[(row-2)*s.w+x]=a;chain[row*s.w+x+1]=a;candidates.push({...s,cells:chain});}
      }
    }
    shuffle(candidates,r);candidates.sort((a,b)=>b.cells.filter(c=>c>=0).length-a.cells.filter(c=>c>=0).length);
    for(const source of candidates){const clear=apply(source,{type:'drop'});if(!clear.ok||!same(clear.state.cells,s.cells))continue;const pre=scatterTo(source,s,r);if(pre)return pre;}
    return null;
  }
  function reversePrep(s,r,seen){
    const options=[];
    for(const action of actions(s))if(action.type==='swap'){
      const cells=s.cells.slice();[cells[action.a],cells[action.b]]=[cells[action.b],cells[action.a]];const pre={...s,cells};
      if(!matches(pre).length&&!seen.has(cells.join(',')))options.push({state:pre,action});
    }
    return options.length?options[Math.floor(r()*options.length)]:null;
  }
  const DIFFICULTY=Object.freeze({
    intro:{w:4,h:4,target:10,palette:3,preps:0,drop:false,greedyTrap:false},
    medium:{w:5,h:6,target:22,palette:3,preps:1,drop:true,greedyTrap:false},
    hard:{w:6,h:7,target:34,palette:4,preps:3,drop:true,greedyTrap:true},
    expert:{w:7,h:8,target:46,palette:3,preps:4,drop:true,greedyTrap:true}
  });
  function* generateSteps(seed,difficulty,overrides){
    const config={...(DIFFICULTY[difficulty||'hard']||{}),...overrides};if(!config.w)throw new TypeError('Unknown difficulty');
    const r=randomFor('swap-v1:'+seed),{w,h,palette}=config;
    for(let attempt=0;attempt<80;attempt++){
      let state={w,h,cells:Array(w*h).fill(EMPTY)},solution=[],floating=false;
      const wide=r()<.5&&w>=3,col=Math.floor(r()*(w-(wide?3:2)+1));
      const top=(h-2)*w+col;
      if(wide){[0,1,0,1,0,1].forEach((c,i)=>{state.cells[top+(i%3)+Math.floor(i/3)*w]=c;});solution.push({type:'swap',a:top+1,b:top+w+1});}
      else{state.cells[top]=0;state.cells[top+1]=1;state.cells[top+w]=1;state.cells[top+w+1]=0;solution.push({type:'swap',a:top,b:top+1});}
      let grown=analyze(state).remaining;
      while(grown<config.target){
        if(!floating&&config.drop&&(grown>=Math.min(10,config.target*.4))){const pre=reverseDrop(state,palette,r)||unfall(state,r);if(pre){state=pre;grown=analyze(state).remaining;solution.unshift({type:'drop'});floating=true;}}
        let added=reverseAdd(state,palette,r,!floating&&config.drop);
        if(!added&&!floating&&config.drop){const pre=reverseDrop(state,palette,r)||unfall(state,r);if(pre){state=pre;grown=analyze(state).remaining;solution.unshift({type:'drop'});floating=true;added=reverseAdd(state,palette,r,false);}}
        if(!added)break;
        state=added.state;solution.unshift(added.action);grown=analyze(state).remaining;
        yield {phase:'construct',attempt,tiles:grown,target:config.target};
      }
      if(config.drop&&!floating){const pre=reverseDrop(state,palette,r)||unfall(state,r);if(pre){state=pre;grown=analyze(state).remaining;solution.unshift({type:'drop'});floating=true;}}
      const seen=new Set([state.cells.join(',')]);
      for(let p=0;p<config.preps;p++){const pre=reversePrep(state,r,seen);if(pre){state=pre.state;solution.unshift(pre.action);seen.add(state.cells.join(','));}}
      const report=replay(state,solution);
      if(grown<config.target-4||!report.valid||(config.drop&&!report.drops)||matches(state).length)continue;
      const trivial=greedy(state);if(config.greedyTrap&&trivial)continue;
      const map=shuffle(Array.from({length:palette},(_,i)=>i),r);state.cells=state.cells.map(c=>c<0?c:map[c]);
      // A horizontal reflection preserves downward gravity and transforms the certificate.
      if(r()<.5){const mirror=i=>Math.floor(i/w)*w+(w-1-i%w);state.cells=state.cells.map((_,i)=>state.cells[mirror(i)]);solution=solution.map(a=>a.type==='drop'?{type:'drop'}:{type:'swap',a:mirror(a.a),b:mirror(a.b)});}
      return {w,h,cells:state.cells,solution,palette,seed:String(seed),difficulty:difficulty||'hard',meta:{tiles:grown,swaps:report.swaps,drops:report.drops,preparations:report.preparations,maxChain:report.maxChain,greedyClears:trivial,attempts:attempt+1}};
    }
    throw new Error('No certified board within generation budget');
  }
  function generate(seed,difficulty,overrides){const it=generateSteps(seed,difficulty,overrides);let step;do{step=it.next();}while(!step.done);return step.value;}
  function shanghaiDateString(date){const d=date===undefined?new Date():new Date(date);if(!Number.isFinite(d.getTime()))throw new TypeError('Invalid date');return new Date(d.getTime()+8*3600000).toISOString().slice(0,10);}
  return Object.freeze({EMPTY,validate,clone,neighbors,matches,compact,apply,analyze,replay,actions,greedy,DIFFICULTY,generateSteps,generate,shanghaiDateString});
});
