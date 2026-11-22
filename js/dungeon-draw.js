// 採集地下城的 canvas 繪圖：像素圖集＋逐幀畫出場景。
// 規則在 js/engine.js，場景狀態（補間、氣泡、迷霧、轉場）由 js/game.js 的外殼維護；這裡只負責「把場景畫出來」，
// 對外介面：TILE、STEP_MS（外殼共用的格子大小與補間時間）、buildAtlas／spriteURL／itemSprite（圖集與 HUD 用圖）、
// drawDungeon（場景 gs、時間、圖塊組、巡邏者 sprite 由參數傳入）；tools/pixel-preview.html 也用 buildAtlas。
// 依賴：window.PIXEL_ART（js/pixelart.js）、document（離屏 canvas）——只在進地下城時才用到。
// 雙匯出：瀏覽器掛在 window.DungeonDraw，node 透過 module.exports（比照 js/focusnav.js）。
(function () {
  'use strict';

  const TILE = 16; // 一格的像素邊長
  const STEP_MS = 120; // 走一格的補間時間（外殼排程與這裡的補間共用）

  let pixelAtlas = null; // sprite id → 離屏 canvas（第一次進場時建立）
  function buildAtlas() {
    if (pixelAtlas) return pixelAtlas;
    const P = window.PIXEL_ART;
    const atlas = {};
    Object.keys(P.sprites).forEach((id) => {
      const sp = P.sprites[id];
      const src = sp.mirror ? P.sprites[sp.mirror] : sp;
      const cv = document.createElement('canvas');
      cv.width = src.w;
      cv.height = src.h;
      const c = cv.getContext('2d');
      src.rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const col = P.palette[row[x]];
          if (!col) continue;
          c.fillStyle = col;
          c.fillRect(sp.mirror ? src.w - 1 - x : x, y, 1, 1);
        }
      });
      atlas[id] = cv;
    });
    pixelAtlas = atlas;
    return atlas;
  }
  const spriteURLs = {};
  const spriteURL = (id) => spriteURLs[id] || (spriteURLs[id] = buildAtlas()[id].toDataURL());
  // 有動畫的素材（稀有）只有 _0/_1 兩格，靜態圖示取第一格
  const itemSprite = (id) => (buildAtlas()[id] ? id : `${id}_0`);

  // 畫一幀到 gs.ctx（gs.buf 是同尺寸的離屏緩衝）。
  // view：{ tileset：這張地圖的圖塊組（D.GATHER[loc].tileset）, guardSprite(gi)：第 gi 名巡邏者的 sprite 前綴 }
  // 唯一的副作用：清掉 gs.fx 裡播完的撿取特效。
  function drawDungeon(gs, now, view) {
    const { run } = gs;
    const atlas = buildAtlas();
    const b = gs.bctx;
    const BUF_W = gs.buf.width;
    const BUF_H = gs.buf.height;
    const p = gs.anim ? Math.min(1, (now - gs.anim.start) / STEP_MS) : 1;
    const at = (o, from) => (from
      ? { x: Math.round((from.x + (o.x - from.x) * p) * TILE), y: Math.round((from.y + (o.y - from.y) * p) * TILE) }
      : { x: o.x * TILE, y: o.y * TILE });
    const me = at(run.player, gs.anim && gs.anim.p);
    // 鏡頭永遠把零溶放在畫面正中央（走到地圖邊緣也一樣，地圖外就是黑的）
    const camX = Math.round(me.x + TILE / 2 - BUF_W / 2);
    const camY = Math.round(me.y + TILE / 2 - BUF_H / 2);
    const x0 = Math.max(0, Math.floor(camX / TILE));
    const y0 = Math.max(0, Math.floor(camY / TILE));
    const x1 = Math.min(run.w - 1, Math.floor((camX + BUF_W) / TILE));
    const y1 = Math.min(run.h - 1, Math.floor((camY + BUF_H) / TILE));
    const tick = Math.floor(now / 500) % 2; // 2Hz 待機動畫
    const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 8;
    const put = (id, x, y) => b.drawImage(atlas[id], x - camX, y - camY);
    const tile = (x, y) => (run.tiles[y] && run.tiles[y][x]) || '#';
    const seen = (x, y) => run.seen[y * run.w + x];
    const ts = view.tileset;

    b.fillStyle = '#0d0a14';
    b.fillRect(0, 0, BUF_W, BUF_H);

    // 地面
    const sprites = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!seen(x, y)) continue;
      const t = tile(x, y);
      const h = hash(x, y);
      if (t === '#') put(tile(x, y + 1) === '#' ? ts.wallTop : ts.wallFace, x * TILE, y * TILE);
      else if (t === ',') put(ts.hall[h % ts.hall.length], x * TILE, y * TILE);
      else if (t === 'G') put(ts.door, x * TILE, y * TILE);
      else put(ts.floor[h < 5 ? 0 : h < 7 ? 1 % ts.floor.length : 2 % ts.floor.length], x * TILE, y * TILE);
      // 擺設：比一格高的圖（16×24）往上疊
      const prop = ts.props[t];
      if (prop) sprites.push({ id: prop, x: x * TILE, y: y * TILE - (atlas[prop].height - TILE), base: y * TILE, dim: !gs.vis.has(y * run.w + x) });
    }
    // 荷花池（2×2 格，從左上格畫；多看一圈以免左上格剛好在畫面外）
    for (let y = Math.max(0, y0 - 1); y <= y1; y++) for (let x = Math.max(0, x0 - 1); x <= x1; x++) {
      if (tile(x, y) === 'P' && (seen(x, y) || seen(x + 1, y + 1))) put(`${ts.big}_${tick}`, x * TILE, y * TILE);
    }
    // 素材、角色：依 y 排序
    run.items.forEach((it) => {
      if (!seen(it.x, it.y)) return;
      sprites.push({ id: it.rare ? `${it.id}_${tick}` : itemSprite(it.id), x: it.x * TILE, y: it.y * TILE - (it.rare ? tick : 0), base: it.y * TILE + 1, dim: !gs.vis.has(it.y * run.w + it.x) });
    });
    const actor = (who, o, from, extraY, shake = 0) => {
      const pos = at(o, from);
      pos.x += shake;
      const frame = from && p < 0.75 ? 1 + (gs.steps % 2) : 0;
      sprites.push({ shadow: true, x: pos.x + 2, y: pos.y + 11, base: pos.y + 2 });
      sprites.push({ id: `${who}_${o.face}_${frame}`, x: pos.x, y: pos.y - 10 - (from ? 0 : tick) + extraY, base: pos.y + 3, head: pos });
      return pos;
    };
    // 撞到東西：零溶左右抖一下
    const bumpT = now - (gs.bumpAt || -1e9);
    actor('ling', run.player, gs.anim && gs.anim.p, 0, bumpT < 180 ? [2, -2, 1, -1, 0][Math.floor(bumpT / 36)] : 0);
    const heads = {};
    run.guards.forEach((gd, gi) => {
      // 看不到的侍衛不畫，但記下位置：跟丟的「？」要浮在迷霧裡給玩家看
      if (!gs.vis.has(gd.y * run.w + gd.x)) { heads[gi] = at(gd, gs.anim && gs.anim.g[gi]); return; }
      const hop = gi === gs.caughtBy && now >= gs.hopFrom ? -Math.round(Math.abs(Math.sin((now - gs.hopFrom) / 110)) * 4) : 0;
      heads[gi] = actor(view.guardSprite(gi), gd, gs.anim && gs.anim.g[gi], hop);
    });
    sprites.sort((s1, s2) => s1.base - s2.base);
    const paint = (list) => list.forEach((s) => {
      if (s.shadow) { b.globalAlpha = 0.35; put('shadow', s.x, s.y); b.globalAlpha = 1; } else put(s.id, s.x, s.y);
    });

    // 記憶中的擺設與素材先畫，再蓋迷霧：沒看過＝黑；看過但現在看不到＝變暗
    paint(sprites.filter((s) => s.dim));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (gs.vis.has(y * run.w + x)) continue;
      b.fillStyle = seen(x, y) ? 'rgba(13,10,20,.55)' : '#0d0a14';
      b.fillRect(x * TILE - camX, y * TILE - camY, TILE, TILE);
    }
    // 侍衛視野（畫在地上，不蓋到角色）
    gs.sight.forEach((s) => {
      if (!s) return;
      b.fillStyle = s.alert ? 'rgba(210,69,63,.35)' : 'rgba(210,69,63,.2)';
      s.cells.forEach((k) => b.fillRect((k % run.w) * TILE - camX, Math.floor(k / run.w) * TILE - camY, TILE, TILE));
    });

    // 看得到的東西最後畫：高的 sprite（角色的頭、假山、燈籠）不會被上面那格的迷霧切掉
    paint(sprites.filter((s) => !s.dim));

    // 天色：最後 15 步慢慢變暗
    const dusk = Math.max(0, 1 - run.stepsLeft / 15);
    if (dusk > 0) { b.fillStyle = `rgba(28,22,74,${(0.32 * dusk).toFixed(3)})`; b.fillRect(0, 0, BUF_W, BUF_H); }

    // 氣泡、撿取特效
    Object.keys(heads).forEach((gi) => {
      const bub = gs.bubbles[gi];
      if (bub && now < bub.until) put(bub.id, heads[gi].x + 4, heads[gi].y - 21);
    });
    gs.fx = gs.fx.filter((f) => now < f.t0 + 330);
    gs.fx.forEach((f) => { if (now >= f.t0) put(`sparkle_${Math.min(2, Math.floor((now - f.t0) / 110))}`, f.x * TILE, f.y * TILE - 6); });
    if (now < gs.flashUntil && now >= gs.hopFrom) { b.fillStyle = 'rgba(255,255,255,.75)'; b.fillRect(0, 0, BUF_W, BUF_H); }

    // 輸出（馬賽克：先縮小再用最近鄰放大）
    const c = gs.ctx;
    c.imageSmoothingEnabled = false;
    const m = Math.max(1, Math.round(gs.mosaic));
    if (m <= 1) c.drawImage(gs.buf, 0, 0);
    else {
      const w = Math.ceil(BUF_W / m);
      const h = Math.ceil(BUF_H / m);
      c.drawImage(gs.buf, 0, 0, BUF_W, BUF_H, 0, 0, w, h);
      c.drawImage(gs.el.canvas, 0, 0, w, h, 0, 0, w * m, h * m);
    }
    if (gs.fade > 0) { c.fillStyle = `rgba(13,10,20,${gs.fade})`; c.fillRect(0, 0, BUF_W, BUF_H); }
  }

  const API = { TILE, STEP_MS, buildAtlas, spriteURL, itemSprite, drawDungeon };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.DungeonDraw = API;
})();
