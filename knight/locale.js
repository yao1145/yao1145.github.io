(() => {
  'use strict';
  const root = document.documentElement, key = 'yaozi.home.language';
  const textMap = {
    '跳到游戏':'Skip to game','← 游戏主页':'← Games','开放巡游挑战':'Open tour challenge','王冠巡游':'Crown Tour','王冠只走骑士步。':'The crown moves like a chess knight.','踏遍每一格，且不重复。':'Visit every square exactly once.','巡游棋盘':'Tour board','骑士巡游棋盘':'Knight’s tour board','第 1 关 · 初巡':'Level 1 · First tour','起点':'Start','终点':'Finish','王冠':'Crown','已巡格':'Visited','可走':'Legal move','王座':'Throne','点击发光的落点；方向键移动光标，Enter / 空格落子。Z 撤销，R 重开。':'Tap a glowing square, or move with the arrow keys and press Enter / Space. Z undoes; R restarts.','动画':'Animation','流畅':'Smooth','快速':'Fast','关闭':'Off','巡游统计':'Tour stats','已巡格数':'Squares visited','可走位置':'Legal moves','处':'moves','已走 ':'Used ','步':'moves','还差 ':'','格。':' squares remain.','王冠落在':'Crown on','巡游完成！':'Tour complete!','巡游进行中':'Tour in progress','无路可走':'No moves left','巡游完整，王冠未归位':'Tour complete, wrong finish','撤销':'Undo','重开':'Restart','下一关 →':'Next level →','巡游足迹':'Tour path','十二星巡游':'Twelve-star tour','每关首次通关，点亮一颗星。':'Clear each level once to earn a star.','集齐星星解锁':'Earn all stars to unlock','已通关 ':'Completed ','十二关，从 5×5 到 8×8':'Twelve levels, from 5×5 to 8×8','每日一局':'Daily challenge','随机挑战':'Random challenge','每日按北京时间生成；每日与随机棋盘不点亮星星。':'Daily boards use Shanghai time. Daily and random boards do not earn stars.','当前浏览器无法保存收藏；星星将在本次打开期间保留。':'This browser cannot save stars. Your progress lasts for this session.','玩法与巡游规则':'How to play','王冠只走骑士步':'The crown moves like a knight','王冠每一步都是“日”字：横向两格再纵向一格，或纵向两格再横向一格。':'A knight moves in an L shape: two squares in one direction, then one square at a right angle.','踏遍棋盘上的每一格，且每格只踏一次。不要求回到起点，这称为':'Visit every square exactly once. Returning to the start is not required; this is an ','开放巡游':'open tour','。':' .','如果还有格子没踏到，王冠却已无路可走，本局失败。可以撤销一步，或重开。':'If the crown has no legal move before every square is visited, the tour ends. Undo or restart.','带“终”标记的关卡，王冠必须':'On levels marked with a finish, the crown must land on the throne ','最后':'last','落在王座上；提前经过王座将无法完成本关。':' . Visiting it earlier makes the level unsolvable.','操作：':'Controls: ','点击发光的落点，或使用方向键移动光标并按 Enter / 空格落子。Z 撤销，R 重开。':'Tap a glowing square, or use the arrow keys then Enter / Space. Z undoes; R restarts.','十二颗星与星冠':'Twelve stars and the star crown','每关首次通关点亮一颗星。十二关全部完成，解锁':'Earn one star the first time you clear a level. Complete all twelve to unlock the ','巡游星冠':'Tour Star Crown','撤销会退回上一步；重开会从起点重新巡游，但不会清除已经点亮的星星。':'Undo returns to the previous square. Restart begins at the start and keeps earned stars.','5×5 到 8×8 的矩形棋盘都存在开放巡游；奇数面积棋盘（5×5、5×7、7×7）必须从多数色格起步。':'Open tours exist on rectangular boards from 5×5 to 8×8. Odd-area boards (5×5, 5×7, 7×7) must start on the majority color.','每日一局以北京时间生成；每日与随机棋盘均不计入十二星。':'Daily boards use Shanghai time. Daily and random boards do not count toward the twelve stars.','数学与算法：骑士图上的哈密顿路径':'Math and algorithms: Hamiltonian paths on knight graphs','把棋盘变成一张图':'Turning the board into a graph','每格是一个顶点，两个格子之间若能走一步骑士步，就连接一条边。恰好访问每个顶点一次的路线叫':'Each square is a vertex; connect two vertices when a knight can move between them. A route that visits every vertex exactly once is a ','哈密顿路径':'Hamiltonian path','，这就是本游戏的开放巡游；若终点还能一步回到起点，则形成闭合巡游。':'—the open tour in this game. If the finish can reach the start in one move, the tour is closed.','骑士每一步都会改变格子的黑白颜色，因此骑士图是二分图。完整路线上的颜色必须交替：奇数面积时，两端都在数量较多的颜色上；偶数面积时，两端颜色不同。颜色条件能排除一些起终点组合，实际有解还需考虑图的连接结构。':'Every knight move changes square color, so the knight graph is bipartite. Colors alternate along a complete tour: on odd-area boards, both endpoints use the majority color; on even-area boards, they have different colors. This rules out some endpoint pairs; connectivity also matters.','这个角度也解释了“留退路”：若未访问区域被分成彼此不连通的部分，或某格再也无法进入，就无法把路线接完。':'This explains why you need to leave an exit: disconnected unvisited regions or an unreachable square make a complete route impossible.','优先走向出口较少的格子':'Prefer squares with fewer exits','生成器采用 Warnsdorff 启发式：在可选的下一格中，优先进入剩余出口较少的格子，把较灵活的位置留到后面。候选顺序相同时用种子随机打破平局；走进死路就回溯，改试其他分支。':'The generator uses Warnsdorff’s heuristic: visit the available square with the fewest remaining exits first, saving flexible squares for later. A seeded random order breaks ties; dead ends trigger backtracking.','程序预先建立骑士步邻接表，用访问标记避免重复。指定王座终点会保留到最后一步。启发式负责排序，找到的完整路线还要逐步检查，确认每步合法、全盘不重不漏并满足终点要求。':'The generator precomputes knight-move neighbors and marks visited squares. A required throne is reserved for the last move. Every generated route is then checked step by step for legal moves, full coverage, and the required finish.','继续了解骑士巡游':'Learn more about the knight’s tour','灵感：':'Inspired by: ','离线可玩 · 每关路线已验证':'Playable offline · every level has a verified route','十二颗星，铺成一条完整的巡游之路。':'Twelve stars form one complete tour.','12 / 12 关全部通关':'All 12 levels cleared','巡游之王':'Tour Champion','从 5×5 到 8×8，你带王冠走遍了每一格。':'From 5×5 to 8×8, you guided the crown across every square.','这顶星冠，属于不重复、不遗漏的你。':'This star crown is yours: no repeats, no squares missed.','戴上星冠，回到棋盘':'Wear the crown and return','关闭星冠':'Close the star crown'
  };
  const phraseMap = {
    '王冠只走日字。先观察哪些格子能接上，再为剩下的格子留好退路。':'The crown moves like a knight. Look for connecting squares and leave an exit for the rest.','每日与随机题都保留一条已验证的路线；每日种子由北京时间日期确定。':'Daily and random boards keep a verified route. The daily seed follows the Shanghai date.',' · 开放巡游':' · Open tour','1 到 12 关的通关星星':'Completion stars for levels 1 to 12','正在生成棋盘':'Building the board','正在搜索一条完整的开放巡游…':'Searching for a complete open tour…','点亮了第 ':'Earned star ',' 颗星！':' star!',' 本关星星此前已收藏。':' This level’s star was already earned.',' 十二星冠已解锁！':' The Star Crown is unlocked!',' 每日棋盘不计入十二星。':' Daily boards do not count toward stars.',' 随机棋盘不计入十二星。':' Random boards do not count toward stars.','本局星星此前已收藏':'This level’s star was already earned','十二星冠已解锁':'The Star Crown is unlocked','随机挑战不计入十二星':'Random boards do not count toward stars','十二关全部通关，你的巡游星冠已解锁。':'All twelve levels cleared. Your Tour Star Crown is unlocked.','查看我的星冠':'View my star crown',
    '切换至浅色模式':'Switch to light mode','切换至深色模式':'Switch to dark mode','切换颜色主题':'Toggle color theme','王冠移动动画':'Crown movement animation','巡游进度':'Tour progress','巡游足迹：':'Tour path: ','巡游挑战':'Tour challenges','每日棋盘不计入十二星':'Daily boards do not count toward stars','随机棋盘不计入十二星':'Random boards do not count toward stars','撤销':'Undo','重开':'Restart','王冠只走日字':'The crown moves like a knight','留好退路':'leave an exit','棋盘':'board','起点':'start','终点':'finish','王座':'throne','可走':'legal move','十二星巡游 ':'Twelve-star tour ',
  };
  let language = 'zh';
  try { const saved = localStorage.getItem(key); language = saved === 'zh' || saved === 'en' ? saved : /^zh/i.test(navigator.language) ? 'zh' : 'en'; } catch { language = /^zh/i.test(navigator.language) ? 'zh' : 'en'; }
  function translate(source) {
    if (language !== 'en') return source;
    if (textMap[source] !== undefined) return textMap[source];
    if (source.trim() === '步') return source.startsWith(' ') ? ' moves' : 'moves';
    if (source === '起') return 'S';
    let match = source.match(/^还差 (\d+) 颗星$/); if (match) return `${match[1]} stars remaining`;
    match = source.match(/^第 (\d+) 关，(已通关|尚未通关)$/); if (match) return `Level ${match[1]}, ${match[2] === '已通关' ? 'cleared' : 'not cleared'}`;
    match = source.match(/^第 (\d+) 到 (\d+) 关的通关星星$/); if (match) return `Completion stars for levels ${match[1]} to ${match[2]}`;
    match = source.match(/^第 (\d+) 关 · (.+)$/); if (match) return `Level ${match[1]} · ${translate(match[2])}`;
    match = source.match(/^(\d+) × (\d+) · 起点 (.+?)(?: · 终点 (.+))?$/); if (match) return `${match[1]} × ${match[2]} · Start ${match[3]}${match[4] ? ` · Finish ${match[4]}` : ''}`;
    match = source.match(/^第 (\d+) 步$/); if (match) return `Move ${match[1]}`;
    match = source.match(/^第 (\d+) 到 (\d+) 关的通关星星$/); if (match) return `Completion stars for levels ${match[1]} to ${match[2]}`;
    match = source.match(/^第 (\d+) 关，(.+)，(\d+)×(\d+) 棋盘(，已通关)?$/); if (match) return `Level ${match[1]}, ${translate(match[2])}, ${match[3]}×${match[4]} board${match[5] ? ', cleared' : ''}`;
    match = source.match(/^第 (\d+) 关，(.+?)(?:，已通关)?$/); if (match) return `Level ${match[1]}, ${translate(match[2])}${source.endsWith('，已通关') ? ', cleared' : ''}`;
    match = source.match(/^已巡 (\d+) \/ (\d+) 格$/); if (match) return `${match[1]} / ${match[2]} squares visited`;
    match = source.match(/^已巡 (\d+) \/ (\d+) 格，当前有 (\d+) 条去路。$/); if (match) return `Visited ${match[1]} / ${match[2]} squares. ${match[3]} legal moves remain.`;
    match = source.match(/^已巡 (\d+) \/ (\d+) 格。现在只有 1 条去路。$/); if (match) return `Visited ${match[1]} / ${match[2]} squares. Only one legal move remains.`;
    match = source.match(/^还差 (\d+) 格。$/); if (match) return `${match[1]} squares remain.`;
    match = source.match(/^用 (\d+) 步踏遍 (\d+) 格。$/); if (match) return `Visited all ${match[2]} squares in ${match[1]} moves.`;
    match = source.match(/^王冠落在 (.+)$/); if (match) return `Crown on ${match[1]}`;
    match = source.match(/^王冠走到 (.+)，已巡 (\d+) 格。$/); if (match) return `Crown moved to ${match[1]}; ${match[2]} squares visited.`;
    match = source.match(/^你踏遍了全盘，但终点应在 (.+)。撤销最后几步，或重开。$/); if (match) return `You visited every square, but the finish must be ${match[1]}. Undo a few moves or restart.`;
    match = source.match(/^还有 (\d+) 格未巡，但王冠已被围住。撤销一步，或重开。$/); if (match) return `${match[1]} squares remain, but the crown is trapped. Undo a move or restart.`;
    match = source.match(/^每日一局 · (.+)$/); if (match) return `Daily challenge · ${match[1]}`;
    match = source.match(/^随机挑战 · (.+)$/); if (match) return `Random challenge · ${match[1]}`;
    match = source.match(/^用 (\d+) 步踏遍 (\d+) 格。点亮了第 (\d+) 颗星！$/); if (match) return `Visited all ${match[2]} squares in ${match[1]} moves. Earned star ${match[3]}!`;
    match = source.match(/^用 (\d+) 步踏遍 (\d+) 格。(.+)$/); if (match) return `Visited all ${match[2]} squares in ${match[1]} moves. ${translate(match[3])}`;
    match = source.match(/^用 (\d+) 步踏遍 (\d+) 格。$/); if (match) return `Visited all ${match[2]} squares in ${match[1]} moves.`;
    match = source.match(/^(\d+) 格全部踏遍。$/); if (match) return `All ${match[1]} squares visited.`;
    match = source.match(/^每日棋盘已生成：(\d+) × (\d+)，起点 (.+)。$/); if (match) return `Daily board generated: ${match[1]} × ${match[2]}; start ${match[3]}.`;
    match = source.match(/^随机棋盘已生成：(\d+) × (\d+)，起点 (.+)。$/); if (match) return `Random board generated: ${match[1]} × ${match[2]}; start ${match[3]}.`;
    match = source.match(/^第 (\d+) 关通关，点亮第 (\d+) 颗星。$/); if (match) return `Level ${match[1]} cleared. Star ${match[2]} earned.`;
    match = source.match(/^第 (\d+) 关通关。$/); if (match) return `Level ${match[1]} cleared.`;
    match = source.match(/^已撤销一步，王冠回到 (.+)。$/); if (match) return `Undid one move. The crown returned to ${match[1]}.`;
    if (source === '本局已重开。') return 'Tour restarted.';
    match = source.match(/^每日棋盘已生成：(.+)。$/); if (match) return `Daily board generated: ${match[1]}.`;
    match = source.match(/^随机棋盘已生成：(.+)。$/); if (match) return `Random board generated: ${match[1]}.`;
    match = source.match(/^第 (\d+) 关，(已通关|尚未通关)$/); if (match) return `Level ${match[1]}, ${match[2] === '已通关' ? 'cleared' : 'not cleared'}`;
    match = source.match(/^Level (\d+), (.+?)(?:，已通关)?$/); if (match) return `Level ${match[1]}, ${translate(match[2])}${source.endsWith('，已通关') ? ', cleared' : ''}`;
    match = source.match(/^(.+)，(第 \d+ 步|尚未巡游)(，王冠在此)?(，可走)?(，终点)?$/);
    if (match) return `${match[1]}, ${match[2] === '尚未巡游' ? 'unvisited' : match[2].replace('第 ', 'move ').replace(' 步', '')}${match[3] ? ', crown here' : ''}${match[4] ? ', legal move' : ''}${match[5] ? ', finish' : ''}`;
    match = source.match(/^第 (\d+) 关 · (.+)$/); if (match) return `Level ${match[1]} · ${translate(match[2])}`;
    match = source.match(/^已通关 (\d+) \/ (\d+)$/); if (match) return `${match[1]} / ${match[2]} completed`;
    const levelNames = { '初巡':'First tour','边城':'Border town','五七纵横':'Five by seven','方阵':'Square formation','长河':'Long river','交错':'Crossing','六八之间':'Six by eight','七曜':'Seven stars','原野':'Open field','八方':'Eight by eight','王座之心':'Throne’s heart','极远之角':'Farthest corner' };
    if (levelNames[source]) return levelNames[source];
    let value = source;
    for (const [zh, en] of Object.entries(phraseMap).sort((a, b) => b[0].length - a[0].length)) value = value.split(zh).join(en);
    return value;
  }
  const textCache = new WeakMap(), attrCache = new WeakMap();
  function apply() {
    root.dataset.language = language; root.lang = language === 'zh' ? 'zh-CN' : 'en';
    const button = document.getElementById('language-toggle');
    if (button) { button.textContent = language === 'zh' ? 'EN' : '中文'; button.setAttribute('aria-label', language === 'zh' ? 'Switch language to English' : 'Switch language to Chinese'); button.title = button.getAttribute('aria-label'); }
    document.title = language === 'zh' ? '王冠巡游 · 开放骑士巡游' : 'Crown Tour · Open Knight’s Tour';
    const desc = document.querySelector('meta[name="description"]'); if (desc) desc.content = language === 'zh' ? '用骑士的走法操控王冠，在 5×5 到 8×8 的棋盘上完成开放巡游。十二关、十二颗星。' : 'Guide a crown like a chess knight on open tours across 5×5 to 8×8 boards. Twelve levels, twelve stars.';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let node;
    while ((node = walker.nextNode())) { if (node.parentElement?.closest('script,style,noscript')) continue; const saved = textCache.get(node); if (!saved || node.data !== saved.output) textCache.set(node, { source: node.data, output: '' }); const entry = textCache.get(node); node.data = translate(entry.source); entry.output = node.data; }
    for (const el of document.body.querySelectorAll('[aria-label],[title]')) for (const attr of ['aria-label','title']) if (el.hasAttribute(attr)) { let cache = attrCache.get(el); if (!cache) { cache = {}; attrCache.set(el, cache); } if (!cache[attr] || el.getAttribute(attr) !== cache[attr].output) cache[attr] = { source: el.getAttribute(attr), output: '' }; cache[attr].output = translate(cache[attr].source); el.setAttribute(attr, cache[attr].output); }
  }
  function set(value) { language = value; try { localStorage.setItem(key, value); } catch {} apply(); window.refreshGameLanguage?.(); }
  window.GameLocale = Object.freeze({ get language() { return language; }, t: translate, apply, set });
  document.getElementById('language-toggle')?.addEventListener('click', () => set(language === 'zh' ? 'en' : 'zh'));
  apply();
})();
