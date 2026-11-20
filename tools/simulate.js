// 平衡模擬器：用機器人玩很多局，統計結果。
// 用法：node tools/simulate.js [局數]
// 規則是照 js/game.js 的邏輯複製過來的；改了遊戲規則（不是數值）時，這裡也要跟著改。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadData() {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8'), ctx);
  return ctx.window.GAME_DATA;
}

// ───────── 一局遊戲 ─────────
function play(D, R, bot, rand) {
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const clamp = (n) => Math.max(0, Math.min(100, n));
  const weightedPick = (table) => {
    const total = table.reduce((s, [, w]) => s + w, 0);
    let r = rand() * total;
    for (const [id, w] of table) { if ((r -= w) < 0) return id; }
    return table[table.length - 1][0];
  };
  const T = D.TARGETS;
  const S = {
    day: 1, slot: 0, silver: R.silver,
    favor: { ...R.favor }, friend: { ...R.friend },
    conc: Object.fromEntries(T.map((t) => [t, { status: R.status[t], preg: 0, musk: 0, debuff: null }])),
    inv: { ...R.startInv }, orders: [], hand: [], seq: 0,
    flip: null, bribe: 0, bribedToday: false, groundUntil: 0,
    noFlipNights: 0, empressBoost: false, tired: false,
    stats: { spikesUsed: 0, success: 0, caught: 0, groundedDays: 0, victims: [], ruined: [] },
    m: { lingFlips: 0, sings: 0, pillow: 0, preg: 0, births: 0, miscarry: 0, infertile: 0, serveFail: 0,
      delivered: 0, late: 0, ordersTotal: 0, bribes: 0, gifts: 0, refused: 0, empress: 0, silverEarned: 0 },
  };
  const have = (id) => S.inv[id] || 0;
  const invAdd = (id, n = 1) => { S.inv[id] = (S.inv[id] || 0) + n; if (S.inv[id] <= 0) delete S.inv[id]; };
  const addFavor = (w, n) => { const b = S.favor[w]; S.favor[w] = clamp(b + n); return S.favor[w] - b; };
  const addFriend = (w, n) => { const b = S.friend[w]; S.friend[w] = clamp(b + n); return S.friend[w] - b; };
  const grounded = () => S.day <= S.groundUntil;
  const catchChance = (who, spike, via) => D.ITEMS[spike].catch
    * Math.max(R.friendCatchFloor, 1 - S.friend[who] / R.friendCatchDivisor)
    * (via === 'deliver' ? R.deliverCatchFactor : 1);
  const pillowChance = (who) => Math.max(0, Math.min(R.pillowMax, S.friend[who] - R.pillowBase)) / 100;
  const acceptChance = (who) => Math.min(100, S.friend[who] + R.giftAcceptBonus) / 100;
  const findRecipe = (a, b) => Object.keys(D.PRODUCTS).find((pid) => {
    const r = D.PRODUCTS[pid].recipe;
    return r && ((r[0] === a && r[1] === b) || (r[0] === b && r[1] === a));
  });
  function flipWeights(bribe = S.bribe) {
    const w = {};
    if (!grounded()) w.lingrong = Math.max(1, S.favor.lingrong) * (S.empressBoost ? R.empressFactor : 1) + bribe;
    T.forEach((t) => { if (S.conc[t].status !== 'pregnant') w[t] = Math.max(1, S.favor[t]); });
    if (S.flip && w[S.flip]) w[S.flip] *= R.repeatFlipFactor;
    return w;
  }

  function applySpike(who, spike, via) {
    if (!spike) return { outcome: 'plain' };
    S.stats.spikesUsed++;
    const it = D.ITEMS[spike];
    if (rand() < catchChance(who, spike, via)) {
      addFriend(who, R.caughtFriend);
      S.groundUntil = Math.max(S.groundUntil, S.day + it.ground);
      S.stats.caught++;
      S.stats.groundedDays += it.ground;
      return { outcome: 'caught', caught: true };
    }
    const c = S.conc[who];
    let outcome; let fav = 0; let ruin = false;
    if (spike === 'musk') {
      if (c.status === 'infertile') outcome = 'musk_useless';
      else {
        c.musk++;
        if (c.status === 'pregnant') {
          if (rand() < R.muskMiscarryChance) { outcome = 'miscarry'; fav = R.fx.miscarry; c.status = 'normal'; c.preg = 0; ruin = true; S.m.miscarry++; }
          else outcome = 'musk_miss';
        } else if (c.musk >= R.muskDoses) { outcome = 'infertile'; fav = R.fx.infertile; c.status = 'infertile'; ruin = true; S.m.infertile++; }
        else outcome = 'musk_dose';
      }
    } else if (spike === 'safflower') {
      if (c.status === 'infertile') outcome = 'saff_useless';
      else if (c.status === 'pregnant') { outcome = 'miscarry'; fav = R.fx.saffMiscarry; c.status = 'infertile'; c.preg = 0; ruin = true; S.m.miscarry++; S.m.infertile++; }
      else { outcome = 'infertile'; fav = R.fx.infertile; c.status = 'infertile'; ruin = true; S.m.infertile++; }
    } else { outcome = 'debuff'; c.debuff = spike; fav = R.fx[spike]; }
    const useless = outcome.endsWith('_useless');
    if (fav) addFavor(who, fav);
    if (!useless) { S.stats.success++; if (!S.stats.victims.includes(who)) S.stats.victims.push(who); }
    if (ruin && !S.stats.ruined.includes(who)) S.stats.ruined.push(who);
    if (ruin && spike === 'musk') S.m.muskRuin = (S.m.muskRuin || 0) + 1;
    return { outcome, useless };
  }

  function startDay() {
    if (S.tired) { S.tired = false; S.slot = 1; }
    S.orders = S.orders.filter((o) => {
      if (o.due >= S.day) return true;
      addFriend(o.who, R.lateFriend); S.m.late++;
      return false;
    });
    const boosted = S.empressBoost && !grounded();
    if (boosted) S.m.empress++;
    const entries = Object.entries(flipWeights());
    S.flip = entries.length ? weightedPick(entries) : null;
    if (boosted) S.empressBoost = false;
    S.bribe = 0; S.bribedToday = false;
    const n = weightedPick(R.orderCountWeights);
    const cands = T.filter((t) => S.orders.filter((o) => o.who === t).length < R.maxOpenOrdersPerChar);
    for (let i = 0; i < n && cands.length; i++) {
      const who = cands.splice(Math.floor(rand() * cands.length), 1)[0];
      const product = S.conc[who].status === 'pregnant' ? 'tonic' : pick(D.NORMAL_ORDERS);
      S.orders.push({ id: ++S.seq, who, product, due: S.day + R.orderDays - 1 });
      S.m.ordersTotal++;
    }
  }

  function settleNight(sing) {
    const who = S.flip;
    let conceived = null; let servedLing = false;
    if (who === 'lingrong') {
      if (!grounded()) {
        addFavor('lingrong', R.serveFavor + (sing ? R.singExtraFavor : 0));
        S.tired = sing; servedLing = true; S.m.lingFlips++; if (sing) S.m.sings++;
      }
    } else if (who) {
      const c = S.conc[who];
      if (c.debuff) { addFavor(who, R.serveFailFavor); S.m.serveFail++; }
      else {
        addFavor(who, R.serveFavor);
        if (rand() < pillowChance(who)) { addFavor('lingrong', R.pillowFavor); S.m.pillow++; }
        if (c.status === 'normal' && rand() < R.pregnancyChance) { c.status = 'pregnant'; c.preg = 0; conceived = who; S.m.preg++; }
      }
    }
    T.forEach((t) => {
      const c = S.conc[t];
      if (c.status !== 'pregnant' || t === conceived) return;
      if (++c.preg >= R.pregnancyNights) { c.status = 'normal'; c.preg = 0; addFavor(t, R.birthFavor); S.m.births++; }
    });
    T.forEach((t) => { S.conc[t].debuff = null; });
    if (servedLing) S.noFlipNights = 0;
    else if (++S.noFlipNights >= R.empressNights) { S.noFlipNights = 0; S.empressBoost = true; }
  }

  // 給機器人用的動作
  const api = {
    S, D, R, have, grounded, catchChance, acceptChance, findRecipe, rand,
    flipOdds(bribe) {
      const w = flipWeights(bribe);
      const tot = Object.values(w).reduce((a, b) => a + b, 0);
      return (w.lingrong || 0) / tot;
    },
    buy(id) { const p = D.ITEMS[id].price; if (S.silver < p) return false; S.silver -= p; invAdd(id); return true; },
    bribe() {
      if (S.bribedToday || S.silver < R.bribeCost) return false;
      S.silver -= R.bribeCost; S.bribe += R.bribeWeight; S.bribedToday = true; S.m.bribes++; return true;
    },
    gather(loc) {
      if (grounded()) return false;
      S.slot++;
      const n = 2 + (rand() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) invAdd(weightedPick(D.GATHER[loc].table));
      return true;
    },
    craft(a, b, spike) {
      if (have(a) < 1 || have(b) < 1 || (a === b && have(a) < 2)) return false;
      S.slot++;
      invAdd(a, -1); invAdd(b, -1);
      const product = findRecipe(a, b) || 'junk';
      const toInv = D.PRODUCTS[product].out === 'inv';
      const sp = toInv ? null : spike;
      if (sp) invAdd(sp, -1);
      if (toInv) invAdd(product);
      else S.hand.push({ id: ++S.seq, product, spike: product === 'junk' ? null : sp });
      return product;
    },
    deliver(order) {
      if (grounded()) return false;
      const item = S.hand.find((h) => h.product === order.product);
      if (!item) return false;
      S.slot++;
      S.orders = S.orders.filter((o) => o !== order);
      S.hand = S.hand.filter((h) => h !== item);
      const res = applySpike(order.who, item.spike, 'deliver');
      if (!res.caught) {
        const base = D.PRODUCTS[item.product].reward;
        const reward = res.useless ? Math.round(base * R.uselessRewardRate) : base;
        if (!res.useless) addFriend(order.who, R.deliverFriend);
        S.silver += reward; S.m.silverEarned += reward;
      }
      S.m.delivered++;
      return true;
    },
    gift(who, item) {
      if (grounded() || item.product === 'junk') return false;
      if (item.spike && who !== S.flip) return false;
      S.slot++; S.m.gifts++;
      if (rand() >= acceptChance(who)) { S.m.refused++; return 'refused'; }
      S.hand = S.hand.filter((h) => h !== item);
      const res = applySpike(who, item.spike, 'gift');
      if (!res.caught && !res.useless) addFriend(who, D.PRODUCTS[item.product].gift);
      return true;
    },
  };

  for (S.day = 1; S.day <= R.days; S.day++) {
    S.slot = 0;
    startDay();
    let guard = 0;
    while (S.slot < R.slotsPerDay && guard++ < 10) { if (!bot.act(api)) break; }
    bot.evening?.(api);
    settleNight(S.flip === 'lingrong' && !grounded() && bot.sing !== false);
  }
  const f = S.favor; const st = S.stats;
  const rank = 1 + T.filter((t) => f[t] >= f.lingrong).length;
  // 封號（照 js/game.js 的 TITLE_CHECK；調合失敗機器人不會發生，所以沒有 heian）
  const minF = Math.min(...T.map((t) => S.friend[t]));
  const CHECK = {
    shexiang: S.m.muskRuin > 0,
    shuangmian: st.victims.length === 3 && st.caught === 0 && minF >= 35,
    duanzi: ['meizhuang', 'zhenhuan'].every((t) => st.ruined.includes(t)),
    wentaiyi: st.caught >= 2,
    guimi: minF >= 40,
    baimang: st.spikesUsed > 0 && st.success === 0,
    jingshi: S.m.bribes >= 2,
    miaoyin: S.m.sings >= 2,
    bailian: st.spikesUsed === 0,
    heian: false,
    zhongsi: S.m.births > 0,
  };
  const titles = D.TITLES.map((t) => t.id).filter((id) => CHECK[id]);
  const ending = titles[0] || 'touming';
  return { S, rank, ending, titles };
}

