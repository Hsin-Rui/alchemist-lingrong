---
title: '新的加料規則與貓咪鬧場'
type: feature
ticket: '4'
created: '2026-11-25'
status: built
baseline_revision: 'b3a896f34825b8070c41089129be683db750d1f3'
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

**Problem:** 被抓機率不看成品特性；加料的禮只能送今晚侍寢的人；木薯粉、貓薄荷送誰都立刻扣恩寵；貓咪鬧場沒有貓。

**Approach:** 照 §14.5 改被抓機率（新基礎值、遮掩分壓低到最低 8%、再乘友好與交貨倍率）；拜訪時加料的禮誰都能收；木薯粉、貓薄荷只對當晚侍寢的人有效，其他人白費；夜晚貓咪鬧場加貓咪立繪與貓叫。

## Boundaries & Constraints

**Always:** 規則在引擎、注入 rand、有單元測試；數值在 data.js；送出前畫面不提醒「白費」（§14.1），送出後結果頁照「無效」顯示讓玩家自己發現。

**Never:** 不改麝香、紅花本身的效果；不改模擬器策略（story 5）。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 遮掩壓到下限 | 紅花 45%，濃郁 3 香氣 3 甜蜜 3，友好 80，送禮 | 45%×max(.08/.45…)→12.6%×0.2≈2.5% | — |
| 遮掩一般 | 麝香 12%，遮掩分 5，友好 10 的滑妃，送禮 | 8.4%×0.9≈7.6% | — |
| 下限 8% | 木薯粉 18%，遮掩分 12 | 遮掩後 8%（不是 18%×0.28） | — |
| 交貨再減半 | 任何料走交貨 | 再 ×0.5 | — |
| 加料禮送非侍寢者 | 拜訪滑妃，今晚真環侍寢，禮加了麝香 | 照常擲收禮與被抓，可以得手 | — |
| 木薯粉給非侍寢者 | 今晚不是她侍寢 | outcome debuff_useless、不扣恩寵、夜晚不出包 | — |
| 木薯粉給侍寢者 | 今晚是她侍寢 | 照舊扣恩寵、夜晚出包 | — |

</frozen-after-approval>

## Code Map

- `js/data.js` -- ITEMS catch 改 0.12／0.45／0.18／0.18；RULES 加 `maskFloor: 0.08`、`maskStep: 0.06`、`maskWeights: { nong: 2, xiang: 1, tian: 1 }`；CHARS 加 `cats`（立繪 cats）；`DEBUFF_WASTED`（零溶發現白下的內心話）。
- `js/engine.js` -- `catchChance(D, S, who, spike, via, tr)`、`maskScore(D, tr)`；`applySpike(..., rand, tr)`、`predict(..., tr)` 帶成品特性；deliver／visit 傳 item.tr；debuff 料對象不是 S.flip → `debuff_useless`（useless、不扣恩寵、不設 c.debuff）；visit 拿掉 blocked。
- `js/game.js` -- doVisit 拿掉加料限制與 toast；拜訪成品列拿掉「只能送今晚侍寢」字樣，預測帶 item.tr；`outcomeLines` 處理 debuff_useless（白天反應＋零溶發現白下）；夜晚貓薄荷出包前加貓咪那句（opt.sfx 'meow'）；startTyper 支援 opt.sfx；#演出 加 debuff_useless 與貓咪鬧場入口。
- `tests/engine.test.js` -- 矩陣；舊的被抓率測試數字跟著新基礎值改。

## Tasks & Acceptance

**Execution:**
- [ ] `js/data.js` -- 新數值、貓咪、台詞 -- 集中
- [ ] `js/engine.js` -- 遮掩、白費、放寬 -- 規則
- [ ] `js/game.js` -- 拜訪放寬、白費台詞、貓咪演出 -- 畫面
- [ ] `tests/engine.test.js` -- 矩陣與既有測試 -- 驗證

**Acceptance Criteria:**
- Given 今晚某人侍寢，when 拜訪另一人送加料的禮，then 不會被擋。
- Given 某妃今晚因貓薄荷出包，when 播夜晚對話，then 有貓咪立繪與貓叫。

## Implementation Notes

- 主 session 直接實作與自審。
- 新增一句不在台詞總表的內心話 `DEBUFF_WASTED`：「（……今晚又不是她侍寢。白下了。）」——送出後才讓玩家發現白費；要請使用者過目。
- 預測文字：對象不是今晚侍寢的人時只顯示料名（不寫「今晚出包」，也不提醒白費）。
- 調合裡的料清單還不知道成品特性，預測照「沒遮掩」顯示；拜訪的成品列會帶成品特性算。
- 對話行支援 `opt.sfx`（貓叫）；#演出 加 debuff_useless、cats_night。
- 模擬器：高手的封號分布有變（新被抓率），數值平衡在 story 5。
- 驗證：node --test 96/96、keyboard-e2e 175/175、simulate --quick。

## Plan Change Log

## Review Triage Log

- 第 1 輪（quick，主 session 自審）：high 0／medium 0／low 0。

## Verification

**Commands:**
- `node --test tests/` -- expected: 全部通過
- `node tools/simulate.js --quick` -- expected: 跑完無錯
- `node tools/keyboard-e2e.js` -- expected: 全部通過
