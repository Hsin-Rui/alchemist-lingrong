---
tracker_id: ""
type: epic
title: "四階段調合"
parent: initiative-lingrong-round2
covers: [R2, R3, R11]
sources: []
companions: []
after: []
refined: true
risk: medium
---

# 四階段調合

## Description

調合照 §13 變成配方冊＋開火攪拌＋加料＋起鍋四階段，有演出與快速調合，成品帶特性。原型見 docs/round2/craft-prototype.html。

## Outcome

調合從點來點去變成有取捨的小遊戲，玩家不用再自己記配方。

## Requirements

- R1 (parent R2): 調合分四階段——選素材（配方冊標示可做／缺什麼、選用哪一份、可自由調合、支援三素材配方）→ 開火攪拌（三選一冒泡 3 次）→ 加料 → 起鍋（珠珠停在中間升 1 級、兩端降 1 級、其他不變）；快速調合跳過二、四；配錯做出黑暗料理；有演出；電腦鍵盤與手機都能玩。
- R2 (parent R3): 成品特性＝所用素材的特性＋攪拌挑的泡泡（同特性相加、最高 3 級），攪完只留最強 3 種，再套起鍋結果（只作用在最強的那種）。
- R3 (parent R11): 調合畫面的文字不出現英文、不出現「安嬪」。

## Constraints

- 規則（抽泡泡、套泡泡、起鍋分區與結果）放在 DOM-free 引擎並有單元測試；隨機走注入的 rand。
- 數值集中在 data.js（RULES.craft），預設照 §13.4：攪拌 3 次、大泡泡 20%、起鍋橫條 14／29／14／29／14、珠珠來回 1.6 秒。
- 素材到最後一步才扣、時辰到最後一步才花；一旦下鍋就不能中途退出（避免退出重抽泡泡）。

## Done when

- 四階段與快速調合照 §13.3 運作，電腦鍵盤與手機都能玩。
- 成品特性的計算（素材、泡泡、起鍋、最多 3 種）有單元測試。
- 配錯配方做出黑暗料理。
- 已部署，使用者試玩過手感。

## Boundaries

- 特性如何影響送禮與被抓屬於 epic-visit-palaces（遮掩的倍率可先在引擎定義）。

## References

- parent — _bmad-output/initiative-lingrong-round2/initiative-lingrong-round2.md, section Requirements (R2, R3, R11)
- design — docs/game-design.md

## Notes

- Decision: 2026-11-24 epic 只取 initiative 的 R2、R3、R11；使用者要求一路做完、最後一次驗收。
- Decision: 2026-11-24 快速調合開關記在這台裝置的瀏覽器（跟封號冊一樣），不是每局重設。
- Decision: 2026-11-24 煉紅花不走四階段（它本身是料），下鍋直接完成；配錯直接做出黑暗料理。
- Decision: 2026-11-24 tracer：story 1（引擎四階段函式＋畫面四階段骨架）。
