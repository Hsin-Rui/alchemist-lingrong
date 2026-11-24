---
tracker_id: ""
type: epic
title: "拜訪各宮與新的加料規則"
parent: initiative-lingrong-round2
covers: [R4, R5, R6, R11, R12]
sources: []
companions: []
after: []
refined: false
risk: medium
---

# 拜訪各宮與新的加料規則

## Description

送禮改成 §14 的拜訪各宮：藏起來的喜好、投其所好／嫌棄／又愛又嫌、拒收；訂單由宮女來下、可包捐代交；新料木薯粉與貓薄荷、遮掩被抓、加料的禮誰都能收。最後更新模擬器並調數值。

## Outcome

交朋友變成要摸索每個人的喜好，加料更有策略。

## Done when

- 拜訪、友好公式、反應、收禮機率照 §14.1–14.3，有單元測試。
- 宮女送訂單、親自交與包捐代交照 §14.4。
- 新料與被抓公式照 §14.5、§7。
- 模擬器以新規則跑完，結果寫回設計文件並據此調數值。
- 已部署，使用者試玩過。

## Boundaries

- 抄經屬於 epic-grounded-sutra；封號屬於 epic-ending-share。
- Touch point: tools/simulate.js、tools/gather-bot.js — 跟新規則更新；owner: 本 epic

## References

- parent — _bmad-output/initiative-lingrong-round2/initiative-lingrong-round2.md, section Requirements (R4, R5, R6, R11, R12)
- design — docs/game-design.md
