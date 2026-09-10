# v2.3 性能采样

本报告对应 `tests/performance-v2.3.html` + `tests/performance-v2.3.js`。它通过真实浏览器的 Canvas 2D 和生产 `Game.update()` / `Game.render()` 进行可重复采样，不安装依赖、不访问网络。

## 重跑

```powershell
python -m http.server 8000
```

打开 `http://localhost:8000/tests/performance-v2.3.html`，等待页面显示“完成”，复制页面 JSON（或在控制台读取 `window.__PERF_V23_RESULTS__`）。每个场景先 warm-up 45 帧，再采样 240 帧。结果字段中的 `medianMs`、`p95Ms`、`maxMs` 和 `over16_7Pct` 分别是中位数、P95、最大值和超过 16.7ms 的样本比例。

四个场景为：普通战斗、密集弹幕、连锁爆炸、Boss 战。脚本同时尝试 `PerformanceObserver` 的 `longtask` 与 `gc` 条目，并在 API 不存在时写入 `supported: false`；`performance.memory`（若存在）仅作为非标准堆使用量近似值。

## 结果

2026-09-10 在本机 Codex In-app Browser（Chrome 152，1280x720，浏览器 DPR 2.2）完成一次基线（生成时间 `2026-09-10T08:39:27.884Z`），完整结构化结果由页面脚本生成（此处只摘录关键字段）：

| 场景 | 实际实体数（弹幕/敌机/粒子） | update median / p95 / max ms | render median / p95 / max ms | update 超 16.7ms | render 超 16.7ms | long task | GC 条目 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 普通战斗 | 27 / 30 / 22 | 0.0 / 0.2 / 0.5 | 0.1 / 0.4 / 4.5 | 0% | 0% | 0（支持） | 0 |
| 密集弹幕 | 414 / 50 / 100 | 0.2 / 0.6 / 0.9 | 0.6 / 6.1 / 16.9 | 0% | 0.417% | 0 | 0 |
| 连锁爆炸 | 190 / 11 / 100 | 0.1 / 0.2 / 0.5 | 0.2 / 4.1 / 5.1 | 0% | 0% | 0 | 0 |
| Boss 战 | 346 / 50 / 100 | 0.2 / 0.4 / 3.5 | 0.5 / 5.3 / 12.9 | 0% | 0% | 0 | 0 |

该次采样的 `performance.memory` 可用，但仅为非标准近似值：四场景堆差分别为 +0.47MiB、+2.17MiB、-1.42MiB、+0.09MiB，不能解释为 GC pause；本次没有收到 GC 或 long-task 条目。紧邻重跑的 max 会明显波动（此前密集弹幕 render 81.7ms、Boss render 71.5ms），说明 max 受浏览器调度影响较大，应优先观察 p95 和跨多次运行的一致性。结果不是跨设备结论；后续提交应在相同 harness 配置下重新生成完整 JSON。

## 测量边界与判读

- `Game.update` 与 `Game.render` 使用 `performance.now()` 包围，属于 wall time；它们包含被调用的同步子系统，但不是函数级 profiler 火焰图。
- `longtask` 是浏览器主线程长任务观察结果，回调异步交付，场景归属只能近似到当前采样场景。
- GC 只有浏览器公开 `gc` PerformanceObserver 条目时才报告；不支持时不能推出“没有 GC”。`performance.memory` 也不能替代 GC pause 或完整堆剖析。
- harness 使用固定实体数量和合成 badge canvas，目的是比较版本回归，不是覆盖所有设备、分辨率、浏览器或真实玩家输入。

## 后续优先级（P0 优先）

1. 若密集弹幕或连锁爆炸的 `updateScript.p95Ms` / `renderDraw.p95Ms` 超过 16.7ms，先保护固定步长上限、typed spatial grid 和单 volley 64 发上限；不要以放宽 catch-up 上限换取平均帧率。
2. 若 `renderDraw` 只有冷启动 max 峰值而 warm-up 后稳定，核对 badge/sprite 预热是否在战斗前完成，并检查 resize 是否错误地使缓存失效。
3. 若 `longTask` 只在 Boss/连锁场景出现，优先分批处理特效、链式查询和大规模 DOM/HUD 更新；保持模拟与表现层解耦。
4. 只有在 P0 指标稳定后，再处理低优先级的视觉细节或进一步降低绘制开销。任何优化都应在同一浏览器、viewport、实体数量和样本配置下重跑并比较 median/P95/max/超预算比例。
