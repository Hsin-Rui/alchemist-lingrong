---
title: '小舖什麼都買得到，多的素材能賣'
type: feature
ticket: '4'
created: '2026-11-24'
status: built
baseline_revision: 'af0acafcf7258323bb380ff428d5fa36ab4d46ac'
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

**Problem:** 第二輪規定除紅花瓣外什麼都買得到，多的素材可以賣（§8）。

**Approach:** 小舖清單在 story 1 已換成全品項；這裡加引擎 sell／sellPrice（售價一半＋每級特性 1 兩，不花時辰；料與紅花瓣不收），小舖畫面分成素材、料、賣東西三區。

</frozen-after-approval>

## Implementation Notes

- 主 session 直接實作與自審；一般份一列、帶特性的每份各一列。

## Review Triage Log

- 第 1 輪（quick，自審）：沒有發現。

## Verification

- `node --test tests/` -- 79/79；`node tools/keyboard-e2e.js` -- 157/157
