(() => {
  const text={
    '经典 5×5 十字模式的矩阵秩为 23，零空间维数为 2。因此 2²⁵ 种亮暗布局中，有 2²³ 种可解，占四分之一；每个可解布局有四个奇偶点击方案。随机邻域模式的秩随作用图变化，应逐题计算。':'The classic 5×5 cross matrix has rank 23 and kernel dimension 2. Of its 2^25 light patterns, 2^23 are solvable, one quarter of all patterns. Each solvable pattern has four parity press sets. Random-neighborhood matrices can have different ranks and are analyzed individually.',
    '跳到游戏':'Skip to game','← 游戏主页':'← Games','翻面 · 全亮':'Flip · All Lit','切换语言':'Switch language','切换颜色主题':'Switch color theme',
    '翻转全亮':'Flip','按下一格，':'Press one square,','点亮的不只是它自己。':'and more than that square lights up.','翻转棋盘':'Flip board','全亮挑战':'All-lit challenges','全亮进度与预算':'Progress and budget','十二关通关星星':'Completion stars for 12 levels',
    '格子里的小图，就是这一格的作用范围。':'The small diagram inside each square is that square’s range.','撤销 ':'Undo ','重开 ':'Restart ','提示 ':'Hint ',
    '点击方格，翻转它自己与作用范围内的邻格。全部亮起即通关。':'Press a square to flip it and the neighbours in its range. Light every square to win.',
    '动画':'Animation','翻转动画速度':'Flip animation speed','流畅':'Smooth','快速':'Fast','关闭':'Off',
    '已亮方格':'Squares lit','剩余预算':'Budget left','步':'moves','最优步数 —':'Minimum —','已按 0 次':'Pressed 0 times','解的数量 —':'Solutions —','本关最佳 —':'Best —',
    '每一格都有自己的作用范围':'Every square has its own range','按下之前，先看清格子里的小图。':'Check the small diagram before you press.','继续点亮':'Keep lighting the board',
    '下一关 →':'Next level →','正在构造并验证可解的棋盘…':'Building and verifying a solvable board…','取消生成':'Cancel generation',
    '两次翻转互相抵消':'Two flips cancel on the board','同一格按两次会恢复原局面，但仍消耗两步预算。最终局面取决于每格点击次数的奇偶性，点击顺序不影响结果。':'Pressing a square twice restores the board but still spends two presses. The final position depends on which squares were pressed an odd number of times; order does not matter.',
    '方向键移动焦点，Enter 或空格按下。Z 撤销，R 重开，H 显示还需要几步。':'Arrow keys move focus, Enter or Space presses. Z undoes, R restarts, H reports how many presses remain.',
    '十二星全亮 ':'Twelve stars, all lit ','每关首次全亮，点亮一颗星。':'Light every square in a level to earn its star.','十二关全部全亮，十二颗星属于你。':'All twelve boards lit. All twelve stars are yours.',
    '十二关，从 3×3 到 5×5':'Twelve levels, from 3×3 to 5×5','已通关':'Completed','每日一局':'Daily challenge','随机挑战':'Random challenge',
    '每日按北京时间生成；每日与随机不计入固定关卡星星。':'The daily board is fixed by the date in China Standard Time. Daily and random boards do not earn fixed-level stars.',
    '浏览器无法保存记录；本次打开期间仍可收集星星。':'This browser cannot save records. You can still earn stars until this page is closed.',
    '玩法与全亮规则':'Rules and controls','点击方格，翻转一片':'One press flips a whole neighbourhood',
    '每个格子里都有一张 3×3 的小图。中间那点代表这一格本身，其余位置是它的邻格。':'Each square holds a 3×3 diagram. The middle dot is the square itself; the other positions are its neighbours.',
    '按下一格，会翻转小图上标出的所有格子，包括它自己。':'Pressing a square flips every square marked in its diagram, including itself.',
    '小图逐格不同：有的格子只影响上下左右，有的还带上斜角，范围大小也不一样。熄着按下去就亮，亮着按下去就熄。':'The diagrams differ from square to square. Some cover the four orthogonal neighbours only; others include diagonals, and the sizes vary. A dark square lights up when pressed, a lit square goes dark.',
    '全部方格亮起即通关。斜向是否受影响，只按小图判断，不按格子的位置猜。':'Light every square to win. Whether a diagonal neighbour is affected comes from the diagram, not from the position of the square.',
    '预算、撤销与重开':'Budget, undo, and restart',
    '每关的最优步数由程序精确算出，作为本次的预算。必须在预算内点亮全部方格；预算耗尽而仍有暗格，本局失败。':'Each level has an exact minimum press count as its budget. Light every square within that budget; dark squares remaining when it runs out end the run.',
    '预算耗尽而棋盘还没全亮，本局失败。撤销最近几步仍然有效，重开回到本题初始局面，星星不会被清除。':'Running out of budget with squares still dark ends the run. Undo still works, and restart returns to the starting position without clearing stars.',
    '最佳成绩记录本关用掉的按键次数，撤销与重开都不会清除它。':'The best score records the presses you used on this level, and survives both undo and restart.',
    '操作：点击方格，或用方向键移动焦点后按 Enter / 空格。Z 撤销，R 重开，H 提示还需要几步。提示只报数量，不代你按。':'Controls: press a square, or move focus with the arrow keys and press Enter or Space. Z undoes, R restarts, H reports how many presses remain. The hint only counts; it never presses for you.',
    '数学与算法：模 2 线性方程组':'Math and algorithms: linear systems over GF(2)','每个局面都是一个模 2 方程组':'Every position is a system of equations over GF(2)',
    '把“这一格是否亮着”记作 0 或 1。按下某格，等于给一组格子各加上 1。同一个格子被按两次就抵消回原状，按下顺序也不影响结果。':'Write whether a square is lit as 0 or 1. Pressing a square adds 1 to a set of squares. Pressing the same square twice cancels, and the order of presses changes nothing.',
    '于是一次游戏真正决定的东西只有按了哪些格，每格按 0 次或 1 次。设 A 记录“按下第 j 格会动到哪些格”，x 记录“按了哪些格”，b 记录“哪些格还需要被翻转”。全亮等价于求解 A x = b，加减都在模 2 下进行，也就是异或。':'So a run is decided by which squares you pressed, each of them 0 or 1 times. Let A record which squares move when square j is pressed, x record which squares were pressed, and b record which squares still need to change. Lighting everything is exactly solving A x = b, with addition and subtraction modulo 2, that is, XOR.',
    'A 的第 j 列由第 j 格的小图决定。3×3 的局部作用限定了这一列中哪些位置可以为 1。':'Column j of A is determined by square j’s diagram. Its local 3×3 range limits which entries in that column may be 1.',
    '高斯消元给特解，零空间给全部解':'Elimination gives one solution; the kernel gives them all',
    '对增广矩阵做模 2 高斯消元，可以判断方程是否有解，给出一个特解 x0，并得到零空间维数 d。全部解是 x0 + ker A，一共 2 的 d 次方个。A 奇异时同一盘棋确有多个解，界面上的解数量就来自这里。':'Gaussian elimination modulo 2 on the augmented matrix decides whether the system has a solution, returns one particular solution x0, and gives the kernel dimension d. The full solution set is x0 + ker A, which holds 2 to the d solutions. When A is singular a single position really does have several solutions, and that count is what the interface reports.',
    '高斯消元给出的解不一定最短。要最少步数，就得枚举零空间的全部向量，取按格数最少的一个，这个最小重量就是本关预算。':'The solution elimination hands back need not be the shortest. The fewest presses come from enumerating every vector of the kernel and keeping the one with the fewest set entries; that minimum weight is the level budget.',
    '固定关的零空间维数限制在 4 以内，最多枚举 16 个向量，实时计算可以精确完成。':'Fixed levels keep the kernel dimension at 4 or below, so at most 16 vectors are enumerated and the exact optimum is computed on the spot.',
    '生成器反过来用这套代数：先随机生成每格的作用范围，再挑一组按键方案，用 b = A x 反推初始棋盘。题目在出题时已经有解，随后枚举零空间求出精确最优值，并回放这条最优路线作为证书。':'The generator runs this algebra backwards: it picks the ranges first, chooses a press set, and reads the starting board off b = A x. Every puzzle therefore has a solution the moment it is made; the kernel enumeration then fixes the exact optimum and replays that optimal route as its certificate.',
    'Flip 官方说明':'Official Flip manual','灵感：':'Inspired by ','离线可玩 · 每关最优步数精确计算':'Playable offline · every level’s optimum computed exactly',
    '初见翻转':'First Flip','十字全亮':'Cross and Light','邻域变奏':'Neighbourhood Variations','一题多解':'Many Answers, One Board','四角同辉':'Four Corners Alight','交错邻域':'Interleaved Ranges','多种答案':'Several Solutions','中宫定式':'Centre Cross','重叠光影':'Overlapping Lights','深层联动':'Deep Coupling','对称迷局':'Symmetry Puzzle','终局全亮':'Full Board',
    '全部亮起！':'Every square is lit!','预算用完了':'The budget is spent','这盘棋已经无法全亮':'This position can never be lit','剩下的预算不够了':'The remaining budget is too small','新棋盘已就绪':'New board ready','已取消生成':'Generation canceled','这道题生成未完成':'Could not finish this board',
    '可以继续当前棋盘，或选择其他关卡。':'Continue this board or choose another level.','请重试，或选择固定关卡继续。':'Try again or choose a fixed level.',
    '当前局面无论怎么按都不会全亮。撤销几步，或重开本题。':'No sequence of presses lights this position. Undo a few moves or restart the puzzle.'
  };
  const patterns=[
    [/^第 (\d+) 关 · (.+)$/,(m,n,name)=>`Level ${n} · ${text[name]||name}`],
    [/^每日一局 · (.+)，最优 (\d+) 步。$/,(m,date,best)=>`Daily challenge · ${date}, minimum ${best} moves.`],
    [/^每日一局 · (.+)$/,(m,date)=>`Daily challenge · ${date}`],
    [/^(\d+) × (\d+) · 最优 (\d+) 步$/,(m,w,h,best)=>`${w} × ${h} · minimum ${best} moves`],
    [/^第 (\d+) 关已通关$/,(m,n)=>`Level ${n} · completed`],
    [/^第 (\d+) 关未通关$/,(m,n)=>`Level ${n} · not completed`],
    [/^还剩 (\d+) 格未亮，预算还剩 (\d+) 步。$/,(m,dark,left)=>`${dark} squares still dark, ${left} presses left in the budget.`],
    [/^第 (\d+) 关完成，按了 (\d+) 次，最优 (\d+) 步。$/,(m,n,used,best)=>`Level ${n} complete in ${used} presses. The minimum is ${best}.`],
    [/^本局按了 (\d+) 次，最优 (\d+) 步，每日与随机不计入十二星。$/,(m,used,best)=>`Solved in ${used} presses. The minimum is ${best}. Daily and random boards do not earn stars.`],
    [/^按满 (\d+) 次仍未全亮，本题无法再完成。撤销几步，或重开本题。$/,(m,budget)=>`Still not lit after ${budget} presses; this puzzle can no longer be finished. Undo a few moves or restart it.`],
    [/^还需要 (\d+) 步。$/,(m,n)=>`${n} presses to go.`],
    [/^从当前局面最少还需要 (\d+) 步，高亮的格子是其中一步。$/,(m,n)=>`At least ${n} presses remain from here. The highlighted square is one of them.`],
    [/^从当前局面最少还需 (\d+) 步，已经超过剩余的 (\d+) 步。撤销几步再试。$/,(m,need,left)=>`At least ${need} presses remain, more than the ${left} left in the budget. Undo a few moves and try again.`],
    [/^最优 (\d+) 步。$/,(m,best)=>`Minimum ${best} moves.`],
    [/^提示：([A-Z]\d+) 是最少步数解里的一步。$/,(m,cell)=>`Hint: ${cell} is one press of a shortest solution.`],
    [/^还剩 (\d+) 步预算。按错了就撤销。$/,(m,left)=>`${left} presses of budget left. Undo a wrong press.`],
    [/^最优步数 (\d+)$/,(m,n)=>`Minimum ${n} moves`],
    [/^已按 (\d+) 次$/,(m,n)=>`Pressed ${n} times`],
    [/^解的数量 (\d+)$/,(m,n)=>`Solutions ${n}`],
    [/^本关最佳 (\d+) 次$/,(m,n)=>`Best ${n} presses`],
    [/^([A-Z]\d+)，已亮，按下翻转 (\d+) 格$/,(m,cell,k)=>`${cell}, lit, flips ${k} squares`],
    [/^([A-Z]\d+)，未亮，按下翻转 (\d+) 格$/,(m,cell,k)=>`${cell}, dark, flips ${k} squares`]
  ];
  let language=(()=>{try{const v=localStorage.getItem('yaozi.home.language');if(v==='zh'||v==='en')return v;}catch{}return(navigator.language||'').toLowerCase().startsWith('zh')?'zh':'en';})();
  const staticNodes=[];const walker=document.createTreeWalker(document.documentElement,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const n=walker.currentNode;if(n.nodeValue.trim()&&!n.parentElement.closest('script,style,noscript'))staticNodes.push([n,n.nodeValue]);}
  const attrs=[];for(const el of document.querySelectorAll('[aria-label],[title]'))for(const key of ['aria-label','title'])if(el.hasAttribute(key))attrs.push([el,key,el.getAttribute(key)]);
  const ordered=Object.entries(text).sort((a,b)=>b[0].length-a[0].length);
  const t=value=>{
    let out=String(value??'');
    if(language!=='en')return out;
    for(const [re,replacement] of patterns)if(re.test(out))return out.replace(re,replacement);
    for(const [zh,en] of ordered)out=out.split(zh).join(en);
    return out;
  };
  let rerender=()=>{};
  function apply(){
    document.documentElement.dataset.language=language;
    document.documentElement.lang=language==='zh'?'zh-CN':'en';
    for(const [node,zh] of staticNodes)if(node.isConnected)node.nodeValue=language==='zh'?zh:t(zh);
    for(const [el,key,zh] of attrs)if(el.isConnected)el.setAttribute(key,language==='zh'?zh:t(zh));
    const title=document.querySelector('title');
    if(title)title.textContent=language==='zh'?'翻转全亮 · 用最少步数点亮棋盘':'Flip · Light the Whole Board';
    const meta=document.querySelector('meta[name="description"]');
    if(meta)meta.content=language==='zh'
      ?'翻转全亮：按下一格，翻转它自己与作用范围内的邻格，在最优预算内点亮全部方格。十二关、每日与随机棋盘。'
      :'Flip: press a square to flip it and the neighbours in its range, and light the whole board inside the exact optimal budget. Twelve levels plus daily and random boards.';
    const toggle=document.getElementById('language-toggle');
    if(toggle){
      toggle.textContent=language==='zh'?'EN':'中文';
      toggle.setAttribute('aria-label',language==='zh'?'Switch to English':'Switch to Chinese');
      toggle.title=language==='zh'?'Switch to English':'Switch to Chinese';
    }
    try{localStorage.setItem('yaozi.home.language',language);}catch{}
    rerender();
  }
  window.GameLocale={t,get language(){return language;},setRerender(fn){rerender=fn;},apply};
  document.getElementById('language-toggle')?.addEventListener('click',()=>{language=language==='zh'?'en':'zh';apply();});
  apply();
})();
