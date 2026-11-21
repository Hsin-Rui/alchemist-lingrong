---
title: '模擬器改用同一引擎'
type: refactor
ticket: '4'
created: '2026-11-21'
status: built
baseline_revision: '2e20ced18c95847a572c806f12e6102021488f15'
route: full
route_source: auto
risk: medium
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - docs/game-design.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `tools/simulate.js` 自帶一份完整的規則複製（`flipWeights`/`applySpike`/`startDay`/`settleNight`/`deliver`/`gift`/`craft`/封號 `CHECK`…），與 `js/engine.js` 重複兩份（epic R4 技術債）。規則一改就得兩邊同步，易漂移。

**Approach:** 讓模擬器 `require('../js/engine.js')` 取得引擎 API，用引擎的 `newState`/`startDay`/`settleNight`/`applySpike`（經 `deliver`/`gift`）/`gather`/`craft`/`buy`/`bribe`/`flipWeights`/`flipOdds`/`catchChance`/`acceptChance`/`computeEnding`/`TITLE_CHECK` 跑模擬，刪掉自帶的重複規則。四種 bot 的決策策略、`mulberry32` 種子、variant 覆蓋系統、CLI 輸出格式全部保留。引擎的隨機注入用模擬器的 seeded `rand`。因兩邊擲骰順序一致且引擎會寫 `S.stats`，固定種子下輸出應與重構前一致。

## Boundaries & Constraints

**Always:** 規則只有一份（引擎）。模擬器只保留：bot 決策（`makeBot`/`smartSpike`/`BOTS`）、`play` 迴圈、`runVariant`/variant 覆蓋、`mulberry32`、統計彙整與 CLI 輸出、以及把引擎回傳的結構化結果翻成 `S.m` 統計的薄膠水。引擎隨機一律走模擬器注入的 `rand`。variant 的 rule/item/product 覆蓋需烘進傳給引擎的 `Dv`（`Dv.RULES = 合併後的 R`），因引擎讀 `D.RULES`。

**Never:** 不在模擬器重寫或保留任何規則邏輯（機率、狀態轉移、封號判定）。不改引擎（本棒只動 `tools/simulate.js`）。不改 bot 策略與輸出欄位。不加打包工具或 npm 依賴。不改數值常數。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 載入引擎 | `require('../js/engine.js')` | 取得與 `window.GameEngine` 等價的 API（Node module.exports） | — |
| 初始狀態 | `E.newState(Dv)` + 掛 `S.m` 統計物件 | 與舊手建 S 的 favor/friend/conc/inv/silver 相同（預設 variant） | variant → `Dv.RULES=R` 後 newState 反映覆蓋 |
| 開日 | `E.startDay(Dv,S,rand)` 回報告 | 翻 `report.lapsed/newOrders/boosted` → `S.m.late/ordersTotal/empress` | — |
| 夜結算 | `E.settleNight(Dv,S,{sing,rand})` 回報告 | 翻 `serve/pillow/conceived/births` → `S.m.lingFlips/sings/pillow/preg/births/serveFail` | — |
| 交貨/送禮 | `E.deliver`/`E.gift`（內含 `applySpike`） | 讀回傳 `reward`/`outcome`/`refused` → `S.m.delivered/silverEarned/miscarry/infertile/refused/gifts` | 無成品→不計；禁足由 bot 端擋 |
| 封號/名次 | `E.computeEnding(Dv,S,[])` | `rank`、`ending=main.id`、`titles=[main,...extra].id` | 無封號 → touming（computeEnding 內建） |
| 固定種子輸出 | `node tools/simulate.js 300`（seed 1234+bi） | 與 baseline（`scratchpad/sim-baseline-300.txt`）逐行一致，或差異僅微小且分佈仍符設計 §9 | 若不一致：查 newState 初值或擲骰順序差異 |

</frozen-after-approval>

## Code Map

