---
title: '引擎骨架＋回歸測試網（tracer）'
type: refactor
ticket: '1'
created: '2026-11-21'
status: built
baseline_revision: 'c7a1ab43b07ac7fc3df5c69decaa9e456051a288'
route: oneshot
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
context:
  - docs/game-design.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 遊戲規則邏輯全混在 `js/game.js`（約 1200 行），與 `tools/simulate.js` 重複一份，沒有分層也沒有測試網，難以安全地加玩法或重構。

**Approach:** 以 functional core / imperative shell 起步：新增 `js/engine.js`（雙匯出 `window.GameEngine` + `module.exports`），先把三段最末端的純邏輯從 `game.js` 搬入——`newState(D)`、`TITLE_CHECK`、`computeEnding(D, S, before)`——`game.js` 改為呼叫引擎；封號冊 `localStorage` 讀寫留在外殼。並把 headless 假 DOM harness 正式納入 repo（`tests/playthrough.test.js`，`node --test`）當回歸測試。遊戲行為必須完全不變。

</frozen-after-approval>

## Implementation Notes

走 oneshot：變更範圍小且邊界清楚（三個確定性函式＋接線＋把既有 harness 移入），並有確定性回歸網可即時驗證行為不變，故直接實作。

要點與不變量：
- `js/engine.js` 匯出 `newState(D)`、`TITLE_CHECK`、`computeEnding(D, S, before)`。皆為純函式、**不碰 DOM／localStorage／Math.random**。`computeEnding` 回傳 `{rank, top, opening, main, extra, book, fresh}`，`book`/`fresh` 由傳入的 `before` 算出，**不自己存檔**。
- `TITLE_CHECK` 吃整個 `S`（部分條件讀 `S.friend`，非只 `S.stats`）；`grounded` 在引擎內以 `S.day <= S.groundUntil` 內聯。
- 雙匯出樣板：`if (typeof module!=='undefined' && module.exports) module.exports = API;` 與 `if (typeof window!=='undefined') window.GameEngine = API;`。引擎不 import `data.js`——`D` 一律當參數傳入。
- `js/game.js`：刪除原 `newState`/`TITLE_CHECK`/`computeEnding` 內文，改 `const E = window.GameEngine;`；`newState` → `E.newState(D)`；`computeEnding(save)` 外殼化為：`const before = loadBook(); const r = E.computeEnding(D, S, before); if (save) saveBook(r.book); return r;`（保留 `BOOK_KEY`/`loadBook`，新增 `saveBook`）。
- `index.html`：於 `data.js` 之後、`audio.js` 之前插入 `<script src="js/engine.js"></script>`（順序 data→engine→audio→game）。
- `tests/playthrough.test.js`：由 scratchpad harness 移入改寫成 `node --test`；假 DOM 載入 `data.js`→`engine.js`→`game.js`（+GameAudio 空殼），跑 20 局自動玩，斷言每局皆達 `ending`、無 throw；另跑數次 `#結局` 斷言渲染。
- rand 注入本棒用不到（三函式皆確定性），但引擎結構已為後續（1.2 搬 `settleNight`）預留。

實作結果（append）：
- 新增 `js/engine.js`：`newState(D)`、`TITLE_CHECK`（改吃 `(S, D)`）、`computeEnding(D, S, before)`，雙匯出。
- `js/game.js`：加 `const E = window.GameEngine`；刪除三段內文；`newState()`→`E.newState(D)`（280、1184 兩處）；`computeEnding` 外殼化，新增 `saveBook`，保留 `BOOK_KEY`/`loadBook`。
- `index.html`：插入 `<script src="js/engine.js">`（data→engine→audio→game）。
- 新增 `tests/playthrough.test.js`（`node --test`）：20 局自動玩到結局、6 次 `#結局` 渲染、引擎純度/雙匯出。
- 驗證：`node --test tests/` 3/3 通過；差異測試 2 萬組隨機狀態 computeEnding 與 baseline **0 差異**；模擬器正常。

## Verification

**Commands:**
- `node --test tests/` -- expected: 全數通過（20/20 到結局、0 錯誤；#結局 渲染正常）
- `node -e "const D=require('./js/_dataload'); ..."`（若需）-- 比對重構前後 `computeEnding` 對同一 `S` 的輸出一致
- `git stash` 前後各跑一次 harness，確認行為一致

**Manual checks:**
- 瀏覽器開 `index.html`：標題→開始→玩一輪→結局顯示正常；`#結局` 可跳結局；console 無錯誤。

## Review Triage Log

quick lens（1 子代理）回報 3 項，皆針對回歸測試網（非引擎）：
- **medium → patch**：playthrough bot 不執行核心行動，覆蓋淺。處置：部分 patch（修 setTimeout 讓調合不會卡死）＋ defer 深層行動覆蓋到 story 1.2（見 deferred-work.md）。引擎抽離本身由 20k 組差異測試證明零回歸。
- **low → patch**：`setTimeout` stub 為 no-op，若未來 bot 點調合會使 `busy` 永久卡住。處置：改為同步執行，消除脆弱性。
- **low → patch**：第三個測試名為「不碰 localStorage」卻只驗確定性。處置：改為真的斷言引擎原始碼（去註解後）不含 localStorage/document/Math.random。
- 審查同時確認：引擎三函式搬移忠實、inlined grounded、`(S,D)` 簽章、回傳結構皆與重構前一致，無行為回歸。
