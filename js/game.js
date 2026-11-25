(() => {
  const D = window.GAME_DATA;
  const A = window.GameAudio;
  const E = window.GameEngine;
  const R = D.RULES;
  const app = document.getElementById('app');
  const SLOT_NAMES = ['早', '午', '晚'];

  let S = null; // 遊戲狀態
  let screen = 'title';
  let dlg = null; // { lines, i, done, bg }；播放中另記 lockUntil（防連按）、veilLine／veilAt（暗幕從哪一句、何時開始）
  let modal = null; // { title, body }
  let busy = false; // 動畫進行中，暫停輸入
  // 調合（四階段，§13.3）：流程本體在 js/craftflow.js；這裡只記從哪張訂單進來、目前第幾階段（鎖返回鍵用）
  const newCraftSel = (forOrder = null, forWho = null) => ({ stage: 1, forOrder, forWho });
  let craftSel = newCraftSel();
  let craftFlow = null; // CraftFlow.mount 的回傳
  let craftHost = null; // 模組畫在這個 div 裡；每次 render() 換頁面時把它搬回 .cf-mount
  // 快速調合（§13.3）：跳過撈泡泡與起鍋。記在這台裝置的瀏覽器裡，跟靜音一樣
  let quickCraft = false;
  try { quickCraft = localStorage.getItem('lingrong-quickcraft') === '1'; } catch { /* 無痕模式等 */ }
  let craftResult = null;
  let gatherResult = null;
  let gatherScene = null; // 採集地下城的外殼狀態（進場時建立、離場時清空）
  let giftWho = null;
  let typer = null;
  let dlgSpeed = 'x2'; // 對話速度：'x2'（約每秒 70 字）或 'instant'；不記住，每次開遊戲回到 2×
  let cursor = { on: false, key: null, sig: null }; // 鍵盤游標：是否顯示、目前停在哪個動作（data-a|data-v#第幾個）、所在畫面

  // 對話與演出
  const TYPE_MS = 14; // 2×：每字 14ms ≈ 每秒 70 字
  const LOCK_MS = 600; // 防連按：高潮句整句顯示後這段時間內按鍵無效
  const VEIL_VERDICT = 0.45; // 被抓暗幕（DESIGN dim-veil）：宣判句起／結果頁一開始
  const VEIL_AFTER_STAMP = 0.62; // 被抓暗幕：結果頁章落下後

  // 採集地下城（繪圖在 js/dungeon-draw.js；格子大小與補間時間跟它共用）
  // dungeon-draw.js 沒載到（例如快取到舊的 index.html）時遊戲照常開機，只是採集退回快速採集
  const DV = window.DungeonDraw || null;
  const TILE = DV ? DV.TILE : 16;
  const STEP_MS = DV ? DV.STEP_MS : 120;
  const hasDungeon = (loc) => !!(D.GATHER[loc] && D.GATHER[loc].dungeon); // 資料裡有 dungeon 的地點就走地下城
  const MIN_VIEW = 9; // 短邊至少看得到 9 格（侍衛視野 4.5 格，看得到零溶的侍衛一定在畫面內）
  const MAX_VIEW_W = 17; // 超大螢幕也不顯示超過這麼多格
  const MAX_VIEW_H = 21;
  const SAY_MS = 2200; // 被抓時侍衛那句話停留多久（可按鍵跳過）
  const REPEAT_MS = 150; // 按住不放的連走間隔
  const HOLD_MS = 260; // 按住多久才開始連走（避免一按走兩步）
  const DG_KEYS = {
    w: 'n', arrowup: 'n', x: 's', arrowdown: 's', a: 'w', arrowleft: 'w', d: 'e', arrowright: 'e',
    q: 'nw', e: 'ne', z: 'sw', c: 'se',
  };

  // ───────── 小工具 ─────────
  const rand = Math.random;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const textHtml = (s) => esc(s).replace(/\n/g, '<br>'); // 對話文字：跳脫後保留換行
  const def = (id) => D.ITEMS[id] || D.PRODUCTS[id];
  const itemName = (id) => def(id).name;
  const charName = (id) => D.CHARS[id].name;
  const have = (id) => S.inv[id] || 0;
  const isTarget = (who) => D.TARGETS.includes(who);
  const grounded = () => S.day <= S.groundUntil;
  // 教學第一天走到哪一步：gather → craft → deliver → night → end（第二天早上結束）；不是教學局＝null
  const tutStep = () => {
    if (!S || !S.tutorial) return null;
    if (S.tutorial.step === 'gather' && (S.inv.osmanthus || 0) > 0) S.tutorial.step = 'craft'; // 桂花到手（採的或買的）就往下一步
    return S.tutorial.step;
  };
  const SPOT = (on) => (on ? ' tut-spot' : ''); // 教學的發光圈
  const pct = (x) => `${Math.round(x * 100)}%`;

  const rarity = (w) => (w >= 3 ? '常見' : w >= 1.5 ? '偶爾' : '稀有');

  function sourcesOf(id) {
    const out = [];
    const it = D.ITEMS[id];
    if (it && it.price && D.SHOP.includes(id)) out.push({ loc: 'shop', label: `小舖 ${it.price} 銀` });
    for (const [loc, g] of Object.entries(D.GATHER)) {
      const row = g.table.find(([x]) => x === id);
      if (row) out.push({ loc, label: `${g.name}（${rarity(row[1])}）` });
    }
    const recipe = Object.entries(D.PRODUCTS).find(([pid, p]) => pid === id && p.out === 'inv');
    if (recipe) out.push({ loc: 'craft', label: `煉金：${recipe[1].recipe.map(itemName).join(' + ')}` });
    return out;
  }
  const locName = (loc) => ({ shop: '小舖', craft: '調合', garden: '御花園', taiyi: '太醫院' }[loc]);

  // 台詞代換：{who} 說話者、{n} 名字、{palace}、{dose}、{spike}、{days}
  function fmt(lines, ctx) {
    return lines.map(([who, expr, text]) => {
      const sp = who === '{who}' ? ctx.who : who;
      const t = text
        .replace(/\{n\}/g, ctx.who ? charName(ctx.who) : '')
        .replace(/\{palace\}/g, ctx.who && D.CHARS[ctx.who].palace ? D.CHARS[ctx.who].palace : '')
        .replace(/\{dose\}/g, ctx.dose ?? '')
        .replace(/\{spike\}/g, ctx.spike ? itemName(ctx.spike) : '')
        .replace(/\{days\}/g, ctx.days ?? '');
      return [sp, expr, t];
    });
  }

  // ───────── 圖示 ─────────
  // 預設不顯示文字圓章／色塊，只有圖片真的讀不到時才退回去（避免每次換畫面都閃一下）
  const IMG_FAIL = "this.parentNode.classList.add('noimg');this.remove()";
  // 特性小標籤：香氣●●○。tr 空 → 空字串
  function trChips(tr, cls = '') {
    const e = Object.entries(tr || {});
    return e.length ? `<span class="trs ${cls}">${e.map(([t, lv], i) => `<span class="trc" style="--c:${D.TRAITS[t].color};--i:${i}">${D.TRAITS[t].name}<i>${'●'.repeat(lv)}${'○'.repeat(3 - lv)}</i></span>`).join('')}</span>` : '';
  }
  // 某素材有幾份帶特性
  const lotCount = (id) => S.lots.filter((l) => l.id === id).length;
  function tok(id, cls = '') {
    const it = def(id);
    const type = D.ITEMS[id] ? it.type : id === 'junk' ? 'junk' : 'product';
    return `<span class="tok tok-${type} has-img ${cls}"><span class="tok-ch">${it.ch}</span><img src="assets/items/${id}.webp" alt="" onerror="${IMG_FAIL}"></span>`;
  }

  function portrait(who, expr, cls = '') {
    const c = D.CHARS[who];
    const file = c.imgs[expr] || c.imgs._ || Object.values(c.imgs)[0];
    return `<div class="portrait ${cls}" style="--c:${c.color}">
      <div class="ph"><span class="ph-face">${c.face}</span></div>
      <img src="assets/characters/${file}.webp" alt="${c.name}" onerror="${IMG_FAIL}">
    </div>`;
  }

  // 銀兩：小元寶圖示＋數字（圖沒載入時 alt 會顯示「銀」）
  const coin = (n) => `<span class="coin"><img src="assets/items/silver.webp" alt="銀">${n}</span>`;

  const avatar = (who, cls = '') => `<span class="avatar ${cls}" style="--c:${D.CHARS[who].color}">${D.CHARS[who].face}</span>`;

  // ───────── 規則 ─────────
  // findRecipe／acceptChance／catchChance／riskLevel／pillowChance／flipWeights／flipOdds／
  // predict／applySpike／settleNight／流程與各行動 已搬入 js/engine.js
  //（純函式、隨機走注入的 rand）。外殼一律呼叫 E.*，並把 rand 傳入。

  // 防連按：在 lines 的第 idx 句加上 { lock: true }（複製，不改動資料表）
  const lockLine = (lines, idx) => lines.map((l, i) => (i === idx ? [l[0], l[1], l[2], { lock: true }] : l));
  // 演出等級：加料得手的事件分輕／中／重（對話與結果頁共用）；被抓也是「重」（另加暗幕）。收下、拒收、無效不在表內＝一般演出
  const FX_TIER = {
    debuff: 'light',
    musk_dose: 'medium', musk_miss: 'medium',
    musk_infertile: 'heavy', safflower_infertile: 'heavy', miscarry_musk: 'heavy', miscarry_safflower: 'heavy',
  };
  const FX_STOP = { light: 70, medium: 120, heavy: 190 }; // 結果頁狠章落到 0.9 倍時的停格（ms）
  const fxTier = (r) => (r && !r.refused && (r.caught ? 'heavy' : !r.useless && FX_TIER[r.outcome])) || null;
  // 對話演出標記（第 4 元素的 fx）：victim 受害者跳起來抖、tremble 受害者抖、evil 零溶奸笑特寫、slam 旁白框「砰」；
  // 被抓（tier = 'caught'）：enter 溫太醫從右側衝入、tremble 受害者抖、shock 零溶嚇得往後退、dim 宣判句起畫面變暗（暗幕）
  const CAUGHT_FX = { doctor: 'enter', lingrong: 'shock', narr: 'dim' };
  function markFx(lines, who, tier) {
    const fx = lines.map(() => null);
    if (tier === 'caught') lines.forEach((l, i) => { fx[i] = l[0] === who ? 'tremble' : CAUGHT_FX[l[0]] || null; });
    else {
      const vi = lines.findIndex((l) => l[0] === who);
      if (vi >= 0 && tier !== 'medium') fx[vi] = tier === 'light' ? 'victim' : 'tremble';
      let li = -1;
      lines.forEach((l, i) => { if (l[0] === 'lingrong' && (l[1] === 'evil' || li < 0 || lines[li][1] !== 'evil')) li = i; });
      if (li >= 0) fx[li] = 'evil';
      if (tier === 'heavy') { const ni = lines.findIndex((l) => l[0] === 'narr'); if (ni >= 0) fx[ni] = 'slam'; }
    }
    return lines.map((l, i) => (fx[i] ? [l[0], l[1], l[2], { ...(l[3] || {}), fx: fx[i] }] : l));
  }
  // 加料得手的那一句：旁白重擊句或受害者出糗（oops）的第一句；都沒有就取零溶奸笑那句（再沒有就零溶的那句）
  function hitIndex(lines) {
    const i = lines.findIndex((l) => l[0] === 'narr' || l[1] === 'oops');
    if (i >= 0) return i;
    const j = lines.findIndex((l) => l[1] === 'evil');
    return j >= 0 ? j : Math.max(0, lines.findIndex((l) => l[0] === 'lingrong')); // 麝香落空：零溶那句
  }

  function outcomeLines(who, spike, res) {
    if (res.caught) return markFx(lockLine(fmt(D.CAUGHT, { who, spike, days: res.days }), 0), who, 'caught'); // 被抓那一句（且慢！）鎖 0.6 秒
    if (res.outcome === 'plain') return D.THANKS[who];
    if (res.outcome === 'debuff_useless') return [...D.DEBUFF_LINES[who][spike], D.DEBUFF_WASTED]; // 白天照樣發作，但今晚不是她侍寢
    const lines = res.outcome === 'debuff' ? D.DEBUFF_LINES[who][spike] : fmt(D.OUTCOME_LINES[res.outcome], { who, dose: res.dose });
    const tier = fxTier(res);
    return tier ? markFx(lockLine(lines, hitIndex(lines)), who, tier) : lines;
  }

  // 手上有好幾個同樣的成品時，用最新做好的那個
  const readyItem = (o) => E.readyItem(S, o);
  const recipeOk = (pid) => D.PRODUCTS[pid].recipe.every((id) => have(id) >= 1);
  const daysLeft = (o) => o.due - S.day + 1;

  // ───────── 對話（逐字顯示） ─────────
  // onChoice：最後一句帶選項（opt.choice）時，玩家選完呼叫 onChoice(值)
  function playDialog(lines, done, bg = 'yanxi', onChoice = null) {
    dlg = { lines, i: 0, done, bg, onChoice, pick: 0 };
    render();
  }
  const choiceAt = (d) => d.lines.findIndex((l) => l[3] && l[3].choice);
  function finishDialog() {
    // 略過整段時，有選項的那一句不能跳過：直接跳到那一句
    const ci = choiceAt(dlg);
    if (ci >= 0 && dlg.i < ci) { dlg.i = ci; stopTyper(); render(); return; }
    if (ci >= 0) return;
    const done = dlg.done;
    dlg = null;
    stopTyper();
    done ? done() : render();
  }
  function advanceDialog() {
    if (!dlg) return;
    if (dlg.lockUntil && performance.now() < dlg.lockUntil) return; // 防連按
    if (typer) { completeTyper(); return; }
    if (dlg.lines[dlg.i][3] && dlg.lines[dlg.i][3].choice) return; // 選項那一句要選了才走
    dlg.i++;
    if (dlg.i >= dlg.lines.length) finishDialog();
    else render();
  }
  function stopTyper() { if (typer) { clearInterval(typer.t); typer = null; } }
  function completeTyper() {
    if (!typer) return;
    typer.el.innerHTML = typer.full;
    stopTyper();
  }
  // 對話演出（Web Animations；不受全域 reduce-motion CSS 規則影響——規格：減少動態只關搖晃）。對話中一律不搖晃
  const LINE_FX = {
    victim: [[{ transform: 'none' }, { transform: 'translateY(-22px) rotate(-3deg)' }, { transform: 'translate(-6px,0) rotate(3deg)' }, { transform: 'translate(6px,0) rotate(-3deg)' }, { transform: 'translate(-4px,0) rotate(2deg)' }, { transform: 'none' }], { duration: 520, easing: 'ease-out' }],
    tremble: [[{ transform: 'none' }, { transform: 'translate(-5px,0) rotate(-2deg)' }, { transform: 'translate(5px,0) rotate(2deg)' }, { transform: 'translate(-4px,0) rotate(-1deg)' }, { transform: 'translate(3px,0)' }, { transform: 'none' }], { duration: 480, easing: 'ease-out' }],
    evil: [[{ transform: 'none' }, { transform: 'translateY(-10px) scale(1.16)' }], { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }],
    slam: [[{ transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 160, easing: 'ease-in' }],
    enter: [[{ transform: 'translateX(120%)' }, { transform: 'translateX(-14px)' }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.3,1.4,.5,1)' }],
    shock: [[{ transform: 'none' }, { transform: 'translate(-14px,6px) scale(.94) rotate(-4deg)' }, { transform: 'translate(8px,0) rotate(3deg)' }, { transform: 'translate(-4px,0)' }, { transform: 'none' }], { duration: 560, easing: 'ease-out' }],
    dim: [[{ opacity: 0 }, { opacity: VEIL_VERDICT }], { duration: 900, easing: 'ease-in', fill: 'forwards' }],
  };
  function playLineFx(fx) {
    const el = app.querySelector(fx === 'slam' ? '.dialog-box' : fx === 'dim' ? '.dialog-layer > .fx-veil' : '.dlg-portrait');
    if (!el || typeof el.animate !== 'function' || !LINE_FX[fx]) return; // 假 DOM 沒有 animate()
    const a = el.animate(...LINE_FX[fx]);
    if (fx === 'dim') {
      // 同一句重繪（例如按 M）時接著暗，不從頭再暗一次
      if (dlg.veilLine === dlg.i) a.currentTime = performance.now() - dlg.veilAt;
      else { dlg.veilLine = dlg.i; dlg.veilAt = performance.now(); }
    }
  }
  function startTyper() {
    stopTyper();
    const el = app.querySelector('.dlg-text');
    if (!el) return;
    const text = el.dataset.full;
    const opt = dlg.lines[dlg.i][3];
    if (opt && opt.fx) playLineFx(opt.fx);
    if (opt && opt.sfx) A.sfx(opt.sfx);
    if (opt && opt.lock) {
      // 高潮句：直接整句，LOCK_MS 內按鍵無效，▼ 之後才出現
      el.innerHTML = textHtml(text);
      const box = app.querySelector('.dialog-box');
      if (box) box.classList.add('locked');
      const at = dlg.i;
      const d = dlg;
      dlg.lockUntil = performance.now() + LOCK_MS;
      setTimeout(() => { if (dlg === d && dlg.i === at && box) box.classList.remove('locked'); }, LOCK_MS);
      return;
    }
    if (dlgSpeed === 'instant') { el.innerHTML = textHtml(text); return; }
    let n = 0;
    typer = {
      el,
      full: textHtml(text),
      t: setInterval(() => {
        n += 1;
        el.innerHTML = textHtml(text.slice(0, n));
        if (n >= text.length) stopTyper();
      }, TYPE_MS),
    };
  }

  // ───────── 流程 ─────────
  function startGame() {
    A.unlock();
    A.playBgm('title', 'main'); // 開場對話繼續播標題曲，第一天開始才換主題曲
    S = E.newState(D);
    screen = 'title'; // 再玩一次時，開場對話要疊在標題頁上（結局頁需要上一局的結果）
    // §15.1：開場 → 問要不要教學
    playDialog(D.OPENING, null, 'yanxi', (v) => {
      if (v === 'tut') playDialog(D.TUT_INTRO, () => startDay(true));
      else playDialog(D.NO_TUTORIAL, () => startDay());
    });
    if (dlg) dlg.fadeIn = true; // A1（淡入，炎洗宮）
  }

  // tut：教學模式的第一天——擺成教學局面，早上的新訂單換成吹緊吸那段（A18–A21）
  function startDay(tut = false) {
    A.playBgm('main');
    A.sfx('gong');
    const report = E.startDay(D, S, rand);
    if (tut) { E.setupTutorial(D, S); report.newOrders = []; report.noOrders = false; }
    const lines = [...renderStartLines(report), ...(tut ? D.TUT_ORDER : [])];
    if (!tut && S.tutorial) { // 教學第二天早上：結束教學（A30）
      if (tutStep() === 'end') lines.push(D.TUT_END);
      S.tutorial = null;
    }
    playDialog(lines, () => go('home'));
  }
  function pickChoice(v) {
    if (!dlg || !dlg.onChoice) return;
    const cb = dlg.onChoice;
    dlg = null;
    stopTyper();
    A.sfx('click');
    cb(v);
  }

  // 依引擎回傳的開日報告組對話 lines（引擎變更狀態、不碰對話；比照 renderNightLines）
  function renderStartLines(report) {
    const lines = [['narr', '', `—— 第 ${S.day} 天・早 ——`]];
    if (report.tired) lines.push(['baojuan', '_', '小主昨晚唱了一整夜金縷衣，嗓子都啞了，睡到中午才起來……（早上的時辰休息掉了）']);
    report.lapsed.forEach((l) => lines.push(['baojuan', '_', `小主，${charName(l.who)}的「${itemName(l.product)}」過期沒送去，娘娘不太高興。（友好 ${R.lateFriend}）`]));
    if (report.grounded) lines.push(['baojuan', '_', `小主還在禁足中（到第 ${S.groundUntil} 天）……今天只能待在炎洗宮了。`]);
    if (report.boosted) lines.push(...D.EMPRESS);
    if (report.flip === 'lingrong') {
      lines.push(['baojuan', '_', '小主！小主！敬事房傳話——今晚黃上翻的是您的牌子！', { lock: true }], ['lingrong', 'evil', '終於……輪到我了。']);
      // 第一次被翻（沒禁足）：包捐說明金縷衣（G4–G5，不分模式、只有一次）
      if (!report.grounded && !S.seenFlip) { S.seenFlip = true; lines.push(...D.FIRST_FLIP); }
    } else if (report.flip) {
      lines.push(['baojuan', '_', `小主，敬事房傳話，今晚黃上翻了${charName(report.flip)}的牌子。`]);
      lines.push(report.flipFriend >= 50
        ? ['lingrong', 'smile', `${charName(report.flip)}姐姐跟我交情好，說不定會替我美言幾句。`]
        : ['lingrong', 'evil', `${charName(report.flip)}啊……要不要送點「心意」過去呢？`]);
    } else {
      lines.push(['baojuan', '_', '今晚黃上誰的牌子都沒翻，說是要批奏摺。']);
    }
    report.newOrders.forEach((o) => lines.push(D.request(o.who, o.product)));
    if (report.noOrders) lines.push(['baojuan', '_', '今天各宮都沒有新訂單。']);
    return lines;
  }

  function go(s) {
    if (screen === 'sutra' && s !== 'sutra') { sutra = null; A.playBgm('main'); }
    screen = s;
    render();
  }

  // ───────── 禁足抄經（§15.5）─────────
  let sutra = null; // { line, tiles, used:Set, next, blots, shake }
  let shopTab = 'mat'; // 小舖分頁：mat／spike／sell
  function openSutra() {
    if (!grounded() || S.slot >= R.slotsPerDay) return;
    const line = D.SUTRA_LINES[Math.floor(rand() * D.SUTRA_LINES.length)];
    sutra = { line, tiles: E.sutraTiles(line, rand), used: new Set(), next: 0, blots: 0, shake: -1 };
    A.playBgm('sutra');
    go('sutra');
  }
  function pickTile(k) {
    if (!sutra || sutra.used.has(k)) return;
    const t = sutra.tiles[k];
    // 同一個字出現兩次（例如「個個」）時，點哪一塊都算對：比的是字，不是字塊的編號
    const want = sutra.tiles.find((x) => x.i === sutra.next).ch;
    if (t.ch !== want) {
      // 點錯：字塊抖一下、經書多一滴墨（不卡關）
      sutra.blots++;
      sutra.shake = k;
      A.sfx('fail');
      render();
      return;
    }
    sutra.used.add(k);
    sutra.next++;
    sutra.shake = -1;
    A.sfx('pop');
    if (sutra.next < sutra.tiles.length) { render(); return; }
    E.copySutra(D, S);
    A.sfx('ding');
    render();
    busy = true;
    setTimeout(() => { busy = false; playDialog(D.SUTRA_DONE, () => finishAction(() => go('home')), 'study'); }, 700);
  }

  function finishAction(next) {
    if (S.slot >= R.slotsPerDay) endDay();
    else next();
  }

  // 夜晚結算（零溶侍寢時先問要不要唱金縷衣）
  function endDay() {
    if (S.flip === 'lingrong' && !grounded()) {
      screen = 'home';
      modal = {
        lock: true,
        title: '今晚侍寢，要演唱「金縷衣」嗎？',
        body: `<p>唱的話，恩寵額外 +${R.singExtraFavor}（共 +${R.serveFavor + R.singExtraFavor}）。但會累到明天早上起不來，<b>少一個時辰</b>。</p>
          <div class="row-btns"><button class="btn ghost" data-a="sing" data-v="0">正常侍寢（+${R.serveFavor}）</button><button class="btn primary" data-a="sing" data-v="1" data-def>開唱！</button></div>`,
      };
      render();
      return;
    }
    settleNight(false);
  }

  function settleNight(sing) {
    const report = E.settleNight(D, S, { sing, rand });
    playDialog(renderNightLines(report), () => go('night'), 'night');
  }

  // 依引擎回傳的結算報告組對話 lines（引擎不碰對話；數值一律讀報告）
  function renderNightLines(report) {
    const lines = [['narr', '', `—— 第 ${S.day} 天・夜 ——`]];
    const who = report.who;
    if (!who) {
      lines.push(['narr', '', '黃上今晚獨自批奏摺，後宮一片寂靜。']);
    } else if (who === 'lingrong') {
      if (report.serve.kind === 'grounded') {
        lines.push(['narr', '', '零溶被禁足，今晚的侍寢取消了。黃上嘆了口氣，改去批奏摺。']);
      } else {
        const d = report.serve.favDelta;
        if (report.sing) lines.push(...D.SING);
        else lines.push(['lingrong', 'smile', '黃上，臣妾給您捏捏肩吧。']);
        lines.push(['narr', '', `零溶侍寢${report.sing ? '（演唱金縷衣）' : ''}，恩寵 +${d}`]);
      }
    } else {
      const name = charName(who);
      if (report.serve.kind === 'debuff') {
        const d = report.serve.favDelta;
        const debuff = report.serve.debuff;
        if (debuff === 'catnip') lines.push(D.CATS_LINE); // 貓咪鬧場：先聽到貓叫
        lines.push(['huangshang', '_', D.SERVE_FAIL_HS[debuff]], ['narr', '', D.SERVE_FAIL[debuff].replace('{n}', name)], ['narr', '', `侍寢出包！${name}恩寵 ${d}`], ['lingrong', 'evil', '（計畫通。）']);
      } else {
        const d = report.serve.favDelta;
        lines.push(['narr', '', `${name}今晚侍寢，恩寵 +${d}`]);
        if (report.pillow) {
          lines.push([who, 'happy', '皇上，安妹妹做的東西可好了，您也去看看她吧。'], ['narr', '', `枕邊風！零溶恩寵 +${report.pillow.favDelta}`]);
        }
        if (report.conceived) {
          lines.push(['narr', '', `隔天一早，太醫診出${name}有喜了！`], ['lingrong', 'evil', '（……有喜了啊。）']);
        }
      }
    }
    report.births.forEach((b) => {
      lines.push(['narr', '', `${charName(b.who)}平安誕下皇嗣！黃上龍心大悅，恩寵 +${b.favDelta}`], ['lingrong', 'shock', '（讓她生下來了……）']);
    });
    if (tutStep() === 'night') { lines.push(D.TUT_NIGHT); S.tutorial.step = 'end'; } // A29
    return lines;
  }

  function nextDay() {
    if (S.day >= R.days) {
      S.result = computeEnding();
      A.playBgm('ending');
      go('ending');
      return;
    }
    E.advanceDay(D, S);
    startDay();
  }

  // ───────── 行動 ─────────
  function needOut() {
    if (!grounded()) return false;
    A.sfx('fail');
    toast('禁足中，不能出門！');
    return true;
  }

  function buy(id) {
    if (!E.buy(D, S, id).ok) { A.sfx('fail'); toast('銀兩不夠啦！'); return; }
    A.sfx('coin');
    toast(`買了 ${itemName(id)}`);
    render();
  }

  // v：'id' 賣一般份；'id:uid' 賣指定那份
  function sell(v) {
    const [id, uid] = String(v).split(':');
    const r = E.sell(D, S, id, uid ? Number(uid) : null);
    if (!r.ok) { A.sfx('fail'); return; }
    A.sfx('coin');
    toast(`賣了 ${itemName(id)}，+${r.price} 兩`);
    render();
  }

  function bribe() {
    const r = E.bribe(D, S);
    if (!r.ok) {
      if (r.reason === 'done') toast('今天已經打點過了');
      else { A.sfx('fail'); toast('銀兩不夠啦！'); }
      return;
    }
    A.sfx('coin');
    toast('敬事房公公收下大紅包：「明天的牌子……奴才懂的。」');
    render();
  }

  function rejectOrder(id) {
    const r = E.rejectOrder(D, S, id);
    if (!r) return;
    toast(`婉拒了${charName(r.who)}的訂單（友好 ${R.rejectFriend}）`);
    render();
  }

  function gather(loc) {
    if (needOut()) return;
    gatherResult = E.gather(D, S, loc, rand);
    const { got } = gatherResult;
    A.sfx('gather');
    if (got.musk || got.petal) setTimeout(() => A.sfx('evil'), 500);
    render();
  }

  // ───────── 採集地下城（外殼）─────────
  // 規則全在引擎（E.buildGatherDungeon／E.gatherStep／E.gatherFov），canvas 繪圖在 js/dungeon-draw.js（DV.drawDungeon）；
  // 這裡只負責場景狀態、補間排程、輸入、HUD、轉場、音效。
  // 監聽與 rAF 只在進場時註冊、離場時移除（headless 回歸網不會進場）。
  function enterGather(loc) {
    if (needOut()) return;
    if (tutStep() === 'gather' && !S.tutorial.seenDungeon) { S.tutorial.seenDungeon = true; playDialog(D.TUT_GATHER, () => enterGather(loc)); return; } // A22–A23
    if (!window.PIXEL_ART || !DV) { gather(loc); return; } // 像素資料或繪圖模組沒載到就退回快速採集
    gatherResult = null;
    gatherScene = {
      loc, run: E.buildGatherDungeon(D, S, loc, rand),
      phase: 'intro', t0: 0, anim: null, steps: 0, buffer: null, held: null, heldKey: null, nextAt: 0,
      bubbles: {}, fx: [], flashUntil: 0, hopFrom: 0, caughtBy: -1, sayFrom: 0, endAt: 0, mosaic: 8, fade: 0,
      vis: new Set(), sight: [], confirm: false,
      view: { tileset: D.GATHER[loc].tileset, guardSprite: (gi) => guardOf(loc, gi).sprite }, // 給 DV.drawDungeon
    };
    screen = 'gather';
    refreshSight(gatherScene);
    render();
    bindGatherRuntime();
  }

  // 每回合算一次：玩家現在看得到哪些格子、看得到的侍衛各自盯著哪些格子
  function refreshSight(gs) {
    const { run } = gs;
    gs.vis = new Set(E.gatherFov(run, run.player.x, run.player.y, run.cfg.playerSight));
    gs.sight = run.guards.map((gd) => {
      if (!gs.vis.has(gd.y * run.w + gd.x)) return null;
      const cells = E.gatherFov(run, gd.x, gd.y, run.cfg.guardSight)
        .filter((k) => gs.vis.has(k) && run.tiles[Math.floor(k / run.w)][k % run.w] !== '#');
      return { cells, alert: gd.state === 'chase' };
    });
  }

  function grabDungeonEls(gs) {
    const q = (sel) => app.querySelector(sel);
    gs.el = { root: q('.dg'), stage: q('.dg-stage'), canvas: q('.dg-canvas'), steps: q('.dg-steps b'), sun: q('.dg-sun'), got: q('.dg-got'), confirm: q('.dg-confirm'), note: q('.dg-note'), say: q('.dg-say') };
    gs.ctx = gs.el.canvas.getContext('2d');
    fitDungeon(gs);
    updateDungeonHud(gs);
  }

  // 畫面填滿整個舞台。一律整數倍放大（最小 2 倍），倍率取「短邊還看得到 MIN_VIEW 格」的最大值；
  // 緩衝大小＝舞台大小 ÷ 倍率，不必是整格（鏡頭以像素為單位置中，邊緣露出半格沒關係）。
  function fitDungeon(gs) {
    const { stage, canvas } = gs.el;
    const sw = stage.clientWidth - 6; // 留白給畫框
    const sh = stage.clientHeight - 6;
    const scale = Math.max(2, Math.floor(Math.min(sw, sh) / (MIN_VIEW * TILE)));
    const w = Math.max(5 * TILE, Math.min(MAX_VIEW_W * TILE, Math.floor(sw / scale)));
    const h = Math.max(5 * TILE, Math.min(MAX_VIEW_H * TILE, Math.floor(sh / scale)));
    // 離屏緩衝和畫面上的 canvas 一定要同尺寸：鏡頭是用緩衝的寬高算的，兩者不一致時零溶會被算到畫面外
    for (const cv of [canvas, gs.buf]) {
      if (cv.width !== w) cv.width = w;
      if (cv.height !== h) cv.height = h;
    }
    canvas.style.width = `${w * scale}px`;
    canvas.style.height = `${h * scale}px`;
  }

  function updateDungeonHud(gs) {
    const { run } = gs;
    gs.el.steps.textContent = Math.max(0, run.stepsLeft);
    gs.el.steps.classList.toggle('low', run.stepsLeft <= 10);
    gs.el.sun.style.opacity = String(0.35 + 0.65 * (run.stepsLeft / run.maxSteps));
    const got = Object.entries(run.got);
    gs.el.got.innerHTML = got.length
      ? got.map(([id, n]) => `<span class="dg-item${id === run.rare ? ' rare' : ''}"><img src="${DV.spriteURL(DV.itemSprite(id))}" alt="${esc(itemName(id))}">×${n}</span>`).join('')
      : '<span class="dg-empty">還沒撿到東西</span>';
  }

  function bindGatherRuntime() {
    const gs = gatherScene;
    if (!gs) return;
    DV.buildAtlas();
    gs.buf = document.createElement('canvas');
    gs.bctx = gs.buf.getContext('2d');
    grabDungeonEls(gs);

    const press = (action, key) => {
      gs.held = action;
      gs.heldKey = key;
      gs.nextAt = performance.now() + HOLD_MS;
      // 收尾那句話（被抓／走累了）：看過一下之後，按任何方向就跳過
      if (gs.phase === 'ending' && gs.sayFrom && performance.now() >= gs.sayFrom + 500) { gs.endAt = 0; return; }
      dungeonAct(action);
    };
    gs.onKeyDown = (e) => {
      const key = (e.key || '').toLowerCase();
      if (key === 'escape') { e.preventDefault(); toggleDungeonConfirm(); return; }
      if (gs.confirm) { if (key === 'enter') { e.preventDefault(); endGather('quit'); } return; }
      const action = DG_KEYS[key];
      if (!action || e.ctrlKey || e.metaKey || e.altKey) return; // 不攔瀏覽器快速鍵
      e.preventDefault();
      if (!e.repeat) press(action, key);
    };
    gs.onKeyUp = (e) => { if ((e.key || '').toLowerCase() === gs.heldKey) gs.held = null; };
    gs.onPadDown = (e) => {
      const btn = e.target.closest && e.target.closest('[data-d]');
      if (!btn) return;
      e.preventDefault();
      press(btn.dataset.d, 'pad');
    };
    gs.onPadUp = () => { if (gs.heldKey === 'pad') gs.held = null; };
    gs.onBlur = () => { gs.held = null; gs.buffer = null; };
    gs.onResize = () => { if (gs.el.canvas.isConnected) fitDungeon(gs); };
    document.addEventListener('keydown', gs.onKeyDown);
    document.addEventListener('keyup', gs.onKeyUp);
    app.addEventListener('pointerdown', gs.onPadDown);
    document.addEventListener('pointerup', gs.onPadUp);
    document.addEventListener('pointercancel', gs.onPadUp);
    window.addEventListener('blur', gs.onBlur);
    window.addEventListener('resize', gs.onResize);
    gs.raf = requestAnimationFrame(dungeonLoop);
  }

  function stopGatherRuntime(gs) {
    if (!gs) return;
    if (gs.raf) cancelAnimationFrame(gs.raf);
    clearTimeout(gs.noteTimer);
    document.removeEventListener('keydown', gs.onKeyDown);
    document.removeEventListener('keyup', gs.onKeyUp);
    app.removeEventListener('pointerdown', gs.onPadDown);
    document.removeEventListener('pointerup', gs.onPadUp);
    document.removeEventListener('pointercancel', gs.onPadUp);
    window.removeEventListener('blur', gs.onBlur);
    window.removeEventListener('resize', gs.onResize);
  }

  // 第 gi 名巡邏者的資料（稱呼、sprite、提示、台詞）
  const guardOf = (loc, gi) => { const list = D.GATHER[loc].guards; return list[Math.max(0, Math.min(gi, list.length - 1))]; };

  // 畫面上方的短提示（侍衛登場等）
  // kind：'warn'（被盯上，紅框）／'bump'（撞到東西，短一點）／不給＝一般
  function dungeonNote(text, kind, ms) {
    const gs = gatherScene;
    const el = gs && gs.el.note;
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    el.className = `dg-note snes${kind ? ` ${kind}` : ''}`;
    clearTimeout(gs.noteTimer);
    gs.noteTimer = setTimeout(() => { el.hidden = true; }, ms || (kind === 'bump' ? 900 : 1800));
  }

  // 撞到什麼：看零溶往哪個方向走、前面那格是什麼；斜走被牆角卡住也說清楚
  function bumpText(gs, action) {
    const { run } = gs;
    const names = D.GATHER[gs.loc].tileset.names;
    const nameOf = (c) => names[c === 'p' ? 'P' : c]; // 荷花池其餘格（p）跟左上格（P）同名
    const d = E.GATHER_DIRS[action];
    if (!d) return '過不去';
    const at = (x, y) => (run.tiles[y] && run.tiles[y][x]) || '#';
    const { x, y } = run.player;
    const name = nameOf(at(x + d[0], y + d[1]));
    if (name) return `被${name}擋住了`;
    // 目標格能走，那就是斜切牆角
    const side = [at(x + d[0], y), at(x, y + d[1])].find(nameOf);
    return `斜角被${nameOf(side) || names['#']}卡住了`;
  }

  function toggleDungeonConfirm(show) {
    const gs = gatherScene;
    if (!gs || gs.phase !== 'play') return;
    gs.confirm = show === undefined ? !gs.confirm : show;
    gs.held = null;
    gs.buffer = null;
    gs.el.confirm.hidden = !gs.confirm;
  }

  // 玩家這回合做什麼 → 交給引擎 → 依事件播動畫與音效
  function dungeonAct(action) {
    const gs = gatherScene;
    if (!gs || gs.phase !== 'play' || gs.confirm) return;
    if (gs.anim) { gs.buffer = action; return; }
    const events = E.gatherStep(gs.run, action, rand);
    if (!events.length) return;
    const now = performance.now();
    if (events[0].t === 'bump') {
      A.sfx('bump'); gs.held = null;
      gs.bumpAt = now;
      dungeonNote(bumpText(gs, action), 'bump');
      return;
    }
    const anim = { start: now, p: null, g: {} };
    for (const ev of events) {
      switch (ev.t) {
        case 'move': anim.p = ev.from; A.sfx('step'); break;
        case 'pick': gs.fx.push({ x: ev.x, y: ev.y, t0: now + STEP_MS * 0.6 }); A.sfx(ev.rare ? 'pickRare' : 'pick'); break;
        case 'gmove': anim.g[ev.g] = ev.from; break;
        case 'spawn': dungeonNote(guardOf(gs.loc, ev.g).note); A.sfx('guardIn'); break;
        case 'alert': gs.bubbles[ev.g] = { id: 'bubble_alert', until: now + 600 }; A.sfx('alert'); dungeonNote(`被${guardOf(gs.loc, ev.g).name}盯上了！快躲！`, 'warn'); break;
        case 'lost': gs.bubbles[ev.g] = { id: 'bubble_lost', until: now + 1400 }; A.sfx('lost'); dungeonNote(`${guardOf(gs.loc, ev.g).name}跟丟了`); break;
        case 'caught': {
          const guard = guardOf(gs.loc, ev.g);
          gs.phase = 'ending'; gs.caughtBy = ev.g; gs.held = null; gs.buffer = null;
          gs.flashUntil = now + STEP_MS + 160; gs.hopFrom = now + STEP_MS;
          gs.sayFrom = now + STEP_MS + 160; gs.endAt = gs.sayFrom + SAY_MS;
          gs.bubbles[ev.g] = { id: 'bubble_alert', until: gs.sayFrom };
          gs.el.say.innerHTML = `<b>${esc(guard.name)}</b><span>${esc(guard.line)}</span>`;
          A.sfx('caught');
          break;
        }
        case 'timeout':
          // 步數走完：零溶乏了，對話框講完（或玩家按鍵）才轉場
          gs.phase = 'ending'; gs.held = null; gs.buffer = null;
          gs.sayFrom = now + STEP_MS + 200; gs.endAt = gs.sayFrom + SAY_MS;
          gs.el.say.innerHTML = `<span>${esc(D.GATHER[gs.loc].tired)}</span>`;
          A.sfx('timeout');
          break;
        default: break;
      }
    }
    gs.anim = anim;
    gs.steps++;
    refreshSight(gs);
    updateDungeonHud(gs);
  }

  function dungeonLoop(now) {
    const gs = gatherScene;
    if (!gs) return;
    if (!gs.el.canvas.isConnected) grabDungeonEls(gs); // 中途被重繪過就重新抓元素
    if (!gs.t0) gs.t0 = now;
    const t = now - gs.t0;
    if (gs.anim && now - gs.anim.start >= STEP_MS) gs.anim = null;
    if (gs.phase === 'intro') {
      // 百葉收黑（CSS 動畫），收完才亮出像素畫面
      if (t >= 320) {
        gs.phase = 'reveal'; gs.t0 = now;
        gs.el.root.classList.add('on');
        fitDungeon(gs);
        A.sfx('enterDungeon');
        if (A.dungeonBgm) A.dungeonBgm(true, D.GATHER[gs.loc].bgm);
      }
    } else if (gs.phase === 'reveal') {
      gs.mosaic = 8 - 7 * Math.min(1, t / 400);
      if (t >= 400) { gs.mosaic = 1; gs.phase = 'play'; dungeonNote(D.GATHER[gs.loc].intro, null, 2800); }
    } else if (gs.phase === 'play') {
      if (!gs.anim) {
        if (gs.buffer) { const a = gs.buffer; gs.buffer = null; dungeonAct(a); }
        else if (gs.held && now >= gs.nextAt) { gs.nextAt = now + REPEAT_MS; dungeonAct(gs.held); }
      }
    } else if (gs.phase === 'ending') {
      // 被抓：閃白之後侍衛開口；走累了：零溶收工。話說完（或玩家按鍵）才轉場
      if (gs.sayFrom && gs.el.say.hidden && now >= gs.sayFrom) gs.el.say.hidden = false;
      if (now >= gs.endAt) { gs.phase = 'out'; gs.t0 = now; gs.el.say.hidden = true; A.sfx('exitDungeon'); }
    } else if (gs.phase === 'out') {
      gs.mosaic = 1 + 7 * Math.min(1, t / 300);
      gs.fade = Math.max(0, Math.min(1, (t - 150) / 150));
      if (t >= 320) { finishGather(); return; }
    }
    if (gs.phase !== 'intro') DV.drawDungeon(gs, now, gs.view);
    gs.raf = requestAnimationFrame(dungeonLoop);
  }

  // 結束這趟：收工由玩家觸發；被抓／步數用完由引擎事件觸發（那時 run.over 已經是 true）
  function endGather(how) {
    const gs = gatherScene;
    if (!gs || gs.phase !== 'play') return;
    if (how === 'quit') E.gatherStep(gs.run, 'quit', rand);
    gs.confirm = false;
    gs.el.confirm.hidden = true;
    gs.phase = 'out';
    gs.t0 = 0;
    A.sfx('exitDungeon');
  }

  // 轉場播完：拆掉即時層、把收穫交回引擎套用一次，再走既有的結果 sheet
  function finishGather() {
    const gs = gatherScene;
    if (!gs) return;
    stopGatherRuntime(gs);
    const haul = E.applyGatherHaul(D, S, gs.loc, gs.run.got, gs.run.haul);
    gatherResult = { ...haul, ended: gs.run.endReason, by: gs.run.caughtBy };
    gatherScene = null;
    if (A.dungeonBgm) A.dungeonBgm(false);
    render();
    const blinds = document.createElement('div');
    blinds.className = 'dg-blinds open';
    blinds.innerHTML = '<i></i>'.repeat(8);
    app.appendChild(blinds);
    setTimeout(() => blinds.remove(), 380);
    A.sfx(haul.got[gs.run.rare] ? 'evil' : 'gather');
  }

  function closeCraft() {
    if (!craftFlow) return;
    craftFlow.destroy();
    craftFlow = null;
    craftHost = null;
    A.playBgm('main');
  }

  function openCraft(orderId) {
    closeCraft();
    const o = S.orders.find((x) => x.id === orderId);
    const who = o ? o.who : isTarget(S.flip) ? S.flip : null;
    craftSel = newCraftSel(o ? o.id : null, who);
    craftResult = null;
    craftHost = document.createElement('div');
    craftHost.className = 'cf-host';
    craftFlow = window.CraftFlow.mount(craftHost, {
      D, E, stock: S, rand,
      spikes: Object.keys(D.ITEMS).filter((id) => D.ITEMS[id].type === 'spike').map((id) => {
        const n = have(id);
        const p = who ? E.predict(D, S, who, id, o ? 'deliver' : 'gift') : null;
        return { id, n, note: p ? `${p.txt}・${p.riskTxt.replace('被抓風險：', '風險')}` : null, cls: p && p.cls, sub: n ? D.ITEMS[id].desc : `缺貨・${sourcesOf(id).map((x) => x.label).join('、')}` };
      }),
      forProduct: o ? o.product : null,
      forWho: o ? D.CHARS[o.who].name : null,
      quick: quickCraft,
      onQuick: (on) => { quickCraft = on; try { localStorage.setItem('lingrong-quickcraft', on ? '1' : '0'); } catch { /* 忽略 */ } },
      firstSpike: !S.seenSpike,
      tutorial: tutStep() === 'craft',
      onSeen: (k) => { if (k === 'spike') S.seenSpike = true; },
      cook: (sel) => {
        craftResult = E.craft(D, S, { ...sel, forOrder: craftSel.forOrder, forWho: craftSel.forWho });
        const r = craftResult;
        if (tutStep() === 'craft' && r.order && r.product === r.order.product) { S.tutorial.step = 'deliver'; S.tutorial.sayDeliver = true; }
        return { product: r.product, traits: r.tr, spike: r.spike, toInv: r.toInv, lostSpike: r.lostSpike };
      },
      actions: () => {
        const r = craftResult;
        const done = S.slot >= R.slotsPerDay;
        const canDeliver = !done && !grounded() && r.order && r.product !== 'junk' && !r.toInv;
        const out = [{ a: 'craftdone', v: 'home', label: done ? '天色晚了，回宮' : '回炎洗宮', def: !canDeliver, primary: !canDeliver }];
        if (canDeliver) out.push({ a: 'craftdone', v: 'deliver', label: `直接送去${D.CHARS[r.order.who].palace}`, primary: true, def: true });
        if (r.order && r.product !== 'junk' && !r.toInv) out.push({ a: 'craftdone', v: 'proxy', label: '包捐代交' });
        return out;
      },
      onStep: (n) => { if (n !== craftSel.stage) cursor.key = null; craftSel.stage = n; },
      onRender: () => { if (screen === 'craft') { syncHeader(); syncCursor(true); } },
      img: (w) => `assets/characters/${D.CHARS[w].imgs._ || Object.values(D.CHARS[w].imgs)[0]}.webp`,
      itemImg: (id) => `assets/items/${id}.webp`,
      sfx: (n, a) => A.sfx(n, a),
    });
    A.playBgm('workshop');
    go('craft');
  }
  // 下鍋後藏起返回鍵：只換頁首，不整頁重畫（模組自己的畫面還在動）
  function syncHeader() {
    const back = app.querySelector('.subhead .icon-btn[data-a="go"]');
    if (back && craftSel.stage > 1) back.replaceWith(Object.assign(document.createElement('span'), { className: 'icon-btn' }));
  }

  // itemId：指定要送哪一個成品（剛調合好的那個）；沒指定就送最新做好的
  // how：'self' 親自送（要出門）；'proxy' 包捐代交（禁足也行、不花時辰、只拿賞銀）
  function doDeliver(orderId, itemId = null, how = 'self') {
    if (how === 'self' && needOut()) return;
    const r = E.deliver(D, S, orderId, itemId, rand, how);
    if (r.noItem) { go('home'); return; }
    if (tutStep() === 'deliver' && !r.proxy) S.tutorial.step = 'night';
    A.sfx('pop');
    if (r.proxy) {
      // 包捐跑腿：出發、（加了料就接加料的結果）、回來
      const [go1, back] = D.PROXY_LINES;
      const mid = r.caught || (r.outcome && r.outcome !== 'plain') ? outcomeLines(r.who, r.spike, r) : [];
      playDialog([go1, ...mid, ...(r.caught ? [] : [back])], () => go('result'), r.caught ? D.CHARS[r.who].bg : 'yanxi');
      return;
    }
    playDialog(outcomeLines(r.who, r.spike, r), () => go('result'), D.CHARS[r.who].bg);
  }

  // 拜訪各宮（§14）：handId 空＝空手
  function doVisit(who, handId) {
    if (needOut()) return;
    const item = handId == null ? null : S.hand.find((h) => h.id === handId);
    if (handId != null && (!item || item.product === 'junk')) return;
    const r = E.visit(D, S, who, item ? item.id : null, rand);
    const enter = D.VISIT_ENTER[who] || [];
    if (r.empty) { playDialog([...enter, ...D.VISIT_EMPTY[who]], () => go('result'), D.CHARS[who].bg); return; }
    if (r.refused) { playDialog([...enter, ...D.REFUSE[r.who]], () => go('result'), D.CHARS[r.who].bg); return; }
    A.sfx(r.reaction === 'love' ? 'ding' : 'pop');
    // 收下：被抓 → 太醫那段；否則先說反應（E 組），有料得手再接加料的結果
    const lines = r.caught ? outcomeLines(r.who, r.spike, r) : [...visitReact(r), ...(r.outcome && r.outcome !== 'plain' ? outcomeLines(r.who, r.spike, r) : [])];
    playDialog([...enter, ...lines], () => go('result'), D.CHARS[r.who].bg);
  }
  function visitReact(r) {
    const V = D.VISIT_REACT[r.who];
    return (r.reaction === 'hate' && V.hateP[r.product]) || V[r.reaction] || V.plain;
  }

  function sleepEarly() {
    modal = {
      title: '要提早就寢嗎？',
      body: `<p>今天還剩 ${R.slotsPerDay - S.slot} 個時辰，就寢後會直接浪費掉。</p>
        <div class="row-btns"><button class="btn ghost" data-a="closemodal">再想想</button><button class="btn primary" data-a="sleepyes" data-def>就寢</button></div>`,
    };
    render();
  }

  function spikeInfo(id) {
    const it = D.ITEMS[id];
    const src = sourcesOf(id).map((s) => `<li>${s.label}</li>`).join('');
    modal = {
      title: `${it.name}・持有 ${have(id)}`,
      body: `<div class="modal-tok">${tok(id, 'xl')}</div><p>${it.desc}</p>
        <p class="muted">被抓的基礎機率 ${pct(it.catch)}，被抓禁足 ${it.ground} 天。跟對方交情越好越不容易被懷疑；夾在她自己點的訂單裡交貨，風險再減半。</p>
        <h4>哪裡拿得到</h4><ul>${src}</ul>
        <button class="btn primary wide" data-a="closemodal" data-def>知道了</button>`,
    };
    render();
  }

  // ───────── 結局 ─────────
  // 結局計算（含封號判定）在 js/engine.js 的純函式 E.computeEnding；
  // 這裡的外殼只負責封號冊（localStorage）的讀寫。
  const BOOK_KEY = 'lingrong-titles';
  function loadBook() {
    try { return JSON.parse(localStorage.getItem(BOOK_KEY)) || []; } catch { return []; }
  }
  function saveBook(book) {
    try { localStorage.setItem(BOOK_KEY, JSON.stringify(book)); } catch { /* 無痕模式等 */ }
  }

  function computeEnding(save = true) {
    const before = loadBook();
    const r = E.computeEnding(D, S, before);
    if (save) saveBook(r.book);
    return r;
  }

  async function share() {
    const e = S.result;
    const more = e.extra.length ? `，另外加封「${e.extra.map((t) => t.name).join('」「')}」` : '';
    const text = `我在《煉金術士零溶——逆襲a零溶》獲封「${e.main.name}」${more}！你也來試試：`;
    const url = location.href;
    try {
      if (navigator.share) { await navigator.share({ title: '煉金術士零溶', text, url }); return; }
      await navigator.clipboard.writeText(`${text}${url}`);
      toast('已複製分享文字！');
    } catch { /* 使用者取消 */ }
  }

  // ───────── 畫面元件 ─────────
  function toast(msg, ms = 1800) {
    app.querySelectorAll('.toast').forEach((t) => t.remove());
    const el = document.createElement('div');
    el.className = `toast${msg.length > 22 ? ' long' : ''}`;
    el.textContent = msg;
    app.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  const muteIcon = () => (A.isMuted()
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M2 2l20 20"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>');

  function topBar() {
    return `<header class="topbar">
      <div class="tb-day"><b>${S.day}/${R.days} 天・${SLOT_NAMES[Math.min(S.slot, 2)]}</b>
        <span class="slots" aria-label="剩 ${R.slotsPerDay - S.slot} 個時辰">${[0, 1, 2].map((i) => `<i class="${i < S.slot ? 'used' : ''}"></i>`).join('')}</span></div>
      <div class="tb-stats">${coin(S.silver)}<span>寵 ${S.favor.lingrong}</span>
        <button class="icon-btn" data-a="mute" aria-label="音樂開關">${muteIcon()}</button></div>
    </header>`;
  }

  function subHeader(title, sub, dark = false, backDef = false, back = true) {
    return `<div class="subhead ${dark ? 'dark' : ''}">
      ${back ? `<button class="icon-btn" data-a="go" data-v="home" aria-label="返回"${backDef ? ' data-def' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button>` : '<span class="icon-btn" aria-hidden="true"></span>'}
      <div><div class="subhead-title">${title}</div>${sub ? `<div class="subhead-sub">${sub}</div>` : ''}</div>
      <div class="subhead-stats">${coin(S.silver)}・剩 ${R.slotsPerDay - S.slot} 時辰</div>
    </div>`;
  }

  // 包捐每天一句（台詞總表 H 組）：由上往下，符合第一個條件就說那一句
  function hintLine() {
    // 教學第一天：包捐指向下一步（A20、H6、A28）
    if (tutStep() === 'gather') return '小主，藕粉桂花糖糕要藕粉和桂花。藕粉咱們有，桂花得去御花園摘。';
    if (tutStep() === 'craft') return '材料都齊了，來調合吧！';
    if (tutStep() === 'deliver') return D.TUT_DELIVER[2];
    const ready = S.orders.find((o) => readyItem(o));
    if (grounded() && ready) return '小主禁足中，東西做好了就交給奴婢跑腿吧。'; // H1
    if (grounded()) return `禁足中……小主可以調合，或抄抄經。（到第 ${S.groundUntil} 天）`; // H2
    const f = S.flip;
    if (isTarget(f) && !S.conc[f].debuff && S.hand.some((h) => h.spike)) return `今晚是${charName(f)}侍寢……手上這份「心意」，該送過去了。`; // H3
    if (ready) return `東西做好了，親自送去給${charName(ready.who)}，交情會更好。`; // H4
    for (const o of S.orders) {
      const miss = D.PRODUCTS[o.product].recipe.find((id) => !have(id));
      if (miss) return `${itemName(miss)}不夠，可以去${locName(sourcesOf(miss).find((x) => x.loc !== 'shop')?.loc || sourcesOf(miss)[0].loc)}採，或在小舖買。`; // H5
    }
    if (S.orders.some((o) => recipeOk(o.product))) return '材料都齊了，來調合吧！'; // H6
    if (!S.orders.length) return '今天沒有訂單，小主可以去各宮走動走動。'; // H7
    const preg = D.TARGETS.find((t) => S.conc[t].status === 'pregnant');
    if (preg) return `${charName(preg)}有喜了呢……（呵）`; // H8
    return D.IDLE[(S.day + S.slot) % D.IDLE.length];
  }

  function tonightCard() {
    const f = S.flip;
    let body;
    if (!f) body = '<div class="tn-main"><b>今晚黃上不翻牌子</b><small>批奏摺去了</small></div>';
    else if (f === 'lingrong') {
      body = `${avatar('lingrong')}<div class="tn-main"><b>今晚黃上翻了零溶的牌子！</b><small>${grounded() ? '可惜禁足中，侍寢取消……' : `晚上恩寵 +${R.serveFavor}`}</small></div>`;
    } else {
      const c = S.conc[f];
      body = `${avatar(f)}<div class="tn-main"><b>今晚${charName(f)}侍寢</b>
        <small>${c.debuff ? `已經${D.ITEMS[c.debuff].debuff}，今晚必定出包！` : `友好 ${S.friend[f]}・枕邊風 ${pct(E.pillowChance(D, S, f))}`}</small></div>
        <button class="btn small ${c.debuff ? '' : 'primary'}" data-a="giftto" data-v="${f}" ${grounded() || c.debuff ? 'disabled' : ''}>拜訪</button>`;
    }
    return `<section class="tonight">
      <div class="tn-row">${body}</div>
      <div class="tn-bribe"><span>${S.bribedToday
        ? `已包大紅包・明天被翻 ${pct(E.flipOdds(D, S).lingrong)}`
        : `給敬事房包大紅包：明天被翻 ${pct(E.flipOdds(D, S, 0).lingrong)} → <b>${pct(E.flipOdds(D, S, R.bribeWeight).lingrong)}</b>`}${S.empressBoost ? '<br>黃后明天會替零溶進言！' : ''}</span>
        <button class="link-btn" data-a="bribe" ${S.bribedToday || S.silver < R.bribeCost ? 'disabled' : ''}>${S.bribedToday ? '已打點' : coin(R.bribeCost)}</button></div>
    </section>`;
  }

  // 主畫面預設：第一張訂單卡的主要按鈕（可按時）；否則導覽列「採集」
  const orderMainOk = (o) => (readyItem(o) ? true : recipeOk(o.product)); // 備好的訂單禁足時也能代交
  const DEF = (on) => (on ? ' data-def' : '');

  function orderCard(o, i) {
    const c = D.CHARS[o.who];
    const isDef = i === 0 && orderMainOk(o);
    const left = daysLeft(o);
    const item = readyItem(o);
    let body;
    if (item) {
      body = `<div class="ready">${item.spike ? tok(item.spike) : tok(item.product)}
          <span>成品已備好・${item.spike ? `偷加了${itemName(item.spike)}` : '正正經經'}</span></div>
        <div class="row-btns deliver-btns">
          <button class="btn primary${SPOT(tutStep() === 'deliver')}" data-a="deliver" data-v="${o.id}"${DEF(isDef && !grounded())} ${grounded() ? 'disabled' : ''}>${grounded() ? '禁足中，不能出門' : `親自送去${c.palace}`}</button>
          <button class="btn ghost" data-a="proxy" data-v="${o.id}"${DEF(isDef && grounded())}>包捐代交<small>只拿賞銀</small></button>
        </div>`;
    } else {
      const rows = D.PRODUCTS[o.product].recipe.map((id) => {
        const n = have(id);
        const src = sourcesOf(id)[0];
        const right = n ? `<span class="ok">已有 ${n}</span>` : `<button class="link-btn" data-a="goto" data-v="${src.loc}">缺 1・去${locName(src.loc)}</button>`;
        return `<div class="need">${tok(id, 'sm')}<span class="need-name">${itemName(id)}</span>${right}</div>`;
      }).join('');
      const ok = recipeOk(o.product);
      body = `<div class="needs">${rows}</div>
        <button class="btn ${ok ? 'primary' : ''} wide${SPOT(ok && tutStep() === 'craft')}" data-a="craftfor" data-v="${o.id}"${DEF(isDef && tutStep() !== 'gather')} ${ok ? '' : 'disabled'}>${ok ? '調合' : '材料還不夠'}</button>`;
    }
    return `<article class="ocard ${left === 1 ? 'urgent' : ''}" style="--c:${c.color}">
      <div class="ocard-head">${avatar(o.who)}
        <div class="ocard-title"><b>${c.name}要「${itemName(o.product)}」</b><small>友好 ${S.friend[o.who]}・${statusShort(o.who)}</small></div>
        <span class="due ${left === 1 ? 'today' : ''}">${left === 1 ? '今天截止' : `剩 ${left} 天`}</span></div>
      ${body}
      <button class="reject" data-a="reject" data-v="${o.id}">婉拒（友好 ${R.rejectFriend}）</button>
    </article>`;
  }

  function statusShort(who) {
    const c = S.conc[who];
    let s = { normal: '正常', pregnant: `有喜（${c.preg + 1}/${R.pregnancyNights}）`, infertile: '不孕' }[c.status];
    if (c.musk && c.status !== 'infertile') s += `・麝香 ${c.musk}/${R.muskDoses}`;
    if (c.debuff) s += `・${D.ITEMS[c.debuff].debuff}`;
    return s;
  }

  function spikeBar() {
    const ids = Object.keys(D.ITEMS).filter((id) => D.ITEMS[id].type === 'spike');
    return `<div class="spikebar"><span class="spikebar-label">料</span>
      ${ids.map((id) => `<button class="spike-btn ${have(id) ? '' : 'empty'}" data-a="spikeinfo" data-v="${id}" aria-label="${itemName(id)} ${have(id)} 個">${tok(id, 'sm')}<b>${have(id)}</b></button>`).join('')}
    </div>`;
  }

  // ───────── 各畫面 ─────────
  const views = {
    title() {
      return `<div class="screen title-screen bg-title">
        <div class="title-scrim"></div>
        ${portrait('lingrong', 'evil', 'title-portrait')}
        <div class="logo"><div class="logo-main">煉金術士<br>零溶</div><div class="logo-sub">逆襲a零溶</div></div>
        <div class="title-ui">
          <button class="btn gold big" data-a="start" data-def>開始遊戲</button>
          <p class="disclaimer">同人惡搞作品<br>所有配方與效果皆為虛構<br>建議開啟聲音遊玩</p>
        </div>
      </div>`;
    },

    home() {
      return `<div class="screen theme-light">
        ${topBar()}
        <div class="scroll">
          ${grounded() ? `<div class="grounded">禁足中（到第 ${S.groundUntil} 天）：不能出門採集、交貨、拜訪，也不能侍寢
            <button class="btn small gold" data-a="sutra"${S.slot >= R.slotsPerDay ? ' disabled' : ''}>抄經（1 時辰）</button></div>` : ''}
          <div class="stage bg-yanxi">
            ${portrait('lingrong', grounded() ? 'shock' : 'smile', 'stage-portrait')}
            <div class="bubble">${esc(hintLine())}</div>
          </div>
          ${tonightCard()}
          <section class="orders">
            <h2>訂單 <small>${S.orders.length} 張</small></h2>
            ${S.orders.length ? S.orders.map(orderCard).join('') : '<p class="muted">目前沒有訂單。可以先採集備料，或去各宮走動走動。</p>'}
            ${S.hand.some((h) => h.product === 'junk') ? `<p class="muted">（手上還有 ${S.hand.filter((h) => h.product === 'junk').length} 坨黑黑的東西……）</p>` : ''}
          </section>
        </div>
        ${spikeBar()}
        <nav class="bottomnav">
          <button data-a="go" data-v="shop"><b>商</b><span>小舖</span></button>
          <button class="${SPOT(tutStep() === 'gather')}" data-a="go" data-v="gather"${DEF(tutStep() === 'gather' || (!tutStep() && !(S.orders.length && orderMainOk(S.orders[0]))))}><b>採</b><span>採集</span></button>
          <button data-a="craftfor" data-v=""><b>煉</b><span>調合</span></button>
          <button data-a="giftto" data-v=""><b>訪</b><span>拜訪</span></button>
          <button data-a="go" data-v="status"><b>宮</b><span>後宮</span></button>
          <button data-a="sleep"><b>寢</b><span>就寢</span></button>
        </nav>
      </div>`;
    },

    sutra() {
      if (!sutra) return views.home();
      const done = sutra.next >= sutra.tiles.length;
      let n = 0;
      const paper = [...sutra.line].map((c) => {
        if (/[，。、！？；：]/.test(c)) return `<span class="sp-punct">${c}</span>`;
        const k = n++;
        return k < sutra.next ? `<span class="sp-ch">${c}</span>` : '<span class="sp-ch blank"></span>';
      }).join('');
      // 墨漬：位置由序號決定（重畫不會跳）
      const blots = Array.from({ length: sutra.blots }, (_, i) => `<i class="sp-blot" style="left:${(i * 37 + 12) % 86}%;top:${(i * 53 + 20) % 70}%;--s:${0.7 + ((i * 7) % 5) / 10}"></i>`).join('');
      const firstFree = sutra.tiles.findIndex((_, k) => !sutra.used.has(k));
      return `<div class="screen theme-dark sutra-screen bg-study">
        ${subHeader('禁足抄經', '依照句子的順序點字・點錯會多一滴墨', true, false, !done)}
        <div class="scroll pad">
          <div class="sp-say">${portrait('baojuan', '_', 'sp-face')}<p>${esc(done ? '抄好了！' : D.SUTRA_START[2])}</p></div>
          <div class="sp-paper${done ? ' done' : ''}"><div class="sp-line">${paper}</div>${blots}</div>
          <div class="sp-tiles">${sutra.tiles.map((t, k) => (sutra.used.has(k)
            ? '<span class="sp-tile gone"></span>'
            : `<button class="sp-tile${sutra.shake === k ? ' shake' : ''}" data-a="tile" data-v="${k}"${DEF(k === firstFree)}>${t.ch}</button>`)).join('')}</div>
        </div>
      </div>`;
    },

    shop() {
      // 分頁＋格子（原本是一條很長的清單）：素材／料／賣東西
      const tab = shopTab;
      const buyCell = (id) => {
        const it = D.ITEMS[id];
        const ok = S.silver >= it.price;
        const note = it.type === 'spike' ? it.desc : id === 'liquor' ? '加紅花瓣煉紅花' : '';
        return `<button class="scell${ok ? '' : ' poor'}" data-a="buy" data-v="${id}"${DEF(id === firstBuy)} ${ok ? '' : 'disabled'}>
          ${tok(id, 'lg')}<b>${it.name}</b>${note ? `<small class="scell-note">${note}</small>` : ''}
          <span class="scell-foot">${coin(it.price)}<em>持有 ${have(id)}</em></span></button>`;
      };
      const mats = D.SHOP.filter((id) => D.ITEMS[id].type === 'mat');
      const spikes = D.SHOP.filter((id) => D.ITEMS[id].type === 'spike');
      const list = tab === 'spike' ? spikes : mats;
      const firstBuy = list.find((x) => S.silver >= D.ITEMS[x].price);
      // 賣：一般份一格（一次賣一份），帶特性的每份各一格
      const sellable = Object.keys(S.inv).filter((id) => D.ITEMS[id].type === 'mat' && D.ITEMS[id].price && have(id) > 0);
      const sellCells = sellable.flatMap((id) => {
        const plain = have(id) - lotCount(id);
        const cells = S.lots.filter((l) => l.id === id).map((l) => `<button class="scell" data-a="sell" data-v="${id}:${l.uid}">
          ${tok(id, 'lg')}<b>${itemName(id)}</b>${trChips(l.tr, 'sm')}<span class="scell-foot">賣 ${coin(E.sellPrice(D, id, l.tr))}</span></button>`);
        if (plain > 0) cells.unshift(`<button class="scell" data-a="sell" data-v="${id}">
          ${tok(id, 'lg')}<b>${itemName(id)}</b><small class="scell-note">一般・持有 ${plain}</small><span class="scell-foot">賣 ${coin(E.sellPrice(D, id, {}))}</span></button>`);
        return cells;
      });
      const TABS = [['mat', '素材'], ['spike', '料'], ['sell', '賣東西']];
      const body = tab === 'sell'
        ? (sellCells.length ? `<p class="muted shop-tip">售價一半，每級特性多 1 兩</p><div class="sgrid">${sellCells.join('')}</div>` : '<p class="muted">沒有能賣的素材。</p>')
        : `<p class="muted shop-tip">${tab === 'spike' ? '紅花瓣只有太醫院採得到喔。' : '小舖買的沒有特性，採集來的才有'}</p><div class="sgrid">${list.map(buyCell).join('')}</div>`;
      return `<div class="screen theme-light">
        ${subHeader('包捐的跑腿小舖', '買賣都不花時辰，禁足中也能買賣')}
        <div class="scroll">
          <div class="shop-head">${portrait('baojuan', '_', 'shop-face')}<div class="bubble">小主要買什麼？多的東西，奴婢也能拿去換銀子。</div></div>
          <div class="pad">
          <div class="seg" role="tablist">${TABS.map(([k, t]) => `<button class="seg-btn${tab === k ? ' on' : ''}" data-a="shoptab" data-v="${k}" role="tab" aria-selected="${tab === k}">${t}</button>`).join('')}</div>
          ${body}
        </div></div>
      </div>`;
    },

    gather() {
      const needed = new Set();
      S.orders.forEach((o) => { if (!readyItem(o)) D.PRODUCTS[o.product].recipe.forEach((id) => { if (!have(id)) needed.add(id); }); });
      const card = (loc, i) => {
        const g = D.GATHER[loc];
        const hits = g.table.filter(([id]) => needed.has(id)).map(([id]) => itemName(id));
        return `<article class="loc ${hits.length ? 'hot' : ''}">
          <div class="loc-banner bg-${g.bg}"><span>${g.name}</span>${hits.length ? `<em>有你缺的${hits.join('、')}</em>` : ''}</div>
          <div class="loc-body">
            <div class="drops">${g.table.map(([id, w]) => `<span class="drop ${D.ITEMS[id].type === 'spike' || id === 'petal' ? 'spike' : ''} ${needed.has(id) ? 'need' : ''} ${w < 1.5 ? 'rare' : ''}">${D.ITEMS[id].type === 'spike' ? '料：' : ''}${itemName(id)}・${rarity(w)}</span>`).join('')}</div>
            <button class="btn ${hits.length ? 'primary' : ''} wide${SPOT(tutStep() === 'gather' && loc === 'garden')}" data-a="${hasDungeon(loc) ? 'enter' : 'gather'}" data-v="${loc}"${DEF(i === 0)} ${grounded() ? 'disabled' : ''}>${grounded() ? '禁足中' : loc === 'taiyi' ? '偷溜進太醫院' : '潛入御花園偷採'}</button>
          </div></article>`;
      };
      let sheet = '';
      if (gatherResult) {
        const g = D.GATHER[gatherResult.loc];
        const done = S.slot >= R.slotsPerDay;
        const entries = Object.entries(gatherResult.got);
        const caught = gatherResult.ended === 'caught';
        const who = caught ? guardOf(gatherResult.loc, gatherResult.by) : null;
        const endMsg = caught ? `${who.name}：「${who.line}」這趟到此為止——撿到的都保住了。`
          : gatherResult.ended === 'timeout' ? '天色暗了，先撤！撿到的都帶走了。'
          : gatherResult.ended === 'quit' ? '見好就收，全身而退。' : '';
        const reAction = hasDungeon(gatherResult.loc) ? 'enter' : 'regather';
        sheet = `<div class="sheet-layer"><div class="sheet">
          ${caught && who.img ? `<div class="caught-guard"><img src="assets/characters/${who.img}.webp" alt="${esc(who.name)}" onerror="${IMG_FAIL}"></div>` : ''}
          <h3 class="sheet-title">${caught ? '被抓了！' : '採到了！'}</h3>
          ${endMsg ? `<p class="center ${caught ? 'ok' : 'muted'}">${endMsg}</p>` : ''}
          ${entries.length
            ? `<div class="got">${entries.map(([id, n], i) => `<div class="got-card ${D.ITEMS[id].type}" style="animation-delay:${i * 0.15}s">${tok(id, 'lg')}<span>${itemName(id)}</span><b>+${n}${D.ITEMS[id].type === 'spike' ? ' 料！' : ''}</b>${(gatherResult.haul || []).filter((h) => h.id === id && E.traitSum(h.tr)).map((h) => trChips(h.tr)).join('')}</div>`).join('')}</div>`
            : '<p class="center muted">這趟空手而回……</p>'}
          ${gatherResult.got.petal ? '<p class="center ok">紅花瓣！加上烈酒就能煉出紅花……</p>' : ''}
          ${gatherResult.ready.map((o) => `<p class="ok center">${charName(o.who)}的${itemName(o.product)}：材料湊齊了</p>`).join('')}
          ${done ? '' : `<button class="btn primary wide regather" data-a="${reAction}" data-v="${gatherResult.loc}">再去${g.name}採一次</button>`}
          <div class="row-btns">
            <button class="btn ghost" data-a="gatherdone" data-v="home"${DEF(done || !gatherResult.ready.length)}>${done ? '天色晚了，回宮' : '回炎洗宮'}</button>
            ${!done && gatherResult.ready.length ? '<button class="btn primary" data-a="gatherdone" data-v="craft" data-def>直接去調合</button>' : ''}
          </div></div></div>`;
      }
      return `<div class="screen theme-light">
        ${subHeader('出門採集', '潛入御花園或太醫院，躲開巡邏偷採素材')}
        <div class="scroll pad">${card('garden', 0)}${card('taiyi', 1)}</div>
        ${sheet}
      </div>`;
    },

    craft() {
      const order = S.orders.find((o) => o.id === craftSel.forOrder);
      const who = craftSel.forWho;
      const sub = order ? `給${charName(order.who)}（${statusShort(order.who)}）` : who ? `料的預測以今晚侍寢的${charName(who)}為準` : '試試看會做出什麼';
      return `<div class="screen theme-dark craft-screen">
        ${subHeader(order ? `調合・${itemName(order.product)}` : '調合', sub, true, false, craftSel.stage === 1)}
        <div class="scroll"><div class="cf-mount"></div></div>
      </div>`;
    },

    gift() {
      const who = giftWho;
      const items = S.hand.filter((h) => h.product !== 'junk');
      const off = grounded();
      const targetCard = (t) => {
        const tonight = S.flip === t;
        return `<button class="gcard ${who === t ? 'on' : ''}" data-a="giftwho" data-v="${t}"${DEF(who == null && t === D.TARGETS[0])} style="--c:${D.CHARS[t].color}">
          ${avatar(t)}<span class="gcard-main"><b>${charName(t)}${tonight ? '<em>今晚侍寢</em>' : ''}</b>
          <small>${D.CHARS[t].palace}・友好 ${S.friend[t]}・收禮機率 ${pct(E.acceptChance(D, S, t))}</small>
          <span class="bar heart"><i style="width:${S.friend[t]}%"></i></span></span></button>`;
      };
      let list = '';
      if (who) {
        // 不顯示預估友好：喜好要玩家自己試出來（§14.1）
        const rows = items.map((h) => {
          const p = h.spike ? E.predict(D, S, who, h.spike, 'gift', h.tr) : null;
          return `<div class="row gift-row">${tok(h.product)}${h.spike ? tok(h.spike, 'sm') : ''}
            <div class="row-main"><b>${itemName(h.product)}${h.spike ? `<em class="spiked">＋${itemName(h.spike)}</em>` : ''}</b>${trChips(h.tr, 'sm')}
            ${p ? `<small>${p.txt}・${p.riskTxt}</small>` : ''}</div>
            <button class="btn small primary" data-a="gift" data-v="${h.id}" ${off ? 'disabled' : ''}>帶這份去</button></div>`;
        }).join('');
        list = `<div class="row gift-row empty-visit"><span class="tok tok-none"><span class="tok-ch">空</span></span>
            <div class="row-main"><b>空手拜訪</b><small>聊聊天，友好 +${R.visitEmptyFriend}</small></div>
            <button class="btn small primary" data-a="gift" data-v=""${DEF(!off)} ${off ? 'disabled' : ''}>去${D.CHARS[who].palace}</button></div>
          ${rows || '<p class="muted">手上沒有成品可以當伴手禮。</p>'}`;
      }
      return `<div class="screen theme-light">
        ${subHeader('拜訪各宮', '花 1 個時辰・可以空手去，也可以帶一份成品當伴手禮')}
        <div class="scroll pad">
          ${off ? '<div class="grounded inline">禁足中，不能出門拜訪</div>' : ''}
          <h3>去誰那裡？</h3>
          <div class="gcards">${D.TARGETS.map(targetCard).join('')}</div>
          ${who ? `<h3>帶什麼去？</h3>${list}` : '<p class="muted">先選一位娘娘。</p>'}
        </div>
      </div>`;
    },

    result() {
      const r = S.result;
      const c = D.CHARS[r.who];
      let stamp;
      let stampCls;
      if (r.refused) { stamp = '拒收'; stampCls = 'grey'; }
      else if (r.caught) { stamp = '被抓'; stampCls = 'red'; }
      else if (r.useless) { stamp = '無效'; stampCls = 'grey'; }
      else if (r.label) { stamp = r.label; stampCls = r.outcome === 'musk_dose' || r.outcome === 'musk_miss' ? 'purple' : 'red'; }
      else if (r.empty) { stamp = '拜訪'; stampCls = 'gold'; }
      else { stamp = { love: '投其所好', hate: '嫌棄', mixed: '又愛又嫌' }[r.reaction] || '收下'; stampCls = r.reaction === 'hate' ? 'grey' : 'gold'; }
      const tier = fxTier(r);
      if (tier) stampCls += ' fierce'; // 狠章（加料得手、被抓）
      const shake = tier === 'heavy' && !r.fxDone && !dlg; // 只有「重」在蓋章時晃一次；重繪不再晃
      const lines = [];
      if (r.kind === 'deliver') {
        lines.push(`<div class="rline">${tok(r.product, 'sm')}<span>${r.caught ? '東西被沒收了' : `${r.proxy ? '包捐代交' : '訂單完成'}・${itemName(r.product)}`}${r.useless ? '<small>（味道怪怪的，賞銀減半、不加友好）</small>' : ''}</span>
          <b class="gold">銀 +${r.reward}${!r.caught && r.friendDelta ? `　友好 +${r.friendDelta}` : ''}</b></div>`);
      } else if (r.empty) {
        lines.push(`<div class="rline"><span class="tok tok-none sm"><span class="tok-ch">空</span></span><span>空手拜訪${c.palace}，聊了一會兒</span><b class="gold">友好 +${r.friendDelta}</b></div>`);
      } else {
        lines.push(`<div class="rline">${tok(r.product, 'sm')}<span>${r.refused ? '被拒收，禮物退回' : r.caught ? '禮物被沒收了' : `送出${itemName(r.product)}`}</span>
          <b class="gold">${!r.refused && !r.caught && r.friendDelta ? `友好 +${r.friendDelta}` : '—'}</b></div>`);
      }
      if (r.spike && !r.refused) {
        let txt;
        let val;
        if (r.caught) { txt = `被太醫驗出${itemName(r.spike)}！禁足 ${r.days} 天`; val = `友好 ${r.friendDelta}`; }
        else if (r.useless) { txt = `${itemName(r.spike)}沒發揮作用`; val = '無'; }
        else if (r.favDelta) { txt = `${itemName(r.spike)}得逞・${r.label}`; val = `${c.name}寵 ${r.favDelta}`; }
        else { txt = `${itemName(r.spike)}・${r.label}`; val = '累積中'; }
        lines.push(`<div class="rline">${tok(r.spike, 'sm')}<span>${txt}${!r.caught && r.outcome === 'debuff' && S.flip === r.who ? '<small>她今晚侍寢，一定出包！</small>' : ''}</span><b class="${r.caught ? 'red' : 'purple'}">${val}</b></div>`);
      }
      const done = S.slot >= R.slotsPerDay;
      const hurt = r.caught ? false : r.favDelta < 0;
      // 被抓暗幕：一開始 0.45，章落下後 0.62（playResultFx 播）；重繪時直接維持 0.62
      const love = r.kind === 'gift' && r.reaction === 'love' && !r.refused && !r.caught;
      const meh = r.kind === 'gift' && !r.caught && (r.reaction === 'hate' || r.reaction === 'mixed') && !r.refused;
      // 拜訪的演出：投其所好＝花瓣＋大字；嫌棄、又愛又嫌＝嫌棄立繪；拒收＝零溶尷尬、禮物彈回
      const who0 = r.caught ? 'doctor' : r.refused && r.kind === 'gift' ? 'lingrong' : r.who;
      const expr = r.refused && r.kind === 'gift' ? 'shock' : hurt ? 'oops' : meh ? 'meh' : 'happy';
      return `<div class="screen result bg-${c.bg}${tier ? ` fx-${tier}` : ''}${r.caught ? ' fx-caught' : ''}${shake ? ' fx-shake' : ''}${love ? ' fx-love' : ''}">
        ${r.caught ? `<div class="fx-veil${r.fxDone ? ' settled' : ''}"></div>` : ''}
        ${love ? `<div class="petals" aria-hidden="true">${'<i></i>'.repeat(14)}</div><div class="love-banner">投其所好！<b>友好 +${r.friendDelta}</b></div>` : ''}
        <div class="result-stage">
          ${portrait(who0, expr, 'result-portrait')}
          ${r.refused && r.kind === 'gift' && r.product ? `<span class="gift-bounce">${tok(r.product, 'lg')}</span>` : ''}
          <div class="stamp ${stampCls}">${stamp}</div>
          ${r.favDelta ? `<div class="float-num minus">${r.favDelta}</div>` : ''}
        </div>
        <div class="receipt">${lines.join('')}</div>
        <div class="footer-cta"><button class="btn primary wide big" data-a="resultdone" data-def>${done ? '天色晚了，回宮' : '回炎洗宮'}</button></div>
      </div>`;
    },

    status() {
      const odds = E.flipOdds(D, S);
      const row = (who) => {
        const isT = isTarget(who);
        return `<div class="hrow">
          <div class="hrow-head">${avatar(who)}<b>${charName(who)}</b><small>${isT ? statusShort(who) : grounded() ? '禁足中' : S.empressBoost ? '黃后明天進言' : `連續 ${S.noFlipNights} 晚沒被翻（${R.empressNights} 晚黃后進言）`}</small>
            <span class="odds">明天被翻 ${pct(odds[who])}</span></div>
          <div class="meter"><span>恩寵</span><span class="bar"><i style="width:${S.favor[who]}%;background:${D.CHARS[who].color}"></i></span><b>${S.favor[who]}</b></div>
          ${isT ? `<div class="meter"><span>友好</span><span class="bar heart"><i style="width:${S.friend[who]}%"></i></span><b>${S.friend[who]}</b></div>
            <div class="hrow-foot">枕邊風 ${pct(E.pillowChance(D, S, who))}・收禮 ${pct(E.acceptChance(D, S, who))}</div>` : ''}
        </div>`;
      };
      const inv = Object.keys(S.inv);
      return `<div class="screen theme-light">
        ${subHeader('後宮', '恩寵決定誰被翻牌子；友好決定枕邊風和被懷疑的機率', false, true)}
        <div class="scroll pad">
          <div class="card">${D.ALL.map(row).join('')}</div>
          <h3>持有的素材與料</h3>
          <div class="chips">${inv.length ? inv.map((id) => `<span class="chip">${tok(id, 'sm')}${itemName(id)}×${S.inv[id]}${lotCount(id) ? `<em>（${lotCount(id)} 份有特性）</em>` : ''}</span>`).join('') : '<p class="muted">空空如也</p>'}</div>
          <h3>手上的成品</h3>
          <div class="chips">${S.hand.length ? S.hand.map((h) => `<span class="chip">${tok(h.product, 'sm')}${itemName(h.product)}${h.spike ? `<em>+${itemName(h.spike)}</em>` : ''}${trChips(h.tr, 'sm')}</span>`).join('') : '<p class="muted">還沒有成品</p>'}</div>
        </div>
      </div>`;
    },

    night() {
      const last = S.day >= R.days;
      return `<div class="screen night bg-night">
        <h2>第 ${S.day} 天・總結</h2>
        <ul class="daylog">${S.dayLog.length ? S.dayLog.map((l) => `<li>${esc(l)}</li>`).join('') : '<li>今天什麼都沒做……</li>'}</ul>
        <div class="night-table">
          ${D.ALL.map((w) => `<div style="--c:${D.CHARS[w].color}"><span>${charName(w)}</span><b>寵 ${S.favor[w]}</b><small>${isTarget(w) ? `友 ${S.friend[w]}` : ''}</small></div>`).join('')}
        </div>
        <button class="btn amber big wide" data-a="next" data-def>${last ? '迎接命運的結局……' : '就寢，迎接明天'}</button>
      </div>`;
    },

    ending() {
      const e = S.result;
      const st = S.stats;
      const expr = ['baimang', 'wentaiyi', 'touming'].includes(e.main.id) ? 'shock' : ['guimi', 'bailian', 'miaoyin'].includes(e.main.id) ? 'smile' : 'evil';
      const seal = (t, i) => {
        const got = e.book.includes(t.id);
        const cls = e.fresh.includes(t.id) ? 'new' : got ? 'got' : 'no';
        return `<button class="seal-btn ${cls}" style="--i:${i}" data-a="seal" data-v="${t.id}">${got ? t.seal.replace('|', '<br>') : '？'}</button>`;
      };
      return `<div class="screen ending bg-yanxi">
        <div class="end-cap">— 十日期滿 —</div>
        ${portrait('lingrong', expr, 'end-portrait')}
        <div class="edict">
          <div class="edict-hd">奉天承運　黃上詔曰</div>
          <p class="edict-open">${e.opening.join('')}</p>
          <p>茲賜${e.top === 'lingrong' ? '鈕祜祿氏零溶' : '炎洗宮安小主零溶'}封號——</p>
          <h1 class="edict-title">${e.main.name}</h1>
          <p>${e.main.comment}欽此。</p>
          ${e.extra.length ? `<div class="edict-extra">另外加封：${e.extra.map((t) => `<b>${t.name}</b>`).join('、')}</div>` : ''}
          <div class="edict-seal">黃上<br>之寶</div>
        </div>
        <div class="end-low">
          <div class="end-chips"><span>恩寵 <b>第 ${e.rank} 名</b></span><span>加料 <b>${st.spikesUsed}</b></span><span>得手 <b>${st.success}</b></span><span>被抓 <b>${st.caught}</b></span></div>
          <section class="title-book">
            <div class="book-h">封號冊 <small>已收集 ${D.TITLES.filter((t) => e.book.includes(t.id)).length} / ${D.TITLES.length}・點印章看說明</small></div>
            <div class="seals">${D.TITLES.map(seal).join('')}</div>
          </section>
          <div class="row-btns">
            <button class="btn gold" data-a="share">分享</button>
            <button class="btn ghost-gold" data-a="start" data-def>再玩一次</button>
          </div>
        </div>
      </div>`;
    },
  };

  // ───────── 結果頁演出（狠章、停格、墨點、立繪） ─────────
  // 時間軸對齊蓋章音效（render 後 350ms）：160ms 起砸、190ms 落到 0.9 倍＝350ms，停格依等級，再彈 1.07 倍回 1。
  // 搖晃是 CSS（.result.fx-shake，延遲＝砸＋重停格），減少動態時由 CSS 關掉；其他演出用 Web Animations 照常播。
  const FX_T0 = 160;
  const FX_SLAM = 190;
  const FX_BOUNCE = 240;
  const RESULT_PORTRAIT_FX = {
    light: [[{ transform: 'none' }, { transform: 'translateY(14px) scaleY(.92)' }, { transform: 'none' }], { duration: 380, easing: 'ease-out' }],
    medium: [[{ transform: 'none' }, { transform: 'translateY(-8px)' }, { transform: 'none' }], { duration: 360, easing: 'ease-out' }],
    heavy: [[{ transform: 'none' }, { transform: 'translateY(14px) scaleY(.92)' }, { transform: 'translate(-6px,0) rotate(-2deg)' }, { transform: 'translate(5px,0) rotate(2deg)' }, { transform: 'none' }], { duration: 520, easing: 'ease-out' }],
  };
  const DOCTOR_FX = [[{ transform: 'none' }, { transform: 'scale(1.08)' }, { transform: 'none' }], { duration: 400, easing: 'ease-out' }]; // 被抓：溫太醫逼近一下
  function playResultFx() {
    const tier = fxTier(S.result);
    const st = tier && app.querySelector('.stamp.fierce');
    if (!st || typeof st.animate !== 'function') return; // 假 DOM 沒有 animate()：章維持靜態
    const stop = FX_STOP[tier];
    const dur = FX_SLAM + stop + FX_BOUNCE;
    const at = (ms) => ms / dur;
    const tf = (s, deg = -12) => `rotate(${deg}deg) scale(${s})`;
    st.animate([
      { offset: 0, transform: tf(4, -26), opacity: 0, easing: 'cubic-bezier(.6,0,1,1)' },
      { offset: at(FX_SLAM), transform: tf(0.9), opacity: 1 },
      { offset: at(FX_SLAM + stop), transform: tf(0.9), opacity: 1, easing: 'ease-out' }, // 停格
      { offset: at(FX_SLAM + stop + FX_BOUNCE * 0.45), transform: tf(1.07), opacity: 1, easing: 'ease-out' },
      { offset: 1, transform: tf(1), opacity: 1 },
    ], { duration: dur, delay: FX_T0, fill: 'both' });
    const stage = st.parentNode;
    const pt = app.querySelector('.result-portrait');
    const box = { x: st.offsetLeft, y: st.offsetTop, w: st.offsetWidth, h: st.offsetHeight }; // 未變形的版面位置
    const color = getComputedStyle(st).color;
    setTimeout(() => {
      if (!stage.isConnected) return;
      inkSplash(stage, box, color);
      if (pt) pt.animate(...(S.result.caught ? DOCTOR_FX : RESULT_PORTRAIT_FX[tier]));
    }, FX_T0 + FX_SLAM + stop);
    // 被抓：章落下（停格結束）後暗幕從 0.45 再沉到 0.62
    const veil = S.result.caught && app.querySelector('.result .fx-veil');
    if (veil) veil.animate([{ opacity: VEIL_VERDICT }, { opacity: VEIL_AFTER_STAMP }], { duration: 1400, delay: FX_T0 + FX_SLAM + stop, easing: 'ease-out', fill: 'both' });
  }
  // 14 顆墨點往外噴＋一圈墨痕擴到 1.6 倍後消失（與章同色）
  function inkSplash(stage, b, color) {
    const ring = document.createElement('div');
    ring.className = 'fx-ring';
    Object.assign(ring.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px`, borderColor: color });
    stage.appendChild(ring);
    ring.animate([{ transform: 'rotate(-12deg) scale(1)', opacity: 0.7 }, { transform: 'rotate(-12deg) scale(1.6)', opacity: 0 }], { duration: 520, easing: 'ease-out', fill: 'forwards' });
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    for (let k = 0; k < 14; k++) {
      const d = document.createElement('div');
      const size = 5 + rand() * 9;
      d.className = 'fx-ink';
      Object.assign(d.style, { width: `${size}px`, height: `${size}px`, left: `${cx}px`, top: `${cy}px`, background: color });
      stage.appendChild(d);
      const ang = rand() * Math.PI * 2;
      const dist = b.w * 0.55 + rand() * 70;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist * 0.8;
      d.animate([
        { transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(calc(-50% + ${dx * 1.08}px), calc(-50% + ${dy + 6}px)) scale(1)`, opacity: 0 },
      ], { duration: 700, easing: 'cubic-bezier(.1,.8,.3,1)', fill: 'forwards' });
    }
  }

  const speedLabel = () => (dlgSpeed === 'instant' ? '▶ 瞬間' : '▶ 2×');
  function toggleSpeed() {
    dlgSpeed = dlgSpeed === 'instant' ? 'x2' : 'instant';
    const b = app.querySelector('.speed-btn');
    if (b) b.textContent = speedLabel();
    if (dlgSpeed === 'instant') completeTyper();
  }

  // 教學的小恩寵榜（A10、A16）：up＝零溶往上跳一格（只是演出，不改數值）
  function rankPanel(up) {
    const ids = ['lingrong', ...D.TARGETS].sort((a, b) => S.favor[b] - S.favor[a]);
    const li = ids.indexOf('lingrong');
    return `<div class="rank-pop${up ? ' up' : ''}"><b>後宮恩寵榜</b>${ids.map((id, k) => {
      const to = up && k === li ? k - 1 : up && k === li - 1 ? k + 1 : k;
      return `<div class="rk-row${id === 'lingrong' ? ' me' : ''}" style="--from:${k};--to:${to};--c:${D.CHARS[id].color}"><span>${D.CHARS[id].name}</span><i style="width:${S.favor[id]}%"></i><em>${S.favor[id]}</em></div>`;
    }).join('')}</div>`;
  }

  function dialogView() {
    const [who, expr, text, opt] = dlg.lines[dlg.i];
    const isNarr = who === 'narr';
    const color = isNarr ? '#6b5a80' : D.CHARS[who].color;
    const fx = opt && opt.fx ? ` fx-${opt.fx}` : ''; // 演出標記（e2e 也看這個 class）
    return `<div class="dialog-layer bg-${dlg.bg}${dlg.fadeIn && dlg.i === 0 ? ' fade-in' : ''}" data-a="adv">
      ${opt && opt.fx === 'dim' ? '<div class="fx-veil"></div>' : ''}
      <div class="dlg-ctrls"><button class="speed-btn" data-a="speed">${speedLabel()}</button><button class="skip-btn" data-a="skip">略過 ≫</button></div>
      ${isNarr ? '' : portrait(who, expr, `dlg-portrait${fx}`)}
      ${opt && opt.panel ? rankPanel(opt.panel === 'rankup') : ''}
      <div class="dialog-box ${isNarr ? `narr${fx}` : ''}${opt && opt.choice ? ' has-choice' : ''}" style="--c:${color}">
        ${isNarr ? '' : `<div class="speaker">${D.CHARS[who].name}</div>`}
        <div class="dlg-text" data-full="${esc(text)}"></div>
        ${opt && opt.choice ? `<div class="dlg-choices">${opt.choice.map(([v, label], k) => `<button class="dlg-choice${dlg.pick === k ? ' on' : ''}" data-a="dlgchoice" data-v="${v}">▸ ${esc(label)}</button>`).join('')}</div>` : '<div class="dlg-next">▼</div>'}
      </div>
    </div>`;
  }

  function modalView() {
    return `<div class="sheet-layer" data-a="${modal.lock ? 'noop' : 'closemodal'}"><div class="sheet" data-a="noop">
      <h3 class="sheet-title">${modal.title}</h3>${modal.body}</div></div>`;
  }

  // 採集地下城 overlay（疊在 gather 畫面上）。畫面由 canvas 逐幀繪製，HUD 與方向盤是 DOM。
  function gatherOverlay() {
    const gs = gatherScene;
    const names = { nw: '左上', n: '上', ne: '右上', w: '左', e: '右', sw: '左下', s: '下', se: '右下' };
    // 3×3 方向盤，正中央留空（沒有「原地等」）
    const pad = ['nw', 'n', 'ne', 'w', '', 'e', 'sw', 's', 'se']
      .map((d) => (d ? `<button class="dg-key" data-d="${d}" aria-label="${names[d]}"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1l5 9-5-2.5L1 10z"/></svg></button>` : '<i class="dg-key-gap"></i>')).join('');
    return `<div class="dg${gs.phase === 'intro' ? '' : ' on'}">
      <div class="dg-blinds">${'<i></i>'.repeat(8)}</div>
      <div class="dg-hud snes">
        <div class="dg-steps"><i class="dg-sun"></i>剩 <b>${gs.run.stepsLeft}</b> / ${gs.run.maxSteps}</div>
        <div class="dg-got"></div>
        <button class="dg-quit" data-a="dgquit">收工</button>
      </div>
      <div class="dg-stage">
        <canvas class="dg-canvas" width="${MIN_VIEW * TILE}" height="${MIN_VIEW * TILE}"></canvas>
        <div class="dg-note snes" hidden></div>
        <div class="dg-say snes" hidden></div>
        <div class="dg-confirm snes" ${gs.confirm ? '' : 'hidden'}>
          <p>現在收工嗎？撿到的都會帶走。</p>
          <div><button data-a="leavegather">收工</button><button data-a="dgstay">繼續採</button></div>
        </div>
      </div>
      <div class="dg-foot">
        <div class="dg-pad">${pad}</div>
        <p class="dg-hint">QWE / A D / ZXC 或方向鍵移動・Esc 收工</p>
      </div>
    </div>`;
  }

  function render() {
    const keepScroll = app.querySelector('.scroll')?.scrollTop || 0;
    const prevScreen = app.dataset.screen;
    let html = views[screen]();
    if (gatherScene) html += gatherOverlay();
    if (dlg) html += dialogView();
    if (modal) html += modalView();
    app.innerHTML = html;
    app.dataset.screen = screen;
    if (prevScreen === screen) { const sc = app.querySelector('.scroll'); if (sc) sc.scrollTop = keepScroll; }
    if (dlg) startTyper();
    if (screen === 'result' && !dlg && !S.result.sfxDone) {
      S.result.sfxDone = true;
      setTimeout(() => A.sfx(S.result.caught || S.result.label ? 'stamp' : S.result.refused ? 'fail' : 'coin'), 350);
    }
    if (screen === 'result' && !dlg && !S.result.fxDone) {
      S.result.fxDone = true;
      playResultFx();
    }
    if (screen === 'craft' && craftHost) app.querySelector('.cf-mount')?.replaceWith(craftHost);
    else if (screen !== 'craft' && craftFlow) closeCraft();
    syncCursor(true);
  }

  // ───────── 鍵盤游標（焦點框） ─────────
  // 每次 render() 整頁換掉節點，所以游標記「動作 key」而不是 DOM 節點；幾何挑選在 js/focusnav.js。
  // 範圍＝最上層的 .sheet-layer（彈出視窗、結果單），否則 .screen；預設＝範圍內的 [data-def]。
  const NAV_SKIP = new Set(['adv', 'noop']);
  const NAV_DIRS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  // 深色面：焦點框改用琥珀
  const DARK_SURFACE = '.topbar, .subhead, .bottomnav, .theme-dark, .night, .ending, .dialog-box.narr, .dark-sheet, .title-screen';
  let focusBox = null;

  function navScope() {
    const layers = app.querySelectorAll('.sheet-layer');
    return layers.length ? layers[layers.length - 1] : app.querySelector('.screen');
  }
  // 範圍內可按的元素，各自帶上 key（同 a|v 出現多次時以序號區分）
  function navItems(scope) {
    if (!scope) return [];
    const seen = {};
    const out = [];
    scope.querySelectorAll('[data-a]').forEach((el) => {
      const a = el.dataset.a;
      if (NAV_SKIP.has(a) || el.disabled || !el.getClientRects().length) return;
      const base = `${a}|${el.dataset.v ?? ''}`;
      seen[base] = (seen[base] || 0) + 1;
      out.push({ el, key: `${base}#${seen[base]}` });
    });
    return out;
  }
  const navDefault = (scope, items) => {
    const d = scope && scope.querySelector('[data-def]');
    return items.find((it) => it.el === d) || null;
  };
  // 依 key 找目前元素；找不到就回預設（或第一個）
  function navCurrent(items, scope) {
    const keys = items.map((it) => it.key);
    const def = navDefault(scope, items);
    const k = window.FocusNav.resolve(cursor.key, keys, def && def.key);
    return items.find((it) => it.key === k) || null;
  }

  function drawFocus(it) {
    if (!focusBox) {
      if (!it) return;
      focusBox = document.createElement('div');
      focusBox.className = 'focus-box';
      focusBox.setAttribute('aria-hidden', 'true');
      focusBox.innerHTML = '<i></i><i></i><i></i><i></i>';
      document.body.appendChild(focusBox);
    }
    if (!it) { focusBox.classList.remove('on'); delete focusBox.dataset.key; return; }
    const r = it.el.getBoundingClientRect();
    // 捲軸內的元素被捲到可視範圍外（藏在頂列／導覽列後面）時先不畫，免得框浮在固定列上
    const sc = it.el.closest('.scroll');
    if (sc) {
      const v = sc.getBoundingClientRect();
      if (r.bottom <= v.top || r.top >= v.bottom) { focusBox.classList.remove('on'); return; }
    }
    focusBox.style.left = `${r.left - 5}px`;
    focusBox.style.top = `${r.top - 5}px`;
    focusBox.style.width = `${r.width + 10}px`;
    focusBox.style.height = `${r.height + 10}px`;
    focusBox.classList.toggle('dark', !!it.el.closest(DARK_SURFACE));
    focusBox.classList.add('on');
    focusBox.dataset.key = it.key;
  }

  // 重繪、捲動、縮放後重新定位；對話與地下城中不畫。
  // 換了畫面／彈出或收起視窗（或中間隔了一段對話）就回預設，同一畫面重繪才留在同一個動作上。
  // reveal：把游標元素捲進可視範圍（重繪、叫出時；捲動事件本身不捲，免得跟滑鼠滾輪打架）
  function syncCursor(reveal = false) {
    if (!cursor.on || dlg || gatherScene) { cursor.sig = null; drawFocus(null); return; }
    const sig = `${screen}|${app.querySelectorAll('.sheet-layer').length}`;
    if (sig !== cursor.sig) { cursor.key = null; cursor.sig = sig; }
    const scope = navScope();
    const it = navCurrent(navItems(scope), scope);
    cursor.key = it ? it.key : null;
    if (it && reveal) it.el.scrollIntoView({ block: 'nearest' });
    drawFocus(it);
  }

  // 幾何用的 rect：把畫面中的 .scroll 當作完全展開（捲軸內的元素加上 scrollTop，
  // 捲軸下方的固定列再往下推「還沒捲到的高度」），這樣捲軸外看不到的卡片也排在固定列之前。
  function navRect(el, sc, scBottom) {
    const r = el.getBoundingClientRect().toJSON();
    if (!sc) return r;
    if (sc.contains(el)) r.top += sc.scrollTop;
    else if (r.top >= scBottom - 1) r.top += sc.scrollHeight - sc.clientHeight;
    return r;
  }

  function hideCursor() {
    if (!cursor.on) return;
    cursor.on = false;
    cursor.key = null;
    drawFocus(null);
  }

  function moveCursor(dir) {
    const scope = navScope();
    const items = navItems(scope);
    if (!cursor.on) {
      // 第一下只顯示，從目前畫面的預設出現
      cursor.on = true;
      cursor.key = null;
      syncCursor(true);
      return;
    }
    const cur = navCurrent(items, scope);
    if (!cur) { drawFocus(null); return; }
    const sc = scope.querySelector('.scroll');
    const scBottom = sc ? sc.getBoundingClientRect().bottom : 0;
    const withRect = items.map((it) => Object.assign(navRect(it.el, sc, scBottom), { it }));
    const from = withRect.find((r) => r.it === cur);
    const next = window.FocusNav.pick(from, withRect, dir);
    const target = next ? next.it : cur;
    cursor.key = target.key;
    if (next) target.el.scrollIntoView({ block: 'nearest' });
    drawFocus(target);
  }

  function pressEnter() {
    const scope = navScope();
    const items = navItems(scope);
    const it = cursor.on ? navCurrent(items, scope) : navDefault(scope, items);
    if (!it) return false;
    it.el.click();
    return true;
  }

  // 數字鍵 1～6 → 導覽列六個動作；只在主畫面與子畫面、沒有彈出視窗時有效
  const HOTKEYS = { 1: ['go', 'shop'], 2: ['go', 'gather'], 3: ['craftfor', ''], 4: ['giftto', ''], 5: ['go', 'status'], 6: ['sleep'] };
  const HOTKEY_TARGET = { 1: 'shop', 2: 'gather', 3: 'craft', 4: 'gift', 5: 'status' }; // 已在該畫面就不重開（免得清掉調合／送禮的選擇）
  const SUB_SCREENS = new Set(['shop', 'gather', 'craft', 'gift', 'status', 'sutra']);
  const HOTKEY_SCREENS = new Set(['home', ...SUB_SCREENS]);

  // Esc（非對話）：關彈出視窗（鎖定視窗如金縷衣無效）；結果單與交貨／送禮結果頁＝回炎洗宮；子畫面＝回主畫面
  function escBack() {
    if (modal) { if (!modal.lock) act('closemodal'); return; }
    if (screen === 'gather' && gatherResult) { act('gatherdone', 'home'); return; }
    if (screen === 'craft' && craftResult && craftSel.stage === 5) { act('craftdone', 'home'); return; }
    if (screen === 'craft' && craftSel.stage > 1) return; // 下鍋後不能中途退出
    if (screen === 'result') { act('resultdone'); return; }
    if (SUB_SCREENS.has(screen)) act('go', 'home');
  }

  // 單一鍵盤處理器：M 靜音、對話（推進／略過）、方向鍵游標、Esc 返回、數字快捷鍵、Enter（Shift 切倍速另外監聽，見下）
  document.addEventListener('keydown', (e) => {
    if (busy || gatherScene) return; // 地下城沿用自己的按鍵
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if ((k === 'm' || k === 'M') && !e.repeat) {
      e.preventDefault();
      if (dlg) A.toggleMute(); else act('mute'); // 對話中不重繪，免得目前這句重新打字
      return;
    }
    if (dlg && dlg.lines[dlg.i][3] && dlg.lines[dlg.i][3].choice) {
      // 選項那一句：方向鍵換、Enter／空白鍵確定（字還在打就先打完）；Esc 無效（不能跳過選擇）
      const ch = dlg.lines[dlg.i][3].choice;
      if (NAV_DIRS[k]) {
        e.preventDefault();
        dlg.pick = (dlg.pick + (k === 'ArrowLeft' || k === 'ArrowUp' ? ch.length - 1 : 1)) % ch.length;
        app.querySelectorAll('.dlg-choice').forEach((b, j) => b.classList.toggle('on', j === dlg.pick)); // 只換高亮，不重打字
        return;
      }
      if ((k === ' ' || k === 'Enter') && !e.repeat) { e.preventDefault(); if (typer) completeTyper(); else pickChoice(ch[dlg.pick][0]); return; }
      if (k === 'Escape') { e.preventDefault(); return; }
    }
    if (dlg) {
      if (k === ' ' || k === 'Enter') {
        e.preventDefault();
        if (!e.repeat) advanceDialog();
      } else if (k === 'Escape' && !e.repeat) {
        e.preventDefault();
        finishDialog(); // 略過整段：不受防連按影響
      }
      return;
    }
    // 四階段調合：撈泡泡的 1／2／3、起鍋的空白鍵由 js/craftflow.js 自己接；下鍋後不能用快捷鍵離開
    if (screen === 'craft' && craftSel.stage > 1 && HOTKEYS[k]) { e.preventDefault(); return; }
    if (NAV_DIRS[k]) {
      e.preventDefault();
      moveCursor(NAV_DIRS[k]);
      return;
    }
    if (k === 'Escape') {
      if (e.repeat) return;
      e.preventDefault();
      escBack();
      return;
    }
    if (HOTKEYS[k] && !e.repeat && HOTKEY_SCREENS.has(screen) && !app.querySelector('.sheet-layer')) {
      e.preventDefault();
      if (HOTKEY_TARGET[k] !== screen) act(...HOTKEYS[k]);
      return;
    }
    if (k === 'Enter') {
      if (e.repeat) { e.preventDefault(); return; }
      // 用 Tab 移到某顆按鈕時，Enter 交給瀏覽器按下那顆（跟空白鍵一致）
      const ae = document.activeElement;
      if (!cursor.on && ae && ae !== document.body && app.contains(ae) && ae.closest('[data-a]')) return;
      if (pressEnter()) e.preventDefault();
    }
  });
  // Shift 單獨按放＝切換對話速度（與其他鍵組合時不算）
  let shiftAlone = false;
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Shift') shiftAlone = false;
    else if (!e.repeat) shiftAlone = true;
  }, true);
  document.addEventListener('keyup', (e) => {
    if (e.key !== 'Shift') return;
    if (shiftAlone && !busy && !gatherScene) toggleSpeed();
    shiftAlone = false;
  });
  document.addEventListener('pointerdown', () => { shiftAlone = false; }, true);
  document.addEventListener('pointerdown', hideCursor, true);
  document.addEventListener('scroll', () => { if (cursor.on) syncCursor(); }, true);
  window.addEventListener('resize', () => { if (cursor.on) syncCursor(); });

  // ───────── 事件 ─────────
  const QUIET = new Set(['tile', 'adv', 'buy', 'gather', 'regather', 'enter', 'leavegather', 'dgquit', 'dgstay', 'cf', 'deliver', 'gift', 'noop', 'mute', 'bribe']);
  app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-a]');
    if (!el || el.disabled || busy) return;
    const a = el.dataset.a;
    const v = el.dataset.v;
    if (a === 'noop') { e.stopPropagation(); return; }
    act(a, v);
  });

  // 所有按鈕動作的單一入口：點擊與鍵盤快捷鍵都走這裡
  function act(a, v) {
    if (!QUIET.has(a)) A.sfx('click');
    switch (a) {
      case 'adv': advanceDialog(); break;
      case 'skip': finishDialog(); break;
      case 'speed': toggleSpeed(); break;
      case 'start': startGame(); break;
      case 'mute': A.toggleMute(); render(); break;
      case 'go': go(v); break;
      case 'goto': if (v === 'shop') go('shop'); else if (v === 'craft') openCraft(null); else go('gather'); break;
      case 'buy': buy(v); break;
      case 'sell': sell(v); break;
      case 'bribe': bribe(); break;
      case 'reject': rejectOrder(Number(v)); break;
      case 'gather': gather(v); break;
      case 'enter': enterGather(v); break;
      case 'leavegather': endGather('quit'); break;
      case 'dgquit': toggleDungeonConfirm(true); break;
      case 'dgstay': toggleDungeonConfirm(false); break;
      case 'regather': gatherResult = null; gather(v); break;
      case 'gatherdone': {
        if (!gatherResult) { go('home'); break; }
        const ready = gatherResult.ready[0];
        gatherResult = null;
        finishAction(() => (v === 'craft' && ready ? openCraft(ready.id) : go('home')));
        break;
      }
      case 'craftfor': openCraft(v ? Number(v) : null); break;
      case 'cf': break; // 調合模組的按鈕：js/craftflow.js 自己處理
      case 'craftdone': {
        const r = craftResult;
        if (!r) { go('home'); break; }
        craftResult = null;
        closeCraft();
        if (S.tutorial && S.tutorial.sayDeliver) { // 教學：做好了 → A28 再往下
          S.tutorial.sayDeliver = false;
          playDialog([D.TUT_DELIVER], () => act('craftdone2', v + '|' + (r.order ? r.order.id : '') + '|' + (r.itemId || '')));
          break;
        }
        if (v === 'proxy' && r.order) { doDeliver(r.order.id, r.itemId, 'proxy'); break; } // 代交不花時辰，不用先檢查天黑
        finishAction(() => (v === 'deliver' && r.order ? doDeliver(r.order.id, r.itemId) : go('home')));
        break;
      }
      case 'deliver': doDeliver(Number(v)); break;
      case 'craftdone2': { // 教學 A28 播完之後接回原本的「回宮／直接送去／代交」
        const [how, oid, iid] = v.split('|');
        if (how === 'proxy' && oid) { doDeliver(Number(oid), Number(iid) || null, 'proxy'); break; }
        finishAction(() => (how === 'deliver' && oid ? doDeliver(Number(oid), Number(iid) || null) : go('home')));
        break;
      }
      case 'proxy': doDeliver(Number(v), null, 'proxy'); break;
      case 'giftto': giftWho = v || (isTarget(S.flip) ? S.flip : null); go('gift'); break;
      case 'giftwho': giftWho = v; render(); break;
      case 'gift': doVisit(giftWho, v ? Number(v) : null); break;
      case 'resultdone': {
        // 第一次被禁足：回宮時包捐說明禁足能做什麼（G6–G8）
        if (grounded() && !S.seenGrounded) { S.seenGrounded = true; playDialog(D.FIRST_GROUNDED, () => finishAction(() => go('home'))); break; }
        finishAction(() => go('home'));
        break;
      }
      case 'spikeinfo': spikeInfo(v); break;
      case 'closemodal': modal = null; render(); break;
      case 'sleep': sleepEarly(); break;
      case 'sutra': openSutra(); break;
      case 'dlgchoice': pickChoice(v); break;
      case 'shoptab': shopTab = v; render(); break;
      case 'tile': pickTile(Number(v)); break;
      case 'sleepyes': modal = null; S.slot = R.slotsPerDay; endDay(); break;
      case 'sing': modal = null; settleNight(v === '1'); break;
      case 'next': nextDay(); break;
      case 'share': share(); break;
      case 'seal': { const t = D.TITLES.find((x) => x.id === v); const got = S.result.book.includes(v); toast(got ? `${t.name}：${t.comment}` : `？？？：${t.hint}`, 3200); break; }
    }
  }

  // 開場先在背景把圖片都載進快取，之後換畫面就不用等
  function preloadImages() {
    const files = [
      ...Object.values(D.CHARS).flatMap((c) => Object.values(c.imgs).map((f) => `characters/${f}`)),
      'characters/guard',
      ...[...Object.keys(D.ITEMS), ...Object.keys(D.PRODUCTS), 'silver'].map((id) => `items/${id}`),
      ...['yanxi', 'garden', 'taiyi', 'shop', 'yikun', 'xianfu', 'suiyu', 'night', 'study', 'workshop'].map((b) => `backgrounds/${b}`),
    ];
    [...new Set(files)].forEach((f) => { new Image().src = `assets/${f}.webp`; });
  }

  // 測試用：網址後面加 #結局 會直接跳到隨機的結局畫面（不影響正常遊戲）
  if (decodeURIComponent(location.hash) === '#結局') {
    S = E.newState(D);
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    D.ALL.forEach((w) => { S.favor[w] = 20 + Math.floor(Math.random() * 80); });
    D.TARGETS.forEach((t) => { S.friend[t] = Math.floor(Math.random() * 60); });
    Object.assign(S.stats, {
      spikesUsed: pick([0, 3, 6]), success: pick([0, 2, 4]), caught: pick([0, 1, 2]),
      victims: pick([[], ['huafei'], [...D.TARGETS]]), ruined: pick([[], ['meizhuang'], ['meizhuang', 'zhenhuan']]),
      sings: pick([0, 2]), bribes: pick([0, 1, 2]), junk: pick([0, 1]), births: pick([0, 1]), muskRuin: pick([0, 1]),
    });
    S.result = computeEnding(false);
    screen = 'ending';
  }
  // 測試用：網址後面加 #演出 顯示事件選單，#演出=<事件> 直接播該事件的對話＋結果頁（不影響正常遊戲）。
  // 走真的引擎（E.deliver／E.visit），只是先擺好對象狀態、用固定骰子，所以 S.result 與對話都跟正常遊玩一樣。
  const fxHash = decodeURIComponent(location.hash);
  if (fxHash === '#演出' || fxHash.startsWith('#演出=')) {
    const NO_CATCH = 0.999; // 抓包骰 ≥ 機率 → 沒被抓；送禮骰 ≥ 收禮機率 → 拒收
    // 事件 → [說明, 對象, 加料, 對象狀態, 骰子序列, 送禮?]
    const FX_DEMO = {
      cassava: ['上吐下瀉（輕）', 'huafei', 'cassava', null, [NO_CATCH]],
      catnip: ['貓咪鬧場（輕）', 'huafei', 'catnip', null, [NO_CATCH]],
      debuff_useless: ['木薯粉白下（不是今晚侍寢）', 'meizhuang', 'cassava', null, [NO_CATCH]],
      cats_night: ['夜晚貓咪鬧場（貓叫）', 'huafei', null, null, []],
      musk_dose: ['麝香 2/3（中）', 'zhenhuan', 'musk', { status: 'normal', musk: 1 }, [NO_CATCH]],
      musk_miss: ['麝香落空（中）', 'zhenhuan', 'musk', { status: 'pregnant', preg: 1, musk: 0 }, [NO_CATCH, NO_CATCH]],
      musk_infertile: ['麝香不孕（重）', 'meizhuang', 'musk', { status: 'normal', musk: 2 }, [NO_CATCH]],
      safflower_infertile: ['紅花不孕（重）', 'meizhuang', 'safflower', { status: 'normal' }, [NO_CATCH]],
      miscarry_musk: ['麝香小產（重）', 'zhenhuan', 'musk', { status: 'pregnant', preg: 1, musk: 0 }, [NO_CATCH, 0]],
      miscarry_safflower: ['紅花小產（重）', 'zhenhuan', 'safflower', { status: 'pregnant', preg: 1 }, [NO_CATCH]],
      musk_useless: ['麝香白下（一般）', 'meizhuang', 'musk', { status: 'infertile' }, [NO_CATCH]],
      safflower_useless: ['紅花白下（一般）', 'meizhuang', 'safflower', { status: 'infertile' }, [NO_CATCH]],
      plain: ['收下（一般）', 'huafei', null, null, []],
      refused: ['拒收（一般）', 'huafei', null, null, [NO_CATCH], true],
      caught: ['被抓（重＋暗幕）', 'huafei', 'cassava', null, [0]],
    };
    window.addEventListener('hashchange', () => location.reload()); // 選單連結換 hash → 重新播
    const key = fxHash.slice('#演出='.length);
    S = E.newState(D);
    screen = 'home';
    if (fxHash === '#演出') {
      screen = 'title';
      modal = {
        lock: true,
        title: '演出測試',
        body: `<div class="row-btns" style="flex-wrap:wrap">${Object.entries(FX_DEMO).map(([k, [label]]) => `<a class="btn ghost" href="#演出=${k}">${label}</a>`).join('')}</div>`,
      };
    } else if (!Object.hasOwn(FX_DEMO, key)) {
      S = null;
      screen = 'title'; // 未知事件 → 回標題頁
    } else {
      const [, who, spike, conc, dice, viaGift] = FX_DEMO[key];
      if (conc) Object.assign(S.conc[who], conc);
      S.flip = key === 'debuff_useless' ? 'huafei' : who; // 木薯粉、貓薄荷只對當晚侍寢的人有效
      const seq = [...dice];
      const demoRand = () => (seq.length ? seq.shift() : NO_CATCH);
      const product = 'incense';
      S.hand.push({ id: 'fxdemo', product, spike });
      let r;
      if (viaGift) {
        r = E.visit(D, S, who, 'fxdemo', demoRand);
      } else {
        S.orders.push({ id: 'fxdemo', who, product, due: S.day + 1 });
        r = E.deliver(D, S, 'fxdemo', 'fxdemo', demoRand);
      }
      const lines = key === 'cats_night'
        ? [D.CATS_LINE, ['huangshang', '_', D.SERVE_FAIL_HS.catnip], ['narr', '', D.SERVE_FAIL.catnip.replace('{n}', charName(who))]]
        : r.refused ? D.REFUSE[who] : outcomeLines(who, spike, r);
      dlg = { lines, i: 0, done: () => go('result'), bg: key === 'cats_night' ? 'night' : D.CHARS[who].bg };
    }
  }
  // 測試用：網址後面加 #e2e 時開放狀態給 tools/keyboard-e2e.js 造情境（不影響正常遊戲）
  // 試玩用：網址後面加 #抄經，直接開一局、禁足中、進抄經小遊戲（不用等被抓）
  if (decodeURIComponent(location.hash) === '#抄經') {
    S = E.newState(D);
    S.groundUntil = S.day + 1;
    screen = 'home';
    setTimeout(openSutra, 0);
  }
  if (location.hash === '#e2e') {
    window.__e2e = { state: () => S, screen: () => screen, gather: () => gatherScene, sutra: () => sutra, render, go, openCraft, playDialog };
  }
  // 標題曲：一打開就試著播；瀏覽器擋下（還沒點過畫面）時，標題頁顯示「點一下畫面播放音樂」，
  // 第一次點擊或按鍵就開始播。assets/audio/bgm_title.lite.mp3 沒有就播主題曲
  const titleBgm = () => {
    if (screen !== 'title' || dlg) return;
    A.unlock();
    A.playBgm('title', 'main');
    app.querySelector('.music-hint')?.remove();
  };
  if (screen === 'title' && !A.isMuted()) {
    A.playBgm('title', 'main');
    setTimeout(() => { if (screen === 'title' && !A.isPlaying() && !A.isMuted()) { const t = app.querySelector('.title-screen'); if (t && !t.querySelector('.music-hint')) t.insertAdjacentHTML('beforeend', '<div class="music-hint">♪ 點一下畫面播放音樂</div>'); } }, 600);
  }
  document.addEventListener('pointerdown', titleBgm, { once: true, capture: true });
  document.addEventListener('keydown', titleBgm, { once: true, capture: true });
  render();
  preloadImages();
})();
