// 額外的模擬機器人（2026-11-26 數值報告）：新手、甄嬛傳迷。規則一律走引擎，透過 simulate.js 的 api 操作。
const { makeBot, DEBUFFS } = require('./simulate.js');

const SPIKES = ['cassava', 'catnip', 'musk', 'safflower'];

// 新手：照訂單做事、不懂喜好和遮掩；一半機率撈泡泡（隨手撈）、10% 記錯配方；有料時 30% 隨手加；
// 禁足會抄經；被翻牌子一半機率唱；20% 讓包捐代交
const novice = makeBot({
  name: '新手',
  spikeFor: (G) => { const s = SPIKES.filter((x) => G.have(x) > 0); return s.length && G.rand() < 0.3 ? s[Math.floor(G.rand() * s.length)] : null; },
  bribeReserve: 40,
  sing: 0.5,
  sutra: true,
  proxyChance: 0.2,
  craft: { bubble: 0.5, skill: 'random', fail: 0.1, finish: [0.3, 0.4, 0.3] },
});

// 甄嬛傳迷：照原作走雙面路線——先交好再下手；舒痕膠加麝香給真環（原著重現）、審沒裝下紅花／麝香、
// 滑妃（本來就不孕）只整侍寢；一定撈泡泡、挑遮掩特性；禁足抄經、心經拿去送人；想贏（打點、70% 唱）；
// 每天 25% 先試一件還沒做過的事。
const RISK = 0.25; // 被抓機率低於這個就敢下手（精算型是 0.15）
const HARM = ['zhenhuan', 'meizhuang'];
const MASK_GUESS = { nong: 1, xiang: 1, tian: 1 }; // 會撈遮掩特性，估被抓時先當成品有一點遮掩

function fanSpike(G, who) {
  const { S, have } = G;
  const c = S.conc[who];
  const ok = (sp) => have(sp) > 0 && G.catchChance(who, sp, 'deliver', MASK_GUESS) < RISK;
  if (who === 'zhenhuan' && c.status !== 'infertile') {
    if (c.status === 'pregnant' && ok('safflower')) return 'safflower';
    if (ok('musk')) return 'musk';
  }
  if (who === 'meizhuang' && c.status !== 'infertile') {
    if (ok('safflower')) return 'safflower';
    if (ok('musk')) return 'musk';
  }
  if (S.flip === who) return DEBUFFS.find(ok) || null;
  return null;
}

function tryNew(G, F) {
  const { S, D, have, R } = G;
  const spare = S.hand.find((h) => h.product !== 'junk' && !h.spike && !h.forOrder && h.product !== 'sutra');
  const ready = S.orders.find((o) => S.hand.some((h) => h.product === o.product));
  const opts = [
    ['proxy', () => ready && G.deliver(ready, 'proxy')],
    ['visitEmpty', () => G.visit(D.TARGETS[Math.floor(G.rand() * 3)], null)],
    ['bribe', () => S.silver >= R.bribeCost && G.bribe()],
    ['hateGift', () => {
      if (!spare) return false;
      const who = D.TARGETS.find((t) => D.PREFS[t].hateP.includes(spare.product));
      return who ? G.visit(who, spare) : false;
    }],
    ['catnip', () => {
      if (!D.TARGETS.includes(S.flip) || S.slot >= R.slotsPerDay - 1) return false;
      if (have('catnip') < 1 && !G.buy('catnip')) return false;
      const pid = D.NORMAL_ORDERS.find((p) => D.PRODUCTS[p].recipe.every((id) => have(id) >= 1));
      return pid ? G.craft(D.PRODUCTS[pid].recipe, 'catnip', S.flip) : false;
    }],
    ['saff', () => have('petal') > 0 && (have('liquor') > 0 || G.buy('liquor')) && G.craft(['petal', 'liquor'])],
  ].filter(([k]) => !F.tried.has(k));
  for (const [k, fn] of opts) {
    const r = fn();
    if (r) { F.tried.add(k); return r; }
  }
  return false;
}

