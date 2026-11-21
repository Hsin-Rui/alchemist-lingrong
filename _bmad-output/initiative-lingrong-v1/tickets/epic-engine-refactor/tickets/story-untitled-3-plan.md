---
title: '每日流程與各行動 進引擎＋單元測試'
type: refactor
ticket: '3'
created: '2026-11-21'
status: built
baseline_revision: 'b8a054e9bae78e7152cf883ef5794ecced0dc42c'
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

**Problem:** 每日流程（`startDay` 的逾期處理、新訂單生成、翻牌子接線、`tired` 休息）與各行動（`buy`/`bribe`/`rejectOrder`/`gather`/`craft`/`deliver`/`gift`）的規則與狀態變更仍混在 `js/game.js` 外殼裡，`Math.random` 直呼、與 `toast`/`sfx`/`render`/動畫交織，無法單元測試。1.2 後 shell 的 `clamp`/`addFavor`/`addFriend`/`weightedPick`/`invAdd` 多已無呼叫點，規則出現兩處。

**Approach:** 延續 functional core / imperative shell：把上述流程與行動的「狀態變更與擲骰」搬進 `js/engine.js`，隨機走注入的 `rand`，回傳結構化結果；外殼只留 UI（`toast`/`A.sfx`/`render`/`playDialog`/`setTimeout` 動畫／`craftSel`/`gatherResult`/`craftResult` 等 view 狀態與路由）。`startDay` 比照 1.2 的 `settleNight` 拆成「引擎變更狀態並回傳報告」＋外殼 `renderStartLines` 組對話。順便把 `acceptChance` 移入引擎，並刪除 shell 已無用的重複小工具（改用引擎版）。補 `node --test` seeded 單元測試。遊戲行為完全不變。

## Boundaries & Constraints

**Always:** 引擎純函式，不碰 DOM／localStorage／`Math.random`／`setTimeout`；`D` 與 `rand` 一律當參數傳入；雙匯出。`toast`/`A.sfx`/`render`/`playDialog`/`outcomeLines`/`D.REFUSE`/`craftSel`/`gatherResult`/`craftResult`/`busy`/動畫 留在外殼。狀態變更（`S.inv`/`S.hand`/`S.orders`/`S.silver`/`S.slot`/`S.seq`/`S.bribe*`/`S.favor`/`S.friend`/`S.stats`/`S.dayLog`/`S.result`/`S.tired`/旗標）由引擎負責。`rand` 擲骰語意順序與次數與重構前一致。行為以 `tests/playthrough.test.js` 回歸網＋新單元測試守住。

**Never:** 不動數值常數（`R`／`data.js`）、不改玩法或機率。不改結局/封號/夜結算/加料/翻牌子（1.1/1.2 完成）。不加打包工具或 npm 依賴、不採 hexagonal。不改 UI 外觀與動畫時序。`index.html` meta「五天」留給 story 1.5。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 採集 | `gather(D,S,loc,rand)` | `S.slot++`，採 `2+(rand<0.5?1:0)` 個（各 `weightedPick(table,rand)`）進 `S.inv`，回 `{loc,got,ready}`，推 dayLog | 禁足由外殼 `needOut` 擋 |
| 調合成功/失敗 | `craft(D,S,craftSel)` 兩材料 | `slot++`、材料 -1、`findRecipe`→成品或 `junk`（`junk++`）；成品入 `S.hand`/`S.inv`；回 craftResult | 無 rand（確定性） |
| 交貨 正常/加料/被抓/無效 | `deliver(D,S,orderId,itemId,rand)` | 移訂單＋手牌，`applySpike`，未被抓給 `reward`(無效×`uselessRewardRate`)＋`deliverFriend`，`S.silver`/`S.result` 設定 | 找不到成品 → `{noItem:true}` |
| 送禮 收下/拒收 | `gift(D,S,who,handId,rand)` | `rand>=acceptChance`→拒收（`S.result.refused`）；否則 `applySpike`＋收禮友好，設 `S.result` | junk／加料非侍寢者由外殼擋 |
| 賄賂 | `bribe(D,S)` | 足銀且未打點→ -`bribeCost`、`S.bribe+=bribeWeight`、`bribedToday`、`stats.bribes++`，回 `{ok:true}` | 已打點/銀不足→`{ok:false,reason}` |
| 買材料 | `buy(D,S,id)` | 足銀→ -price、`invAdd`，回 `{ok:true}` | 銀不足→`{ok:false}` |
| 婉拒訂單 | `rejectOrder(D,S,id)` | 移訂單、`addFriend(rejectFriend)`、dayLog，回 `{who}` | 找不到→`null` |
| 開日 | `startDay(D,S,rand)` | `tired`→`slot=1`；逾期訂單移除＋`lateFriend`；`chooseFlip`＋消耗 `empressBoost`＋重置 bribe；生成新訂單（`weightedPick`＋隨機抽對象）；回報告 | — |
| 進日 | `advanceDay(D,S)` | `S.day++`、`S.slot=0` | 外殼在 `day>=days` 時改走結局 |

