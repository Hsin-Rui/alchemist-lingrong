---
title: '游標與焦點框（focus-cursor）'
type: feature
ticket: '1'
created: '2026-11-22'
status: built
baseline_revision: '9842213f3c2b12f2d4f02b0d1160fdaef737be46'
route: full
route_source: auto
risk: high
review: quick
review_source: pinned
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: true
context: ['{project-root}/_bmad-output/initiative-lingrong-v1/tickets/epic-ux-input/ux-ux-input/EXPERIENCE.md', '{project-root}/_bmad-output/initiative-lingrong-v1/tickets/epic-ux-input/ux-ux-input/DESIGN.md']
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** 桌機只能用滑鼠玩；沒有任何鍵盤游標或焦點指示。

**Approach:** 新增一個共用的鍵盤處理與「空間游標」：方向鍵叫出並移動四角焦點框，Enter 按下游標所在元素（游標沒出現時按畫面預設），Space／Enter 推進對話。純幾何挑選邏輯放在新的 DOM-free 模組以便單元測試，DOM 接線留在 `js/game.js`。之後的 story（快捷鍵、Esc、對話速度）都掛在這個鍵盤處理上。

## Boundaries & Constraints

**Always:**
- 預設位置照 EXPERIENCE「Information Architecture」表（金縷衣視窗預設＝唱，`data-a="sing" data-v="1"`）；會花時辰的按鈕不當預設（表上已排除）。
- 方向鍵照畫面方位找最近可按元素；到邊緣不繞回；停用按鈕跳過；重繪後若同一動作（同 `data-a`＋`data-v`）仍在就留在它上面，否則回預設。
- 焦點框：四個 L 形角，臂長 10px、粗 3px、往外 5px；淺色面 `--crimson`，深色面（底部導覽列、`.theme-dark` 調合、`.night`、結局、對話旁白框）琥珀 `#F4C66A`；元素本身大小顏色位置都不變；直角不圓。
- 只在按過方向鍵後出現；任何 pointerdown（滑鼠／觸控）就隱藏；再按方向鍵從「目前畫面預設」重新出現（第一下只顯示、不移動）。
- 彈出視窗（`.sheet-layer`，含 modal 與採集結果單）開著時游標只在視窗內。
- `busy` 為真、或採集地下城 overlay 開著（`gatherScene`）時，本處理器不動作——地下城沿用自己的按鍵。
- 有 Ctrl/Meta/Alt 修飾鍵時不攔截。Tab 不攔截。

**Never:**
- 不做數字鍵、Esc、M、Shift、對話倍速、防連按（屬 story 2、3）。本 story 不綁 Esc，因此金縷衣視窗 Esc 自然無效；story 2 要維持這點。
- 不改遊戲規則數值、不改手機觸控行為與按鈕尺寸。
- 不用瀏覽器原生 focus 外框當指示，也不在按鈕本身加放大／改色。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 首次方向鍵 | 主畫面、游標隱藏、有訂單 | 框出現在第一張訂單卡主要按鈕，不移動 | — |
| 無訂單 | 主畫面、`S.orders` 空 | 預設＝導覽列「採集」 | — |
| 往下移 | 游標在訂單按鈕，按 ↓ | 移到下方最近可按元素 | 下方沒有 → 不動 |
| 停用按鈕 | 小舖買不起的商品 | 被跳過；預設＝第一個買得起的 | 全買不起 → 第一個可按元素 |
| Enter 無游標 | 標題頁、未按方向鍵 | 按下「開始遊戲」 | 畫面無預設 → 無動作 |
| 對話中 | `dlg` 開著，按 Space／Enter | 推進對話（同點擊） | 方向鍵無效 |
| 彈窗 | 就寢確認開著 | 游標只在視窗內，預設「就寢」 | — |
| 重繪 | 調合放入素材後重繪 | 若同一素材按鈕仍在則留著，否則回預設 | — |
| 滑鼠 | 游標顯示中點一下 | 框隱藏 | — |
| 地下城 | 採集地下城中按方向鍵 | 只有地下城走路 | — |

</intent-contract>

## Code Map

