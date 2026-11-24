---
title: '新配方、新素材與新料上線（含三素材調合）'
type: feature
ticket: '1'
created: '2026-11-24'
status: built
baseline_revision: 'f63539cffa6f856dd5e1c35f184a5ed0778c2f59'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick-inline]
review_loop_iteration: 0
context:
  - '{project-root}/docs/game-design.md'
  - '{project-root}/docs/round2/lines-review.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 遊戲還是第一輪的配方（安神香、養顏膏…）、素材（檀香、玫瑰…）和料（巴豆、癢癢粉、臭豆腐精華），跟第二輪定案的原作梗內容不符；調合也只能放兩樣素材，做不出歲寒三友茶。

**Approach:** 照 design §7、§8 換掉 data.js 的素材、配方、料、採集表與相關台詞；引擎的配方比對改成「兩或三樣素材的多重集合相等」；調合畫面多一格素材；訂單需求改成宮女開口；補新素材的地下城像素圖。素材份與特性（S.lots）留給 story 2。

## Boundaries & Constraints

**Always:** 引擎維持 DOM-free、有單元測試；遊戲畫面不出現英文、不出現「安嬪」；地下城、夜晚、結局流程不變。保留 id `cake`、`incense`、`tonic`、`jasmine`、`osmanthus`、`pearl`、`jujube`、`angelica`、`petal`、`liquor`、`musk`、`safflower`（舊圖示沿用）。

**Never:** 不做素材份／特性、不改被抓機率公式與基礎值（新料沿用 15%）、不做拜訪或包捐代交、不改小舖買賣（story 4）。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 兩素材配方 | 藕粉＋桂花（任意順序） | 藕粉桂花糖糕 | — |
| 三素材配方 | 松針＋竹葉＋梅花（任意順序） | 歲寒三友茶 | — |
| 三素材少一樣 | 松針＋竹葉 | 黑暗料理 | — |
| 兩素材配方多放一樣 | 藕粉＋桂花＋梅花 | 黑暗料理 | — |
| 煉紅花 | 紅花瓣＋烈酒 | 紅花進道具欄 | — |
| 新料出糗 | 木薯粉／貓薄荷下給今晚侍寢者 | 當晚侍寢出包，台詞用 F 組 | — |

</frozen-after-approval>

## Code Map

- `js/data.js` -- ITEMS（素材 12＋烈酒／紅花瓣＋料 4）、PRODUCTS（7＋紅花＋junk，reward/gift 照 §8）、NORMAL_ORDERS、SHOP、GATHER.table、RULES.startInv、RULES.fx、NEEDS（C1–C18）、request()（B12–B14，宮女開口）、DEBUFF_LINES／SERVE_FAIL／SERVE_FAIL_HS（F1–F14）、CHARS 加三位宮女（無立繪先用 face 字）。新增 TRAITS 定義與 ITEMS.nature（story 2/3 用，這裡只放資料）。
- `js/engine.js` -- `findRecipe(D, a, b)` → 改吃陣列；`craft` 消耗 2–3 樣；`predict`/`applySpike` 的出糗 label 改讀資料；`startDay` 不變。
- `js/game.js` -- 調合畫面 `craft()`、`openCraft`、`doCraft`、`unmat`/`mat` 動作：最多三格、兩格以上可開始；出糗名稱對照表（828、878 行）改讀資料；`#演出` 測試入口（1678–1691 行）換成新料。
- `js/pixelart.js` -- 新增 16×16 素材圖：pine、bamboo、lotus、pear、plum、motherwort、agarwood、jujube、pearl、cassava、liquor，稀有動畫 catnip_0/1；移除 rose、itch_*、croton；更新 anims、required。
- `tests/*.test.js`、`tools/simulate.js`、`tools/keyboard-e2e.js`、`tools/gather-bot.js` -- 舊 id 換新 id。

## Tasks & Acceptance

**Execution:**
- [ ] `js/data.js` -- 換資料與台詞 -- 內容以 design §7、§8 與台詞總表為準
- [ ] `js/engine.js` -- 多重集合配方比對、2–3 素材調合、出糗 label 讀資料 -- 支援歲寒三友茶
- [ ] `js/game.js` -- 調合三格、label 對照、演出入口 -- 畫面跟上資料
- [ ] `js/pixelart.js` -- 新素材像素圖 -- 地下城圖集不缺圖
- [ ] `tests/`、`tools/` -- 改用新 id，加 I/O 表的配方測試

**Acceptance Criteria:**
- Given 新開局，when 打開調合，then 素材抽屜是新素材、配方書列 7 道新配方。
- Given 早上有新訂單，when 播早上對話，then 由宮女（送吱／踩月／吹緊吸）用 B12–B14 的句型開口。
- Given 兩張地圖，when 進地下城，then 素材都是新表裡的、每個都有像素圖。

## Implementation Notes

- 直接在主 session 實作（沒有派子代理）；審查也由主 session 自己讀 diff 進行，因為使用者要一次做完 epic 1、沒有另外授權開子代理。
- 地下城素材表與像素圖原本排在 story 3，但換掉 ITEMS 後舊表會指向不存在的素材，所以併到這個 story（story 3 只剩擲特性）。
- 模擬器的勝率因為小舖什麼都買得到而上升（高手約 47%），數值平衡屬於 epic-visit-palaces。
- 驗證：node --test 73/73、simulate --quick、gather-bot、keyboard-e2e 157/157。

## Plan Change Log

## Review Triage Log

- 第 1 輪（quick，主 session 自審）：high 0／medium 0／low 1／false 0。
  - low・patch：調合畫面四格 56px＋間距超過鍋子寬 220px，料那格會掉到第二行 → 改成 50px。

## Design Notes

採集表：御花園 pine、bamboo、lotus、osmanthus、pear、jasmine、plum，稀有 catnip×2；太醫院 jujube、motherwort、angelica、pearl、agarwood、cassava、liquor、petal（權重低），稀有 musk×1。常見種類變多，extraItems 降為 [5,7]，總數與舊版相近。

## Verification

**Commands:**
- `node --test tests/` -- expected: 全部通過
- `node tools/simulate.js --quick` -- expected: 跑完無錯
- `node tools/gather-bot.js` -- expected: 跑完無錯
- `node tools/keyboard-e2e.js` -- expected: 全部通過
