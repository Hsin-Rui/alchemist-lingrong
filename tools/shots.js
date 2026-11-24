// 情境截圖：用 headless Chrome 開遊戲（#e2e），照劇本擺好狀態，存成 PNG，給人眼檢查畫面。
// 用法：node tools/shots.js <輸出資料夾> [劇本名…]（不給劇本名＝全部）；SHOT_W=360 可改畫面寬度（模擬手機）
// 需要：Node ≥ 22（內建 WebSocket）、Google Chrome（或環境變數 CHROME 指定路徑）
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };

// 共用的開局擺設：給每種素材幾份，其中幾份帶特性
const SETUP = `
  const S = __e2e.state(), E = window.GameEngine, D = window.GAME_DATA;
  S.silver = 300;
  E.addUnit(S, 'lotus', { tian: 2, qing: 1 });
  E.addUnit(S, 'osmanthus', { xiang: 1 });
  E.addUnit(S, 'plum', { xiang: 3, hua: 1 });
  E.addUnit(S, 'pearl', { hua: 2 });
  S.inv.cassava = 1; S.inv.musk = 1;
`;
const click = (sel) => `document.querySelector(${JSON.stringify(sel)}).click();`;

// 劇本：[名稱, 依序執行的頁面內 JS（每段之間會等一下讓畫面重繪）]
const SCENES = {
  'craft-book': [SETUP + "__e2e.openCraft(null);"],
  'craft-lots': [SETUP + "__e2e.openCraft(null);", click('[data-v="recipe:cake"]')],
  'craft-free': [SETUP + "__e2e.openCraft(null);", click('[data-v=free]')],
  'craft-bubble': [SETUP + "__e2e.openCraft(null);", click('[data-v="recipe:cake"]'), click('[data-v="lot:0:0"]'), click('[data-v="lot:1:0"]'), click('[data-v=cook]'), 'WAIT2800'],
  'craft-spike': [SETUP + "__e2e.openCraft(null);", click('[data-v="recipe:cake"]'), click('[data-v="lot:0:0"]'), click('[data-v="lot:1:0"]'), click('[data-v=cook]'), 'WAIT10500', click('[data-v="spike:cassava"]'), 'WAIT1500'],
  'craft-result': [SETUP + "__e2e.openCraft(null);", click('[data-v=quick]'), click('[data-v="recipe:cake"]'), click('[data-v="lot:0:0"]'), click('[data-v="lot:1:0"]'), click('[data-v=cook]'), click('[data-v=go4]'), 'WAIT1500', "localStorage.setItem('lingrong-quickcraft', '0');"],
  shop: [SETUP + "__e2e.go('shop');", "document.querySelector('.scroll').scrollTop = 99999;"],
};

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

async function launchChrome() {
  const port = 9800 + Math.floor(Math.random() * 150);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lingrong-shots-'));
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--mute-audio', '--window-size=480,900', 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    try {
      const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
      if (page) return { proc, ws: page.webSocketDebuggerUrl };
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
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.reject(new Error(msg.error.message)); else p.resolve(msg.result); }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); });
  return new Promise((resolve, reject) => { ws.onopen = () => resolve({ send, close: () => ws.close() }); ws.onerror = reject; });
}

(async () => {
  const out = process.argv[2];
  if (!out) { console.error('用法：node tools/shots.js <輸出資料夾> [劇本名…]'); process.exit(1); }
  const want = process.argv.slice(3);
  const names = want.length ? want : Object.keys(SCENES);
  fs.mkdirSync(out, { recursive: true });
  const server = await startServer();
  const chrome = await launchChrome();
  const cdp = await connect(chrome.ws);
  await cdp.send('Page.enable');
  const W = Number(process.env.SHOT_W || 480);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: 800, deviceScaleFactor: 1, mobile: W < 480 });
  const ev = async (expr) => {
    const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`${expr}\n→ ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    return r.result.value;
  };
  try {
    for (const name of names) {
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/index.html?${Date.now()}#e2e` });
      await sleep(600);
      // 開新局、略過開場對話，回到主畫面
      await ev("document.querySelector('[data-a=start]').click()");
      for (let i = 0; i < 20 && await ev("!!document.querySelector('[data-a=skip]')"); i++) { await ev("document.querySelector('[data-a=skip]').click()"); await sleep(150); }
      await ev("window.__e2e.go('home')");
      for (const step of SCENES[name]) {
        if (step.startsWith('WAIT')) { await sleep(Number(step.slice(4))); continue; }
        await ev(`(() => { ${step} __e2e.render && 0; })()`);
        await sleep(250);
      }
      await sleep(400);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(data, 'base64'));
      console.log(`存好 ${name}.png`);
    }
  } finally {
    cdp.close();
    chrome.proc.kill();
    server.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