// ───────── 機器人 ─────────
// 共通：交貨 > 做訂單 > 採集缺的素材。spikeFor 決定做訂單時要不要加料。
function makeBot({ name, spikeFor, giftSpike = false, bribeReserve = Infinity, bribeSmart = false, sing = true, makeSaff = false, buySpikes = false }) {
  return {
    name, sing,
    act(G) {
      const { S, D, have } = G;
      // 0. 有錢就打點敬事房（明天被翻的機率）
      if (bribeSmart ? S.silver >= G.R.bribeCost && G.flipOdds(0) < 0.35 : S.silver >= G.R.bribeCost + bribeReserve) G.bribe();
      if (buySpikes && S.silver >= 80 && have('stinky') < 1) G.buy('stinky');
      // 1. 交貨
      if (!G.grounded()) {
        const o = S.orders.find((x) => S.hand.some((h) => h.product === x.product));
        if (o) return G.deliver(o);
      }
      // 2. 加料送禮給今晚侍寢的人
      if (giftSpike && !G.grounded() && D.TARGETS.includes(S.flip) && (!bribeSmart || S.favor[S.flip] >= S.favor.lingrong - 10)) {
        // 料要在調合時加進去：手上有加了出包料的成品就送，沒有就先做一個
        const isDebuff = (x) => ['croton', 'itch', 'stinky'].includes(x);
        const ready = S.hand.find((h) => isDebuff(h.spike));
        const safe = (sp) => G.acceptChance(S.flip) >= 0.6 && G.catchChance(S.flip, sp, 'gift') < 0.15;
        if (ready && safe(ready.spike)) return G.gift(S.flip, ready);
        const sp = ['croton', 'itch', 'stinky'].find((x) => have(x) > 0);
        if (!ready && sp && safe(sp) && S.slot < G.R.slotsPerDay - 1) {
          const pid = ['cake', 'incense', 'tea', 'cream'].find((p) => D.PRODUCTS[p].recipe.every((id) => have(id) >= 1));
          if (pid) { const [a, b] = D.PRODUCTS[pid].recipe; return G.craft(a, b, sp); }
        }
      }
      // 3. 做訂單（照期限排序）
      const todo = S.orders.filter((o) => !S.hand.some((h) => h.product === o.product)).sort((a, b) => a.due - b.due);
      for (const o of todo) {
        const [a, b] = D.PRODUCTS[o.product].recipe;
        [a, b].forEach((id) => { if (have(id) < 1 && D.SHOP.includes(id)) G.buy(id); });
        if (have(a) >= 1 && have(b) >= 1) {
          const sp = spikeFor(G, o.who);
          return G.craft(a, b, sp && have(sp) > 0 ? sp : null);
        }
      }
      // 4. 煉紅花
      if (makeSaff && have('petal') > 0 && (have('liquor') > 0 || G.buy('liquor'))) return G.craft('petal', 'liquor');
      // 5. 採集訂單缺的東西
      if (!G.grounded()) {
        const need = new Set();
        todo.forEach((o) => D.PRODUCTS[o.product].recipe.forEach((id) => { if (have(id) < 1) need.add(id); }));
        const inGarden = [...need].some((id) => D.GATHER.garden.table.some(([x]) => x === id));
        const inTaiyi = [...need].some((id) => D.GATHER.taiyi.table.some(([x]) => x === id));
        if (inTaiyi && (!inGarden || G.rand() < 0.5)) return G.gather('taiyi');
        if (inGarden) return G.gather('garden');
        // 沒缺東西：壞心機器人去太醫院找料，其他人去御花園備料
        return G.gather(makeSaff ? 'taiyi' : 'garden');
      }
      return false; // 禁足又沒事做 → 就寢
    },
  };
}

