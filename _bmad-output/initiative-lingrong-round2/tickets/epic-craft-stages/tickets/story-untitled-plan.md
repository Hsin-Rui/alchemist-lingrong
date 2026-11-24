---
title: '四階段調合骨架'
type: feature
ticket: '1'
created: '2026-11-24'
status: built
baseline_revision: '5fc5eefcfbb9e3329c828444bab4ef4f23a1778b'
route: full
route_source: auto
risk: high
review: quick
review_source: pinned
lenses_ran: [quick-inline]
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 調合按一下就完成，沒有玩法（§13.3）。

**Approach:** 引擎加 potTraits、rollBubbles、stirTraits、finishZone、applyFinish、finalTraits，craft 收 stirs 與 finish；數值放 RULES.craft。畫面把調合拆成選素材→攪拌→加料→起鍋，最後一步才呼叫 E.craft（才扣素材與時辰）；下鍋後不能退出。

</frozen-after-approval>

## Code Map

- `js/data.js` -- RULES.craft（stirs、bubbles、bigChance、natureWeight、zones、beadMs）。
- `js/engine.js` -- 四階段純函式；craft 用 finalTraits。
- `js/game.js` -- newCraftSel、craftLots、craftPotTr、startCook、pickBubble、toFinish、beadPos/beadLoop/stopBead；craft() 畫面分四段；Esc 與快捷鍵在下鍋後無效；攪拌 1/2/3、起鍋 Space／Enter。
- `tools/keyboard-e2e.js` -- 鍵盤機器人會走完四步。

## Implementation Notes

- 主 session 直接實作與自審（使用者要求一路做完、最後一次驗收）。
- 抽泡泡的權重只看素材原本的特性，不看已挑的泡泡（避免越滾越單一）。
- 起鍋平手時依特性順序（香氣在甜蜜前）。

## Review Triage Log

- 第 1 輪（quick，自審）：沒有發現。

## Verification

- `node --test tests/` 83/83；`node tools/keyboard-e2e.js` 157/157
