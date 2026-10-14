(() => {
  'use strict';
  const root = document.documentElement;
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  const themeButton = document.getElementById('theme-toggle');
  const strings = {
    zh: {
      title: 'yao1145 的小游戏',
      description: 'yao1145 的小游戏：PKUfighter、十步万度与 Cube。选一款，开始玩。',
      heading: '选一款，开始玩。',
      intro: '躲弹幕、拨指针、滚方块。欢迎来到我的小游戏主页。',
      language: '语言', games: '选择游戏',
      fighterDescription: '驾驶北大校徽，穿过弹幕、迎战高校 Boss。选择效果卡，搭配你的战斗路线。',
      fighterPlay: '开始战斗',
      clocksTitle: '十步万度',
      clocksDescription: '拨动 25 枚指针，让旋转接力。挑战 1–12 步的最优角度，收集十二颗满分星星。',
      clocksPlay: '拨动指针',
      cubeDescription: '在 4×4 棋盘滚动立方体，让六面全蓝。每关只有最少步数，用完还未完成即失败。',
      cubePlay: '挑战最短路线',
      footer: '在浏览器里，随时开一局。',
      light: '浅色', dark: '深色',
      toLight: '切换至浅色模式', toDark: '切换至深色模式'
    },
    en: {
      title: "yao1145's mini games",
      description: 'Play PKUfighter, Clock Relay and Cube. Pick a game and start playing.',
      heading: 'Pick a game. Start playing.',
      intro: 'Dodge bullets, turn clock hands, roll a cube. Welcome to my little arcade.',
      language: 'Language', games: 'Choose a game',
      fighterDescription: 'Pilot the Peking University emblem through bullet storms and face university bosses. Pick effect cards to shape your run.',
      fighterPlay: 'Start battle',
      clocksTitle: 'Clock Relay',
      clocksDescription: 'Set 25 clock hands in motion. Find the best angles in 1–12 moves and collect all twelve stars.',
      clocksPlay: 'Turn the hands',
      cubeDescription: 'Roll across a 4×4 board and turn all six faces blue. Solve each level within its shortest move limit.',
      cubePlay: 'Find the shortest path',
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
