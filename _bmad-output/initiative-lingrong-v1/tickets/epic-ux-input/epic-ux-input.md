---
type: epic
title: "提升 UX：電腦鍵盤操作與介面手感"
parent: initiative-lingrong-v1
covers: ["R4"]
after: []
refined: false
risk: medium
---

# 提升 UX：電腦鍵盤操作與介面手感

## Description

讓電腦玩家能用鍵盤順暢操作——目前只能用滑鼠，桌機玩起來彆扭。既有動作都要有鍵盤對應與清楚的焦點指示，並改善整體操作手感。採集小遊戲（epic 2）帶出的新 UI 一併在此設計打磨。建議先由 UX 設計師 Sally（`bmad-ux`）跟使用者定出 `DESIGN.md`／`EXPERIENCE.md`，再實作；實作建在 epic 1 重構後的畫面/事件層上。

## Outcome

桌機玩家能用鍵盤流暢玩完一輪、不覺得彆扭；整體操作手感更俐落，手機直式體驗不退步。

## Boundaries

- 不改遊戲規則與數值（屬引擎/玩法）。
- 手機直式體驗必須維持可玩、不退步。
- 新玩法的核心互動邏輯屬 epic 2；本 epic 負責其呈現與輸入手感。

## Done when

- 既有動作皆可用鍵盤操作，且有可見焦點指示；桌機可純鍵盤玩完一輪。
- 操作手感改善項（含採集新 UI）落實，手機直式仍可玩。
- `index.html` meta「五天」等殘留文字一致（若未於 epic 1 修正）。

## References

- parent — _bmad-output/initiative-lingrong-v1/initiative-lingrong-v1.md, section Requirements (R4)
- design — docs/game-design.md §10 畫面
- 需 epic-engine-refactor 的畫面/事件層；就新 UI 與 epic-gather-minigame 協調
