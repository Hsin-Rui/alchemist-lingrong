---
title: 'Epic 2 收尾'
type: chore
ticket: '3'
created: '2026-11-22'
status: built
route: oneshot
route_source: human（「不要做被抓懲罰。不用做花叢躲藏。可以收尾了。」）
risk: low
review: none
---

## Intent

使用者決定 Epic 2 不做被抓懲罰旋鈕、不做花叢躲藏；打磨項目已在 2.1／2.2 的試玩回合中完成。本票只做收尾。

## Implementation Notes

- `tools/pixel-preview.html`：示範房間改成依主題繪製，並排顯示御花園與太醫院；走廊與房間同一種地面（跟上 2.2 後的規格）。
- `docs/game-design.md` §12.6 分片第 3 項改為收尾；被抓懲罰、花叢躲藏從待辦移除（花叢躲藏留在 §13 點子庫）。
- `docs/pixel-art-spec.md` 預覽頁描述更新。
- 票務：2.3 改名為「Epic 2 收尾」、hitl 改 false；epic 加結案決策紀錄。

## Verification

- Headless Chrome 開 `tools/pixel-preview.html`：兩個示範房間正常繪製、無 console 錯誤。
- `node --test tests/`：59/59。
