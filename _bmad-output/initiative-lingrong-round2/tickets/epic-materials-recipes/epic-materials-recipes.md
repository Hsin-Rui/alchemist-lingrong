---
tracker_id: ""
type: epic
title: "新素材、新配方與帶特性的素材份"
parent: initiative-lingrong-round2
covers: [R1, R3, R11]
sources: []
companions: []
after: []
refined: true
risk: medium
---

# 新素材、新配方與帶特性的素材份

## Description

遊戲改用 §8 的 7 道新配方與 12 種新素材、§7 的新料。素材改成一份一份記，採集來的依本性帶特性；小舖除了紅花瓣什麼都買得到，多的素材能賣。現有的調合畫面在這個 epic 結束時仍可做新配方（含三素材的歲寒三友茶），四階段留給 epic 2。

## Outcome

玩家一開局就玩到原作梗的新配方，採集回來的素材看得出特性差異。

## Requirements

- R1 (parent R1): 新配方 7 道＋紅花；12 種正經素材以「一份一份」記錄；除紅花瓣外所有東西小舖都買得到；採集的素材依本性隨機帶 0–2 個特性（離出生點越遠等級越高），小舖的沒有；多的素材可在小舖賣（售價一半＋每級特性 1 兩）。
- R2 (parent R3): 五種特性（香氣、甜蜜、華麗、清雅、濃郁）各 1–3 級；本 epic 讓成品直接繼承所用素材的特性（同特性相加、最高 3 級、最多 3 種），也就是 §13.3 的「快速調合」結果；攪拌與起鍋屬於 epic-craft-stages。
- R3 (parent R11): 本 epic 碰到的台詞依台詞總表定稿：新料的出糗台詞（F1–F14）、訂單需求句（C1–C18）與宮女開口下單（B12–B14）。

## Constraints

- 規則放在 DOM-free 引擎並有單元測試；遊戲畫面不出現英文、不出現「安嬪」（initiative Constraints）。
- 現有的存檔外功能（地下城、夜晚、結局）行為不變，只換素材。

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

## Notes

- Decision: 2026-11-24 epic 只取 initiative 的 R1、R3、R11，不另外問使用者（設計文件已定案）。
- Decision: 2026-11-24 資料結構：`S.inv[id]` 維持總數，另以 `S.lots` 記帶特性的那幾份（uid、id、tr）；沒特性的就是一般份。舊程式碼用總數的地方不必改。
- Decision: 2026-11-24 訂單需求句換新配方時一併改成宮女開口（B12–B14），因為新的需求句是宮女的口吻；宮女立繪、包捐代交仍屬 epic-visit-palaces。
- Decision: 2026-11-24 新料的被抓基礎機率先沿用舊值 15%，新數值與遮掩屬於 epic-visit-palaces。
- Decision: 2026-11-24 tracer：story 1（新資料＋三素材調合）。
- Decision: 2026-11-24 新採集素材表與像素圖併入 story 1（換掉 ITEMS 後舊表會失效），story 3 只剩擲特性。
