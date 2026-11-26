// 數值模擬報告：用指定的數值版本，讓 7 種機器人（＋5 種「唱一半」）各玩 N 局，輸出一頁 HTML。
// 用法：node tools/sim-report.js [每種局數=5000] [輸出檔=docs/round2/sim-report.html]
const fs = require('fs');
const path = require('path');
const { loadData, runVariant, BOTS, makeBot } = require('./simulate.js');
const { novice, fan } = require('./bots-extra.js');

const N = Number(process.argv[2]) || 5000;
const OUT = process.argv[3] || path.join(__dirname, '..', 'docs', 'round2', 'sim-report.html');
const D = loadData();

// 使用者 2026-11-26 決定的版本：D 組＋被抓「更重」＋枕邊風 +10
const CHOSEN = {
  quick: true,
  rules: {
    orderCountWeights: [[0, 15], [1, 45], [2, 40]],
    giftCoef: { like: 1.3, plain: 1.1, hate: 0.85 },
    deliverFriend: 6,
    pillowFavor: 10,
    maskFloor: 0.12, maskStep: 0.045, friendCatchFloor: 0.35, deliverCatchFactor: 0.65,
  },
  items: { musk: { catch: 0.18 }, cassava: { catch: 0.25 }, catnip: { catch: 0.25 } },
};
const BEFORE = {
  quick: true,
  rules: {
    orderCountWeights: [[0, 25], [1, 45], [2, 30]], giftCoef: { like: 1.2, plain: 1, hate: 0.8 }, deliverFriend: 5, pillowFavor: 15,
    maskFloor: 0.08, maskStep: 0.06, friendCatchFloor: 0.2, deliverCatchFactor: 0.5,
  },
  items: { musk: { catch: 0.12 }, cassava: { catch: 0.18 }, catnip: { catch: 0.18 } },
};
const VALUES = [
  ['每天訂單（0／1／2 張）', '25／45／30%', '15／45／40%'],
  ['枕邊風恩寵', '+15', '+10'],
  ['送禮友好係數（喜歡／普通／不喜歡的成品）', '×1.2／1／0.8', '×1.3／1.1／0.85'],
  ['親自交貨友好', '+5 起', '+6 起'],
  ['被抓基礎值（麝香／木薯粉、貓薄荷；紅花 45% 不變）', '12／18%', '18／25%'],
  ['遮掩最多壓到／每點遮掩分', '8%／−6%', '12%／−4.5%'],
  ['友好、交貨最多把被抓打到', '×0.2、×0.5', '×0.35、×0.65'],
];

const MAIN = [...BOTS, novice, fan];
const HALF = BOTS.map((b) => ({ ...b, name: `${b.name}（唱一半）`, sing: 0.5 }));
console.log(`跑模擬：每種 ${N} 局…`);
const res = runVariant(D, CHOSEN, N, [...MAIN, ...HALF]);
const before = runVariant(D, BEFORE, N, MAIN);

const STRAT = {
  正經: '從不加料；乖乖做訂單、交貨，銀兩夠（留 40 兩）就打點敬事房；被翻一定唱。',
  交際: '從不加料；多的成品送給最喜歡它的妃嬪，沒事就去拜訪今晚侍寢的人養枕邊風。',
  隨手加料: '手上剛好有料就一半機率加，不看風險；不買料。',
  精算: '被抓機率低於 15% 才加；會買木薯粉、煉紅花；有喜就打掉、沒有就讓她不孕；侍寢的人用出包料整她。',
  高手: '跟精算一樣，但只整恩寵快追上自己的人；只在自己被翻機率低時才打點。',
  新手: '照訂單做事、不懂喜好和遮掩；一半撈泡泡（亂撈）、10% 記錯配方；有料 30% 亂加；禁足抄經；唱一半；20% 讓包捐代交。',
  甄嬛傳迷: '先交好再下手；舒痕膠＋麝香給真環、紅花／麝香給審沒裝；一定撈泡泡挑遮掩特性；被抓機率低於 25% 就敢下手；禁足抄經、心經送人；70% 唱；每天 25% 先試沒做過的事。',
};
const WHO = D.ALL;
const pct = (x, d = 1) => `${(x * 100).toFixed(d)}%`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const names = MAIN.map((b) => b.name);
const titleName = Object.fromEntries(D.TITLES.map((t) => [t.id, t.name]));

