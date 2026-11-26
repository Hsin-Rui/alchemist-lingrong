// 平衡模擬器：用機器人玩很多局，統計結果。
// 用法：node tools/simulate.js [局數] [--quick]；數值掃描見 tools/sweep.js，七種機器人的 HTML 報告見 tools/sim-report.js
//   預設採集走地下城：先用 tools/gather-bot.js 的「會躲」機器人每張地圖玩 POOL 趟，
//   整局模擬時每次採集從中抽一趟的收穫（地下城很慢，這樣才跑得動）。--quick＝舊的一鍵採集（2～3 個）。
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
// 撈泡泡（§13.4 第二階段的簡化）：撈 stirs 次，每次從 3 顆泡泡挑 1 顆。焦泡 20%、大泡泡（+2）15%。
// skill 'random'＝隨手撈；'mask'＝挑遮掩特性（濃郁×2、香氣、甜蜜）和收禮人喜歡的特性，避開焦泡。
function scoop(D, st, forWho, rand) {
  const keys = Object.keys(D.TRAITS);
  const like = forWho && D.PREFS[forWho] ? D.PREFS[forWho].likeT : [];
  const want = (b) => (b.t === 'burnt' ? -10 : b.v * ((D.RULES.maskWeights[b.t] || 0) + (like.includes(b.t) ? 1.5 : 0) + 0.1));
  return Array.from({ length: D.RULES.craft.stirs }, () => {
    const cands = Array.from({ length: 3 }, () => (rand() < 0.2 ? { t: 'burnt' } : { t: keys[Math.floor(rand() * keys.length)], v: rand() < 0.15 ? 2 : 1 }));
    return st.skill === 'mask' ? cands.reduce((a, b) => (want(b) > want(a) ? b : a)) : cands[Math.floor(rand() * 3)];
  });
}

