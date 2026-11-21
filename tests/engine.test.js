// 引擎層 seeded 單元測試：覆蓋 I/O 矩陣每一列（加料被抓／麝香絕育／紅花打胎／
// 翻牌子權重／夜結算侍寢／枕邊風有喜／生子）與封號 stat 路徑。
// 隨機一律注入可控 rand（()=>0 必中、()=>0.999 必不中、或固定序列），不碰 Math.random。
// 執行：node --test tests/
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const E = require('../js/engine.js');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function loadData() {
  const ctx = { window: {} };
  vm.runInNewContext(read('js/data.js'), ctx);
  return ctx.window.GAME_DATA;
}
const D = loadData();
const fresh = () => E.newState(D);
const ZERO = () => 0; // 必中（擲骰值 < 任何正機率）
const ONE = () => 0.999; // 必不中
// 固定序列的 rand（settleNight 依序擲：枕邊風 → 有喜）
function seq(values) {
  let i = 0;
  return () => (i < values.length ? values[i++] : values[values.length - 1]);
}

// ───────── 加料被抓 ─────────
test('applySpike：被抓 → outcome caught、禁足拉高、stats.caught++、友好 += caughtFriend，success 不增', () => {
  const S = fresh();
  const res = E.applySpike(D, S, 'meizhuang', 'safflower', 'gift', ZERO); // 0.40×0.6=0.24，ZERO 必中
  assert.strictEqual(res.outcome, 'caught');
  assert.strictEqual(res.caught, true);
  assert.strictEqual(res.days, D.ITEMS.safflower.ground); // 4
  assert.strictEqual(res.friendDelta, D.RULES.caughtFriend); // -30
  assert.strictEqual(S.friend.meizhuang, 40 + D.RULES.caughtFriend); // 10
  assert.strictEqual(S.groundUntil, S.day + D.ITEMS.safflower.ground); // 1+4=5
  assert.strictEqual(S.stats.caught, 1);
  assert.strictEqual(S.stats.groundedDays, D.ITEMS.safflower.ground);
  assert.strictEqual(S.stats.spikesUsed, 1);
  assert.strictEqual(S.stats.success, 0, '被抓不算得逞');
});

test('applySpike：無 spike → plain，不動 stats', () => {
  const S = fresh();
  const res = E.applySpike(D, S, 'meizhuang', null, 'deliver', ZERO);
  assert.deepStrictEqual(res, { outcome: 'plain' });
  assert.strictEqual(S.stats.spikesUsed, 0);
});

// ───────── 麝香絕育 ─────────
test('applySpike：連下麝香達 muskDoses 未被抓 → infertile、muskRuin++、ruined 含她；已不孕再下 → musk_useless', () => {
  const S = fresh();
  const who = 'meizhuang'; // 麝香 via gift 被抓率 0.10×0.6=0.06，ONE 必不中
  const r1 = E.applySpike(D, S, who, 'musk', 'gift', ONE);
  assert.strictEqual(r1.outcome, 'musk_dose');
  assert.strictEqual(S.conc[who].musk, 1);
  const r2 = E.applySpike(D, S, who, 'musk', 'gift', ONE);
  assert.strictEqual(r2.outcome, 'musk_dose');
  const r3 = E.applySpike(D, S, who, 'musk', 'gift', ONE);
  assert.strictEqual(r3.outcome, 'musk_infertile');
  assert.strictEqual(S.conc[who].status, 'infertile');
  assert.strictEqual(S.stats.muskRuin, 1);
  assert.ok(S.stats.ruined.includes(who));
  assert.strictEqual(r3.favDelta, D.RULES.fx.infertile); // -10
  assert.strictEqual(S.stats.success, 3);
  assert.strictEqual(S.stats.spikesUsed, 3);
  // 已不孕 → 無效
  const r4 = E.applySpike(D, S, who, 'musk', 'gift', ONE);
  assert.strictEqual(r4.outcome, 'musk_useless');
  assert.strictEqual(r4.useless, true);
  assert.strictEqual(S.stats.spikesUsed, 4);
  assert.strictEqual(S.stats.success, 3, '無效不加 success');
});

