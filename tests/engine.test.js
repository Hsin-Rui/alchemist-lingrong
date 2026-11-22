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

// ───────── 採集地下城：生成 buildGatherDungeon ─────────
// 可重現的 seeded rand（LCG），讓「同 rand 兩次呼叫」能逐一比對。
function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const DG = D.GATHER.garden.dungeon;
const WALK = '.,G';
const roomOf = (run, o) => run.rooms.findIndex((r) => o.x >= r.x && o.x < r.x + r.w && o.y >= r.y && o.y < r.y + r.h);

// 獨立於引擎 gValid 的不變式檢查（game-design §12.2）
function assertDungeon(run, label) {
  const G = D.GATHER[run.loc];
  const DG = G.dungeon; // 依地圖取參數（蓋掉外層的御花園預設）
  assert.strictEqual(run.w, DG.w, `${label} 寬`);
  assert.strictEqual(run.h, DG.h, `${label} 高`);
  assert.strictEqual(run.tiles.length, DG.h);
  assert.ok(run.tiles.every((row) => row.length === DG.w), `${label} 每列等寬`);
  assert.ok(run.rooms.length >= DG.rooms[0] && run.rooms.length <= DG.rooms[1], `${label} 庭院數 ${run.rooms.length}`);
  assert.strictEqual(run.stepsLeft, DG.steps);
  for (const r of run.rooms) assert.ok(r.w >= DG.roomW[0] && r.w <= DG.roomW[1] && r.h >= DG.roomH[0] && r.h <= DG.roomH[1], `${label} 房間大小 ${r.w}×${r.h}`);
  // 全部可走格都從出生點連得到（擺設沒有切斷連通）
  const dist = E.gatherDist(run, run.player.x, run.player.y);
  let walk = 0;
  for (let y = 0; y < run.h; y++) for (let x = 0; x < run.w; x++) if (WALK.includes(run.tiles[y][x])) walk++;
  assert.strictEqual(dist.filter((d) => d >= 0).length, walk, `${label} 全圖連通`);
  assert.strictEqual(run.tiles[run.player.y][run.player.x], 'G', `${label} 出生在月洞門`);
  // 素材：每種 ≥1、稀有正好 rareCount 個、總數＝1（出生點旁）＋稀有＋常見各 1＋額外，都走得到且互不重疊
  const ids = run.items.map((it) => it.id);
  for (const [id] of G.table) assert.ok(ids.includes(id), `${label} ${id} 至少 1 個`);
  const base = 1 + DG.rareCount + (G.table.length - 1);
  assert.ok(run.items.length >= base + DG.extraItems[0] && run.items.length <= base + DG.extraItems[1], `${label} 素材總數 ${run.items.length}`);
  const rares = run.items.filter((it) => it.rare);
  assert.strictEqual(rares.length, DG.rareCount, `${label} 稀有 ${DG.rareCount} 個`);
  assert.ok(rares.every((it) => it.id === G.rare));
  assert.strictEqual(ids.filter((id) => id === G.rare).length, DG.rareCount);
  assert.strictEqual(new Set(run.items.map((it) => `${it.x},${it.y}`)).size, run.items.length, `${label} 素材不重疊`);
  for (const it of run.items) assert.ok(dist[it.y * run.w + it.x] > 0, `${label} 素材走得到`);
  // 出生點 nearItem 步內至少有 1 個素材
  assert.ok(run.items.some((it) => dist[it.y * run.w + it.x] <= DG.nearItem), `${label} 出生點 ${DG.nearItem} 格內有素材`);
  // 稀有位置隨機，但一定在步數預算內走得到；素材只會在房間地面或走廊上
  for (const it of rares) assert.ok(dist[it.y * run.w + it.x] <= DG.steps * DG.rareReach, `${label} 稀有走得到`);
  for (const it of run.items) assert.ok('.,'.includes(run.tiles[it.y][it.x]), `${label} 素材在草地或走廊`);
  // 侍衛一開始不在場
  assert.strictEqual(run.guards.length, 0, `${label} 開場沒有侍衛`);
}

