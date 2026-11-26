// 分享圖卡（§9 分享 prototype）：在瀏覽器用 canvas 畫 1200×630 的圖卡，版面同結局範例稿。
// ShareCard.draw(card) → Promise<HTMLCanvasElement>；ShareCard.toBlob(canvas) → Promise<Blob>（PNG）。
// card：{ title, comment, chips: [[標籤, 值]], rank, portrait（圖片網址）, url }
(function () {
  const W = 1200;
  const H = 630;
  const C = { amber: '#F4C66A', edict: '#F7E7BE', ink: '#3B2208', seal: '#C0262B', head: '#7a1f2b', text: '#F3E9FF', muted: '#CDB8EE' };
  const SERIF = '"Noto Serif TC", "Songti TC", "PMingLiU", serif';
  const SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';

  const loadImg = (src) => new Promise((res) => {
    if (!src) { res(null); return; }
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
  async function fonts() {
    if (!document.fonts) return;
    try {
      await Promise.all([`900 64px ${SERIF}`, `700 20px ${SANS}`, `400 20px ${SANS}`].map((f) => document.fonts.load(f, '零溶封號')));
    } catch { /* 字型載不到就用系統字 */ }
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  // 中文逐字換行，最多 maxLines 行（超過的最後一行補「……」）
  function wrap(ctx, text, maxW, maxLines) {
    const lines = [];
    let cur = '';
    for (const ch of text) {
      if (ctx.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; } else cur += ch;
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, -1)}……`; }
    return lines;
  }
  // 字太長就縮小到放得下
  function fit(ctx, text, font, size, maxW, min) {
    let s = size;
    do { ctx.font = font(s); s -= 2; } while (ctx.measureText(text).width > maxW && s >= min);
  }

  async function draw(card) {
    await fonts();
    const [bg, por] = await Promise.all([loadImg('assets/backgrounds/yanxi.webp'), loadImg(card.portrait)]);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    // 底：炎洗宮背景＋夜紫漸層
    ctx.fillStyle = '#1a1224';
    ctx.fillRect(0, 0, W, H);
    if (bg) { const s = Math.max(W / bg.width, H / bg.height); ctx.globalAlpha = 0.35; ctx.drawImage(bg, (W - bg.width * s) / 2, (H - bg.height * s) / 2, bg.width * s, bg.height * s); ctx.globalAlpha = 1; }
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, 'rgba(43,29,61,.88)'); g.addColorStop(0.6, 'rgba(26,18,36,.82)'); g.addColorStop(1, 'rgba(26,18,36,.6)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 右：零溶立繪＋名次
    if (por) {
      const h = H * 0.96;
      const w = (por.width / por.height) * h;
      ctx.save();
      ctx.shadowColor = 'rgba(160,100,255,.5)'; ctx.shadowBlur = 30;
      ctx.drawImage(por, W - w - 10, H - h, w, h);
      ctx.restore();
    }
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.font = `900 34px ${SERIF}`;
    ctx.fillStyle = C.amber;
    ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 10;
    ctx.fillText(card.rank, W - 40, 44);
    ctx.shadowBlur = 0;

    // 左：遊戲名
    const L = 60;
    const LW = 600;
    ctx.textAlign = 'left';
    ctx.font = `900 32px ${SERIF}`;
    ctx.fillStyle = C.amber;
    ctx.fillText('煉金術士零溶——逆襲a零溶', L, 50);

    // 聖旨框
    const ey = 112;
    const eh = 300;
    ctx.fillStyle = C.edict;
    roundRect(ctx, L, ey, LW, eh, 8); ctx.fill();
    ctx.strokeStyle = '#b8892e'; ctx.lineWidth = 4;
    roundRect(ctx, L + 6, ey + 6, LW - 12, eh - 12, 6); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = C.head;
    ctx.font = `900 22px ${SERIF}`;
    ctx.fillText('黃上詔曰　茲賜封號', L + LW / 2, ey + 28);
    ctx.fillStyle = C.seal;
    fit(ctx, card.title, (s) => `900 ${s}px ${SERIF}`, 72, LW - 60, 40);
    ctx.fillText(card.title, L + LW / 2, ey + 70);
    ctx.fillStyle = C.ink;
    ctx.font = `400 23px ${SERIF}`;
    wrap(ctx, card.comment, LW - 150, 3).forEach((ln, i) => ctx.fillText(ln, L + LW / 2, ey + 172 + i * 34));
    // 玉璽
    ctx.save();
    ctx.translate(L + LW - 62, ey + eh - 60);
    ctx.rotate(-8 * Math.PI / 180);
    ctx.strokeStyle = C.seal; ctx.lineWidth = 4;
    roundRect(ctx, -34, -34, 68, 68, 6); ctx.stroke();
    ctx.fillStyle = C.seal;
    ctx.font = `900 18px ${SERIF}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('黃上', 0, -12); ctx.fillText('之寶', 0, 12);
    ctx.restore();

    // 戰績標籤
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    let x = L;
    let y = ey + eh + 44;
    (card.chips || []).forEach(([a, b]) => {
      ctx.font = `400 21px ${SANS}`;
      const wa = ctx.measureText(`${a} `).width;
      ctx.font = `700 21px ${SANS}`;
      const wb = ctx.measureText(String(b)).width;
      const w = wa + wb + 36;
      if (x + w > L + LW + 10) { x = L; y += 50; }
      ctx.fillStyle = 'rgba(255,255,255,.1)';
      roundRect(ctx, x, y - 20, w, 40, 20); ctx.fill();
      ctx.fillStyle = C.text; ctx.font = `400 21px ${SANS}`;
      ctx.fillText(`${a} `, x + 18, y + 1);
      ctx.fillStyle = C.amber; ctx.font = `700 21px ${SANS}`;
      ctx.fillText(String(b), x + 18 + wa, y + 1);
      x += w + 12;
    });

    // 網址
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = C.muted;
    ctx.font = `400 21px ${SANS}`;
    ctx.fillText(`你能逆襲嗎？ ${card.url}`, L, H - 36);
    return cv;
  }

  const toBlob = (cv) => new Promise((res) => cv.toBlob(res, 'image/png'));

  window.ShareCard = { W, H, draw, toBlob };
})();
