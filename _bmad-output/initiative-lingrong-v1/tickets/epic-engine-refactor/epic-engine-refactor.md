---
type: epic
title: "代碼品質重構：抽出純引擎＋測試網"
parent: initiative-lingrong-v1
covers: ["R6"]
after: []
refined: false
risk: medium
---

# 代碼品質重構：抽出純引擎＋測試網

## Description

把目前集中在 `js/game.js`（約 1200 行）的遊戲邏輯，依「functional core / imperative shell」抽成一層不依賴 DOM 的純引擎（狀態、每日流程、夜晚結算、加料、翻牌子權重、結局/封號判定），外面保留 UI 外殼（渲染與事件）。行為完全不變，過程以 headless 回歸測試守住；為引擎補單元測試；並讓 `tools/simulate.js` 改用同一引擎，消除目前兩份規則重複的技術債。不採 hexagonal（對單人純前端小遊戲過度設計），不加後端或框架。

## Outcome

之後要加玩法、改畫面的人，面對的是一份有測試保護、邏輯與畫面分離的程式碼：規則只有一份、改動有回歸網接住。

## Boundaries

- 行為不變：玩法、數值、結局結果與現況一致（回歸測試為準）。
- 不加後端、不引入框架或重量級建置工具；不採 hexagonal。
- 不在本 epic 內加入新玩法或改 UX（屬 epic 2、3）。
- 順手項：`index.html` meta「五天」→「十天」可在此或 UX epic 收尾。

## Done when

- 純引擎（無 DOM 依賴）抽離完成，`game.js` 僅保留 UI 外殼。
- 引擎有單元測試；headless 回歸測試納入 repo 並通過。
- `tools/simulate.js` 改用同一引擎，規則不再重複。
- 一輪 10 天行為與重構前一致（回歸驗證）。

## References

- parent — _bmad-output/initiative-lingrong-v1/initiative-lingrong-v1.md, section Requirements (R6)
- design — docs/game-design.md（規則權威）
- 現有碼 — js/game.js, js/data.js, tools/simulate.js
