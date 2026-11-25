// 回歸測試：用 node 內建假 DOM 真的載入 js/engine.js + js/game.js，
// 自動點擊玩完一輪，確認遊戲能從頭玩到結局且不 throw。
// 執行：node --test tests/
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function parseDlgFull(html) {
  const m = html.match(/class="[^"]*dlg-text[^"]*"[^>]*data-full="([^"]*)"/);
  return m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&') : '';
}
function makeNode() {
  return {
    dataset: {}, style: {}, _html: '',
    classList: { add() {}, remove() {}, contains() { return false; } },
    set innerHTML(v) { this._html = String(v); }, get innerHTML() { return this._html; },
    set textContent(v) {}, get textContent() { return ''; },
    setAttribute() {}, removeAttribute() {}, appendChild() {}, remove() {},
    addEventListener() {}, focus() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
  };
}

// 載入 data.js → engine.js → focusnav.js → dungeon-draw.js → game.js（不載 pixelart.js，採集走快速採集），回傳一個可驅動的遊戲實例
function bootGame({ hash = '' } = {}) {
  const app = makeNode();
  let clickHandler = null;
  app.addEventListener = (type, fn) => { if (type === 'click') clickHandler = fn; };
  app.querySelector = (sel) => {
    if (sel === '.dlg-text') {
      const full = parseDlgFull(app._html);
      return { dataset: { full }, set innerHTML(v) {}, get innerHTML() { return ''; } };
    }
    return null;
  };
  app.querySelectorAll = () => [];

  const sandbox = {
    console,
    setTimeout: (fn) => { try { if (typeof fn === 'function') fn(); } catch (e) { /* 忽略 */ } return 0; },
    clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    performance: { now: () => Date.now() },
    Math, Date, JSON, Object, Array, String, Number, Boolean, Set, Map, RegExp, Promise, parseInt, parseFloat, isNaN,
    Image: class { set src(v) {} },
    localStorage: (() => { const s = new Map(); return { getItem: (k) => (s.has(k) ? s.get(k) : null), setItem: (k, v) => s.set(k, String(v)), removeItem: (k) => s.delete(k) }; })(),
    location: { hash, href: '' },
    navigator: {},
    addEventListener() {}, // window.addEventListener（#演出 測試入口註冊 hashchange）
    document: { getElementById: (id) => (id === 'app' ? app : null), createElement: () => makeNode(), body: makeNode(), addEventListener() {}, querySelector: () => null },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.GameAudio = { sfx() {}, playBgm() {}, toggleMute() {}, isMuted() { return false; }, unlock() {} };
  // 調合流程模組（js/craftflow.js）要真的 DOM，這裡換成替身：記下遊戲傳進去的選項，測試直接呼叫 cook／onStep
  sandbox.window.CraftFlow = { mount(el, o) { sandbox.__cf = o; return { destroy() { sandbox.__cfDestroyed = (sandbox.__cfDestroyed || 0) + 1; }, step: () => 1 }; } };

  const ctx = vm.createContext(sandbox);
  vm.runInContext(read('js/data.js'), ctx, { filename: 'data.js' });
  vm.runInContext(read('js/engine.js'), ctx, { filename: 'engine.js' });
  vm.runInContext(read('js/focusnav.js'), ctx, { filename: 'focusnav.js' });
  vm.runInContext(read('js/dungeon-draw.js'), ctx, { filename: 'dungeon-draw.js' });
  vm.runInContext(read('js/game.js'), ctx, { filename: 'game.js' });

  function parseButtons(html) {
    const btns = []; const re = /<[^>]*\bdata-a="([^"]*)"[^>]*>/g; let m;
    while ((m = re.exec(html))) {
      const tag = m[0];
      const v = (tag.match(/\bdata-v="([^"]*)"/) || [])[1];
      btns.push({ a: m[1], v, disabled: /\bdisabled\b/.test(tag) });
    }
    return btns;
  }
  function click(a, v) {
    clickHandler({ target: { closest: () => ({ dataset: { a, v }, disabled: false }) }, stopPropagation() {}, preventDefault() {} });
  }
  return { app, parseButtons, click, win: sandbox };
}

