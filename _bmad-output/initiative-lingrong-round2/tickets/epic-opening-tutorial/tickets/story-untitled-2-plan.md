---
title: '第一次被翻牌子的說明'
type: feature
ticket: '3'
created: '2026-11-25'
status: built
baseline_revision: '94a8c14d8d92224a4e7df9e95a5459b5c2587a0e'
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

**Problem:** 第一次被翻牌子時，玩家不知道可以唱金縷衣、也不知道唱了隔天會少一個時辰。

**Approach:** 零溶第一次被翻（沒禁足）的那天早上，公布之後包捐說 G4、零溶說 G5；只說一次、不分模式。

</frozen-after-approval>

## Implementation Notes

- oneshot；主 session 直接實作與自審。記在 `S.seenFlip`。
- 設計文件加 §15.4.1 記下 epic 5 的實作。
- 驗證：node --test 104/104（playthrough 強制兩天都翻到零溶：第一天有 G4–G5、第二天沒有）、keyboard-e2e 200/200、simulate --quick。

## Review Triage Log

- 第 1 輪（quick，主 session 自審）：high 0／medium 0／low 0。