- `tools/simulate.js:14-233` -- `play(D,R,bot,rand)`：核心重寫。刪掉內嵌的 `pick`/`clamp`/`weightedPick`/`flipWeights`/`applySpike`/`startDay`/`settleNight`/`findRecipe`/`catchChance`/`pillowChance` 等規則；改用 `E.*`。S 用 `E.newState(Dv)` 建後掛 `S.m`。loop 內 `E.startDay`/`E.settleNight` 並翻報告進 `S.m`。
- `tools/simulate.js:145-203` -- `api` 物件（bot 介面）：維持對 bot 的簽章（`buy(id)`/`bribe()`/`gather(loc)`/`craft(a,b,spike)`/`deliver(order)`/`gift(who,item)`/`flipOdds(bribe)`/`have`/`grounded`/`catchChance`/`acceptChance`/`findRecipe`/`rand`/`R`），內部改呼叫 `E.*`（傳 `Dv`、`rand`），並把結果翻成 `S.m`。保留 bot 端的禁足/有無成品等前置守衛。
- `tools/simulate.js:213-232` -- 名次/封號：改用 `E.computeEnding(Dv,S,[])`，刪掉本地 `CHECK`。
- `tools/simulate.js:321-325` -- `runVariant`：仍深拷貝 `D`、合併 `R`、套 item/product 覆蓋；新增把合併後 `R` 寫回 `Dv.RULES`（供引擎讀取）。
- `tools/simulate.js:235-309,312-319,357-370` -- `makeBot`/`smartSpike`/`BOTS`/`mulberry32`/CLI 輸出：不動（除非 api 介面欄位名調整）。
- `js/engine.js` -- 規則權威來源，唯讀，不改。

## Tasks & Acceptance

**Execution:**
- [x] `tools/simulate.js` -- `require` 引擎；`play` 改用 `E.newState`/`E.startDay`/`E.settleNight`/`E.deliver`/`E.gift`/`E.gather`/`E.craft`/`E.buy`/`E.bribe`/`E.flipOdds`/`E.catchChance`/`E.acceptChance`/`E.computeEnding`；刪除所有自帶規則與本地 `CHECK`；`api` 內部改走引擎並把結構化回傳翻成 `S.m`；`runVariant` 把合併 R 烘進 `Dv.RULES`。bot/variant/輸出保留。

**Acceptance Criteria:**
- Given 刪改後，when grep `tools/simulate.js`，then 不再有本地的 `applySpike`/`settleNight`/`flipWeights`/`startDay` 規則函式或封號 `CHECK`（規則只剩引擎一份）。
- Given 固定種子，when `node tools/simulate.js 300`，then 輸出與 `scratchpad/sim-baseline-300.txt` 逐行一致（或差異極微且四種 bot 主封號分佈仍與設計 §9 相符：正經→白蓮花 ~79%、精算/高手→妙音/螽斯為大宗）。
- Given 既有測試，when `node --test tests/`，then 仍 29/29（本棒不動遊戲與測試）。

## Implementation Notes

- `tools/simulate.js` 改 `require('../js/engine.js')`；`play` 以 `E.newState(Dv)` 建狀態後掛 `S.m`，刪除全部內嵌規則（`pick`/`clamp`/`weightedPick`/`flipWeights`/`applySpike`/`startDay`/`settleNight`/`findRecipe`/`catchChance`/`pillowChance`/本地 `CHECK`）。
- `api` 介面簽章不變，內部改呼叫 `E.*`（傳 `Dv`、`rand`）＋把結構化回傳翻成 `S.m`（`tallySpike`、settleNight/startDay 報告翻譯）。bot 端守衛（禁足/材料/junk/加料非侍寢）保留。名次/封號改走 `E.computeEnding`。`runVariant` 加 `D.RULES = R` 讓引擎套 variant。
- 三個刻意的對齊細節（達成逐行一致）：deliver 以第一個符合品項的成品 `id` 顯式傳給 `E.deliver`（引擎預設取最後一個）；`flipOdds` 保留權重全空時回 `NaN` 的純量語意；`computeEnding` 無封號時回 `touming`，濾掉以符合舊 titles 不含 touming。
- 驗證：`node tools/simulate.js 300` 與 baseline（`scratchpad/sim-baseline-300.txt`）**逐行一致（0 diff）**；`grep` 確認無本地規則函式/CHECK；`node --test tests/` 29/29；`node -c` 語法通過。淨 -118 行。