// ───────── 紅花打胎 ─────────
test('applySpike：對懷孕妃下紅花未被抓 → 小產＋絕育、ruined；已不孕 → safflower_useless', () => {
  const S = fresh();
  const who = 'zhenhuan';
  S.conc[who].status = 'pregnant';
  S.conc[who].preg = 1;
  // 紅花 via gift 被抓率 0.40×(1-0.5)=0.20，ONE 必不中
  const r = E.applySpike(D, S, who, 'safflower', 'gift', ONE);
  assert.strictEqual(r.outcome, 'miscarry_safflower');
  assert.strictEqual(S.conc[who].status, 'infertile');
  assert.strictEqual(S.conc[who].preg, 0);
  assert.strictEqual(r.favDelta, D.RULES.fx.saffMiscarry); // -25
  assert.ok(S.stats.ruined.includes(who));
  assert.strictEqual(S.stats.success, 1);
  // 已不孕再下紅花 → useless
  const r2 = E.applySpike(D, S, who, 'safflower', 'gift', ONE);
  assert.strictEqual(r2.outcome, 'safflower_useless');
  assert.strictEqual(r2.useless, true);
});

// ───────── 翻牌子權重 ─────────
test('flipWeights：基本權重＝恩寵；懷孕妃不列入', () => {
  const S = fresh();
  const w = E.flipWeights(D, S);
  assert.deepStrictEqual(w, { lingrong: 15, huafei: 60, meizhuang: 40, zhenhuan: 45 });
  S.conc.meizhuang.status = 'pregnant';
  assert.ok(!('meizhuang' in E.flipWeights(D, S)), '懷孕妃不列入');
});

test('flipWeights：禁足去 lingrong 權重；empressBoost ×empressFactor；bribe 加權；重複翻 ×repeatFlipFactor', () => {
  let S = fresh();
  S.groundUntil = S.day; // 禁足
  assert.ok(!('lingrong' in E.flipWeights(D, S)), '禁足時 lingrong 不列入');

  S = fresh();
  S.empressBoost = true;
  assert.strictEqual(E.flipWeights(D, S).lingrong, 15 * D.RULES.empressFactor); // 30

  S = fresh();
  assert.strictEqual(E.flipWeights(D, S, D.RULES.bribeWeight).lingrong, 15 + D.RULES.bribeWeight); // 115

  S = fresh();
  S.flip = 'huafei'; // 昨晚翻她 → 今晚喜新厭舊
  assert.strictEqual(E.flipWeights(D, S).huafei, 60 * D.RULES.repeatFlipFactor); // 30
});

test('flipOdds / chooseFlip：機率占比正確；權重全空 → chooseFlip 為 null', () => {
  const S = fresh();
  const odds = E.flipOdds(D, S);
  const total = 15 + 60 + 40 + 45;
  assert.ok(Math.abs(odds.lingrong - 15 / total) < 1e-9);
  const sum = Object.values(odds).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  // ZERO 擲骰 → 取第一個權重條目（lingrong）
  assert.strictEqual(E.chooseFlip(D, S, ZERO), 'lingrong');
  // 全空：禁足 + 三妃全懷孕
  const S2 = fresh();
  S2.groundUntil = S2.day;
  D.TARGETS.forEach((t) => { S2.conc[t].status = 'pregnant'; });
  assert.deepStrictEqual(E.flipWeights(D, S2), {});
  assert.strictEqual(E.chooseFlip(D, S2, ZERO), null);
});

// ───────── 夜結算：零溶侍寢 ─────────
test('settleNight：零溶侍寢（正常 / 演唱 / 禁足）', () => {
  // 正常侍寢
  let S = fresh();
  S.flip = 'lingrong';
  let rep = E.settleNight(D, S, { sing: false, rand: ONE });
  assert.strictEqual(rep.serve.kind, 'serve');
  assert.strictEqual(rep.serve.favDelta, D.RULES.serveFavor); // +10
  assert.strictEqual(S.favor.lingrong, 15 + D.RULES.serveFavor); // 25
  assert.strictEqual(S.tired, false);
  assert.strictEqual(S.stats.sings, 0);
  assert.strictEqual(S.noFlipNights, 0, '侍寢後黃后倒數歸零');

  // 演唱金縷衣
  S = fresh();
  S.flip = 'lingrong';
  rep = E.settleNight(D, S, { sing: true, rand: ONE });
  assert.strictEqual(rep.serve.kind, 'sing');
  assert.strictEqual(S.favor.lingrong, 15 + D.RULES.serveFavor + D.RULES.singExtraFavor); // 30
  assert.strictEqual(S.tired, true);
  assert.strictEqual(S.stats.sings, 1);

  // 禁足 → 侍寢取消、恩寵不變
  S = fresh();
  S.flip = 'lingrong';
  S.groundUntil = S.day;
  rep = E.settleNight(D, S, { sing: false, rand: ONE });
  assert.strictEqual(rep.serve.kind, 'grounded');
  assert.strictEqual(rep.serve.favDelta, 0);
  assert.strictEqual(S.favor.lingrong, 15, '禁足取消侍寢，恩寵不變');
  assert.strictEqual(S.noFlipNights, 1, '沒侍寢 → 黃后倒數 +1');
});