test('buildGatherDungeon：200 個 seed 都滿足生成不變式（連通、素材、出生點旁有素材、稀有走得到、開場無侍衛）', () => {
  for (let seed = 1; seed <= 200; seed++) assertDungeon(E.buildGatherDungeon(D, fresh(), 'garden', lcg(seed)), `seed ${seed}`);
});

test('太醫院：同一套生成，200 個 seed 都滿足不變式（麝香正好 1 個、房間 6～8 且較小）；極端 rand 也合格', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const run = E.buildGatherDungeon(D, fresh(), 'taiyi', lcg(seed));
    assert.strictEqual(run.loc, 'taiyi');
    assert.strictEqual(run.rare, 'musk');
    assertDungeon(run, `taiyi seed ${seed}`);
  }
  for (const v of [0, 0.999, 0.5]) assertDungeon(E.buildGatherDungeon(D, fresh(), 'taiyi', () => v), `taiyi rand=${v}`);
});

test('太醫院 fuzz：300 局隨機操作都會結束、侍衛照時程登場、被抓時記下是誰抓的、收穫可套用', () => {
  const acts = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
  let caught = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const rand = lcg(seed * 7 + 1);
    const S = fresh();
    const run = E.buildGatherDungeon(D, S, 'taiyi', rand);
    let n = 0;
    while (!run.over) {
      E.gatherStep(run, acts[Math.floor(rand() * acts.length)], rand);
      assert.ok(++n < 2000, `seed ${seed} 沒有結束`);
      const used = run.maxSteps - run.stepsLeft;
      assert.ok(run.guards.length <= (used >= 30 ? 2 : used >= 10 ? 1 : 0));
    }
    assert.deepStrictEqual(JSON.parse(JSON.stringify(run)), run);
    if (run.endReason === 'caught') { caught++; assert.ok(run.caughtBy >= 0 && run.caughtBy < run.guards.length); } else assert.strictEqual(run.caughtBy, -1);
    const haul = E.applyGatherHaul(D, S, 'taiyi', run.got);
    assert.strictEqual(haul.loc, 'taiyi');
    for (const [id, c] of Object.entries(run.got)) assert.ok(S.inv[id] >= c);
  }
  assert.ok(caught > 0, '至少有幾局被抓');
});

test('採集地圖資料：每張地下城地圖都有 tileset 與每名巡邏者的稱呼／sprite／提示／台詞', () => {
  for (const [loc, g] of Object.entries(D.GATHER)) {
    if (!g.dungeon) continue;
    for (const k of ['floor', 'hall']) assert.ok(Array.isArray(g.tileset[k]) && g.tileset[k].length, `${loc} tileset.${k}`);
    for (const k of ['wallTop', 'wallFace', 'door', 'big']) assert.ok(g.tileset[k], `${loc} tileset.${k}`);
    for (const k of ['#', 'P', 'F', 'R', 'L']) assert.ok(g.tileset.names[k], `${loc} tileset.names['${k}']（撞到時的提示）`);
    assert.ok(g.intro, `${loc} 進場開場白`);
    assert.strictEqual(Object.keys(g.tileset.props).sort().join(''), 'FLR', `${loc} 擺設`);
    assert.strictEqual(g.guards.length, g.dungeon.guardSpawns.length, `${loc} 巡邏者數＝登場時程數`);
    for (const gd of g.guards) for (const k of ['name', 'sprite', 'note', 'line']) assert.ok(gd[k], `${loc} guards.${k}`);
    assert.ok(g.table.some(([id]) => id === g.rare), `${loc} 稀有在素材表裡`);
  }
  assert.strictEqual(D.GATHER.taiyi.dungeon.rareCount, 1);
  assert.strictEqual(D.GATHER.taiyi.guards.map((gd) => gd.note).join('｜'), '藥童開始巡房了｜溫太醫睡醒了');
});