## Plan Change Log

## Review Triage Log

### Pass 1 — quick lens（1 子代理）

verdict counts: high 0 / medium 0 / low 0 / **false 1** / maybe-false 0。

- **false（reject）** — `heian` 封號語意：重構前 sim 硬寫 `heian:false`（註解「bot 不會調合失敗」），現經 `E.computeEnding` 走 `TITLE_CHECK.heian = S.stats.junk>=1`。refutation：lens 自證此為 dormant——所有 bot 的 `craft(a,b)` 皆取自合法配方，`findRecipe` 不會回 junk，`S.stats.junk` 恆為 0，故 `heian` 不觸發、固定種子輸出逐行一致（已實測 0 diff），驗收未破。且其隱含修法（恢復 `heian:false`）會「在模擬器重新寫一份規則」，正是本棒（單一規則來源）要消除的；若未來 bot 真調合出 junk，引擎回報 heian 才是與遊戲一致的正確結果。故非缺陷，不 patch、不 defer。
- lens 另確認（非 finding）：擲骰順序逐路徑與引擎一致、`S.m` 翻譯正確、deliver 首件/`flipOdds` NaN/`touming` 濾除三對齊點成立、`runVariant` 烘 `Dv.RULES`、封號條件與舊 CHECK 逐條等效。

## Design Notes

`S.m` 翻譯對照（引擎回傳 → 統計）：
```
startDay.report:  lapsed[]→late(+len)、newOrders[]→ordersTotal(+len)、boosted→empress(+1)
settleNight.report: serve.kind 'serve'|'sing'→lingFlips、'sing'→sings、'debuff'→serveFail；
                    pillow→pillow、conceived→preg、births[]→births(+len)
deliver/gift 回傳: delivered++/gifts++、reward→silverEarned、refused→refused、
                  outcome 'miscarry_musk'→miscarry、'miscarry_safflower'→miscarry+infertile、
                  'musk_infertile'|'safflower_infertile'→infertile
bribe ok→bribes（或讀 S.stats.bribes）；muskRuin 讀 S.stats.muskRuin
```
可優先讀引擎已寫的 `S.stats`（sings/births/bribes/caught/groundedDays/muskRuin）以減少重複計數；其餘由報告/結果翻出。擲骰順序必須與引擎一致（startDay: chooseFlip→orderCount→抽對象；settleNight: 枕邊風→有喜；gather: 數量→逐顆；gift: accept→applySpike），故固定種子下與 baseline 應逐行相同；若不同，先用 `E.newState` 初值與單局 trace 比對找出差異點，不可改引擎遷就。

## Verification

**Commands:**
- `node tools/simulate.js 300 > /tmp/sim-after.txt && diff /private/tmp/claude-501/-Users-hsin-ruilin-alchemist-lingrong/b8ad63aa-e6e0-4a41-b303-c88678133847/scratchpad/sim-baseline-300.txt /tmp/sim-after.txt` -- expected: 無差異（或極微且分佈仍符設計 §9）；該 baseline 檔是重構前 `node tools/simulate.js 300` 的輸出
- `grep -nE 'function (applySpike|settleNight|startDay|flipWeights)|CHECK *=' tools/simulate.js` -- expected: 無（規則不再重複）
- `node --test tests/` -- expected: 29/29 通過（本棒不動遊戲/測試）
- `node -c tools/simulate.js` -- expected: 語法通過

**Manual checks (if no CLI):**
- 檢視 `tools/simulate.js`：`play` 內無規則邏輯，只有 `E.*` 呼叫＋`S.m` 翻譯；bot 與輸出欄位不變。
