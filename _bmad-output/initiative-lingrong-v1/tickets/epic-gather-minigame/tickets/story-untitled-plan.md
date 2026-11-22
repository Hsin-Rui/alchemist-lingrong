---
title: '太醫院地圖＋地圖資料化'
type: feature
ticket: '2'
created: '2026-11-22'
status: built
baseline_revision: '2eebc93'
route: oneshot
route_source: human（「按照你規劃的來實施」，設計已在 docs/game-design.md §12.8 確認）
risk: medium
review: none
context: ['docs/game-design.md', 'docs/pixel-art-spec.md']
---

## Intent

依 `docs/game-design.md §12.8` 做太醫院採集地下城，並把地圖主題、巡邏者、文字抽成資料。規則與御花園完全相同（同一套生成、回合、視野、追擊、結算）。麝香一趟 1 個（使用者接受建議）。

## Implementation Notes

- `js/data.js`：`GATHER.<loc>` 新增 `tileset`（地形代號→像素圖 id）、`guards`（依登場順序：稱呼、sprite、結算立繪、登場提示、被抓台詞）；`dungeon` 新增 `roomW`／`roomH`。太醫院：房間 6～8（3～6 × 3～4）、環路 3、`rareCount: 1`、其餘同御花園。
- `js/engine.js`：房間大小改讀資料；run 多一個 `caughtBy`（抓到零溶的巡邏者編號，沒被抓是 -1）。沒有新增 AI。
- `js/game.js`：`MINIGAME` 改成「資料裡有 `dungeon` 就走地下城」；畫圖依 `tileset` 與 `guards[i].sprite` 取圖（擺設高度由圖的高度決定）；登場提示、被抓對話框、結算文字與立繪都依抓人者取資料（藥童沒有立繪就不顯示）。
- `js/pixelart.js`：調色盤加 11 色（木頭、青磚、官服、短褂）；新圖 `ty_floor_0..2`（房間與走廊共用；原本的青磚迴廊 `ty_hall_*` 試看示意圖後依使用者意見拿掉）、`ty_wall_top`、`ty_wall_face`、`ty_door`、`ty_stove_0/1`、`ty_basket`、`ty_mortar`、`ty_candle`、`page_*`、`doctor_*`（各 12 幀）、`angelica`、`croton`、`petal`、`musk_0/1`。
- 太醫院舊的快速採集入口已不再出現；`gather()` 只剩「像素資料沒載到」時的退路（回歸網在 Node 裡跑的也是這條）。

## Verification

- `node --test tests/`：59/59。新增：太醫院 200 seed 生成不變式＋極端 rand、太醫院 300 局 fuzz（登場時程、`caughtBy`、收穫套用）、地圖資料完整性、兩張地圖的圖塊／巡邏者 sprite／素材圖都存在且尺寸正確。
- Headless Chrome（390×760、1280×720）：太醫院可進場、14 個素材（麝香 1）、第 10 步「藥童開始巡房了」、第 30 步「溫太醫睡醒了」、撞上溫太醫 →「小主，請回宮歇著吧。」→ 結算顯示太醫立繪與台詞；無 console 錯誤。
- 未做：獨立 code review（oneshot）；真人試玩。