// 自動玩一輪，回傳 { endedScreen, clicks, screens }
function autoplay() {
  const g = bootGame();
  const visited = new Set();
  let clicks = 0;
  const screens = new Set();
  for (let i = 0; i < 800; i++) {
    const screen = g.app.dataset.screen; screens.add(screen);
    if (screen === 'ending') return { endedScreen: 'ending', clicks, screens };
    const btns = g.parseButtons(g.app._html).filter((b) => !b.disabled);
    const has = (a) => btns.find((b) => b.a === a);
    const dlgActive = /data-a="(skip|adv)"/.test(g.app._html);
    let pick = null;
    if (has('dlgchoice')) pick = btns.filter((b) => b.a === 'dlgchoice')[i % 2]; // 開場選項：教學／不用了輪著選
    else if (has('skip')) pick = has('skip');
    else if (has('adv')) pick = has('adv');
    else if (has('start') && !dlgActive && (screen === 'title' || screen === 'result')) pick = has('start');
    else if (has('sing')) pick = { a: 'sing', v: '0' };
    else if (has('next')) pick = has('next');
    else if (has('resultdone')) pick = has('resultdone');
    else if (has('sleepyes')) pick = has('sleepyes');
    else if (has('closemodal')) pick = has('closemodal');
    else {
      // 巡覽各畫面一次（渲染覆蓋），以睡覺保證日程推進到結局。
      // 註：更深的「真的採集/調合/交貨/加料被抓/演唱」行動覆蓋，待 story 1.2
      // 那些邏輯搬入引擎時，以可重現的 seeded 引擎層單元測試補上（見 deferred-work）。
      const tour = btns.find((b) => ['go', 'goto', 'craftfor', 'giftto'].includes(b.a) && b.v !== undefined && !visited.has(b.a + ':' + b.v));
      if (tour) { visited.add(tour.a + ':' + tour.v); pick = tour; }
      else if (has('sleep')) pick = has('sleep');
      else if (has('go')) pick = { a: 'go', v: 'home' };
      else pick = btns.find((b) => !['share', 'mute', 'bribe'].includes(b.a));
    }
    if (!pick) return { endedScreen: screen, clicks, screens, stuck: true };
    g.click(pick.a, pick.v); clicks++;
  }
  return { endedScreen: g.app.dataset.screen, clicks, screens, exhausted: true };
}

test('遊戲開機並自動玩完一輪到結局（20 局）', () => {
  for (let i = 0; i < 20; i++) {
    const r = autoplay();
    assert.strictEqual(r.endedScreen, 'ending', `第 ${i + 1} 局未到結局（stuck=${r.stuck}, exhausted=${r.exhausted}）`);
    assert.ok(r.clicks > 0 && r.clicks < 800, `第 ${i + 1} 局點擊數異常：${r.clicks}`);
  }
});

test('#結局 debug 路徑能算出並渲染結局（6 種隨機狀態）', () => {
  for (let i = 0; i < 6; i++) {
    const g = bootGame({ hash: '#結局' });
    assert.strictEqual(g.app.dataset.screen, 'ending', '未進入結局畫面');
    assert.ok(g.app._html.length > 500, '結局畫面內容過短');
  }
});

