(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PingShui = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var BOM_RE = /﻿/g;
  var CN_NUM = '零一二三四五六七八九';
  var YUN_ALIAS = { '二十一个': '二十一箇' };
  var MODES = ['auto', 'char', 'rhyme'];
  var HAN_RE;

  try {
    HAN_RE = new RegExp('\\p{Script=Han}', 'u');
  } catch (error) {
    HAN_RE = /[㐀-䶿一-鿿豈-﫿]/;
  }

  function cleanText(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(BOM_RE, '').trim();
  }

  function isHan(character) {
    return !!character && HAN_RE.test(character);
  }

  function numToCn(number) {
    if (typeof number !== 'number' || !isFinite(number) ||
        Math.floor(number) !== number || number < 0 || number > 99) {
      return null;
    }
    if (number < 10) return CN_NUM.charAt(number);
    if (number < 20) {
      return '十' + (number % 10 ? CN_NUM.charAt(number % 10) : '');
    }
    var tens = Math.floor(number / 10);
    var ones = number % 10;
    return CN_NUM.charAt(tens) + '十' + (ones ? CN_NUM.charAt(ones) : '');
  }

  function cnDigit(character) {
    var index = CN_NUM.indexOf(character);
    return index < 0 ? null : index;
  }

  function cnToNum(text) {
    var value = cleanText(text);
    if (!value) return null;
    if (value === '十') return 10;
    if (value.length === 1) return cnDigit(value);

    var parts = value.split('十');
    if (parts.length !== 2) return null;

    var tens = parts[0] === '' ? 1 : cnDigit(parts[0]);
    var ones = parts[1] === '' ? 0 : cnDigit(parts[1]);
    if (tens === null || ones === null) return null;
    return tens * 10 + ones;
  }

  function digitsToCn(text) {
    var value = cleanText(text);
    var match = /^(\d+)([\s\S]*)$/.exec(value);
    if (!match) return value;
    // The data only numbers groups up to 30. Longer digit strings are left
    // untouched so an oversized input simply misses instead of overflowing.
    if (match[1].length > 6) return value;
    var number = Number(match[1]);
    var cn = numToCn(number);
    return cn === null ? value : cn + match[2];
  }

  function normalizeRhymeName(value) {
    var name = cleanText(value);
    var match = /^(\d+)([\s\S]*)$/.exec(name);
    if (match) {
      var number = Number(match[1]);
      var cn = numToCn(number);
      if (cn !== null) name = cn + match[2];
    }
    return name;
  }

  function withAlias(name) {
    return YUN_ALIAS[name] || name;
  }

  function countRhymeCharacters(text) {
    var value = text === null || text === undefined
      ? ''
      : String(text).replace(BOM_RE, '');
    var withoutNotes = value.replace(/\[[^\]]*\]/g, '');
    var charCount = 0;
    Array.from(withoutNotes).forEach(function (character) {
      if (isHan(character)) charCount += 1;
    });
    return {
      charCount: charCount,
      rawLength: Array.from(value).length,
      hasNotes: /\[[^\]]*\]/.test(value)
    };
  }

  function leadingNumber(name) {
    var match = /^([一二三四五六七八九十]+)/.exec(name);
    return match ? cnToNum(match[1]) : null;
  }

  function createEngine(data) {
    data = data || {};
    var charSource = data.characters && typeof data.characters === 'object'
      ? data.characters
      : {};
    var rhymeSource = data.rhymes && typeof data.rhymes === 'object'
      ? data.rhymes
      : {};

    var charMap = new Map();
    Object.keys(charSource).forEach(function (character) {
      var sourceEntries = charSource[character];
      if (!Array.isArray(sourceEntries)) return;
      var entries = [];
      sourceEntries.forEach(function (item) {
        if (!Array.isArray(item) || item.length < 2) return;
        var rhyme = normalizeRhymeName(item[1]);
        if (!rhyme) return;
        entries.push({
          tone: cleanText(item[0]),
          rhyme: rhyme,
          note: item.length > 2 && item[2] !== null && item[2] !== undefined
            ? String(item[2]).replace(BOM_RE, '').trim()
            : ''
        });
      });
      if (entries.length) charMap.set(String(character), entries);
    });

    var rhymeEntries = [];
    var rhymeByKey = Object.create(null);

    Object.keys(rhymeSource).forEach(function (rawKey) {
      var key = cleanText(rawKey);
      var match = /^([一二三四五六七八九十]+)([\s\S]+?)([平上去入])$/.exec(key);
      if (!match) return;
      var number = cnToNum(match[1]);
      if (number === null) return;
      var prefix = numToCn(number);
      if (prefix === null) return;

      var name = withAlias(prefix + match[2]);
      var tone = match[3];
      var identity = name + '\u0000' + tone;
      var text = rhymeSource[rawKey] === null || rhymeSource[rawKey] === undefined
        ? ''
        : String(rhymeSource[rawKey]).replace(BOM_RE, '');
      var counts = countRhymeCharacters(text);
      var entry = {
        name: name,
        tone: tone,
        key: identity,
        text: text,
        charCount: counts.charCount,
        rawLength: counts.rawLength,
        hasNotes: counts.hasNotes
      };

      if (rhymeByKey[identity]) {
        var previous = rhymeByKey[identity];
        var previousIndex = rhymeEntries.indexOf(previous);
        if (previousIndex === -1) rhymeEntries.push(entry);
        else rhymeEntries[previousIndex] = entry;
      } else {
        rhymeEntries.push(entry);
      }
      rhymeByKey[identity] = entry;
    });

    function queryChar(character) {
      var entries = charMap.get(character);
      if (!entries) return [];
      return entries.map(function (entry) {
        return { tone: entry.tone, rhyme: entry.rhyme, note: entry.note };
      });
    }

    function findRhymes(raw) {
      var value = cleanText(raw);
      if (!value) return [];
      value = withAlias(value);

      if (value.indexOf('上平') === 0) value = value.slice(2);
      else if (value.indexOf('下平') === 0) value = value.slice(2);

      value = digitsToCn(value);

      // Number + name + tone, for example 一东平 or 十五合入.
      var exact = /^([一二三四五六七八九十]+)([\s\S]+?)([平上去入])$/.exec(value);
      if (exact) {
        var exactNumber = cnToNum(exact[1]);
        if (exactNumber !== null) {
          var exactPrefix = numToCn(exactNumber);
          if (exactPrefix !== null) {
            var exactName = withAlias(exactPrefix + exact[2]);
            var found = rhymeByKey[exactName + '\u0000' + exact[3]];
            if (found) return [found];
          }
        }
      }

      // A bare number lists every group with that number.
      var bare = /^([一二三四五六七八九十]+)$/.exec(value);
      if (bare) {
        var bareNumber = cnToNum(bare[1]);
        if (bareNumber !== null) {
          return rhymeEntries.filter(function (entry) {
            return leadingNumber(entry.name) === bareNumber;
          });
        }
      }

      // Number + name, for example 一东 or 十五合.
      var numbered = /^([一二三四五六七八九十]+)([\s\S]+)$/.exec(value);
      if (numbered) {
        var numberedNumber = cnToNum(numbered[1]);
        if (numberedNumber !== null) {
          var numberedPrefix = numToCn(numberedNumber);
          if (numberedPrefix !== null) {
            var numberedName = withAlias(numberedPrefix + numbered[2]);
            var matches = rhymeEntries.filter(function (entry) {
              return entry.name === numberedName;
            });
            if (matches.length) return matches;
          }
        }
      }

      // Partial group name, for example 东 or 合.
      return rhymeEntries.filter(function (entry) {
        return entry.name.indexOf(value) !== -1;
      });
    }

    function query(raw, mode) {
      var original = raw === null || raw === undefined ? '' : String(raw);
      var text = cleanText(original);
      var requestedMode = MODES.indexOf(mode) === -1 ? 'auto' : mode;
      var result = {
        raw: original,
        input: text,
        mode: requestedMode,
        forced: null,
        kind: 'empty',
        charMatches: [],
        rhymeMatches: []
      };
      if (!text) return result;

      var forcedMatch = /^(字|韵|部)(?:[ \t　]+)([\s\S]*)$/.exec(text);
      var effectiveMode = requestedMode;
      var input = text;
      if (forcedMatch) {
        result.forced = forcedMatch[1] === '字' ? 'char' : 'rhyme';
        effectiveMode = result.forced;
        input = cleanText(forcedMatch[2]);
      }
      result.input = input;
      result.mode = effectiveMode;
      if (!input) return result;

      var charEntries = [];
      var rhymeMatches = [];
      var characters = Array.from(input);

      if (effectiveMode === 'char') {
        charEntries = queryChar(input);
      } else if (effectiveMode === 'rhyme') {
        rhymeMatches = findRhymes(input);
      } else {
        var singleHan = characters.length === 1 && isHan(characters[0]);
        if (singleHan) {
          charEntries = queryChar(input);
          rhymeMatches = findRhymes(input);
        } else {
          rhymeMatches = findRhymes(input);
          if (rhymeMatches.length === 0 && characters.length === 1) {
            charEntries = queryChar(input);
          }
        }
      }

      if (charEntries.length) {
        result.charMatches = [{ char: input, entries: charEntries }];
      }
      result.rhymeMatches = rhymeMatches;

      if (result.charMatches.length && result.rhymeMatches.length) result.kind = 'both';
      else if (result.charMatches.length) result.kind = 'char';
      else if (result.rhymeMatches.length) result.kind = 'rhyme';
      else result.kind = 'none';
      return result;
    }

    return { query: query };
  }

  // ---------------------------------------------------------------------
  // Browser interface

  var I18N = {
    zh: {
      documentTitle: '平水韵查询',
      metaDescription: '离线查询平水韵：输入汉字查韵部，输入韵部查全部韵字。',
      backHome: '返回主页',
      languageGroup: '界面语言',
      themeToggle: '切换明暗主题',
      brand: '平水韵',
      eyebrow: '工具',
      heading: '平水韵查询',
      intro: '输入汉字查所属韵部，输入韵部查全部韵字。字典随页面加载，不发送查询。',
      queryLabel: '查询内容',
      placeholder: '例如：东、一东、15合、字 东',
      submit: '查询',
      modeLegend: '查询方式',
      modeAuto: '自动',
      modeChar: '查字',
      modeRhyme: '查韵部',
      modeHint: '单字自动查询会同时给出该字的读音和同名韵部。',
      examples: '示例',
      helpSummary: '使用说明',
      helpP1: '输入单个汉字，查它的全部读音、韵部和备注。若这个字同时是韵部名，也会一并给出韵部中的字。',
      helpP2: '输入韵部可以查完整韵字：东、一东、1、15合、十五合入、上平一东都可以。纯数字会列出该编号下的全部韵部。',
      helpP3: '用“字 东”强制查字，用“韵 一东”或“部 十五合”强制查韵部。也可以用上方的查询方式选项。',
      helpP4: '韵部原文中的方括号是原数据备注，页面原样保留；字位统计不计方括号内的注释。',
      helpP5: '界面语言和明暗主题沿用主页设置。查询词保存在地址栏，刷新或前进后退会恢复。',
      introTitle: '输入一个字或韵部开始查询',
      introBody: '也可以点下面的示例，或用“字 东”“韵 一东”指定查询方式。',
      emptyTitle: '请输入要查询的内容',
      emptyBody: '可以输入汉字、韵部编号或韵部名。',
      notFoundTitle: '没有找到“{q}”',
      notFoundBody: '可尝试去掉声调或上平、下平前缀，或用“字 …”“韵 …”指定查询方式。',
      charHeading: '「{char}」共 {n} 个读音',
      charHeadingOne: '「{char}」有 1 个读音',
      rhymeHeading: '韵部「{name}」（{tone}）',
      rhymeCount: '可识字位 {count} 个',
      rhymeCountNotes: '可识字位 {count} 个；原文共 {raw} 字符，含 [ ] 注释',
      rhymeEmpty: '该韵部原文为空。',
      multiple: '“{q}”匹配到 {n} 个韵部，以下逐一列出。',
      bothHint: '“{q}”同时是韵部名，以下是同名的韵部结果。',
      viewRhymeAria: '查询韵部 {rhyme}',
      note: '（{note}）',
      sourceLink: '源仓库 ping_shui_yun',
      dataVersion: '数据版本 {commit}',
      footerNote: '纯前端工具。数据随页面加载，不发送查询，也不改写原文。',
      tones: { '平': '平声', '上': '上声', '去': '去声', '入': '入声' }
    },
    en: {
      documentTitle: 'Pingshui Rhyme Lookup',
      metaDescription: 'Look up Pingshui rhyme groups offline: find the groups of a character or all characters in a group.',
      backHome: 'Back to home',
      languageGroup: 'Interface language',
      themeToggle: 'Toggle light and dark theme',
      brand: 'Pingshui Rhymes',
      eyebrow: 'TOOL',
      heading: 'Pingshui Rhyme Lookup',
      intro: 'Look up the rhyme groups of a character, or the characters in a rhyme group. The dictionary loads with the page; queries are not sent anywhere.',
      queryLabel: 'Search',
      placeholder: 'e.g. 东, 一东, 15合, 字 东',
      submit: 'Search',
      modeLegend: 'Search mode',
      modeAuto: 'Auto',
      modeChar: 'Character',
      modeRhyme: 'Rhyme group',
      modeHint: 'For a single character, Auto shows both its readings and any rhyme group with the same name.',
      examples: 'Examples',
      helpSummary: 'How to use',
      helpP1: 'Enter one Chinese character to see all of its readings, rhyme groups and notes. If the character is also a rhyme group name, the group is shown as well.',
      helpP2: 'Enter a rhyme group to see its full text: 东, 一东, 1, 15合, 十五合入 and 上平一东 all work. A bare number lists every group with that number.',
      helpP3: 'Use “字 东” to force a character lookup, or “韵 一东” and “部 十五合” to force a group lookup. The search mode control does the same.',
      helpP4: 'Square brackets in a group’s text are notes from the original data and are kept as-is. The character count excludes bracketed notes.',
      helpP5: 'Interface language and theme use the home page settings. The query is stored in the address bar, so refresh and back/forward restore it.',
      introTitle: 'Enter a character or a rhyme group',
      introBody: 'Try an example below, or use “字 东” and “韵 一东” to choose the lookup type.',
      emptyTitle: 'Nothing to search for',
      emptyBody: 'Enter a Chinese character, a group number or a group name.',
      notFoundTitle: 'No match for “{q}”',
      notFoundBody: 'Try removing the tone or the 上平 / 下平 prefix, or use “字 …” / “韵 …” to choose the lookup type.',
      charHeading: '“{char}” has {n} readings',
      charHeadingOne: '“{char}” has 1 reading',
      rhymeHeading: 'Rhyme group “{name}” ({tone})',
      rhymeCount: 'Readable character positions: {count}',
      rhymeCountNotes: 'Readable character positions: {count}; {raw} characters in the original, including [ ] notes',
      rhymeEmpty: 'The original text for this group is empty.',
      multiple: '“{q}” matches {n} rhyme groups. Each is listed below.',
      bothHint: '“{q}” is also a rhyme group name. The matching groups are listed below.',
      viewRhymeAria: 'Look up rhyme group {rhyme}',
      note: ' ({note})',
      sourceLink: 'Source: ping_shui_yun',
      dataVersion: 'Data version {commit}',
      footerNote: 'Pure front-end tool. The data loads with the page; queries are not sent and the original text is not rewritten.',
      tones: {
        '平': 'Level tone (平)',
        '上': 'Rising tone (上)',
        '去': 'Departing tone (去)',
        '入': 'Entering tone (入)'
      }
    }
  };

  function startBrowserInterface() {
    var doc = document;
    var globalObject = typeof globalThis !== 'undefined' ? globalThis : window;
    var bodyData = globalObject.PINGSHUI_DATA || {};
    var engine = createEngine(bodyData);
    var rootElement = doc.documentElement;

    var form = doc.getElementById('query-form');
    var input = doc.getElementById('query-input');
    var resultElement = doc.getElementById('result');
    var themeButton = doc.getElementById('theme-toggle');
    var sourceLink = doc.getElementById('source-link');
    var versionElement = doc.getElementById('data-version');
    var modeInputs = Array.prototype.slice.call(
      doc.querySelectorAll('input[name="mode"]')
    );
    var languageButtons = Array.prototype.slice.call(
      doc.querySelectorAll('button[data-language]')
    );
    var exampleButtons = Array.prototype.slice.call(
      doc.querySelectorAll('[data-example]')
    );

    var THEME_KEY = 'yaozi.home.theme';
    var LANGUAGE_KEY = 'yaozi.home.language';
    var themeMedia = window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

    var currentLanguage = 'zh';
    var lastResult = null;
    var themePreference = 'system';
    var composing = false;

    function readStore(key) {
      try {
        return window.localStorage.getItem(key);
      } catch (error) {
        return null;
      }
    }

    function writeStore(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch (error) {
        // Storage may be unavailable; queries still work without it.
      }
    }

    function t(key) {
      var table = I18N[currentLanguage] || I18N.zh;
      if (table[key] !== undefined) return table[key];
      return I18N.zh[key] !== undefined ? I18N.zh[key] : key;
    }

    function format(key, values) {
      return String(t(key)).replace(/\{(\w+)\}/g, function (match, name) {
        return values && values[name] !== undefined ? String(values[name]) : match;
      });
    }

    function toneLabel(tone) {
      var labels = (I18N[currentLanguage] || I18N.zh).tones || {};
      return labels[tone] || tone;
    }

    function makeElement(tagName, className, text) {
      var element = doc.createElement(tagName);
      if (className) element.className = className;
      if (text !== undefined) element.textContent = text;
      return element;
    }

    function selectedMode() {
      var checked = doc.querySelector('input[name="mode"]:checked');
      return checked && MODES.indexOf(checked.value) !== -1 ? checked.value : 'auto';
    }

    function setMode(mode) {
      var value = MODES.indexOf(mode) === -1 ? 'auto' : mode;
      modeInputs.forEach(function (radio) {
        radio.checked = radio.value === value;
      });
    }

    function readLocation() {
      var params = new URLSearchParams(window.location.search);
      var mode = params.get('mode');
      return {
        q: params.get('q') || '',
        mode: mode === 'char' || mode === 'rhyme' ? mode : 'auto'
      };
    }

    function writeLocation(raw, mode) {
      var query = String(raw == null ? '' : raw);
      try {
        var url = new URL(window.location.href);
        if (query.trim()) url.searchParams.set('q', query);
        else url.searchParams.delete('q');
        if (mode === 'char' || mode === 'rhyme') url.searchParams.set('mode', mode);
        else url.searchParams.delete('mode');
        if (url.href === window.location.href) return;
        window.history.pushState({ q: query, mode: mode }, '', url.href);
      } catch (error) {
        // Some file:// contexts refuse history changes. Lookup still works.
      }
    }

    function updateFooter() {
      if (sourceLink) {
        sourceLink.textContent = t('sourceLink');
        if (typeof bodyData.source === 'string' && bodyData.source) {
          sourceLink.href = bodyData.source;
        }
      }
      if (!versionElement) return;
      if (typeof bodyData.commit === 'string' && bodyData.commit) {
        var shortCommit = bodyData.commit.slice(0, 7);
        versionElement.textContent = format('dataVersion', { commit: shortCommit });
        if (typeof bodyData.source === 'string' && bodyData.source) {
          versionElement.href = bodyData.source.replace(/\/$/, '') +
            '/commit/' + bodyData.commit;
        }
        versionElement.hidden = false;
      } else {
        versionElement.hidden = true;
      }
    }

    function updateThemeButton() {
      if (themeButton) themeButton.setAttribute('aria-label', t('themeToggle'));
    }

    function applyI18n() {
      doc.title = t('documentTitle');
      rootElement.lang = currentLanguage === 'zh' ? 'zh-CN' : 'en';
      rootElement.dataset.language = currentLanguage;

      var description = doc.querySelector('meta[name="description"]');
      if (description) description.setAttribute('content', t('metaDescription'));

      Array.prototype.forEach.call(doc.querySelectorAll('[data-i18n]'), function (node) {
        node.textContent = t(node.getAttribute('data-i18n'));
      });
      Array.prototype.forEach.call(doc.querySelectorAll('[data-i18n-placeholder]'), function (node) {
        node.setAttribute('placeholder', t(node.getAttribute('data-i18n-placeholder')));
      });
      Array.prototype.forEach.call(doc.querySelectorAll('[data-i18n-aria]'), function (node) {
        node.setAttribute('aria-label', t(node.getAttribute('data-i18n-aria')));
      });

      languageButtons.forEach(function (button) {
        button.setAttribute('aria-pressed', button.dataset.language === currentLanguage ? 'true' : 'false');
      });
      updateThemeButton();
      updateFooter();
    }

    function applyTheme() {
      var resolved = themePreference;
      if (themePreference === 'system') {
        resolved = themeMedia && themeMedia.matches ? 'dark' : 'light';
      }
      rootElement.dataset.themePreference = themePreference;
      rootElement.dataset.theme = resolved;
      rootElement.style.colorScheme = resolved;
      var themeColor = doc.querySelector('meta[name="theme-color"]');
      if (themeColor) themeColor.setAttribute('content', resolved === 'dark' ? '#111113' : '#f5f5f7');
      updateThemeButton();
    }

    function applyLanguage(language, persist) {
      if (language !== 'zh' && language !== 'en') return;
      currentLanguage = language;
      if (persist) writeStore(LANGUAGE_KEY, language);
      applyI18n();
      if (lastResult) renderResult(lastResult);
      else renderIntro();
    }

    function emptyState(title, body) {
      var box = makeElement('div', 'empty');
      box.appendChild(makeElement('p', 'empty-title', title));
      box.appendChild(makeElement('p', 'empty-body', body));
      return box;
    }

    function renderIntro() {
      lastResult = null;
      resultElement.textContent = '';
      resultElement.appendChild(emptyState(t('introTitle'), t('introBody')));
    }

    function renderCharCard(character, entries) {
      var card = makeElement('section', 'result-card char-card');
      var heading = entries.length === 1
        ? format('charHeadingOne', { char: character })
        : format('charHeading', { char: character, n: entries.length });
      card.appendChild(makeElement('h2', 'result-heading', heading));

      var list = makeElement('div', 'char-list');
      entries.forEach(function (entry) {
        var row = makeElement('div', 'char-entry');
        row.appendChild(makeElement('span', 'tone-badge', toneLabel(entry.tone)));

        var link = makeElement('button', 'rhyme-link', entry.rhyme);
        link.type = 'button';
        link.setAttribute('aria-label', format('viewRhymeAria', { rhyme: entry.rhyme }));
        link.addEventListener('click', function () {
          queryForRhyme(entry.rhyme);
        });
        row.appendChild(link);

        if (entry.note) {
          row.appendChild(makeElement('span', 'entry-note',
            format('note', { note: entry.note })));
        }
        list.appendChild(row);
      });
      card.appendChild(list);
      return card;
    }

    function appendRhymeText(parent, text) {
      if (!text) {
        parent.appendChild(makeElement('span', 'empty-text', t('rhymeEmpty')));
        return;
      }
      var notePattern = /\[[^\]]*\]/g;
      var lastIndex = 0;
      var match;
      while ((match = notePattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parent.appendChild(doc.createTextNode(text.slice(lastIndex, match.index)));
        }
        parent.appendChild(makeElement('span', 'rhyme-note', match[0]));
        lastIndex = match.index + match[0].length;
        if (match[0].length === 0) notePattern.lastIndex += 1;
      }
      if (lastIndex < text.length) {
        parent.appendChild(doc.createTextNode(text.slice(lastIndex)));
      }
    }

    function renderRhymeCard(entry) {
      var card = makeElement('section', 'result-card rhyme-card');
      var heading = makeElement('h2', 'result-heading');
      var title = makeElement('button', 'rhyme-title',
        format('rhymeHeading', { name: entry.name, tone: toneLabel(entry.tone) }));
      title.type = 'button';
      title.setAttribute('aria-label', format('viewRhymeAria', { rhyme: entry.name + entry.tone }));
      title.addEventListener('click', function () {
        queryForRhyme(entry.name + entry.tone);
      });
      heading.appendChild(title);
      card.appendChild(heading);

      var meta = makeElement('p', 'rhyme-meta');
      meta.appendChild(makeElement('span', 'rhyme-count',
        entry.hasNotes
          ? format('rhymeCountNotes', { count: entry.charCount, raw: entry.rawLength })
          : format('rhymeCount', { count: entry.charCount })));
      card.appendChild(meta);

      var text = makeElement('div', 'rhyme-text');
      appendRhymeText(text, entry.text);
      card.appendChild(text);
      return card;
    }

    function renderResult(result) {
      resultElement.textContent = '';
      if (result.kind === 'empty') {
        resultElement.appendChild(emptyState(t('emptyTitle'), t('emptyBody')));
        return;
      }
      if (result.kind === 'none') {
        resultElement.appendChild(emptyState(
          format('notFoundTitle', { q: result.input || result.raw }),
          t('notFoundBody')
        ));
        return;
      }

      var charMatches = result.charMatches || [];
      var rhymeMatches = result.rhymeMatches || [];

      charMatches.forEach(function (match) {
        resultElement.appendChild(renderCharCard(match.char, match.entries));
      });

      if (charMatches.length && rhymeMatches.length) {
        resultElement.appendChild(makeElement('p', 'result-note',
          format('bothHint', { q: result.input })));
      }

      if (rhymeMatches.length) {
        if (rhymeMatches.length > 1) {
          resultElement.appendChild(makeElement('p', 'result-note',
            format('multiple', { q: result.input, n: rhymeMatches.length })));
        }
        rhymeMatches.forEach(function (entry) {
          resultElement.appendChild(renderRhymeCard(entry));
        });
      }
    }

    function runQuery(raw, options) {
      options = options || {};
      var mode = selectedMode();
      var result = engine.query(raw, mode);
      lastResult = result;
      renderResult(result);
      if (options.updateUrl !== false) writeLocation(raw, mode);
    }

    function queryForRhyme(rhyme) {
      var raw = '韵 ' + rhyme;
      input.value = raw;
      runQuery(raw, { updateUrl: true });
    }

    function applyLocation(pushState) {
      var state = readLocation();
      setMode(state.mode);
      if (state.q) {
        input.value = state.q;
        runQuery(state.q, { updateUrl: false });
      } else {
        input.value = '';
        renderIntro();
        if (pushState) writeLocation('', state.mode);
      }
    }

    // Theme preference.
    var storedTheme = readStore(THEME_KEY);
    themePreference = storedTheme === 'light' || storedTheme === 'dark'
      ? storedTheme
      : 'system';
    applyTheme();
    if (themeMedia) {
      var onSystemThemeChange = function () {
        if (themePreference === 'system') applyTheme();
      };
      if (themeMedia.addEventListener) themeMedia.addEventListener('change', onSystemThemeChange);
      else if (themeMedia.addListener) themeMedia.addListener(onSystemThemeChange);
    }
    if (themeButton) {
      themeButton.addEventListener('click', function () {
        var current = rootElement.dataset.theme === 'dark' ? 'dark' : 'light';
        themePreference = current === 'dark' ? 'light' : 'dark';
        writeStore(THEME_KEY, themePreference);
        applyTheme();
      });
    }

    // Language preference.
    var storedLanguage = readStore(LANGUAGE_KEY);
    var navigatorLanguage = (window.navigator && window.navigator.language) || 'zh';
    var initialLanguage = storedLanguage === 'zh' || storedLanguage === 'en'
      ? storedLanguage
      : (String(navigatorLanguage).toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en');
    applyLanguage(initialLanguage, false);
    languageButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        applyLanguage(button.dataset.language, true);
      });
    });

    // Input and query handling.
    input.addEventListener('compositionstart', function () {
      composing = true;
    });
    input.addEventListener('compositionend', function () {
      composing = false;
    });
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && (composing || event.isComposing)) {
        event.preventDefault();
      }
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (composing) return;
      runQuery(input.value, { updateUrl: true });
    });

    modeInputs.forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (radio.checked) {
          if (input.value.trim()) runQuery(input.value, { updateUrl: true });
          else writeLocation('', selectedMode());
        }
      });
    });

    exampleButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        var raw = button.getAttribute('data-example') || '';
        input.value = raw;
        runQuery(raw, { updateUrl: true });
      });
    });

    window.addEventListener('popstate', function () {
      applyLocation(false);
    });

    applyLocation(false);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startBrowserInterface, { once: true });
    } else {
      startBrowserInterface();
    }
  }

  return {
    createEngine: createEngine,
    numToCn: numToCn,
    cnToNum: cnToNum,
    normalizeRhymeName: normalizeRhymeName,
    countRhymeCharacters: countRhymeCharacters
  };
});