- `js/game.js:9-19` -- 外殼狀態（`screen`、`dlg`、`modal`、`busy`、`gatherScene`、`gatherResult`、`craftResult`）。在此加游標狀態（是否顯示、目前動作 key）。
- `js/game.js:120-135` -- `advanceDialog()`：Space／Enter 在對話中呼叫它。
- `js/game.js:199-216` -- `endDay()` 的金縷衣 modal（`lock: true`；按鈕 `sing` v=0／v=1）。
- `js/game.js:783-805` -- `sleepEarly()`、`spikeInfo()` modal。
- `js/game.js:947-1262` -- `views`：title／home／shop／gather（含 `gatherResult` 結果單 `.sheet-layer`）／craft（`.theme-dark`；含 `craftResult` 完成單）／gift／result／status／night／ending。在各預設按鈕加 `data-def` 標記（每畫面至多一個實際存在）。
- `js/game.js:848-930` -- `topBar`、`subHeader`（返回按鈕）、`tonightCard`、`orderCard`（第一張的主要按鈕＝主畫面預設）。
- `js/game.js:1267-1283` -- `dialogView()`（`.dialog-layer data-a="adv"`）、`modalView()`（`.sheet-layer` 內 `.sheet`）。
- `js/game.js:1315-1330` -- `render()`：每次整頁 `innerHTML` 重繪；重繪後要重新定位焦點框。
- `js/game.js:1334-1393` -- `#app` 的點擊委派；Enter 用 `el.click()` 觸發同一路徑。
- `js/game.js:420-465` -- 地下城自己的 `keydown`（`bindGatherRuntime`/`stopGatherRuntime`）；不要動。
- `css/style.css:1-60` -- `:root` 色票（`--crimson` 等）、`.theme-light/.theme-dark`；`.bottomnav`（171）、`.night`（316）、`.dialog-box.narr`（295）。
- `index.html:15-19` -- script 載入順序；新模組放在 `game.js` 之前。
- `tests/playthrough.test.js` -- 假 DOM 回歸網（`makeNode` 無 `getBoundingClientRect`）；新程式不可讓它 throw。

## Tasks & Acceptance

**Execution:**
- [x] `js/focusnav.js` -- 新增 DOM-free 純函式模組（同 engine.js 的雙匯出：`module.exports` 與 `window.FocusNav`）：`pick(fromRect, candidates, dir)` 回傳方向上最近的候選（只看中心落在該方向半平面者，主軸距離＋偏軸距離加權，無候選回 null）；可另放決定「保留／回預設」的小函式 -- 可單元測試的幾何核心。
- [x] `tests/focusnav.test.js` -- 測 I/O 矩陣的幾何情境：四方向、偏軸較近者勝、邊緣回 null（不繞回）、空候選。
- [x] `js/game.js` -- 單一 document `keydown` 處理器（之後 story 掛上去）：地下城／busy／修飾鍵時略過；對話中 Space／Enter → `advanceDialog()`；方向鍵 → 顯示或移動；Enter → 點游標元素或 `[data-def]`。範圍＝最上層 `.sheet-layer`，否則 `.screen`；候選＝範圍內可見、未停用的 `[data-a]`（排除 `adv`、`noop`）。pointerdown 隱藏。`render()`、scroll、resize 後重新定位；移動時 `scrollIntoView({block:'nearest'})`。在各 view 的預設按鈕加 `data-def`。
- [x] `css/style.css` -- 焦點框樣式（固定定位的覆蓋層＋四個角），淺／深色兩種顏色，`pointer-events:none`。
- [x] `index.html` -- 在 `game.js` 前載入 `js/focusnav.js`。
- [x] `tools/keyboard-e2e.js` -- 新增真瀏覽器檢查腳本：起本機靜態 server、以 headless Chrome（`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --headless=new --remote-debugging-port=…`）開遊戲，用 Node 內建 `WebSocket` 走 CDP 送 `Input.dispatchKeyEvent`／滑鼠事件，逐條斷言 I/O 矩陣每一列（讀焦點框是否顯示、框住哪個 `data-a/data-v`、目前 screen），並純鍵盤玩完一輪到結局、收集 console 錯誤；全部通過 exit 0。可用 `location.hash` 或注入腳本調整狀態（例如清空訂單、讓小舖買不起）來造情境。 -- 矩陣中的 DOM 行為無法在假 DOM 測，需真瀏覽器覆蓋。
- [x] `tests/playthrough.test.js` -- 若需要，讓假 DOM 載入新模組；回歸網照舊全過。

**Acceptance Criteria:**
- Given 桌機 Chrome 開遊戲，when 只用方向鍵、Enter、Space 操作，then 能從標題玩到結局（含採集地下城用其既有按鍵、金縷衣視窗用 ←→ 選）。
- Given 任一畫面首次按方向鍵，when 框出現，then 位置符合 EXPERIENCE 預設表。
- Given 游標顯示中，when 點一下滑鼠，then 框消失；再按方向鍵框從該畫面預設重現。
- Given 手機寬度並以觸控操作，when 玩一輪，then 從頭到尾看不到焦點框，點擊行為照舊。
- Given 焦點框落在底部導覽列或調合畫面，when 顯示，then 框為琥珀色；卷軸紙、卡片與調合的米色素材抽屜上為朱紅（依 DESIGN「淺色面朱紅」）。

## Implementation Notes

