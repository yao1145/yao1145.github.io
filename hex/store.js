(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HexStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const KEY = 'yaozi.hex.progress.v1', SETTINGS_KEY = 'yaozi.hex.settings.v1';
  const budgets = [100, 800, 3000, 100, 1000, 4000, 150, 1500, 5000, 200, 2000, 6000];
  const LEVELS = Object.freeze(budgets.map((budgetMs, i) => Object.freeze({
    id: i + 1, size: [7, 9, 11, 13][Math.floor(i / 3)],
    difficulty: ['easy', 'medium', 'high'][i % 3], budgetMs
  })));
  let memory = null, memorySettings = null;
  const integer = (n, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n >= 0 && n <= max ? n : 0;
  function result(value) {
    if (!value || typeof value !== 'object' || !Number.isSafeInteger(value.moves) || value.moves < 0 ||
      value.moves > 169 || !Number.isFinite(value.durationMs) || value.durationMs < 0 ||
      !Number.isFinite(value.aiMs) || value.aiMs < 0) return null;
    return { moves: value.moves, durationMs: value.durationMs, aiMs: value.aiMs };
  }
  function sanitize(value) {
    const levels = LEVELS.map((_, i) => {
      const old = value && value.version === 1 && Array.isArray(value.levels) ? value.levels[i] : null;
      const attempts = integer(old && old.attempts), wins = Math.min(attempts, integer(old && old.wins));
      const last = result(old && old.last);
      return { attempts, wins, best: wins ? result(old && old.best) : null,
        last: last ? { won: old.last.won === true, ...last } : null };
    });
    // Unlocks derive from actual completion records rather than an untrusted counter.
    let unlocked = 1;
    for (let i = 0; i < 11 && levels[i].wins > 0; i++) unlocked = i + 2;
    return { version: 1, unlocked, levels };
  }
  function read(key) {
    try { return JSON.parse(globalThis.localStorage.getItem(key)); } catch (_) { return null; }
  }
  function write(key, value) {
    try { globalThis.localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* In-memory play remains available. */ }
  }
  function load() {
    const saved = read(KEY);
    memory = sanitize(saved || memory);
    return memory;
  }
  function save(progress) { memory = progress; write(KEY, progress); return progress; }
  function begin(progress, levelId) {
    if (!Number.isInteger(levelId) || levelId < 1 || levelId > progress.unlocked || levelId > 12) return progress;
    progress.levels[levelId - 1].attempts++;
    return save(progress);
  }
  function finish(progress, levelId, record) {
    if (!Number.isInteger(levelId) || levelId < 1 || levelId > progress.unlocked || levelId > 12) return progress;
    const clean = result(record);
    if (!clean) return progress;
    const level = progress.levels[levelId - 1];
    level.last = { won: record.won === true, ...clean };
    if (record.won === true) {
      level.wins++;
      if (!level.best || clean.durationMs < level.best.durationMs ||
        (clean.durationMs === level.best.durationMs && clean.moves < level.best.moves)) level.best = clean;
      progress.unlocked = Math.max(progress.unlocked, Math.min(12, levelId + 1));
    }
    return save(progress);
  }
  function cleanSettings(value) {
    return { motion: value && value.motion === 'off' ? 'off' : 'auto',
      performance: value && value.performance === 'fast' ? 'fast' : 'balanced',
      analysis: !!(value && value.analysis === true) };
  }
  function loadSettings() { memorySettings = cleanSettings(read(SETTINGS_KEY) || memorySettings); return memorySettings; }
  function saveSettings(settings) { memorySettings = cleanSettings(settings); write(SETTINGS_KEY, memorySettings); return memorySettings; }
  return { LEVELS, load, begin, finish, completed: progress => progress.levels.filter(level => level.wins > 0).length,
    loadSettings, saveSettings };
});
