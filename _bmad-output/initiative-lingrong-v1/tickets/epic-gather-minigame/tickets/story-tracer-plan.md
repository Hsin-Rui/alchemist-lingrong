---
title: '御花園採集小遊戲（tracer）'
type: feature
ticket: '1'
created: '2026-11-21'
status: built
baseline_revision: 'ece4dbdc17ac7605f42d276446aae73d37d798d5'
route: full
route_source: pinned
risk: high
review: quick
review_source: pinned
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['docs/game-design.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 採集目前是「點地點→骰 2～3 樣進包包」的拉霸，零抉擇、零張力。要把御花園改成進場景的即時潛行小遊戲：操控零溶移動、撿素材、閃避巡邏侍衛、限時內搶到稀有素材；時間到或被抓就結束，撿到的保留。這是整條採集 epic 的 tracer，走完「引擎場景生成 → 即時互動外殼 → 收穫回灌包包」的垂直切片。

**Approach:** 引擎加兩個純函式（注入 rand、可 seeded 測、不碰 DOM）：`buildGatherScene` 生成場景規格（散落素材與正規化座標、保證每種素材≥1、必出稀有、侍衛起點與巡邏點、秒數），`applyGatherHaul` 把玩家撿到的 got 套進既有包包（invAdd）、`S.slot++`、推 dayLog、回傳 ready 清單。即時層（移動、碰撞、倒數、搖桿、鍵盤、rAF）全在外殼 `js/game.js`，以 overlay 疊在既有 `gather` 畫面上。既有 `E.gather` 保留不動（模擬器/回歸網仍用）；本棒只把御花園接上小遊戲，太醫院維持舊的快速採集，留給 2.2 轉場景＋資料化。

## Boundaries & Constraints

**Always:**
- 引擎純粹：`buildGatherScene`/`applyGatherHaul` 只用注入 rand、不碰 `document`/`localStorage`/`Math.random`/`setTimeout`/`rAF`；維持 `tests/playthrough.test.js` 的純度斷言。
- 即時互動（rAF、鍵盤/觸控監聽、計時）只在外殼，且**只在進入場景時才註冊監聽/啟動 rAF、離場時移除**（避免 headless 沙箱在載入期觸發）。
- 一次進場＝花 1 時辰：`S.slot++` 由 `applyGatherHaul` 在該趟結束（逾時／被抓／離開）時做一次。
- 撿到的素材一律保留、不沒收（被抓也算）。結束後沿用既有 `finishAction`（slot 滿→endDay，否則回 home／可去調合）路由。
- 保證御花園每種素材（茉莉、桂花、玫瑰、癢癢粉）至少各出現 1 個，稀有＝癢癢粉必出；其餘數量不等。
- 手機虛擬搖桿、電腦方向鍵或 WASD 皆可操控零溶。
- `gather` 畫面在「未進場」狀態仍保有 subHeader 的返回鍵（`data-a="go" v="home"`）；進場的按鈕用新 action（非 go/goto/craftfor/giftto），確保回歸網只巡覽不誤觸小遊戲。

**Never:**
- 不改採集以外核心循環（翻牌子、送禮、交貨、結算、結局、訂單）。
- 不動 `E.gather`、不刪既有太醫院採集路徑。
- 不加後端、框架、打包工具、npm 依賴、canvas 以外新相依；場景用 DOM 絕對定位元件即可（與既有風格一致，不引入 canvas）。
- 不加「被抓＝禁足／掉友好」懲罰（延到 2.3）。
- 不改任何數值常數的既有語意（新增 `GATHER.garden.rare` 屬新資料，非改舊值）。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 生成場景 | `buildGatherScene(D,S,'garden',rand)` | 回 `{loc,seconds,rare,items:[{id,rare,x,y}],guard:{x,y,waypoints,speed}}`；每種素材≥1、rare=癢癢粉含 1 個、座標皆 0..1 | loc 無 `rare` → 取權重最低者為稀有 |
| 固定 rand 決定性 | 同 `rand` 兩次呼叫 | items/guard 組成與座標逐一相同 | — |
| 套用收穫 | `applyGatherHaul(D,S,'garden',{jasmine:2,itch:1})` | inv 各 +count、`S.slot` +1、dayLog 新增一列、回 `{loc,got,ready}`（ready＝湊齊配方的訂單） | got 空 → inv 不變、仍 slot++、dayLog 記「空手而回」 |
| 撿取判定（外殼） | 零溶座標進入素材的撿取半徑 | 該素材計入 got、畫面移除、撿取音效 | 重複碰同一素材只計一次（撿後移除） |
| 被抓（外殼） | 零溶座標進入侍衛的被抓半徑 | 該趟結束、結算目前 got（保留）、顯示「被侍衛發現了！」 | — |
| 逾時（外殼） | 倒數歸零 | 該趟結束、結算目前 got | — |
| 禁足 | `grounded()` 為真 | 御花園入口鈕 disabled（沿用既有 needOut/grounded 守衛） | 點到亦被既有守衛擋下 |

</frozen-after-approval>

## Code Map

- `js/engine.js` -- 加 `buildGatherScene(D,S,loc,rand)` 與 `applyGatherHaul(D,S,loc,got)` 兩個純函式，並加進檔尾 `API`。可重用內部 `weightedPick`/`invAdd`/`readyItem`/`recipeOk`/`itemName`。`E.gather`（319-333）保留不動。
- `js/data.js` -- `GATHER.garden`（40-44）加 `rare: 'itch'`。表內容不變。
- `js/game.js` -- 新增場景狀態（如 `gatherScene`）與其 overlay 渲染、rAF 迴圈、搖桿/鍵盤輸入、碰撞/倒數/結束→`applyGatherHaul`→既有結果 sheet→`finishAction`。接點：`views.gather()`（567-601，御花園卡的按鈕改為新 action 進場；太醫院卡維持舊 `gather`）、事件 switch（862-906，加新 action）、`finishAction`（183-186）、`render()`（837-851，overlay 併入）、`preloadImages`（910-917，加 `characters/guard`）。零溶 sprite 用現成 `lingrong_smile`，侍衛用 `assets/characters/guard.webp`（可能未生好→`onerror` 退回 CSS 佔位，比照既有 `IMG_FAIL`）。
- `css/style.css` -- 加場景 overlay、play field、素材/侍衛/零溶 sprite、HUD（倒數、已撿）、虛擬搖桿、被抓/逾時結算的樣式。沿用既有 `bg-garden`、`.sheet-layer`/`.sheet`。
- `tests/engine.test.js` -- 加 `buildGatherScene`/`applyGatherHaul` 的 seeded 單元測試。
- `tests/playthrough.test.js` -- 不改；回歸網須仍 20/20（harness 只巡覽 gather 畫面後回 home，不進場景）。

## Tasks & Acceptance

**Execution:**
- [x] `js/data.js` -- `GATHER.garden` 加 `rare: 'itch'` -- 讓引擎知道御花園稀有素材，不改既有表。
- [x] `js/engine.js` -- 加 `buildGatherScene`、`applyGatherHaul` 並匯出 -- 場景生成與收穫套用的純邏輯；隨機走注入 rand，不碰 DOM/計時器。
- [x] `js/game.js` -- 加御花園即時小遊戲外殼（場景 state＋overlay 渲染、rAF 迴圈、搖桿＋方向鍵/WASD、撿取/被抓/倒數、結束→`applyGatherHaul`→結果 sheet→`finishAction`）；御花園卡改為新 action 進場，太醫院維持舊採集 -- 把互動層接上引擎，維持引擎純粹與回歸網。
- [x] `css/style.css` -- 加場景/sprite/HUD/搖桿樣式 -- 手機直式優先、可玩可讀。
- [x] `tests/engine.test.js` -- 為 I/O 矩陣各列加 seeded 單元測試（生成保證每種≥1＋必出稀有＋座標範圍＋決定性；套用 inv/slot/ready/dayLog；got 空的邊界） -- 鎖住引擎行為。

**Acceptance Criteria:**
- Given 瀏覽器開御花園，when 用搖桿或方向鍵/WASD 移動並碰到素材，then 素材計入收穫並從場上消失。
- Given 在場景中，when 碰到巡邏侍衛或倒數歸零，then 該趟結束、已撿到的素材進包包（不沒收）、該日花掉 1 時辰。
- Given 一趟採集結束，when slot 已滿，then 走既有夜晚結算；否則回炎洗宮或可直接去調合（沿用 `finishAction`）。
- Given 禁足中，when 進採集畫面，then 御花園入口不可點（沿用既有守衛）。
- Given `node --test tests/`，when 執行，then 新引擎單元測試通過，且既有回歸網一輪 10 天仍 20/20 到結局、0 錯誤。

## Implementation Notes

- 引擎常數（可調）：`GATHER_SECONDS=30`、`GUARD_SPEED=0.16`（正規化/秒）、`SCENE_MARGIN=0.08`。場景總數 7～9（每種素材各 1 ＋ 3～5 個非稀有常見素材），侍衛 3～4 個巡邏點，起點落在上半（y∈[0.08,0.5]）以免一入場就撞到從底部 (0.5,0.86) 出生的玩家。
- 外殼手感常數（`js/game.js`）：`PLAYER_SPEED=0.52`、`PICK_RADIUS=0.075`、`CATCH_RADIUS=0.07`、`CATCH_GRACE=0.6`（開場緩衝秒數，避免生成當幀被抓）。
- 進場用新 action `enter`（離場 `leavegather`），`gather`/`regather` 留給太醫院舊快速採集。御花園結果 sheet 的「再採一次」按鈕依 `MINIGAME` 集合切成 `enter`。
- 侍衛立繪 `assets/characters/guard.webp` 尚未生成 → `onerror` 退回 CSS「侍」佔位（比照 `IMG_FAIL`/portrait 的 `.noimg`）；零溶沿用現成 `lingrong_smile`。
- 監聽（keydown/keyup、joystick pointer）與 rAF 只在 `enterGather`/`bindGatherRuntime` 註冊、`endGather`→`stopGatherRuntime` 移除；模組載入期不掛任何全域監聽，headless 回歸網（不點 `enter`）永不進 rAF 迴圈。

## Plan Change Log

## Review Triage Log

### Pass 1（quick lens，2026-11-21）

Verdicts: high 0｜medium 1｜low 1｜false 0｜maybe-false 0。ACs 與 Boundaries 全數成立、回歸網經檢視仍 20/20。

- **medium — 碰撞判定未校正場地長寬比**（`js/game.js` `gatherLoop`）。撿取／被抓用正規化空間的 `Math.hypot`（等向），但座標以 `left:x%`/`top:y%` 投到直式非正方 `.playfield`，實際命中區在螢幕上是縱向拉長的橢圓：看似重疊卻撿不到、或在看似安全的垂直距離就被抓，直接影響本 tracer 要驗的手感。→ patch。
- **low — 侍衛危險圈與真實被抓範圍不符**（`css/style.css` `.pf-guard::after`）。固定 60px 虛線圈不對應實際 `CATCH_RADIUS=0.07`（隨場地縮放且因上述而非等向），可能誤導玩家的安全距離。與上一條同根因（螢幕命中幾何未與像素對齊），併為一組。→ patch。

處置：無 intent_gap／bad_plan，不 loopback；兩條併為一組（最高 medium）走 patch，交回實作 subagent 修。

## Design Notes

座標採正規化 0..1（引擎產出，外殼乘以 play field 尺寸換成 %／px），讓場景生成可純測、可重現，且外殼只負責映射與逐格更新。侍衛巡邏＝在 `waypoints` 間線性移動、到點折返/循環，速度 `speed`（正規化/秒）由引擎給；逐幀位移在外殼。撿取/被抓用圓形距離判定（半徑常數在外殼）。

生成規則（garden 範例，table 見 data.js）：先放該地圖素材集各 1 個（保證每種≥1、含稀有），再從「非稀有」常見素材多撒數個（稀有維持 1 個、其餘數量不等），總數約 7～9；每個素材給一組 rand 正規化座標（與既有邊界留白）。侍衛起點與數個巡邏點亦由 rand 定。

harness 安全：進場按鈕用非 `go/goto/craftfor/giftto` 的 action（例如 `enter`），且未進場時 gather 畫面保有 `go home` 返回鍵——回歸 harness 在 gather 畫面只會點 home 離開，永不進入 rAF 迴圈。

## Verification

**Commands:**
- `node -c js/engine.js && node -c js/game.js && node -c js/data.js` -- expected: 語法通過
- `node --test tests/` -- expected: 全綠；新增 `buildGatherScene`/`applyGatherHaul` 單元測試通過，回歸 playthrough 一輪 10 天 20/20 到結局、引擎純度斷言通過
- `grep -n "function gather" js/engine.js` -- expected: 既有 `gather` 仍在（未被移除）

**Manual checks:**
- 瀏覽器開 `index.html` → 採集 → 御花園：能用搖桿（手機）與方向鍵/WASD（電腦）移動零溶、撿到素材、碰侍衛或時間到結束、收穫進包包且花 1 時辰；太醫院仍可照舊採集；一輪 10 天可玩到結局。
