(() => {
  'use strict';
  const E = window.RobotsEngine;
  const $ = id => document.getElementById(id);
  const BOARD = $('board');
  if (!E || !BOARD) { if ($('level-title')) $('level-title').textContent = '引擎未能加载，请重新打开页面。'; return; }

  const N = E.BOARD_W;
  const GLYPHS = ['●', '▲', '■', '◆'];
  const NAMES = [
    ['蓝色圆形', 'blue circle'],
    ['橙色三角', 'orange triangle'],
    ['绿色方块', 'green square'],
    ['玫红菱形', 'magenta diamond']
  ];
  const ARROWS = { up: '↑', right: '→', down: '↓', left: '←' };
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.5 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.4l6.2-.9Z"/></svg>';
  const PROGRESS_KEY = 'yaozi.robots.progress.v1';
  const MOTION_KEY = 'yaozi.robots.motion';
  const MAX_LEVEL = 12;

  const DICT = {
    'doc-title': ['Robots 滑行 · 四台同时归位', 'Robots · Four Home at Once'],
    'doc-description': [
      'Robots 滑行：四台机器人只能滑到撞墙、撞内墙或被另一台挡住为止，四台同时停在自己的目标上才算完成。16×16 棋盘，十二关，每日与随机挑战。',
      'Robots: four robots slide until they hit a wall, an inner wall, or another robot. All four must stop on their own targets at the same time. 16×16 board, twelve levels, daily and random puzzles.'
    ],
    'switch-language': ['切换语言', 'Switch language'],
    'theme-light': ['切换至浅色模式', 'Switch to light mode'],
    'theme-dark': ['切换至深色模式', 'Switch to dark mode'],
    'theme-label': ['切换颜色主题', 'Switch color theme'],
    back: ['← 游戏主页', '← Games'],
    skip: ['跳到游戏', 'Skip to the game'],
    'board-section': ['机器人棋盘', 'Robot board'],
    'side-section': ['进度与记录', 'Progress and records'],
    'challenges-section': ['十二关挑战', 'Twelve-level challenges'],
    'star-shelf': ['十二关通关星星', 'Completion stars for the twelve levels'],
    'pad-robots': ['选择机器人', 'Select a robot'],
    'pad-dirs': ['滑动方向', 'Slide direction'],
    'dir-up': ['向上滑行', 'Slide up'],
    'dir-right': ['向右滑行', 'Slide right'],
    'dir-down': ['向下滑行', 'Slide down'],
    'dir-left': ['向左滑行', 'Slide left'],
    kicker: ['滑动 · 挡停 · 四台归位', 'Slide · Block · Four home'],
    title: ['Robots 滑行', 'Robots'],
    tagline1: ['机器人一滑到底，中途停不下来。', 'A robot slides until something stops it.'],
    tagline2: ['四台同时归位，本关完成。', 'All four home at once clears the level.'],
    'ready-hint': ['点机器人选中它，再选一个方向。', 'Select a robot, then choose a direction.'],
    'selected-note': ['已选机器人 {n}（{name}）。选一个方向滑行。', 'Robot {n} ({name}) selected. Choose a direction.'],
    'blocked-note': ['这个方向滑不动，换一个方向。', 'That direction is blocked. Try another one.'],
    'legend-robot': ['机器人', 'Robot'],
    'legend-target': ['同色同符号目标', 'Matching target'],
    'legend-wall': ['内墙', 'Inner wall'],
    'legend-done': ['已归位', 'Home'],
    'board-help': ['点机器人选中，再选方向；也可以直接在棋盘上朝一个方向划动。方向键或 WASD 移动，1–4 换机器人，Z 撤销，R 重开。', 'Tap a robot, then choose a direction, or swipe across the board. Arrow keys or WASD slide, 1–4 selects a robot, Z undoes, R restarts.'],
    motion: ['动画', 'Animation'],
    'motion-label': ['滑动动画速度', 'Slide animation speed'],
    smooth: ['流畅', 'Smooth'],
    fast: ['快速', 'Fast'],
    off: ['关闭', 'Off'],
    'stat-done': ['已归位', 'Home'],
    'stat-moves': ['滑行步数', 'Slides'],
    'unit-moves': ['步', ''],
    'stat-cert': ['本题证书', 'Certified route'],
    'stat-bound': ['松弛下界', 'Relaxed bound'],
    'stat-best': ['本关最少', 'Level best'],
    'move-unit': ['{n} 步', '{n} moves'],
    next: ['下一关 →', 'Next level →'],
    cancel: ['取消生成', 'Cancel'],
    'busy-build': ['正在构造可回放的归位路线…', 'Building a reusable route…'],
    'sequence-title': ['本次滑行', 'Your slides'],
    'sequence-empty': ['尚未移动', 'No slides yet'],
    'collection-title': ['十二星归位', '12-star homecoming'],
    'collection-note': ['每关首次通关，点亮一颗星。', 'Clear a level once to earn its star.'],
    'collection-done': ['十二关全部完成。十二颗星，属于你。', 'All twelve levels cleared. Every star is yours.'],
    'progress-label': ['已通关 {n} / 12', 'Cleared {n} / 12'],
    'challenge-title': ['十二关，从滑一次到互为挡板', 'Twelve levels, from one slide to mutual blocking'],
    daily: ['每日一局', 'Daily puzzle'],
    random: ['随机挑战', 'Random puzzle'],
    'extra-note': ['每日按北京时间生成，当天所有人拿到同一道题；每日与随机不点亮星星，也不计入固定关记录。', 'The daily puzzle is fixed by the Beijing date, so everyone gets the same board that day. Daily and random puzzles earn no stars and are not recorded with the fixed levels.'],
    'level-title-level': ['第 {n} 关 · {name}', 'Level {n} · {name}'],
    'level-title-daily': ['每日一局 · {date}', 'Daily puzzle · {date}'],
    'level-title-random': ['随机挑战', 'Random puzzle'],
    'board-meta': ['16 × 16 · {walls}', '16 × 16 · {walls}'],
    'walls-count': ['内墙 {n} 段', '{n} wall edges'],
    'walls-none': ['无内墙', 'No inner walls'],
    'layout-scatter': ['随机转角', 'Random corners'],
    'layout-open': ['无内墙', 'No inner walls'],
    'layout-bars': ['零散短墙', 'Scattered walls'],
    'layout-cross': ['十字长墙', 'Crossing walls'],
    'layout-rooms': ['环墙房间', 'Walled rooms'],
    'layout-lattice': ['分格墙', 'Latticed walls'],
    'layout-honey': ['错列横墙', 'Staggered walls'],
    'level-0': ['转角初阵', 'Corner opening'],
    'level-1': ['散布短墙', 'Scattered walls'],
    'level-2': ['错位通道', 'Offset lanes'],
    'level-3': ['交叉借位', 'Crossing routes'],
    'level-4': ['内圈四站', 'Four inner stops'],
    'level-5': ['隔墙协作', 'Wall cooperation'],
    'level-6': ['连环挡停', 'Stopper chains'],
    'level-7': ['四区换位', 'Four regions'],
    'level-8': ['折返迷阵', 'Return maze'],
    'level-9': ['长程借道', 'Long detour'],
    'level-10': ['深层合流', 'Deep confluence'],
    'level-11': ['四机终局', 'Four home'],
    'msg-start-title': ['四台同时到位才算完成', 'All four robots must be home at once'],
    'msg-start-text': ['每台机器人有同色同符号的目标格。机器人互为挡板，先想清楚哪一步要停在哪里。', 'Each robot has a target with its own colour and symbol. Robots block each other, so plan where every slide stops.'],
    'msg-play-title': ['继续安排挡板', 'Keep using the other robots'],
    'msg-play-text': ['已归位 {n} / 4，用了 {m} 步。已经到位的机器人仍然可以移动。', '{n} of 4 robots are home after {m} moves. A robot already on its target can still move.'],
    'won-title': ['四台机器人全部归位！', 'All four robots are home!'],
    'won-level': ['第 {n} 关完成，用了 {m} 步。', 'Level {n} cleared in {m} moves.'],
    'won-extra': ['本局用了 {m} 步。每日与随机不计入十二星。', 'Solved in {m} moves. Daily and random puzzles earn no stars.'],
    'cancel-title': ['已取消生成', 'Generation canceled'],
    'cancel-text': ['可以继续当前棋盘，或选择其他关卡。', 'Continue this board or choose another level.'],
    'cert-note': ['参考解 {n} 步：{moves}\n松弛下界 {b} 步。证书可以逐步回放；这个下界对任何解法都成立。', 'Reference route, {n} moves: {moves}\nRelaxed lower bound: {b} moves. The route replays step by step; the bound holds for every solution.'],
    'announce-move': ['机器人 {n} 向{dir}滑到 {cell}', 'Robot {n} slides {dir} to {cell}'],
    'announce-won': ['四台机器人全部归位', 'All four robots are home'],
    'robot-label': ['机器人 {n}，{name}，{cell}', 'Robot {n}, {name}, {cell}'],
    'target-label': ['机器人 {n} 的目标，{name}', 'Target for robot {n}, {name}'],
    'world-label': ['机器人棋盘，16 乘 16', 'Robot board, 16 by 16'],
    'level-pick': ['第 {n} 关 {name}', 'Level {n}, {name}'],
    'rules-title': ['玩法：机器人不会提前停下', 'Rules: a robot never stops early'],
    'rules-h1': ['一滑到底', 'One slide, all the way'],
    'rules-p1': ['点机器人选中它，再选方向：上、右、下、左。机器人会一直滑，直到撞上棋盘外墙、撞上内墙，或者被另一台机器人挡住，停在它前面一格。中途不能主动停下。', 'Select a robot, then a direction: up, right, down or left. The robot keeps sliding until it hits the outer edge, an inner wall, or another robot, and stops in the cell before it. It cannot stop early.'],
    'rules-p2': ['机器人不能被推动。滑行方向上如果紧挨着另一台机器人，这一步不合法，也不会计入步数。', 'Robots cannot be pushed. If another robot stands directly next to it in that direction, the move is illegal and does not count as a step.'],
    'rules-p3': ['内墙在格子边上，两侧一致：这条边对两边的格子都算墙。', 'Inner walls sit on cell edges and both sides agree: the edge blocks the cells on either side.'],
    'rules-h2': ['四台同时到位才算完成', 'All four robots must be home'],
    'rules-p4': ['每台机器人有自己的颜色和符号，棋盘上有同色同符号的目标格。四台同时停在各自的目标上，本关完成。已经到位的机器人仍然可以移动，你可以把它滑开再滑回来，它不会被锁住。', 'Every robot has its own colour and symbol, and the board carries a matching target for each one. The level is cleared when all four stand on their own targets at the same time. A robot that is already home can still move; you can slide it away and bring it back, and it is never locked.'],
    'rules-p5': ['每关首次通关点亮一颗星，并记录你用的最少步数。撤销可以连续回退，重开回到本关初始局面，两者都不清除已得到的星星。', 'Clearing a level for the first time earns its star and records your fewest moves. Undo steps back one move at a time and restart returns to the opening position; neither removes stars you already earned.'],
    'rules-p6': ['键盘：1–4 选中机器人，方向键或 WASD 滑行，Z 撤销，R 重开。手机上可以点机器人，也可以直接在棋盘上朝一个方向划动。', 'Keyboard: 1–4 selects a robot, arrow keys or WASD slide it, Z undoes and R restarts. On a phone, tap a robot or swipe across the board in the direction you want.'],
    'math-title': ['数学与算法：配置图、下界与有解构造', 'Math and algorithms: the configuration graph, bounds, and construction'],
    'math-h1': ['完整状态要四台一起看', 'The full state is all four robots at once'],
    'math-p1': ["四台有标号机器人的位置四元组构成完整状态。中央四格被障碍占据，四台机器人互不重叠，因此 252 个可进入格上的状态数不超过 252 × 251 × 250 × 249 = 3 937 437 000，约 3.94 × 10⁹。", "The ordered positions of four labelled robots form a complete state. With four blocked center cells and no shared cells, the 252 accessible cells admit at most 252 × 251 × 250 × 249 = 3,937,437,000 states, about 3.94 × 10⁹."],
    'math-p2': ['一次滑行只动一台机器人，但四元组整体改变：机器人互为挡板，移动一台就改变了其他机器人接下来能滑到哪里。目标因此是联合条件，先到目标的机器人不算完成，它随时可能被再次移动。', 'A slide moves one robot, but the quadruple changes as a whole: robots are each other\'s stoppers, so moving one changes where the others can slide next. The goal is therefore a joint condition. A robot that arrives first does not finish the puzzle, and it can be moved again at any time.'],
    'math-p3': ['在这张配置图上做广度优先搜索可以得到最少滑动次数。3.94 × 10⁹ 量级的图不适合逐点展开，本游戏也不要求最少步数，所以实现走相反的路线：先滑出一条合法路线，用它证明这道题有解。', 'Breadth-first search over this configuration graph gives the fewest slides. A graph of about 3.94 × 10⁹ states cannot be expanded cell by cell, and this game does not ask for the fewest slides, so the implementation goes the other way: it slides a legal route first and uses that route as the proof that the puzzle is solvable.'],
    'math-h2': ['先走出路线，再定下目标', 'Walk a route first, then fix the targets'],
    'math-p4': ["棋盘由分散的 L 形短墙、边缘挡板和中央障碍组成。生成器随机滑出一条合法路线，把终局里四台机器人的位置作为各自目标，并保存路线以证明有解。四个目标都在内部，至少一个目标四边没有固定墙，必须借助另一台机器人挡停；后六关至少有两个这样的目标。固定十二关保存已核验的题目，随机与每日题也须通过下界和借位条件筛选。", "Boards combine scattered L-shaped walls, edge stubs, and a central obstacle. The generator follows a legal random route and uses the final robot positions as targets, retaining the route as a solvability certificate. All four targets are internal. At least one has no adjacent fixed wall and requires another robot as a stopper; the final six levels require at least two. The twelve fixed puzzles are verified in advance. Daily and random puzzles also pass lower-bound and stopper requirements."],
    'math-p5': ['难度用下界衡量。把其他机器人拿掉、并且允许滑到任意一格停下，这时每台机器人的最少滑动次数是它在原问题里所需步数的下界（原问题的每一步在松弛模型里都合法），四台相加就是总步数的下界。只把其他机器人拿掉、仍要求滑到挡板前才停的距离不能当界：挡板有时正好把机器人停在你想要的位置，去掉挡板反而更难。', 'Difficulty is measured by a lower bound. Remove the other robots and let a robot stop on any cell along its slide: the fewest slides in this relaxed model is a lower bound on the slides that robot needs in the real puzzle, because every real slide is legal there. Summing the four bounds gives a lower bound on the total. Dropping the other robots while still requiring a run to the stopper is not a bound: a stopper can hold a robot exactly where you want it, so removing it can make the puzzle harder.'],
    'math-p6': ["松弛模型里每台机器人在 252 个可进入格上做广度优先搜索，四台距离相加得到总下界。新版十二关的下界为 10–15 步。页面同时给出证书步数与下界：证书是一条 N 步的合法解，下界说明任何解法至少需要 M 步；证书长度不等于最少步数。", "Breadth-first search over the 252 accessible cells gives each relaxed distance; their sum bounds the total. The twelve revised levels have bounds of 10–15 slides. The page shows both the certificate length and the bound: a certificate is a legal N-slide solution, while every solution needs at least M slides. Certificate length does not establish the minimum."],
    'source-note': ['玩法来源：ricocheto.com 的 chain 与规则说明。', 'Source: the chain game and its rules guide at ricocheto.com.'],
    'footer-left': ['灵感：ricocheto.com · 机器人滑行', 'Inspired by ricocheto.com · sliding robots'],
    'footer-right': ['离线可玩 · 每道题附可回放证书', 'Playable offline · every puzzle ships with a replayed certificate'],
    'storage-note': ['浏览器无法保存记录；本次打开期间仍可收集星星。', 'This browser cannot save records. Stars still count until you close the page.'],
    cleared: ['已通关', 'Cleared'],
    'not-cleared': ['未通关', 'Not cleared'],
    'load-failed': ['关卡未能载入', 'The level did not load'],
    'load-failed-text': ['请重新打开页面，或改选其他固定关卡。', 'Reload the page, or pick another fixed level.']
  };

  let language = (() => {
    try { const saved = localStorage.getItem('yaozi.home.language'); if (saved === 'zh' || saved === 'en') return saved; } catch {}
    return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  })();
  const t = key => {
    const entry = DICT[key];
    if (!entry) return key;
    return language === 'zh' ? entry[0] : entry[1];
  };
  const fill = (key, values) => t(key).replace(/\{(\w+)\}/g, (whole, name) => (values[name] === undefined ? whole : String(values[name])));
  const robotName = index => NAMES[index][language === 'zh' ? 0 : 1];
  const coord = cell => String.fromCharCode(65 + cell[0]) + (cell[1] + 1);
  const dirWord = dir => (language === 'zh' ? { up: '上', right: '右', down: '下', left: '左' }[dir] : dir);
  const pct = value => (value * 100 / N) + '%';

  // ---------------------------------------------------------------- progress
  let storageAvailable = true;
  let recordArchive={},migrating=false;
  let records = Array.from({ length: MAX_LEVEL }, () => ({ won: false, best: null }));
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY));
    if (raw && raw.version === 1 && Array.isArray(raw.levels)) {
      recordArchive=raw.archive&&typeof raw.archive==='object'?raw.archive:{};
      migrating=raw.edition!==E.LEVEL_EDITION;
      if(migrating)recordArchive={...recordArchive,[raw.edition||'original-v1']:raw.levels};
      records = records.map((empty, index) => {
        const item = raw.levels[index], best = item && item.best;
        return {
          won: item ? item.won === true : false,
          best: !migrating && Number.isInteger(best) && best > 0 ? best : null
        };
      });
    }
  } catch {}
  try { localStorage.setItem(PROGRESS_KEY + '.probe', '1'); localStorage.removeItem(PROGRESS_KEY + '.probe'); }
  catch { storageAvailable = false; $('storage-note').hidden = false; }
  function save() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, edition:E.LEVEL_EDITION, levels: records, archive:recordArchive })); }
    catch { storageAvailable = false; $('storage-note').hidden = false; }
  }

  if(migrating&&storageAvailable)save();
  const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let motionPreference = null;
  try { const saved = localStorage.getItem(MOTION_KEY); if (['0', '80', '180'].includes(saved)) motionPreference = saved; } catch {}
  const slideDuration = () => {
    if (motionPreference !== null) return Number(motionPreference);
    return systemMotion.matches ? 0 : 180;
  };

  // ---------------------------------------------------------------- state
  let puzzle = null, state = null, initial = null, mode = 'level', levelIndex = 0;
  let moves = 0, history = [], moveLog = [], selected = 0, note = null, awarded = false;
  let animating = false, animationEpoch = 0, generating = false, generationEpoch = 0, randomCount = 6, dailyDate = null;
  let suppressClickUntil = 0, pointer = null, starFlash = null;
  const robotEls = [], targetEls = [], levelButtons = [], starSlots = [];
  const busy = () => animating || generating;

  // ---------------------------------------------------------------- board frames
  (function buildGrid() {
    const grid = $('cell-grid');
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const cell = document.createElement('i');
        if ((x + y) % 2) cell.className = 'alt';
        if((x===7||x===8)&&(y===7||y===8))cell.classList.add('blocked');
        grid.append(cell);
      }
    }
  })();

  function buildRobotPad() {
    const pad = $('robot-pad');
    for (let index = 0; index < E.ROBOT_COUNT; index++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'robot-btn r' + index;
      button.dataset.robot = String(index);
      button.innerHTML = '<span class="glyph">' + GLYPHS[index] + '</span><span class="num">' + (index + 1) + '</span>';
      button.addEventListener('click', () => { selected = index; note = null; render(); });
      pad.append(button);
    }
  }

  function buildLevels() {
    const shelf = $('star-shelf'), list = $('levels');
    for (let index = 0; index < MAX_LEVEL; index++) {
      const slot = document.createElement('div');
      slot.className = 'star-slot';
      slot.setAttribute('role', 'listitem');
      slot.innerHTML = STAR + '<span>' + (index + 1) + '</span>';
      shelf.append(slot);
      starSlots.push(slot);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'level';
      button.dataset.level = String(index);
      button.innerHTML = '<span class="level-number">' + (index + 1) + '</span><span class="level-main"><b></b><small></small></span>';
      button.addEventListener('click', () => loadLevel(index));
      list.append(button);
      levelButtons.push(button);
    }
  }
  buildRobotPad();
  buildLevels();

  // ---------------------------------------------------------------- rendering
  function placeRobots(instant) {
    if (!state) return;
    if (instant) BOARD.style.setProperty('--slide', '0ms');
    state.robots.forEach((cell, index) => {
      const element = robotEls[index];
      if (!element) return;
      element.style.setProperty('--rx', String(cell[0]));
      element.style.setProperty('--ry', String(cell[1]));
    });
    if (instant) { void BOARD.offsetWidth; BOARD.style.setProperty('--slide', slideDuration() + 'ms'); }
  }

  function drawHints(won) {
    const layer = $('hint-layer');
    layer.replaceChildren();
    if (won || animating || generating || selected === null || !state) return;
    for (const dir of E.DIR_KEYS) {
      const move = E.slide(state, selected, dir);
      if (!move) continue;
      const dot = document.createElement('i');
      dot.className = 'hint r' + selected;
      dot.style.setProperty('--hx', String(move.to[0]));
      dot.style.setProperty('--hy', String(move.to[1]));
      layer.append(dot);
    }
  }

  function render() {
    if (!state || !puzzle) return;
    const won = E.isWon(state);
    if (won && !awarded) { awarded = true; award(); }
    else if (!won) awarded = false;
    const onTarget = E.onTargetCount(state);
    $('stat-done').textContent = String(onTarget);
    $('stat-moves').textContent = String(moves);
    $('stat-cert').textContent = fill('move-unit', { n: puzzle.solution.length });
    $('stat-bound').textContent = fill('move-unit', { n: puzzle.meta.lower });
    const best = mode === 'level' ? records[levelIndex].best : null;
    $('stat-best').textContent = best === null ? '—' : fill('move-unit', { n: best });

    placeRobots(false);
    robotEls.forEach((element, index) => {
      const home = E.robotOnTarget(state, index);
      element.classList.toggle('settled', home);
      element.setAttribute('aria-pressed', String(selected === index));
      element.setAttribute('aria-label', fill('robot-label', { n: index + 1, name: robotName(index), cell: coord(state.robots[index]) }));
    });
    targetEls.forEach((element, index) => {
      element.classList.toggle('settled', E.robotOnTarget(state, index));
      element.setAttribute('aria-label', fill('target-label', { n: index + 1, name: robotName(index) }));
    });
    document.querySelectorAll('.robot-btn').forEach((button, index) => {
      button.setAttribute('aria-label', fill('robot-label', { n: index + 1, name: robotName(index), cell: coord(state.robots[index]) }));
    });
    drawHints(won);
    BOARD.classList.toggle('won', won);
    $('board').setAttribute('aria-busy', String(busy()));
    $('undo').disabled = history.length === 0 || generating;
    $('next').hidden = !(won && mode === 'level' && levelIndex < MAX_LEVEL - 1);
    $('dir-center').textContent = String(selected + 1);
    $('dir-center').style.setProperty('--paint', 'var(--r' + selected + ')');
    $('selection-note').textContent = note !== null ? t(note)
      : selected === null ? t('ready-hint')
        : fill('selected-note', { n: selected + 1, name: robotName(selected) });
    $('sequence').textContent = moveLog.length ? moveLog.map(entry => (entry.robot + 1) + ARROWS[entry.dir]).join(' ') : t('sequence-empty');

    if (won) message(t('won-title'), mode === 'level'
      ? fill('won-level', { n: levelIndex + 1, m: moves })
      : fill('won-extra', { m: moves }), 'won');
    else message(moves === 0 ? t('msg-start-title') : t('msg-play-title'), moves === 0
      ? t('msg-start-text')
      : fill('msg-play-text', { n: onTarget, m: moves }));

    $('board-meta').textContent = fill('board-meta', {
      walls: puzzle.walls.length ? fill('walls-count', { n: puzzle.walls.length }) : t('walls-none')
    });
    collection();
    renderCertificate();
  }

  function renderCertificate() {
    const text = puzzle.solution.map(step => (step.robot + 1) + ARROWS[step.dir]).join(' ');
    $('solution-note').textContent = fill('cert-note', { n: puzzle.solution.length, moves: text, b: puzzle.meta.lower });
  }

  function message(title, text, tone) {
    $('message-title').textContent = title;
    $('message-text').textContent = text;
    $('message').classList.toggle('won', tone === 'won');
    $('message').classList.toggle('error', tone === 'error');
  }

  function collection() {
    const cleared = records.filter(record => record.won).length;
    $('star-count').textContent = cleared + ' / 12';
    $('progress-label').textContent = fill('progress-label', { n: cleared });
    $('collection').classList.toggle('complete', cleared === MAX_LEVEL);
    $('collection-note').textContent = cleared === MAX_LEVEL ? t('collection-done') : t('collection-note');
    records.forEach((record, index) => {
      const state_text = record.won ? t('cleared') : t('not-cleared');
      starSlots[index].classList.toggle('earned', record.won);
      starSlots[index].classList.toggle('selected', mode === 'level' && levelIndex === index);
      starSlots[index].setAttribute('aria-label', fill('level-pick', { n: index + 1, name: t('level-' + index) }) + ' · ' + state_text);
      levelButtons[index].classList.toggle('done', record.won);
      levelButtons[index].setAttribute('aria-pressed', String(mode === 'level' && levelIndex === index));
      levelButtons[index].querySelector('b').textContent = t('level-' + index);
      levelButtons[index].querySelector('small').textContent = t('layout-' + E.LEVELS[index].layout);
      levelButtons[index].setAttribute('aria-label', fill('level-pick', { n: index + 1, name: t('level-' + index) }) + ' · ' + t('layout-' + E.LEVELS[index].layout) + ' · ' + state_text);
    });
  }

  function announce(text) { $('announcement').textContent = text; }

  // ---------------------------------------------------------------- puzzle setup
  function layoutPuzzle() {
    const walls = $('wall-layer'), targets = $('target-layer'), robots = $('robot-layer');
    walls.replaceChildren();
    for (const code of puzzle.walls) {
      const { x, y, axis } = E.decodeWall(code);
      const wall = document.createElement('i');
      wall.className = 'wall ' + (axis === 0 ? 'wall-v' : 'wall-h');
      if (axis === 0) { wall.style.left = pct(x + 1); wall.style.top = pct(y + 0.5); }
      else { wall.style.left = pct(x + 0.5); wall.style.top = pct(y + 1); }
      walls.append(wall);
    }
    targetEls.length = 0;
    targets.replaceChildren();
    puzzle.targets.forEach((cell, index) => {
      const element = document.createElement('i');
      element.className = 'target r' + index;
      element.style.setProperty('--tx', String(cell[0]));
      element.style.setProperty('--ty', String(cell[1]));
      const glyph = document.createElement('span');
      glyph.textContent = GLYPHS[index];
      element.append(glyph);
      targets.append(element);
      targetEls.push(element);
    });
    robotEls.length = 0;
    robots.replaceChildren();
    puzzle.robots.forEach((cell, index) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'robot r' + index;
      element.id = 'robot-' + index;
      element.dataset.robot = String(index);
      const disc = document.createElement('span');
      disc.className = 'disc';
      disc.textContent = GLYPHS[index];
      element.append(disc);
      element.addEventListener('click', event => {
        if (performance.now() < suppressClickUntil) { event.preventDefault(); return; }
        selected = index;
        note = null;
        render();
      });
      robots.append(element);
      robotEls.push(element);
    });
    BOARD.setAttribute('aria-label', t('world-label'));
  }

  function levelTitle() {
    if (mode === 'level') return fill('level-title-level', { n: levelIndex + 1, name: t('level-' + levelIndex) });
    if (mode === 'daily') return fill('level-title-daily', { date: dailyDate });
    return t('level-title-random');
  }

  function loadPuzzle(next, nextMode, index, date) {
    cancelGeneration();
    cancelAnimation();
    puzzle = JSON.parse(JSON.stringify(next));
    state = E.clone(puzzle);
    initial = E.clone(puzzle);
    mode = nextMode;
    levelIndex = index;
    dailyDate = date;
    moves = 0;
    history = [];
    moveLog = [];
    selected = 0;
    note = null;
    layoutPuzzle();
    placeRobots(true);
    $('level-title').textContent = levelTitle();
    render();
  }

  function loadLevel(index) {
    if (!Number.isInteger(index) || !E.LEVELS[index]) return false;
    loadPuzzle(E.generateLevel(index), 'level', index, null);
    return true;
  }

  // ---------------------------------------------------------------- moves
  function cancelAnimation() {
    animationEpoch++;
    animating = false;
  }

  function slide(robotIndex, dir) {
    if (!state || busy() || E.isWon(state)) return Promise.resolve(false);
    const move = E.slide(state, robotIndex, dir);
    if (!move) {
      note = 'blocked-note';
      render();
      return Promise.resolve(false);
    }
    history.push({ state: E.clone(state), moves, log: moveLog.slice() });
    state = E.applyMove(state, { robot: robotIndex, dir }).state;
    moves++;
    moveLog.push({ robot: robotIndex, dir, to: move.to.slice() });
    selected = robotIndex;
    note = null;
    const token = ++animationEpoch;
    animating = true;
    render();
    const duration = slideDuration();
    const wait = duration ? new Promise(resolve => setTimeout(resolve, duration)) : Promise.resolve();
    return wait.then(() => {
      if (token !== animationEpoch) return false;
      animating = false;
      if (E.isWon(state)) announce(t('announce-won'));
      else announce(fill('announce-move', { n: robotIndex + 1, dir: dirWord(dir), cell: coord(move.to) }));
      render();
      return true;
    });
  }

  function award() {
    if (mode !== 'level') return;
    const record = records[levelIndex];
    const first = !record.won;
    record.won = true;
    if (record.best === null || moves < record.best) record.best = moves;
    save();
    if (first) {
      const slot = starSlots[levelIndex];
      slot.classList.add('new-star');
      clearTimeout(starFlash);
      starFlash = setTimeout(() => slot.classList.remove('new-star'), 1200);
    }
  }

  function undo() {
    if (!history.length || generating) return;
    cancelAnimation();
    const entry = history.pop();
    state = entry.state;
    moves = entry.moves;
    moveLog = entry.log;
    note = null;
    render();
  }

  function restart() {
    if (!initial || generating) return;
    cancelAnimation();
    state = E.clone(initial);
    moves = 0;
    history = [];
    moveLog = [];
    note = null;
    placeRobots(true);
    render();
  }

  async function playSolution() {
    if (!puzzle || busy()) return false;
    for (const step of puzzle.solution) {
      if (E.isWon(state)) break;
      if (generating) return false;
      const ok = await slide(step.robot, step.dir);
      if (!ok) return false;
    }
    return E.isWon(state);
  }

  // ---------------------------------------------------------------- generation
  function cancelGeneration() {
    generationEpoch++;
    if (!generating) return;
    generating = false;
    $('busy').hidden = true;
    render();
  }

  async function generatePuzzle(nextMode) {
    cancelAnimation();
    cancelGeneration();
    const id = generationEpoch;
    generating = true;
    note = null;
    $('busy').hidden = false;
    $('busy-text').textContent = t('busy-build');
    render();
    const date = E.shanghaiDateString();
    const tier = nextMode === 'daily' ? E.dailyTier(date) : (randomCount % MAX_LEVEL);
    if (nextMode === 'random') randomCount++;
    const seed = nextMode === 'daily'
      ? 'robots-daily:' + date
      : 'robots-random:' + Date.now() + ':' + randomCount + ':' + Math.random();
    const iterator = E.generateSteps(seed, E.levelOptions(tier));
    try {
      let step = iterator.next(), chunk = 0;
      while (!step.done) {
        if (id !== generationEpoch) return;
        if (++chunk % 6 === 0) await new Promise(resolve => setTimeout(resolve, 0));
        step = iterator.next();
      }
      if (id !== generationEpoch) return;
      generating = false;
      $('busy').hidden = true;
      loadPuzzle(step.value, nextMode, null, nextMode === 'daily' ? date : null);
    } catch (error) {
      if (id !== generationEpoch) return;
      generating = false;
      $('busy').hidden = true;
      render();
      message(t('cancel-title'), t('cancel-text'), 'error');
    }
  }

  // ---------------------------------------------------------------- input
  function cellFromPoint(clientX, clientY) {
    const rect = BOARD.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = Math.floor((clientX - rect.left) / (rect.width / N));
    const y = Math.floor((clientY - rect.top) / (rect.height / N));
    if (x < 0 || x >= N || y < 0 || y >= N) return null;
    return { x, y };
  }

  BOARD.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (busy() || !state) return;
    const cell = cellFromPoint(event.clientX, event.clientY);
    if (!cell) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, cell, swiped: false };
  });

  window.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId || pointer.swiped) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (Math.max(ax, ay) < 22 || Math.max(ax, ay) < Math.min(ax, ay) * 1.4) return;
    pointer.swiped = true;
    suppressClickUntil = performance.now() + 400;
    const dir = ax > ay ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    const robot = E.robotAt(state, pointer.cell.x, pointer.cell.y);
    if (robot >= 0) selected = robot;
    slide(selected, dir);
  });

  window.addEventListener('pointerup', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const cell = pointer.cell, swiped = pointer.swiped;
    pointer = null;
    if (swiped || performance.now() < suppressClickUntil) return;
    const robot = E.robotAt(state, cell.x, cell.y);
    if (robot >= 0) { selected = robot; note = null; render(); }
  });

  window.addEventListener('pointercancel', () => { pointer = null; });
  window.addEventListener('blur', () => { pointer = null; });

  document.querySelectorAll('[data-dir]').forEach(button => {
    button.addEventListener('click', () => slide(selected, button.dataset.dir));
  });
  $('undo').addEventListener('click', undo);
  $('restart').addEventListener('click', restart);
  $('next').addEventListener('click', () => {
    if (mode === 'level' && levelIndex < MAX_LEVEL - 1) loadLevel(levelIndex + 1);
  });
  $('daily').addEventListener('click', () => generatePuzzle('daily'));
  $('random').addEventListener('click', () => generatePuzzle('random'));
  $('cancel').addEventListener('click', () => {
    cancelGeneration();
    note = null;
    render();
    message(t('cancel-title'), t('cancel-text'));
  });
  $('motion').addEventListener('change', () => {
    motionPreference = $('motion').value;
    try { localStorage.setItem(MOTION_KEY, motionPreference); } catch {}
    cancelAnimation();
    BOARD.style.setProperty('--slide', slideDuration() + 'ms');
    render();
  });
  systemMotion.addEventListener('change', () => {
    if (motionPreference === null) {
      $('motion').value = systemMotion.matches ? '0' : '180';
      BOARD.style.setProperty('--slide', slideDuration() + 'ms');
      render();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable) return;
    const key = event.key.toLowerCase();
    if (key === 'z') { event.preventDefault(); undo(); return; }
    if (key === 'r') { event.preventDefault(); restart(); return; }
    if (/^[1-4]$/.test(key)) { selected = Number(key) - 1; note = null; render(); return; }
    const dir = {
      arrowup: 'up', w: 'up', arrowright: 'right', d: 'right',
      arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left'
    }[key];
    if (dir) { event.preventDefault(); slide(selected, dir); }
  });

  window.addEventListener('resize', () => { if (animating) cancelAnimation(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && animating) cancelAnimation(); });

  // ---------------------------------------------------------------- theme and language
  let themePreference = null;
  try { themePreference = localStorage.getItem('yaozi.home.theme'); } catch {}
  function themeColor() { return document.documentElement.dataset.theme === 'dark' ? '#0d1826' : '#edf3f9'; }
  function theme(value) {
    document.documentElement.dataset.theme = value;
    document.querySelector('meta[name="theme-color"]').content = themeColor();
    $('theme').setAttribute('aria-label', t(value === 'dark' ? 'theme-light' : 'theme-dark'));
  }
  theme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  $('theme').addEventListener('click', () => {
    themePreference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    theme(themePreference);
    try { localStorage.setItem('yaozi.home.theme', themePreference); } catch {}
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    if (!['light', 'dark'].includes(themePreference)) theme(event.matches ? 'dark' : 'light');
  });

  function applyLanguage() {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.dataset.language = language;
    document.querySelectorAll('[data-t]').forEach(element => { element.textContent = t(element.dataset.t); });
    document.querySelectorAll('[data-ta]').forEach(element => { element.setAttribute('aria-label', t(element.dataset.ta)); });
    document.title = t('doc-title');
    document.querySelector('meta[name="description"]').content = t('doc-description');
    const toggle = $('language-toggle');
    toggle.textContent = language === 'zh' ? 'EN' : '中文';
    toggle.setAttribute('aria-label', t('switch-language'));
    toggle.title = t('switch-language');
    $('theme').setAttribute('aria-label', t(document.documentElement.dataset.theme === 'dark' ? 'theme-light' : 'theme-dark'));
    $('motion').setAttribute('aria-label', t('motion-label'));
    if (state) {
      BOARD.setAttribute('aria-label', t('world-label'));
      $('level-title').textContent = levelTitle();
      render();
    }
  }
  $('language-toggle').addEventListener('click', () => {
    language = language === 'zh' ? 'en' : 'zh';
    try { localStorage.setItem('yaozi.home.language', language); } catch {}
    applyLanguage();
  });

  // ---------------------------------------------------------------- boot
  $('motion').value = motionPreference === null ? (systemMotion.matches ? '0' : '180') : motionPreference;
  BOARD.style.setProperty('--slide', slideDuration() + 'ms');
  applyLanguage();
  try { loadLevel(0); }
  catch (error) {
    message(t('load-failed'), t('load-failed-text'), 'error');
    $('level-title').textContent = t('load-failed');
  }

  window.RobotsGame = Object.freeze({
    loadLevel,
    ready: () => Boolean(state) && !animating && !generating,
    snapshot: () => JSON.parse(JSON.stringify({
      puzzle: puzzle ? {
        w: puzzle.w, h: puzzle.h, robots: puzzle.robots, targets: puzzle.targets, walls: puzzle.walls,
        layout: puzzle.layout, name: puzzle.name, seed: puzzle.seed, solution: puzzle.solution, meta: puzzle.meta
      } : null,
      state,
      moves,
      won: state ? E.isWon(state) : false,
      levelIndex: mode === 'level' ? levelIndex : null,
      mode,
      stars: records.map(record => record.won),
      records,
      selected,
      history: history.length,
      sequence: moveLog.slice(),
      certificate: puzzle ? puzzle.solution.slice() : null,
      certificateLength: puzzle ? puzzle.solution.length : 0,
      lowerBound: puzzle ? puzzle.meta.lower : null,
      dailyDate,
      seed: puzzle ? puzzle.seed : null,
      animating,
      generating,
      storageAvailable
    })),
    playSolution,
    play: (robot, dir) => slide(robot, dir),
    select: index => { if (Number.isInteger(index) && index >= 0 && index < E.ROBOT_COUNT) { selected = index; note = null; render(); } },
    cancelGeneration
  });
})();
