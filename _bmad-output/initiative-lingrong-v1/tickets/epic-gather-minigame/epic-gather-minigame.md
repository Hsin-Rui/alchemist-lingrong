---
type: epic
title: "新玩法：採集互動小遊戲"
parent: initiative-lingrong-v1
covers: ["R3"]
after: []
refined: false
risk: high
---

# 新玩法：採集互動小遊戲

## Description

把目前「單鍵採集」升級成一個可互動的小遊戲：玩家進到採集地點（御花園、太醫院等）的畫面，實際與場景中的物件互動來取得素材，而不是按一下就拿到。建在 epic 1 抽出的純引擎上、有測試保護，且不破壞既有一輪 10 天的流程與時辰規則。概念仍開放（小遊戲形式未定），本 epic 先做一小段 shaping 把玩法定出來再切 story。

## Outcome

玩家覺得「採集」本身好玩、有參與感，而不只是流程中的一個按鈕。

## Boundaries

- 不改動採集以外的核心循環（翻牌子、送禮、交貨、結算、結局）。
- 新玩法仍受既有時辰/禁足規則約束。
- 採集小遊戲自己的新 UI 由本 epic 負責產出；跨畫面的鍵盤操作與整體手感屬 epic 3，兩者就新 UI 協調。
- 形式待 shaping 決定（例如：場景點擊探索／採集節點／小挑戰）。

## Done when

- 採集改為可互動小遊戲並可玩，素材取得正確進入既有庫存/配方流程。
- 以引擎單元測試與 headless 回歸測試守住既有流程不破壞。
- 一輪 10 天仍可完整玩到結局。

## References

- parent — _bmad-output/initiative-lingrong-v1/initiative-lingrong-v1.md, section Requirements (R3)
- design — docs/game-design.md §8 素材與配方、§12 點子庫
- 需 epic-engine-refactor 的純引擎與回歸測試網
