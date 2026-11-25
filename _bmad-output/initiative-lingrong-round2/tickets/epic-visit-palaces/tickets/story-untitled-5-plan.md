---
title: '模擬器與數值平衡'
type: chore
ticket: '5'
created: '2026-11-25'
status: built
baseline_revision: '2dd3ffbd872dc6ebf493bda325973882a5dbea1d'
route: oneshot
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick-inline]
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 模擬器還在用舊的送禮與交貨，量不到第二輪新規則下各打法的逆襲率；高手勝率先前約 47%，改完被抓規則後又不知道落在哪。

**Approach:** 機器人改用拜訪、代交、帶成品特性的被抓機率，加一個「交際」機器人；跑模擬、調數值，結果寫回設計文件。

</frozen-after-approval>

## Implementation Notes

- oneshot：改動集中在 tools/simulate.js 與 data.js 幾個數值。
- 模擬器：api 加 `visit`、`giftFriend`，deliver 禁足時走代交，catchChance 帶 tr；地下城抽樣保留每份的特性（haul）；新增「交際」機器人。
- 試過的變體（每種 1500 局）：枕邊風門檻 20→10（正經 23%，太容易）、+12／+15、上限 80%、遮掩每分 8%、木薯粉／貓薄荷加重；採用「枕邊風 +15、上限 80%、木薯粉 −15、貓薄荷 −12」。
- 結果（3000 局）：正經 15.5%、交際 18.3%、隨手加料 18.3%、精算 30.4%、高手 34.3%；寫進設計文件 §14.7，§3 與料表跟著改。
- 驗證：node --test 96/96、node tools/simulate.js 3000。

## Review Triage Log

- 第 1 輪（quick，主 session 自審）：high 0／medium 0／low 0。
