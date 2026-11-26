// 數值掃描：對幾個平衡數值做「一次只動一個」與「全部排列組合」，每組讓 5 種機器人各玩 N 局（一鍵採集），
// 依同一把尺打分，列出最接近目標的幾組。不改遊戲本身；用 tools/simulate.js 的 runVariant（固定種子，各組擲同樣的骰）。
// 用法：node tools/sweep.js [每組局數=1000] [--top 10] [--json 輸出檔]
const { loadData, runVariant } = require('./simulate.js');

// ───────── 要測的數值（第一個＝基準：2026-11-26 調整前）─────────
const AXES = {
  orders: [
    ['25/45/30', { orderCountWeights: [[0, 25], [1, 45], [2, 30]] }],
    ['20/45/35', { orderCountWeights: [[0, 20], [1, 45], [2, 35]] }],
    ['15/45/40', { orderCountWeights: [[0, 15], [1, 45], [2, 40]] }],
  ],
  pillow: [
    ['15', { pillowFavor: 15 }],
    ['8', { pillowFavor: 8 }],
    ['10', { pillowFavor: 10 }],
    ['12', { pillowFavor: 12 }],
    ['13', { pillowFavor: 13 }],
    ['14', { pillowFavor: 14 }],
  ],
  gift: [
    ['1.2/1/0.8', { giftCoef: { like: 1.2, plain: 1, hate: 0.8 } }],
    ['1.3/1/0.8', { giftCoef: { like: 1.3, plain: 1, hate: 0.8 } }],
    ['1.3/1.1/0.85', { giftCoef: { like: 1.3, plain: 1.1, hate: 0.85 } }],
    ['1.4/1.1/0.9', { giftCoef: { like: 1.4, plain: 1.1, hate: 0.9 } }],
  ],
  deliver: [
    ['5', { deliverFriend: 5 }],
    ['6', { deliverFriend: 6 }],
  ],
  // 被抓：基礎值（麝香／木薯粉、貓薄荷）、遮掩下限／每分、友好下限、交貨倍率
  catch: [
    ['調整前', { rules: { maskFloor: 0.08, maskStep: 0.06, friendCatchFloor: 0.2, deliverCatchFactor: 0.5 }, items: { musk: 0.12, cassava: 0.18, catnip: 0.18 } }],
    ['中間', { rules: { maskFloor: 0.09, maskStep: 0.055, friendCatchFloor: 0.25, deliverCatchFactor: 0.55 }, items: { musk: 0.14, cassava: 0.2, catnip: 0.2 } }],
    ['線上版', { rules: { maskFloor: 0.1, maskStep: 0.05, friendCatchFloor: 0.3, deliverCatchFactor: 0.6 }, items: { musk: 0.15, cassava: 0.22, catnip: 0.22 } }],
    ['更重', { rules: { maskFloor: 0.12, maskStep: 0.045, friendCatchFloor: 0.35, deliverCatchFactor: 0.65 }, items: { musk: 0.18, cassava: 0.25, catnip: 0.25 } }],
  ],
};
const KEYS = Object.keys(AXES);

function variantOf(pick) {
  const rules = {};
  const items = {};
  KEYS.forEach((k) => {
    const v = AXES[k][pick[k]][1];
    if (k === 'catch') { Object.assign(rules, v.rules); Object.entries(v.items).forEach(([id, c]) => { items[id] = { catch: c }; }); } else Object.assign(rules, v);
  });
  return { quick: true, rules, items };
}
const label = (pick) => KEYS.map((k) => `${k}=${AXES[k][pick[k]][0]}`).join(' ');

// ───────── 目標與打分（越小越好）─────────
// 加料高手 30–35%、正經 18–22%、交際比正經高 2–4、隨手加料不比正經好、加料型被抓約 1 次、一局約 12 張訂單
const band = (x, lo, hi) => (x < lo ? lo - x : x > hi ? x - hi : 0);
function score(r) {
  const w = (b) => r[b].winRate * 100;
  const expert = (w('精算') + w('高手')) / 2;
  const caught = (r['精算'].caught + r['高手'].caught) / 2;
  const orders = r['正經'].m.ordersTotal;
  const parts = {
    expert: band(expert, 30, 35),
    honest: band(w('正經'), 18, 22),
    social: band(w('交際') - w('正經'), 2, 4),
    casual: Math.max(0, w('隨手加料') - w('正經')),
    top: Math.max(0, Math.max(w('正經'), w('交際'), w('隨手加料')) - Math.min(w('精算'), w('高手'))),
    caught: band(caught, 0.9, 1.2) * 10,
    orders: band(orders, 11.5, 12.8) * 2,
  };
  return { total: Object.values(parts).reduce((a, b) => a + b, 0), parts };
}
function summary(r, pillowFavor) {
  const w = (b) => +(r[b].winRate * 100).toFixed(1);
  return {
    正經: w('正經'), 交際: w('交際'), 隨手加料: w('隨手加料'), 精算: w('精算'), 高手: w('高手'),
    被抓: +(((r['精算'].caught + r['高手'].caught) / 2).toFixed(2)),
    訂單: +r['正經'].m.ordersTotal.toFixed(1),
    枕邊風恩寵: +((r['交際'].m.pillow * pillowFavor).toFixed(1)), // 交際機器人一局從枕邊風拿到的恩寵
  };
}

if (require.main === module) {
  const N = Number(process.argv[2]) || 1000;
  const topN = Number((process.argv[process.argv.indexOf('--top') + 1]) || 10) || 10;
  const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
  const D = loadData();
  const run = (pick) => {
    const r = runVariant(D, variantOf(pick), N);
    const pf = AXES.pillow[pick.pillow][1].pillowFavor;
    return { pick, label: label(pick), ...score(r), s: summary(r, pf) };
  };
  const base = Object.fromEntries(KEYS.map((k) => [k, 0]));
  const fmt = (x) => `${x.label}\n    分數 ${x.total.toFixed(1)}｜${Object.entries(x.s).map(([k, v]) => `${k} ${v}`).join('｜')}`;

  console.log(`每組 ${N} 局（一鍵採集），固定種子\n\n── 基準（調整前）──`);
  const b = run(base);
  console.log(fmt(b));

  console.log('\n── 一次只動一個 ──');
  const single = [];
  KEYS.forEach((k) => AXES[k].forEach((_, i) => {
    if (!i) return;
    const x = run({ ...base, [k]: i });
    single.push(x);
    console.log(fmt(x));
  }));

  const all = [];
  const rec = (i, pick) => {
    if (i === KEYS.length) { all.push(run(pick)); return; }
    AXES[KEYS[i]].forEach((_, j) => rec(i + 1, { ...pick, [KEYS[i]]: j }));
  };
  rec(0, {});
  all.sort((a, c) => a.total - c.total);
  console.log(`\n── 全部 ${all.length} 組，分數最好的 ${topN} 組 ──`);
  all.slice(0, topN).forEach((x) => console.log(fmt(x)));
  if (jsonOut) require('fs').writeFileSync(jsonOut, JSON.stringify({ N, base: b, single, all }, null, 1));
}

module.exports = { AXES, variantOf, score, summary };
