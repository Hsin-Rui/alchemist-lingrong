---
title: '夜晚結算＋加料＋翻牌子 進引擎＋單元測試'
type: refactor
ticket: '2'
created: '2026-11-21'
status: built
baseline_revision: 'e56990432b5904007a1cbd291272508e4d6488ef'
route: full
route_source: auto
risk: high
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - docs/game-design.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 夜晚結算 `settleNight`、加料 `applySpike`/`predict`、翻牌子權重 `flipWeights`/`flipOdds` 連同其隨機擲骰與狀態變更，全混在 `js/game.js` 的 UI 外殼裡，`Math.random` 直呼、對話字串與狀態變更交織，無法單元測試、也難保證重構安全。

**Approach:** 延續 story 1.1 的 functional core / imperative shell：把這些確定性與隨機邏輯搬進 `js/engine.js`，隨機一律走注入的 `rand` 參數（不呼叫 `Math.random`）。`settleNight` 拆成「引擎變更狀態並回傳結構化結算報告」＋「外殼依報告組對話 `lines`」。補 `node --test` seeded 單元測試覆蓋結算／加料／翻牌子權重，順帶補上 story 1.1 defer 的封號路徑覆蓋（加料被抓、演唱、麝香絕育、生子等）。遊戲行為完全不變。

## Boundaries & Constraints

**Always:** 引擎純函式，不碰 DOM／localStorage／`Math.random`；`D`（資料）與 `rand`（隨機源）一律當參數傳入；雙匯出 `window.GameEngine` + `module.exports`。對話 `lines`、`playDialog`、`go`、`toast`、`render` 全留在外殼。狀態變更（`S.favor`/`S.conc`/`S.stats`/`S.dayLog`/`S.log`/旗標）由引擎負責。行為不變以 `tests/playthrough.test.js` 回歸網＋新單元測試守住。

**Never:** 不動數值常數（`R`／`data.js`）、不改玩法或機率、不改結局判定（story 1.1 已完成）。不搬 `startDay`/`endDay`/`nextDay` 主流程、採集/調合/交貨/送禮/賄賂等行動（屬 story 1.3）。不碰 `acceptChance`（送禮用，story 1.3）。不加打包工具或 npm 依賴。不採 hexagonal。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 加料被抓 | `rand()<catchChance`，對某妃下料 | `outcome:'caught'`，`groundUntil` 拉高、`stats.caught++`、friend += `caughtFriend`；success 不增 | 無 spike → `{outcome:'plain'}` |
| 麝香絕育 | 連下麝香達 `muskDoses`、未被抓 | `status:'infertile'`、`stats.muskRuin++`、`ruined` 含她 | 已不孕 → `musk_useless` |
| 紅花打胎 | 對懷孕妃下 safflower、未被抓 | 小產＋絕育、`stats.ruined` | 已不孕 → useless |
| 翻牌子權重 | 禁足／`empressBoost`／`bribe`／重複翻（喜新厭舊）／懷孕妃 | 禁足去 lingrong 權重；boost ×`empressFactor`；bribe 加權；上次 flip ×`repeatFlipFactor`；懷孕妃不列入 | 權重全空 → flip 為 null |
| 夜結算侍寢 | `flip==='lingrong'` 未禁足，`sing` 真/假 | favor.lingrong += `serveFavor`(+`singExtraFavor`)，`sing`→`tired=true`、`stats.sings++` | 禁足 → 侍寢取消、favor 不變 |
| 枕邊風／有喜 | 目標妃侍寢，`rand` 命中 `pillowChance`／`pregnancyChance` | 零溶 favor += `pillowFavor`／該妃 `status:'pregnant'` | 有 debuff → 侍寢出包、`serveFailFavor` |
| 生子 | 懷孕妃 `preg` 達 `pregnancyNights` | 復原、favor += `birthFavor`、`stats.births++` | 當晚受孕者該夜不+preg |

</frozen-after-approval>

## Code Map

