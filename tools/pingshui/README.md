# 平水韵查询

`ping_shui_yun` 的 JavaScript 网页版。输入汉字查韵部，输入韵部查韵字。

页面入口为 `tools/pingshui/index.html`，直接打开或经静态服务器访问均可。字典由同目录的 `data.js` 随页面加载，全部查询在浏览器内完成，也可离线使用。

数据来源：<https://github.com/yao1145/ping_shui_yun>，当前数据版本 `ebed44fe32387279ea13551f7c1f49a8810cadd8`。

## 查询方式

- 单个汉字：自动同时查询该字的读音、韵部和备注，以及可能与之同名的韵部。例如 `东` 会给出「东」字的结果和「一东」韵部。
- 韵部：`东`、`一东`、`1`、`15合`、`十五合入`、`上平一东` 都可以。纯数字会列出该编号下的全部韵部。
- 强制前缀：`字 东` 只查字；`韵 一东` 或 `部 十五合` 只查韵部。
- 界面上的“自动 / 查字 / 查韵部”选项与强制前缀作用相同，强制前缀优先。

查询词和查询方式保存在地址栏的 `?q=` 与 `?mode=` 中（`auto` 时省略 `mode`）。刷新、前进和后退会恢复查询。个别浏览器会拒绝 `file://` 页面写入历史记录，此时查询本身仍然可用。

## 结果结构

`app.js` 是 UMD 模块。Node 中：

```js
const { createEngine } = require('./app.js');
const engine = createEngine(data); // data 形如 { characters, rhymes }
const result = engine.query('东', 'auto');
```

浏览器中 `data.js` 把同一对象放在 `window.PINGSHUI_DATA`，页面逻辑直接读取它。

`createEngine(data)` 返回 `{ query(raw, mode = 'auto') }`。`data` 需要包含 `characters` 和 `rhymes` 两个对象，也可以直接省略，缺失时返回空结果。`mode` 可取 `auto`、`char`、`rhyme`。

`query` 返回：

```js
{
  raw: '东',                 // 原始输入
  input: '东',               // 去掉“字 / 韵 / 部”前缀后的查询词
  mode: 'auto',              // 实际生效的查询方式
  forced: null,              // 'char' 或 'rhyme'，无前缀时为 null
  kind: 'both',              // empty | char | rhyme | both | none
  charMatches: [
    {
      char: '东',
      entries: [
        { tone: '平', rhyme: '一东', note: '' }
      ]
    }
  ],
  rhymeMatches: [
    {
      name: '一东',
      tone: '平',
      key: '一东\u0000平',
      text: '东同铜桐……',
      charCount: 0,          // 实际数值由原文计算，不计 [ ] 注释内的汉字
      rawLength: 0,          // 实际数值由原文计算，含注释字符（已去掉 BOM）
      hasNotes: false
    }
  ]
}
```

`charMatches` 为空数组表示没有按字命中，`rhymeMatches` 同理。`kind` 为 `empty` 时输入为空，为 `none` 时没有命中。

## 数据边界

- `characters` 的值原为 `[声调, 韵部, 备注]` 列表；`rhymes` 的键为“韵部名 + 声调”，值为原字串。构建索引时读取原对象，不修改数据。
- 原始资料含 BOM 和数字韵名。索引会去掉 BOM，并把韵名开头的阿拉伯数字转成中文数字。
- 原数据有一处 OCR 讹误：韵部键 `二十一个` 在索引中按原 `run.py` 的规则映射为 `二十一箇`。字符条目里的韵部字段同样去掉 BOM 并转换数字韵名，但不替换这个别名，也不做整表纠错。
- 韵部原文原样显示，方括号 `[……]` 是原数据备注。`charCount` 只统计方括号之外、Unicode Han 范围内的字符，避免把备注标点和注释算作韵字；`rawLength` 是原文全部字符数，用于说明差异。
- 重复的韵部键沿用 Python 字典赋值的语义：后出现的值覆盖先出现的值，保留第一次出现的位置。
- 数据中的历史字形、异体和繁简用字保持原样；工具不提供拼音、释义或校勘。

## 界面

- 明暗主题读取 `yaozi.home.theme`，语言读取 `yaozi.home.language`；本地存储不可用时仍可查询和切换当前会话状态。
- 中文韵部、声调和原始备注保持原文；英文界面只翻译操作与说明。
- 输入框在手机上使用 16px 字号，常用按钮至少 44px 高；窄屏下改为单栏布局。
- 读屏结果区使用 `aria-live`，遵循 `prefers-reduced-motion`。

## 文件

| 文件 | 用途 |
| --- | --- |
| `index.html` | 页面结构、主题与语言预置、帮助和来源 |
| `app.js` | 查询引擎、UMD 导出和页面交互 |
| `style.css` | Apple 风格明暗主题与响应式布局 |
| `data.js` | 原仓库数据，只读 |
| `verify.cjs` | 引擎回归断言，可在 Node 中运行 |

## 验证

```sh
node tools/pingshui/verify.cjs
```

脚本通过 `vm` 读取 `data.js`，不修改数据，断言查询语义、强制前缀、自动模式、别名、计数和超大数字等边界。它不启动服务器，也不访问网络。
