// 撈泡泡小遊戲（調合第二階段）：獨立模組，遊戲（js/game.js）和試玩頁（bubble-lab.html）共用。
// 鍋裡不斷冒出特性泡泡，飄到頂就破；限時內撈滿勺子的格數。金邊大泡泡 +2，焦泡讓最強特性 −1。
// 包捐在旁邊顧火、搧火、喊話。不依賴遊戲其他檔案：特性定義、鍋裡原有特性、參數都由呼叫端給。
//
// 用法：const g = BubbleGame.mount(el, { traits, pot, cfg, rand, sfx, img, onDone });
//   traits：{ id: { name, color } }（D.TRAITS）
//   pot：鍋裡原有的特性 { tian: 2, ... }（決定哪種泡泡比較常冒）
//   cfg：見 DEFAULTS
//   sfx(name, arg)：音效（可省略）；img(who)：立繪網址（可省略，沒有就用字）
//   onDone({ stirs, caught, escaped })：結束時呼叫；stirs 給 GameEngine.finalTraits 用（{t,v} 或 {t:'burnt'}）
//   回傳 { destroy() }
window.BubbleGame = (() => {
  const DEFAULTS = {
    duration: 9000, // 火候（毫秒）
    slots: 3, // 勺子能裝幾顆
    lanes: 3,
    spawnMs: 520, // 平均多久冒一顆
    riseMs: [2600, 3600], // 從鍋面飄到頂要多久（越小越快）
    natureWeight: 3, // 鍋裡已有的特性每級多幾倍機會
    bigChance: 0.15,
    bigValue: 2,
    burntChance: 0.14,
    fan: true, // 包捐搧火：一次冒一波泡泡
    fanEvery: [2600, 3600],
    fanCount: 4,
    introMs: 1500,
  };

  const LINES = {
    intro: [['baojuan', '奴婢顧火，小主負責撈！挑想要的顏色撈 {n} 顆。']],
    big: [['baojuan', '金邊的！那顆一抵二！']],
    burntSeen: [['baojuan', '黑的是焦泡，千萬別撈！']],
    burnt: [['lingrong', '……燙。'], ['baojuan', '哎呀，焦了，少一味。'], ['baojuan', '小主，那是焦的……']],
    fan: [['baojuan', '奴婢搧一下火！'], ['baojuan', '火大一點～'], ['baojuan', '呼——呼——']],
    escaped: [['baojuan', '跑掉了～'], ['lingrong', '……慢了一步。']],
    hurry: [['baojuan', '火快熄了！']],
    good: [['lingrong', '就是這顆。'], ['baojuan', '好手勁！']],
    full: [['lingrong', '撈好了。'], ['baojuan', '小主手真快！']],
    timeout: [['baojuan', '火熄了……剩下的就隨它去吧。']],
    timeoutEmpty: [['lingrong', '……我剛剛在發呆。']],
  };
  const NAMES = { baojuan: '包捐', lingrong: '零溶' };
  const KEYS = { 1: 0, 2: 1, 3: 2, a: 0, s: 1, d: 2, arrowleft: 0, arrowdown: 1, arrowright: 2 };

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];

  function mount(el, opts) {
    const cfg = { ...DEFAULTS, ...(opts.cfg || {}) };
    const traits = opts.traits;
    const pot = opts.pot || {};
    const rand = opts.rand || Math.random;
    const sfx = opts.sfx || (() => {});
    const img = opts.img || (() => null);
    const weights = Object.keys(traits).map((t) => [t, 1 + cfg.natureWeight * (pot[t] || 0)]);
    const totalW = weights.reduce((a, [, w]) => a + w, 0);
    const keyboard = !(window.matchMedia && window.matchMedia('(hover: none)').matches);

    const face = (who) => {
      const src = img(who);
      return src ? `<img src="${esc(src)}" alt="${NAMES[who]}">` : `<span>${NAMES[who][0]}</span>`;
    };
    el.innerHTML = `
      <div class="bbl" tabindex="-1">
        <div class="bbl-top">
          <div class="bbl-ladle" aria-label="勺子">${Array.from({ length: cfg.slots }, () => '<i class="bbl-slot"></i>').join('')}</div>
          <div class="bbl-fire"><b></b></div>
        </div>
        <div class="bbl-arena">
          <div class="bbl-lanes">${Array.from({ length: cfg.lanes }, (_, i) => `<i>${keyboard ? `<kbd>${i + 1}</kbd>` : ''}</i>`).join('')}</div>
          <div class="bbl-surface"></div>
          <div class="bbl-helper">${face('baojuan')}</div>
          <div class="bbl-say" hidden><b></b><span></span></div>
          <div class="bbl-banner" hidden></div>
        </div>
        <p class="bbl-hint">${keyboard ? '點泡泡，或按 1／2／3 撈那一排最上面的' : '點泡泡撈起來'}・金邊 +2・黑色焦泡別撈</p>
      </div>`;
    const root = el.querySelector('.bbl');
    const arena = root.querySelector('.bbl-arena');
    const slotEls = [...root.querySelectorAll('.bbl-slot')];
    const fireBar = root.querySelector('.bbl-fire b');
    const sayEl = root.querySelector('.bbl-say');
    const helper = root.querySelector('.bbl-helper');
    const banner = root.querySelector('.bbl-banner');

    const st = {
      t: 0, last: 0, raf: 0, phase: 'intro', bubbles: [], seq: 0, nextSpawn: 0, nextFan: 0,
      stirs: [], escaped: 0, sayUntil: 0, sayPri: 0, seen: {}, hurried: false, done: false,
    };

    function say(kind, pri = 1, vars = {}) {
      const now = st.t;
      if (now < st.sayUntil && pri <= st.sayPri) return;
      const [who, text] = pick(LINES[kind], rand);
      sayEl.hidden = false;
      sayEl.className = `bbl-say who-${who}`;
      sayEl.querySelector('b').textContent = NAMES[who];
      sayEl.querySelector('span').textContent = text.replace('{n}', vars.n != null ? vars.n : cfg.slots);
      st.sayUntil = now + 1700;
      st.sayPri = pri;
    }

    function size() { return { w: arena.clientWidth, h: arena.clientHeight }; }

    function spawn(lane) {
      const { w, h } = size();
      const laneW = w / cfg.lanes;
      if (lane == null) {
        // 挑一排：避開鍋面上剛冒、還沒飄開的那排
        const free = [...Array(cfg.lanes).keys()].filter((l) => !st.bubbles.some((b) => b.lane === l && b.y > h * 0.72));
        lane = free.length ? pick(free, rand) : Math.floor(rand() * cfg.lanes);
      }
      const r0 = rand();
      let kind = 'trait', t = null, v = 1;
      if (r0 < cfg.burntChance) kind = 'burnt';
      else {
        let x = rand() * totalW;
        for (const [k, wt] of weights) { x -= wt; if (x <= 0) { t = k; break; } }
        t = t || weights[weights.length - 1][0];
        if (rand() < cfg.bigChance) { kind = 'big'; v = cfg.bigValue; }
      }
      const r = kind === 'big' ? 34 : 27;
      const dur = cfg.riseMs[0] + rand() * (cfg.riseMs[1] - cfg.riseMs[0]);
      const b = {
        id: ++st.seq, lane, kind, t, v, r, born: st.t, dur,
        x0: laneW * (lane + 0.5), y: h + r, wob: 6 + rand() * 8, ph: rand() * Math.PI * 2, gone: false,
      };
      const node = document.createElement('button');
      node.type = 'button';
      node.className = `bbl-b ${kind}`;
      node.style.setProperty('--r', `${r}px`);
      if (t) node.style.setProperty('--c', traits[t].color);
      node.innerHTML = kind === 'burnt' ? '<span>焦</span>' : `<span>${esc(traits[t].name)}</span>${kind === 'big' ? '<small>+2</small>' : ''}`;
      node.setAttribute('aria-label', kind === 'burnt' ? '焦泡' : `${traits[t].name}${kind === 'big' ? '大泡泡' : '泡泡'}`);
      node.addEventListener('pointerdown', (e) => { e.preventDefault(); catchBubble(b); });
      b.node = node;
      arena.appendChild(node);
      st.bubbles.push(b);
      if (kind === 'big' && !st.seen.big) { st.seen.big = true; say('big', 2); }
      if (kind === 'burnt' && !st.seen.burnt) { st.seen.burnt = true; say('burntSeen', 2); }
    }

    function pos(b) {
      const { h } = size();
      const p = (st.t - b.born) / b.dur; // 0 → 1
      const y = h + b.r - p * (h + 2 * b.r);
      const x = b.x0 + Math.sin(p * 7 + b.ph) * b.wob;
      return { p, x, y };
    }

    function removeBubble(b, cls) {
      b.gone = true;
      st.bubbles = st.bubbles.filter((x) => x !== b);
      if (cls) { b.node.classList.add(cls); b.node.disabled = true; setTimeout(() => b.node.remove(), 450); } else b.node.remove();
    }

    function catchBubble(b) {
      if (st.phase !== 'play' || b.gone) return;
      const n = st.stirs.length;
      if (n >= cfg.slots) return;
      const slot = slotEls[n];
      // 泡泡飛進勺子那格
      const ar = arena.getBoundingClientRect(), sr = slot.getBoundingClientRect();
      const { x, y } = pos(b);
      b.node.style.setProperty('--fx', `${sr.left + sr.width / 2 - ar.left - x}px`);
      b.node.style.setProperty('--fy', `${sr.top + sr.height / 2 - ar.top - y}px`);
      removeBubble(b, 'caught');
      if (b.kind === 'burnt') {
        st.stirs.push({ t: 'burnt' });
        slot.className = 'bbl-slot burnt';
        slot.innerHTML = '焦';
        sfx('bubBurnt');
        say('burnt', 3);
        root.classList.remove('shake'); void root.offsetWidth; root.classList.add('shake');
      } else {
        st.stirs.push({ t: b.t, v: b.v });
        slot.className = `bbl-slot on${b.kind === 'big' ? ' big' : ''}`;
        slot.style.setProperty('--c', traits[b.t].color);
        slot.innerHTML = `${esc(traits[b.t].name)}${b.kind === 'big' ? '<small>+2</small>' : ''}`;
        sfx(b.kind === 'big' ? 'bubBig' : 'bubCatch', n);
        if (b.kind === 'big' || rand() < 0.3) say('good', 1);
      }
      if (st.stirs.length >= cfg.slots) finish('full');
    }

    // 鍵盤：撈那一排「最上面」（最快要破）的那顆
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      const lane = KEYS[(e.key || '').toLowerCase()];
      if (lane == null || lane >= cfg.lanes) return;
      e.preventDefault();
      e.stopPropagation();
      if (st.phase !== 'play' || e.repeat) return;
      const inLane = st.bubbles.filter((b) => b.lane === lane && pos(b).y < size().h - b.r);
      if (!inLane.length) { root.querySelectorAll('.bbl-lanes i')[lane].classList.remove('miss'); void root.offsetWidth; root.querySelectorAll('.bbl-lanes i')[lane].classList.add('miss'); return; }
      catchBubble(inLane.reduce((a, b) => (pos(b).y < pos(a).y ? b : a)));
    }

    function fan() {
      helper.classList.remove('fanning'); void helper.offsetWidth; helper.classList.add('fanning');
      sfx('fan');
      say('fan', 1);
      const lanes = [...Array(cfg.lanes).keys()];
      for (let i = 0; i < cfg.fanCount; i++) {
        setTimeout(() => { if (st.phase === 'play') spawn(lanes[i % cfg.lanes]); }, i * 160);
      }
    }

    function finish(why) {
      if (st.phase === 'end') return;
      st.phase = 'end';
      root.classList.add('ended');
      if (why === 'full') say('full', 9);
      else say(st.stirs.length ? 'timeout' : 'timeoutEmpty', 9);
      banner.hidden = false;
      banner.textContent = why === 'full' ? '撈滿了！' : '火熄了';
      st.bubbles.slice().forEach((b) => removeBubble(b, 'popped'));
      setTimeout(() => {
        if (st.done) return;
        st.done = true;
        stop();
        if (opts.onDone) opts.onDone({ stirs: st.stirs.slice(), caught: st.stirs.length, escaped: st.escaped, why });
      }, 1500);
    }

    function frame(now) {
      const dt = Math.min(50, st.last ? now - st.last : 16);
      st.last = now;
      st.t += dt;
      if (st.phase === 'intro' && st.t >= cfg.introMs) {
        st.phase = 'play';
        st.playFrom = st.t;
        st.nextSpawn = st.t;
        st.nextFan = st.t + cfg.fanEvery[0] + rand() * (cfg.fanEvery[1] - cfg.fanEvery[0]);
        banner.hidden = true;
      }
      if (st.phase === 'play') {
        const left = cfg.duration - (st.t - st.playFrom);
        fireBar.style.width = `${Math.max(0, left / cfg.duration) * 100}%`;
        root.classList.toggle('hurry', left < 3000);
        if (left < 3000 && !st.hurried) { st.hurried = true; say('hurry', 2); }
        if (st.t >= st.nextSpawn) { spawn(); st.nextSpawn = st.t + cfg.spawnMs * (0.6 + rand() * 0.8); }
        if (cfg.fan && st.t >= st.nextFan) { fan(); st.nextFan = st.t + cfg.fanEvery[0] + rand() * (cfg.fanEvery[1] - cfg.fanEvery[0]); }
        if (left <= 0) finish('timeout');
      }
      for (const b of st.bubbles.slice()) {
        const { p, x, y } = pos(b);
        if (p >= 1) {
          removeBubble(b, 'popped');
          if (st.phase === 'play' && b.kind !== 'burnt') {
            st.escaped++;
            sfx('bubEscape');
            if (b.kind === 'big' || st.escaped % 4 === 0) say('escaped', 1);
          }
          continue;
        }
        b.node.style.transform = `translate(${x - b.r}px, ${y - b.r}px)`;
      }
      if (st.t > st.sayUntil && !sayEl.hidden) sayEl.hidden = true;
      st.raf = requestAnimationFrame(frame);
    }

    function stop() {
      cancelAnimationFrame(st.raf);
      document.removeEventListener('keydown', onKey, true);
    }

    banner.hidden = false;
    banner.textContent = '開火！';
    fireBar.style.width = '100%';
    document.addEventListener('keydown', onKey, true);
    st.raf = requestAnimationFrame(frame);
    say('intro', 5);

    return {
      destroy() { st.done = true; stop(); el.innerHTML = ''; },
      // 測試用：直接撈第 n 排最上面那顆
      _state: st,
    };
  }

  return { mount, DEFAULTS, LINES };
})();