const fan = {
  name: '甄嬛傳迷',
  sing: 0.7,
  proxyChance: 0,
  craft: { bubble: 1, skill: 'mask', fail: 0.05, finish: [0.5, 0.35, 0.15] },
  act(G) {
    const { S, D, have, R } = G;
    const F = S.fan || (S.fan = { tried: new Set() });
    if (S.silver >= R.bribeCost + 60 && G.flipOdds(0) < 0.4) G.bribe();
    if (!G.grounded() && !S.stats.yuanzhu && S.silver >= 90 && have('musk') < 1) G.buy('musk');
    const ready = S.orders.find((o) => S.hand.some((h) => h.product === o.product));

    // 禁足：先讓包捐代交，剩下的時辰抄經
    if (G.grounded()) {
      if (ready) { F.tried.add('proxy'); return G.deliver(ready, 'proxy'); }
      return G.copySutra();
    }
    // 好奇心
    if (G.rand() < 0.25) { const r = tryNew(G, F); if (r) return r; }
    // 交貨（不讓訂單過期）
    if (ready) return G.deliver(ready, 'self');
    // 加了出包料的禮，送給今晚侍寢的人
    const debuffGift = S.hand.find((h) => DEBUFFS.includes(h.spike) && !h.forOrder);
    if (debuffGift && D.TARGETS.includes(S.flip) && G.catchChance(S.flip, debuffGift.spike, 'gift', debuffGift.tr) < RISK) return G.visit(S.flip, debuffGift);
    // 原著重現：舒痕膠加麝香送真環
    if (!S.stats.yuanzhu && S.conc.zhenhuan.status !== 'infertile') {
      const sh = S.hand.find((h) => h.product === 'shuhen' && h.spike === 'musk' && !h.forOrder);
      if (sh) {
        if (G.acceptChance('zhenhuan') >= 0.55 && G.catchChance('zhenhuan', 'musk', 'gift', sh.tr) < RISK) return G.visit('zhenhuan', sh);
      } else if (have('musk') > 0 && S.slot < R.slotsPerDay - 1) {
        ['pearl', 'jasmine'].forEach((id) => { if (have(id) < 1) G.buy(id); });
        if (have('pearl') >= 1 && have('jasmine') >= 1) return G.craft(['pearl', 'jasmine'], 'musk', 'zhenhuan');
      }
    }
    // 先交好再下手：多的成品或心經送給要害的人裡友好最低的那位
    const spare = S.hand.find((h) => h.product !== 'junk' && !h.spike && !h.forOrder);
    if (spare) {
      const who = HARM.slice().sort((a, b) => S.friend[a] - S.friend[b])[0];
      return G.visit(who, spare);
    }
    // 做訂單（照期限）
    const todo = S.orders.filter((o) => !S.hand.some((h) => h.product === o.product)).sort((a, b) => a.due - b.due);
    for (const o of todo) {
      const mats = D.PRODUCTS[o.product].recipe;
      mats.forEach((id) => { if (have(id) < 1 && D.SHOP.includes(id)) G.buy(id); });
      if (mats.every((id) => have(id) >= 1)) {
        const sp = fanSpike(G, o.who);
        return G.craft(mats, sp, o.who);
      }
    }
    // 煉紅花（要給審沒裝）
    if (have('petal') > 0 && (have('liquor') > 0 || G.buy('liquor'))) return G.craft(['petal', 'liquor']);
    // 採集缺的；沒缺就去跟友好最低的目標套交情，或去太醫院找料
    const need = new Set();
    todo.forEach((o) => D.PRODUCTS[o.product].recipe.forEach((id) => { if (have(id) < 1) need.add(id); }));
    if ([...need].some((id) => D.GATHER.taiyi.table.some(([x]) => x === id))) return G.gather('taiyi');
    if (need.size) return G.gather('garden');
    const low = HARM.slice().sort((a, b) => S.friend[a] - S.friend[b])[0];
    if (S.friend[low] < 50) return G.visit(low, null);
    return G.gather('taiyi');
  },
};

module.exports = { novice, fan };
