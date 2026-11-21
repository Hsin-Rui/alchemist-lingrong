// 平衡模擬器：用機器人玩很多局，統計結果。
// 用法：node tools/simulate.js [局數]
// 規則一律走遊戲引擎（js/engine.js）；模擬器只提供 bot 決策、mulberry32 種子、variant 覆蓋、
// CLI 輸出，以及把引擎回傳的結構化結果翻成 S.m 統計的薄膠水。改規則只要改引擎，不必動這裡。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const E = require('../js/engine.js');

function loadData() {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8'), ctx);
  return ctx.window.GAME_DATA;
}

// ───────── 一局遊戲 ─────────
// 規則全部走引擎：newState/startDay/settleNight/applySpike（經 deliver/gift）/gather/craft/
// buy/bribe/flipWeights/catchChance/acceptChance/computeEnding。此處只保留 bot 介面的薄膠水：
// 前置守衛（禁足、材料是否足夠）、把引擎結構化回傳翻成 S.m 統計。擲骰一律走注入的 rand，
// 與引擎同序，故固定種子下輸出與重構前一致。
function play(Dv, R, bot, rand) {
  const S = E.newState(Dv);
  // 統計物件（引擎不寫 S.m，由本檔從報告／結果翻出）
  S.m = {
    lingFlips: 0, sings: 0, pillow: 0, preg: 0, births: 0, miscarry: 0, infertile: 0, serveFail: 0,
    delivered: 0, late: 0, ordersTotal: 0, bribes: 0, gifts: 0, refused: 0, empress: 0, silverEarned: 0,
  };
  const have = (id) => S.inv[id] || 0;
  const grounded = () => S.day <= S.groundUntil;

  // 引擎 applySpike 的 outcome → S.m（害人成效統計）。被抓/無效/正經皆不計。
  const tallySpike = (res) => {
    switch (res.outcome) {
      case 'miscarry_musk': S.m.miscarry++; break;
      case 'miscarry_safflower': S.m.miscarry++; S.m.infertile++; break;
      case 'musk_infertile':
      case 'safflower_infertile': S.m.infertile++; break;
      default: break;
    }
  };

  // 給機器人用的動作：簽章維持與重構前一致，內部改呼叫引擎並把結果翻成 S.m。
  const api = {
    S, D: Dv, R, have, grounded, rand,
    catchChance: (who, spike, via) => E.catchChance(Dv, S, who, spike, via),
    acceptChance: (who) => E.acceptChance(Dv, S, who),
    findRecipe: (a, b) => E.findRecipe(Dv, a, b),
    // 零溶明天被翻的機率（純量）；沿用重構前語意（權重全空時為 NaN）。
    flipOdds(bribe) {
      const w = E.flipWeights(Dv, S, bribe);
      const tot = Object.values(w).reduce((a, b) => a + b, 0);
      return (w.lingrong || 0) / tot;
    },
    buy(id) { return E.buy(Dv, S, id).ok; },
    bribe() { const r = E.bribe(Dv, S); if (r.ok) S.m.bribes++; return r.ok; },
    gather(loc) {
      if (grounded()) return false;
      E.gather(Dv, S, loc, rand);
      return true;
    },
    craft(a, b, spike) {
      // 材料不足由 bot 端先擋（引擎的 craft 不檢查）
      if (have(a) < 1 || have(b) < 1 || (a === b && have(a) < 2)) return false;
      return E.craft(Dv, S, { mats: [a, b], spike }).product;
    },
    deliver(order) {
      if (grounded()) return false;
      // 沿用重構前的選件：手上第一個符合品項的成品
      const item = S.hand.find((h) => h.product === order.product);
      if (!item) return false;
      const res = E.deliver(Dv, S, order.id, item.id, rand);
      S.m.delivered++;
      if (!res.caught) S.m.silverEarned += res.reward;
      tallySpike(res);
      return true;
    },
    gift(who, item) {
      if (grounded() || item.product === 'junk') return false;
      if (item.spike && who !== S.flip) return false;
      S.m.gifts++;
      const res = E.gift(Dv, S, who, item.id, rand);
      if (res.refused) { S.m.refused++; return 'refused'; }
      tallySpike(res);
      return true;
    },
  };

  for (S.day = 1; S.day <= R.days; S.day++) {
    S.slot = 0;
    const sd = E.startDay(Dv, S, rand);
    S.m.late += sd.lapsed.length;
    S.m.ordersTotal += sd.newOrders.length;
    if (sd.boosted) S.m.empress++;
    let guard = 0;
    while (S.slot < R.slotsPerDay && guard++ < 10) { if (!bot.act(api)) break; }
    bot.evening?.(api);
    const sing = S.flip === 'lingrong' && !grounded() && bot.sing !== false;
    const nr = E.settleNight(Dv, S, { sing, rand });
    const sv = nr.serve;
    if (sv && sv.target === 'lingrong' && sv.kind !== 'grounded') S.m.lingFlips++;
    if (sv && sv.kind === 'sing') S.m.sings++;
    if (sv && sv.kind === 'debuff') S.m.serveFail++;
    if (nr.pillow) S.m.pillow++;
    if (nr.conceived) S.m.preg++;
    S.m.births += nr.births.length;
  }

  // 名次／封號一律走引擎的 computeEnding（封號冊傳空陣列，模擬器不收集）。
  // computeEnding 無封號時回 touming；重構前的 titles 只收真封號、不含 touming，故濾掉。
  const end = E.computeEnding(Dv, S, []);
  const titles = [end.main, ...end.extra].map((t) => t.id).filter((id) => id !== 'touming');
  return { S, rank: end.rank, ending: end.main.id, titles };
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
  // 把合併後的規則烘回 D.RULES，供引擎（讀 D.RULES）套用 variant 覆蓋
  D.RULES = R;
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