test('buildGatherDungeon：素材位置隨機——走廊上也會有素材、稀有不一定在最深的庭院', () => {
  let onPath = 0;
  let rareOnPath = 0;
  let rareNotDeepest = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const run = E.buildGatherDungeon(D, fresh(), 'garden', lcg(seed));
    const dist = E.gatherDist(run, run.player.x, run.player.y);
    const entry = run.rooms.map((r) => {
      let best = Infinity;
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const d = dist[y * run.w + x]; if (d >= 0 && d < best) best = d; }
      return best;
    });
    const deepest = Math.max(...entry.slice(1));
    for (const it of run.items) {
      const path = run.tiles[it.y][it.x] === ',';
      if (path) onPath++;
      if (it.rare && path) rareOnPath++;
      if (it.rare && (roomOf(run, it) < 0 || entry[roomOf(run, it)] < deepest)) rareNotDeepest++;
    }
  }
  assert.ok(onPath > 200, `走廊上的素材 ${onPath}`);
  assert.ok(rareOnPath > 20, `走廊上的稀有 ${rareOnPath}`);
  assert.ok(rareNotDeepest > 150, `不在最深庭院的稀有 ${rareNotDeepest}`);
});

test('buildGatherDungeon：極端 rand（恆 0／恆 0.999／恆 0.5）也會回傳合格地圖（重骰或保底布局）', () => {
  for (const v of [0, 0.999, 0.5]) assertDungeon(E.buildGatherDungeon(D, fresh(), 'garden', () => v), `rand=${v}`);
});

test('buildGatherDungeon：同 seed 兩次呼叫 → run state 完全相同；不同 seed → 地圖不同', () => {
  const a = E.buildGatherDungeon(D, fresh(), 'garden', lcg(42));
  const b = E.buildGatherDungeon(D, fresh(), 'garden', lcg(42));
  assert.deepStrictEqual(a, b);
  const c = E.buildGatherDungeon(D, fresh(), 'garden', lcg(43));
  assert.notDeepStrictEqual(a.tiles, c.tiles);
});

// ───────── 採集地下城：回合規則 gatherStep ─────────
// 手工小地圖：'Z' 玩家、'@' 侍衛、小寫 j/o/r 素材、'*' 稀有（癢癢粉），其餘是地形字元。
function mini(rows, opts = {}) {
  const run = {
    loc: 'garden', w: rows[0].length, h: rows.length, tiles: null, rooms: [], rare: 'itch',
    player: null, items: [], guards: [], maxSteps: 60, stepsLeft: 60, got: {}, picked: 0,
    seen: new Array(rows[0].length * rows.length).fill(0), over: false, endReason: null,
    cfg: { guardSight: 4.5, playerSight: 5.5, searchTurns: 3, wanderKeep: 0.7, wanderIdle: 0.1 },
    ...opts,
  };
  const ITEM = { j: 'jasmine', o: 'osmanthus', r: 'rose', '*': 'itch' };
  run.tiles = rows.map((row, y) => [...row].map((ch, x) => {
    if (ch === 'Z') { run.player = { x, y, face: 'down' }; return '.'; }
    if (ch === '@') { run.guards.push({ x, y, face: 'down', state: 'wander', dir: null, last: null, searchLeft: 0 }); return '.'; }
    if (ITEM[ch]) { run.items.push({ id: ITEM[ch], rare: ch === '*', x, y }); return '.'; }
    return ch;
  }).join(''));
  return run;
}
const types = (ev) => ev.map((e) => e.t);

test('gatherStep 移動：8 方向各走一格、步數 -1、事件 move', () => {
  const dirs = { n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0], nw: [-1, -1] };
  for (const [a, [dx, dy]] of Object.entries(dirs)) {
    const run = mini(['#####', '#...#', '#.Z.#', '#...#', '#####']);
    const ev = E.gatherStep(run, a, ZERO);
    assert.deepStrictEqual(types(ev), ['move'], a);
    assert.deepStrictEqual([run.player.x, run.player.y], [2 + dx, 2 + dy], a);
    assert.strictEqual(run.stepsLeft, 59, a);
    assert.deepStrictEqual(ev[0], { t: 'move', from: { x: 2, y: 2 }, to: { x: 2 + dx, y: 2 + dy } });
  }
});

