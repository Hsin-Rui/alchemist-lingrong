// 純遊戲引擎（functional core）。
// 不依賴 DOM / localStorage / Math.random：資料一律以參數 D（= GAME_DATA）傳入，
// 需要隨機的函式（後續加入）以注入的 rand 取用。
// 雙匯出：瀏覽器掛在 window.GameEngine，node 透過 module.exports。
(function () {
  'use strict';

  function newState(D) {
    const R = D.RULES;
    return {
      day: 1, slot: 0, silver: R.silver,
      favor: { ...R.favor },
      friend: { ...R.friend },
      conc: Object.fromEntries(D.TARGETS.map((t) => [t, { status: R.status[t], preg: 0, musk: 0, debuff: null }])),
      inv: { ...R.startInv },
      orders: [], hand: [], seq: 0,
      flip: null, bribe: 0, bribedToday: false, groundUntil: 0,
      noFlipNights: 0, empressBoost: false, tired: false,
      stats: { spikesUsed: 0, success: 0, caught: 0, groundedDays: 0, victims: [], ruined: [], sings: 0, bribes: 0, junk: 0, births: 0, muskRuin: 0 },
      log: [], dayLog: [], result: null,
    };
  }

  // 封號判定：吃整個 S（部分條件讀 S.friend，不只 S.stats）；D 供部分條件取 TARGETS。
  // 判定順序與 D.TITLES 無關；D.TITLES 的排序決定誰是主封號。
  const TITLE_CHECK = {
    shexiang: (S) => S.stats.muskRuin > 0,
    shuangmian: (S, D) => S.stats.victims.length === 3 && S.stats.caught === 0 && D.TARGETS.every((t) => S.friend[t] >= 35),
    duanzi: (S) => ['meizhuang', 'zhenhuan'].every((t) => S.stats.ruined.includes(t)),
    wentaiyi: (S) => S.stats.caught >= 2,
    guimi: (S, D) => D.TARGETS.every((t) => S.friend[t] >= 40),
    baimang: (S) => S.stats.spikesUsed > 0 && S.stats.success === 0,
    jingshi: (S) => S.stats.bribes >= 2,
    miaoyin: (S) => S.stats.sings >= 2,
    bailian: (S) => S.stats.spikesUsed === 0,
    heian: (S) => S.stats.junk >= 1,
    zhongsi: (S) => S.stats.births >= 1,
    touming: () => false,
  };

  // 純函式：before 是之前的封號冊（由外殼傳入）；不碰 localStorage、不存檔。
  function computeEnding(D, S, before) {
    before = before || [];
    const f = S.favor;
    const grounded = S.day <= S.groundUntil;
    const rank = 1 + D.TARGETS.filter((t) => f[t] >= f.lingrong).length;
    const top = rank === 1 ? 'lingrong' : D.TARGETS.reduce((a, b) => (f[b] > f[a] ? b : a));
    const opening = [D.END_TOP[top]];
    if (top !== 'lingrong') opening.push(D.END_LING[grounded ? 'grounded' : rank]);
    let titles = D.TITLES.filter((t) => TITLE_CHECK[t.id](S, D));
    if (!titles.length) titles = [D.TITLES.find((t) => t.id === 'touming')];
    const book = [...new Set([...before, ...titles.map((t) => t.id)])];
    return {
      rank, top, opening,
      main: titles[0], extra: titles.slice(1), book,
      fresh: titles.map((t) => t.id).filter((id) => !before.includes(id)),
    };
  }

  const API = { newState, TITLE_CHECK, computeEnding };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.GameEngine = API;
})();