// ───────── 夜結算：枕邊風 / 有喜 / 出包 ─────────
test('settleNight：妃嬪侍寢命中枕邊風與有喜（當晚受孕該夜不 +preg）', () => {
  const S = fresh();
  const who = 'meizhuang';
  S.flip = who;
  S.friend[who] = 80; // 枕邊風 min(60,60)/100=0.6
  const rep = E.settleNight(D, S, { sing: false, rand: seq([0, 0]) }); // 先枕邊風命中、再有喜命中
  assert.strictEqual(rep.serve.kind, 'serve');
  assert.strictEqual(S.favor[who], 40 + D.RULES.serveFavor); // 50
  assert.ok(rep.pillow);
  assert.strictEqual(rep.pillow.favDelta, D.RULES.pillowFavor); // +8
  assert.strictEqual(S.favor.lingrong, 15 + D.RULES.pillowFavor); // 23
  assert.strictEqual(rep.conceived, who);
  assert.strictEqual(S.conc[who].status, 'pregnant');
  assert.strictEqual(S.conc[who].preg, 0, '當晚受孕者該夜不 +preg');
});

test('settleNight：有 debuff → 侍寢出包、serveFailFavor、無枕邊風，結算後 debuff 清除', () => {
  const S = fresh();
  const who = 'zhenhuan';
  S.flip = who;
  S.conc[who].debuff = 'itch';
  const rep = E.settleNight(D, S, { sing: false, rand: ZERO });
  assert.strictEqual(rep.serve.kind, 'debuff');
  assert.strictEqual(rep.serve.debuff, 'itch');
  assert.strictEqual(rep.serve.favDelta, D.RULES.serveFailFavor); // -10
  assert.strictEqual(S.favor[who], 45 + D.RULES.serveFailFavor); // 35
  assert.strictEqual(rep.pillow, null);
  assert.strictEqual(rep.conceived, null);
  assert.strictEqual(S.conc[who].debuff, null, '夜結算後 debuff 消失');
});

// ───────── 夜結算：生子 ─────────
test('settleNight：懷孕妃 preg 達 pregnancyNights → 生子、favor += birthFavor、births++', () => {
  const S = fresh();
  const who = 'meizhuang';
  S.conc[who].status = 'pregnant';
  S.conc[who].preg = D.RULES.pregnancyNights - 1; // 今晚 +1 達標
  S.flip = null; // 今晚沒人侍寢，只跑懷孕進度
  const rep = E.settleNight(D, S, { sing: false, rand: ONE });
  assert.strictEqual(S.conc[who].status, 'normal');
  assert.strictEqual(S.conc[who].preg, 0);
  assert.strictEqual(S.favor[who], 40 + D.RULES.birthFavor); // 60
  assert.strictEqual(S.stats.births, 1);
  assert.deepStrictEqual(rep.births, [{ who, favDelta: D.RULES.birthFavor }]);
});

// ───────── 黃后進言倒數 ─────────
test('settleNight：連續 empressNights 晚沒侍寢 → empressBoost 排隊', () => {
  const S = fresh();
  S.flip = null;
  let rep;
  for (let i = 0; i < D.RULES.empressNights; i++) rep = E.settleNight(D, S, { sing: false, rand: ONE });
  assert.strictEqual(rep.empressQueued, true);
  assert.strictEqual(S.empressBoost, true);
  assert.strictEqual(S.noFlipNights, 0, '觸發後倒數歸零');
});

