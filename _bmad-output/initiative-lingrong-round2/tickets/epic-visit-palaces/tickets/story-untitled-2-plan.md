---
title: '拜訪的反應演出與台詞'
type: feature
ticket: '2'
created: '2026-11-25'
status: built
baseline_revision: '2bce8601decac341ef286b9a5268b58b0b4f32f9'
route: full
route_source: auto
risk: low
review: quick
review_source: pinned
lenses_ran: [quick-inline]
review_loop_iteration: 0
context:
  - '{project-root}/docs/round2/lines-review.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 拜訪帶禮時，娘娘的反應只看得到結果頁的章；台詞仍是舊的收禮台詞，拒收台詞也還是舊字，嫌棄立繪沒用上。

**Approach:** 依台詞總表 E 組接上進門之後的反應台詞（普通／投其所好／嫌棄／又愛又嫌）與新的拒收台詞；嫌棄、又愛又嫌用 meh 立繪；投其所好有花瓣與大字；拒收時零溶尷尬、禮物彈回。

## Boundaries & Constraints

**Always:** 台詞一字照 lines-review 定稿（E7–E22、E26–E28）；不給喜好暗示；稱呼規則（安妹妹）；prefers-reduced-motion 下演出收斂。

**Never:** 不做心經的收禮台詞（E23–E25，epic 4）；不改公式。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 投其所好 | 反應 love | 該妃 E10–E12＋結果頁花瓣與「投其所好！友好 +N」 | — |
| 嫌棄（成品） | 滑妃收安胎藥／真環收坐胎藥 | 用該成品專屬句 E14／E17，meh 立繪 | — |
| 嫌棄（特性） | 其他嫌棄 | 該妃的一般嫌棄句 E13／E15／E16 | — |
| 又愛又嫌 | 反應 mixed | E26–E28，meh 立繪 | — |
| 拒收 | 收禮骰沒過 | E18／E20／E21＋E22 內心話，零溶尷尬臉，禮物彈回 | — |

</frozen-after-approval>

## Code Map

- `js/data.js` -- CHARS 三位妃嬪 imgs 加 `meh`；新增 `VISIT_REACT[who] = { plain, love, hate, hateP: { product: lines }, mixed }`；REFUSE 換成 E18／E20／E21＋E22。
- `js/game.js` -- `doVisit` 帶禮收下時：進門＋反應句＋（有料且非 plain 才接 `outcomeLines`）；result 畫面：love 加花瓣層與大字，hate／mixed 用 meh 立繪，refused 用零溶 shock 立繪＋禮物彈回。
- `css/style.css` -- 花瓣飄落、大字、禮物彈回動畫；reduced-motion 關掉。
- `tools/shots.js` -- 情境：visit-love、visit-hate、visit-refused。

## Tasks & Acceptance

**Execution:**
- [ ] `js/data.js` -- 台詞與立繪 -- 定稿台詞
- [ ] `js/game.js` -- 反應對話與結果頁演出 -- 玩家看得出反應
- [ ] `css/style.css` -- 演出動畫 -- 有感
- [ ] `tests/engine.test.js` 或 playthrough -- 反應台詞選擇的測試 -- 驗證矩陣

**Acceptance Criteria:**
- Given 任一反應，when 拜訪結束，then 結果頁立繪、章與台詞一致，且畫面沒有「安嬪」或英文。

## Implementation Notes

- 主 session 直接實作與自審（同 epic 1、2）。
- 反應句選擇放在 game.js 的 `visitReact`；拒收時結果頁換成零溶尷尬臉＋禮物彈回；投其所好時隱藏章、改用花瓣與大字。
- 真環拒收用 happy 立繪（她是笑著送客）；滑妃、審沒裝拒收用 meh。
- shots.js：visit-love、visit-hate、visit-refused（拒收情境直接擺 S.result，避免擲骰）。
- 驗證：node --test 91/91、keyboard-e2e 175/175、三張情境截圖。

## Plan Change Log

## Review Triage Log

- 第 1 輪（quick，主 session 自審）：high 0／medium 0／low 0。

## Verification

**Commands:**
- `node --test tests/` -- expected: 全部通過
- `node tools/keyboard-e2e.js` -- expected: 全部通過
- `SHOT_W=400 node tools/shots.js <dir> visit-love visit-hate visit-refused` -- expected: 三張截圖演出正確
