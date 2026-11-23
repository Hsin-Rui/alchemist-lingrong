---
title: '加料演出分輕中重（spike-fx）'
type: feature
ticket: '4'
created: '2026-11-22'
status: built
baseline_revision: '5973e55fdcf8b2ec4ad2238754cc33ca215ad06d'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: ['{project-root}/_bmad-output/initiative-lingrong-v1/tickets/epic-ux-input/ux-ux-input/EXPERIENCE.md', '{project-root}/_bmad-output/initiative-lingrong-v1/tickets/epic-ux-input/ux-ux-input/DESIGN.md', '{project-root}/_bmad-output/initiative-lingrong-v1/tickets/epic-ux-input/ux-ux-input/mockups/fx-demo.html']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** 加料得手時的演出平淡：所有紅章都一樣、每個紅章都晃，輕重分不出來。

**Approach:** 依 EXPERIENCE「Interaction Primitives — 演出」分級表與 DESIGN「狠章」，把加料事件分輕／中／重：對話中加立繪動作（受害者跳起來抖、零溶奸笑特寫、重事件旁白框「砰」），結果頁改蓋「狠章」（4 倍斜砸、0.9 倍停格、彈 1.07 倍回 1、14 顆墨點、墨圈擴到 1.6 倍）＋依等級停格，只有「重」在蓋章時晃一次。另做一個測試入口，直接觸發各事件的演出，story 5（被抓）沿用。

## Boundaries & Constraints

**Always:**
- 等級：輕＝出糗（狂癢、口臭、腹瀉；`outcome === 'debuff'`）紅章；中＝麝香 n/3（`musk_dose`）、麝香落空（`musk_miss`）紫章；重＝不孕（`musk_infertile`、`safflower_infertile`）、小產（`miscarry_musk`、`miscarry_safflower`）紅章。
- 停格：輕約 0.07 秒、中約 0.12 秒、重約 0.19 秒。結果頁受害者立繪：輕＝被震得往下一縮，中＝輕跳，重＝被震。
- 搖晃只在「重」事件結果頁蓋章時一次：振幅 15px、約 0.76 秒、逐漸衰減。對話中一律不搖晃。
- 系統「減少動態效果」（`prefers-reduced-motion: reduce`）時不搖晃，其他演出照常。
- 不閃色；不引進新色系（墨點、墨圈與章同色）。紫狠章字級 48px，其他狠章 72px。
- 收下、拒收、無效、麝香白下（`musk_useless`、`safflower_useless`）：照舊一般章、不搖晃。
- 狠章、停格等計時參考 `mockups/fx-demo.html`；規格表與示範頁衝突時以規格表為準（示範頁的輕／中搖晃選項不採用）。
- story 3 的防連按（`{ lock: true }` 第 4 元素）與倍速照常運作；對話行的第 4 元素可再帶演出標記。

**Never:**
- 不做被抓的演出（溫太醫衝入、零溶後退、暗幕）——屬 story 5；本 story 只需讓被抓維持現狀但移除「每個紅章都晃」（被抓的搖晃與暗幕由 story 5 加）。
- 不改遊戲規則、數值、台詞文字。
- 測試入口不得影響正常遊戲（沒加 hash 時不存在）。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 輕 | 腹瀉得手 | 對話：受害者跳抖、零溶奸笑句特寫；結果頁紅狠章、停格約 0.07s、立繪下縮、不晃 | — |
| 中 | 麝香 2/3 | 紫狠章（48px）、停格約 0.12s、立繪輕跳、不晃 | — |
| 中 | 麝香落空 | 同中（紫章） | — |
| 重 | 不孕／小產 | 旁白重擊句框「砰」；結果頁紅狠章、停格約 0.19s、晃一次 15px 約 0.76s | — |
| 減少動態 | 重事件＋reduce | 其他演出照常、不晃 | — |
| 一般 | 收下／拒收／無效 | 一般章，不晃 | — |
| 測試入口 | 網址 hash 指定事件 | 直接播該事件的對話＋結果頁 | 未知事件 → 回標題頁 |

</intent-contract>

## Code Map

- `js/game.js` `outcomeLines()`（約 106–125 行）-- 組加料結果對話；story 3 已用 `lockLine()` 加 `{ lock: true }`。在此依等級加上對話演出標記（第 4 元素物件可多帶欄位，如 `fx`）。`fmt()` 只回傳 3 元素，標記要在 fmt 之後加。
- `js/game.js` `startTyper()`／`dialogView()`（約 150–190、1300–1320 行）-- 每句渲染；依第 4 元素的演出標記在 `.dlg-portrait`／`.dialog-box` 加動畫 class。
- `js/game.js` `views.result()`（約 1180–1230 行）-- 結果頁：`stampCls`、`.stamp`、`.result-portrait`；`S.result` 有 `outcome`、`caught`、`useless`、`refused`、`label`、`who`。依等級加狠章 class 與停格／搖晃。
- `js/game.js` `render()` 結尾（`screen === 'result'` 時延遲播 `stamp` 音效，約 350ms）-- 演出計時要跟音效對齊。
- `js/game.js` 結尾 `#結局` 與 `#e2e` hash 處理 -- 測試入口照這個模式加（例如 `#演出` 顯示事件選單，或 `#演出=<outcome>` 直接播）。
- `js/engine.js` `deliver()`／`gift()` -- 產生 `S.result`；測試入口可直接組一個合法的 `S.result` 與對應對話，不必走引擎隨機。
- `css/style.css:275-288` -- `.stamp` 系列與 `.result:has(.stamp.red) { animation: screenshake }`（目前每個紅章都晃——要拿掉）；`@keyframes stamp`（360、372 兩份同名，後者生效）、`screenshake`（374）。
- `mockups/fx-demo.html` -- 狠章、墨點、墨圈、停格、立繪動作的參考實作（示範頁 `<style>` 與腳本）。
- `tools/keyboard-e2e.js` -- 真瀏覽器檢查（CDP）；可加演出斷言（class、computed style、計時）。
- `tests/playthrough.test.js` -- 假 DOM 回歸網，不可 throw（setTimeout 會立即執行、沒有 animate API）。