</frozen-after-approval>

## Code Map

- `js/game.js:326-375` -- `buy`/`bribe`/`rejectOrder`/`gather`：搬入引擎（`(D,S,...)`＋`rand`），回傳結果物；外殼留 `needOut`/`toast`/`A.sfx`/`render`/`setTimeout(evil)`/設 `gatherResult`。
- `js/game.js:384-410` -- `doCraft`：純狀態變更抽成引擎 `craft(D,S,craftSel)`（`slot++`/材料-1/`findRecipe`/junk/手牌/找訂單/dayLog，用 `++S.seq`），回 craftResult；外殼留 `busy`/動畫/`setTimeout`/`A.sfx`/`craftSel` 重置/`render`。`findRecipe` 移入引擎（`deliver`/`craft` 用）。
- `js/game.js:413-457` -- `doDeliver`/`doGift`：抽成引擎 `deliver`/`gift`（內部已用 `E.applySpike`），設 `S.result`＋dayLog 並回傳；外殼留 `needOut`、送禮前置驗證 toast、`A.sfx`、`playDialog(outcomeLines|D.REFUSE,...)`。`acceptChance`(game.js:118 區) 移入引擎。
- `js/game.js:184-240` -- `startDay`：狀態推進（tired/逾期/`chooseFlip`＋empressBoost 消耗＋bribe 重置/新訂單）抽成引擎 `startDay(D,S,rand)` 回報告；外殼 `renderStartLines(report)` 組 `lines`（逾期/禁足/翻牌子三種提示/新訂單/無訂單），`playDialog(...,()=>go('home'))`。
- `js/game.js:306-317,242-305` -- `nextDay` 的 `day++`/`slot=0` 抽成引擎 `advanceDay(D,S)`；`endDay`/`finishAction`/`nextDay` 的路由（sing modal、結局判斷、`computeEnding`、`go`）留外殼。
- `js/game.js:23,33-54,40-43` -- shell `clamp`/`addFavor`/`addFriend`/`weightedPick`/`invAdd`/`pick`：行動搬走後多成無呼叫點 → 刪 shell 版，引擎內部自備（引擎已有 clamp/addFavor/addFriend/weightedPick，補 `invAdd`/`pick`）。保留仍被 render 使用者（逐一確認後再刪）。
- `js/engine.js` -- 現有 1.1/1.2 函式；本棒新增上列並併入雙匯出 `API`。
- `tests/engine.test.js` / `tests/playthrough.test.js` -- 既有；本棒在 engine.test.js 追加流程與行動的 seeded 測試，回歸網不改。

## Tasks & Acceptance

**Execution:**
- [x] `js/engine.js` -- 新增 `buy`/`bribe`/`rejectOrder`/`gather`/`craft`/`findRecipe`/`deliver`/`gift`/`acceptChance`/`startDay`/`advanceDay`，全部 `(D,S,...)`＋注入 `rand`，回傳結構化結果/報告；補內部 `invAdd`/`pick`；併入雙匯出 API。
- [x] `js/game.js` -- 刪除上列函式本體與已無用的 shell 小工具，改呼叫 `E.*`（傳 `Math.random`）；`startDay` 外殼化為取報告＋`renderStartLines`；`doCraft` 動畫殼包 `E.craft`；`deliver`/`gift`/`buy`/`bribe`/`rejectOrder`/`gather` 外殼保留各自 UI 回饋與路由。
- [x] `tests/engine.test.js` -- 追加 seeded 單元測試覆蓋 I/O 矩陣每列（採集數量與掉落、調合成功/junk、交貨 reward/被抓/無效、送禮 收下/拒收、賄賂/買/婉拒 邊界、startDay 逾期+訂單生成、advanceDay）。

**Acceptance Criteria:**
- Given 注入固定 `rand`，when 呼叫引擎各流程/行動，then 狀態轉移、金錢、庫存、訂單、擲骰閾值與重構前一致；引擎原始碼不含 `Math.random`/`document`/`localStorage`/`setTimeout`。
- Given 完整測試，when `node --test tests/`，then 全綠（回歸網 20/20 到結局＋新單元測試通過）。
- Given 瀏覽器實玩一輪，when 採集/調合/交貨/送禮/賄賂/開日流程，then 對話、數值、動畫、結局與重構前一致。

## Implementation Notes