// ───────── 封號 stat 路徑（經 computeEnding / TITLE_CHECK）─────────
test('封號路徑：caught/muskRuin/sings/births/spikesUsed+success 驅動對應封號', () => {
  // 白蓮花：完全沒加料
  assert.strictEqual(E.TITLE_CHECK.bailian(fresh()), true);

  // 白忙一場：加了料但一次都沒得逞（對已不孕者下麝香）
  let S = fresh();
  E.applySpike(D, S, 'huafei', 'musk', 'gift', ONE); // huafei 開局不孕 → useless
  assert.strictEqual(S.stats.spikesUsed, 1);
  assert.strictEqual(S.stats.success, 0);
  assert.strictEqual(E.TITLE_CHECK.baimang(S), true);
  assert.strictEqual(E.TITLE_CHECK.bailian(S), false);
  let book = E.computeEnding(D, S, []).book;
  assert.ok(book.includes('baimang'));

  // 溫太醫不要：被抓 ≥ 2
  S = fresh();
  E.applySpike(D, S, 'meizhuang', 'safflower', 'gift', ZERO);
  E.applySpike(D, S, 'zhenhuan', 'safflower', 'gift', ZERO);
  assert.strictEqual(S.stats.caught, 2);
  assert.strictEqual(E.TITLE_CHECK.wentaiyi(S), true);

  // 麝香代言人：muskRuin > 0
  S = fresh();
  for (let i = 0; i < D.RULES.muskDoses; i++) E.applySpike(D, S, 'meizhuang', 'musk', 'gift', ONE);
  assert.ok(S.stats.muskRuin > 0);
  assert.strictEqual(E.TITLE_CHECK.shexiang(S), true);

  // 真・妙音娘子：演唱 ≥ 2
  S = fresh();
  S.flip = 'lingrong';
  E.settleNight(D, S, { sing: true, rand: ONE });
  S.day++; S.flip = 'lingrong';
  E.settleNight(D, S, { sing: true, rand: ONE });
  assert.strictEqual(S.stats.sings, 2);
  assert.strictEqual(E.TITLE_CHECK.miaoyin(S), true);

  // 螽斯門零溶：有妃生子
  S = fresh();
  S.conc.meizhuang.status = 'pregnant';
  S.conc.meizhuang.preg = D.RULES.pregnancyNights - 1;
  S.flip = null;
  E.settleNight(D, S, { sing: false, rand: ONE });
  assert.strictEqual(S.stats.births, 1);
  assert.strictEqual(E.TITLE_CHECK.zhongsi(S), true);
});

// ───────── 流程與各行動（seeded）─────────

test('buy：足銀 → 扣錢入庫 ok:true；銀不足 → ok:false', () => {
  const S = fresh();
  const before = S.silver;
  const r = E.buy(D, S, 'musk'); // 50 銀
  assert.deepStrictEqual(r, { ok: true });
  assert.strictEqual(S.silver, before - D.ITEMS.musk.price);
  assert.strictEqual(S.inv.musk, 1);
  // 銀不足
  S.silver = 0;
  assert.deepStrictEqual(E.buy(D, S, 'musk'), { ok: false });
  assert.strictEqual(S.inv.musk, 1, '失敗不入庫');
});

test('bribe：足銀未打點 → 扣錢加權記 stat；已打點 → done；銀不足 → poor', () => {
  const S = fresh();
  S.silver = 200;
  const r = E.bribe(D, S);
  assert.deepStrictEqual(r, { ok: true });
  assert.strictEqual(S.silver, 200 - D.RULES.bribeCost); // 50
  assert.strictEqual(S.bribe, D.RULES.bribeWeight); // 100
  assert.strictEqual(S.bribedToday, true);
  assert.strictEqual(S.stats.bribes, 1);
  // 已打點
  assert.deepStrictEqual(E.bribe(D, S), { ok: false, reason: 'done' });
  // 銀不足（重置打點旗標）
  S.bribedToday = false; S.silver = 10;
  assert.deepStrictEqual(E.bribe(D, S), { ok: false, reason: 'poor' });
  assert.strictEqual(S.stats.bribes, 1, '失敗不計 stat');
});