## Tasks & Acceptance

**Execution:**
- [x] `js/game.js` -- 事件等級對照（輕／中／重）；`outcomeLines()` 加對話演出標記；`startTyper()`／`dialogView()` 套用立繪與旁白框動畫；`views.result()` 依等級輸出狠章、停格、立繪動作、重事件搖晃（尊重 reduce motion）；加測試入口 hash。 -- 演出邏輯集中在外殼。
- [x] `css/style.css` -- 狠章（`.stamp.fierce`）、墨點、墨圈、立繪動作、旁白框砰、搖晃 keyframes；移除「每個紅章都晃」；`@media (prefers-reduced-motion: reduce)` 關掉搖晃。 -- 依 DESIGN。
- [x] `tools/keyboard-e2e.js` -- 以測試入口觸發腹瀉（輕）、麝香 2/3（中）、不孕（重）、收下（一般）：斷言章 class／字級、重事件才有搖晃、對話中不搖晃、reduce motion（CDP `Emulation.setEmulatedMedia` `prefers-reduced-motion`）時不晃、0 console 錯誤。 -- 覆蓋 I/O 矩陣。
- [x] `tests/playthrough.test.js` -- 照舊全過（必要時補假 DOM 能力）。

**Acceptance Criteria:**
- Given 測試入口，when 依序觸發腹瀉、麝香 2/3、不孕，then 三者章的大小與停格長短照分級表，只有不孕晃一次。
- Given 系統開啟減少動態效果，when 觸發不孕，then 不晃，其他演出照常。
- Given 收下、拒收、無效結果，when 結果頁出現，then 一般章、不晃。
- Given 正常遊玩（無 hash），when 玩一輪，then 沒有測試入口的任何痕跡、回歸網照舊通過。

## Implementation Notes

- 等級對照 `FX_TIER`／`fxTier()` 對話與結果頁共用；原 `SPIKE_HIT` 併入。對話標記由 `markFx()` 在 `lockLine()` 之後合併進第 4 元素（`fx`: victim／tremble／evil／slam）。重事件的受害者句（事發前、表情 happy）用較輕的 `tremble`，不跳。
- 結果頁狠章、停格、墨點、立繪動作用 Web Animations（`playResultFx()`），因為既有全域 `prefers-reduced-motion` CSS 規則會把 CSS 動畫壓成 0.01ms，而規格要求減少動態時只關搖晃。搖晃是 CSS `.result.fx-shake`（延遲 0.54s＝起砸 160＋砸 190＋停格 190），reduce 時 `animation: none`。時間軸：160ms 起砸、350ms 落到 0.9 倍＝對齊既有蓋章音效。
- 搖晃與演出只在結果頁第一次 render 播（`S.result.fxDone`），重繪（如按 M）不再晃。
- 測試入口 `#演出`（選單）／`#演出=<事件>`：走真的 `E.deliver`／`E.gift`，先擺對象狀態＋固定骰子；事件鍵：itch、stinky、croton、musk_dose、musk_miss、musk_infertile、safflower_infertile、miscarry_musk、miscarry_safflower、musk_useless、safflower_useless、plain、refused、caught；未知 → 標題頁。
- 假 DOM 補 `performance`、`window.addEventListener`；新增 `#演出` 回歸測試。

## Plan Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 1 findings — high 0, medium 0, low 1, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` `#演出=constructor` 等原型鏈名字讓測試入口 throw、頁面空白 — 改用 Object.hasOwn；playthrough 加斷言。

## Design Notes

等級表寫成一個 outcome → 等級的對照，對話與結果頁共用，避免兩處各自判斷。停格可用 Web Animations API 或 CSS 動畫的關鍵影格（在 0.9 倍處停住一段），參考示範頁的做法；假 DOM 沒有 `animate()`，呼叫前要檢查。

## Verification

**Commands:**
- `node --test tests/` -- expected: 全部通過。
- `node tools/simulate.js --quick` -- expected: 正常跑完。
- `node tools/keyboard-e2e.js` -- expected: 全部 PASS（含新的演出斷言）、0 console 錯誤。

**Manual checks (if no CLI):**
- `node tools/keyboard-e2e.js --shots <dir>` 或另截圖：狠章、墨點、紫章 48px 外觀正確。

## Auto Run Result

- 摘要：加料事件分輕／中／重：對話中立繪動作、結果頁狠章＋依等級停格，只有重事件晃一次（減少動態時不晃）；移除每個紅章都晃；新增 `#演出` 測試入口。
- 檔案：`js/game.js`（等級表、對話／結果頁演出、測試入口）、`css/style.css`（狠章、墨點、墨圈、搖晃、reduce motion）、`tests/playthrough.test.js`（演出測試）、`tools/keyboard-e2e.js`（約 40 條演出斷言）。
- 審查：1 patch（low），0 deferred，0 reject。Follow-up review：false。
- 驗證：node --test 69/69；simulate OK；keyboard-e2e 124/124；截圖確認輕／中／重外觀。
- 殘留風險：手感（時間長短、誇張程度）需使用者試玩確認（hitl）。
