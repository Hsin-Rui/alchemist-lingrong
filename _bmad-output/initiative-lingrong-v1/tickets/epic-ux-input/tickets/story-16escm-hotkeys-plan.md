---
title: '快捷鍵 1–6、Esc、M（hotkeys）'
type: feature
ticket: '2'
created: '2026-11-22'
status: built
baseline_revision: 'da81a3d'
route: oneshot
route_source: auto
risk: low
review: quick
review_source: pinned
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: true
context: ['{project-root}/_bmad-output/initiative-lingrong-v1/tickets/epic-ux-input/ux-ux-input/EXPERIENCE.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** 桌機沒有快捷鍵：切畫面、返回、關聲音都得移游標或用滑鼠。

**Approach:** 掛在 story 1 的共用鍵盤處理上：1–6 對應導覽列六個動作（小舖／採集／調合／送禮／後宮／就寢確認），只在主畫面與子畫面、沒有彈出視窗時有效；Esc（非對話）關彈出視窗（鎖定的金縷衣視窗無效）、結果單＝回炎洗宮、子畫面＝回主畫面；M 開關聲音。對話中、調合進行中（busy）、採集地下城中數字鍵無效。把點擊委派的 switch 抽成 `act(a, v)`，點擊與快捷鍵共用。

</intent-contract>

## Implementation Notes

oneshot：約 60 行，集中在 `js/game.js` 鍵盤處理與點擊委派。
- `act(a, v)`：原點擊 switch 搬出（含點擊音效），點擊與快捷鍵共用。
- `HOTKEYS`／`HOTKEY_SCREENS`（home＋五個子畫面）／`escBack()`；有任何 `.sheet-layer` 時數字鍵無效。
- M 在對話中也有效；採集地下城由其自有處理器接管，不受影響。
- 標題、夜晚總結、結局按 Esc 不動作（沒有「上一層」）；交貨／送禮結果頁 Esc＝回炎洗宮（審查後修正）。
- e2e 新增 14 條斷言（1–6、Esc 返回／關窗、金縷衣 Esc 與數字鍵無效、M、對話中數字鍵無效）。

## Verification

- `node --test tests/` -- 68/68。
- `node tools/simulate.js --quick` -- OK。
- `node tools/keyboard-e2e.js` -- 68/68 PASS（審查後）。

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 3 findings — high 0, medium 2, low 1, false 0, maybe-false 0
- findings:
  - `[medium]` `[patch]` 對話中按 M 會 render() 讓目前這句重新打字 — 對話中只呼叫 A.toggleMute() 不重繪；e2e 加斷言。
  - `[medium]` `[patch]` 在調合／送禮畫面按自己的數字鍵會清掉已選素材／對象 — 已在目標畫面時不重開（HOTKEY_TARGET）；e2e 加斷言。
  - `[low]` `[patch]` 交貨／送禮結果頁 Esc 無作用，與「返回上一層」不符 — escBack 加 result → resultdone；e2e 加斷言。

## Auto Run Result

- 摘要：1–6 快捷鍵、Esc 返回／關窗（金縷衣鎖定無效）、M 開關聲音；點擊委派抽成 act(a, v) 共用。
- 檔案：`js/game.js`（鍵盤處理、act、escBack）、`tools/keyboard-e2e.js`（+18 條斷言）。
- 審查：3 patch（2 medium、1 low），0 deferred，0 reject。
- Follow-up review：true（首輪 patch 2 個 medium）；未驗證風險＝act() 重構後各點擊路徑只靠回歸網與 e2e 間接覆蓋。
- 驗證：node --test 68/68；simulate --quick OK；keyboard-e2e 68/68。