test('#演出 測試入口：各事件播對話＋結果頁，等級對應狠章／搖晃；沒加 hash 時不存在', async () => {
  // 事件 → [狠章?, 搖晃?]
  const cases = {
    cassava: [true, false], catnip: [true, false], musk_dose: [true, false], musk_miss: [true, false],
    musk_infertile: [true, true], safflower_infertile: [true, true], miscarry_musk: [true, true], miscarry_safflower: [true, true],
    musk_useless: [false, false], safflower_useless: [false, false], plain: [false, false], refused: [false, false], caught: [true, true],
  };
  for (const [ev, [fierce, shake]] of Object.entries(cases)) {
    const g = bootGame({ hash: `#演出=${ev}` });
    assert.ok(/data-a="skip"/.test(g.app._html), `${ev}：沒有直接播對話`);
    g.click('skip');
    assert.strictEqual(g.app.dataset.screen, 'result', `${ev}：對話後沒到結果頁`);
    assert.strictEqual(/class="stamp [^"]*fierce/.test(g.app._html), fierce, `${ev}：狠章不符`);
    assert.strictEqual(/fx-shake/.test(g.app._html), shake, `${ev}：搖晃不符`);
    assert.strictEqual(/class="fx-veil/.test(g.app._html), ev === 'caught', `${ev}：暗幕只屬被抓`);
    g.click('mute'); // 結果頁重繪不再晃
    assert.ok(!/fx-shake/.test(g.app._html), `${ev}：重繪後又晃`);
    if (ev === 'caught') assert.ok(/class="fx-veil settled"/.test(g.app._html), 'caught：重繪後暗幕應維持 0.62（settled）');
  }
  // 被抓對話的演出標記：溫太醫衝入（鎖句）、受害者抖、零溶後退、宣判句暗幕
  const g = bootGame({ hash: '#演出=caught' });
  const marks = [];
  for (let i = 0; i < 4 && /data-a="skip"/.test(g.app._html); i++) {
    marks.push((g.app._html.match(/ fx-(enter|tremble|shock|dim)\b/) || [])[1] + (/class="fx-veil"/.test(g.app._html) ? '+veil' : ''));
    if (i === 0) await new Promise((r) => setTimeout(r, 650)); // 「且慢！」那句鎖 0.6 秒（整句，無逐字）
    else g.click('adv'); // 先補完逐字
    g.click('adv');
  }
  assert.deepStrictEqual(marks, ['enter', 'tremble', 'shock', 'dim+veil'], `被抓對話標記不符：${marks}`);
  assert.strictEqual(bootGame({ hash: '#演出=不存在' }).app.dataset.screen, 'title', '未知事件應回標題頁');
  assert.strictEqual(bootGame({ hash: '#演出=constructor' }).app.dataset.screen, 'title', '原型鏈上的名字也算未知事件');
  assert.ok(/演出測試/.test(bootGame({ hash: '#演出' }).app._html), '#演出 應顯示事件選單');
  const plain = bootGame();
  assert.ok(!/演出測試|fx-/.test(plain.app._html), '沒加 hash 時不應有測試入口痕跡');
});

test('引擎雙匯出、原始碼不碰 DOM/localStorage，且 computeEnding 為確定性純函式', () => {
  const E = require('../js/engine.js');
  assert.ok(typeof E.newState === 'function' && typeof E.computeEnding === 'function' && E.TITLE_CHECK, '引擎未正確匯出');

  // 純度：引擎程式碼（去掉註解後）不得引用 DOM / localStorage / Math.random
  const src = read('js/engine.js')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  assert.ok(!/localStorage/.test(src), '引擎不應引用 localStorage');
  assert.ok(!/\bdocument\b/.test(src), '引擎不應引用 document');
  assert.ok(!/Math\.random/.test(src), '引擎不應直接呼叫 Math.random（隨機應走注入的 rand）');

  // computeEnding 確定性：同輸入同輸出
  const ctx = { window: {} };
  vm.runInNewContext(read('js/data.js'), ctx);
  const D = ctx.window.GAME_DATA;
  const S = E.newState(D);
  const r1 = E.computeEnding(D, S, []);
  const r2 = E.computeEnding(D, S, []);
  assert.deepStrictEqual(r1, r2, 'computeEnding 對同一輸入不穩定');
  assert.ok(r1.main && typeof r1.rank === 'number' && Array.isArray(r1.opening), '結局結構不完整');
});

