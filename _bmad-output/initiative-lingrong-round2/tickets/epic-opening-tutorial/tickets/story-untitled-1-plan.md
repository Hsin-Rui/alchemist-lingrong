---
title: '教學第一天的引導'
type: feature
ticket: '2'
created: '2026-11-25'
status: built
baseline_revision: '97e5559f6303c627fba335c6522f2db832844128'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick-inline]
review_loop_iteration: 0
context:
  - '{project-root}/docs/round2/lines-review.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 選了教學之後，第一天還是要自己摸索要先做什麼。

**Approach:** 照 §15.2：發光圈依序指向採集→調合→親自交貨，每一步第一次進去時包捐說明（A22–A28），第一天晚上 A29、第二天早上 A30 結束；選「不用了」完全沒有引導。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 採集 | 教學、沒有桂花 | 主畫面「採集」、採集畫面「御花園」有發光圈；第一次進御花園先播 A22–A23 | — |
| 調合 | 桂花到手（採的或買的） | 發光圈移到訂單的「調合」；調合模組用 A24–A27 | — |
| 做好 | 教學訂單的糖糕出鍋 | 按回宮／直接送去之前播 A28；發光圈移到「親自送去」 | — |
| 交貨後 | 親自交 | 當晚播 A29；隔天早上 A30、教學結束、沒有發光圈 | 代交不算這一步 |

</frozen-after-approval>

## Implementation Notes

- 主 session 直接實作與自審。
- 教學狀態 `S.tutorial.step`：gather → craft → deliver → night → end；`tutStep()` 在桂花到手時自動往下（不管是採的還是買的）。
- 包捐每天一句在教學時換成 A20／H6／A28 指向下一步；發光圈 class `tut-spot`（減少動態時不閃）。
- A28 插在調合出鍋按鈕之後，播完接回原本的回宮／直接送去／代交（`craftdone2`）。
- 調合模組：從訂單點進來的教學局用 A24（原本是 M2）；「每樣挑一份」那頁也放快速調合開關。
- keyboard-e2e：主要那一輪開場選「不用了」；另加一段教學模式從開場走到第二天早上（12 項）。
- 沒解決：當天時辰用完還沒交貨，就不會有 A29、隔天也不播 A30（教學照樣結束）。
- 驗證：node --test 103/103、keyboard-e2e 200/200、發光圈截圖。

## Review Triage Log

- 第 1 輪（quick，主 session 自審）：high 0／medium 0／low 2。
  - low・patch：從訂單進調合時說的是 M2 不是 A24 → 教學局改說 A24。
  - low・patch：「每樣挑一份」那頁沒有快速調合開關 → 補上。