test('gatherStep 撞牆／擺設／斜切牆角：位置與步數不變、事件 bump；自己撞上侍衛：當場被抓', () => {
  // 牆
  let run = mini(['#####', '#Z..#', '#...#', '#####']);
  assert.deepStrictEqual(types(E.gatherStep(run, 'n', ZERO)), ['bump']);
  assert.deepStrictEqual([run.player.x, run.player.y, run.stepsLeft], [1, 1, 60]);
  // 擺設（荷花池、花圃、假山、石燈籠都擋路）
  for (const prop of ['P', 'p', 'F', 'R', 'L']) {
    run = mini(['#####', `#Z${prop}.#`, '#...#', '#####']);
    assert.deepStrictEqual(types(E.gatherStep(run, 'e', ZERO)), ['bump'], prop);
    assert.strictEqual(run.stepsLeft, 60);
  }
  // 斜切牆角：往右下走，但右邊是牆
  run = mini(['#####', '#Z#.#', '#...#', '#####']);
  assert.deepStrictEqual(types(E.gatherStep(run, 'se', ZERO)), ['bump']);
  assert.deepStrictEqual([run.player.x, run.player.y, run.stepsLeft], [1, 1, 60]);
  // 自己走到侍衛站的格子：當場被抓，零溶不移動、不扣步
  run = mini(['#######', '#Z@...#', '#######']);
  run.got = { jasmine: 1 };
  assert.deepStrictEqual(E.gatherStep(run, 'e', ZERO), [{ t: 'caught', g: 0, self: true }]);
  assert.deepStrictEqual([run.player.x, run.player.y, run.stepsLeft], [1, 1, 60]);
  assert.deepStrictEqual([run.over, run.endReason], [true, 'caught']);
  assert.deepStrictEqual(run.got, { jasmine: 1 }, '收穫保留');
  assert.strictEqual(run.guards[0].face, 'left', '侍衛轉身面向零溶');
  assert.deepStrictEqual(E.gatherStep(run, 'w', ZERO), [], '結束後不再推進');
  // 斜向撞侍衛但會切牆角 → 只是撞牆，不算被抓
  run = mini(['#####', '#Z#.#', '#.@.#', '#####']);
  assert.deepStrictEqual(types(E.gatherStep(run, 'se', ZERO)), ['bump']);
  assert.strictEqual(run.over, false);
});

test('gatherStep 等待：步數 -1、侍衛照常行動', () => {
  const run = mini(['#########', '#Z#....@#', '#########']); // 中間有牆，侍衛看不到玩家
  const ev = E.gatherStep(run, 'wait', lcg(5));
  assert.strictEqual(ev[0].t, 'wait');
  assert.strictEqual(run.stepsLeft, 59);
  assert.ok(ev.some((e) => e.t === 'gmove'), '侍衛巡邏走了一格');
  assert.deepStrictEqual([run.player.x, run.player.y], [1, 1]);
});

test('gatherStep 撿取：走到素材上 → got++、素材移除、事件 pick（帶 rare），同一格不會重複計算', () => {
  const run = mini(['######', '#Zj*.#', '######']);
  let ev = E.gatherStep(run, 'e', ZERO);
  assert.deepStrictEqual(ev.find((e) => e.t === 'pick'), { t: 'pick', id: 'jasmine', rare: false, x: 2, y: 1 });
  assert.deepStrictEqual(run.got, { jasmine: 1 });
  assert.strictEqual(run.items.length, 1);
  ev = E.gatherStep(run, 'e', ZERO);
  assert.deepStrictEqual(ev.find((e) => e.t === 'pick'), { t: 'pick', id: 'itch', rare: true, x: 3, y: 1 });
  // 走回原格：已經沒有素材
  ev = E.gatherStep(run, 'w', ZERO);
  assert.ok(!ev.some((e) => e.t === 'pick'));
  assert.deepStrictEqual(run.got, { jasmine: 1, itch: 1 });
  assert.strictEqual(run.picked, 2);
});

