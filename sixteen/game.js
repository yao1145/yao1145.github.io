(() => {
  'use strict';
  const E = SixteenEngine, $ = id => document.getElementById(id), board = $('board');
  let state = null, challenge = null, selection = 0, mode = 'mixed', direction = 1;
  try { if (localStorage.getItem('sixteen.rotation.v1') === 'ccw') direction = -1; } catch {}
  let history = [], route = [], current = { type: 'level', index: 0 }, loading = true, epoch = 0;
  let animating = false, animations = [], queue = [], gesture = null, suppressClick = 0;
  const pointers = new Set();
  let records = {};
  try {
    const saved = JSON.parse(localStorage.getItem('sixteen.minimum.v1') || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) for (const [key, value] of Object.entries(saved)) if (/^\d+$/.test(key) && value === true) records[key] = true;
  } catch { storageNotice(); }
  function storageNotice() { $('storage-note').hidden = false; $('storage-note').textContent = '当前浏览器无法保存记录，本次仍可正常游玩。'; }
  function save() { try { localStorage.setItem('sixteen.minimum.v1', JSON.stringify(records)); } catch { storageNotice(); } }
  const names = ['六步思考', '七步进阶', '八步纵横', '九步交错', '十步推演', '十一重环', '十二回转', '十三步局', '十四步阵', '十五重奏', '十六对极', '十七破局'];
  const highestIndex = E.LEVELS.length - 1;
  let worker = null, requestId = 0, searchProgress = null;
  const localSolver = createSixteenOptimal(E);
  const pending = new Map();
  function finish(id, result, error) {
    const item = pending.get(id); if (!item) return; pending.delete(id);
    error ? item.reject(error) : item.resolve(result);
  }
  function runLocal(id, item) {
    const task = item.type === 'optimal' ? localSolver.solve(item.board, { signal: item.controller.signal, onProgress: item.onProgress }) : E.generate(item.depth, item.seed);
    task.then(result => finish(id, result), error => finish(id, null, error));
  }
  function fallbackWorker() {
    if (worker) worker.terminate(); worker = null;
    for (const [id, item] of pending) runLocal(id, item);
  }
  function createWorker() {
    if (worker) return;
    try {
      const source = `const E = (${createSixteenEngine.toString()})(); const O = (${createSixteenOptimal.toString()})(E); onmessage = async ({data}) => { try { const result = data.type === 'optimal' ? await O.solve(data.board, {onProgress: progress => postMessage({id:data.id,progress})}) : await E.generate(data.depth, data.seed); postMessage({ id: data.id, result }); } catch(error) { postMessage({ id: data.id, error: error.message }); } };`;
      const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      try { worker = new Worker(url); } finally { URL.revokeObjectURL(url); }
      worker.onmessage = ({ data }) => {
        const item = pending.get(data.id); if (!item) return;
        if (data.progress) { item.onProgress?.(data.progress); return; }
        finish(data.id, data.result, data.error ? new Error(data.error) : null);
      };
      worker.onerror = event => { event.preventDefault(); fallbackWorker(); };
    } catch { worker = null; }
  }
  function stopTask() {
    if (worker && pending.size) { worker.terminate(); worker = null; }
    for (const [id, item] of pending) { item.controller.abort(); const error = new Error('Search cancelled'); error.name = 'AbortError'; finish(id, null, error); }
  }
  function request(type, parameters, onProgress) {
    return new Promise((resolve, reject) => {
      const id = ++requestId, item = { resolve, reject, type, ...parameters, onProgress, controller: new AbortController() }; pending.set(id, item);
      createWorker();
      if (!worker) { runLocal(id, item); return; }
      try { worker.postMessage({ id, type, ...parameters }); } catch { fallbackWorker(); }
    });
  }
  function title() {
    if (current.type === 'daily') return `每日一局 · ${current.seed} · ${current.depth} 步`;
    if (current.type === 'random') return challenge && Number.isInteger(challenge.optimal) ? `随机挑战 · ${challenge.optimal} 步` : '随机挑战 · 求解中';
    return `第 ${current.index + 1} 关 · ${names[current.index]}`;
  }
  function clearMotion() {
    queue = []; animations.forEach(a => a.cancel()); animations = []; animating = false; gesture = null;
    tiles.forEach(tile => { tile.style.zIndex = ''; });
  }
  async function load(config) {
    const token = ++epoch; stopTask(); clearMotion(); current = { ...config }; loading = true; state = null; challenge = null; searchProgress = null; history = []; route = [];
    if (config.type === 'random') { challenge = { board: config.board, optimal: null }; state = { board: config.board, used: 0, status: 'playing' }; searchProgress = { phase: 'patterns', lower: E.lowerBound(config.board), completed: 0, total: 8, nodes: 0 }; }
    $('loading').hidden = config.type === 'random'; $('loading').textContent = '正在验证最短步数…';
    $('level-title').textContent = title(); render();
    let depth, seed;
    if (config.type === 'level') ({ depth, seed } = E.LEVELS[config.index]);
    else { depth = config.depth; seed = config.seed; }
    try {
      let result;
      if (config.type === 'random') {
        const answer = await request('optimal', { board: config.board }, progress => { if (token === epoch) { searchProgress = progress; render(); } });
        if (answer.solution.length !== answer.optimal || answer.solution.reduce(E.move, config.board) !== E.GOAL) throw new Error('Invalid optimal solution');
        result = { board: config.board, optimal: answer.optimal, solution: answer.solution, proof: { method: answer.proof, nodes: answer.nodes } };
      } else result = await request('generate', { depth, seed });
      if (token !== epoch) return;
      if (config.type !== 'random' && result.optimal > 6) E.registerCertificate(result);
      challenge = result; state = { board: result.board, used: 0, status: result.board === E.GOAL ? 'won' : 'playing' }; selection = 0;
      loading = false; $('loading').hidden = true; $('level-title').textContent = title(); render();
    } catch (error) {
      if (token !== epoch) return;
      $('loading').hidden = config.type === 'random'; $('loading').textContent = '棋盘准备失败，请重开或换一关。';
      $('solver-progress').textContent = '计算中断。可重开重新计算，或取消后选择其他关卡。';
      $('message').innerHTML = '<h2>再试一次</h2><p>点击重开，或选择下方其他关卡。</p>';
      $('restart').disabled = false;
    }
  }
  const tiles = Array.from({ length: 16 }, (_, value) => {
    const button = document.createElement('button'); button.className = 'tile'; button.textContent = value + 1; button.dataset.value = value + 1;
    button.addEventListener('focus', () => { if (state && !animating) { selection = state.board.indexOf(String.fromCharCode(65 + value)); renderSelection(); } });
    button.addEventListener('click', () => { if (performance.now() < suppressClick || !state) return; selection = state.board.indexOf(String.fromCharCode(65 + value)); renderSelection(); });
    board.append(button); return button;
  });
  const outline = document.createElement('div'); outline.className = 'block-outline'; outline.setAttribute('aria-hidden', 'true'); board.append(outline);
  const points = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const button = document.createElement('button'); button.className = 'rotate-point'; button.dataset.block = `${r},${c}`;
    button.style.left = `calc(${25 * (c + 1)}% + ${2 * c - 2}px)`; button.style.top = `calc(${25 * (r + 1)}% + ${2 * r - 2}px)`;
    button.innerHTML = '<span aria-hidden="true">↻</span>';
    button.addEventListener('click', () => { selection = r * 4 + c; act(16 + (r * 3 + c) * 2 + (direction === 1 ? 0 : 1)); });
    button.addEventListener('contextmenu', event => { event.preventDefault(); selection = r * 4 + c; act(16 + (r * 3 + c) * 2 + (direction === 1 ? 1 : 0)); });
    board.append(button); points.push(button);
  }
  const arrowButtons = [];
  function arrow(container, id, symbol, label) {
    const button = document.createElement('button'); button.textContent = symbol; button.dataset.move = id; button.setAttribute('aria-label', label);
    button.addEventListener('click', () => act(id)); $(container).append(button); arrowButtons.push(button);
  }
  for (let i = 0; i < 4; i++) {
    arrow('left-arrows', i * 2, '←', `第 ${i + 1} 行向左移动`); arrow('right-arrows', i * 2 + 1, '→', `第 ${i + 1} 行向右移动`);
    arrow('top-arrows', 8 + i * 2, '↑', `第 ${i + 1} 列向上移动`); arrow('bottom-arrows', 9 + i * 2, '↓', `第 ${i + 1} 列向下移动`);
  }
  const levelButtons = E.LEVELS.map((level, index) => {
    const button = document.createElement('button'); button.className = 'level'; button.dataset.level = index;
    button.innerHTML = `<b>${String(index + 1).padStart(2, '0')}</b><span>${level.depth} 步</span>`;
    button.setAttribute('aria-label', `第 ${index + 1} 关，最少 ${level.depth} 步`);
    button.addEventListener('click', () => load({ type: 'level', index })); $('levels').append(button); return button;
  });
  function renderSelection() {
    const r = Math.floor(selection / 4), c = selection % 4, br = Math.min(r, 2), bc = Math.min(c, 2);
    $('position-label').textContent = `第 ${r + 1} 行 · 第 ${c + 1} 列`;
    if (state) tiles.forEach((tile, value) => tile.classList.toggle('selected', mode !== 'rotate' && state.board.indexOf(String.fromCharCode(65 + value)) === selection));
    outline.hidden = mode === 'slide' || loading;
    outline.style.left = `calc(${bc * 25}% + ${bc * 2 - 2}px)`; outline.style.top = `calc(${br * 25}% + ${br * 2 - 2}px)`;
    points.forEach((button, i) => {
      button.hidden = mode === 'slide'; button.classList.toggle('selected', i === br * 3 + bc);
      button.firstElementChild.textContent = direction === 1 ? '↻' : '↺';
      button.setAttribute('aria-label', `旋转第 ${Math.floor(i / 3) + 1} 行第 ${i % 3 + 1} 列起的 2×2 方格，${direction === 1 ? '顺' : '逆'}时针`);
    });
  }
  function setMode(value) {
    mode = value; $('frame').dataset.mode = value;
    for (const name of ['slide','rotate','mixed']) $(`${name}-mode`).setAttribute('aria-pressed', String(value === name));
    $('mode-help').textContent = value === 'slide' ? '在数字上滑动，或点击边缘箭头。移出的一格会从另一端回来。' : value === 'rotate' ? '点击四格交点处的旋转钮；右键反向。Q / E 旋转选中的四格。' : '滑动数字或点击箭头移动行列；点击四格交点旋转。两种操作可直接混用。';
    renderSelection();
  }
  function describe(id) {
    const m = E.MOVES[id];
    if (m.kind === 'row') return `行 ${m.row + 1} ${m.direction === 1 ? '→' : '←'}`;
    if (m.kind === 'column') return `列 ${m.col + 1} ${m.direction === 1 ? '↓' : '↑'}`;
    return `四格 ${m.row + 1},${m.col + 1} ${m.direction === 1 ? '↻' : '↺'}`;
  }
  function render() {
    $('frame').setAttribute('aria-busy', String(loading));
    const blocked = loading || !state || state.status !== 'playing';
    arrowButtons.forEach(button => { button.disabled = blocked; }); points.forEach(button => { button.disabled = blocked; });
    $('ccw').disabled = $('cw').disabled = blocked;
    $('undo').disabled = loading || !history.length; $('restart').disabled = loading;
    $('next').hidden = !state || state.status !== 'won' || current.type !== 'level' || current.index === highestIndex;
    if (current.type !== 'random') $('difficulty').value = String(state ? challenge.optimal : current.depth || E.LEVELS[current.index || 0].depth);
    const known = state && Number.isInteger(challenge.optimal);
    $('remaining').textContent = known ? challenge.optimal - state.used : '—'; $('correct').textContent = state ? E.correct(state.board) : '—';
    $('optimal').textContent = known ? challenge.optimal : '—'; $('used').textContent = state ? state.used : 0;
    $('solver-status').hidden = !(loading && current.type === 'random');
    if (searchProgress) $('solver-progress').textContent = searchProgress.phase === 'patterns' ? `正在准备最优求解 · ${searchProgress.completed} / 8 · 至少需要 ${searchProgress.lower} 步` : `正在检索 ${searchProgress.lower} 步最优解 · 已检查 ${searchProgress.nodes.toLocaleString()} 个节点`;
    $('track').replaceChildren();
    if (state) for (let i = 0; i < challenge.optimal; i++) { const tick = document.createElement('i'); tick.className = i < state.used ? state.status === 'lost' ? 'exhausted' : 'used' : ''; $('track').append(tick); }
    const b = state ? state.board : E.GOAL;
    tiles.forEach((tile, value) => {
      const pos = b.indexOf(String.fromCharCode(65 + value)), r = Math.floor(pos / 4), c = pos % 4;
      tile.style.left = `calc(${c * 25}% + ${c * 2}px)`; tile.style.top = `calc(${r * 25}% + ${r * 2}px)`;
      tile.classList.toggle('correct', pos === value); tile.disabled = blocked;
      tile.setAttribute('aria-label', `数字 ${value + 1}，第 ${r + 1} 行第 ${c + 1} 列${pos === value ? '，已归位' : ''}`);
    });
    renderSelection();
    if (loading && current.type === 'random') {
      $('message').className = 'message'; $('message').innerHTML = '<h2>正在计算最优解</h2><p>局面已随机生成。确定最少步数后即可开始，也可取消计算。</p>';
    } else if (state) {
      const status = state.status; $('message').className = `message ${status}`;
      const messages = status === 'won' ? ['恰好，最短解！', `你用 ${state.used} 步让所有数字归位。${current.type === 'level' && E.LEVELS.every(level => records[level.recordId]) ? `${E.LEVELS.length} 关全部完成！` : '再挑战一关吧。'}`] : status === 'lost' ? ['步数用完了', '还差一点。撤销一步重新推演，或重开再试。'] : ['每一步，都有转机', `在 ${challenge.optimal} 步内复原。滑动与旋转可以自由组合。`];
      $('message').replaceChildren(); const h = document.createElement('h2'), p = document.createElement('p'); h.textContent = messages[0]; p.textContent = messages[1]; $('message').append(h, p);
    } else { $('message').className = 'message'; $('message').innerHTML = '<h2>每一步，都有转机</h2><p>正在准备棋盘与最短步数。</p>'; }
    $('sequence').textContent = route.length ? route.map((id, i) => `${i + 1}. ${describe(id)}`).join('  ·  ') : '—';
    levelButtons.forEach((button, i) => { button.setAttribute('aria-pressed', String(current.type === 'level' && current.index === i)); button.classList.toggle('done', records[E.LEVELS[i].recordId] === true); });
    $('progress').textContent = `已通关 ${E.LEVELS.filter(level => records[level.recordId]).length} / ${E.LEVELS.length}`;
  }
  async function act(id) {
    if (loading || !state || state.status !== 'playing') return;
    if (animating) { if (queue.length < 8) queue.push(id); return; }
    const token = epoch, before = state.board, m = E.MOVES[id];
    history.push({ ...state }); route.push(id); state = E.play(state, id, challenge.optimal);
    if (state.status === 'won' && current.type === 'level') { records[E.LEVELS[current.index].recordId] = true; save(); }
    const duration = Number($('motion').value); animating = duration > 0; render();
    if (duration > 0) {
      const size = board.getBoundingClientRect().width, pitch = (size + 8) / 4;
      for (const from of m.cells) {
        const value = before.charCodeAt(from) - 65, to = state.board.indexOf(before[from]);
        const fx = from % 4 * pitch, fy = Math.floor(from / 4) * pitch, tx = to % 4 * pitch, ty = Math.floor(to / 4) * pitch;
        let frames;
        if (m.kind === 'rotate') {
          const cx = (m.col + .5) * pitch, cy = (m.row + .5) * pitch;
          frames = [0, .25, .5, .75, 1].map(t => { const angle = t * m.direction * Math.PI / 2, x = cx + (fx - cx) * Math.cos(angle) - (fy - cy) * Math.sin(angle), y = cy + (fx - cx) * Math.sin(angle) + (fy - cy) * Math.cos(angle); return { transform: `translate(${x - tx}px,${y - ty}px)` }; });
        } else if (Math.abs(to - from) === (m.kind === 'row' ? 3 : 12)) {
          // A wrapped tile exits at one edge and enters at the opposite edge.
          const dx = m.kind === 'row' ? m.direction * pitch : 0, dy = m.kind === 'column' ? m.direction * pitch : 0;
          frames = [{ transform: `translate(${fx - tx}px,${fy - ty}px)`, opacity: 1 }, { transform: `translate(${fx - tx + dx * .5}px,${fy - ty + dy * .5}px)`, opacity: 0, offset: .49 }, { transform: `translate(${-dx * .5}px,${-dy * .5}px)`, opacity: 0, offset: .5 }, { transform: 'translate(0,0)', opacity: 1 }];
        } else frames = [{ transform: `translate(${fx - tx}px,${fy - ty}px)` }, { transform: 'translate(0,0)' }];
        tiles[value].style.zIndex = '2'; animations.push(tiles[value].animate(frames, { duration, easing: 'ease-in-out' }));
      }
      await Promise.all(animations.map(a => a.finished.catch(() => {})));
    }
    if (token !== epoch) return;
    animations = []; tiles.forEach(t => { t.style.zIndex = ''; }); animating = false;
    if (state.status !== 'playing') queue = [];
    if (queue.length) act(queue.shift());
  }
  function undo() {
    if (loading || !history.length) return;
    ++epoch; clearMotion(); state = history.pop(); route.pop(); render();
  }
  function restart() {
    if (loading || !challenge) { load(current); return; }
    ++epoch; clearMotion(); state = { board: challenge.board, used: 0, status: 'playing' }; history = []; route = []; render();
  }
  function setDirection(value, persist = true) {
    direction = value;
    $('cw').setAttribute('aria-pressed', String(value === 1)); $('ccw').setAttribute('aria-pressed', String(value === -1));
    $('default-cw').setAttribute('aria-pressed', String(value === 1)); $('default-ccw').setAttribute('aria-pressed', String(value === -1));
    if (persist) { try { localStorage.setItem('sixteen.rotation.v1', value === 1 ? 'cw' : 'ccw'); } catch {} }
    if (state) renderSelection();
  }
  function rotate(value) {
    setDirection(value); if (mode === 'slide') setMode('rotate'); else renderSelection();
    const r = Math.min(Math.floor(selection / 4), 2), c = Math.min(selection % 4, 2); act(16 + (r * 3 + c) * 2 + (value === 1 ? 0 : 1));
  }
  $('slide-mode').onclick = () => setMode('slide'); $('rotate-mode').onclick = () => setMode('rotate');
  $('mixed-mode').onclick = () => setMode('mixed');
  $('cw').onclick = () => rotate(1); $('ccw').onclick = () => rotate(-1);
  $('default-cw').onclick = () => setDirection(1); $('default-ccw').onclick = () => setDirection(-1);
  setDirection(direction, false);
  for (let depth = 6; depth <= E.MAX_CERTIFIED; depth++) { const option = document.createElement('option'); option.value = depth; option.textContent = `${depth} 步${depth === E.MAX_CERTIFIED ? ' · 最高' : ''}`; $('difficulty').append(option); }
  $('highest').textContent = `最高难度 · ${E.MAX_CERTIFIED} 步`;
  $('highest').onclick = () => load({ type: 'level', index: highestIndex });
  $('undo').onclick = undo; $('restart').onclick = restart; $('next').onclick = () => load({ type: 'level', index: Math.min(current.index + 1, highestIndex) });
  $('difficulty').onchange = () => load({ type: 'level', index: Number($('difficulty').value) - 6 });
  $('daily').onclick = () => load({ type: 'daily', depth: Number($('difficulty').value), seed: E.dailySeed() });
  $('random').onclick = () => load({ type: 'random', board: E.randomBoard() });
  $('cancel-solve').onclick = () => load({ type: 'level', index: Number($('difficulty').value) - 6 });
  const systemMotion = matchMedia('(prefers-reduced-motion: reduce)'); if (systemMotion.matches) $('motion').value = '0';
  let explicitMotion = false;
  $('motion').addEventListener('change', () => { explicitMotion = true; });
  systemMotion.addEventListener('change', event => { if (!explicitMotion) $('motion').value = event.matches ? '0' : '220'; });
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || /^(SELECT|INPUT|TEXTAREA)$/.test(event.target.tagName) || event.target.isContentEditable) return;
    const key = event.key.toLowerCase();
    if (key === 'z') { event.preventDefault(); undo(); return; }
    if (key === 'r') { event.preventDefault(); restart(); return; }
    if (['1','2','3'].includes(key)) { event.preventDefault(); setMode(key === '1' ? 'slide' : key === '2' ? 'rotate' : 'mixed'); return; }
    const isBoard = board.contains(event.target) || event.target === document.body;
    if (!isBoard) return;
    if (key === 'q' || key === 'e') { event.preventDefault(); rotate(key === 'e' ? 1 : -1); return; }
    if (!['arrowleft','arrowright','arrowup','arrowdown'].includes(key)) return;
    event.preventDefault();
    const r = Math.floor(selection / 4), c = selection % 4;
    if (mode === 'rotate') {
      selection = Math.max(0, Math.min(2, Math.min(r, 2) + (key === 'arrowdown' ? 1 : key === 'arrowup' ? -1 : 0))) * 4 + Math.max(0, Math.min(2, Math.min(c, 2) + (key === 'arrowright' ? 1 : key === 'arrowleft' ? -1 : 0))); renderSelection();
    } else act(key === 'arrowleft' ? r * 2 : key === 'arrowright' ? r * 2 + 1 : key === 'arrowup' ? 8 + c * 2 : 9 + c * 2);
  });
  board.addEventListener('pointerdown', event => {
    pointers.add(event.pointerId);
    if (pointers.size > 1) { gesture = null; return; }
    if (mode === 'rotate' || event.button !== 0 || loading || !state || state.status !== 'playing') return;
    const tile = event.target.closest('.tile'); if (!tile) return;
    const pos = state.board.indexOf(String.fromCharCode(64 + Number(tile.dataset.value)));
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, pos };
  });
  window.addEventListener('pointerup', event => {
    pointers.delete(event.pointerId); const start = gesture; if (!start || start.id !== event.pointerId) return; gesture = null;
    const dx = event.clientX - start.x, dy = event.clientY - start.y, ax = Math.abs(dx), ay = Math.abs(dy);
    if (Math.max(ax, ay) < 22 || Math.max(ax, ay) < Math.min(ax, ay) * 1.5) return;
    suppressClick = performance.now() + 350; selection = start.pos;
    const r = Math.floor(start.pos / 4), c = start.pos % 4;
    act(ax > ay ? r * 2 + (dx > 0 ? 1 : 0) : 8 + c * 2 + (dy > 0 ? 1 : 0));
  });
  window.addEventListener('pointercancel', event => { pointers.delete(event.pointerId); gesture = null; });
  window.addEventListener('blur', () => { pointers.clear(); gesture = null; });
  $('theme').onclick = () => {
    const value = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = value;
    try { localStorage.setItem('yaozi.home.theme', value); } catch {}
    $('theme').setAttribute('aria-label', value === 'dark' ? '切换至浅色模式' : '切换至深色模式');
    document.querySelector('meta[name="theme-color"]').content = value === 'dark' ? '#0d1826' : '#edf3f9';
  };
  const initialDark = document.documentElement.dataset.theme === 'dark';
  $('theme').setAttribute('aria-label', initialDark ? '切换至浅色模式' : '切换至深色模式');
  document.querySelector('meta[name="theme-color"]').content = initialDark ? '#0d1826' : '#edf3f9';
  window.SixteenGame = Object.freeze({ snapshot: () => ({ state: state && { ...state }, optimal: challenge && challenge.optimal, mode, selection, loading, animating, queued: queue.length, current: { ...current }, route: route.slice() }), ready: () => !loading && !!state && !animating && !queue.length });
  const legacyLevel = Number(new URLSearchParams(location.search).get('level'));
  const requestedLevel = legacyLevel === 26 ? E.LEVELS.length : legacyLevel;
  load(Number.isInteger(requestedLevel) && requestedLevel > 0 && requestedLevel <= E.LEVELS.length ? { type: 'level', index: requestedLevel - 1 } : current);
})();