// 精算型的加料判斷：風險低才下手，挑效果最好的料
function smartSpike(G, who) {
  const { S, have } = G;
  const c = S.conc[who];
  const ok = (sp) => have(sp) > 0 && G.catchChance(who, sp, 'deliver') < 0.15;
  if (c.status === 'pregnant') { if (ok('safflower')) return 'safflower'; if (ok('musk')) return 'musk'; }
  if (c.status === 'normal' && ok('safflower')) return 'safflower';
  if (S.flip === who) { const d = ['croton', 'itch', 'stinky'].find(ok); if (d) return d; }
  if (c.status === 'normal' && ok('musk')) return 'musk';
  return ['croton', 'itch', 'stinky'].find(ok) || null;
}

const BOTS = [
  makeBot({ name: '正經', spikeFor: () => null, bribeReserve: 40 }),
  makeBot({ name: '隨手加料', spikeFor: (G) => { const s = ['itch', 'stinky', 'croton', 'musk', 'safflower'].filter((x) => G.have(x) > 0); return s.length && G.rand() < 0.5 ? s[0] : null; }, bribeReserve: 40 }),
  makeBot({ name: '精算', spikeFor: smartSpike, giftSpike: true, bribeReserve: 0, makeSaff: true, buySpikes: true }),
  // 高手：只整恩寵追得上自己的人，打點只在被翻機率低的時候
  makeBot({ name: '高手', spikeFor: (G, who) => (G.S.favor[who] >= G.S.favor.lingrong - 10 ? smartSpike(G, who) : null), giftSpike: true, bribeSmart: true, makeSaff: true, buySpikes: true }),
];