test('gatherStep 發現與追擊：視野內且沒被樹籬擋 → alert 只在轉換時發一次、侍衛往玩家走一步', () => {
  const run = mini(['#########', '#Z...@..#', '#########']); // 距離 4 ≤ 4.5
  let ev = E.gatherStep(run, 'wait', ONE);
  assert.strictEqual(ev.filter((e) => e.t === 'alert').length, 1);
  assert.strictEqual(run.guards[0].state, 'chase');
  assert.deepStrictEqual(ev.find((e) => e.t === 'gmove'), { t: 'gmove', g: 0, from: { x: 5, y: 1 }, to: { x: 4, y: 1 } });
  assert.deepStrictEqual(run.guards[0].last, { x: 1, y: 1 });
  ev = E.gatherStep(run, 'wait', ONE);
  assert.strictEqual(ev.filter((e) => e.t === 'alert').length, 0, '已在追擊，不重複發 alert');
  assert.strictEqual(run.guards[0].x, 3);
});

test('gatherStep 發現：超出半徑或被樹籬擋住 → 不發現', () => {
  // 距離 5 > 4.5
  let run = mini(['##########', '#Z....@..#', '##########']);
  run.guards[0].dir = null;
  let ev = E.gatherStep(run, 'wait', () => 0.05); // 0.05：不沿原方向（沒有原方向）、第二擲 <0.1 → 原地停
  assert.ok(!ev.some((e) => e.t === 'alert'));
  assert.strictEqual(run.guards[0].state, 'wander');
  // 距離 2 但中間是樹籬
  run = mini(['#####', '#Z#@#', '#.#.#', '#####']);
  ev = E.gatherStep(run, 'wait', () => 0.05);
  assert.ok(!ev.some((e) => e.t === 'alert'));
  assert.strictEqual(run.guards[0].state, 'wander');
  // 擺設不擋視線
  run = mini(['######', '#ZF.@#', '######']);
  ev = E.gatherStep(run, 'wait', ONE);
  assert.ok(ev.some((e) => e.t === 'alert'), '花圃不擋視線');
});

test('gatherStep 跟丟：追到最後看見的位置仍看不到 → lost、張望 searchTurns 回合後回巡邏（calm）', () => {
  // 玩家躲進牆後；侍衛已在追擊、正站在最後看見的位置
  const run = mini(['#######', '#Z#...#', '#.#.@.#', '#...#.#', '#######']);
  Object.assign(run.guards[0], { state: 'chase', last: { x: 4, y: 2 } });
  let ev = E.gatherStep(run, 'wait', ONE);
  assert.ok(ev.some((e) => e.t === 'lost'));
  assert.strictEqual(run.guards[0].state, 'search');
  assert.strictEqual(run.guards[0].searchLeft, 3);
  assert.ok(!ev.some((e) => e.t === 'gmove'), '張望時不移動');
  E.gatherStep(run, 'wait', ONE);
  E.gatherStep(run, 'wait', ONE);
  assert.strictEqual(run.guards[0].state, 'search');
  ev = E.gatherStep(run, 'wait', ONE);
  assert.ok(ev.some((e) => e.t === 'calm'));
  assert.strictEqual(run.guards[0].state, 'wander');
});

test('gatherStep 被抓：侍衛回合開始時能合法一步走到玩家 → caught；剛走到相鄰格那回合不算', () => {
  // 距離 2：這回合侍衛走到相鄰格，不抓
  const run = mini(['######', '#Z.@.#', '######']);
  let ev = E.gatherStep(run, 'wait', ONE);
  assert.ok(!ev.some((e) => e.t === 'caught'), '剛貼上來的那回合不算抓');
  assert.strictEqual(run.guards[0].x, 2);
  assert.strictEqual(run.over, false);
  // 下一回合還待在原地 → 被抓
  ev = E.gatherStep(run, 'wait', ONE);
  assert.deepStrictEqual(ev[ev.length - 1], { t: 'caught', g: 0 });
  assert.strictEqual(run.over, true);
  assert.strictEqual(run.endReason, 'caught');
});

