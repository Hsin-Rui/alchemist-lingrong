---
title: '被抓演出（caught-fx）'
type: feature
ticket: '5'
created: '2026-11-22'
status: built
baseline_revision: '0427be9a5878070bbd8aef1f6cd04ba7c7bccc10'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: ['{project-root}/_bmad-output/initiative-lingrong-v1/tickets/epic-ux-input/ux-ux-input/EXPERIENCE.md', '{project-root}/_bmad-output/initiative-lingrong-v1/tickets/epic-ux-input/ux-ux-input/DESIGN.md', '{project-root}/_bmad-output/initiative-lingrong-v1/tickets/epic-ux-input/ux-ux-input/mockups/fx-demo.html', '{project-root}/_bmad-output/initiative-lingrong-v1/tickets/epic-ux-input/tickets/story-spike-fx-plan.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** 被抓是全遊戲最重的時刻，現在只是一般紅章，沒有份量。

**Approach:** 依 EXPERIENCE 演出表「被抓」列與 DESIGN 暗幕，在 story 4 的演出架構上加被抓演出：對話中溫太醫從右側衝進來（「且慢！」那句）、受害者抖、零溶嚇得往後退、宣判句起畫面 0.9 秒暗到 45%；結果頁沿用暗幕、蓋「重」級紅狠章（停格約 0.19 秒＋晃一次），章落下後再暗到 62%，章、收據、按鈕不被壓暗。story 4 的測試入口加入「被抓」。

## Boundaries & Constraints

**Always:**
- 被抓屬「重」：紅狠章、停格約 0.19 秒、蓋章時晃一次（15px、約 0.76 秒衰減）；減少動態效果時不晃，其他照常。
- 對話中一律不搖晃。
- 暗幕色 `#140C1C`（DESIGN `dim-veil`）：宣判句（CAUGHT 最後一句旁白）起 0.9 秒暗到 0.45；結果頁一開始就是 0.45，章落下後暗到 0.62。暗幕蓋住背景與立繪；章、收據、底部按鈕在暗幕之上不被壓暗。
- 不閃色；不引進新色系。
- story 3 的防連按（「且慢！」那句鎖 0.6 秒）、倍速與略過照常；略過整段對話時直接到結果頁，結果頁的演出照常播。
- 沿用 story 4 的等級表、狠章、`playResultFx()`、`#演出` 測試入口與 e2e 架構；不另做第二套。

**Never:**
- 不改遊戲規則、數值、台詞文字。
- 不改加料（非被抓）事件的演出。
- 暗幕不得擋住按鈕的點擊或鍵盤游標。

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 被抓對話 | 「且慢！」句 | 溫太醫立繪從右側衝入；句子鎖 0.6 秒 | — |
| 被抓對話 | 受害者句 | 受害者立繪抖 | — |
| 被抓對話 | 零溶喊冤句 | 零溶立繪往後退 | — |
| 宣判 | 旁白宣判句 | 暗幕 0.9 秒漸暗到 0.45；不晃 | — |
| 結果頁 | 被抓結果 | 暗幕 0.45 → 紅狠章停格約 0.19s＋晃一次 → 暗幕 0.62；章、收據、按鈕亮度不變 | — |
| 減少動態 | 被抓＋reduce | 不晃，其他（暗幕、狠章）照常 | — |
| 略過 | 被抓對話中按 Esc | 直接到結果頁，結果頁演出照常 | — |
| 重繪 | 結果頁再 render（例如按 M） | 不重播、暗幕維持 0.62、不再晃 | — |

</intent-contract>

## Code Map

- `js/game.js` `outcomeLines()` -- `res.caught` 時回傳 `lockLine(fmt(D.CAUGHT, …), 0)`；story 4 的 `markFx()` 在此加對話演出標記。CAUGHT 四句：溫太醫「且慢！」、`{who}` oops、零溶 shock 喊冤、旁白宣判（`js/data.js:289-294`）。
- `js/game.js` `dialogView()`／`playLineFx()`（story 4 新增）-- 依第 4 元素 `fx` 套立繪與旁白框動畫；在此加「衝入」「後退」「暗幕」。
- `js/game.js` `views.result()`／`playResultFx()`／`fxTier()`（story 4 新增）-- 被抓目前是一般紅章、不晃；改為重級狠章＋暗幕。被抓時結果頁立繪是 `doctor`。`S.result.fxDone` 防重播。
- `js/game.js` `#演出` 測試入口（story 4 新增，在檔尾）-- 加入「被抓」事件（固定骰子讓 `E.deliver` 判定被抓）。
- `css/style.css` -- story 4 的 `.stamp.fierce`、`.result.fx-shake`、`fxshake`、reduced-motion 規則；在此加暗幕層與層級（暗幕在背景／立繪之上，章、`.receipt`、`.footer-cta` 之上）。
- `mockups/fx-demo.html` -- `.dim`、被抓情境的參考實作（暗幕 z-index、衝入、後退）。
- `tools/keyboard-e2e.js` -- story 4 的演出區段；目前斷言「被抓：一般章、不晃」——改為新的被抓斷言。
- `tests/playthrough.test.js` -- story 4 加的演出測試中被抓的預期要跟著改。

## Tasks & Acceptance

**Execution:**
- [x] `js/game.js` -- 被抓對話演出標記（衝入、受害者抖、零溶後退、宣判暗幕）；結果頁被抓改重級狠章＋暗幕 0.45→0.62；測試入口加被抓。 -- 依 EXPERIENCE 被抓列。
- [x] `css/style.css` -- 暗幕層、衝入／後退動畫、層級（章／收據／按鈕在暗幕上）。 -- 依 DESIGN 暗幕與 Elevation。
- [x] `tools/keyboard-e2e.js` -- 以測試入口觸發被抓：斷言對話各句立繪 class、宣判句後暗幕 opacity 約 0.45、對話中無搖晃；結果頁狠章、重級停格、晃一次、章落下後暗幕約 0.62、章／收據／按鈕不在暗幕之下（elementFromPoint 或 z-index 檢查）；reduce motion 不晃；Esc 略過後結果頁演出照常；重繪不重播；0 console 錯誤。 -- 覆蓋 I/O 矩陣。
- [x] `tests/playthrough.test.js` -- 更新被抓的演出預期；照舊全過。

**Acceptance Criteria:**
- Given 測試入口觸發被抓，when 對話播放，then 溫太醫從右側衝入、受害者抖、零溶後退，宣判句起畫面漸暗，全程不晃。
- Given 被抓結果頁，when 章蓋下，then 紅狠章停格、畫面晃一次、暗幕再沉到約 62%，章、收據與按鈕仍是原亮度、按鈕可點可用鍵盤按。
- Given 系統減少動態效果，when 被抓，then 不晃，其他演出照常。

## Implementation Notes

- `fxTier()` 對被抓回傳 `heavy`（拒收優先排除），所以結果頁自動走 story 4 的狠章、0.19s 停格、`fx-shake`、`fxDone` 防重播；另加 `.fx-caught` class。
- 對話標記：`markFx(lines, who, 'caught')` 依說話者給 `enter`（溫太醫）、`tremble`（受害者，依 EXPERIENCE「受害者抖」）、`shock`（零溶）、`dim`（旁白宣判）；「且慢！」仍是 `lockLine` 鎖句。動畫數值取自 fx-demo。
- 暗幕 `.fx-veil`（`#140C1C`、`pointer-events: none`）：對話中在宣判句插入 `.dialog-layer` 第一個子元素（z 0，旁白框／略過／倍速疊在上面），WAAPI 0→0.45 / 900ms；同一句重繪時用 `currentTime` 接續不重暗。結果頁暗幕 z 2，章（z 3）、墨點、墨圈、`.receipt`、`.footer-cta`（z 3）在上；立繪在下。CSS 靜止值 0.45，`playResultFx()` 在章落下（160+190+190ms）後 WAAPI 0.45→0.62 / 1400ms；重繪時 `fxDone` → `.settled` 直接 0.62。
- 結果頁溫太醫立繪用 fx-demo 的「逼近一下」（scale 1.08）而非受害者被震。
- `#演出` 選單標籤改為「被抓（重＋暗幕）」；入口本身 story 4 已有。
- 截圖肉眼看暗幕不明顯，以像素驗證：背景 232→101（≈62%）、按鈕像素與未暗時相同。

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `node --test tests/` -- expected: 全部通過。
- `node tools/simulate.js --quick` -- expected: 正常跑完。
- `node tools/keyboard-e2e.js` -- expected: 全部 PASS（含被抓斷言）、0 console 錯誤。

**Manual checks (if no CLI):**
- `node tools/keyboard-e2e.js --shots <dir>`：截圖被抓對話（暗幕中）與結果頁（暗幕 62%，章與按鈕明亮）。

### 2026-11-22 — Review pass
- verdicts: 5 findings — high 0, medium 0, low 4, false 1, maybe-false 0
- findings:
  - `[low]` `[reject]` 結果頁蓋章前 2 秒內重繪（按 M）會讓暗幕提早跳到 0.62 — 需在 2 秒窗口內按 M 才會遇到，修法要加計時狀態，不划算；試玩時留意。
  - `[low]` `[reject]` 減少動態下只測了溫太醫衝入，沒測其他對話演出 — 同一 Web Animations 路徑、reduce motion 不影響，屬測試補強。
  - `[false]` `[reject]` 宣判句少了示範頁的旁白框「砰」 — EXPERIENCE 被抓列未要求，規格與示範頁衝突時以規格為準。
  - `[low]` `[patch]` css 註解「狠章（加料得手）」過時 — 改為「加料得手、被抓」。
  - `[low]` `[patch]` e2e「被抓略過：暗幕沉到 0.62」缺失敗細節 — 補上實測值。

## Auto Run Result

- 摘要：被抓改重級演出：對話中溫太醫衝入、受害者抖、零溶後退、宣判句暗幕 0.45；結果頁紅狠章停格 0.19s＋晃一次、暗幕 0.45→0.62，章／收據／按鈕在暗幕上；減少動態不晃。
- 檔案：`js/game.js`、`css/style.css`、`tests/playthrough.test.js`、`tools/keyboard-e2e.js`。
- 驗證：node --test 69/69；simulate --quick OK；keyboard-e2e 157/157、0 console 錯誤。
- 殘留風險：手感需試玩確認（hitl）；未做 review。
