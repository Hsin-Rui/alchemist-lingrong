// 鍵盤游標真瀏覽器檢查：起本機靜態 server，用 headless Chrome（CDP over Node 內建 WebSocket）
// 送鍵盤／滑鼠／觸控事件，逐條斷言 story「游標與焦點框」的 I/O 矩陣，並純鍵盤玩完一輪到結局。
// 用法：node tools/keyboard-e2e.js [--shots <dir>]   （全部通過 exit 0）
// 需要：Node ≥ 22（內建 WebSocket）、/Applications/Google Chrome.app（或環境變數 CHROME 指定路徑）
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOTS = (() => { const i = process.argv.indexOf('--shots'); return i > 0 ? process.argv[i + 1] : null; })();
const CRIMSON = 'rgb(142, 43, 43)';
const AMBER = 'rgb(244, 198, 106)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  — ${detail}` : ''}`);
}

// ───────── 靜態 server ─────────
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.svg': 'image/svg+xml' };
function startServer() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.normalize(path.join(ROOT, rel === '/' ? '/index.html' : rel));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// ───────── Chrome + CDP ─────────
async function launchChrome() {
  const port = 9300 + Math.floor(Math.random() * 500);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lingrong-e2e-'));
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio',
    '--autoplay-policy=no-user-gesture-required', '--window-size=480,900', 'about:blank',
  ], { stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return { proc, dir, ws: page.webSocketDebuggerUrl };
    } catch { /* 還沒起來 */ }
    await sleep(100);
  }
  proc.kill();
  throw new Error('Chrome 沒有起來');
}

function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  const handlers = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
    } else if (msg.method) handlers.forEach((h) => h(msg));
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  return new Promise((resolve, reject) => {
    ws.onopen = () => resolve({ send, on: (h) => handlers.push(h), close: () => ws.close() });
    ws.onerror = reject;
  });
}

