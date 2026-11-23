// 鍵盤游標的幾何核心（DOM-free 純函式）。
// rect 一律是 { left, top, width, height }（getBoundingClientRect 的子集），可以多帶其他欄位。
// 雙匯出：瀏覽器掛在 window.FocusNav，node 透過 module.exports。
(function () {
  'use strict';

  const OFF_WEIGHT = 2; // 偏軸距離的權重：偏得越多越不像「那個方向」
  const EPS = 1; // 中心至少要往該方向移動這麼多 px 才算在半平面內

  const cx = (r) => r.left + r.width / 2;
  const cy = (r) => r.top + r.height / 2;
  // 兩段區間 [a0,a1]、[b0,b1] 的間距（重疊為 0）
  const gap = (a0, a1, b0, b1) => Math.max(0, b0 - a1, a0 - b1);

  // 從 from 往 dir（'up'|'down'|'left'|'right'）找最近的候選；沒有就回 null（到邊緣不繞回）。
  // 只看中心落在該方向半平面的候選；偏軸不重疊的候選還得整個在 from 那條邊之外
  //（避免底部導覽列最右顆按 → 跳到畫面頂端右上角的按鈕）。
  // 分數＝主軸邊距＋偏軸邊距×權重，平手比中心距離。
  function pick(from, candidates, dir) {
    const fx = cx(from);
    const fy = cy(from);
    const fr = from.left + from.width;
    const fb = from.top + from.height;
    let best = null;
    let bestScore = Infinity;
    for (const c of candidates || []) {
      if (!c || c === from) continue;
      const x = cx(c);
      const y = cy(c);
      const cr = c.left + c.width;
      const cb = c.top + c.height;
      let main; // 主軸邊距（可為負：兩者在主軸上重疊）
      let off;
      if (dir === 'down') { if (y <= fy + EPS) continue; main = c.top - fb; off = gap(from.left, fr, c.left, cr); }
      else if (dir === 'up') { if (y >= fy - EPS) continue; main = from.top - cb; off = gap(from.left, fr, c.left, cr); }
      else if (dir === 'right') { if (x <= fx + EPS) continue; main = c.left - fr; off = gap(from.top, fb, c.top, cb); }
      else if (dir === 'left') { if (x >= fx - EPS) continue; main = from.left - cr; off = gap(from.top, fb, c.top, cb); }
      else return null;
      if (off > 0 && main < -EPS) continue;
      main = Math.max(0, main);
      const score = main + off * OFF_WEIGHT + Math.hypot(x - fx, y - fy) * 1e-3;
      if (score < bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

  // 重繪後游標該停哪：上次的 key 仍在就留著，否則回預設；預設也沒有就第一個；全空回 null。
  function resolve(prevKey, keys, defKey) {
    if (prevKey != null && keys.includes(prevKey)) return prevKey;
    if (defKey != null && keys.includes(defKey)) return defKey;
    return keys.length ? keys[0] : null;
  }

  const API = { pick, resolve };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.FocusNav = API;
})();