test('gatherStep 被抓：玩家有一回合可以逃；斜向隔著牆角不算相鄰可抓', () => {
  // 貼上來之後玩家往反方向走 → 侍衛追一格，仍只是相鄰、沒被抓
  let run = mini(['#######', '#..Z@.#', '#######']);
  // 侍衛已相鄰：玩家先走開
  let ev = E.gatherStep(run, 'w', ONE);
  assert.ok(!ev.some((e) => e.t === 'caught'), '走開就逃掉');
  assert.strictEqual(run.over, false);
  // 斜向相鄰但被牆角卡住（侍衛不能斜切過去）→ 不算抓
  run = mini(['#####', '#Z#.#', '#.@.#', '#####']);
  // 玩家 (1,1)、侍衛 (2,2)：斜走要經過 (2,1) 牆，不合法
  ev = E.gatherStep(run, 'wait', ONE);
  assert.ok(!ev.some((e) => e.t === 'caught'), '斜切牆角抓不到');
  assert.strictEqual(run.over, false);
});

test('gatherStep 步數用完：第 60 步結算後 timeout；同一回合被抓優先', () => {
  let run = mini(['#####', '#Z..#', '#####'], { stepsLeft: 1 });
  let ev = E.gatherStep(run, 'e', ZERO);
  assert.deepStrictEqual(types(ev), ['move', 'timeout']);
  assert.strictEqual(run.endReason, 'timeout');
  assert.strictEqual(run.stepsLeft, 0);
  // 最後一步同時被抓 → caught
  run = mini(['#####', '#Z@.#', '#####'], { stepsLeft: 1 });
  ev = E.gatherStep(run, 'wait', ZERO);
  assert.strictEqual(run.endReason, 'caught');
  assert.ok(!ev.some((e) => e.t === 'timeout'));
});

test('gatherStep 收工：endReason quit、不扣步、侍衛不動；結束後再呼叫不產生變化', () => {
  const run = mini(['######', '#Z..@#', '######']);
  const guards = JSON.stringify(run.guards);
  assert.deepStrictEqual(E.gatherStep(run, 'quit', ZERO), [{ t: 'quit' }]);
  assert.strictEqual(run.endReason, 'quit');
  assert.strictEqual(run.stepsLeft, 60);
  assert.strictEqual(JSON.stringify(run.guards), guards);
  const snap = JSON.stringify(run);
  assert.deepStrictEqual(E.gatherStep(run, 'e', ZERO), []);
  assert.deepStrictEqual(E.gatherStep(run, 'wait', ZERO), []);
  assert.strictEqual(JSON.stringify(run), snap);
});

test('gatherFov：樹籬擋視線（牆面本身看得到、牆後看不到）、半徑外看不到', () => {
  const run = mini(['#########', '#Z..#...#', '#########']);
  const fov = new Set(E.gatherFov(run, 1, 1, 5.5));
  const k = (x, y) => y * run.w + x;
  assert.ok(fov.has(k(3, 1)), '空地看得到');
  assert.ok(fov.has(k(4, 1)), '牆面看得到');
  assert.ok(!fov.has(k(5, 1)), '牆後看不到');
  const open = mini(['##########', '#Z.......#', '##########']);
  const far = new Set(E.gatherFov(open, 1, 1, 5.5));
  assert.ok(far.has(1 * open.w + 6) && !far.has(1 * open.w + 7), '半徑 5.5 → 看到 5 格外、看不到 6 格外');
});

