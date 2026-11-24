---
title: '配方冊與選用哪一份素材'
type: feature
ticket: '2'
created: '2026-11-24'
status: built
baseline_revision: 'a230f8fdcd01d8dd0aac5c34f05ef39a72235879'
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

**Problem:** 看了配方還要自己記、自己點素材；同種素材的哪一份要用也沒得選（§13.3 第一階段）。

**Approach:** 第一步改成配方冊（每道標可以做／缺什麼，點了自動放素材），下面列每種素材的一般份與帶特性的各份可挑；保留「自由調合」。引擎的 lots 支援 0＝指定用一般份。

</frozen-after-approval>

## Code Map

- `js/engine.js` -- takeUnit：指定的份不存在（含 PLAIN=0）時退回「先一般份」。
- `js/game.js` -- PLAIN、craftLots 回 resolved；第一步分配方冊／自由調合兩種面板；動作 recipe、lot、freecraft。
- `css/style.css` -- .rrow、.pill、.lotopt、.linkbtn。
- `tools/shots.js` -- 新的情境截圖工具（node tools/shots.js <資料夾> [劇本]）。
- `tools/keyboard-e2e.js` -- 素材格檢查改在自由調合裡做。

## Implementation Notes

- 主 session 直接實作與自審；用 tools/shots.js 看過配方冊、攪拌、起鍋、結果、小舖的截圖。

## Review Triage Log

- 第 1 輪（quick，自審）：high 0／medium 0／low 1。
  - low・patch：用配方冊調合時標題仍寫「自由調合」→ 改成「調合・成品名」。

## Verification

- `node --test tests/` 84/84；`node tools/keyboard-e2e.js` 157/157