test('rejectOrder：移訂單、友好 rejectFriend、記 dayLog、回 {who}；找不到 → null', () => {
  const S = fresh();
  S.orders = [{ id: 7, who: 'zhenhuan', product: 'cake', due: 3 }];
  const r = E.rejectOrder(D, S, 7);
  assert.deepStrictEqual(r, { who: 'zhenhuan' });
  assert.strictEqual(S.orders.length, 0);
  assert.strictEqual(S.friend.zhenhuan, 50 + D.RULES.rejectFriend); // 49
  assert.ok(S.dayLog.some((l) => l.includes('婉拒')));
  assert.strictEqual(E.rejectOrder(D, S, 999), null);
});

test('gather：slot++、採 2+(rand<0.5?1:0) 個、各 weightedPick 入庫、回 {loc,got,ready}', () => {
  // ZERO：數量 3、weightedPick 取第一條（御花園→jasmine）
  const S = fresh();
  const r = E.gather(D, S, 'garden', ZERO);
  assert.strictEqual(S.slot, 1);
  assert.deepStrictEqual(r.got, { jasmine: 3 });
  assert.strictEqual(S.inv.jasmine, 1 + 3); // 開局 1
  assert.strictEqual(r.loc, 'garden');
  assert.deepStrictEqual(r.ready, []);
  assert.ok(S.dayLog.some((l) => l.includes('採集')));
  // rand=0.5：數量 2、weightedPick(0.5) 於御花園 → osmanthus
  const S2 = fresh();
  const r2 = E.gather(D, S2, 'garden', () => 0.5);
  assert.deepStrictEqual(r2.got, { osmanthus: 2 });
  // ready：湊齊訂單材料時回報（此處已有 sandalwood，採到 jasmine → 安神香齊）
  const S3 = fresh();
  S3.orders = [{ id: 1, who: 'meizhuang', product: 'incense', due: 3 }];
  const r3 = E.gather(D, S3, 'garden', ZERO); // 採到 jasmine
  assert.ok(r3.ready.some((o) => o.product === 'incense'));
});

test('craft：成功入手牌、材料 -1、slot++；配方錯 → junk、stats.junk++', () => {
  // 成功：檀香+茉莉 → 安神香
  const S = fresh();
  const r = E.craft(D, S, { mats: ['sandalwood', 'jasmine'], spike: null, forOrder: null, forWho: null });
  assert.strictEqual(r.product, 'incense');
  assert.strictEqual(r.toInv, false);
  assert.strictEqual(S.slot, 1);
  assert.strictEqual(S.inv.sandalwood, undefined, '材料用掉（1→0 刪鍵）');
  assert.strictEqual(S.inv.jasmine, undefined);
  assert.strictEqual(S.hand.length, 1);
  assert.strictEqual(S.hand[0].product, 'incense');
  assert.strictEqual(r.itemId, S.hand[0].id);
  // junk：亂配
  const S2 = fresh();
  const r2 = E.craft(D, S2, { mats: ['sandalwood', 'honey'], spike: null, forOrder: null, forWho: null });
  assert.strictEqual(r2.product, 'junk');
  assert.strictEqual(S2.stats.junk, 1);
  assert.strictEqual(S2.hand[0].product, 'junk');
  assert.strictEqual(S2.hand[0].spike, null);
});

test('craft：加料成品 item.spike 帶料、料 -1；煉紅花 toInv 入庫不可加料', () => {
  // 加料：安神香 + 麝香
  const S = fresh();
  S.inv.musk = 1;
  const r = E.craft(D, S, { mats: ['sandalwood', 'jasmine'], spike: 'musk', forOrder: null, forWho: null });
  assert.strictEqual(r.spike, 'musk');
  assert.strictEqual(S.inv.musk, undefined, '料用掉');
  assert.strictEqual(S.hand[0].spike, 'musk');
  // 紅花瓣+烈酒 → 紅花（out:inv），即使選了料也忽略
  const S2 = fresh();
  S2.inv.petal = 1; S2.inv.liquor = 1; S2.inv.musk = 1;
  const r2 = E.craft(D, S2, { mats: ['petal', 'liquor'], spike: 'musk', forOrder: null, forWho: null });
  assert.strictEqual(r2.product, 'safflower');
  assert.strictEqual(r2.toInv, true);
  assert.strictEqual(r2.spike, null, 'toInv 不帶料');
  assert.strictEqual(S2.inv.safflower, 1, '煉出的料入庫');
  assert.strictEqual(S2.inv.musk, 1, 'toInv 不消耗所選料');
  assert.strictEqual(S2.hand.length, 0, 'toInv 不入手牌');
});

