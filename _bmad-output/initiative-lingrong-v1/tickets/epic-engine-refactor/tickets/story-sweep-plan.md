---
title: '收尾 sweep：外殼化稽核＋文案修正＋全套測試'
type: chore
ticket: '5'
created: '2026-11-21'
status: built
baseline_revision: '59cdfb14e0085b5c5be320472e4ee6aef6346529'
route: oneshot
route_source: auto
risk: low
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - docs/game-design.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** epic 的收尾：確認 `js/game.js` 外殼化完成（規則都在引擎），並修正 `index.html` meta 過時文案「五天」（遊戲實為 10 天，`R.days=10`）。

**Approach:** 稽核 `game.js` 確認無殘留遊戲規則（1.1-1.4 已全搬入引擎）；把 `index.html` 的 `<meta name="description">`「五天內逆襲後宮」改為「十天內逆襲後宮」；跑完整 `node --test` 與 `node tools/simulate.js` 確認全綠。僅清理與文案，不改任何行為、數值、玩法、結局。

</frozen-after-approval>

## Implementation Notes

走 oneshot：唯一的程式變更是 `index.html` 一行 meta 文案（`五天`→`十天`），其餘為稽核與測試執行，風險極低。

稽核結果（append）：
- `js/game.js` 的核心遊戲規則（狀態、每日流程、夜結算、加料、翻牌子、各行動、結局/封號）都已在 `js/engine.js`；shell 僅餘：渲染/事件/對話(`renderStartLines`/`renderNightLines`/`outcomeLines`)/音效/路由(`endDay`/`finishAction`/`nextDay`/`sleepEarly`)，以及封號冊 `localStorage` 持久化邊界(`computeEnding` 外殼＋`loadBook`/`saveBook`)。
- **修正（review 後）**：外殼化非 100% 字面——少數「前置條件守衛」仍留在呼叫端（符合 functional-core/imperative-shell：core 假設輸入合法、shell 負責驗證＋UI 回饋）：(a) 禁足「不能出門」由 `game.js` `needOut()`（toast）與 `simulate.js` `grounded()` 把關，引擎 `gather`/`deliver`/`gift` 不自檢；(b) 調合材料充足由 `recipeOk`＋按鈕禁用把關，引擎 `craft` 不自檢。(a) 的禁足判斷在兩個外殼各有一份，屬 R4「規則只有一份」的小缺口 → 已 defer（見 deferred-work.md），本棒不擴大範圍動它。
- `rand` 僅定義一次並注入 `E.*`；`endDay` 的 sing-modal 判斷與 `sleepyes` 的 `S.slot=R.slotsPerDay` 屬 UI 路由（非規則），保留。
- `#結局` debug 區塊（lines ~922-924）用 `Math.random` 隨機化 favor/friend 以預覽結局，屬 dev 工具路徑，非正式邏輯，保留。
- 確認全專案靜態「五天」文案只有 `index.html` meta description 一處。

## Verification

**Commands:**
- `grep -rnE '五天' index.html js/ tools/` -- expected: 無（文案已修正）
- `node --test tests/` -- expected: 全數通過（回歸 playthrough + engine 單元測試，29/29）
- `node tools/simulate.js 300` -- expected: 正常跑完，四 bot 數字與設計 §9 相符
- `node -c js/game.js && node -c js/engine.js && node -c tools/simulate.js` -- expected: 語法通過

**Manual checks:**
- 瀏覽器開 `index.html`：分享/SEO 的 description 顯示「十天」；遊戲實玩一輪一切正常。

## Review Triage Log

### Pass 1 — quick lens（1 子代理）

verdict counts: high 0 / medium 0 / low 2 / false 1 / maybe-false 0。一次程式變更（meta 文案）本身零 findings；三項皆針對本棒 Implementation Notes 的「外殼化已完成」稽核claim。

- **false（reject）** — 引擎 `craft` 不檢查材料充足：refutation：所有呼叫端皆先把關（`game.js` `recipeOk`＋按鈕禁用；`simulate.js` bot 守衛），不會以缺料呼叫 → 屬「對未達狀態 loud-fail＝正確」，非可達缺陷。此為 core/shell 既定模式（core 假設輸入合法）。
- **low → defer** — 禁足「不能出門」規則只在外殼把關且**兩個外殼各一份**（`game.js` `needOut()`＋`simulate.js` `grounded()`），引擎 `gather`/`deliver`/`gift` 不自檢。真實但屬 pre-existing（1.1-1.3 的邊界決策，非本文案棒引入），行為正確；為 R4「規則一份」的小缺口。修法（引擎動作回傳 grounded 拒絕、兩殼各自轉譯）超過 trivial 修正且逾本低風險 sweep 範圍 → defer。
- **low → defer（同根因）** — `S.day <= S.groundUntil` 謂詞散見 `game.js`、`simulate.js` 與引擎內 4 處內聯，而非單一引擎 helper。與上一項同根（grounded 歸屬未收斂）→ 併入同一 defer。
- 已更正 Implementation Notes 的 claim 用語（外殼化非 100% 字面；少數前置條件守衛留在呼叫端）。tests/sim 的 29/29 與 §9 數字 lens 未跑，由本 session 自行驗證通過。
