---
title: '素材一份一份記，成品繼承特性'
type: feature
ticket: '2'
created: '2026-11-24'
status: built
baseline_revision: '6565697ef448dc47dbea388995e3590273db79f6'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick-inline]
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 素材只記數量，無法分辨哪一份帶特性；成品也沒有特性（§13.1–13.2）。

**Approach:** 引擎加 S.lots（帶特性的份），所有減素材走 takeUnit；調合自動挑特性最多的那份（也可指定 uid），成品帶合併後的特性；畫面顯示特性小標籤。

</frozen-after-approval>

## Code Map

- `js/engine.js` -- traitSum、bestLot、addUnit、takeUnit、mergeTraits；newState 加 lots/lotSeq；craft 用 lots、成品帶 tr。
- `js/game.js` -- trChips、lotCount；調合預覽、結果視窗、送禮列表、後宮頁顯示特性。
- `css/style.css` -- .trs／.trc 小標籤。

## Implementation Notes

- 主 session 直接實作與自審（理由同 story 1）。
- S.inv 仍是總數，舊程式碼不用改；不變式：lots 數 ≤ inv 數。

## Review Triage Log

- 第 1 輪（quick，自審）：high 0／medium 0／low 1。
  - low・patch：「n 份有特性」用琥珀色在米色抽屜上對比不足 → 改朱紅。

## Verification

- `node --test tests/` -- 76/76 通過
