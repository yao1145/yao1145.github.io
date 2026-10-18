(() => {
  'use strict';
  const E = window.CrownTourEngine, $ = id => document.getElementById(id);
  const board = $('board'), boardScene = $('board-scene'), boardPanel = $('board-panel'), trail = $('trail'), trailPath = $('trail-path');
  const crown = $('crown'), message = $('message'), levelsHost = $('levels'), starShelf = $('star-shelf');
  const crownDialog = $('crown-dialog'), motionSelect = $('motion');
  const STORAGE_KEY = 'crown.tour.v1', LEVEL_COUNT = E.LEVELS.length;
  const starPath = 'M12 2.8 14.8 8.5 21 9.4 16.5 13.8 17.6 20 12 17.1 6.4 20 7.5 13.8 3 9.4 9.2 8.5Z';
  const starIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${starPath}"/></svg>`;
  let records = Array(LEVEL_COUNT).fill(false), storageAvailable = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw), list = Array.isArray(saved) ? saved : saved && saved.levels;
      if (Array.isArray(list) && list.length === LEVEL_COUNT) {
        records = list.map(record => record === true || (record && typeof record === 'object') ? true : false);
      }
    }
  } catch { storageAvailable = false; }
  const starSlots = [];
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const slot = document.createElement('div');
    slot.className = 'star-slot'; slot.setAttribute('role', 'listitem');
    slot.innerHTML = starIcon + `<span>${i + 1}</span>`;
    slot.addEventListener('animationend', () => slot.classList.remove('new-star'));
    starSlots.push(slot); starShelf.append(slot);
    const spark = document.createElement('span');
    spark.className = 'orbit-star'; spark.innerHTML = starIcon;
    const angle = (i * 30 - 90) * Math.PI / 180;
    spark.style.setProperty('--orbit-x', (50 + Math.cos(angle) * 43) + '%');
    spark.style.setProperty('--orbit-y', (50 + Math.sin(angle) * 43) + '%');
    spark.style.setProperty('--spark-delay', (i * 50) + 'ms');
    $('crown-orbit').append(spark);
  }
  function storageNotice() {
    if (!storageAvailable) {
      $('storage-note').hidden = false;
      $('storage-note').textContent = '当前浏览器无法保存收藏；星星将在本次打开期间保留。';
    }
  }
  function saveRecords() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, levels: records })); }
    catch { storageAvailable = false; storageNotice(); }
  }
  let state = null, history = [], tiles = [], levelButtons = [], focusIndex = 0;
  let generating = false, generationToken = 0;
  let animating = false, queue = [], crownAnimation = null, motionEpoch = 0, flushing = false;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let explicitMotion = false;
  if (reducedMotion.matches) motionSelect.value = '0';
  function announce(text) { $('announcement').textContent = window.GameLocale?.t(text) || text; }
  function motionDuration() { return Number(motionSelect.value); }
  function revealBoard() {
    boardPanel.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
  }
  function dailyLabel(date) {
    const key = date || E.dailyKey(), parts = key.split('-');
    if (window.GameLocale?.language === 'en') return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(parts[1]) - 1]} ${Number(parts[2])}`;
    return `${Number(parts[1])} 月 ${Number(parts[2])} 日`;
  }
  function visitMap() {
    const seen = new Uint8Array(state.w * state.h);
    for (const cell of state.path) seen[cell] = 1;
    return seen;
  }
  function legalMoves() {
    if (!state || state.status !== 'playing') return [];
    const seen = visitMap(), last = state.path[state.path.length - 1];
    return E.neighbors(last, state.w, state.h).filter(cell => !seen[cell]);
  }
  function evaluateStatus() {
    const total = state.w * state.h, last = state.path[state.path.length - 1];
    if (state.path.length === total) {
      state.status = state.end === null || last === state.end ? 'won' : 'lost';
      state.lostReason = state.status === 'lost' ? 'end' : '';
      return;
    }
    const seen = visitMap();
    const exits = E.neighbors(last, state.w, state.h).some(cell => !seen[cell]);
    state.status = exits ? 'playing' : 'lost';
    state.lostReason = exits ? '' : 'dead';
  }
  function title() {
    if (state.mode === 'daily') return `每日一局 · ${dailyLabel(state.dailyDate)}`;
    if (state.mode === 'random') return '随机挑战';
    const level = E.LEVELS[state.levelIndex];
    return `第 ${state.levelIndex + 1} 关 · ${level.name}`;
  }
  function meta() {
    const start = E.coord(state.start, state.w);
    return state.end === null
      ? `${state.w} × ${state.h} · 起点 ${start}`
      : `${state.w} × ${state.h} · 起点 ${start} · 终点 ${E.coord(state.end, state.w)}`;
  }
  function updateTabStops() {
    tiles.forEach((tile, index) => { tile.tabIndex = index === focusIndex ? 0 : -1; });
  }
  function fitBoard() {
    if (!state) return;
    const sceneWidth = boardScene.clientWidth;
    if (!sceneWidth) return;
    const maxHeight = Math.max(240, Math.min(window.innerHeight * 0.66, 620));
    const width = Math.min(sceneWidth, 560, Math.max(160, maxHeight * state.w / state.h));
    board.style.width = width + 'px';
    board.style.height = (width * state.h / state.w) + 'px';
  }
  function buildBoard() {
    const total = state.w * state.h, cells = [];
    board.style.setProperty('--w', state.w);
    board.style.setProperty('--h', state.h);
    tiles = [];
    for (let index = 0; index < total; index++) {
      const x = index % state.w, y = Math.floor(index / state.w);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell' + (((x + y) & 1) ? ' alt' : '');
      cell.dataset.index = String(index);
      cell.innerHTML = '<span class="step"></span><span class="coord"></span><span class="marker"></span>';
      cell.querySelector('.coord').textContent = E.coord(index, state.w);
      cell.addEventListener('click', () => requestMove(index));
      cell.addEventListener('focus', () => { focusIndex = index; updateTabStops(); });
      cell.addEventListener('keydown', event => {
        const movement = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
        if (!movement) return;
        event.preventDefault();
        const nx = index % state.w + movement[0], ny = Math.floor(index / state.w) + movement[1];
        if (nx < 0 || nx >= state.w || ny < 0 || ny >= state.h) return;
        focusIndex = ny * state.w + nx;
        updateTabStops();
        tiles[focusIndex].focus({ preventScroll: true });
      });
      cells.push(cell); tiles.push(cell);
    }
    board.replaceChildren(...cells, trail, crown);
    updateTabStops();
    fitBoard();
    requestAnimationFrame(() => { fitBoard(); renderTrail(); if (state && !animating) positionCrown(state.path[state.path.length - 1]); });
  }
  function renderTrail() {
    if (!state) return;
    const width = board.clientWidth, height = board.clientHeight;
    if (!width || !height) return;
    trail.setAttribute('viewBox', `0 0 ${width} ${height}`);
    if (state.path.length < 2) { trailPath.setAttribute('d', ''); return; }
    let d = '';
    for (let i = 1; i < state.path.length; i++) {
      const from = tiles[state.path[i - 1]], to = tiles[state.path[i]];
      if (!from || !to) continue;
      const ax = from.offsetLeft + from.offsetWidth / 2, ay = from.offsetTop + from.offsetHeight / 2;
      const bx = to.offsetLeft + to.offsetWidth / 2, by = to.offsetTop + to.offsetHeight / 2;
      if (i === 1) d += `M${ax} ${ay}`;
      d += ` L${bx} ${by}`;
    }
    trailPath.setAttribute('d', d);
  }
  function crownBox(index) {
    const tile = tiles[index];
    if (!tile) return null;
    const size = Math.max(18, Math.min(tile.offsetWidth, tile.offsetHeight) * 0.72);
    return {
      size,
      left: tile.offsetLeft + (tile.offsetWidth - size) / 2,
      top: tile.offsetTop + (tile.offsetHeight - size) / 2
    };
  }
  function positionCrown(index) {
    const box = crownBox(index);
    if (!box) return;
    crown.style.width = box.size + 'px';
    crown.style.height = box.size + 'px';
    crown.style.transform = `translate(${box.left}px,${box.top}px)`;
  }
  function cancelMotion() {
    motionEpoch++;
    queue = [];
    if (crownAnimation) { crownAnimation.cancel(); crownAnimation = null; }
    animating = false;
  }
  function animateCrown(from, to, duration) {
    if (crownAnimation) { crownAnimation.cancel(); crownAnimation = null; }
    const a = crownBox(from), b = crownBox(to);
    if (!a || !b) { positionCrown(to); return Promise.resolve(); }
    crown.style.width = b.size + 'px'; crown.style.height = b.size + 'px';
    const animation = crown.animate([
      { transform: `translate(${a.left}px,${a.top}px)` },
      { transform: `translate(${b.left}px,${b.top}px)` }
    ], { duration, easing: 'cubic-bezier(.32,.08,.3,1)' });
    crownAnimation = animation;
    return animation.finished.catch(() => {}).then(() => {
      if (crownAnimation === animation) crownAnimation = null;
    });
  }
  function renderCells() {
    const total = state.w * state.h, last = state.path[state.path.length - 1];
    const seen = visitMap(), order = new Int16Array(total).fill(-1);
    state.path.forEach((cell, index) => { order[cell] = index + 1; });
    const legal = new Set(legalMoves());
    tiles.forEach((tile, index) => {
      const step = order[index], isCurrent = index === last, isLegal = legal.has(index);
      tile.classList.toggle('visited', step > 0);
      tile.classList.toggle('current', isCurrent);
      tile.classList.toggle('legal', isLegal);
      tile.classList.toggle('start', index === state.start);
      tile.classList.toggle('target', state.end !== null && index === state.end);
      tile.querySelector('.step').textContent = step > 0 ? String(step) : '';
      tile.querySelector('.marker').textContent = index === state.start ? '起' : state.end !== null && index === state.end ? '终' : '';
      tile.dataset.legal = String(isLegal);
      tile.dataset.step = step > 0 ? String(step) : '0';
      tile.setAttribute('aria-label',
        `${E.coord(index, state.w)}，${step > 0 ? `第 ${step} 步` : '尚未巡游'}` +
        `${isCurrent ? '，王冠在此' : ''}${isLegal ? '，可走' : ''}` +
        `${state.end !== null && index === state.end ? '，终点' : ''}`);
      tile.tabIndex = index === focusIndex ? 0 : -1;
    });
  }
  function renderStats() {
    const total = state.w * state.h, visited = state.path.length;
    const exits = legalMoves().length;
    $('visited').textContent = String(visited);
    $('total').textContent = `/ ${total}`;
    $('exits').textContent = String(exits);
    $('used').textContent = String(visited - 1);
    $('start-cell').textContent = E.coord(state.start, state.w);
    $('end-budget').hidden = state.end === null;
    if (state.end !== null) $('end-cell').textContent = E.coord(state.end, state.w);
    const percent = total ? visited / total * 100 : 0;
    $('progress-fill').style.width = percent + '%';
    $('progress').setAttribute('aria-valuemax', String(total));
    $('progress').setAttribute('aria-valuenow', String(visited));
    $('progress').setAttribute('aria-valuetext', `已巡 ${visited} / ${total} 格`);
    if (state.status === 'won') $('remaining-note').textContent = `${total} 格全部踏遍。`;
    else if (state.status === 'lost') {
      $('remaining-note').textContent = state.lostReason === 'end'
        ? `巡游完整，但终点应是 ${E.coord(state.end, state.w)}。`
        : `还差 ${total - visited} 格，王冠已无路可走。`;
    } else $('remaining-note').textContent = `还差 ${total - visited} 格。`;
  }
  function renderMessage() {
    let heading, detail, tone = '';
    if (generating) {
      heading = '正在生成棋盘'; detail = '正在搜索一条完整的开放巡游…';
    } else if (state.notice) {
      heading = state.notice.title; detail = state.notice.detail; tone = state.notice.tone || '';
    } else if (state.status === 'won') {
      const total = state.w * state.h;
      heading = '巡游完成！';
      detail = `用 ${total - 1} 步踏遍 ${total} 格。`;
      if (state.mode === 'level') {
        const index = state.levelIndex;
        if (state.newStar) detail += `点亮了第 ${index + 1} 颗星！`;
        else detail += ' 本关星星此前已收藏。';
        if (records.every(Boolean)) detail += ' 十二星冠已解锁！';
      } else {
        detail += state.mode === 'daily' ? ' 每日棋盘不计入十二星。' : ' 随机棋盘不计入十二星。';
      }
      tone = 'won';
    } else if (state.status === 'lost') {
      if (state.lostReason === 'end') {
        heading = '巡游完整，王冠未归位';
        detail = `你踏遍了全盘，但终点应在 ${E.coord(state.end, state.w)}。撤销最后几步，或重开。`;
      } else {
        heading = '无路可走';
        detail = `还有 ${state.w * state.h - state.path.length} 格未巡，但王冠已被围住。撤销一步，或重开。`;
      }
      tone = 'lost';
    } else {
      const total = state.w * state.h, last = state.path[state.path.length - 1];
      if (state.path.length === 1) {
        heading = `王冠落在 ${E.coord(last, state.w)}`;
        detail = '王冠只走日字。先观察哪些格子能接上，再为剩下的格子留好退路。';
      } else {
        const exits = legalMoves().length;
        heading = '巡游进行中';
        detail = exits === 1
          ? `已巡 ${state.path.length} / ${total} 格。现在只有 1 条去路。`
          : `已巡 ${state.path.length} / ${total} 格，当前有 ${exits} 条去路。`;
      }
    }
    const h = document.createElement('h2'), p = document.createElement('p');
    h.textContent = heading; p.textContent = detail;
    message.className = 'message' + (tone ? ' ' + tone : '');
    message.replaceChildren(h, p);
  }
  function renderSequence() {
    const text = state.path.map(cell => E.coord(cell, state.w)).join(' → ');
    $('sequence').textContent = text || '—';
    $('sequence').setAttribute('aria-label', text ? `巡游足迹：${text}` : '尚未移动');
  }
  function renderControls() {
    $('undo').disabled = !history.length || generating || !state;
    $('restart').disabled = generating || !state;
    $('next').hidden = !state || state.mode !== 'level' || state.status !== 'won' || state.levelIndex >= LEVEL_COUNT - 1;
    $('daily').disabled = generating;
    $('random').disabled = generating;
  }
  function renderRecords(fresh = -1) {
    const count = records.filter(Boolean).length;
    $('star-count').textContent = `${count} / ${LEVEL_COUNT}`;
    $('collection-note').textContent = count === LEVEL_COUNT ? '十二关全部通关，你的巡游星冠已解锁。' : '每关首次通关，点亮一颗星。';
    $('view-crown').disabled = count < LEVEL_COUNT;
    $('view-crown').textContent = count === LEVEL_COUNT ? '查看我的星冠' : `还差 ${LEVEL_COUNT - count} 颗星`;
    $('collection').classList.toggle('complete', count === LEVEL_COUNT);
    $('progress-label').textContent = `已通关 ${count} / ${LEVEL_COUNT}`;
    starSlots.forEach((slot, index) => {
      const record = records[index];
      slot.classList.toggle('earned', !!record);
      slot.classList.toggle('selected', state.mode === 'level' && state.levelIndex === index);
      if (fresh === index) slot.classList.add('new-star');
      slot.setAttribute('aria-label', `第 ${index + 1} 关，${record ? '已通关' : '尚未通关'}`);
    });
    levelButtons.forEach((button, index) => {
      const record = records[index];
      button.classList.toggle('done', !!record);
      button.setAttribute('aria-pressed', String(state.mode === 'level' && state.levelIndex === index));
      const level = E.LEVELS[index];
      button.setAttribute('aria-label', `第 ${index + 1} 关，${level.name}，${level.w}×${level.h} 棋盘${record ? '，已通关' : ''}`);
    });
  }
  function render() {
    if (!state) return;
    $('level-title').textContent = title();
    $('board-meta').textContent = meta();
    $('end-legend').hidden = state.end === null;
    renderCells();
    renderStats();
    renderMessage();
    renderSequence();
    renderControls();
    renderRecords();
    renderTrail();
    if (!animating) positionCrown(state.path[state.path.length - 1]);
    window.GameLocale?.apply();
  }
  function handleWin() {
    state.newStar = false;
    if (state.mode !== 'level') {
      crown.classList.remove('celebrate'); void crown.offsetWidth; crown.classList.add('celebrate');
      setTimeout(() => crown.classList.remove('celebrate'), 900);
      announce('巡游完成。本局不计入十二星。');
      return;
    }
    const index = state.levelIndex, first = !records[index];
    records[index] = true;
    saveRecords();
    state.newStar = first;
    if (first) {
      starSlots[index].classList.remove('new-star');
      void starSlots[index].offsetWidth;
      starSlots[index].classList.add('new-star');
    }
    crown.classList.remove('celebrate'); void crown.offsetWidth; crown.classList.add('celebrate');
    setTimeout(() => crown.classList.remove('celebrate'), 900);
    if (first) {
      const count = records.filter(Boolean).length;
      if (count === LEVEL_COUNT) setTimeout(showCrown, 600);
      announce(`第 ${index + 1} 关通关，点亮第 ${index + 1} 颗星。`);
    } else announce(`第 ${index + 1} 关通关。`);
  }
  function flush() {
    if (flushing || !state || animating || generating) return;
    if (state.status !== 'playing') { queue = []; return; }
    flushing = true;
    while (queue.length && !animating && state.status === 'playing') {
      const next = queue.shift(), before = state.path.length;
      commitMove(next);
      if (animating) break;
      if (state.path.length === before) continue;
    }
    flushing = false;
  }
  function commitMove(index) {
    if (!state || state.status !== 'playing' || generating) return;
    const seen = visitMap(), last = state.path[state.path.length - 1];
    if (seen[index] || !E.isKnightMove(last, index, state.w, state.h)) return;
    const from = last;
    history.push({ path: state.path.slice() });
    state.path.push(index);
    state.notice = null;
    focusIndex = index;
    evaluateStatus();
    if (state.status === 'won') handleWin();
    const epoch = ++motionEpoch;
    render();
    const duration = motionDuration();
    if (duration > 0) {
      animating = true;
      positionCrown(from);
      renderControls();
      animateCrown(from, index, duration).then(() => {
        if (epoch !== motionEpoch) return;
        animating = false;
        positionCrown(index);
        renderControls();
        flush();
      });
    } else {
      positionCrown(index);
      flush();
    }
    if (tiles[index]) tiles[index].focus({ preventScroll: true });
    announce(`王冠走到 ${E.coord(index, state.w)}，已巡 ${state.path.length} 格。`);
  }
  function requestMove(index) {
    if (!state || state.status !== 'playing' || generating) return;
    if (animating) { if (queue.length < 4) queue.push(index); return; }
    commitMove(index);
  }
  function undo() {
    if (!state || !history.length || generating) return;
    cancelMotion();
    const previous = history.pop();
    state.path = previous.path;
    state.notice = null;
    evaluateStatus();
    focusIndex = state.path[state.path.length - 1];
    render();
    updateTabStops();
    if (tiles[focusIndex]) tiles[focusIndex].focus({ preventScroll: true });
    announce(`已撤销一步，王冠回到 ${E.coord(focusIndex, state.w)}。`);
  }
  function restart() {
    if (!state || generating) return;
    cancelMotion();
    history = [];
    state.path = [state.start];
    state.status = 'playing'; state.lostReason = ''; state.notice = null;
    state.newStar = false;
    focusIndex = state.start;
    render();
    updateTabStops();
    if (tiles[state.start]) tiles[state.start].focus({ preventScroll: true });
    announce('本局已重开。');
  }
  function loadLevel(index, focus = false) {
    generationToken++; generating = false;
    cancelMotion();
    const level = E.LEVELS[index];
    state = {
      mode: 'level', levelIndex: index, w: level.w, h: level.h, start: level.start, end: level.end,
      path: [level.start], status: 'playing', lostReason: '',
      notice: null, newStar: false, dailyDate: ''
    };
    history = []; focusIndex = level.start;
    buildBoard(); render();
    if (focus && tiles[level.start]) {
      tiles[level.start].focus({ preventScroll: true });
      revealBoard();
    }
  }
  async function loadGenerated(kind) {
    if (generating) return;
    cancelMotion();
    const token = ++generationToken;
    generating = true;
    renderControls(); renderMessage();
    await new Promise(resolve => setTimeout(resolve, 20));
    if (token !== generationToken) return;
    let result = null;
    try {
      const seed = kind === 'daily' ? E.dailySeed() : E.randomSeed();
      result = E.generate(seed);
    } catch { result = null; }
    if (token !== generationToken) return;
    generating = false;
    if (!result) {
      state.notice = { title: '棋盘生成失败', detail: '没有找到合适的棋盘，请再试一次。', tone: 'error' };
      render(); return;
    }
    state = {
      mode: kind, levelIndex: -1, w: result.w, h: result.h, start: result.start, end: null,
      path: [result.start], status: 'playing', lostReason: '',
      notice: null, newStar: false, dailyDate: kind === 'daily' ? E.dailyKey() : ''
    };
    history = []; focusIndex = result.start;
    buildBoard(); render();
    if (tiles[result.start]) tiles[result.start].focus({ preventScroll: true });
    revealBoard();
    announce(`${kind === 'daily' ? '每日' : '随机'}棋盘已生成：${result.w} × ${result.h}，起点 ${E.coord(result.start, result.w)}。`);
  }
  function showCrown() {
    if (records.filter(Boolean).length < LEVEL_COUNT || crownDialog.open) return;
    crownDialog.showModal();
  }
  E.LEVELS.forEach((level, index) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'level'; button.dataset.level = String(index);
    button.innerHTML = `<b>${String(index + 1).padStart(2, '0')}</b><span>${level.w}×${level.h}</span>`;
    button.addEventListener('click', () => loadLevel(index, true));
    levelsHost.append(button); levelButtons.push(button);
  });
  $('restart').addEventListener('click', restart);
  $('undo').addEventListener('click', undo);
  $('next').addEventListener('click', () => { if (state.mode === 'level' && state.levelIndex < LEVEL_COUNT - 1) loadLevel(state.levelIndex + 1, true); });
  $('daily').addEventListener('click', () => loadGenerated('daily'));
  $('random').addEventListener('click', () => loadGenerated('random'));
  $('view-crown').addEventListener('click', showCrown);
  $('close-crown').addEventListener('click', () => crownDialog.close());
  $('return-game').addEventListener('click', () => crownDialog.close());
  crownDialog.addEventListener('close', () => $('view-crown').focus({ preventScroll: true }));
  motionSelect.addEventListener('change', () => {
    explicitMotion = true;
    if (motionSelect.value === '0' && crownAnimation) crownAnimation.finish();
  });
  reducedMotion.addEventListener('change', event => {
    if (!explicitMotion) motionSelect.value = event.matches ? '0' : '180';
  });
  document.addEventListener('keydown', event => {
    if (crownDialog.open) return;
    if (event.ctrlKey || event.metaKey || event.altKey || /^(SELECT|INPUT|TEXTAREA)$/.test(event.target.tagName) || event.target.isContentEditable || (event.target instanceof Element && event.target.closest('summary'))) return;
    const key = event.key.toLowerCase();
    if (key === 'z') { event.preventDefault(); undo(); }
    else if (key === 'r') { event.preventDefault(); restart(); }
  });
  function refitBoard() {
    if (!state) return;
    fitBoard(); renderTrail();
    if (!animating) positionCrown(state.path[state.path.length - 1]);
  }
  new ResizeObserver(refitBoard).observe(boardScene);
  window.addEventListener('resize', refitBoard);
  $('theme').addEventListener('click', () => {
    const value = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = value;
    try { localStorage.setItem('yaozi.home.theme', value); } catch {}
    $('theme').setAttribute('aria-label', value === 'dark' ? '切换至浅色模式' : '切换至深色模式');
    window.GameLocale?.apply();
    document.querySelector('meta[name="theme-color"]').content = value === 'dark' ? '#0d1826' : '#edf3f9';
  });
  const initialDark = document.documentElement.dataset.theme === 'dark';
  $('theme').setAttribute('aria-label', initialDark ? '切换至浅色模式' : '切换至深色模式');
  window.GameLocale?.apply();
  document.querySelector('meta[name="theme-color"]').content = initialDark ? '#0d1826' : '#edf3f9';
  window.refreshGameLanguage = () => render();
  storageNotice();
  window.KnightGame = Object.freeze({
    engine: E,
    snapshot: () => state ? {
      state: { ...state, path: state.path.slice() },
      records: records.slice(),
      stars: records.filter(Boolean).length,
      generating, animating, queued: queue.length
    } : null,
    ready: () => !!state && !generating && !animating && !queue.length
  });
  loadLevel(0);
})();
