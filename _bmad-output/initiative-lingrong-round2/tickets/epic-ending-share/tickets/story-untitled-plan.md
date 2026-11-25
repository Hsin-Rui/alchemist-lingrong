---
title: '新封號與十日戰績計數'
type: feature
ticket: '1'
created: '2026-11-26'
status: built
baseline_revision: 'ec55ca588f0dd42fae2ee036b35d087c43a9b4ac'
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

**Problem:** 封號只有 12 個，第二輪新玩法（抄經、包捐代交、特性、投其所好）都沒有封號，也沒記次數，結局戰績寫不出 kuso 句。

**Approach:** S.stats 加次數（投其所好、親自交貨、包捐代交、完美成品、原著重現）；TITLE_CHECK 加 4 個新封號；TITLES 依 §9 第二輪排成 16 個；用模擬器看順位。

## Boundaries & Constraints

**Always:** 判定在引擎、有單元測試；評語與提示照 §9 第二輪一字不改；畫面不出現英文（零溶a 例外）。

**Never:** 不改既有 12 個封號的條件。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 米其林 | 成品特性 3 種都 3 級 | perfect +1、拿到 | — |
| 米其林差一級 | 3/3/2 | 不拿到 | — |
| 原著重現 | 舒痕膠＋麝香交給真環，沒被抓 | yuanzhu +1 | — |
| 原著重現被抓 | 同上但被抓 | 不算 | — |
| 原著重現別人 | 送審沒裝 | 不算 | — |
| 甘露寺 | 抄經 3 次 | 拿到；2 次不拿到 | — |
| 包捐本體 | 代交 3 張、親自 0 | 拿到；親自交過 1 次就不算 | — |
| 投其所好 | 拜訪收下、反應 love | loves +1；拒收不算 | — |

</frozen-after-approval>

## Code Map

- `js/engine.js` -- newState stats 加 loves／selfDeliver／proxyDeliver／perfect／yuanzhu；`bump`、`isPerfect`、`markYuanzhu`；craft／deliver／visit 記次數；TITLE_CHECK 加 yuanzhu／michelin／ganlu／baojuan。
- `js/data.js` -- TITLES 16 個。
- `js/game.js` -- #結局 測試頁的隨機戰績補新欄位。
- `tests/engine.test.js` -- 矩陣與 16 個封號順位。

## Tasks & Acceptance

**Execution:**
- [x] `js/engine.js` -- 次數與判定
- [x] `js/data.js` -- 16 個封號
- [x] `tests/engine.test.js` -- 矩陣

**Acceptance Criteria:**
- Given 任一新封號條件剛好達成，when 算結局，then 該封號出現；差一點就不出現。

## Implementation Notes

- 主 session 直接實作與自審。
- 原著重現的「得手」＝麝香沒被抓、也不是無效；親自交、代交、拜訪送禮都算。
- 模擬器（quick）：原著重現精算／高手約 2%，與麝香代言人同級；米其林、甘露寺、包捐本體機器人不會刻意做，順位照 §9 暫定。
- 驗證：node --test 110/110、simulate --quick。

## Plan Change Log

## Review Triage Log

- 第 1 輪（quick，主 session 自審）：high 0／medium 0／low 0。

## Verification

**Commands:**
- `node --test tests/` -- expected: 全部通過
- `node tools/simulate.js --quick` -- expected: 跑完無錯、新封號出現在統計
