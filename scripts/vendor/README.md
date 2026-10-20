# Markdown parser

`markdown-it.min.js` is the self-contained browser UMD bundle from the official `markdown-it` npm package, pinned to **15.0.3**. The Node blog generator loads it locally; the website does not download or run the parser.

- Package: https://registry.npmjs.org/markdown-it/15.0.3
- Source: https://github.com/markdown-it/markdown-it/tree/15.0.3
- Original file: `package/dist/browser/markdown-it.umd.min.js`
- License: MIT; retained in `markdown-it.LICENSE`.

The downloaded package was checked against the registry's SHA-512 integrity value before extraction. Raw HTML is disabled in the generator. Update this file and rerun the blog verification when replacing the parser.

## Math typesetting

KaTeX **0.19.0** is the official npm UMD bundle (`katex.min.js`); its MIT license is retained in `katex.LICENSE`. The homepage loads its matching CSS and fonts from `blog/vendor/katex/`, without a CDN or browser math script.

The math delimiter parser is **@vscode/markdown-it-katex 1.1.2**, from https://github.com/microsoft/vscode-markdown-it-katex. `markdown-it-katex.cjs` retains the compiled npm distribution, with its sole `require("katex")` changed to `require("./katex.min.js")`. Its MIT license is retained separately. Both tarballs were verified against the npm registry SHA-512 integrity before extraction.

The generator overrides math renderers to fail on invalid TeX, disable trusted HTML/URL commands, and emit both visual HTML and accessible MathML. Unicode text is permitted. Code blocks and escaped dollar signs keep their Markdown semantics.
