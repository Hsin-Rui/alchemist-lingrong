# Deferred work

- source_plan: `_bmad-output/initiative-lingrong-v1/tickets/epic-engine-refactor/tickets/story-tracer-plan.md`
  summary: 回歸測試網應真的執行核心行動（採集/調合/交貨/送禮/加料被抓/演唱），以覆蓋 shexiang/shuangmian/duanzi/wentaiyi/baimang/jingshi/miaoyin/heian/guimi 等封號路徑。
  evidence: quick review 指出目前 playthrough bot 只巡覽畫面＋睡覺跳過 10 天，從不執行 doDeliver/applySpike/doCraft/doGift，故這些行動碼與相依的封號條件未被回歸網執行。嘗試讓 bot 真的遊玩會卡在 800 步上限（非簡單修正）。本棒引擎抽離已由 20k 組狀態差異測試證明零回歸，故 defer；story 1.2 將 settleNight/applySpike 搬入引擎後，以可重現的 seeded 引擎層單元測試覆蓋這些路徑（比驅動 DOM 的 bot 更可靠）。
  resolved: story 1.2/1.3 已在 tests/engine.test.js 以 seeded 引擎層單元測試覆蓋 caught/muskRuin/sings/births/spikesUsed+success 及各行動路徑（含加料被抓、演唱、生子等封號條件）。

- source_plan: `_bmad-output/initiative-lingrong-v1/tickets/epic-engine-refactor/tickets/story-sweep-plan.md`
  summary: 把「禁足期間不能出門」這條規則從兩個外殼（game.js `needOut()` 與 simulate.js `grounded()` 守衛）收斂進引擎，讓 `gather`/`deliver`/`gift` 自行回傳 grounded 拒絕、外殼只負責轉譯（toast/return false）；順帶把 `S.day <= S.groundUntil` 謂詞改為單一引擎 helper，消除 game.js/simulate.js/engine.js 的內聯重複。
  evidence: story 1.5 的 quick review 指出此規則目前只在外殼把關、且在兩個外殼各有一份，是 R4「規則只有一份」的殘留小缺口；行為正確（呼叫端都有守衛），屬 pre-existing 架構邊界，修法超過 trivial 修正，故 defer 不在收尾文案棒內處理。引擎 `craft` 不檢查材料充足屬同類 core/shell 模式，呼叫端已守衛，視為可接受、不在此範圍。
