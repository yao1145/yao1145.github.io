const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const cache = path.join(cfg.cwd, '.browser-objects'); fs.mkdirSync(cache, { recursive: true });
function exec(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python', [cfg.emcc, ...args], { cwd: cfg.cwd, env: process.env, windowsHide: true });
    let log = ''; proc.stdout.on('data', b => { log += b; }); proc.stderr.on('data', b => { log += b; });
    proc.on('error', reject); proc.on('exit', code => code === 0 ? resolve() : reject(Error(log)));
  });
}
(async () => {
  const objects = []; let index = 0, failed = false, compiled = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (!failed && index < cfg.sources.length) {
      const source = cfg.sources[index++], full = path.join(cfg.cwd, source);
      const hash = crypto.createHash('sha256').update(fs.readFileSync(full)).update(JSON.stringify(cfg.compile)).digest('hex');
      const object = path.join(cache, source.replace(/[\\/]/g, '_') + '-' + hash.slice(0, 16) + '.o');
      objects.push(object);
      if (fs.existsSync(object)) continue;
      try { await exec([...cfg.compile, '-c', source, '-o', object]); compiled++; }
      catch (error) { failed = true; throw error; }
    }
  }));
  console.log(`MoHex: ${compiled} source files compiled, ${objects.length} objects linked.`);
  await exec([...objects, ...cfg.link]);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