test('deliver：正常賞銀＋友好；找不到成品 → {noItem:true}', () => {
  const S = fresh();
  S.orders = [{ id: 5, who: 'meizhuang', product: 'incense', due: 3 }];
  S.hand = [{ id: 9, product: 'incense', spike: null }];
  const silver0 = S.silver;
  const r = E.deliver(D, S, 5, null, ONE);
  assert.strictEqual(r.kind, 'deliver');
  assert.strictEqual(r.who, 'meizhuang');
  assert.strictEqual(r.reward, D.PRODUCTS.incense.reward); // 28
  assert.strictEqual(r.friendDelta, D.RULES.deliverFriend); // +5
  assert.strictEqual(S.silver, silver0 + D.PRODUCTS.incense.reward);
  assert.strictEqual(S.friend.meizhuang, 40 + D.RULES.deliverFriend);
  assert.strictEqual(S.orders.length, 0);
  assert.strictEqual(S.hand.length, 0);
  assert.strictEqual(S.slot, 1);
  // 找不到成品
  const S2 = fresh();
  S2.orders = [{ id: 1, who: 'meizhuang', product: 'incense', due: 3 }];
  assert.deepStrictEqual(E.deliver(D, S2, 1, null, ONE), { noItem: true });
  assert.strictEqual(S2.slot, 0, 'noItem 不消耗時辰');
});

test('deliver：加料被抓 → 無賞銀、友好 caughtFriend；無效 → 賞銀減半不加友好', () => {
  // 被抓：紅花交貨給 meizhuang（0.40×0.6×0.5=0.12，ZERO 必中）
  const S = fresh();
  S.orders = [{ id: 1, who: 'meizhuang', product: 'incense', due: 3 }];
  S.hand = [{ id: 1, product: 'incense', spike: 'safflower' }];
  const silver0 = S.silver;
  const r = E.deliver(D, S, 1, null, ZERO);
  assert.strictEqual(r.caught, true);
  assert.strictEqual(r.reward, 0);
  assert.strictEqual(S.silver, silver0, '被抓無賞銀');
  assert.strictEqual(S.friend.meizhuang, 40 + D.RULES.caughtFriend); // 10
  // 無效：對已不孕的滑妃下麝香交貨（ONE 不被抓 → musk_useless）
  const S2 = fresh();
  S2.orders = [{ id: 1, who: 'huafei', product: 'incense', due: 3 }];
  S2.hand = [{ id: 1, product: 'incense', spike: 'musk' }];
  const s0 = S2.silver;
  const r2 = E.deliver(D, S2, 1, null, ONE);
  assert.strictEqual(r2.useless, true);
  assert.strictEqual(r2.reward, Math.round(D.PRODUCTS.incense.reward * D.RULES.uselessRewardRate)); // 14
  assert.strictEqual(S2.silver, s0 + r2.reward);
  assert.strictEqual(S2.friend.huafei, 10, '無效不加友好');
});

test('gift：收下 → 友好＋禮物值；拒收 → refused、不動友好', () => {
  // 收下：ZERO < acceptChance 必收；無料 → 友好 += gift
  const S = fresh();
  S.hand = [{ id: 1, product: 'cream', spike: null }];
  const r = E.gift(D, S, 'meizhuang', 1, ZERO);
  assert.strictEqual(r.kind, 'gift');
  assert.strictEqual(r.refused, undefined);
  assert.strictEqual(S.friend.meizhuang, 40 + D.PRODUCTS.cream.gift); // +6
  assert.strictEqual(S.hand.length, 0);
  assert.strictEqual(S.slot, 1);
  // 拒收：ONE(0.999) >= acceptChance(0.7) → 退回、友好不變、手牌留著
  const S2 = fresh();
  S2.hand = [{ id: 1, product: 'cream', spike: null }];
  const r2 = E.gift(D, S2, 'meizhuang', 1, ONE);
  assert.strictEqual(r2.refused, true);
  assert.strictEqual(S2.friend.meizhuang, 40, '拒收不動友好');
  assert.strictEqual(S2.hand.length, 1, '拒收退回手牌');
  assert.strictEqual(S2.slot, 1, '拒收仍花時辰');
});

