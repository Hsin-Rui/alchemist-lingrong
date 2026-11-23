---
title: '對話速度、略過與防連按（dialog-speed）'
type: feature
ticket: '3'
created: '2026-11-22'
status: built
baseline_revision: 'ee04c3c'
route: oneshot
route_source: auto
risk: low
review: quick
review_source: pinned
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: ['{project-root}/_bmad-output/initiative-lingrong-v1/tickets/epic-ux-input/ux-ux-input/EXPERIENCE.md', '{project-root}/_bmad-output/initiative-lingrong-v1/tickets/epic-ux-input/ux-ux-input/DESIGN.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** 對話只有一種速度，快轉鈕叫「快轉」；高潮句容易被連按跳過。

**Approach:** 依 EXPERIENCE「對話／對話速度／略過／防連按」：兩段速度 2×（約每秒 70 字，預設）與瞬間，Shift 單獨按放或點「▶ 2×／瞬間」膠囊按鈕（在「略過 ≫」左邊同列、≥40px）切換，不記住；Esc 或「略過 ≫」跳過整段、不受防連按影響；被抓、加料得手、早上翻牌子三句整句顯示，0.6 秒內按鍵與點擊無效、▼ 之後才出現；開場教學不擋。

</intent-contract>

## Implementation Notes

oneshot：約 90 行，`js/game.js`、`css/style.css`。
- 對話行可帶第 4 個元素 `{ lock: true }`；`lockLine()` 複製後加上，不改資料表。
- 「加料得手的那一句」：SPIKE_HIT 結果（出糗、麝香 n/3、麝香落空〔劑量仍累積〕、不孕、小產）中，第一句旁白或受害者 `oops`；都沒有取零溶奸笑句（例：麝香 n/3 → 「（麝香 n/3……）」、腹瀉 → 「本宮先失陪一下——！」）。被抓＝CAUGHT 第一句「且慢！」。早上＝寶娟翻牌子句。
- 2× 打字間隔 14ms（原 28ms）。
- Shift：capture 階段追蹤「只按了 Shift」，keyup 時切換；有其他鍵或點擊介入就不算。
- 倍速切換不重繪（避免重打目前這句）；切到瞬間時把正在打的句子補完。
- e2e 新增 15 條斷言；整輪自動玩的迴圈在鎖定句時等待解鎖。

## Verification

- `node --test tests/` -- 68/68。
- `node tools/simulate.js --quick` -- OK。
- `node tools/keyboard-e2e.js` -- 83/83 PASS。

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 1 findings — high 0, medium 0, low 1, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` 麝香落空（劑量仍累積、顯示麝香 n/3）沒有防連按 — SPIKE_HIT 加 musk_miss，hitIndex 無奸笑句時退回零溶那句。

## Auto Run Result

- 摘要：對話 2×／瞬間（Shift 單按或倍速鈕）、「略過 ≫」與 Esc 跳過整段、三種高潮句 0.6 秒防連按。
- 檔案：`js/game.js`（速度、鎖定句、Shift、Esc）、`css/style.css`（按鈕列、鎖定時隱藏 ▼）、`tools/keyboard-e2e.js`（+17 條斷言）。
- 審查：1 patch（low），0 deferred，0 reject。Follow-up review：false。
- 驗證：node --test 68/68；simulate OK；keyboard-e2e 83/83。