- 引擎新增 11 個流程/行動函式（`buy`/`bribe`/`rejectOrder`/`gather`/`craft`/`deliver`/`gift`/`startDay`/`advanceDay`＋`findRecipe`/`acceptChance`）與內部 `invAdd`/`pick`/`have`/`readyItem`/`recipeOk`/`itemName`，併入雙匯出。狀態變更與擲骰全在引擎，`rand` 注入並保留擲骰順序（gather 先數量後逐顆；startDay `chooseFlip`→`weightedPick(orderCount)`→逐張抽對象＋`pick(NORMAL_ORDERS)`，懷孕→tonic 不抽品項；gift 先 `acceptChance` 擲骰收下才 `applySpike`）。
- `startDay` 外殼化為 `playDialog(renderStartLines(E.startDay(D,S,rand)), …)`；`renderStartLines` 比照 `renderNightLines`，對話順序（header→tired→逾期→禁足→EMPRESS→翻牌子→新訂單→無訂單）與重構前逐字一致。`nextDay` 用 `E.advanceDay`。
- `doCraft` 保留動畫殼（`busy`/`brewing`/`setTimeout`/`A.sfx`/`craftSel` 重置），核心換 `E.craft`。`deliver`/`gift` 外殼保留 `needOut`、送禮前置驗證 toast、`A.sfx`、`playDialog(outcomeLines|D.REFUSE)`；拒收仍不播 `A.sfx('pop')`。
- 刪除 shell 已無呼叫點的 `clamp`/`pick`/`weightedPick`/`invAdd`/`addFavor`/`addFriend`/`findRecipe`/`acceptChance`（`#結局` debug 區塊的本地 `pick` 保留）；render 3 處改 `E.findRecipe`/`E.acceptChance`。grep 確認無殘留 bare 參照。
- 驗證：`node --test tests/` 29/29（17 既有＋12 新）；scratchpad 差異測試 60 局 seeded 同序列同點擊、整段渲染串流 baseline(b8a054e) vs 重構 0 不符、皆達結局；`node tools/simulate.js 300` 四 bot 數字與 1.2 前後一致。
- 殘留：無瀏覽器環境，人工實玩留給使用者冒煙測試。

## Plan Change Log

## Review Triage Log

### Pass 1 — quick lens（1 子代理）

verdict counts: high 0 / medium 0 / low 0 / false 0 / maybe-false 0 — **零 findings**。

lens 確認：引擎純度（`Math.random`/`document`/`localStorage`/`setTimeout` 僅出現在註解）、擲骰順序與次數保留（startDay `chooseFlip`→`weightedPick`→抽對象＋`pick`，懷孕跳品項；gather 先數量後逐顆；gift 先 `acceptChance` 後 `applySpike`）、`buy`/`bribe`/`rejectOrder`/`craft`/`deliver`/`gift`/`advanceDay` 狀態轉移與舊碼逐行等效、`S.result` 展開不覆蓋 `who`/`spike`（`applySpike` 回傳不含該鍵）、`renderStartLines` 對話順序與 `flipFriend` 快照時機一致、已刪 shell 小工具無殘留參照、API 匯出齊全、單元測試覆蓋 I/O 矩陣每列且與新碼 rand 消耗一致。無迴圈、無 patch、無新 defer。

## Design Notes

`startDay` 報告結構（外殼 `renderStartLines` 據此組 `lines`；比照 1.2 `settleNight`）：
```
{ tired:bool, lapsed:[{who,product}], grounded:bool,
  boosted:bool, flip: who|null, flipFriend:number,
  newOrders:[{who,product}], noOrders:bool }
```
`craft`/`gather`/`deliver`/`gift` 的回傳沿用現有 `craftResult`/`gatherResult`/`S.result` 欄位形狀，使 render 無需改動。擲骰順序保留：`gather` 先數量後逐顆 `weightedPick`；`startDay` 先 `chooseFlip`（1.2）再 `weightedPick(orderCountWeights)` 再逐張訂單抽對象＋`pick(NORMAL_ORDERS)`；`gift` 先 `acceptChance` 擲骰、收下才 `applySpike`。production 下 `rand=Math.random` 不受順序影響，seeded 測試用可控 `rand` 斷言分支。

## Verification

**Commands:**
- `node --test tests/` -- expected: 全數通過（回歸 20/20 到結局＋流程/行動 seeded 單元測試綠）
- `node tools/simulate.js 300` -- expected: 四種 bot 數字與先前/設計 §9 相符（規則未變）
- 差異測試（scratchpad）：baseline `b8a054e` vs 重構，多局 seeded 同序列同點擊，比對整段渲染串流 -- expected: 0 不符

**Manual checks (if no CLI):**
- 瀏覽器開 `index.html`：採集掉落、調合動畫與成品、交貨賞銀/被抓、送禮收下/拒收、開日逾期與新訂單、就寢流程、結局皆正常，console 無錯。
