---
title: '整理程式碼 epic 2＋3（cleanup）'
type: refactor
ticket: '6'
created: '2026-11-22'
status: built
baseline_revision: 'c34962df7593008176c2d221d00ef4bee874dc96'
route: full
route_source: auto
risk: low
review: quick
review_source: pinned
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Epic 2（採集地下城）與 Epic 3（鍵盤游標、快捷鍵、對話速度、演出）在短時間內連續加進 `js/game.js`，檔案已近 1900 行，有重複、過時註解與零散的常數；使用者要求把這兩個 epic 的程式碼整理一下。

**Approach:** 只整理、不改行為：清掉重複與死碼、統一命名與常數位置、更新過時註解，必要時把邊界清楚的區塊抽成獨立檔案（比照 `js/focusnav.js` 的做法）。每一步都用既有測試、模擬器與真瀏覽器 e2e 證明行為不變。

## Boundaries & Constraints

**Always:**
- 範圍：Epic 2 起（commit `33afa90` 之後）與 Epic 3 新增或改動的程式碼——`js/game.js` 的採集地下城外殼、鍵盤游標／快捷鍵／對話速度／演出區塊、`js/engine.js` 的採集函式、`js/pixelart.js`、`js/focusnav.js`、`css/style.css` 對應段落、`tools/gather-bot.js`、`tools/keyboard-e2e.js`、相關測試。
- 行為完全不變：畫面、時間、數值、按鍵、演出、文字都一樣。
- 抽檔只在邊界清楚（少量明確依賴、可用參數注入）時做；新檔要加進 `index.html` 與 `tests/playthrough.test.js` 的載入順序，並維持 GitHub Pages 工作流程只部署遊戲檔（`.github/workflows/pages.yml` 若用清單列檔要跟著加）。
- 註解維持繁體中文、說明「為什麼」。

**Never:**
- 不加功能、不修玩法、不調數值或演出時間。
- 不動 Epic 1 之前就存在、與這兩個 epic 無關的程式（除非是被這兩個 epic 改到的同一段）。
- 不刪測試或降低斷言；只能等價改寫。

</intent-contract>

## Code Map

- `js/game.js` -- 主要整理對象。區塊：採集地下城外殼（`enterGather`、`bindGatherRuntime`、`dungeonLoop`、繪圖、`fitDungeon` 等，約 300–760 行）；演出（`FX_TIER`、`markFx`、`playLineFx`、`playResultFx`、`inkSplash`、暗幕）；對話速度與防連按（`dlgSpeed`、`lockLine`、`startTyper`）；鍵盤（`syncCursor`、`moveCursor`、`HOTKEYS`、`escBack`、keydown／Shift 監聽）；`#演出`、`#e2e`、`#結局` 測試入口（檔尾）。
- `css/style.css` -- 已知有兩份同名 `@keyframes stamp`（約 360、372 行，後者生效）；焦點框、狠章、暗幕、地下城樣式。
- `js/engine.js` -- 採集地下城純函式（`buildGatherDungeon`、`gatherStep`、`gatherFov` 等）。
- `js/pixelart.js`、`js/focusnav.js` -- 已是獨立模組。
- `tools/keyboard-e2e.js`、`tools/gather-bot.js`、`tests/*.test.js` -- 驗證網；可整理重複的 helper，但斷言不得減少。
- `.github/workflows/pages.yml` -- 部署的檔案範圍。
- 各 story 計畫的 Review Triage Log（`_bmad-output/initiative-lingrong-v1/tickets/epic-ux-input/tickets/*-plan.md`、`…/epic-gather-minigame/tickets/*-plan.md`）-- 被 reject 或延後的小項，可參考但只做「整理」性質的。

## Tasks & Acceptance

**Execution:**
- [x] 盤點：列出重複程式、死碼、過時註解、散落常數、可抽出的區塊，寫進 Implementation Notes，標明做與不做的理由。
- [x] `css/style.css` -- 移除重複／失效的規則（例如被覆蓋的 `@keyframes stamp`），確認無視覺變化。
- [x] `js/game.js` 及相關檔 -- 依盤點逐項整理；若抽出模組，比照 `focusnav.js` 雙匯出並更新載入順序。
- [x] 驗證網 -- 等價整理；全部照舊通過。

**Acceptance Criteria:**
- Given 整理後的程式，when 跑 `node --test tests/`、`node tools/simulate.js --quick`、`node tools/gather-bot.js`、`node tools/keyboard-e2e.js`，then 全部通過，e2e 斷言數不少於整理前（157）。
- Given 整理前後，when 比較 `node tools/simulate.js --quick` 輸出，then 數值結果相同。
- Given 部署設定，when 檢查 Pages 工作流程，then 新增的遊戲檔（若有）會被部署、非遊戲檔不會。

## Implementation Notes

盤點（基準 c34962d；整理前基準輸出：69 tests、simulate／gather-bot 輸出存檔比對、e2e 157/157）。

