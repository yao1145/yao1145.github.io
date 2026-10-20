// Markdown sources are authoritative. The browser reads the generated static JS.
const fs = require('node:fs');
const path = require('node:path');
const MarkdownIt = require('./vendor/markdown-it.min.js');
const fields = new Set(['slug', 'date', 'lang', 'title', 'summary', 'draft']);

function parsePost(source, name) {
  const normalized = source.replace(/^\ufeff/, '').replace(/\r\n?/g, '\n');
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/.exec(normalized);
  const fail = message => { throw new Error(`${name}: ${message}`); };
  if (!match) fail('Expected YAML front matter between --- lines.');
  const metadata = {};
  for (const line of match[1].split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const field = /^([a-z][a-z0-9_-]*):[ \t]*(.*)$/.exec(line);
    if (!field) fail('Each metadata field must be a single key: value line.');
    const [, key, raw] = field;
    if (!fields.has(key)) fail(`Unknown metadata field: ${key}`);
    if (Object.hasOwn(metadata, key)) fail(`Duplicate metadata field: ${key}`);
    const value = raw.trim();
    if (key === 'draft') {
      if (!['true', 'false'].includes(value)) fail('draft must be true or false, without quotes.');
      metadata.draft = value === 'true';
      continue;
    }
    let parsed = value;
    if (value.startsWith('"')) {
      try { parsed = JSON.parse(value); } catch { fail(`Invalid double-quoted ${key}. Use JSON string escaping.`); }
    } else if (value.startsWith("'")) {
      if (!/^'(?:[^']|'')*'$/.test(value)) fail(`Invalid single-quoted ${key}.`);
      parsed = value.slice(1, -1).replace(/''/g, "'");
    } else if (/[:\[\]{}#]/.test(value)) {
      fail(`Quote ${key} when it contains YAML punctuation.`);
    }
    if (typeof parsed !== 'string' || !parsed.trim() || /[\r\n]/.test(parsed)) fail(`${key} must be a nonempty single-line string.`);
    metadata[key] = parsed.trim();
  }
  for (const key of fields) if (!Object.hasOwn(metadata, key)) fail(`Missing required field: ${key}`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.slug)) fail('slug must use lowercase letters, numbers and single hyphens.');
  if (!['zh', 'en'].includes(metadata.lang)) fail('lang must be zh or en.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.date)) fail('date must be YYYY-MM-DD.');
  const date = new Date(`${metadata.date}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== metadata.date) fail('date must be a real calendar date.');
  if (name !== `${metadata.slug}.${metadata.lang}.md`) fail(`Expected filename ${metadata.slug}.${metadata.lang}.md`);
  if (!match[2].trim()) fail('The Markdown body must not be empty.');
  return { metadata, markdown: match[2].replace(/^\n+/, '').replace(/\n*$/, '\n') };
}

function renderMarkdown(markdown, name) {
  const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
  // Asset paths are relative to the source article, not the homepage URL.
  function assetUrl(value) {
    if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(value)) return value;
    const resolved = new URL(value, `https://blog.invalid/blog/posts/${name}`);
    return resolved.pathname + resolved.search + resolved.hash;
  }
  const renderLink = md.renderer.rules.link_open || ((tokens, index, options, env, renderer) => renderer.renderToken(tokens, index, options));
  md.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
    const token = tokens[index];
    token.attrSet('href', assetUrl(token.attrGet('href')));
    return renderLink(tokens, index, options, env, renderer);
  };
  const renderImage = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, index, options, env, renderer) => {
    const token = tokens[index];
    token.attrSet('src', assetUrl(token.attrGet('src')));
    token.attrSet('loading', 'lazy');
    token.attrSet('decoding', 'async');
    return renderImage(tokens, index, options, env, renderer);
  };
  md.core.ruler.push('article_heading_levels', state => {
    for (const token of state.tokens) {
      if (token.type === 'heading_open' || token.type === 'heading_close') {
        token.tag = `h${Math.min(6, Math.max(3, Number(token.tag.slice(1)) + 1))}`;
      }
    }
  });
  return md.render(markdown);
}

function compilePosts(files) {
  const entries = new Map();
  for (const { name, source } of files) {
    const { metadata: meta, markdown } = parsePost(source, name);
    if (meta.draft) continue;
    let post = entries.get(meta.slug);
    if (!post) {
      post = { slug: meta.slug, date: meta.date, title: {}, summary: {}, html: {} };
      entries.set(meta.slug, post);
    }
    if (Object.hasOwn(post.title, meta.lang)) throw new Error(`${name}: Duplicate ${meta.lang} translation for ${meta.slug}.`);
    if (post.date !== meta.date) throw new Error(`${name}: Translations of ${meta.slug} must share the same date.`);
    post.title[meta.lang] = meta.title;
    post.summary[meta.lang] = meta.summary;
    post.html[meta.lang] = renderMarkdown(markdown, name);
  }
  return [...entries.values()].sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

function serializePosts(posts) {
  const json = JSON.stringify(posts, null, 2).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return '// Generated by node scripts/build-blog.cjs. Edit blog/posts/*.md instead.\nwindow.YAOZI_BLOG_POSTS = ' + json + ';\n';
}

function buildBlog(root = path.resolve(__dirname, '..'), { check = false } = {}) {
  const directory = path.join(root, 'blog', 'posts');
  const files = fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && /\.md$/i.test(entry.name))
    .map(entry => entry.name).sort()
    .map(name => ({ name, source: fs.readFileSync(path.join(directory, name), 'utf8') }));
  const posts = compilePosts(files);
  const output = path.join(root, 'blog', 'posts.js');
  const generated = serializePosts(posts);
  if (check) {
    if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== generated) {
      throw new Error('blog/posts.js is out of date. Run node scripts/build-blog.cjs.');
    }
  } else {
    fs.writeFileSync(output, generated, 'utf8');
  }
  return { count: posts.length, output };
}

module.exports = { parsePost, compilePosts, serializePosts, buildBlog };
if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--check')) throw new Error('Usage: node scripts/build-blog.cjs [--check]');
    const result = buildBlog(undefined, { check: args.includes('--check') });
    console.log(`${args.includes('--check') ? 'Checked' : 'Generated'} blog/posts.js (${result.count} published articles).`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
