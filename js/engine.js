// 純遊戲引擎（functional core）。
// 不依賴 DOM / localStorage / Math.random：資料一律以參數 D（= GAME_DATA）傳入，
// 需要隨機的函式（後續加入）以注入的 rand 取用。
// 雙匯出：瀏覽器掛在 window.GameEngine，node 透過 module.exports。
(function () {
  'use strict';

  // ───────── 引擎內部小工具（暫與外殼各持一份，story 1.5 收斂）─────────
  // 隨機一律走注入的 rand，不碰 Math.random。
  const clamp = (n) => Math.max(0, Math.min(100, n));
  const charName = (D, who) => D.CHARS[who].name;

  function addFavor(S, who, n) {
    const before = S.favor[who];
    S.favor[who] = clamp(before + n);
    return S.favor[who] - before;
  }
  function addFriend(S, who, n) {
    const before = S.friend[who];
    S.friend[who] = clamp(before + n);
    return S.friend[who] - before;
  }
  function weightedPick(table, rand) {
    const total = table.reduce((s, [, w]) => s + w, 0);
    let r = rand() * total;
    for (const [id, w] of table) { if ((r -= w) < 0) return id; }
    return table[table.length - 1][0];
  }
  function invAdd(S, id, n = 1) {
    S.inv[id] = (S.inv[id] || 0) + n;
    if (S.inv[id] <= 0) delete S.inv[id];
  }
  const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];

  // ───────── 素材份與特性（game-design §13.1–13.2）─────────
  // S.inv[id] 仍是「總共有幾份」；帶特性的那幾份另外記在 S.lots（{ uid, id, tr }），沒特性的就是一般份。
  // 不變式：同一種素材的 lots 數 ≤ inv 數。要減素材一律走 takeUnit，才不會兩邊對不上。
  const traitSum = (tr) => Object.values(tr || {}).reduce((a, b) => a + b, 0);
  const lotsOf = (S, id) => S.lots.filter((l) => l.id === id);
  // 預設挑哪一份：特性總級數最高的那份；都沒有特性 → null（用一般份）
  function bestLot(S, id, skip) {
    const ls = lotsOf(S, id).filter((l) => !(skip && skip.includes(l.uid)));
    return ls.reduce((a, b) => (!a || traitSum(b.tr) > traitSum(a.tr) ? b : a), null);
  }
  // 放進一份：tr 有東西才記成帶特性的份
  function addUnit(S, id, tr) {
    invAdd(S, id);
    if (tr && traitSum(tr) > 0) S.lots.push({ uid: ++S.lotSeq, id, tr: { ...tr } });
  }
  // 拿走一份：指定 uid 就拿那份；沒指定先拿一般份，一般份沒了再拿特性最少的那份。回傳拿走那份的特性（一般份 → {}）。
  // craftSel.lots 裡的 0（PLAIN）表示「指定用一般份」，不會自動改挑帶特性的。
  function takeUnit(S, id, uid) {
    if (!(S.inv[id] > 0)) return {};
    let lot = uid != null ? S.lots.find((l) => l.uid === uid && l.id === id) : null;
    const ls = lotsOf(S, id);
    // 沒指定、或指定的那份不存在（例如 PLAIN＝0：指定用一般份）→ 先拿一般份，一般份沒了才拿特性最少的那份
    if (!lot && ls.length >= S.inv[id]) lot = ls.reduce((a, b) => (traitSum(b.tr) < traitSum(a.tr) ? b : a));
    invAdd(S, id, -1);
    if (!lot) return {};
    S.lots = S.lots.filter((l) => l !== lot);
    return { ...lot.tr };
  }
  // ───────── 四階段調合（§13.3）─────────
  // 素材的特性先倒進鍋（同特性相加、最高 3 級，這時還不砍種類）
  const potTraits = (D, trs) => mergeTraits(D, trs, 3, Infinity);
  // 開火攪拌：冒 bubbles 顆不同特性的泡泡。每種特性基本權重 1，鍋裡已有的特性每級 +natureWeight；
  // 每顆有 bigChance 是大泡泡（+bigValue），其餘 +1。回 [{ t, v }]
  function rollBubbles(D, pot, rand) {
    const C = D.RULES.craft;
    const pool = Object.keys(D.TRAITS).map((t) => [t, 1 + C.natureWeight * ((pot && pot[t]) || 0)]);
    const out = [];
    for (let i = 0; i < C.bubbles && pool.length; i++) {
      const t = weightedPick(pool, rand);
      pool.splice(pool.findIndex(([k]) => k === t), 1);
      out.push({ t, v: rand() < C.bigChance ? C.bigValue : 1 });
    }
    return out;
  }
  // 套一顆泡泡：該特性 +v，最高 3 級（回新物件，不改傳入的）。
  // 焦泡（b.t === 'burnt'）：最強的那種特性 −1（平手取先出現的），降到 0 就消失
  const stirTraits = (tr, b) => {
    if (b.t !== 'burnt') return { ...tr, [b.t]: Math.min(3, ((tr || {})[b.t] || 0) + b.v) };
    const out = { ...tr };
    const top = Object.keys(out).sort((x, y) => out[y] - out[x])[0];
    if (top) { out[top]--; if (out[top] <= 0) delete out[top]; }
    return out;
  };
  // 珠珠停在 pos（0～100，橫條的百分比位置）屬於哪一區：'down'|'keep'|'up'
  // zones 可省略（預設 RULES.craft.zones）；起鍋每次用 jitterZones 浮動過的分區
  function finishZone(D, pos, zones) {
    const Z = zones || D.RULES.craft.zones;
    let x = 0;
    for (const [w, z] of Z) { x += w; if (pos < x) return z; }
    return Z[Z.length - 1][1];
  }
  // 起鍋分區每次浮動：兩端降級區各 8～18%、升級區 9～17% 且位置在 30～70% 之間，其餘是維持（每段至少 8%）
  function jitterZones(rand) {
    const r = (a, b) => a + rand() * (b - a);
    const d1 = Math.round(r(8, 18)), d2 = Math.round(r(8, 18)), u = Math.round(r(9, 17));
    let c = r(30, 70);
    c = Math.min(Math.max(c, d1 + 8 + u / 2), 100 - d2 - 8 - u / 2);
    const k1 = Math.round(c - u / 2 - d1);
    const k2 = 100 - d1 - k1 - u - d2;
    return [[d1, 'down'], [k1, 'keep'], [u, 'up'], [k2, 'keep'], [d2, 'down']];
  }
  // 起鍋：只作用在最強的那種特性（平手依 D.TRAITS 順序）；升到最高 3 級、降到 0 就消失。沒有特性 → 不變
  function applyFinish(D, tr, zone) {
    const order = Object.keys(D.TRAITS);
    const top = Object.keys(tr || {}).sort((a, b) => tr[b] - tr[a] || order.indexOf(a) - order.indexOf(b))[0];
    if (!top || zone === 'keep') return { ...tr };
    const out = { ...tr, [top]: Math.min(3, tr[top] + (zone === 'up' ? 1 : -1)) };
    if (out[top] <= 0) delete out[top];
    return out;
  }
  // 成品特性：素材的特性 → 依序套攪拌挑的泡泡 → 只留最強 3 種 → 套起鍋結果
  function finalTraits(D, trs, stirs, zone) {
    let tr = potTraits(D, trs);
    (stirs || []).forEach((b) => { tr = stirTraits(tr, b); });
    tr = mergeTraits(D, [tr]);
    return zone ? applyFinish(D, tr, zone) : tr;
  }

  // 採集到的素材擲特性（§13.2）：偏向素材的本性（ITEMS.nature），0～2 種；
  // frac＝離出生點的遠近（0 最近、1 最遠）：近 1 級，中 1～2 級，遠 2～3 級。料與沒有本性的素材 → {}。
  function rollTraits(D, id, frac, rand) {
    const nat = D.ITEMS[id] && D.ITEMS[id].nature;
    if (!nat || !nat.length) return {};
    const r = rand();
    const n = Math.min(nat.length, r < 0.3 ? 0 : r < 0.8 ? 1 : 2);
    const order = nat.length > 1 && rand() < 0.5 ? [...nat].reverse() : nat;
    const tr = {};
    for (let i = 0; i < n; i++) {
      const base = frac < 1 / 3 ? 1 : frac < 2 / 3 ? 1 : 2;
      tr[order[i]] = Math.min(3, base + (frac >= 1 / 3 && rand() < 0.5 ? 1 : 0));
    }
    return tr;
  }

  // 合併特性：同特性相加、最高 maxLv 級；只留最強的 maxN 種（平手依 D.TRAITS 的順序）
  function mergeTraits(D, trs, maxLv = 3, maxN = 3) {
    const sum = {};
    trs.forEach((tr) => Object.entries(tr || {}).forEach(([t, lv]) => { sum[t] = Math.min(maxLv, (sum[t] || 0) + lv); }));
    const order = Object.keys(D.TRAITS);
    return Object.fromEntries(Object.entries(sum).sort((a, b) => b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0])).slice(0, maxN));
  }
  const itemName = (D, id) => (D.ITEMS[id] || D.PRODUCTS[id]).name;
  const have = (S, id) => S.inv[id] || 0;
  // 成品記著是替哪張訂單做的（forOrder）。那張訂單還在，成品就只屬於它，不會被別張同品項訂單拿走
  // （兩人同時要安神香時，替甲加料的那份不能出現在乙的訂單上）。訂單已不在或沒綁訂單的成品，誰要都能用。
  const ownerOf = (S, h) => (h.forOrder != null && S.orders.some((o) => o.id === h.forOrder) ? h.forOrder : null);
  const canFill = (S, o, h) => h.product === o.product && (ownerOf(S, h) === null || ownerOf(S, h) === o.id);
  // 手上有好幾個能用的成品時：先用綁這張訂單的，再用沒綁的；同一類裡用最新做好的那個
  const readyItem = (S, o) => {
    const ok = S.hand.filter((h) => canFill(S, o, h));
    return ok.filter((h) => ownerOf(S, h) === o.id).pop() || ok.pop();
  };
  const recipeOk = (D, S, pid) => D.PRODUCTS[pid].recipe.every((id) => have(S, id) >= 1);
  // 配方比對：放進鍋裡的素材（2 或 3 樣，順序不拘、可重複）和配方完全一樣才算數。
  // 舊呼叫法 findRecipe(D, a, b) 也接受。
  function findRecipe(D, mats, b) {
    const list = Array.isArray(mats) ? mats : [mats, b];
    const key = list.filter(Boolean).slice().sort().join('+');
    return Object.keys(D.PRODUCTS).find((pid) => {
      const r = D.PRODUCTS[pid].recipe;
      return r && r.slice().sort().join('+') === key;
    });
  }
  // ───────── 拜訪各宮（§14）─────────
  // 反應：成品喜歡 +1／不喜歡 −1，帶的特性喜歡每種 +1／討厭每種 −1；加總 >0 投其所好、<0 嫌棄、=0 兩邊都有＝又愛又嫌、其他普通
  function giftReaction(D, who, product, tr) {
    const P = D.PREFS[who];
    const ts = Object.keys(tr || {}).filter((t) => tr[t] > 0);
    const likeP = P.likeP.includes(product), hateP = P.hateP.includes(product);
    const likeT = ts.filter((t) => P.likeT.includes(t)).length, hateT = ts.filter((t) => P.hateT.includes(t)).length;
    const net = (likeP ? 1 : 0) - (hateP ? 1 : 0) + likeT - hateT;
    const both = (likeP || likeT > 0) && (hateP || hateT > 0);
    return { net, kind: net > 0 ? 'love' : net < 0 ? 'hate' : both ? 'mixed' : 'plain' };
  }
  // 伴手禮的友好：（基本值＋喜歡特性每級 −討厭特性每級）× 成品係數，四捨五入、最低 0
  function giftFriend(D, who, product, tr) {
    const P = D.PREFS[who];
    const C = D.RULES.giftCoef;
    let v = D.PRODUCTS[product].gift || 0;
    for (const [t, lv] of Object.entries(tr || {})) {
      if (P.likeT.includes(t)) v += lv;
      if (P.hateT.includes(t)) v -= lv;
    }
    const coef = P.likeP.includes(product) ? C.like : P.hateP.includes(product) ? C.hate : C.plain;
    return Math.max(0, Math.round(v * coef));
  }
  // 收禮機率＝友好＋30%（最高 100%）；反應是嫌棄時再扣
  const acceptChance = (D, S, who, kind) => Math.max(0, Math.min(100, S.friend[who] + D.RULES.giftAcceptBonus - (kind === 'hate' ? D.RULES.hateAcceptPenalty : 0))) / 100;

  function newState(D) {
    const R = D.RULES;
    return {
      day: 1, slot: 0, silver: R.silver,
      favor: { ...R.favor },
      friend: { ...R.friend },
      conc: Object.fromEntries(D.TARGETS.map((t) => [t, { status: R.status[t], preg: 0, musk: 0, debuff: null }])),
      inv: { ...R.startInv }, lots: [], lotSeq: 0,
      orders: [], hand: [], seq: 0,
      flip: null, bribe: 0, bribedToday: false, groundUntil: 0,
      noFlipNights: 0, empressBoost: false, tired: false,
      stats: { spikesUsed: 0, success: 0, caught: 0, groundedDays: 0, victims: [], ruined: [], sings: 0, bribes: 0, junk: 0, births: 0, muskRuin: 0, sutras: 0, loves: 0, selfDeliver: 0, proxyDeliver: 0, perfect: 0, yuanzhu: 0 },
      log: [], dayLog: [], result: null,
    };
  }

  // 封號判定：吃整個 S（部分條件讀 S.friend，不只 S.stats）；D 供部分條件取 TARGETS。
  // 判定順序與 D.TITLES 無關；D.TITLES 的排序決定誰是主封號。
  const TITLE_CHECK = {
    shexiang: (S) => S.stats.muskRuin > 0,
    shuangmian: (S, D) => S.stats.victims.length === 3 && S.stats.caught === 0 && D.TARGETS.every((t) => S.friend[t] >= 35),
    duanzi: (S) => ['meizhuang', 'zhenhuan'].every((t) => S.stats.ruined.includes(t)),
    wentaiyi: (S) => S.stats.caught >= 2,
    guimi: (S, D) => D.TARGETS.every((t) => S.friend[t] >= 40),
    baimang: (S) => S.stats.spikesUsed > 0 && S.stats.success === 0,
    jingshi: (S) => S.stats.bribes >= 2,
    miaoyin: (S) => S.stats.sings >= 2,
    bailian: (S) => S.stats.spikesUsed === 0,
    yuanzhu: (S) => (S.stats.yuanzhu || 0) >= 1,
    michelin: (S) => (S.stats.perfect || 0) >= 1,
    ganlu: (S) => (S.stats.sutras || 0) >= 3,
    baojuan: (S, D) => (S.stats.proxyDeliver || 0) >= D.RULES.baojuanProxy,
    heian: (S) => S.stats.junk >= 1,
    zhongsi: (S) => S.stats.births >= 1,
    touming: () => false,
  };

  // 十日戰績：依 D.END_STATS 的順序挑有發生的前 max 條 → [{ n, text, chip }]；一次都沒下料時第一條是「清清白白」。
  function endingStats(D, S, max = 4) {
    const st = { ...S.stats };
    const val = (k) => (k === 'ruined' ? (st.ruined || []).length : st[k] || 0);
    const out = [];
    if (!st.spikesUsed) out.push({ n: D.END_CLEAN[0], text: D.END_CLEAN[1], chip: '下料' });
    D.END_STATS.forEach((x) => {
      if (out.length >= max || !val(x.key)) return;
      const tpl = x.solo && !st.selfDeliver ? x.solo : x.text;
      out.push({ n: val(x.key), text: tpl.replace(/\{(\w+)\}/g, (_, k) => st[k] || 0), chip: x.chip });
    });
    return out;
  }

  // 純函式：before 是之前的封號冊（由外殼傳入）；不碰 localStorage、不存檔。
  function computeEnding(D, S, before) {
    before = before || [];
    const f = S.favor;
    const grounded = S.day <= S.groundUntil;
    const rank = 1 + D.TARGETS.filter((t) => f[t] >= f.lingrong).length;
    const top = rank === 1 ? 'lingrong' : D.TARGETS.reduce((a, b) => (f[b] > f[a] ? b : a));
    const opening = [D.END_TOP[top]];
    if (top !== 'lingrong') opening.push(D.END_LING[grounded ? 'grounded' : rank]);
    let titles = D.TITLES.filter((t) => TITLE_CHECK[t.id](S, D));
    if (!titles.length) titles = [D.TITLES.find((t) => t.id === 'touming')];
    const book = [...new Set([...before, ...titles.map((t) => t.id)])];
    return {
      rank, top, opening,
      board: [...D.ALL].sort((a, b) => f[b] - f[a] || (a === 'lingrong') - (b === 'lingrong')).map((who) => ({ who, favor: f[who] })),
      stats: endingStats(D, S),
      main: titles[0], extra: titles.slice(1), book,
      fresh: titles.map((t) => t.id).filter((id) => !before.includes(id)),
    };
  }

  // ───────── 規則（被抓機率、翻牌子權重、枕邊風）─────────
  // via: 'deliver'（她自己點的東西，比較不會懷疑）或 'gift'
  // 遮掩分：成品的濃郁×2＋香氣＋甜蜜（§14.5）
  const maskScore = (D, tr) => Object.entries(D.RULES.maskWeights).reduce((a, [t, w]) => a + w * ((tr && tr[t]) || 0), 0);
  // 被抓機率：基礎機率先被遮掩壓低（最低 maskFloor），再乘友好倍率、交貨再減半。tr＝成品的特性
  function catchChance(D, S, who, spike, via, tr) {
    const R = D.RULES;
    const base = D.ITEMS[spike].catch;
    const masked = Math.min(base, Math.max(R.maskFloor, base * (1 - R.maskStep * maskScore(D, tr))));
    return masked
      * Math.max(R.friendCatchFloor, 1 - S.friend[who] / R.friendCatchDivisor)
      * (via === 'deliver' ? R.deliverCatchFactor : 1);
  }
  const riskLevel = (p) => (p < 0.12 ? '低' : p < 0.25 ? '中' : '高');
  function pillowChance(D, S, who) {
    const R = D.RULES;
    return Math.max(0, Math.min(R.pillowMax, S.friend[who] - R.pillowBase)) / 100;
  }

  function flipWeights(D, S, bribe) {
    const R = D.RULES;
    if (bribe === undefined) bribe = S.bribe;
    const grounded = S.day <= S.groundUntil;
    const w = {};
    if (!grounded) w.lingrong = Math.max(1, S.favor.lingrong) * (S.empressBoost ? R.empressFactor : 1) + bribe;
    D.TARGETS.forEach((t) => { if (S.conc[t].status !== 'pregnant') w[t] = Math.max(1, S.favor[t]); });
    if (S.flip && w[S.flip]) w[S.flip] *= R.repeatFlipFactor; // 黃上喜新厭舊
    return w;
  }
  function flipOdds(D, S, bribe) {
    const w = flipWeights(D, S, bribe);
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    return Object.fromEntries(D.ALL.map((k) => [k, w[k] ? w[k] / total : 0]));
  }
  // 早上抽當晚侍寢者：用 S.bribe，隨機走注入的 rand。權重全空回傳 null。
  function chooseFlip(D, S, rand) {
    const entries = Object.entries(flipWeights(D, S, S.bribe));
    return entries.length ? weightedPick(entries, rand) : null;
  }

  // ───────── 加料 ─────────
  // 預測加料效果（純函式，不擲骰）
  function predict(D, S, who, spike, via, tr) {
    const R = D.RULES;
    if (!spike) return { txt: '正經交貨', cls: 'neutral' };
    const c = S.conc[who];
    const it = D.ITEMS[spike];
    const risk = catchChance(D, S, who, spike, via, tr);
    const out = { risk, riskTxt: `被抓風險：${riskLevel(risk)}` };
    if (spike === 'musk') {
      if (c.status === 'infertile') return { ...out, txt: '無效（已不孕）', cls: 'bad' };
      if (c.status === 'pregnant') return { ...out, txt: '50% 小產', cls: 'good' };
      return { ...out, txt: c.musk + 1 >= R.muskDoses ? `不孕 ${R.fx.infertile}` : `麝香 ${c.musk + 1}/${R.muskDoses}`, cls: 'good' };
    }
    if (spike === 'safflower') {
      if (c.status === 'infertile') return { ...out, txt: '無效（已不孕）', cls: 'bad' };
      if (c.status === 'pregnant') return { ...out, txt: `小產＋不孕 ${R.fx.saffMiscarry}`, cls: 'good' };
      return { ...out, txt: `不孕 ${R.fx.infertile}`, cls: 'good' };
    }
    return { ...out, txt: S.flip === who ? `${it.debuff} ${R.fx[spike]}・今晚出包` : it.debuff, cls: 'good', it }; // 不是今晚侍寢的人：不提醒會白費
  }

  const bump = (S, k, n = 1) => { S.stats[k] = (S.stats[k] || 0) + n; };
  // 好成品（炎洗宮米其林）：一份成品的特性總和 ≥ RULES.michelinSum 級
  const isPerfect = (D, tr) => traitSum(tr) >= D.RULES.michelinSum;
  // 原著重現：舒痕膠加麝香送到真環手上，而且麝香有發揮（沒被抓、不是無效）
  function markYuanzhu(S, who, item, res) {
    if (who === 'zhenhuan' && item.product === 'shuhen' && item.spike === 'musk' && !res.caught && !res.useless) bump(S, 'yuanzhu');
  }

  // 真正下料（擲骰、改狀態、推 S.log/S.stats）。rand 注入。
  function applySpike(D, S, who, spike, via, rand, tr) {
    const R = D.RULES;
    if (!spike) return { outcome: 'plain' };
    S.stats.spikesUsed++;
    const it = D.ITEMS[spike];
    if (rand() < catchChance(D, S, who, spike, via, tr)) {
      const friendDelta = addFriend(S, who, R.caughtFriend);
      S.groundUntil = Math.max(S.groundUntil, S.day + it.ground);
      S.stats.caught++;
      S.stats.groundedDays += it.ground;
      S.log.push(`第 ${S.day} 天：對${charName(D, who)}下${it.name}，被太醫抓到，禁足 ${it.ground} 天`);
      return { outcome: 'caught', caught: true, friendDelta, days: it.ground };
    }
    const c = S.conc[who];
    let outcome;
    let fav = 0;
    let label = null;
    let ruin = false;
    if (spike === 'musk') {
      if (c.status === 'infertile') outcome = 'musk_useless';
      else {
        c.musk++;
        if (c.status === 'pregnant') {
          if (rand() < R.muskMiscarryChance) { outcome = 'miscarry_musk'; fav = R.fx.miscarry; label = '小產'; c.status = 'normal'; c.preg = 0; ruin = true; }
          else { outcome = 'musk_miss'; label = `麝香 ${c.musk}/${R.muskDoses}`; }
        } else if (c.musk >= R.muskDoses) { outcome = 'musk_infertile'; fav = R.fx.infertile; label = '不孕'; c.status = 'infertile'; ruin = true; }
        else { outcome = 'musk_dose'; label = `麝香 ${c.musk}/${R.muskDoses}`; }
      }
    } else if (spike === 'safflower') {
      if (c.status === 'infertile') outcome = 'safflower_useless';
      else if (c.status === 'pregnant') { outcome = 'miscarry_safflower'; fav = R.fx.saffMiscarry; label = '小產'; c.status = 'infertile'; c.preg = 0; ruin = true; }
      else { outcome = 'safflower_infertile'; fav = R.fx.infertile; label = '不孕'; c.status = 'infertile'; ruin = true; }
    } else if (S.flip !== who) {
      outcome = 'debuff_useless'; // 木薯粉、貓薄荷只在當晚侍寢時發作；送給別人就白費了
    } else {
      outcome = 'debuff';
      c.debuff = spike;
      fav = R.fx[spike];
      label = it.debuff;
    }
    const useless = outcome.endsWith('_useless');
    const favDelta = fav ? addFavor(S, who, fav) : 0;
    if (!useless) {
      S.stats.success++;
      if (!S.stats.victims.includes(who)) S.stats.victims.push(who);
    }
    if (ruin && !S.stats.ruined.includes(who)) S.stats.ruined.push(who);
    if (ruin && spike === 'musk') S.stats.muskRuin++;
    S.log.push(`第 ${S.day} 天：${charName(D, who)} ← ${it.name}（${useless ? '無效' : label}）`);
    return { outcome, useless, favDelta, label, dose: c.musk };
  }

  // ───────── 夜晚結算 ─────────
  // 引擎變更全部狀態（含 S.dayLog 字串）並回傳結構化報告；
  // 外殼依報告組對話 lines（見 renderNightLines），引擎不碰對話。
  // rand 擲骰語意順序：枕邊風 → 有喜（被抓／小產發生在白天的 applySpike）。
  function settleNight(D, S, { sing, rand }) {
    const R = D.RULES;
    const who = S.flip;
    const grounded = S.day <= S.groundUntil;
    const report = { who, grounded, sing, serve: null, pillow: null, conceived: null, births: [], empressQueued: false };
    let conceived = null;
    let servedLing = false;
    if (!who) {
      // 今晚不翻牌子，無侍寢
    } else if (who === 'lingrong') {
      if (grounded) {
        report.serve = { target: 'lingrong', favDelta: 0, kind: 'grounded' };
      } else {
        const d = addFavor(S, 'lingrong', R.serveFavor + (sing ? R.singExtraFavor : 0));
        S.dayLog.push(`零溶侍寢${sing ? '並演唱金縷衣' : ''}，恩寵 +${d}`);
        S.tired = sing;
        if (sing) S.stats.sings++;
        servedLing = true;
        report.serve = { target: 'lingrong', favDelta: d, kind: sing ? 'sing' : 'serve' };
      }
    } else {
      const c = S.conc[who];
      const name = charName(D, who);
      if (c.debuff) {
        const d = addFavor(S, who, R.serveFailFavor);
        S.dayLog.push(`${name}侍寢出包，恩寵 ${d}`);
        report.serve = { target: who, favDelta: d, kind: 'debuff', debuff: c.debuff };
      } else {
        const d = addFavor(S, who, R.serveFavor);
        S.dayLog.push(`${name}侍寢，恩寵 +${d}`);
        report.serve = { target: who, favDelta: d, kind: 'serve' };
        if (rand() < pillowChance(D, S, who)) {
          const g = addFavor(S, 'lingrong', R.pillowFavor);
          S.dayLog.push(`${name}吹了枕邊風，零溶恩寵 +${g}`);
          report.pillow = { favDelta: g };
        }
        if (c.status === 'normal' && rand() < R.pregnancyChance) {
          c.status = 'pregnant';
          c.preg = 0;
          conceived = who;
          report.conceived = who;
          S.dayLog.push(`${name}有喜了`);
        }
      }
    }
    // 懷孕進度（當晚受孕者該夜不 +preg）
    D.TARGETS.forEach((t) => {
      const c = S.conc[t];
      if (c.status !== 'pregnant' || t === conceived) return;
      c.preg++;
      if (c.preg >= R.pregnancyNights) {
        c.status = 'normal';
        c.preg = 0;
        const d = addFavor(S, t, R.birthFavor);
        S.stats.births++;
        report.births.push({ who: t, favDelta: d });
        S.dayLog.push(`${charName(D, t)}誕下皇嗣，恩寵 +${d}`);
      }
    });
    D.TARGETS.forEach((t) => { S.conc[t].debuff = null; });
    // 黃后進言倒數
    if (servedLing) S.noFlipNights = 0;
    else if (++S.noFlipNights >= R.empressNights) {
      S.noFlipNights = 0;
      S.empressBoost = true;
      report.empressQueued = true;
      S.dayLog.push('黃后似乎打算明天替零溶說話……');
    }
    return report;
  }

  // ───────── 流程與各行動 ─────────
  // 純狀態變更（擲骰走注入的 rand），回傳結構化結果/報告；外殼只負責 UI 回饋與路由。
  // 狀態變更（inv/hand/orders/silver/slot/seq/bribe*/favor/friend/stats/dayLog/result/tired/旗標）由此負責。

  // 買材料：足銀 → 扣錢、入庫；銀不足 → { ok:false }
  function buy(D, S, id) {
    const p = D.ITEMS[id].price;
    if (S.silver < p) return { ok: false };
    S.silver -= p;
    invAdd(S, id);
    return { ok: true };
  }

  // 賣素材（§8）：不花時辰。售價一半（無條件捨去）＋每 1 級特性 1 兩；沒有售價的（紅花瓣）和料不收。
  // uid 指定賣哪一份；沒指定先賣一般份。回 { ok, price }，不能賣 → { ok:false }
  const sellPrice = (D, id, tr) => Math.floor((D.ITEMS[id].price || 0) / 2) + traitSum(tr);
  function sell(D, S, id, uid) {
    const it = D.ITEMS[id];
    if (!it || it.type !== 'mat' || !it.price || !(S.inv[id] > 0)) return { ok: false };
    if (uid != null && !S.lots.some((l) => l.uid === uid && l.id === id)) return { ok: false };
    const tr = takeUnit(S, id, uid);
    const price = sellPrice(D, id, tr);
    S.silver += price;
    return { ok: true, price, tr };
  }

  // 賄賂敬事房：足銀且未打點 → 扣錢、加權、記錄；否則 { ok:false, reason }
  function bribe(D, S) {
    const R = D.RULES;
    if (S.bribedToday) return { ok: false, reason: 'done' };
    if (S.silver < R.bribeCost) return { ok: false, reason: 'poor' };
    S.silver -= R.bribeCost;
    S.bribe += R.bribeWeight;
    S.bribedToday = true;
    S.stats.bribes++;
    return { ok: true };
  }

  // 婉拒訂單：移訂單、友好 -、記 dayLog，回 { who }；找不到 → null
  function rejectOrder(D, S, id) {
    const R = D.RULES;
    const o = S.orders.find((x) => x.id === id);
    if (!o) return null;
    S.orders = S.orders.filter((x) => x !== o);
    addFriend(S, o.who, R.rejectFriend);
    S.dayLog.push(`婉拒了${charName(D, o.who)}的訂單，友好 ${R.rejectFriend}`);
    return { who: o.who };
  }

  // 採集：slot++，採 2+(rand<0.5?1:0) 個（各 weightedPick）進 inv，回 { loc, got, ready }
  function gather(D, S, loc, rand) {
    const g = D.GATHER[loc];
    S.slot++;
    const n = 2 + (rand() < 0.5 ? 1 : 0);
    const got = {};
    for (let i = 0; i < n; i++) {
      const id = weightedPick(g.table, rand);
      got[id] = (got[id] || 0) + 1;
      invAdd(S, id);
    }
    const ready = S.orders.filter((o) => !readyItem(S, o) && recipeOk(D, S, o.product));
    S.dayLog.push(`在${g.name}採集：${Object.entries(got).map(([id, c]) => `${itemName(D, id)}×${c}`).join('、')}`);
    return { loc, got, ready };
  }

  // ───────── 採集地下城（回合制潛行；game-design §12）─────────
  // 全部是純函式：隨機只走注入的 rand，run state 可 JSON 序列化。
  // 地形字元：'#' 樹籬（擋路、擋視線）｜'.' 房間地面｜',' 走廊（外觀依地圖 tileset，目前兩張圖都和房間同一種地面）｜'G' 月洞門（可走）
  //          'P' 荷花池左上格、'p' 荷花池其餘格、'F' 花圃、'R' 假山、'L' 石燈籠（擋路、不擋視線）
  // 八方向動作 → 位移（也匯出成 GATHER_DIRS，給外殼的撞牆提示與 tools/gather-bot.js 共用）
  // 凍結：對外匯出（GATHER_DIRS）給外殼與機器人共用，不能讓外面改到引擎的移動規則
  const G_DIRS = Object.freeze(Object.fromEntries(Object.entries({ n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0], nw: [-1, -1] }).map(([k, v]) => [k, Object.freeze(v)])));
  // 尋路／巡邏的固定方向順序（直向優先，平手時走直的比較自然）
  const G_ORDER = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
  const gTile = (run, x, y) => (x < 0 || y < 0 || x >= run.w || y >= run.h ? '#' : run.tiles[y][x]);
  const gWalk = (run, x, y) => { const t = gTile(run, x, y); return t === '.' || t === ',' || t === 'G'; };
  const gOpaque = (run, x, y) => gTile(run, x, y) === '#';
  const gFace = (dx, dy, prev) => (dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : dy > 0 ? 'down' : prev);

  // 能不能從 (x,y) 往 (dx,dy) 走一格：目標可走，且斜走時兩個直向鄰格都可走（不能斜切牆角）。只看地形。
  function gatherCanStep(run, x, y, dx, dy) {
    if (!gWalk(run, x + dx, y + dy)) return false;
    if (dx && dy && (!gWalk(run, x + dx, y) || !gWalk(run, x, y + dy))) return false;
    return true;
  }

  // 從 (sx,sy) 出發的 8 方向 BFS 步數表（走不到 = -1）。blocked：額外視為擋路的格子索引集合。
  function gatherDist(run, sx, sy, blocked) {
    const dist = new Array(run.w * run.h).fill(-1);
    dist[sy * run.w + sx] = 0;
    const queue = [[sx, sy]];
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      const d = dist[y * run.w + x];
      for (const [dx, dy] of G_ORDER) {
        const k = (y + dy) * run.w + x + dx;
        if (!gatherCanStep(run, x, y, dx, dy) || dist[k] >= 0 || (blocked && blocked.has(k))) continue;
        dist[k] = d + 1;
        queue.push([x + dx, y + dy]);
      }
    }
    return dist;
  }

  // 視線（Bresenham）：中途的格子不能是樹籬；斜穿時兩側都是樹籬也算擋住。終點本身不檢查（看得到牆面）。
  function gLos(run, x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    for (;;) {
      if (x === x1 && y === y1) return true;
      if ((x !== x0 || y !== y0) && gOpaque(run, x, y)) return false;
      const e2 = 2 * err;
      const stepX = e2 > -dy;
      const stepY = e2 < dx;
      if (stepX && stepY && gOpaque(run, x + sx, y) && gOpaque(run, x, y + sy)) return false;
      if (stepX) { err -= dy; x += sx; }
      if (stepY) { err += dx; y += sy; }
    }
  }
  // 互相看得到才算看得到：Bresenham 兩個方向經過的格子不一定相同，兩邊都試，確保「侍衛看得到我 ⇔ 我看得到侍衛」
  const gSees = (run, x0, y0, x1, y1, r) => (x1 - x0) ** 2 + (y1 - y0) ** 2 <= r * r && (gLos(run, x0, y0, x1, y1) || gLos(run, x1, y1, x0, y0));

  // 從 (x,y) 以半徑 r 看得到的格子索引（y*w+x）陣列，含牆面。玩家視野與侍衛視野共用。
  function gatherFov(run, x, y, r) {
    const out = [];
    const R = Math.ceil(r);
    for (let yy = Math.max(0, y - R); yy <= Math.min(run.h - 1, y + R); yy++) {
      for (let xx = Math.max(0, x - R); xx <= Math.min(run.w - 1, x + R); xx++) {
        if (gSees(run, x, y, xx, yy, r)) out.push(yy * run.w + xx);
      }
    }
    return out;
  }
  function gMarkSeen(run) {
    for (const k of gatherFov(run, run.player.x, run.player.y, run.cfg.playerSight)) run.seen[k] = 1;
  }

  // 生成一張地下城（一次嘗試）。格局：2 欄 × 4 列的區塊，每個選中的區塊放一個庭院，
  // 入口庭院在最下列、上半部至少 2 個庭院（地圖有縱深），再用 L 形走廊串成樹＋1 條環路。
  function gGenerate(D, loc, rand) {
    const g = D.GATHER[loc];
    const c = g.dungeon;
    const W = c.w;
    const H = c.h;
    const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
    const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
    const grid = Array.from({ length: H }, () => new Array(W).fill('#'));

    // 區塊
    const COLS = 2;
    const ROWS = 4;
    const cw = Math.floor((W - 1) / COLS) - 1; // 區塊內寬（25 → 11）
    const ch = Math.floor((H - 3) / ROWS); // 區塊高（31 → 7）
    const cell = (cx, cy) => ({ cx, cy });
    const n = Math.max(3, Math.min(COLS * ROWS, ri(c.rooms[0], c.rooms[1])));
    const entrance = cell(ri(0, COLS - 1), ROWS - 1);
    const tops = shuffle([cell(0, 0), cell(1, 0), cell(0, 1), cell(1, 1)]);
    const chosen = [entrance, tops[0], tops[1]];
    const rest = [];
    for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
      if (!chosen.some((q) => q.cx === cx && q.cy === cy)) rest.push(cell(cx, cy));
    }
    shuffle(rest);
    while (chosen.length < n) chosen.push(rest.pop());

    // 庭院
    const rooms = chosen.map(({ cx, cy }) => {
      const w = ri(Math.min(c.roomW[0], cw), Math.min(c.roomW[1], cw));
      const h = ri(Math.min(c.roomH[0], ch - 2), Math.min(c.roomH[1], ch - 2));
      const x = 1 + cx * (cw + 1) + ri(0, cw - w);
      const y = 1 + cy * ch + ri(0, ch - 1 - h);
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) grid[yy][xx] = '.';
      return { x, y, w, h };
    });
    const center = (r) => [r.x + r.w / 2, r.y + r.h / 2];
    const gap = (a, b) => Math.abs(center(a)[0] - center(b)[0]) + Math.abs(center(a)[1] - center(b)[1]);

    // 走廊：L 形、1 格寬，只挖樹籬
    const carve = (a, b) => {
      const ax = ri(a.x, a.x + a.w - 1);
      const ay = ri(a.y, a.y + a.h - 1);
      const bx = ri(b.x, b.x + b.w - 1);
      const by = ri(b.y, b.y + b.h - 1);
      const dig = (x, y) => { if (grid[y][x] === '#') grid[y][x] = ','; };
      const hFirst = rand() < 0.5;
      const cornerX = hFirst ? bx : ax;
      const cornerY = hFirst ? ay : by;
      for (let x = Math.min(ax, cornerX); x <= Math.max(ax, cornerX); x++) dig(x, ay);
      for (let y = Math.min(ay, cornerY); y <= Math.max(ay, cornerY); y++) dig(ax === cornerX ? ax : cornerX, y);
      for (let x = Math.min(cornerX, bx); x <= Math.max(cornerX, bx); x++) dig(x, by);
      for (let y = Math.min(cornerY, by); y <= Math.max(cornerY, by); y++) dig(bx, y);
    };
    const linked = [0];
    const links = new Set();
    const todo = rooms.map((_, i) => i).slice(1);
    while (todo.length) {
      let best = null;
      for (const t of todo) for (const l of linked) {
        const d = gap(rooms[t], rooms[l]);
        if (!best || d < best.d) best = { t, l, d };
      }
      carve(rooms[best.l], rooms[best.t]);
      links.add(`${Math.min(best.t, best.l)}-${Math.max(best.t, best.l)}`);
      linked.push(best.t);
      todo.splice(todo.indexOf(best.t), 1);
    }
    const spare = [];
    for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) if (!links.has(`${i}-${j}`)) spare.push([i, j]);
    // 環路：再接 loops 組最近但還沒直接相連的庭院，讓路線有得選、深處不會遠到走不到
    spare.sort((a, b) => gap(rooms[a[0]], rooms[a[1]]) - gap(rooms[b[0]], rooms[b[1]]));
    spare.slice(0, c.loops).forEach(([i, j]) => carve(rooms[i], rooms[j]));

    // 月洞門：入口庭院底牆，玩家出生點
    const er = rooms[0];
    const gx = ri(er.x, er.x + er.w - 1);
    const gy = er.y + er.h;
    grid[gy][gx] = 'G';

    const run = {
      loc, w: W, h: H, tiles: null, rooms,
      rare: g.rare || g.table.reduce((a, b) => (b[1] < a[1] ? b : a))[0],
      player: { x: gx, y: gy, face: 'up' },
      items: [], guards: [],
      maxSteps: c.steps, stepsLeft: c.steps, got: {}, haul: [], picked: 0,
      seen: new Array(W * H).fill(0), over: false, endReason: null, caughtBy: -1,
      cfg: { guardSight: c.guardSight, playerSight: c.playerSight, searchTurns: c.searchTurns, wanderKeep: c.wanderKeep, wanderIdle: c.wanderIdle, guardSpawns: Array.from(c.guardSpawns, (sp) => ({ ...sp })) },
    };
    const sync = () => { run.tiles = grid.map((row) => row.join('')); };
    sync();
    const walkCount = () => grid.reduce((s, row) => s + row.filter((t) => t === '.' || t === ',' || t === 'G').length, 0);
    const connected = () => gatherDist(run, gx, gy).filter((d) => d >= 0).length === walkCount();

    // 擺設：只放庭院內圈（不貼庭院邊緣），放完若切斷連通就拿掉
    for (const r of rooms) {
      const count = ri(0, 2);
      for (let i = 0; i < count; i++) {
        if (r.w < 3 || r.h < 3) continue;
        const px = ri(r.x + 1, r.x + r.w - 2);
        const py = ri(r.y + 1, r.y + r.h - 2);
        const kind = rand();
        const pond = kind < 0.3 && px + 1 <= r.x + r.w - 2 && py + 1 <= r.y + r.h - 2;
        const cells = pond ? [[px, py, 'P'], [px + 1, py, 'p'], [px, py + 1, 'p'], [px + 1, py + 1, 'p']] : [[px, py, kind < 0.55 ? 'F' : kind < 0.8 ? 'R' : 'L']];
        if (cells.some(([x, y]) => grid[y][x] !== '.')) continue;
        cells.forEach(([x, y, t]) => { grid[y][x] = t; });
        sync();
        if (!connected()) { cells.forEach(([x, y]) => { grid[y][x] = '.'; }); sync(); }
      }
    }

    // 可放素材的格子：庭院空地＋走廊（月洞門不放）。素材不擋路，放哪都不影響連通
    const dist = gatherDist(run, gx, gy);
    const free = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if ((grid[y][x] === '.' || grid[y][x] === ',') && dist[y * W + x] >= 1) free.push([x, y]);
    }
    const take = (ok) => {
      const pool = free.map((cell_, i) => i).filter((i) => !ok || ok(free[i]));
      if (!pool.length) return null;
      return free.splice(pool[Math.floor(rand() * pool.length)], 1)[0];
    };

    // 素材：出生點附近先保證 1 個常見素材；稀有隨機放（只要求在步數預算內走得到）；
    // 其餘每種至少 1 個，再多撒幾個常見的。庭院、走廊都可能有
    const put = (id, cell_) => { if (cell_) run.items.push({ id, rare: id === run.rare, x: cell_[0], y: cell_[1] }); };
    const commons = g.table.filter(([id]) => id !== run.rare);
    const near = ([x, y]) => dist[y * W + x] <= c.nearItem;
    const reach = ([x, y]) => dist[y * W + x] <= c.steps * c.rareReach;
    put(weightedPick(commons, rand), take(near));
    for (let i = 0; i < c.rareCount; i++) put(run.rare, take(reach));
    for (const [id] of commons) put(id, take());
    const extra = ri(c.extraItems[0], c.extraItems[1]);
    for (let i = 0; i < extra; i++) put(weightedPick(commons, rand), take());

    // 特性：越深處（離出生點步數越多）等級越高。放完素材才擲，不影響上面的擺放
    const farthest = Math.max(1, ...run.items.map((it) => dist[it.y * W + it.x]));
    run.items.forEach((it) => { it.tr = rollTraits(D, it.id, dist[it.y * W + it.x] / farthest, rand); });

    // 侍衛不在這裡生成：走滿指定步數後才由 gatherStep 放進場（見 gSpawnCell）
    gMarkSeen(run);
    return run;
  }

  // 生成結果是否滿足 §12.2 的不變式（重試與保底用；測試另有一份獨立的檢查）
  function gValid(D, run) {
    const g = D.GATHER[run.loc];
    const c = g.dungeon;
    const dist = gatherDist(run, run.player.x, run.player.y);
    const at = (o) => dist[o.y * run.w + o.x];
    let walk = 0;
    for (let y = 0; y < run.h; y++) for (let x = 0; x < run.w; x++) if (gWalk(run, x, y)) walk++;
    if (dist.filter((d) => d >= 0).length !== walk) return false;
    if (g.table.some(([id]) => !run.items.some((it) => it.id === id))) return false;
    if (run.items.filter((it) => it.rare).length !== c.rareCount) return false;
    if (run.items.some((it) => at(it) < 0)) return false;
    // 出生點附近要有素材；稀有素材要在步數預算內走得到（留一點餘裕），不然「往深處走」就不是選項
    if (!run.items.some((it) => at(it) >= 1 && at(it) <= c.nearItem)) return false;
    if (run.items.some((it) => it.rare && at(it) > c.steps * c.rareReach)) return false;
    return true;
  }

  // 採集地下城・生成：回 run state（見 gGenerate）。不合格就用同一個 rand 重骰，
  // 最後退回內建固定種子的保底布局（同樣要過不變式）。
  function buildGatherDungeon(D, S, loc, rand) {
    for (let i = 0; i < 20; i++) {
      const run = gGenerate(D, loc, rand);
      if (gValid(D, run)) return run;
    }
    for (let seed = 1; ; seed++) {
      let s = seed * 2654435761 >>> 0;
      const fixed = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
      const run = gGenerate(D, loc, fixed);
      if (gValid(D, run) || seed >= 200) return run;
    }
  }

  // 幫新登場的侍衛挑位置：離玩家至少 minDist 格（直線格數，所以走路也至少這麼遠）、走得到玩家。
  // 優先挑不超過 maxDist 且玩家當下看不到的格子（不要憑空冒在眼前、也不要遠到整趟遇不到），挑不到再放寬。
  function gSpawnCell(run, spec, rand) {
    const p = run.player;
    const dist = gatherDist(run, p.x, p.y);
    const inView = new Set(gatherFov(run, p.x, p.y, run.cfg.playerSight));
    const far = [];
    const ok = [];
    const best = [];
    for (let y = 0; y < run.h; y++) for (let x = 0; x < run.w; x++) {
      const k = y * run.w + x;
      const d = Math.max(Math.abs(x - p.x), Math.abs(y - p.y));
      if (dist[k] < 0 || d < spec.minDist || run.guards.some((gd) => gd.x === x && gd.y === y)) continue;
      far.push([x, y]);
      if (spec.maxDist && d > spec.maxDist) continue;
      ok.push([x, y]);
      if (!inView.has(k)) best.push([x, y]);
    }
    const pool = best.length ? best : ok.length ? ok : far;
    return pool.length ? pool[Math.floor(rand() * pool.length)] : null;
  }

  // 採集地下城・推進一回合。action：'n','ne','e','se','s','sw','w','nw'（走一格）、'wait'（原地等）、'quit'（收工）。
  // 直接改 run，回傳事件清單給外殼播動畫／音效：
  //   {t:'bump'}｜{t:'move',from,to}｜{t:'wait'}｜{t:'pick',id,rare,x,y}
  //   {t:'spawn',g,x,y}｜{t:'gmove',g,from,to}｜{t:'alert',g}｜{t:'lost',g}｜{t:'calm',g}｜{t:'caught',g,self?}｜{t:'timeout'}｜{t:'quit'}
  // 順序：玩家行動 → 撿取 → 扣步、更新已探索 → 每名侍衛（抓人判定 → 感知 → 走一格）→ 新侍衛登場 → 步數用完。
  function gatherStep(run, action, rand) {
    if (run.over) return [];
    const ev = [];
    const p = run.player;
    if (action === 'quit') {
      run.over = true;
      run.endReason = 'quit';
      return [{ t: 'quit' }];
    }
    if (action === 'wait') {
      ev.push({ t: 'wait' });
    } else {
      const d = G_DIRS[action];
      if (!d) return [];
      const [dx, dy] = d;
      p.face = gFace(dx, dy, p.face);
      const tx = p.x + dx;
      const ty = p.y + dy;
      if (!gatherCanStep(run, p.x, p.y, dx, dy)) return [{ t: 'bump' }];
      // 自己撞上侍衛：當場被抓（零溶不移動）
      const hit = run.guards.findIndex((gd) => gd.x === tx && gd.y === ty);
      if (hit >= 0) {
        run.guards[hit].face = gFace(-dx, -dy, run.guards[hit].face);
        run.over = true;
        run.endReason = 'caught';
        run.caughtBy = hit;
        return [{ t: 'caught', g: hit, self: true }];
      }
      ev.push({ t: 'move', from: { x: p.x, y: p.y }, to: { x: tx, y: ty } });
      p.x = tx;
      p.y = ty;
      const i = run.items.findIndex((it) => it.x === tx && it.y === ty);
      if (i >= 0) {
        const [it] = run.items.splice(i, 1);
        run.got[it.id] = (run.got[it.id] || 0) + 1;
        (run.haul = run.haul || []).push({ id: it.id, tr: it.tr || {} });
        run.picked++;
        ev.push({ t: 'pick', id: it.id, rare: it.rare, x: tx, y: ty, tr: it.tr || {} });
      }
    }
    run.stepsLeft--;
    gMarkSeen(run);

    const sight = run.cfg.guardSight;
    const spot = (gd, gi) => {
      if (!gSees(run, gd.x, gd.y, p.x, p.y, sight)) return false;
      if (gd.state !== 'chase') ev.push({ t: 'alert', g: gi });
      gd.state = 'chase';
      gd.last = { x: p.x, y: p.y };
      return true;
    };
    const walkTo = (gd, gi, dx, dy) => {
      ev.push({ t: 'gmove', g: gi, from: { x: gd.x, y: gd.y }, to: { x: gd.x + dx, y: gd.y + dy } });
      gd.x += dx;
      gd.y += dy;
      gd.dir = [dx, dy];
      gd.face = gFace(dx, dy, gd.face);
    };
    for (let gi = 0; gi < run.guards.length; gi++) {
      const gd = run.guards[gi];
      const ax = p.x - gd.x;
      const ay = p.y - gd.y;
      // 抓人：回合開始時能合法一步走到玩家身上
      if (Math.max(Math.abs(ax), Math.abs(ay)) === 1 && gatherCanStep(run, gd.x, gd.y, ax, ay)) {
        gd.face = gFace(ax, ay, gd.face);
        run.over = true;
        run.endReason = 'caught';
        run.caughtBy = gi;
        ev.push({ t: 'caught', g: gi });
        return ev;
      }
      spot(gd, gi);
      const taken = (x, y) => (x === p.x && y === p.y) || run.guards.some((o) => o !== gd && o.x === x && o.y === y);
      if (gd.state === 'chase') {
        if (gd.x === gd.last.x && gd.y === gd.last.y) {
          // 走到最後看見的位置還是沒人 → 跟丟，原地張望
          gd.state = 'search';
          gd.searchLeft = run.cfg.searchTurns;
          gd.dir = null;
          ev.push({ t: 'lost', g: gi });
        } else {
          const blocked = new Set(run.guards.filter((o) => o !== gd).map((o) => o.y * run.w + o.x));
          const dist = gatherDist(run, gd.last.x, gd.last.y, blocked);
          let best = null;
          for (const [dx, dy] of G_ORDER) {
            const k = (gd.y + dy) * run.w + gd.x + dx;
            if (!gatherCanStep(run, gd.x, gd.y, dx, dy) || dist[k] < 0 || taken(gd.x + dx, gd.y + dy)) continue;
            if (!best || dist[k] < best.d) best = { dx, dy, d: dist[k] };
          }
          const here = dist[gd.y * run.w + gd.x];
          if (best && (here < 0 || best.d < here)) walkTo(gd, gi, best.dx, best.dy);
        }
      } else if (gd.state === 'search') {
        gd.face = ['down', 'left', 'up', 'right'][Math.floor(rand() * 4)];
        if (--gd.searchLeft <= 0) { gd.state = 'wander'; ev.push({ t: 'calm', g: gi }); }
      } else {
        // 巡邏：多半沿原方向，否則隨機換方向，偶爾停一下
        const open = G_ORDER.filter(([dx, dy]) => gatherCanStep(run, gd.x, gd.y, dx, dy) && !taken(gd.x + dx, gd.y + dy));
        const keep = gd.dir && open.find(([dx, dy]) => dx === gd.dir[0] && dy === gd.dir[1]);
        const roll = rand();
        if (keep && roll < run.cfg.wanderKeep) walkTo(gd, gi, keep[0], keep[1]);
        else if (open.length && rand() >= run.cfg.wanderIdle) { const [dx, dy] = open[Math.floor(rand() * open.length)]; walkTo(gd, gi, dx, dy); }
        else gd.dir = null;
      }
      // 走完再看一次：剛好走進視野就立刻警戒（下一回合才抓得到人）
      if (gd.state !== 'search' || gd.searchLeft < run.cfg.searchTurns) spot(gd, gi);
    }
    // 侍衛登場：走滿指定步數後，出現在離玩家當下位置夠遠的地方（登場那回合不行動）
    const spawns = run.cfg.guardSpawns || [];
    while (run.guards.length < spawns.length && run.maxSteps - run.stepsLeft >= spawns[run.guards.length].step) {
      const cell_ = gSpawnCell(run, spawns[run.guards.length], rand);
      if (!cell_) break;
      run.guards.push({ x: cell_[0], y: cell_[1], face: 'down', state: 'wander', dir: null, last: null, searchLeft: 0 });
      ev.push({ t: 'spawn', g: run.guards.length - 1, x: cell_[0], y: cell_[1] });
    }
    if (run.stepsLeft <= 0) {
      run.over = true;
      run.endReason = 'timeout';
      ev.push({ t: 'timeout' });
    }
    return ev;
  }

  // 採集小遊戲・收穫套用（純函式，無 rand）：把這趟撿到的 got 加進包包、slot++、推 dayLog、回 ready。
  // haul（run.haul，每份的 {id,tr}）有給就照份放進去，帶特性的進 S.lots；沒給就照 got 的數量放一般份（模擬器用）。
  // got 空（被抓／逾時卻兩手空空）→ inv 不變、仍 slot++、dayLog 記「空手而回」。
  function applyGatherHaul(D, S, loc, got, haul) {
    const g = D.GATHER[loc];
    S.slot++;
    const entries = Object.entries(got || {}).filter(([, c]) => c > 0);
    if (haul) haul.forEach((h) => addUnit(S, h.id, h.tr));
    else for (const [id, c] of entries) invAdd(S, id, c);
    const ready = S.orders.filter((o) => !readyItem(S, o) && recipeOk(D, S, o.product));
    S.dayLog.push(entries.length
      ? `在${g.name}採集：${entries.map(([id, c]) => `${itemName(D, id)}×${c}`).join('、')}`
      : `在${g.name}空手而回`);
    return { loc, got: got || {}, haul: haul || [], ready };
  }

  // 調合（確定性，無 rand）：slot++、放進去的 2～3 樣素材各 -1、findRecipe→成品或 junk；成品入 hand/inv。
  // craftSel.lots：與 mats 同位置的素材份 uid（null／省略 → 自動挑特性最多的那份，沒有就用一般份）。
  // craftSel.stirs：攪拌挑的泡泡 [{t,v}]；craftSel.finish：起鍋結果 'up'|'keep'|'down'（兩者省略＝快速調合）。
  // 成品特性見 finalTraits；黑暗料理和紅花沒有特性。
  function craft(D, S, craftSel) {
    const mats = craftSel.mats.filter(Boolean);
    S.slot++;
    const chosen = [];
    const used = mats.map((id, i) => {
      let uid = craftSel.lots && craftSel.lots[i] != null ? craftSel.lots[i] : null;
      if (uid == null) { const b = bestLot(S, id, chosen); uid = b ? b.uid : null; }
      if (uid != null) chosen.push(uid);
      return [id, uid];
    });
    const trs = used.map(([id, uid]) => takeUnit(S, id, uid));
    const product = findRecipe(D, mats) || 'junk';
    if (product === 'junk') S.stats.junk++;
    const toInv = D.PRODUCTS[product].out === 'inv';
    const spike = toInv ? null : craftSel.spike;
    if (spike) invAdd(S, spike, -1);
    if (toInv) invAdd(S, product);
    const tr = product === 'junk' ? {} : finalTraits(D, trs, craftSel.stirs, craftSel.finish);
    if (isPerfect(D, tr)) bump(S, 'perfect');
    const item = toInv ? null : { id: ++S.seq, product, spike: product === 'junk' ? null : spike, forOrder: null, tr };
    // 從訂單進來的就送那張訂單；否則先找調合時預測的對象（forWho）要這個成品、還沒備好的訂單，
    // 再找任何還沒備好的同品項訂單。找到就把成品綁在那張訂單上。
    const open = (o) => o.product === product && !readyItem(S, o);
    const order = S.orders.find((o) => o.id === craftSel.forOrder && o.product === product)
      || S.orders.find((o) => open(o) && o.who === craftSel.forWho)
      || S.orders.find(open)
      || null;
    if (item) { if (order) item.forOrder = order.id; S.hand.push(item); }
    S.dayLog.push(product === 'junk' ? '調合失敗，做出一坨黑黑的東西' : `調合了${itemName(D, product)}${spike ? `（加了${itemName(D, spike)}）` : ''}`);
    return { product, spike, toInv, lostSpike: product === 'junk' && spike, order, itemId: item && item.id, tr: item ? item.tr : {} };
  }

  // 交貨：移訂單＋手牌，applySpike，未被抓給 reward（無效×uselessRewardRate）＋deliverFriend，設 S.result。
  // itemId：指定要送哪一個成品（剛調合好的那個）；沒指定就送最新做好的。找不到成品 → { noItem:true }
  // how：'self' 親自交（花 1 時辰、賞銀＋友好 5＋特性總和每 3 級 +1）；'proxy' 包捐代交（不花時辰、只拿賞銀，禁足也能用）
  function deliver(D, S, orderId, itemId, rand, how = 'self') {
    const R = D.RULES;
    const proxy = how === 'proxy';
    const order = S.orders.find((o) => o.id === orderId);
    const item = order && ((itemId && S.hand.find((h) => h.id === itemId && canFill(S, order, h))) || readyItem(S, order));
    if (!item) return { noItem: true };
    if (!proxy) S.slot++;
    S.orders = S.orders.filter((o) => o !== order);
    S.hand = S.hand.filter((h) => h !== item);
    const who = order.who;
    const res = applySpike(D, S, who, item.spike, 'deliver', rand, item.tr);
    bump(S, proxy ? 'proxyDeliver' : 'selfDeliver');
    markYuanzhu(S, who, item, res);
    let reward = 0;
    let friendDelta = res.friendDelta || 0;
    if (!res.caught) {
      const base = D.PRODUCTS[item.product].reward;
      reward = res.useless ? Math.round(base * R.uselessRewardRate) : base;
      if (!res.useless && !proxy) friendDelta = addFriend(S, who, R.deliverFriend + Math.floor(traitSum(item.tr) / R.deliverTraitStep));
      S.silver += reward;
    }
    S.result = { kind: 'deliver', who, product: item.product, spike: item.spike, reward, friendDelta, proxy, ...res };
    S.dayLog.push(`${proxy ? '包捐代交' : '交貨'}給${charName(D, who)}：${res.caught ? '被抓！' : `賞銀 +${reward}`}${res.label ? `，${res.label}` : ''}`);
    return S.result;
  }

  // ───────── 教學模式（§15.2）─────────
  // 第一天擺成教學局面：沒有桂花（得去御花園採）、訂單只有真環的藕粉桂花糖糕。在 startDay 之後呼叫。
  function setupTutorial(D, S) {
    S.tutorial = { step: 'gather' };
    S.inv.osmanthus = 0;
    S.lots = S.lots.filter((l) => l.id !== 'osmanthus');
    if (!(S.inv.lotus > 0)) S.inv.lotus = 1;
    S.orders = [{ id: ++S.seq, who: 'zhenhuan', product: 'cake', due: S.day + D.RULES.orderDays - 1 }];
    return S.orders[0];
  }

  // ───────── 禁足抄經（§15.5）─────────
  const SUTRA_PUNCT = /[，。、！？；：「」]/;
  // 一句拆成字塊：去掉標點、打亂（rand 注入）。回 [{ ch, i }]，i＝這個字在句中（不含標點）的順序
  function sutraTiles(line, rand) {
    const tiles = [...line].filter((c) => !SUTRA_PUNCT.test(c)).map((ch, i) => ({ ch, i }));
    for (let k = tiles.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [tiles[k], tiles[j]] = [tiles[j], tiles[k]]; }
    return tiles;
  }
  // 抄完一句：只有禁足能抄；花 1 時辰、抄經次數 +1、手上多一本《後宮心經》
  function copySutra(D, S) {
    if (!(S.day <= S.groundUntil)) return { blocked: true };
    S.slot++;
    S.stats.sutras = (S.stats.sutras || 0) + 1;
    const item = { id: ++S.seq, product: 'sutra', spike: null, forOrder: null, tr: {} };
    S.hand.push(item);
    S.dayLog.push('抄了一本《後宮心經》');
    return { ok: true, itemId: item.id };
  }

  // 拜訪各宮：花 1 時辰。handId 空＝空手（友好 +1，不擲骰）；帶禮：rand>=收禮機率 → 拒收（禮物退回）；
  // 收下 → applySpike＋伴手禮友好（加料的禮誰都能收）。junk 不能送 → { noItem:true }
  function visit(D, S, who, handId, rand) {
    if (handId == null) {
      S.slot++;
      const friendDelta = addFriend(S, who, D.RULES.visitEmptyFriend);
      S.result = { kind: 'gift', who, empty: true, friendDelta, reward: 0 };
      S.dayLog.push(`空手拜訪${charName(D, who)}`);
      return S.result;
    }
    const item = S.hand.find((h) => h.id === handId);
    if (!item || item.product === 'junk') return { noItem: true };
    S.slot++;
    if (D.PRODUCTS[item.product].fixedGift) {
      // 《後宮心經》：品質固定，送誰都 +gift、一定收下（不擲骰、不看喜好）
      S.hand = S.hand.filter((h) => h !== item);
      const friendDelta = addFriend(S, who, D.PRODUCTS[item.product].gift);
      S.result = { kind: 'gift', who, product: item.product, spike: null, reaction: 'fixed', friendDelta, reward: 0, outcome: 'plain' };
      S.dayLog.push(`拜訪${charName(D, who)}，送了${itemName(D, item.product)}`);
      return S.result;
    }
    const reaction = giftReaction(D, who, item.product, item.tr).kind;
    if (rand() >= acceptChance(D, S, who, reaction)) {
      S.result = { kind: 'gift', who, product: item.product, spike: item.spike, refused: true, reaction, friendDelta: 0 };
      S.dayLog.push(`拜訪${charName(D, who)}，禮被拒收`);
      return S.result;
    }
    S.hand = S.hand.filter((h) => h !== item);
    const res = applySpike(D, S, who, item.spike, 'gift', rand, item.tr);
    markYuanzhu(S, who, item, res);
    let friendDelta = res.friendDelta || 0;
    if (!res.caught && !res.useless) friendDelta = addFriend(S, who, giftFriend(D, who, item.product, item.tr));
    if (!res.caught && reaction === 'love') bump(S, 'loves');
    S.result = { kind: 'gift', who, product: item.product, spike: item.spike, reaction, friendDelta, reward: 0, ...res };
    S.dayLog.push(`拜訪${charName(D, who)}，送了${itemName(D, item.product)}${res.caught ? '，被抓！' : res.label ? `，${res.label}` : ''}`);
    return S.result;
  }

  // 開日：重置 dayLog；tired→slot=1；逾期訂單移除＋lateFriend；chooseFlip＋消耗 empressBoost＋重置 bribe；
  // 生成新訂單（weightedPick＋隨機抽對象）。回報告，外殼 renderStartLines 據此組對話。
  // rand 擲骰順序：chooseFlip → weightedPick(orderCountWeights) → 逐張訂單抽對象＋pick(NORMAL_ORDERS)。
  function startDay(D, S, rand) {
    const R = D.RULES;
    S.dayLog = [];
    const report = { tired: false, lapsed: [], grounded: false, boosted: false, flip: null, flipFriend: 0, newOrders: [], noOrders: false };
    if (S.tired) { S.tired = false; S.slot = 1; report.tired = true; }
    // 逾期
    S.orders = S.orders.filter((o) => {
      if (o.due >= S.day) return true;
      addFriend(S, o.who, R.lateFriend);
      report.lapsed.push({ who: o.who, product: o.product });
      S.dayLog.push(`${charName(D, o.who)}的訂單逾期，友好 ${R.lateFriend}`);
      return false;
    });
    const grounded = S.day <= S.groundUntil;
    report.grounded = grounded;
    // 翻牌子
    const boosted = S.empressBoost && !grounded;
    report.boosted = boosted;
    S.flip = chooseFlip(D, S, rand);
    if (boosted) S.empressBoost = false;
    S.bribe = 0;
    S.bribedToday = false;
    report.flip = S.flip;
    if (S.flip && D.TARGETS.includes(S.flip)) report.flipFriend = S.friend[S.flip];
    // 新訂單
    const n = weightedPick(R.orderCountWeights, rand);
    const cands = D.TARGETS.filter((t) => S.orders.filter((o) => o.who === t).length < R.maxOpenOrdersPerChar);
    for (let i = 0; i < n && cands.length; i++) {
      const who = cands.splice(Math.floor(rand() * cands.length), 1)[0];
      let product = S.conc[who].status === 'pregnant' ? 'tonic' : pick(D.NORMAL_ORDERS, rand);
      // 滑妃不知道自己不孕，不時點坐胎藥（只對她多擲一次，別人的骰序不變）
      if (who === 'huafei' && product !== 'tonic' && rand() < R.zuotaiChance) product = 'zuotai';
      S.orders.push({ id: ++S.seq, who, product, due: S.day + R.orderDays - 1 });
      report.newOrders.push({ who, product });
    }
    report.noOrders = (n === 0);
    return report;
  }

  // 進日：day++、slot=0（外殼在 day>=days 時改走結局）
  function advanceDay(D, S) {
    S.day++;
    S.slot = 0;
  }

  const API = {
    newState, TITLE_CHECK, computeEnding, endingStats,
    catchChance, riskLevel, pillowChance, flipWeights, flipOdds, chooseFlip,
    predict, applySpike, settleNight,
    findRecipe, setupTutorial, sutraTiles, copySutra, maskScore, acceptChance, giftReaction, giftFriend, visit, traitSum, bestLot, addUnit, takeUnit, mergeTraits, rollTraits,
    potTraits, rollBubbles, stirTraits, finishZone, jitterZones, applyFinish, finalTraits,
    buy, sell, sellPrice, bribe, rejectOrder, readyItem, gather, buildGatherDungeon, gatherStep, gatherFov, gatherCanStep, gatherDist, GATHER_DIRS: G_DIRS, applyGatherHaul, craft, deliver, startDay, advanceDay,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.GameEngine = API;
})();
