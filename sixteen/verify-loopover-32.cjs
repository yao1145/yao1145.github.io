/* node sixteen/verify-loopover-32.cjs [--replay]
 * Search for <=16-move witnesses; independently replay every supplied board.
 * This is a feasibility certificate, not a claim that the witnesses are shortest.
 */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const E = require('./engine.js'), O = require('./optimal.js')(E);
const dataFile = path.join(__dirname, 'loopover-32.json'), resultFile = path.join(__dirname, 'loopover-32-results.json'), summaryFile = path.join(__dirname, 'loopover-32-results.md');
const boards = JSON.parse(fs.readFileSync(dataFile,'utf8')), dataHash = crypto.createHash('sha256').update(JSON.stringify(boards)).digest('hex');
const goal = Array.from({length:16},(_,i)=>i+1), key = b => b.join(',');
assert.equal(boards.length,32); assert.equal(new Set(boards.map(b=>key(b.flat()))).size,32);
for(let i=0;i<32;i++) {
  assert.equal(boards[i].length,4); boards[i].forEach(row=>assert.equal(row.length,4));
  assert.deepEqual(boards[i].flat().slice().sort((a,b)=>a-b),goal);
  // Independently regenerate the exact numeric pattern in the user's table.
  const k=i%16, sign=i<16?1:-1;
  const expected=Array.from({length:4},(_,r)=>Array.from({length:4},(_,c)=>(k%4+sign*r+4)%4+1+4*((Math.floor(k/4)+sign*c+4)%4)));
  assert.deepEqual(boards[i],expected,`Input transcription #${i+1}`);
}
// Oracle uses only numeric action IDs and the rule definition, not E.move or
// the solver's transition/cell arrays. Positions and block anchors are 1-based in labels.
function apply(b,id) {
  assert.ok(Number.isInteger(id)&&id>=0&&id<34,'Legal action ID');const out=b.slice();
  if(id<8) {const r=id>>1,d=id%2?1:-1;for(let c=0;c<4;c++)out[r*4+(c+d+4)%4]=b[r*4+c];}
  else if(id<16) {const c=(id-8)>>1,d=id%2?1:-1;for(let r=0;r<4;r++)out[((r+d+4)%4)*4+c]=b[r*4+c];}
  else {
    const block=(id-16)>>1,r=Math.floor(block/3),c=block%3,a=r*4+c;
    if(id%2===0){out[a]=b[a+4];out[a+1]=b[a];out[a+5]=b[a+1];out[a+4]=b[a+5];}
    else{out[a]=b[a+1];out[a+1]=b[a+5];out[a+5]=b[a+4];out[a+4]=b[a];}
  }
  return out;
}
function label(id) {
  if(id<8)return `R${(id>>1)+1}${id%2?'→':'←'}`;
  if(id<16)return `C${((id-8)>>1)+1}${id%2?'↓':'↑'}`;
  const k=(id-16)>>1;return `B(${Math.floor(k/3)+1},${k%3+1})${id%2?'↺':'↻'}`;
}
function transform(b,p) {const out=[];for(let i=0;i<16;i++)out[p[i]]=p[b[i]-1]+1;return out;}
const maps=[];
for(let s=0;s<8;s++)for(let dr=0;dr<4;dr++)for(let dc=0;dc<4;dc++)maps.push(Array.from({length:16},(_,i)=>{
  let r=i>>2,c=i&3;if(s>=4)c=3-c;for(let j=0;j<s%4;j++)[r,c]=[c,3-r];return ((r+dr)%4)*4+(c+dc)%4;
}));
const actionKeys=Array.from({length:34},(_,id)=>key(apply(goal,id))), slideKeys=new Set(actionKeys.slice(0,16)), mixedKeys=new Set(actionKeys);
const slideMaps=maps.filter(p=>actionKeys.slice(0,16).every(b=>slideKeys.has(key(transform(b.split(',').map(Number),p)))));
const mixedMaps=slideMaps.filter(p=>actionKeys.every(b=>mixedKeys.has(key(transform(b.split(',').map(Number),p)))));
assert.equal(slideMaps.length,128);assert.equal(mixedMaps.length,8);
const boardIndex=new Map(boards.map((b,i)=>[key(b.flat()),i+1]));
const classes=[1,2,3].map(representative=>({representative,members:[...new Set(slideMaps.map(p=>{
  const id=boardIndex.get(key(transform(boards[representative-1].flat(),p)));assert.ok(id,'Symmetry remains in supplied set');return id;
}))].sort((a,b)=>a-b)}));
assert.deepEqual(classes.map(c=>c.members.length),[8,16,8]);assert.equal(new Set(classes.flatMap(c=>c.members)).size,32);
function replay(result) {
  assert.equal(result.board.length,4);assert.deepEqual(result.board,boards[result.id-1]);
  assert.equal(result.within16,true);assert.ok(Array.isArray(result.actions)&&result.actions.length<=16);
  let b=result.board.flat();const states=[b.slice()];
  for(const id of result.actions){b=apply(b,id);states.push(b.slice());}
  assert.deepEqual(b,goal,`Independent final board #${result.id}`);
  assert.equal(result.length,result.actions.length);assert.deepEqual(result.states,states);
}
(async()=>{
  if(process.argv.includes('--replay')) {
    const report=JSON.parse(fs.readFileSync(resultFile,'utf8'));assert.equal(report.inputSha256,dataHash);assert.equal(report.results.length,32);
    assert.deepEqual(report.results.map(r=>r.id),Array.from({length:32},(_,i)=>i+1));report.results.forEach(replay);
    console.log('Independent replay passed: all 32 boards reach 1–16 within 16 legal mixed-rule moves.');return;
  }
  const results=[];
  for(let i=0;i<32;i++) {
    const b=boards[i].flat().map(v=>String.fromCharCode(64+v)).join('');let last=0;
    const found=await O.findWithin(b,16,{onProgress:p=>{if(p.phase==='bounded-search'&&Date.now()-last>5000){last=Date.now();console.log(`#${i+1}: searching <=16; ${p.nodes.toLocaleString()} nodes`)}}});
    if(!found.within)throw new Error(`#${i+1}: complete bounded search found no solution <=16 (${found.nodes} nodes)`);
    let state=boards[i].flat();const states=[state.slice()];for(const id of found.solution){state=apply(state,id);states.push(state.slice());}
    const item={id:i+1,board:boards[i],within16:true,length:found.length,actions:found.solution,moves:found.solution.map(label),states,nodes:found.nodes};
    replay(item);results.push(item);console.log(`#${i+1}: PASS ${item.length} moves, ${item.nodes.toLocaleString()} nodes`);
  }
  const report={rules:{size:4,actions:34,slide:16,rotation:18,rotationAnchors:'contiguous non-wrapping 2x2',moveCost:1},limit:16,inputSha256:dataHash,method:'Each of the 32 boards searched independently; every witness replayed by a separate numeric array oracle.',symmetry:{slidePreservingMaps:slideMaps.length,mixedPreservingMaps:mixedMaps.length,classes},results};
  fs.writeFileSync(resultFile,JSON.stringify(report,null,2)+'\n');
  const rows=results.map(r=>`| ${r.id} | ${classes.find(c=>c.members.includes(r.id)).representative} | ${r.length} | ${r.moves.join(' ')} |`).join('\n');
  const summary=`# 32 个 Loopover 局面的混合规则验证\n\n**32 / 32 全部通过：每个局面都有不超过 16 步的合法解。** 下表记录找到的解长度，验证结论是最短步数 ≤16。\n\n规则：4×4；整行或整列循环移动一格；任一不跨边界的相邻 2×2 区域旋转 90°。每个动作计一步。\n\n32 组全部独立搜索；解序列再由不调用游戏引擎移动函数的独立数组代码重放。JSON 保存输入、动作 ID、文字动作、每步完整棋盘与节点数。\n\n## 对称性核对\n\n仅滑动规则的 128 个环面方格对称变换，确实把所给数据分成以 1、2、3 号为代表的 8、16、8 三类。在这 128 种变换中，保持全部 34 个混合操作合法的只有 8 个：非零环面平移可能把相邻 2×2 旋转区搬到跨边界位置。因此本验证对所有 32 组逐个求解，不依赖三代表能覆盖混合规则。\n\n## 动作记法\n\nR 行、C 列；箭头表示移动方向。B(r,c) 的 r、c 表示旋转块的左上角，↻ 顺时针、↺ 逆时针。行列从 1 开始。\n\n| 编号 | 仅滑动对称类代表 | 解长度 | 合法解序列 |\n| -- | -- | -- | -- |\n${rows}\n\n## 复现\n\n在仓库根目录运行：\n\n\`\`\`sh\nnode sixteen/verify-loopover-32.cjs\nnode sixteen/verify-loopover-32.cjs --replay\n\`\`\`\n\n第一条重新搜索并生成报告；第二条只用独立代码核对已有证书。输入 SHA-256：\`${dataHash}\`。\n\n若接受“仅滑动的直径为 18，且恰有这 32 个 18 步局面”的穷举结论，则其余局面原本最多 17 步，而以上 32 个在混合规则下至多 16 步；结合另已证明需要 17 步的混合局面，可以推出混合规则的全局最大最短步数恰好为 17。该全局推论以原 Loopover 穷举结论及名单完整性为前提。\n`;
  fs.writeFileSync(summaryFile,summary);console.log(`All 32 passed. Certificates: ${resultFile}`);
})().catch(error=>{console.error(error);process.exitCode=1});
