/* Exact vertex coloring, deterministic graph construction and resumable search. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ColoringEngine = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function normalize(graph) {
    if (!graph || !Number.isInteger(graph.n) || graph.n < 0 || graph.n > 256 || !Array.isArray(graph.edges)) throw new TypeError('Invalid graph');
    const adjacent = Array.from({ length: graph.n }, () => []), edges = [], seen = new Set();
    for (const edge of graph.edges) {
      if (!Array.isArray(edge) || edge.length !== 2) throw new TypeError('Invalid edge');
      const [a,b] = edge;
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= graph.n || b >= graph.n || a === b) throw new TypeError('Edges must join distinct vertices');
      const key = Math.min(a,b) + ':' + Math.max(a,b);
      if (seen.has(key)) continue;
      seen.add(key); edges.push([a,b]); adjacent[a].push(b); adjacent[b].push(a);
    }
    return { n: graph.n, edges, adjacent };
  }
  function validateColoring(graph, colors, q) {
    const g = normalize(graph);
    const limit = q === undefined ? g.n : q;
    if (!Array.isArray(colors) || colors.length !== g.n || !Number.isInteger(limit) || limit < 0) return { valid: false, complete: false, conflicts: [], invalid: true };
    const invalid = colors.some(c => !Number.isInteger(c) || c < -1 || c >= limit);
    const conflicts = [];
    g.edges.forEach(([a,b], i) => { if (colors[a] >= 0 && colors[a] === colors[b]) conflicts.push(i); });
    return { valid: !invalid && conflicts.length === 0, complete: !invalid && colors.every(c => c >= 0), conflicts, invalid };
  }
  function createSearch(graph, q, options) {
    const g = normalize(graph), opts = options || {};
    if (!Number.isInteger(q) || q < 0) throw new TypeError('Color count must be a nonnegative integer');
    const budget = opts.maxNodes === undefined ? Infinity : Math.max(0, Number(opts.maxNodes));
    if (Number.isNaN(budget)) throw new TypeError('Invalid search budget');
    const colors = Array(g.n).fill(-1); let nodes = 0, final = null;
    const outcome = (status, reason) => ({ status, colors: status === 'feasible' ? colors.slice() : null, nodes, ...(reason ? { reason } : {}) });
    function blocked(v, color) { return g.adjacent[v].some(w => colors[w] === color); }
    function forwardValid() {
      for (let v = 0; v < g.n; v++) if (colors[v] < 0) {
        const used = new Set(g.adjacent[v].filter(w => colors[w] >= 0).map(w => colors[w]));
        if (used.size >= q) return false;
      }
      return true;
    }
    function chooseVertex() {
      let chosen = -1, saturation = -1, degree = -1;
      for (let v = 0; v < g.n; v++) if (colors[v] < 0) {
        const count = new Set(g.adjacent[v].filter(w => colors[w] >= 0).map(w => colors[w])).size;
        if (count > saturation || (count === saturation && g.adjacent[v].length > degree)) { chosen = v; saturation = count; degree = g.adjacent[v].length; }
      }
      return chosen;
    }
    function* dfs(used, assigned) {
      if (opts.cancelled && opts.cancelled()) return outcome('unknown', 'cancelled');
      if (assigned === g.n) return outcome('feasible');
      if (nodes >= budget) return outcome('unknown', 'budget');
      nodes++; yield null;
      const v = chooseVertex();
      // All unused color names are interchangeable. Introduce only the next one.
      for (let color = 0; color < Math.min(q, used + 1); color++) {
        if (blocked(v, color)) continue;
        colors[v] = color;
        if (forwardValid()) {
          const result = yield* dfs(Math.max(used, color + 1), assigned + 1);
          if (result.status !== 'infeasible') return result;
        }
        colors[v] = -1;
      }
      return outcome('infeasible');
    }
    function* run() {
      if (!g.n) return outcome('feasible');
      if (!q) return outcome('infeasible');
      if (!g.edges.length) { colors.fill(0); return outcome('feasible'); }
      if (q >= g.n) { for (let i=0;i<g.n;i++) colors[i] = i; return outcome('feasible'); }
      return yield* dfs(0, 0);
    }
    const iterator = run();
    return Object.freeze({ step(batchSize) {
      if (final) return { ...final, colors: final.colors && final.colors.slice() };
      const batch = batchSize === undefined ? 1000 : batchSize;
      if (!Number.isInteger(batch) || batch <= 0) throw new TypeError('Batch size must be a positive integer');
      for (let i=0;i<batch;i++) {
        const next = iterator.next();
        if (next.done) { final = next.value; return { ...final, colors: final.colors && final.colors.slice() }; }
      }
      if (opts.onProgress) opts.onProgress(nodes);
      return { status: 'searching', nodes };
    } });
  }
  function findColoring(graph, q, options) {
    const search = createSearch(graph, q, options); let result;
    do { result = search.step(2000); } while (result.status === 'searching');
    return result;
  }
  function greedyUpperBound(graph) {
    const g = normalize(graph), colors = Array(g.n).fill(-1);
    for (let i=0;i<g.n;i++) {
      let v = -1, best = -1, degree = -1;
      for (let w=0;w<g.n;w++) if (colors[w] < 0) {
        const saturation = new Set(g.adjacent[w].map(u => colors[u]).filter(c => c >= 0)).size;
        if (saturation > best || (saturation === best && g.adjacent[w].length > degree)) { v=w;best=saturation;degree=g.adjacent[w].length; }
      }
      const forbidden = new Set(g.adjacent[v].map(u => colors[u])); let c=0; while (forbidden.has(c)) c++; colors[v]=c;
    }
    return { k: g.n ? Math.max(...colors)+1 : 0, colors };
  }
  function cliqueLowerBound(graph) {
    const g = normalize(graph), order = Array.from({length:g.n},(_,i)=>i).sort((a,b)=>g.adjacent[b].length-g.adjacent[a].length); let best=[];
    for (const start of order) {
      const clique = [start];
      for (const v of order) if (v !== start && clique.every(w => g.adjacent[v].includes(w))) clique.push(v);
      if (clique.length > best.length) best = clique;
    }
    return { k: best.length, vertices: best };
  }
  function solveExact(graph, options) {
    const upper = greedyUpperBound(graph), lower = cliqueLowerBound(graph); let nodes=0;
    for (let q=lower.k;q<upper.k;q++) {
      const result = findColoring(graph,q,{...options,maxNodes:Math.max(0,(options?.maxNodes ?? Infinity)-nodes)}); nodes+=result.nodes;
      if (result.status === 'unknown') return { status:'unknown',lower:q,upper:upper.k,colors:upper.colors,nodes };
      if (result.status === 'feasible') return { status:'optimal',k:q,colors:result.colors,nodes };
    }
    return { status:'optimal',k:upper.k,colors:upper.colors,nodes };
  }
  function hash(seed) { let h=2166136261;for (const c of String(seed)) {h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0; }
  function randomFor(seed) { let s=hash(seed);return ()=>{s+=0x6d2b79f5;let t=Math.imul(s^s>>>15,1|s);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;}; }
  function shuffle(array, random) { for(let i=array.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[array[i],array[j]]=[array[j],array[i]];}return array; }
  function cycle(n) { return { n, edges:Array.from({length:n},(_,i)=>[i,(i+1)%n]) }; }
  function mycielski(g) {
    return { n:2*g.n+1, edges:g.edges.map(e=>e.slice()).concat(g.edges.flatMap(([a,b])=>[[a,b+g.n],[b,a+g.n]]),Array.from({length:g.n},(_,i)=>[g.n+i,2*g.n])) };
  }
  function wheel(rim) { const g=cycle(rim);return { n:rim+1,edges:g.edges.concat(Array.from({length:rim},(_,i)=>[i,rim])) }; }
  function prism(n) { const g=cycle(n);return {n:2*n,edges:g.edges.concat(g.edges.map(([a,b])=>[a+n,b+n]),Array.from({length:n},(_,i)=>[i,i+n]))}; }
  function complement(g) { const occupied=new Set(g.edges.map(([a,b])=>Math.min(a,b)+':'+Math.max(a,b))),edges=[];for(let a=0;a<g.n;a++)for(let b=a+1;b<g.n;b++)if(!occupied.has(a+':'+b))edges.push([a,b]);return {n:g.n,edges}; }
  function extend(g, count) {
    const n=g.n,edges=g.edges.map(e=>e.slice());
    for(let i=0;i<count;i++){edges.push([n+i,i%n],[n+i,(i+2)%n]);if(i)edges.push([n+i-1,n+i]);}
    return {n:n+count,edges};
  }
  function petersen() { const edges=cycle(5).edges;for(let i=0;i<5;i++)edges.push([i,i+5],[i+5,(i+2)%5+5]);return {n:10,edges}; }
  function kneser() {
    const pairs=[];for(let a=0;a<6;a++)for(let b=a+1;b<6;b++)pairs.push([a,b]);const edges=[];
    for(let a=0;a<pairs.length;a++)for(let b=a+1;b<pairs.length;b++)if(pairs[a].every(v=>!pairs[b].includes(v)))edges.push([a,b]);
    return {n:pairs.length,edges};
  }
  function doubleHub() { const g=cycle(7),edges=g.edges.concat([[7,8]]);for(let i=0;i<7;i++)edges.push([i,7],[i,8]);return extend({n:9,edges},5); }
  function relabel(g, seed) {
    const random=randomFor('relabel:'+seed),order=shuffle(Array.from({length:g.n},(_,i)=>i),random),inverse=[];
    order.forEach((old,i)=>{inverse[old]=i;});
    // A second independent permutation places vertices; construction layers carry no clue.
    const placement=shuffle(Array.from({length:g.n},(_,i)=>i),random),angle=random()*Math.PI*2;
    const positions=placement.map(i=>[500+420*Math.cos(angle+2*Math.PI*i/g.n),500+420*Math.sin(angle+2*Math.PI*i/g.n)]);
    return {...g,edges:g.edges.map(([a,b])=>[inverse[a],inverse[b]]),solution:order.map(i=>g.solution[i]),positions};
  }
  const m5=mycielski(cycle(5));
  const diamond={n:7,edges:[[0,2],[0,3],[1,2],[1,3],[2,3],[0,5],[0,6],[4,5],[4,6],[5,6],[1,4]]};
  const specifications=[
    ['初试相邻',2,{n:6,edges:[[0,1],[1,2],[2,3],[3,0],[3,4],[4,5]]}],
    ['奇环一笔',3,cycle(7)],['五角交织',3,petersen()],['双环错位',3,prism(7)],
    ['无三角的四色',4,m5],['九环与枢纽',4,wheel(9)],['双菱约束',4,extend(diamond,3)],
    ['不相交之网',4,kneser()],['七环再生',4,mycielski(cycle(7))],
    ['九环反面',5,extend(complement(cycle(9)),3)],['双枢迷阵',5,doubleHub()],['五色无三角',5,mycielski(m5)]
  ];
  const LEVELS=specifications.map(([name,k,graph],i)=>{
    const witness=findColoring(graph,k,{maxNodes:2000000});
    if(witness.status!=='feasible')throw new Error('Invalid level construction: '+name);
    const level=relabel({...graph,name,k,solution:witness.colors},'fixed-'+i);
    level.edges.forEach(Object.freeze);level.positions.forEach(Object.freeze);Object.freeze(level.edges);Object.freeze(level.positions);Object.freeze(level.solution);return Object.freeze(level);
  });Object.freeze(LEVELS);
  function makeCandidate(seed,difficulty) {
    const random=randomFor('candidate:'+seed),indices=difficulty==='easy'?[1,2,3]:[4,6,7,8,9,10,11],base=LEVELS[indices[Math.floor(random()*indices.length)]];
    const g={...base,edges:base.edges.map(e=>e.slice()),solution:base.solution.slice()};
    const occupied=new Set(g.edges.map(([a,b])=>Math.min(a,b)+':'+Math.max(a,b))),candidates=[];
    for(let a=0;a<g.n;a++)for(let b=a+1;b<g.n;b++)if(g.solution[a]!==g.solution[b]&&!occupied.has(a+':'+b))candidates.push([a,b]);
    shuffle(candidates,random);const extra=Math.min(candidates.length,Math.floor(random()*5));g.edges.push(...candidates.slice(0,extra));
    return {...relabel(g,seed),name:base.name,seed:String(seed),baseLevel:LEVELS.indexOf(base)};
  }
  function generate(seed,difficulty,options) {
    const candidate=makeCandidate(seed,difficulty),validation=validateColoring(candidate,candidate.solution,candidate.k);
    if(!validation.valid||!validation.complete)throw new Error('Invalid candidate witness');
    const proof=findColoring(candidate,candidate.k-1,{maxNodes:2000000,...options});
    return proof.status==='infeasible'?{...candidate,status:'verified',proofNodes:proof.nodes}:{status:'unknown',nodes:proof.nodes};
  }
  function shanghaiDateString(date) { const d=date===undefined?new Date():new Date(date);if(!Number.isFinite(d.getTime()))throw new TypeError('Invalid date');return new Date(d.getTime()+8*3600000).toISOString().slice(0,10); }
  return Object.freeze({LEVELS,normalize,validateColoring,createSearch,findColoring,greedyUpperBound,cliqueLowerBound,solveExact,chromaticNumber:solveExact,makeCandidate,generate,shanghaiDateString});
});
