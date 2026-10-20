# 博客写作与更新

一篇文章一个 Markdown 文件，保存在 `blog/posts/<slug>.<lang>.md`。从 [TEMPLATE.md](TEMPLATE.md) 复制新文章，例如 `blog/posts/first-note.zh.md`。模板本身不参与生成。

文件开头使用以下单行 YAML 元信息：

```yaml
---
slug: "first-note"
date: "2026-10-20"
lang: "zh"
title: "第一篇随想"
summary: "用一两句话概括文章。"
draft: true
---
```

这些字段都必须填写。字符串建议使用双引号；引号内的双引号写成 `\"`。`draft` 使用不带引号的 `true` 或 `false`。支持双引号字符串、单引号字符串和不含 YAML 特殊标点的简单值；元信息不使用嵌套对象、数组或多行字段。

- `slug` 是文章链接标识，只用小写英文字母、数字和单个连字符。发布后保留它，以维持旧链接。
- `date` 为发布日期，格式是 `YYYY-MM-DD`。新文章使用北京时间日期；同篇文章的中英文版本使用相同日期。
- `lang` 为 `zh` 或 `en`。只写中文即可；界面切到另一语言时会显示已有版本。
- `title` 和 `summary` 是纯文本，正文写在第二条 `---` 之后。正文从 `##` 小标题开始，文章大标题由 `title` 提供。
- `draft: true` 不进入文章列表及生成数据。改为 `false` 后参与生成。草稿标记只控制页面展示；公开仓库中的源稿仍然公开，私密原稿保存在仓库外。

正文支持段落、标题、粗体、斜体、列表、引用、链接、图片、表格和围栏代码块。原始 HTML 按文字展示。图片写明替代文字，例如 `![图的内容](./assets/photo.png)`；相对路径从文章源文件所在目录解析，可将素材放进 `blog/posts/assets/`。

英文版使用相同 `slug`，另建 `<slug>.en.md`。只创建已有或用户要求翻译的语言版本。

在仓库根目录运行：

```sh
node scripts/build-blog.cjs
node scripts/build-blog.cjs --check
node scripts/verify-blog.cjs
```

生成器校验元信息、合并同篇文章的语言版本、按日期倒序生成 `blog/posts.js`。格式错误时会报告文件名，并保留旧的生成文件。`--check` 只检查源稿与生成文件是否一致。

通过本地 HTTP 服务访问 `/#blog` 查看列表，通过 `/#blog/first-note` 直接阅读文章。发布时一起提交 Markdown、使用的素材和 `blog/posts.js`；站点继续从 `main` 根目录发布。`blog/posts.js` 是生成文件，每次修改文章后重新生成，不手工编辑它，也不再向 `home-content.js` 手工添加文章。

智能体整理原稿时遵循根目录 [AGENTS.md](../AGENTS.md) 中的“博客 Markdown 与文本整理”规则。
