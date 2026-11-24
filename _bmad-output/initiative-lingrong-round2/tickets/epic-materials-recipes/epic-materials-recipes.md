---
tracker_id: ""
type: epic
title: "新素材、新配方與帶特性的素材份"
parent: initiative-lingrong-round2
covers: [R1, R3, R11]
sources: []
companions: []
after: []
refined: false
risk: medium
---

# 新素材、新配方與帶特性的素材份

## Description

遊戲改用 §8 的 7 道新配方與 12 種新素材、§7 的新料。素材改成一份一份記，採集來的依本性帶特性；小舖除了紅花瓣什麼都買得到，多的素材能賣。現有的調合畫面在這個 epic 結束時仍可做新配方（含三素材的歲寒三友茶），四階段留給 epic 2。

## Outcome

玩家一開局就玩到原作梗的新配方，採集回來的素材看得出特性差異。

## Done when

- 新配方、素材、料的資料與取得方式符合 §7、§8，引擎單元測試通過。
- 採集回來的素材帶特性、小舖買的沒有；賣素材可換銀兩。
- 現有調合畫面能做全部新配方（含三素材）。
- 一輪 10 天自動 harness 跑完無錯誤，已部署。

## Boundaries

- 四階段調合 UI 屬於 epic-craft-stages。
- 拜訪、喜好、新加料規則屬於 epic-visit-palaces。
- Touch point: 採集地下城素材表 — 換新素材與特性；owner: 本 epic

## References

- parent — _bmad-output/initiative-lingrong-round2/initiative-lingrong-round2.md, section Requirements (R1, R3, R11)
- design — docs/game-design.md
