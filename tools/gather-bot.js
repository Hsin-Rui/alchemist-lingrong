// 採集地下城的機器人玩家（給 tools/simulate.js 用）。規則全走引擎的 buildGatherDungeon／gatherStep。
// 機器人只用玩家看得到的資訊：看過的格子、看過的素材、現在看得到的侍衛。
//   careful：看得到侍衛就閃（不走到侍衛一步可達的格子；被追時往離侍衛最遠的方向跑）
//   greedy ：完全不管侍衛，直奔最近的素材（下限參考）
const E = require('../js/engine.js');

const DIRS = E.GATHER_DIRS;

function chooseMove(run, careful, mem = {}) {
  const p = run.player;
  const W = run.w;
  const fov = new Set(E.gatherFov(run, p.x, p.y, run.cfg.playerSight));
  const guards = run.guards.filter((g) => fov.has(g.y * W + g.x));
  const gCells = new Set(run.guards.map((g) => g.y * W + g.x));
  const here = E.gatherDist(run, p.x, p.y, gCells);

  // 目標：最近的已知素材；沒有就去最近的「探索邊界」（看過、可走、旁邊有沒看過的格子）
  let target = null;
  let best = Infinity;
  for (const it of run.items) {
    const k = it.y * W + it.x;
    if (run.seen[k] && here[k] > 0 && here[k] < best) { best = here[k]; target = [it.x, it.y]; }
  }
  // 探索目標一旦選定就走到底（不然每步重選會在兩個邊界之間來回）
  if (!target && mem.explore && here[mem.explore[1] * W + mem.explore[0]] > 0) target = mem.explore;
  if (!target) {
    for (let y = 0; y < run.h; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x;
      if (!(here[k] > 0) || here[k] >= best) continue;
      let edge = false;
      for (const [dx, dy] of Object.values(DIRS)) {
        const xx = x + dx; const yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < run.h && !run.seen[yy * W + xx]) { edge = true; break; }
      }
      if (edge) { best = here[k]; target = [x, y]; }
    }
    mem.explore = target;
  }
  const toT = target ? E.gatherDist(run, target[0], target[1], gCells) : null;

  const moves = Object.entries(DIRS).filter(([, [dx, dy]]) => E.gatherCanStep(run, p.x, p.y, dx, dy) && !gCells.has((p.y + dy) * W + p.x + dx));
  if (!moves.length) return 'n';
  const gd = careful ? guards.map((g) => E.gatherDist(run, g.x, g.y)) : [];
  const danger = guards.some((g) => g.state === 'chase' || Math.max(Math.abs(g.x - p.x), Math.abs(g.y - p.y)) <= 4);
  const score = ([, [dx, dy]]) => {
    const k = (p.y + dy) * W + p.x + dx;
    const goal = toT && toT[k] >= 0 ? toT[k] : 99;
    if (!careful || !gd.length) return -goal;
    const near = Math.min(...gd.map((d) => (d[k] < 0 ? 99 : d[k])));
    if (near <= 1) return -1000 - goal; // 走過去下一回合就被抓
    if (danger) return near * 10 - goal; // 被追：先拉開距離，再顧目標
    return (near <= 2 ? -50 : 0) - goal;
  };
  moves.sort((a, b) => score(b) - score(a));
  return moves[0][0];
}

// 玩一趟，回 run（got、endReason、picked…）
function playDungeon(D, loc, rand, { careful = true } = {}) {
  const run = E.buildGatherDungeon(D, null, loc, rand);
  let guard = 0;
  const mem = {};
  while (!run.over && guard++ < 500) E.gatherStep(run, chooseMove(run, careful, mem), rand);
  return run;
}

module.exports = { playDungeon, chooseMove };

if (require.main === module) {
  const { loadData, mulberry32 } = require('./simulate.js');
  const D = loadData();
  const N = Number(process.argv[2]) || 2000;
  for (const loc of Object.keys(D.GATHER).filter((l) => D.GATHER[l].dungeon)) {
    for (const careful of [true, false]) {
      const rand = mulberry32(99);
      const acc = { n: 0, caught: 0, rare: 0, items: {}, caughtAt: 0 };
      for (let i = 0; i < N; i++) {
        const run = playDungeon(D, loc, rand, { careful });
        acc.n += run.picked;
        if (run.endReason === 'caught') { acc.caught++; acc.caughtAt += run.maxSteps - run.stepsLeft; }
        if (run.got[run.rare]) acc.rare++;
        for (const [id, c] of Object.entries(run.got)) acc.items[id] = (acc.items[id] || 0) + c;
      }
      const g = D.GATHER[loc];
      console.log(`${g.name}｜${careful ? '會躲' : '不躲'}：平均撿 ${(acc.n / N).toFixed(1)} 個｜被抓 ${(acc.caught / N * 100).toFixed(0)}%（平均第 ${(acc.caughtAt / Math.max(1, acc.caught)).toFixed(0)} 步）｜拿到稀有 ${(acc.rare / N * 100).toFixed(0)}%｜`
        + Object.entries(acc.items).map(([id, c]) => `${D.ITEMS[id].name} ${(c / N).toFixed(2)}`).join('、'));
    }
  }
}
