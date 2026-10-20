const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { compilePosts, serializePosts, buildBlog } = require('./build-blog.cjs');
let checks = 0;
const check = (condition, message) => { checks++; assert.ok(condition, message); };
function source(overrides = {}, body = '## 小标题\n\n这是 **重点**。\n\n- 第一项\n- 第二项\n') {
  const data = { slug: 'first-note', date: '2026-10-20', lang: 'zh', title: '第一篇随想', summary: '一段摘要。', draft: false, ...overrides };
  return '---\n' + Object.entries(data).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n') + '\n---\n\n' + body;
}
const file = (name, text) => ({ name, source: text });
const template = fs.readFileSync(path.join(__dirname, '..', 'blog', 'TEMPLATE.md'), 'utf8');
check(compilePosts([file('first-note.zh.md', template)]).length === 0, 'the standard template is a valid unpublished draft');
const compile = (text, name = 'first-note.zh.md') => compilePosts([file(name, text)]);
const rejects = (text, message, name) => { checks++; assert.throws(() => compile(text, name), message); };

const posts = compile(source());
check(posts.length === 1 && posts[0].title.zh === '第一篇随想', 'metadata');
check(posts[0].html.zh.includes('<h3>小标题</h3>'), 'body headings follow the article h2');
check(posts[0].html.zh.includes('<strong>重点</strong>') && posts[0].html.zh.includes('<li>第一项</li>'), 'Markdown formatting');
check(compile(source({ draft: true })).length === 0, 'drafts excluded');
const bilingual = compilePosts([file('first-note.en.md', source({ lang: 'en', title: 'First note' }, 'English body.')), file('first-note.zh.md', source())]);
check(bilingual.length === 1 && bilingual[0].html.en.includes('English body.'), 'translations grouped');
check(!('en' in compile(source())[0].html), 'single-language post kept without fake translation');
const ordered = compilePosts([file('old-note.zh.md', source({ slug: 'old-note', date: '2026-10-19' })), file('first-note.zh.md', source())]);
check(ordered[0].slug === 'first-note', 'newest first');
check(compile(source({}, '    first code line\n    second code line\n'))[0].html.zh.includes('<pre><code>first code line\nsecond code line\n'), 'indented code keeps its leading spaces');
check(compile('\ufeff' + source().replace(/\n/g, '\r\n')).length === 1, 'Windows BOM and CRLF');
rejects('no metadata', /front matter/i);
rejects(source({ slug: '../bad' }), /slug/);
rejects(source({ lang: 'fr' }), /lang/);
rejects(source({ date: '2026-02-30' }), /date/);
rejects(source({ title: '' }), /title/);
rejects(source({ summary: '' }), /summary/);
rejects(source({ draft: 'false' }), /draft/);
rejects(source({ author: 'unexpected' }), /Unknown/);
rejects(source().replace('---\n\n', 'title: "duplicate"\n---\n\n'), /Duplicate/);
rejects(source(), /filename/i, 'wrong.zh.md');
rejects(source({}, '   '), /body/i);
checks++; assert.throws(() => compilePosts([file('first-note.zh.md', source()), file('first-note.zh.md', source())]), /Duplicate/);
checks++; assert.throws(() => compilePosts([file('first-note.zh.md', source()), file('first-note.en.md', source({ lang: 'en', date: '2026-10-19' }))]), /date/);

const dangerous = compile(source({}, '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[bad](javascript:alert(1))\n\n![bad](data:image/svg+xml;base64,PHN2Zz4=)\n\n```js\nconst answer = 42;\n```'))[0].html.zh;
check(!dangerous.includes('<script>') && !dangerous.includes('<img src=x'), 'raw HTML escaped');
check(!dangerous.includes('href="javascript:') && !dangerous.includes('src="data:image/svg'), 'unsafe links blocked');
check(dangerous.includes('<pre><code class="language-js">'), 'fenced code');
const assets = compile(source({}, '[相对文件](./assets/note.txt)\n\n![图](./assets/photo.png)'))[0].html.zh;
check(assets.includes('href="/blog/posts/assets/note.txt"') && assets.includes('src="/blog/posts/assets/photo.png"'), 'relative assets resolved from source folder');
const escaped = serializePosts(compile(source({ title: '</script><script>alert(1)</script>' })));
check(!escaped.includes('</script>'), 'safe JS embedding');
const sandbox = { window: {} };
vm.runInNewContext(escaped, sandbox);
check(sandbox.window.YAOZI_BLOG_POSTS[0].title.zh === '</script><script>alert(1)</script>', 'serialized data round trip');

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'yaozi-blog-'));
try {
  fs.mkdirSync(path.join(temporary, 'blog', 'posts'), { recursive: true });
  const input = path.join(temporary, 'blog', 'posts', 'first-note.zh.md');
  fs.writeFileSync(input, source());
  check(buildBlog(temporary).count === 1, 'build writes generated output');
  const output = path.join(temporary, 'blog', 'posts.js');
  const previous = fs.readFileSync(output, 'utf8');
  check(buildBlog(temporary, { check: true }).count === 1, 'check verifies current output');
  fs.writeFileSync(input, source({ title: '更新标题' }));
  checks++; assert.throws(() => buildBlog(temporary, { check: true }), /out of date/i);
  check(fs.readFileSync(output, 'utf8') === previous, 'check never writes');
  fs.writeFileSync(input, 'invalid');
  checks++; assert.throws(() => buildBlog(temporary), /front matter/i);
  check(fs.readFileSync(output, 'utf8') === previous, 'failed build preserves output');
} finally {
  const resolved = fs.realpathSync(temporary);
  assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
  assert.ok(path.basename(resolved).startsWith('yaozi-blog-'));
  fs.rmSync(resolved, { recursive: true, force: true });
}
console.log(JSON.stringify({ passed: true, checks }));
