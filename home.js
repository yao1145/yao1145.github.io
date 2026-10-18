(() => {
  'use strict';
  const root = document.documentElement;
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  const themeButton = document.getElementById('theme-toggle');
  const strings = {
    zh: {
      title: 'yao1145 的小游戏',
      description: 'yao1145 的小游戏：PKUfighter、十步万度、Cube、Sixteen、王冠巡游、Tronix、顶点着色与 Swap 全清。简单规则，意想不到的世界。',
      heading: '简单规则，意想不到的世界。',
      intro: '从弹幕到棋盘，从路线到点线。欢迎来到我的小游戏主页。',
      language: '语言', games: '选择游戏',
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
      footer: '在浏览器里，随时开一局。',
      light: '浅色', dark: '深色',
      toLight: '切换至浅色模式', toDark: '切换至深色模式'
    },
    en: {
      title: "yao1145's mini games",
      description: 'Play PKUfighter, Clock Relay, Cube, Sixteen, Crown Tour, Tronix, Vertex Coloring and Swap. Simple rules. Unexpected worlds.',
      heading: 'Simple rules. Unexpected worlds.',
      intro: 'From bullet storms to boards, paths to networks. Welcome to my little arcade.',
      language: 'Language', games: 'Choose a game',
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
      footer: 'A quick game, right in your browser.',
      light: 'Light', dark: 'Dark',
      toLight: 'Switch to light mode', toDark: 'Switch to dark mode'
    }
  };

  function save(key, value) {
    try { localStorage.setItem(key, value); } catch { /* Preferences still work for this visit. */ }
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
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#0d1826' : '#f3f7fc';
    updateThemeButton();
  }

  function applyLanguage(language) {
    root.dataset.language = language;
    root.lang = language === 'zh' ? 'zh-CN' : 'en';
    const text = strings[language];
    document.title = text.title;
    document.querySelector('meta[name="description"]').content = text.description;
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
  }

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
  applyLanguage(root.dataset.language);
})();