**做了：**
- `css/style.css`：刪掉被覆蓋的第一份 `@keyframes stamp`（後者生效，無視覺變化）。另檢查：無其他同名 keyframes、無未使用的 keyframes，Epic 2／3 新增的 class 都有被 JS 用到。
- 抽檔 `js/dungeon-draw.js`（`window.DungeonDraw`，比照 focusnav.js 雙匯出）：像素圖集（`buildAtlas`／`spriteURL`／`itemSprite`）與逐幀繪圖 `drawDungeon` 原樣搬出。邊界清楚：輸入只有場景 `gs`、時間、`view`（圖塊組＋巡邏者 sprite 查詢，進場時放在 `gs.view`），唯一副作用是清掉播完的 `gs.fx`。`TILE`、`STEP_MS` 改由這個模組提供（外殼與繪圖共用同一份）。已加進 `index.html`、`tests/playthrough.test.js` 載入順序；Pages 工作流程整個複製 `js/`，不必改。
- `tools/pixel-preview.html` 原本自己複製了一份圖集繪製，改用 `DungeonDraw.buildAtlas()`。
- 方向表三份重複（engine `G_DIRS`、game `DG_DIRS`、gather-bot `DIRS`，內容與順序完全相同）→ engine 匯出 `GATHER_DIRS`，外殼撞牆提示與機器人共用。
- `js/game.js`：頂端常數分組（狀態變數 → 對話與演出常數 → 地下城常數），不再穿插在 `let` 之間；`MINIGAME.has` → `hasDungeon`；`textHtml` 收掉 startTyper 裡四份 `esc(…).replace(/\n/g,'<br>')`；`bumpText` 的圖塊名稱查詢收成 `nameOf`；被抓事件的 `guardOf` 只查一次；`HOTKEY_SCREENS` 由 `SUB_SCREENS` 組成；拿掉已不需要的 `typeof window.addEventListener` 防衛（假 DOM 已提供）。
- 過時註解：`dlg` 欄位說明補上 lockUntil／veilLine／veilAt；鍵盤處理器「之後的快捷鍵…」改寫成現況；`#演出` 的「story 5 沿用」拿掉；地下城外殼區塊說明指向 dungeon-draw.js；e2e 檔頭與各段 story 編號（2→3.2 等）。
- `tools/keyboard-e2e.js`：八處 `waitFor("…dataset.screen === 'x'", 2000)` 收成 `waitScr('x')`（等價，斷言數不變）。

**不做（理由）：**
- 把整個地下城外殼（輸入、補間、轉場）或演出邏輯（`markFx`／`fxTier`／結果頁演出）抽檔：都與 `gatherScene`／`dlg`／`S`／`render()` 等外殼可變狀態綁在一起，注入點太多，不符合「邊界清楚」。
- `tonightCard`／`statusShort` 兩份 debuff 名稱表、`#結局` 入口的 hash 解碼：Epic 1 之前的程式，不在範圍。
- e2e 頁內 `__t.items()` 複寫一份 navItems 規則：那是測試的獨立預言（oracle），刻意不共用。
- `engine.js` 開頭「暫與外殼各持一份，story 1.5 收斂」：Epic 1 的註解，不在範圍。
- 各 story 的 Review Triage Log：沒有被延後、屬於整理性質的項目。

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `node --test tests/` -- expected: 全部通過。
- `node tools/simulate.js --quick` -- expected: 與整理前輸出相同（先存一份基準輸出比對）。
- `node tools/gather-bot.js` -- expected: 正常跑完，結果與整理前相同。
- `node tools/keyboard-e2e.js` -- expected: 全部 PASS、≥157 條、0 console 錯誤。

**Results（整理後）：**
- `node --test tests/`：69/69 pass。
- `node tools/simulate.js --quick`：與整理前輸出逐字相同（diff 為空）。
- `node tools/gather-bot.js`：與整理前輸出逐字相同（diff 為空）。
- `node tools/keyboard-e2e.js`：157/157 PASS、0 console 錯誤；斷言名稱清單與整理前逐條相同。
- 另外：headless Chrome 進御花園地下城截圖確認畫面正常繪製（canvas 30 色、無例外）；`tools/pixel-preview.html` 86 個 sprite 全部畫出、無 console 錯誤。

### 2026-11-22 — Review pass
- verdicts: 3 findings — high 0, medium 1, low 2, false 0, maybe-false 0
- findings:
  - `[medium]` `[patch]` game.js 開機時解構 window.DungeonDraw，該檔沒載到（舊快取 index.html）整個遊戲無法啟動 — 改為有則用、無則用預設常數，enterGather 沒有繪圖模組時退回快速採集。
  - `[low]` `[patch]` 匯出的 GATHER_DIRS 與引擎內部共用同一物件、可被外部改動 — Object.freeze（含內層陣列）。
  - `[low]` `[patch]` dungeon-draw.js 檔頭說唯一接點是 drawDungeon 參數，與實際介面不符 — 改寫為完整對外介面。

## Auto Run Result

- 摘要：整理 Epic 2＋3 程式碼、行為不變：抽出 `js/dungeon-draw.js`（圖集與地下城繪圖），方向表統一由引擎匯出，常數歸位、重複程式合併、過時註解更新、刪除被覆蓋的 `@keyframes stamp`。
- 審查：3 patch（1 medium、2 low），0 deferred，0 reject。Follow-up review：false（只有 1 個 medium，且為直接防呆）。
- 驗證：node --test 69/69；simulate --quick 與 gather-bot 輸出與整理前相同；keyboard-e2e 157/157；pixel-preview 手動確認。
