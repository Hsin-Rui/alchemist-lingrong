---
title: 'Refactor sweep'
type: refactor
ticket: '6'
created: '2026-11-25'
status: built
baseline_revision: '88d59e769a060265dcac1121ec1e9412059f8503'
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

**Problem:** epic 3 與調合換模組後，留下舊送禮的別名、舊調合畫面的 CSS 與工具函式。

**Approach:** 只做清理：刪掉沒人用的程式與樣式，行為不變。

</frozen-after-approval>

## Implementation Notes

- 刪 `E.gift` 別名（#演出改用 `E.visit`）；刪 game.js 的 `liquid`、焦點框的 `LIGHT_INSET`（米色抽屜已不存在）。
- css/style.css 刪掉舊調合畫面專用的規則與用不到的 keyframes（627 → 507 行）；用腳本確認每個刪掉的 class 在 js／index.html 都沒有出現。
- 留著沒刪：引擎的 `rollBubbles`（有單元測試、規則文件仍引用；撈泡泡模組自己抽泡泡）。
- 驗證：node --test 96/96、simulate --quick、gather-bot、keyboard-e2e 175/175；主畫面、小舖、拜訪、調合、投其所好截圖正常。

## Review Triage Log

- 第 1 輪（quick，主 session 自審）：high 0／medium 0／low 0。
