# Task 3 fix round

- 修复 `completeCoreCardSelection()` / `selectCard()`：只接受当前打开的 `cardSelectionModel.options` 中的卡片，拒绝合法但未展示的卡片，并保持运行状态不变。
- 修复 `skipCardSelection()` / `completeCoreCardSelection(null)`：要求选择阶段打开且存在当前模型；仅在当前已打开模型明确表示全牌耗尽时允许保底跳过。
- 新增边界回归覆盖：遗漏选项卡片、关闭面板、缺少当前模型，以及耗尽模型的合法跳过。
- 测试：`node --experimental-default-type=module --test tests/cards.test.js tests/*.test.js`（23/23 通过，含 Task 2 builds）。
- 语法检查：全部 `js/**/*.js` 通过 `node --check`。
- 差异检查：`git diff --check` 通过。
- Fix commit：`fix: enforce active core card selection model`。
- 用户已有的 `.gitignore` 未修改。
