---
type: epic
title: "提升 UX：電腦鍵盤操作與介面手感"
parent: initiative-lingrong-v1
covers: ["R4"]
sources: []
companions:
  - _bmad-output/initiative-lingrong-v1/tickets/epic-ux-input/ux-ux-input/EXPERIENCE.md
  - _bmad-output/initiative-lingrong-v1/tickets/epic-ux-input/ux-ux-input/DESIGN.md
after: []
refined: true
risk: medium
---

# 提升 UX：電腦鍵盤操作與介面手感

## Description

讓電腦玩家能用鍵盤順暢操作——目前只能用滑鼠，桌機玩起來彆扭。既有動作都要有鍵盤對應與清楚的焦點指示，對話可加快，加料與被抓的演出更有份量。行為與外觀以 Sally 定稿的 `EXPERIENCE.md`／`DESIGN.md` 為準；實作建在 epic 1 重構後的畫面/事件層上。

## Outcome

桌機玩家能用鍵盤流暢玩完一輪、不覺得彆扭；整體操作手感更俐落，手機直式體驗不退步。

## Requirements

- R1 (parent R4; EXPERIENCE Component/State Patterns 游標、Information Architecture 預設表): 桌機按方向鍵叫出四角焦點框並照畫面方位移動，Enter 按下游標所在元素或該畫面預設；一用滑鼠／觸控就隱藏；彈出視窗開著時游標限在視窗內，金縷衣視窗 Esc 無效——可只用鍵盤玩完一輪。
- R2 (parent R4; EXPERIENCE 數字 1～6、Esc、M): 1–6 切到小舖／採集／調合／送禮／後宮／就寢，Esc 返回上一層或關視窗，M 開關聲音；對話中、彈出視窗開著、調合進行中、採集地下城中數字鍵無效。
- R3 (parent R4; EXPERIENCE 對話、對話速度、略過、防連按): 對話可在 2×／瞬間間切換（Shift 單按或倍速按鈕，不記住），Esc 或「略過 ≫」跳過整段；被抓、加料得手、「今晚黃上翻的是您的牌子！」三句整句顯示且 0.6 秒內按鍵無效。
- R4 (parent R4; EXPERIENCE Interaction Primitives 演出、DESIGN 狠章): 加料事件依輕／中／重呈現立繪動作與狠章停格，只有重事件在結果頁蓋章時晃一次畫面；系統「減少動態效果」時不晃；任何事件不閃色。
- R5 (parent R4; EXPERIENCE 演出「被抓」列、DESIGN 暗幕): 被抓時溫太醫從右側衝入、零溶後退、宣判句起畫面暗到 45%，章落下後暗到 62%，章、收據、按鈕不被壓暗。

## Constraints

- 手機觸控不退步：按鈕尺寸、點擊推進對話、略過按鈕照舊；新倍速按鈕與略過同款、至少 40px 高（EXPERIENCE Accessibility Floor）。
- 不改遊戲規則與數值；採集地下城的鍵盤操作維持現狀（EXPERIENCE Foundation）。

## Done when

- 桌機可純鍵盤玩完一輪，每個畫面焦點框可見、預設位置符合 EXPERIENCE 預設表。
- 快捷鍵、對話速度、略過、防連按照 EXPERIENCE 運作。
- 加料與被抓演出照分級表落實，使用者試玩確認手感。
- 手機直式照舊可玩（點擊操作、看不到焦點框）。
- 既有測試全過，部署到 GitHub Pages 後可玩。

## Boundaries

- 不改遊戲規則與數值（屬引擎/玩法）。
- 採集地下城的玩法與按鍵屬 epic 2，不在此改。
- 手機直式體驗必須維持可玩、不退步。

## References

- parent — _bmad-output/initiative-lingrong-v1/initiative-lingrong-v1.md, section Requirements (R4)
- design — _bmad-output/initiative-lingrong-v1/tickets/epic-ux-input/ux-ux-input/EXPERIENCE.md
- design — _bmad-output/initiative-lingrong-v1/tickets/epic-ux-input/ux-ux-input/DESIGN.md
- design — docs/game-design.md §10 畫面

## Notes

- Decision: 2026-11-22 需求直接取自定稿 UX 規格，不另訪談。
- Decision: 2026-11-22 原 Done when「index.html meta 五天」已是「十天」，刪除。
- Decision: 2026-11-22 第一個 story（tracer）＝游標與焦點框：最有風險（整頁重畫後游標要留在原動作），也直接解決桌機不能用鍵盤的痛點。
- Decision: 2026-11-22 演出拆成「加料演出」與「被抓演出」兩個 story，一次只試玩一種手感。
- Decision: 2026-11-22 收尾 story「整理程式碼」範圍擴及 epic 2 與 epic 3 的程式碼（使用者指定），只整理、不加功能。
- Decision: 2026-11-22 tracer 之後先做快捷鍵與對話（低風險、跟 tracer 共用鍵盤處理），演出放後面；使用者已同意此順序。檢查建議把演出提前，不採用。
- Decision: 2026-11-22 story 1 擁有共用鍵盤處理，story 2、3 掛在上面。
- Decision: 2026-11-22 所有 story 都改 `js/game.js`／`css/style.css`，依序做，不平行。
