# HEX XII 验证记录

## 2026-10-20：手机端 AI 启动修复

旧版在首次引擎下载延迟 34 秒时，约 39.1 秒后报告不可用，棋盘仍为 0 子：后台的 30 秒总超时打断下载，主线程回退又在 9 秒后超时。原有 13×13 高级开局的 WebAssembly 线性内存增长至 318.625 MiB。测试复现了超时路径；用户手机上的实际进程内存和网络未直接测量。

修复将下载、初始化、虚连接分析和搜索分别计时，显示加载阶段，并为引擎资源增加一致版本号。棋形包去重后从 6,440,795 字节降至 3,275,375 字节，八份原始文件逐字节一致。原生模式表按实际容量分配，关闭子树复用的浏览器调用直接清空并复用 4,096 项知识缓存，搜索节点和防守算法保持原配置。

- `node hex/verify.cjs`：18,045 项通过；`node hex/verify-opening.cjs`：218 项通过。
- `node hex/verify-defense.cjs`：1,496 项通过，包含 48 组独立穷举核验战术、32 组大棋盘虚接防守及关键双桥补救。
- `node hex/verify-memory.cjs`：13×13 连续 40 手真实 MoHex 搜索通过，WebAssembly 线性内存峰值 160.125 MiB；八份原始棋形文本核验一致。
- `node hex/verify-mobile-ai.cjs --slow-network`：WebKit、Edge 的 390px 触摸环境通过。首次引擎下载延迟 34 秒，约 41～43 秒完成高级首手，继续落子后 AI 正常应答；峰值 180.1875 MiB。
- `node hex/verify-mobile-ai.cjs --slow-network --no-worker`：WebKit、Edge 均通过。首次下载延迟 12 秒，主线程异步回退正常完成高级首手及后续应答，峰值 160.125～180.1875 MiB。
- `node hex/verify-experience.cjs`：110 项通过，覆盖启动取消、静默 Worker 超时回退、重复加载进度不能延长死锁期限、错误保留棋局与重试。
- `node hex/verify-browser.cjs`：35 项通过，包含真实对局、离线资源加载及手机宽度。

上述内存数值为 WebAssembly 线性内存容量，不是浏览器进程总内存。手机测试使用桌面 WebKit/Edge 的视口与触摸模拟，没有真实 iPhone/iPad 测量。

## 2026-10-19：MoHex 2.0 接入

2026-10-19，Windows 桌面环境。此次将自写 AI 替换为现成 MoHex 2.0 / Benzene WebAssembly 引擎。

## 本次已完成的验证

- `node hex/verify.cjs`：18,045 项通过，覆盖规则、独立连通性比对、存档、合法落子、真实引擎身份、即时战术及取消。
- `node hex/verify-opening.cjs`：218 项通过，覆盖 7～13 尺寸的三档开局、交换、不交换及撤销身份恢复。
- `node hex/verify-defense.cjs`：1,496 项通过。包括 48 组完整穷举核验的 3×3 非一步连接战术，以及 32 组 7、9、11、13 棋盘上的虚接防守；还覆盖关键双桥补救、边界双桥和运行中取消。
- `node hex/verify-opening-browser.cjs`：100 项 Edge/WebKit 检查通过。
- `node hex/verify-experience.cjs`：107 项通过，其中 Edge 99 项、WebKit 8 项。
- `node hex/verify-browser.cjs`：35 项通过。

浏览器检查覆盖实际 MoHex Worker、交换后的棋色和连接目标、蓝棋玩家获胜、红棋 AI 获胜、完整自由对局、十二关解锁与存档、撤销、重开和切关取消、无 Worker 时的异步回退、引擎失败后保留棋局并重试，以及直接打开文件离线游玩。

布局覆盖 320、375、390、430、768、1280px 与手机横屏。WebKit 为浏览器引擎模拟；此次没有真实 iPhone/iPad 测试。

## 引擎接入范围

三档均调用原有 MoHex 的虚连接分析、must-play 防守区、学习棋形权重、UCT 和 RAVE。Medium 使用上游交换表；Easy 玩家红棋先手无交换，Medium 玩家先手、AI 可接管首着，High AI 红棋先手无交换。已有通关记录保留。

适配层负责尺寸、棋色、预算、取消和数据加载。浏览器构建的少量修改包括内存配置、异步调度、短预算回退保持在引擎候选区，以及修复上游 ICE 禁用分支缺少返回值。准确源码、补丁、许可证和重链接说明见 `vendor/mohex/README.md`。

这些测试验证具体战术和集成功能，不是棋力等级或 Elo 测量。旧版 AI 的历史胜率不适用于当前引擎。按用户要求，完成上述验证后停止追加检查。
