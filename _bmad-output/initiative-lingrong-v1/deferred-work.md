# Deferred work

- source_plan: `_bmad-output/initiative-lingrong-v1/tickets/epic-engine-refactor/tickets/story-tracer-plan.md`
  summary: 回歸測試網應真的執行核心行動（採集/調合/交貨/送禮/加料被抓/演唱），以覆蓋 shexiang/shuangmian/duanzi/wentaiyi/baimang/jingshi/miaoyin/heian/guimi 等封號路徑。
  evidence: quick review 指出目前 playthrough bot 只巡覽畫面＋睡覺跳過 10 天，從不執行 doDeliver/applySpike/doCraft/doGift，故這些行動碼與相依的封號條件未被回歸網執行。嘗試讓 bot 真的遊玩會卡在 800 步上限（非簡單修正）。本棒引擎抽離已由 20k 組狀態差異測試證明零回歸，故 defer；story 1.2 將 settleNight/applySpike 搬入引擎後，以可重現的 seeded 引擎層單元測試覆蓋這些路徑（比驅動 DOM 的 bot 更可靠）。