test('startDay：逾期扣友好＋移除、tired→slot=1、重置 bribe、回報告', () => {
  const S = fresh();
  S.day = 2;
  S.tired = true;
  S.bribe = 50; S.bribedToday = true;
  S.orders = [{ id: 1, who: 'meizhuang', product: 'incense', due: 1 }]; // 逾期（due < day）
  // seq：chooseFlip → lingrong（r=0）、orderCount → 0 張（r=0）
  const rep = E.startDay(D, S, seq([0, 0]));
  assert.strictEqual(rep.tired, true);
  assert.strictEqual(S.slot, 1);
  assert.strictEqual(S.tired, false);
  assert.deepStrictEqual(rep.lapsed, [{ who: 'meizhuang', product: 'incense' }]);
  assert.strictEqual(S.friend.meizhuang, 40 + D.RULES.lateFriend); // 35
  assert.strictEqual(S.orders.length, 0, '逾期訂單移除');
  assert.strictEqual(rep.flip, 'lingrong');
  assert.strictEqual(S.flip, 'lingrong');
  assert.strictEqual(S.bribe, 0);
  assert.strictEqual(S.bribedToday, false);
  assert.strictEqual(rep.noOrders, true);
  assert.deepStrictEqual(rep.newOrders, []);
});

test('startDay：生成新訂單（weightedPick 數量＋隨機抽對象與品項）', () => {
  const S = fresh();
  // seq：flip(0)→lingrong、orderCount(0.75)→2 張、who1(0)→huafei、prod1(0)→incense、who2(0)→meizhuang、prod2(0)→incense
  const rep = E.startDay(D, S, seq([0, 0.75, 0, 0, 0, 0]));
  assert.strictEqual(rep.newOrders.length, 2);
  assert.deepStrictEqual(rep.newOrders[0], { who: 'huafei', product: 'incense' });
  assert.deepStrictEqual(rep.newOrders[1], { who: 'meizhuang', product: 'incense' });
  assert.strictEqual(S.orders.length, 2);
  assert.strictEqual(S.orders[0].due, S.day + D.RULES.orderDays - 1); // 1+3-1=3
  assert.strictEqual(rep.noOrders, false);
  // 懷孕的對象改點安胎藥（不消耗品項擲骰）
  const S2 = fresh();
  S2.conc.huafei.status = 'pregnant';
  const rep2 = E.startDay(D, S2, seq([0, 0.75, 0, /*prod1 跳過*/ 0, 0]));
  assert.strictEqual(rep2.newOrders[0].who, 'huafei');
  assert.strictEqual(rep2.newOrders[0].product, 'tonic');
});

test('advanceDay：day++、slot 歸零', () => {
  const S = fresh();
  S.day = 3; S.slot = 2;
  E.advanceDay(D, S);
  assert.strictEqual(S.day, 4);
  assert.strictEqual(S.slot, 0);
});

// ───────── 採集小遊戲：場景生成 buildGatherScene ─────────
// 可重現的 seeded rand（LCG），讓「同 rand 兩次呼叫」能逐一比對。
function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

test('buildGatherScene：每種素材≥1、稀有正好 1 個且=地圖指定、座標皆 0..1', () => {
  const scene = E.buildGatherScene(D, fresh(), 'garden', lcg(1));
  assert.strictEqual(scene.loc, 'garden');
  assert.strictEqual(scene.seconds, 30);
  assert.strictEqual(scene.rare, 'itch'); // data.js GATHER.garden.rare
  // 每種素材（茉莉、桂花、玫瑰、癢癢粉）至少各 1
  const ids = scene.items.map((it) => it.id);
  for (const [id] of D.GATHER.garden.table) assert.ok(ids.includes(id), `${id} 至少出現 1 個`);
  // 稀有正好 1 個，且標記 rare 的就是 itch
  const rares = scene.items.filter((it) => it.rare);
  assert.strictEqual(rares.length, 1, '稀有正好 1 個');
  assert.strictEqual(rares[0].id, 'itch');
  assert.strictEqual(ids.filter((id) => id === 'itch').length, 1, '稀有素材只撒 1 個');
  // 總數約 7～9
  assert.ok(scene.items.length >= 7 && scene.items.length <= 9, `總數 ${scene.items.length} 落在 7～9`);
  // 所有座標在 0..1
  for (const it of scene.items) {
    assert.ok(it.x >= 0 && it.x <= 1 && it.y >= 0 && it.y <= 1, '素材座標 0..1');
  }
  assert.ok(scene.guard.x >= 0 && scene.guard.x <= 1 && scene.guard.y >= 0 && scene.guard.y <= 1, '侍衛起點 0..1');
  assert.ok(scene.guard.waypoints.length >= 1, '至少 1 個巡邏點');
  for (const w of scene.guard.waypoints) assert.ok(w.x >= 0 && w.x <= 1 && w.y >= 0 && w.y <= 1, '巡邏點 0..1');
  assert.strictEqual(scene.guard.speed, 0.16);
});

