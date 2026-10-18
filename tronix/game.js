(() => {
  'use strict';

  const E = window.TronixEngine;
  const $ = id => document.getElementById(id);
  if (!E) {
    const message = $('message-title');
    if (message) message.textContent = '引擎未能加载';
    return;
  }

  const LEVEL_COUNT = E.LEVELS.length;
  const STORAGE_KEY = 'yaozi.tronix.progress.v1';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const starPath = 'M12 2.8 14.8 8.5 21 9.4 16.5 13.8 17.6 20 12 17.1 6.4 20 7.5 13.8 3 9.4 9.2 8.5Z';
  const starIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${starPath}"/></svg>`;
  const board = $('board');
  const boardSurface = $('board-surface');
  const edgeLayer = $('edge-layer');
  const nodeLayer = $('node-layer');
  const levelsHost = $('levels');
  const starShelf = $('star-shelf');
  const message = $('message');
  const messageTitle = $('message-title');
  const messageText = $('message-text');
  const conflictCount = $('conflicts');
  const movesCount = $('moves');
  const goalNote = $('goal-note');
  const selectionNote = $('selection-note');
  const bestValue = $('best');
  const recordLabel = $('record-label');
  const levelTier = $('level-tier');
  const nextButton = $('next');
  const undoButton = $('undo');
  const restartButton = $('restart');
  const themeButton = $('theme');
  const announcement = $('announcement');

  let storageAvailable = true;
  const records = loadRecords();
  const levelButtons = [];
  const starSlots = [];
  let edgeElements = [];
  let nodeElements = [];

  let mode = 'level';
  let levelIndex = 0;
  let graph = null;
  let points = [];
  let history = [];
  let selected = null;
  let drag = null;
  let currentSolved = false;
  let lastReport = null;
  let dailyDate = null;
  let randomSeed = null;
  let randomDifficulty = null;
  let activePointers = new Map();
  let multiTouch = false;
  let lastMultiTouchTime = -Infinity;
  let suppressSurfaceClick = false;
  let celebrateTimer = 0;
  let starTimer = 0;
  let randomClicks = 0;
  let resolveReady;
  const readyPromise = new Promise(resolve => { resolveReady = resolve; });

  function defaultRecords() {
    return { stars: Array(LEVEL_COUNT).fill(false), best: Array(LEVEL_COUNT).fill(null) };
  }

  function loadRecords() {
    const fallback = defaultRecords();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return fallback;
      const stars = Array.isArray(saved.stars) ? saved.stars : [];
      const best = Array.isArray(saved.best) ? saved.best : [];
      for (let i = 0; i < LEVEL_COUNT; i++) {
        fallback.stars[i] = stars[i] === true;
        fallback.best[i] = Number.isInteger(best[i]) && best[i] >= 0 ? best[i] : null;
      }
      return fallback;
    } catch {
      storageAvailable = false;
      return fallback;
    }
  }

  function saveRecords() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1,
        stars: records.stars.slice(),
        best: records.best.slice()
      }));
    } catch {
      storageAvailable = false;
      const note = $('storage-note');
      note.hidden = false;
    }
  }

  function announce(text) {
    if (!announcement) return;
    announcement.textContent = text;
  }

  function setMessage(title, detail, tone) {
    message.className = 'message' + (tone ? ' ' + tone : '');
    messageTitle.textContent = title;
    messageText.textContent = detail;
  }

  function loadFixedLevel(index) {
    if (!Number.isInteger(index) || index < 0 || index >= LEVEL_COUNT) return false;
    const level = E.LEVELS[index];
    loadGraph({
      mode: 'level',
      levelIndex: index,
      name: level.name,
      tier: level.tier,
      nodes: level.nodes,
      edges: E.cloneEdges(level.edges),
      start: E.clonePoints(level.start),
      n: level.n,
      m: level.m,
      dailyDate: null,
      randomSeed: null,
      randomDifficulty: null
    });
    return true;
  }

  function loadGraph(descriptor) {
    clearCelebration();
    cancelDrag(false);
    mode = descriptor.mode;
    levelIndex = descriptor.levelIndex;
    dailyDate = descriptor.dailyDate;
    randomSeed = descriptor.randomSeed;
    randomDifficulty = descriptor.randomDifficulty;
    graph = {
      name: descriptor.name,
      tier: descriptor.tier,
      nodes: descriptor.nodes.slice(),
      edges: descriptor.edges.map(edge => [edge[0], edge[1]]),
      start: descriptor.start.map(point => [point[0], point[1]]),
      n: descriptor.n,
      m: descriptor.m
    };
    points = descriptor.start.map(point => [point[0], point[1]]);
    history = [];
    selected = null;
    drag = null;
    currentSolved = false;
    lastReport = null;
    nextButton.hidden = true;
    buildBoard();
    updateHeader();
    updateRecordDisplay();
    updateCollection();
    const report = renderScene();
    updateSelectionNote();
    setMessage('拖动节点开始', `当前有 ${report.count} 处冲突。红色线段或节点需要调整。共享端点的线可以相接；共线重叠仍算冲突。`);
    announce(`${descriptor.name}已载入，${report.count} 处冲突`);
  }

  function buildBoard() {
    edgeLayer.replaceChildren();
    nodeLayer.replaceChildren();
    edgeElements = graph.edges.map((edge, index) => {
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('class', 'edge');
      line.setAttribute('data-edge-index', String(index));
      edgeLayer.append(line);
      return line;
    });
    nodeElements = graph.nodes.map((label, index) => {
      const node = document.createElement('button');
      node.type = 'button';
      node.id = 'node-' + index;
      node.className = 'node';
      node.dataset.index = String(index);
      node.setAttribute('aria-label', '节点 ' + label);
      const dot = document.createElement('span');
      dot.className = 'node-dot';
      const text = document.createElement('span');
      text.className = 'node-label';
      text.textContent = label;
      text.setAttribute('aria-hidden', 'true');
      dot.append(text);
      node.append(dot);
      node.addEventListener('pointerdown', onNodePointerDown);
      node.addEventListener('pointermove', onNodePointerMove);
      node.addEventListener('pointerup', onNodePointerUp);
      node.addEventListener('pointercancel', onNodePointerCancel);
      node.addEventListener('keydown', onNodeKeyDown);
      node.addEventListener('focus', () => {
        if (!drag && Number.isInteger(Number(node.dataset.index))) selectNode(Number(node.dataset.index), false);
      });
      node.addEventListener('click', event => {
        if (event.detail === 0) selectNode(index, false);
      });
      nodeLayer.append(node);
      return node;
    });
    const density = graph.nodes.length <= 10 ? 'sparse' : graph.nodes.length <= 16 ? 'medium' : 'dense';
    board.dataset.density = density;
    board.setAttribute('aria-label', `解结棋盘 · ${graph.name}`);
    if (nodeElements.length) {
      // Keep the first node out of the tab order until the player enters the board.
      nodeElements.forEach(node => { node.tabIndex = 0; });
    }
  }

  function selectNode(index, moveFocus) {
    if (!Number.isInteger(index) || index < 0 || index >= graph.nodes.length) return;
    selected = index;
    if (moveFocus) nodeElements[index].focus({ preventScroll: true });
    updateSelectionNote();
    renderScene();
    announce(`已选中节点 ${graph.nodes[index]}`);
  }

  function updateSelectionNote() {
    if (selected === null) {
      selectionNote.textContent = '尚未选中节点';
      return;
    }
    const moving = drag && drag.index === selected ? '正在移动' : '已选';
    selectionNote.textContent = `${moving}节点 ${graph.nodes[selected]}。拖动它，或点击棋盘空白处移动。`;
  }

  function updateHeader() {
    if (mode === 'level') {
      $('level-title').textContent = `第 ${levelIndex + 1} 关 · ${graph.name}`;
      $('board-meta').textContent = `${graph.n} 节点 · ${graph.m} 条线 · ${graph.tier}`;
    } else if (mode === 'daily') {
      $('level-title').textContent = `每日一局 · ${E.formatDateCN(dailyDate)}`;
      $('board-meta').textContent = `${graph.n} 节点 · ${graph.m} 条线 · 北京时间`;
    } else {
      $('level-title').textContent = '随机挑战';
      $('board-meta').textContent = `${graph.n} 节点 · ${graph.m} 条线 · ${graph.tier}`;
    }
    document.title = mode === 'level'
      ? `第 ${levelIndex + 1} 关 · ${graph.name} · Tronix 解结`
      : `${graph.name} · Tronix 解结`;
  }

  function updateRecordDisplay() {
    if (mode === 'level') {
      recordLabel.textContent = '本关最佳';
      bestValue.textContent = records.best[levelIndex] === null ? '—' : `${records.best[levelIndex]} 次`;
      levelTier.textContent = E.LEVELS[levelIndex].tier;
    } else {
      recordLabel.textContent = '固定关卡最佳';
      bestValue.textContent = '不计记录';
      levelTier.textContent = mode === 'daily' ? '每日' : '随机';
    }
  }

  function updateCollection(newStar) {
    const done = records.stars.filter(Boolean).length;
    $('star-count').textContent = `${done} / ${LEVEL_COUNT}`;
    $('progress-label').textContent = `已通关 ${done} / ${LEVEL_COUNT}`;
    $('collection').classList.toggle('complete', done === LEVEL_COUNT);
    $('collection-note').textContent = done === LEVEL_COUNT
      ? '十二颗星已集齐。重开或更换关卡不会清除记录。'
      : '每张固定线网首次解开，点亮一颗星。';
    starSlots.forEach((slot, index) => {
      slot.classList.toggle('earned', records.stars[index]);
      slot.setAttribute('aria-label', `第 ${index + 1} 关，${records.stars[index] ? '已通关' : '未通关'}`);
    });
    levelButtons.forEach((button, index) => {
      const level = E.LEVELS[index];
      const completed = records.stars[index];
      const best = records.best[index];
      button.classList.toggle('done', completed);
      button.setAttribute('aria-pressed', String(mode === 'level' && levelIndex === index));
      button.setAttribute('aria-label',
        `第 ${index + 1} 关，${level.name}，${level.n} 个节点，${level.m} 条线` +
        `${completed ? '，已通关' : ''}${best !== null ? `，最佳 ${best} 次` : ''}`);
      button.title = completed ? `已通关${best !== null ? `，最佳 ${best} 次` : ''}` : '尚未通关';
    });
    if (newStar !== undefined && newStar !== null) {
      const slot = starSlots[newStar];
      if (slot) {
        slot.classList.add('new-star');
        clearTimeout(starTimer);
        starTimer = window.setTimeout(() => slot.classList.remove('new-star'), 900);
      }
    }
  }

  function updateGoal(report) {
    if (report.count === 0) {
      goalNote.textContent = '所有边都已合法相接，线网解开。';
    } else {
      goalNote.textContent = `${report.count} 处冲突。拖动红色节点或相关连线。`;
    }
  }

  function renderScene() {
    if (!graph) return null;
    edgeElements.forEach((line, index) => {
      const edge = graph.edges[index];
      const a = points[edge[0]], b = points[edge[1]];
      line.setAttribute('x1', a[0].toFixed(2));
      line.setAttribute('y1', a[1].toFixed(2));
      line.setAttribute('x2', b[0].toFixed(2));
      line.setAttribute('y2', b[1].toFixed(2));
    });
    const report = E.detectConflicts(points, graph.edges, { bounds: E.BOUNDS });
    lastReport = report;
    edgeElements.forEach((line, index) => {
      line.classList.toggle('conflict', report.edgeFlags[index]);
    });
    nodeElements.forEach((node, index) => {
      const point = points[index];
      node.style.left = (point[0] / E.WIDTH * 100).toFixed(4) + '%';
      node.style.top = (point[1] / E.HEIGHT * 100).toFixed(4) + '%';
      node.classList.toggle('conflict', report.nodeFlags[index]);
      node.classList.toggle('selected', selected === index);
      node.classList.toggle('dragging', !!drag && drag.index === index);
      node.setAttribute('aria-pressed', String(selected === index));
      node.setAttribute('aria-label',
        `节点 ${graph.nodes[index]}` +
        (report.nodeFlags[index] ? '，存在冲突' : '') +
        (selected === index ? '，已选中' : ''));
      node.tabIndex = 0;
    });
    conflictCount.textContent = String(report.count);
    movesCount.textContent = String(history.length);
    undoButton.disabled = history.length === 0;
    board.classList.toggle('solved', report.count === 0);
    updateGoal(report);
    updateSelectionNote();
    return report;
  }

  function moveNodeTo(index, point, source) {
    const previous = [points[index][0], points[index][1]];
    const next = E.clampPoint(point, E.BOUNDS);
    if (Math.hypot(next[0] - previous[0], next[1] - previous[1]) < 0.05) return false;
    points[index] = next;
    history.push({ index, from: previous });
    selected = index;
    const report = renderScene();
    finishMove(source);
    return report;
  }

  function finishMove(source) {
    const report = renderScene();
    const solved = report.count === 0;
    const wasSolved = currentSolved;
    currentSolved = solved;
    updateRecordDisplay();
    updateCollection();
    if (solved) {
      if (!wasSolved) completeCurrent();
      else {
        nextButton.hidden = !(mode === 'level' && levelIndex < LEVEL_COUNT - 1);
        setMessage('线网保持解开', `已经完成 ${history.length} 次移动。`, 'won');
        announce(`线网已解开，共 ${history.length} 次移动`);
      }
    } else {
      nextButton.hidden = true;
      const prefix = source === 'undo' ? '撤销了一步' : source === 'keyboard' ? `第 ${history.length} 次移动` : '还剩冲突';
      setMessage(prefix, `当前有 ${report.count} 处冲突。红色线段或节点需要调整。`);
      announce(`${source === 'undo' ? '已撤销' : `第 ${history.length} 次移动`}，冲突 ${report.count} 处`);
    }
  }

  function completeCurrent() {
    const moves = history.length;
    let first = false, improved = false;
    if (mode === 'level') {
      first = !records.stars[levelIndex];
      if (first) records.stars[levelIndex] = true;
      if (records.best[levelIndex] === null || moves < records.best[levelIndex]) {
        records.best[levelIndex] = moves;
        improved = true;
      }
      if (first || improved) saveRecords();
      updateCollection(first ? levelIndex : undefined);
      updateRecordDisplay();
      nextButton.hidden = levelIndex >= LEVEL_COUNT - 1;
    } else {
      nextButton.hidden = true;
    }
    const allDone = records.stars.every(Boolean);
    board.classList.remove('celebrate');
    void board.offsetWidth;
    board.classList.add('celebrate');
    clearTimeout(celebrateTimer);
    celebrateTimer = window.setTimeout(() => board.classList.remove('celebrate'), 850);
    let title, detail;
    if (mode === 'level') {
      title = first ? `解开第 ${levelIndex + 1} 关，点亮一颗星` : `第 ${levelIndex + 1} 关解开了`;
      if (allDone) {
        title = '十二关全部解开';
        detail = `本局用了 ${moves} 次移动。十二颗星已经集齐，固定关卡记录已保存。`;
      } else if (first) {
        detail = `本局用了 ${moves} 次移动，点亮一颗星。移动次数只作记录。`;
      } else if (improved) {
        detail = `本局用了 ${moves} 次移动，刷新了本关最佳记录。`;
      } else {
        detail = `本局用了 ${moves} 次移动。本关最佳仍是 ${records.best[levelIndex]} 次。`;
      }
    } else {
      title = '线网解开了';
      detail = `本局用了 ${moves} 次移动。每日与随机挑战不点亮十二星，也不写入固定关卡记录。`;
    }
    setMessage(title, detail, 'won');
    announce(`${title}。${detail}`);
  }

  function undo() {
    if (drag) {
      cancelDrag(true);
      renderScene();
      setMessage('拖动已取消', '可以重新拖动节点，或按 Z 撤销上一步。');
      return;
    }
    if (!history.length) return;
    const entry = history.pop();
    points[entry.index] = entry.from.slice();
    selected = entry.index;
    const report = renderScene();
    currentSolved = report.count === 0;
    nextButton.hidden = !(currentSolved && mode === 'level' && levelIndex < LEVEL_COUNT - 1);
    updateCollection();
    finishMove('undo');
    nodeElements[entry.index].focus({ preventScroll: true });
  }

  function restart() {
    cancelDrag(false);
    clearCelebration();
    points = graph.start.map(point => [point[0], point[1]]);
    history = [];
    selected = null;
    currentSolved = false;
    nextButton.hidden = true;
    const report = renderScene();
    updateCollection();
    setMessage('已重开', `当前有 ${report.count} 处冲突。通关星星和最佳记录不会被清除。`);
    announce(`已重开，${report.count} 处冲突`);
  }

  function clearCelebration() {
    clearTimeout(celebrateTimer);
    board.classList.remove('celebrate');
    board.classList.remove('solved');
  }

  function updateBestIfNeeded() {
    updateRecordDisplay();
  }

  function onSurfaceClick(event) {
    if (performance.now() - lastMultiTouchTime < 500) return;
    if (suppressSurfaceClick) { suppressSurfaceClick = false; return; }
    if (drag) return;
    if (selected === null) {
      setMessage('先选择一个节点', '点一下节点，再点空白处移动；也可以直接拖动节点。');
      announce('请先选择一个节点');
      return;
    }
    const point = clientToBoard(event.clientX, event.clientY);
    moveNodeTo(selected, point, 'click');
  }

  function clientToBoard(clientX, clientY) {
    const rect = boardSurface.getBoundingClientRect();
    if (!rect.width || !rect.height) return [0, 0];
    return [
      (clientX - rect.left) / rect.width * E.WIDTH,
      (clientY - rect.top) / rect.height * E.HEIGHT
    ];
  }

  function onNodePointerDown(event) {
    if (multiTouch || activePointers.size > 1) return;
    if (drag) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index)) return;
    selected = index;
    event.currentTarget.focus({ preventScroll: true });
    updateSelectionNote();
    renderScene();
    const startPoint = clientToBoard(event.clientX, event.clientY);
    drag = {
      pointerId: event.pointerId,
      index,
      node: event.currentTarget,
      startPoint,
      moved: false,
      from: [points[index][0], points[index][1]]
    };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
    if (event.pointerType === 'mouse') event.preventDefault();
    announce(`已选中节点 ${graph.nodes[index]}`);
  }

  function onNodePointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId || multiTouch) return;
    const point = clientToBoard(event.clientX, event.clientY);
    if (!drag.moved) {
      if (Math.hypot(point[0] - drag.startPoint[0], point[1] - drag.startPoint[1]) < 0.6) return;
      drag.moved = true;
    }
    points[drag.index] = E.clampPoint(point, E.BOUNDS);
    renderScene();
  }

  function onNodePointerUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const index = drag.index;
    const moved = drag.moved;
    const node = drag.node;
    const from = drag.from;
    drag = null;
    try { node.releasePointerCapture(event.pointerId); } catch {}
    if (!moved) {
      points[index] = from.slice();
      renderScene();
      setMessage('节点已选中', `节点 ${graph.nodes[index]} 已选中。拖动它，或点击棋盘空白处移动。`);
      return;
    }
    history.push({ index, from });
    selected = index;
    suppressSurfaceClick = true;
    renderScene();
    finishMove('drag');
    node.focus({ preventScroll: true });
  }

  function onNodePointerCancel(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    cancelDrag(true);
    renderScene();
    setMessage('拖动已取消', '多指操作或系统手势会取消当前拖动。节点已回到拖动前的位置。');
    announce('拖动已取消');
  }

  function cancelDrag(revert) {
    if (!drag) return;
    const current = drag;
    drag = null;
    if (revert) points[current.index] = current.from.slice();
    try { current.node.releasePointerCapture(current.pointerId); } catch {}
    renderScene();
    updateSelectionNote();
  }

  function onNodeKeyDown(event) {
    const index = Number(event.currentTarget.dataset.index);
    const movement = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]
    }[event.key];
    if (movement) {
      event.preventDefault();
      if (drag || multiTouch) return;
      const step = event.shiftKey ? 32 : 8;
      const point = [points[index][0] + movement[0] * step, points[index][1] + movement[1] * step];
      moveNodeTo(index, point, 'keyboard');
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectNode(index, false);
    }
  }

  function trackPointerDown(event) {
    activePointers.set(event.pointerId, true);
    if (activePointers.size > 1) {
      multiTouch = true;
      lastMultiTouchTime = performance.now();
      if (drag) cancelDrag(true);
    }
  }

  function trackPointerEnd(event) {
    activePointers.delete(event.pointerId);
    if (!activePointers.size) multiTouch = false;
  }

  function goNext() {
    if (mode !== 'level' || levelIndex >= LEVEL_COUNT - 1) return;
    loadFixedLevel(levelIndex + 1);
  }

  function loadDaily() {
    try {
      const date = E.shanghaiDateString();
      const seed = E.dateSeed(date);
      const generated = E.generate(seed, 'hard');
      loadGraph({
        mode: 'daily',
        levelIndex: null,
        name: '每日线网',
        tier: '每日',
        nodes: generated.nodes,
        edges: E.cloneEdges(generated.edges),
        start: E.clonePoints(generated.start),
        n: generated.n,
        m: generated.m,
        dailyDate: date,
        randomSeed: null,
        randomDifficulty: null
      });
      announce(`每日一局已载入，${E.formatDateCN(date)}`);
    } catch (error) {
      setMessage('生成每日线网失败', String(error && error.message || error), 'error');
    }
  }

  function loadRandom() {
    try {
      randomClicks++;
      const seed = (Date.now() ^ Math.imul(randomClicks, 0x9e3779b9) ^ Math.floor(Math.random() * 4294967296)) >>> 0;
      const difficulty = randomClicks % 3 === 0 ? 'expert' : 'hard';
      const generated = E.generate(seed, difficulty);
      loadGraph({
        mode: 'random',
        levelIndex: null,
        name: '随机线网',
        tier: difficulty === 'expert' ? '专家' : '困难',
        nodes: generated.nodes,
        edges: E.cloneEdges(generated.edges),
        start: E.clonePoints(generated.start),
        n: generated.n,
        m: generated.m,
        dailyDate: null,
        randomSeed: seed,
        randomDifficulty: difficulty
      });
      announce('随机线网已载入');
    } catch (error) {
      setMessage('生成随机线网失败', String(error && error.message || error), 'error');
    }
  }

  function initTheme() {
    const root = document.documentElement;
    const meta = document.querySelector('meta[name="theme-color"]');
    const system = matchMedia('(prefers-color-scheme: dark)');
    function storedPreference() {
      try { return localStorage.getItem('yaozi.home.theme'); } catch { return null; }
    }
    let preference = storedPreference();
    function apply(theme) {
      root.dataset.theme = theme;
      if (meta) meta.content = theme === 'dark' ? '#0d1826' : '#edf3f9';
      themeButton.setAttribute('aria-label', theme === 'dark' ? '切换至浅色模式' : '切换至深色模式');
      themeButton.title = theme === 'dark' ? '切换至浅色模式' : '切换至深色模式';
    }
    apply(root.dataset.theme === 'dark' ? 'dark' : 'light');
    themeButton.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      preference = next;
      apply(next);
      try { localStorage.setItem('yaozi.home.theme', next); } catch {}
    });
    system.addEventListener('change', event => {
      if (preference !== 'light' && preference !== 'dark') apply(event.matches ? 'dark' : 'light');
    });
  }

  function buildCollection() {
    for (let i = 0; i < LEVEL_COUNT; i++) {
      const slot = document.createElement('div');
      slot.className = 'star-slot';
      slot.id = 'star-' + i;
      slot.dataset.index = String(i);
      slot.setAttribute('role', 'listitem');
      slot.innerHTML = starIcon + `<span>${i + 1}</span>`;
      starSlotListeners(slot);
      starSlots.push(slot);
      starShelf.append(slot);
    }
    for (let i = 0; i < LEVEL_COUNT; i++) {
      const level = E.LEVELS[i];
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'level-' + i;
      button.className = 'level';
      button.dataset.level = String(i);
      button.innerHTML =
        `<span class="level-number">${String(i + 1).padStart(2, '0')}</span>` +
        `<span class="level-main"><b></b><small>${level.n} 点 · ${level.m} 线 · ${level.tier}</small></span>` +
        `<span class="level-star" aria-hidden="true">${starIcon}</span>`;
      button.querySelector('b').textContent = level.name;
      button.addEventListener('click', () => loadFixedLevel(i));
      levelButtons.push(button);
      levelsHost.append(button);
    }
  }

  function starSlotListeners(slot) {
    slot.addEventListener('animationend', () => slot.classList.remove('new-star'));
  }

  function bindGlobalEvents() {
    undoButton.addEventListener('click', undo);
    restartButton.addEventListener('click', restart);
    nextButton.addEventListener('click', goNext);
    $('daily').addEventListener('click', loadDaily);
    $('random').addEventListener('click', loadRandom);
    boardSurface.addEventListener('pointerdown', () => { suppressSurfaceClick = false; });
    boardSurface.addEventListener('click', onSurfaceClick);
    window.addEventListener('pointerdown', trackPointerDown, true);
    window.addEventListener('pointerup', trackPointerEnd, true);
    window.addEventListener('pointercancel', trackPointerEnd, true);
    document.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      const tag = event.target && event.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (event.key === 'z' || event.key === 'Z') {
        event.preventDefault();
        undo();
      } else if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        restart();
      }
    });
  }

  function snapshot() {
    const report = graph ? E.detectConflicts(points, graph.edges, { bounds: E.BOUNDS }) : null;
    const level = graph ? {
      mode,
      index: levelIndex,
      name: graph.name,
      tier: graph.tier,
      nodes: graph.nodes.slice(),
      edges: E.cloneEdges(graph.edges),
      start: E.clonePoints(graph.start),
      n: graph.n,
      m: graph.m,
      hasWitness: true
    } : null;
    return {
      ready: true,
      mode,
      levelIndex,
      levelCount: LEVEL_COUNT,
      level,
      graph: graph ? {
        nodes: graph.nodes.slice(),
        edges: E.cloneEdges(graph.edges)
      } : null,
      coords: points.map(point => [point[0], point[1]]),
      status: report && report.count === 0 ? 'solved' : 'playing',
      solved: !!report && report.count === 0,
      conflictCount: report ? report.count : 0,
      conflicts: report ? report.conflicts.map(conflict => {
        if (conflict.nodes) return { type: conflict.type, nodes: conflict.nodes.slice() };
        if (conflict.edges) return { type: conflict.type, edges: conflict.edges.slice() };
        if (conflict.edge !== undefined) return { type: conflict.type, node: conflict.node, edge: conflict.edge };
        return { type: conflict.type, node: conflict.node };
      }) : [],
      selectedIndex: selected,
      dragging: !!drag,
      moves: history.length,
      canUndo: history.length > 0,
      nextVisible: !nextButton.hidden,
      records: {
        stars: records.stars.slice(),
        best: records.best.slice()
      },
      stars: records.stars.slice(),
      best: records.best.slice(),
      dailyDate,
      randomSeed,
      randomDifficulty,
      storageAvailable
    };
  }

  window.TronixGame = Object.freeze({
    snapshot,
    loadLevel: loadFixedLevel,
    ready: () => readyPromise
  });

  initTheme();
  buildCollection();
  bindGlobalEvents();
  loadFixedLevel(0);
  updateBestIfNeeded();
  resolveReady(snapshot());
})();
