---
title: '御花園像素潛行地下城（tracer）'
type: feature
ticket: '1'
created: '2026-11-22'
status: ready-for-dev
baseline_revision: ''
route: full
route_source: pinned
risk: high
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: ['docs/game-design.md', 'docs/pixel-art-spec.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 第一版 tracer（commit `33afa90`，即時閃避：搖桿、30 秒、1 名侍衛、空場地）試玩後被評為「難度很低、視覺無趣、玩法也不好」：時間太充裕、沒有路線取捨，侍衛也沒有感知。使用者重新協商玩法（2026-11-22），改成**回合制的隨機潛行地下城**（類似希煉／世界樹迷宮的單層，不戰鬥），並換成超任像素風，讓玩家明確感覺「進入了另一個模式」。

**Approach:** 依 `docs/game-design.md §12`（玩法權威）與 `docs/pixel-art-spec.md`（美術規範）把御花園改成像素地下城，**取代**第一版的即時外殼。回合制讓所有規則進純引擎：`buildGatherDungeon`（生成）、`gatherStep`（推進一回合、回傳事件）、`gatherFov`（視野），`applyGatherHaul` 沿用。外殼負責 canvas 繪製、補間、鏡頭、迷霧呈現、輸入、轉場、音效與 BGM。像素美術全套以 `js/pixelart.js` 內嵌調色盤字串手工繪製，另附預覽頁。太醫院維持舊的快速採集，留給 2.2。

## Boundaries & Constraints

**Always:**
- 引擎純粹：新函式只用注入的 `rand`，不碰 `document`、`localStorage`、`Math.random`、計時器與 rAF；run state 可以 `JSON.stringify` 來回。維持 `tests/playthrough.test.js` 的純度斷言。
- 規則數值集中放在 `D.GATHER.garden.dungeon`（§12.5 表）；引擎從資料讀，不寫死。
- 監聽器（鍵盤、方向盤）與 rAF **只在進場時註冊、離場時移除**，模組載入期不掛任何全域監聽。回歸網只巡覽、不進場。
- 一次進場＝花 1 時辰：結束時（步數用完、被抓、收工）呼叫一次 `applyGatherHaul`，再走既有結果 sheet 與 `finishAction` 路由。收穫一律保留。
- 鍵位：W/A/D/X 加方向鍵走直向、Q/E/Z/C 走斜向、S 原地等、Esc 收工（要確認）；手機用 3×3 方向盤（中央＝等）加 HUD 的「收工」。不能斜切牆角。
- 像素圖整數倍放大、不做平滑；1 倍可辨識（規範 §1 的品質底線）。§3 清單裡的 sprite id 一個不缺。
- `gather` 畫面在未進場時保留 subHeader 返回鍵；進場用非 `go`/`goto`/`craftfor`/`giftto` 的 action（沿用 `enter`），禁足時入口停用。

**Never:**
- 不改採集以外的核心循環；主遊戲畫面不改成像素風。
- 不動 `E.gather`，不刪太醫院的舊採集路徑。
- 不加後端、框架、打包工具、npm 依賴、外連網路字型或外部圖檔服務；不用生圖產出 sprite（只用內嵌像素資料）。
- 不加被抓懲罰；不做侍衛面向視野錐、躲藏、多層（都已記進點子庫）。
- 不改任何既有數值常數的語意。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 生成不變式 | `buildGatherDungeon(D,S,'garden',rand)`，任意 seed | 25×31；全部可走格從出生點都連得到；4 種素材各 ≥1、總數 8～10、癢癢粉正好 1 個且在 BFS 最遠的庭院；2 名侍衛在不同的非入口庭院、與玩家 BFS ≥8；擺設不切斷連通 | 不合格就用同一個 rand 重新生成，最多 N 次；仍失敗則退回保底的固定布局（仍要滿足不變式） |
| 決定性 | 同一個 seed 呼叫兩次 | run state 完全相同 | — |
| 移動 | `gatherStep(run,'ne')`，目標可走且未斜切 | 玩家移動、步數 -1、事件 `move` | 撞牆、擺設、侍衛或斜切牆角 → 位置與步數不變，事件 `bump` |
| 等待 | `'wait'` | 步數 -1，侍衛照常行動 | — |
| 撿取 | 走到有素材的格子 | `got[id]++`，素材移除，事件 `pick`（帶 `rare`） | 同一格不會重複計算 |
| 發現與追擊 | 玩家在侍衛半徑 4.5 內且視線沒被樹籬擋住 | 侍衛轉為追擊，事件 `alert`（只在狀態轉換時發），往最後看到的位置走一步 | 被樹籬擋住 → 不發現 |
| 跟丟 | 追擊中走到最後看見的位置仍看不到 | 事件 `lost`，原地張望 3 回合後回巡邏 | — |
| 被抓 | 侍衛回合開始時能合法一步走到玩家 | `over=true`、`endReason='caught'`，事件 `caught` | 侍衛剛走到相鄰格的那一回合不算抓（玩家有一回合可以逃） |
| 步數用完 | 第 60 步結算後 | `endReason='timeout'` | 同一回合被抓優先於步數用完 |
| 收工 | `'quit'` | `endReason='quit'`，不扣步、侍衛不動 | 結束後再呼叫 `gatherStep` 不產生任何變化 |
| 套用收穫 | `applyGatherHaul(D,S,'garden',run.got)` | 沿用既有行為（inv、slot++、dayLog、ready） | got 為空 → 記「空手而回」 |
| 像素資料 | 載入 `js/pixelart.js` | 每列長度＝w、列數＝h、字元都在調色盤、必備 id 齊全、每張 ≤16 色、mirror 目標存在 | — |

</frozen-after-approval>

## Code Map

- `js/data.js`：`GATHER.garden` 加 `dungeon: { w, h, rooms, steps, guards, guardSight, playerSight, extraItems, guardMinDist, searchTurns, wanderKeep }`（§12.5 的值），`rare: 'itch'` 已存在。
- `js/engine.js`：移除 `buildGatherScene` 與 `GATHER_SECONDS`/`GUARD_SPEED`/`SCENE_MARGIN`，新增 `buildGatherDungeon`、`gatherStep`、`gatherFov` 並加進 `API`。`applyGatherHaul` 與 `E.gather` 不動。可重用 `weightedPick`。
- `js/pixelart.js`（新）：`PIXEL = { palette, sprites, anims }` 純資料，掛到 `window`／`module.exports`（比照 data.js 的匯出方式）。
- `js/game.js`：移除第一版即時外殼（rAF 位移、搖桿、`PLAYER_SPEED`…、aspect 校正），換成地下城外殼：圖集建立、canvas 繪製（規範 §2 的繪製順序）、120ms 補間與輸入緩衝、鏡頭、迷霧呈現、HUD、方向盤、轉場、事件→動畫／音效、結束→`applyGatherHaul`→結果 sheet（被抓時用 `guard.webp` 立繪）→`finishAction`。接點不變：`views.gather()`、事件 switch 的 `enter`/`leavegather`、`render()` overlay、`preloadImages`。
- `js/audio.js`：加入規範 §5.2 的音效，以及場景用的 8-bit BGM（沿用合成架構；進場暫停主 BGM，離場恢復）。
- `css/style.css`：移除第一版 `.pf-*`／搖桿樣式；加 SNES 視窗框、HUD、3×3 方向盤、百葉轉場、canvas `image-rendering: pixelated`。
- `index.html`：在 `engine.js` 之前載入 `js/pixelart.js`。
- `tools/pixel-preview.html`（新）：4 倍顯示全部 sprite 加一個示範房間。
- `tests/engine.test.js`：移除 `buildGatherScene` 的測試，新增地下城測試。`tests/pixelart.test.js`（新）負責像素資料格式。
- `tests/playthrough.test.js`：不改，須仍 20/20；若 harness 載入的檔案清單需要 `pixelart.js` 才補上。

## Tasks & Acceptance

**Execution:**
- [ ] `js/data.js`：加 `GATHER.garden.dungeon` 參數，讓規則可調並為 2.2 資料化鋪路。
- [ ] `js/engine.js`：移除 `buildGatherScene`，實作 `buildGatherDungeon`、`gatherStep`、`gatherFov`，讓全部規則進純引擎、可 seeded 測。
- [ ] `js/pixelart.js`：依規範 §3／§6 繪製全部御花園 sprite，這是美術本體。
- [ ] `tools/pixel-preview.html`：做成人工驗收美術用的預覽頁。
- [ ] `js/game.js` + `index.html`：用地下城外殼取代即時外殼，接上引擎、圖集、轉場、HUD 與輸入。
- [ ] `js/audio.js`：加音效與場景 BGM。
- [ ] `css/style.css`：清掉舊樣式，加上像素 HUD、方向盤與轉場樣式。
- [ ] `tests/engine.test.js` + `tests/pixelart.test.js`：涵蓋 I/O 矩陣每一列；生成不變式跑 ≥200 個 seed；隨機策略 fuzz ≥500 局，必定在 ≤60 步內結束、不丟例外、state 可 JSON 化。

**Acceptance Criteria:**
- Given 瀏覽器開御花園，when 點入口，then 經百葉加馬賽克轉場進入像素地下城並換 BGM；結束後反向轉場回結果 sheet。
- Given 連續進場兩次，when 比較地圖，then 地形、素材、侍衛位置都不同，且有迷霧需要探索。
- Given 電腦用 QWE/ASD/ZXC 或方向鍵，手機用 3×3 方向盤，when 操作，then 8 方向一次一格、S／中央可以等、撞牆不扣步、斜切牆角被擋。
- Given 被侍衛看到，when 繼續行動，then 侍衛冒「！」追來；甩開視線後冒「？」；被抓、60 步用完或收工都正確結束，收穫進包包、花 1 時辰，後續走 `finishAction`。
- Given 禁足中，when 進採集畫面，then 御花園入口不可點。
- Given `tools/pixel-preview.html`，when 人工檢視，then 所有 sprite 齊全、1 倍可辨識、地形無縫拼接。
- Given `node --test tests/`，when 執行，then 全部通過，且回歸網一輪 10 天 20/20、0 錯誤。

## Implementation Notes

## Plan Change Log

- 2026-11-22（人工重新協商）：整份 plan 重寫。舊版（即時閃避 tracer，status `built`，commit `33afa90`，review 已處理長寬比問題）被取代。KEEP：引擎／外殼分工、`enter`/`leavegather` action 與回歸網安全作法、`applyGatherHaul`、結果 sheet＋`finishAction` 路由、禁足守衛。DROP：`buildGatherScene`、即時 rAF 位移、搖桿、30 秒倒數、aspect 校正、`.pf-*` 樣式、「不引入 canvas」的限制。

## Review Triage Log

## Design Notes

**回合順序（`gatherStep`）**：
1. 玩家行動。不合法就回傳 `bump`，結束這次呼叫，不扣步。
2. 撿取。
3. 步數 -1，更新已探索格。
4. 依序處理每名侍衛：先判斷能否一步抓到人（能就 `caught`，整趟結束）；再更新感知（巡邏／追擊／跟丟張望）；最後走一格，不能重疊其他侍衛或玩家。
5. 步數歸零就 `timeout`。

侍衛移動用 8 方向 BFS 最短路徑，遵守同一套不斜切規則。視線用 Bresenham，只有樹籬不透明。

**事件**是給外殼播動畫和音效的唯一管道，例如 `[{t:'move'},{t:'pick',id,rare},{t:'alert',g:0},{t:'gmove',g:1},{t:'caught',g:0}]`。外殼不自己推導任何規則。

**生成建議**（演算法由實作決定）：在 25×31 裡隨機放 5～7 個不重疊的矩形庭院，用 L 形 1 格寬走廊串成樹狀再加 1 條環路，入口庭院靠底邊。擺設放進庭院後重做一次連通檢查。地面變體不寫進 state，由外殼依 `(x,y)` 雜湊決定。

## Verification

**Commands:**
- `node -c js/engine.js && node -c js/game.js && node -c js/data.js && node -c js/pixelart.js`：預期語法全部通過。
- `node --test tests/`：預期全綠，地下城、像素資料與回歸網都通過。
- `grep -n "function gather\b\|function gather(" js/engine.js`：預期既有的 `gather` 還在。

**Manual checks:**
- 開 `tools/pixel-preview.html` 檢查美術；開 `index.html` → 採集 → 御花園，在電腦（鍵盤）和手機寬度（方向盤）各玩數局；一輪 10 天可以玩到結局。這張是 hitl 票，需要使用者試玩驗收手感與美術。
