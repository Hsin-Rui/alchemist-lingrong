---
title: '鍵盤與手機操作'
type: feature
ticket: '5'
created: '2026-11-24'
status: built
baseline_revision: '48c06f17c1ace6708a115b8918bf755b2047a1a2'
route: oneshot
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

**Problem:** 四階段要電腦鍵盤和手機都順手（initiative Constraints）。

**Approach:** 每一步換階段時游標回該步的預設（配方 → 下鍋 → 第一顆泡泡 → 不加料 → 起鍋）；攪拌 1/2/3、起鍋 Space／Enter；下鍋後 Esc 與導覽快捷鍵無效。鍵盤 e2e 加一整段四階段與快速調合檢查；手機寬度（360px）截圖檢查，窄螢幕縮小鍋上的格子。

</frozen-after-approval>

## Implementation Notes

- 主 session 直接實作與自審。
- tools/shots.js 加 SHOT_W 環境變數模擬手機寬度。

## Review Triage Log

- 第 1 輪（quick，自審）：high 0／medium 1／low 1。
  - medium・patch：選了配方後游標還停在配方上（沿用「上一個 key 還在就留著」），要多按才到下鍋 → 換配方／換階段時清掉游標 key。
  - low・patch：360px 寬時「料」那格貼到右邊 → 窄螢幕縮小格子與鍋子位移。

## Verification

- `node --test tests/` 85/85；`node tools/keyboard-e2e.js` 175/175
