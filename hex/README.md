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

- 入门：0-1 BFS 计算双方连接代价，从高分候选中加权选择。
- 策略：UCT 蒙特卡洛树搜索，模拟中加入双桥应对偏好。
- 高级：在树搜索上增加 RAVE/AMAF、双桥和边界偏好，以及同一局面的有限统计复用。

三档都会先检查立即获胜和对方一步获胜的落点。Medium 在玩家首着后，结合树搜索和开局位置先验评估是否接管红棋。双桥与关键候选用作启发式；分析面板中的胜率是 AI 当前棋色的搜索估计。提示、胜负和成绩跟随玩家身份计算，悔棋会恢复对应的交换状态。

## 验证与部署

```sh
node hex/verify.cjs
node hex/verify-opening.cjs
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
