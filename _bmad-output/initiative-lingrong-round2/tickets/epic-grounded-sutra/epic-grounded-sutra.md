---
tracker_id: ""
type: epic
title: "禁足抄經"
parent: initiative-lingrong-round2
covers: [R7, R11]
sources: []
companions: []
after: []
refined: true
risk: medium
---

# 禁足抄經

## Description

禁足時能玩 §15.5 的排字拼經，得到後宮心經（送誰都 +5、不拒收），包捐會提示禁足時能做什麼。

## Outcome

禁足不再無聊，被抓也有事可做。

## Requirements

- R1 (parent R7): 禁足時才能抄經（1 時辰、從 6 句台詞挑一句排字），得到《後宮心經》，送誰都友好 +5、不拒收；禁足時包捐提示可代交、可抄經或調合。
- R2 (parent R11): 遊戲台詞依台詞總表定稿；稱呼一律安小主（妃嬪當面叫安妹妹），零溶自稱我。

## Constraints

- 心經的規則（固定 +5、不拒收、沒有特性）與抄經次數統計放在 DOM-free 引擎並有單元測試。
- 抄經用 study 背景與 bgm_sutra；電腦鍵盤與手機都能玩。

## Done when

- 只有禁足時出現抄經，花 1 時辰，6 句隨機一句，電腦與手機都能排。
- 後宮心經送誰都 +5、不拒收，有單元測試。
- 禁足時包捐提示。
- 已部署。

## Boundaries

- 封號甘露寺預備役的判定屬於 epic-ending-share。

## References

- parent — _bmad-output/initiative-lingrong-round2/initiative-lingrong-round2.md, section Requirements (R7, R11)
- design — docs/game-design.md

## Notes

- Decision: 2026-11-25 使用者試玩 epic 2＋3 後說「先進下一個 Epic」，照舊一路做完、最後一次驗收。
- Decision: 2026-11-25 tracer：story 1（抄經小遊戲＋《後宮心經》進手上）。只有 2 個 story，不另開 Refactor sweep（規則是超過 3 個才開）。
- Decision: 2026-11-25 第一次禁足的 G6–G8 放在本 epic 的 story 2（跟禁足提示一起）；第一次被翻牌子的 G4–G5 留給 epic 5。
- Assumption: 2026-11-25 抄經次數記在 S.stats.sutras，給 epic 6 的「甘露寺預備役」用。

