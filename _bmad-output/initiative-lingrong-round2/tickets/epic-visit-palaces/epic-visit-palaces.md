---
tracker_id: ""
type: epic
title: "拜訪各宮與新的加料規則"
parent: initiative-lingrong-round2
covers: [R4, R5, R6, R11, R12]
sources: []
companions: []
after: []
refined: true
risk: medium
---

# 拜訪各宮與新的加料規則

## Description

送禮改成 §14 的拜訪各宮：藏起來的喜好、投其所好／嫌棄／又愛又嫌、拒收；訂單由宮女來下、可包捐代交；新料木薯粉與貓薄荷、遮掩被抓、加料的禮誰都能收。最後更新模擬器並調數值。

## Outcome

交朋友變成要摸索每個人的喜好，加料更有策略。

## Requirements

- R1 (parent R4): 拜訪各宮取代送禮——花 1 時辰、次數不限，空手友好 +1 或帶伴手禮；友好＝(基本值＋喜歡特性每級 +1－討厭特性每級 −1)×成品係數 1.2／1／0.8；喜好藏起來、不暗示、不記錄；反應依喜歡與討厭抵銷決定投其所好／嫌棄／又愛又嫌／普通；收禮機率＝友好＋30%，嫌棄再 −20%。
- R2 (parent R5): 訂單由宮女（吹緊吸、踩月、送吱）來下；交貨可親自（賞銀＋友好 5＋每 3 級特性總和 +1）或包捐代交（只有賞銀）；滑妃會不時點坐胎藥。
- R3 (parent R6): 加料的禮誰都能收；料為麝香、紅花、木薯粉（上吐下瀉）、貓薄荷（貓咪鬧場）；被抓機率先以遮掩分（濃郁×2＋香氣＋甜蜜）壓低、最低 8%，再乘友好與交貨倍率；基礎機率 12／45／18%。
- R4 (parent R11): 遊戲台詞依台詞總表定稿；稱呼一律安小主（妃嬪當面叫安妹妹），零溶自稱我。
- R5 (parent R12): 模擬器跟著新規則更新，量出各機器人的逆襲率與封號取得率，用來調數值與封號順位。

## Constraints

- 規則（友好公式、反應、收禮機率、遮掩與被抓、交貨友好）放在 DOM-free 引擎並有單元測試；隨機走注入的 rand。
- 喜好與數值集中在 data.js；預設照 §14.2–14.5。

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

## Notes

- Decision: 2026-11-25 epic 只取 initiative 的 R4、R5、R6、R11、R12；使用者授權整個 epic 一路做完、最後一次驗收（推上 build/r2-e2-craft-stages 後「就可以往下做」）。
- Decision: 2026-11-25 tracer：story 1（引擎拜訪＋新友好公式＋喜好資料，畫面上拜訪取代送禮，能從選人走到結果）。
- Assumption: 2026-11-25 包捐代交不花零溶的時辰（包捐跑腿）；親自交照舊花 1 時辰。§14.4 沒寫代交的時辰，這樣代交才有「省時辰、少友好」的取捨。
- Assumption: 2026-11-25 滑妃點坐胎藥的機率：她的普通訂單裡約 1/4 換成坐胎藥（數值放 data.js，模擬器階段再調）。