// ───────── 主流程 ─────────
(async () => {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/index.html#e2e`;
  const chrome = await launchChrome();
  const cdp = await connect(chrome.ws);
  const errors = [];
  cdp.on((m) => {
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  });
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  const ev = async (expr) => {
    const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`${expr}\n→ ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    return r.result.value;
  };
  const waitFor = async (expr, ms = 4000) => {
    const t = Date.now();
    while (Date.now() - t < ms) { if (await ev(expr)) return true; await sleep(40); }
    return false;
  };
  const KEYS = {
    Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' },
    Space: { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' },
    Escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
    Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 },
    ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 },
    ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 },
    ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 },
    ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 },
    Shift: { key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 },
    m: { key: 'm', code: 'KeyM', windowsVirtualKeyCode: 77, text: 'm' },
    ...Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [String(n), { key: String(n), code: `Digit${n}`, windowsVirtualKeyCode: 48 + n, text: String(n) }])),
  };
  const press = async (name, { modifiers = 0, wait = 40 } = {}) => {
    const k = KEYS[name];
    await cdp.send('Input.dispatchKeyEvent', { type: k.text ? 'keyDown' : 'rawKeyDown', modifiers, ...k });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers, ...k, text: undefined });
    await sleep(wait);
  };
  const click = async (x, y) => {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await sleep(60);
  };
  const shot = async (name) => {
    if (!SHOTS) return;
    fs.mkdirSync(SHOTS, { recursive: true });
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SHOTS, `${name}.png`), Buffer.from(data, 'base64'));
  };

  // 頁面內小工具：focus 狀態、依 key 找元素（與 game.js navItems 同規則）、範圍內預設 key
  const HELPERS = `
    window.__t = {
      scope() { const l = document.querySelectorAll('#app .sheet-layer'); return l.length ? l[l.length - 1] : document.querySelector('#app .screen'); },
      items() {
        const seen = {}; const out = [];
        const sc = this.scope(); if (!sc) return out;
        sc.querySelectorAll('[data-a]').forEach((el) => {
          const a = el.dataset.a;
          if (a === 'adv' || a === 'noop' || el.disabled || !el.getClientRects().length) return;
          const b = a + '|' + (el.dataset.v ?? ''); seen[b] = (seen[b] || 0) + 1;
          out.push({ el, key: b + '#' + seen[b] });
        });
        return out;
      },
      el(key) { const it = this.items().find((x) => x.key === key); return it ? it.el : null; },
      defKey() { const d = this.scope()?.querySelector('[data-def]'); const it = this.items().find((x) => x.el === d); return it ? it.key : null; },
      firstKey() { const it = this.items()[0]; return it ? it.key : null; },
      focus() {
        const b = document.querySelector('.focus-box.on');
        if (!b) return null;
        const r = b.getBoundingClientRect();
        const el = this.el(b.dataset.key);
        const er = el && el.getBoundingClientRect();
        return { key: b.dataset.key, color: getComputedStyle(b.firstElementChild).borderTopColor, box: [r.left, r.top, r.width, r.height],
          el: er ? [er.left, er.top, er.width, er.height] : null, nav: !!(el && el.closest('.bottomnav')), disabled: !!(el && el.disabled) };
      },
      center(sel) { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; },
    };`;
  const focus = () => ev('__t.focus()');
  const scr = () => ev("document.getElementById('app').dataset.screen");
  const hasDlg = () => ev("!!document.querySelector('.dialog-layer')");
  const hasModal = (a) => ev(`!!document.querySelector('#app > .sheet-layer [data-a="${a}"]')`);
  const G = (code) => ev(`(() => { const S = __e2e.state(); const D = window.GAME_DATA; ${code} })()`);
  const hideByMouse = async () => { await click(2, 2); }; // 左上角空白處（不是按鈕）
  const pressUntilStable = async (k, max = 40) => {
    let prev = (await focus())?.key;
    for (let i = 0; i < max; i++) {
      await press(k);
      const cur = (await focus())?.key;
      if (cur === prev) return cur;
      prev = cur;
    }
    return prev;
  };

  async function load(metrics) {
    await cdp.send('Emulation.setDeviceMetricsOverride', metrics);
    await cdp.send('Page.navigate', { url: 'about:blank' });
    await sleep(100);
    await cdp.send('Page.navigate', { url: base });
    await waitFor('!!window.__e2e && !!document.querySelector("#app .screen")', 8000);
    await ev(HELPERS);
  }

  try {
    await load({ width: 480, height: 900, deviceScaleFactor: 1, mobile: false });

    // ── 標題：Enter 無游標 → 開始遊戲 ──
    check('標題頁開機無焦點框', (await focus()) === null && (await scr()) === 'title');
    await press('Tab');
    check('Tab 不叫出焦點框', (await focus()) === null);
    await press('Enter');
    check('Enter 無游標 → 按下「開始遊戲」', await waitFor("!!document.querySelector('.dialog-layer')", 2000));

    // ── 對話：方向鍵無效、Space／Enter 推進 ──
    const line0 = await ev("document.querySelector('.dlg-text').dataset.full");
    await press('ArrowDown');
    check('對話中方向鍵無效', (await focus()) === null && line0 === await ev("document.querySelector('.dlg-text').dataset.full"));
    await press('Space'); await press('Space');
    const line1 = await ev("document.querySelector('.dlg-text')?.dataset.full");
    await press('Enter'); await press('Enter');
    const line2 = await ev("document.querySelector('.dlg-text')?.dataset.full");
    check('Space、Enter 推進對話', line1 !== line0 && line2 !== line1, `${line0} / ${line1} / ${line2}`);
    for (let i = 0; i < 400 && await hasDlg(); i++) await press('Space', { wait: 15 });
    check('連按 Space 跑完開場對話進主畫面', !(await hasDlg()) && (await scr()) === 'home');

    // ── 主畫面：首次方向鍵出現在第一張訂單卡主要按鈕，不移動 ──
    const firstOrder = await G(`
      if (!S.orders.length) { // 第 1 天剛好沒訂單：造一張
        const product = Object.keys(D.PRODUCTS).find((p) => D.PRODUCTS[p].recipe && D.PRODUCTS[p].out !== 'inv');
        S.orders.push({ id: ++S.seq, who: D.TARGETS[0], product, due: S.day + 2 });
      }
      const o = S.orders[0];
      D.PRODUCTS[o.product].recipe.forEach((id) => { S.inv[id] = (S.inv[id] || 0) + 1; });
      __e2e.render(); return o.id;`);
    check('造出第一張訂單', firstOrder != null);
    check('方向鍵前不顯示焦點框', (await focus()) === null);
    await press('ArrowDown');
    let f = await focus();
    check('首次方向鍵 → 第一張訂單卡主要按鈕（只顯示不移動）', f && f.key === `craftfor|${firstOrder}#1`, JSON.stringify(f));
    check('淺色面框為朱紅', f && f.color === CRIMSON, f && f.color);
    check('焦點框往外 5px、元素不變', f && f.el && Math.abs(f.box[0] - (f.el[0] - 5)) < 0.6 && Math.abs(f.box[2] - (f.el[2] + 10)) < 0.6, JSON.stringify(f));
    await shot('home-crimson');

    // ── 往下移：移到下方元素；一路到底不繞回 ──
    const yOf = (key) => ev(`(() => { const e = __t.el(${JSON.stringify(key)}); const r = e.getBoundingClientRect(); return r.top + r.height / 2; })()`);
    const before = f.key;
    await press('ArrowDown');
    f = await focus();
    const movedDown = f && f.key !== before && (await yOf(f.key)) > (await yOf(before));
    check('↓ 移到下方最近可按元素', movedDown, `${before} → ${f && f.key}`);
    await pressUntilStable('ArrowDown');
    f = await focus();
    check('一路 ↓ 到底停在導覽列', f && f.nav, JSON.stringify(f));
    check('深色面（導覽列）框為琥珀', f && f.color === AMBER, f && f.color);
    await shot('nav-amber');
    const bottomKey = f.key;
    await press('ArrowDown');
    check('底部再按 ↓ 不繞回', (await focus())?.key === bottomKey);
    const rightKey = await pressUntilStable('ArrowRight');
    check('→ 到最右「就寢」且不繞回', rightKey === 'sleep|#1', rightKey);
    await press('ArrowDown', { modifiers: 2 });
    check('有 Ctrl 修飾鍵不攔截', (await focus())?.key === 'sleep|#1');

    // ── 滑鼠：點一下框消失；再按方向鍵從預設重現 ──
    await hideByMouse();
    check('點一下滑鼠 → 框隱藏', (await focus()) === null);
    await press('ArrowUp');
    f = await focus();
    check('再按方向鍵 → 從畫面預設重現（非上次位置）', f && f.key === `craftfor|${firstOrder}#1`, JSON.stringify(f));

    // ── 無訂單 → 預設＝導覽列「採集」；重繪後原 key 不在則回預設 ──
    await G('window.__saved = S.orders; S.orders = []; __e2e.render();');
    f = await focus();
    check('無訂單：重繪後回預設＝導覽列「採集」', f && f.key === 'go|gather#1', JSON.stringify(f));
    await G('S.orders = window.__saved; __e2e.render();');

    // ── 捲軸外的卡片：一路 ↓ 會先走完所有訂單卡（捲進畫面），才到下方固定列 ──
    await hideByMouse();
    const orderIds = await G(`
      const product = Object.keys(D.PRODUCTS).find((p) => D.PRODUCTS[p].recipe && D.PRODUCTS[p].out !== 'inv');
      while (S.orders.length < 4) S.orders.push({ id: ++S.seq, who: D.TARGETS[S.orders.length % D.TARGETS.length], product, due: S.day + 2 });
      __e2e.render(); return S.orders.map((o) => o.id);`);
    await press('ArrowDown');
    const walk = [];
    for (let i = 0; i < 60; i++) { const k = (await focus())?.key; if (walk[walk.length - 1] === k) break; walk.push(k); await press('ArrowDown'); }
    const lastReject = Math.max(...orderIds.map((id) => walk.indexOf(`reject|${id}#1`)));
    const firstFixed = walk.findIndex((k) => k && k.startsWith('spikeinfo|'));
    check('↓ 先走完捲軸外的訂單卡才到固定列', orderIds.every((id) => walk.includes(`reject|${id}#1`)) && firstFixed > lastReject, walk.join(' '));
    await G('S.orders = window.__saved; __e2e.render();');

    // ── 小舖：停用跳過、預設第一個買得起；全買不起 ──
    await hideByMouse();
    const shopCase = await G(`
      const prices = D.SHOP.map((id) => D.ITEMS[id].price);
      const cheap = Math.min(...prices);
      window.__silver = S.silver; S.silver = cheap;
      __e2e.go('shop');
      return { exp: D.SHOP.find((id) => D.ITEMS[id].price <= cheap), anyDisabled: prices.some((p) => p > cheap) };`);
    await press('ArrowDown');
    f = await focus();
    check('小舖預設＝第一個買得起的商品', f && f.key === `buy|${shopCase.exp}#1` && shopCase.anyDisabled, JSON.stringify(f));
    let landedDisabled = false;
    for (let i = 0; i < 12; i++) { await press(i < 6 ? 'ArrowDown' : 'ArrowUp'); if ((await focus())?.disabled) landedDisabled = true; }
    check('停用（買不起）按鈕被跳過', !landedDisabled);
    await G('S.silver = 0; __e2e.render();');
    await hideByMouse();
    await press('Enter');
    check('全買不起：Enter 無預設 → 無動作', (await scr()) === 'shop' && (await G('return S.silver;')) === 0);
    await press('ArrowDown');
    f = await focus();
    check('全買不起：方向鍵 → 第一個可按元素', f && f.key === await ev('__t.firstKey()'), JSON.stringify(f));
    await G('S.silver = window.__silver; __e2e.go("home");');

    // ── 彈窗：就寢確認，游標只在視窗內，預設「就寢」 ──
    await hideByMouse();
    await ev("document.querySelector('[data-a=sleep]').click()");
    await press('ArrowDown');
    f = await focus();
    check('就寢確認預設＝「就寢」', f && f.key === 'sleepyes|#1', JSON.stringify(f));
    const inModal = new Set();
    for (const k of ['ArrowUp', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowLeft']) { await press(k); inModal.add((await focus())?.key); }
    check('彈窗開著時游標只在視窗內', [...inModal].every((k) => k === 'sleepyes|#1' || k === 'closemodal|#1') && inModal.has('closemodal|#1'), [...inModal].join(','));
    await press('ArrowLeft');
    await press('Enter');
    check('Enter 按下游標所在「再想想」→ 關閉視窗', !(await hasModal('sleepyes')) && (await scr()) === 'home');

    // ── 調合：重繪後同一素材按鈕仍在就留著，否則回預設 ──
    await hideByMouse();
    const mats = await G(`
      window.__inv = { ...S.inv };
      const ids = Object.keys(D.ITEMS).filter((id) => D.ITEMS[id].type === 'mat').slice(0, 2);
      S.inv = { [ids[0]]: 2, [ids[1]]: 1 };
      __e2e.openCraft(null); return ids;`);
    await press('ArrowDown');
    f = await focus();
    check('調合預設＝第一個可用素材', f && f.key === `mat|${mats[0]}#1`, JSON.stringify(f));
    check('調合米色素材抽屜（淺色面）框為朱紅', f && f.color === CRIMSON, f && f.color);
    await shot('craft-drawer');
    await press('ArrowUp'); await press('ArrowUp');
    const fw = await focus();
    check('調合深色工房區框為琥珀', fw && fw.color === AMBER, JSON.stringify(fw));
    await hideByMouse(); await press('ArrowDown');
    await press('Enter');
    f = await focus();
    check('放入素材後重繪：同一素材按鈕仍在 → 留著', f && f.key === `mat|${mats[0]}#1`, JSON.stringify(f));
    await press('Enter');
    f = await focus();
    const defAfter = await ev('__t.defKey()');
    check('素材按鈕停用後 → 回預設', f && f.key === defAfter && !f.key.startsWith(`mat|${mats[0]}`), `${f && f.key} vs ${defAfter}`);
    await G('S.inv = window.__inv; __e2e.go("home");');

    // ── 採集地下城：方向鍵只有地下城走路；收工後結果單預設 ──
    await hideByMouse();
    await G('__e2e.go("gather");');
    await press('ArrowDown');
    f = await focus();
    check('採集預設＝第一個可去的地點', f && f.key === 'enter|garden#1', JSON.stringify(f));
    await press('Enter');
    check('Enter 進入地下城', await waitFor("!!document.querySelector('.dg.on')", 3000));
    await sleep(900);
    const steps0 = await ev("Number(document.querySelector('.dg-steps b').textContent)");
    let sawBox = false;
    for (const k of ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']) {
      await press(k, { wait: 220 });
      if (await focus()) sawBox = true;
    }
    const steps1 = await ev("Number(document.querySelector('.dg-steps b').textContent)");
    check('地下城中方向鍵只有走路（無焦點框）', !sawBox && steps1 < steps0, `${steps0} → ${steps1}`);
    await press('Escape');
    await press('Enter');
    check('地下城 Esc＋Enter 收工（沿用既有按鍵）', await waitFor("!document.querySelector('.dg') && !!document.querySelector('#app .sheet-layer')", 4000));
    f = await focus();
    check('地下城回來游標仍在（鍵盤玩家不必重叫）', !!f);
    if (!f) { await press('ArrowDown'); f = await focus(); }
    const gExp = (await ev("!!document.querySelector('[data-a=gatherdone][data-v=craft]')")) ? 'gatherdone|craft#1' : 'gatherdone|home#1';
    check('採集結果單預設（直接去調合／回炎洗宮）', f && f.key === gExp, JSON.stringify(f));
    await press('Enter');
    check('結果單 Enter 離開', await waitFor("!document.querySelector('#app .sheet-layer')", 2000));

    // ── 快捷鍵（story 2）：1–6、Esc、M ──
    await hideByMouse();
    const toScr = async (key, want) => { await press(key); return (await scr()) === want; };
    check('主畫面按 1 → 小舖', await toScr('1', 'shop'));
    check('子畫面按 Esc → 主畫面', await toScr('Escape', 'home'));
    check('按 2 → 採集', await toScr('2', 'gather'));
    check('子畫面按 3 → 調合', await toScr('3', 'craft'));
    await G('const ids = Object.keys(D.ITEMS).filter((id) => D.ITEMS[id].type === "mat"); S.inv[ids[0]] = (S.inv[ids[0]] || 0) + 2; __e2e.render();');
    await ev("document.querySelector('[data-a=mat]:not([disabled])').click()");
    const slotsBefore = await ev("document.querySelectorAll('.cslot.filled').length");
    await press('3');
    check('調合畫面再按 3 不清掉已放的素材', slotsBefore > 0 && (await ev("document.querySelectorAll('.cslot.filled').length")) === slotsBefore, String(slotsBefore));
    check('子畫面按 4 → 送禮', await toScr('4', 'gift'));
    check('子畫面按 5 → 後宮', await toScr('5', 'status'));
    check('後宮按 1 → 小舖', await toScr('1', 'shop'));
    await press('Escape');
    await press('6');
    check('按 6 → 就寢確認視窗', await hasModal('sleepyes'));
    await press('2');
    check('彈出視窗開著時數字鍵無效', (await hasModal('sleepyes')) && (await scr()) === 'home');
    await press('Escape');
    check('Esc 關閉彈出視窗', !(await hasModal('sleepyes')) && (await scr()) === 'home');
    const muted0 = await ev("localStorage.getItem('lingrong-muted')");
    await press('m');
    const muted1 = await ev("localStorage.getItem('lingrong-muted')");
    await press('m');
    const muted2 = await ev("localStorage.getItem('lingrong-muted')");
    check('M 開關聲音', muted1 === (muted0 === '1' ? '0' : '1') && muted2 === (muted1 === '1' ? '0' : '1'), `${muted0}/${muted1}/${muted2}`);
    await ev("__e2e.playDialog([['narr','','測試對話一'],['narr','','測試對話二']], () => __e2e.go('home'))");
    await press('1');
    check('對話中數字鍵無效', (await hasDlg()) && (await scr()) === 'home');
    await press('Enter'); // 補完整句
    const fullBefore = await ev("document.querySelector('.dlg-text').innerHTML");
    await press('m');
    check('對話中按 M 不會讓目前這句重打', (await ev("document.querySelector('.dlg-text').innerHTML")) === fullBefore);
    await press('m');
    for (let i = 0; i < 20 && await hasDlg(); i++) await press('Space', { wait: 15 });

    // ── 對話速度、略過、防連按（story 3） ──
    const txt = () => ev("document.querySelector('.dlg-text')?.innerHTML || ''");
    const full = () => ev("document.querySelector('.dlg-text')?.dataset.full || ''");
    const LONG = '這是一句很長很長的測試台詞，用來確認逐字顯示的速度是不是兩倍速，大概每秒七十個字左右。';
    await ev(`__e2e.playDialog([['narr','',${JSON.stringify(LONG)}],['narr','','第二句'],['doctor','_','且慢！這東西裡有料！',{lock:true}],['narr','','之後']], () => __e2e.go('home'))`);
    check('對話按鈕文字「略過 ≫」與「▶ 2×」', (await ev("document.querySelector('.skip-btn').textContent")) === '略過 ≫' && (await ev("document.querySelector('.speed-btn').textContent")) === '▶ 2×');
    await sleep(150);
    const part = (await txt()).length;
    check('2× 逐字顯示（150ms 後只出現一部分）', part > 3 && part < LONG.length, String(part));
    await sleep(900);
    check('2× 約 1 秒內打完一長句', (await txt()) === LONG);
    // Shift 跟其他鍵組合時不算
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37, modifiers: 8 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37, modifiers: 8 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 });
    await sleep(40);
    check('Shift 與其他鍵組合時不切換速度', (await ev("document.querySelector('.speed-btn').textContent")) === '▶ 2×');
    await press('Shift');
    check('Shift 單獨按放 → 瞬間', (await ev("document.querySelector('.speed-btn').textContent")) === '▶ 瞬間');
    await press('Space');
    check('瞬間：下一句直接整句出現', (await txt()) === '第二句' && (await full()) === '第二句');
    await press('Space');
    check('防連按句直接整句顯示、▼ 隱藏', (await txt()).startsWith('且慢！') && (await ev("getComputedStyle(document.querySelector('.dlg-next')).visibility")) === 'hidden');
    await press('Space', { wait: 10 }); await press('Enter', { wait: 10 });
    await click(240, 450);
    check('0.6 秒內按鍵與點擊無效', (await full()).startsWith('且慢！'));
    await sleep(650);
    check('0.6 秒後 ▼ 出現', (await ev("getComputedStyle(document.querySelector('.dlg-next')).visibility")) === 'visible');
    await press('Space');
    check('解鎖後可推進', (await full()) === '之後');
    await ev("document.querySelector('.speed-btn').click()");
    check('點倍速按鈕切回 2×', (await ev("document.querySelector('.speed-btn').textContent")) === '▶ 2×');
    await press('Escape');
    check('對話中 Esc 略過整段', !(await hasDlg()) && (await scr()) === 'home');
    await ev(`__e2e.playDialog([['doctor','_','且慢！',{lock:true}],['narr','','後面']], () => __e2e.go('home'))`);
    await press('Escape');
    check('Esc 略過不受防連按影響', !(await hasDlg()));
    await press('Shift'); // 切到瞬間，之後重開遊戲要回到 2×

    // ── 純鍵盤玩到結局 ──
    let craftedOnDay = 0;
    let singChecked = false;
    let resultEscChecked = false;
    let craftChecked = false;
    let stuck = 0;
    let last = '';
    for (let i = 0; i < 6000; i++) {
      const s = await scr();
      const dlgOn = await hasDlg();
      if (s === 'ending' && !dlgOn) break;
      const sig = `${s}|${dlgOn}|${(await focus())?.key}|${await ev("document.querySelector('.dlg-text')?.dataset.full || ''")}|${await G('return S && S.day + "/" + S.slot;')}`;
      stuck = sig === last ? stuck + 1 : 0;
      last = sig;
      if (stuck > 30) throw new Error(`卡住了：${sig}`);
      if (dlgOn) { await press('Space', { wait: (await ev("!!document.querySelector('.dialog-box.locked')")) ? 120 : 15 }); continue; } // 防連按句等它解鎖
      if (await hasModal('sing')) {
        if (!(await focus())) await press('ArrowRight');
        const k1 = (await focus())?.key;
        await press('ArrowLeft'); const k2 = (await focus())?.key;
        await press('ArrowRight'); const k3 = (await focus())?.key;
        if (!singChecked) {
          await press('Escape');
          check('金縷衣（鎖定）視窗 Esc 無效', await hasModal('sing'));
          await press('1');
          check('金縷衣視窗開著時數字鍵無效', await hasModal('sing'));
          check('金縷衣視窗預設＝唱；←→ 選', k1 === 'sing|1#1' && k2 === 'sing|0#1' && k3 === 'sing|1#1', `${k1} ${k2} ${k3}`);
          singChecked = true;
        }
        await press('Enter');
        continue;
      }
      if (await hasModal('sleepyes')) { await press('Enter'); continue; }
      if (s === 'result' && !resultEscChecked) {
        resultEscChecked = true;
        await press('Escape');
        check('交貨／送禮結果頁按 Esc → 回炎洗宮', await waitFor("document.getElementById('app').dataset.screen !== 'result' || !!document.querySelector('.dialog-layer') || !!document.querySelector('#app > .sheet-layer')", 2000));
        continue;
      }
      if (s === 'home') {
        // 造情境：讓今晚翻到零溶（且未禁足），保證會遇到金縷衣視窗
        if (!singChecked) await G('S.flip = "lingrong"; S.groundUntil = 0; __e2e.render();');
        // 造情境：第一次回主畫面時補齊第一張訂單的材料，保證走一次「調合 → 結果單」
        if (!craftedOnDay) await G('const o = S.orders[0]; if (o) { D.PRODUCTS[o.product].recipe.forEach((id) => { S.inv[id] = (S.inv[id] || 0) + 1; }); __e2e.render(); }');
        if (!(await focus())) await press('ArrowUp');
        const day = await G('return S.day;');
        const k = (await focus())?.key || '';
        if (k.startsWith('craftfor|') && craftedOnDay !== day && k !== 'craftfor|#1') {
          craftedOnDay = day;
          await press('Enter'); // 進調合（訂單自動放好材料）
          continue;
        }
        await pressUntilStable('ArrowDown');
        await pressUntilStable('ArrowRight');
        await press('Enter'); // 就寢 → 確認視窗
        continue;
      }
      if (s === 'craft' && !(await ev("!!document.querySelector('#app .sheet-layer')"))) {
        // 一路 ↓ 到「開始調合」；按不到（材料不齊）就 ↑← 到返回鍵回宮
        if (!(await focus())) await press('ArrowDown');
        let ck = (await focus())?.key;
        for (let j = 0; j < 40 && ck !== 'craft|#1'; j++) { await press('ArrowDown'); const n = (await focus())?.key; if (n === ck) break; ck = n; }
        if (ck === 'craft|#1') {
          await press('Enter');
          const ok = await waitFor("!!document.querySelector('#app .sheet-layer')", 4000);
          if (!craftChecked) { check('調合畫面 ↓ 到「開始調合」→ 結果單', ok); craftChecked = true; }
        } else {
          await pressUntilStable('ArrowUp');
          await pressUntilStable('ArrowLeft');
          await press('Enter');
        }
        continue;
      }
      // 其他畫面（夜晚、交貨結果、結果單…）：Enter 按預設
      await press('Enter', { wait: 60 });
    }
    check('純鍵盤從標題玩到結局', (await scr()) === 'ending' && !(await hasDlg()));
    check('玩的過程中遇到金縷衣視窗並以 ←→ 操作', singChecked);
    check('玩的過程中有檢查到結果頁 Esc', resultEscChecked);
    check('玩的過程中純鍵盤調合過一次', craftedOnDay > 0);
    f = await focus();
    if (!f) { await press('ArrowDown'); f = await focus(); }
    check('結局預設＝再玩一次', f && f.key === 'start|#1', JSON.stringify(f));
    check('結局（深色面）框為琥珀', f && f.color === AMBER, f && f.color);
    await shot('ending-amber');

    // ── 手機寬度＋觸控：整輪看不到焦點框 ──
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await load({ width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await ev("__e2e.playDialog([['narr','','重開後']], () => __e2e.go('title'))");
    check('重開遊戲後對話速度回到 2×（不記住）', (await ev("document.querySelector('.speed-btn').textContent")) === '▶ 2×');
    check('手機：倍速按鈕至少 40px 高、在略過左邊同列', await ev("(() => { const a = document.querySelector('.speed-btn'), b = document.querySelector('.skip-btn'); if (!a || !b) return false; const r = a.getBoundingClientRect(), q = b.getBoundingClientRect(); return r.height >= 40 && Math.abs(r.top - q.top) < 2 && r.right <= q.left; })()"));
    await ev("document.querySelector('.skip-btn').click()");
    const tap = async (sel) => {
      const c = await ev(`__t.center(${JSON.stringify(sel)})`);
      if (!c) return false;
      await cdp.send('Input.synthesizeTapGesture', { x: c[0], y: c[1], duration: 30 });
      await sleep(80);
      return true;
    };
    let touchBox = false;
    let taps = 0;
    for (let i = 0; i < 3000; i++) {
      const s = await scr();
      if (s === 'ending' && !(await hasDlg())) break;
      if (await focus()) touchBox = true;
      taps++;
      if (await hasDlg()) await tap('.skip-btn');
      else if (await hasModal('sing')) await tap('[data-a=sing][data-v="0"]');
      else if (await hasModal('sleepyes')) await tap('[data-a=sleepyes]');
      else if (s === 'title') await tap('[data-a=start]');
      else if (s === 'home') await tap('[data-a=sleep]');
      else if (s === 'night') await tap('[data-a=next]');
      else await tap('[data-def]');
    }
    if (await focus()) touchBox = true;
    check('手機寬度觸控玩一輪到結局', (await scr()) === 'ending', `taps=${taps}`);
    check('觸控全程看不到焦點框', !touchBox);

    // ── 加料演出分輕中重（story 4）：用 #演出=<事件> 測試入口 ──
    const fxBase = base.replace('#e2e', '');
    async function loadFx(evName, reduce = false) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 480, height: 900, deviceScaleFactor: 1, mobile: false });
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }] });
      await cdp.send('Page.navigate', { url: 'about:blank' });
      await sleep(100);
      await cdp.send('Page.navigate', { url: `${fxBase}#${encodeURIComponent('演出')}${evName === null ? '' : `=${evName}`}` });
      await waitFor('!!document.querySelector("#app .screen")', 8000);
    }
    const FX_PROBE = `(() => {
      const st = document.querySelector('.stamp');
      const res = document.querySelector('.result');
      const a = st && st.getAnimations().find((x) => x.effect.getKeyframes().length === 5); // 狠章：砰→0.9→停格→1.07→1
      let hold = null;
      if (a) { const k = a.effect.getKeyframes(); hold = Math.round((k[2].computedOffset - k[1].computedOffset) * a.effect.getTiming().duration); }
      return { cls: st ? st.className : null, font: st ? getComputedStyle(st).fontSize : null, hold,
        shakeCls: !!(res && res.classList.contains('fx-shake')), shakeAnim: res ? getComputedStyle(res).animationName : null,
        shakeDur: res ? getComputedStyle(res).animationDuration : null };
    })()`;
    const noShakeNow = () => ev("document.getAnimations().every((a) => a.animationName !== 'fxshake') && !document.querySelector('.fx-shake')");
    const toResult = async () => { await press('Escape'); await waitFor("document.getElementById('app').dataset.screen === 'result'", 2000); };

    // 輕：腹瀉（對話逐句走，確認立繪演出、對話中不晃）
    await loadFx('croton');
    check('演出入口：#演出=croton 直接播對話', await hasDlg());
    check('輕：受害者那句立繪跳起來抖（fx-victim＋動畫）', await ev("!!document.querySelector('.dlg-portrait.fx-victim') && document.querySelector('.dlg-portrait').getAnimations().length > 0"));
    check('輕：對話中不搖晃（受害者句）', await noShakeNow());
    await sleep(650);
    await press('Space');
    check('輕：零溶奸笑句立繪特寫（fx-evil）', await ev("!!document.querySelector('.dlg-portrait.fx-evil') && document.querySelector('.dlg-portrait').getAnimations().length > 0"));
    check('輕：對話中不搖晃（零溶句）', await noShakeNow());
    await press('Space'); await press('Space');
    await waitFor("document.getElementById('app').dataset.screen === 'result'", 2000);
    let p = await ev(FX_PROBE);
    check('輕：紅狠章 72px', /fierce/.test(p.cls) && /red/.test(p.cls) && p.font === '72px', JSON.stringify(p));
    check('輕：停格約 0.07 秒', p.hold === 70, String(p.hold));
    check('輕：結果頁不晃', !p.shakeCls && p.shakeAnim === 'none', JSON.stringify(p));
    await sleep(500);
    check('輕：受害者立繪被震（有動畫）', await ev("document.querySelector('.result-portrait').getAnimations().length > 0"));
    check('輕：14 顆墨點＋1 圈墨痕', await ev("document.querySelectorAll('.fx-ink').length === 14 && document.querySelectorAll('.fx-ring').length === 1"));
    check('輕：墨點與章同色', await ev("getComputedStyle(document.querySelector('.fx-ink')).backgroundColor === getComputedStyle(document.querySelector('.stamp')).color"));
    await shot('fx-light-croton');
    await press('Enter');
    check('演出入口：結果頁 Enter 照常回炎洗宮', await waitFor("document.getElementById('app').dataset.screen === 'home'", 2000));

    // 中：麝香 2/3
    await loadFx('musk_dose');
    check('中：零溶奸笑句特寫（不搖晃）', (await ev("document.querySelectorAll('.dlg-portrait').length === 1")) && await noShakeNow());
    await sleep(650); await press('Space');
    check('中：零溶那句 fx-evil', await ev("!!document.querySelector('.dlg-portrait.fx-evil')"));
    await toResult();
    p = await ev(FX_PROBE);
    check('中：紫狠章 48px', /fierce/.test(p.cls) && /purple/.test(p.cls) && p.font === '48px', JSON.stringify(p));
    check('中：停格約 0.12 秒', p.hold === 120, String(p.hold));
    check('中：不晃', !p.shakeCls && p.shakeAnim === 'none');
    await sleep(500);
    await shot('fx-medium-musk');
    // 中：麝香落空
    await loadFx('musk_miss');
    await toResult();
    p = await ev(FX_PROBE);
    check('中：麝香落空同紫狠章、0.12 秒、不晃', /fierce/.test(p.cls) && /purple/.test(p.cls) && p.hold === 120 && !p.shakeCls, JSON.stringify(p));

    // 重：不孕
    await loadFx('musk_infertile');
    check('重：受害者句立繪抖', await ev("!!document.querySelector('.dlg-portrait.fx-tremble')"));
    await sleep(900); await press('Space');
    check('重：旁白重擊句文字框「砰」', await ev("!!document.querySelector('.dialog-box.narr.fx-slam') && document.querySelector('.dialog-box').getAnimations().length > 0"));
    check('重：對話中不搖晃', await noShakeNow());
    await sleep(650); await press('Space');
    check('重：零溶特寫', await ev("!!document.querySelector('.dlg-portrait.fx-evil')"));
    await press('Space'); await press('Space');
    await waitFor("document.getElementById('app').dataset.screen === 'result'", 2000);
    p = await ev(FX_PROBE);
    check('重：紅狠章 72px', /fierce/.test(p.cls) && /red/.test(p.cls) && p.font === '72px', JSON.stringify(p));
    check('重：停格約 0.19 秒', p.hold === 190, String(p.hold));
    check('重：蓋章時晃一次（fxshake 0.76 秒、只播一次）', p.shakeCls && p.shakeAnim === 'fxshake' && p.shakeDur === '0.76s' && (await ev("getComputedStyle(document.querySelector('.result')).animationIterationCount")) === '1', JSON.stringify(p));
    await sleep(700);
    await shot('fx-heavy-infertile');
    await press('m'); await press('m'); // 重繪
    check('重：結果頁重繪後不再晃', !(await ev(FX_PROBE)).shakeCls);
    for (const evName of ['safflower_infertile', 'miscarry_musk', 'miscarry_safflower']) {
      await loadFx(evName);
      await toResult();
      p = await ev(FX_PROBE);
      check(`重：${evName} 紅狠章、0.19 秒、晃一次`, /fierce/.test(p.cls) && /red/.test(p.cls) && p.hold === 190 && p.shakeAnim === 'fxshake', JSON.stringify(p));
    }

    // 減少動態：重事件不晃，其他照常
    await loadFx('musk_infertile', true);
    await sleep(900); await press('Space');
    check('減少動態：旁白框「砰」照常', await ev("document.querySelector('.dialog-box').getAnimations().length > 0"));
    await toResult();
    p = await ev(FX_PROBE);
    check('減少動態：重事件不晃', p.shakeAnim === 'none', JSON.stringify(p));
    check('減少動態：狠章與停格照常', /fierce/.test(p.cls) && p.hold === 190, JSON.stringify(p));
    await sleep(500);
    check('減少動態：墨點照常', await ev("document.querySelectorAll('.fx-ink').length === 14"));

    // 一般：收下／拒收／無效／麝香白下／被抓（被抓不再每個紅章都晃）
    for (const [evName, cls] of [['plain', 'gold'], ['refused', 'grey'], ['musk_useless', 'grey'], ['safflower_useless', 'grey'], ['caught', 'red']]) {
      await loadFx(evName);
      await toResult();
      p = await ev(FX_PROBE);
      check(`一般：${evName} 一般章、不晃`, p.cls === `stamp ${cls}` && !p.shakeCls && p.shakeAnim === 'none', JSON.stringify(p));
    }
    await loadFx('不存在');
    check('演出入口：未知事件 → 標題頁', (await scr()) === 'title' && !(await hasDlg()));
    await loadFx(null);
    check('演出入口：#演出 顯示事件選單', await ev("document.querySelectorAll('#app .sheet a[href^=\"#\"]').length >= 10"));
    await ev("document.querySelector('#app .sheet a[href*=\"croton\"]').click()");
    await waitFor("!!document.querySelector('.dialog-layer')", 4000);
    check('演出入口：點選單事件 → 播該事件', await ev("!!document.querySelector('.dlg-portrait.fx-victim')"));
    await cdp.send('Emulation.setEmulatedMedia', { features: [] });
  } catch (err) {
    check('執行過程無例外', false, err.stack || String(err));
  }

  check('0 console 錯誤', errors.length === 0, errors.slice(0, 5).join(' | '));
  cdp.close();
  chrome.proc.kill();
  server.close();
  try { fs.rmSync(chrome.dir, { recursive: true, force: true }); } catch { /* 忽略 */ }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  process.exit(failed.length ? 1 : 0);
})();
