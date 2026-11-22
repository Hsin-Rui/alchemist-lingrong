// 像素美術資料格式檢查（規範：docs/pixel-art-spec.md §2.1、§3）。
// js/pixelart.js 是純資料，Node 直接載入。執行：node --test tests/
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const P = require('../js/pixelart.js');
const SIZE = { tile: [16, 16], actor: [16, 24], pond: [32, 32], bubble: [8, 10], shadow: [12, 4] };

test('pixelart：每張 sprite 的列數＝h、每列長度＝w、字元都在調色盤裡、不超過 16 色', () => {
  for (const [id, sp] of Object.entries(P.sprites)) {
    if (sp.mirror) continue;
    assert.strictEqual(sp.rows.length, sp.h, `${id} 列數`);
    sp.rows.forEach((row, y) => {
      assert.strictEqual(row.length, sp.w, `${id} 第 ${y} 列長度`);
      for (const ch of row) assert.ok(Object.prototype.hasOwnProperty.call(P.palette, ch), `${id} 第 ${y} 列有調色盤外的字元 ${ch}`);
    });
    assert.ok(new Set(sp.rows.join('')).size <= 16, `${id} 超過 16 色`);
  }
});

test('pixelart：mirror 的目標存在且不是另一個 mirror', () => {
  for (const [id, sp] of Object.entries(P.sprites)) {
    if (!sp.mirror) continue;
    assert.ok(P.sprites[sp.mirror] && P.sprites[sp.mirror].rows, `${id} 的 mirror 目標 ${sp.mirror}`);
  }
});

test('pixelart：規範 §3 的必備 id 一個不缺，尺寸符合規格', () => {
  const need = [
    'grass_0', 'grass_1', 'grass_2', 'path_0', 'path_1', 'hedge_top', 'hedge_face', 'gate',
    'pond_0', 'pond_1', 'flowerbed', 'rock', 'lantern', 'shadow',
    'jasmine', 'osmanthus', 'rose', 'itch_0', 'itch_1',
    'bubble_alert', 'bubble_lost', 'sparkle_0', 'sparkle_1', 'sparkle_2',
  ];
  for (const who of ['ling', 'guard']) for (const dir of ['down', 'up', 'left', 'right']) for (const f of [0, 1, 2]) need.push(`${who}_${dir}_${f}`);
  const size = (id) => { const sp = P.sprites[id]; const src = sp.mirror ? P.sprites[sp.mirror] : sp; return [src.w, src.h]; };
  for (const id of need) {
    assert.ok(P.sprites[id], `缺 ${id}`);
    const want = /^(ling|guard)_/.test(id) || id === 'rock' || id === 'lantern' ? SIZE.actor
      : id.startsWith('pond') ? SIZE.pond : id.startsWith('bubble') ? SIZE.bubble : id === 'shadow' ? SIZE.shadow : SIZE.tile;
    assert.deepStrictEqual(size(id), want, `${id} 尺寸`);
  }
  for (const id of need) assert.ok(P.required.includes(id), `required 清單缺 ${id}`);
});

test('pixelart：地面圖塊不透明（可無縫鋪滿）、角色與素材有透明底與深色外框', () => {
  for (const id of ['grass_0', 'grass_1', 'grass_2', 'path_0', 'path_1', 'hedge_top', 'hedge_face', 'gate']) {
    assert.ok(!P.sprites[id].rows.join('').includes('.'), `${id} 不該有透明像素`);
  }
  for (const id of ['ling_down_0', 'guard_down_0', 'jasmine', 'osmanthus', 'rose', 'itch_0']) {
    const all = P.sprites[id].rows.join('');
    assert.ok(all.includes('.') && all.includes('k'), `${id} 要有透明底和外框`);
  }
});

test('pixelart：動畫引用的幀都存在；地下城資料指定的素材都有對應的地上圖示', () => {
  for (const [name, ids] of Object.entries(P.anims)) for (const id of ids) assert.ok(P.sprites[id], `anims.${name} 引用了不存在的 ${id}`);
  const vm = require('vm');
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js/data.js'), 'utf8'), ctx);
  const g = ctx.window.GAME_DATA.GATHER.garden;
  for (const [id] of g.table) assert.ok(P.sprites[id] || P.sprites[`${id}_0`], `素材 ${id} 沒有像素圖`);
  assert.ok(P.sprites[`${g.rare}_0`] && P.sprites[`${g.rare}_1`], '稀有素材要有 2 幀閃光');
});

test('pixelart.js 是純資料：原始碼不碰 DOM／計時器', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js/pixelart.js'), 'utf8').replace(/\/\/[^\n]*/g, '');
  assert.ok(!/\bdocument\b|localStorage|setTimeout|requestAnimationFrame|Math\.random/.test(src));
});
