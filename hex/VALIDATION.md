# HEX XII 验证记录

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
