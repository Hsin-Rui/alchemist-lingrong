---
title: '結局畫面二：封號蓋章與 kuso 戰績'
type: feature
ticket: '3'
created: '2026-11-26'
status: built
baseline_revision: 'b01d5d1a2a710809d5db7d4b55b6e89435f7a629'
route: full
route_source: auto
risk: low
review: quick
review_source: pinned
lenses_ran: [quick-inline]
review_loop_iteration: 0
context:
  - '{project-root}/docs/round2/ending-mockup.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 封號與戰績擠在同一頁，戰績只有四個數字，不好笑也不好分享。

**Approach:** 聖旨展開、主封號蓋章、加封一個個跳出；十日戰績挑最有梗的 4 條用 kuso 說法；分享到 FB／其他分享／再玩一次；封號冊收合在下方。

## Boundaries & Constraints

**Always:** 照範例稿 docs/round2/ending-mockup.html；台詞照 L 組；400px 寬與電腦都能看；鍵盤能走完；prefers-reduced-motion 下直接顯示。

**Never:** 不改封號判定（story 1）；不做後台。

</frozen-after-approval>

## Code Map

- `js/data.js` -- `END_STATS`（11 種戰績句，依序挑有發生的）、`END_CLEAN`（沒下料時「0 次下料，清清白白」）。
- `js/engine.js` -- `endingStats(D, S, max=4)`；computeEnding 回 `stats`。
- `js/game.js` -- `endingEdict()`；`book` 動作收合封號冊；蓋章音效在 700ms。
- `css/style.css` -- 舊的一頁式結局樣式換掉。

## Implementation Notes

- 主 session 直接實作與自審。
- 戰績句是新寫的（參考範例稿），驗收時請使用者過目。
- 「分享到 FB」按鈕先接 shareFb（開 FB 分享網址）；圖卡在 story 4。
- 預設焦點仍是「再玩一次」（e2e 檢查）。

## Review Triage Log

- 第 1 輪（quick，主 session 自審）：high 0／medium 0／low 0。

## Verification

**Commands:**
- `node --test tests/` -- expected: 全部通過
- `node tools/keyboard-e2e.js` -- expected: 全部通過
- `SHOT_W=400 node tools/shots.js <dir> end1-ling end1-rival end2-ling end2-rival` -- expected: 截圖照範例稿
