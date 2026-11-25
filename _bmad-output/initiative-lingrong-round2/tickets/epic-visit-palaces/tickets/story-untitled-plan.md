---
title: '拜訪各宮與新的友好公式'
type: feature
ticket: '1'
created: '2026-11-25'
status: built
baseline_revision: '197bf0650e56516105d8a82d90c1b9c98f379218'
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

**Problem:** 送禮只看成品固定的禮物值，誰收都一樣；也不能空手去走動。§14 要改成拜訪各宮：每人有藏起來的喜好，同一份禮送不同人友好不同。

**Approach:** 引擎加喜好資料、友好公式、反應分類、新的收禮機率與 `visit`；畫面「送禮」整個改名為「拜訪」，可以空手去或帶一份成品。

## Boundaries & Constraints

**Always:** 規則在 DOM-free 引擎、注入 rand、有單元測試；喜好與數值在 data.js（§14.2、§14.3）；畫面不給任何喜好暗示（不顯示預估友好、不記錄喜好）；不出現英文與「安嬪」。

**Never:** 不做投其所好花瓣、嫌棄立繪、拒收彈回等演出與 E 組反應台詞（story 2）；不改交貨（story 3）；不改被抓公式、也還不放寬「加料的禮只能送今晚侍寢的人」（story 4）。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 投其所好 | 神仙玉女粉・華麗 3 → 滑妃 | 友好 +13，反應 love | — |
| 投其所好 | 藕粉桂花糖糕・甜蜜 2 清雅 1 → 審沒裝 | +10，love | — |
| 嫌棄（特性） | 梨花帳中香・濃郁 2 → 真環 | +6，hate | — |
| 嫌棄（成品） | 安胎藥（無特性）→ 滑妃 | +5，hate，收禮機率＝友好＋30−20 | — |
| 又愛又嫌 | 坐胎藥・華麗 1 → 審沒裝 | mixed，收禮機率不扣 | — |
| 普通 | 舒痕膠（無特性）→ 滑妃 | plain，友好＝基本值 8 | — |
| 友好最低 0 | 討厭特性等級高到算出負數 | 友好 +0 | — |
| 空手 | 拜訪不帶禮 | 花 1 時辰、友好 +1、不擲收禮骰 | — |
| 黑暗料理 | 送 junk | 不能送 | 回 noItem |

</frozen-after-approval>

## Code Map

- `js/data.js` -- 新增 `PREFS`（§14.2，likeT／hateT／likeP／hateP）並匯出；RULES 加 `giftCoef: { like: 1.2, plain: 1, hate: 0.8 }`、`hateAcceptPenalty: 20`、`visitEmptyFriend: 1`。成品基本值沿用 `PRODUCTS[*].gift`（已是價值 ÷ 3）。
- `js/engine.js` -- 新增 `giftReaction(D, who, product, tr)` → `{ kind: 'love'|'hate'|'mixed'|'plain', net }`、`giftFriend(D, who, product, tr)`（四捨五入、最低 0）、`acceptChance(D, S, who, kind)`（kind 為 hate 再扣）；`gift` 改寫為 `visit(D, S, who, handId|null, rand)`：handId 空＝空手；S.result 加 `reaction`、`empty`。保留 `gift` 當 `visit` 的別名給模擬器（story 5 再改）。現有 spike 限制（blocked）保留。
- `js/game.js` -- `doGift`→`doVisit`；`views.gift` 改成拜訪畫面（標題「拜訪各宮」；選人卡只顯示友好與基本收禮機率；「空手拜訪」按鈕＋成品列「帶這份去」，列上不顯示預估友好）；底部導覽與首頁卡片的「送禮」改「拜訪」；result 畫面處理空手（「空手拜訪」友好 +1）與反應字（投其所好／嫌棄／又愛又嫌）。空手的對話先用 data.js 新增的 `VISIT_ENTER`（E1–E3）＋`VISIT_EMPTY`（E4–E6）。
- `tests/engine.test.js` -- 舊 gift 測試改成 visit；加矩陣測試。
- `tools/keyboard-e2e.js` -- 若有寫死「送禮」字樣或 giftto 流程，跟著改。

## Tasks & Acceptance

**Execution:**
- [ ] `js/data.js` -- PREFS、RULES 新值、VISIT_ENTER／VISIT_EMPTY 台詞 -- 喜好與數值集中
- [ ] `js/engine.js` -- giftReaction、giftFriend、acceptChance(kind)、visit（含空手）、gift 別名 -- 規則可測
- [ ] `js/game.js` -- 拜訪畫面、doVisit、文字改名、結果畫面 -- 玩家能拜訪
- [ ] `tests/engine.test.js` -- 矩陣每列一個測試，舊 gift 測試改寫 -- 驗證公式

**Acceptance Criteria:**
- Given 主畫面，when 按「拜訪」（或快捷鍵 4），then 進拜訪畫面、可選三位娘娘、可以空手或帶一份成品。
- Given 空手拜訪，when 確認，then 花 1 時辰、友好 +1、回結果頁。
- Given 拜訪畫面，when 看選人卡與成品列，then 只看得到友好與收禮機率、成品特性，看不到預估友好或喜好。

## Implementation Notes

- 主 session 直接實作、自己讀 diff 審查（使用者授權整個 epic 一路做完，沒有另外開子代理），跟 epic 1、2 相同。
- `E.gift` 保留為 `visit` 的別名，模擬器 story 5 再改用新名字；結果頁的章改成投其所好／嫌棄／又愛又嫌／拜訪。
- 空手拜訪的對話＝進門（E1–E3）＋空手（E4–E6）；帶禮的對話＝進門＋原本的收禮／加料台詞（反應台詞在 story 2）。
- tools/shots.js 加 visit、visit-result 兩個情境。
- 驗證：node --test 90/90、simulate --quick、keyboard-e2e 175/175。

## Plan Change Log

## Review Triage Log

- 第 1 輪（quick，主 session 自審）：high 0／medium 0／low 0／false 0。拒收台詞仍是舊字（審沒裝、真環、滑妃的「你」），屬 story 2 範圍，不在本 story 修。

## Design Notes

反應的 net：成品在 likeP +1、在 hateP −1；成品帶的特性在 likeT 每種 +1、在 hateT 每種 −1。net>0 love；net<0 hate；net=0 且有喜歡也有討厭 mixed；否則 plain。友好公式另算：(gift + Σ喜歡特性等級 − Σ討厭特性等級) × 係數（依成品喜不喜歡），四捨五入、最低 0。

## Verification

**Commands:**
- `node --test tests/` -- expected: 全部通過
- `node tools/simulate.js --quick` -- expected: 跑完無錯
- `node tools/keyboard-e2e.js` -- expected: 全部通過
