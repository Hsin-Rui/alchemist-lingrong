---
title: 'Refactor sweep'
type: chore
ticket: '6'
created: '2026-11-24'
status: built
baseline_revision: 'a2832f5f09a3b613b9c9ee139db14c949c0ea34c'
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

**Problem:** epic 2 的實作細節只在程式裡，設計文件沒寫。

**Approach:** 只做整理：把實作時定下的細節（泡泡權重、平手順序、下鍋後不能退出、快速調合記在瀏覽器）補進 game-design §13.4.1；確認模擬器（走快速調合路徑，craft 不帶 stirs）、gather-bot、e2e 都通過。

</frozen-after-approval>

## Implementation Notes

- 模擬器本來就呼叫 E.craft 不帶 stirs／finish，等於快速調合，不用改。

## Review Triage Log

- 第 1 輪（quick，自審）：沒有發現。

## Verification

- `node --test tests/` 85/85、`node tools/simulate.js --quick`、`node tools/gather-bot.js`、`node tools/keyboard-e2e.js` 175/175
