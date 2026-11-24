// 四階段調合流程（選素材 → 撈泡泡 → 加料 → 起鍋）：獨立模組，遊戲和試玩台（craft-lab.html）共用。
// 包捐全程在旁邊幫忙：捧素材、顧火搧火、窗邊把風、端碗等起鍋。第二階段用 BubbleGame（js/bubblegame.js）。
// 不碰遊戲狀態：呼叫端給「現在有哪些素材份」，結束時拿回選擇（craftSel 形狀），由呼叫端扣素材、做成品。
//
// const f = CraftFlow.mount(el, {
//   D, E,                         // GAME_DATA、GameEngine
//   stock: { inv: { id: n }, lots: [{ uid, id, tr, src? }] },   // src：'gather'|'shop'（顯示用，可省略）
//   spikes: ['musk', ...],        // 手上有的料
//   spikeNote(id) → 字串          // 加料那格的附註（例如被抓機率），可省略
//   quick: false,                 // 快速調合：跳過二、四階段
//   bubble: { ...BubbleGame 參數 },
//   img(who) / itemImg(id) / sfx(name, arg) / rand,
//   onDone({ product, mats, lots, stirs, spike, zone, traits }),  // 結果畫面按「收下」後呼叫
//   onExit(),                     // 還沒下鍋前按返回
// });  回傳 { destroy() }
window.CraftFlow = (() => {
  const NAMES = { baojuan: '包捐', lingrong: '零溶' };
  const STEPS = ['選素材', '撈泡泡', '加料', '起鍋'];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];

  const LINES = {
    book: [['baojuan', '小主今天想做什麼？配方都在這兒，缺什麼奴婢也寫上了。']],
    recipe: [['baojuan', '{p}要{m}。每樣挑一份，奴婢捧上來。']],
    lotGood: [['baojuan', '這份是小主親手採的，{t}足得很！'], ['baojuan', '好眼光，這份{t}最好。']],
    lotPlain: [['baojuan', '小舖買的，普普通通。'], ['baojuan', '這份沒什麼特別的，不過能用。']],
    ready: [['baojuan', '齊了！小主，下鍋吧。']],
    spikeAsk: [['baojuan', '小主……要不要加點料？奴婢去窗邊把風。']],
    spikePick: [['lingrong', '嘿嘿……'], ['lingrong', '就決定是你了。']],
    spikeGo: [['baojuan', '（窗邊）沒人沒人，快！']],
    spikeNo: [['baojuan', '今天做個乾淨的，奴婢放心多了。']],
    finish: [['baojuan', '奴婢端碗等著。小主看準了再收火！']],
    up: [['baojuan', '金色！升了！']],
    keep: [['baojuan', '穩穩的，不好不壞。']],
    down: [['baojuan', '哎呀，火候過了……']],
    done: [['baojuan', '出鍋了！{p}，香得奴婢口水都要流下來了。'], ['baojuan', '{p}做好了！小主好手藝。']],
    junk: [['baojuan', '這……是吃的嗎？'], ['lingrong', '……就當作是新口味吧。']],
  };

  function mount(el, o) {
    const { D, E } = o;
    const rand = o.rand || Math.random;
    const sfx = o.sfx || (() => {});
    const img = o.img || (() => null);
    const itemImg = o.itemImg || (() => null);
    const R = D.RULES.craft;
    const st = { step: 1, product: null, lots: {}, spike: null, stirs: [], zone: null, bubble: null, raf: 0, beadT0: 0, sayT: 0 };
    const keyH = (e) => onKey(e);
    document.addEventListener('keydown', keyH);

    // ── 小工具 ──
    const trName = (t) => D.TRAITS[t].name;
    const chip = (t, lv) => `<span class="cf-tr" style="--c:${D.TRAITS[t].color}">${esc(trName(t))}<i>${'●'.repeat(lv)}${'○'.repeat(Math.max(0, 3 - lv))}</i></span>`;
    const chips = (tr, empty = '') => {
      const e = Object.entries(tr || {}).sort((a, b) => b[1] - a[1]);
      return e.length ? e.map(([t, v]) => chip(t, v)).join('') : empty;
    };
    const tok = (id, big) => {
      const it = D.ITEMS[id] || D.PRODUCTS[id];
      const src = itemImg(id);
      return `<span class="cf-tok${big ? ' big' : ''}">${src ? `<img src="${esc(src)}" alt="" onerror="this.remove()">` : ''}<b>${esc(it.ch)}</b></span>`;
    };
    const face = (who) => { const s = img(who); return s ? `<img src="${esc(s)}" alt="${NAMES[who]}">` : `<span>${NAMES[who][0]}</span>`; };
    const lotsOf = (id) => o.stock.lots.filter((l) => l.id === id);
    const plainCount = (id) => (o.stock.inv[id] || 0) - lotsOf(id).length;
    const sum = (tr) => Object.values(tr || {}).reduce((a, b) => a + b, 0);
    const recipe = () => (st.product ? D.PRODUCTS[st.product].recipe : []);
    // 第 i 格挑的那份的特性（uid 0＝一般份）
    const lotTr = (i) => { const u = st.lots[i]; if (!u) return {}; const l = o.stock.lots.find((x) => x.uid === u); return l ? l.tr : {}; };
    const potNow = () => E.potTraits(D, recipe().map((_, i) => lotTr(i)));
    const allPicked = () => st.product && recipe().every((_, i) => st.lots[i] != null);
    const need = (pid) => {
      const cnt = {};
      D.PRODUCTS[pid].recipe.forEach((m) => { cnt[m] = (cnt[m] || 0) + 1; });
      return Object.entries(cnt).filter(([m, n]) => (o.stock.inv[m] || 0) < n).map(([m]) => m);
    };

    function say(kind, vars = {}) {
      const [who, text] = pick(LINES[kind], rand);
      const box = el.querySelector('.cf-say');
      if (!box) return;
      box.hidden = false;
      box.className = `cf-say who-${who}`;
      box.innerHTML = `<b>${NAMES[who]}</b><span>${esc(text.replace(/\{(\w)\}/g, (_, k) => vars[k] ?? ''))}</span>`;
      box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
    }

    // ── 版面：上面是步驟＋鍋（第二階段換成撈泡泡），下面是操作面板 ──
    function frame(inner, panel, cta) {
      const skip = (i) => o.quick && (i === 1 || i === 3);
      el.innerHTML = `<div class="cf">
        <ol class="cf-steps">${STEPS.map((t, i) => `<li class="${skip(i) ? 'skip' : i + 1 === st.step ? 'on' : i + 1 < st.step ? 'done' : ''}"><b>${i + 1}</b>${t}</li>`).join('')}</ol>
        ${inner}
        <div class="cf-panel">${panel}</div>
        ${cta ? `<div class="cf-cta">${cta}</div>` : ''}
      </div>`;
    }
    function stage(extra = '', cls = '') {
      const pot = st.step >= 2 ? potNow() : potNow();
      const mats = recipe();
      return `<div class="cf-stage ${cls}">
        <div class="cf-pot">
          <div class="cf-soup" style="${soup(pot)}"></div>
          <div class="cf-pot-mats">${mats.map((m, i) => (st.lots[i] != null ? `<span class="cf-drop" style="animation-delay:${i * 0.12}s">${tok(m)}</span>` : `<span class="cf-slot">${esc(D.ITEMS[m].name)}</span>`)).join('')}</div>
          <div class="cf-pot-trs">${chips(pot)}</div>
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

    // ── 一：選素材 ──
    function step1() {
      st.step = 1;
      const list = Object.entries(D.PRODUCTS).filter(([, p]) => p.recipe && !p.out);
      const book = `<h3>配方冊</h3><div class="cf-book">${list.map(([pid, p]) => {
        const miss = need(pid);
        return `<button type="button" class="cf-recipe${st.product === pid ? ' on' : ''}" data-recipe="${pid}"${miss.length ? ' disabled' : ''}>
          ${tok(pid)}<span class="cf-main"><b>${esc(p.name)}</b><small>${p.recipe.map((m) => esc(D.ITEMS[m].name)).join(' ＋ ')}</small></span>
          ${miss.length ? `<span class="cf-pill miss">缺${miss.map((m) => esc(D.ITEMS[m].name)).join('、')}</span>` : '<span class="cf-pill ok">可以做</span>'}
        </button>`;
      }).join('')}</div>`;
      let picker = '';
      if (st.product) {
        picker = `<h3>每樣挑一份</h3>${recipe().map((m, i) => {
          const used = Object.entries(st.lots).filter(([j]) => Number(j) !== i).map(([, u]) => u);
          const opts = [];
          const plainLeft = plainCount(m) - used.filter((u) => u === 0).length;
          if (plainLeft > 0) opts.push({ uid: 0, tr: {}, src: 'shop' });
          lotsOf(m).filter((l) => !used.includes(l.uid)).sort((a, b) => sum(b.tr) - sum(a.tr)).forEach((l) => opts.push(l));
          return `<div class="cf-mat"><div class="cf-mat-h">${tok(m)}<b>${esc(D.ITEMS[m].name)}</b></div><div class="cf-lots">${opts.map((l) => `
            <button type="button" class="cf-lot${st.lots[i] === l.uid ? ' on' : ''}" data-slot="${i}" data-uid="${l.uid}">
              <small>${l.uid === 0 ? `一般份・剩 ${plainLeft}` : l.src === 'shop' ? '小舖' : '採集來的'}</small>
              <span class="cf-trs">${chips(l.tr, '<small class="cf-none">沒有特性</small>')}</span>
            </button>`).join('')}</div></div>`;
        }).join('')}`;
      }
      frame(stage(), `${st.product ? picker + '<button type="button" class="cf-link" data-back-book>換一道配方</button>' : book}`,
        `<button type="button" class="cf-btn" data-go2${allPicked() ? '' : ' disabled'}>${allPicked() ? '下鍋！' : st.product ? '每樣挑一份才能下鍋' : '先挑一道配方'}</button>
         ${o.onExit ? '<button type="button" class="cf-link" data-exit>返回</button>' : ''}`);
    }

    // ── 二：撈泡泡 ──
    function step2() {
      st.step = 2;
      if (o.quick) { st.stirs = []; step3(); return; }
      frame('<div class="cf-bubble"></div>', `<p class="cf-note">鍋裡現在：${chips(potNow(), '（沒有特性）')}</p>`, '');
      st.bubble = window.BubbleGame.mount(el.querySelector('.cf-bubble'), {
        traits: D.TRAITS, pot: potNow(), cfg: o.bubble, rand, sfx, img,
        onDone: (r) => { st.stirs = r.stirs; st.bubble = null; setTimeout(step3, 200); },
      });
    }

    // ── 三：加料 ──
    function step3() {
      st.step = 3;
      const tr = E.finalTraits(D, recipe().map((_, i) => lotTr(i)), st.stirs);
      const list = o.spikes.filter((id) => D.ITEMS[id]);
      frame(stage(`<div class="cf-window${st.spike ? ' watch' : ''}"><i></i></div>${st.spike ? `<div class="cf-hehe">嘿嘿……</div>` : ''}`, `lookout${st.spike ? ' armed' : ''}`),
        `<h3>要加料嗎？</h3><div class="cf-book">
          <button type="button" class="cf-recipe${!st.spike ? ' on' : ''}" data-spike=""><span class="cf-tok none">無</span><span class="cf-main"><b>不加料</b><small>做個乾淨的</small></span></button>
          ${list.map((id) => `<button type="button" class="cf-recipe${st.spike === id ? ' on' : ''}" data-spike="${id}">${tok(id)}<span class="cf-main"><b>${esc(D.ITEMS[id].name)}</b><small>${esc(D.ITEMS[id].desc || '')}</small></span>${o.spikeNote ? `<span class="cf-pill">${esc(o.spikeNote(id))}</span>` : ''}</button>`).join('')}
        </div><p class="cf-note">目前的特性：${chips(tr, '（沒有特性）')}</p>`,
        `<button type="button" class="cf-btn" data-go4>${st.spike ? `撒進去，${o.quick ? '起鍋' : '準備起鍋'}` : o.quick ? '起鍋' : '準備起鍋'}</button>`);
      say(st.spike ? 'spikeGo' : 'spikeAsk');
    }

    // ── 四：起鍋 ──
    function step4() {
      st.step = 4;
      if (o.quick) { st.zone = null; result(); return; }
      const tr = E.finalTraits(D, recipe().map((_, i) => lotTr(i)), st.stirs);
      const order = Object.keys(D.TRAITS);
      const top = Object.keys(tr).sort((a, b) => tr[b] - tr[a] || order.indexOf(a) - order.indexOf(b))[0];
      frame(stage('<div class="cf-bowl"></div>', 'bowl'),
        `<h3>起鍋</h3><p class="cf-note">${top ? `停在金色，<b>${esc(trName(top))}</b>升一級；停在紅色，降一級。` : '鍋裡沒有特性，隨便收火就好。'}</p>
         <div class="cf-bar" data-stop>${R.zones.map(([w, z]) => `<span class="${z}" style="width:${w}%">${z === 'up' ? '升' : z === 'down' ? '降' : ''}</span>`).join('')}<i class="cf-bead"></i></div>
         <div class="cf-verdict"></div>`,
        `<button type="button" class="cf-btn" data-stop>收火！</button><p class="cf-keys">點一下，或按空白鍵</p>`);
      say('finish');
      st.beadT0 = performance.now();
      const bead = el.querySelector('.cf-bead');
      const loop = (now) => {
        if (st.zone) return;
        bead.style.left = `${beadPos(now)}%`;
        st.raf = requestAnimationFrame(loop);
      };
      st.raf = requestAnimationFrame(loop);
    }
    function beadPos(now) { const p = ((now - st.beadT0) % R.beadMs) / R.beadMs; return p < 0.5 ? p * 200 : 200 - p * 200; }
    function stopBead() {
      if (st.step !== 4 || st.zone) return;
      cancelAnimationFrame(st.raf);
      const pos = beadPos(performance.now());
      st.zone = E.finishZone(D, pos);
      const bead = el.querySelector('.cf-bead');
      bead.style.left = `${pos}%`;
      bead.classList.add('hit');
      const v = el.querySelector('.cf-verdict');
      v.className = `cf-verdict ${st.zone}`;
      v.textContent = st.zone === 'up' ? '升一級！' : st.zone === 'down' ? '降一級……' : '維持';
      el.querySelectorAll('[data-stop]').forEach((b) => { if (b.tagName === 'BUTTON') b.disabled = true; });
      sfx(st.zone === 'up' ? 'ding' : st.zone === 'down' ? 'fail' : 'pop');
      say(st.zone);
      setTimeout(result, 1300);
    }

    // ── 成品 ──
    function result() {
      st.step = 5;
      const trs = recipe().map((_, i) => lotTr(i));
      const traits = E.finalTraits(D, trs, st.stirs, st.zone);
      const pid = st.product;
      const p = D.PRODUCTS[pid];
      el.innerHTML = `<div class="cf"><div class="cf-stage done">
          <div class="cf-steam"></div><div class="cf-result">${tok(pid, true)}<b>${esc(p.name)}</b><div class="cf-trs">${chips(traits, '<small>沒有特性</small>')}</div>
          ${st.spike ? `<small class="cf-spiked">（加了${esc(D.ITEMS[st.spike].name)}）</small>` : ''}</div>
          <div class="cf-helper">${face('baojuan')}</div><div class="cf-say" hidden></div>
        </div>
        <div class="cf-cta"><button type="button" class="cf-btn" data-take>收下</button></div></div>`;
      sfx('ding');
      say('done', { p: p.name });
      st.final = { product: pid, mats: recipe().slice(), lots: recipe().map((_, i) => st.lots[i]), stirs: st.stirs, spike: st.spike, zone: st.zone, traits };
    }

    // ── 事件 ──
    el.addEventListener('click', onClick);
    function onClick(e) {
      const b = e.target.closest('button, [data-stop]');
      if (!b || b.disabled || !el.contains(b)) return;
      const d = b.dataset;
      if (d.recipe) {
        st.product = d.recipe; st.lots = {};
        // 每樣預設不選，讓玩家自己挑；只有一種選擇時直接放好
        recipe().forEach((m, i) => {
          const used = Object.values(st.lots);
          const opts = (plainCount(m) - used.filter((u) => u === 0).length > 0 ? [0] : []).concat(lotsOf(m).filter((l) => !used.includes(l.uid)).map((l) => l.uid));
          if (opts.length === 1) st.lots[i] = opts[0];
        });
        sfx('click'); step1();
        say('recipe', { p: D.PRODUCTS[st.product].name, m: recipe().map((m) => D.ITEMS[m].name).join('、') });
      } else if (d.slot != null) {
        const i = Number(d.slot), uid = Number(d.uid);
        st.lots[i] = uid;
        sfx('pop'); step1();
        const tr = lotTr(i);
        if (allPicked()) say('ready');
        else if (sum(tr) >= 2) say('lotGood', { t: Object.keys(tr).sort((a, b) => tr[b] - tr[a]).map(trName)[0] });
        else if (!sum(tr)) say('lotPlain');
      } else if (d.backBook != null) { st.product = null; st.lots = {}; step1(); say('book'); }
      else if (d.exit != null) { if (o.onExit) o.onExit(); }
      else if (d.go2 != null) { sfx('bubble'); step2(); }
      else if (d.spike != null) {
        st.spike = d.spike || null;
        sfx(st.spike ? 'evil' : 'click');
        step3();
        if (st.spike) setTimeout(() => say('spikePick'), 10), setTimeout(() => { if (st.step === 3 && st.spike) say('spikeGo'); }, 900);
        else say('spikeNo');
      } else if (d.go4 != null) { if (st.spike) sfx('pop'); step4(); }
      else if (d.stop != null) stopBead();
      else if (d.take != null) { if (o.onDone) o.onDone(st.final); }
    }
    function onKey(e) {
      if (st.step === 4 && (e.key === ' ' || e.key === 'Enter') && !st.zone) { e.preventDefault(); stopBead(); }
    }

    step1();
    say('book');
    return {
      destroy() {
        cancelAnimationFrame(st.raf);
        if (st.bubble) st.bubble.destroy();
        document.removeEventListener('keydown', keyH);
        el.removeEventListener('click', onClick);
        el.innerHTML = '';
      },
    };
  }

  return { mount, LINES };
})();