// 很難拿到的封號：7 種機器人平均 < 3%
const WHY = {
  shexiang: '要用麝香讓人不孕（3 劑）或小產；麝香貴、被抓率高，機器人多半用紅花。',
  yuanzhu: '要舒痕膠＋麝香送到真環手上；只有刻意去做的人（甄嬛傳迷）才拿得到。',
  shuangmian: '三位都要中招、一次都不能被抓，還要三位友好都 ≥ 35。',
  duanzi: '審沒裝和真環都要不孕或小產。',
  michelin: '一份成品特性總和要 ≥ 7 級（2026-11-26 由「三種都 3 級」放寬）；要會撈泡泡、起鍋也要停得準。',
  wentaiyi: '被抓 2 次以上。',
  ganlu: '要被禁足、而且抄經 3 次以上。',
  guimi: '三位友好都 ≥ 40；滑妃開局友好只有 10。',
  baojuan: '包捐代交 ≥ 5 次（2026-11-26 放寬）；機器人只在禁足或好奇時才讓包捐代交。',
  baimang: '加過料但一次都沒得逞。',
  jingshi: '打點敬事房 2 次以上。',
  bailian: '十天都沒加料。',
  heian: '調合失敗一次；只有新手和甄嬛傳迷會失手。',
  zhongsi: '有妃嬪生下皇嗣。',
  miaoyin: '唱金縷衣 2 次以上。',
  touming: '什麼封號都沒拿到。',
};
const avgGot = (id) => names.reduce((a, n) => a + (res[n].got[id] || 0), 0) / names.length;
const rare = D.TITLES.filter((t) => avgGot(t.id) < 0.03).sort((a, b) => avgGot(a.id) - avgGot(b.id));

const color = (who) => D.CHARS[who].color;
const winBars = names.map((n) => {
  const w = res[n].winRate;
  const b0 = before[n].winRate;
  return `<div class="wbar"><span class="wn">${n}</span><span class="wtrack"><i style="width:${(w * 100 / 0.4).toFixed(1)}%"></i><b class="was" style="left:${(b0 * 100 / 0.4).toFixed(1)}%" title="調整前 ${pct(b0)}"></b></span><span class="wv">${pct(w)}<small>調整前 ${pct(b0)}</small></span></div>`;
}).join('');
const topBars = names.map((n) => `<div class="tbar"><span class="wn">${n}</span><span class="stack">${WHO.map((w) => {
  const v = res[n].tops[w] || 0;
  return v > 0.005 ? `<i style="width:${(v * 100).toFixed(1)}%;background:${color(w)}" title="${D.CHARS[w].name} ${pct(v)}">${v >= 0.08 ? `${D.CHARS[w].name} ${pct(v, 0)}` : ''}</i>` : '';
}).join('')}</span></div>`).join('');
const favorRows = names.map((n) => `<tr><th>${n}</th>${WHO.map((w) => `<td>${res[n].favor[w].toFixed(0)}</td>`).join('')}</tr>`).join('');
const spikeRows = names.map((n) => {
  const r = res[n];
  return `<tr><th>${n}</th><td>${r.stats.spikesUsed.toFixed(1)}</td><td>${r.caught.toFixed(2)}</td><td class="hl">${pct(r.caughtGames, 0)}</td><td>${(r.stats.sutras || 0).toFixed(2)}</td><td>${r.m.ordersTotal.toFixed(1)}</td><td>${r.m.sings.toFixed(2)}</td><td>${r.m.pillow.toFixed(2)}</td></tr>`;
}).join('');
const heat = (v) => `background:rgba(192,38,43,${Math.min(0.85, v * 1.1).toFixed(2)});color:${v > 0.45 ? '#fff' : 'inherit'}`;
const titleRows = D.TITLES.map((t, i) => `<tr><th><span class="no">${i + 1}</span>${t.name}</th>${names.map((n) => {
  const v = n in res ? res[n].got[t.id] || 0 : 0;
  return `<td style="${heat(v)}">${v ? pct(v, v < 0.01 ? 1 : 0) : '—'}</td>`;
}).join('')}</tr>`).join('');
const mainRows = names.map((n) => {
  const e = Object.entries(res[n].endings).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return `<tr><th>${n}</th><td>${e.map(([k, v]) => `${titleName[k]} <b>${pct(v, 0)}</b>`).join('、')}</td></tr>`;
}).join('');
const singRows = BOTS.map((b) => {
  const a = res[b.name];
  const h = res[`${b.name}（唱一半）`];
  return `<tr><th>${b.name}</th><td>${pct(a.winRate)}</td><td>${pct(h.winRate)}</td><td>${((a.winRate - h.winRate) * 100).toFixed(1)}</td><td>${a.m.sings.toFixed(2)}／${h.m.sings.toFixed(2)}</td></tr>`;
}).join('');
const rareList = rare.map((t) => {
  const best = names.map((n) => [n, res[n].got[t.id] || 0]).sort((a, b) => b[1] - a[1])[0];
  return `<li><b>${t.name}</b><span class="rv">平均 ${pct(avgGot(t.id))}${best[1] > 0 ? `，最常拿到的是${best[0]}（${pct(best[1])}）` : '，沒有機器人拿到'}</span><p>${esc(WHY[t.id] || '')}</p></li>`;
}).join('');
const strat = names.map((n) => `<div class="sc"><h3>${n}</h3><p>${esc(STRAT[n])}</p></div>`).join('');