- `js/game.js:118-136` -- `catchChance`/`riskLevel`/`pillowChance`/`flipWeights`/`flipOdds`：搬入引擎（簽章加 `D,S`；`grounded` 內聯 `S.day<=S.groundUntil`；`bribe` 顯式傳參）。`acceptChance`(123) 留著。
- `js/game.js:139-207` -- `predict`（純，無 rand）、`applySpike`（擲骰＋改狀態＋推 `S.log`/`S.stats`）：搬入引擎，`rand` 注入。`outcomeLines`(209) 留外殼（讀 D 對話）。
- `js/game.js:292-310` -- startDay 內翻牌子「選牌」：抽成引擎 `chooseFlip(D,S,rand)`（內部 `flipWeights`+`weightedPick`，用 `S.bribe`）；外殼 `S.flip = E.chooseFlip(...)`，其餘對話/empressBoost 消耗/bribe 重置/訂單留原地（story 1.3）。
- `js/game.js:352-420` -- `settleNight`：引擎 `settleNight(D,S,{sing,rand})` 變更全部狀態並回傳報告；外殼 `renderNightLines(report)` 組 `lines` 後 `playDialog(...,()=>go('night'),'night')`。
- `js/game.js:33-53` -- `weightedPick`/`clamp`/`addFavor`/`addFriend`：引擎內部自備一份（暫與外殼並存，story 1.5 收斂）；引擎的隨機走注入 `rand`。
- `js/engine.js` -- 現有 `newState`/`TITLE_CHECK`/`computeEnding`；本棒新增上列函式並入 `API` 雙匯出。
- `js/game.js:21,266,424,etc` -- 呼叫點改走 `E.*`（`rand=Math.random` 由外殼傳）。render 用到 `predict`(848,917)、`flipOdds`(690) 改 `E.*`。
- `tests/playthrough.test.js` -- 既有回歸網，不改邏輯，續當端到端守門。

## Tasks & Acceptance

**Execution:**
- [x] `js/engine.js` -- 新增 `catchChance`/`riskLevel`/`pillowChance`/`flipWeights`/`flipOdds`/`chooseFlip`/`predict`/`applySpike`/`settleNight`，全部 `(D,S,...)`＋注入 `rand`，`settleNight` 回傳結算報告；併入雙匯出 API；引擎內部自備 `clamp`/`addFavor`/`addFriend`/`weightedPick`。
- [x] `js/game.js` -- 刪除上列函式本體，改呼叫 `E.*`（傳 `Math.random`）；`settleNight` 外殼化為取報告＋`renderNightLines` 組 `lines`；`startDay` 選牌改 `E.chooseFlip`；render 的 `predict`/`flipOdds` 改 `E.*`。
- [x] `tests/engine.test.js` -- 新增 `node --test` seeded 單元測試，覆蓋 I/O 矩陣每列與封號 stat 路徑（caught→問太醫/短子、muskRuin→麝香、sings→妙音、births→螽斯、spikesUsed+success→白忙/白蓮）。

**Acceptance Criteria:**
- Given 注入固定 `rand`，when 呼叫引擎各函式，then 狀態轉移與機率閾值與重構前一致，且引擎原始碼不含 `Math.random`/`document`/`localStorage`。
- Given 完整測試，when `node --test tests/`，then 全綠（回歸網 20/20 到結局＋新單元測試通過）。
- Given 瀏覽器實玩一輪，when 夜晚結算/加料/翻牌子，then 對話、數值、結局與重構前一致。

## Implementation Notes

