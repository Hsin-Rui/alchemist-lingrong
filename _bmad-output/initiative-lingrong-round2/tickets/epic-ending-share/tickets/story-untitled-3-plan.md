---
title: '分享圖卡與分享按鈕'
type: feature
ticket: '4'
created: '2026-11-26'
status: built
baseline_revision: '671c0ebf4e1b83d8a88ff7b0aeb76cfc5939c78b'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick-inline]
review_loop_iteration: 0
context:
  - '{project-root}/docs/game-design.md'
  - '{project-root}/docs/round2/ending-mockup.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 分享只會丟一行文字＋網址，FB 預覽沒有圖，玩家沒東西可以炫耀。

**Approach:** canvas 畫 1200×630 圖卡（遊戲名、主封號、評語、戰績標籤、零溶立繪、網址）；手機系統分享帶圖檔，不支援就下載 PNG；「分享到 FB」開 FB 分享網址；index.html 加 og 標籤與固定 og 圖。

## Boundaries & Constraints

**Always:** 圖卡內容同範例稿；不送任何資料到外部（除了玩家自己按的 FB 分享視窗）。

**Never:** 不做後台、不依每局產生 FB 預覽（下一個 iteration）。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 手機可分享檔案 | navigator.canShare({files}) | 系統分享：圖卡＋文字＋網址 | 使用者取消 → 不提示 |
| 電腦 | 不支援分享檔案 | 按鈕叫「存下圖卡」、下載 PNG、toast | — |
| 畫不出圖 | canvas 例外 | 退回分享文字／複製文字 | — |
| 分享到 FB | 任何環境 | 開 FB sharer，分享遊戲網址 | — |

</frozen-after-approval>

## Code Map

- `js/sharecard.js` -- ShareCard.draw／toBlob（等字型、背景、立繪載好再畫；封號太長自動縮字；評語最多 3 行）。
- `js/game.js` -- `canShareFiles`、`cardData`、`share()`、`shareFb()`、`GAME_URL`；`__e2e.card()`。
- `index.html` -- og 標籤、載 sharecard.js。
- `assets/og.jpg` -- 固定 og 圖（tools/shots.js 的 og 情境產出）。
- `tools/shots.js`、`tools/keyboard-e2e.js` -- 圖卡截圖與檢查。

## Implementation Notes

- 主 session 直接實作與自審。
- 遊戲網址用 https://hsin-rui.github.io/alchemist-lingrong/（範例稿上的網址）；部署網址不同的話要改 GAME_URL 與 og 標籤。
- 圖卡戰績標籤＝恩寵名次＋十日戰績前 3 條的短標籤。

## Review Triage Log

- 第 1 輪（quick，主 session 自審）：high 0／medium 0／low 1。low・patch：og 圖右上角重複遊戲名 → og 圖不放右上字。

## Verification

**Commands:**
- `node --test tests/` -- expected: 全部通過
- `node tools/keyboard-e2e.js` -- expected: 全部通過（含圖卡 1200×630、存下圖卡按鈕）
- `SHOT_W=1200 node tools/shots.js <dir> card-ling card-rival og` -- expected: 圖卡照範例稿
