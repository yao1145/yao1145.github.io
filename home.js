(() => {
  'use strict';
  const root = document.documentElement;
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  const themeButton = document.getElementById('theme-toggle');
  const metaDescription = document.querySelector('meta[name="description"]');
  const strings = {
    zh: {
      title: 'Yaozi — 小游戏',
      description: 'Yaozi（@yao1145）的个人主页：小游戏、实用工具、开源代码与随想。简单规则，意想不到的世界。',
      heading: '简单规则，意想不到的世界。',
      intro: '从弹幕到棋盘，从路线到点线。欢迎来到我的小游戏主页。',
      language: '语言', games: '选择游戏', sections: '分区导航',
      navGames: '游戏', navPersonal: '个人', navBlog: '博客', navTools: '工具',
      fighterDescription: '驾驶北大校徽，穿过弹幕、迎战高校 Boss。选择效果卡，搭配你的战斗路线。',
      fighterPlay: '开始战斗',
      clocksTitle: '十步万度',
      clocksDescription: '拨动 25 枚指针，让旋转接力。挑战 1–12 步的最优角度，收集十二颗满分星星。',
      clocksPlay: '拨动指针',
      cubeDescription: '在 4×4 棋盘滚动立方体，让六面全蓝。每关只有最少步数，通关点亮十二颗星。',
      cubePlay: '挑战最短路线',
      sixteenDescription: '循环滑动整行整列，旋转 2×2 四格。在最少步数内，让 1—16 各归其位。',
      sixteenPlay: '挑战数字复原',
      knightTitle: '王冠巡游',
      knightDescription: '王冠只走骑士步。踏遍 5×5 到 8×8 的每一格，收集十二颗巡游星星。',
      knightPlay: '开始巡游',
      tronixTitle: 'Tronix · 解结',
      tronixDescription: '拖动节点，解开交叉的连线。从第一张线网，到层层嵌套的复杂图形。',
      tronixPlay: '解开线网',
      coloringTitle: '顶点着色',
      coloringDescription: '相连的点，填上不同颜色。用恰好够用的色数，破解整张图的约束。',
      coloringPlay: '挑战最少颜色',
      swapTitle: 'Swap 全清',
      swapDescription: '交换相邻方块，同色相邻即消除。保留空洞，掌握下落时机，把最后一块也清空。',
      swapPlay: '挑战全部清空',
      flipTitle: 'Flip',
      flipDescription: '翻转局部，点亮全盘。看清每格的作用范围，用最少点击完成十二关。',
      flipPlay: '点亮全盘',
      pegsTitle: 'Pegs · 孔明棋',
      pegsDescription: '跳过邻子，落入空洞。从三角到十字，探索不同棋盘，最终只留一子。',
      pegsPlay: '挑战只留一子',
      robotsTitle: 'Robots · 四机归位',
      robotsDescription: '机器人遇墙才停。借助彼此作挡板，让四台机器人同时抵达各自目标。',
      robotsPlay: '规划四机路线',
      hexDescription: '连接棋盘两岸，与三档 AI 对弈。从玩家先手、首着交换，到 AI 先手，挑战 7×7 至 13×13 棋盘。',
      hexPlay: '连接两岸',
      footer: '游戏、工具、代码与随想。',
      toolsTitle: 'Yaozi — 工具',
      toolsDescription: '平水韵查询与灵性测试，Yaozi 的在线工具。',
      toolsHeading: '工具',
      toolsIntro: '查一查韵部，探索一些有趣的问题。',
      pingshuiTitle: '平水韵',
      pingshuiDescription: '输入汉字查韵部，或按韵部浏览韵字。',
      pingshuiOpen: '查询平水韵',
      spiritualityTitle: '灵性测试',
      spiritualityDescription: '隐藏信息感知、未来事件预知、双人实验与体验量表。',
      spiritualityOpen: '前往灵性测试',
      personalTitle: 'Yaozi — 个人',
      personalDescription: 'Yaozi（@yao1145）的个人主页：小游戏、开源代码与工具。',
      personalHeading: '个人',
      personalIntro: '这里放我的代码、工具和小游戏。',
      githubProfile: '在 GitHub 查看',
      reposHeading: '公开仓库',
      reposAll: '全部仓库',
      reposEmpty: '暂时没有可列的仓库。',
      repoFork: 'Fork',
      blogTitle: 'Yaozi — 随想',
      blogDescription: 'Yaozi（@yao1145）的随想与文章。',
      blogHeading: '随想',
      blogIntro: '偶尔写下一些想法和文章。',
      blogEmpty: '还没有文章。下次见。',
      postMissing: '找不到这篇文章。',
      backToBlog: '返回随想',
      light: '浅色', dark: '深色',
      toLight: '切换至浅色模式', toDark: '切换至深色模式'
    },
    en: {
      title: 'Yaozi — Games',
      description: 'Yaozi (@yao1145): small games, useful tools, open-source code and notes. Simple rules. Unexpected worlds.',
      heading: 'Simple rules. Unexpected worlds.',
      intro: 'From bullet storms to boards, paths to networks. Welcome to my little arcade.',
      language: 'Language', games: 'Choose a game', sections: 'Sections',
      navGames: 'Games', navPersonal: 'Personal', navBlog: 'Blog', navTools: 'Tools',
      fighterDescription: 'Pilot the Peking University emblem through bullet storms and face university bosses. Pick effect cards to shape your run.',
      fighterPlay: 'Start battle',
      clocksTitle: 'Clock Relay',
      clocksDescription: 'Set 25 clock hands in motion. Find the best angles in 1–12 moves and collect all twelve stars.',
      clocksPlay: 'Turn the hands',
      cubeDescription: 'Roll across a 4×4 board and turn all six faces blue. Solve each level within its shortest move limit and light all twelve stars.',
      cubePlay: 'Find the shortest path',
      sixteenDescription: 'Slide rows and columns, rotate 2×2 blocks, and restore 1–16 in the fewest possible moves.',
      sixteenPlay: 'Restore the numbers',
      knightTitle: 'Crown Tour',
      knightDescription: 'Move the crown like a knight. Visit every square from 5×5 to 8×8 exactly once and collect twelve stars.',
      knightPlay: 'Begin the tour',
      tronixTitle: 'Tronix · Untangle',
      tronixDescription: 'Drag the nodes to uncross every line. Work your way from a first tangle to intricate nested networks.',
      tronixPlay: 'Untangle the network',
      coloringTitle: 'Vertex Coloring',
      coloringDescription: 'Connected nodes need different colors. Solve each network using its minimum number of colors.',
      coloringPlay: 'Find the right colors',
      swapTitle: 'Swap · Clear All',
      swapDescription: 'Swap neighboring tiles and clear matching neighbors. Keep the gaps, choose when to drop, and leave no tile behind.',
      swapPlay: 'Clear every tile',
      flipTitle: 'Flip',
      flipDescription: 'Flip local patterns to light every tile. Read each switch and solve twelve levels in the fewest clicks.',
      flipPlay: 'Light every tile',
      pegsTitle: 'Pegs · Solitaire',
      pegsDescription: 'Jump a neighbor into an empty hole. Explore triangles, crosses and more, leaving just one peg.',
      pegsPlay: 'Leave one peg',
      robotsTitle: 'Robots · Chain',
      robotsDescription: 'Slide until a wall or robot stops you. Use one another as stoppers and park all four on their targets together.',
      robotsPlay: 'Plan four routes',
      hexDescription: 'Connect opposite sides against three AI levels: move first, play with a swap rule, or face an AI opening. Boards range from 7×7 to 13×13.',
      hexPlay: 'Connect the sides',
      footer: 'Games, tools, code and notes.',
      toolsTitle: 'Yaozi — Tools',
      toolsDescription: 'Pingshui rhyme lookup and the Spirituality Test. Online tools by Yaozi.',
      toolsHeading: 'Tools',
      toolsIntro: 'Look up a rhyme or explore a curious question.',
      pingshuiTitle: 'Pingshui Rhymes',
      pingshuiDescription: 'Find rhyme groups by Chinese character, or browse characters in a rhyme group.',
      pingshuiOpen: 'Look up a rhyme',
      spiritualityTitle: 'Spirituality Test',
      spiritualityDescription: 'Hidden-information perception, future-event guesses, paired experiments and an experience questionnaire.',
      spiritualityOpen: 'Open Spirituality Test',
      personalTitle: 'Yaozi — Personal',
      personalDescription: 'Yaozi (@yao1145): games, open-source code and tools.',
      personalHeading: 'Personal',
      personalIntro: 'A home for my code, tools and small games.',
      githubProfile: 'View on GitHub',
      reposHeading: 'Public repositories',
      reposAll: 'All repositories',
      reposEmpty: 'No repositories to list yet.',
      repoFork: 'Fork',
      blogTitle: 'Yaozi — Notes',
      blogDescription: 'Notes and writing by Yaozi (@yao1145).',
      blogHeading: 'Notes',
      blogIntro: 'Occasional thoughts and writing.',
      blogEmpty: 'No posts yet. See you next time.',
      postMissing: 'That post could not be found.',
      backToBlog: 'Back to notes',
      light: 'Light', dark: 'Dark',
      toLight: 'Switch to light mode', toDark: 'Switch to dark mode'
    }
  };

  const content = window.YAOZI_CONTENT && typeof window.YAOZI_CONTENT === 'object' ? window.YAOZI_CONTENT : {};
  const repositories = Array.isArray(content.repositories) ? content.repositories : [];
  const markdownPosts = Array.isArray(window.YAOZI_BLOG_POSTS) ? window.YAOZI_BLOG_POSTS : [];
  const posts = [...markdownPosts, ...(Array.isArray(content.posts) ? content.posts : [])];
  const panels = Array.from(document.querySelectorAll('.panel'));
  const navLinks = Array.from(document.querySelectorAll('[data-section-link]'));
  const navSlider = document.querySelector('.nav-slider');
  const blogListView = document.getElementById('blog-list-view');
  const postListView = document.getElementById('post-list');
  const blogEmpty = document.getElementById('blog-empty');
  const postNotice = document.getElementById('post-notice');
  const postView = document.getElementById('post-view');
  const postTitle = document.getElementById('post-title');
  const postDate = document.getElementById('post-date');
  const postBody = document.getElementById('post-body');
  const postBack = document.getElementById('post-back');
  const repoList = document.getElementById('repo-list');
  const repoEmpty = document.getElementById('repo-empty');
  let activeSlug = '';
  let lastSection = null;
  let lastSlug = null;

  function save(key, value) {
    try { localStorage.setItem(key, value); } catch { /* Preferences still work for this visit. */ }
  }

  function pickLocalized(value, language = root.dataset.language) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return String(value[language] || value.en || value.zh || '');
  }

  function safeUrl(value, fallback) {
    if (typeof value !== 'string' || !value.trim()) return fallback;
    try {
      const url = new URL(value, location.href);
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
    } catch { /* Use the fallback below. */ }
    return fallback;
  }

  function postBySlug(slug) {
    return posts.find(post => post && String(post.slug) === slug) || null;
  }

  function formatDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    if (!match) return String(value || '');
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    try {
      return new Intl.DateTimeFormat(root.dataset.language === 'zh' ? 'zh-CN' : 'en-US', {
        year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
      }).format(date);
    } catch {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }

  function renderRepositories() {
    if (!repoList) return;
    const language = root.dataset.language;
    const text = strings[language];
    const valid = repositories.filter(repo => repo && typeof repo.name === 'string' && repo.name);
    repoList.replaceChildren();
    for (const repo of valid) {
      const item = document.createElement('a');
      item.className = 'repo';
      item.href = safeUrl(repo.url, `https://github.com/yao1145/${encodeURIComponent(repo.name)}`);
      item.target = '_blank';
      item.rel = 'noopener noreferrer';
      const top = document.createElement('div');
      top.className = 'repo-top';
      const name = document.createElement('span');
      name.className = 'repo-name';
      name.textContent = repo.name;
      top.append(name);
      if (repo.language) {
        const languageTag = document.createElement('span');
        languageTag.className = 'repo-tag';
        const dot = document.createElement('span');
        dot.className = 'repo-dot';
        dot.setAttribute('aria-hidden', 'true');
        languageTag.append(dot, document.createTextNode(String(repo.language)));
        top.append(languageTag);
      }
      if (repo.fork) {
        const forkTag = document.createElement('span');
        forkTag.className = 'repo-tag fork';
        forkTag.textContent = text.repoFork;
        top.append(forkTag);
      }
      item.append(top);
      const description = pickLocalized(repo.description, language);
      if (description) {
        const paragraph = document.createElement('p');
        paragraph.className = 'repo-description';
        paragraph.textContent = description;
        item.append(paragraph);
      }
      repoList.append(item);
    }
    repoList.hidden = valid.length === 0;
    if (repoEmpty) repoEmpty.hidden = valid.length > 0;
  }

  function renderBlog(slug) {
    if (!postListView || !blogListView) return;
    const language = root.dataset.language;
    const text = strings[language];
    const valid = posts.filter(post => post && typeof post.slug === 'string' && post.slug);
    const active = slug ? postBySlug(slug) : null;

    postListView.replaceChildren();
    for (const post of valid) {
      const item = document.createElement('a');
      item.className = 'post-item';
      item.href = `#blog/${encodeURIComponent(String(post.slug))}`;
      item.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        navigate(`#blog/${encodeURIComponent(String(post.slug))}`);
      });
      const date = document.createElement('p');
      date.className = 'post-item-date';
      date.textContent = formatDate(post.date);
      const title = document.createElement('h3');
      title.className = 'post-item-title';
      title.textContent = pickLocalized(post.title, language) || text.blogHeading;
      const summary = document.createElement('p');
      summary.className = 'post-summary';
      summary.textContent = pickLocalized(post.summary, language);
      item.append(date, title);
      if (summary.textContent) item.append(summary);
      postListView.append(item);
    }

    const missing = Boolean(slug) && !active && valid.length > 0;
    if (postNotice) {
      postNotice.hidden = !missing;
      postNotice.textContent = missing ? text.postMissing : '';
    }
    if (blogEmpty) blogEmpty.hidden = valid.length > 0;
    blogListView.hidden = Boolean(active);
    if (!postView) return;
    postView.hidden = !active;
    if (!active) return;

    postTitle.textContent = pickLocalized(active.title, language) || text.blogHeading;
    postDate.textContent = formatDate(active.date);
    postBody.replaceChildren();
    const html = pickLocalized(active.html, language);
    if (html) {
      // Generated from Markdown by build-blog.cjs with raw HTML disabled.
      postBody.innerHTML = html;
      return;
    }
    const rawBody = active.body;
    const paragraphs = rawBody && Array.isArray(rawBody[language])
      ? rawBody[language]
      : (rawBody && Array.isArray(rawBody.en) ? rawBody.en : (rawBody && Array.isArray(rawBody.zh) ? rawBody.zh : []));
    for (const paragraph of paragraphs) {
      if (typeof paragraph !== 'string') continue;
      const element = document.createElement('p');
      element.textContent = paragraph;
      postBody.append(element);
    }
  }

  function updateDocumentMeta() {
    const text = strings[root.dataset.language];
    const section = root.dataset.homeSection;
    const post = activeSlug ? postBySlug(activeSlug) : null;
    if (post) {
      const title = pickLocalized(post.title) || text.blogHeading;
      document.title = `${title} — Yaozi`;
      metaDescription.content = pickLocalized(post.summary) || text.blogDescription;
    } else if (section === 'personal') {
      document.title = text.personalTitle;
      metaDescription.content = text.personalDescription;
    } else if (section === 'tools') {
      document.title = text.toolsTitle;
      metaDescription.content = text.toolsDescription;
    } else if (section === 'blog') {
      document.title = text.blogTitle;
      metaDescription.content = text.blogDescription;
    } else {
      document.title = text.title;
      metaDescription.content = text.description;
    }
  }

  function parseRoute() {
    const raw = location.hash.replace(/^#/, '');
    const slash = raw.indexOf('/');
    const sectionPart = slash === -1 ? raw : raw.slice(0, slash);
    const slugPart = slash === -1 ? '' : raw.slice(slash + 1);
    let slug = '';
    if (slugPart) {
      try { slug = decodeURIComponent(slugPart); } catch { slug = ''; }
    }
    const section = ['games', 'blog', 'tools', 'personal'].includes(sectionPart) ? sectionPart : 'games';
    return { section, slug: section === 'blog' ? slug : '' };
  }

  function navigate(href) {
    const target = href.startsWith('#') ? href : `#${href}`;
    if (location.hash !== target) {
      try { history.pushState(null, '', target); }
      catch { location.hash = target; }
    }
    applyRoute();
  }

  function updateNav(section) {
    let index = 0;
    navLinks.forEach((link, position) => {
      const current = link.dataset.sectionLink === section;
      if (current) index = position;
      if (current) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (navSlider) navSlider.style.transform = `translateX(${index * 100}%)`;
  }

  function applyRoute({ initial = false } = {}) {
    const { section, slug } = parseRoute();
    const sectionChanged = section !== lastSection;
    const slugChanged = slug !== lastSlug;
    for (const panel of panels) panel.hidden = panel.dataset.section !== section;
    root.dataset.homeSection = section;
    updateNav(section);
    activeSlug = section === 'blog' ? slug : '';
    renderBlog(activeSlug);
    updateDocumentMeta();
    if (!initial && (sectionChanged || slugChanged)) window.scrollTo(0, 0);
    lastSection = section;
    lastSlug = slug;
    const focused = document.activeElement;
    if (focused && focused !== document.body && focused.closest && focused.closest('[hidden]')) {
      if (section === 'blog' && slug && postTitle) {
        postTitle.focus({ preventScroll: true });
      } else if (section === 'blog' && postListView && !postListView.hidden) {
        const firstPost = postListView.querySelector('.post-item');
        if (firstPost) firstPost.focus({ preventScroll: true });
        else {
          const current = navLinks.find(link => link.dataset.sectionLink === section);
          if (current) current.focus({ preventScroll: true });
        }
      } else {
        const current = navLinks.find(link => link.dataset.sectionLink === section);
        if (current) current.focus({ preventScroll: true });
      }
    }
  }

  function updateThemeButton() {
    const text = strings[root.dataset.language];
    const dark = root.dataset.theme === 'dark';
    document.getElementById('theme-label').textContent = dark ? text.light : text.dark;
    themeButton.setAttribute('aria-label', dark ? text.toLight : text.toDark);
    themeButton.title = dark ? text.toLight : text.toDark;
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#111113' : '#f5f5f7';
    updateThemeButton();
  }

  function applyLanguage(language) {
    root.dataset.language = language;
    root.lang = language === 'zh' ? 'zh-CN' : 'en';
    const text = strings[language];
    for (const element of document.querySelectorAll('[data-i18n]')) {
      element.textContent = text[element.dataset.i18n];
    }
    for (const element of document.querySelectorAll('[data-i18n-aria]')) {
      element.setAttribute('aria-label', text[element.dataset.i18nAria]);
    }
    for (const code of ['zh', 'en']) {
      document.getElementById(`language-${code}`).setAttribute('aria-pressed', String(code === language));
    }
    updateThemeButton();
    renderRepositories();
    renderBlog(activeSlug);
    updateDocumentMeta();
  }

  for (const link of navLinks) {
    link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      navigate(`#${link.dataset.sectionLink}`);
    });
  }
  if (postBack) {
    postBack.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      navigate('#blog');
    });
  }
  window.addEventListener('hashchange', () => applyRoute());
  window.addEventListener('popstate', () => applyRoute());

  for (const language of ['zh', 'en']) {
    document.getElementById(`language-${language}`).addEventListener('click', () => {
      applyLanguage(language);
      save('yaozi.home.language', language);
    });
  }
  themeButton.addEventListener('click', () => {
    const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.themePreference = theme;
    applyTheme(theme);
    save('yaozi.home.theme', theme);
  });
  systemTheme.addEventListener('change', event => {
    if (root.dataset.themePreference === 'system') applyTheme(event.matches ? 'dark' : 'light');
  });

  applyRoute({ initial: true });
  applyLanguage(root.dataset.language);
})();
