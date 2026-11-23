// 鍵盤游標幾何核心（js/focusnav.js）的單元測試。
// 執行：node --test tests/
const { test } = require('node:test');
const assert = require('node:assert');
const FN = require('../js/focusnav.js');

const R = (id, left, top, width = 40, height = 20) => ({ id, left, top, width, height });

// 3×3 格子：每格 40×20，間距 20
//  a b c
//  d e f
//  g h i
const grid = [
  R('a', 0, 0), R('b', 60, 0), R('c', 120, 0),
  R('d', 0, 40), R('e', 60, 40), R('f', 120, 40),
  R('g', 0, 80), R('h', 60, 80), R('i', 120, 80),
];
const at = (id) => grid.find((r) => r.id === id);
const go = (id, dir) => { const r = FN.pick(at(id), grid, dir); return r && r.id; };

test('四個方向各找到正鄰居', () => {
  assert.strictEqual(go('e', 'up'), 'b');
  assert.strictEqual(go('e', 'down'), 'h');
  assert.strictEqual(go('e', 'left'), 'd');
  assert.strictEqual(go('e', 'right'), 'f');
});

test('到邊緣回 null（不繞回）', () => {
  assert.strictEqual(go('a', 'up'), null);
  assert.strictEqual(go('a', 'left'), null);
  assert.strictEqual(go('i', 'down'), null);
  assert.strictEqual(go('i', 'right'), null);
  assert.strictEqual(go('b', 'up'), null);
});

test('空候選或只有自己回 null；未知方向回 null', () => {
  assert.strictEqual(FN.pick(at('e'), [], 'down'), null);
  assert.strictEqual(FN.pick(at('e'), undefined, 'down'), null);
  assert.strictEqual(FN.pick(at('e'), [at('e')], 'down'), null);
  assert.strictEqual(FN.pick(at('e'), grid, 'diagonal'), null);
});

test('偏軸較近者勝：稍遠但對齊的贏過較近但偏很多的', () => {
  const from = R('from', 100, 0);
  const aligned = R('aligned', 100, 60); // 正下方，主軸邊距 40
  const skewed = R('skewed', 220, 30); // 主軸邊距 10，但水平偏 80
  assert.strictEqual(FN.pick(from, [skewed, aligned], 'down').id, 'aligned');
});

test('同一排的鄰居不算「下方」', () => {
  const from = R('from', 0, 0);
  const side = R('side', 60, 0);
  const below = R('below', 0, 200);
  assert.strictEqual(FN.pick(from, [side, below], 'down').id, 'below');
});

test('最右邊再按 → 不會跳到上方偏遠、主軸重疊的元素', () => {
  // 底部導覽列最右顆（400..476）與右上角的小按鈕（430..470，在很上面）
  const sleepBtn = R('sleep', 400, 800, 76, 54);
  const mute = R('mute', 430, 10, 40, 40);
  assert.strictEqual(FN.pick(sleepBtn, [mute], 'right'), null);
  // 但完全在右邊、只是偏下一些的仍可到達
  const lower = R('lower', 500, 870, 40, 40);
  assert.strictEqual(FN.pick(sleepBtn, [mute, lower], 'right').id, 'lower');
});

test('左上角的小按鈕往下：可到右下方整個在下面的按鈕', () => {
  const back = R('back', 10, 10, 40, 40);
  const buy = R('buy', 380, 200, 60, 36);
  assert.strictEqual(FN.pick(back, [buy], 'down').id, 'buy');
});

test('寬按鈕往下到一排小按鈕：挑中心最近的那顆', () => {
  const wide = R('wide', 0, 0, 300, 40);
  const nav = [0, 1, 2, 3, 4, 5].map((i) => R(`n${i}`, i * 50, 100, 50, 50));
  // 中心 150：n2（125）與 n3（175）等距，必定是中間兩顆之一
  const id = FN.pick(wide, nav, 'down').id;
  assert.ok(id === 'n2' || id === 'n3');
});

test('resolve：保留／回預設／第一個／空', () => {
  assert.strictEqual(FN.resolve('x', ['a', 'x'], 'a'), 'x');
  assert.strictEqual(FN.resolve('gone', ['a', 'b'], 'b'), 'b');
  assert.strictEqual(FN.resolve('gone', ['a', 'b'], null), 'a');
  assert.strictEqual(FN.resolve(null, ['a', 'b'], 'missing'), 'a');
  assert.strictEqual(FN.resolve('a', [], 'a'), null);
});