- 引擎新增 9 個純函式（`catchChance`/`riskLevel`/`pillowChance`/`flipWeights`/`flipOdds`/`chooseFlip`/`predict`/`applySpike`/`settleNight`）＋內部 `clamp`/`charName`/`addFavor`/`addFriend`/`weightedPick`，併入雙匯出 API。隨機全走注入 `rand`。
- `settleNight(D,S,{sing,rand})` 變更全部狀態（含 `S.dayLog`/`S.log` 字串、懷孕進度、黃后倒數）並回傳 Design Notes 的報告結構；外殼新增 `renderNightLines(report)` 逐字重建對話，順序（侍寢→枕邊風→有喜→生子）與重構前一致。
- `flipWeights` 以 `bribe===undefined→S.bribe` 保留原預設參數語意；`chooseFlip` 等價於原 `startDay` 的 `weightedPick(Object.entries(flipWeights()))`。
- 外殼呼叫點全改 `E.*` 並傳 `rand=Math.random`：`startDay`、`settleNight`、`doDeliver`、`doGift`、`tonightCard`、`status` view、craft/gift view 的 `predict`。`acceptChance` 與 shell 的 `clamp`/`addFavor`/`addFriend`/`weightedPick` 暫留（story 1.3/1.5）。
- 驗證：`node --test tests/` 17/17 通過（14 新 seeded 單元 ＋ 3 既有：20 局回歸、#結局、純度/雙匯出）；scratchpad 差異測試 60 局 seeded 全程 HTML 串流 baseline(e569904) vs 重構 0 不符、pick 序列一致；`node tools/simulate.js 300` 數字與設計文件 §9 相符。
- 殘留：shell `addFavor` 現已無呼叫點（story 1.5 收斂時刪）；無瀏覽器環境，人工實玩留給使用者冒煙測試。

## Plan Change Log

## Review Triage Log

### Pass 1 — quick lens（1 子代理）

verdict counts: high 0 / medium 0 / low 0 / false 0 / maybe-false 0 — **零 findings**。

lens 獨立驗證並確認無虞：引擎純度（AC1，`Math.random`/`document`/`localStorage` 僅出現在註解）、所有呼叫點都已轉為 `E.*` 且參數順序正確、`settleNight`→`renderNightLines` 行為等價（對話順序、dayLog 字串、`rand` 消耗順序與次數、黃后 `noFlipNights`/`empressBoost` 倒數、當晚受孕不+preg、debuff 清除）、`flipWeights` 預設 bribe 語意保留、單元測試斷言對照 `data.js` 常數全數相符。
非 findings（plan 已 defer 至 story 1.5）：report 的 `grounded` 欄位未被 `renderNightLines` 讀取（屬報告契約）、shell `addFavor` 現無呼叫點、shell/engine 小工具重複。無迴圈、無 patch、無新 defer。

## Design Notes

`settleNight` 報告結構（外殼據此組 `lines`，避免引擎碰對話）：
```
{ who, grounded, sing,
  serve: null | {target:'lingrong'|who, favDelta, kind:'serve'|'sing'|'grounded'|'debuff', debuff?},
  pillow: null | {favDelta},
  conceived: who|null,
  births: [{who, favDelta}],
  empressQueued: bool }
```
引擎內 `rand` 擲骰的語意順序（被抓→麝香小產→枕邊風→有喜）須保留各自機率；production 下 `rand=Math.random` 不受呼叫順序影響，seeded 測試則用可控 `rand`（如 `()=>0` 必中、`()=>0.999` 必不中）斷言分支。`S.dayLog`/`S.log` 字串屬狀態、留引擎推入，與重構前逐字一致。

## Verification

**Commands:**
- `node --test tests/` -- expected: 全數通過（回歸 20/20 到結局、0 錯誤；結算/加料/翻牌子/封號單元測試綠）
- `node tools/simulate.js`（若存在對應指令）-- expected: 四種 bot 數字與先前一致（規則未變）
- 差異測試（scratchpad）：對大量 seeded 狀態比對 baseline 與引擎 `applySpike`/`settleNight` 的 `S` 變更一致 -- expected: 0 差異

**Manual checks (if no CLI):**
- 瀏覽器開 `index.html`：玩一輪，翻牌子提示、侍寢/枕邊風/有喜/生子、加料被抓禁足、結局皆正常，console 無錯。
