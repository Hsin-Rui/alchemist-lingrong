---
tracker_id: ""
type: epic
title: "結局兩畫面與分享圖卡"
parent: initiative-lingrong-round2
covers: [R9, R10, R11]
sources: []
companions: []
after: []
refined: true
risk: medium
---

# 結局兩畫面與分享圖卡

## Description

結局照 §9 第二輪拆成恩寵揭曉與封號戰績兩個畫面，新增 4 個封號（共 16 個），並做分享 prototype：瀏覽器畫圖卡、手機系統分享、電腦存圖、FB 按鈕分享網址。範例稿見 docs/round2/ending-mockup.html。

## Outcome

玩家玩完有儀式感，也能把封號圖卡分享出去。

## Requirements

- R1 (parent R9): 結局兩個畫面——畫面一太監宣旨、恩寵榜從第 4 名揭曉到第 1 名、長條長出來，零溶第一給大字＋壞笑立繪，對手第一給她得意立繪＋零溶縮在旁邊＋零溶處境一句；畫面二聖旨展開、主封號蓋章、加封一個個跳出、kuso 戰績、分享與再玩一次、封號冊。
- R2 (parent R9): 新增原著重現、炎洗宮米其林、甘露寺預備役、包捐才是本體，共 16 個封號；條件與評語照 §9 第二輪，順位依模擬結果。
- R3 (parent R10): 分享 prototype——canvas 畫 1200×630 圖卡（遊戲名、主封號、評語、戰績標籤、零溶立繪、網址）；手機用系統分享（帶圖卡檔）、不支援時存圖；「分享到 FB」按鈕開 FB 分享遊戲網址；網頁有固定 og:image。
- R4 (parent R11): 結局台詞照台詞總表 L 組；稱呼安小主，畫面不出現英文。

## Constraints

- 封號判定在引擎、有單元測試；戰績要的次數記在 S.stats。
- 兩個畫面手機（400px 寬）與電腦都能看；鍵盤能走完（Enter 下一步、焦點在按鈕上）。
- prefers-reduced-motion 下演出收斂成直接顯示。
- 不做後台（下一個 iteration）。

## Done when

- 兩個結局畫面照範例稿，手機與電腦都能看。
- 16 個封號判定有單元測試，順位依模擬結果。
- 分享圖卡在手機能分享、電腦能存圖。
- 已部署。

## Boundaries

- 分享後台（自己的 VM）屬於下一個 iteration。

## References

- parent — _bmad-output/initiative-lingrong-round2/initiative-lingrong-round2.md, section Requirements (R9, R10, R11)
- design — docs/game-design.md

## Notes

- Decision: 2026-11-26 使用者說「可以了請開始 Epic 6」，照舊一路做完、最後一次驗收。
- Decision: 2026-11-26 tracer：story 1（新封號與戰績計數，引擎＋測試＋模擬器排順位），之後畫面一、畫面二、分享圖卡。
- Assumption: 2026-11-26「已部署」＝合併到 main 後 GitHub Pages 自動更新；合併前先請使用者驗收，不自己合併。
- Assumption: 2026-11-26 kuso 戰績的句子是新寫的（台詞總表沒有），參考範例稿寫，驗收時請使用者過目。
- Assumption: 2026-11-26「原著重現」的得手＝麝香沒被抓、也不是無效（劑量、小產、不孕都算），親自交貨或拜訪送禮都算。
- Assumption: 2026-11-26「炎洗宮米其林」只看做出來的成品（不必送出）。