// ───────── 統計 ─────────
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function runVariant(D0, variant, N) {
  const D = JSON.parse(JSON.stringify(D0, (k, v) => (typeof v === 'function' ? undefined : v)));
  const R = { ...D.RULES, ...(variant.rules || {}), fx: { ...D.RULES.fx, ...((variant.rules || {}).fx || {}) } };
  Object.entries(variant.items || {}).forEach(([id, o]) => Object.assign(D.ITEMS[id], o));
  Object.entries(variant.products || {}).forEach(([id, o]) => Object.assign(D.PRODUCTS[id], o));
  const out = {};
  BOTS.forEach((bot, bi) => {
    const rand = mulberry32(1234 + bi);
    const acc = { got: {}, win: 0, rank: 0, ling: 0, top: 0, endings: {}, m: {} , caught: 0, grounded: 0, silver: 0, birthGames: 0 };
    for (let i = 0; i < N; i++) {
      const { S, rank, ending, titles } = play(D, R, bot, rand);
      titles.forEach((id) => { acc.got[id] = (acc.got[id] || 0) + 1; });
      acc.win += rank === 1;
      acc.rank += rank;
      acc.ling += S.favor.lingrong;
      acc.top += Math.max(...D.TARGETS.map((t) => S.favor[t]));
      acc.caught += S.stats.caught;
      acc.grounded += S.stats.groundedDays;
      acc.silver += S.silver;
      acc.birthGames += S.m.births > 0;
      acc.endings[ending] = (acc.endings[ending] || 0) + 1;
      Object.entries(S.m).forEach(([k, v]) => { acc.m[k] = (acc.m[k] || 0) + v; });
    }
    out[bot.name] = {
      winRate: acc.win / N, avgRank: acc.rank / N, ling: acc.ling / N, topRival: acc.top / N,
      caught: acc.caught / N, grounded: acc.grounded / N, silverLeft: acc.silver / N, birthGames: acc.birthGames / N,
      got: Object.fromEntries(Object.entries(acc.got).map(([k, v]) => [k, v / N])),
      endings: Object.fromEntries(Object.entries(acc.endings).map(([k, v]) => [k, v / N])),
      m: Object.fromEntries(Object.entries(acc.m).map(([k, v]) => [k, v / N])),
    };
  });
  return out;
}

