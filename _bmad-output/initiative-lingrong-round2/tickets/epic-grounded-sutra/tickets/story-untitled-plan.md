---
title: '抄經小遊戲與後宮心經'
type: feature
ticket: '1'
created: '2026-11-25'
status: built
baseline_revision: 'abe6c75d62ff1b9e7322870110a0318d85defb74'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick-inline]
review_loop_iteration: 0
context:
  - '{project-root}/docs/game-design.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 禁足時不能出門，常常沒事做。

**Approach:** 照 §15.5 加禁足限定的「抄經」：從 6 句宮鬥台詞隨機一句，字打亂成字塊依序點出，抄完得到《後宮心經》。

## Boundaries & Constraints

**Always:** 只有禁足時出現；花 1 個時辰（抄完才扣，中途離開不扣）；標點自動放好、不算字塊；點錯抖一下＋一滴墨漬、不卡關、沒有干擾字；書桌背景、抄經音樂、J1–J4 台詞；電腦 ←→＋Enter、手機點按。

**Never:** 不減刑；心經送禮的規則與台詞（story 2）；封號判定（epic 6）。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 抄完 | 禁足中，依序點完 | 手上多一本心經、時辰 +1、抄經次數 +1 | — |
| 沒禁足 | 呼叫抄經 | 不能抄 | 回 blocked、不扣時辰 |
| 點錯 | 點了不是下一個字的字塊 | 墨漬 +1、字塊抖、進度不變 | — |
| 句子 | 任一局 | 從 6 句其中一句、標點不在字塊裡 | — |

</frozen-after-approval>

## Code Map

- `js/data.js` -- `SUTRA_LINES`（6 句）；PRODUCTS 加 `sutra`（後宮心經，沒有配方、gift 5）；`SUTRA_TALK`（J1 開始、J2–J4 抄完）。
- `js/engine.js` -- `copySutra(D, S)`：沒禁足回 blocked；否則 slot++、`S.stats.sutras`++、手上加 `{ product: 'sutra', tr: {} }`；`sutraTiles(D, line, rand)`：去掉標點、打亂；newState 的 stats 加 sutras。
- `js/game.js` -- 主畫面禁足條加「抄經（1 時辰）」按鈕；新畫面 `sutra`：紙上顯示句子（已點的字、標點、空格），下方字塊 `data-a="tile"`；墨漬層；抄完播 J2–J4 回主畫面；進出換 bgm_sutra／main；背景 study。
- `css/style.css` -- 抄經畫面、字塊、抖動、墨漬。
- `tests/engine.test.js`、`tools/keyboard-e2e.js` -- 矩陣與鍵盤排一句。

## Tasks & Acceptance

**Execution:**
- [ ] `js/data.js`、`js/engine.js` -- 句子、心經、copySutra、sutraTiles -- 規則
- [ ] `js/game.js`、`css/style.css` -- 抄經畫面 -- 玩法
- [ ] `tests/engine.test.js`、`tools/keyboard-e2e.js` -- 測試

**Acceptance Criteria:**
- Given 禁足中，when 在主畫面按「抄經」並依序點完字，then 播 J2–J4、回主畫面、手上有《後宮心經》。
- Given 沒禁足，when 在主畫面，then 看不到抄經。

## Implementation Notes

- 主 session 直接實作與自審。
- 字塊上的數字鍵沒做：14 個字的句子放不下 1–9，數字鍵也跟導覽快捷鍵衝突；電腦用 ←→（方向鍵游標）＋Enter，符合 §15.5「←→ 選、Enter 確定」。
- 中途按返回／Esc 離開不扣時辰；抄完才 `E.copySutra`。背景 study、音樂 bgm_sutra，離開換回主題曲。
- 主畫面禁足條下面一顆「抄經（1 時辰）」；時辰用完就停用。
- 驗證：node --test 98/98、keyboard-e2e 181/181、手機寬度截圖（主畫面按鈕、抄經畫面墨漬與字塊）。

## Plan Change Log

## Review Triage Log

- 第 1 輪（quick，主 session 自審）：high 0／medium 0／low 2。
  - low・patch：主畫面抄經按鈕套到大按鈕樣式，太大 → 改成小按鈕、獨立一行。
  - low・patch：空格底線連成一條看不出幾個字 → 每格分開。

## Verification

**Commands:**
- `node --test tests/` -- expected: 全部通過
- `node tools/keyboard-e2e.js` -- expected: 全部通過
