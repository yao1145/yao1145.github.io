'use strict';
importScripts('engine.js');
self.onmessage = function (event) {
  const { id, seed, difficulty } = event.data;
  try {
    self.postMessage({ id, type: 'progress', nodes: 0 });
    let result = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = ColoringEngine.makeCandidate(seed + ':' + attempt, difficulty);
      if (!ColoringEngine.validateColoring(candidate, candidate.solution, candidate.k).valid) continue;
      const search = ColoringEngine.createSearch(candidate, candidate.k - 1, { maxNodes: 2000000 });
      let check;
      do {
        check = search.step(2000);
        self.postMessage({ id, type: 'progress', nodes: check.nodes || 0 });
      } while (check.status === 'searching');
      if (check.status === 'infeasible') { result = { ...candidate, status: 'verified' }; break; }
    }
    self.postMessage({ id, type: 'result', result });
  } catch (error) { self.postMessage({ id, type: 'error', message: String(error.message || error) }); }
};
