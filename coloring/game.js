(() => {
  'use strict';
  const E = window.ColoringEngine, $ = id => document.getElementById(id), tr = window.GameLocale?.t || (value => value);
  if (!E) { $('level-title').textContent = '引擎未能加载，请重新打开页面。'; return; }
  const KEY = 'yaozi.coloring.progress.v1', NS = 'http://www.w3.org/2000/svg';
  let storageAvailable = true, stars = Array(12).fill(false);
  try { const r = JSON.parse(localStorage.getItem(KEY)); if (r?.version === 1 && Array.isArray(r.stars)) stars = stars.map((_, i) => r.stars[i] === true); } catch { /* Invalid saved data starts a new collection. */ }
  let graph, colors = [], history = [], levelIndex = 0, mode = 'level', selected = null, activeColor = 0, status = 'playing';
  let epoch = 0, busy = false, worker = null, dailyDate = null, randomCounter = 0, nodes = [], edges = [];
  let busyTextSource = '正在生成并验证挑战…';
  let workerCancel = null;
  const levelButtons = [], starSlots = [];
  const starSVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.5 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.4l6.2-.9Z"/></svg>';
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ version: 1, stars })); }
    catch { storageAvailable = false; $('storage-note').hidden = false; }
  }
  // Detect blocked storage even before the first earned star.
  try { localStorage.setItem(KEY + '.probe', '1'); localStorage.removeItem(KEY + '.probe'); } catch { storageAvailable = false; $('storage-note').hidden = false; }
  let currentMessage = ['先观察，再落色', '给后面的顶点留出可用颜色。需要时可以改色或撤销。', false];
  function message(title, text, won = false) { currentMessage = [title, text, won]; $('message-title').textContent = tr(title); $('message-text').textContent = tr(text); $('message').classList.toggle('won', won); }
  function collection() {
    const count = stars.filter(Boolean).length;
    $('star-count').textContent = count + ' / 12'; $('progress-label').textContent = tr('已通关 ' + count + ' / 12'); $('collection').classList.toggle('complete', count === 12);
    stars.forEach((s, i) => { starSlots[i].classList.toggle('earned', s); starSlots[i].setAttribute('aria-label', tr(`第 ${i + 1} 关${s ? '已通关' : '未通关'}`)); levelButtons[i].classList.toggle('done', s); levelButtons[i].setAttribute('aria-pressed', String(mode === 'level' && levelIndex === i)); });
  }
  function stopGeneration() { epoch++; busy = false; if (workerCancel) workerCancel(); workerCancel = null; if (worker) worker.terminate(); worker = null; $('busy').hidden = true; }
  function setBusyText(value) { busyTextSource = value; $('busy-text').textContent = tr(value); }
  function loadGraph(g, nextMode, index = null, date = null) {
    graph = JSON.parse(JSON.stringify(g)); mode = nextMode; levelIndex = index; dailyDate = date;
    colors = Array(graph.n).fill(-1); history = []; selected = null; activeColor = 0; status = 'playing';
    $('level-title').textContent = tr(nextMode === 'level' ? `第 ${index + 1} 关 · ${graph.name}` : nextMode === 'daily' ? `每日一局 · ${date}` : '随机挑战 · ' + graph.name);
    $('board-meta').textContent = tr(`${graph.n} 顶点 · ${graph.edges.length} 条边`);
    $('target').textContent = graph.k; $('total').textContent = '/ ' + graph.n;
    buildBoard(); buildPalette(); render(); collection(); message('先观察，再落色', `本关最少需要 ${graph.k} 种颜色。先选一种颜色，再点击顶点。`);
  }
  function loadLevel(index) { if (!Number.isInteger(index) || !E.LEVELS[index]) return false; stopGeneration(); loadGraph(E.LEVELS[index], 'level', index); return true; }
  function buildBoard() {
    $('edges').replaceChildren(); $('vertices').replaceChildren();
    edges = graph.edges.map(([a, b], i) => { const line = document.createElementNS(NS, 'line'); line.classList.add('color-edge'); line.dataset.edge = i; const p = graph.positions[a], q = graph.positions[b]; line.setAttribute('x1', p[0]); line.setAttribute('y1', p[1]); line.setAttribute('x2', q[0]); line.setAttribute('y2', q[1]); $('edges').append(line); return line; });
    nodes = Array.from({ length: graph.n }, (_, i) => {
      const node = document.createElement('button'); node.type = 'button'; node.className = 'vertex'; node.id = 'node-' + i; node.dataset.index = i;
      node.style.left = graph.positions[i][0] / 10 + '%'; node.style.top = graph.positions[i][1] / 10 + '%';
      const dot = document.createElement('span'); dot.className = 'vertex-dot'; node.append(dot);
      node.addEventListener('focus', () => { selected = i; render(); });
      node.addEventListener('click', () => { selected = i; paint(i, activeColor); });
      node.addEventListener('keydown', event => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (/^Arrow/.test(event.key)) { event.preventDefault(); focusDirection(i, event.key); }
        else if (/^[1-5]$/.test(event.key) && Number(event.key) <= graph.k) { event.preventDefault(); activeColor = Number(event.key) - 1; paint(i, activeColor); }
        else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); paint(i, -1); }
      });
      $('vertices').append(node); return node;
    });
  }
  function focusDirection(i, key) {
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
    if (!dir) return;
    const p = graph.positions[i]; let best = -1, cost = Infinity;
    graph.positions.forEach((q, j) => { const dx = q[0] - p[0], dy = q[1] - p[1], along = dx * dir[0] + dy * dir[1]; if (j === i || along <= 0) return; const across = Math.abs(dx * dir[1] - dy * dir[0]); const score = Math.hypot(dx, dy) + across * 2; if (score < cost) { cost = score; best = j; } });
    if (best >= 0) nodes[best].focus();
  }
  function buildPalette() {
    $('palette').replaceChildren();
    for (let c = 0; c < graph.k; c++) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'swatch'; button.dataset.color = c; button.id = 'color-' + c; button.setAttribute('aria-label', tr(`颜色 ${c + 1}`));
      button.innerHTML = `<span class="swatch-dot" style="--paint:var(--paint-${c})">${c + 1}</span>`;
      button.addEventListener('click', () => { activeColor = c; render(); }); $('palette').append(button);
    }
    const erase = document.createElement('button'); erase.type = 'button'; erase.id = 'erase'; erase.className = 'swatch'; erase.dataset.color = -1; erase.textContent = tr('清除'); erase.addEventListener('click', () => { activeColor = -1; render(); }); $('palette').append(erase);
  }
  function paint(i, color) {
    if (!graph || busy || color < -1 || color >= graph.k) return;
    selected = i;
    if (colors[i] !== color) { history.push({ index: i, from: colors[i] }); colors[i] = color; }
    render();
  }
  function render() {
    if (!graph) return;
    const conflicts = graph.edges.map(([a, b]) => colors[a] >= 0 && colors[a] === colors[b]);
    const adjacent = new Set(); graph.edges.forEach(([a, b]) => { if (a === selected) adjacent.add(b); if (b === selected) adjacent.add(a); });
    const badNodes = new Set(); graph.edges.forEach(([a, b], i) => { if (conflicts[i]) { badNodes.add(a); badNodes.add(b); } });
    edges.forEach((line, i) => { line.classList.toggle('conflict', conflicts[i]); line.classList.toggle('incident', graph.edges[i].includes(selected)); });
    nodes.forEach((node, i) => { node.classList.toggle('selected', selected === i); node.classList.toggle('neighbor', adjacent.has(i)); node.classList.toggle('conflict', badNodes.has(i)); node.classList.toggle('colored', colors[i] >= 0); node.style.setProperty('--paint', `var(--paint-${Math.max(0, colors[i])})`); node.firstChild.textContent = colors[i] < 0 ? '·' : colors[i] + 1; node.setAttribute('aria-label', tr(`顶点 ${i + 1}，${colors[i] < 0 ? '未着色' : '颜色 ' + (colors[i] + 1)}${badNodes.has(i) ? '，有冲突' : ''}`)); });
    $('board').classList.toggle('has-selection', selected !== null);
    const count = conflicts.filter(Boolean).length, filled = colors.filter(c => c >= 0).length;
    $('filled').textContent = filled; $('conflict-count').textContent = window.GameLocale?.language === 'en' ? `${count} edge ${count === 1 ? 'conflict' : 'conflicts'}` : `${count} 条边`; $('undo').disabled = !history.length || busy;
    $('palette').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.color) === activeColor)));
    $('palette-note').textContent = tr(activeColor < 0 ? '清除模式' : '当前颜色 ' + (activeColor + 1));
    $('selection-note').textContent = tr(selected === null ? '选择颜色，开始填图。' : `顶点 ${selected + 1} · ${adjacent.size} 个邻居${colors[selected] < 0 ? ' · 尚未着色' : ' · 颜色 ' + (colors[selected] + 1)}`);
    const won = filled === graph.n && count === 0, previous = status; status = won ? 'won' : 'playing'; $('board').classList.toggle('won', won);
    $('next').hidden = !(won && mode === 'level' && levelIndex < 11);
    if (won) {
      if (mode === 'level' && !stars[levelIndex]) { stars[levelIndex] = true; save(); collection(); }
      message('整张图，恰好够用！', mode === 'level' ? `你用 ${graph.k} 种颜色完成了第 ${levelIndex + 1} 关。` : `你用 ${graph.k} 种颜色完成了本局。`, true);
    } else if (history.length || previous === 'won') message(count ? '还有同色的邻居' : '继续填满整张图', count ? `${count} 条虚线的两端颜色相同，可以改色或撤销。` : `还差 ${graph.n - filled} 个顶点，给后面的点留出颜色。`);
  }
  function undo() { if (busy) stopGeneration(); const item = history.pop(); if (!item) return; colors[item.index] = item.from; selected = item.index; render(); nodes[item.index].focus({ preventScroll: true }); }
  function restart() { stopGeneration(); colors.fill(-1); history = []; selected = null; status = 'playing'; render(); message('重新开始', '颜色已经清空，试试另一种安排。'); }
  const yieldFrame = () => new Promise(resolve => setTimeout(resolve, 0));
  function fromWorker(seed, difficulty, id) {
    return new Promise(resolve => {
      let w;
      try { w = new Worker('worker.js'); } catch { resolve(null); return; }
      worker = w;
      const done = value => { w.terminate(); if (worker === w) worker = null; if (workerCancel === cancel) workerCancel = null; resolve(value); };
      const cancel = () => done(null); workerCancel = cancel;
      w.onerror = event => { event.preventDefault(); done(null); };
      w.onmessage = event => { if (event.data.id !== id || id !== epoch) return; if (event.data.type === 'progress') setBusyText(`正在验证最少色数 · 已搜索 ${Number(event.data.nodes) || 0} 个分支`); else if (event.data.type === 'result') done(event.data.result); else if (event.data.type === 'error') done(null); };
      w.postMessage({ seed, difficulty, id });
    });
  }
  async function fallback(seed, difficulty, id) {
    for (let attempt = 0; attempt < 8; attempt++) {
      if (id !== epoch) return null;
      const candidate = E.makeCandidate(seed + ':' + attempt, difficulty);
      if (!E.validateColoring(candidate, candidate.solution, candidate.k).valid) continue;
      const search = E.createSearch(candidate, candidate.k - 1, { maxNodes: 2000000 });
      let result;
      do {
        if (id !== epoch) return null;
        result = search.step(500);
        setBusyText(`正在验证最少色数 · 已搜索 ${result.nodes || 0} 个分支`);
        await yieldFrame();
      } while (result.status === 'searching');
      if (result.status === 'infeasible') return { ...candidate, status: 'verified' };
    }
    return null;
  }
  async function generate(nextMode) {
    stopGeneration(); const id = epoch; busy = true; $('busy').hidden = false; setBusyText('正在生成并验证挑战…'); $('undo').disabled = true;
    const date = E.shanghaiDateString(); const seed = nextMode === 'daily' ? 'coloring-daily:' + date : 'coloring-random:' + Date.now() + ':' + (++randomCounter) + ':' + Math.random();
    try {
      let result = await fromWorker(seed, 'hard', id);
      if (id !== epoch) return;
      // Use the same candidate seed sequence on Worker and fallback paths.
      if (!result || result.status !== 'verified') result = await fallback(seed, 'hard', id);
      if (id !== epoch) return;
      busy = false; $('busy').hidden = true;
      if (!result) { render(); message('这一张图验证耗时较长', '请重新生成，或选择一个固定关卡。'); return; }
      loadGraph(result, nextMode, null, nextMode === 'daily' ? date : null);
    } catch (error) { if (id === epoch) { busy = false; $('busy').hidden = true; render(); message('生成未完成', '请重试，或选择固定关卡继续。'); } }
  }
  E.LEVELS.forEach((g, i) => {
    const slot = document.createElement('div'); slot.className = 'star-slot'; slot.setAttribute('role', 'listitem'); slot.innerHTML = starSVG + `<span>${i + 1}</span>`; $('star-shelf').append(slot); starSlots.push(slot);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'level'; b.dataset.level = i; b.innerHTML = `<span class="level-number">${i + 1}</span><span class="level-main"><b>${g.name}</b><small>${g.n} 顶点 · ${g.k} 色</small></span><span class="level-star">${starSVG}</span>`; b.addEventListener('click', () => loadLevel(i)); $('levels').append(b); levelButtons.push(b);
  });
  $('undo').addEventListener('click', undo); $('restart').addEventListener('click', restart); $('next').addEventListener('click', () => loadLevel(levelIndex + 1)); $('daily').addEventListener('click', () => generate('daily')); $('random').addEventListener('click', () => generate('random')); $('cancel').addEventListener('click', () => { stopGeneration(); render(); message('已取消生成', '继续当前棋盘，或选择其他关卡。'); });
  document.addEventListener('keydown', event => { if (event.ctrlKey || event.metaKey || event.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName)) return; if (event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); } if (event.key.toLowerCase() === 'r') { event.preventDefault(); restart(); } });
  let preference = null; try { preference = localStorage.getItem('yaozi.home.theme'); } catch {}
  function theme(value) { document.documentElement.dataset.theme = value; document.querySelector('meta[name="theme-color"]').content = value === 'dark' ? '#0d1826' : '#edf3f9'; $('theme').setAttribute('aria-label', tr(value === 'dark' ? '切换至浅色模式' : '切换至深色模式')); }
  theme(document.documentElement.dataset.theme);
  $('theme').addEventListener('click', () => { preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; theme(preference); try { localStorage.setItem('yaozi.home.theme', preference); } catch {} });
  matchMedia('(prefers-color-scheme:dark)').addEventListener('change', event => { if (!['light','dark'].includes(preference)) theme(event.matches ? 'dark' : 'light'); });
  window.ColoringGame = Object.freeze({ loadLevel, ready: () => !!graph && !busy, snapshot: () => JSON.parse(JSON.stringify({ graph, colors, k: graph?.k, mode, levelIndex, status, selected, activeColor, busy, stars, historyLength: history.length, dailyDate, storageAvailable })) });
  window.GameLocale?.setRerender(() => {
    const savedMessage = currentMessage;
    render(); collection();
    $('level-title').textContent = tr(mode === 'level' ? `第 ${levelIndex + 1} 关 · ${graph.name}` : mode === 'daily' ? `每日一局 · ${dailyDate}` : `随机挑战 · ${graph.name}`);
    $('board-meta').textContent = tr(`${graph.n} 顶点 · ${graph.edges.length} 条边`);
    $('palette').querySelector('#erase').textContent = tr('清除');
    levelButtons.forEach((button, index) => { const level = E.LEVELS[index]; button.querySelector('.level-main b').textContent = tr(level.name); button.querySelector('.level-main small').textContent = tr(`${level.n} 顶点 · ${level.k} 色`); });
    setBusyText(busyTextSource);
    if (savedMessage) message(...savedMessage);
  });
  loadLevel(0);
  window.GameLocale?.apply();
})();
