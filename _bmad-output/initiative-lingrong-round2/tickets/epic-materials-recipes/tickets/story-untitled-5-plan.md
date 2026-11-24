---
title: 'Refactor sweep'
type: chore
ticket: '5'
created: '2026-11-24'
status: built
baseline_revision: 'f6b79307e9d7a3a3df6be10db9e6e028768b9d60'
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

**Problem:** epic 1 換完素材後，文件與工具還留著舊素材的說法。

**Approach:** 只做整理：更新 game-design §12 的素材表、pixel-art-spec 的圖清單；確認測試、模擬器、gather-bot、e2e 都用新資料跑過。

</frozen-after-approval>

## Implementation Notes

- 模擬器與 e2e 的舊 id 已在 story 1 換掉；這裡只剩文件。
- 視覺檢查：e2e 截圖（調合畫面四格同一行、新素材與新料、訂單用新成品）沒有跑版。

## Review Triage Log

- 第 1 輪（quick，自審）：沒有發現。

## Verification

- `node --test tests/` 79/79、`node tools/simulate.js --quick`、`node tools/gather-bot.js`、`node tools/keyboard-e2e.js` 157/157
