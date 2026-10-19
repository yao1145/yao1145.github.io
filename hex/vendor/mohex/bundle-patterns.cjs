const fs = require('node:fs');
const path = require('node:path');
const names = require('./patterns.json');
const patterns = Object.fromEntries(names.map(name => [name, fs.readFileSync(path.join(__dirname, 'patterns', name), 'utf8')]));
fs.writeFileSync(path.join(__dirname, 'patterns.js'), '/* Upstream MoHex/Benzene pattern weights, LGPL-3.0. See UPSTREAM-SOURCE.txt. */\n' +
  '(function(root){const data=' + JSON.stringify(patterns) + ";if(typeof module==='object'&&module.exports)module.exports=data;else root.MoHexPatterns=data;})(globalThis);\n");