module.exports = { loadData, runVariant, BOTS, play, makeBot, smartSpike, mulberry32 };

if (require.main === module) {
  const N = Number(process.argv[2]) || 5000;
  const D = loadData();
  const res = runVariant(D, {}, N);
  for (const [bot, r] of Object.entries(res)) {
    console.log(`\n【${bot}】逆襲成功（恩寵第一） ${(r.winRate * 100).toFixed(1)}%｜平均名次 ${r.avgRank.toFixed(2)}｜零溶恩寵 ${r.ling.toFixed(0)}｜最高對手 ${r.topRival.toFixed(0)}`);
    console.log(`  被翻 ${r.m.lingFlips.toFixed(2)} 次｜打點 ${r.m.bribes.toFixed(2)}｜枕邊風 ${r.m.pillow.toFixed(2)}｜黃后進言 ${r.m.empress.toFixed(2)}｜被抓 ${r.caught.toFixed(2)}｜禁足 ${r.grounded.toFixed(1)} 天`);
    console.log(`  懷孕 ${r.m.preg.toFixed(2)}｜生產 ${r.m.births.toFixed(2)}（${(r.birthGames * 100).toFixed(0)}% 的局看得到）｜小產 ${r.m.miscarry.toFixed(2)}｜不孕 ${r.m.infertile.toFixed(2)}｜侍寢出包 ${r.m.serveFail.toFixed(2)}`);
    console.log(`  訂單 ${r.m.ordersTotal.toFixed(1)}｜交貨 ${r.m.delivered.toFixed(1)}｜逾期 ${r.m.late.toFixed(1)}｜賺 ${r.m.silverEarned.toFixed(0)} 銀｜剩 ${r.silverLeft.toFixed(0)} 銀`);
    const nm = Object.fromEntries(D.TITLES.map((t) => [t.id, t.name]));
    console.log('  主封號', Object.entries(r.endings).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${nm[k]} ${(v * 100).toFixed(0)}%`).join('、'));
    console.log('  拿到過', Object.entries(r.got).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${nm[k]} ${(v * 100).toFixed(0)}%`).join('、'));
  }
}
