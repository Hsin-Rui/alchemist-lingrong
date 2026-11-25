---
title: '結局畫面一：恩寵揭曉'
type: feature
ticket: '2'
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

**Problem:** 結局一頁塞滿，誰最受寵只有一行字，沒有儀式感。

**Approach:** 先進恩寵揭曉：太監宣旨、恩寵榜從第 4 名往第 1 名一條條長出來；零溶第一給大字＋壞笑立繪，對手第一給她得意立繪、零溶縮在旁邊、補零溶處境一句。

## Boundaries & Constraints

**Always:** 照範例稿 docs/round2/ending-mockup.html；台詞照 L 組；400px 寬與電腦都能看；鍵盤能走完；prefers-reduced-motion 下直接顯示。

**Never:** 不改封號判定（story 1）；不做後台。

</frozen-after-approval>

## Code Map

- `js/engine.js` -- computeEnding 回 `board`（依恩寵排序，平手零溶排後面，跟 rank 一致）。
- `js/game.js` -- `endStep`、`endingReveal()`；`endnext` 動作；`__e2e.ending(step)`。
- `css/style.css` -- `.rk*`、`.end-verdict`、`.end-hero`、`.end-cower`；動畫延遲用 CSS 變數，重繪也不會亂。
- `tools/shots.js`、`tools/keyboard-e2e.js` -- 截圖情境與畫面一→二。

## Implementation Notes

- 主 session 直接實作與自審。
- 大字／小字從 END_TOP 第一個逗號切開（零溶第一：大字＝「即日起改姓鈕祜祿！」；對手第一：大字＝「○○恩寵冠絕六宮」）。
- 零溶第一的第三行用範例稿那句「炎洗宮上下跪接聖旨，包捐哭成淚人。」（END_CROWD，台詞總表沒有，請使用者過目）。
- 太監宣旨用文字「聖旨到——」（照範例稿，沒放太監立繪）。

## Review Triage Log

- 第 1 輪（quick，主 session 自審）：high 0／medium 0／low 1。low・patch：對手第一時立繪壓到小字 → 判決文字加半透明底。

## Verification

**Commands:**
- `node --test tests/` -- expected: 全部通過
- `node tools/keyboard-e2e.js` -- expected: 全部通過
- `SHOT_W=400 node tools/shots.js <dir> end1-ling end1-rival end2-ling end2-rival` -- expected: 截圖照範例稿
