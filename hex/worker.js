'use strict';
importScripts('engine.js', 'ai.js?v=20261020-mobile1');
let current = 0;
self.onmessage = async function (event) {
  const { id, type, request } = event.data || {};
  if (type !== 'search') return;
  current = id;
  try {
    const result = await HexAI.search(request,
      progress => { if (current === id) self.postMessage({ id, type: 'progress', ...progress }); },
      () => current !== id);
    if (current === id) self.postMessage({ id, type: 'result', result });
  } catch (error) {
    if (current === id) self.postMessage({ id, type: 'error', message: String(error.message || error) });
  }
};
