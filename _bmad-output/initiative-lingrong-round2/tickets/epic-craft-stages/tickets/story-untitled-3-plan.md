---
title: '快速調合與特殊分支'
type: feature
ticket: '3'
created: '2026-11-24'
status: built
baseline_revision: '1a1271ff05c017a7fd1f76170f8950dd33d8dcee'
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

**Problem:** 每次都玩完四步太花時間（§13.3 快速調合）。

**Approach:** 第一步加「快速調合」開關（記在瀏覽器 lingrong-quickcraft）：下鍋直接到加料、加料完直接完成，成品只帶素材的特性。配錯直接黑暗料理、煉紅花直接完成、下鍋後不能退出——這三項在 story 1 已做好，這裡補測試。

</frozen-after-approval>

## Implementation Notes

- 主 session 直接實作與自審；步驟條把跳過的兩步劃掉。
- playthrough 測試的 bootGame 多回傳 win（沙盒的 window）以便擺狀態。

## Review Triage Log

- 第 1 輪（quick，自審）：沒有發現。

## Verification

- `node --test tests/` 85/85；`node tools/keyboard-e2e.js` 157/157
