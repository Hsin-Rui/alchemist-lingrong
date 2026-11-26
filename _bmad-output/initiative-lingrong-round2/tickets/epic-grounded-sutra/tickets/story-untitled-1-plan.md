---
title: '心經送禮與禁足提示'
type: feature
ticket: '2'
created: '2026-11-25'
status: built
baseline_revision: '5da700fdffc18f13324d321e61a5984731eb0572'
route: oneshot
route_source: auto
risk: low
review: quick
review_source: pinned
lenses_ran: [quick-inline]
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 《後宮心經》拜訪時還照一般伴手禮擲收禮骰、看喜好；禁足時包捐的提示沒提到抄經；第一次禁足沒有說明。

**Approach:** 心經固定友好 +5、一定收下（E23–E25）；禁足提示換成 H2；第一次被禁足時，結果頁回宮後播 G6–G8。

</frozen-after-approval>

## Implementation Notes

- oneshot：改動小（engine visit 一個分支、data 台詞、game 兩處）。主 session 直接實作與自審。
- 心經用成品旗標 `fixedGift`（data.js）判斷；結果 reaction 記成 'fixed'，台詞 VISIT_REACT[who].fixed（E23–E25）。
- 第一次禁足：被抓的結果頁按「回炎洗宮」時播 G6–G8（記在 S.seenGrounded）。keyboard-e2e 的兩個被抓結果頁檢查跟著改成先看到說明再回宮。
- 驗證：node --test 99/99、keyboard-e2e 182/182、simulate --quick。

## Review Triage Log

- 第 1 輪（quick，主 session 自審）：high 0／medium 0／low 0。

## Verification

**Commands:**
- `node --test tests/` -- expected: 全部通過
- `node tools/keyboard-e2e.js` -- expected: 全部通過
