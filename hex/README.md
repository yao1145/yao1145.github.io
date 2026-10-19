# HEX XII

连接属于自己的两条边界，先连通的一方获胜。红棋连接上下，蓝棋连接左右。

| 难度 | 玩家 | AI | 开局规则 |
| --- | --- | --- | --- |
| Easy · 入门 | 先手，红棋 | 后手，蓝棋 | 无交换 |
| Medium · 策略 | 先手，初始红棋 | 后手，可交换 | AI 可接管玩家首着，与玩家交换棋色和目标边界 |
| High · 高级 | 后手，蓝棋 | 先手，红棋 | 无交换 |

Medium 的交换占用 AI 这一回合，不额外放棋。首子保留原位，交换后玩家执蓝棋并立即落子，AI 改执红棋。AI 也可以不交换，直接落蓝棋。每回合只落一子。闯关和自由对局使用相同配置，已有通关记录保留。

十二关按 7×7、9×9、11×11、13×13 分为四组，每组都有入门、策略和高级 AI。战胜一关即可解锁下一关。自由对局支持 7～13 的所有整数尺寸，可使用悔棋、提示和局面分析。胜利是通关条件，落子数只作对局记录。

点击或轻触落子；方向键移动焦点，Enter 或空格确认。R 重开；自由对局中 Z 悔棋。手机可放大棋盘后滚动选择格子，也可使用浏览器捏合缩放。语言和主题沿用主页偏好，成绩保存在当前浏览器。

从静态 HTTP 服务打开 `hex/`，或直接打开 `index.html` 离线游玩。代码无需构建，无外部运行依赖；Worker 不可用时，AI 使用会定期让出主线程的异步搜索。快速性能模式可缩短思考预算。

## AI 与分析

- 三档均使用现成的 [MoHex 2.0 / Benzene](vendor/mohex/README.md) WebAssembly 引擎，沿用上游虚连接分析、劣势格分析、学习得到的棋形权重、UCT 与 RAVE。
- 实际落子前计算对手虚接的 must-play 防区，搜索在引擎给出的候选集合中进行。策略与高级档启用预搜索并使用更长的思考预算。
- 入门档限制为最多 192 次模拟，策略与高级档主要由现有的各关预算控制。所有难度保留原先的先后手和交换规则。

Medium 的接管决定来自 MoHex 自带的开局交换表。分析面板中的胜率来自 MoHex，界面的连接距离、双桥标记与提示仍用于解释局面。提示、胜负和成绩跟随玩家身份计算，悔棋会恢复对应的交换状态。引擎不可用时保留当前棋局并显示重试按钮。

首次 AI 回合按需加载约 8.1 MiB 本地资源；之后复用已加载的引擎。无服务端推理，也不依赖外部 CDN。上游对应源码、许可证、构建适配和重链接说明均随站点提供，详见 [引擎来源](vendor/mohex/README.md)。

## 验证与部署

```sh
node hex/verify.cjs
node hex/verify-opening.cjs
node hex/verify-defense.cjs
node hex/calibrate.cjs --games=16 --budget=40
```

规则检查包含独立连通性核验、完整棋盘无平局、7～13 棋盘、战术和存档恢复。校准对每组难度交换颜色并使用固定种子；`--budget` 是策略档的毫秒预算，高级档使用两倍预算。输出胜率、模拟速度、每步最大树深的均值和响应时间。

浏览器检查需要 Playwright 和本地静态服务：

```sh
HEX_TEST_URL=http://127.0.0.1:8000/hex/ node hex/verify-browser.cjs
HEX_TEST_URL=http://127.0.0.1:8000/hex/ node hex/verify-experience.cjs
HEX_TEST_URL=http://127.0.0.1:8000/hex/ node hex/verify-opening-browser.cjs
```

Windows PowerShell 可先设置 `$env:HEX_TEST_URL`。使用 `PLAYWRIGHT_MODULE` 指定 Playwright 包路径。体验检查需要该版本对应的 WebKit；`--webkit-only` 可单独运行 WebKit 部分。检查覆盖桌面和手机宽度、实际 Worker、过期结果、完整对局、离线与存储禁用场景。实测结果见 [验证记录](VALIDATION.md)。

GitHub Actions 的 Hex checks 在相关文件变更时运行规则验收。站点继续使用现有 GitHub Pages 发布方式，直接提供仓库根目录中的静态文件；资源和 Worker 使用相对路径，也可放在仓库子路径下。

## English

Connect your two opposite edges first to win. Red joins top to bottom; blue joins left to right.

- Easy: you play red first; the AI plays blue. No swap.
- Medium: you place the first red stone. The AI may take over red and give you blue. A swap uses the AI turn, adds no stone, and you move next. The opening stone stays in place.
- High: the AI plays red first; you play blue second. No swap.

Twelve campaign levels span four board sizes and three AI difficulties. A win opens the next level. Free play supports every size from 7×7 to 13×13, with undo, hints and optional analysis. Scores stay in your browser, and language and theme preferences are shared with the homepage.

Click or tap to place a stone. Arrow keys move focus; Enter or Space confirms. Press R to restart, or Z to undo in free play. Enlarge the board on small screens for precise taps. Open the page through a static server or directly from disk. All AI runs locally, with no build step or external service.

All tiers now use the existing MoHex 2.0 / Benzene engine, with upstream virtual connections, must-play defense, learned pattern weights, UCT and RAVE. Medium uses MoHex's swap table; tiers retain their opening rules and receive different search budgets. The first AI turn loads about 8.1 MiB of local engine resources. [Credits, LGPL notices, source and rebuild instructions](vendor/mohex/README.md) are included.