test('buildGatherScene：同 rand（同種子）兩次呼叫 → items/guard 逐一相同（決定性）', () => {
  const a = E.buildGatherScene(D, fresh(), 'garden', lcg(42));
  const b = E.buildGatherScene(D, fresh(), 'garden', lcg(42));
  assert.deepStrictEqual(a, b);
});

test('buildGatherScene：地圖無 rare 欄位 → 取權重最低者為稀有（太醫院→麝香）', () => {
  // data.js 目前只有 garden 設了 rare；taiyi 走 fallback = 權重最低（musk 0.6）
  const scene = E.buildGatherScene(D, fresh(), 'taiyi', lcg(7));
  assert.strictEqual(scene.rare, 'musk');
  assert.strictEqual(scene.items.filter((it) => it.id === 'musk').length, 1, '稀有只 1 個');
  assert.strictEqual(scene.items.filter((it) => it.rare).length, 1);
});

// ───────── 採集小遊戲：收穫套用 applyGatherHaul ─────────
test('applyGatherHaul：inv 各 +count、slot++、dayLog 新增一列、回 {loc,got,ready}', () => {
  const S = fresh();
  S.orders = [{ id: 1, who: 'meizhuang', product: 'incense', due: 3 }]; // 檀香(開局有)+茉莉
  const r = E.applyGatherHaul(D, S, 'garden', { jasmine: 2, itch: 1 });
  assert.strictEqual(S.slot, 1);
  assert.strictEqual(S.inv.jasmine, 1 + 2); // 開局 1
  assert.strictEqual(S.inv.itch, 1);
  assert.strictEqual(r.loc, 'garden');
  assert.deepStrictEqual(r.got, { jasmine: 2, itch: 1 });
  assert.ok(S.dayLog.some((l) => l.includes('採集')));
  // 採到 jasmine → 安神香材料湊齊 → ready 回報
  assert.ok(r.ready.some((o) => o.product === 'incense'));
});

test('applyGatherHaul：got 空 → inv 不變、仍 slot++、dayLog 記「空手而回」', () => {
  const S = fresh();
  const invBefore = JSON.stringify(S.inv);
  const r = E.applyGatherHaul(D, S, 'garden', {});
  assert.strictEqual(S.slot, 1, '空手仍花 1 時辰');
  assert.strictEqual(JSON.stringify(S.inv), invBefore, '空手不動 inv');
  assert.deepStrictEqual(r.got, {});
  assert.ok(S.dayLog.some((l) => l.includes('空手而回')));
  // 傳 undefined 也當空手
  const S2 = fresh();
  const r2 = E.applyGatherHaul(D, S2, 'garden', undefined);
  assert.strictEqual(S2.slot, 1);
  assert.deepStrictEqual(r2.got, {});
});

// ───────── 預測純函式（不擲骰、不改狀態）─────────
test('predict：純函式，risk 與 catchChance 一致、不改狀態', () => {
  const S = fresh();
  const snapshot = JSON.stringify(S);
  const p = E.predict(D, S, 'meizhuang', 'musk', 'deliver');
  assert.strictEqual(p.risk, E.catchChance(D, S, 'meizhuang', 'musk', 'deliver'));
  assert.strictEqual(p.cls, 'good');
  assert.strictEqual(JSON.stringify(S), snapshot, 'predict 不得改狀態');
  // 對不孕者預測麝香 → 無效
  const S2 = fresh();
  assert.strictEqual(E.predict(D, S2, 'huafei', 'musk', 'gift').cls, 'bad');
});