function play(Dv, R, bot, rand, hauls) {
  const S = E.newState(Dv);
  // 統計物件（引擎不寫 S.m，由本檔從報告／結果翻出）
  S.m = {
    lingFlips: 0, sings: 0, pillow: 0, preg: 0, births: 0, miscarry: 0, infertile: 0, serveFail: 0,
    delivered: 0, proxy: 0, late: 0, ordersTotal: 0, bribes: 0, gifts: 0, visits: 0, love: 0, refused: 0, empress: 0, silverEarned: 0,
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
    catchChance: (who, spike, via, tr) => E.catchChance(Dv, S, who, spike, via, tr),
    acceptChance: (who, kind) => E.acceptChance(Dv, S, who, kind),
    giftFriend: (who, item) => E.giftFriend(Dv, who, item.product, item.tr),
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
      if (hauls && hauls[loc]) { const h = hauls[loc][Math.floor(rand() * hauls[loc].length)]; E.applyGatherHaul(Dv, S, loc, h.got, h.haul); }
      else E.gather(Dv, S, loc, rand);
      return true;
    },
    craft(mats, spike, forWho) {
      // 材料不足由 bot 端先擋（引擎的 craft 不檢查）
      if (mats.some((id) => have(id) < mats.filter((m) => m === id).length)) return false;
      const sel = { mats, spike };
      // bot.craft：會撈泡泡／會失手的機器人（新手、甄嬛傳迷）；沒設定＝快速調合、不失手（原本五種，不多擲骰）
      const st = bot.craft;
      if (st) {
        if (rand() < st.fail) {
          // 記錯配方：換掉一樣素材，做出黑暗料理
          const x = Object.keys(S.inv).find((id) => have(id) > 0 && Dv.ITEMS[id] && Dv.ITEMS[id].type === 'mat' && !mats.includes(id) && !E.findRecipe(Dv, [mats[0], id]));
          if (x) sel.mats = [mats[0], x];
        } else if (rand() < st.bubble) {
          sel.stirs = scoop(Dv, st, forWho, rand);
          const z = rand();
          sel.finish = z < st.finish[0] ? 'up' : z < st.finish[0] + st.finish[1] ? 'keep' : 'down';
        }
      }
      return E.craft(Dv, S, sel).product;
    },
    // 禁足抄經（花 1 時辰，手上多一本心經）
    copySutra() {
      if (!grounded() || S.slot >= R.slotsPerDay) return false;
      const r = E.copySutra(Dv, S);
      if (r.ok) S.m.sutras = (S.m.sutras || 0) + 1;
      return !!r.ok;
    },
    // 禁足時包捐代交（只拿賞銀、不花時辰）；否則親自交
    deliver(order, want) {
      // 沿用重構前的選件：手上第一個符合品項的成品
      const item = S.hand.find((h) => h.product === order.product);
      if (!item) return false;
      // 禁足時一定代交；bot.proxyChance：沒禁足也有機率讓包捐代交（新手）；want 指定（甄嬛傳迷）
      const how = grounded() ? 'proxy' : want || (bot.proxyChance && rand() < bot.proxyChance ? 'proxy' : 'self');
      const res = E.deliver(Dv, S, order.id, item.id, rand, how);
      S.m.delivered++;
      if (how === 'proxy') S.m.proxy++;
      if (!res.caught) S.m.silverEarned += res.reward;
      tallySpike(res);
      return true;
    },
    // 拜訪各宮（§14）：item 空＝空手
    visit(who, item) {
      if (grounded() || (item && item.product === 'junk')) return false;
      S.m.visits++;
      if (item) S.m.gifts++;
      const res = E.visit(Dv, S, who, item ? item.id : null, rand);
      if (res.refused) { S.m.refused++; return 'refused'; }
      if (res.reaction === 'love') S.m.love++;
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
    // bot.sing：true＝每次都唱、false＝不唱、數字＝唱的機率（只有數字才多擲骰，原本的機器人骰序不變）
    const sing = S.flip === 'lingrong' && !grounded() && bot.sing !== false && (typeof bot.sing !== 'number' || rand() < bot.sing);
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
function makeBot({ name, spikeFor, giftSpike = false, bribeReserve = Infinity, bribeSmart = false, sing = true, makeSaff = false, buySpikes = false, social = false, sutra = false, proxyChance = 0, craft = null }) {
  return {
    name, sing, proxyChance, craft,
    act(G) {
      const { S, D, have } = G;
      // 0. 有錢就打點敬事房（明天被翻的機率）
      if (bribeSmart ? S.silver >= G.R.bribeCost && G.flipOdds(0) < 0.35 : S.silver >= G.R.bribeCost + bribeReserve) G.bribe();
      if (buySpikes && S.silver >= 80 && have('cassava') < 1) G.buy('cassava');
      // 1. 交貨（禁足時包捐代交，不花時辰）
      const o1 = S.orders.find((x) => S.hand.some((h) => h.product === x.product));
      if (o1) return G.deliver(o1);
      // 2. 加料送禮給今晚侍寢的人
      if (giftSpike && !G.grounded() && D.TARGETS.includes(S.flip) && (!bribeSmart || S.favor[S.flip] >= S.favor.lingrong - 10)) {
        // 料要在調合時加進去：手上有加了出包料的成品就送，沒有就先做一個
        const isDebuff = (x) => DEBUFFS.includes(x);
        const ready = S.hand.find((h) => isDebuff(h.spike));
        const safe = (sp, tr) => G.acceptChance(S.flip) >= 0.6 && G.catchChance(S.flip, sp, 'gift', tr) < 0.15;
        if (ready && safe(ready.spike, ready.tr)) return G.visit(S.flip, ready);
        const sp = DEBUFFS.find((x) => have(x) > 0);
        if (!ready && sp && safe(sp) && S.slot < G.R.slotsPerDay - 1) {
          const pid = D.NORMAL_ORDERS.find((p) => D.PRODUCTS[p].recipe.every((id) => have(id) >= 1));
          if (pid) return G.craft(D.PRODUCTS[pid].recipe, sp);
        }
      }
      // 3. 做訂單（照期限排序）
      const todo = S.orders.filter((o) => !S.hand.some((h) => h.product === o.product)).sort((a, b) => a.due - b.due);
      for (const o of todo) {
        const mats = D.PRODUCTS[o.product].recipe;
        mats.forEach((id) => { if (have(id) < 1 && D.SHOP.includes(id)) G.buy(id); });
        if (mats.every((id) => have(id) >= 1)) {
          const sp = spikeFor(G, o.who);
          return G.craft(mats, sp && have(sp) > 0 ? sp : null);
        }
      }
      // 4. 煉紅花
      if (makeSaff && have('petal') > 0 && (have('liquor') > 0 || G.buy('liquor'))) return G.craft(['petal', 'liquor']);
      // 4.5 交際：手上有沒綁訂單的成品，送給最喜歡它的人（機器人知道喜好＝玩家試出來之後）
      if (social && !G.grounded()) {
        const spare = S.hand.find((h) => h.product !== 'junk' && !h.spike && !h.forOrder);
        if (spare) {
          const who = D.TARGETS.slice().sort((a, b) => G.giftFriend(b, spare) - G.giftFriend(a, spare))[0];
          return G.visit(who, spare);
        }
        // 沒訂單要做時，為今晚侍寢的人做一份她喜歡的伴手禮（養枕邊風）
        if (!todo.length && D.TARGETS.includes(S.flip) && S.slot < G.R.slotsPerDay - 1) {
          const can = D.NORMAL_ORDERS.concat(['zuotai', 'tonic']).filter((p) => D.PRODUCTS[p].recipe.every((id) => have(id) >= 1));
          const best = can.sort((a, b) => G.giftFriend(S.flip, { product: b, tr: {} }) - G.giftFriend(S.flip, { product: a, tr: {} }))[0];
          if (best) return G.craft(D.PRODUCTS[best].recipe);
        }
      }
      // 5. 採集訂單缺的東西
      if (!G.grounded()) {
        const need = new Set();
        todo.forEach((o) => D.PRODUCTS[o.product].recipe.forEach((id) => { if (have(id) < 1) need.add(id); }));
        const inGarden = [...need].some((id) => D.GATHER.garden.table.some(([x]) => x === id));
        const inTaiyi = [...need].some((id) => D.GATHER.taiyi.table.some(([x]) => x === id));
        if (inTaiyi && (!inGarden || G.rand() < 0.5)) return G.gather('taiyi');
        if (inGarden) return G.gather('garden');
        // 沒缺東西：交際型去拜訪今晚侍寢的人（空手 +1，養枕邊風）；壞心機器人去太醫院找料，其他人去御花園備料
        if (social && D.TARGETS.includes(S.flip)) return G.visit(S.flip, null);
        return G.gather(makeSaff ? 'taiyi' : 'garden');
      }
      if (sutra && G.grounded()) return G.copySutra(); // 禁足沒事做 → 抄經
      return false; // 禁足又沒事做 → 就寢
    },
  };
}

// 精算型的加料判斷：風險低才下手，挑效果最好的料
const DEBUFFS = ['cassava', 'catnip'];
function smartSpike(G, who) {
  const { S, have } = G;
  const c = S.conc[who];
  const ok = (sp) => have(sp) > 0 && G.catchChance(who, sp, 'deliver') < 0.15; // 調合時還不知道成品特性，照沒遮掩估
  if (c.status === 'pregnant') { if (ok('safflower')) return 'safflower'; if (ok('musk')) return 'musk'; }
  if (c.status === 'normal' && ok('safflower')) return 'safflower';
  if (S.flip === who) { const d = DEBUFFS.find(ok); if (d) return d; }
  if (c.status === 'normal' && ok('musk')) return 'musk';
  return DEBUFFS.find(ok) || null;
}

const BOTS = [
  makeBot({ name: '正經', spikeFor: () => null, bribeReserve: 40 }),
  // 交際：正經做訂單，空檔去各宮走動、多的成品送給喜歡的人（第二輪新玩法）
  makeBot({ name: '交際', spikeFor: () => null, bribeReserve: 40, social: true }),
  makeBot({ name: '隨手加料', spikeFor: (G) => { const s = [...DEBUFFS, 'musk', 'safflower'].filter((x) => G.have(x) > 0); return s.length && G.rand() < 0.5 ? s[0] : null; }, bribeReserve: 40 }),
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

// 每張地下城地圖預先玩 n 趟，回 { loc: [{ got, haul }, …] }
const POOL = 2000;
function dungeonHauls(D, n = POOL) {
  const { playDungeon } = require('./gather-bot.js');
  const out = {};
  for (const loc of Object.keys(D.GATHER).filter((l) => D.GATHER[l].dungeon)) {
    const rand = mulberry32(777);
    out[loc] = Array.from({ length: n }, () => { const run = playDungeon(D, loc, rand, { careful: true }); return { got: run.got, haul: run.haul }; }); // haul 帶每份的特性
  }
  return out;
}

function runVariant(D0, variant, N, bots = BOTS) {
  const D = JSON.parse(JSON.stringify(D0, (k, v) => (typeof v === 'function' ? undefined : v)));
  const R = { ...D.RULES, ...(variant.rules || {}), fx: { ...D.RULES.fx, ...((variant.rules || {}).fx || {}) } };
  // 把合併後的規則烘回 D.RULES，供引擎（讀 D.RULES）套用 variant 覆蓋
  D.RULES = R;
  Object.entries(variant.items || {}).forEach(([id, o]) => Object.assign(D.ITEMS[id], o));
  Object.entries(variant.products || {}).forEach(([id, o]) => Object.assign(D.PRODUCTS[id], o));
  const hauls = variant.quick ? null : dungeonHauls(D);
  const out = {};
  bots.forEach((bot, bi) => {
    const rand = mulberry32(1234 + bi);
    const acc = { got: {}, win: 0, rank: 0, ling: 0, top: 0, endings: {}, m: {} , caught: 0, grounded: 0, silver: 0, birthGames: 0, caughtGames: 0, tops: {}, favor: {}, stats: {} };
    for (let i = 0; i < N; i++) {
      const { S, rank, ending, titles } = play(D, R, bot, rand, hauls);
      titles.forEach((id) => { acc.got[id] = (acc.got[id] || 0) + 1; });
      acc.win += rank === 1;
      acc.rank += rank;
      acc.ling += S.favor.lingrong;
      acc.top += Math.max(...D.TARGETS.map((t) => S.favor[t]));
      acc.caught += S.stats.caught;
      acc.caughtGames += S.stats.caught > 0; // 被抓過＝至少禁足一次、能抄經
      acc.grounded += S.stats.groundedDays;
      acc.silver += S.silver;
      acc.birthGames += S.m.births > 0;
      acc.endings[ending] = (acc.endings[ending] || 0) + 1;
      if (ending === 'touming') acc.got.touming = (acc.got.touming || 0) + 1;
      const top = D.ALL.reduce((a, b) => (S.favor[b] > S.favor[a] || (S.favor[b] === S.favor[a] && a === 'lingrong') ? b : a));
      acc.tops[top] = (acc.tops[top] || 0) + 1;
      D.ALL.forEach((w) => { acc.favor[w] = (acc.favor[w] || 0) + S.favor[w]; });
      Object.entries(S.stats).forEach(([k, v]) => { if (typeof v === 'number') acc.stats[k] = (acc.stats[k] || 0) + v; });
      Object.entries(S.m).forEach(([k, v]) => { acc.m[k] = (acc.m[k] || 0) + v; });
    }
    out[bot.name] = {
      winRate: acc.win / N, avgRank: acc.rank / N, ling: acc.ling / N, topRival: acc.top / N,
      caught: acc.caught / N, grounded: acc.grounded / N, silverLeft: acc.silver / N, birthGames: acc.birthGames / N, caughtGames: acc.caughtGames / N,
      tops: Object.fromEntries(Object.entries(acc.tops).map(([k, v]) => [k, v / N])),
      favor: Object.fromEntries(Object.entries(acc.favor).map(([k, v]) => [k, v / N])),
      stats: Object.fromEntries(Object.entries(acc.stats).map(([k, v]) => [k, v / N])),
      got: Object.fromEntries(Object.entries(acc.got).map(([k, v]) => [k, v / N])),
      endings: Object.fromEntries(Object.entries(acc.endings).map(([k, v]) => [k, v / N])),
      m: Object.fromEntries(Object.entries(acc.m).map(([k, v]) => [k, v / N])),
    };
  });
  return out;
}

module.exports = { loadData, runVariant, BOTS, play, makeBot, smartSpike, mulberry32, dungeonHauls, DEBUFFS };

if (require.main === module) {
  const N = Number(process.argv[2]) || 5000;
  const D = loadData();
  const quick = process.argv.includes('--quick');
  console.log(quick ? '採集：舊的一鍵採集' : `採集：地下城（會躲侍衛的機器人，每張地圖預玩 ${POOL} 趟抽樣）`);
  const res = runVariant(D, { quick }, N);
  for (const [bot, r] of Object.entries(res)) {
    console.log(`\n【${bot}】逆襲成功（恩寵第一） ${(r.winRate * 100).toFixed(1)}%｜平均名次 ${r.avgRank.toFixed(2)}｜零溶恩寵 ${r.ling.toFixed(0)}｜最高對手 ${r.topRival.toFixed(0)}`);
    console.log(`  被翻 ${r.m.lingFlips.toFixed(2)} 次｜打點 ${r.m.bribes.toFixed(2)}｜枕邊風 ${r.m.pillow.toFixed(2)}｜黃后進言 ${r.m.empress.toFixed(2)}｜被抓 ${r.caught.toFixed(2)}｜禁足 ${r.grounded.toFixed(1)} 天`);
    console.log(`  懷孕 ${r.m.preg.toFixed(2)}｜生產 ${r.m.births.toFixed(2)}（${(r.birthGames * 100).toFixed(0)}% 的局看得到）｜小產 ${r.m.miscarry.toFixed(2)}｜不孕 ${r.m.infertile.toFixed(2)}｜侍寢出包 ${r.m.serveFail.toFixed(2)}`);
    console.log(`  訂單 ${r.m.ordersTotal.toFixed(1)}｜交貨 ${r.m.delivered.toFixed(1)}（代交 ${r.m.proxy.toFixed(1)}）｜逾期 ${r.m.late.toFixed(1)}｜拜訪 ${r.m.visits.toFixed(1)}（投其所好 ${r.m.love.toFixed(1)}）｜賺 ${r.m.silverEarned.toFixed(0)} 銀｜剩 ${r.silverLeft.toFixed(0)} 銀`);
    const nm = Object.fromEntries(D.TITLES.map((t) => [t.id, t.name]));
    console.log('  主封號', Object.entries(r.endings).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${nm[k]} ${(v * 100).toFixed(0)}%`).join('、'));
    console.log('  拿到過', Object.entries(r.got).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${nm[k]} ${(v * 100).toFixed(0)}%`).join('、'));
  }
}