const winMax = names.reduce((a, n) => (res[n].winRate > res[a].winRate ? n : a));
const winMin = names.reduce((a, n) => (res[n].winRate < res[a].winRate ? n : a));
const huafeiTop = names.reduce((a, n) => a + (res[n].tops.huafei || 0), 0) / names.length;
const spikers = ['精算', '高手', '甄嬛傳迷'];
const sutraRange = spikers.map((n) => res[n].caughtGames);

VALUES.push(['炎洗宮米其林', '三種特性都 3 級', '特性總和 ≥ 7 級'], ['包捐才是本體', '全由包捐代交、至少 3 張', '包捐代交 ≥ 5 次']);
const html = `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>數值模擬報告</title>
<style>
:root { --bg:#faf6ef; --card:#fff; --ink:#2b1f2e; --muted:#6f6475; --line:#e7ddd0; --accent:#8e2b2b; --gold:#c9902c; --track:#efe7dc; }
@media (prefers-color-scheme: dark) { :root { --bg:#17121c; --card:#221a29; --ink:#f1e8f7; --muted:#b5a6c2; --line:#3a2f45; --accent:#f08a7e; --gold:#f4c66a; --track:#2e2538; } }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.6 'Noto Sans TC',-apple-system,'PingFang TC','Microsoft JhengHei',sans-serif; }
main { max-width:1040px; margin:0 auto; padding:28px 16px 60px; }
h1 { font-family:'Noto Serif TC','Songti TC',serif; font-size:28px; margin:0 0 4px; }
h2 { font-family:'Noto Serif TC','Songti TC',serif; font-size:20px; margin:36px 0 6px; color:var(--accent); }
.sub { color:var(--muted); margin:0 0 18px; }
.lead { color:var(--muted); margin:0 0 14px; font-size:14px; }
.cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; }
.card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:14px 16px; }
.card .k { font-size:13px; color:var(--muted); } .card .v { font-size:24px; font-weight:800; margin-top:2px; } .card .n { font-size:13px; color:var(--muted); }
table { border-collapse:collapse; width:100%; background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; font-size:14px; }
th, td { padding:7px 10px; border-bottom:1px solid var(--line); text-align:right; font-variant-numeric:tabular-nums; }
th { text-align:left; font-weight:700; white-space:nowrap; } thead th { background:var(--track); font-size:13px; text-align:right; } thead th:first-child { text-align:left; }
.wrap { overflow-x:auto; }
td.hl { font-weight:800; color:var(--accent); }
.wbar, .tbar { display:grid; grid-template-columns:86px 1fr 130px; gap:10px; align-items:center; margin:6px 0; }
.tbar { grid-template-columns:86px 1fr; }
.wn { font-weight:700; font-size:14px; }
.wtrack { position:relative; height:18px; background:var(--track); border-radius:9px; }
.wtrack i { position:absolute; inset:0 auto 0 0; background:var(--gold); border-radius:9px; }
.wtrack .was { position:absolute; top:-4px; bottom:-4px; width:3px; background:var(--ink); opacity:.55; border-radius:2px; }
.wv { font-weight:800; font-variant-numeric:tabular-nums; } .wv small { display:block; font-weight:400; color:var(--muted); font-size:12px; }
.stack { display:flex; height:24px; border-radius:8px; overflow:hidden; background:var(--track); }
.stack i { display:flex; align-items:center; justify-content:center; font-style:normal; font-size:12px; color:#fff; white-space:nowrap; overflow:hidden; text-shadow:0 1px 2px rgba(0,0,0,.35); }
.legend { display:flex; gap:14px; flex-wrap:wrap; font-size:13px; color:var(--muted); margin:6px 0 0; } .legend span::before { content:''; display:inline-block; width:10px; height:10px; border-radius:3px; background:var(--c); margin-right:5px; }
.titles th .no { display:inline-block; width:22px; color:var(--muted); font-weight:400; }
.titles td { text-align:center; font-size:13px; }
.rare { list-style:none; padding:0; display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:10px; }
.rare li { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:10px 14px; }
.rare .rv { display:block; font-size:13px; color:var(--accent); } .rare p { margin:4px 0 0; font-size:13px; color:var(--muted); }
.strat { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:10px; }
.sc { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:10px 14px; } .sc h3 { margin:0 0 2px; font-size:15px; } .sc p { margin:0; font-size:13.5px; color:var(--muted); }
.note { background:var(--card); border-left:4px solid var(--gold); border-radius:8px; padding:10px 14px; font-size:14px; margin-top:10px; }
.find { margin:0; padding-left:20px; } .find li { margin:4px 0; }
</style></head><body><main>
<h1>數值模擬報告</h1>
<p class="sub">${new Date().toISOString().slice(0, 10)}・你決定的版本（D 組＋被抓「更重」＋枕邊風 +10）・每種機器人 ${N} 局・一鍵採集・固定種子</p>

<div class="cards">
  <div class="card"><div class="k">最好贏的玩法</div><div class="v">${winMax} ${pct(res[winMax].winRate)}</div><div class="n">最難贏：${winMin} ${pct(res[winMin].winRate)}</div></div>
  <div class="card"><div class="k">加料玩家碰到抄經（至少被禁足一次）</div><div class="v">${pct(Math.min(...sutraRange), 0)}～${pct(Math.max(...sutraRange), 0)}</div><div class="n">精算、高手、甄嬛傳迷</div></div>
  <div class="card"><div class="k">最常恩寵第一的人</div><div class="v">滑妃 ${pct(huafeiTop, 0)}</div><div class="n">7 種機器人平均</div></div>
  <div class="card"><div class="k">很難拿到的封號（平均 &lt; 3%）</div><div class="v">${rare.length} 個</div><div class="n">見下方「很難拿到的封號」</div></div>
</div>

<h2>重點</h2>
<ul class="find">
  <li>逆襲成功率整體下修：最好贏的${winMax}是 ${pct(res[winMax].winRate)}，調整前是 ${pct(before[winMax].winRate)}。沒逆襲成功的局，最後多半是滑妃恩寵第一。</li>
  <li>加料型的玩家大約每 ${(1 / Math.max(...sutraRange)).toFixed(1)}～${(1 / Math.min(...sutraRange)).toFixed(1)} 局會被禁足一次、碰到抄經；不加料的正經、交際永遠碰不到。</li>
  <li>唱金縷衣對勝率的影響見「唱金縷衣」一節：每次都唱和只唱一半，差 ${Math.min(...BOTS.map((b) => (res[b.name].winRate - res[`${b.name}（唱一半）`].winRate) * 100)).toFixed(1)}～${Math.max(...BOTS.map((b) => (res[b.name].winRate - res[`${b.name}（唱一半）`].winRate) * 100)).toFixed(1)} 個百分點。</li>
  <li>甄嬛傳迷拿到「原著重現」的比例是 ${pct(res['甄嬛傳迷'].got.yuanzhu || 0, 0)}：只要刻意去做就很容易，其他機器人幾乎拿不到。</li>
  <li>放寬後的「炎洗宮米其林」（特性總和 ≥ 7）：甄嬛傳迷 ${pct(res['甄嬛傳迷'].got.michelin || 0)}、新手 ${pct(res['新手'].got.michelin || 0)}；「包捐才是本體」（代交 ≥ 5 次）：新手 ${pct(res['新手'].got.baojuan || 0)}。</li>
</ul>

<h2>數值版本</h2>
<div class="wrap"><table><thead><tr><th>數值</th><th>調整前</th><th>這次</th></tr></thead><tbody>
${VALUES.map(([a, b, c]) => `<tr><th>${a}</th><td>${b}</td><td><b>${c}</b></td></tr>`).join('')}
</tbody></table></div>

<h2>逆襲成功率</h2>
<p class="lead">零溶恩寵第一的機率。直線是調整前的位置（橫軸到 40%）。</p>
${winBars}

<h2>最後誰恩寵最高</h2>
<p class="lead">每種機器人的局裡，第 10 天結算後誰排第一。</p>
${topBars}
<div class="legend">${WHO.map((w) => `<span style="--c:${color(w)}">${D.CHARS[w].name}</span>`).join('')}</div>
<h3 style="font-size:15px;margin:18px 0 6px">最終恩寵平均</h3>
<div class="wrap"><table><thead><tr><th>機器人</th>${WHO.map((w) => `<th>${D.CHARS[w].name}</th>`).join('')}</tr></thead><tbody>${favorRows}</tbody></table></div>

<h2>加料、被抓與抄經</h2>
<p class="lead">「碰到抄經」＝一局裡至少被禁足一次。</p>
<div class="wrap"><table><thead><tr><th>機器人</th><th>一局加料</th><th>一局被抓</th><th>碰到抄經</th><th>一局抄經</th><th>一局訂單</th><th>一局唱歌</th><th>一局枕邊風</th></tr></thead><tbody>${spikeRows}</tbody></table></div>

<h2>封號：拿到的機率</h2>
<p class="lead">每個封號在每種機器人的局裡出現的比例（含另外加封）。排序＝封號的稀有順位，越上面越稀有。</p>
<div class="wrap"><table class="titles"><thead><tr><th>封號</th>${names.map((n) => `<th>${n}</th>`).join('')}</tr></thead><tbody>${titleRows}</tbody></table></div>
<h3 style="font-size:15px;margin:18px 0 6px">最常拿到的主封號（前 3 名）</h3>
<div class="wrap"><table><tbody>${mainRows}</tbody></table></div>

<h2>很難拿到的封號</h2>
<p class="lead">7 種機器人平均不到 3% 的封號，和難拿的原因。</p>
<ul class="rare">${rareList}</ul>

<h2>唱金縷衣</h2>
<p class="lead">原本五種機器人，每次都唱 vs. 一半機率唱（唱完隔天少一個時辰）。</p>
<div class="wrap"><table><thead><tr><th>機器人</th><th>每次都唱</th><th>唱一半</th><th>差（百分點）</th><th>一局唱幾次</th></tr></thead><tbody>${singRows}</tbody></table></div>

<h2>機器人的策略</h2>
<p class="lead">共通：每天先交貨、再照期限做訂單、缺素材就買或採集；禁足時讓包捐代交。原本五種用快速調合、不會失手。</p>
<div class="strat">${strat}</div>
<div class="note">撈泡泡的成功率、失手率是假設值（甄嬛傳迷起鍋升級 50%／維持 35%／降級 15%、記錯配方 5%；新手 30／40／30%、10%），不是真人數據；「米其林」「黑暗料理」的比例只能當參考。機器人加料都會看風險，真人隨手加料被抓的機會更高。</div>
</main></body></html>`;
fs.writeFileSync(OUT, html);
console.log('報告：', OUT);
