---
title: '新開場與教學選項'
type: feature
ticket: '1'
created: '2026-11-25'
status: built
baseline_revision: 'c15c2252e9537cae6d61b0240416141e76d9869f'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick-inline]
review_loop_iteration: 0
context:
  - '{project-root}/docs/round2/lines-review.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 開場還是第一輪的一長串說明，老玩家也得看完；新玩家看完也不知道第一步要做什麼。

**Approach:** 開場換成 §15.1 的短對話，最後問要不要教學；選「不用了」直接開始，選「好」播 A9–A21（含小恩寵榜），並把第一天擺成教學局面（沒有桂花、只有真環的糖糕訂單）。

## Boundaries & Constraints

**Always:** 台詞照 A2–A21 一字不改（A1 是舞台指示，用淡入表現）；選項在對話框裡，電腦 ←→／↑↓＋Enter、手機點按都能選；選項那一句不能用 Esc 略過。

**Never:** 第一天的逐步引導（story 2）；第一次被翻牌子（story 3）。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 不用了 | 開新局選「不用了」 | A7–A8 → 第一天照常（隨機訂單），沒有教學狀態 | — |
| 好 | 開新局選「好，妳說吧」 | A9–A17（A10 彈小恩寵榜、A16 零溶往上跳一格）→ 早上公布 → A18–A21；手上沒有桂花；訂單只有真環的藕粉桂花糖糕 | — |
| 再玩一次 | 結局按再玩一次 | 一樣先播開場與選項 | — |

</frozen-after-approval>

## Code Map

- `js/data.js` -- `OPENING`（A2–A6，A6 帶 choice）、`NO_TUTORIAL`（A7–A8）、`TUT_INTRO`（A9–A17，A10 panel rank、A16 panel rankup）、`TUT_ORDER`（A18–A21）；拿掉舊 `TUTORIAL`。
- `js/engine.js` -- `setupTutorial(D, S)`：`S.tutorial = { step: 'gather' }`、清掉桂花（數量與帶特性的份）、訂單換成真環的糖糕一張。
- `js/game.js` -- `startGame` 改成 OPENING → 選項 → 兩條路；對話行支援 `opt.choice`（對話框裡兩顆按鈕 `data-a="dlgchoice"`，←→↑↓ 換、Enter 確定，Esc 無效）與 `opt.panel`（小恩寵榜疊在對話上）；教學第一天的早上對話把新訂單句換成 TUT_ORDER。
- `css/style.css` -- 選項按鈕、小恩寵榜與往上跳的動畫。
- `tests/engine.test.js`、`tests/playthrough.test.js`、`tools/keyboard-e2e.js` -- 兩條路都測；舊測試裡略過開場的步驟跟著改。

## Tasks & Acceptance

**Execution:**
- [ ] `js/data.js`、`js/engine.js` -- 台詞、setupTutorial -- 資料與規則
- [ ] `js/game.js`、`css/style.css` -- 選項、小恩寵榜、兩條路 -- 畫面
- [ ] 測試 -- 兩條路

**Acceptance Criteria:**
- Given 標題頁，when 按開始遊戲，then 先看到 A2–A6，最後一句有兩個選項，Esc 不會跳過選項。

## Implementation Notes

- 主 session 直接實作與自審。
- 對話支援 `opt.choice`（選項，最後一句；略過整段會停在這句、Esc 無效、←→ 只換高亮不重打字）與 `opt.panel`（小恩寵榜，A10／A11 顯示、A16 零溶往上跳一格，只是演出）；開場第一句對話層淡入（A1）。
- startDay(tut)：教學第一天在 E.startDay 之後呼叫 E.setupTutorial，早上的新訂單句換成 A18–A21。
- 測試：playthrough 的自動玩機器人與 keyboard-e2e 的觸控機器人學會選選項；tools/shots.js 開局選「不用了」。
- 驗證：node --test 103/103、keyboard-e2e 189/189、開場選項與恩寵榜截圖。

## Plan Change Log

## Review Triage Log

- 第 1 輪（quick，主 session 自審）：high 0／medium 0／low 2。
  - low・patch：恩寵榜套到蓋章動畫，被旋轉、跑出畫面 → 改用自己的淡入動畫、置中。
  - low・patch：字還在打時方向鍵沒反應 → 方向鍵隨時能換，Enter 先把字打完。

## Verification

**Commands:**
- `node --test tests/` -- expected: 全部通過
- `node tools/keyboard-e2e.js` -- expected: 全部通過