test('侍衛登場：前 10 步不在場；走滿 10 步來第一名（離玩家 ≥8 格）、走滿 30 步來第二名（≥5 格），登場那回合不行動', () => {
  const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const [first, second] = DG.guardSpawns;
  assert.deepStrictEqual([first.step, first.minDist, second.step, second.minDist], [10, 8, 30, 5]);
  for (let seed = 1; seed <= 100; seed++) {
    const rand = lcg(seed * 11 + 2);
    const run = E.buildGatherDungeon(D, fresh(), 'garden', rand);
    const acts = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw', 'wait'];
    const seenSpawns = [];
    while (!run.over) {
      const ev = E.gatherStep(run, acts[Math.floor(rand() * acts.length)], rand);
      const taken = run.maxSteps - run.stepsLeft;
      for (const e of ev.filter((x) => x.t === 'spawn')) {
        const spec = DG.guardSpawns[e.g];
        assert.strictEqual(taken, spec.step, `seed ${seed} 第 ${e.g + 1} 名在第 ${spec.step} 步登場`);
        assert.ok(cheb(e, run.player) >= spec.minDist, `seed ${seed} 第 ${e.g + 1} 名離玩家 ≥${spec.minDist} 格`);
        assert.ok(E.gatherDist(run, run.player.x, run.player.y)[e.y * run.w + e.x] >= spec.minDist, '走路距離也至少這麼遠');
        assert.deepStrictEqual([run.guards[e.g].x, run.guards[e.g].y], [e.x, e.y], '登場那回合不行動');
        assert.ok(!ev.some((x) => x.t === 'gmove' && x.g === e.g));
        seenSpawns.push(e.g);
      }
      if (taken < first.step) assert.strictEqual(run.guards.length, 0, `seed ${seed} 前 ${first.step} 步沒有侍衛`);
      else if (taken < second.step && !run.over) assert.strictEqual(run.guards.length, 1, `seed ${seed} 第 ${second.step} 步前只有 1 名`);
    }
    if (run.endReason === 'timeout') assert.deepStrictEqual(seenSpawns, [0, 1], `seed ${seed} 走完 60 步兩名都登場過`);
  }
});

test('視線是對稱的：侍衛看得到玩家 ⇔ 玩家看得到侍衛（同半徑；含牆角的不對稱案例與 100 張隨機地圖）', () => {
  // Bresenham 從 (2,1)→(0,0) 與 (0,0)→(2,1) 經過的格子不同；兩個方向的結果必須一致
  const run = mini(['.#.', '.#.']);
  const k = (x, y) => y * run.w + x;
  assert.strictEqual(E.gatherFov(run, 2, 1, 4.5).includes(k(0, 0)), E.gatherFov(run, 0, 0, 4.5).includes(k(2, 1)));
  for (let seed = 1; seed <= 100; seed++) {
    const rand = lcg(seed * 17 + 3);
    const d = E.buildGatherDungeon(D, fresh(), 'garden', rand);
    const open = [];
    for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) if (WALK.includes(d.tiles[y][x])) open.push([x, y]);
    for (let i = 0; i < 30; i++) {
      const [ax, ay] = open[Math.floor(rand() * open.length)];
      for (const kb of E.gatherFov(d, ax, ay, 4.5)) {
        const bx = kb % d.w;
        const by = Math.floor(kb / d.w);
        if (!WALK.includes(d.tiles[by][bx])) continue;
        assert.ok(E.gatherFov(d, bx, by, 4.5).includes(ay * d.w + ax), `seed ${seed}: (${ax},${ay}) 看得到 (${bx},${by})，反過來卻看不到`);
      }
    }
  }
});

test('採集地下城 fuzz：500 局隨機操作都在 ≤60 步內結束、不丟例外、state 可 JSON 來回，收穫可套用', () => {
  const acts = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw', 'wait'];
  const reasons = new Set();
  for (let seed = 1; seed <= 500; seed++) {
    const rand = lcg(seed * 31 + 7);
    const S = fresh();
    const run = E.buildGatherDungeon(D, S, 'garden', rand);
    let calls = 0;
    while (!run.over) {
      E.gatherStep(run, acts[Math.floor(rand() * acts.length)], rand);
      assert.ok(++calls < 5000, `seed ${seed} 沒有結束`);
    }
    assert.ok(run.maxSteps - run.stepsLeft <= 60, `seed ${seed} 超過 60 步`);
    assert.ok(run.stepsLeft >= 0);
    assert.ok(['caught', 'timeout'].includes(run.endReason));
    reasons.add(run.endReason);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(run)), run, `seed ${seed} state 可序列化`);
    const haul = E.applyGatherHaul(D, S, 'garden', run.got);
    assert.strictEqual(S.slot, 1);
    assert.strictEqual(Object.values(haul.got).reduce((a, b) => a + b, 0), run.picked);
  }
  assert.strictEqual(reasons.size, 2, 'fuzz 應同時涵蓋被抓與步數用完');
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
