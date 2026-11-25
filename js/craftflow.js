// 四階段調合流程（選素材 → 撈泡泡 → 加料 → 起鍋）：獨立模組，遊戲（js/game.js）和試玩台（craft-lab.html）共用。
// 包捐全程在旁邊幫忙：捧素材、顧火搧火、窗邊把風、端碗等起鍋。第二階段用 BubbleGame（js/bubblegame.js）。
// 模組不改遊戲狀態：讀呼叫端給的素材份，最後把選擇交給 cook()，由呼叫端扣素材、做成品，再顯示回傳的結果。
// 按鈕一律帶 data-a="cf"（＋data-def 標預設），遊戲的鍵盤游標就能直接用；遊戲那邊的 act('cf') 什麼都不做。
//
// const f = CraftFlow.mount(el, {
//   D, E,                              // GAME_DATA、GameEngine
//   stock: { inv: { id: n }, lots: [{ uid, id, tr }] },   // 遊戲直接給 S
//   spikes: [{ id, n, note?, cls?, sub? }],               // 料：n＝手上幾份；note／cls＝右側小標（預測）；sub＝說明
//   forProduct, forWho,                // 從訂單點進來：先翻到這道配方；forWho＝娘娘的名字（台詞用）
//   quick, onQuick(on),                // 快速調合（跳過二、四階段）與切換時的通知
//   tutorial,                          // 教學模式：改用 A24–A27
//   firstSpike, onSeen(kind),          // 第一次加料要不要播 G1–G3；播過時通知 onSeen('spike')
//   bubble,                            // BubbleGame 參數
//   cook(sel) → { product, traits, spike, toInv, lostSpike },   // 結果由呼叫端算（遊戲：E.craft）
//   actions(res) → [{ a, v, label, primary, def }],             // 結果畫面的按鈕（遊戲自己的 data-a）
//   onStep(step), onRender(),          // 換階段、重畫後通知（遊戲用來鎖返回鍵、重畫游標）
//   img(who) / itemImg(id) / sfx(name, arg) / rand,
// });  回傳 { destroy(), step() }
window.CraftFlow = (() => {
  const NAMES = { baojuan: '包捐', lingrong: '零溶' };
  const STEPS = ['選素材', '撈泡泡', '加料', '起鍋'];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];

  // 台詞定稿（2026-11-25）：編號對照 docs/round2/lines-review.html 的 M 組；同一格有好幾句的，每次隨機挑一句
  const LINES = {
    book: [['baojuan', '小主今天想做什麼？配方都在這兒，缺什麼奴婢也寫上了。']], // M1
    order: [['baojuan', '{w}娘娘要的{p}，奴婢把配方翻好了。']], // M2
    recipe: [['baojuan', '{p}要{m}。每樣挑一份，奴婢捧上來。']], // M3
    lotGood: [['baojuan', '這份是小主親手採的，{t}足得很！']], // M4
    lotPlain: [['baojuan', '小舖買的，普普通通。']], // M5
    ready: [['baojuan', '齊了！小主，下鍋吧。']], // M6
    free: [['lingrong', '不看配方，憑感覺。'], ['baojuan', '小主……奴婢有點怕。']], // M7→M8（依序）
    spikeAsk: [['baojuan', '接下來……小主還要加點什麼嗎？']], // M19
    spikeFirst: [['baojuan', '小、小主……您這是要加……？'], ['lingrong', '噓。'], ['baojuan', '……奴婢什麼都沒看見。不過溫太醫的眼睛可利了。跟娘娘交情越好，她越不會起疑；東西越香、越甜、越濃，也越蓋得住味道。']], // G1→G3（依序，只有第一次）
    spikePick: [['lingrong', '嘿嘿……'], ['baojuan', '……奴婢去窗邊看看有沒有人。']], // M20→M21（依序）
    spikeGo: [['baojuan', '（窗邊）沒人沒人，快！']], // M22
    spikeNo: [['baojuan', '今天做個乾淨的，奴婢放心多了。']], // M23
    finish: [['baojuan', '奴婢端碗等著。小主看準了再收火！']], // M24
    up: [['baojuan', '金色！升了！']], // M25
    keep: [['baojuan', '穩穩的，不好不壞。']],
    down: [['baojuan', '哎呀，火候過了……']],
    done: [['baojuan', '出鍋了！{p}，香得奴婢口水都要流下來了。']], // M26
    doneSpiked: [['baojuan', '這碗……奴婢就不嚐了。']], // M27
    junk: [['baojuan', '這……是吃的嗎？'], ['lingrong', '……就當作是新口味吧。']], // M28→M29（依序）
    toInv: [['lingrong', '呵呵……這可是猛藥。']],
    // 教學模式改用這幾句（A24、A26、A27；A25 給撈泡泡模組）
    tutBook: [['baojuan', '先從配方冊挑一道，每樣素材挑一份。採集來的會帶特性，比小舖買的好。']],
    tutSpike: [['baojuan', '這一步可以加點「料」……不過這份是給真環娘娘的訂單，今天就先正正經經吧。']],
    tutFinish: [['baojuan', '起鍋！珠珠停在金色，特性升一級；停在紅色，就降一級。']],
  };
  const TUT_BUBBLE = [['baojuan', '開火了！鍋裡會冒泡泡，挑想要的顏色撈三顆。金邊的一抵二，黑的是焦泡，別撈！']]; // A25
  const SEQ = new Set(['free', 'spikeFirst', 'spikePick', 'junk']); // 這幾組是一句接一句講，不是隨機挑

  function mount(el, o) {
    const { D, E } = o;
    const rand = o.rand || Math.random;
    const sfx = o.sfx || (() => {});
    const img = o.img || (() => null);
    const itemImg = o.itemImg || (() => null);
    const R = D.RULES.craft;
    const st = {
      step: 1, product: null, free: false, freeMats: [], lots: {}, spike: null, stirs: [], zone: null, quick: !!o.quick,
      bubble: null, raf: 0, beadT0: 0, sayTimers: [], lastSay: null, res: null, destroyed: false,
    };

    // ── 小工具 ──
    const B = (v, extra = '') => `data-a="cf" data-v="${esc(v)}"${extra}`;
    const DEF = (on) => (on ? ' data-def' : '');
    const trName = (t) => D.TRAITS[t].name;
    const chip = (t, lv) => `<span class="cf-tr" style="--c:${D.TRAITS[t].color}">${esc(trName(t))}<i>${'●'.repeat(lv)}${'○'.repeat(Math.max(0, 3 - lv))}</i></span>`;
    const chips = (tr, empty = '') => {
      const e = Object.entries(tr || {}).sort((a, b) => b[1] - a[1]);
      return e.length ? e.map(([t, v]) => chip(t, v)).join('') : empty;
    };
    const tok = (id, big) => {
      const it = D.ITEMS[id] || D.PRODUCTS[id];
      const src = itemImg(id);
      return `<span class="cf-tok${big ? ' big' : ''}${id === 'junk' ? ' junk' : ''}">${src ? `<img src="${esc(src)}" alt="" onerror="this.remove()">` : ''}<b>${esc(it.ch)}</b></span>`;
    };
    const face = (who) => { const s = img(who); return s ? `<img src="${esc(s)}" alt="${NAMES[who]}">` : `<span>${NAMES[who][0]}</span>`; };
    const inv = (id) => o.stock.inv[id] || 0;
    const lotsOf = (id) => o.stock.lots.filter((l) => l.id === id);
    const sum = (tr) => Object.values(tr || {}).reduce((a, b) => a + b, 0);
    const mats = () => (st.free ? st.freeMats : st.product ? D.PRODUCTS[st.product].recipe : []);
    const lotTr = (i) => { const u = st.lots[i]; if (!u) return {}; const l = o.stock.lots.find((x) => x.uid === u); return l ? l.tr : {}; };
    const potNow = () => E.potTraits(D, mats().map((_, i) => lotTr(i)));
    const allPicked = () => mats().length >= 2 && mats().every((_, i) => st.lots[i] != null);
    const result = () => (mats().length >= 2 ? E.findRecipe(D, mats()) : null);
    const cooking = () => { const r = result(); return r && !D.PRODUCTS[r].out; }; // 走完四階段的才算（配錯、煉紅花直接出鍋）
    const need = (pid) => {
      const cnt = {};
      D.PRODUCTS[pid].recipe.forEach((m) => { cnt[m] = (cnt[m] || 0) + 1; });
      return Object.entries(cnt).filter(([m, n]) => inv(m) < n).map(([m]) => m);
    };
    // 第 i 格能選哪幾份：一般份（uid 0，還有剩才列）＋各份帶特性的（別格選走的不列）
    function options(i) {
      const m = mats()[i];
      const used = Object.entries(st.lots).filter(([j]) => Number(j) !== i && mats()[j] === m).map(([, u]) => u);
      const plainLeft = inv(m) - lotsOf(m).length - used.filter((u) => u === 0).length;
      const out = plainLeft > 0 ? [{ uid: 0, tr: {}, left: plainLeft }] : [];
      lotsOf(m).filter((l) => !used.includes(l.uid)).sort((a, b) => sum(b.tr) - sum(a.tr)).forEach((l) => out.push(l));
      return out;
    }
    // 只有一種選擇的格子直接放好
    function autoFill() {
      mats().forEach((_, i) => { if (st.lots[i] == null) { const op = options(i); if (op.length === 1) st.lots[i] = op[0].uid; } });
    }

    function clearSay() { st.sayTimers.forEach(clearTimeout); st.sayTimers = []; }
    function show(who, text) {
      const box = el.querySelector('.cf-say');
      if (!box) return;
      box.hidden = false;
      box.className = `cf-say who-${who}`;
      box.innerHTML = `<b>${NAMES[who]}</b><span>${esc(text)}</span>`;
      box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
    }
    // 說一句（或依序說一串）；換畫面重畫後會補上最後一句
    function say(kind, vars = {}) {
      clearSay();
      const fill = (t) => t.replace(/\{(\w)\}/g, (_, k) => vars[k] ?? '');
      const lines = SEQ.has(kind) ? LINES[kind] : [pick(LINES[kind], rand)];
      let at = 0;
      lines.forEach(([who, text]) => {
        const t = fill(text);
        st.sayTimers.push(setTimeout(() => { st.lastSay = [who, t]; show(who, t); }, at));
        at += Math.max(1300, t.length * 75);
      });
      return at;
    }
    function reSay() { if (st.lastSay) show(...st.lastSay); }

    // ── 版面 ──
    function frame(inner, panel, cta) {
      const skip = (i) => st.quick && (i === 1 || i === 3);
      el.innerHTML = `<div class="cf">
        <ol class="cf-steps">${STEPS.map((t, i) => `<li class="${skip(i) ? 'skip' : i + 1 === st.step ? 'on' : i + 1 < st.step ? 'done' : ''}"><b>${i + 1}</b>${t}</li>`).join('')}</ol>
        ${inner}
        <div class="cf-panel">${panel}</div>
        ${cta ? `<div class="cf-cta">${cta}</div>` : ''}
      </div>`;
      reSay();
      if (o.onRender) o.onRender();
    }
    function stage(extra = '', cls = '') {
      const pot = potNow();
      const ms = mats();
      const slots = st.free ? [0, 1, 2] : ms.map((_, i) => i);
      const preview = st.step === 1 && st.free && ms.length >= 2 ? `<div class="cf-preview">${result() ? `→ ${esc(D.PRODUCTS[result()].name)}` : '→ ？？？（好像不太對）'}</div>` : '';
      return `<div class="cf-stage ${cls}">
        <div class="cf-pot">
          <div class="cf-soup" style="${soup(pot)}"></div>
          <div class="cf-pot-mats">${slots.map((i) => {
            const m = ms[i];
            if (!m) return `<span class="cf-slot">${i === 2 ? '可不放' : '素材'}</span>`;
            if (st.free && st.step === 1) return `<button type="button" class="cf-slot-btn" ${B(`unmat:${i}`)} aria-label="拿掉${esc(D.ITEMS[m].name)}">${tok(m)}</button>`;
            return st.lots[i] != null ? `<span class="cf-drop" style="animation-delay:${i * 0.12}s">${tok(m)}</span>` : `<span class="cf-slot">${esc(D.ITEMS[m].name)}</span>`;
          }).join('')}</div>
          <div class="cf-pot-trs">${chips(pot)}</div>
          ${preview}
        </div>
        <div class="cf-helper">${face('baojuan')}</div>
        <div class="cf-say" hidden></div>
        ${extra}
      </div>`;
    }
    function soup(tr) {
      const e = Object.entries(tr || {});
      if (!e.length) return '';
      const tot = e.reduce((a, [, v]) => a + v, 0);
      let acc = 0;
      return `background: conic-gradient(from 90deg, ${e.map(([t, v]) => { const a = acc; acc += v; return `${D.TRAITS[t].color} ${(a / tot) * 100}% ${(acc / tot) * 100}%`; }).join(',')})`;
    }
    const quickToggle = () => `<button type="button" class="cf-quick${st.quick ? ' on' : ''}" ${B('quick')} role="switch" aria-checked="${st.quick}"><i></i>快速調合<small>跳過撈泡泡與起鍋</small></button>`;

    function setStep(n) { st.step = n; if (o.onStep) o.onStep(n); }

    // ── 一：選素材 ──
    function step1() {
      setStep(1);
      let panel = '';
      let defDone = false;
      const def = () => { if (defDone) return ''; defDone = true; return ' data-def'; };
      if (!st.product && !st.free) {
        const list = Object.entries(D.PRODUCTS).filter(([, p]) => p.recipe);
        panel = `<div class="cf-row"><h3>配方冊</h3>${quickToggle()}</div><div class="cf-book">${list.map(([pid, p]) => {
          const miss = need(pid);
          return `<button type="button" class="cf-recipe" ${B(`recipe:${pid}`)}${miss.length ? ' disabled' : def()}>
            ${tok(pid)}<span class="cf-main"><b>${esc(p.name)}</b><small>${p.recipe.map((m) => esc(D.ITEMS[m].name)).join(' ＋ ')}</small></span>
            ${miss.length ? `<span class="cf-pill miss">缺${miss.map((m) => esc(D.ITEMS[m].name)).join('、')}</span>` : `<span class="cf-pill ok">${p.out ? '進道具欄' : '可以做'}</span>`}
          </button>`;
        }).join('')}</div><button type="button" class="cf-link" ${B('free')}>不看配方，自由調合</button>`;
      } else {
        if (st.free) {
          const owned = Object.keys(D.ITEMS).filter((id) => D.ITEMS[id].type === 'mat' && inv(id) > 0);
          const avail = (id) => inv(id) - st.freeMats.filter((m) => m === id).length;
          panel += `<div class="cf-row"><h3>自由調合</h3>${quickToggle()}</div><p class="cf-note">放兩、三樣素材；點鍋上的素材可以拿掉。</p>
            <div class="cf-grid">${owned.map((id) => `<button type="button" class="cf-mat-btn" ${B(`mat:${id}`)}${avail(id) <= 0 || st.freeMats.length >= 3 ? ' disabled' : st.freeMats.length < 2 ? def() : ''}>${tok(id)}<span>${esc(D.ITEMS[id].name)}</span><small>×${avail(id)}</small></button>`).join('')}</div>`;
        }
        if (mats().length) {
          panel += `<div class="cf-row"><h3>每樣挑一份</h3>${st.free ? '' : quickToggle()}</div>${mats().map((m, i) => {
            const opts = options(i);
            return `<div class="cf-mat"><div class="cf-mat-h">${tok(m)}<b>${esc(D.ITEMS[m].name)}</b></div><div class="cf-lots">${opts.map((l) => {
              const on = st.lots[i] === l.uid;
              return `<button type="button" class="cf-lot${on ? ' on' : ''}" ${B(`lot:${i}:${l.uid}`)}${st.lots[i] == null && !on ? def() : ''}>
                <small>${l.uid === 0 ? `一般份・剩 ${l.left}` : '採集來的'}</small>
                <span class="cf-trs">${chips(l.tr, '<small class="cf-none">沒有特性</small>')}</span>
              </button>`;
            }).join('')}</div></div>`;
          }).join('')}`;
        }
        panel += `<button type="button" class="cf-link" ${B('book')}>${st.free ? '回配方冊' : '換一道配方'}</button>`;
      }
      const ok = allPicked();
      const label = ok ? (cooking() ? '下鍋！' : result() ? '下鍋！（直接完成）' : '下鍋……？') : st.product || st.free ? (mats().length < 2 ? '放兩、三樣素材' : '每樣挑一份才能下鍋') : '先挑一道配方';
      frame(stage(), panel, `<button type="button" class="cf-btn" ${B('cook')}${ok ? DEF(!defDone) : ' disabled'}>${label}</button>`);
    }

    // ── 二：撈泡泡 ──
    function step2() {
      setStep(2);
      if (st.quick) { st.stirs = []; step3(true); return; }
      clearSay();
      st.lastSay = null;
      frame('<div class="cf-bubble"></div>', `<p class="cf-note">鍋裡現在：${chips(potNow(), '（沒有特性）')}</p>`, '');
      st.bubble = window.BubbleGame.mount(el.querySelector('.cf-bubble'), {
        traits: D.TRAITS, pot: potNow(), cfg: o.bubble, rand, sfx, img,
        lines: o.tutorial ? { intro: TUT_BUBBLE } : null,
        onDone: (r) => { st.stirs = r.stirs; st.bubble = null; setTimeout(() => { if (!st.destroyed) step3(true); }, 200); },
      });
    }

    // ── 三：加料 ──
    function step3(enter) {
      setStep(3);
      const tr = E.finalTraits(D, mats().map((_, i) => lotTr(i)), st.stirs);
      const list = (o.spikes || []).filter((s) => D.ITEMS[s.id]);
      const next = st.quick ? '完成' : '準備起鍋';
      // 料排成格子（原本一列一列很長）；說明只顯示選到的那個
      const sel = list.find((x) => x.id === st.spike);
      frame(stage(`<div class="cf-window"><i></i></div>${st.spike ? '<div class="cf-hehe">嘿嘿……</div>' : ''}`, `lookout${st.spike ? ' armed' : ''}`),
        `<h3>要加料嗎？</h3><div class="cf-sgrid">
          <button type="button" class="cf-scell${!st.spike ? ' on' : ''}" ${B('spike:')}><span class="cf-tok none"><b>無</b></span><b>不加料</b><small>正正經經</small></button>
          ${list.map((x) => `<button type="button" class="cf-scell${st.spike === x.id ? ' on' : ''}" ${B(`spike:${x.id}`)}${x.n ? '' : ' disabled'}>${tok(x.id)}<b>${esc(D.ITEMS[x.id].name)}${x.n != null ? `<small class="cf-n"> ×${x.n}</small>` : ''}</b>${x.note ? `<small class="cf-snote ${esc(x.cls || '')}">${esc(x.note)}</small>` : ''}</button>`).join('')}
        </div>
        <p class="cf-note cf-sdesc">${sel ? esc(sel.sub || D.ITEMS[sel.id].desc || '') : '目前的特性：'}${sel ? '' : chips(tr, '（沒有特性）')}</p>`,
        `<button type="button" class="cf-btn" ${B('go4')} data-def>${st.spike ? `偷偷撒進去，${next}` : `就這樣，${next}`}</button>`);
      if (enter) say(o.tutorial ? 'tutSpike' : 'spikeAsk');
    }

    // ── 四：起鍋 ──
    function step4() {
      setStep(4);
      if (st.quick) { st.zone = null; finishCook(); return; }
      const tr = E.finalTraits(D, mats().map((_, i) => lotTr(i)), st.stirs);
      const order = Object.keys(D.TRAITS);
      const top = Object.keys(tr).sort((a, b) => tr[b] - tr[a] || order.indexOf(a) - order.indexOf(b))[0];
      st.lastSay = null;
      st.zones = E.jitterZones ? E.jitterZones(rand) : R.zones; // 升降區每次浮動
      frame(stage('<div class="cf-bowl"></div>', 'bowl'),
        `<h3>起鍋</h3><p class="cf-note">${top ? `停在金色，<b>${esc(trName(top))}</b>升一級；停在紅色，降一級。` : '鍋裡沒有特性，隨便收火就好。'}</p>
         <div class="cf-bar" ${B('stop')}>${st.zones.map(([w, z]) => `<span class="${z}" style="width:${w}%">${z === 'up' ? '升' : z === 'down' ? '降' : ''}</span>`).join('')}<i class="cf-bead"></i></div>
         <div class="cf-verdict"></div>`,
        `<button type="button" class="cf-btn" ${B('stop')} data-def>收火！（點畫面任何地方或空白鍵）</button>`);
      say(o.tutorial ? 'tutFinish' : 'finish');
      st.beadT0 = performance.now();
      const loop = (now) => {
        if (st.zone || st.step !== 4 || st.destroyed) return;
        const bead = el.querySelector('.cf-bead');
        if (bead) bead.style.left = `${beadPos(now)}%`;
        st.raf = requestAnimationFrame(loop);
      };
      st.raf = requestAnimationFrame(loop);
    }
    function beadPos(now) { const p = ((now - st.beadT0) % R.beadMs) / R.beadMs; return p < 0.5 ? p * 200 : 200 - p * 200; }
    function stopBead() {
      if (st.step !== 4 || st.zone) return;
      cancelAnimationFrame(st.raf);
      const pos = beadPos(performance.now());
      st.zone = E.finishZone(D, pos, st.zones);
      const bead = el.querySelector('.cf-bead');
      if (bead) { bead.style.left = `${pos}%`; bead.classList.add('hit'); }
      const v = el.querySelector('.cf-verdict');
      if (v) { v.className = `cf-verdict ${st.zone}`; v.textContent = st.zone === 'up' ? '升一級！' : st.zone === 'down' ? '降一級……' : '維持'; }
      el.querySelectorAll('[data-v="stop"]').forEach((b) => { if (b.tagName === 'BUTTON') b.disabled = true; });
      sfx(st.zone === 'up' ? 'ding' : st.zone === 'down' ? 'fail' : 'pop');
      say(st.zone);
      st.sayTimers.push(setTimeout(() => { if (!st.destroyed) finishCook(); }, 1300));
    }

    // ── 出鍋：交給呼叫端算成品，再顯示 ──
    function finishCook() {
      const sel = { mats: mats().slice(), lots: mats().map((_, i) => (st.lots[i] != null ? st.lots[i] : null)), stirs: st.stirs, spike: cooking() ? st.spike : null, finish: st.zone };
      const r = o.cook ? o.cook(sel) : null;
      st.res = r || { product: result() || 'junk', traits: E.finalTraits(D, sel.lots.map((_, i) => lotTr(i)), st.stirs, st.zone), spike: sel.spike };
      setStep(5);
      const res = st.res;
      const p = D.PRODUCTS[res.product];
      const acts = o.actions ? o.actions(res) : [{ a: 'cf', v: 'again', label: '收下', primary: true, def: true }];
      clearSay();
      st.lastSay = null;
      el.innerHTML = `<div class="cf"><div class="cf-stage done${res.product === 'junk' ? ' junk' : ''}">
          <div class="cf-steam"></div><div class="cf-result">${tok(res.product, true)}<b>${esc(p.name)}</b>
          ${res.toInv ? '<small class="cf-spiked">進了道具欄</small>' : `<div class="cf-trs">${chips(res.traits, res.product === 'junk' ? '' : '<small>沒有特性</small>')}</div>`}
          ${res.spike ? `<small class="cf-spiked">（加了${esc(D.ITEMS[res.spike].name)}）</small>` : ''}
          ${res.lostSpike ? `<small class="cf-spiked">${esc(D.ITEMS[res.lostSpike].name)}也一起燒掉了</small>` : ''}</div>
          <div class="cf-helper">${face('baojuan')}</div><div class="cf-say" hidden></div>
        </div>
        <div class="cf-cta cf-acts">${acts.map((x) => `<button type="button" class="cf-btn${x.primary ? '' : ' ghost'}" data-a="${esc(x.a)}" data-v="${esc(x.v || '')}"${DEF(x.def)}>${esc(x.label)}</button>`).join('')}</div></div>`;
      if (o.onRender) o.onRender();
      if (res.product === 'junk') { sfx('boom'); say('junk'); } else if (res.toInv) { sfx('evil'); say('toInv'); } else {
        sfx(res.spike ? 'evil' : 'ding');
        say(res.spike ? 'doneSpiked' : 'done', { p: p.name });
      }
    }

    // ── 事件 ──
    function onClick(e) {
      const b = e.target.closest('[data-a="cf"]');
      if (!b || b.disabled || !el.contains(b)) return;
      const [act, x, y] = b.dataset.v.split(':');
      switch (act) {
        case 'recipe':
          st.product = x; st.free = false; st.lots = {};
          autoFill();
          sfx('click'); step1();
          say('recipe', { p: D.PRODUCTS[x].name, m: D.PRODUCTS[x].recipe.map((m) => D.ITEMS[m].name).join('、') });
          break;
        case 'free': st.free = true; st.product = null; st.freeMats = []; st.lots = {}; sfx('click'); step1(); say('free'); break;
        case 'book': st.free = false; st.product = null; st.freeMats = []; st.lots = {}; step1(); say(o.tutorial ? 'tutBook' : 'book'); break;
        case 'mat': if (st.freeMats.length < 3) { st.freeMats.push(x); st.lots = {}; autoFill(); sfx('pop'); step1(); } break;
        case 'unmat': st.freeMats.splice(Number(x), 1); st.lots = {}; autoFill(); step1(); break;
        case 'lot': {
          const i = Number(x);
          st.lots[i] = Number(y);
          autoFill();
          sfx('pop'); step1();
          const tr = lotTr(i);
          if (allPicked()) say('ready');
          else if (sum(tr) >= 2) say('lotGood', { t: trName(Object.keys(tr).sort((a, c) => tr[c] - tr[a])[0]) });
          else if (!sum(tr)) say('lotPlain');
          break;
        }
        case 'quick': st.quick = !st.quick; if (o.onQuick) o.onQuick(st.quick); step1(); break;
        case 'cook':
          if (!allPicked()) break;
          if (!cooking()) { finishCook(); break; } // 配錯或煉紅花：直接出鍋
          sfx('bubble'); step2();
          break;
        case 'spike': {
          const prev = st.spike;
          st.spike = x || null;
          step3();
          if (st.spike && !prev) {
            sfx('evil');
            let at = 0;
            if (o.firstSpike) { at = say('spikeFirst'); o.firstSpike = false; if (o.onSeen) o.onSeen('spike'); }
            const t = setTimeout(() => { if (st.step === 3 && st.spike) say('spikePick'); }, at);
            if (at) st.sayTimers.push(t);
          } else if (!st.spike) say('spikeNo');
          break;
        }
        case 'go4':
          if (!st.spike) { step4(); break; }
          // 包捐在窗邊喊沒人，料撒進鍋，再起鍋
          say('spikeGo');
          el.querySelectorAll('[data-a="cf"]').forEach((x) => { x.disabled = true; });
          el.querySelector('.cf-stage')?.insertAdjacentHTML('beforeend', `<span class="cf-pour">${tok(st.spike)}</span>`);
          sfx('pop');
          st.sayTimers.push(setTimeout(() => { if (!st.destroyed) step4(); }, 1100));
          break;
        case 'stop': stopBead(); break;
        case 'again': break; // 試玩台用：交給呼叫端
        default: break;
      }
    }
    // 起鍋：點畫面任何地方都能停珠珠
    function onTapAnywhere(e) {
      if (st.step !== 4 || st.zone || st.destroyed) return;
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      stopBead();
    }
    function onKey(e) {
      if (st.step === 4 && !st.zone && (e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); e.stopPropagation(); stopBead(); }
    }
    el.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onTapAnywhere, true);

    // 開場：從訂單進來就直接翻到那道配方
    if (o.forProduct && D.PRODUCTS[o.forProduct] && !need(o.forProduct).length) {
      st.product = o.forProduct;
      autoFill();
      step1();
      if (o.tutorial) say('tutBook'); else say('order', { w: o.forWho || '', p: D.PRODUCTS[o.forProduct].name });
    } else {
      step1();
      say(o.tutorial ? 'tutBook' : 'book');
    }

    return {
      step: () => st.step,
      destroy() {
        st.destroyed = true;
        clearSay();
        cancelAnimationFrame(st.raf);
        if (st.bubble) st.bubble.destroy();
        document.removeEventListener('keydown', onKey, true);
        document.removeEventListener('pointerdown', onTapAnywhere, true);
        el.removeEventListener('click', onClick);
        el.innerHTML = '';
      },
    };
  }

  return { mount, LINES };
})();