- 預設的退路（表上沒寫到的情況）：主畫面第一張訂單主要按鈕停用時（材料不齊、禁足不能送）→ 導覽列「採集」；調合鍋已放滿兩樣（沒有可用素材）→ 目前選定的料列（預設「不加料」）；送禮沒有可按的「送出」→ 選定（或第一位）娘娘卡；其餘畫面沒有 `data-def` 時方向鍵從範圍內第一個可按元素出現、Enter 無動作。
- 「同一畫面」才保留游標：以 `screen`＋`.sheet-layer` 數量當簽名，換畫面、彈出／收起視窗、或中間夾了對話就回預設。否則從採集地點按 Enter、回來時結果單的「再去採一次」（同為 `enter|garden`）會被當成同一動作留住——那是會花時辰的按鈕。
- 幾何：`.scroll` 當作完全展開來算（捲軸內加 `scrollTop`、捲軸下方固定列再往下推剩餘高度），否則捲軸外的訂單卡會被底下的料列／導覽列搶走而到不了；`pick` 另排除「偏軸不重疊且主軸重疊」的候選，避免導覽列最右按 → 跳到右上角音樂鍵。重繪與叫出時 `scrollIntoView({block:'nearest'})`，捲動事件本身只重新定位、不捲。
- 深色面清單多加了 `.title-screen` 與 `.dark-sheet`（標題頁是深色背景圖）。依 AC，調合畫面一律琥珀——包含米色的素材抽屜（`.drawer`），那裡琥珀對比偏低，若要改朱紅需改 AC。
- `#e2e` 網址 hash 會在 `window.__e2e` 開放 `state/screen/render/go/openCraft` 給 `tools/keyboard-e2e.js` 造情境；不帶 hash 時不存在。
- Enter／Space 的自動連發（`e.repeat`）一律忽略；方向鍵允許連發。

- (main session) 調合畫面的米色素材抽屜屬淺色面，改用朱紅（LIGHT_INSET='.drawer'），AC 依 DESIGN 措辭修正；e2e 改為抽屜朱紅＋工房琥珀兩條斷言，50/50 PASS。

## Plan Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 5 findings — high 0, medium 2, low 2, false 0, maybe-false 0, rejected-plan-edit 1
- findings:
  - `[medium]` `[patch]` 焦點框在朱紅頂列／子標題列（靜音、返回鈕，後宮榜預設）上看不見 — DARK_SURFACE 加入 `.topbar, .subhead`，改琥珀。
  - `[medium]` `[patch]` Tab 移焦後按 Enter 會按到畫面預設而非該按鈕 — 游標未顯示且 activeElement 是 #app 內 [data-a] 時交給瀏覽器原生。
  - `[low]` `[patch]` 滾輪捲動後框浮在固定列上 — drawFocus 在元素捲出 .scroll 可視範圍時先不畫。
  - `[low]` `[patch]` e2e 抽屜顏色只檢 !== AMBER — 改為 === CRIMSON。
  - `[low]` `[reject]` Implementation Notes 第 101 行與後來修正矛盾 — 修法是編輯本 build 的計畫，依規則不處理（line 105 已記錄最終決定）。

## Design Notes

用「動作 key」（`data-a` + `data-v`）而不是 DOM 節點記住游標，因為每次 `render()` 都整頁換掉節點。預設用模板裡的 `data-def` 標記而不是另一份畫面→選擇器對照表，預設跟按鈕寫在一起才不會漂移。焦點框用一個獨立的固定定位覆蓋層，避免改到按鈕本身的版面。

## Verification

**Commands:**
- `node --test tests/` -- expected: 全部通過（含新的 focusnav 測試）。
- `node tools/simulate.js --quick` -- expected: 正常跑完、無錯誤。
- `node tools/keyboard-e2e.js` -- expected: 矩陣每一列與純鍵盤一輪皆 PASS、0 console 錯誤、exit 0。

**Manual checks (if no CLI):**
- Headless Chrome（`/Applications/Google Chrome.app`，可用 `--remote-debugging-port` 或 puppeteer-core 若可取得）以本機 http server 開 `index.html`：只送鍵盤事件從標題玩到結局，無 console 錯誤；截圖主畫面、調合、底部導覽列上的焦點框顏色正確；390px 寬模擬觸控時看不到框。

## Auto Run Result

- 摘要：新增共用鍵盤處理與空間游標；方向鍵叫出四角焦點框、Enter 按下游標或畫面預設、Space／Enter 推進對話；各畫面預設以 `data-def` 標記。
- 檔案：`js/focusnav.js`（幾何純函式）、`js/game.js`（鍵盤處理、游標、data-def）、`css/style.css`（焦點框）、`index.html`（載入）、`tests/focusnav.test.js`（9 單元測試）、`tests/playthrough.test.js`（載入新模組）、`tools/keyboard-e2e.js`（真 Chrome 50 條斷言）。
- 審查：4 個 patch 已套用（2 medium、2 low），0 deferred，1 reject（改計畫）。
- Follow-up review：true（首輪 patch 了 2 個 medium）；未驗證風險＝Tab 原生焦點與 Enter 交互僅以檢視確認，未進 e2e。
- 驗證：`node --test tests/` 68/68；`node tools/simulate.js --quick` OK；`node tools/keyboard-e2e.js` 50/50、0 console 錯誤。
- 殘留風險：Tab 原生焦點外框與四角框並存；e2e 依賴本機 Chrome。
