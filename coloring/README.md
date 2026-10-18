# 顶点着色

给每个顶点填色，使每条边的两端颜色不同。每关提供恰好够用的颜色，任何合法方案都能通关。

从仓库根目录启动静态服务后访问 `/coloring/`，也可以直接打开 `index.html` 离线游玩。页面使用原生 JavaScript，基础界面样式引用 `../tronix/style.css`，需要保留仓库的相对目录结构。

## 操作

- 先选颜色，再点顶点；选“清除”后可擦除颜色。
- 选中或聚焦顶点后，突出显示它相连的边和邻居；虚线表示同色冲突。
- Tab 或方向键选点，数字键 1–5 给焦点顶点着色，Enter 使用当前颜色，Delete 清除。
- Z 撤销，R 重开。重开和撤销保留通关星星。
- 线条交叉处没有圆点就不相连。

十二个固定关逐步加入更复杂的约束，后段包含没有三角形却需要四种颜色的图，以及 23 个顶点的五色图。节点数、色数与搜索分支数是结构和计算指标；实际解题难度还取决于玩家采用的策略。

## 精确求解

`engine.js` 为 UMD 纯函数模块，浏览器中为 `ColoringEngine`，Node 中可通过 `require` 读取。图采用 `{n, edges: [[a,b],...]}`，颜色从 0 编号。

`findColoring(graph,q,options)` 使用 DSATUR 选点顺序与完整回溯，返回 `feasible`、`infeasible` 或 `unknown`。找到一个合法 k 色解，加上完整排除 k−1 色，确定图的色数为 k。确定性节点预算耗尽只返回 `unknown`。

`createSearch(graph,q,options).step(batchSize)` 支持分片搜索；未结束时返回 `searching`。`LEVELS` 保存固定图、布局、最少色数和合法解。`makeCandidate` 与 `generate` 负责确定性候选生成及验证。

每日题使用北京时间日期作种子。HTTP 环境优先用 `worker.js` 验证候选；Worker 不可用时，每次展开有限分支后让出主线程。两条路径使用同一候选种子序列和总节点预算，取消、重开或切关会丢弃过期结果。正常着色不运行搜索。

收藏保存在 `yaozi.coloring.progress.v1`，主题沿用 `yaozi.home.theme`。存储不可用时仍能游玩，并在本次打开期间保留收藏。

## 验证

从仓库根目录运行：

```sh
node coloring/verify.cjs
```

该脚本用独立集覆盖的子集动态规划，对不超过五个顶点的全部简单图交叉核对求解器；复核十二关的 k 色方案和 k−1 色不可行性、分片搜索、预算耗尽、随机生成和北京时间日期边界。

`ColoringGame.snapshot()` 返回当前状态的副本，`loadLevel(index)` 载入 0–11 号关卡，`ready()` 表示棋盘已就绪且没有生成任务。稳定 DOM 接口包括 `#node-N`、`[data-level]`、`[data-color]`、`#undo`、`#restart`、`#daily`、`#random`、`#cancel` 和 `#next`。
