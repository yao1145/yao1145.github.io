const fs = require('node:fs');
const path = require('node:path');
const names = require('./patterns.json');
const patterns = {}, aliases = {};
for (const name of names) {
  const text = fs.readFileSync(path.join(__dirname, 'patterns', name), 'utf8');
  const original = Object.keys(patterns).find(key => patterns[key] === text);
  if (original) aliases[name] = original;
  else patterns[name] = text;
}
fs.writeFileSync(path.join(__dirname, 'patterns.js'), '/* Upstream MoHex/Benzene pattern weights, LGPL-3.0. See UPSTREAM-SOURCE.txt. */\n' +
  '(function(root){const data=' + JSON.stringify(patterns) + ';const aliases=' + JSON.stringify(aliases) +
  ';for(const [name,original] of Object.entries(aliases))data[name]=data[original];' +
  "if(typeof module==='object'&&module.exports)module.exports=data;else root.MoHexPatterns=data;})(globalThis);\n");
