---
title: '調合演出'
type: feature
ticket: '4'
created: '2026-11-24'
status: built
baseline_revision: 'ed2841a2331474362bd1282ebdbf82cb66af08e1'
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

**Problem:** 四階段沒有演出，少了儀式感（§13.5）。

**Approach:** 一次性演出 craftFx（下一次重繪播完就清，避免重繪重播）：下鍋素材掉進鍋、點火（火焰＋勺子）、湯色隨特性漸層、攪拌時勺子攪動＋該特性顏色的泡泡升起、選料時零溶壞笑「嘿嘿……」、加料時料掉進鍋、完成視窗冒蒸氣＋特性徽章依序跳出。減少動態時關掉。

</frozen-after-approval>

## Implementation Notes

- 主 session 直接實作與自審，用 tools/shots.js 看過加料、起鍋、結果截圖。

## Review Triage Log

- 第 1 輪（quick，自審）：high 0／medium 0／low 2。
  - low・patch：勺子擋住鍋裡的成品名 → 移到右側。
  - low・patch：三個特性標籤直排會溢出鍋身、且跟湯色混在一起 → 改橫排換行、加深色外框。

## Verification

- `node --test tests/` 85/85；`node tools/keyboard-e2e.js` 157/157
