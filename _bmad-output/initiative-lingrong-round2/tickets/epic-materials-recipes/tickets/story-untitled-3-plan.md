---
title: '採集來的素材帶特性'
type: feature
ticket: '3'
created: '2026-11-24'
status: built
baseline_revision: 'dcca512188917c901caf808feee775610c46ddb7'
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

**Problem:** 採集回來的素材跟小舖買的一樣，沒有理由去採（§13.2）。

**Approach:** 地下城擺好素材後依本性與離出生點的遠近擲特性；撿起來記進 run.haul，結算時照份放進包包，帶特性的進 S.lots；結算畫面顯示特性。

</frozen-after-approval>

## Code Map

- `js/engine.js` -- rollTraits；gGenerate 擺完素材後擲特性；gatherStep 撿取寫 haul、pick 事件帶 tr；applyGatherHaul 收 haul。
- `js/game.js` -- 結算時傳 run.haul；採集結算卡片顯示特性。

## Implementation Notes

- 主 session 直接實作與自審。
- 擲特性放在擺完素材之後，素材位置的擺法不受影響。
- 模擬器仍用 got 數量放一般份；特性對平衡的影響留給 epic-visit-palaces 的模擬 story。

## Review Triage Log

- 第 1 輪（quick，自審）：high 0／medium 0／low 1。
  - low・patch：採集卡片固定高度 116px，加上特性標籤會溢出 → 改 min-height。

## Verification

- `node --test tests/` -- 78/78；`node tools/gather-bot.js` 跑完
