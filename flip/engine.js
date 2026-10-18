(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.FlipEngine=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const CENTER=4,MAX_CELLS=36,MAX_NULLITY=16,GENERATION_NULLITY_LIMIT=8;
  const dxOf=bit=>bit%3-1,dyOf=bit=>(bit-bit%3)/3-1,bitOf=(dx,dy)=>(dy+1)*3+(dx+1);
  const clone=s=>({w:s.w,h:s.h,cells:s.cells.slice(),masks:s.masks.slice()});

  function validate(s){
    if(!s||!Number.isInteger(s.w)||!Number.isInteger(s.h)||s.w<1||s.h<1||s.w*s.h>MAX_CELLS)throw new TypeError('Invalid board size');
    const n=s.w*s.h;
    if(!Array.isArray(s.cells)||s.cells.length!==n)throw new TypeError('Invalid cells');
    if(!Array.isArray(s.masks)||s.masks.length!==n)throw new TypeError('Invalid masks');
    for(const c of s.cells)if(c!==0&&c!==1)throw new TypeError('Invalid cell value');
    for(let j=0;j<n;j++){
      const mask=s.masks[j];
      if(!Number.isInteger(mask)||mask<0||mask>511)throw new TypeError('Invalid mask');
      if(!(mask&(1<<CENTER)))throw new TypeError('A cell must flip itself');
      const x=j%s.w,y=(j-x)/s.w;
      for(let bit=0;bit<9;bit++)if(mask&(1<<bit)){
        const nx=x+dxOf(bit),ny=y+dyOf(bit);
        if(nx<0||nx>=s.w||ny<0||ny>=s.h)throw new TypeError('A mask reaches outside the board');
      }
    }
    return s;
  }
  function toggled(state,index){
    const mask=state.masks[index],x=index%state.w,y=(index-x)/state.w,out=[];
    for(let bit=0;bit<9;bit++)if(mask&(1<<bit)){
      const nx=x+dxOf(bit),ny=y+dyOf(bit);
      if(nx>=0&&nx<state.w&&ny>=0&&ny<state.h)out.push(ny*state.w+nx);
    }
    return out;
  }
  function apply(state,action){
    validate(state);
    const reject=reason=>({ok:false,reason,state:clone(state),toggled:[]});
    if(!action||action.type!=='flip')return reject('action');
    if(!Number.isInteger(action.index)||action.index<0||action.index>=state.cells.length)return reject('index');
    const hits=toggled(state,action.index),cells=state.cells.slice();
    for(const i of hits)cells[i]^=1;
    return {ok:true,state:{w:state.w,h:state.h,cells,masks:state.masks.slice()},toggled:hits};
  }
  function analyze(state){
    validate(state);
    let lit=0;
    for(const c of state.cells)if(c)lit++;
    return {lit,dark:state.cells.length-lit,total:state.cells.length,status:lit===state.cells.length?'won':'playing'};
  }
  function replay(state,solution){
    if(!Array.isArray(solution))throw new TypeError('Invalid solution');
    let current=clone(validate(state));
    for(let i=0;i<solution.length;i++){
      const result=apply(current,{type:'flip',index:solution[i]});
      if(!result.ok)return {valid:false,index:i,reason:result.reason,state:current,presses:i,lit:analyze(current).lit};
      current=result.state;
    }
    const info=analyze(current);
    return {valid:info.status==='won',state:current,presses:solution.length,lit:info.lit};
  }
  // Pressing one cell twice cancels and order does not matter, so every play is a
  // press set over GF(2). rows[i][j] = 1 when pressing j flips cell i.
  function equations(state){
    const n=state.cells.length,rows=[];
    for(let i=0;i<n;i++)rows.push(new Uint8Array(n+1));
    for(let j=0;j<n;j++)for(const i of toggled(state,j))rows[i][j]=1;
    for(let i=0;i<n;i++)rows[i][n]=state.cells[i]?0:1;
    return rows;
  }
  function eliminate(rows,n){
    const R=rows.map(row=>row.slice()),pivotRow=new Int32Array(n).fill(-1);
    let rank=0;
    for(let c=0;c<n&&rank<R.length;c++){
      let p=-1;
      for(let i=rank;i<R.length;i++)if(R[i][c]){p=i;break;}
      if(p<0)continue;
      const swap=R[rank];R[rank]=R[p];R[p]=swap;
      for(let i=0;i<R.length;i++)if(i!==rank&&R[i][c])for(let k=c;k<=n;k++)R[i][k]^=R[rank][k];
      pivotRow[c]=rank;rank++;
    }
    for(let i=0;i<R.length;i++){
      let any=false;
      for(let k=0;k<n;k++)if(R[i][k]){any=true;break;}
      if(!any&&R[i][n])return {consistent:false,rank,R,pivotRow};
    }
    return {consistent:true,rank,R,pivotRow};
  }
  function rankOf(w,h,masks){
    const n=w*h;
    return eliminate(equations({w,h,cells:new Array(n).fill(1),masks}),n).rank;
  }
  function indicesOf(vector){
    const out=[];
    for(let i=0;i<vector.length;i++)if(vector[i])out.push(i);
    return out;
  }
  function lessList(a,b){
    const n=Math.min(a.length,b.length);
    for(let i=0;i<n;i++)if(a[i]!==b[i])return a[i]<b[i];
    return a.length<b.length;
  }
  function solve(state,options){
    validate(state);
    const n=state.cells.length;
    const {consistent,rank,R,pivotRow}=eliminate(equations(state),n);
    if(!consistent)return {solvable:false,optimal:null,solution:null,rank,nullity:null,solutionCount:0,exact:true};
    const free=[];
    for(let c=0;c<n;c++)if(pivotRow[c]<0)free.push(c);
    const particular=new Uint8Array(n);
    for(let c=0;c<n;c++)if(pivotRow[c]>=0)particular[c]=R[pivotRow[c]][n];
    const basis=[];
    for(const f of free){
      const vector=new Uint8Array(n);
      vector[f]=1;
      for(let c=0;c<n;c++)if(pivotRow[c]>=0)vector[c]=R[pivotRow[c]][f];
      basis.push(vector);
    }
    const cap=options&&options.maxNullity||MAX_NULLITY;
    if(basis.length>cap)return {solvable:true,optimal:null,solution:null,rank,nullity:basis.length,solutionCount:null,exact:false};
    // The solutions form particular + ker A. Enumerating the kernel finds the lightest one,
    // which is the true minimum number of presses.
    const cur=particular.slice();
    let count=0;
    for(const v of cur)if(v)count++;
    let best=cur.slice(),bestCount=count,bestList=indicesOf(cur);
    const limit=2**basis.length;
    let previous=0;
    for(let i=1;i<limit;i++){
      const gray=i^(i>>1),changed=gray^previous;previous=gray;
      const vector=basis[31-Math.clz32(changed)];
      for(let j=0;j<n;j++)if(vector[j]){cur[j]^=1;count+=cur[j]?1:-1;}
      if(count<bestCount){bestCount=count;best=cur.slice();bestList=indicesOf(cur);}
      else if(count===bestCount){
        const list=indicesOf(cur);
        if(lessList(list,bestList)){best=cur.slice();bestList=list;}
      }
    }
    return {solvable:true,optimal:bestCount,solution:bestList,rank,nullity:basis.length,solutionCount:2**basis.length,exact:true};
  }

  function randomFor(seed){
    let s=2166136261;
    for(const c of String(seed)){s^=c.charCodeAt(0);s=Math.imul(s,16777619);}
    return ()=>{s+=0x6d2b79f5;let t=Math.imul(s^s>>>15,1|s);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};
  }
  function shuffle(list,r){
    for(let i=list.length-1;i>0;i--){const j=Math.floor(r()*(i+1));const swap=list[i];list[i]=list[j];list[j]=swap;}
    return list;
  }
  function makeMasks(w,h,style,r){
    const density=style==='sparse' ? 0.28 : style==='wide' ? 0.62 : 0.42;
    const masks=[];
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      let mask=1<<CENTER;
      const neighbors=[];
      for(let bit=0;bit<9;bit++){
        if(bit===CENTER)continue;
        const nx=x+dxOf(bit),ny=y+dyOf(bit);
        if(nx<0||nx>=w||ny<0||ny>=h)continue;
        neighbors.push(bit);
      }
      if(style==='cross'){
        for(const bit of neighbors)if(bit%3===1||dyOf(bit)===0)mask|=1<<bit;
      }else{
        const chosen=neighbors.filter(bit=>r()<density);
        const pool=shuffle(neighbors.slice(),r);
        for(const bit of pool){if(chosen.length>=2)break;if(!chosen.includes(bit))chosen.push(bit);}
        for(const bit of chosen)mask|=1<<bit;
      }
      masks.push(mask);
    }
    return masks;
  }
  function cellsForPressSet(masks,w,h,presses){
    const state={w,h,cells:new Array(w*h).fill(1),masks},dark=new Uint8Array(w*h);
    for(const j of presses)for(const i of toggled(state,j))dark[i]^=1;
    return Array.from(dark,c=>c?0:1);
  }
  function fitScore(candidate,config){
    let score=0;
    if(candidate.nullity<config.minNullity)score+=(config.minNullity-candidate.nullity)*8;
    if(candidate.nullity>config.maxNullity)score+=(candidate.nullity-config.maxNullity)*8;
    if(candidate.optimal<config.minOpt)score+=config.minOpt-candidate.optimal;
    if(candidate.optimal>config.maxOpt)score+=candidate.optimal-config.maxOpt;
    return score;
  }
  // Every candidate is built by picking a press set and reading off the board it solves,
  // so a valid certificate exists before any search happens.
  function buildCandidate(config,r,style){
    const w=config.w,h=config.h,n=w*h,masks=makeMasks(w,h,style||config.style,r);
    const rank=rankOf(w,h,masks),nullity=n-rank;
    if(nullity>GENERATION_NULLITY_LIMIT)return null;
    const trials=nullity===0?2:5;
    let best=null;
    for(let t=0;t<trials;t++){
      const size=nullity===0?config.minOpt+Math.floor(r()*(config.maxOpt-config.minOpt+1)):config.maxOpt+Math.floor(r()*3);
      const presses=shuffle(Array.from({length:n},(_,i)=>i),r).slice(0,Math.min(size,n)).sort((a,b)=>a-b);
      const state={w,h,cells:cellsForPressSet(masks,w,h,presses),masks};
      const result=solve(state);
      if(!result.solvable||!result.exact)continue;
      const candidate={w,h,cells:state.cells,masks,rank,nullity,optimal:result.optimal,solution:result.solution,solutionCount:result.solutionCount,presses:presses.length};
      if(!best||fitScore(candidate,config)<fitScore(best,config))best=candidate;
    }
    return best;
  }
  function buildWorld(config){
    const attempts=config.attempts||400;
    let best=null,bestScore=Infinity;
    for(let a=0;a<attempts;a++){
      const candidate=buildCandidate(config,randomFor(config.seed+'#'+a));
      if(!candidate)continue;
      const score=fitScore(candidate,config);
      if(score===0)return candidate;
      if(score<bestScore){bestScore=score;best=candidate;}
    }
    // A cross-shaped board always has a candidate, so this is a floor, never a failure.
    if(!best)best=buildCandidate(config,randomFor(config.seed+'#fallback'),'cross');
    if(!best)throw new Error('No certified board within the generation budget');
    return best;
  }
  function compose(candidate,extra){
    const state={w:candidate.w,h:candidate.h,cells:candidate.cells,masks:candidate.masks};
    const report=replay(state,candidate.solution);
    if(!report.valid||report.presses!==candidate.optimal)throw new Error('Generated board failed its own certificate');
    // The stored solution is the lightest member of its coset, so it proves the budget.
    const check=solve(state);
    if(!check.solvable||!check.exact||check.optimal!==candidate.optimal)throw new Error('Generated board has no exact optimum');
    return Object.freeze({
      name:extra.name,
      w:candidate.w,
      h:candidate.h,
      cells:Object.freeze(candidate.cells.slice()),
      masks:Object.freeze(candidate.masks.slice()),
      optimal:candidate.optimal,
      solution:Object.freeze(candidate.solution.slice()),
      rank:candidate.rank,
      nullity:candidate.nullity,
      solutionCount:candidate.solutionCount,
      seed:extra.seed,
      difficulty:extra.difficulty||null,
      meta:{style:extra.style,presses:candidate.presses,dark:state.cells.filter(c=>!c).length}
    });
  }
  const LEVEL_SPECS=Object.freeze([
    {seed:'flip-level-01',name:'初见翻转',w:3,h:3,style:'cross',minOpt:3,maxOpt:4,minNullity:0,maxNullity:0},
    {seed:'flip-level-02',name:'十字全亮',w:3,h:3,style:'cross',minOpt:5,maxOpt:6,minNullity:0,maxNullity:0},
    {seed:'flip-level-03',name:'邻域变奏',w:3,h:3,style:'mixed',minOpt:4,maxOpt:5,minNullity:0,maxNullity:0},
    {seed:'flip-level-04',name:'一题多解',w:3,h:3,style:'mixed',minOpt:4,maxOpt:5,minNullity:1,maxNullity:3},
    {seed:'flip-level-05',name:'四角同辉',w:4,h:4,style:'cross',minOpt:4,maxOpt:6,minNullity:1,maxNullity:4},
    {seed:'flip-level-06',name:'交错邻域',w:4,h:4,style:'mixed',minOpt:6,maxOpt:7,minNullity:0,maxNullity:0},
    {seed:'flip-level-07',name:'多种答案',w:4,h:4,style:'mixed',minOpt:6,maxOpt:7,minNullity:1,maxNullity:4},
    {seed:'flip-level-08',name:'中宫定式',w:5,h:5,style:'cross',minOpt:7,maxOpt:9,minNullity:1,maxNullity:4},
    {seed:'flip-level-09',name:'重叠光影',w:5,h:5,style:'mixed',minOpt:8,maxOpt:9,minNullity:0,maxNullity:0},
    {seed:'flip-level-10',name:'深层联动',w:5,h:5,style:'mixed',minOpt:10,maxOpt:11,minNullity:0,maxNullity:0},
    {seed:'flip-level-11',name:'对称迷局',w:5,h:5,style:'mixed',minOpt:10,maxOpt:11,minNullity:1,maxNullity:4},
    {seed:'flip-level-12',name:'终局全亮',w:5,h:5,style:'mixed',minOpt:12,maxOpt:13,minNullity:0,maxNullity:0}
  ]);
  const LEVELS=Object.freeze(LEVEL_SPECS.map(spec=>compose(buildWorld({...spec,attempts:500}),{name:spec.name,seed:spec.seed,style:spec.style})));
  const DIFFICULTY=Object.freeze({
    gentle:{w:4,h:4,style:'cross',minOpt:4,maxOpt:6,minNullity:0,maxNullity:4,attempts:60},
    steady:{w:5,h:5,style:'sparse',minOpt:8,maxOpt:10,minNullity:0,maxNullity:0,attempts:200},
    deep:{w:5,h:5,style:'mixed',minOpt:11,maxOpt:13,minNullity:0,maxNullity:0,attempts:200},
    tangled:{w:5,h:5,style:'mixed',minOpt:11,maxOpt:14,minNullity:1,maxNullity:4,attempts:500}
  });
  function generate(seed,difficulty){
    const key=DIFFICULTY[difficulty]?difficulty:'deep';
    const config={...DIFFICULTY[key],seed:'flip-world:'+seed};
    return compose(buildWorld(config),{name:'随机题',seed:String(seed),style:config.style,difficulty:key});
  }
  function shanghaiDateString(date){
    const d=date===undefined?new Date():new Date(date);
    if(!Number.isFinite(d.getTime()))throw new TypeError('Invalid date');
    return new Date(d.getTime()+8*3600000).toISOString().slice(0,10);
  }
  return Object.freeze({
    CENTER,MAX_CELLS,MAX_NULLITY,VALID_STYLES:Object.freeze(['cross','sparse','mixed','wide']),
    bitOf,dxOf,dyOf,validate,clone,apply,toggled,analyze,replay,equations,eliminate,rankOf,solve,
    randomFor,shuffle,makeMasks,cellsForPressSet,generate,LEVELS,LEVEL_SPECS,DIFFICULTY,shanghaiDateString
  });
});
