---
title: '訂單與交貨：宮女、親自交、包捐代交、坐胎藥'
type: feature
ticket: '3'
created: '2026-11-25'
status: built
baseline_revision: '2c8e1a68c14e2a7b30bc496ca868f431b6d03eb5'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick-inline]
review_loop_iteration: 0
context:
  - '{project-root}/docs/game-design.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 交貨只有親自交、友好固定 +5，成品做得好不好沒差；禁足時訂單只能放到過期；滑妃從不點坐胎藥；包捐每天一句還是舊的。

**Approach:** 照 §14.4 加「包捐代交」（只拿賞銀、不加友好、不花時辰、禁足也能用），親自交友好改成 5＋每 3 級特性總和 +1；滑妃的普通訂單有機會換成坐胎藥；包捐每天一句換成台詞總表 H 組。

## Boundaries & Constraints

**Always:** 規則在引擎並有單元測試、注入 rand；數值在 data.js；台詞照 lines-review（D7、D8、H1、H3–H8）。

**Never:** 不改被抓公式（story 4）；H2（提到抄經）留給 epic 4，禁足時先照舊句。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 親自交、無特性 | 成品 tr {} | 友好 +5、花 1 時辰、賞銀照舊 | — |
| 親自交、特性 9 級 | tr {a:3,b:3,c:3} | 友好 +8 | — |
| 親自交、特性 5 級 | tr 總和 5 | 友好 +6 | — |
| 包捐代交 | 任何成品 | 賞銀照舊、友好 +0、不花時辰 | — |
| 禁足代交 | 禁足中 | 可以代交；親自交按鈕停用 | — |
| 代交加了料 | 成品有料 | 照交貨規則下料（可能被抓） | — |
| 滑妃坐胎藥 | 滑妃普通訂單、擲骰 < 機率 | 訂單成品是坐胎藥 | — |
| 有喜 | 對象有喜 | 照舊點安胎藥 | — |

</frozen-after-approval>

## Code Map

- `js/data.js` -- RULES：`deliverTraitStep: 3`（每 3 級 +1）、`zuotaiChance: 0.25`；`PROXY_LINES`（D7 出發、D8 回來）。
- `js/engine.js` -- `deliver(D, S, orderId, itemId, rand, how = 'self')`：`how === 'proxy'` 不 slot++、不加友好、result 帶 `proxy: true`；self 友好＝deliverFriend＋floor(traitSum/3)。`startDay` 生訂單：滑妃且沒懷孕時，抽完普通成品再擲一次 `zuotaiChance` 換成坐胎藥（只對滑妃多擲，其他人的骰序不變）。
- `js/game.js` -- `doDeliver(orderId, itemId, how)`；訂單卡備好時兩顆按鈕「送去○○宮（1 時辰）」「包捐代交」，禁足時只有代交可按、預設代交；調合出鍋的動作加「包捐代交」；結果頁代交顯示「包捐代交・賞銀」且沒有友好；`hintLine` 換 H 組。
- `tests/engine.test.js` -- 矩陣測試；原本 deliverFriend 測試跟著改。

## Tasks & Acceptance

**Execution:**
- [ ] `js/data.js` -- 新數值與 D7／D8 -- 集中
- [ ] `js/engine.js` -- deliver how、坐胎藥訂單 -- 規則
- [ ] `js/game.js` -- 代交按鈕、結果、H 組 -- 畫面
- [ ] `tests/engine.test.js` -- 矩陣 -- 驗證

**Acceptance Criteria:**
- Given 有備好的訂單，when 在主畫面，then 看得到親自送與包捐代交兩種，代交後時辰不變、只拿賞銀。
- Given 禁足中有備好的訂單，when 在主畫面，then 包捐說 H1，代交可以按。

## Implementation Notes

- 主 session 直接實作與自審。
- 代交的對話：D7（出發）→ 加了料就接加料結果 → D8（回來）；被抓時不接 D8。
- 調合出鍋多一顆「包捐代交」；代交不花時辰，所以不先檢查天黑。
- 主畫面預設：備好的訂單禁足時預設在「包捐代交」。
- H5 的地點優先寫採集地點（不是小舖），句尾補「或在小舖買」。
- 宮女下訂單的立繪：素材 commit 後 CHARS 的 imgs 已能載到，不必改程式。
- 驗證：node --test 93/93、keyboard-e2e 175/175、simulate --quick、order-ready／order-grounded 截圖。

## Plan Change Log

## Review Triage Log

- 第 1 輪（quick，主 session 自審）：high 0／medium 0／low 1。
  - low・patch：代交按鈕的「只拿賞銀」跟主文字擠在同一行 → 改成第二行小字。

## Verification

**Commands:**
- `node --test tests/` -- expected: 全部通過
- `node tools/simulate.js --quick` -- expected: 跑完無錯
- `node tools/keyboard-e2e.js` -- expected: 全部通過