test('調合：遊戲把素材、料的預測交給調合模組；cook 扣素材做成品；下鍋後鎖返回鍵；快速調合記在瀏覽器', () => {
  const g = bootGame({ hash: '#e2e' });
  g.click('start');
  for (let i = 0; i < 30 && /data-a="skip"/.test(g.app._html); i++) g.click('skip');
  const S = g.win.__e2e.state();
  const E = g.win.GameEngine;
  E.addUnit(S, 'lotus', { tian: 2 });
  const uid = S.lots[S.lots.length - 1].uid;
  const hand0 = S.hand.length;
  const lotus0 = S.inv.lotus;
  g.click('craftfor', '');
  const o = g.win.__cf;
  assert.ok(o && o.stock === S, '模組拿到遊戲的素材');
  assert.ok(o.spikes.some((x) => x.id === 'cassava'), '料的清單');
  assert.strictEqual(o.firstSpike, true, '第一次加料要播 G1–G3');
  assert.ok(/data-a="go" data-v="home"/.test(g.app._html), '還沒下鍋：有返回鍵');
  o.onStep(2);
  g.win.__e2e.render();
  assert.ok(!/data-a="go" data-v="home"/.test(g.app._html), '下鍋後沒有返回鍵');
  const res = o.cook({ mats: ['lotus', 'osmanthus'], lots: [uid, null], stirs: [{ t: 'tian', v: 1 }], spike: null, finish: 'up' });
  assert.strictEqual(res.product, 'cake');
  assert.strictEqual(JSON.stringify(res.traits), '{"tian":3}', '甜蜜 2 ＋泡泡 1 ＋起鍋升（封頂 3）');
  assert.strictEqual(S.hand.length, hand0 + 1);
  assert.strictEqual(S.inv.lotus, lotus0 - 1, '藕粉少一份');
  assert.ok(!S.lots.some((l) => l.uid === uid), '用掉的是指定的那份（帶特性）');
  o.onStep(5);
  const acts = o.actions(res);
  assert.ok(acts.every((x) => x.a === 'craftdone') && acts.some((x) => x.def), '結果按鈕交回遊戲');
  g.click('craftdone', 'home');
  assert.strictEqual(g.win.__e2e.screen(), 'home');
  assert.ok(g.win.__cfDestroyed >= 1, '離開調合就收掉模組');
  o.onSeen('spike');
  assert.strictEqual(S.seenSpike, true);
  g.click('craftfor', '');
  assert.strictEqual(g.win.__cf.firstSpike, false, '加過料就不再播 G1–G3');
  g.win.__cf.onQuick(true);
  assert.strictEqual(g.win.localStorage.getItem('lingrong-quickcraft'), '1', '快速調合記在瀏覽器');
  // 配錯：黑暗料理
  S.inv.pine = 2;
  const bad = g.win.__cf.cook({ mats: ['pine', 'pine'], lots: [null, null], stirs: [], spike: null, finish: null });
  assert.strictEqual(bad.product, 'junk');
});

test('開場：先播 A2–A6，最後一句有兩個選項；不用了 → A7–A8、第一天照常；好 → 教學局面', () => {
  const run = (v) => {
    const g = bootGame({ hash: '#e2e' });
    let t = 0;
    g.win.performance.now = () => (t += 1000); // 快轉時鐘：鎖句（防連按）不會擋住測試
    g.click('start');
    assert.ok(/好苦。我不是吃了苦杏仁嗎/.test(g.app._html), '第一句是 A2');
    for (let i = 0; i < 10 && !/data-a="dlgchoice"/.test(g.app._html); i++) g.click('adv');
    assert.ok(/好，妳說吧/.test(g.app._html) && /不用了/.test(g.app._html), '選項出現');
    g.click('skip');
    assert.ok(/data-a="dlgchoice"/.test(g.app._html), '略過不會跳過選項');
    g.click('dlgchoice', v);
    const texts = [];
    for (let i = 0; i < 60 && /data-a="(skip|adv)"/.test(g.app._html); i++) { const m = g.app._html.match(/data-full="([^"]*)"/); if (m) texts.push(m[1]); g.click('adv'); }
    return { g, S: g.win.__e2e.state(), texts };
  };
  const a = run('skip');
  assert.ok(a.texts.some((t) => t.includes('您的恩寵目前墊底')), 'A7');
  assert.ok(!a.S.tutorial, '不用了：沒有教學狀態');
  const b = run('tut');
  assert.ok(b.texts.some((t) => t.includes('後宮的恩寵榜')), 'A10');
  assert.ok(b.texts.some((t) => t.includes('奴婢是睡慾軒的吹緊吸')), 'A18');
  assert.ok(b.S.tutorial, '好：進教學');
  assert.strictEqual(b.S.inv.osmanthus, 0);
  assert.strictEqual(b.S.orders.length, 1);
  assert.strictEqual(b.S.orders[0].product, 'cake');
  assert.strictEqual(b.S.orders[0].who, 'zhenhuan');
});
