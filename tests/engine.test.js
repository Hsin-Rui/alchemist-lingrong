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
