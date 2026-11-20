---
tracker_id: ""
type: initiative
title: "煉金術士零溶——原型打磨成可分享的 v1"
parent:
sources:
  - docs/game-design.md
companions:
  - docs/game-design.md
after: []
risk: medium
---

# 煉金術士零溶——原型打磨成可分享的 v1

## Description

《煉金術士零溶——逆襲a零溶》已有一個能跑的網頁原型（`index.html` + `js/game.js`、`js/data.js`、`js/audio.js`，設計見 `docs/game-design.md` v0.4）。這條 initiative 不重寫原型，而是把它當既有程式庫，沿三個方向打磨成一個可以安心丟連結給朋友玩的 v1：把現有流程修順、調好手感與數值；把內容補齊到設計並選入少量新玩法；把畫面、轉場與音樂整合成一致的宮廷質感。完成的判準寫在下方 `Done when`，玩法細節一律以 `docs/game-design.md` 為準（原樣採用、不在此複製）。

## Outcome

安陵容…不，是作者，能把一個連結分享給朋友，朋友在手機上就能順順玩完一輪 10 天、看到聖旨封號結局，且玩起來不卡、好看、有梗。

## Requirements

1. **玩得完、不出錯** (R1)
   **Given** 依 `docs/game-design.md` v0.4 設計的一輪 10 天
   **When** 玩家從開局玩到第 10 天夜晚結算
   **Then** 全程無卡死、無 console 錯誤、無法進行的死局，且數值與節奏手感經過調校

2. **內容對齊設計** (R2)
   **Given** v0.4 設計的訂單、素材配方、加料、翻牌子、枕邊風、聖旨封號結局
   **When** 比對原型與設計文件
   **Then** 設計到但尚未實作的部分補齊，行為與設計一致

3. **選入的新玩法** (R3)
   **Given** `docs/game-design.md` §12 點子庫中使用者選入本輪的項目
   **When** 加入遊戲
   **Then** 新內容可運作，且不破壞既有流程

4. **一致的呈現質感** (R4)
   **Given** 手機直式優先的網頁
   **When** 玩家操作各畫面與轉場
   **Then** UI、立繪/背景整合、音效與背景音樂呈現一致的宮廷卷軸質感

5. **可分享上線** (R5)
   **Given** 純前端靜態網站
   **When** 部署到如 GitHub Pages
   **Then** 朋友用一個連結即可直接遊玩

6. **可維護、可測試的引擎** (R6)
   **Given** 目前規則邏輯集中在 `game.js`、並與 `tools/simulate.js` 重複一份
   **When** 把不依賴 DOM 的純遊戲邏輯抽成獨立引擎、為其寫單元測試、並讓模擬器改用同一引擎
   **Then** 引擎行為與現況一致（回歸測試通過），規則只有一份，新玩法可在有測試保護下加入

## Constraints

- 純 HTML/CSS/JS，無後端、不做存檔（design-doc §11）。
- 手機直式優先，電腦也能玩（design-doc §1）。
- 遊戲畫面不出現英文；台語用字「a」（零溶a、逆襲a）保留（design-doc §9）。

## Done when

- 一輪 10 天能從開局玩到聖旨結局，無卡死與 console 錯誤（R1；已以 headless harness 20/20 驗證）。
- 原型內容與 `docs/game-design.md` v0.4 一致（R2；稽核確認已滿足）。
- 本輪選入的 §12 新玩法已加入並可運作（R3）。
- 各畫面、轉場、立繪/背景與音樂呈現一致質感，手機直式可玩（R4）。
- 已部署為可分享連結的靜態網站（R5）。
- 純遊戲引擎抽離完成、單元測試與回歸測試通過、模擬器併用同一引擎（R6）。

## Boundaries

- 重構是刻意的、行為不變的引擎抽離（functional core / imperative shell）；不加後端、不引入框架或重量級建置工具，不採 hexagonal（過度設計）。
- 本輪不做：存檔/後端、帳號、排行榜後台（封號冊仍只存本機瀏覽器）。
- §12 點子庫中未選入本輪的項目留待之後；本輪新玩法聚焦「採集互動小遊戲」。
- 一句話貫穿路徑（tracer）：先重構出純引擎＋測試網 → 在其上開發採集互動小遊戲 → 打磨 UX（鍵盤操作＋新 UI） → 部署分享。

## References

- design — docs/game-design.md（v0.4 全文，玩法與數值的權威來源）
- 原型程式 — index.html、js/game.js、js/data.js、js/audio.js

## Notes

- Decision (2026-11-21): 稽核＋headless harness 實測顯示 v0.4 設計已全數實作、20/20 玩到結局無錯誤；R2 視為已滿足，原「打磨/補齊內容」導向取消。
- Decision (2026-11-21): 本輪重心＝三個 epic：代碼品質重構（引擎＋測試）→ 採集互動小遊戲 → UX（鍵盤＋新 UI）。
- Decision (2026-11-21): 架構採 functional core / imperative shell，不採 hexagonal；單元測試針對抽出的純引擎，模擬器併用同一引擎。
- Assumption: 一輪以 10 天為準（v0.4 設計），`index.html` 的 meta 寫「五天」為舊描述，列入重構/UX 收尾順手修正。
