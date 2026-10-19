(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const E = window.HexEngine;
  const AI = window.HexAI;
  const Store = window.HexStore;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const SQRT3 = Math.sqrt(3);
  const MAX_LEVEL = 12;

  const DEFAULT_LEVELS = [
    { id: 1, size: 7, difficulty: 'easy', budgetMs: 100 },
    { id: 2, size: 7, difficulty: 'medium', budgetMs: 800 },
    { id: 3, size: 7, difficulty: 'high', budgetMs: 3000 },
    { id: 4, size: 9, difficulty: 'easy', budgetMs: 100 },
    { id: 5, size: 9, difficulty: 'medium', budgetMs: 1000 },
    { id: 6, size: 9, difficulty: 'high', budgetMs: 4000 },
    { id: 7, size: 11, difficulty: 'easy', budgetMs: 150 },
    { id: 8, size: 11, difficulty: 'medium', budgetMs: 1500 },
    { id: 9, size: 11, difficulty: 'high', budgetMs: 5000 },
    { id: 10, size: 13, difficulty: 'easy', budgetMs: 200 },
    { id: 11, size: 13, difficulty: 'medium', budgetMs: 2000 },
    { id: 12, size: 13, difficulty: 'high', budgetMs: 6000 }
  ];
  const LEVELS = Array.isArray(Store && Store.LEVELS) && Store.LEVELS.length === MAX_LEVEL ? Store.LEVELS : DEFAULT_LEVELS;
  const FREE_BUDGET = { easy: 250, medium: 1600, high: 4500 };

  const DICT = {
    'doc-title': ['HEX XII · 连接你的两条边界', 'HEX XII · Connect your two edges'],
    'doc-description': [
      'HEX XII：在 7×7 到 13×13 的六边形棋盘上连接两条边界。十二关、三档 AI、自由对局与局面分析。',
      'HEX XII: connect two edges on a 7×7 to 13×13 hex board. Twelve levels, three AI tiers, free play, and board analysis.'
    ],
    'switch-language': ['切换语言', 'Switch language'],
    'theme-light': ['切换至浅色模式', 'Switch to light mode'],
    'theme-dark': ['切换至深色模式', 'Switch to dark mode'],
    back: ['← 游戏主页', '← Games'],
    skip: ['跳到游戏', 'Skip to the game'],
    kicker: ['六边形 · 连接边界 · 十二关', 'Hexagons · Connect edges · Twelve levels'],
    tagline1: ['你执红，连接上下；AI 执蓝，连接左右。', 'You play red and join top to bottom. The AI plays blue and joins left to right.'],
    tagline2: ['先连成一条不断的线者获胜。', 'The first unbroken connection wins.'],
    'menu-section': ['开始对局', 'Start a game'],
    'campaign-title': ['闯关模式', 'Campaign'],
    'campaign-text': ['十二关依次提高棋盘尺寸与 AI 强度。胜出一关，解锁下一关。', 'Twelve levels step through larger boards and stronger AI. Win a level to unlock the next.'],
    'start-campaign': ['继续闯关', 'Continue campaign'],
    'start-campaign-n': ['继续闯关 · 第 {n} 关', 'Continue · Level {n}'],
    'free-title': ['自由对局', 'Free play'],
    'free-text': ['任选 7×7 到 13×13 与 AI 强度。悔棋、提示和局面分析只在自由对局可用。', 'Choose any board from 7×7 to 13×13 and any AI tier. Undo, hints, and analysis are available in free play.'],
    'free-size': ['棋盘', 'Board'],
    'free-difficulty': ['难度', 'AI'],
    'easy': ['入门', 'Easy'],
    medium: ['策略', 'Medium'],
    high: ['高级', 'High'],
    'start-free': ['开始自由对局', 'Start free game'],
    'motion-label': ['动画', 'Animation'],
    'motion-auto': ['跟随系统', 'Follow system'],
    'motion-off': ['关闭', 'Off'],
    'performance-label': ['性能', 'Performance'],
    'performance-balanced': ['均衡', 'Balanced'],
    'performance-fast': ['快速', 'Fast'],
    'performance-note': ['快速模式缩短 AI 思考预算，适合较慢的手机。', 'Fast mode shortens the AI budget for slower phones.'],
    'storage-note': ['浏览器无法保存进度；本次打开期间仍可继续游玩。', 'This browser cannot save progress. You can still play until the page closes.'],
    'board-section': ['六边形棋盘', 'Hex board'],
    'side-section': ['对局状态', 'Game status'],
    'legend-red': ['红方 · 上下', 'Red · top to bottom'],
    'legend-blue': ['蓝方 · 左右', 'Blue · left to right'],
    'legend-last': ['最后一手', 'Last move'],
    'legend-win': ['获胜连线', 'Winning path'],
    'legend-bridge': ['双桥', 'Bridge'],
    'legend-candidate': ['关键候选', 'Key candidate'],
    'stat-red': ['你的棋子', 'Your stones'],
    'stat-blue': ['AI 棋子', 'AI stones'],
    'stat-time': ['用时', 'Time'],
    'stat-ai': ['AI 思考', 'AI time'],
    'stat-moves': ['你的落子', 'Your moves'],
    'menu-button': ['返回菜单', 'Menu'],
    next: ['下一关 →', 'Next level →'],
    undo: ['撤销', 'Undo'],
    restart: ['重开', 'Restart'],
    hint: ['提示', 'Hint'],
    'analysis-toggle': ['显示局面分析', 'Show board analysis'],
    'analysis-section': ['局面分析', 'Board analysis'],
    'analysis-title': ['局面分析', 'Board analysis'],
    'estimate-tag': ['估算', 'ESTIMATE'],
    'ana-red-distance': ['红方连接距离', 'Red connection distance'],
    'ana-blue-distance': ['蓝方连接距离', 'Blue connection distance'],
    'ana-bridges': ['已形成双桥', 'Bridges formed'],
    'ana-winrate': ['搜索胜率估计', 'Estimated search win rate'],
    'ana-candidates': ['关键候选', 'Key candidates'],
    'analysis-note': [
      '距离按经过的空格数计；双桥与候选为启发式提示；胜率来自 AI 搜索，是估计值。',
      'Distance counts empty cells crossed. Bridges and candidates are heuristic markers. The win rate is an AI-search estimate.'
    ],
    'challenges-section': ['十二关挑战', 'Twelve-level challenges'],
    'memorial-kicker': ['12 / 12', '12 / 12'],
    'memorial-title': ['HEX XII 全通关', 'HEX XII complete'],
    'memorial-text': ['从 7×7 到 13×13，你赢下了全部十二关。棋盘没有平局，每一局都有胜负。', 'From 7×7 to 13×13, you won all twelve levels. The board has no draws; every game is decided.'],
    'challenge-title': ['十二关，四种棋盘，三档 AI', 'Twelve levels, four boards, three AI tiers'],
    'challenge-note': ['每行对应一种棋盘尺寸，每列对应一档 AI。胜出一关即可解锁下一关。', 'Each row is one board size and each column one AI tier. Winning a level unlocks the next.'],
    'progress-label-value': ['已通关 {c} / 12', 'Cleared {c} / 12'],
    'menu-campaign-summary': ['已解锁 {u} / 12 · 已通关 {c} / 12', '{u} of 12 unlocked · {c} of 12 cleared'],
    'group-label': ['{size} × {size}', '{size} × {size}'],
    'level-state-locked': ['锁定', 'Locked'],
    'level-state-completed': ['已通关', 'Cleared'],
    'level-state-open': ['未通关', 'Open'],
    'level-record': ['{a} 次挑战 · {w} 胜', '{a} attempts · {w} wins'],
    'level-best': ['最佳 {m} 手 · {t}', 'Best {m} moves · {t}'],
    'level-best-none': ['尚无最佳记录', 'No best record yet'],
    'level-aria': ['第 {n} 关，{size} × {size}，{diff}，{state}。{record}', 'Level {n}, {size} × {size}, {diff}, {state}. {record}'],
    'level-title-level': ['第 {n} 关', 'Level {n}'],
    'level-title-free': ['自由对局', 'Free play'],
    'board-meta-campaign': ['{size} × {size} · {diff}', '{size} × {size} · {diff}'],
    'board-meta-free': ['自由对局 · {size} × {size} · {diff}', 'Free play · {size} × {size} · {diff}'],
    'cell-empty': ['{coord}，空格', '{coord}, empty'],
    'cell-red': ['{coord}，红方棋子', '{coord}, red stone'],
    'cell-blue': ['{coord}，蓝方棋子', '{coord}, blue stone'],
    'cell-last': ['，最后一手', ', last move'],
    'turn-red': ['红方落子', 'Red to play'],
    'turn-blue': ['蓝方思考', 'Blue thinking'],
    'turn-won': ['你获胜', 'You won'],
    'turn-lost': ['AI 获胜', 'AI won'],
    'thinking-text': ['蓝方正在搜索落点…', 'Blue is searching for a move…'],
    'thinking-progress': ['蓝方已模拟 {it} 次 · 估计胜率 {pct}%', 'Blue has simulated {it} playouts · estimated win rate {pct}%'],
    'msg-start-title': ['轮到你落子', 'Your move'],
    'msg-start-text': ['你执红，把上边和下边连起来。', 'You play red. Join the top edge to the bottom edge.'],
    'msg-turn-title': ['轮到你了', 'Your turn'],
    'msg-turn-text': ['蓝方落在 {coord}。红方继续连接上下两边。', 'Blue played {coord}. Keep joining the top and bottom edges.'],
    'msg-thinking-title': ['蓝方思考中', 'Blue is thinking'],
    'msg-thinking-text': ['棋盘保持可操作，AI 的计算在后台进行。', 'The board stays responsive while the AI computes in the background.'],
    'msg-won-title': ['红线连通，你赢了', 'Red connects. You win'],
    'msg-won-campaign': ['第 {n} 关完成。用时 {time}，你落了 {m} 手。', 'Level {n} cleared in {time} with {m} moves.'],
    'msg-won-free': ['自由对局获胜。用时 {time}，你落了 {m} 手。', 'Free game won in {time} with {m} moves.'],
    'msg-lost-title': ['蓝线连通，AI 获胜', 'Blue connects. The AI wins'],
    'msg-lost-campaign': ['可以重开本关，或返回菜单换一关。', 'Restart this level or return to the menu for another one.'],
    'msg-lost-free': ['可以悔棋、重开，或换一个难度。', 'Undo, restart, or try another AI tier.'],
    'hint-title': ['提示', 'Hint'],
    'hint-text': ['建议落在 {coord}，基于一步连接距离估算。', 'Suggested move: {coord}, based on a one-ply connection estimate.'],
    'hint-note': ['提示：{coord}（快速估算）', 'Hint: {coord} (quick estimate)'],
    'hint-none': ['没有可提示的空格。', 'No empty cell to suggest.'],
    'zoom-in': ['放大棋盘', 'Enlarge board'],
    'zoom-out': ['适应整盘', 'Fit board'],
    'zoom-hint': ['棋盘已放大：可左右滑动查看，页面仍可双指缩放。', 'Board enlarged: scroll to see the rest. Page pinch-zoom still works.'],
    'board-help': ['点空格落子。方向键移动焦点，Enter 或空格确认。', 'Tap an empty cell to play. Arrow keys move focus; Enter or Space plays.'],
    'announce-you': ['你在 {coord} 落子', 'You played {coord}'],
    'announce-ai': ['蓝方在 {coord} 落子', 'Blue played {coord}'],
    'announce-win': ['红线连通，你赢了', 'Red is connected. You win'],
    'announce-loss': ['蓝线连通，AI 获胜', 'Blue is connected. The AI wins'],
    'announce-undo': ['已撤销上一轮落子', 'The last round was undone'],
    'guess-start': ['AI 已落子', 'The AI has played'],
    'winrate-value': ['{pct}%（蓝方视角）', '{pct}% (blue view)'],
    'winrate-none': ['尚未估算', 'Not estimated yet'],
    'distance-value': ['{d} 空', '{d} empty'],
    'distance-unreachable': ['不可达', 'Unreachable'],
    'bridge-value': ['红 {r} · 蓝 {b}', 'Red {r} · Blue {b}'],
    'candidate-value': ['{coords}', '{coords}'],
    'rules-title': ['玩法：把两条边连成一条线', 'Rules: join two opposite edges'],
    'rules-h1': ['红连上下，蓝连左右', 'Red joins top to bottom'],
    'rules-p1': ['你执红棋，目标是把上边和下边用连续的红棋连起来。AI 执蓝棋，目标是把左边和右边连起来。斜对角相邻的格子也算相连。', 'You play red and join the top edge to the bottom edge with connected red stones. The AI plays blue and joins the left edge to the right edge. Diagonal neighbours count as connected.'],
    'rules-p2': ['点击空格落子，红方先手，之后与 AI 轮流落子。棋子落下后不能移动，也不能被吃掉。任意一方先连成目标边界就获胜；Hex 棋盘不会出现平局。', 'Tap an empty cell. Red moves first, then you alternate with the AI. Stones never move or get captured. The first side to connect its target edges wins, and Hex has no draws.'],
    'rules-p3': ['棋盘边长从 7 到 13。手机上的大棋盘可以点“放大棋盘”，左右滑动查看，页面本身仍可双指缩放。', 'Boards run from 7 to 13 per side. On a phone, use Enlarge board and scroll to inspect a large board. Page pinch-zoom remains available.'],
    'rules-h2': ['闯关与自由对局', 'Campaign and free play'],
    'rules-p4': ['闯关模式共十二关，按 7×7、9×9、11×11、13×13 排列，每档尺寸都有入门、策略、高级三关。胜出一关会解锁下一关，并记录挑战次数、胜场和最佳用时。', 'The campaign has twelve levels: 7×7, 9×9, 11×11, and 13×13, each with Easy, Medium, and High tiers. A win unlocks the next level and records attempts, wins, and your best time.'],
    'rules-p5': ['自由对局可以任选尺寸和 AI 难度，并开启悔棋、提示和局面分析。闯关模式不提供这些辅助，成绩直接计入十二关记录。', 'Free play allows any size and AI tier, with undo, hints, and analysis. The campaign omits those aids and records its games in the twelve-level table.'],
    'rules-p6': ['操作：点击或触摸空格落子；方向键移动焦点，Enter 或空格落子；Z 悔棋（自由对局），R 重开。', 'Controls: tap or click an empty cell. Arrow keys move focus; Enter or Space plays. Z undoes in free play, R restarts.'],
    'math-title': ['数学与算法：连接、双桥与搜索', 'Math and algorithms: connection, bridges, search'],
    'math-h1': ['连接距离', 'Connection distance'],
    'math-p1': ['把棋盘看成图：每个格子是一个顶点，六个方向相邻就有边。己方棋子通过成本为 0，空格为 1，对方棋子不可通过。用 0-1 BFS 可以求出从一侧边界到另一侧边界的最小连接成本，页面分析中的“连接距离”就是这个数。', 'View the board as a graph: one vertex per cell, an edge between the six neighbours. Your stones cost 0 to cross, empty cells cost 1, and enemy stones are blocked. A 0-1 BFS gives the minimum connection cost between the two target edges, which is the connection distance shown in analysis.'],
    'math-p2': ['双桥由两枚不相邻的同色棋子和两个共享的空格邻居组成。对手占据其中一格时，可以用另一格把两枚棋子连起来。分析模式会标出双方的双桥结构。', 'A bridge consists of two nonadjacent friendly stones with two shared empty neighbours. If the opponent takes one carrier, you can connect through the other. Analysis marks these structures for both sides.'],
    'math-p3': ['Hex 的策略窃取论证说明，标准对称棋盘存在先手必胜策略。本游戏始终由红方先手，蓝方 AI 在给定思考预算内搜索应对。', 'The strategy-stealing argument establishes a first-player winning strategy on the standard symmetric board. Red always plays first here, and the blue AI searches for a response within its thinking budget.'],
    'math-h2': ['AI 怎样选点', 'How the AI chooses'],
    'math-p4': ['入门 AI 用连接距离给候选点排序，并在一批较优点中带权随机选择。策略 AI 用蒙特卡洛树搜索（UCT）配合带双桥倾向的随机模拟。高级 AI 在此基础上加入 RAVE/AMAF 统计和更强的边界、双桥先验，用更多模拟换取更稳的落点。', 'Easy AI ranks candidates by connection distance and picks among the better ones with weighted randomness. Medium AI runs Monte Carlo tree search with UCT and bridge-biased playouts. High AI adds RAVE/AMAF statistics and stronger edge and bridge priors, spending more playouts for a steadier move.'],
    'math-p5': ['分析面板里的“搜索胜率”是搜索树给出的估计值，不是严格的数学获胜概率。关键候选由一层的连接距离变化给出，用来帮助理解局面，不构成胜负证明。', 'The search win rate in analysis is the tree search’s estimate, not an exact mathematical probability. Key candidates come from one-ply changes in connection distance and help you read the position; they are not a proof of the result.'],
    'math-p6': ['每关的 AI 思考预算固定，性能模式会缩短预算。计算在 Web Worker 中运行；浏览器不支持 Worker 时改用异步回退，页面保持可操作。', 'Each level fixes an AI thinking budget, and fast performance mode shortens it. Search runs in a Web Worker; when Workers are unavailable, an asynchronous fallback keeps the page responsive.'],
    'footer-left': ['灵感：Hex · 六边形连接棋', 'Inspired by Hex'],
    'footer-right': ['离线可玩 · 十二关进度保存在本机', 'Playable offline · campaign progress stays on this device'],
    'final-kicker': ['12 / 12', '12 / 12'],
    'final-title': ['HEX XII 全通关', 'HEX XII complete'],
    'final-text': ['四种棋盘尺寸，三档 AI，十二关全部获胜。棋盘不会给出平局，这十二场分出胜负的连线属于你。', 'Four board sizes, three AI tiers, twelve wins. The board allows no draws, and all twelve decided connections are yours.'],
    'final-close': ['回到棋盘', 'Back to the board']
  };

  let language = (() => {
    try {
      const saved = localStorage.getItem('yaozi.home.language');
      if (saved === 'zh' || saved === 'en') return saved;
    } catch {}
    return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  })();
  const t = key => {
    const entry = DICT[key];
    if (!entry) return key;
    return language === 'zh' ? entry[0] : entry[1];
  };
  const fill = (key, values) => t(key).replace(/\{(\w+)\}/g, (whole, name) => values[name] === undefined ? whole : String(values[name]));
  const diffName = value => t(value === 'medium' ? 'medium' : value === 'high' ? 'high' : 'easy');
  const coordOf = index => {
    const size = game ? game.size : 7;
    const row = Math.floor(index / size), col = index % size;
    return String.fromCharCode(65 + col) + (row + 1);
  };
  const formatTime = ms => {
    const total = Math.max(0, Math.floor(ms / 1000));
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
  };
  const formatAI = ms => (Math.max(0, ms) / 1000).toFixed(1) + ' s';

  // ------------------------------------------------------------- progress and settings
  const emptyProgress = () => ({
    version: 1,
    unlocked: 1,
    levels: Array.from({ length: MAX_LEVEL }, () => ({ attempts: 0, wins: 0, best: null, last: null }))
  });
  let progress = emptyProgress();
  if (Store && typeof Store.load === 'function') {
    try {
      const loaded = Store.load();
      if (loaded && Array.isArray(loaded.levels)) progress = loaded;
    } catch {}
  }
  if (!Array.isArray(progress.levels) || progress.levels.length !== MAX_LEVEL) {
    const safe = emptyProgress();
    safe.unlocked = Math.min(MAX_LEVEL, Math.max(1, Number(progress.unlocked) || 1));
    progress = safe;
  }
  const recordOf = id => progress.levels[id - 1] || { attempts: 0, wins: 0, best: null, last: null };
  const completedCount = () => Store && typeof Store.completed === 'function'
    ? (() => { try { return Store.completed(progress); } catch { return progress.levels.filter(level => level.wins > 0).length; } })()
    : progress.levels.filter(level => level.wins > 0).length;
  const beginAttempt = id => {
    if (Store && typeof Store.begin === 'function') {
      try { const next = Store.begin(progress, id); if (next) progress = next; return; } catch {}
    }
    const record = progress.levels[id - 1];
    if (record) record.attempts = (record.attempts || 0) + 1;
  };
  const finishAttempt = (id, result) => {
    const before = completedCount();
    if (Store && typeof Store.finish === 'function') {
      try { const next = Store.finish(progress, id, result); if (next) progress = next; } catch {}
    } else {
      const record = progress.levels[id - 1];
      if (record) {
        if (result.won) {
          record.wins = (record.wins || 0) + 1;
          if (!record.best || result.durationMs < record.best.durationMs || (result.durationMs === record.best.durationMs && result.moves < record.best.moves)) {
            record.best = { moves: result.moves, durationMs: result.durationMs, aiMs: result.aiMs };
          }
          if (id < MAX_LEVEL) progress.unlocked = Math.max(progress.unlocked || 1, id + 1);
        }
        record.last = result;
      }
    }
    return { before, after: completedCount() };
  };

  let settings = { motion: 'auto', performance: 'balanced', analysis: false };
  if (Store && typeof Store.loadSettings === 'function') {
    try {
      const loaded = Store.loadSettings();
      if (loaded && typeof loaded === 'object') settings = { ...settings, ...loaded };
    } catch {}
  }
  if (!['auto', 'off'].includes(settings.motion)) settings.motion = 'auto';
  if (!['balanced', 'fast'].includes(settings.performance)) settings.performance = 'balanced';
  settings.analysis = settings.analysis === true;
  const saveSettings = () => {
    if (Store && typeof Store.saveSettings === 'function') {
      try { Store.saveSettings(settings); } catch {}
    }
  };

  let storageAvailable = true;
  try {
    localStorage.setItem('yaozi.hex.probe', '1');
    localStorage.removeItem('yaozi.hex.probe');
  } catch {
    storageAvailable = false;
    $('storage-note').hidden = false;
  }

  const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const motionOff = () => settings.motion === 'off' || (settings.motion === 'auto' && systemMotion.matches);
  const applyMotion = () => { document.documentElement.dataset.motion = motionOff() ? 'off' : 'on'; };
  applyMotion();
  systemMotion.addEventListener('change', () => { if (settings.motion === 'auto') applyMotion(); });

  // ------------------------------------------------------------- state
  let game = null;
  let focusIndex = 0;
  let searchToken = 0;
  let activeWorker = null;
  let activeCancel = null;
  let clockTimer = null;
  let animTimers = [];
  let zoomOn = false;
  let zoomManual = false;
  let evaluationCache = { key: '', candidates: [] };
  const cells = [];
  let pathLayer = null, cellLayer = null, markerLayer = null;

  if (!E) {
    const title = $('campaign-summary');
    if (title) title.textContent = '游戏引擎未能加载，请重新打开页面。';
    return;
  }

  // ------------------------------------------------------------- translation
  function applyLanguage() {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.dataset.language = language;
    document.querySelectorAll('[data-t]').forEach(element => { element.textContent = t(element.dataset.t); });
    document.querySelectorAll('[data-ta]').forEach(element => { element.setAttribute('aria-label', t(element.dataset.ta)); });
    document.title = t('doc-title');
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = t('doc-description');
    const toggle = $('language-toggle');
    toggle.textContent = language === 'zh' ? 'EN' : '中文';
    toggle.setAttribute('aria-label', t('switch-language'));
    toggle.title = t('switch-language');
    $('theme').setAttribute('aria-label', t(document.documentElement.dataset.theme === 'dark' ? 'theme-light' : 'theme-dark'));
    $('undo').innerHTML = t('undo') + ' <kbd>Z</kbd>';
    $('restart').innerHTML = t('restart') + ' <kbd>R</kbd>';
    $('hint').textContent = t('hint');
    $('analysis-note').textContent = t('analysis-note');
    $('final-kicker').textContent = t('final-kicker');
    $('final-title').textContent = t('final-title');
    $('final-text').textContent = t('final-text');
    $('close-final').textContent = t('final-close');
    updateCampaignSummary();
    renderLevels();
    if (game) {
      $('board-svg').setAttribute('aria-label', t('board-section'));
      renderAll();
    } else {
      updateZoomButton();
    }
  }

  // ------------------------------------------------------------- theme
  let themePreference = null;
  try { themePreference = localStorage.getItem('yaozi.home.theme'); } catch {}
  function themeColor() { return document.documentElement.dataset.theme === 'dark' ? '#0d1826' : '#edf3f9'; }
  function theme(value) {
    document.documentElement.dataset.theme = value;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = themeColor();
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

  // ------------------------------------------------------------- menu construction
  (function buildFreeSizes() {
    const select = $('free-size');
    for (let size = 7; size <= 13; size++) {
      const option = document.createElement('option');
      option.value = String(size);
      option.textContent = size + ' × ' + size;
      select.append(option);
    }
    select.value = '9';
  })();

  const levelCards = [];
  (function buildLevels() {
    const container = $('levels');
    const sizes = [7, 9, 11, 13];
    sizes.forEach(size => {
      const group = document.createElement('div');
      group.className = 'level-group';
      const label = document.createElement('div');
      label.className = 'group-label';
      label.textContent = fill('group-label', { size });
      group.append(label);
      const row = document.createElement('div');
      row.className = 'level-row';
      LEVELS.filter(level => level.size === size).sort((a, b) => a.id - b.id).forEach(level => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'level';
        button.dataset.level = String(level.id);
        button.innerHTML = '<span class="level-top"><span class="level-id">' + String(level.id).padStart(2, '0') + '</span><span class="level-diff"></span><span class="level-state"></span></span><span class="level-record"></span><span class="level-best"></span>';
        button.addEventListener('click', () => {
          const id = Number(button.dataset.level);
          if (id <= (progress.unlocked || 1)) startCampaign(id);
        });
        row.append(button);
        levelCards.push({ button, level });
      });
      group.append(row);
      container.append(group);
    });
  })();

  function updateCampaignSummary() {
    const completed = completedCount();
    const unlocked = Math.min(MAX_LEVEL, Math.max(1, Number(progress.unlocked) || 1));
    $('campaign-summary').textContent = fill('menu-campaign-summary', { u: unlocked, c: completed });
    $('progress-label').textContent = fill('progress-label-value', { c: completed });
    $('memorial').hidden = completed < MAX_LEVEL;
    const start = $('start-campaign');
    start.textContent = fill('start-campaign-n', { n: suggestedLevel() });
  }

  function suggestedLevel() {
    const unlocked = Math.min(MAX_LEVEL, Math.max(1, Number(progress.unlocked) || 1));
    for (let id = 1; id <= unlocked; id++) if ((recordOf(id).wins || 0) === 0) return id;
    return unlocked;
  }

  function renderLevels() {
    levelCards.forEach(({ button, level }) => {
      const record = recordOf(level.id);
      const unlocked = level.id <= (progress.unlocked || 1);
      const completed = (record.wins || 0) > 0;
      button.disabled = !unlocked;
      button.classList.toggle('locked', !unlocked);
      button.classList.toggle('completed', completed);
      button.classList.toggle('current', Boolean(game && game.mode === 'campaign' && game.levelId === level.id));
      const stateName = !unlocked ? t('level-state-locked') : completed ? t('level-state-completed') : t('level-state-open');
      button.querySelector('.level-diff').textContent = diffName(level.difficulty);
      button.querySelector('.level-state').textContent = stateName;
      button.querySelector('.level-record').textContent = fill('level-record', { a: record.attempts || 0, w: record.wins || 0 });
      const best = record.best;
      button.querySelector('.level-best').textContent = best
        ? fill('level-best', { m: best.moves, t: formatTime(best.durationMs) })
        : t('level-best-none');
      button.setAttribute('aria-label', fill('level-aria', {
        n: level.id, size: level.size, diff: diffName(level.difficulty), state: stateName,
        record: fill('level-record', { a: record.attempts || 0, w: record.wins || 0 })
      }));
    });
  }
  renderLevels();
  updateCampaignSummary();

  // ------------------------------------------------------------- board construction
  function hexGeometry(size) {
    const margin = 0.4;
    return {
      margin,
      width: SQRT3 * (1.5 * size - 0.5) + margin * 2,
      height: 1.5 * size + 0.5 + margin * 2,
      minX: -SQRT3 / 2 - margin,
      minY: -1 - margin
    };
  }
  const centerOf = index => {
    const size = game.size;
    return {
      x: SQRT3 * ((index % size) + Math.floor(index / size) / 2),
      y: 1.5 * Math.floor(index / size)
    };
  };
  const verticesOfCell = index => {
    const { x, y } = centerOf(index);
    const points = [];
    for (let k = 0; k < 6; k++) {
      const angle = (30 + 60 * k) * Math.PI / 180;
      points.push({ x: x + Math.cos(angle), y: y + Math.sin(angle) });
    }
    return points;
  };
  const pointText = point => point.x.toFixed(4) + ',' + point.y.toFixed(4);
  const svgEl = (tag, attributes) => {
    const element = document.createElementNS(SVG_NS, tag);
    if (attributes) for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
    return element;
  };
  const addSegment = (layer, className, a, b) => {
    const path = svgEl('path', { d: 'M' + pointText(a) + 'L' + pointText(b), class: className });
    layer.append(path);
  };

  function buildBoard(size) {
    const svg = $('board-svg');
    svg.replaceChildren();
    const view = hexGeometry(size);
    svg.setAttribute('viewBox', [view.minX, view.minY, view.width, view.height].join(' '));
    svg.setAttribute('aria-label', t('board-section'));

    const boundaryLayer = svgEl('g');
    const linesLayer = svgEl('g');
    cellLayer = svgEl('g');
    pathLayer = linesLayer;
    markerLayer = svgEl('g');
    svg.append(boundaryLayer, linesLayer, cellLayer, markerLayer);
    cells.length = 0;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const index = r * size + c;
        const vertices = verticesOfCell(index);
        const group = svgEl('g', { role: 'button', tabindex: '-1', focusable: 'true', class: 'hex-cell' + ((r + c) % 2 ? ' alt' : '') });
        group.dataset.index = String(index);
        const polygon = svgEl('polygon', { class: 'hex-shape', points: vertices.map(pointText).join(' ') });
        const stone = svgEl('circle', { class: 'stone', cx: centerOf(index).x, cy: centerOf(index).y, r: 0.72 });
        stone.style.display = 'none';
        const shine = svgEl('circle', { class: 'stone-shine', cx: centerOf(index).x - 0.22, cy: centerOf(index).y - 0.22, r: 0.16 });
        shine.style.display = 'none';
        const lastRing = svgEl('circle', { class: 'last-ring', cx: centerOf(index).x, cy: centerOf(index).y, r: 0.84 });
        lastRing.style.display = 'none';
        group.append(polygon, stone, shine, lastRing);
        group.addEventListener('click', () => tryHumanMove(index));
        group.addEventListener('focus', () => {
          if (!game) return;
          focusIndex = index;
          updateTabStops();
        });
        cellLayer.append(group);
        cells.push({ group, stone, shine, lastRing });
      }
    }

    // Boundary edges: red top/bottom, blue left/right.
    for (let c = 0; c < size; c++) {
      const top = verticesOfCell(c), bottom = verticesOfCell((size - 1) * size + c);
      addSegment(boundaryLayer, 'boundary red', top[3], top[4]);
      addSegment(boundaryLayer, 'boundary red', top[4], top[5]);
      addSegment(boundaryLayer, 'boundary red', bottom[1], bottom[2]);
      addSegment(boundaryLayer, 'boundary red', bottom[0], bottom[1]);
    }
    for (let r = 0; r < size; r++) {
      const left = verticesOfCell(r * size), right = verticesOfCell(r * size + size - 1);
      addSegment(boundaryLayer, 'boundary blue', left[2], left[3]);
      addSegment(boundaryLayer, 'boundary blue', right[0], right[5]);
      if (r < size - 1) addSegment(boundaryLayer, 'boundary blue', left[1], left[2]);
      if (r > 0) addSegment(boundaryLayer, 'boundary blue', right[4], right[5]);
    }

    focusIndex = Math.floor(size / 2) * size + Math.floor(size / 2);
    zoomManual = false;
    zoomOn = automaticZoom(size);
    updateTabStops();
    updateZoomButton();
  }

  function updateTabStops() {
    cells.forEach((cell, index) => cell.group.setAttribute('tabindex', index === focusIndex ? '0' : '-1'));
  }

  function automaticZoom(size) {
    return (size >= 9 && window.innerWidth <= 640) || window.innerWidth <= 360;
  }

  function zoomWidth(size) {
    const view = hexGeometry(size);
    const cellPx = window.innerWidth <= 540 ? 44 : 36;
    const target = view.width * (cellPx / SQRT3);
    const available = $('board-scroll').clientWidth || 0;
    return Math.round(Math.max(target, available));
  }

  function updateZoomButton() {
    const button = $('zoom-toggle');
    if (!game) { button.hidden = true; return; }
    button.hidden = false;
    button.textContent = zoomOn ? t('zoom-out') : t('zoom-in');
    button.setAttribute('aria-pressed', String(zoomOn));
    button.setAttribute('aria-label', zoomOn ? t('zoom-out') : t('zoom-in'));
    const scroll = $('board-scroll');
    scroll.classList.toggle('zoomed', zoomOn);
    if (zoomOn) scroll.style.setProperty('--zoom-width', zoomWidth(game.size) + 'px');
    else scroll.style.removeProperty('--zoom-width');
    if (game) updateBoardHint();
  }

  function toggleZoom() {
    if (!game) return;
    zoomManual = true;
    zoomOn = !zoomOn;
    updateZoomButton();
    if (zoomOn) {
      const scroll = $('board-scroll');
      const focusCell = cells[focusIndex];
      if (focusCell && scroll.scrollWidth > scroll.clientWidth) {
        const target = Math.max(0, focusCell.group.getBoundingClientRect().left - scroll.getBoundingClientRect().left + scroll.scrollLeft - scroll.clientWidth / 2);
        scroll.scrollLeft = target;
      }
    }
  }

  function updateBoardHint() {
    if (!game) return;
    let text = t('board-help');
    if (game.hintIndex !== null) text = fill('hint-note', { coord: coordOf(game.hintIndex) });
    else if (zoomOn) text = t('zoom-hint');
    $('board-hint').textContent = text;
  }

  // ------------------------------------------------------------- rendering
  function lastMoveIndex() {
    if (!game || !game.state.moves.length) return -1;
    return game.state.moves[game.state.moves.length - 1];
  }

  function renderBoard() {
    if (!game) return;
    const board = game.state.board;
    const winner = game.state.winner;
    const winning = new Set(Array.isArray(game.state.path) ? game.state.path : []);
    $('board-svg').classList.toggle('finished', Boolean(winner));
    const last = lastMoveIndex();
    cells.forEach((cell, index) => {
      const value = board[index];
      cell.group.classList.toggle('red', value === 1);
      cell.group.classList.toggle('blue', value === 2);
      cell.group.classList.toggle('path', winning.has(index));
      cell.group.style.setProperty('--path-order', Math.max(0, game.state.path.indexOf(index)));
      cell.stone.style.display = value ? '' : 'none';
      cell.stone.classList.toggle('placed', value && index === game.animateIndex);
      cell.shine.style.display = value ? '' : 'none';
      cell.lastRing.style.display = index === last ? '' : 'none';
      cell.group.setAttribute('tabindex', index === focusIndex ? '0' : '-1');
      let label = value === 1 ? fill('cell-red', { coord: coordOf(index) }) : value === 2 ? fill('cell-blue', { coord: coordOf(index) }) : fill('cell-empty', { coord: coordOf(index) });
      if (index === last) label += t('cell-last');
      if (winning.has(index)) label += language === 'zh' ? '，获胜连线' : ', winning path';
      cell.group.setAttribute('aria-label', label);
      cell.group.setAttribute('aria-disabled', String(Boolean(value) || winner !== 0 || game.thinking || game.state.turn !== 1));
    });

    if (pathLayer) pathLayer.replaceChildren();
    if (markerLayer) markerLayer.replaceChildren();
    if (!pathLayer || !markerLayer) return;

    const analysis = analysisEnabled() ? analysisData() : null;
    if (analysis) {
      drawPath(analysis.red.path, 'ana-path red');
      drawPath(analysis.blue.path, 'ana-path blue');
      analysis.bridges.forEach(bridge => {
        const side = bridge.player === 1 ? 'red' : 'blue';
        (bridge.ends || []).forEach(index => {
          const center = centerOf(index);
          markerLayer.append(svgEl('circle', { class: 'bridge-ring ' + side, cx: center.x, cy: center.y, r: 0.62 }));
        });
        (bridge.cells || []).forEach(index => {
          const center = centerOf(index);
          markerLayer.append(svgEl('circle', { class: 'bridge-dot ' + side, cx: center.x, cy: center.y, r: 0.11 }));
        });
      });
      analysis.candidates.forEach((candidate, order) => {
        const center = centerOf(candidate.index);
        markerLayer.append(svgEl('circle', { class: 'candidate-ring', cx: center.x, cy: center.y, r: 0.66 }));
        const label = svgEl('text', { class: 'candidate-label', x: center.x, y: center.y + 0.14 });
        label.textContent = String(order + 1);
        markerLayer.append(label);
      });
    }

    if (winner && winning.size > 1) {
      const points = Array.from(winning).map(index => centerOf(index));
      const polyline = svgEl('polyline', { class: 'win-line' + (winner === 2 ? ' blue' : ''), pathLength: 1, points: points.map(pointText).join(' ') });
      markerLayer.append(polyline);
    }

    if (game.hintIndex !== null && board[game.hintIndex] === 0) {
      const center = centerOf(game.hintIndex);
      markerLayer.append(svgEl('circle', { class: 'hint-ring', cx: center.x, cy: center.y, r: 0.76 }));
      markerLayer.append(svgEl('circle', { class: 'hint-dot', cx: center.x, cy: center.y, r: 0.1 }));
    }
  }

  function drawPath(path, className) {
    if (!Array.isArray(path) || path.length < 2 || !markerLayer) return;
    const points = path.map(index => centerOf(index));
    markerLayer.append(svgEl('polyline', { class: className, points: points.map(pointText).join(' ') }));
  }

  function analysisEnabled() {
    return Boolean(game && game.mode === 'free' && settings.analysis);
  }

  function countStones(player) {
    if (!game) return 0;
    let count = 0;
    for (let i = 0; i < game.state.board.length; i++) if (game.state.board[i] === player) count++;
    return count;
  }

  function renderStats() {
    if (!game) return;
    $('stat-red').textContent = String(countStones(1));
    $('stat-blue').textContent = String(countStones(2));
    $('stat-moves').textContent = String(countStones(1));
    $('stat-time').textContent = formatTime(game.ended ? game.elapsedMs : Date.now() - game.startedAt);
    $('stat-ai').textContent = formatAI(game.aiMs);
  }

  function renderStatus() {
    if (!game) return;
    const state = game.state;
    let title = '', text = '', tone = '';
    if (state.winner === 1) {
      title = t('msg-won-title');
      text = game.mode === 'campaign'
        ? fill('msg-won-campaign', { n: game.levelId, time: formatTime(game.elapsedMs), m: countStones(1) })
        : fill('msg-won-free', { time: formatTime(game.elapsedMs), m: countStones(1) });
      tone = 'won';
    } else if (state.winner === 2) {
      title = t('msg-lost-title');
      text = game.mode === 'campaign' ? t('msg-lost-campaign') : t('msg-lost-free');
      tone = 'lost';
    } else if (game.thinking) {
      title = t('msg-thinking-title');
      text = t('msg-thinking-text');
    } else if (state.moves.length > 0) {
      title = t('msg-turn-title');
      const last = state.moves[state.moves.length - 1];
      text = fill('msg-turn-text', { coord: coordOf(last) });
    } else {
      title = t('msg-start-title');
      text = t('msg-start-text');
    }
    $('message-title').textContent = title;
    $('message-text').textContent = text;
    $('message').classList.toggle('won', tone === 'won');
    $('message').classList.toggle('lost', tone === 'lost');
    $('message').classList.toggle('error', tone === 'lost');

    const chip = $('turn-chip');
    chip.classList.toggle('blue', game.thinking && !state.winner);
    chip.classList.toggle('done', Boolean(state.winner));
    chip.textContent = state.winner === 1 ? t('turn-won') : state.winner === 2 ? t('turn-lost') : game.thinking ? t('turn-blue') : t('turn-red');

    $('thinking').hidden = !game.thinking;
    if (game.thinking) {
      $('thinking-text').textContent = game.winRate === null
        ? t('thinking-text')
        : fill('thinking-progress', { it: game.iterations || 0, pct: Math.round(game.winRate * 100) });
    }
  }

  function renderButtons() {
    if (!game) return;
    const free = game.mode === 'free';
    const winner = game.state.winner;
    $('undo').hidden = !free;
    $('hint').hidden = !free;
    $('free-tools').hidden = !free;
    $('free-analysis').checked = Boolean(settings.analysis);
    $('undo').disabled = !free || game.thinking || game.state.moves.length === 0;
    $('hint').disabled = !free || game.thinking || Boolean(winner);
    $('restart').disabled = false;
    $('next').hidden = !(game.mode === 'campaign' && winner === 1 && game.levelId < MAX_LEVEL);
    $('analysis-panel').hidden = !(free && settings.analysis);
    $('legend-win').hidden = !winner;
    $('legend-bridge').hidden = !analysisEnabled();
    $('legend-candidate').hidden = !analysisEnabled();
    $('board-svg').setAttribute('aria-busy', String(game.thinking));
    $('zoom-toggle').hidden = false;
    updateZoomButton();
  }

  function renderAnalysis() {
    if (!analysisEnabled()) return;
    const data = analysisData();
    $('ana-red').textContent = !Number.isFinite(data.red.distance) ? t('distance-unreachable') : fill('distance-value', { d: data.red.distance });
    $('ana-blue').textContent = !Number.isFinite(data.blue.distance) ? t('distance-unreachable') : fill('distance-value', { d: data.blue.distance });
    const redBridges = data.bridges.filter(bridge => bridge.player === 1).length;
    const blueBridges = data.bridges.filter(bridge => bridge.player === 2).length;
    $('ana-bridges').textContent = fill('bridge-value', { r: redBridges, b: blueBridges });
    $('ana-winrate').textContent = game.winRate === null ? t('winrate-none') : fill('winrate-value', { pct: Math.round(game.winRate * 100) });
    $('ana-candidates').textContent = data.candidates.length
      ? fill('candidate-value', { coords: data.candidates.map(candidate => coordOf(candidate.index)).join(' · ') })
      : '—';
    $('analysis-note').textContent = t('analysis-note');
  }

  function renderAll() {
    if (!game) return;
    renderBoard();
    renderStatus();
    renderStats();
    renderButtons();
    renderAnalysis();
    updateBoardHint();
    const level = game.mode === 'campaign' ? LEVELS.find(item => item.id === game.levelId) : null;
    $('level-title').textContent = game.mode === 'campaign' ? fill('level-title-level', { n: game.levelId }) : t('level-title-free');
    $('board-meta').textContent = game.mode === 'campaign'
      ? fill('board-meta-campaign', { size: game.size, diff: diffName(level ? level.difficulty : game.difficulty) })
      : fill('board-meta-free', { size: game.size, diff: diffName(game.difficulty) });
    updateCampaignSummary();
    renderLevels();
  }

  function message(title, text, tone) {
    $('message-title').textContent = title;
    $('message-text').textContent = text;
    $('message').classList.toggle('won', tone === 'won');
    $('message').classList.toggle('lost', tone === 'lost');
    $('message').classList.toggle('error', tone === 'error');
  }

  function announce(text) { $('announcement').textContent = text; }

  function clockTick() {
    if (!game) return;
    $('stat-time').textContent = formatTime(game.ended ? game.elapsedMs : Date.now() - game.startedAt);
    $('stat-ai').textContent = formatAI(game.aiMs);
  }
  function startClock() {
    stopClock();
    clockTimer = setInterval(clockTick, 500);
    clockTick();
  }
  function stopClock() {
    if (clockTimer !== null) clearInterval(clockTimer);
    clockTimer = null;
  }

  // ------------------------------------------------------------- analysis helpers
  function evaluationKey() {
    if (!game) return '';
    return game.size + ':' + game.state.board.join('') + ':' + game.state.turn;
  }

  function evaluateCandidates(limit) {
    if (!game) return [];
    const key = evaluationKey();
    if (evaluationCache.key === key && evaluationCache.candidates.length >= limit) {
      return evaluationCache.candidates.slice(0, limit);
    }
    const size = game.size, board = game.state.board;
    const trial = board.slice();
    const empties = [];
    for (let i = 0; i < board.length; i++) if (board[i] === 0) empties.push(i);
    const scored = [];
    for (const index of empties) {
      trial[index] = 1;
      let redDistance = 1e9;
      try { redDistance = E.connection(trial, size, 1).distance; } catch {}
      trial[index] = 0;
      trial[index] = 2;
      let blueDistance = 1e9;
      try { blueDistance = E.connection(trial, size, 2).distance; } catch {}
      trial[index] = 0;
      let score = 0;
      score += Number.isFinite(redDistance) ? -redDistance * 10 : -1000;
      score += Number.isFinite(blueDistance) ? blueDistance * 10 : 1000;
      if (redDistance === 0) score += 3e6;
      if (blueDistance === 0) score += 2e6;
      const r = Math.floor(index / size), c = index % size;
      const mid = (size - 1) / 2;
      score -= (Math.abs(r - mid) + Math.abs(c - mid)) * 0.6;
      scored.push({ index, score });
    }
    scored.sort((a, b) => b.score - a.score || a.index - b.index);
    evaluationCache = { key, candidates: scored };
    return scored.slice(0, limit);
  }

  function analysisData() {
    if (!game) return null;
    const size = game.size, board = game.state.board;
    const red = E.connection(board, size, 1);
    const blue = E.connection(board, size, 2);
    let bridges = [];
    try {
      if (typeof E.bridges === 'function') bridges = E.bridges(board, size, 1).concat(E.bridges(board, size, 2));
    } catch {}
    const candidates = evaluateCandidates(3);
    return { red, blue, bridges, candidates };
  }

  function showHint() {
    if (!game || game.mode !== 'free' || game.thinking || game.state.winner || game.state.turn !== 1) return;
    const candidates = evaluateCandidates(1);
    if (!candidates.length) { message(t('hint-title'), t('hint-none')); return; }
    game.hintIndex = candidates[0].index;
    renderAll();
    message(t('hint-title'), fill('hint-text', { coord: coordOf(game.hintIndex) }));
    announce(fill('hint-note', { coord: coordOf(game.hintIndex) }));
  }

  // ------------------------------------------------------------- games
  function clearAnimationTimers() {
    animTimers.forEach(timer => clearTimeout(timer));
    animTimers = [];
  }

  function cancelActiveSearch() {
    if (activeCancel) {
      const cancel = activeCancel;
      activeCancel = null;
      try { cancel(); } catch {}
    }
  }

  function cancelAI() {
    searchToken++;
    cancelActiveSearch();
    if (activeWorker) {
      try { activeWorker.terminate(); } catch {}
      activeWorker = null;
    }
    if (game) game.thinking = false;
  }

  function newGame(mode, levelId, size, difficulty, budgetMs) {
    cancelAI();
    clearAnimationTimers();
    if (mode === 'campaign') {
      try { beginAttempt(levelId); } catch {}
    }
    game = {
      mode,
      levelId: mode === 'campaign' ? levelId : null,
      size,
      difficulty,
      budgetMs,
      state: E.create(size),
      startedAt: Date.now(),
      elapsedMs: 0,
      aiMs: 0,
      thinking: false,
      ended: false,
      humanMoves: 0,
      aiMoves: 0,
      animateIndex: -1,
      hintIndex: null,
      winRate: null,
      iterations: 0,
      searchSource: null,
      recovered: false
    };
    evaluationCache = { key: '', candidates: [] };
    ensureWorkerIdle();
    buildBoard(size);
    $('menu').hidden = true;
    $('game').hidden = false;
    $('message').classList.remove('won', 'lost', 'error');
    startClock();
    renderAll();
    const target = $('game');
    if (target.offsetTop < window.scrollY + 20) target.scrollIntoView({ block: 'nearest' });
    announce(mode === 'campaign' ? fill('level-title-level', { n: levelId }) : t('level-title-free'));
  }

  function ensureWorkerIdle() {
    if (activeWorker) {
      try { activeWorker.terminate(); } catch {}
      activeWorker = null;
    }
  }

  function startCampaign(id) {
    id = Number(id);
    if (!Number.isInteger(id) || id < 1 || id > MAX_LEVEL) return false;
    if (id > (Number(progress.unlocked) || 1)) return false;
    const level = LEVELS.find(item => item.id === id);
    if (!level) return false;
    const budget = settings.performance === 'fast' ? Math.max(20, Math.round(level.budgetMs * 0.55)) : level.budgetMs;
    try { newGame('campaign', id, level.size, level.difficulty, budget); }
    catch { return false; }
    return true;
  }

  function startFree(size, difficulty) {
    size = Number(size);
    difficulty = String(difficulty);
    if (!Number.isInteger(size) || size < 7 || size > 13) return false;
    if (!Object.prototype.hasOwnProperty.call(FREE_BUDGET, difficulty)) return false;
    let budget = FREE_BUDGET[difficulty];
    if (size >= 11) budget = Math.round(budget * 1.25);
    if (settings.performance === 'fast') budget = Math.max(20, Math.round(budget * 0.55));
    try { newGame('free', null, size, difficulty, budget); }
    catch { return false; }
    $('free-size').value = String(size);
    $('free-difficulty').value = difficulty;
    return true;
  }

  function canPlay() {
    return Boolean(game && !game.ended && !game.thinking && game.state.turn === 1 && game.state.winner === 0 && !activeCancel);
  }

  function tryHumanMove(index) {
    if (!canPlay()) return false;
    if (!Number.isInteger(index) || index < 0 || index >= game.size * game.size) return false;
    if (game.state.board[index] !== 0) return false;
    const ok = E.play(game.state, index);
    if (!ok) return false;
    game.humanMoves = countStones(1);
    game.animateIndex = index;
    game.hintIndex = null;
    game.winRate = null;
    game.iterations = 0;
    focusIndex = index;
    renderAll();
    announce(fill('announce-you', { coord: coordOf(index) }));
    if (game.state.winner) finishGame();
    else startAI();
    return true;
  }

  function legalRecoveryMove() {
    const size = game.size, board = game.state.board;
    const empties = [];
    for (let i = 0; i < board.length; i++) if (board[i] === 0) empties.push(i);
    if (!empties.length) return -1;
    for (const index of empties) {
      board[index] = 2;
      const won = E.winner(board, size) === 2;
      board[index] = 0;
      if (won) return index;
    }
    for (const index of empties) {
      board[index] = 1;
      const won = E.winner(board, size) === 1;
      board[index] = 0;
      if (won) return index;
    }
    const mid = (size - 1) / 2;
    let best = empties[0], bestScore = -Infinity;
    for (const index of empties) {
      let score = 0;
      try { for (const neighbour of E.neighbors(size, index)) { if (board[neighbour] === 2) score += 2; else if (board[neighbour] === 1) score += 1; } } catch {}
      score -= (Math.abs(Math.floor(index / size) - mid) + Math.abs(index % size - mid)) * 0.15;
      if (score > bestScore) { bestScore = score; best = index; }
    }
    return best;
  }

  function workerSearch(request, token, onProgress) {
    return new Promise((resolve, reject) => {
      let worker;
      try { worker = activeWorker || new Worker('worker.js'); }
      catch (error) { reject(error); return; }
      activeWorker = worker;
      const id = 'hex-' + token + '-' + Date.now();
      let settled = false;
      const timer = setTimeout(() => finish(reject, new Error('worker-timeout')), Math.max(3000, request.budgetMs + 5000));
      function finish(callback, value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (activeWorker === worker) activeCancel = null;
        // Keep successful searches in the same Worker so position priors survive undo/replay.
        if (callback !== resolve) {
          if (activeWorker === worker) activeWorker = null;
          try { worker.terminate(); } catch {}
        }
        callback(value);
      }
      activeCancel = () => finish(reject, new Error('cancelled'));
      worker.onmessage = event => {
        const data = event.data || {};
        if (data.id !== id) return;
        if (data.type === 'progress') { onProgress(data.progress || data); return; }
        if (data.type === 'result') { finish(resolve, data.result); return; }
        if (data.type === 'error') finish(reject, new Error(data.message || 'worker-error'));
      };
      worker.onerror = () => finish(reject, new Error('worker-error'));
      worker.postMessage({ id, type: 'search', request });
    });
  }

  async function fallbackSearch(request, token, onProgress) {
    if (!AI || typeof AI.search !== 'function') throw new Error('ai-unavailable');
    const budget = Math.max(80, Math.min(request.budgetMs, 3000));
    let abandon = false;
    const isCancelled = () => abandon || token !== searchToken || !game || game.ended;
    let timer = null;
    const timeout = new Promise((resolve, reject) => {
      timer = setTimeout(() => { abandon = true; reject(new Error('fallback-timeout')); }, budget + 6000);
    });
    try {
      const result = await Promise.race([
        Promise.resolve(AI.search({ ...request, board: request.board.slice(), budgetMs: budget }, onProgress, isCancelled)),
        timeout
      ]);
      if (isCancelled()) throw new Error('cancelled');
      return result;
    } finally {
      if (timer !== null) clearTimeout(timer);
      if (!isCancelled()) abandon = false;
    }
  }

  function handleProgress(progress) {
    if (!game || !game.thinking) return;
    if (Number.isFinite(progress.iterations)) game.iterations = progress.iterations;
    if (Number.isFinite(progress.winRate)) {
      game.winRate = Math.max(0, Math.min(1, progress.winRate));
      if (analysisEnabled()) $('ana-winrate').textContent = fill('winrate-value', { pct: Math.round(game.winRate * 100) });
    }
    if (!game.winRate) $('thinking-text').textContent = t('thinking-text');
    else $('thinking-text').textContent = fill('thinking-progress', { it: game.iterations || 0, pct: Math.round(game.winRate * 100) });
  }

  async function startAI() {
    if (!game || game.ended || game.state.winner) return;
    game.thinking = true;
    game.winRate = null;
    game.iterations = 0;
    game.searchSource = null;
    renderAll();
    const token = ++searchToken;
    const request = {
      size: game.size,
      board: game.state.board.slice(),
      player: 2,
      difficulty: game.difficulty,
      budgetMs: game.budgetMs
    };
    const started = performance.now();
    const onProgress = progress => {
      if (token === searchToken && game && game.thinking) handleProgress(progress);
    };
    let result = null;
    try {
      result = await workerSearch(request, token, onProgress);
      if (token !== searchToken || !game) return;
      if (game) game.searchSource = 'worker';
    } catch (error) {
      if (token !== searchToken || !game || game.ended) return;
      try {
        result = await fallbackSearch(request, token, onProgress);
        if (token !== searchToken || !game) return;
        if (game) game.searchSource = 'fallback';
      } catch (fallbackError) {
        if (token !== searchToken || !game || game.ended) return;
        result = null;
      }
    }
    if (token !== searchToken || !game || game.ended) return;
    const elapsed = Math.max(0, performance.now() - started);
    let move = result && Number.isInteger(result.move) ? result.move : -1;
    if (move < 0 || move >= game.size * game.size || game.state.board[move] !== 0) {
      move = legalRecoveryMove();
      result = null;
      if (game) game.recovered = true;
    }
    if (move < 0) {
      game.thinking = false;
      message(language === 'zh' ? '没有合法落点' : 'No legal move', language === 'zh' ? '可以重开本局。' : 'Restart the game.', 'error');
      renderButtons();
      return;
    }
    game.aiMs += elapsed;
    if (result && Number.isFinite(result.winRate)) game.winRate = Math.max(0, Math.min(1, result.winRate));
    game.thinking = false;
    game.animateIndex = move;
    game.aiMoves = countStones(2) + 1;
    const played = E.play(game.state, move);
    if (!played) {
      game.thinking = false;
      game.recovered = false;
      renderAll();
      return;
    }
    game.aiMoves = countStones(2);
    game.hintIndex = null;
    renderAll();
    announce(fill('announce-ai', { coord: coordOf(move) }));
    if (game.state.winner === 2) finishGame();
    else if (game.state.turn === 1) {
      announce(fill('msg-turn-text', { coord: coordOf(move) }));
    }
  }

  function finishGame() {
    if (!game || game.ended) return;
    game.ended = true;
    game.thinking = false;
    cancelActiveSearch();
    game.elapsedMs = Math.max(0, Date.now() - game.startedAt);
    stopClock();
    if (game.mode === 'campaign') {
      const { before, after } = finishAttempt(game.levelId, {
        won: game.state.winner === 1,
        moves: countStones(1),
        durationMs: game.elapsedMs,
        aiMs: Math.round(game.aiMs)
      });
      updateCampaignSummary();
      renderLevels();
      if (game.state.winner === 1 && after === MAX_LEVEL && before < MAX_LEVEL) openFinalDialog();
    }
    renderAll();
    $('stat-time').textContent = formatTime(game.elapsedMs);
    if (game.state.winner === 1) announce(t('announce-win'));
    else if (game.state.winner === 2) announce(t('announce-loss'));
  }

  function openFinalDialog() {
    const dialog = $('final-dialog');
    if (!dialog) return;
    try {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } catch {}
  }

  function undo() {
    if (!game || game.mode !== 'free' || game.thinking) return;
    if (typeof E.undoRound !== 'function') return;
    cancelAI();
    let changed = false;
    try { changed = E.undoRound(game.state); } catch { changed = false; }
    if (!changed) return;
    game.ended = false;
    game.animateIndex = -1;
    game.hintIndex = null;
    game.winRate = null;
    game.iterations = 0;
    game.recovered = false;
    game.humanMoves = countStones(1);
    game.aiMoves = countStones(2);
    game.startedAt = Date.now() - game.elapsedMs;
    startClock();
    renderAll();
    announce(t('announce-undo'));
  }

  function restart() {
    if (!game) return;
    cancelAI();
    clearAnimationTimers();
    if (game.mode === 'campaign') {
      try { beginAttempt(game.levelId); } catch {}
    }
    const size = game.size;
    game.state = E.create(size);
    game.startedAt = Date.now();
    game.elapsedMs = 0;
    game.aiMs = 0;
    game.thinking = false;
    game.ended = false;
    game.humanMoves = 0;
    game.aiMoves = 0;
    game.animateIndex = -1;
    game.hintIndex = null;
    game.winRate = null;
    game.iterations = 0;
    game.recovered = false;
    evaluationCache = { key: '', candidates: [] };
    focusIndex = Math.floor(size / 2) * size + Math.floor(size / 2);
    updateTabStops();
    startClock();
    renderAll();
  }

  function showMenu() {
    cancelAI();
    clearAnimationTimers();
    stopClock();
    game = null;
    $('game').hidden = true;
    $('menu').hidden = false;
    const dialog = $('final-dialog');
    try { if (dialog && dialog.open) dialog.close(); } catch {}
    updateCampaignSummary();
    renderLevels();
    $('menu').scrollIntoView({ block: 'start' });
  }

  // ------------------------------------------------------------- controls
  $('start-campaign').addEventListener('click', () => startCampaign(suggestedLevel()));
  $('start-free').addEventListener('click', () => startFree($('free-size').value, $('free-difficulty').value));
  $('undo').addEventListener('click', undo);
  $('hint').addEventListener('click', showHint);
  $('restart').addEventListener('click', restart);
  $('menu-button').addEventListener('click', showMenu);
  $('next').addEventListener('click', () => { if (game && game.mode === 'campaign' && game.levelId < MAX_LEVEL) startCampaign(game.levelId + 1); });
  $('zoom-toggle').addEventListener('click', toggleZoom);
  $('free-analysis').addEventListener('change', () => {
    settings.analysis = $('free-analysis').checked;
    saveSettings();
    evaluationCache = { key: '', candidates: [] };
    renderAll();
  });
  $('motion-select').addEventListener('change', () => {
    settings.motion = $('motion-select').value === 'off' ? 'off' : 'auto';
    saveSettings();
    applyMotion();
  });
  $('performance-select').addEventListener('change', () => {
    settings.performance = $('performance-select').value === 'fast' ? 'fast' : 'balanced';
    saveSettings();
    if (game) {
      const level = game.mode === 'campaign' ? LEVELS.find(item => item.id === game.levelId) : null;
      const base = game.mode === 'campaign' && level ? level.budgetMs : Math.round(FREE_BUDGET[game.difficulty] * (game.size >= 11 ? 1.25 : 1));
      game.budgetMs = settings.performance === 'fast' ? Math.max(20, Math.round(base * 0.55)) : base;
    }
  });
  $('close-final').addEventListener('click', () => {
    const dialog = $('final-dialog');
    if (dialog && dialog.open && typeof dialog.close === 'function') dialog.close();
    else if (dialog) dialog.removeAttribute('open');
  });
  $('final-dialog').addEventListener('click', event => {
    if (event.target === $('final-dialog')) {
      if (typeof $('final-dialog').close === 'function') $('final-dialog').close();
      else $('final-dialog').removeAttribute('open');
    }
  });
  $('language-toggle').addEventListener('click', () => {
    language = language === 'zh' ? 'en' : 'zh';
    try { localStorage.setItem('yaozi.home.language', language); } catch {}
    applyLanguage();
  });

  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable) return;
    if (!game) return;
    const key = event.key.toLowerCase();
    if (key === 'r') { event.preventDefault(); restart(); return; }
    if (key === 'z') { event.preventDefault(); if (game.mode === 'free') undo(); return; }
    const arrow = { arrowup: 'up', w: 'up', arrowright: 'right', d: 'right', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left' }[key];
    if (event.target.classList && event.target.classList.contains('hex-cell')) {
      if (arrow) { event.preventDefault(); moveFocus(arrow); return; }
      if (key === 'enter' || key === ' ') { event.preventDefault(); tryHumanMove(focusIndex); return; }
    }
  });

  function moveFocus(direction) {
    if (!game) return;
    const size = game.size;
    const neighbourList = E.neighbors(size, focusIndex);
    if (!neighbourList.length) return;
    const current = centerOf(focusIndex);
    const desired = direction === 'up' ? { x: 0, y: -1 } : direction === 'down' ? { x: 0, y: 1 } : direction === 'left' ? { x: -1, y: 0 } : { x: 1, y: 0 };
    let best = neighbourList[0], bestScore = -Infinity;
    for (const index of neighbourList) {
      const center = centerOf(index);
      const dx = center.x - current.x, dy = center.y - current.y;
      const length = Math.hypot(dx, dy) || 1;
      const score = (dx * desired.x + dy * desired.y) / length + (direction === 'up' || direction === 'down' ? -Math.abs(dx) * 0.01 : -Math.abs(dy) * 0.01);
      if (score > bestScore) { bestScore = score; best = index; }
    }
    if (bestScore <= 0) return;
    focusIndex = best;
    updateTabStops();
    const cell = cells[focusIndex];
    if (cell) cell.group.focus({ preventScroll: false });
  }

  // ------------------------------------------------------------- boot
  $('motion-select').value = settings.motion;
  $('performance-select').value = settings.performance;
  $('free-analysis').checked = Boolean(settings.analysis);
  window.addEventListener('resize', () => {
    if (!game) return;
    if (!zoomManual) zoomOn = automaticZoom(game.size);
    updateZoomButton();
  });
  applyLanguage();
  if (!storageAvailable) $('storage-note').hidden = false;

  window.HexGame = Object.freeze({
    snapshot() {
      let analysis = null;
      if (game) {
        try {
          const data = analysisEnabled() ? analysisData() : null;
          analysis = {
            enabled: analysisEnabled(),
            redDistance: data ? data.red.distance : null,
            blueDistance: data ? data.blue.distance : null,
            bridges: data ? {
              red: data.bridges.filter(bridge => bridge.player === 1).length,
              blue: data.bridges.filter(bridge => bridge.player === 2).length
            } : null,
            candidates: data ? data.candidates.map(candidate => candidate.index) : [],
            winRate: game.winRate,
            source: game.searchSource
          };
        } catch { analysis = { enabled: analysisEnabled() }; }
      }
      return {
        state: game ? {
          size: game.size,
          board: Array.from(game.state.board),
          turn: game.state.turn,
          winner: game.state.winner,
          moves: game.state.moves.slice(),
          path: game.state.path.slice()
        } : null,
        mode: game ? game.mode : null,
        levelId: game && game.mode === 'campaign' ? game.levelId : null,
        progress: JSON.parse(JSON.stringify(progress)),
        thinking: Boolean(game && game.thinking),
        analysis
      };
    },
    startCampaign,
    startFree
  });
})();
